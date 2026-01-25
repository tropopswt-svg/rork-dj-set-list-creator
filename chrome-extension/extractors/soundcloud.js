// IDentified - SoundCloud Extractor
// Scrapes tracks and artists from SoundCloud pages

(function() {
  'use strict';
  
  // Detect page type
  function getPageType() {
    const url = window.location.href;
    const path = window.location.pathname;

    if (path.includes('/charts/')) return 'charts';
    if (path.includes('/discover/sets')) return 'discover_sets';
    if (url.includes('/discover')) return 'discover';
    if (path.includes('/sets/')) return 'playlist';
    if (path.includes('/likes')) return 'likes';
    if (path.includes('/reposts')) return 'reposts';
    if (path.includes('/tracks')) return 'tracks';
    if (path.includes('/albums')) return 'albums';
    if (path.match(/^\/[^\/]+\/[^\/]+$/)) return 'track'; // /artist/track-name
    if (path.match(/^\/[^\/]+\/?$/)) return 'artist'; // /artist
    if (url.includes('/search')) return 'search';
    return 'unknown';
  }

  // Extract genre from URL or page
  function extractGenre() {
    const path = window.location.pathname;

    // Charts URL: /charts/top?genre=house
    const urlParams = new URLSearchParams(window.location.search);
    const genreParam = urlParams.get('genre');
    if (genreParam) {
      return genreParam.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // Discover URL: /discover/sets/charts-top:house
    const genreMatch = path.match(/charts-[^:]+:([^\/]+)/);
    if (genreMatch) {
      return genreMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // Try to get from page title or breadcrumb
    const breadcrumb = document.querySelector('.g-nav-item.active, [class*="genre"]');
    if (breadcrumb) {
      return breadcrumb.textContent?.trim() || '';
    }

    return '';
  }
  
  // Extract artist name from URL or page
  function extractArtistFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/^\/([^\/]+)/);
    if (match) {
      return match[1].replace(/-/g, ' ');
    }
    return null;
  }
  
  // Extract tracks from the page
  function extractTracks() {
    const tracks = [];
    const artists = new Map();
    
    // SoundCloud track selectors
    const trackSelectors = [
      '.soundList__item',
      '.trackItem',
      '.searchItem',
      '.sound',
      '[class*="trackItem"]',
      '.playableTile',
      'article[class*="track"]',
    ];
    
    let trackElements = [];
    for (const selector of trackSelectors) {
      trackElements = document.querySelectorAll(selector);
      if (trackElements.length > 0) break;
    }
    
    trackElements.forEach((el, index) => {
      try {
        // Extract track title
        const titleEl = el.querySelector(
          '.soundTitle__title, .trackItem__trackTitle, ' +
          '[class*="trackTitle"], a[href*="/"] span[class*="title"], ' +
          '.soundTitle__usernameText'
        );
        let title = titleEl?.textContent?.trim();
        
        // Extract artist
        const artistEl = el.querySelector(
          '.soundTitle__username, .trackItem__username, ' +
          '[class*="username"], a[href^="/"] span[class*="user"]'
        );
        const artistName = artistEl?.textContent?.trim();
        const artistUrl = artistEl?.closest('a')?.href;
        
        // Extract track URL
        const trackLink = el.querySelector('a[href*="/"]');
        const trackUrl = trackLink?.href;
        
        // Extract play count
        const playsEl = el.querySelector(
          '[class*="playbackCount"], .soundStats__plays, ' +
          '[class*="plays"], [title*="plays"]'
        );
        const playsText = playsEl?.textContent?.trim() || playsEl?.title || '';
        const plays = parsePlayCount(playsText);
        
        // Extract likes
        const likesEl = el.querySelector(
          '[class*="likes"], .soundStats__likes'
        );
        const likesText = likesEl?.textContent?.trim() || '';
        const likes = parsePlayCount(likesText);
        
        // Extract duration
        const durationEl = el.querySelector(
          '[class*="duration"], .soundBadge__duration, ' +
          'span[class*="time"]'
        );
        const durationStr = durationEl?.textContent?.trim() || '';
        const durationSeconds = parseDuration(durationStr);
        
        // Extract genre/tags
        const tagEls = el.querySelectorAll(
          '[class*="tag"], a[href*="/tags/"]'
        );
        const tags = [];
        tagEls.forEach(t => {
          const tag = t.textContent?.trim();
          if (tag && !tags.includes(tag)) tags.push(tag);
        });
        
        // Extract artwork
        const artworkEl = el.querySelector(
          '[class*="artwork"] img, .sound__coverArt img, ' +
          'span[style*="background-image"]'
        );
        let artworkUrl = artworkEl?.src;
        if (!artworkUrl && artworkEl?.style?.backgroundImage) {
          artworkUrl = artworkEl.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];
        }
        
        // Add artist to map
        if (artistName && !artists.has(artistName)) {
          artists.set(artistName, {
            name: artistName,
            soundcloud_url: artistUrl,
          });
        }
        
        if (title) {
          tracks.push({
            title,
            artist: artistName || extractArtistFromUrl() || 'Unknown',
            soundcloud_url: trackUrl,
            plays,
            likes,
            duration_seconds: durationSeconds,
            tags,
            artwork_url: artworkUrl,
            position: index + 1,
          });
        }
      } catch (e) {
        console.error('[SoundCloud Extractor] Track parse error:', e);
      }
    });
    
    return { tracks, artists: Array.from(artists.values()) };
  }
  
  // Extract single track page
  function extractSingleTrack() {
    const tracks = [];
    const artists = [];
    
    try {
      // Get track title
      const titleEl = document.querySelector(
        '[class*="soundTitle__title"], h1[class*="title"], ' +
        '.fullHero__title'
      );
      const title = titleEl?.textContent?.trim();
      
      // Get artist
      const artistEl = document.querySelector(
        '[class*="soundTitle__username"], .fullHero__username, ' +
        'a[href^="/"][class*="user"]'
      );
      const artistName = artistEl?.textContent?.trim();
      const artistUrl = artistEl?.href;
      
      // Get description (might contain track info)
      const descEl = document.querySelector(
        '[class*="description"], .truncatedAudioInfo__content'
      );
      const description = descEl?.textContent?.trim();
      
      // Get tags/genre
      const tagEls = document.querySelectorAll(
        '[class*="tag"] a, a[href*="/tags/"]'
      );
      const tags = [];
      tagEls.forEach(t => {
        const tag = t.textContent?.trim();
        if (tag && !tags.includes(tag)) tags.push(tag);
      });
      
      // Get play count
      const playsEl = document.querySelector('[class*="playbackCount"]');
      const plays = parsePlayCount(playsEl?.textContent?.trim() || '');
      
      // Get duration
      const durationEl = document.querySelector(
        '[class*="duration"], .playbackTimeline__duration'
      );
      const durationSeconds = parseDuration(durationEl?.textContent?.trim() || '');
      
      // Get artwork
      const artworkEl = document.querySelector(
        '[class*="artwork"] img, .fullHero__artwork img'
      );
      const artworkUrl = artworkEl?.src;
      
      // Get release date
      const dateEl = document.querySelector(
        '[class*="releaseDate"], time[datetime]'
      );
      const releaseDate = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();
      
      if (artistName) {
        artists.push({
          name: artistName,
          soundcloud_url: artistUrl,
        });
      }
      
      if (title) {
        tracks.push({
          title,
          artist: artistName || 'Unknown',
          soundcloud_url: window.location.href,
          plays,
          duration_seconds: durationSeconds,
          tags,
          artwork_url: artworkUrl,
          release_date: releaseDate,
          description,
        });
      }
    } catch (e) {
      console.error('[SoundCloud Extractor] Single track error:', e);
    }
    
    return { tracks, artists };
  }
  
  // Extract artist page
  function extractArtistPage() {
    const artists = [];
    
    try {
      // Get artist name
      const nameEl = document.querySelector(
        '[class*="profileHeaderInfo__userName"], h1, ' +
        '.userInfoBar__username'
      );
      const name = nameEl?.textContent?.trim();
      
      // Get image
      const imgEl = document.querySelector(
        '[class*="profileHeaderInfo__avatar"] img, .userAvatar__image'
      );
      const imageUrl = imgEl?.src;
      
      // Get bio
      const bioEl = document.querySelector(
        '[class*="bio"], .userInfoBar__description'
      );
      const bio = bioEl?.textContent?.trim();
      
      // Get location
      const locEl = document.querySelector(
        '[class*="location"], .userInfoBar__location'
      );
      const location = locEl?.textContent?.trim();
      
      // Get followers
      const followersEl = document.querySelector(
        '[class*="followers"] span, [title*="followers"]'
      );
      const followers = parsePlayCount(followersEl?.textContent?.trim() || '');
      
      if (name) {
        artists.push({
          name,
          image_url: imageUrl,
          bio,
          location,
          followers,
          soundcloud_url: window.location.href,
        });
      }
    } catch (e) {
      console.error('[SoundCloud Extractor] Artist page error:', e);
    }
    
    // Also extract any tracks on the page
    const { tracks, artists: trackArtists } = extractTracks();
    
    return {
      tracks,
      artists: [...artists, ...trackArtists.filter(a => !artists.find(x => x.name === a.name))],
    };
  }
  
  // Parse play/like counts (handles K, M suffixes)
  function parsePlayCount(str) {
    if (!str) return 0;
    const num = parseFloat(str.replace(/[^0-9.KMkm]/g, ''));
    if (str.toLowerCase().includes('m')) return Math.round(num * 1000000);
    if (str.toLowerCase().includes('k')) return Math.round(num * 1000);
    return Math.round(num) || 0;
  }
  
  // Parse duration string to seconds
  function parseDuration(str) {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }
  
  // Main extraction function
  function extract() {
    const pageType = getPageType();
    const genre = extractGenre();
    console.log('[SoundCloud Extractor] Page type:', pageType, 'Genre:', genre);

    let result;

    if (pageType === 'track') {
      result = extractSingleTrack();
    } else if (pageType === 'artist') {
      result = extractArtistPage();
    } else {
      result = extractTracks();
    }

    // Add genre to tracks and artists if detected
    if (genre) {
      result.genreName = genre;
      result.tracks = result.tracks.map(t => ({ ...t, genre }));
      result.artists = result.artists.map(a => ({
        ...a,
        genres: a.genres ? [...a.genres, genre] : [genre]
      }));
    }

    // Add metadata
    result.source = 'soundcloud';
    result.sourceUrl = window.location.href;
    result.pageType = pageType;
    result.scrapedAt = new Date().toISOString();

    console.log('[SoundCloud Extractor] Result:', result);
    return result;
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE') {
      try {
        const data = extract();
        sendResponse({ success: true, data });
      } catch (error) {
        console.error('[SoundCloud Extractor] Error:', error);
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
        
        if (data.tracks.length === 0 && data.artists.length === 0) {
          btn.innerHTML = '⚠️ Nothing found';
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
          console.log('[SoundCloud] Sent to API:', response.result);
        } else {
          btn.innerHTML = '❌ ' + (response.error || 'Send failed');
          console.error('[SoundCloud] API error:', response.error);
        }
        
        setTimeout(() => {
          btn.innerHTML = '✨ IDentified';
          btn.disabled = false;
        }, 4000);
        
      } catch (e) {
        console.error('[SoundCloud] Button error:', e);
        btn.innerHTML = '❌ Error';
        setTimeout(() => {
          btn.innerHTML = '✨ IDentified';
          btn.disabled = false;
        }, 3000);
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
  
  console.log('[SoundCloud Extractor] Loaded');
})();
