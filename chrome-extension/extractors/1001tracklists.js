// TRACK'D - 1001Tracklists Extractor
// Scrapes tracklists from 1001tracklists.com

(function() {
  'use strict';
  
  // Wait for dynamic content to load (timestamps are loaded via JS)
  async function waitForTimestamps(maxWait = 5000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      // Check if any cue/time elements exist with actual values
      // 1001tracklists uses .cueVal for the timestamp text inside .cueI containers
      const cueFields = document.querySelectorAll('.cueVal, .cueI, .cueValueField');
      for (const field of cueFields) {
        const text = field.textContent?.trim() || '';
        if (text.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
          return true; // Found a timestamp
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return false; // Timed out
  }

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

      // Helper to check if YouTube URL is a valid video (not channel/profile)
      function isValidYoutubeVideo(url) {
        // Valid video patterns
        if (url.includes('youtube.com/watch?v=')) return true;
        if (url.includes('youtu.be/')) return true;
        // Invalid patterns (channels, profiles)
        if (url.includes('/channel/')) return false;
        if (url.includes('/c/')) return false;
        if (url.includes('/user/')) return false;
        if (url.includes('/@')) return false;
        return false;
      }

      // Helper to check if SoundCloud URL is a valid track/set (not profile)
      function isValidSoundcloudTrack(url) {
        // Profile URLs only have 1 path segment: soundcloud.com/artist
        // Track/set URLs have 2+: soundcloud.com/artist/track
        const path = url.replace(/https?:\/\/(www\.)?soundcloud\.com\/?/, '');
        const segments = path.split('/').filter(s => s.length > 0);
        return segments.length >= 2;
      }

      // Helper to check if Mixcloud URL is a valid show (not profile)
      function isValidMixcloudShow(url) {
        const path = url.replace(/https?:\/\/(www\.)?mixcloud\.com\/?/, '');
        const segments = path.split('/').filter(s => s.length > 0);
        return segments.length >= 2;
      }

      // Find all external links on the page - only capture valid content URLs
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.href;
        if (href.includes('soundcloud.com') && !externalLinks.soundcloud_url) {
          if (isValidSoundcloudTrack(href)) {
            externalLinks.soundcloud_url = href;
          }
        } else if ((href.includes('youtube.com') || href.includes('youtu.be')) && !externalLinks.youtube_url) {
          if (isValidYoutubeVideo(href)) {
            externalLinks.youtube_url = href;
          }
        } else if (href.includes('mixcloud.com') && !externalLinks.mixcloud_url) {
          if (isValidMixcloudShow(href)) {
            externalLinks.mixcloud_url = href;
          }
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

      // Debug: Log all elements that might contain timestamps
      // The actual timestamp element has class "cue" with id like "cue_11479797"
      console.log('[1001TL] Looking for timestamp elements...');
      const allCues = document.querySelectorAll('div.cue[id^="cue_"], .cue.noWrap');
      console.log('[1001TL] Found div.cue elements:', allCues.length);
      if (allCues.length > 0) {
        console.log('[1001TL] First .cue text:', allCues[0].textContent);
      }

      // Build a map of track IDs to timestamps
      // The cue element ID contains the track ID: cue_11479797
      const timestampMap = new Map();

      allCues.forEach((cueEl) => {
        const text = cueEl.textContent?.trim() || '';
        const match = text.match(/^(\d{1,2}:\d{2}(:\d{2})?)$/);
        if (match) {
          // Extract the track ID from the cue element's ID (cue_XXXXXXX)
          const cueId = cueEl.id?.replace('cue_', '') || '';
          if (cueId) {
            timestampMap.set(cueId, match[1]);
          }
          // Also try to find the parent track item and store by index
          const parentItem = cueEl.closest('.bItm, .tlpItem');
          if (parentItem) {
            // Store the timestamp directly on the parent for later lookup
            parentItem.dataset.timestamp = match[1];
          }
          console.log('[1001TL] Timestamp found:', match[1], 'for cue ID:', cueId);
        }
      });

      // Extract tracks - 1001tracklists uses .bItm for track items in the modern layout
      // Also try legacy selectors .tlpItem and .tlpTog
      const trackItems = document.querySelectorAll('.bItm:not(.bItmH):not(.con), .tlpItem, .tlpTog');
      console.log('[1001TL] Found', trackItems.length, 'track items');

      // Also get track items via the tracklist tab if available
      const tlTabItems = document.querySelectorAll('#tlTab .bItm');
      console.log('[1001TL] Found', tlTabItems.length, 'track items in #tlTab');

      const itemsToProcess = tlTabItems.length > 0 ? tlTabItems : trackItems;

      itemsToProcess.forEach((item, index) => {
        try {
          const artistEl = item.querySelector('.blueLinkColor, a[href*="/artist/"]');
          const trackEl = item.querySelector('.trackValue, span[itemprop="name"]');
          const labelEl = item.querySelector('a[href*="/label/"]');

          // Find timestamp - the actual element is div.cue with id="cue_XXXXXXX"
          let timeStr = '';

          // Method 1: Check if we stored a timestamp on this item via dataset
          if (item.dataset.timestamp) {
            timeStr = item.dataset.timestamp;
          }

          // Method 2: Look for div.cue element within this item
          if (!timeStr || !timeStr.match(/^\d{1,2}:\d{2}/)) {
            const cueEl = item.querySelector('div.cue[id^="cue_"], .cue.noWrap, .cue.action');
            if (cueEl) {
              const text = cueEl.textContent?.trim() || '';
              const match = text.match(/^(\d{1,2}:\d{2}(:\d{2})?)$/);
              if (match) timeStr = match[1];
            }
          }

          // Method 3: Look for any element with "cue" in the class
          if (!timeStr || !timeStr.match(/^\d{1,2}:\d{2}/)) {
            const cueEl = item.querySelector('[class*="cue"]');
            if (cueEl) {
              const text = cueEl.textContent?.trim() || '';
              const match = text.match(/^(\d{1,2}:\d{2}(:\d{2})?)$/);
              if (match) timeStr = match[1];
            }
          }

          // Method 4: Search for timestamp pattern in item text (last resort)
          if (!timeStr || !timeStr.match(/^\d{1,2}:\d{2}/)) {
            // Look specifically for time patterns, avoiding track numbers
            const allText = item.textContent || '';
            const tsMatch = allText.match(/\b(\d{1,2}:\d{2}(:\d{2})?)\b/);
            if (tsMatch) {
              timeStr = tsMatch[1];
            }
          }

          // Debug: Log what we found for first few tracks
          if (index < 5) {
            const cueEl = item.querySelector('div.cue, [class*="cue"]');
            console.log(`[1001TL] Track ${index}: timeStr="${timeStr}", cueEl found:`, !!cueEl, cueEl?.textContent?.trim());
          }

          if (!timeStr) timeStr = '0:00';

          let trackArtist = artistEl?.textContent?.trim() || '';
          let trackName = trackEl?.textContent?.trim() || '';
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
            // Debug: log timestamp extraction
            if (index < 5) {
              console.log(`[1001TL] Track ${index + 1}: "${trackName}" - timeStr="${timeStr}" secs=${secs}`);
            }

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
  
  // Extract tracks from chart pages (weekly, monthly, etc.)
  // These are track-only pages - no set creation
  function extractChartTracks() {
    const tracks = [];
    const artists = new Map();

    try {
      // Get chart name from page title
      let chartName = '';
      const titleEl = document.querySelector('#pageTitle, h1');
      if (titleEl) {
        chartName = titleEl.textContent?.trim() || '';
      }
      if (!chartName) {
        chartName = document.title.replace(/ \| 1001Tracklists$/i, '').trim();
      }

      console.log('[1001TL] Extracting chart tracks:', chartName);

      // Chart pages have track items with format: "Artist - Track [Label]"
      // Look for track links
      const trackLinks = document.querySelectorAll('a[href*="/track/"]');
      console.log('[1001TL] Found', trackLinks.length, 'track links');

      const processedTracks = new Set();

      trackLinks.forEach((link, index) => {
        try {
          const trackText = link.textContent?.trim() || '';
          const trackUrl = link.href;

          // Skip duplicates
          if (processedTracks.has(trackUrl)) return;
          processedTracks.add(trackUrl);

          if (!trackText || trackText.length < 3) return;

          // Parse "Artist - Track Name [LABEL]" format
          let artist = '';
          let title = '';
          let label = '';

          // Extract label from brackets at end
          const labelMatch = trackText.match(/\[([^\]]+)\]$/);
          if (labelMatch) {
            label = labelMatch[1].trim();
          }

          // Remove label from text for parsing
          const textWithoutLabel = trackText.replace(/\s*\[[^\]]+\]\s*$/, '').trim();

          // Split by " - " to get artist and title
          const dashIndex = textWithoutLabel.indexOf(' - ');
          if (dashIndex > 0) {
            artist = textWithoutLabel.substring(0, dashIndex).trim();
            title = textWithoutLabel.substring(dashIndex + 3).trim();
          } else {
            title = textWithoutLabel;
          }

          // Get play count from parent container
          let playCount = 0;
          const parent = link.closest('.bItm, .chartItem, tr, li') || link.parentElement?.parentElement;
          if (parent) {
            // Look for play count (the circled number)
            const playEl = parent.querySelector('.pCnt, [class*="play"], .chartPos');
            if (playEl) {
              const playMatch = playEl.textContent?.match(/(\d+)/);
              if (playMatch) playCount = parseInt(playMatch[1]);
            }
          }

          // Get position from the chart
          let position = index + 1;
          if (parent) {
            const posEl = parent.querySelector('.chartPosition, .pos, td:first-child');
            if (posEl) {
              const posMatch = posEl.textContent?.match(/(\d+)/);
              if (posMatch) position = parseInt(posMatch[1]);
            }
          }

          if (title) {
            tracks.push({
              title,
              artist: artist || 'Unknown',
              label: label || null,
              play_count: playCount,
              position,
              source_url: trackUrl,
            });

            // Add artist(s) to map
            // Handle multiple artists (e.g., "Artist1 & Artist2" or "Artist1 vs. Artist2")
            if (artist) {
              const artistNames = artist.split(/\s*(?:&|vs\.?|feat\.?|ft\.?|,|x)\s*/i);
              artistNames.forEach(name => {
                const cleanName = name.trim();
                if (cleanName && cleanName !== 'Unknown' && cleanName.length > 1 && !artists.has(cleanName)) {
                  artists.set(cleanName, {
                    name: cleanName,
                  });
                }
              });
            }
          }
        } catch (e) {
          console.error('[1001TL] Track parse error:', e);
        }
      });

      console.log('[1001TL] Extracted', tracks.length, 'tracks from chart page');
      return {
        chartName,
        tracks,
        artists: Array.from(artists.values()),
      };
    } catch (e) {
      console.error('[1001TL] Chart extraction error:', e);
      return { chartName: '', tracks: [], artists: [] };
    }
  }

  // Extract top tracks from genre page sidebar
  function extractGenreTopTracks() {
    const tracks = [];
    const artists = new Map();

    try {
      // Get genre name from page title or breadcrumb
      let genreName = '';
      const breadcrumb = document.querySelector('.breadcrumb a[href*="/genre/"]');
      if (breadcrumb) {
        genreName = breadcrumb.textContent?.trim() || '';
      }
      if (!genreName) {
        const titleMatch = document.title.match(/^([^|]+)/);
        if (titleMatch) genreName = titleMatch[1].trim();
      }

      console.log('[1001TL] Extracting genre top tracks for:', genreName);

      // Find the top tracks container - it's usually in a sidebar or main content
      // Look for track entries with the format: "Artist - Track [LABEL]"
      // They have position numbers and play counts

      // Method 1: Look for track items in the sidebar
      const trackContainers = document.querySelectorAll('.sideTop100 .bItm, .topTracksWrap .bItm, .tWrap .bItm');
      console.log('[1001TL] Found track containers (method 1):', trackContainers.length);

      // Method 2: Look for any elements with track info pattern
      if (trackContainers.length === 0) {
        // Try finding by the structure shown in screenshot
        // Position number followed by track link
        const allLinks = document.querySelectorAll('a[href*="/track/"]');
        console.log('[1001TL] Found track links:', allLinks.length);

        allLinks.forEach((link, index) => {
          try {
            const trackText = link.textContent?.trim() || '';
            if (!trackText || trackText.length < 3) return;

            // Parse "Artist - Track Name [LABEL]" or "Artist1 & Artist2 - Track [LABEL]"
            let artist = '';
            let title = '';
            let label = '';

            // Extract label from brackets
            const labelMatch = trackText.match(/\[([^\]]+)\]$/);
            if (labelMatch) {
              label = labelMatch[1].trim();
            }

            // Remove label from text for parsing
            const textWithoutLabel = trackText.replace(/\s*\[[^\]]+\]\s*$/, '').trim();

            // Split by " - " to get artist and title
            const dashIndex = textWithoutLabel.indexOf(' - ');
            if (dashIndex > 0) {
              artist = textWithoutLabel.substring(0, dashIndex).trim();
              title = textWithoutLabel.substring(dashIndex + 3).trim();
            } else {
              title = textWithoutLabel;
            }

            // Try to get play count from nearby element
            let playCount = 0;
            const parent = link.closest('.bItm') || link.parentElement;
            if (parent) {
              const playEl = parent.querySelector('.pCnt, .plays, [class*="play"]');
              if (playEl) {
                const playMatch = playEl.textContent?.match(/(\d+)/);
                if (playMatch) playCount = parseInt(playMatch[1]);
              }
            }

            // Get external links near this track
            let soundcloud_url = null;
            let youtube_url = null;
            let spotify_url = null;
            if (parent) {
              parent.querySelectorAll('a[href]').forEach(extLink => {
                const href = extLink.href;
                if (href.includes('soundcloud.com') && !soundcloud_url) soundcloud_url = href;
                if ((href.includes('youtube.com') || href.includes('youtu.be')) && !youtube_url) youtube_url = href;
                if (href.includes('spotify.com') && !spotify_url) spotify_url = href;
              });
            }

            if (title && artist) {
              tracks.push({
                title,
                artist,
                label,
                play_count: playCount,
                position: index + 1,
                genre: genreName,
                soundcloud_url,
                youtube_url,
                spotify_url,
              });

              // Add artist(s) to map
              // Handle multiple artists (e.g., "Artist1 & Artist2" or "Artist1 vs. Artist2")
              const artistNames = artist.split(/\s*(?:&|vs\.?|feat\.?|ft\.?|,)\s*/i);
              artistNames.forEach(name => {
                const cleanName = name.trim();
                if (cleanName && cleanName !== 'Unknown' && !artists.has(cleanName)) {
                  artists.set(cleanName, {
                    name: cleanName,
                    genres: genreName ? [genreName] : [],
                  });
                }
              });
            }
          } catch (e) {
            console.error('[1001TL] Track parse error:', e);
          }
        });
      } else {
        // Process containers found with method 1
        trackContainers.forEach((item, index) => {
          try {
            const trackLink = item.querySelector('a[href*="/track/"]');
            const trackText = trackLink?.textContent?.trim() || '';

            if (!trackText) return;

            let artist = '';
            let title = '';
            let label = '';

            const labelMatch = trackText.match(/\[([^\]]+)\]$/);
            if (labelMatch) label = labelMatch[1].trim();

            const textWithoutLabel = trackText.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
            const dashIndex = textWithoutLabel.indexOf(' - ');
            if (dashIndex > 0) {
              artist = textWithoutLabel.substring(0, dashIndex).trim();
              title = textWithoutLabel.substring(dashIndex + 3).trim();
            } else {
              title = textWithoutLabel;
            }

            // Get play count
            let playCount = 0;
            const playEl = item.querySelector('.pCnt, .plays');
            if (playEl) {
              const playMatch = playEl.textContent?.match(/(\d+)/);
              if (playMatch) playCount = parseInt(playMatch[1]);
            }

            if (title && artist) {
              tracks.push({
                title,
                artist,
                label,
                play_count: playCount,
                position: index + 1,
                genre: genreName,
              });

              const artistNames = artist.split(/\s*(?:&|vs\.?|feat\.?|ft\.?|,)\s*/i);
              artistNames.forEach(name => {
                const cleanName = name.trim();
                if (cleanName && cleanName !== 'Unknown' && !artists.has(cleanName)) {
                  artists.set(cleanName, {
                    name: cleanName,
                    genres: genreName ? [genreName] : [],
                  });
                }
              });
            }
          } catch (e) {
            console.error('[1001TL] Track container parse error:', e);
          }
        });
      }

      console.log('[1001TL] Extracted', tracks.length, 'tracks from genre page');
      return {
        genreName,
        tracks,
        artists: Array.from(artists.values()),
      };
    } catch (e) {
      console.error('[1001TL] Genre extraction error:', e);
      return { genreName: '', tracks: [], artists: [] };
    }
  }

  // Main extraction function
  async function extract() {
    const currentUrl = window.location.href;
    const isTracklistPage = currentUrl.includes('/tracklist/');
    const isDjProfilePage = currentUrl.includes('/dj/') && !currentUrl.includes('/tracklist/');
    const isGenrePage = currentUrl.includes('/genre/');
    const isChartPage = currentUrl.includes('/charts/');

    // For chart pages (weekly, monthly, etc.) - tracks only, NO sets
    if (isChartPage) {
      const chartResult = extractChartTracks();
      return {
        source: '1001tracklists',
        sourceUrl: currentUrl,
        pageType: 'chart', // Important: this tells the API not to create a set
        scrapedAt: new Date().toISOString(),
        chartName: chartResult.chartName,
        tracks: chartResult.tracks,
        artists: chartResult.artists,
        // No setInfo - this ensures no set is created
      };
    }

    // For genre pages, extract top tracks - tracks only, NO sets
    if (isGenrePage) {
      const genreResult = extractGenreTopTracks();
      return {
        source: '1001tracklists',
        sourceUrl: currentUrl,
        pageType: 'genre', // Important: this tells the API not to create a set
        scrapedAt: new Date().toISOString(),
        genreName: genreResult.genreName,
        tracks: genreResult.tracks,
        artists: genreResult.artists,
        // No setInfo - this ensures no set is created
      };
    }

    // For tracklist pages - CREATE a set with tracks
    if (isTracklistPage) {
      // Wait for timestamps to load (they're loaded dynamically)
      await waitForTimestamps(3000);

      const result = extractTracklist();

      return {
        source: '1001tracklists',
        sourceUrl: currentUrl,
        pageType: 'tracklist', // This tells the API to create a set
        scrapedAt: new Date().toISOString(),
        setInfo: result.setInfo, // setInfo triggers set creation
        tracks: result.tracks,
        artists: result.artists,
      };
    }

    // For listing pages (DJ/venue profiles, any page with multiple tracklists)
    const listingUrls = extractDjProfileUrls();
    if (listingUrls.length > 0) {
      const pageLabel =
        getDjNameFromProfile() ||
        document.title.replace(/ \| 1001Tracklists$/i, '').trim();
      return {
        source: '1001tracklists',
        sourceUrl: currentUrl,
        pageType: isDjProfilePage ? 'dj_profile' : 'listing',
        isBatchPage: true,
        tracklistUrls: listingUrls,
        pageLabel,
        scrapedAt: new Date().toISOString(),
        tracks: [],
        artists: [],
      };
    }

    // Fallback: nothing useful on this page
    return {
      source: '1001tracklists',
      sourceUrl: null,
      pageType: 'unknown',
      scrapedAt: new Date().toISOString(),
      tracks: [],
      artists: [],
    };
  }
  
  // ── DJ profile helpers ──────────────────────────────────────────────────────

  function isDjProfilePage() {
    return location.pathname.includes('/dj/') && !location.pathname.includes('/tracklist/');
  }

  function extractDjProfileUrls() {
    const seen = new Set();
    const urls = [];
    document.querySelectorAll('a[href*="/tracklist/"]').forEach(a => {
      // Strip query params / fragments; only keep the canonical path
      const url = a.href.split('?')[0].split('#')[0];
      if (url.includes('/tracklist/') && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    });
    return urls;
  }

  function getDjNameFromProfile() {
    return (
      document.querySelector('h1.djName')?.textContent?.trim() ||
      document.querySelector('.djTitle')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      ''
    );
  }

  // ── DJ profile batch-import button ──────────────────────────────────────────

  function createDjProfileButton() {
    if (document.getElementById('identified-btn')) return;

    const urls   = extractDjProfileUrls();
    const djName = getDjNameFromProfile();
    if (urls.length === 0) return;

    const btn = document.createElement('button');
    btn.id        = 'identified-btn';
    btn.innerHTML = `📋 Queue ${urls.length} Sets`;
    btn.title     = `Batch-import all sets for ${djName || 'this DJ'}`;

    // Live-update the count when the page loads more content (e.g. "See More" sidebar)
    let countObserver = null;
    function startCountObserver() {
      if (countObserver) return;
      countObserver = new MutationObserver(() => {
        if (!btn.innerHTML.startsWith('⏳')) {
          const n = extractDjProfileUrls().length;
          btn.innerHTML = `📋 Queue ${n} Sets`;
        }
      });
      countObserver.observe(document.body, { childList: true, subtree: true });
    }
    startCountObserver();

    let pollInterval = null;

    function stopPolling() {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }

    function startPolling(total) {
      stopPolling();
      pollInterval = setInterval(async () => {
        try {
          const status = await chrome.runtime.sendMessage({ type: 'BATCH_STATUS' });
          if (!status.running) {
            stopPolling();
            const p = status.progress;
            btn.innerHTML = `✅ Done! ${p.success}/${p.total} imported`;
            btn.disabled  = false;
            setTimeout(() => { btn.innerHTML = `📋 Queue ${extractDjProfileUrls().length} Sets`; }, 6000);
          } else {
            const p = status.progress;
            btn.innerHTML = `⏳ ${p.done}/${p.total} sets...`;
          }
        } catch (e) {
          stopPolling();
          btn.disabled  = false;
          btn.innerHTML = `📋 Queue ${urls.length} Sets`;
        }
      }, 2500);
    }

    btn.addEventListener('click', async () => {
      if (btn.innerHTML.startsWith('⏳')) {
        // Second click while running → stop
        try { await chrome.runtime.sendMessage({ type: 'BATCH_STOP' }); } catch {}
        stopPolling();
        btn.disabled  = false;
        const fresh = extractDjProfileUrls();
        btn.innerHTML = `📋 Queue ${fresh.length} Sets`;
        return;
      }

      // Re-extract at click time — captures anything loaded by "Show More"
      const urls   = extractDjProfileUrls();
      const djName = getDjNameFromProfile();

      if (urls.length === 0) {
        btn.innerHTML = '⚠️ No sets found';
        setTimeout(() => { btn.innerHTML = `📋 Queue Sets`; }, 2000);
        return;
      }

      if (countObserver) { countObserver.disconnect(); countObserver = null; }
      btn.disabled  = true;
      btn.innerHTML = `Starting ${urls.length} sets...`;

      try {
        const resp = await chrome.runtime.sendMessage({
          type:   'BATCH_START',
          urls,
          djName,
        });
        if (resp.success) {
          btn.disabled  = false; // re-enable so click-to-stop works
          btn.innerHTML = `⏳ 0/${urls.length} sets...`;
          startPolling(urls.length);
        } else {
          btn.innerHTML = '❌ Failed to start';
          btn.disabled  = false;
        }
      } catch (e) {
        btn.innerHTML = '❌ Error: ' + e.message;
        btn.disabled  = false;
      }
    });

    document.body.appendChild(btn);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE') {
      // Handle async extraction
      (async () => {
        try {
          const data = await extract();
          sendResponse({ success: true, data });
        } catch (error) {
          console.error('[1001TL Extractor] Error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
    }
    return true; // Keep channel open for async response
  });
  
  // Create floating button
  function createButton() {
    if (document.getElementById('identified-btn')) return;

    // On individual tracklist pages — create the single-scrape button right away
    if (location.pathname.includes('/tracklist/')) {
      _createSingleScrapeButton();
      return;
    }

    // On listing pages (DJ profiles, genre pages, etc.) — wait for tracklist
    // links to appear in the DOM (they load via JS after document_idle fires)
    const urls = extractDjProfileUrls();
    if (urls.length > 0) {
      createDjProfileButton();
      return;
    }

    // Not loaded yet — watch for them
    const observer = new MutationObserver(() => {
      if (document.getElementById('identified-btn')) { observer.disconnect(); return; }
      if (extractDjProfileUrls().length > 0) {
        observer.disconnect();
        createDjProfileButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Belt-and-suspenders: also try after fixed delays
    [2000, 5000].forEach(delay => {
      setTimeout(() => {
        if (!document.getElementById('identified-btn') && extractDjProfileUrls().length > 0) {
          observer.disconnect();
          createDjProfileButton();
        }
      }, delay);
    });
  }

  function _createSingleScrapeButton() {
    const btn = document.createElement('button');
    btn.id = 'identified-btn';
    btn.innerHTML = "✨ TRACK'D";
    btn.title = "Scrape and send tracklist to TRACK'D";
    
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '⏳ Scraping...';

      try {
        const data = await extract();

        if (data.tracks.length === 0 && data.artists?.length === 0) {
          btn.innerHTML = '⚠️ No tracks found';
          setTimeout(() => {
            btn.innerHTML = "✨ TRACK'D";
            btn.disabled = false;
          }, 2000);
          return;
        }

        btn.innerHTML = `📤 Sending ${data.tracks.length} tracks...`;

        // Auto-send to API
        const response = await chrome.runtime.sendMessage({
          type: 'SEND_TO_API',
          data: data
        });

        if (response.success) {
          const r = response.result;
          // Show different message based on page type
          if (data.pageType === 'tracklist' && r.setsCreated > 0) {
            btn.innerHTML = `✅ Set + ${r.tracksCreated || 0} tracks`;
          } else {
            // Chart/genre page - just tracks and artists
            const parts = [];
            if (r.artistsCreated > 0) parts.push(`+${r.artistsCreated} artists`);
            if (r.tracksCreated > 0) parts.push(`+${r.tracksCreated} tracks`);
            if (parts.length === 0) parts.push('All exist');
            btn.innerHTML = `✅ ${parts.join(', ')}`;
          }
          console.log('[1001TL] Sent to API:', response.result);
        } else {
          btn.innerHTML = '❌ ' + (response.error || 'Send failed');
          console.error('[1001TL] API error:', response.error);
        }

        setTimeout(() => {
          btn.innerHTML = "✨ TRACK'D";
          btn.disabled = false;
        }, 4000);

      } catch (e) {
        console.error('[1001TL] Button error:', e);
        btn.innerHTML = '❌ Error';
        setTimeout(() => {
          btn.innerHTML = "✨ TRACK'D";
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
    // Wait for Cloudflare challenge to pass and page to fully render
    await new Promise(resolve => setTimeout(resolve, 7000));

    const data = await extract();
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
    // DJ profile pages: no auto-scrape (batch button handles everything)
    // Genre/chart pages: auto-scrape still fires to capture top tracks
    // Tracklist pages: auto-scrape handles the set
    if (!isDjProfilePage()) {
      setTimeout(autoScrape, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[1001Tracklists Extractor] Loaded');
})();
