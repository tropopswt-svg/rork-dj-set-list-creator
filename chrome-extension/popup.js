// IDentified - Popup Script

let currentPlatform = null;
let scrapedData = null;

// Detect which platform we're on
function detectPlatform(url) {
  if (url.includes('beatport.com')) return 'beatport';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('1001tracklists.com')) return '1001tracklists';
  return null;
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
    document.getElementById('artistCount').textContent = data.artists?.length || 0;
    document.getElementById('trackCount').textContent = data.tracks?.length || 0;
    document.getElementById('sourceType').textContent = getPlatformLabel(data.source);
    resultDiv.style.display = 'block';
    sendBtn.style.display = 'block';
    scrapedData = data;
  } else {
    resultDiv.style.display = 'none';
    sendBtn.style.display = 'none';
    scrapedData = null;
  }
}

// Scrape the current page
async function scrape() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  scrapeBtn.disabled = true;
  scrapeBtn.innerHTML = '<span class="loading"></span>Scraping...';
  clearMessage();
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script to scrape
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE' });
    
    if (response && response.success) {
      showMessage(`Found ${response.data.tracks?.length || 0} tracks, ${response.data.artists?.length || 0} artists`, 'success');
      showScrapeResults(response.data);
    } else {
      showMessage(response?.error || 'Failed to scrape page', 'error');
      showScrapeResults(null);
    }
  } catch (error) {
    console.error('Scrape error:', error);
    showMessage('Could not scrape page. Try refreshing.', 'error');
    showScrapeResults(null);
  }
  
  scrapeBtn.disabled = false;
  scrapeBtn.textContent = `Scrape from ${getPlatformLabel(currentPlatform)}`;
}

// Send scraped data to API
async function sendToApi() {
  if (!scrapedData) return;
  
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="loading"></span>Sending...';
  clearMessage();
  
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
  sendBtn.textContent = 'Send to IDentified';
}

// Initialize popup
async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentPlatform = detectPlatform(tab.url);
    updateUI(currentPlatform, tab.url);
    
    // Check for existing scraped data
    chrome.storage.local.get(['lastScrape'], (result) => {
      if (result.lastScrape && result.lastScrape.source === currentPlatform) {
        showScrapeResults(result.lastScrape);
      }
    });
  } catch (error) {
    console.error('Init error:', error);
  }
}

// Event listeners
document.getElementById('scrapeBtn').addEventListener('click', scrape);
document.getElementById('sendBtn').addEventListener('click', sendToApi);

// Initialize
init();
