// IDentified - Background Service Worker
// Handles communication between content scripts and the API

// Update this to your Vercel deployment URL
const DEFAULT_API_URL = 'https://rork-dj-set-list-creator.vercel.app';

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
  console.log('[IDentified] Payload:', {
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
    const response = await fetch(`${apiUrl}/api/import`, {
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

    console.log('[IDentified] API Response Status:', response.status);
    console.log('[IDentified] API Response Body:', responseBody);

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
    console.error('[IDentified] API Error:', error);

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

// Clear cache and set correct URL on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('[IDentified] Extension installed/updated');
  console.log('[IDentified] Default API URL:', DEFAULT_API_URL);

  // Clear any cached old URL and force use of DEFAULT_API_URL
  cachedApiUrl = null;
  chrome.storage.sync.set({ apiUrl: DEFAULT_API_URL });
  console.log('[IDentified] Reset API URL to:', DEFAULT_API_URL);
});
