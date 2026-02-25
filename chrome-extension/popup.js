// TRACK'D - Popup Script

let currentPlatform = null;
let scrapedData = null;

// Update this to your Vercel deployment URL
const DEFAULT_API_URL = 'https://rork-dj-set-list-creator.vercel.app';

// Detect which platform we're on
function detectPlatform(url) {
  if (url.includes('beatport.com')) return 'beatport';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('1001tracklists.com')) return '1001tracklists';
  return null;
}

// Get API URL from storage
async function getApiUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiUrl'], (result) => {
      resolve(result.apiUrl || DEFAULT_API_URL);
    });
  });
}

// Save API URL to storage
async function saveApiUrl(url) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ apiUrl: url }, resolve);
  });
}

// Update UI based on platform
function updateUI(platform, tabUrl) {
  const pageStatus = document.getElementById('pageStatus');
  const scrapeBtn = document.getElementById('scrapeBtn');
  
  // Reset badges
  document.querySelectorAll('.platform-badge').forEach(b => b.classList.remove('active'));
  
  if (platform) {
    document.getElementById(`badge-${platform === '1001tracklists' ? '1001' : platform}`).classList.add('active');
    pageStatus.textContent = getPlatformLabel(platform);
    pageStatus.className = 'status-value detected';
    scrapeBtn.disabled = false;
    scrapeBtn.textContent = `Scrape from ${getPlatformLabel(platform)}`;
  } else {
    pageStatus.textContent = 'Not a supported page';
    pageStatus.className = 'status-value not-detected';
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = 'Scrape This Page';
  }
}

function getPlatformLabel(platform) {
  const labels = {
    'beatport': 'Beatport',
    'soundcloud': 'SoundCloud',
    '1001tracklists': '1001Tracklists'
  };
  return labels[platform] || platform;
}

// Show message
function showMessage(text, type = 'info') {
  const msg = document.getElementById('message');
  msg.textContent = text;
  msg.className = `message ${type}`;
}

// Clear message
function clearMessage() {
  const msg = document.getElementById('message');
  msg.className = 'message';
}

// Update scrape results display
function showScrapeResults(data) {
  const resultDiv = document.getElementById('scrapeResult');
  const sendBtn = document.getElementById('sendBtn');

  if (data) {
    if (data.isBatchPage) {
      document.getElementById('artistCount').textContent = '-';
      document.getElementById('trackCountLabel').textContent = 'Tracklists';
      document.getElementById('trackCount').textContent = data.tracklistUrls?.length || 0;
      document.getElementById('sourceType').textContent = data.pageLabel || '1001Tracklists';
      resultDiv.style.display = 'block';
      sendBtn.style.display = 'block';
      sendBtn.textContent = `📋 Queue ${data.tracklistUrls?.length || 0} Sets`;
    } else {
      document.getElementById('artistCount').textContent = data.artists?.length || 0;
      document.getElementById('trackCountLabel').textContent = 'Tracks';
      document.getElementById('trackCount').textContent = data.tracks?.length || 0;
      document.getElementById('sourceType').textContent = getPlatformLabel(data.source);
      resultDiv.style.display = 'block';
      sendBtn.style.display = 'block';
      sendBtn.textContent = "Send to TRACK'D";
    }
    scrapedData = data;
  } else {
    resultDiv.style.display = 'none';
    sendBtn.style.display = 'none';
    scrapedData = null;
  }
}

// Inject the content script if it's not already running, then send a message
async function sendToContentScript(tabId, message) {
  // First attempt
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    if (!e.message?.includes('Receiving end does not exist')) throw e;
  }

  // Content script not loaded — inject it now
  const platform = currentPlatform;
  const scriptFile = platform === 'beatport'       ? 'extractors/beatport.js'
                   : platform === 'soundcloud'     ? 'extractors/soundcloud.js'
                   : platform === '1001tracklists' ? 'extractors/1001tracklists.js'
                   : null;
  if (!scriptFile) throw new Error('No extractor for this page');

  await chrome.scripting.executeScript({ target: { tabId }, files: [scriptFile] });
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] });

  // Wait for the listener to register
  await new Promise(r => setTimeout(r, 500));
  return await chrome.tabs.sendMessage(tabId, message);
}

// Scrape the current page
async function scrape() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  scrapeBtn.disabled = true;
  scrapeBtn.innerHTML = '<span class="loading"></span>Scraping...';
  clearMessage();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const response = await sendToContentScript(tab.id, { type: 'SCRAPE' });

    if (response && response.success) {
      if (response.data.isBatchPage) {
        showMessage(`Found ${response.data.tracklistUrls?.length || 0} tracklists — press Queue to import all`, 'info');
      } else {
        showMessage(`Found ${response.data.tracks?.length || 0} tracks, ${response.data.artists?.length || 0} artists`, 'success');
      }
      showScrapeResults(response.data);
    } else {
      showMessage(response?.error || 'Failed to scrape page', 'error');
      showScrapeResults(null);
    }
  } catch (error) {
    console.error('Scrape error:', error);
    showMessage(`Scrape failed: ${error.message || 'Try refreshing the page'}`, 'error');
    showScrapeResults(null);
  }

  scrapeBtn.disabled = false;
  scrapeBtn.textContent = `Scrape from ${getPlatformLabel(currentPlatform)}`;
}

// Send scraped data to API
async function sendToApi() {
  if (!scrapedData) return;

  const sendBtn = document.getElementById('sendBtn');
  clearMessage();

  // Batch mode: start queue instead of sending data
  if (scrapedData.isBatchPage) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="loading"></span>Starting...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'BATCH_START',
        urls: scrapedData.tracklistUrls,
        djName: scrapedData.pageLabel || '',
      });

      if (response.success) {
        const total = response.total;
        showMessage(`Queued ${total} sets — importing in background tabs`, 'success');
        sendBtn.disabled = false;
        sendBtn.textContent = `⏳ 0/${total} sets...`;

        const pollId = setInterval(async () => {
          try {
            const status = await chrome.runtime.sendMessage({ type: 'BATCH_STATUS' });
            if (!status.running) {
              clearInterval(pollId);
              const p = status.progress;
              showMessage(`Done! ${p.success}/${p.total} sets imported`, 'success');
              sendBtn.textContent = `📋 Queue ${scrapedData.tracklistUrls.length} Sets`;
              sendBtn.disabled = false;
            } else {
              const p = status.progress;
              sendBtn.textContent = `⏳ ${p.done}/${p.total} sets...`;
            }
          } catch (e) {
            clearInterval(pollId);
            sendBtn.disabled = false;
          }
        }, 2500);
      } else {
        showMessage('Failed to start batch', 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = `📋 Queue ${scrapedData.tracklistUrls.length} Sets`;
      }
    } catch (error) {
      console.error('Batch error:', error);
      showMessage('Batch error: ' + error.message, 'error');
      sendBtn.disabled = false;
    }
    return;
  }

  // Regular single-page send
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="loading"></span>Sending...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SEND_TO_API',
      data: scrapedData
    });

    if (response.success) {
      const result = response.result;
      showMessage(
        `Added ${result.artistsCreated || 0} artists, ${result.tracksCreated || 0} tracks`,
        'success'
      );
    } else {
      showMessage(response.error || 'Failed to send data', 'error');
    }
  } catch (error) {
    console.error('API error:', error);
    showMessage('Could not connect to API', 'error');
  }

  sendBtn.disabled = false;
  sendBtn.textContent = "Send to TRACK'D";
}

// Initialize popup
async function init() {
  try {
    // Race against a 2s timeout — chrome.tabs.query can hang on fresh installs
    const queryPromise = chrome.tabs.query({ active: true, currentWindow: true });
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([undefined]), 2000));
    const [tab] = await Promise.race([queryPromise, timeoutPromise]);

    const tabUrl = tab?.url || '';
    currentPlatform = detectPlatform(tabUrl);
    updateUI(currentPlatform, tabUrl);

    // Check for existing scraped data
    chrome.storage.local.get(['lastScrape'], (result) => {
      if (result.lastScrape && result.lastScrape.source === currentPlatform) {
        showScrapeResults(result.lastScrape);
      }
    });
  } catch (error) {
    console.error('Init error:', error);
    updateUI(null, '');
  }
}

// Toggle settings panel
function toggleSettings() {
  const settingsSection = document.getElementById('settingsSection');
  const isVisible = settingsSection.style.display !== 'none';
  settingsSection.style.display = isVisible ? 'none' : 'block';
  
  if (!isVisible) {
    // Load current API URL
    getApiUrl().then(url => {
      document.getElementById('apiUrl').value = url;
    });
  }
}

// Save settings
async function saveSettings() {
  const url = document.getElementById('apiUrl').value.trim();
  if (url) {
    await saveApiUrl(url);
    showMessage('Settings saved!', 'success');
    
    // Also update the background script
    chrome.runtime.sendMessage({ type: 'UPDATE_API_URL', url });
  }
}

// Test API connection
async function testConnection() {
  const url = document.getElementById('apiUrl').value.trim() || DEFAULT_API_URL;
  const statusEl = document.getElementById('connectionStatus');
  
  statusEl.textContent = 'Testing...';
  statusEl.className = 'connection-status';
  
  try {
    const response = await fetch(`${url}/api/import`, {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      statusEl.textContent = `✓ Connected! ${data.status || 'API is running'}`;
      statusEl.className = 'connection-status success';
    } else {
      statusEl.textContent = `✗ Error: ${response.status} ${response.statusText}`;
      statusEl.className = 'connection-status error';
    }
  } catch (error) {
    statusEl.textContent = `✗ Connection failed: ${error.message}`;
    statusEl.className = 'connection-status error';
  }
}

// Auto-scrape toggle
async function loadAutoScrapeState() {
  const result = await chrome.storage.sync.get(['autoScrape']);
  document.getElementById('autoScrapeToggle').checked = result.autoScrape || false;
}

async function toggleAutoScrape() {
  const enabled = document.getElementById('autoScrapeToggle').checked;
  await chrome.storage.sync.set({ autoScrape: enabled });
  showMessage(enabled ? 'Auto-scrape enabled! Pages will scrape automatically.' : 'Auto-scrape disabled.', 'success');
}

// Event listeners
document.getElementById('scrapeBtn').addEventListener('click', scrape);
document.getElementById('sendBtn').addEventListener('click', sendToApi);
document.getElementById('toggleSettings').addEventListener('click', toggleSettings);
document.getElementById('closeSettings').addEventListener('click', toggleSettings);
document.getElementById('saveSettings').addEventListener('click', saveSettings);
document.getElementById('testConnection').addEventListener('click', testConnection);
document.getElementById('autoScrapeToggle').addEventListener('change', toggleAutoScrape);
document.getElementById('refreshStats').addEventListener('click', loadStats);

// Fetch and display database stats
async function loadStats() {
  const refreshBtn = document.getElementById('refreshStats');
  refreshBtn.classList.add('spinning');

  try {
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/api/stats`);

    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }

    const data = await response.json();

    if (data.success) {
      // Update counts
      document.getElementById('totalTracks').textContent = data.stats.totalTracks.toLocaleString();
      document.getElementById('totalArtists').textContent = data.stats.totalArtists.toLocaleString();

      // Update recent tracks list
      const list = document.getElementById('recentTracksList');
      if (data.stats.recentTracks && data.stats.recentTracks.length > 0) {
        list.innerHTML = data.stats.recentTracks
          .map(track => `<li title="${track.title}">${track.title}</li>`)
          .join('');
      } else {
        list.innerHTML = '<li class="loading-item">No tracks yet</li>';
      }
    }
  } catch (error) {
    console.error('Stats error:', error);
    document.getElementById('totalTracks').textContent = '?';
    document.getElementById('totalArtists').textContent = '?';
    document.getElementById('recentTracksList').innerHTML = '<li class="loading-item">Could not load</li>';
  }

  refreshBtn.classList.remove('spinning');
}

// Initialize
init();
loadAutoScrapeState();
loadStats();
