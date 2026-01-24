// IDentified - Background Service Worker
// Handles communication between content scripts and the API

const DEFAULT_API_URL = 'https://rork-dj-set-list-creator-3um4.vercel.app';

// Get API URL from storage or use default
async function getApiUrl() {
  const result = await chrome.storage.sync.get(['apiUrl']);
  return result.apiUrl || DEFAULT_API_URL;
}

// Send scraped data to the API
async function sendToApi(data) {
  const apiUrl = await getApiUrl();
  
  try {
    const response = await fetch(`${apiUrl}/api/chrome-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[IDentified] API Error:', error);
    throw error;
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_RESULT') {
    // Store the scraped data temporarily
    chrome.storage.local.set({ lastScrape: message.data });
    sendResponse({ success: true });
  }
  
  if (message.type === 'SEND_TO_API') {
    sendToApi(message.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'GET_LAST_SCRAPE') {
    chrome.storage.local.get(['lastScrape'], (result) => {
      sendResponse({ data: result.lastScrape });
    });
    return true;
  }
});

// Context menu for quick scraping (optional)
chrome.runtime.onInstalled.addListener(() => {
  console.log('[IDentified] Extension installed');
});
