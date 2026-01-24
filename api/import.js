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
  cleaned = cleaned.replace(/^[\s|:\-–—.]+/, '').trim();
  cleaned = cleaned.replace(/[\s|:\-–—.]+$/, '').trim();
  cleaned = cleaned.replace(/^\d{1,2}[.)]\s*/, '').trim();

  const noiseTerms = [/^\s*tracklist\s*:?\s*$/i, /^intro$/i, /^outro$/i, /^id\s*[-–—]\s*id\s*$/i, /^unknown$/i, /^tba$/i, /^\s*$/, /^id\?*$/i, /^track\s*id\?*$/i, /^what.*tune/i, /^tune\?*$/i, /^crazy/i, /^heate+r+/i, /^fire$/i, /^banger$/i, /^unreal$/i, /^insane$/i, /^anyone know/i, /^need.*id/i, /^i need/i, /^please\s*(id|identify)/i, /^is\s+unreal/i, /^sounds like/i, /^neee+d/i];
  for (const noise of noiseTerms) {
    if (noise.test(cleaned)) return null;
  }

  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
  const emojis = cleaned.match(emojiRegex) || [];
  const nonEmojiLength = cleaned.replace(emojiRegex, '').trim().length;
  if (emojis.length > 0 && nonEmojiLength < 5) return null;
  if (/^\d+:\d+\s*$/.test(cleaned)) return null;
  if (/\?\s*$/.test(cleaned) && !cleaned.includes(' - ')) return null;
  if (cleaned.length < 3 || cleaned.length > 200) return null;

  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let part1 = dashMatch[1].trim();
    let part2 = dashMatch[2].trim();
    const part1HasRemix = /remix|edit|vip|dub|bootleg/i.test(part1);
    const part2HasRemix = /remix|edit|vip|dub|bootleg/i.test(part2);
    if (part2HasRemix && !part1HasRemix) {
      return { artist: part1, title: part2 };
    }
    return { title: part1, artist: part2 };
  }

  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) return { title: byMatch[1].trim(), artist: byMatch[2].trim() };

  return null;
}

function parseComments(comments) {
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
        afterText = afterText.replace(/^[\s|:\-–—.]+/, '').trim();
        const info = parseTrackInfo(afterText);
        if (info) {
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

function parseDescription(description) {
  const lines = cleanText(description).split(/[\n\r]+/);
  const tracks = [];
  const seen = new Set();
  for (const line of lines) {
    const timestamps = extractTimestamps(line);
    if (timestamps.length > 0) {
      const ts = timestamps[0];
      let afterText = line.slice(ts.position + ts.formatted.length).trim();
      afterText = afterText.replace(/^[\s|:\-–—.]+/, '').trim();
      const info = parseTrackInfo(afterText);
      if (info) {
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
  
  // Skip noise
  const noisePatterns = [
    /^(id\??|track\s*id\??|what|anyone|need|fire|banger|heater|crazy|insane|unreal|tune\??|sick|wow|omg|yes+|finally|sound dude)$/i,
    /^(i need|anyone know|what song|what track|please id|need this|i'd|anyone got)/i,
    /^(best|love|great|amazing|perfect|incredible)\s*(set|track|tune|song|mix|boiler)?$/i,
    /^\d+:\d+\s*$/,  // Just a timestamp
    /^@/,  // Just an @mention (wasn't cleaned)
  ];
  
  for (const pattern of noisePatterns) {
    if (pattern.test(cleaned)) return null;
  }
  
  // Too short or too long
  if (cleaned.length < 5 || cleaned.length > 200) return null;
  
  // Skip if ends with ? and doesn't look like track info
  if (/\?\s*$/.test(cleaned) && !/[-–—]/.test(cleaned)) return null;
  
  // Try to parse formats with dash: "Artist - Title" or "Title - Artist"
  // Also handle formats like "closer -gaskin" (space before dash)
  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let part1 = dashMatch[1].trim();
    let part2 = dashMatch[2].trim();
    
    // Skip if either part is too short or just noise
    if (part1.length < 2 || part2.length < 2) return null;
    if (/^(id|unknown|tba|\?+)$/i.test(part1) || /^(id|unknown|tba|\?+)$/i.test(part2)) return null;
    
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
    return { 
      title: toTitleCase(byMatch[1].trim()), 
      artist: toTitleCase(byMatch[2].trim()) 
    };
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
        return {
          artist: toTitleCase(firstWords[0]),
          title: toTitleCase(firstWords.slice(1).join(' ') + ' / ' + part2)
        };
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
  
  // Merge description tracks and comment tracks
  const merged = new Map();
  for (const t of descTracks) merged.set(t.timestamp, t);
  for (const t of commentTracks) {
    // Only add if no similar timestamp exists (within 30 seconds)
    const existing = Array.from(merged.keys()).find(ts => Math.abs(ts - t.timestamp) < 30);
    if (!existing) merged.set(t.timestamp, t);
  }
  
  const tracks = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
  
  // Parse artist/title 
  const { name, artist } = parseArtistFromTitle(title);
  const finalArtist = artist !== 'Unknown Artist' ? artist : artistFromPage;
  const finalName = name || title;
  
  const setList = {
    id: `sc-${oembedInfo.id}-${Date.now()}`,
    name: finalName,
    artist: finalArtist,
    date: pageInfo?.createdAt || new Date().toISOString(),
    tracks: tracks.map((pt, i) => ({
      id: `imported-${Date.now()}-${i}`,
      title: pt.title,
      artist: pt.artist,
      duration: 0,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date().toISOString(),
      source: 'ai',
      timestamp: pt.timestamp,
      verified: false,
      contributedBy: pt.sourceAuthor || 'Description',
    })),
    coverUrl: thumbnailUrl,
    sourceLinks: [{ platform: 'soundcloud', url }],
    totalDuration: duration,
    aiProcessed: true,
    commentsScraped: comments.length,
    tracksIdentified: tracks.length,
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
  };
}

// ============ YOUTUBE IMPORT ============

async function importFromYouTube(url, apiKey) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  const [video, comments] = await Promise.all([
    fetchVideoInfo(videoId, apiKey),
    fetchVideoComments(videoId, apiKey, 500),
  ]);

  const descTracks = parseDescription(video.description);
  const commentTracks = parseComments(comments);

  const merged = new Map();
  for (const t of descTracks) merged.set(t.timestamp, t);
  for (const t of commentTracks) {
    const existing = Array.from(merged.keys()).find(ts => Math.abs(ts - t.timestamp) < 30);
    if (!existing) merged.set(t.timestamp, t);
  }

  const tracks = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
  const { name, artist } = parseArtistFromTitle(video.title);

  const setList = {
    id: `yt-${video.id}-${Date.now()}`,
    name,
    artist: artist !== 'Unknown Artist' ? artist : video.channelTitle,
    date: video.publishedAt,
    tracks: tracks.map((pt, i) => ({
      id: `imported-${Date.now()}-${i}`,
      title: pt.title,
      artist: pt.artist,
      duration: 0,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date().toISOString(),
      source: 'ai',
      timestamp: pt.timestamp,
      verified: false,
      contributedBy: pt.sourceAuthor,
    })),
    coverUrl: video.thumbnailUrl,
    sourceLinks: [{ platform: 'youtube', url }],
    totalDuration: parseDuration(video.duration),
    aiProcessed: true,
    commentsScraped: comments.length,
    tracksIdentified: tracks.length,
    plays: 0,
  };

  return { success: true, setList, videoInfo: video, commentsCount: comments.length, tracksCount: tracks.length };
}

// ============ MAIN HANDLER ============

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const platform = detectPlatform(url);
    
    if (platform === 'youtube') {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });
      
      const result = await importFromYouTube(url, apiKey);
      return res.status(200).json(result);
      
    } else if (platform === 'soundcloud') {
      const result = await importFromSoundCloud(url);
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
