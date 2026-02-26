// TRACK'D - Background Service Worker
// Handles communication between content scripts and the API

const DEFAULT_API_URL = 'https://trakthat.app';
let cachedApiUrl = null;

// ── Batch queue state ─────────────────────────────────────────────────────────
let batchQueue    = [];
let batchProgress = { total: 0, done: 0, success: 0, errors: 0, djName: '' };
let batchRunning  = false;

// Concurrent tab workers — process N tabs at once
const MAX_CONCURRENT = 3;
let activeTabs = new Map(); // tabId → { timer, url }

async function processBatchQueue() {
  if (!batchRunning) return;

  // Fill up to MAX_CONCURRENT active tabs
  while (activeTabs.size < MAX_CONCURRENT && batchQueue.length > 0) {
    const url = batchQueue.shift();
    const idx = batchProgress.done + activeTabs.size + 1;
    console.log(`[TRACK'D] Batch: opening ${url} (${idx}/${batchProgress.total})`);

    try {
      const tab = await chrome.tabs.create({ url, active: false });

      // Timeout fallback — skip if no response within 25s
      const timer = setTimeout(() => {
        if (activeTabs.has(tab.id)) {
          console.warn('[TRACK\'D] Batch tab timed out:', url);
          activeTabs.delete(tab.id);
          batchProgress.errors++;
          batchProgress.done++;
          chrome.tabs.remove(tab.id).catch(() => {});
          processBatchQueue(); // Fill the slot
        }
      }, 25000);

      activeTabs.set(tab.id, { timer, url });
    } catch (err) {
      console.error('[TRACK\'D] Batch tab create failed:', err);
      batchProgress.errors++;
      batchProgress.done++;
    }
  }

  // Check if we're completely done
  if (batchQueue.length === 0 && activeTabs.size === 0) {
    batchRunning = false;
    console.log('[TRACK\'D] Batch complete:', batchProgress);
  }
}

function handleBatchTabComplete(tabId, success) {
  const entry = activeTabs.get(tabId);
  if (!entry) return;

  clearTimeout(entry.timer);
  activeTabs.delete(tabId);

  if (success) batchProgress.success++;
  else         batchProgress.errors++;
  batchProgress.done++;

  chrome.tabs.remove(tabId).catch(() => {});

  // Tiny delay then fill the slot
  setTimeout(processBatchQueue, 500);
}

// Get API URL from storage or use default
async function getApiUrl() {
  if (cachedApiUrl) return cachedApiUrl;
  const result = await chrome.storage.sync.get(['apiUrl']);
  cachedApiUrl = result.apiUrl || DEFAULT_API_URL;
  return cachedApiUrl;
}

// Send scraped data to the API
async function sendToApi(data) {
  const apiUrl = await getApiUrl();

  console.log("[TRACK'D] Sending to API:", apiUrl);
  console.log("[TRACK'D] Payload:", {
    source: data.source,
    tracksCount: data.tracks?.length,
    artistsCount: data.artists?.length,
  });

  const payload = { ...data, chromeExtension: true };

  try {
    const response = await fetch(`${apiUrl}/api/chrome-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let responseBody;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = { error: await response.text() };
    }

    console.log("[TRACK'D] API Response Status:", response.status);
    console.log("[TRACK'D] API Response Body:", responseBody);

    if (!response.ok) {
      const errorMessage = responseBody.error || responseBody.message || `${response.status} ${response.statusText}`;
      if (response.status === 500 && errorMessage.includes('Database not configured')) {
        throw new Error('Database not configured on server.');
      }
      throw new Error(errorMessage);
    }

    return responseBody;
  } catch (error) {
    console.error("[TRACK'D] API Error:", error);
    if (error.message === 'Failed to fetch') {
      throw new Error('Could not connect to API.');
    }
    throw error;
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_RESULT') {
    chrome.storage.local.set({ lastScrape: message.data });
    sendResponse({ success: true });
  }

  if (message.type === 'SEND_TO_API') {
    const tabId = sender.tab?.id;
    const isBatchTab = batchRunning && tabId != null && activeTabs.has(tabId);
    sendToApi(message.data)
      .then(result => {
        sendResponse({ success: true, result });
        if (isBatchTab) handleBatchTabComplete(tabId, true);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
        if (isBatchTab) handleBatchTabComplete(tabId, false);
      });
    return true;
  }

  if (message.type === 'BATCH_START') {
    // ADDITIVE — append new URLs to existing queue
    const newUrls = message.urls || [];
    // Dedupe against what's already queued
    const queued = new Set(batchQueue);
    const unique = newUrls.filter(u => !queued.has(u));
    batchQueue.push(...unique);
    batchProgress.total += unique.length;
    batchProgress.djName = message.djName || batchProgress.djName;

    if (!batchRunning) {
      batchRunning = true;
      // Reset counters only if starting fresh
      if (batchProgress.done === batchProgress.total - unique.length) {
        // Continuing from zero
      }
    }

    // Ensure auto-scrape is on for batch mode
    chrome.storage.sync.set({ autoScrape: true, batchMode: true });
    processBatchQueue();
    sendResponse({ success: true, total: batchProgress.total, queued: unique.length });
    return true;
  }

  if (message.type === 'BATCH_STOP') {
    batchRunning = false;
    batchQueue   = [];
    // Clear all active tabs
    for (const [tabId, entry] of activeTabs) {
      clearTimeout(entry.timer);
      chrome.tabs.remove(tabId).catch(() => {});
    }
    activeTabs.clear();
    chrome.storage.sync.set({ batchMode: false });
    sendResponse({ success: true });
  }

  if (message.type === 'BATCH_STATUS') {
    sendResponse({
      running: batchRunning,
      progress: { ...batchProgress, queued: batchQueue.length, active: activeTabs.size },
    });
    return true;
  }

  if (message.type === 'GET_LAST_SCRAPE') {
    chrome.storage.local.get(['lastScrape'], (result) => {
      sendResponse({ data: result.lastScrape });
    });
    return true;
  }

  if (message.type === 'UPDATE_API_URL') {
    cachedApiUrl = message.url;
    console.log("[TRACK'D] API URL updated to:", message.url);
    sendResponse({ success: true });
  }

  if (message.type === 'GET_API_URL') {
    getApiUrl().then(url => sendResponse({ url }));
    return true;
  }
});

// Clear cache on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log("[TRACK'D] Extension installed/updated");
  cachedApiUrl = null;
  chrome.storage.sync.set({ apiUrl: DEFAULT_API_URL });
});
