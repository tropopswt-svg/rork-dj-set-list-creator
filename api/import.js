const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const SOUNDCLOUD_OEMBED = 'https://soundcloud.com/oembed';
const SOUNDCLOUD_API_V2 = 'https://api-v2.soundcloud.com';

// Cache for dynamic SoundCloud client_id
let cachedSoundCloudClientId = null;
let clientIdFetchedAt = 0;
const CLIENT_ID_CACHE_DURATION = 3600000; // 1 hour

// Dynamically fetch a fresh SoundCloud client_id from their JS files
async function fetchSoundCloudClientId() {
  // Return cached if still valid
  if (cachedSoundCloudClientId && (Date.now() - clientIdFetchedAt) < CLIENT_ID_CACHE_DURATION) {
    return cachedSoundCloudClientId;
  }
  
  try {
    // Step 1: Fetch SoundCloud homepage to find JS files
    const homeResponse = await fetch('https://soundcloud.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!homeResponse.ok) {
      console.log('Failed to fetch SoundCloud homepage');
      return null;
    }
    
    const html = await homeResponse.text();
    
    // Step 2: Extract JS file URLs from <script crossorigin src="..."> tags
    const scriptPattern = /<script crossorigin src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g;
    const urls = [];
    let match;
    while ((match = scriptPattern.exec(html)) !== null) {
      urls.push(match[1]);
    }
    
    if (urls.length === 0) {
      console.log('No SoundCloud JS files found');
      return null;
    }
    
    // Step 3: Fetch the last JS file (usually contains the client_id)
    const jsUrl = urls[urls.length - 1];
    console.log('Fetching SoundCloud JS:', jsUrl);
    
    const jsResponse = await fetch(jsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    if (!jsResponse.ok) {
      console.log('Failed to fetch SoundCloud JS file');
      return null;
    }
    
    const jsContent = await jsResponse.text();
    
    // Step 4: Extract client_id from the JS content
    const clientIdMatch = jsContent.match(/,client_id:"([^"]+)"/);
    if (clientIdMatch) {
      cachedSoundCloudClientId = clientIdMatch[1];
      clientIdFetchedAt = Date.now();
      console.log('Found fresh SoundCloud client_id:', cachedSoundCloudClientId.substring(0, 10) + '...');
      return cachedSoundCloudClientId;
    }
    
    // Try alternative patterns
    const altMatch = jsContent.match(/client_id=([a-zA-Z0-9]+)/);
    if (altMatch) {
      cachedSoundCloudClientId = altMatch[1];
      clientIdFetchedAt = Date.now();
      console.log('Found SoundCloud client_id (alt):', cachedSoundCloudClientId.substring(0, 10) + '...');
      return cachedSoundCloudClientId;
    }
    
    console.log('Could not find client_id in JS file');
    return null;
  } catch (error) {
    console.error('Error fetching SoundCloud client_id:', error);
    return null;
  }
}

// ============ PLATFORM DETECTION ============

function detectPlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('mixcloud.com')) return 'mixcloud';
  return null;
}

// ============ YOUTUBE FUNCTIONS ============

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchVideoInfo(videoId, apiKey) {
  const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
  }
  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found');
  }
  const video = data.items[0];
  return {
    id: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    channelTitle: video.snippet.channelTitle,
    publishedAt: video.snippet.publishedAt,
    thumbnailUrl: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url,
    duration: video.contentDetails.duration,
  };
}

async function fetchVideoComments(videoId, apiKey, maxResults = 500) {
  const comments = [];
  let nextPageToken;
  while (comments.length < maxResults) {
    const pageSize = Math.min(100, maxResults - comments.length);
    let url = `${YOUTUBE_API_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${pageSize}&order=relevance&key=${apiKey}`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      if (error.error?.errors?.[0]?.reason === 'commentsDisabled') break;
      throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
    }
    const data = await response.json();
    if (!data.items || data.items.length === 0) break;
    for (const item of data.items) {
      const c = item.snippet.topLevelComment.snippet;
      comments.push({
        id: item.id,
        authorName: c.authorDisplayName,
        text: c.textOriginal || c.textDisplay,
        likeCount: c.likeCount,
      });
    }
    nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
  }
  return comments;
}

function cleanText(text) {
  return text.replace(/<[^>]+>/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

function extractTimestamps(text) {
  const results = [];
  const cleaned = cleanText(text);
  const longPattern = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;
  let match;
  while ((match = longPattern.exec(cleaned)) !== null) {
    const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    results.push({ timestamp: seconds, formatted: match[0], position: match.index });
  }
  const shortPattern = /\b(\d{1,2}):(\d{2})\b/g;
  while ((match = shortPattern.exec(cleaned)) !== null) {
    const isPartOfLonger = results.some(r => match.index >= r.position && match.index < r.position + r.formatted.length + 3);
    if (!isPartOfLonger) {
      const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      results.push({ timestamp: seconds, formatted: match[0], position: match.index });
    }
  }
  return results.sort((a, b) => a.position - b.position);
}

function parseTrackInfo(text) {
  let cleaned = cleanText(text);
  // Remove leading punctuation, brackets, whitespace
  cleaned = cleaned.replace(/^[\s|:\-–—.\[\]()]+/, '').trim();
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[\s|:\-–—.\[\]()]+$/, '').trim();
  // Remove numbered list prefixes like "1." or "2)"
  cleaned = cleaned.replace(/^\d{1,2}[.)]\s*/, '').trim();

  // STRICT FILTERING - Reject obvious garbage
  
  // Reject URLs
  if (/https?:\/\/|www\.|\.com|\.org|soundcloud\.com|youtube\.com|youtu\.be|spotify\.com|music\.apple/i.test(cleaned)) {
    return null;
  }
  
  // Reject URL fragments (video IDs, query params)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(cleaned) || /[?&=]/.test(cleaned) || /watch\?v=/i.test(cleaned)) {
    return null;
  }
  
  // Reject user reactions and comments (not track names)
  const reactionPatterns = [
    /^love\s*(it|this|that)?!*$/i,
    /^fuck(ing)?\s*(love|loved|amazing)/i,
    /^(this|that)\s*(is|was)\s*(so|the|a|an)?\s*(good|great|amazing|fire|sick|insane)/i,
    /^i\s+remember/i,
    /^i\s+(love|loved|like|liked|need)/i,
    /^(so|very|really)\s+(good|fire|sick)/i,
    /^not\s+sure\s+what/i,
    /^anyone\s+(know|got|have)/i,
    /^what\s+(is|was)\s+(this|that)/i,
    /^can\s+(someone|anyone)/i,
    /^(absolute|total)\s+(banger|fire|heater)/i,
    /^(banger|fire|heater|sick|insane|crazy|unreal|amazing|incredible)!*$/i,
    /^ooph/i,
    /^grimy/i,
    /^dark$/i,
    /^(the|this|that)\s+\w+\s+is\s+(the|a)/i,  // "the X is the Y" pattern
    /^listen\s+to/i,
    /starting\s+at\s+\w+\s+\d+/i,  // "starting at edco 2024"
  ];
  
  for (const pattern of reactionPatterns) {
    if (pattern.test(cleaned)) return null;
  }
  
  // Reject ID/unknown tracks
  const idPatterns = [
    /^\s*tracklist\s*:?\s*$/i, 
    /^intro$/i, 
    /^outro$/i, 
    /^id\s*[-–—]\s*id\s*$/i, 
    /^unknown$/i, 
    /^tba$/i, 
    /^\s*$/, 
    /^id\?*$/i, 
    /^track\s*id\?*$/i,
    /\(id\)$/i,  // Ends with (ID)
    /\bid\b.*\bid\b/i,  // Contains "ID" multiple times
    /^id\s*$/i,
  ];
  
  for (const noise of idPatterns) {
    if (noise.test(cleaned)) return null;
  }
  
  // Reject text with unbalanced parentheses (broken parsing)
  const openParens = (cleaned.match(/\(/g) || []).length;
  const closeParens = (cleaned.match(/\)/g) || []).length;
  if (Math.abs(openParens - closeParens) > 1) return null;
  
  // Reject if it starts or ends with a broken parenthesis pattern
  if (/^\)/.test(cleaned) || /\($/.test(cleaned)) return null;
  
  // Reject pure emoji or too short
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
  const emojis = cleaned.match(emojiRegex) || [];
  const nonEmojiLength = cleaned.replace(emojiRegex, '').trim().length;
  if (emojis.length > 0 && nonEmojiLength < 5) return null;
  if (/^\d+:\d+\s*$/.test(cleaned)) return null;
  if (/\?\s*$/.test(cleaned) && !cleaned.includes(' - ')) return null;
  if (cleaned.length < 3 || cleaned.length > 200) return null;

  // Remove any stray timestamps that might be embedded in the text
  cleaned = cleaned.replace(/\d{1,2}:\d{2}(:\d{2})?\s*/g, '').trim();
  
  // Standard format: "Artist - Title"
  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let part1 = dashMatch[1].trim();
    let part2 = dashMatch[2].trim();
    
    // Validate both parts look like real track/artist info
    if (!isValidTrackPart(part1) || !isValidTrackPart(part2)) return null;
    
    // Check for remix/edit info - if it's in part1, that's likely the title (unusual format)
    const part1HasRemix = /remix|edit|vip|dub|bootleg/i.test(part1);
    const part2HasRemix = /remix|edit|vip|dub|bootleg/i.test(part2);
    
    // Standard: Artist - Title (remix info in title)
    // So if part2 has remix info, it's standard format
    // If part1 has remix info and part2 doesn't, it might be "Title - Artist" format
    if (part1HasRemix && !part2HasRemix) {
      return { title: part1, artist: part2 };
    }
    
    // Default: part1 is Artist, part2 is Title (standard format)
    return { artist: part1, title: part2 };
  }

  // "Title by Artist" format
  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    const title = byMatch[1].trim();
    const artist = byMatch[2].trim();
    if (!isValidTrackPart(title) || !isValidTrackPart(artist)) return null;
    return { title, artist };
  }

  return null;
}

/**
 * Validate that a string looks like a valid track title or artist name
 */
function isValidTrackPart(str) {
  if (!str || str.length < 2) return false;
  if (str.length > 100) return false;
  
  // Reject if it's mostly numbers or special characters
  const alphaCount = (str.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < 2) return false;
  
  // Reject common non-track patterns
  const invalidPatterns = [
    /^https?:/i,
    /^www\./i,
    /^listen\s+to/i,
    /^check\s+(out|it)/i,
    /^i\s+(remember|love|need|think)/i,
    /^(this|that|it)\s+(is|was)/i,
    /^not\s+sure/i,
    /^anyone/i,
    /^what\s+(is|was)/i,
    /^(so|very|really|fucking)\s+(good|fire|sick)/i,
    /^(amazing|incredible|insane|crazy|unreal)$/i,
    /starting\s+at/i,
    /\d{4}$/,  // Ends with a year (likely a comment about an event)
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(str)) return false;
  }
  
  return true;
}

/**
 * Check if two names are similar (for DJ name filtering)
 * Returns true if names are similar enough to be considered the same person
 */
function areNamesSimilar(name1, name2) {
  if (!name1 || !name2) return false;

  // Normalize both names
  const normalize = (n) => n.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Exact match
  if (n1 === n2) return true;

  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Check if first/last word matches (e.g., "Franky Rizardo" vs "Franky" or "Rizardo")
  const words1 = n1.split(' ');
  const words2 = n2.split(' ');

  for (const w1 of words1) {
    if (w1.length >= 4) { // Only check words with 4+ chars
      for (const w2 of words2) {
        if (w2.length >= 4 && w1 === w2) return true;
      }
    }
  }

  return false;
}

function parseComments(comments, djName = null) {
  const tracks = [];
  const seen = new Set();

  const sorted = [...comments].sort((a, b) => {
    const aTs = extractTimestamps(a.text).length;
    const bTs = extractTimestamps(b.text).length;
    if (aTs >= 5 && bTs < 5) return -1;
    if (bTs >= 5 && aTs < 5) return 1;
    return b.likeCount - a.likeCount;
  });

  for (const comment of sorted) {
    const text = cleanText(comment.text);
    const timestamps = extractTimestamps(text);
    if (timestamps.length === 0) continue;

    const lines = text.split(/[\n\r]+/);
    if (lines.length >= 3) {
      for (const line of lines) {
        const lineTs = extractTimestamps(line);
        if (lineTs.length === 0) continue;
        const ts = lineTs[0];
        let afterText = line.slice(ts.position + ts.formatted.length).trim();
        afterText = afterText.replace(/^[\s|:\-–—.\[\]()]+/, '').trim();
        let info = parseTrackInfo(afterText);

        if (info) {
          // If the parsed "artist" is actually the DJ name, it's likely the track title
          // In DJ set tracklists, people often write "DJ Name - Track Title" meaning the DJ played it
          if (djName && areNamesSimilar(info.artist, djName)) {
            // The "title" field likely contains the real track info
            // Try to re-parse the title to extract actual artist - track
            const reparsed = parseTrackInfo(info.title);
            if (reparsed) {
              // Found nested artist - title in what we thought was just title
              info = reparsed;
            } else {
              // Just the track title, artist unknown
              info = { title: info.title, artist: 'Unknown Artist' };
            }
          }

          const key = `${ts.timestamp}-${info.artist.toLowerCase()}-${info.title.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            let conf = 0.5;
            if (timestamps.length >= 5) conf += 0.2;
            if (comment.likeCount > 100) conf += 0.15;
            else if (comment.likeCount > 10) conf += 0.05;
            tracks.push({ timestamp: ts.timestamp, timestampFormatted: ts.formatted, title: info.title, artist: info.artist, confidence: Math.min(conf, 1), sourceAuthor: comment.authorName, likes: comment.likeCount });
          }
        }
      }
    }
  }
  return tracks.sort((a, b) => a.timestamp - b.timestamp);
}

function parseDescription(description, djName = null) {
  const lines = cleanText(description).split(/[\n\r]+/);
  const tracks = [];
  const seen = new Set();
  for (const line of lines) {
    const timestamps = extractTimestamps(line);
    if (timestamps.length > 0) {
      const ts = timestamps[0];
      let afterText = line.slice(ts.position + ts.formatted.length).trim();
      afterText = afterText.replace(/^[\s|:\-–—.\[\]()]+/, '').trim();
      let info = parseTrackInfo(afterText);

      if (info) {
        // If the parsed "artist" is actually the DJ name, fix it
        if (djName && areNamesSimilar(info.artist, djName)) {
          const reparsed = parseTrackInfo(info.title);
          if (reparsed) {
            info = reparsed;
          } else {
            info = { title: info.title, artist: 'Unknown Artist' };
          }
        }

        const key = `${ts.timestamp}-${info.artist.toLowerCase()}-${info.title.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          tracks.push({ timestamp: ts.timestamp, timestampFormatted: ts.formatted, title: info.title, artist: info.artist, confidence: 0.95, sourceAuthor: 'Uploader', likes: 0 });
        }
      }
    }
  }
  return tracks;
}

function parseArtistFromTitle(title) {
  const patterns = [/^(.+?)\s*[@|]\s*(.+)$/, /^(.+?)\s*[-–—]\s*(.+)$/, /^(.+?)\s+(?:live\s+)?(?:at|@)\s+(.+)$/i];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return { artist: match[1].trim(), name: title };
  }
  return { name: title, artist: 'Unknown Artist' };
}

function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || '0') * 3600 + parseInt(match[2] || '0') * 60 + parseInt(match[3] || '0');
}

// ============ SOUNDCLOUD FUNCTIONS ============

async function fetchSoundCloudInfo(url) {
  // First try oEmbed
  try {
    const oembedUrl = `${SOUNDCLOUD_OEMBED}?format=json&url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim()) {
        const data = JSON.parse(text);
        if (data.title) {
          let title = data.title || 'Unknown Set';
          let artist = data.author_name || 'Unknown Artist';
          
          const byMatch = title.match(/^(.+?)\s+by\s+(.+)$/i);
          if (byMatch) {
            title = byMatch[1].trim();
            artist = byMatch[2].trim();
          }
          
          return {
            id: url.split('/').pop() || Date.now().toString(),
            title: data.title || title,
            artist,
            description: data.description || '',
            thumbnailUrl: data.thumbnail_url,
            duration: 0,
            authorUrl: data.author_url,
          };
        }
      }
    }
  } catch (e) {
    console.log('oEmbed failed, falling back to page scraping:', e.message);
  }
  
  // Fallback: return basic info from URL
  const urlParts = url.split('/');
  const trackSlug = urlParts[urlParts.length - 1] || 'unknown';
  const artistSlug = urlParts[urlParts.length - 2] || 'unknown';
  
  // Convert slugs to readable names
  const formatSlug = (slug) => slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  return {
    id: trackSlug,
    title: formatSlug(trackSlug),
    artist: formatSlug(artistSlug),
    description: '',
    thumbnailUrl: null,
    duration: 0,
    authorUrl: `https://soundcloud.com/${artistSlug}`,
  };
}

async function fetchSoundCloudPage(url) {
  // Fetch the actual page to get the description with tracklist
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    if (!response.ok) {
      console.log('SoundCloud page fetch failed:', response.status);
      return null;
    }
    
    const html = await response.text();
    
    // Try multiple methods to extract data
    
    // Method 1: Look for hydration data
    const hydrationMatch = html.match(/<script>window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);<\/script>/);
    if (hydrationMatch) {
      try {
        const hydrationData = JSON.parse(hydrationMatch[1]);
        for (const item of hydrationData) {
          if (item.hydratable === 'sound' && item.data) {
            return {
              trackId: item.data.id, // Important: we need this to fetch comments!
              title: item.data.title,
              artist: item.data.user?.username,
              description: item.data.description || '',
              duration: item.data.duration ? Math.floor(item.data.duration / 1000) : 0,
              artworkUrl: item.data.artwork_url?.replace('-large', '-t500x500') || item.data.user?.avatar_url,
              createdAt: item.data.created_at,
              genre: item.data.genre,
              playbackCount: item.data.playback_count,
            };
          }
        }
      } catch (e) {
        console.log('Hydration parse error:', e.message);
      }
    }
    
    // Try to find track ID in other script tags
    const trackIdMatch = html.match(/"id":(\d{5,15})/);
    if (trackIdMatch) {
      console.log('Found track ID from regex:', trackIdMatch[1]);
    }
    
    // Method 2: Extract from meta tags
    const result = {};
    
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (titleMatch) result.title = titleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    
    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (descMatch) result.description = descMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
    
    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (imageMatch) result.artworkUrl = imageMatch[1];
    
    // Try to extract from twitter:title as well
    const twitterTitleMatch = html.match(/<meta\s+name="twitter:title"\s+content="([^"]+)"/i);
    if (twitterTitleMatch && !result.title) {
      result.title = twitterTitleMatch[1].replace(/&amp;/g, '&');
    }
    
    if (Object.keys(result).length > 0) {
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch SoundCloud page:', error);
    return null;
  }
}

async function fetchSoundCloudComments(trackId, clientId) {
  if (!trackId || !clientId) return [];
  
  try {
    // Use threaded=1 parameter - this is required for the API to work
    const commentsUrl = `${SOUNDCLOUD_API_V2}/tracks/${trackId}/comments?client_id=${clientId}&threaded=1&filter_replies=0&limit=200&offset=0`;
    console.log('Fetching SoundCloud comments from:', commentsUrl.substring(0, 80) + '...');
    
    const response = await fetch(commentsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log('SoundCloud comments fetch failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    const comments = data.collection || [];
    console.log(`Got ${comments.length} comments from SoundCloud API`);
    
    // Map to our comment format - SoundCloud timestamps are in milliseconds
    return comments.map(c => ({
      id: c.id,
      authorName: c.user?.username || 'Anonymous',
      text: c.body || '',
      timestamp: c.timestamp ? Math.floor(c.timestamp / 1000) : 0, // Convert ms to seconds
      likeCount: 0,
    }));
  } catch (error) {
    console.error('Failed to fetch SoundCloud comments:', error);
    return [];
  }
}

// Convert to title case: "all night long" -> "All Night Long"
function toTitleCase(str) {
  if (!str) return str;
  // Don't change if already has mixed case (likely intentional)
  if (str !== str.toLowerCase() && str !== str.toUpperCase()) {
    return str;
  }
  // Common words to keep lowercase (unless first word)
  const lowercase = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in'];
  return str.split(' ').map((word, i) => {
    if (i > 0 && lowercase.includes(word.toLowerCase())) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

// Clean SoundCloud comment text - strip @mentions, emojis, etc.
function cleanSoundCloudComment(text) {
  let cleaned = cleanText(text);
  
  // SoundCloud @mention formats:
  // 1. "@username: track info" (with colon)
  // 2. "@username track info" (no colon, space separated)
  
  // First try to strip "@username:" format (with colon)
  if (/^@[\w-]+\s*:/.test(cleaned)) {
    cleaned = cleaned.replace(/^@[\w-]+\s*:\s*/, '').trim();
  } 
  // Then try "@username " format (no colon) - username ends at space
  else if (/^@[\w-]+\s+/.test(cleaned)) {
    cleaned = cleaned.replace(/^@[\w-]+\s+/, '').trim();
  }
  
  // Strip common prefixes
  cleaned = cleaned.replace(/^(track\s*id|id|this\s+is|that's|it's|its)\s*:?\s*/i, '').trim();
  
  // Remove excessive emojis but keep some context
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
  cleaned = cleaned.replace(emojiRegex, ' ').replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Parse SoundCloud comment to extract track info
function parseSoundCloudTrackInfo(text) {
  let cleaned = cleanSoundCloudComment(text);
  
  // STRICT FILTERING - Reject obvious garbage
  
  // Reject URLs
  if (/https?:\/\/|www\.|\.com|\.org|soundcloud\.com|youtube\.com|youtu\.be|spotify\.com|music\.apple|on\.soundcloud/i.test(cleaned)) {
    return null;
  }
  
  // Reject URL fragments (video IDs, query params)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(cleaned) || /[?&=]/.test(cleaned)) {
    return null;
  }
  
  // Skip noise - expanded patterns
  const noisePatterns = [
    /^(id\??|track\s*id\??|what|anyone|need|fire|banger|heater|crazy|insane|unreal|tune\??|sick|wow|omg|yes+|finally|sound dude)$/i,
    /^(i need|anyone know|what song|what track|please id|need this|i'd|anyone got)/i,
    /^(best|love|great|amazing|perfect|incredible|fucking|grimy|dark|ooph)\s*(set|track|tune|song|mix|boiler)?!*$/i,
    /^\d+:\d+\s*$/,  // Just a timestamp
    /^@/,  // Just an @mention (wasn't cleaned)
    /^love\s*(it|this|that)?!*$/i,
    /^fuck(ing)?\s*(love|loved|amazing)/i,
    /^(this|that)\s+(is|was)\s+(the|so|a|an)/i,
    /^i\s+remember/i,
    /^not\s+sure\s+what/i,
    /^listen\s+to/i,
    /starting\s+at\s+\w+\s+\d+/i,  // "starting at edco 2024"
    /^check\s+(it|this|out)/i,
    /\(id\)$/i,  // Ends with (ID) - unknown track
  ];
  
  for (const pattern of noisePatterns) {
    if (pattern.test(cleaned)) return null;
  }
  
  // Too short or too long
  if (cleaned.length < 5 || cleaned.length > 200) return null;
  
  // Reject text with unbalanced parentheses (broken parsing)
  const openParens = (cleaned.match(/\(/g) || []).length;
  const closeParens = (cleaned.match(/\)/g) || []).length;
  if (Math.abs(openParens - closeParens) > 1) return null;
  
  // Reject if it starts or ends with a broken parenthesis pattern
  if (/^\)/.test(cleaned) || /\($/.test(cleaned)) return null;
  
  // Skip if ends with ? and doesn't look like track info
  if (/\?\s*$/.test(cleaned) && !/[-–—]/.test(cleaned)) return null;
  
  // Remove any stray timestamps embedded in the text (e.g., "1:03:05 Chris Stussy")
  cleaned = cleaned.replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/, '').trim(); // Start
  cleaned = cleaned.replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*$/, '').trim(); // End
  cleaned = cleaned.replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s+/g, ' ').trim(); // Middle
  
  // Try to parse formats with dash: "Artist - Title" or "Title - Artist"
  // Also handle formats like "closer -gaskin" (space before dash)
  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let part1 = dashMatch[1].trim();
    let part2 = dashMatch[2].trim();
    
    // Skip if either part is too short or just noise
    if (part1.length < 2 || part2.length < 2) return null;
    if (/^(id|unknown|tba|\?+)$/i.test(part1) || /^(id|unknown|tba|\?+)$/i.test(part2)) return null;
    
    // Validate both parts look like real track/artist info
    if (!isValidTrackPart(part1) || !isValidTrackPart(part2)) return null;
    
    // Determine which is artist vs title
    // Key insight: In DJ set comments, it's usually "Artist - Track" format
    // BUT remix/edit info is usually in the track name
    const part1HasRemix = /remix|edit|vip|dub|bootleg|rework/i.test(part1);
    const part2HasRemix = /remix|edit|vip|dub|bootleg|rework/i.test(part2);
    
    // Count words
    const part1Words = part1.split(/\s+/).length;
    const part2Words = part2.split(/\s+/).length;
    
    // Heuristics for artist vs title:
    // - Single-word names at end are often artist names (e.g., "come on - kosh", "closer - gaskin")
    // - Remix/edit info is in the title
    // - Artist names are typically 1-2 words
    // - Common words like "come", "on", "closer" etc. are more likely title words
    
    const commonTitleWords = ['come', 'on', 'the', 'a', 'my', 'your', 'all', 'night', 'long', 'closer', 'higher', 'deeper'];
    const part1HasCommonWords = part1.toLowerCase().split(/\s+/).some(w => commonTitleWords.includes(w));
    const part2HasCommonWords = part2.toLowerCase().split(/\s+/).some(w => commonTitleWords.includes(w));
    
    // Single word that doesn't look like a common word = likely artist name
    const part1IsSingleUncommonWord = part1Words === 1 && !part1HasCommonWords;
    const part2IsSingleUncommonWord = part2Words === 1 && !part2HasCommonWords;
    
    let artist, title;
    
    if (part2HasRemix && !part1HasRemix) {
      // "Artist - Track (Remix)" format - most common
      artist = toTitleCase(part1);
      title = toTitleCase(part2);
    } else if (part1HasRemix && !part2HasRemix) {
      // "Track (Remix) - Artist" format
      title = toTitleCase(part1);
      artist = toTitleCase(part2);
    } else if (part2IsSingleUncommonWord && part1Words >= 2) {
      // Second part is a single unusual word (likely artist): "come on - kosh"
      title = toTitleCase(part1);
      artist = toTitleCase(part2);
    } else if (part1IsSingleUncommonWord && part2Words >= 2) {
      // First part is a single unusual word (likely artist): "Gaskin - Me, Myself..."
      artist = toTitleCase(part1);
      title = toTitleCase(part2);
    } else if (part1Words === 1 && part2Words === 1) {
      // Both single words: common word is title, uncommon is artist
      // e.g., "closer - gaskin" → Title: Closer, Artist: Gaskin
      if (part1HasCommonWords && !part2HasCommonWords) {
        title = toTitleCase(part1);
        artist = toTitleCase(part2);
      } else if (part2HasCommonWords && !part1HasCommonWords) {
        artist = toTitleCase(part1);
        title = toTitleCase(part2);
      } else {
        // Both common or both uncommon - default to Artist - Title
        artist = toTitleCase(part1);
        title = toTitleCase(part2);
      }
    } else if (part1Words === 1 && part2Words > 2) {
      // Single word first, multi-word second: likely "Artist - Long Track Name"
      artist = toTitleCase(part1);
      title = toTitleCase(part2);
    } else if (part2Words === 1 && part1Words > 2) {
      // Multi-word first, single word second: likely "Long Track Name - Artist"
      title = toTitleCase(part1);
      artist = toTitleCase(part2);
    } else {
      // Default to "Artist - Title" (most common in DJ set track IDs)
      artist = toTitleCase(part1);
      title = toTitleCase(part2);
    }
    
    return { artist, title };
  }
  
  // Try "by" format: "Track Name by Artist"
  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    const title = toTitleCase(byMatch[1].trim());
    const artist = toTitleCase(byMatch[2].trim());
    // Validate both parts
    if (isValidTrackPart(title) && isValidTrackPart(artist)) {
      return { title, artist };
    }
    return null;
  }
  
  // Try slash format: "artist / track" or "artist track / version"
  const slashMatch = cleaned.match(/^(.+?)\s*\/\s*(.+)$/);
  if (slashMatch) {
    const part1 = slashMatch[1].trim();
    const part2 = slashMatch[2].trim();
    if (part1.length >= 2 && part2.length >= 2) {
      // Usually "artist track / extra info" - first part has both
      // Try to split first part: "locklead i'm turning" -> Artist: Locklead, Title: I'm Turning
      const firstWords = part1.split(/\s+/);
      if (firstWords.length >= 2) {
        const artist = toTitleCase(firstWords[0]);
        const title = toTitleCase(firstWords.slice(1).join(' ') + ' / ' + part2);
        if (isValidTrackPart(artist) && isValidTrackPart(title)) {
          return { artist, title };
        }
      }
    }
  }
  
  return null;
}

function parseSoundCloudComments(comments) {
  // SoundCloud comments are tied to timestamps, so we can extract track info
  const tracks = [];
  const seen = new Set();
  
  // Sort by likes/engagement - more liked comments are more reliable
  const sortedComments = [...comments].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  
  for (const comment of sortedComments) {
    const info = parseSoundCloudTrackInfo(comment.text);
    
    if (info && info.artist && info.title) {
      // Use the comment's timestamp (SoundCloud comments are positioned on the waveform)
      const timestamp = comment.timestamp || 0;
      const key = `${info.artist.toLowerCase()}-${info.title.toLowerCase()}`;
      
      // Allow same track at different timestamps (could be played twice)
      // But dedupe exact same track at same timestamp
      const fullKey = `${timestamp}-${key}`;
      
      if (!seen.has(fullKey)) {
        seen.add(fullKey);
        tracks.push({
          timestamp,
          timestampFormatted: formatSecondsToTimestamp(timestamp),
          title: info.title,
          artist: info.artist,
          confidence: 0.75,
          sourceAuthor: comment.authorName,
          likes: comment.likeCount || 0,
        });
      }
    }
  }
  
  // Sort by timestamp for tracklist order
  return tracks.sort((a, b) => a.timestamp - b.timestamp);
}

function formatSecondsToTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function importFromSoundCloud(url) {
  // Try page scraping first (more reliable), then fallback to oEmbed
  const pageInfo = await fetchSoundCloudPage(url);
  const oembedInfo = await fetchSoundCloudInfo(url);
  
  // Try to get SoundCloud comments using a fresh client ID
  let comments = [];
  let commentTracks = [];
  
  if (pageInfo?.trackId) {
    // First try env var, then dynamically fetch a fresh one
    let clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    
    // Try fetching comments with env client_id first
    if (clientId) {
      comments = await fetchSoundCloudComments(pageInfo.trackId, clientId);
    }
    
    // If that failed, try to get a fresh client_id
    if (comments.length === 0) {
      console.log('Trying to fetch fresh SoundCloud client_id...');
      const freshClientId = await fetchSoundCloudClientId();
      if (freshClientId) {
        comments = await fetchSoundCloudComments(pageInfo.trackId, freshClientId);
      }
    }
    
    if (comments.length > 0) {
      commentTracks = parseSoundCloudComments(comments);
      console.log(`Fetched ${comments.length} SoundCloud comments, found ${commentTracks.length} tracks`);
    }
  }
  
  // Combine info from both sources, preferring page info
  const title = pageInfo?.title || oembedInfo.title || 'Unknown Set';
  const description = pageInfo?.description || oembedInfo.description || '';
  const duration = pageInfo?.duration || 0;
  const thumbnailUrl = pageInfo?.artworkUrl || oembedInfo.thumbnailUrl;
  const artistFromPage = pageInfo?.artist || oembedInfo.artist;
  
  // Parse tracklist from description
  const descTracks = parseDescription(description);
  
  // Combine description and comment tracks
  const allTracks = [...descTracks, ...commentTracks];
  
  // Parse artist/title 
  const { name, artist } = parseArtistFromTitle(title);
  const finalArtist = artist !== 'Unknown Artist' ? artist : artistFromPage;
  const finalName = name || title;
  const setId = `sc-${oembedInfo.id}-${Date.now()}`;
  
  // Deduplicate using segment-based grouping (returns tracks + same-platform conflicts)
  const { tracks, conflicts: samePlatformConflicts } = deduplicateSingleSource(
    allTracks,
    'soundcloud',
    setId,
    finalName
  );
  
  const setList = {
    id: setId,
    name: finalName,
    artist: finalArtist,
    date: pageInfo?.createdAt || new Date().toISOString(),
    tracks: tracks.map((pt, i) => ({
      id: `imported-${Date.now()}-${i}`,
      title: pt.title,
      artist: pt.artist,
      duration: pt.duration || 0,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date().toISOString(),
      source: 'ai',
      timestamp: pt.timestamp,
      verified: false,
      contributedBy: pt.sourceAuthor || 'Description',
      hasConflict: pt.hasConflict,
      conflictId: pt.conflictId,
    })),
    coverUrl: thumbnailUrl,
    sourceLinks: [{ platform: 'soundcloud', url }],
    totalDuration: duration,
    aiProcessed: true,
    commentsScraped: comments.length,
    tracksIdentified: tracks.length,
    conflicts: samePlatformConflicts, // Include same-platform conflicts
    plays: pageInfo?.playbackCount || 0,
  };
  
  return {
    success: true,
    setList,
    soundcloudInfo: {
      title: finalName,
      artist: finalArtist,
      thumbnailUrl,
      duration,
      genre: pageInfo?.genre,
    },
    commentsCount: comments.length,
    tracksCount: tracks.length,
    samePlatformConflicts: samePlatformConflicts.length,
  };
}

// ============ YOUTUBE IMPORT ============

/**
 * Deduplicate tracks from a single source using segment-based grouping.
 * Returns both deduplicated tracks AND any same-platform conflicts.
 * 
 * Same-platform conflicts occur when multiple comments suggest different tracks
 * at similar timestamps (e.g., someone got the timestamp wrong, or different people
 * identify different tracks at the same point).
 */
function deduplicateSingleSource(tracks, platform = 'youtube', setId = null, setName = null) {
  if (tracks.length === 0) return { tracks: [], conflicts: [] };
  
  // Sort by timestamp
  const sorted = [...tracks].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  
  const deduped = [];
  const conflicts = [];
  const segments = [];
  let currentSegment = [sorted[0]];
  
  // Group into segments
  for (let i = 1; i < sorted.length; i++) {
    const track = sorted[i];
    const lastTrack = currentSegment[currentSegment.length - 1];
    const timeDiff = (track.timestamp || 0) - (lastTrack.timestamp || 0);
    
    if (timeDiff <= SEGMENT_WINDOW) {
      currentSegment.push(track);
    } else {
      segments.push(currentSegment);
      currentSegment = [track];
    }
  }
  segments.push(currentSegment);
  
  // Process each segment
  for (const segment of segments) {
    if (segment.length === 1) {
      // Single track - no conflict
      deduped.push(segment[0]);
      continue;
    }
    
    // Multiple tracks in segment - group by similarity
    const trackGroups = [];
    
    for (const track of segment) {
      let foundGroup = false;
      
      for (const group of trackGroups) {
        const sim = calculateTrackSimilarity(
          track.title, track.artist,
          group[0].title, group[0].artist
        );
        
        if (sim >= MIN_SIMILARITY) {
          group.push(track);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        trackGroups.push([track]);
      }
    }
    
    if (trackGroups.length === 1) {
      // All tracks match - use intelligent selection to pick the best version
      const best = selectBestTrackVersion(trackGroups[0]);
      if (trackGroups[0].length > 1) {
        console.log(`[Smart Merge] Merged ${trackGroups[0].length} similar entries at ${segment[0].timestamp}s into: "${best.title}" by "${best.artist}"`);
        trackGroups[0].forEach((t, i) => {
          if (i > 0) console.log(`  - Also matched: "${t.title}" by "${t.artist}"`);
        });
      }
      deduped.push(best);
    } else {
      // Multiple different tracks at same timestamp = conflict
      // Sort groups by total confidence/support
      const rankedGroups = trackGroups
        .map(group => ({
          group,
          totalConfidence: group.reduce((sum, t) => sum + (t.confidence || 0.7), 0),
          totalLikes: group.reduce((sum, t) => sum + (t.likes || 0), 0),
          count: group.length,
        }))
        .sort((a, b) => {
          // More sources > higher confidence > more likes
          if (b.count !== a.count) return b.count - a.count;
          if (b.totalConfidence !== a.totalConfidence) return b.totalConfidence - a.totalConfidence;
          return b.totalLikes - a.totalLikes;
        });
      
      // Check if top group has significantly more support
      const topGroup = rankedGroups[0];
      const secondGroup = rankedGroups[1];
      const confidenceGap = (topGroup.totalConfidence / topGroup.count) - (secondGroup.totalConfidence / secondGroup.count);
      
      if (topGroup.count >= 2 && secondGroup.count === 1 && confidenceGap > 0.15) {
        // Clear winner - multiple people agreed, only one person disagreed
        const best = selectBestTrackVersion(topGroup.group);
        deduped.push(best);
        console.log(`[Auto-Resolve] Conflict at ${segment[0].timestamp}s resolved: "${best.title}" (${topGroup.count} sources vs ${secondGroup.count})`);
      } else {
        // Genuine conflict - create for user voting
        const timestamp = segment[0].timestamp || 0;
        
        conflicts.push({
          id: `conflict-single-${platform}-${timestamp}-${Date.now()}`,
          setId: setId || 'pending',
          setName: setName || 'Unknown Set',
          timestamp,
          options: rankedGroups.slice(0, 3).map((rg, i) => {
            const best = rg.group[0];
            return {
              id: `opt-${platform}-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              title: best.title,
              artist: best.artist,
              source: platform,
              confidence: rg.totalConfidence / rg.count,
              contributedBy: best.sourceAuthor,
              duration: best.duration,
              supportCount: rg.count,
            };
          }),
          votes: [],
          createdAt: new Date().toISOString(),
          status: 'active',
          isSamePlatform: true, // Flag to indicate this is a same-platform conflict
        });
        
        // Still add the top-ranked option as the default track (can be overridden by voting)
        const defaultTrack = selectBestTrackVersion(rankedGroups[0].group);
        defaultTrack.hasConflict = true;
        defaultTrack.conflictId = conflicts[conflicts.length - 1].id;
        deduped.push(defaultTrack);
        
        console.log(`[Conflict Created] At ${timestamp}s: ${rankedGroups.length} distinct track suggestions:`);
        rankedGroups.forEach((rg, i) => {
          console.log(`  ${i + 1}. "${rg.group[0].title}" by "${rg.group[0].artist}" (${rg.count} source${rg.count > 1 ? 's' : ''})`);
        });
      }
    }
  }
  
  console.log(`Segment deduplication: ${tracks.length} -> ${deduped.length} tracks, ${conflicts.length} same-platform conflicts`);
  
  // Second pass: Global deduplication to catch duplicates at different timestamps
  const globalDeduped = removeGlobalDuplicates(deduped);
  
  console.log(`Global deduplication: ${deduped.length} -> ${globalDeduped.length} tracks`);
  return { tracks: globalDeduped, conflicts };
}

/**
 * Remove duplicate tracks that appear at different timestamps.
 * This catches cases where the same track is listed at different times
 * (e.g., user timing errors, different people reporting different timestamps).
 */
function removeGlobalDuplicates(tracks) {
  if (tracks.length <= 1) return tracks;
  
  const result = [];
  const seen = new Map(); // Map of normalized key -> best track
  
  for (const track of tracks) {
    // Create a normalized key for this track
    const normalizedTitle = normalizeForDedup(track.title);
    const normalizedArtist = normalizeForDedup(track.artist);
    
    // Try multiple key variations to catch different formats
    const keys = [
      `${normalizedTitle}::${normalizedArtist}`,
      `${normalizedTitle}`, // Just title (catches artist variations)
    ];
    
    let isDuplicate = false;
    let existingKey = null;
    
    for (const key of keys) {
      if (seen.has(key)) {
        isDuplicate = true;
        existingKey = key;
        break;
      }
      
      // Also check for high similarity with existing keys
      for (const [seenKey, seenTrack] of seen.entries()) {
        const similarity = calculateTrackSimilarity(
          track.title, track.artist,
          seenTrack.title, seenTrack.artist
        );
        
        if (similarity >= 0.85) {
          isDuplicate = true;
          existingKey = seenKey;
          console.log(`[Global Dedup] "${track.title}" by "${track.artist}" matches "${seenTrack.title}" by "${seenTrack.artist}" (${(similarity * 100).toFixed(0)}% similar)`);
          break;
        }
      }
      
      if (isDuplicate) break;
    }
    
    if (isDuplicate && existingKey) {
      // We found a duplicate - keep the one with more confidence or more complete info
      const existing = seen.get(existingKey);
      const newScore = scoreTrackQuality(track);
      const existingScore = scoreTrackQuality(existing);
      
      if (newScore > existingScore) {
        // Replace with better version
        seen.set(existingKey, track);
        console.log(`[Global Dedup] Replaced "${existing.title}" (score: ${existingScore.toFixed(2)}) with "${track.title}" (score: ${newScore.toFixed(2)})`);
      } else {
        console.log(`[Global Dedup] Kept existing "${existing.title}" (score: ${existingScore.toFixed(2)}), discarded duplicate at ${track.timestamp}s`);
      }
    } else {
      // Not a duplicate - add it
      const primaryKey = keys[0];
      seen.set(primaryKey, track);
    }
  }
  
  // Convert map back to sorted array
  const dedupedTracks = Array.from(seen.values());
  dedupedTracks.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  
  return dedupedTracks;
}

/**
 * Normalize a string for deduplication comparison
 */
function normalizeForDedup(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // Remove parenthetical content
    .replace(/\[.*?\]/g, '') // Remove bracketed content
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Score the quality/completeness of a track entry
 */
function scoreTrackQuality(track) {
  let score = track.confidence || 0.5;
  
  // Prefer tracks with longer, more complete titles
  const titleLen = (track.title || '').length;
  if (titleLen >= 5 && titleLen <= 60) score += 0.1;
  
  // Prefer tracks with multiple artists (more complete credit)
  const artistParts = (track.artist || '').split(/[&,]/).length;
  if (artistParts >= 2) score += 0.1;
  
  // Prefer tracks from description (usually more accurate)
  if (track.sourceType === 'description' || track.sourceAuthor === 'Uploader') {
    score += 0.2;
  }
  
  // Prefer tracks with more likes (social proof)
  if (track.likes > 10) score += 0.1;
  if (track.likes > 50) score += 0.1;
  
  // Prefer earlier timestamps in a tie (usually more accurate)
  // Small penalty for very late timestamps
  if (track.timestamp > 7200) score -= 0.05; // After 2 hours
  
  return score;
}

async function importFromYouTube(url, apiKey) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  const [video, comments] = await Promise.all([
    fetchVideoInfo(videoId, apiKey),
    fetchVideoComments(videoId, apiKey, 500),
  ]);

  // Extract DJ/artist name from video title FIRST so we can filter it from tracks
  const { name, artist } = parseArtistFromTitle(video.title);
  const djName = artist !== 'Unknown Artist' ? artist : video.channelTitle;

  const descTracks = parseDescription(video.description, djName);
  const commentTracks = parseComments(comments, djName);

  // Combine description and comment tracks
  const allTracks = [...descTracks, ...commentTracks];
  const setId = `yt-${video.id}-${Date.now()}`;
  
  // Deduplicate using segment-based grouping (returns tracks + same-platform conflicts)
  const { tracks, conflicts: samePlatformConflicts } = deduplicateSingleSource(
    allTracks, 
    'youtube',
    setId,
    name
  );

  const setList = {
    id: setId,
    name,
    artist: djName,
    date: video.publishedAt,
    tracks: tracks.map((pt, i) => ({
      id: `imported-${Date.now()}-${i}`,
      title: pt.title,
      artist: pt.artist,
      duration: pt.duration || 0,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date().toISOString(),
      source: 'ai',
      timestamp: pt.timestamp,
      verified: false,
      contributedBy: pt.sourceAuthor,
      hasConflict: pt.hasConflict,
      conflictId: pt.conflictId,
    })),
    coverUrl: video.thumbnailUrl,
    sourceLinks: [{ platform: 'youtube', url }],
    totalDuration: parseDuration(video.duration),
    aiProcessed: true,
    commentsScraped: comments.length,
    tracksIdentified: tracks.length,
    conflicts: samePlatformConflicts, // Include same-platform conflicts
    plays: 0,
  };

  return { 
    success: true, 
    setList, 
    videoInfo: video, 
    commentsCount: comments.length, 
    tracksCount: tracks.length,
    samePlatformConflicts: samePlatformConflicts.length,
  };
}

// ============ TRACK MERGING UTILITIES ============
// Smart deduplication and track segmentation with intelligent matching

const SEGMENT_WINDOW = 45; // seconds - tracks within this window are considered same segment (increased for user timing errors)
const MIN_SIMILARITY = 0.55; // Threshold for tracks to be considered potentially same (lowered for fuzzy matching)
const HIGH_SIMILARITY = 0.80; // Threshold for auto-merge without conflict
const CONFIDENCE_BOOST = 0.2;
const MIN_TRACK_GAP = 60; // Minimum expected gap between tracks (1 min typical for DJ sets)

// Common user commentary patterns to strip from track info
const USER_COMMENTARY_PATTERNS = [
  /\(red card( tho)?\)/gi,
  /\(banger\)/gi,
  /\(fire\)/gi,
  /\(sick\)/gi,
  /\(amazing\)/gi,
  /\(classic\)/gi,
  /\(tune\)/gi,
  /\(big one\)/gi,
  /\(huge\)/gi,
  /\(absolute\s+\w+\)/gi,
  /\(so good\)/gi,
  /\(love this\)/gi,
  /\(id\s*\??\)/gi, // (ID) or (ID?)
  /\(unreleased\s*\??\)/gi,
  /\(forthcoming\)/gi,
  /\(dub\s*\??\)/gi,
  /\([^)]*edit[^)]*\)/gi, // (someone's edit)
  /\s*tho\s*$/gi, // trailing "tho"
];

// Label patterns in track titles to normalize
const LABEL_PATTERNS = [
  /\[([A-Z0-9\s&]+)\]$/i, // [LABEL NAME] at end
  /\s+on\s+[A-Z][a-zA-Z0-9\s&]+$/i, // "on Label Name" at end
];

// Common artist abbreviations/variations
const ARTIST_ALIASES = {
  'cb': ['chris stussy', 'across boundaries'],
  'tmp': ['t.m.p', 'tmp', 't m p'],
  'djb': ['dj boring'],
  'kh': ['k.h', 'kh'],
};

/**
 * Clean a track title by removing user commentary and normalizing
 */
function cleanTrackTitle(title) {
  if (!title) return '';
  
  let cleaned = title;
  
  // Remove user commentary patterns
  for (const pattern of USER_COMMENTARY_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Extract and store label info, but remove from matching
  let label = null;
  for (const pattern of LABEL_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      label = match[1] || match[0];
      cleaned = cleaned.replace(pattern, '');
    }
  }
  
  // Normalize whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return { cleaned, label, original: title };
}

/**
 * Clean and normalize artist names
 */
function cleanArtistName(artist) {
  if (!artist) return '';
  
  let cleaned = artist;
  
  // Remove featuring/and variations to get primary artists
  const primaryArtists = cleaned
    .split(/\s*[&,]\s*|\s+(?:feat\.?|ft\.?|featuring|and|x|vs\.?)\s+/i)
    .map(a => a.trim())
    .filter(a => a.length > 0);
  
  // Normalize each artist
  const normalized = primaryArtists.map(a => 
    a.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
  
  return { 
    primary: normalized[0] || '', 
    all: normalized, 
    original: artist,
    normalized: normalized.join(' ')
  };
}

/**
 * Extract core identifying words from a title
 */
function extractCoreWords(title) {
  const cleaned = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Filter out common non-identifying words
  const stopWords = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'mix', 'remix', 'edit', 'version', 'original', 'extended', 'club', 'dub', 'instrumental']);
  
  const words = cleaned.split(' ').filter(w => 
    w.length > 1 && !stopWords.has(w)
  );
  
  return words;
}

function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Advanced string similarity using multiple methods
 */
function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  
  const n1 = normalizeString(s1);
  const n2 = normalizeString(s2);
  
  if (n1 === n2) return 1;
  
  // Check for containment (one is substring of other)
  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = Math.min(n1.length, n2.length);
    const longer = Math.max(n1.length, n2.length);
    return 0.7 + (shorter / longer) * 0.3; // High score for containment
  }
  
  // Word-based similarity
  const words1 = extractCoreWords(s1);
  const words2 = extractCoreWords(s2);
  
  if (words1.length === 0 || words2.length === 0) {
    return n1.includes(n2) || n2.includes(n1) ? 0.6 : 0;
  }
  
  // Check for key word matches
  let matches = 0;
  let partialMatches = 0;
  
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2) {
        matches++;
        break;
      } else if (w1.includes(w2) || w2.includes(w1)) {
        partialMatches++;
        break;
      } else if (levenshteinSimilarity(w1, w2) > 0.8) {
        // Fuzzy match for typos
        partialMatches += 0.8;
        break;
      }
    }
  }
  
  const totalWords = Math.max(words1.length, words2.length);
  const matchScore = (matches + partialMatches * 0.5) / totalWords;
  
  return Math.min(1, matchScore);
}

/**
 * Levenshtein distance-based similarity
 */
function levenshteinSimilarity(s1, s2) {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const matrix = [];
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[s1.length][s2.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

/**
 * Intelligent track similarity calculation
 * Handles variations like:
 * - "Across Boundaries & Chris Stussy - T.M.P" vs "Across Boundaries - T.m.p"
 * - User commentary in parentheses
 * - Different artist credit formats
 */
function calculateTrackSimilarity(title1, artist1, title2, artist2) {
  // Clean titles
  const t1 = cleanTrackTitle(title1);
  const t2 = cleanTrackTitle(title2);
  
  // Clean artists
  const a1 = cleanArtistName(artist1);
  const a2 = cleanArtistName(artist2);
  
  // Title similarity on cleaned versions
  const titleSim = stringSimilarity(t1.cleaned, t2.cleaned);
  
  // Artist similarity - check if any artists match
  let artistSim = 0;
  
  // Check primary artist match
  if (a1.primary && a2.primary) {
    artistSim = stringSimilarity(a1.primary, a2.primary);
  }
  
  // Check if any artist in one appears in the other
  for (const artist of a1.all) {
    for (const otherArtist of a2.all) {
      const sim = stringSimilarity(artist, otherArtist);
      if (sim > artistSim) {
        artistSim = sim;
      }
    }
  }
  
  // If one artist string contains the other as a substring
  if (a1.normalized.includes(a2.primary) || a2.normalized.includes(a1.primary)) {
    artistSim = Math.max(artistSim, 0.8);
  }
  
  // Weight: title is more important than artist for matching
  // because users often abbreviate artist names
  const baseScore = titleSim * 0.7 + artistSim * 0.3;
  
  // Boost if labels match
  if (t1.label && t2.label && stringSimilarity(t1.label, t2.label) > 0.8) {
    return Math.min(1, baseScore + 0.1);
  }
  
  // Special case: if title similarity is very high (>0.8), it's likely same track
  // even if artist format differs significantly
  if (titleSim > 0.8) {
    return Math.max(baseScore, 0.75);
  }
  
  return baseScore;
}

/**
 * Determine if two tracks are likely the same based on intelligent matching
 */
function areTracksSimilar(track1, track2, timestampThreshold = SEGMENT_WINDOW) {
  // Check timestamp proximity
  const timeDiff = Math.abs((track1.timestamp || 0) - (track2.timestamp || 0));
  if (timeDiff > timestampThreshold) {
    return { similar: false, confidence: 0, reason: 'timestamp_too_far' };
  }
  
  // Calculate similarity
  const similarity = calculateTrackSimilarity(
    track1.title, track1.artist,
    track2.title, track2.artist
  );
  
  if (similarity >= HIGH_SIMILARITY) {
    return { 
      similar: true, 
      confidence: similarity, 
      reason: 'high_similarity',
      autoMerge: true 
    };
  }
  
  if (similarity >= MIN_SIMILARITY) {
    return { 
      similar: true, 
      confidence: similarity, 
      reason: 'potential_match',
      autoMerge: false 
    };
  }
  
  return { similar: false, confidence: similarity, reason: 'low_similarity' };
}

/**
 * Select the best version of a track from multiple similar entries
 */
function selectBestTrackVersion(tracks) {
  if (tracks.length === 0) return null;
  if (tracks.length === 1) return tracks[0];
  
  // Score each track version
  const scored = tracks.map(track => {
    let score = track.confidence || 0.5;
    
    // Prefer longer, more complete titles (but not too long with junk)
    const titleLen = (track.title || '').length;
    if (titleLen >= 3 && titleLen <= 50) {
      score += 0.1;
    }
    
    // Prefer tracks with proper artist credits (multiple artists = more complete)
    const artistParts = (track.artist || '').split(/[&,]/).length;
    if (artistParts >= 2) {
      score += 0.1;
    }
    
    // Prefer tracks from description over comments (usually more accurate)
    if (track.sourceType === 'description') {
      score += 0.15;
    }
    
    // Prefer tracks with more likes (social proof)
    if (track.likes && track.likes > 5) {
      score += 0.05;
    }
    
    return { track, score };
  });
  
  // Sort by score and return best
  scored.sort((a, b) => b.score - a.score);
  
  // Merge info from top candidates
  const best = { ...scored[0].track };
  
  // If another version has a longer/better title, consider it
  for (const { track } of scored.slice(1)) {
    // Take longer artist string if it has more info
    if ((track.artist || '').split(/[&,]/).length > (best.artist || '').split(/[&,]/).length) {
      best.artist = track.artist;
    }
  }
  
  console.log(`Selected best track version: "${best.title}" by "${best.artist}" (score: ${scored[0].score.toFixed(2)})`);
  
  return best;
}

/**
 * Group tracks into time segments. Tracks within SEGMENT_WINDOW seconds 
 * of each other belong to the same segment.
 */
function groupIntoSegments(tracks) {
  if (tracks.length === 0) return [];
  
  // Sort by timestamp first
  const sorted = [...tracks].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  
  const segments = [];
  let currentSegment = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const track = sorted[i];
    const lastTrack = currentSegment[currentSegment.length - 1];
    const timeDiff = (track.timestamp || 0) - (lastTrack.timestamp || 0);
    
    if (timeDiff <= SEGMENT_WINDOW) {
      // Same segment
      currentSegment.push(track);
    } else {
      // New segment
      segments.push(currentSegment);
      currentSegment = [track];
    }
  }
  
  // Don't forget the last segment
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  
  return segments;
}

/**
 * Find the best track within a segment by comparing similarity and confidence.
 * Returns: { bestTrack, allSources, isConflict, conflictOptions }
 */
function resolveSegment(tracksInSegment, setId, setName) {
  if (tracksInSegment.length === 0) {
    return null;
  }
  
  if (tracksInSegment.length === 1) {
    return {
      bestTrack: tracksInSegment[0],
      allSources: tracksInSegment[0].sources || [{ 
        platform: tracksInSegment[0].platform || 'youtube',
        timestamp: tracksInSegment[0].timestamp,
        confidence: tracksInSegment[0].confidence || 0.7,
      }],
      isConflict: false,
      conflictOptions: null,
    };
  }
  
  // Multiple tracks in segment - need to dedupe or create conflict
  // First, try to find matching tracks to merge
  const trackGroups = []; // Groups of similar tracks
  
  for (const track of tracksInSegment) {
    let foundGroup = false;
    
    for (const group of trackGroups) {
      const similarity = calculateTrackSimilarity(
        track.title,
        track.artist,
        group[0].title,
        group[0].artist
      );
      
      if (similarity >= MIN_SIMILARITY) {
        group.push(track);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      trackGroups.push([track]);
    }
  }
  
  // If all tracks grouped together, they're the same track
  if (trackGroups.length === 1) {
    // Merge all sources, pick best track info, boost confidence
    const group = trackGroups[0];
    const bestTrack = group.reduce((best, t) => 
      (t.confidence || 0.7) > (best.confidence || 0.7) ? t : best
    );
    
    const allSources = group.flatMap(t => t.sources || [{
      platform: t.platform || 'unknown',
      timestamp: t.timestamp,
      confidence: t.confidence || 0.7,
    }]);
    
    // Boost confidence since multiple sources agree
    const boostedConfidence = Math.min(1.0, (bestTrack.confidence || 0.7) + (group.length - 1) * 0.1);
    
    return {
      bestTrack: { ...bestTrack, confidence: boostedConfidence },
      allSources,
      isConflict: false,
      conflictOptions: null,
    };
  }
  
  // Multiple distinct track groups = potential conflict
  // But first, check if one group has significantly higher confidence
  const groupConfidences = trackGroups.map(group => ({
    group,
    avgConfidence: group.reduce((sum, t) => sum + (t.confidence || 0.7), 0) / group.length,
    totalSources: group.length,
  }));
  
  groupConfidences.sort((a, b) => {
    // Sort by: more sources first, then higher confidence
    if (b.totalSources !== a.totalSources) return b.totalSources - a.totalSources;
    return b.avgConfidence - a.avgConfidence;
  });
  
  const topGroup = groupConfidences[0];
  const secondGroup = groupConfidences[1];
  
  // If top group has significantly more sources or higher confidence, auto-pick it
  const confidenceGap = topGroup.avgConfidence - secondGroup.avgConfidence;
  const sourceGap = topGroup.totalSources - secondGroup.totalSources;
  
  if (sourceGap >= 2 || confidenceGap >= 0.25 || topGroup.avgConfidence >= HIGH_SIMILARITY) {
    // Clear winner - no conflict needed
    const bestTrack = topGroup.group.reduce((best, t) => 
      (t.confidence || 0.7) > (best.confidence || 0.7) ? t : best
    );
    
    const allSources = topGroup.group.flatMap(t => t.sources || [{
      platform: t.platform || 'unknown',
      timestamp: t.timestamp,
      confidence: t.confidence || 0.7,
    }]);
    
    return {
      bestTrack,
      allSources,
      isConflict: false,
      conflictOptions: null,
    };
  }
  
  // Genuine conflict - create voting options
  const timestamp = tracksInSegment[0].timestamp || 0;
  const conflictOptions = groupConfidences.slice(0, 2).map((gc, i) => {
    const representative = gc.group.reduce((best, t) => 
      (t.confidence || 0.7) > (best.confidence || 0.7) ? t : best
    );
    return {
      id: `opt-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: representative.title,
      artist: representative.artist,
      source: representative.platform || representative.sources?.[0]?.platform || 'unknown',
      confidence: gc.avgConfidence,
      contributedBy: representative.contributedBy,
      duration: representative.duration,
    };
  });
  
  // Use the higher-confidence option as the default track (can be overridden by voting)
  const bestTrack = groupConfidences[0].group[0];
  
  return {
    bestTrack,
    allSources: tracksInSegment.flatMap(t => t.sources || [{
      platform: t.platform || 'unknown',
      timestamp: t.timestamp,
      confidence: t.confidence || 0.7,
    }]),
    isConflict: true,
    conflictOptions,
    conflictTimestamp: timestamp,
  };
}

/**
 * Identify gaps in the tracklist where no tracks were identified.
 * Returns array of { start, end, duration } for significant gaps.
 */
function identifyGaps(tracks, totalDuration) {
  const gaps = [];
  const sorted = [...tracks].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  
  // Gap at the start
  if (sorted.length > 0 && sorted[0].timestamp > MIN_TRACK_GAP * 2) {
    gaps.push({
      start: 0,
      end: sorted[0].timestamp,
      duration: sorted[0].timestamp,
    });
  }
  
  // Gaps between tracks
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = (sorted[i].timestamp || 0) + (sorted[i].duration || 180); // Assume 3 min if unknown
    const nextStart = sorted[i + 1].timestamp || 0;
    const gapDuration = nextStart - currentEnd;
    
    // If gap is larger than expected (more than 5 minutes of unidentified content)
    if (gapDuration > 300) {
      gaps.push({
        start: currentEnd,
        end: nextStart,
        duration: gapDuration,
        afterTrack: i,
      });
    }
  }
  
  // Gap at the end
  if (totalDuration && sorted.length > 0) {
    const lastTrackEnd = (sorted[sorted.length - 1].timestamp || 0) + 180;
    if (totalDuration - lastTrackEnd > 300) {
      gaps.push({
        start: lastTrackEnd,
        end: totalDuration,
        duration: totalDuration - lastTrackEnd,
      });
    }
  }
  
  return gaps;
}

/**
 * Main merge function - combines tracks from multiple sources with smart deduplication.
 * 
 * Strategy:
 * 1. Combine all tracks from both sources with platform tags
 * 2. Scale timestamps if durations differ
 * 3. Group into time segments (tracks within 30s of each other)
 * 4. For each segment, resolve to single track or create conflict
 * 5. Identify gaps where no tracks were found
 * 6. Return clean tracklist + conflicts + gaps
 */
function mergeTracks(primaryTracks, secondaryTracks, primaryDuration, secondaryDuration, setId, setName, secondaryPlatform) {
  const stats = {
    totalPrimary: primaryTracks.length,
    totalSecondary: secondaryTracks.length,
    totalBeforeMerge: primaryTracks.length + secondaryTracks.length,
    matched: 0,
    deduped: 0,
    newFromSecondary: 0,
    conflictsCreated: 0,
    gapsIdentified: 0,
    durationRatio: 1,
  };

  // Calculate duration ratio (allow 5% tolerance before scaling)
  let durationRatio = 1;
  if (primaryDuration && secondaryDuration) {
    const ratio = primaryDuration / secondaryDuration;
    if (Math.abs(ratio - 1) > 0.05) {
      durationRatio = ratio;
    }
  }
  stats.durationRatio = durationRatio;

  // Tag primary tracks with their platform
  const taggedPrimary = primaryTracks.map(t => ({
    ...t,
    platform: t.sources?.[0]?.platform || 'youtube',
    sources: t.sources || [{
      platform: 'youtube',
      timestamp: t.timestamp,
      confidence: t.confidence || 0.7,
      importedAt: new Date().toISOString(),
    }],
  }));

  // Scale secondary timestamps and tag with platform
  const taggedSecondary = secondaryTracks.map(track => ({
    ...track,
    platform: secondaryPlatform,
    originalTimestamp: track.timestamp,
    timestamp: Math.round((track.timestamp || 0) * durationRatio),
    sources: [{
      platform: secondaryPlatform,
      timestamp: Math.round((track.timestamp || 0) * durationRatio),
      contributedBy: track.contributedBy,
      confidence: track.confidence || 0.7,
      importedAt: new Date().toISOString(),
    }],
  }));

  // Combine all tracks
  const allTracks = [...taggedPrimary, ...taggedSecondary];
  
  // Group into time segments
  const segments = groupIntoSegments(allTracks);
  
  console.log(`Merging: ${allTracks.length} total tracks -> ${segments.length} segments`);
  
  // Resolve each segment
  const mergedTracks = [];
  const conflicts = [];
  
  for (const segment of segments) {
    const resolution = resolveSegment(segment, setId, setName);
    
    if (!resolution) continue;
    
    if (resolution.isConflict && resolution.conflictOptions) {
      // Create a conflict for voting
      conflicts.push({
        id: `conflict-${setId}-${resolution.conflictTimestamp}-${Date.now()}`,
        setId,
        setName,
        timestamp: resolution.conflictTimestamp,
        options: resolution.conflictOptions,
        votes: [],
        createdAt: new Date().toISOString(),
        status: 'active',
      });
      stats.conflictsCreated++;
    }
    
    // Track deduplication stats
    const sourcesInSegment = segment.length;
    const platformsInSegment = new Set(segment.map(t => t.platform)).size;
    
    if (platformsInSegment > 1 && !resolution.isConflict) {
      stats.matched++; // Cross-platform match
    }
    if (sourcesInSegment > 1 && platformsInSegment === 1) {
      stats.deduped += sourcesInSegment - 1; // Same-platform deduplication
    }
    
    // Add the resolved track
    mergedTracks.push({
      id: resolution.bestTrack.id || `track-merged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: resolution.bestTrack.title,
      artist: resolution.bestTrack.artist,
      duration: resolution.bestTrack.duration || 0,
      coverUrl: resolution.bestTrack.coverUrl || '',
      addedAt: new Date().toISOString(),
      source: 'ai',
      timestamp: resolution.bestTrack.timestamp,
      contributedBy: resolution.bestTrack.contributedBy,
      verified: false,
      confidence: resolution.bestTrack.confidence || 0.7,
      sources: resolution.allSources,
      hasConflict: resolution.isConflict,
    });
  }

  // Sort by timestamp
  mergedTracks.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // Identify gaps
  const gaps = identifyGaps(mergedTracks, primaryDuration || secondaryDuration);
  stats.gapsIdentified = gaps.length;
  stats.newFromSecondary = secondaryTracks.length - stats.matched - stats.conflictsCreated;

  console.log(`Merge complete: ${mergedTracks.length} tracks, ${conflicts.length} conflicts, ${gaps.length} gaps`);

  return { 
    mergedTracks, 
    conflicts, 
    gaps,
    stats,
  };
}

// ============ CHROME EXTENSION HANDLER ============

async function handleChromeExtensionImport(req, res, data) {
  console.log('[Chrome Import] Handler called with data:', {
    source: data?.source,
    tracksCount: data?.tracks?.length,
    artistsCount: data?.artists?.length,
    keys: data ? Object.keys(data) : 'null',
  });
  
  // Validate we have data to import
  if (!data || (!data.tracks?.length && !data.artists?.length)) {
    console.log('[Chrome Import] No data to import');
    return res.status(400).json({ 
      error: 'No tracks or artists to import',
      received: {
        hasTracks: !!data?.tracks,
        tracksLength: data?.tracks?.length || 0,
        hasArtists: !!data?.artists,
        artistsLength: data?.artists?.length || 0,
      }
    });
  }
  
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('[Chrome Import] Supabase config:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
  });
  
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ 
      error: 'Database not configured',
      message: 'Supabase credentials not found on server'
    });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
  }
  
  function generateSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  
  console.log(`[Chrome Import] Processing from ${data.source}:`, {
    artists: data.artists?.length || 0,
    tracks: data.tracks?.length || 0,
  });
  
  const results = {
    artistsCreated: 0,
    artistsSkipped: 0,
    tracksCreated: 0,
    tracksSkipped: 0,
    setCreated: false,
    setId: null,
  };
  
  // Process artists
  if (data.artists && Array.isArray(data.artists)) {
    for (const artist of data.artists) {
      if (!artist.name) continue;
      const slug = generateSlug(artist.name);
      
      const { data: existing } = await supabase.from('artists').select('id').eq('slug', slug).single();
      
      if (existing) {
        results.artistsSkipped++;
        continue;
      }
      
      const { error } = await supabase.from('artists').insert({
        name: artist.name,
        slug,
        genres: artist.genres || [],
        country: artist.country || null,
        beatport_url: artist.beatport_url || null,
        soundcloud_url: artist.soundcloud_url || null,
      });
      
      if (error && !error.message.includes('duplicate')) {
        console.error(`Artist error: ${artist.name}`, error.message);
      }
      error ? results.artistsSkipped++ : results.artistsCreated++;
    }
  }
  
  // Process tracks
  if (data.tracks && Array.isArray(data.tracks)) {
    for (const track of data.tracks) {
      if (!track.title) continue;
      const titleNormalized = normalizeText(track.title);
      const artistName = track.artist || track.artists?.[0] || 'Unknown';
      
      const { data: existing } = await supabase.from('tracks').select('id').eq('title_normalized', titleNormalized).eq('artist_name', artistName).single();
      
      if (existing) {
        results.tracksSkipped++;
        continue;
      }
      
      // Find artist ID
      let artistId = null;
      const { data: artistData } = await supabase.from('artists').select('id').eq('slug', generateSlug(artistName)).single();
      if (artistData) artistId = artistData.id;
      
      const { error } = await supabase.from('tracks').insert({
        title: track.title,
        title_normalized: titleNormalized,
        artist_id: artistId,
        artist_name: artistName,
        label: track.label || null,
        release_year: track.release_year || null,
        is_unreleased: track.is_unreleased || false,
        bpm: track.bpm || null,
        key: track.key || null,
        duration_seconds: track.duration_seconds || null,
        beatport_url: track.beatport_url || null,
        soundcloud_url: track.soundcloud_url || null,
        times_played: 0,
      });
      
      if (error && !error.message.includes('duplicate')) {
        console.error(`Track error: ${track.title}`, error.message);
      }
      error ? results.tracksSkipped++ : results.tracksCreated++;
    }
  }
  
  // Process set info for 1001tracklists
  if (data.source === '1001tracklists' && data.setInfo) {
    try {
      const setInfo = data.setInfo;
      const setSlug = generateSlug(`${setInfo.djName}-${setInfo.title}`.substring(0, 100));

      // Only save tracklist_url if it's an actual tracklist page URL (not DJ profile)
      // Valid: https://www.1001tracklists.com/tracklist/abc123/
      // Invalid: https://www.1001tracklists.com/dj/chris-stussy/
      const isValidTracklistUrl = data.sourceUrl &&
        data.sourceUrl.includes('/tracklist/') &&
        !data.sourceUrl.includes('/dj/');

      const tracklistUrl = isValidTracklistUrl ? data.sourceUrl : null;

      // Check if set already exists (by tracklist_url if we have one, or by slug)
      let existingSet = null;
      if (tracklistUrl) {
        const { data: setByUrl } = await supabase
          .from('sets')
          .select('id')
          .eq('tracklist_url', tracklistUrl)
          .single();
        existingSet = setByUrl;
      }

      // Also check by slug if no URL match
      if (!existingSet) {
        const { data: setBySlug } = await supabase
          .from('sets')
          .select('id')
          .eq('slug', setSlug)
          .single();
        existingSet = setBySlug;
      }

      if (!existingSet) {
        // Find DJ's artist ID
        let djId = null;
        if (setInfo.djName && setInfo.djName !== 'Unknown Artist') {
          const { data: djData } = await supabase
            .from('artists')
            .select('id')
            .eq('slug', generateSlug(setInfo.djName))
            .single();
          if (djData) djId = djData.id;
        }

        // Parse date
        let eventDate = null;
        if (setInfo.date) {
          // Try to parse various date formats
          const dateStr = setInfo.date;
          const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/) ||
                           dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) {
            if (dateMatch[0].includes('-')) {
              eventDate = dateMatch[0];
            } else {
              eventDate = `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`;
            }
          }
        }

        // Create the set
        const { data: newSet, error: setError } = await supabase
          .from('sets')
          .insert({
            title: setInfo.title,
            slug: setSlug,
            dj_name: setInfo.djName,
            dj_id: djId,
            venue: setInfo.venue || null,
            event_name: setInfo.eventName || null,
            event_date: eventDate,
            duration_seconds: setInfo.durationSeconds || null,
            track_count: data.tracks?.length || 0,
            tracklist_url: tracklistUrl,
            soundcloud_url: setInfo.soundcloud_url || null,
            youtube_url: setInfo.youtube_url || null,
            mixcloud_url: setInfo.mixcloud_url || null,
            spotify_url: setInfo.spotify_url || null,
            apple_music_url: setInfo.apple_music_url || null,
            source: '1001tracklists',
          })
          .select('id')
          .single();

        if (setError) {
          console.error('[Chrome Import] Set creation error:', setError.message);
        } else if (newSet) {
          results.setCreated = true;
          results.setId = newSet.id;

          // Create set_tracks entries
          for (const track of data.tracks || []) {
            // Find track ID if it exists
            let trackId = null;
            const titleNormalized = normalizeText(track.title);
            const artistName = track.artist || 'Unknown';

            const { data: trackData } = await supabase
              .from('tracks')
              .select('id')
              .eq('title_normalized', titleNormalized)
              .eq('artist_name', artistName)
              .single();

            if (trackData) trackId = trackData.id;

            // Insert set_track
            await supabase.from('set_tracks').insert({
              set_id: newSet.id,
              track_id: trackId,
              artist_name: artistName,
              track_title: track.title,
              position: track.position || 0,
              timestamp_seconds: track.timestamp_seconds || null,
              timestamp_str: track.timestamp_str || null,
              is_id: track.is_unreleased || track.title?.toLowerCase() === 'id',
            });
          }

          console.log(`[Chrome Import] Created set "${setInfo.title}" with ${data.tracks?.length || 0} tracks`);
        }
      } else {
        console.log('[Chrome Import] Set already exists:', tracklistUrl || setSlug);
        results.setId = existingSet.id;
      }
    } catch (setErr) {
      console.error('[Chrome Import] Set processing error:', setErr.message);
    }
  }

  console.log('[Chrome Import] Results:', results);

  return res.status(200).json({
    success: true,
    source: data.source,
    ...results,
  });
}

// ============ MAIN HANDLER ============

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // GET handler for testing connection
  if (req.method === 'GET') {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    return res.status(200).json({
      status: 'ok',
      endpoint: '/api/import',
      supabaseConfigured: !!(supabaseUrl && supabaseKey),
      timestamp: new Date().toISOString(),
    });
  }
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body - handle both pre-parsed and string bodies
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error('[Import] Failed to parse body:', e.message);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  body = body || {};
  
  console.log('[Import] Received request:', {
    chromeExtension: body.chromeExtension,
    hasUrl: !!body.url,
    hasTracks: !!body.tracks,
    hasArtists: !!body.artists,
    source: body.source,
  });
  
  // Handle Chrome Extension import
  if (body.chromeExtension) {
    return handleChromeExtensionImport(req, res, body);
  }

  const { url, mergeWith } = body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const platform = detectPlatform(url);
    
    if (platform === 'youtube') {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });
      
      const result = await importFromYouTube(url, apiKey);
      
      // If merge mode, merge with existing tracks
      if (mergeWith && result.success) {
        const { existingTracks, primaryDuration, setId, setName } = mergeWith;
        const newTracks = result.setList.tracks.map(t => ({
          title: t.title,
          artist: t.artist,
          timestamp: t.timestamp,
          confidence: 0.7,
          contributedBy: t.contributedBy,
        }));
        
        const mergeResult = mergeTracks(
          existingTracks,
          newTracks,
          primaryDuration,
          result.setList.totalDuration,
          setId,
          setName,
          'youtube'
        );
        
        return res.status(200).json({
          ...result,
          mergeResult: {
            mergedTracks: mergeResult.mergedTracks,
            conflicts: mergeResult.conflicts,
            stats: mergeResult.stats,
          },
        });
      }
      
      return res.status(200).json(result);
      
    } else if (platform === 'soundcloud') {
      const result = await importFromSoundCloud(url);
      
      // If merge mode, merge with existing tracks
      if (mergeWith && result.success) {
        const { existingTracks, primaryDuration, setId, setName } = mergeWith;
        const newTracks = result.setList.tracks.map(t => ({
          title: t.title,
          artist: t.artist,
          timestamp: t.timestamp,
          confidence: 0.7,
          contributedBy: t.contributedBy,
        }));
        
        const mergeResult = mergeTracks(
          existingTracks,
          newTracks,
          primaryDuration,
          result.setList.totalDuration,
          setId,
          setName,
          'soundcloud'
        );
        
        return res.status(200).json({
          ...result,
          mergeResult: {
            mergedTracks: mergeResult.mergedTracks,
            conflicts: mergeResult.conflicts,
            stats: mergeResult.stats,
          },
        });
      }
      
      return res.status(200).json(result);
      
    } else if (platform === 'mixcloud') {
      return res.status(400).json({ error: 'Mixcloud support coming soon!' });
      
    } else {
      return res.status(400).json({ error: 'Unsupported platform. Please use a YouTube or SoundCloud link.' });
    }
    
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Import failed' });
  }
};
