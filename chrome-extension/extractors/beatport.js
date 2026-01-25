// IDentified - Beatport Extractor
// Scrapes tracks and artists from Beatport pages

(function() {
  'use strict';
  
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

  // Extract genre from URL
  function extractGenreFromUrl() {
    const path = window.location.pathname;
    // URL pattern: /genre/tech-house/top-100
    const genreMatch = path.match(/\/genre\/([^\/]+)/);
    if (genreMatch) {
      // Convert slug to readable name: tech-house -> Tech House
      return genreMatch[1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return null;
  }
  
  function extractTracks() {
    const tracks = [];
    const artists = new Map();
    
    console.log('[Beatport] Starting extraction...');
    
    // Find all track links first
    const trackLinks = document.querySelectorAll('a[href*="/track/"]');
    console.log('[Beatport] Found', trackLinks.length, 'track links');
    
    const processedUrls = new Set();
    
    trackLinks.forEach((trackLink, index) => {
      try {
        const trackUrl = trackLink.href;
        
        // Skip if already processed (avoid duplicates)
        if (processedUrls.has(trackUrl)) return;
        processedUrls.add(trackUrl);
        
        // Get track title from the link or its title attribute
        let title = trackLink.getAttribute('title') || trackLink.textContent?.trim();
        
        // Clean up title - remove extra whitespace
        title = title?.replace(/\s+/g, ' ').trim();
        
        // Skip if no valid title
        if (!title || title.length < 2) return;
        
        // Find the row container by going up the DOM
        let container = trackLink.closest('[class*="MetaRow"]') || 
                        trackLink.closest('[class*="ItemRow"]') ||
                        trackLink.closest('[class*="TrackRow"]') ||
                        trackLink.closest('li') ||
                        trackLink.parentElement?.parentElement?.parentElement?.parentElement;
        
        // If no container found, use a larger parent
        if (!container) {
          container = trackLink;
          for (let i = 0; i < 8; i++) {
            if (container.parentElement) container = container.parentElement;
          }
        }
        
        // Find artist links within the container or nearby
        const trackArtists = [];
        const artistLinks = container.querySelectorAll('a[href*="/artist/"]');
        
        artistLinks.forEach(a => {
          const name = a.getAttribute('title') || a.textContent?.trim();
          if (name && name.length > 0 && !trackArtists.includes(name)) {
            trackArtists.push(name);
            if (!artists.has(name)) {
              artists.set(name, {
                name,
                beatport_url: a.href,
              });
            }
          }
        });
        
        // Find label
        const labelLink = container.querySelector('a[href*="/label/"]');
        const label = labelLink?.getAttribute('title') || labelLink?.textContent?.trim();
        
        // Find genre
        const genreLink = container.querySelector('a[href*="/genre/"]');
        const genre = genreLink?.textContent?.trim();
        
        // Find BPM - look for a standalone number in typical BPM range
        let bpm = null;
        const allText = container.textContent || '';
        // Look for BPM typically shown as "125" or "125 BPM"
        const bpmMatches = allText.match(/\b(1[0-1][0-9]|1[2-7][0-9]|180)\b/g);
        if (bpmMatches && bpmMatches.length > 0) {
          // Take the first match that looks like a BPM
          bpm = parseInt(bpmMatches[0]);
        }
        
        // Find key
        let key = null;
        const keyMatch = allText.match(/\b([A-G][#♯b♭]?\s*(min|maj|m|M)?)\b/);
        if (keyMatch) {
          key = keyMatch[1].trim();
        }
        
        // Find duration (MM:SS format)
        let durationSeconds = null;
        const durationMatch = allText.match(/\b(\d{1,2}):(\d{2})\b/);
        if (durationMatch) {
          durationSeconds = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
        }
        
        // Extract Beatport ID from URL
        const beatportId = trackUrl.match(/\/track\/[^\/]+\/(\d+)/)?.[1];
        
        tracks.push({
          title,
          artists: trackArtists,
          artist: trackArtists[0] || 'Unknown',
          label: label || null,
          bpm,
          key,
          genre,
          duration_seconds: durationSeconds,
          beatport_url: trackUrl,
          beatport_id: beatportId,
          position: tracks.length + 1,
        });
        
        console.log('[Beatport] Track:', title, '| Artists:', trackArtists.join(', ') || 'Unknown');
        
      } catch (e) {
        console.error('[Beatport] Error parsing track:', e);
      }
    });
    
    console.log('[Beatport] Extracted', tracks.length, 'tracks,', artists.size, 'artists');
    
    return {
      tracks,
      artists: Array.from(artists.values()),
    };
  }
  
  function extract() {
    const pageType = getPageType();
    const urlGenre = extractGenreFromUrl();
    console.log('[Beatport] Page type:', pageType, '| URL Genre:', urlGenre);

    const result = extractTracks();

    // Add genre from URL to all tracks and artists if detected
    if (urlGenre) {
      result.genreName = urlGenre;
      result.tracks = result.tracks.map(t => ({
        ...t,
        genre: t.genre || urlGenre
      }));
      result.artists = result.artists.map(a => ({
        ...a,
        genres: a.genres ? [...a.genres, urlGenre] : [urlGenre]
      }));
    }

    result.source = 'beatport';
    result.sourceUrl = window.location.href;
    result.pageType = pageType;
    result.scrapedAt = new Date().toISOString();

    return result;
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE') {
      try {
        const data = extract();
        sendResponse({ success: true, data });
      } catch (error) {
        console.error('[Beatport] Error:', error);
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
    btn.title = 'Scrape and send tracks to IDentified';
    
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '⏳ Scraping...';
      
      try {
        const data = extract();
        
        if (data.tracks.length === 0) {
          btn.innerHTML = '⚠️ No tracks found';
          setTimeout(() => {
            btn.innerHTML = '✨ IDentified';
            btn.disabled = false;
          }, 2000);
          return;
        }
        
        btn.innerHTML = `📤 Sending ${data.tracks.length}...`;
        
        // Auto-send to API
        const response = await chrome.runtime.sendMessage({
          type: 'SEND_TO_API',
          data: data
        });
        
        if (response.success) {
          const r = response.result;
          btn.innerHTML = `✅ +${r.artistsCreated || 0} artists, +${r.tracksCreated || 0} tracks`;
          console.log('[Beatport] Sent to API:', response.result);
        } else {
          btn.innerHTML = '❌ ' + (response.error || 'Send failed');
          console.error('[Beatport] API error:', response.error);
        }
        
        setTimeout(() => {
          btn.innerHTML = '✨ IDentified';
          btn.disabled = false;
        }, 4000);
        
      } catch (e) {
        console.error('[Beatport] Button error:', e);
        btn.innerHTML = '❌ Error';
        setTimeout(() => {
          btn.innerHTML = '✨ IDentified';
          btn.disabled = false;
        }, 3000);
      }
    });
    
    document.body.appendChild(btn);
  }
  
  // Auto-scrape function
  async function autoScrape() {
    // Check if auto-scrape is enabled
    const result = await chrome.storage.sync.get(['autoScrape']);
    if (!result.autoScrape) return;

    const pageType = getPageType();
    // Only auto-scrape on pages with multiple tracks
    if (!['chart', 'genre', 'top100', 'label'].includes(pageType)) return;

    console.log('[Beatport] Auto-scrape enabled, starting...');

    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const data = extract();
    if (data.tracks.length === 0) {
      console.log('[Beatport] Auto-scrape: No tracks found');
      showNotification('No tracks found', 'error');
      return;
    }

    showNotification(`Auto-scraping ${data.tracks.length} tracks...`, 'info');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEND_TO_API',
        data: data
      });

      if (response.success) {
        const r = response.result;
        const totalFound = (r.tracksCreated || 0) + (r.tracksSkipped || 0);
        const msg = totalFound > 0
          ? `✅ Found ${totalFound} tracks: +${r.tracksCreated || 0} new, ${r.tracksSkipped || 0} already in DB`
          : `✅ Processed (no tracks found on page)`;
        showNotification(msg, 'success');
        console.log('[Beatport] Auto-scrape success:', response.result);
      } else {
        showNotification('❌ ' + (response.error || 'Failed'), 'error');
        console.error('[Beatport] Auto-scrape error:', response.error);
      }
    } catch (e) {
      console.error('[Beatport] Auto-scrape error:', e);
      showNotification('❌ Error: ' + e.message, 'error');
    }
  }

  // Show notification toast
  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('identified-notification');
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.id = 'identified-notification';
    notif.className = `identified-notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);

    setTimeout(() => notif.remove(), 4000);
  }

  // Wait for page to load
  function init() {
    setTimeout(createButton, 1000);
    // Trigger auto-scrape after a delay
    setTimeout(autoScrape, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Beatport] Extractor loaded');
})();
