// IDentified - Beatport Extractor
// Scrapes tracks and artists from Beatport pages

(function() {
  'use strict';
  
  // Detect page type
  function getPageType() {
    const url = window.location.href;
    if (url.includes('/chart/')) return 'chart';
    if (url.includes('/release/')) return 'release';
    if (url.includes('/track/')) return 'track';
    if (url.includes('/artist/')) return 'artist';
    if (url.includes('/label/')) return 'label';
    if (url.includes('/genre/')) return 'genre';
    if (url.includes('/top-100')) return 'top100';
    return 'unknown';
  }
  
  // Extract tracks from chart/release/genre pages
  function extractTracks() {
    const tracks = [];
    const artists = new Map(); // Use map to dedupe
    
    // Different selectors for different Beatport layouts
    const trackSelectors = [
      // New Beatport layout
      '[data-testid="track-row"]',
      '.track-row',
      '.bucket-item',
      // Chart/Top 100 layout
      '.chart-track',
      '.top-track',
      // Release layout
      '.interior-release-chart-content-item',
      // Generic track containers
      '[class*="TrackRow"]',
      '[class*="track-"]',
    ];
    
    let trackElements = [];
    for (const selector of trackSelectors) {
      trackElements = document.querySelectorAll(selector);
      if (trackElements.length > 0) break;
    }
    
    // Fallback: look for any elements with track structure
    if (trackElements.length === 0) {
      // Try finding by data structure
      trackElements = document.querySelectorAll('[data-track], [data-track-id]');
    }
    
    trackElements.forEach((el, index) => {
      try {
        // Extract track title
        const titleEl = el.querySelector(
          '[class*="TrackTitle"], [class*="track-title"], .buk-track-title, ' +
          'a[href*="/track/"] span, [data-testid="track-title"]'
        );
        const title = titleEl?.textContent?.trim();
        
        // Extract artists
        const artistEls = el.querySelectorAll(
          '[class*="ArtistLink"], [class*="artist-link"], .buk-track-artists a, ' +
          'a[href*="/artist/"], [data-testid="artist-link"]'
        );
        const trackArtists = [];
        artistEls.forEach(a => {
          const name = a.textContent?.trim();
          if (name && !trackArtists.includes(name)) {
            trackArtists.push(name);
            // Add to artists map
            const artistUrl = a.href || '';
            const artistId = artistUrl.match(/\/artist\/([^\/]+)/)?.[1];
            if (!artists.has(name)) {
              artists.set(name, {
                name,
                beatport_url: artistUrl,
                beatport_id: artistId,
              });
            }
          }
        });
        
        // Extract remix info
        const remixEl = el.querySelector(
          '[class*="Remixer"], [class*="remixer"], .buk-track-remixers'
        );
        const remixer = remixEl?.textContent?.trim();
        
        // Extract label
        const labelEl = el.querySelector(
          '[class*="Label"], a[href*="/label/"], .buk-track-labels a'
        );
        const label = labelEl?.textContent?.trim();
        const labelUrl = labelEl?.href;
        
        // Extract BPM
        const bpmEl = el.querySelector(
          '[class*="Bpm"], [class*="bpm"], .buk-track-bpm'
        );
        const bpm = parseInt(bpmEl?.textContent?.trim()) || null;
        
        // Extract Key
        const keyEl = el.querySelector(
          '[class*="Key"], [class*="key"]:not([class*="keyboard"]), .buk-track-key'
        );
        const key = keyEl?.textContent?.trim() || null;
        
        // Extract genre
        const genreEl = el.querySelector(
          '[class*="Genre"], a[href*="/genre/"], .buk-track-genre'
        );
        const genre = genreEl?.textContent?.trim() || null;
        
        // Extract duration
        const durationEl = el.querySelector(
          '[class*="Duration"], [class*="length"], .buk-track-length'
        );
        const durationStr = durationEl?.textContent?.trim() || '';
        let durationSeconds = 0;
        const durParts = durationStr.split(':').map(Number);
        if (durParts.length === 2) {
          durationSeconds = durParts[0] * 60 + durParts[1];
        }
        
        // Extract track URL
        const trackLink = el.querySelector('a[href*="/track/"]');
        const trackUrl = trackLink?.href;
        const beatportId = trackUrl?.match(/\/track\/[^\/]+\/(\d+)/)?.[1];
        
        // Extract release year if visible
        const yearEl = el.querySelector('[class*="release-date"], [class*="ReleaseDate"]');
        const yearMatch = yearEl?.textContent?.match(/(\d{4})/);
        const releaseYear = yearMatch ? parseInt(yearMatch[1]) : null;
        
        if (title) {
          tracks.push({
            title: title,
            artists: trackArtists,
            artist: trackArtists[0] || 'Unknown',
            remixer: remixer || null,
            label: label || null,
            label_url: labelUrl || null,
            bpm: bpm,
            key: key,
            genre: genre,
            duration_seconds: durationSeconds || null,
            release_year: releaseYear,
            beatport_url: trackUrl,
            beatport_id: beatportId,
            position: index + 1,
          });
        }
      } catch (e) {
        console.error('[Beatport Extractor] Track parse error:', e);
      }
    });
    
    return {
      tracks,
      artists: Array.from(artists.values()),
    };
  }
  
  // Extract artist info from artist page
  function extractArtistPage() {
    const artists = [];
    
    try {
      // Get artist name
      const nameEl = document.querySelector(
        'h1, [class*="ArtistName"], [class*="artist-name"]'
      );
      const name = nameEl?.textContent?.trim();
      
      if (name) {
        // Get genres
        const genreEls = document.querySelectorAll(
          '[class*="Genre"] a, a[href*="/genre/"]'
        );
        const genres = [];
        genreEls.forEach(g => {
          const genre = g.textContent?.trim();
          if (genre && !genres.includes(genre)) genres.push(genre);
        });
        
        // Get image
        const imgEl = document.querySelector(
          '[class*="ArtistImage"] img, [class*="artist-image"] img, ' +
          '.interior-artist-artwork img'
        );
        const imageUrl = imgEl?.src;
        
        artists.push({
          name,
          genres,
          image_url: imageUrl,
          beatport_url: window.location.href,
        });
      }
    } catch (e) {
      console.error('[Beatport Extractor] Artist page error:', e);
    }
    
    // Also extract any tracks on the page
    const { tracks, artists: trackArtists } = extractTracks();
    
    return {
      tracks,
      artists: [...artists, ...trackArtists.filter(a => !artists.find(x => x.name === a.name))],
    };
  }
  
  // Main extraction function
  function extract() {
    const pageType = getPageType();
    console.log('[Beatport Extractor] Page type:', pageType);
    
    let result;
    
    if (pageType === 'artist') {
      result = extractArtistPage();
    } else {
      result = extractTracks();
    }
    
    // Add metadata
    result.source = 'beatport';
    result.sourceUrl = window.location.href;
    result.pageType = pageType;
    result.scrapedAt = new Date().toISOString();
    
    console.log('[Beatport Extractor] Result:', result);
    return result;
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE') {
      try {
        const data = extract();
        sendResponse({ success: true, data });
      } catch (error) {
        console.error('[Beatport Extractor] Error:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });
  
  // Create floating button
  function createButton() {
    if (document.getElementById('identified-btn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'identified-btn';
    btn.innerHTML = '✨ IDentified';
    btn.title = 'Scrape tracks for IDentified';
    
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '⏳ Scraping...';
      
      try {
        const data = extract();
        
        // Store in extension storage
        chrome.runtime.sendMessage({ type: 'SCRAPE_RESULT', data });
        
        btn.innerHTML = `✅ ${data.tracks.length} tracks`;
        setTimeout(() => {
          btn.innerHTML = '✨ IDentified';
          btn.disabled = false;
        }, 2000);
      } catch (e) {
        btn.innerHTML = '❌ Error';
        setTimeout(() => {
          btn.innerHTML = '✨ IDentified';
          btn.disabled = false;
        }, 2000);
      }
    });
    
    document.body.appendChild(btn);
  }
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createButton);
  } else {
    createButton();
  }
  
  console.log('[Beatport Extractor] Loaded');
})();
