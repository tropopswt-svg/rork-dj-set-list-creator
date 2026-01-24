// Debug script to see raw YouTube comments and test parsing
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyD_MwrdayiDIhEXkdvvhSCIrDUlz5iQZos';
const VIDEO_URL = process.argv[2] || 'https://youtu.be/IvMPAe3oPn0';

function extractVideoId(url: string): string | null {
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

async function fetchAllComments(videoId: string, maxResults: number = 500) {
  const comments: any[] = [];
  let nextPageToken: string | undefined;

  while (comments.length < maxResults) {
    const pageSize = Math.min(100, maxResults - comments.length);
    let url = `${YOUTUBE_API_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${pageSize}&order=relevance&key=${API_KEY}`;

    if (nextPageToken) {
      url += `&pageToken=${nextPageToken}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      break;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      const comment = item.snippet.topLevelComment.snippet;
      comments.push({
        id: item.id,
        author: comment.authorDisplayName,
        text: comment.textDisplay,
        textOriginal: comment.textOriginal,
        likes: comment.likeCount,
        publishedAt: comment.publishedAt,
      });
    }

    nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
  }

  return comments;
}

async function fetchVideoInfo(videoId: string) {
  const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.items?.[0];
}

// Current parsing logic
function extractTimestamps(text: string) {
  const results: { timestamp: number; formatted: string; position: number }[] = [];

  const longPattern = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;
  let match;
  while ((match = longPattern.exec(text)) !== null) {
    const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    results.push({ timestamp: seconds, formatted: match[0], position: match.index });
  }

  const shortPattern = /\b(\d{1,2}):(\d{2})\b/g;
  while ((match = shortPattern.exec(text)) !== null) {
    const isPartOfLonger = results.some(
      r => match!.index >= r.position && match!.index < r.position + r.formatted.length + 3
    );
    if (!isPartOfLonger) {
      const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      results.push({ timestamp: seconds, formatted: match[0], position: match.index });
    }
  }

  return results.sort((a, b) => a.position - b.position);
}

async function main() {
  const videoId = extractVideoId(VIDEO_URL);
  if (!videoId) {
    console.error('Invalid YouTube URL');
    process.exit(1);
  }

  console.log(`\n=== Fetching video: ${videoId} ===\n`);

  // Get video info
  const video = await fetchVideoInfo(videoId);
  console.log('VIDEO TITLE:', video?.snippet?.title);
  console.log('CHANNEL:', video?.snippet?.channelTitle);
  console.log('\n--- DESCRIPTION ---');
  console.log(video?.snippet?.description?.slice(0, 1000));
  console.log('...\n');

  // Get comments
  console.log('=== Fetching comments ===\n');
  const comments = await fetchAllComments(videoId, 300);
  console.log(`Total comments fetched: ${comments.length}\n`);

  // Analyze comments
  let commentsWithTimestamps = 0;
  let commentsWithTracklists = 0;

  console.log('=== COMMENTS WITH TIMESTAMPS OR TRACK INFO ===\n');

  for (const comment of comments) {
    const timestamps = extractTimestamps(comment.text);
    const hasNewlines = comment.text.includes('\n') || comment.text.includes('<br');
    const looksLikeTracklist = (
      timestamps.length >= 3 ||
      /\d+\.\s/.test(comment.text) ||
      (hasNewlines && timestamps.length >= 1)
    );

    if (timestamps.length > 0) {
      commentsWithTimestamps++;
    }

    if (looksLikeTracklist || timestamps.length >= 2) {
      commentsWithTracklists++;
      console.log('----------------------------------------');
      console.log(`AUTHOR: ${comment.author} | LIKES: ${comment.likes}`);
      console.log(`TIMESTAMPS FOUND: ${timestamps.length}`);
      console.log('RAW TEXT (textDisplay):');
      console.log(comment.text);
      console.log('\nRAW TEXT (textOriginal):');
      console.log(comment.textOriginal);
      console.log('\nPARSED TIMESTAMPS:', timestamps.map(t => t.formatted));
      console.log('----------------------------------------\n');
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total comments: ${comments.length}`);
  console.log(`Comments with timestamps: ${commentsWithTimestamps}`);
  console.log(`Comments that look like tracklists: ${commentsWithTracklists}`);

  // Also show top 5 most liked comments
  console.log('\n=== TOP 5 MOST LIKED COMMENTS ===\n');
  const topComments = [...comments].sort((a, b) => b.likes - a.likes).slice(0, 5);
  for (const comment of topComments) {
    console.log(`[${comment.likes} likes] ${comment.author}:`);
    console.log(comment.text.slice(0, 300));
    console.log('---\n');
  }
}

main().catch(console.error);
