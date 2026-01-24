const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const SOUNDCLOUD_OEMBED = 'https://soundcloud.com/oembed';

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

async function importFromSoundCloud(url) {
  // Try page scraping first (more reliable), then fallback to oEmbed
  const pageInfo = await fetchSoundCloudPage(url);
  const oembedInfo = await fetchSoundCloudInfo(url);
  
  // Combine info from both sources, preferring page info
  const title = pageInfo?.title || oembedInfo.title || 'Unknown Set';
  const description = pageInfo?.description || oembedInfo.description || '';
  const duration = pageInfo?.duration || 0;
  const thumbnailUrl = pageInfo?.artworkUrl || oembedInfo.thumbnailUrl;
  const artistFromPage = pageInfo?.artist || oembedInfo.artist;
  
  // Parse tracklist from description
  const tracks = parseDescription(description);
  
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
    commentsScraped: 0, // SoundCloud comments aren't easily accessible
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
    commentsCount: 0,
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
