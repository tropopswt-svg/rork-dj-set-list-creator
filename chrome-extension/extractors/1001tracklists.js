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
      
      // Get venue/event from title or page
      let venue = '';
      let eventName = '';
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

      // Try to get event name from page
      const eventLink = document.querySelector('a[href*="/event/"]');
      if (eventLink) {
        eventName = eventLink.textContent?.trim() || '';
      }

      // Extract external links (SoundCloud, YouTube, Mixcloud, Spotify, Apple Music)
      const externalLinks = {
        soundcloud_url: null,
        youtube_url: null,
        mixcloud_url: null,
        spotify_url: null,
        apple_music_url: null,
      };

      // Find all external links on the page
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.href;
        if (href.includes('soundcloud.com') && !externalLinks.soundcloud_url) {
          externalLinks.soundcloud_url = href;
        } else if ((href.includes('youtube.com') || href.includes('youtu.be')) && !externalLinks.youtube_url) {
          externalLinks.youtube_url = href;
        } else if (href.includes('mixcloud.com') && !externalLinks.mixcloud_url) {
          externalLinks.mixcloud_url = href;
        } else if (href.includes('spotify.com') && !externalLinks.spotify_url) {
          externalLinks.spotify_url = href;
        } else if (href.includes('music.apple.com') && !externalLinks.apple_music_url) {
          externalLinks.apple_music_url = href;
        }
      });

      // Try to get duration from page (usually in format "1:30:00" or "90 min")
      let durationSeconds = null;
      const durationEl = document.querySelector('.side1')?.textContent || '';
      const durationMatch = durationEl.match(/(\d{1,2}):(\d{2}):(\d{2})/) ||
                           durationEl.match(/(\d+)\s*(?:min|minutes)/i);
      if (durationMatch) {
        if (durationMatch[3]) {
          // HH:MM:SS format
          durationSeconds = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]);
        } else if (durationMatch[1]) {
          // XX min format
          durationSeconds = parseInt(durationMatch[1]) * 60;
        }
      }

      // Extract tracks
      document.querySelectorAll('.tlpItem, .tlpTog').forEach((item, index) => {
        try {
          const artistEl = item.querySelector('.blueLinkColor, a[href*="/artist/"]');
          const trackEl = item.querySelector('.trackValue, span[itemprop="name"]');
          const timeEl = item.querySelector('.cueValueField');
          const labelEl = item.querySelector('a[href*="/label/"]');
          
          let trackArtist = artistEl?.textContent?.trim() || '';
          let trackName = trackEl?.textContent?.trim() || '';
          const timeStr = timeEl?.textContent?.trim() || '0:00';
          const label = labelEl?.textContent?.trim();

          // If no separate artist found, try to parse from track name "Artist - Track" format
          if (!trackArtist && trackName && trackName.includes(' - ')) {
            const parts = trackName.split(' - ');
            trackArtist = parts[0].trim();
            trackName = parts.slice(1).join(' - ').trim();
          }

          // Also check if trackName still has "Artist - Track" format even if we got an artist
          if (trackArtist === 'Unknown' && trackName.includes(' - ')) {
            const parts = trackName.split(' - ');
            trackArtist = parts[0].trim();
            trackName = parts.slice(1).join(' - ').trim();
          }

          // Default to Unknown if still empty
          trackArtist = trackArtist || 'Unknown';
          trackName = trackName || 'Unknown';
          
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
          eventName,
          date: setDate,
          durationSeconds,
          ...externalLinks,
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

    // Only include sourceUrl if this is an actual tracklist page, not a DJ profile
    // Tracklist pages have URLs like: /tracklist/abc123/
    // DJ profile pages have URLs like: /dj/artist-name/
    const currentUrl = window.location.href;
    const isTracklistPage = currentUrl.includes('/tracklist/');
    const isDjProfilePage = currentUrl.includes('/dj/') && !currentUrl.includes('/tracklist/');

    // Format for API
    return {
      source: '1001tracklists',
      // Only save the URL if it's an actual tracklist page
      sourceUrl: isTracklistPage ? currentUrl : null,
      pageType: isTracklistPage ? 'tracklist' : (isDjProfilePage ? 'dj_profile' : 'unknown'),
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
    btn.title = 'Scrape and send tracklist to IDentified';
    
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
          console.log('[1001TL] Sent to API:', response.result);
        } else {
          btn.innerHTML = '❌ ' + (response.error || 'Send failed');
          console.error('[1001TL] API error:', response.error);
        }
        
        setTimeout(() => {
          btn.innerHTML = '✨ IDentified';
          btn.disabled = false;
        }, 4000);
        
      } catch (e) {
        console.error('[1001TL] Button error:', e);
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
    const result = await chrome.storage.sync.get(['autoScrape']);
    if (!result.autoScrape) return;

    console.log('[1001TL] Auto-scrape enabled, starting...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const data = extract();
    if (data.tracks.length === 0) {
      console.log('[1001TL] Auto-scrape: No tracks found');
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
      } else {
        showNotification('❌ ' + (response.error || 'Failed'), 'error');
      }
    } catch (e) {
      showNotification('❌ Error: ' + e.message, 'error');
    }
  }

  function showNotification(message, type = 'info') {
    const existing = document.getElementById('identified-notification');
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.id = 'identified-notification';
    notif.className = `identified-notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }

  // Initialize
  function init() {
    createButton();
    setTimeout(autoScrape, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[1001Tracklists Extractor] Loaded');
})();
