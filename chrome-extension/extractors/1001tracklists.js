// IDentified - 1001Tracklists Extractor
// Scrapes tracklists from 1001tracklists.com

(function() {
  'use strict';
  
  function extractTracklist() {
    const tracks = [];
    const artists = new Map();
    
    try {
      // Get set info
      const title = document.querySelector('#pageTitle')?.textContent?.trim() || 
                    document.title.replace(/ \| 1001Tracklists$/i, '');
      
      // Get DJ name
      let djName = '';
      const djLink = document.querySelector('a[href*="/dj/"]');
      if (djLink) {
        djName = djLink.textContent?.trim() || '';
        // Add DJ to artists
        if (djName) {
          artists.set(djName, {
            name: djName,
            resident_advisor_url: null,
            tracklists_url: djLink.href,
          });
        }
      }
      if (!djName) {
        const parts = title.split(/\s*[-–@]\s*/);
        if (parts.length >= 2) {
          djName = parts[0].trim();
        }
      }
      
      // Get date
      let setDate = '';
      const dateEl = document.querySelector('.side1 .value');
      if (dateEl) {
        setDate = dateEl.textContent?.trim() || '';
      }
      if (!setDate) {
        const urlMatch = location.href.match(/(\d{4}-\d{2}-\d{2})/);
        if (urlMatch) setDate = urlMatch[1];
      }
      
      // Get venue
      let venue = '';
      const venuePatterns = [
        /@\s*([^,\-–]+)/i,
        /(?:at|live at)\s+([^,\-–]+)/i,
      ];
      for (const pattern of venuePatterns) {
        const match = title.match(pattern);
        if (match) {
          venue = match[1].trim();
          break;
        }
      }
      
      // Extract tracks
      document.querySelectorAll('.tlpItem, .tlpTog').forEach((item, index) => {
        try {
          const artistEl = item.querySelector('.blueLinkColor, a[href*="/artist/"]');
          const trackEl = item.querySelector('.trackValue, span[itemprop="name"]');
          const timeEl = item.querySelector('.cueValueField');
          const labelEl = item.querySelector('a[href*="/label/"]');
          
          const trackArtist = artistEl?.textContent?.trim() || 'Unknown';
          const trackName = trackEl?.textContent?.trim() || 'Unknown';
          const timeStr = timeEl?.textContent?.trim() || '0:00';
          const label = labelEl?.textContent?.trim();
          
          // Parse timestamp
          const parts = timeStr.split(':').map(Number);
          let secs = 0;
          if (parts.length === 3) {
            secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
          } else if (parts.length === 2) {
            secs = parts[0] * 60 + parts[1];
          }
          
          // Check if it's an ID/unreleased
          const isUnreleased = trackName.toLowerCase().includes(' id') ||
                              trackName.toLowerCase().includes('unreleased') ||
                              trackName.toLowerCase() === 'id' ||
                              item.querySelector('.idCon') !== null;
          
          // Add artist to map
          if (trackArtist && trackArtist !== 'Unknown' && !artists.has(trackArtist)) {
            artists.set(trackArtist, {
              name: trackArtist,
              tracklists_url: artistEl?.href,
            });
          }
          
          if (trackName !== 'Unknown' || trackArtist !== 'Unknown') {
            tracks.push({
              title: trackName,
              artist: trackArtist,
              timestamp_seconds: secs,
              timestamp_str: timeStr,
              label,
              is_unreleased: isUnreleased,
              position: index + 1,
            });
          }
        } catch (e) {
          console.error('[1001TL Extractor] Track parse error:', e);
        }
      });
      
      // Try JSON-LD if no tracks found
      if (tracks.length === 0) {
        const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
          try {
            const jsonLd = JSON.parse(jsonLdScript.textContent);
            if (jsonLd.track && Array.isArray(jsonLd.track)) {
              jsonLd.track.forEach((t, i) => {
                if (t.name) {
                  const parts = t.name.split(' - ');
                  const artist = parts[0]?.trim() || 'Unknown';
                  const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : t.name;
                  
                  tracks.push({
                    title,
                    artist,
                    timestamp_seconds: 0,
                    timestamp_str: '0:00',
                    position: i + 1,
                  });
                  
                  if (artist !== 'Unknown' && !artists.has(artist)) {
                    artists.set(artist, { name: artist });
                  }
                }
              });
            }
          } catch (e) {
            console.error('[1001TL Extractor] JSON-LD parse error:', e);
          }
        }
      }
      
      return {
        setInfo: {
          title,
          djName: djName || 'Unknown Artist',
          venue,
          date: setDate,
        },
        tracks,
        artists: Array.from(artists.values()),
      };
    } catch (e) {
      console.error('[1001TL Extractor] Extract error:', e);
      return { setInfo: {}, tracks: [], artists: [] };
    }
  }
  
  // Main extraction function
  function extract() {
    const result = extractTracklist();
    
    // Format for API
    return {
      source: '1001tracklists',
      sourceUrl: window.location.href,
      pageType: 'tracklist',
      scrapedAt: new Date().toISOString(),
      setInfo: result.setInfo,
      tracks: result.tracks,
      artists: result.artists,
    };
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE') {
      try {
        const data = extract();
        sendResponse({ success: true, data });
      } catch (error) {
        console.error('[1001TL Extractor] Error:', error);
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
    btn.title = 'Scrape tracklist for IDentified';
    
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '⏳ Scraping...';
      
      try {
        const data = extract();
        
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
  
  console.log('[1001Tracklists Extractor] Loaded');
})();
