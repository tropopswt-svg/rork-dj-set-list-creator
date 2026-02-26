// TRACK'D - Background Service Worker
// Handles communication between content scripts and the API

// Update this to your Vercel deployment URL
const DEFAULT_API_URL = 'https://trakthat.app';

// Cache the API URL
let cachedApiUrl = null;

// ── Batch queue state ─────────────────────────────────────────────────────────
let batchQueue    = [];
let batchProgress = { total: 0, done: 0, success: 0, errors: 0, djName: '' };
let batchTabId    = null;
let batchRunning  = false;
let batchTabTimer = null;
const BATCH_TAB_TIMEOUT = 30000; // 30s per tab
const BATCH_TAB_DELAY   = 8000;  // 8s base between tabs
const BATCH_JITTER      = 4000;  // +0-4s random jitter

async function processBatchQueue() {
  if (!batchRunning || batchQueue.length === 0) {
    batchRunning = false;
    batchTabId   = null;
    console.log('[TRACK\'D] Batch complete:', batchProgress);
    return;
  }

  const url = batchQueue.shift();
  console.log(`[TRACK\'D] Batch: opening ${url} (${batchProgress.done + 1}/${batchProgress.total})`);

  try {
    const tab = await chrome.tabs.create({ url, active: false });
    batchTabId = tab.id;

    // Timeout fallback — skip this tab if no response within BATCH_TAB_TIMEOUT
    batchTabTimer = setTimeout(() => {
      if (batchTabId === tab.id) {
        console.warn('[TRACK\'D] Batch tab timed out:', url);
        batchProgress.errors++;
        batchProgress.done++;
        chrome.tabs.remove(tab.id).catch(() => {});
        batchTabId = null;
        setTimeout(processBatchQueue, 1000);
      }
    }, BATCH_TAB_TIMEOUT);
  } catch (err) {
    console.error('[TRACK\'D] Batch tab create failed:', err);
    batchProgress.errors++;
    batchProgress.done++;
    setTimeout(processBatchQueue, 1000);
  }
}

function handleBatchTabComplete(success) {
  if (batchTabTimer) { clearTimeout(batchTabTimer); batchTabTimer = null; }
  if (success) batchProgress.success++;
  else         batchProgress.errors++;
  batchProgress.done++;

  const tabToClose = batchTabId;
  batchTabId = null;
  chrome.tabs.remove(tabToClose).catch(() => {});

  // Pause between tabs — be polite to 1001tracklists
  const jitter = Math.floor(Math.random() * BATCH_JITTER);
  setTimeout(processBatchQueue, BATCH_TAB_DELAY + jitter);
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

  // Add chrome extension flag
  const payload = {
    ...data,
    chromeExtension: true,
  };

  try {
    const response = await fetch(`${apiUrl}/api/chrome-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Get response body regardless of status
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

      // Provide helpful error messages
      if (response.status === 500 && errorMessage.includes('Database not configured')) {
        throw new Error('Database not configured on server. Please add Supabase credentials to Vercel.');
      }
      if (response.status === 500 && errorMessage.includes('Supabase')) {
        throw new Error('Supabase connection error. Check your environment variables on Vercel.');
      }

      throw new Error(errorMessage);
    }

    return responseBody;
  } catch (error) {
    console.error("[TRACK'D] API Error:", error);

    // Enhance network errors
    if (error.message === 'Failed to fetch') {
      throw new Error('Could not connect to API. Check if your Vercel deployment is live.');
    }

    throw error;
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_RESULT') {
    // Store the scraped data temporarily
    chrome.storage.local.set({ lastScrape: message.data });
    sendResponse({ success: true });
  }
  
  if (message.type === 'SEND_TO_API') {
    const isBatchTab = batchRunning && sender.tab?.id != null && sender.tab.id === batchTabId;
    sendToApi(message.data)
      .then(result => {
        sendResponse({ success: true, result });
        if (isBatchTab) handleBatchTabComplete(true);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
        if (isBatchTab) handleBatchTabComplete(false);
      });
    return true; // Keep channel open for async response
  }

  if (message.type === 'BATCH_START') {
    batchQueue    = [...message.urls];
    batchProgress = { total: message.urls.length, done: 0, success: 0, errors: 0, djName: message.djName || '' };
    batchRunning  = true;
    // Ensure auto-scrape is on for batch mode
    chrome.storage.sync.set({ autoScrape: true });
    processBatchQueue();
    sendResponse({ success: true, total: message.urls.length });
    return true;
  }

  if (message.type === 'BATCH_STOP') {
    batchRunning = false;
    batchQueue   = [];
    if (batchTabTimer) { clearTimeout(batchTabTimer); batchTabTimer = null; }
    if (batchTabId) { chrome.tabs.remove(batchTabId).catch(() => {}); batchTabId = null; }
    sendResponse({ success: true });
  }

  if (message.type === 'BATCH_STATUS') {
    sendResponse({ running: batchRunning, progress: { ...batchProgress } });
    return true;
  }
  
  if (message.type === 'GET_LAST_SCRAPE') {
    chrome.storage.local.get(['lastScrape'], (result) => {
      sendResponse({ data: result.lastScrape });
    });
    return true;
  }
  
  if (message.type === 'UPDATE_API_URL') {
    // Update the cached URL
    cachedApiUrl = message.url;
    console.log("[TRACK'D] API URL updated to:", message.url);
    sendResponse({ success: true });
  }
  
  if (message.type === 'GET_API_URL') {
    getApiUrl().then(url => sendResponse({ url }));
    return true;
  }
});

// Clear cache and set correct URL on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log("[TRACK'D] Extension installed/updated");
  console.log("[TRACK'D] Default API URL:", DEFAULT_API_URL);

  // Clear any cached old URL and force use of DEFAULT_API_URL
  cachedApiUrl = null;
  chrome.storage.sync.set({ apiUrl: DEFAULT_API_URL });
  console.log("[TRACK'D] Reset API URL to:", DEFAULT_API_URL);
});
