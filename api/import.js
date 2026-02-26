import { fetchSoundCloudClientId } from './_lib/soundcloud-core.js';
import { rateLimit } from './_lib/rate-limit.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const SOUNDCLOUD_OEMBED = 'https://soundcloud.com/oembed';
const SOUNDCLOUD_API_V2 = 'https://api-v2.soundcloud.com';

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
  const allComments = [];
  const seenIds = new Set();

  // Helper to fetch comments with a specific order
  async function fetchWithOrder(order, limit) {
    const comments = [];
    let nextPageToken;
    while (comments.length < limit) {
      const pageSize = Math.min(100, limit - comments.length);
      let url = `${YOUTUBE_API_BASE}/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=${pageSize}&order=${order}&key=${apiKey}`;
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
        // Skip if already seen
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        const c = item.snippet.topLevelComment.snippet;
        const topComment = {
          id: item.id,
          authorName: c.authorDisplayName,
          text: c.textOriginal || c.textDisplay,
          likeCount: c.likeCount,
          isReply: false,
        };
        comments.push(topComment);

        // Process replies - these often contain track IDs
        if (item.replies && item.replies.comments) {
          const parentTimestamps = extractTimestamps(topComment.text);
          const parentTimestamp = parentTimestamps.length > 0 ? parentTimestamps[0] : null;

          for (const reply of item.replies.comments) {
            if (seenIds.has(reply.id)) continue;
            seenIds.add(reply.id);

            const r = reply.snippet;
            comments.push({
              id: reply.id,
              authorName: r.authorDisplayName,
              text: r.textOriginal || r.textDisplay,
              likeCount: r.likeCount,
              isReply: true,
              parentId: item.id,
              parentTimestamp: parentTimestamp,
            });
          }
        }
      }
      nextPageToken = data.nextPageToken;
      if (!nextPageToken) break;
    }
    return comments;
  }

  // Fetch by relevance (most liked/engaged comments - often have good tracklists)
  try {
    const relevanceComments = await fetchWithOrder('relevance', maxResults);
    allComments.push(...relevanceComments);
    console.log(`Fetched ${relevanceComments.length} comments by relevance`);
  } catch (e) {
    console.log(`[Comments] Relevance fetch failed: ${e.message}`);
  }

  // Also fetch by time (recent comments - catch new comprehensive tracklists)
  try {
    const timeComments = await fetchWithOrder('time', Math.floor(maxResults / 2));
    allComments.push(...timeComments);
    console.log(`Fetched ${timeComments.length} additional comments by time`);
  } catch (e) {
    console.log(`[Comments] Time fetch failed: ${e.message}`);
  }

  console.log(`Total: ${allComments.length} YouTube comments (including replies)`);
  return allComments;
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
  // Remove numbered list prefixes like "1.", "2)", "75."
  cleaned = cleaned.replace(/^\d{1,3}[.)]\s*/, '').trim();

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
    /^(man|dude|bro|mate),?\s/i,
    /^no\s+(doubt|way|cap)/i,
    /^(big|huge|massive)\s+(tune|track|banger|one)/i,
    /^(such|what)\s+a\s+(tune|set|mix|banger|track)/i,
    /^(need|want|give)\s+(this|that|the)\s/i,
    /^(my|the)\s+(favourite|favorite|fav)\s/i,
    /^(played|playing|plays)\s+(this|that|it)\s/i,
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
  if (openParens !== closeParens) return null;

  // Reject if it starts or ends with a broken parenthesis pattern
  if (/^\)/.test(cleaned) || /\($/.test(cleaned)) return null;

  // Reject truncated text: ends with open paren + tiny fragment like "Drive (I" or "(mixed"
  if (/\([a-zA-Z]{1,3}$/.test(cleaned)) return null;

  // Reject text that starts with a lowercase letter (truncated from the start, e.g., "ree Style Dub")
  // Exception: known lowercase prefixes and intentional lowercase artists
  // Also allow if text contains " - " (likely a valid "artist - title" line)
  if (/^[a-z]/.test(cleaned) && !/^(dj |mc |de |di |da |le |la |el |vs |ft |a |i )/.test(cleaned.toLowerCase()) && !cleaned.includes(' - ')) {
    return null;
  }

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
  
  // Common single words that are not track titles or artist names
  const commonWords = new Set([
    'the', 'this', 'that', 'what', 'when', 'where', 'which', 'who', 'how',
    'set', 'mix', 'live', 'here', 'best', 'vibes', 'good', 'great', 'nice',
    'tune', 'song', 'track', 'music', 'sound', 'yeah', 'yes', 'wow', 'omg',
  ]);

  // Strip "unreleased" tag that might be embedded in the text (it's metadata, not track info)
  cleaned = cleaned.replace(/\bunreleased\b\s*/gi, '').trim();
  // Strip "forthcoming" tag too
  cleaned = cleaned.replace(/\bforthcoming\b\s*/gi, '').trim();
  // Re-clean leading/trailing junk after stripping
  cleaned = cleaned.replace(/^[\s|:\-–—.\[\]()]+/, '').replace(/[\s|:\-–—.\[\]()]+$/, '').trim();

  // Reject if too short after cleaning
  if (cleaned.length < 5) return null;

  // Standard format: "Artist - Title"
  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let part1 = dashMatch[1].trim();
    let part2 = dashMatch[2].trim();

    // Clean up any leftover "unreleased" fragments from parts
    part1 = part1.replace(/\bunreleased\b\s*/gi, '').trim();
    part2 = part2.replace(/\bunreleased\b\s*/gi, '').trim();

    // Validate both parts look like real track/artist info
    if (!isValidTrackPart(part1) || !isValidTrackPart(part2)) return null;

    // Reject if either part is a common English word (not a real artist/title)
    const p1Lower = part1.toLowerCase().trim();
    const p2Lower = part2.toLowerCase().trim();
    if (commonWords.has(p1Lower) || commonWords.has(p2Lower)) return null;

    // Reject if artist and title are the same text (parsing error)
    if (p1Lower === p2Lower) return null;

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
  if (!str || str.length < 3) return false;
  if (str.length > 100) return false;

  // Reject if it's mostly numbers or special characters
  const alphaCount = (str.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < 2) return false;

  // Reject truncated parts: ends with open paren + 0-2 chars (e.g., "Drive (I", "unreleased M")
  if (/\([a-zA-Z]{0,2}$/.test(str)) return false;

  // Reject unbalanced parentheses in individual parts
  const open = (str.match(/\(/g) || []).length;
  const close = (str.match(/\)/g) || []).length;
  if (open !== close) return false;

  // Reject parts that start with a closing paren
  if (/^\)/.test(str)) return false;

  // Reject parts that are metadata labels, not artist/title
  if (/^unreleased\b/i.test(str)) return false;
  if (/^forthcoming\b/i.test(str)) return false;

  // Reject parts starting with lowercase (truncated text) unless known pattern
  // Allow lowercase-starting parts if they have 4+ alpha chars (real artist names like "kölsch", "deadmau5")
  const lcAlphaCount = (str.match(/[a-zA-Z]/g) || []).length;
  if (/^[a-z]/.test(str) && lcAlphaCount < 4 && !/^(dj |mc |de |di |da |le |la |el |vs |ft |a |i )/i.test(str)) return false;

  // Reject common non-track patterns
  // NOTE: keep these conservative — this validates individual artist/title PARTS after
  // splitting on " - ", so "Check It Out", "I Remember", "What Is Love" are all valid titles
  const invalidPatterns = [
    /^https?:/i,
    /^www\./i,
    /^listen\s+to\s/i,                             // "Listen to this track" — but not "Listen" alone
    /^not\s+sure/i,
    /^anyone/i,
    /^(so|very|really|fucking)\s+(good|fire|sick)/i,
    /^(amazing|incredible|insane|crazy|unreal)$/i, // Only reject as standalone word
    /starting\s+at/i,
    /^(set|mix|live|vibes?|tune|song|track)$/i,    // Single generic music words only
    /^(man|bro|mate|dude|lol|omg|wow)$/i,          // Reactions/filler
    /^(yes|no|yeah|nah|yep|nope)$/i,               // Affirmatives
    /^(here|there|now|then|just|only)$/i,           // Adverbs alone
    /^\d+$/,                                         // Pure numbers
    /^\d+\)\s*/,                                     // Starts with "75)" etc (leftover numbering)
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

  // Sort: prioritize comments with many timestamps (full tracklists), then by likes
  const sorted = [...comments].sort((a, b) => {
    const aTs = extractTimestamps(a.text).length;
    const bTs = extractTimestamps(b.text).length;
    if (aTs >= 5 && bTs < 5) return -1;
    if (bTs >= 5 && aTs < 5) return 1;
    return b.likeCount - a.likeCount;
  });

  // Helper to add a track if valid
  const addTrack = (ts, info, comment, isMultiLine, rawLineText = '') => {
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
      let conf = 0.5;
      if (isMultiLine) conf += 0.2; // Full tracklist comments are more reliable
      if (comment.likeCount > 100) conf += 0.15;
      else if (comment.likeCount > 10) conf += 0.05;
      const isUnreleased = detectUnreleasedInText(rawLineText) || detectUnreleasedInText(comment.text);
      const cleanTitle = isUnreleased ? stripUnreleasedFromTitle(info.title) : info.title;
      tracks.push({
        timestamp: ts.timestamp,
        timestampFormatted: ts.formatted,
        title: cleanTitle,
        artist: info.artist,
        confidence: Math.min(conf, 1),
        sourceAuthor: comment.authorName,
        likes: comment.likeCount,
        isUnreleased,
      });
    }
  };

  for (const comment of sorted) {
    const text = cleanText(comment.text);
    const timestamps = extractTimestamps(text);
    const lines = text.split(/[\n\r]+/).filter(l => l.trim());

    // CASE 1: Multi-line tracklist (5+ timestamps = someone posted full tracklist)
    if (timestamps.length >= 3 && lines.length >= 3) {
      for (const line of lines) {
        const lineTs = extractTimestamps(line);
        if (lineTs.length === 0) continue;
        const ts = lineTs[0];
        let afterText = line.slice(ts.position + ts.formatted.length).trim();
        afterText = afterText.replace(/^[\s|:\-–—.\[\]()]+/, '').trim();
        const info = parseTrackInfo(afterText);
        if (info) {
          addTrack(ts, info, comment, true, line);
        }
      }
    }
    // CASE 2: Single/few line comment with timestamp(s) - like "45:30 Fisher - Losing It"
    else if (timestamps.length > 0) {
      for (const ts of timestamps) {
        // Get text after this timestamp
        const afterIndex = ts.position + ts.formatted.length;
        let afterText = text.slice(afterIndex);
        // If there's another timestamp, only take text up to it
        const nextTs = timestamps.find(t => t.position > ts.position);
        if (nextTs) {
          afterText = text.slice(afterIndex, nextTs.position);
        }
        afterText = afterText.split(/[\n\r]/)[0]; // Take first line only
        afterText = afterText.replace(/^[\s|:\-–—.\[\]()]+/, '').trim();

        const info = parseTrackInfo(afterText);
        if (info) {
          addTrack(ts, info, comment, false, afterText);
        }
      }
    }
    // CASE 3: Reply comment inheriting timestamp from parent
    // "What's this track at 45:30?" -> Reply: "It's Fisher - Losing It"
    else if (comment.isReply && comment.parentTimestamp) {
      const info = parseTrackInfo(text);
      if (info) {
        addTrack(comment.parentTimestamp, info, comment, false, text);
      }
    }
    // CASE 4: Multi-line comment with NO timestamps but 3+ "Artist - Title" lines
    // Someone posted the entire tracklist in one comment without timestamps
    else if (lines.length >= 3) {
      const candidateLines = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Strip numbered prefixes: "1.", "2)", "03 -", etc.
        let cleaned = trimmed.replace(/^\d{1,3}[.):\-–—]\s*/, '').trim();
        if (/^\d{1,3}\s+/.test(trimmed)) {
          cleaned = trimmed.replace(/^\d{1,3}\s+/, '').trim();
        }
        const info = parseTrackInfo(cleaned);
        if (info) candidateLines.push({ info, rawLine: trimmed });
      }
      // Only treat as tracklist if majority of lines parse as tracks
      if (candidateLines.length >= 3 && candidateLines.length >= lines.filter(l => l.trim()).length * 0.5) {
        console.log(`[parseComments] CASE 4: untimed tracklist in comment by "${comment.authorName}" — ${candidateLines.length} tracks (${comment.likeCount} likes)`);
        for (let i = 0; i < candidateLines.length; i++) {
          let info = candidateLines[i].info;
          if (djName && areNamesSimilar(info.artist, djName)) {
            const reparsed = parseTrackInfo(info.title);
            info = reparsed || { title: info.title, artist: 'Unknown Artist' };
          }
          // Use a position-based key so same track at different positions isn't deduped
          const key = `untimed-${i}-${info.artist.toLowerCase()}-${info.title.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            const isUnreleased = detectUnreleasedInText(candidateLines[i].rawLine);
            const cleanTitle = isUnreleased ? stripUnreleasedFromTitle(info.title) : info.title;
            let conf = 0.6;
            if (comment.likeCount > 100) conf += 0.2;
            else if (comment.likeCount > 10) conf += 0.1;
            tracks.push({
              timestamp: 0,
              timestampFormatted: '',
              title: cleanTitle,
              artist: info.artist,
              confidence: Math.min(conf, 1),
              sourceAuthor: comment.authorName,
              likes: comment.likeCount,
              isUnreleased,
              position: i,
            });
          }
        }
      }
    }
  }

  console.log(`Parsed ${tracks.length} tracks from comments (${tracks.filter(t => t.timestamp > 0).length} timed, ${tracks.filter(t => !t.timestamp).length} untimed)`);

  // Sort: timed tracks by timestamp, untimed tracks by their position in the original comment
  const sortedTracks = tracks.sort((a, b) => {
    if (a.timestamp > 0 && b.timestamp > 0) return a.timestamp - b.timestamp;
    if (a.timestamp > 0) return -1; // timed before untimed
    if (b.timestamp > 0) return 1;
    return (a.position || 0) - (b.position || 0); // preserve comment order for untimed
  });

  // Normalize helper for dedup comparison
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Dedup: if two tracks are within 60 seconds and have similar titles, keep the higher-confidence one
  // For untimed tracks (timestamp=0), dedup by title+artist only (not timestamp proximity)
  const deduped = [];
  for (const track of sortedTracks) {
    const existing = deduped.find(t => {
      const titleMatch = normalize(t.title) === normalize(track.title) ||
        normalize(t.artist + t.title).includes(normalize(track.title)) ||
        normalize(track.artist + track.title).includes(normalize(t.title));
      if (!titleMatch) return false;
      // Timed tracks: require timestamp proximity
      if (t.timestamp > 0 && track.timestamp > 0) return Math.abs(t.timestamp - track.timestamp) < 60;
      // One or both are untimed: dedup by title+artist match only
      return true;
    });
    if (existing) {
      if (track.confidence > existing.confidence) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = track;
      }
    } else {
      deduped.push(track);
    }
  }

  console.log(`After dedup: ${deduped.length} tracks`);
  return deduped;
}

function parseDescription(description, djName = null) {
  const lines = cleanText(description).split(/[\n\r]+/);
  const tracks = [];
  const seen = new Set();

  // Pass 1: Extract tracks that have timestamps (most reliable)
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
          const isUnreleased = detectUnreleasedInText(line);
          const cleanTitle = isUnreleased ? stripUnreleasedFromTitle(info.title) : info.title;
          tracks.push({ timestamp: ts.timestamp, timestampFormatted: ts.formatted, title: cleanTitle, artist: info.artist, confidence: 0.95, sourceAuthor: 'Uploader', likes: 0, isUnreleased });
        }
      }
    }
  }

  // Pass 2: If no timestamped tracks found, look for non-timestamped tracklists
  // (e.g. BBC Radio 1 tracklists: "01. Artist - Track" or plain "Artist - Track" lines)
  if (tracks.length === 0) {
    const candidateLines = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Strip numbered prefix: "01.", "1.", "2)", "03 -", etc.
      let cleaned = trimmed.replace(/^\d{1,3}[.):\-–—]\s*/, '').trim();
      // Also handle "01 " (number + space, no punctuation) when followed by Artist - Track
      if (/^\d{1,3}\s+\S/.test(trimmed) && !cleaned.match(/^\d{1,3}\s/)) {
        // already stripped above
      } else if (/^\d{1,3}\s+/.test(trimmed)) {
        cleaned = trimmed.replace(/^\d{1,3}\s+/, '').trim();
      }

      const info = parseTrackInfo(cleaned);
      if (info) {
        candidateLines.push({ line: trimmed, info, cleaned });
      }
    }

    // Only use non-timestamped tracks if we found a meaningful cluster (3+ tracks)
    // This prevents random "Artist - Title" lines in descriptions from being treated as tracklists
    if (candidateLines.length >= 3) {
      console.log(`[parseDescription] Found ${candidateLines.length} non-timestamped tracks (tracklist without timestamps)`);
      for (let i = 0; i < candidateLines.length; i++) {
        let info = candidateLines[i].info;

        // If the parsed "artist" is actually the DJ name, fix it
        if (djName && areNamesSimilar(info.artist, djName)) {
          const reparsed = parseTrackInfo(info.title);
          if (reparsed) {
            info = reparsed;
          } else {
            info = { title: info.title, artist: 'Unknown Artist' };
          }
        }

        const key = `${i}-${info.artist.toLowerCase()}-${info.title.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          const isUnreleased = detectUnreleasedInText(candidateLines[i].line);
          const cleanTitle = isUnreleased ? stripUnreleasedFromTitle(info.title) : info.title;
          tracks.push({
            timestamp: 0, // No real timestamp — will be distributed evenly by the client
            timestampFormatted: '',
            title: cleanTitle,
            artist: info.artist,
            confidence: 0.85, // Slightly lower since no timestamp verification
            sourceAuthor: 'Uploader',
            likes: 0,
            isUnreleased,
            position: i, // Preserve order from description
          });
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

/**
 * Canonical venue database - maps variations to standard venue names with locations
 */
const VENUE_DATABASE = {
  // Ibiza
  'ushuaia': { name: 'Ushuaïa', location: 'Ibiza, Spain', aliases: ['ushuaïa', 'ushuaia ibiza'] },
  'hi ibiza': { name: 'Hï Ibiza', location: 'Ibiza, Spain', aliases: ['hï ibiza', 'hi-ibiza'] },
  'pacha': { name: 'Pacha', location: 'Ibiza, Spain', aliases: ['pacha ibiza'] },
  'amnesia': { name: 'Amnesia', location: 'Ibiza, Spain', aliases: ['amnesia ibiza'] },
  'dc10': { name: 'DC-10', location: 'Ibiza, Spain', aliases: ['dc-10', 'dc 10'] },
  'privilege': { name: 'Privilege', location: 'Ibiza, Spain', aliases: ['privilege ibiza'] },

  // Berlin
  'berghain': { name: 'Berghain', location: 'Berlin, Germany', aliases: ['berghain berlin'] },
  'tresor': { name: 'Tresor', location: 'Berlin, Germany', aliases: ['tresor berlin'] },
  'watergate': { name: 'Watergate', location: 'Berlin, Germany', aliases: [] },

  // London/UK
  'fabric': { name: 'Fabric', location: 'London, UK', aliases: ['fabric london'] },
  'printworks': { name: 'Printworks', location: 'London, UK', aliases: ['printworks london'] },
  'warehouse project': { name: 'The Warehouse Project', location: 'Manchester, UK', aliases: ['twp', 'whp'] },
  'depot': { name: 'Depot', location: 'UK', aliases: ['depot mayfield'] },
  'motion': { name: 'Motion', location: 'Bristol, UK', aliases: [] },

  // New York
  'brooklyn mirage': { name: 'Brooklyn Mirage', location: 'New York, USA', aliases: ['the brooklyn mirage', 'mirage'] },
  'avant gardner': { name: 'Avant Gardner', location: 'New York, USA', aliases: ['avant gardener'] },
  'output': { name: 'Output', location: 'Brooklyn, USA', aliases: ['output brooklyn'] },
  'nowadays': { name: 'Nowadays', location: 'New York, USA', aliases: [] },

  // Chicago
  'navy pier': { name: 'Navy Pier', location: 'Chicago, USA', aliases: ['navypier'] },
  'spybar': { name: 'Spybar', location: 'Chicago, USA', aliases: ['spy bar'] },
  'sound-bar': { name: 'Sound-Bar', location: 'Chicago, USA', aliases: ['soundbar chicago'] },
  'prysm': { name: 'Prysm', location: 'Chicago, USA', aliases: ['prysm nightclub'] },
  'radius': { name: 'Radius Chicago', location: 'Chicago, USA', aliases: ['radius'] },

  // Radio Shows / Event Series
  'house calls': { name: 'House Calls', location: 'Chicago, USA', aliases: ['housecalls'] },
  'obskur': { name: 'Obskür', location: 'Various', aliases: ['obskür', 'obskur music'] },

  // Miami
  'space miami': { name: 'Club Space', location: 'Miami, USA', aliases: ['club space', 'space'] },
  'e11even': { name: 'E11EVEN', location: 'Miami, USA', aliases: ['eleven', 'e11even miami'] },

  // LA
  'exchange la': { name: 'Exchange LA', location: 'Los Angeles, USA', aliases: ['exchange'] },
  'sound nightclub': { name: 'Sound Nightclub', location: 'Los Angeles, USA', aliases: ['sound la'] },

  // Amsterdam
  'de school': { name: 'De School', location: 'Amsterdam, Netherlands', aliases: [] },
  'shelter': { name: 'Shelter', location: 'Amsterdam, Netherlands', aliases: ['shelter amsterdam'] },

  // Festivals
  'tomorrowland': { name: 'Tomorrowland', location: 'Belgium', aliases: ['tomorrowland belgium'] },
  'coachella': { name: 'Coachella', location: 'California, USA', aliases: ['coachella festival'] },
  'awakenings': { name: 'Awakenings', location: 'Amsterdam, Netherlands', aliases: ['awakenings festival'] },
  'time warp': { name: 'Time Warp', location: 'Germany', aliases: ['timewarp'] },
  'movement': { name: 'Movement', location: 'Detroit, USA', aliases: ['movement detroit', 'demf'] },
  'ultra': { name: 'Ultra Music Festival', location: 'Miami, USA', aliases: ['ultra miami', 'umf'] },
  'edc': { name: 'EDC', location: 'Las Vegas, USA', aliases: ['electric daisy carnival', 'edc vegas', 'edc las vegas'] },
  'creamfields': { name: 'Creamfields', location: 'UK', aliases: ['creamfields uk'] },
  'mysteryland': { name: 'Mysteryland', location: 'Netherlands', aliases: [] },
  'sonar': { name: 'Sónar', location: 'Barcelona, Spain', aliases: ['sonar barcelona', 'sonar festival'] },
  'bpm festival': { name: 'BPM Festival', location: 'Various', aliases: ['bpm'] },
  'burning man': { name: 'Burning Man', location: 'Nevada, USA', aliases: ['burningman', 'playa', 'black rock city', 'robot heart', 'mayan warrior', 'camp question mark'] },
  'lollapalooza': { name: 'Lollapalooza', location: 'Chicago, USA', aliases: ['lolla', 'lollapalooza chicago', 'perry stage', 'perrys stage'] },
  'electric forest': { name: 'Electric Forest', location: 'Michigan, USA', aliases: ['e forest'] },
  'lightning in a bottle': { name: 'Lightning in a Bottle', location: 'California, USA', aliases: ['lib', 'lightning bottle'] },
  'outsidelands': { name: 'Outside Lands', location: 'San Francisco, USA', aliases: ['outside lands', 'osl'] },
  'holy ship': { name: 'Holy Ship!', location: 'Cruise', aliases: ['holyship'] },
  'shambhala': { name: 'Shambhala', location: 'British Columbia, Canada', aliases: [] },
  'day zero': { name: 'Day Zero', location: 'Tulum, Mexico', aliases: ['dayzero'] },
  'zamna': { name: 'Zamna', location: 'Tulum, Mexico', aliases: ['zamna tulum'] },

  // Radio/Online
  'bbc radio 1': { name: 'BBC Radio 1', location: 'UK', aliases: ['radio 1', 'bbc r1', 'radio one'] },
  'essential mix': { name: 'Essential Mix', location: 'BBC Radio 1', aliases: [] },
  'boiler room': { name: 'Boiler Room', location: 'Various', aliases: ['br'] },
  'cercle': { name: 'Cercle', location: 'Various', aliases: [] },
  'resident advisor': { name: 'Resident Advisor', location: 'Various', aliases: ['ra'] },

  // Events/Brands
  'circoloco': { name: 'Circoloco', location: 'Various', aliases: ['circo loco'] },
  'defected': { name: 'Defected', location: 'Various', aliases: ['defected records'] },
  'drumcode': { name: 'Drumcode', location: 'Various', aliases: ['drum code'] },
  'afterlife': { name: 'Afterlife', location: 'Various', aliases: [] },
  'ants': { name: 'ANTS', location: 'Ushuaïa Ibiza', aliases: ['ants ibiza'] },
  'resistance': { name: 'Resistance', location: 'Various', aliases: ['ultra resistance'] },
  'elrow': { name: 'elrow', location: 'Various', aliases: ['el row'] },

  // NYC Event Series
  'raw cuts': { name: 'Raw Cuts', location: 'New York, USA', aliases: ['rawcuts', 'raw cuts nyc'] },
  'teksupport': { name: 'Teksupport', location: 'New York, USA', aliases: ['tek support', 'teksupport nyc'] },
  'cityfox': { name: 'Cityfox', location: 'New York, USA', aliases: ['the cityfox', 'cityfox experience'] },
  'mister saturday night': { name: 'Mister Saturday Night', location: 'New York, USA', aliases: ['mister sunday'] },
  'good room': { name: 'Good Room', location: 'Brooklyn, USA', aliases: ['goodroom'] },
  'elsewhere': { name: 'Elsewhere', location: 'Brooklyn, USA', aliases: ['elsewhere brooklyn'] },
  'knockdown center': { name: 'Knockdown Center', location: 'Queens, USA', aliases: ['knockdown'] },
  'the lot radio': { name: 'The Lot Radio', location: 'Brooklyn, USA', aliases: ['lot radio'] },

  // LA Event Series
  'sound': { name: 'Sound Nightclub', location: 'Los Angeles, USA', aliases: ['sound la', 'sound nightclub la'] },
  'factory 93': { name: 'Factory 93', location: 'Los Angeles, USA', aliases: ['factory93'] },
  'incognito': { name: 'Incognito', location: 'Los Angeles, USA', aliases: ['incognito la'] },

  // Chicago Event Series
  'smartbar': { name: 'Smartbar', location: 'Chicago, USA', aliases: ['smart bar'] },
  'primary': { name: 'Primary', location: 'Chicago, USA', aliases: ['primary chicago'] },

  // Miami Event Series
  'club space': { name: 'Club Space', location: 'Miami, USA', aliases: ['space miami', 'space terrace'] },
  'do not sit': { name: 'Do Not Sit On The Furniture', location: 'Miami, USA', aliases: ['do not sit on the furniture', 'dnsotf'] },
  'treehouse': { name: 'Treehouse Miami', location: 'Miami, USA', aliases: ['treehouse miami'] },

  // UK Event Series
  'fuse': { name: 'FUSE', location: 'London, UK', aliases: ['fuse london'] },
  'e1': { name: 'E1 London', location: 'London, UK', aliases: ['e1 london', 'studio spaces'] },
  'xoyo': { name: 'XOYO', location: 'London, UK', aliases: ['xoyo london'] },

  // Label Parties
  'music on': { name: 'Music On', location: 'Ibiza, Spain', aliases: ['musicon', 'marco carola music on'] },
  'paradise': { name: 'Paradise', location: 'Ibiza, Spain', aliases: ['paradise ibiza', 'jamie jones paradise'] },
  'solid grooves': { name: 'Solid Grooves', location: 'Ibiza, Spain', aliases: ['solidgrooves'] },
  'keinemusik': { name: 'Keinemusik', location: 'Various', aliases: ['keine musik', '&me'] },
  'tale of us': { name: 'Tale Of Us', location: 'Various', aliases: ['afterlife'] },
  'hyte': { name: 'HYTE', location: 'Various', aliases: ['hyte ibiza', 'hyte berlin'] },
  'toolroom': { name: 'Toolroom', location: 'UK', aliases: ['toolroom records'] },
  'dirtybird': { name: 'Dirtybird', location: 'Various', aliases: ['dirty bird', 'dirtybird campout'] },
  'hot creations': { name: 'Hot Creations', location: 'Various', aliases: ['hotcreations'] },
};

// Countries and states to strip from set names
const COUNTRIES_AND_STATES = [
  'usa', 'united states', 'uk', 'united kingdom', 'spain', 'germany', 'netherlands',
  'belgium', 'france', 'italy', 'portugal', 'croatia', 'mexico', 'brazil', 'australia',
  'japan', 'china', 'canada', 'argentina', 'colombia', 'chile', 'peru',
  'california', 'new york', 'florida', 'texas', 'nevada', 'colorado', 'arizona',
  'illinois', 'michigan', 'georgia', 'massachusetts', 'washington', 'oregon'
];

/**
 * Normalize venue name to canonical form
 */
function normalizeVenue(venueName) {
  if (!venueName) return null;

  const lower = venueName.toLowerCase().trim();

  // Check exact matches and aliases
  for (const [key, data] of Object.entries(VENUE_DATABASE)) {
    if (lower === key || lower.includes(key)) {
      return { venue: data.name, location: data.location };
    }
    for (const alias of data.aliases) {
      if (lower === alias || lower.includes(alias)) {
        return { venue: data.name, location: data.location };
      }
    }
  }

  // Return original if no match, cleaned up
  return { venue: venueName.trim(), location: null };
}

/**
 * Enhanced parsing to extract artist, event name, venue, and location from title
 * Handles formats like:
 * - "John Summit @ BBC Radio 1 Presents ANTS Metalworks, Ushuaïa Ibiza"
 * - "Chris Stussy @ Hudson River Boat Party, New York for Teksupport"
 * - "Amelie Lens | Awakenings Festival 2024"
 * - "Fisher - Live at Tomorrowland 2024"
 */
function parseSetInfo(title) {
  const result = {
    name: title,
    artist: 'Unknown Artist',
    venue: null,
    location: null,
  };

  const lowerTitle = title.toLowerCase();

  // Step 1: Extract artist (before @ | - or "at"/"live at")
  const artistPatterns = [
    /^(.+?)\s*[@]\s*(.+)$/i,
    /^(.+?)\s*[|]\s*(.+)$/i,
    /^(.+?)\s*[-–—]\s*(?:live\s+)?(?:at\s+)?(.+)$/i,
    /^(.+?)\s+live\s+(?:at\s+)?(.+)$/i,
    /^(.+?)\s+at\s+(.+)$/i,
  ];

  let artistPart = null;
  let restPart = title;

  for (const pattern of artistPatterns) {
    const match = title.match(pattern);
    if (match) {
      artistPart = match[1].trim();
      restPart = match[2].trim();
      break;
    }
  }

  if (artistPart) {
    result.artist = artistPart;
  }

  // Step 2: Check for known venues in the VENUE_DATABASE
  for (const [key, data] of Object.entries(VENUE_DATABASE)) {
    const allTerms = [key, ...data.aliases];
    for (const term of allTerms) {
      if (lowerTitle.includes(term)) {
        result.venue = data.name;
        result.location = data.location;
        break;
      }
    }
    if (result.venue) break;
  }

  // Step 3: Check for "for [event organizer]" pattern (e.g., "for Teksupport")
  const forMatch = restPart.match(/^(.+?)\s+for\s+(.+)$/i);
  let eventOrganizer = null;
  if (forMatch) {
    restPart = forMatch[1].trim();
    eventOrganizer = forMatch[2].trim();
  }

  // Step 4: Parse comma-separated parts for venue/location
  const commaParts = restPart.split(/[,]/);

  if (commaParts.length >= 2) {
    const lastPart = commaParts[commaParts.length - 1].trim();
    const lastPartLower = lastPart.toLowerCase();

    // Check if last part is a country/state (should go to location, not name)
    const isCountryOrState = COUNTRIES_AND_STATES.some(cs =>
      lastPartLower === cs || lastPartLower.includes(cs)
    );

    if (isCountryOrState) {
      // This should be the location
      if (!result.location) {
        result.location = lastPart;
      }

      // Check if second-to-last is the venue
      if (commaParts.length > 2) {
        const secondLastPart = commaParts[commaParts.length - 2].trim();
        const normalized = normalizeVenue(secondLastPart);
        if (!result.venue) {
          result.venue = normalized.venue;
        }
        result.name = commaParts.slice(0, -2).join(', ').trim();
      } else {
        result.name = commaParts.slice(0, -1).join(', ').trim();
      }
    } else {
      // Last part might be a city/venue
      const normalized = normalizeVenue(lastPart);
      if (!result.venue && normalized.venue) {
        result.venue = normalized.venue;
        if (normalized.location && !result.location) {
          result.location = normalized.location;
        }
      }
      result.name = commaParts.slice(0, -1).join(', ').trim();
    }
  }

  // Step 5: If no name extracted yet, build from restPart
  if (!result.name || result.name === title) {
    if (artistPart && restPart) {
      let eventName = restPart;

      // Remove venue and location from name if they appear
      if (result.venue) {
        eventName = eventName.replace(new RegExp(result.venue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
      }
      if (result.location) {
        eventName = eventName.replace(new RegExp(result.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
      }

      // Remove country/state names from the event name
      for (const cs of COUNTRIES_AND_STATES) {
        eventName = eventName.replace(new RegExp(`\\b${cs}\\b`, 'gi'), '');
      }

      // Clean up
      eventName = eventName
        .replace(/^[,\s@|\\-–—]+|[,\s@|\\-–—]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (eventName && eventName.length > 2) {
        result.name = eventName;
      } else if (result.venue) {
        // Use venue as the name if nothing else
        result.name = result.venue;
      } else {
        result.name = restPart;
      }
    }
  }

  // Step 6: If name still equals full title and we have artist, clean it up
  if (result.name === title && result.artist !== 'Unknown Artist') {
    result.name = title.replace(new RegExp(`^${result.artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[@|\\-–—]\\s*`, 'i'), '').trim();
  }

  // Step 7: Include event organizer in name if found
  if (eventOrganizer && !result.name.toLowerCase().includes(eventOrganizer.toLowerCase())) {
    result.name = `${result.name} for ${eventOrganizer}`;
  }

  // Step 8: Final cleanup - remove any trailing country/state from name
  for (const cs of COUNTRIES_AND_STATES) {
    result.name = result.name.replace(new RegExp(`[,\\s]+${cs}[,\\s]*$`, 'gi'), '').trim();
  }

  console.log(`[parseSetInfo] "${title}" -> artist: "${result.artist}", name: "${result.name}", venue: "${result.venue}", location: "${result.location}"`);

  return result;
}

/**
 * Parse YouTube video description for venue, location, city, country, and stage info
 * Looks for common patterns in descriptions like:
 * - "Location: Berlin, Germany"
 * - "Venue: Berghain"
 * - "Stage: Main Stage"
 * - "Recorded at Tomorrowland"
 * - "Live from Ushuaïa Ibiza"
 */
function parseDescriptionMetadata(description) {
  if (!description) return {};

  const result = {
    venue: null,
    location: null,
    city: null,
    country: null,
    stage: null,
    eventName: null,
    recordedDate: null,
  };

  const lines = description.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
  const lowerDesc = description.toLowerCase();

  // Pattern 1: Explicit field labels (common in well-formatted descriptions)
  const fieldPatterns = [
    { field: 'venue', patterns: [/(?:venue|club|location)\s*[:|-]\s*(.+?)(?:\n|$)/i] },
    { field: 'city', patterns: [/(?:city)\s*[:|-]\s*(.+?)(?:\n|$)/i] },
    { field: 'country', patterns: [/(?:country)\s*[:|-]\s*(.+?)(?:\n|$)/i] },
    { field: 'stage', patterns: [/(?:stage)\s*[:|-]\s*(.+?)(?:\n|$)/i] },
    { field: 'eventName', patterns: [/(?:event|festival)\s*[:|-]\s*(.+?)(?:\n|$)/i] },
    { field: 'recordedDate', patterns: [/(?:date|recorded|filmed)\s*[:|-]\s*(.+?)(?:\n|$)/i] },
  ];

  for (const { field, patterns } of fieldPatterns) {
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim().replace(/[,\s]+$/, '');
        if (value.length > 1 && value.length < 100) {
          result[field] = value;
          break;
        }
      }
    }
  }

  // Pattern 2: "Location: City, Country" format - split into city and country
  const locationLineMatch = description.match(/(?:location|place|where)\s*[:|-]\s*([^,\n]+),\s*([^\n]+)/i);
  if (locationLineMatch) {
    if (!result.city) result.city = locationLineMatch[1].trim();
    if (!result.country) result.country = locationLineMatch[2].trim();
    if (!result.location) result.location = `${locationLineMatch[1].trim()}, ${locationLineMatch[2].trim()}`;
  }

  // Pattern 3: "Recorded at / Live from / Filmed at" patterns
  const recordedAtPatterns = [
    /(?:recorded|filmed|shot|captured)\s+(?:at|in|@)\s+([^,\n]+(?:,\s*[^,\n]+)?)/i,
    /(?:live\s+from|live\s+at|streaming\s+from)\s+([^,\n]+(?:,\s*[^,\n]+)?)/i,
    /(?:from|at)\s+the\s+([^,\n]+(?:,\s*[^,\n]+)?)/i,
  ];

  for (const pattern of recordedAtPatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Check if it's a known venue
      const normalized = normalizeVenue(extracted);
      if (normalized.venue && !result.venue) {
        result.venue = normalized.venue;
        if (normalized.location && !result.location) {
          result.location = normalized.location;
        }
      } else if (!result.venue && extracted.length > 2 && extracted.length < 80) {
        // Might be a venue or location
        result.venue = extracted;
      }
      break;
    }
  }

  // Pattern 4: Check for known venues from VENUE_DATABASE anywhere in description
  if (!result.venue) {
    for (const [key, data] of Object.entries(VENUE_DATABASE)) {
      const allTerms = [key, ...data.aliases];
      for (const term of allTerms) {
        // Look for venue names with word boundaries (not part of other words)
        const termPattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (termPattern.test(description)) {
          result.venue = data.name;
          if (!result.location && data.location && data.location !== 'Various') {
            result.location = data.location;
          }
          break;
        }
      }
      if (result.venue) break;
    }
  }

  // Pattern 5: Look for common location formats in description
  // "Berlin, Germany", "New York, USA", "Ibiza, Spain" etc.
  const cityCountryPattern = /\b([A-Z][a-zA-Z\s]+),\s*(Germany|Spain|UK|USA|Netherlands|Belgium|France|Italy|Australia|Brazil|Mexico|Portugal|Switzerland|Austria|Poland|Croatia|Greece|Sweden|Japan|Canada|Argentina|Colombia|South Africa|United States|United Kingdom|England|Scotland)\b/g;
  let cityCountryMatch;
  while ((cityCountryMatch = cityCountryPattern.exec(description)) !== null) {
    if (!result.city) result.city = cityCountryMatch[1].trim();
    if (!result.country) result.country = cityCountryMatch[2].trim();
    if (!result.location) result.location = `${cityCountryMatch[1].trim()}, ${cityCountryMatch[2].trim()}`;
    break; // Take first match
  }

  // Pattern 6: Stage information - common in festival sets
  const stagePatterns = [
    /\b(main\s*stage|mainstage)\b/i,
    /\b(arcadia|arcadia\s*spider)\b/i,
    /\b(freedom\s*stage|liberty\s*stage)\b/i,
    /\b(yuma\s*tent|yuma\s*stage|yuma)\b/i,
    /\b(sahara\s*tent|sahara\s*stage|sahara)\b/i,
    /\b(do\s*lab|dolab)\b/i,
    /\b(gobi\s*tent|gobi\s*stage|gobi)\b/i,
    /\b(mojave\s*tent|mojave\s*stage|mojave)\b/i,
    /\b(outdoor\s*stage|outdoor)\b/i,
    /\b(carl\s*cox\s*megastructure|megastructure)\b/i,
    /\b(resistance\s*stage|resistance)\b/i,
    /\b(worldwide\s*stage)\b/i,
    /\b(neon\s*garden)\b/i,
    /\b(circuit\s*grounds)\b/i,
    /\b(kinetic\s*field)\b/i,
    /\b(cosmic\s*meadow)\b/i,
    /\b(bass\s*pod)\b/i,
  ];

  if (!result.stage) {
    for (const pattern of stagePatterns) {
      const match = description.match(pattern);
      if (match) {
        result.stage = match[1].trim();
        break;
      }
    }
  }

  // Pattern 7: Extract event date from description
  const datePatterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,  // DD/MM/YYYY or MM/DD/YYYY
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,  // YYYY/MM/DD
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/i,
  ];

  if (!result.recordedDate) {
    for (const pattern of datePatterns) {
      const match = description.match(pattern);
      if (match) {
        result.recordedDate = match[0];
        break;
      }
    }
  }

  // Pattern 8: City abbreviations and common city names
  // These are often found in set titles like "Raw Cuts NYC Pop Up"
  const cityAbbreviations = {
    'NYC': { city: 'New York', country: 'USA' },
    'NY': { city: 'New York', country: 'USA' },
    'LA': { city: 'Los Angeles', country: 'USA' },
    'SF': { city: 'San Francisco', country: 'USA' },
    'CHI': { city: 'Chicago', country: 'USA' },
    'MIA': { city: 'Miami', country: 'USA' },
    'ATL': { city: 'Atlanta', country: 'USA' },
    'BK': { city: 'Brooklyn', country: 'USA' },
    'LDN': { city: 'London', country: 'UK' },
    'BCN': { city: 'Barcelona', country: 'Spain' },
    'AMS': { city: 'Amsterdam', country: 'Netherlands' },
    'BER': { city: 'Berlin', country: 'Germany' },
    'IBZ': { city: 'Ibiza', country: 'Spain' },
  };

  if (!result.city || !result.country) {
    for (const [abbrev, loc] of Object.entries(cityAbbreviations)) {
      // Look for abbreviation with word boundaries (case insensitive for consistency)
      const abbrevPattern = new RegExp(`\\b${abbrev}\\b`, 'i');
      if (abbrevPattern.test(description)) {
        if (!result.city) result.city = loc.city;
        if (!result.country) result.country = loc.country;
        if (!result.location) result.location = `${loc.city}, ${loc.country}`;
        console.log(`[parseDescriptionMetadata] Found city abbreviation: ${abbrev} -> ${loc.city}, ${loc.country}`);
        break;
      }
    }
  }

  // Pattern 9: Common city names without country
  const knownCities = {
    'New York': 'USA',
    'Brooklyn': 'USA',
    'Queens': 'USA',
    'Manhattan': 'USA',
    'Los Angeles': 'USA',
    'San Francisco': 'USA',
    'Chicago': 'USA',
    'Miami': 'USA',
    'Detroit': 'USA',
    'Las Vegas': 'USA',
    'Denver': 'USA',
    'Austin': 'USA',
    'Seattle': 'USA',
    'Portland': 'USA',
    'Boston': 'USA',
    'Philadelphia': 'USA',
    'Atlanta': 'USA',
    'London': 'UK',
    'Manchester': 'UK',
    'Bristol': 'UK',
    'Glasgow': 'UK',
    'Birmingham': 'UK',
    'Leeds': 'UK',
    'Berlin': 'Germany',
    'Hamburg': 'Germany',
    'Munich': 'Germany',
    'Cologne': 'Germany',
    'Frankfurt': 'Germany',
    'Amsterdam': 'Netherlands',
    'Rotterdam': 'Netherlands',
    'Barcelona': 'Spain',
    'Madrid': 'Spain',
    'Ibiza': 'Spain',
    'Valencia': 'Spain',
    'Paris': 'France',
    'Lyon': 'France',
    'Marseille': 'France',
    'Melbourne': 'Australia',
    'Sydney': 'Australia',
    'Toronto': 'Canada',
    'Montreal': 'Canada',
    'Vancouver': 'Canada',
    'Tokyo': 'Japan',
    'Osaka': 'Japan',
    'São Paulo': 'Brazil',
    'Rio de Janeiro': 'Brazil',
    'Buenos Aires': 'Argentina',
    'Mexico City': 'Mexico',
    'Tulum': 'Mexico',
  };

  if (!result.city || !result.country) {
    for (const [cityName, country] of Object.entries(knownCities)) {
      const cityPattern = new RegExp(`\\b${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (cityPattern.test(description)) {
        if (!result.city) result.city = cityName;
        if (!result.country) result.country = country;
        if (!result.location) result.location = `${cityName}, ${country}`;
        console.log(`[parseDescriptionMetadata] Found city name: ${cityName} -> ${cityName}, ${country}`);
        break;
      }
    }
  }

  // Build full location from city + country if not already set
  if (!result.location && (result.city || result.country)) {
    if (result.city && result.country) {
      result.location = `${result.city}, ${result.country}`;
    } else {
      result.location = result.city || result.country;
    }
  }

  console.log(`[parseDescriptionMetadata] Found: venue="${result.venue}", location="${result.location}", city="${result.city}", country="${result.country}", stage="${result.stage}"`);

  return result;
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
  if (openParens !== closeParens) return null;

  // Reject truncated text
  if (/\([a-zA-Z]{1,3}$/.test(cleaned)) return null;
  if (/^[a-z]/.test(cleaned) && !/^(dj |mc |de |di |da |le |la |el |vs |ft |a |i )/.test(cleaned.toLowerCase())) return null;
  
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

/**
 * Interpolate timestamps for an ordered tracklist using anchor points and total duration.
 *
 * Tracks with timestamp > 0 are "anchors". Tracks with timestamp 0 are interpolated
 * between surrounding anchors. The first implicit anchor is 0:00 and the last is totalDuration.
 *
 * Example: 10 tracks, total duration 3600s, track 3 anchored at 900s, track 7 at 2400s
 *   → tracks 0-2 interpolated between 0 and 900 (0, 300, 600)
 *   → tracks 4-6 interpolated between 900 and 2400 (1275, 1650, 2025)
 *   → tracks 8-9 interpolated between 2400 and 3600 (2800, 3200)
 */
function interpolateTimestamps(orderedTracks, totalDuration) {
  if (!orderedTracks || orderedTracks.length === 0 || !totalDuration || totalDuration <= 0) {
    return orderedTracks;
  }

  // Build list of anchor points: { index, timestamp }
  // Always start with virtual anchor at (index -1, time 0) and end at (index N, time totalDuration)
  const anchors = [{ index: -1, timestamp: 0 }];
  for (let i = 0; i < orderedTracks.length; i++) {
    if (orderedTracks[i].timestamp > 0) {
      anchors.push({ index: i, timestamp: orderedTracks[i].timestamp });
    }
  }
  anchors.push({ index: orderedTracks.length, timestamp: totalDuration });

  // If no real anchors (only virtual start/end), just space everything evenly
  const hasRealAnchors = anchors.length > 2;

  let interpolatedCount = 0;
  // Fill in gaps between consecutive anchors
  for (let a = 0; a < anchors.length - 1; a++) {
    const startAnchor = anchors[a];
    const endAnchor = anchors[a + 1];

    // Tracks in the gap: indices between startAnchor.index and endAnchor.index (exclusive)
    const gapStart = startAnchor.index + 1;
    const gapEnd = endAnchor.index; // exclusive — this is the next anchor
    const gapCount = gapEnd - gapStart;

    if (gapCount <= 0) continue; // No untimed tracks in this gap

    const startTime = startAnchor.timestamp;
    const endTime = endAnchor.timestamp;
    const segmentDuration = endTime - startTime;

    for (let i = 0; i < gapCount; i++) {
      const trackIdx = gapStart + i;
      if (orderedTracks[trackIdx].timestamp > 0) continue; // Already anchored

      // Evenly space within the segment
      // +1 because we divide the gap into (gapCount + 1) intervals if there's an end anchor
      const fraction = (i + 1) / (gapCount + 1);
      const interpolated = Math.floor(startTime + fraction * segmentDuration);

      orderedTracks[trackIdx].timestamp = interpolated;
      orderedTracks[trackIdx].timestampFormatted = formatSecondsToTimestamp(interpolated);
      orderedTracks[trackIdx].isInterpolated = true;
      interpolatedCount++;
    }
  }

  if (interpolatedCount > 0) {
    console.log(`[Interpolate] Placed ${interpolatedCount} timestamps using ${anchors.length - 2} anchor(s) across ${totalDuration}s`);
  }

  return orderedTracks;
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

  // Cross-reference: if description tracks lack timestamps, try to inherit from matching comment tracks
  const untimedScDescTracks = descTracks.filter(t => !t.timestamp || t.timestamp === 0);
  if (untimedScDescTracks.length > 0 && commentTracks.length > 0) {
    console.log(`[SoundCloud Import] Cross-referencing ${untimedScDescTracks.length} untimed description tracks against ${commentTracks.length} comment tracks`);
    let matched = 0;
    for (const dt of untimedScDescTracks) {
      let bestMatch = null;
      let bestSim = 0;
      for (const ct of commentTracks) {
        const sim = calculateTrackSimilarity(dt.title, dt.artist, ct.title, ct.artist);
        if (sim > bestSim && sim >= 0.55) {
          bestSim = sim;
          bestMatch = ct;
        }
      }
      if (bestMatch) {
        dt.timestamp = bestMatch.timestamp;
        dt.timestampFormatted = bestMatch.timestampFormatted;
        dt.confidence = Math.min((dt.confidence || 0.85) + 0.1, 1);
        matched++;
      }
    }
    console.log(`[SoundCloud Import] Cross-reference: ${matched}/${untimedScDescTracks.length} description tracks got timestamps from comments`);
  }

  // Parse artist/title/venue/location
  const setInfo = parseSetInfo(title);
  const finalArtist = setInfo.artist !== 'Unknown Artist' ? setInfo.artist : artistFromPage;
  const finalName = setInfo.name || title;
  const finalVenue = setInfo.venue || null;
  const finalLocation = setInfo.location || null;
  const setId = `sc-${oembedInfo.id}-${Date.now()}`;

  // Separate timestamped and still-untimed tracks for proper dedup
  const scTimedTracks = [...descTracks.filter(t => t.timestamp > 0), ...commentTracks];
  const scStillUntimed = descTracks.filter(t => !t.timestamp || t.timestamp === 0);

  // Deduplicate only the timestamped tracks
  const { tracks: scDedupedTimed, conflicts: samePlatformConflicts } = deduplicateSingleSource(
    scTimedTracks,
    'soundcloud',
    setId,
    finalName
  );

  // Build ordered track list with interpolated timestamps
  const scOrderedTracks = descTracks.map(dt => ({ ...dt }));

  // Add comment-only tracks (not in description)
  const scCommentOnly = scDedupedTimed.filter(ct => {
    return !descTracks.some(dt =>
      calculateTrackSimilarity(ct.title, ct.artist, dt.title, dt.artist) >= 0.55
    );
  });
  for (const ct of scCommentOnly) {
    let insertIdx = scOrderedTracks.length;
    if (ct.timestamp > 0) {
      for (let i = 0; i < scOrderedTracks.length; i++) {
        if (scOrderedTracks[i].timestamp > 0 && scOrderedTracks[i].timestamp > ct.timestamp) {
          insertIdx = i;
          break;
        }
      }
    }
    scOrderedTracks.splice(insertIdx, 0, ct);
  }

  // Interpolate timestamps using anchors + total duration
  if (duration > 0 && scOrderedTracks.length > 0) {
    interpolateTimestamps(scOrderedTracks, duration);
  }

  const tracks = scOrderedTracks;

  const setList = {
    id: setId,
    name: finalName,
    artist: finalArtist,
    venue: finalVenue,
    location: finalLocation,
    date: pageInfo?.createdAt || new Date().toISOString(),
    tracks: tracks.map((pt, i) => ({
      id: `imported-${Date.now()}-${i}`,
      title: pt.title,
      artist: pt.artist,
      duration: pt.duration || 0,
      coverUrl: '',
      addedAt: new Date().toISOString(),
      source: 'ai',
      timestamp: pt.timestamp,
      timestampFormatted: pt.timestampFormatted || formatSecondsToTimestamp(pt.timestamp || 0),
      verified: false,
      contributedBy: pt.sourceAuthor || 'Description',
      hasConflict: pt.hasConflict,
      conflictId: pt.conflictId,
      isUnreleased: pt.isUnreleased || false,
      isInterpolated: pt.isInterpolated || false,
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

  // If all tracks have timestamp 0 and have position fields (non-timestamped tracklist),
  // skip segment-based dedup — each line is a distinct ordered track from the description
  const allZeroTimestamp = tracks.every(t => !t.timestamp || t.timestamp === 0);
  const hasPositions = tracks.some(t => t.position !== undefined);
  if (allZeroTimestamp && hasPositions) {
    console.log(`[deduplicateSingleSource] Non-timestamped tracklist (${tracks.length} tracks) — skipping segment dedup`);
    const sorted = [...tracks].sort((a, b) => (a.position || 0) - (b.position || 0));
    return { tracks: sorted, conflicts: [] };
  }

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

  // Extract DJ/artist name, event name, venue, location from video title
  const setInfo = parseSetInfo(video.title);
  const { name, artist, venue: titleVenue, location: titleLocation } = setInfo;
  const djName = artist !== 'Unknown Artist' ? artist : video.channelTitle;

  // Also parse the description for additional metadata (venue, location, stage, etc.)
  const descMetadata = parseDescriptionMetadata(video.description);
  console.log(`[YouTube Import] Description metadata:`, descMetadata);

  // Use title info first, fall back to description metadata
  const venue = titleVenue || descMetadata.venue || null;
  const location = titleLocation || descMetadata.location || null;
  const stage = descMetadata.stage || null;
  const eventName = descMetadata.eventName || null;

  const descTracks = parseDescription(video.description, djName);
  console.log(`[YouTube Import] Description tracks: ${descTracks.length}`);

  const commentTracks = parseComments(comments, djName);
  console.log(`[YouTube Import] Comment tracks: ${commentTracks.length}`);

  // Log sample of found tracks
  if (commentTracks.length > 0) {
    console.log(`[YouTube Import] Sample comment tracks:`, commentTracks.slice(0, 5).map(t => ({
      timestamp: t.timestampFormatted,
      artist: t.artist,
      title: t.title,
      author: t.sourceAuthor,
    })));
  }

  // Cross-reference: if description tracks lack timestamps, try to inherit from matching comment tracks
  const untimedDescTracks = descTracks.filter(t => !t.timestamp || t.timestamp === 0);
  if (untimedDescTracks.length > 0 && commentTracks.length > 0) {
    console.log(`[YouTube Import] Cross-referencing ${untimedDescTracks.length} untimed description tracks against ${commentTracks.length} comment tracks`);
    let matched = 0;
    for (const dt of untimedDescTracks) {
      let bestMatch = null;
      let bestSim = 0;
      for (const ct of commentTracks) {
        const sim = calculateTrackSimilarity(dt.title, dt.artist, ct.title, ct.artist);
        if (sim > bestSim && sim >= 0.55) {
          bestSim = sim;
          bestMatch = ct;
        }
      }
      if (bestMatch) {
        dt.timestamp = bestMatch.timestamp;
        dt.timestampFormatted = bestMatch.timestampFormatted;
        // Boost confidence since both description and comments agree on this track
        dt.confidence = Math.min((dt.confidence || 0.85) + 0.1, 1);
        matched++;
        console.log(`[YouTube Import] Matched "${dt.artist} - ${dt.title}" → timestamp ${bestMatch.timestampFormatted} (sim: ${bestSim.toFixed(2)})`);
      }
    }
    console.log(`[YouTube Import] Cross-reference: ${matched}/${untimedDescTracks.length} description tracks got timestamps from comments`);
  }

  // Separate timed vs untimed comment tracks — CASE 4 produces untimed ones (timestamp=0)
  // They must NOT go into deduplicateSingleSource which would collapse them all into one segment
  const timedCommentTracks = commentTracks.filter(t => t.timestamp > 0);
  const untimedCommentTracks = commentTracks.filter(t => !t.timestamp || t.timestamp === 0);

  // Separate timestamped and still-untimed tracks for proper dedup
  const timedTracks = [...descTracks.filter(t => t.timestamp > 0), ...timedCommentTracks];
  const stillUntimed = [
    ...descTracks.filter(t => !t.timestamp || t.timestamp === 0),
    ...untimedCommentTracks,
  ];

  console.log(`[YouTube Import] Timed tracks: ${timedTracks.length}, still untimed: ${stillUntimed.length} (${untimedCommentTracks.length} from comment tracklist)`);
  const setId = `yt-${video.id}-${Date.now()}`;

  // Deduplicate only the timestamped tracks (segment-based grouping works correctly for these)
  const { tracks: dedupedTimed, conflicts: samePlatformConflicts } = deduplicateSingleSource(
    timedTracks,
    'youtube',
    setId,
    name
  );

  // For untimed tracks, only keep those that don't already exist in the timed set
  const untimedUnique = stillUntimed.filter(ut => {
    return !dedupedTimed.some(tt =>
      calculateTrackSimilarity(ut.title, ut.artist, tt.title, tt.artist) >= 0.55
    );
  });

  if (untimedUnique.length > 0) {
    console.log(`[YouTube Import] ${untimedUnique.length} untimed unique tracks (${untimedCommentTracks.length > 0 ? 'incl. comment tracklist' : 'from description'})`);
  }

  // Build ordered track list: use description order as canonical order.
  // Insert timed-only comment tracks (no description match) at their timestamp positions.
  const totalDuration = parseDuration(video.duration);

  // Start with description tracks in order (some now have timestamps from cross-ref)
  const orderedTracks = descTracks.map(dt => ({ ...dt }));

  // Add timed comment-only tracks (not in description) — insert at position based on timestamp
  const commentOnlyTracks = dedupedTimed.filter(ct => {
    return !descTracks.some(dt =>
      calculateTrackSimilarity(ct.title, ct.artist, dt.title, dt.artist) >= 0.55
    );
  });
  for (const ct of commentOnlyTracks) {
    // Find insertion point: after the last track with a smaller timestamp
    let insertIdx = orderedTracks.length;
    if (ct.timestamp > 0) {
      for (let i = 0; i < orderedTracks.length; i++) {
        if (orderedTracks[i].timestamp > 0 && orderedTracks[i].timestamp > ct.timestamp) {
          insertIdx = i;
          break;
        }
      }
    }
    orderedTracks.splice(insertIdx, 0, ct);
  }

  // Append untimed comment-only tracks (e.g. full tracklist posted without timestamps)
  // that aren't already represented in orderedTracks — they get interpolated below
  const untimedCommentOnly = untimedUnique.filter(ut =>
    !orderedTracks.some(ot => calculateTrackSimilarity(ut.title, ut.artist, ot.title, ot.artist) >= 0.55)
  );
  if (untimedCommentOnly.length > 0) {
    console.log(`[YouTube Import] Appending ${untimedCommentOnly.length} untimed comment-only tracks for interpolation`);
    orderedTracks.push(...untimedCommentOnly.map(t => ({ ...t })));
  }

  // Interpolate timestamps: use anchored tracks + total duration to fill gaps
  if (totalDuration > 0 && orderedTracks.length > 0) {
    interpolateTimestamps(orderedTracks, totalDuration);
  }

  const tracks = orderedTracks;

  const setList = {
    id: setId,
    name,
    artist: djName,
    venue: venue || null,
    location: location || null,
    stage: stage || null,
    eventName: eventName || null,
    date: video.publishedAt,
    tracks: tracks.map((pt, i) => ({
      id: `imported-${Date.now()}-${i}`,
      title: pt.title,
      artist: pt.artist,
      duration: pt.duration || 0,
      coverUrl: '',
      addedAt: new Date().toISOString(),
      source: 'ai',
      timestamp: pt.timestamp,
      timestampFormatted: pt.timestampFormatted || formatSecondsToTimestamp(pt.timestamp || 0),
      verified: false,
      contributedBy: pt.sourceAuthor,
      hasConflict: pt.hasConflict,
      conflictId: pt.conflictId,
      isUnreleased: pt.isUnreleased || false,
      isInterpolated: pt.isInterpolated || false,
    })),
    coverUrl: video.thumbnailUrl,
    sourceLinks: [{ platform: 'youtube', url }],
    totalDuration,
    aiProcessed: true,
    commentsScraped: comments.length,
    tracksIdentified: tracks.length,
    timedTracksCount: tracks.filter(t => t.timestamp > 0).length,
    untimedTracksCount: tracks.filter(t => !t.timestamp || t.timestamp === 0).length,
    conflicts: samePlatformConflicts,
    plays: 0,
  };

  console.log(`[YouTube Import] Final: ${tracks.length} tracks (${tracks.filter(t => t.timestamp > 0).length} timed, ${tracks.filter(t => !t.timestamp || t.timestamp === 0).length} untimed), ${comments.length} comments scraped`);
  if (tracks.length > 0) {
    console.log(`[YouTube Import] Sample final tracks:`, tracks.slice(0, 5).map(t => ({
      artist: t.artist,
      title: t.title,
      timestamp: t.timestamp,
      tsFormatted: t.timestampFormatted,
    })));
  }

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

// Unreleased indicator patterns — detect tracks flagged as unreleased in comments/descriptions
const UNRELEASED_INDICATORS = [
  /\(unreleased\s*\??\)/i,
  /\(forthcoming\)/i,
  /\(dub\s*\??\)/i,
  /\(dubplate\)/i,
  /\(white\s*label\)/i,
  /\(VIP\)/i,
  /\bunreleased\b/i,
  /\bforthcoming\b/i,
  /\bdubplate\b/i,
  /\bwhite\s*label\b/i,
];

function detectUnreleasedInText(text) {
  if (!text) return false;
  return UNRELEASED_INDICATORS.some(pattern => pattern.test(text));
}

/**
 * Strip unreleased indicator text from a track title so it displays cleanly.
 * Handles both full parenthetical like "(unreleased)" and broken fragments like "(unreleased"
 */
function stripUnreleasedFromTitle(title) {
  if (!title) return title;
  let cleaned = title;
  cleaned = cleaned.replace(/\s*\(?\s*unreleased\s*\??\s*\)?\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(?\s*forthcoming\s*\)?\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(\s*dub\s*\??\s*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(\s*dubplate\s*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(\s*white\s*label\s*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(\s*VIP\s*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\(\s*$/, '').replace(/^\s*\)/, '').trim();
  return cleaned;
}

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
  
  // Cross-field matching: check if artist/title fields got swapped or mixed
  // e.g., Track1: title="Drive (Downriver Dub)", artist="Aaron-Carl"
  //        Track2: title="(downriver dub)", artist="Drive"
  const crossTitleArtist = stringSimilarity(t1.cleaned, a2.normalized);
  const crossArtistTitle = stringSimilarity(a1.normalized, t2.cleaned);
  const crossScore = Math.max(crossTitleArtist, crossArtistTitle);

  // Also check combined strings: join title+artist and compare
  const combined1 = normalizeString(title1 + ' ' + artist1);
  const combined2 = normalizeString(title2 + ' ' + artist2);
  const combinedSim = stringSimilarity(combined1, combined2);

  // Weight: title is more important than artist for matching
  // because users often abbreviate artist names
  let baseScore = titleSim * 0.7 + artistSim * 0.3;

  // If cross-field or combined matching is strong, boost the score
  if (crossScore > 0.7) {
    baseScore = Math.max(baseScore, crossScore * 0.85);
  }
  if (combinedSim > 0.7) {
    baseScore = Math.max(baseScore, combinedSim * 0.9);
  }

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

  /**
   * Extract the primary canonical artist name from a collaboration/featuring string.
   * "Chris Stussy ft Moby" → "Chris Stussy"
   * "Adam Beyer B2B Cirez D" → "Adam Beyer"
   * "Peggy Gou" → "Peggy Gou" (unchanged)
   */
  function extractPrimaryArtist(name) {
    if (!name) return name;
    // Split on featuring/collab separators — take the first (primary) artist
    const parts = name.split(/\s+(?:ft\.?|feat\.?|featuring|b\d+b|vs\.?|x)\s+|\s*&\s*(?!ME\b)/i);
    const primary = (parts[0] || name).trim();
    return primary || name;
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

      // Extract canonical primary artist name (strip featuring/collab suffixes)
      const canonicalName = extractPrimaryArtist(artist.name);
      const slug = generateSlug(canonicalName);

      const { data: existing } = await supabase.from('artists').select('id').eq('slug', slug).single();

      if (existing) {
        // If the original name differs, store it as an alias for future matching
        if (artist.name !== canonicalName) {
          await supabase.from('artist_aliases').upsert({
            artist_id: existing.id,
            alias: artist.name,
            alias_lower: normalizeText(artist.name),
          }, { onConflict: 'alias_lower' });
        }
        results.artistsSkipped++;
        continue;
      }

      const { data: newArtist, error } = await supabase.from('artists').insert({
        name: canonicalName,
        slug,
        genres: artist.genres || [],
        country: artist.country || null,
        beatport_url: artist.beatport_url || null,
        soundcloud_url: artist.soundcloud_url || null,
      }).select('id').single();

      if (error && !error.message.includes('duplicate')) {
        console.error(`Artist error: ${canonicalName}`, error.message);
      }

      // Store original collab name as an alias if it differs
      if (!error && newArtist && artist.name !== canonicalName) {
        await supabase.from('artist_aliases').upsert({
          artist_id: newArtist.id,
          alias: artist.name,
          alias_lower: normalizeText(artist.name),
        }, { onConflict: 'alias_lower' });
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
      
      const { data: newTrack, error } = await supabase.from('tracks').insert({
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
      }).select('id').single();

      if (error && !error.message.includes('duplicate')) {
        console.error(`Track error: ${track.title}`, error.message);
      }
      error ? results.tracksSkipped++ : results.tracksCreated++;

      // Enqueue new track for Spotify validation (fire-and-forget)
      if (!error && newTrack?.id) {
        supabase.rpc('enqueue_track_validation', {
          p_track_id: newTrack.id,
          p_provider: 'spotify',
          p_priority: 50,
        }).catch(() => {});
      }
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

        // Normalize DJ name before inserting
        const normalizedDjName = setInfo.djName
          ? setInfo.djName.trim().replace(/\s{2,}/g, ' ').replace(/\bb2b\b/gi, 'B2B')
          : setInfo.djName;

        // Create the set
        const { data: newSet, error: setError } = await supabase
          .from('sets')
          .insert({
            title: setInfo.title,
            slug: setSlug,
            dj_name: normalizedDjName,
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
            cover_url: data.coverUrl || null,
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
            // Normalize artist and track names for consistency
            let artistName = (track.artist || 'Unknown').trim().replace(/\s{2,}/g, ' ');
            artistName = artistName.replace(/\bb2b\b/gi, 'B2B');
            let trackTitle = (track.title || '').trim().replace(/\s{2,}/g, ' ');

            // Strip unreleased indicators from displayed title
            if (track.is_unreleased || detectUnreleasedInText(trackTitle)) {
              trackTitle = stripUnreleasedFromTitle(trackTitle);
            }

            // Find track ID if it exists
            let trackId = null;
            const titleNormalized = normalizeText(trackTitle);

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
              track_title: trackTitle,
              position: track.position || 0,
              timestamp_seconds: track.timestamp_seconds || null,
              timestamp_str: track.timestamp_str || null,
              is_id: track.is_unreleased || trackTitle?.toLowerCase() === 'id',
              is_unreleased: track.is_unreleased || false,
              unreleased_source: track.is_unreleased ? 'comment_hint' : null,
            });
          }

          console.log(`[Chrome Import] Created set "${setInfo.title}" with ${data.tracks?.length || 0} tracks`);
        }
      } else {
        console.log('[Chrome Import] Set already exists:', tracklistUrl || setSlug);
        results.setId = existingSet.id;

        // Backfill missing tracks and update timestamps (ADDITIVE — never remove)
        if (data.tracks && data.tracks.length > 0) {
          // Get existing set_tracks to compare
          const { data: existingTracks } = await supabase
            .from('set_tracks')
            .select('id, position, track_title, artist_name, timestamp_seconds')
            .eq('set_id', existingSet.id)
            .order('position', { ascending: true });

          const existingPositions = new Set((existingTracks || []).map(t => t.position));
          let tracksUpdated = 0;
          let tracksBackfilled = 0;

          for (const track of data.tracks) {
            const pos = track.position || 0;

            if (existingPositions.has(pos)) {
              // Track exists at this position — only update timestamp if it has one
              if (track.timestamp_seconds && track.timestamp_seconds > 0) {
                const { error: updateError } = await supabase
                  .from('set_tracks')
                  .update({
                    timestamp_seconds: track.timestamp_seconds,
                    timestamp_str: track.timestamp_str,
                  })
                  .eq('set_id', existingSet.id)
                  .eq('position', pos);

                if (!updateError) tracksUpdated++;
              }
            } else {
              // Track missing at this position — backfill it
              let artistName = (track.artist || 'Unknown').trim().replace(/\s{2,}/g, ' ');
              artistName = artistName.replace(/\bb2b\b/gi, 'B2B');
              let trackTitle = (track.title || '').trim().replace(/\s{2,}/g, ' ');

              if (track.is_unreleased || detectUnreleasedInText(trackTitle)) {
                trackTitle = stripUnreleasedFromTitle(trackTitle);
              }

              const { error: insertError } = await supabase
                .from('set_tracks')
                .insert({
                  set_id: existingSet.id,
                  artist_name: artistName,
                  track_title: trackTitle,
                  position: pos,
                  timestamp_seconds: track.timestamp_seconds || null,
                  timestamp_str: track.timestamp_str || null,
                  source: '1001tracklists',
                  is_id: trackTitle?.toLowerCase() === 'id',
                  is_unreleased: track.is_unreleased || false,
                  unreleased_source: track.is_unreleased ? 'comment_hint' : null,
                });

              if (!insertError) tracksBackfilled++;
            }
          }

          // Fix track_count to match actual rows
          if (tracksBackfilled > 0) {
            const { count: actualCount } = await supabase
              .from('set_tracks')
              .select('*', { count: 'exact', head: true })
              .eq('set_id', existingSet.id);
            if (actualCount !== null) {
              await supabase.from('sets').update({ track_count: actualCount }).eq('id', existingSet.id);
            }
          }

          if (tracksUpdated > 0 || tracksBackfilled > 0) {
            console.log(`[Chrome Import] Updated ${tracksUpdated} timestamps, backfilled ${tracksBackfilled} missing tracks`);
            results.tracksUpdated = tracksUpdated;
            results.tracksBackfilled = tracksBackfilled;
          }
        }
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

// ============ FETCH TRACK METADATA ============

/**
 * Fetch metadata for a single track link (for AddTrackModal)
 * Supports: YouTube, SoundCloud, Spotify (basic), Beatport (basic)
 */
async function fetchTrackMetadata(url, apiKey) {
  const platform = detectPlatform(url);
  console.log(`[fetchTrackMetadata] Platform: ${platform}, URL: ${url}`);

  try {
    if (platform === 'youtube') {
      const videoId = extractVideoId(url);
      if (!videoId) throw new Error('Invalid YouTube URL');

      const video = await fetchVideoInfo(videoId, apiKey);

      // Parse artist and title from video title
      const parsed = parseSetInfo(video.title);

      return {
        success: true,
        platform: 'youtube',
        title: parsed.name || video.title,
        artist: parsed.artist !== 'Unknown Artist' ? parsed.artist : video.channelTitle,
        duration: parseDuration(video.duration),
        coverUrl: video.thumbnailUrl,
        channelName: video.channelTitle,
        publishedAt: video.publishedAt,
        description: video.description,
        venue: parsed.venue,
        location: parsed.location,
      };
    }

    if (platform === 'soundcloud') {
      // Try oEmbed first for basic info
      const oembedUrl = `${SOUNDCLOUD_OEMBED}?format=json&url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (response.ok) {
        const data = await response.json();
        // Parse artist from title (usually "Artist - Track Title")
        const titleParts = data.title.split(' - ');
        let artist = data.author_name;
        let title = data.title;

        if (titleParts.length >= 2) {
          artist = titleParts[0].trim();
          title = titleParts.slice(1).join(' - ').trim();
        }

        return {
          success: true,
          platform: 'soundcloud',
          title,
          artist,
          coverUrl: data.thumbnail_url,
          channelName: data.author_name,
        };
      }
    }

    if (platform === 'spotify') {
      // For Spotify, we extract track ID and return basic info
      // Full metadata would require Spotify API auth
      const trackIdMatch = url.match(/track\/([a-zA-Z0-9]+)/);
      if (trackIdMatch) {
        return {
          success: true,
          platform: 'spotify',
          spotifyId: trackIdMatch[1],
          // User will need to manually enter title/artist or we can use Spotify API
          title: '',
          artist: '',
          needsManualEntry: true,
          message: 'Spotify link detected. Please enter track details manually.',
        };
      }
    }

    if (platform === 'beatport') {
      // Extract info from Beatport URL structure
      // URLs like: beatport.com/track/track-name/12345
      const match = url.match(/beatport\.com\/track\/([^/]+)\/(\d+)/);
      if (match) {
        const trackSlug = match[1].replace(/-/g, ' ');
        return {
          success: true,
          platform: 'beatport',
          title: trackSlug.replace(/\b\w/g, l => l.toUpperCase()),
          artist: '',
          beatportId: match[2],
          needsManualEntry: true,
          message: 'Beatport link detected. Please verify track details.',
        };
      }
    }

    // Unsupported platform - return basic info
    return {
      success: true,
      platform,
      title: '',
      artist: '',
      needsManualEntry: true,
      message: `${platform} link detected. Please enter track details manually.`,
    };

  } catch (error) {
    console.error('[fetchTrackMetadata] Error:', error.message);
    return {
      success: false,
      error: error.message,
      platform,
    };
  }
}

// ============ REFRESH SET METADATA ============

/**
 * Re-process a YouTube set to extract better metadata from description
 * Used to update existing sets with venue, location, stage info
 */
async function refreshSetMetadata(youtubeUrl, apiKey) {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error('Invalid YouTube URL');

  const video = await fetchVideoInfo(videoId, apiKey);

  // Parse title for basic info
  const titleInfo = parseSetInfo(video.title);

  // Parse TITLE for city abbreviations and event names (e.g., "Raw Cuts NYC Pop Up")
  const titleMetadata = parseDescriptionMetadata(video.title);
  console.log('[refreshSetMetadata] Title metadata:', titleMetadata);

  // Parse description for additional metadata
  const descMetadata = parseDescriptionMetadata(video.description);
  console.log('[refreshSetMetadata] Description metadata:', descMetadata);

  // Combine - title takes precedence, then title metadata, then description fills gaps
  const metadata = {
    name: titleInfo.name,
    artist: titleInfo.artist !== 'Unknown Artist' ? titleInfo.artist : video.channelTitle,
    venue: titleInfo.venue || titleMetadata.venue || descMetadata.venue,
    location: titleInfo.location || titleMetadata.location || descMetadata.location,
    city: titleMetadata.city || descMetadata.city,
    country: titleMetadata.country || descMetadata.country,
    stage: titleMetadata.stage || descMetadata.stage,
    eventName: titleMetadata.eventName || descMetadata.eventName,
    recordedDate: descMetadata.recordedDate,
    coverUrl: video.thumbnailUrl,
    totalDuration: parseDuration(video.duration),
    publishedAt: video.publishedAt,
  };

  // If we found city/country but no location, build it
  if (!metadata.location && (metadata.city || metadata.country)) {
    if (metadata.city && metadata.country) {
      metadata.location = `${metadata.city}, ${metadata.country}`;
    } else {
      metadata.location = metadata.city || metadata.country;
    }
  }

  console.log('[refreshSetMetadata] Final extracted metadata:', metadata);

  return {
    success: true,
    videoId,
    metadata,
  };
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

  // Rate limit: 10 imports per minute per IP
  if (!rateLimit(req, res, { key: 'import', limit: 10, windowMs: 60_000 })) return;

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
    action: body.action,
    chromeExtension: body.chromeExtension,
    hasUrl: !!body.url,
    hasTracks: !!body.tracks,
    hasArtists: !!body.artists,
    hasSets: !!body.sets,
    setsCount: body.sets?.length,
    source: body.source,
    bodyKeys: Object.keys(body),
  });

  // Handle Chrome Extension import
  if (body.chromeExtension) {
    return handleChromeExtensionImport(req, res, body);
  }

  // Handle action-based requests
  if (body.action) {
    console.log('[Import] Processing action:', body.action);
    const apiKey = process.env.YOUTUBE_API_KEY;

    // Fetch metadata for a single track link (for AddTrackModal)
    if (body.action === 'fetchTrackMetadata') {
      if (!body.url) return res.status(400).json({ error: 'URL is required' });
      try {
        const result = await fetchTrackMetadata(body.url, apiKey);
        return res.status(200).json(result);
      } catch (error) {
        console.error('[fetchTrackMetadata] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
      }
    }

    // Refresh metadata for an existing YouTube set
    if (body.action === 'refreshSetMetadata') {
      if (!body.url) return res.status(400).json({ error: 'YouTube URL is required' });
      if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });
      try {
        const result = await refreshSetMetadata(body.url, apiKey);
        return res.status(200).json(result);
      } catch (error) {
        console.error('[refreshSetMetadata] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
      }
    }

    // Batch refresh metadata for multiple sets
    if (body.action === 'batchRefreshMetadata') {
      console.log('[batchRefreshMetadata] Starting batch refresh for', body.sets?.length, 'sets');
      if (!body.sets || !Array.isArray(body.sets)) {
        console.log('[batchRefreshMetadata] Error: sets array missing or invalid');
        return res.status(400).json({ error: 'sets array is required' });
      }
      if (!apiKey) {
        console.log('[batchRefreshMetadata] Error: No YouTube API key');
        return res.status(500).json({ error: 'YouTube API key not configured' });
      }

      const results = [];
      for (const set of body.sets) {
        // Find YouTube source link
        const ytSource = set.sourceLinks?.find(s => s.platform === 'youtube');
        if (!ytSource) {
          results.push({ setId: set.id, success: false, error: 'No YouTube source' });
          continue;
        }

        try {
          const result = await refreshSetMetadata(ytSource.url, apiKey);
          results.push({
            setId: set.id,
            success: true,
            metadata: result.metadata,
          });
        } catch (error) {
          results.push({ setId: set.id, success: false, error: error.message });
        }
      }

      return res.status(200).json({ success: true, results });
    }

    console.log('[Import] Unknown action:', body.action);
    return res.status(400).json({ error: `Unknown action: ${body.action}` });
  }

  // Fallback: Handle batch refresh if sets array is present (in case action wasn't detected)
  if (body.sets && Array.isArray(body.sets) && body.sets.length > 0) {
    console.log('[Import] Fallback: Detected sets array, treating as batchRefreshMetadata');
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });

    const results = [];
    for (const set of body.sets) {
      const ytSource = set.sourceLinks?.find(s => s.platform === 'youtube');
      if (!ytSource) {
        results.push({ setId: set.id, success: false, error: 'No YouTube source' });
        continue;
      }

      try {
        const result = await refreshSetMetadata(ytSource.url, apiKey);
        results.push({
          setId: set.id,
          success: true,
          metadata: result.metadata,
        });
      } catch (error) {
        results.push({ setId: set.id, success: false, error: error.message });
      }
    }

    return res.status(200).json({ success: true, results });
  }

  // If no action, this is a standard import that requires a URL
  const { url, mergeWith } = body;
  if (!url) {
    console.log('[Import] No URL provided and no action specified. Body keys:', Object.keys(body));
    console.log('[Import] Body action value:', body.action, 'typeof:', typeof body.action);
    return res.status(400).json({ error: 'URL is required' });
  }

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
    // Return appropriate status codes for known error types
    const msg = error.message || 'Import failed';
    if (msg === 'Video not found' || msg.includes('not found')) {
      return res.status(404).json({ success: false, error: 'Video not found — it may have been deleted or made private' });
    }
    if (msg.includes('quotaExceeded') || msg.includes('quota')) {
      return res.status(429).json({ success: false, error: 'YouTube API quota exceeded. Please try again later.' });
    }
    if (msg === 'Invalid YouTube URL' || msg === 'Invalid SoundCloud URL') {
      return res.status(400).json({ success: false, error: msg });
    }
    if (msg.includes('commentsDisabled')) {
      return res.status(200).json({ success: true, setList: { tracks: [] }, error: 'Comments are disabled on this video' });
    }
    return res.status(500).json({ success: false, error: msg });
  }
};
