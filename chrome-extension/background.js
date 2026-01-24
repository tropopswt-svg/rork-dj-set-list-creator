// IDentified - Background Service Worker
// Handles communication between content scripts and the API

const DEFAULT_API_URL = 'https://rork-dj-set-list-creator-3um4.vercel.app';

// Cache the API URL
let cachedApiUrl = null;

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
  
  console.log('[IDentified] Sending to API:', apiUrl);
  
  // Add chrome extension flag
  const payload = {
    ...data,
    chromeExtension: true,
  };
  
  try {
    const response = await fetch(`${apiUrl}/api/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('[IDentified] API Error Response:', errorData);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        const errorText = await response.text();
        console.error('[IDentified] API Error Text:', errorText);
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('[IDentified] API Response:', result);
    return result;
  } catch (error) {
    console.error('[IDentified] API Error:', error);
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
  
  if (message.type === 'UPDATE_API_URL') {
    // Update the cached URL
    cachedApiUrl = message.url;
    console.log('[IDentified] API URL updated to:', message.url);
    sendResponse({ success: true });
  }
  
  if (message.type === 'GET_API_URL') {
    getApiUrl().then(url => sendResponse({ url }));
    return true;
  }
});

// Context menu for quick scraping (optional)
chrome.runtime.onInstalled.addListener(() => {
  console.log('[IDentified] Extension installed');
  console.log('[IDentified] Default API URL:', DEFAULT_API_URL);
});
