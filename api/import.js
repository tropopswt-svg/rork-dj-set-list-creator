const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });

  try {
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

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

    return res.status(200).json({ success: true, setList, videoInfo: video, commentsCount: comments.length, tracksCount: tracks.length });
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Import failed' });
  }
};
