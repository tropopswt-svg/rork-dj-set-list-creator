import * as z from "zod";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { spawnSync } from "child_process";
import { createTRPCRouter, publicProcedure } from "../create-context.js";
import { tmpdir } from "os";

const ScrapedTrack = z.object({
  title: z.string(),
  artist: z.string(),
  timestamp: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.string(),
});

const ScrapedComment = z.object({
  author: z.string(),
  text: z.string(),
  timestamp: z.string().optional(),
  platform: z.string(),
});

const ScrapedSetData = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  thumbnail: z.string().optional(),
  duration: z.string().optional(),
  venue: z.string().optional(),
  date: z.string().optional(),
  platform: z.string(),
  tracks: z.array(ScrapedTrack),
  comments: z.array(ScrapedComment).optional(),
  links: z.object({
    youtube: z.string().optional(),
    soundcloud: z.string().optional(),
    mixcloud: z.string().optional(),
  }),
});

function parseTimestamp(text: string): string | null {
  const patterns = [
    /(\d{1,2}:\d{2}:\d{2})/,
    /(\d{1,2}:\d{2})/,
    /(\d+)\s*(?:min|minute)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[0].includes('min')) {
        const minutes = parseInt(match[1]);
        return `${minutes}:00`;
      }
      return match[1];
    }
  }
  return null;
}

function extractTrackFromComment(comment: string): { artist?: string; title?: string; timestamp?: string } | null {
  const timestamp = parseTimestamp(comment);
  
  const patterns = [
    /(?:track(?:list)?|id|song)[:\s]+([^@\n]+?)(?:\s*[-–]\s*|\s+by\s+)([^@\n]+)/i,
    /([^@\n]+?)\s*[-–]\s*([^@\n]+?)(?:\s+at\s+|\s*@\s*)?\d/i,
    /"([^"]+)"\s*(?:by|-)\s*([^@\n]+)/i,
    /([A-Z][^\-–]+?)\s*[-–]\s*([^@\n]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = comment.match(pattern);
    if (match && match[1] && match[2]) {
      const part1 = match[1].trim();
      const part2 = match[2].trim();
      
      if (part1.length > 2 && part2.length > 2 && part1.length < 100 && part2.length < 100) {
        return {
          artist: part1,
          title: part2,
          timestamp: timestamp || undefined,
        };
      }
    }
  }
  
  return timestamp ? { timestamp } : null;
}

function extractVideoId(url: string): { platform: string; id: string } | null {
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
  if (youtubeMatch) {
    return { platform: "youtube", id: youtubeMatch[1] };
  }

  const soundcloudMatch = url.match(/soundcloud\.com\/([^\/]+)\/([^\/?\s]+)/);
  if (soundcloudMatch) {
    return { platform: "soundcloud", id: `${soundcloudMatch[1]}/${soundcloudMatch[2]}` };
  }

  const mixcloudMatch = url.match(/mixcloud\.com\/([^\/]+)\/([^\/?\s]+)/);
  if (mixcloudMatch) {
    return { platform: "mixcloud", id: `${mixcloudMatch[1]}/${mixcloudMatch[2]}` };
  }

  const tracklistMatch = url.match(/1001tracklists\.com\/tracklist\/([^\s?]+)/);
  if (tracklistMatch) {
    return { platform: "1001tracklists", id: tracklistMatch[1] };
  }

  return null;
}

function isSoundCloudUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?soundcloud\.com\//i.test(url);
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/i.test(url);
}

function getYtDlpConfig(): { type: "binary" | "python"; cmd: string; args?: string[] } {
  const raw = process.env.YT_DLP_PATH?.trim();
  const projectRoot = process.cwd();

  if (raw) {
    // Check if it's a Python module command (e.g., "python3 -m yt_dlp")
    if (raw.includes("python") || raw.includes("yt_dlp") || raw.includes("-m")) {
      // Parse python command (e.g., "python3 -m yt_dlp" or "python3 -m yt_dlp")
      const parts = raw.split(/\s+/);
      const pythonCmd = parts[0] || "python3";
      const moduleIndex = parts.indexOf("-m");
      const module = moduleIndex >= 0 && parts[moduleIndex + 1] 
        ? parts[moduleIndex + 1] 
        : "yt_dlp";
      return { type: "python", cmd: pythonCmd, args: ["-m", module] };
    }
    
    // It's a binary path
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return { type: "binary", cmd: resolved };
      }
    } catch {
      /* ignore */
    }
    return { type: "binary", cmd: path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw) };
  }

  // Try default binary first
  const defaultBin = path.resolve(projectRoot, "bin", "yt-dlp");
  if (fs.existsSync(defaultBin) && fs.statSync(defaultBin).isFile()) {
    return { type: "binary", cmd: defaultBin };
  }
  
  // Fallback to Python module if binary doesn't exist
  return { type: "python", cmd: "python3", args: ["-m", "yt_dlp"] };
}

/**
 * Download an audio segment from YouTube using yt-dlp
 * Returns the path to the downloaded audio file (WAV format for ACRCloud compatibility)
 */
async function downloadYouTubeAudioSegment(
  youtubeUrl: string,
  startSeconds: number,
  durationSeconds: number
): Promise<string | null> {
  const config = getYtDlpConfig();
  const tempDir = tmpdir();
  const outputPath = path.join(tempDir, `acrcloud_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);
  
  // yt-dlp can extract segments using --download-sections or postprocessor args
  // Using --postprocessor-args with ffmpeg to extract segment and convert to WAV
  const ytDlpArgs = [
    "-x", // Extract audio only
    "--audio-format", "wav", // Convert to WAV (ACRCloud compatible)
    "--audio-quality", "0", // Best quality
    "--no-check-certificates",
    "--postprocessor-args", `ffmpeg:-ss ${startSeconds} -t ${durationSeconds}`, // Extract segment
    "-o", outputPath,
    youtubeUrl,
  ];
  
  const cmd = config.cmd;
  const args = config.type === "python" && config.args 
    ? [...config.args, ...ytDlpArgs]
    : ytDlpArgs;
  
  try {
    console.log(`[Scraper] Downloading audio segment: ${startSeconds}s-${startSeconds + durationSeconds}s`);
    console.log(`[Scraper] Running: ${cmd} ${args.join(' ')}`);
    
    const startTime = Date.now();
    const result = spawnSync(cmd, args, {
      encoding: "utf8",
      timeout: 60_000, // 60 second timeout for download
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const elapsed = Date.now() - startTime;
    
    console.log(`[Scraper] Download completed in ${elapsed}ms, exit status: ${result.status}`);
    
    if (result.status !== 0) {
      const errorMsg = result.stderr?.toString() || result.stdout?.toString() || "Unknown error";
      console.error(`[Scraper] yt-dlp download failed: ${errorMsg.substring(0, 500)}`);
      return null;
    }
    
    // Check if file was created
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`[Scraper] ✅ Audio segment downloaded: ${outputPath} (${stats.size} bytes)`);
      return outputPath;
    } else {
      console.error(`[Scraper] ❌ Audio file not found at ${outputPath}`);
      return null;
    }
  } catch (e) {
    console.error(`[Scraper] Exception downloading audio:`, e);
    return null;
  }
}

/**
 * Resolve a YouTube watch URL to a direct stream URL for ACRCloud.
 * Uses yt-dlp: either a yt-dlp binary (brew install yt-dlp) or the yt-dlp-master source
 * (python3 -m yt_dlp). Set YT_DLP_PATH to the binary path, or to the yt-dlp-master directory.
 */
async function resolveYouTubeToStreamUrl(youtubeUrl: string): Promise<string | null> {
  const config = getYtDlpConfig();
  
  // ACRCloud may not support HLS manifests - try to get direct stream URLs
  // Use format selector that prefers non-HLS formats
  const ytDlpArgs = [
    "-g",
    "-f", "worstaudio/worst[height<=480]/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best[ext=m4a]/best[ext=webm]/best",
    "--no-check-certificates",
    youtubeUrl,
  ];
  
  // Build command and args based on type
  const cmd = config.cmd;
  const args = config.type === "python" && config.args 
    ? [...config.args, ...ytDlpArgs]
    : ytDlpArgs;
  
  try {
    console.log(`[Scraper] Running yt-dlp (${config.type}): ${cmd} ${args.join(' ')}`);
    console.log(`[Scraper] Starting yt-dlp execution (timeout: 30s)...`);
    
    // Use spawnSync but ignore stderr (warnings) - only check stdout for the URL
    // This matches the manual test that works
    const startTime = Date.now();
    const result = spawnSync(cmd, args, {
      encoding: "utf8",
      timeout: 30_000,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'], // stdin: ignore, stdout: capture, stderr: capture but ignore warnings
    });
    const elapsed = Date.now() - startTime;
    
    console.log(`[Scraper] yt-dlp completed in ${elapsed}ms`);

    const { status, stdout, stderr } = result;
    console.log(`[Scraper] yt-dlp exit status: ${status}`);
    console.log(`[Scraper] stdout length: ${stdout?.toString().length || 0} bytes`);
    console.log(`[Scraper] stderr length: ${stderr?.toString().length || 0} bytes`);
    
    // Extract URL from stdout first - yt-dlp outputs warnings to stderr, URL to stdout
    // Even if exit code is non-zero, it might still output the URL (semaphore errors are warnings)
    const output = stdout?.toString() || "";
    const lines = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    // Find first line starting with http (the stream URL)
    const streamUrl = lines.find(line => line.startsWith('http')) || lines[lines.length - 1] || "";
    
    // Log stderr for debugging but don't fail on warnings
    if (stderr) {
      const stderrStr = stderr.toString();
      const isSemaphoreError = stderrStr.includes('ERROR] Failed to initialize sync semaphore') || 
                               stderrStr.includes('Failed to initialize sync semaphore');
      
      if (isSemaphoreError) {
        console.warn(`[Scraper] ⚠️  yt-dlp semaphore error (this is usually harmless if URL is extracted)`);
        console.warn(`[Scraper] stderr: ${stderrStr.substring(0, 200)}`);
      } else if (!stderrStr.includes('WARNING:')) {
        console.warn(`[Scraper] yt-dlp stderr: ${stderrStr.substring(0, 500)}`);
      }
    }
    
    // If we found a valid URL, check if it's an HLS manifest
    // ACRCloud may not support HLS manifests, so we should try to get a direct stream
    if (streamUrl && streamUrl.startsWith("http")) {
      // Check if it's an HLS manifest (.m3u8)
      if (streamUrl.includes('.m3u8') || streamUrl.includes('manifest') || streamUrl.includes('hls')) {
        console.warn(`[Scraper] ⚠️  Got HLS manifest URL - ACRCloud may not support this format`);
        console.warn(`[Scraper] Trying to get direct audio stream instead...`);
        
        // Try again with format that excludes HLS
        const directArgs = [
          "-g",
          "-f", "bestaudio[protocol!=m3u8][protocol!=m3u8_native]/bestaudio[ext=m4a]/bestaudio[ext=webm]/best[ext=m4a]/best[ext=webm]",
          "--no-check-certificates",
          youtubeUrl,
        ];
        
        const directResult = spawnSync(cmd, config.type === "python" && config.args 
          ? [...config.args, ...directArgs]
          : directArgs, {
          encoding: "utf8",
          timeout: 30_000,
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        
        const directOutput = directResult.stdout?.toString() || "";
        const directLines = directOutput.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const directStreamUrl = directLines.find(line => line.startsWith('http') && !line.includes('.m3u8') && !line.includes('manifest') && !line.includes('hls'));
        
        if (directStreamUrl && directStreamUrl.startsWith("http")) {
          console.log(`[Scraper] ✅ Got direct audio stream URL (non-HLS)`);
          console.log(`[Scraper] Stream URL: ${directStreamUrl.substring(0, 100)}...`);
          return directStreamUrl;
        } else {
          console.warn(`[Scraper] ⚠️  Could not get direct stream, using HLS manifest (ACRCloud may reject it)`);
        }
      }
      
      console.log(`[Scraper] ✅ yt-dlp successfully extracted stream URL (exit status: ${status})`);
      console.log(`[Scraper] Stream URL: ${streamUrl.substring(0, 100)}...`);
      return streamUrl;
    }
    
    // No URL found - check exit code and log error
    if (status !== 0) {
      const errorMsg = stderr?.toString() || stdout?.toString() || "Unknown error";
      console.error(`[Scraper] ❌ yt-dlp failed with status ${status} and no URL extracted:`);
      console.error(`[Scraper] stderr: ${errorMsg.slice(0, 1000)}`);
      console.error(`[Scraper] stdout: ${stdout?.toString().slice(0, 500) || 'none'}`);
      return null;
    }
    
    // Exit code is 0 but no URL found
    console.error(`[Scraper] ❌ yt-dlp completed but did not return a valid stream URL`);
    console.error(`[Scraper] stdout lines: ${lines.length}, content: ${output.substring(0, 500)}`);
    if (stderr) {
      console.error(`[Scraper] stderr: ${stderr.toString().substring(0, 500)}`);
    }
    return null;
    console.log(`[Scraper] ✅ yt-dlp successfully extracted stream URL`);
    console.log(`[Scraper] Stream URL: ${streamUrl.substring(0, 100)}...`);
    return streamUrl;
  } catch (e) {
    console.error(`[Scraper] YouTube resolve (yt-dlp) exception:`, e);
    return null;
  }
}

/**
 * Resolve a SoundCloud track/set page URL to a direct stream URL for ACRCloud.
 * Uses SoundCloud Widget API: resolve → transcodings → stream URL.
 * Requires SOUNDCLOUD_CLIENT_ID (create app at https://developers.soundcloud.com/).
 */
async function resolveSoundCloudToStreamUrl(soundcloudUrl: string): Promise<string | null> {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId?.trim()) {
    console.warn("[Scraper] SOUNDCLOUD_CLIENT_ID not set; cannot resolve SoundCloud URLs.");
    return null;
  }

  try {
    const resolveUrl = `https://api-widget.soundcloud.com/resolve?url=${encodeURIComponent(soundcloudUrl)}&format=json&client_id=${clientId}`;
    const resolveRes = await fetch(resolveUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RorkSetList/1.0)",
        Accept: "application/json",
      },
    });
    if (!resolveRes.ok) {
      const errorText = await resolveRes.text();
      console.error(`[Scraper] ❌ SoundCloud resolve failed: ${resolveRes.status}`);
      console.error(`[Scraper] Error response: ${errorText.substring(0, 500)}`);
      if (resolveRes.status === 403) {
        console.error(`[Scraper] 💡 403 Forbidden - Check if SOUNDCLOUD_CLIENT_ID is valid and has proper permissions`);
      }
      return null;
    }

    const data = (await resolveRes.json()) as {
      kind?: string;
      media?: { transcodings?: Array<{ url: string; format?: { protocol?: string } }> };
      track_authorization?: string;
    };

    const transcodings = data.media?.transcodings;
    const trackAuth = data.track_authorization;
    if (!transcodings?.length || !trackAuth) {
      console.warn("[Scraper] SoundCloud resolve: no transcodings or track_authorization");
      return null;
    }

    const progressive = transcodings.find((t) => t.format?.protocol === "progressive");
    const chosen = progressive ?? transcodings[0];
    let streamUrl = chosen.url;
    if (!streamUrl.startsWith("http")) {
      streamUrl = `https://api-v2.soundcloud.com${streamUrl.startsWith("/") ? "" : "/"}${streamUrl}`;
    }
    const withAuth = `${streamUrl}?client_id=${clientId}&track_authorization=${encodeURIComponent(trackAuth)}`;

    const streamRes = await fetch(withAuth, { redirect: "follow" });
    const contentType = streamRes.headers.get("content-type") ?? "";
    let finalUrl: string | null = null;
    if (contentType.includes("application/json")) {
      const json = (await streamRes.json()) as { url?: string };
      finalUrl = json?.url ?? null;
    } else {
      finalUrl = streamRes.url;
    }
    if (!finalUrl) {
      console.warn("[Scraper] SoundCloud stream: no final URL from transcoding request");
      return withAuth;
    }
    if (!/\.m3u8|\.mp3|audio|stream|cloudfront|sndcdn|soundcloud/i.test(finalUrl)) {
      console.warn("[Scraper] SoundCloud stream URL did not look like audio:", finalUrl);
    }
    return finalUrl;
  } catch (e) {
    console.warn("[Scraper] SoundCloud resolve error:", e);
    return null;
  }
}

async function fetchYouTubeComments(videoId: string): Promise<z.infer<typeof ScrapedComment>[]> {
  console.log(`[Scraper] Fetching YouTube comments for: ${videoId}`);
  
  const comments: z.infer<typeof ScrapedComment>[] = [];
  
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      console.log(`[Scraper] Fetched YouTube page, length: ${html.length}`);
      
      const ytInitialData = html.match(/var ytInitialData = (\{.*?\});/s);
      if (ytInitialData) {
        try {
          const data = JSON.parse(ytInitialData[1]);
          
          const findComments = (obj: unknown): void => {
            if (!obj || typeof obj !== 'object') return;
            
            if (Array.isArray(obj)) {
              for (const item of obj) {
                findComments(item);
              }
              return;
            }
            
            const record = obj as Record<string, unknown>;
            
            if (record.commentRenderer) {
              const renderer = record.commentRenderer as Record<string, unknown>;
              const contentText = renderer.contentText as Record<string, unknown>;
              const authorText = renderer.authorText as Record<string, unknown>;
              
              const text = (contentText?.runs as { text: string }[])?.map(r => r.text).join('') || '';
              const author = (authorText?.simpleText as string) || 'Unknown';
              
              if (text) {
                const timestamp = parseTimestamp(text);
                comments.push({
                  author,
                  text,
                  timestamp: timestamp || undefined,
                  platform: 'youtube',
                });
              }
            }
            
            for (const value of Object.values(record)) {
              findComments(value);
            }
          };
          
          findComments(data);
        } catch (parseError) {
          console.error(`[Scraper] Error parsing YouTube data:`, parseError);
        }
      }
      
      const descriptionMatch = html.match(/"description":\{"simpleText":"([^"]+)"\}/);
      if (descriptionMatch) {
        const description = descriptionMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\u0026/g, '&');
        
        console.log(`[Scraper] Found video description, checking for tracklist`);
        
        const lines = description.split('\n');
        for (const line of lines) {
          const timestamp = parseTimestamp(line);
          if (timestamp) {
            comments.push({
              author: 'Video Description',
              text: line,
              timestamp,
              platform: 'youtube',
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`[Scraper] YouTube comments error:`, error);
  }
  
  console.log(`[Scraper] Found ${comments.length} YouTube comments/description entries`);
  return comments;
}

async function fetchYouTubeData(videoId: string): Promise<z.infer<typeof ScrapedSetData>> {
  console.log(`[Scraper] Fetching YouTube data for: ${videoId}`);
  
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let comments: z.infer<typeof ScrapedComment>[] = [];
  let tracks: z.infer<typeof ScrapedTrack>[] = [];
  let title = "Unknown Set";
  let artist = "Unknown Artist";
  let thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  let duration: string | undefined;
  
  try {
    // Try to fetch comments (don't fail if this doesn't work)
    try {
      comments = await fetchYouTubeComments(videoId);
      tracks = extractTracksFromComments(comments);
    } catch (commentError) {
      console.warn(`[Scraper] Failed to fetch YouTube comments, continuing:`, commentError);
    }
    
    // Try to fetch metadata via oEmbed
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${youtubeUrl}&format=json`;
      const response = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[Scraper] YouTube oEmbed data:`, data);
        
        const titleParts = data.title?.split(' - ') || [];
        artist = data.author_name || titleParts[0] || 'Unknown Artist';
        title = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : data.title || 'Unknown Set';
        thumbnail = data.thumbnail_url || thumbnail;
      } else {
        console.warn(`[Scraper] YouTube oEmbed returned ${response.status}, using defaults`);
      }
    } catch (oembedError) {
      console.warn(`[Scraper] YouTube oEmbed failed, using defaults:`, oembedError);
    }
    
    // Try to fetch duration from the YouTube page
    try {
      const pageResponse = await fetch(youtubeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });
      
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        
        // Try to extract duration from page data - look for "lengthSeconds":"X"
        const lengthMatch = html.match(/"lengthSeconds"\s*:\s*"?(\d+)"?/);
        if (lengthMatch) {
          const seconds = parseInt(lengthMatch[1], 10);
          if (seconds > 0) {
            duration = seconds.toString();
            console.log(`[Scraper] Found YouTube duration: ${seconds} seconds`);
          }
        }
        
        // Also try approxDurationMs as fallback
        if (!duration) {
          const approxMatch = html.match(/"approxDurationMs"\s*:\s*"?(\d+)"?/);
          if (approxMatch) {
            const seconds = Math.floor(parseInt(approxMatch[1], 10) / 1000);
            if (seconds > 0) {
              duration = seconds.toString();
              console.log(`[Scraper] Found YouTube duration from approxDurationMs: ${seconds} seconds`);
            }
          }
        }
      }
    } catch (pageError) {
      console.warn(`[Scraper] Failed to fetch YouTube page for duration:`, pageError);
    }
  } catch (error) {
    console.error(`[Scraper] YouTube fetch error:`, error);
    // Continue with defaults
  }

  return {
    title,
    artist,
    thumbnail,
    duration,
    platform: "youtube",
    tracks,
    comments,
    links: {
      youtube: youtubeUrl,
    },
  };
}

async function fetchSoundCloudComments(trackUrl: string): Promise<z.infer<typeof ScrapedComment>[]> {
  console.log(`[Scraper] Fetching SoundCloud comments for: ${trackUrl}`);
  
  const comments: z.infer<typeof ScrapedComment>[] = [];
  
  try {
    const pageResponse = await fetch(trackUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (pageResponse.ok) {
      const html = await pageResponse.text();
      console.log(`[Scraper] Fetched SoundCloud page, length: ${html.length}`);
      
      const hydrationMatch = html.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);/s);
      if (hydrationMatch) {
        try {
          const hydrationData = JSON.parse(hydrationMatch[1]);
          console.log(`[Scraper] Found SoundCloud hydration data`);
          
          for (const item of hydrationData) {
            if (item.hydratable === 'comment' || item.data?.comments) {
              const commentsData = item.data?.comments || item.data;
              if (Array.isArray(commentsData)) {
                for (const c of commentsData) {
                  if (c.body) {
                    const timestamp = c.timestamp ? formatMilliseconds(c.timestamp) : undefined;
                    comments.push({
                      author: c.user?.username || 'Unknown',
                      text: c.body,
                      timestamp,
                      platform: 'soundcloud',
                    });
                  }
                }
              }
            }
          }
        } catch (parseError) {
          console.error(`[Scraper] Error parsing hydration data:`, parseError);
        }
      }
      
      const commentPattern = /<div[^>]*class="[^"]*commentItem[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      const bodyPattern = /<p[^>]*class="[^"]*commentBody[^"]*"[^>]*>([^<]+)<\/p>/i;
      const userPattern = /<a[^>]*class="[^"]*commentUser[^"]*"[^>]*>([^<]+)<\/a>/i;
      
      let match;
      while ((match = commentPattern.exec(html)) !== null) {
        const commentHtml = match[1];
        const bodyMatch = commentHtml.match(bodyPattern);
        const userMatch = commentHtml.match(userPattern);
        
        if (bodyMatch) {
          comments.push({
            author: userMatch?.[1] || 'Unknown',
            text: bodyMatch[1].trim(),
            platform: 'soundcloud',
          });
        }
      }
    }
  } catch (error) {
    console.error(`[Scraper] SoundCloud comments error:`, error);
  }
  
  console.log(`[Scraper] Found ${comments.length} SoundCloud comments`);
  return comments;
}

function formatMilliseconds(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function extractTracksFromComments(comments: z.infer<typeof ScrapedComment>[]): z.infer<typeof ScrapedTrack>[] {
  const tracks: z.infer<typeof ScrapedTrack>[] = [];
  const seen = new Set<string>();
  
  for (const comment of comments) {
    const extracted = extractTrackFromComment(comment.text);
    if (extracted && extracted.artist && extracted.title) {
      const key = `${extracted.artist.toLowerCase()}-${extracted.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push({
          title: extracted.title,
          artist: extracted.artist,
          timestamp: extracted.timestamp || comment.timestamp || '0:00',
          confidence: 'low',
          source: `${comment.platform} comment by ${comment.author}`,
        });
      }
    }
  }
  
  tracks.sort((a, b) => {
    const parseTime = (t: string) => {
      const parts = t.split(':').map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return 0;
    };
    return parseTime(a.timestamp) - parseTime(b.timestamp);
  });
  
  return tracks;
}

async function fetchSoundCloudData(trackPath: string): Promise<z.infer<typeof ScrapedSetData>> {
  console.log(`[Scraper] Fetching SoundCloud data for: ${trackPath}`);
  
  const soundcloudUrl = `https://soundcloud.com/${trackPath}`;
  let comments: z.infer<typeof ScrapedComment>[] = [];
  let tracks: z.infer<typeof ScrapedTrack>[] = [];
  const parts = trackPath.split('/');
  let title = parts[1]?.replace(/-/g, ' ') || "Unknown Set";
  let artist = parts[0]?.replace(/-/g, ' ') || "Unknown Artist";
  let thumbnail: string | undefined;
  let duration: string | undefined;
  
  try {
    // Try to fetch the page to get duration and other metadata
    try {
      const pageResponse = await fetch(soundcloudUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });
      
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        
        // Try to extract from hydration data
        const hydrationMatch = html.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);/s);
        if (hydrationMatch) {
          try {
            const hydrationData = JSON.parse(hydrationMatch[1]);
            for (const item of hydrationData) {
              if (item.hydratable === 'sound' && item.data) {
                // Get duration in milliseconds, convert to seconds
                if (item.data.duration) {
                  const seconds = Math.floor(item.data.duration / 1000);
                  if (seconds > 0) {
                    duration = seconds.toString();
                    console.log(`[Scraper] Found SoundCloud duration: ${seconds} seconds`);
                  }
                }
                // Also get title and artist from hydration
                if (item.data.title) title = item.data.title;
                if (item.data.user?.username) artist = item.data.user.username;
                if (item.data.artwork_url) thumbnail = item.data.artwork_url.replace('-large', '-t500x500');
                break;
              }
            }
          } catch (parseError) {
            console.warn(`[Scraper] Failed to parse SoundCloud hydration data:`, parseError);
          }
        }
      }
    } catch (pageError) {
      console.warn(`[Scraper] Failed to fetch SoundCloud page:`, pageError);
    }
    
    // Try to fetch comments (don't fail if this doesn't work)
    try {
      comments = await fetchSoundCloudComments(soundcloudUrl);
      tracks = extractTracksFromComments(comments);
    } catch (commentError) {
      console.warn(`[Scraper] Failed to fetch SoundCloud comments, continuing:`, commentError);
    }
    
    // Try to fetch metadata via oEmbed (as fallback for title/artist/thumbnail)
    if (!thumbnail || title.includes('-')) {
      try {
        const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(soundcloudUrl)}&format=json`;
        const response = await fetch(oembedUrl, {
          signal: AbortSignal.timeout(10000),
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[Scraper] SoundCloud oEmbed data:`, data);
          
          if (!title || title.includes('-')) title = data.title || title;
          if (!artist || artist.includes('-')) artist = data.author_name || artist;
          if (!thumbnail) thumbnail = data.thumbnail_url;
        } else {
          console.warn(`[Scraper] SoundCloud oEmbed returned ${response.status}, using defaults`);
        }
      } catch (oembedError) {
        console.warn(`[Scraper] SoundCloud oEmbed failed, using defaults:`, oembedError);
      }
    }
  } catch (error) {
    console.error(`[Scraper] SoundCloud fetch error:`, error);
    // Continue with defaults
  }

  return {
    title,
    artist,
    thumbnail,
    duration,
    platform: "soundcloud",
    tracks,
    comments,
    links: {
      soundcloud: soundcloudUrl,
    },
  };
}

async function fetchMixcloudData(trackPath: string): Promise<z.infer<typeof ScrapedSetData>> {
  console.log(`[Scraper] Fetching Mixcloud data for: ${trackPath}`);
  
  const parts = trackPath.split('/');
  let title = parts[1]?.replace(/-/g, ' ') || "Unknown Set";
  let artist = parts[0]?.replace(/-/g, ' ') || "Unknown Artist";
  let thumbnail: string | undefined;
  
  try {
    const oembedUrl = `https://www.mixcloud.com/oembed/?url=https://www.mixcloud.com/${trackPath}/&format=json`;
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[Scraper] Mixcloud oEmbed data:`, data);
      
      title = data.title || title;
      artist = data.author_name || artist;
      thumbnail = data.image;
    } else {
      console.warn(`[Scraper] Mixcloud oEmbed returned ${response.status}, using defaults`);
    }
  } catch (error) {
    console.warn(`[Scraper] Mixcloud oEmbed failed, using defaults:`, error);
  }

  return {
    title,
    artist,
    thumbnail,
    platform: "mixcloud",
    tracks: [],
    links: {
      mixcloud: `https://www.mixcloud.com/${trackPath}/`,
    },
  };
}

async function search1001Tracklists(query: string): Promise<z.infer<typeof ScrapedTrack>[]> {
  console.log(`[Scraper] Searching 1001tracklists for: ${query}`);
  
  const tracks: z.infer<typeof ScrapedTrack>[] = [];
  
  try {
    const searchQuery = encodeURIComponent(query.replace(/[^a-zA-Z0-9\s]/g, '').trim());
    const searchUrl = `https://www.1001tracklists.com/search/result.php?search_selection=0&search_value=${searchQuery}`;
    
    console.log(`[Scraper] Fetching 1001tracklists search: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      console.log(`[Scraper] 1001tracklists response length: ${html.length}`);
      
      const tracklistLinkMatch = html.match(/href="(\/tracklist\/[^"]+)"/i);
      if (tracklistLinkMatch) {
        const tracklistUrl = `https://www.1001tracklists.com${tracklistLinkMatch[1]}`;
        console.log(`[Scraper] Found tracklist page: ${tracklistUrl}`);
        
        const tracklistResponse = await fetch(tracklistUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (tracklistResponse.ok) {
          const tracklistHtml = await tracklistResponse.text();
          
          const trackPattern = /<span[^>]*class="[^"]*trackValue[^"]*"[^>]*>([^<]+)<\/span>/gi;
          const artistPattern = /<span[^>]*class="[^"]*artistValue[^"]*"[^>]*>([^<]+)<\/span>/gi;
          const timePattern = /<span[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/span>/gi;
          
          const trackMatches = tracklistHtml.match(trackPattern) || [];
          const artistMatches = tracklistHtml.match(artistPattern) || [];
          const timeMatches = tracklistHtml.match(timePattern) || [];
          
          const extractValue = (str: string) => str.replace(/<[^>]+>/g, '').trim();
          
          const trackValues = trackMatches.map(extractValue);
          const artistValues = artistMatches.map(extractValue);
          const timeValues = timeMatches.map(extractValue);
          
          for (let i = 0; i < Math.min(trackValues.length, artistValues.length); i++) {
            if (trackValues[i] && artistValues[i]) {
              tracks.push({
                title: trackValues[i],
                artist: artistValues[i],
                timestamp: timeValues[i] || '0:00',
                confidence: 'high',
                source: '1001tracklists',
              });
            }
          }
          
          const jsonLdMatch = tracklistHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
          if (jsonLdMatch && tracks.length === 0) {
            try {
              const jsonLd = JSON.parse(jsonLdMatch[1]);
              if (jsonLd.track && Array.isArray(jsonLd.track)) {
                for (const t of jsonLd.track) {
                  if (t.name) {
                    const parts = t.name.split(' - ');
                    tracks.push({
                      title: parts.length > 1 ? parts.slice(1).join(' - ') : t.name,
                      artist: parts[0] || 'Unknown',
                      timestamp: '0:00',
                      confidence: 'high',
                      source: '1001tracklists',
                    });
                  }
                }
              }
            } catch (e) {
              console.error('[Scraper] Error parsing JSON-LD:', e);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`[Scraper] 1001tracklists error:`, error);
  }
  
  console.log(`[Scraper] Found ${tracks.length} tracks from 1001tracklists`);
  return tracks;
}

interface Fetch1001Result {
  tracks: z.infer<typeof ScrapedTrack>[];
  title?: string;
  artist?: string;
  venue?: string;
  date?: string;
  thumbnail?: string;
  duration?: string;
  links: {
    youtube?: string;
    soundcloud?: string;
    mixcloud?: string;
    spotify?: string;
    appleMusic?: string;
  };
}

function extract1001AudioLinks(html: string): Fetch1001Result['links'] {
  const links: Fetch1001Result['links'] = {};
  
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/gi,
    /data-yt(?:video)?id=["']([a-zA-Z0-9_-]{11})["']/gi,
    /ytVideoId["']?\s*[:=]\s*["']([a-zA-Z0-9_-]{11})["']/gi,
  ];
  
  for (const pattern of youtubePatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      links.youtube = `https://www.youtube.com/watch?v=${match[1]}`;
      console.log(`[Scraper] Found YouTube link: ${links.youtube}`);
      break;
    }
  }
  
  const soundcloudPatterns = [
    /href=["'](https?:\/\/soundcloud\.com\/[^"'\s]+)["']/gi,
    /data-sc-url=["']([^"']+)["']/gi,
    /soundcloud\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/gi,
  ];
  
  for (const pattern of soundcloudPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const scUrl = match[1].startsWith('http') ? match[1] : `https://soundcloud.com/${match[1]}`;
      if (!scUrl.includes('/search') && !scUrl.includes('/explore')) {
        links.soundcloud = scUrl.split('?')[0];
        console.log(`[Scraper] Found SoundCloud link: ${links.soundcloud}`);
        break;
      }
    }
  }
  
  const mixcloudPatterns = [
    /href=["'](https?:\/\/(?:www\.)?mixcloud\.com\/[^"'\s]+)["']/gi,
    /mixcloud\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/gi,
  ];
  
  for (const pattern of mixcloudPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const mcUrl = match[1].startsWith('http') ? match[1] : `https://www.mixcloud.com/${match[1]}`;
      if (!mcUrl.includes('/search') && !mcUrl.includes('/explore')) {
        links.mixcloud = mcUrl.split('?')[0];
        console.log(`[Scraper] Found Mixcloud link: ${links.mixcloud}`);
        break;
      }
    }
  }
  
  const spotifyMatch = html.match(/href=["'](https?:\/\/open\.spotify\.com\/[^"'\s]+)["']/i);
  if (spotifyMatch) {
    links.spotify = spotifyMatch[1].split('?')[0];
    console.log(`[Scraper] Found Spotify link: ${links.spotify}`);
  }
  
  const appleMusicMatch = html.match(/href=["'](https?:\/\/music\.apple\.com\/[^"'\s]+)["']/i);
  if (appleMusicMatch) {
    links.appleMusic = appleMusicMatch[1].split('?')[0];
    console.log(`[Scraper] Found Apple Music link: ${links.appleMusic}`);
  }
  
  const iframePatterns = [
    /<iframe[^>]*src=["']([^"']*youtube[^"']*)["']/gi,
    /<iframe[^>]*src=["']([^"']*soundcloud[^"']*)["']/gi,
    /<iframe[^>]*src=["']([^"']*mixcloud[^"']*)["']/gi,
  ];
  
  for (const pattern of iframePatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      const iframeSrc = match[1];
      if (iframeSrc.includes('youtube') && !links.youtube) {
        const ytMatch = iframeSrc.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
          links.youtube = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
          console.log(`[Scraper] Found YouTube from iframe: ${links.youtube}`);
        }
      } else if (iframeSrc.includes('soundcloud') && !links.soundcloud) {
        const scUrlMatch = iframeSrc.match(/url=([^&]+)/);
        if (scUrlMatch) {
          links.soundcloud = decodeURIComponent(scUrlMatch[1]);
          console.log(`[Scraper] Found SoundCloud from iframe: ${links.soundcloud}`);
        }
      } else if (iframeSrc.includes('mixcloud') && !links.mixcloud) {
        const mcMatch = iframeSrc.match(/feed=([^&]+)/);
        if (mcMatch) {
          links.mixcloud = decodeURIComponent(mcMatch[1]);
          console.log(`[Scraper] Found Mixcloud from iframe: ${links.mixcloud}`);
        }
      }
    }
  }
  
  return links;
}

async function fetch1001TracklistDirect(url: string): Promise<Fetch1001Result> {
  console.log(`[Scraper] Fetching 1001tracklists directly: ${url}`);
  
  const result: Fetch1001Result = {
    tracks: [],
    links: {},
    title: undefined,
    artist: undefined,
    thumbnail: undefined,
    venue: undefined,
    date: undefined,
    duration: undefined,
  };
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });
    
    if (response.ok) {
      const html = await response.text();
      console.log(`[Scraper] 1001tracklists page length: ${html.length}`);
      
      result.links = extract1001AudioLinks(html);
      
      const titleMatch = html.match(/<h1[^>]*id="pageTitle"[^>]*>([^<]+)<\/h1>/i) ||
                         html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                         html.match(/<title>([^<]+)<\/title>/i);
      
      const djPatterns = [
        /<a[^>]*class="[^"]*blue[^"]*"[^>]*href="\/dj\/[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<meta[^>]*name="author"[^>]*content="([^"]+)"/i,
        /<span[^>]*class="[^"]*artistLink[^"]*"[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/dj\/[^"]*"[^>]*title="([^"]+)"/i,
      ];
      
      let djName: string | undefined;
      for (const pattern of djPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          djName = match[1].trim();
          break;
        }
      }
      
      if (titleMatch) {
        result.title = titleMatch[1]
          .replace(/ \| 1001Tracklists$/i, '')
          .replace(/ Tracklist$/i, '')
          .trim();
      }
      result.artist = djName;
      
      const venuePatterns = [
        /@\s*([^,\n<]+)/i,
        /at\s+([^,\n<]+(?:festival|club|room|warehouse|party)?)/i,
        /venue["']?\s*[:=]\s*["']?([^"'<,]+)/i,
      ];
      
      if (result.title) {
        for (const pattern of venuePatterns) {
          const match = result.title.match(pattern);
          if (match && match[1] && match[1].length > 2 && match[1].length < 100) {
            result.venue = match[1].trim();
            break;
          }
        }
      }
      
      const datePatterns = [
        /<time[^>]*datetime="([^"]+)"[^>]*>/i,
        /(\d{4}-\d{2}-\d{2})/,
        /(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/,
      ];
      
      for (const pattern of datePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          result.date = match[1];
          break;
        }
      }
      
      const thumbnailPatterns = [
        /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i,
        /<img[^>]*class="[^"]*mainImage[^"]*"[^>]*src="([^"]+)"/i,
        /<img[^>]*id="[^"]*artwork[^"]*"[^>]*src="([^"]+)"/i,
        /data-artwork-url=["']([^"']+)["']/i,
      ];
      
      for (const pattern of thumbnailPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          result.thumbnail = match[1];
          break;
        }
      }
      
      const durationMatch = html.match(/duration["']?\s*[:=]\s*["']?(\d+:\d{2}(?::\d{2})?)["']?/i) ||
                            html.match(/(\d{1,2}:\d{2}:\d{2})\s*(?:total|length|duration)/i);
      if (durationMatch) {
        result.duration = durationMatch[1];
      }
      
      console.log(`[Scraper] Found set: "${result.title}" by ${result.artist}`);
      console.log(`[Scraper] Audio links found:`, result.links);
      
      const trackRowPattern = /<div[^>]*class="[^"]*tlpItem[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
      const rows = html.match(trackRowPattern) || [];
      
      for (const row of rows) {
        const trackNameMatch = row.match(/<span[^>]*class="[^"]*trackFormat[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const timeMatch = row.match(/<span[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/span>/i);
        
        if (trackNameMatch) {
          const fullTrack = trackNameMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const parts = fullTrack.split(' - ');
          
          if (parts.length >= 2) {
            result.tracks.push({
              title: parts.slice(1).join(' - ').trim(),
              artist: parts[0].trim(),
              timestamp: timeMatch ? timeMatch[1].trim() : '0:00',
              confidence: 'high',
              source: '1001tracklists',
            });
          }
        }
      }
      
      if (result.tracks.length === 0) {
        const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
        if (jsonLdMatch) {
          try {
            const jsonLd = JSON.parse(jsonLdMatch[1]);
            
            if (jsonLd.name && !result.title) {
              result.title = jsonLd.name;
            }
            if (jsonLd.byArtist?.name && !result.artist) {
              result.artist = jsonLd.byArtist.name;
            }
            if (jsonLd.image && !result.thumbnail) {
              result.thumbnail = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
            }
            if (jsonLd.datePublished && !result.date) {
              result.date = jsonLd.datePublished;
            }
            if (jsonLd.duration) {
              const durationParsed = jsonLd.duration.replace(/^PT/, '').replace(/H/, ':').replace(/M/, ':').replace(/S/, '');
              result.duration = durationParsed;
            }
            
            if (jsonLd.track && Array.isArray(jsonLd.track)) {
              for (const t of jsonLd.track) {
                if (t.name) {
                  const parts = t.name.split(' - ');
                  result.tracks.push({
                    title: parts.length > 1 ? parts.slice(1).join(' - ') : t.name,
                    artist: parts[0] || 'Unknown',
                    timestamp: '0:00',
                    confidence: 'high',
                    source: '1001tracklists',
                  });
                }
              }
            }
          } catch (e) {
            console.error('[Scraper] JSON-LD parse error:', e);
          }
        }
      }
      
      if (result.tracks.length === 0) {
        const trackItemPatterns = [
          /<div[^>]*class="[^"]*tlpTog[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
          /<tr[^>]*class="[^"]*tlpItem[^"]*"[^>]*>[\s\S]*?<\/tr>/gi,
        ];
        
        for (const pattern of trackItemPatterns) {
          const items = html.match(pattern) || [];
          for (const item of items) {
            const valueMatch = item.match(/value["']?\s*[:=]\s*["']?([^"'<]+)/i) ||
                               item.match(/>([^<]+\s+-\s+[^<]+)</i);
            if (valueMatch) {
              const parts = valueMatch[1].split(' - ');
              if (parts.length >= 2) {
                result.tracks.push({
                  title: parts.slice(1).join(' - ').trim(),
                  artist: parts[0].trim(),
                  timestamp: '0:00',
                  confidence: 'high',
                  source: '1001tracklists',
                });
              }
            }
          }
          if (result.tracks.length > 0) break;
        }
      }
    }
  } catch (error) {
    console.error('[Scraper] 1001tracklists direct fetch error:', error);
  }
  
  console.log(`[Scraper] Extracted ${result.tracks.length} tracks from 1001tracklists`);
  return result;
}

function extractArtistFromTitle(title: string): { artist: string; cleanTitle: string } {
  const patterns = [
    /^(.+?)\s*[-–@]\s*(.+)$/,
    /^(.+?)\s+(?:live|dj set|set|mix|b2b)\s+(?:at|@|from)\s+(.+)$/i,
    /^(.+?)\s+(?:boiler room|cercle|hör|hor|dekmantel|defected|mixmag)\s*(.*)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const part1 = match[1].trim();
      const part2 = match[2]?.trim() || '';
      
      if (part1.length > 2 && part1.length < 50) {
        return { artist: part1, cleanTitle: title };
      }
    }
  }
  
  return { artist: '', cleanTitle: title };
}

/**
 * Validate that a Spotify track exists by checking the oEmbed API
 */
async function validateSpotifyTrack(trackId: string): Promise<boolean> {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RorkSetList/1.0)',
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    // oEmbed returns track info if it exists
    return !!data && !!data.title;
  } catch (error) {
    console.warn(`[Validation] Spotify track ${trackId} validation failed:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Validate that a YouTube video exists by checking if it's accessible
 */
async function validateYouTubeVideo(videoId: string): Promise<boolean> {
  try {
    // Use YouTube oEmbed API to check if video exists
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RorkSetList/1.0)',
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    // oEmbed returns video info if it exists
    return !!data && !!data.title;
  } catch (error) {
    console.warn(`[Validation] YouTube video ${videoId} validation failed:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/** Internal helper: identify track at a URL+timestamp via ACRCloud. No tab/playback needed. */
async function identifyTrackFromUrlInternal(
  audioUrl: string,
  startSeconds: number = 0,
  durationSeconds: number = 15
): Promise<{
  success: boolean;
  error: string | null;
  result: {
    title: string;
    artist: string;
    album?: string;
    releaseDate?: string;
    label?: string;
    confidence: number;
    duration?: number;
    links: { spotify?: string; youtube?: string; isrc?: string };
  } | null;
}> {
  console.log(`[ACRCloud] ===== IDENTIFICATION TRACE START =====`);
  console.log(`[ACRCloud] Input URL: ${audioUrl}`);
  console.log(`[ACRCloud] Start time: ${startSeconds}s, Duration: ${durationSeconds}s`);
  
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;
  const host = process.env.ACRCLOUD_HOST || "identify-us-west-2.acrcloud.com";

  if (!accessKey || !accessSecret) {
    console.log(`[ACRCloud] ❌ ERROR: ACRCloud credentials not configured`);
    return { success: false, error: "ACRCloud credentials not configured", result: null };
  }

  let urlToIdentify = audioUrl;
  
  if (isSoundCloudUrl(audioUrl)) {
    console.log(`[ACRCloud] Detected SoundCloud URL`);
    if (!process.env.SOUNDCLOUD_CLIENT_ID?.trim()) {
      console.log(`[ACRCloud] ❌ ERROR: SOUNDCLOUD_CLIENT_ID not set`);
      return {
        success: false,
        error:
          "SoundCloud URLs require SOUNDCLOUD_CLIENT_ID. Create an app at https://developers.soundcloud.com/ and add it to your environment.",
        result: null,
      };
    }
    console.log(`[ACRCloud] Resolving SoundCloud URL to stream...`);
    const streamUrl = await resolveSoundCloudToStreamUrl(audioUrl);
    if (!streamUrl) {
      console.log(`[ACRCloud] ❌ ERROR: Could not resolve SoundCloud URL to stream`);
      return {
        success: false,
        error: "Could not resolve SoundCloud URL to a stream. Check the link and SOUNDCLOUD_CLIENT_ID.",
        result: null,
      };
    }
    urlToIdentify = streamUrl;
    console.log(`[ACRCloud] ✅ Resolved SoundCloud stream URL: ${streamUrl.substring(0, 100)}...`);
  } else if (isYouTubeUrl(audioUrl)) {
    console.log(`[ACRCloud] Detected YouTube URL`);
    // ACRCloud may support YouTube watch URLs directly
    // Try using the original YouTube URL first, as videoplayback URLs often return 403
    console.log(`[ACRCloud] Using YouTube watch URL directly (ACRCloud may support it)`);
    urlToIdentify = audioUrl;
    console.log(`[ACRCloud] ✅ Using YouTube URL: ${audioUrl}`);
    
    // Note: If ACRCloud doesn't support direct YouTube URLs, we could fall back to stream URL resolution
    // But videoplayback URLs often return 403, so direct YouTube URL is preferred
  } else {
    console.log(`[ACRCloud] Direct URL (not YouTube/SoundCloud), using as-is`);
  }
  
  console.log(`[ACRCloud] Final URL sent to ACRCloud: ${urlToIdentify.substring(0, 150)}...`);

  // Test if the resolved URL is accessible before sending to ACRCloud
  try {
    console.log(`[ACRCloud] Testing if stream URL is accessible...`);
    const testResponse = await fetch(urlToIdentify, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (!testResponse.ok) {
      console.log(`[ACRCloud] ⚠️  Stream URL returned status ${testResponse.status}, but continuing anyway`);
    } else {
      console.log(`[ACRCloud] ✅ Stream URL is accessible (status ${testResponse.status})`);
    }
  } catch (testError) {
    console.log(`[ACRCloud] ⚠️  Could not verify stream URL accessibility: ${testError instanceof Error ? testError.message : 'Unknown error'}`);
    console.log(`[ACRCloud] Continuing with ACRCloud request anyway...`);
  }

  try {
    const httpMethod = "POST";
    const httpUri = "/v1/identify";
    const dataType = "audio_url"; // Must be "audio_url" for URL identification, not "url"
    const signatureVersion = "1";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = [httpMethod, httpUri, accessKey, dataType, signatureVersion, timestamp].join("\n");
    const signature = crypto.createHmac("sha1", accessSecret).update(stringToSign).digest("base64");

    const formData = new URLSearchParams();
    formData.append("access_key", accessKey);
    formData.append("url", urlToIdentify);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    formData.append("data_type", dataType);
    formData.append("signature_version", signatureVersion);
    
    // Add timestamp parameters if provided (may be optional for audio_url)
    if (startSeconds > 0) {
      formData.append("start_time_seconds", startSeconds.toString());
    }
    if (durationSeconds !== 15) {
      formData.append("rec_length", durationSeconds.toString());
    }

    console.log(`[ACRCloud] Sending request to ACRCloud API...`);
    console.log(`[ACRCloud] Request details:`);
    console.log(`  - Stream URL: ${urlToIdentify.substring(0, 150)}...`);
    console.log(`  - URL type: ${urlToIdentify.includes('.m3u8') || urlToIdentify.includes('manifest') || urlToIdentify.includes('hls') ? 'HLS Manifest (may not be supported)' : 'Direct stream'}`);
    console.log(`  - Start time: ${startSeconds}s (${Math.floor(startSeconds / 60)}:${String(startSeconds % 60).padStart(2, '0')})`);
    console.log(`  - Duration: ${durationSeconds}s`);
    console.log(`  - This will analyze audio from ${startSeconds}s to ${startSeconds + durationSeconds}s`);
    console.log(`[ACRCloud] Request parameters:`);
    console.log(`  - access_key: ${accessKey.substring(0, 10)}...`);
    console.log(`  - url: ${urlToIdentify.substring(0, 100)}...`);
    console.log(`  - start_time_seconds: ${startSeconds} (type: ${typeof startSeconds})`);
    console.log(`  - rec_length: ${durationSeconds} (type: ${typeof durationSeconds})`);
    console.log(`  - data_type: ${dataType}`);
    console.log(`  - signature_version: ${signatureVersion}`);
    
    const response = await fetch(`https://${host}${httpUri}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    
    console.log(`[ACRCloud] ACRCloud response status: ${response.status}`);
    const result = await response.json();
    console.log(`[ACRCloud] ACRCloud full response:`, JSON.stringify(result, null, 2));
    console.log(`[ACRCloud] ACRCloud response code: ${result.status?.code}, message: ${result.status?.msg || 'N/A'}`);
    
    // Log if we get "invalid arguments" error
    if (result.status?.msg?.toLowerCase().includes('invalid arguments') || 
        result.status?.msg?.toLowerCase().includes('invalid argument')) {
      console.error(`[ACRCloud] ⚠️  "Invalid arguments" error detected!`);
      console.error(`[ACRCloud] Full error response:`, JSON.stringify(result, null, 2));
      console.error(`[ACRCloud] Request parameters sent:`);
      console.error(`  - url: ${urlToIdentify.substring(0, 100)}...`);
      console.error(`  - start_time_seconds: ${startSeconds}`);
      console.error(`  - rec_length: ${durationSeconds}`);
      console.error(`  - data_type: ${dataType}`);
    }
    
    if (result.status?.code === 0) {
      if (result.metadata?.music?.length > 0) {
        console.log(`[ACRCloud] ✅ Successfully analyzed audio segment and found match!`);
        console.log(`[ACRCloud] 🎵 ACRCloud listened to audio from ${startSeconds}s to ${startSeconds + durationSeconds}s`);
      } else {
        console.log(`[ACRCloud] ✅ Successfully analyzed audio segment (code 0 but no music data)`);
      }
    } else if (result.status?.code === 1001) {
      console.log(`[ACRCloud] ⚠️  Audio was analyzed (listened to ${startSeconds}s-${startSeconds + durationSeconds}s) but no match found in database`);
      console.log(`[ACRCloud] 💡 This means ACRCloud successfully processed the audio, but the track isn't in their database`);
    } else {
      console.log(`[ACRCloud] ❌ Error analyzing audio: ${result.status?.msg || 'Unknown error'}`);
      console.log(`[ACRCloud] 💡 ACRCloud may not have been able to access or process the audio stream`);
    }

    if (result.status?.code === 0 && result.metadata?.music?.length > 0) {
      const music = result.metadata.music[0];
      const artists = music.artists?.map((a: { name: string }) => a.name).join(", ") || "Unknown Artist";
      const title = music.title || "Unknown Track";
      const externalMetadata = music.external_metadata || {};
      const spotifyId = externalMetadata.spotify?.track?.id;
      const youtubeId = externalMetadata.youtube?.vid;
      
      console.log(`[ACRCloud] ✅ Match found: ${artists} - ${title}`);
      
      // Validate links by checking if they exist via API
      const validatedLinks: { spotify?: string; youtube?: string; isrc?: string } = {};
      
      if (spotifyId) {
        const spotifyUrl = `https://open.spotify.com/track/${spotifyId}`;
        const isValid = await validateSpotifyTrack(spotifyId);
        if (isValid) {
          validatedLinks.spotify = spotifyUrl;
          console.log(`[ACRCloud] ✅ Validated Spotify link: ${spotifyUrl}`);
        } else {
          console.warn(`[ACRCloud] ⚠️  Spotify track ${spotifyId} not found or inaccessible`);
        }
      }
      
      if (youtubeId) {
        const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
        const isValid = await validateYouTubeVideo(youtubeId);
        if (isValid) {
          validatedLinks.youtube = youtubeUrl;
          console.log(`[ACRCloud] ✅ Validated YouTube link: ${youtubeUrl}`);
        } else {
          console.warn(`[ACRCloud] ⚠️  YouTube video ${youtubeId} not found or inaccessible`);
        }
      }
      
      if (music.external_ids?.isrc) {
        validatedLinks.isrc = music.external_ids.isrc;
      }
      
      console.log(`[ACRCloud] ===== IDENTIFICATION TRACE END (SUCCESS) =====`);
      return {
        success: true,
        error: null,
        result: {
          title,
          artist: artists,
          album: music.album?.name,
          releaseDate: music.release_date,
          label: music.label,
          confidence: music.score ?? 100,
          duration: music.duration_ms ? Math.floor(music.duration_ms / 1000) : undefined,
          links: validatedLinks,
        },
      };
    }
    if (result.status?.code === 1001) {
      console.log(`[ACRCloud] ⚠️  No match found (code 1001)`);
      console.log(`[ACRCloud] ===== IDENTIFICATION TRACE END (NO MATCH) =====`);
      return { success: true, error: null, result: null };
    }
    console.log(`[ACRCloud] ❌ ACRCloud error: ${result.status?.msg ?? "Unknown error"}`);
    console.log(`[ACRCloud] ===== IDENTIFICATION TRACE END (ERROR) =====`);
    return {
      success: false,
      error: result.status?.msg ?? "Unknown error from ACRCloud",
      result: null,
    };
  } catch (e) {
    console.log(`[ACRCloud] ❌ Exception: ${e instanceof Error ? e.message : "Unknown error"}`);
    console.log(`[ACRCloud] ===== IDENTIFICATION TRACE END (EXCEPTION) =====`);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to identify track",
      result: null,
    };
  }
}

export const scraperRouter = createTRPCRouter({
  scrapeUrl: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      console.log(`[Scraper] Starting scrape for URL: ${input.url}`);
      
      const extracted = extractVideoId(input.url);
      
      if (!extracted) {
        console.log(`[Scraper] Could not extract video ID from URL`);
        return {
          success: false,
          error: "Unsupported URL format. Please use YouTube or SoundCloud links.",
          data: null,
        };
      }

      console.log(`[Scraper] Extracted platform: ${extracted.platform}, ID: ${extracted.id}`);

      let setData: z.infer<typeof ScrapedSetData>;

      try {
        switch (extracted.platform) {
          case "youtube":
            setData = await fetchYouTubeData(extracted.id);
            break;
          case "soundcloud":
            setData = await fetchSoundCloudData(extracted.id);
            break;
          case "mixcloud":
            setData = await fetchMixcloudData(extracted.id);
            break;
          case "1001tracklists":
            const result1001 = await fetch1001TracklistDirect(input.url);
            setData = {
              title: result1001.title || "Set from 1001tracklists",
              artist: result1001.artist || "Unknown Artist",
              thumbnail: result1001.thumbnail,
              venue: result1001.venue,
              date: result1001.date,
              duration: result1001.duration,
              platform: "1001tracklists",
              tracks: result1001.tracks,
              links: {
                youtube: result1001.links.youtube,
                soundcloud: result1001.links.soundcloud,
                mixcloud: result1001.links.mixcloud,
              },
            };
            break;
          default:
            return {
              success: false,
              error: "Unsupported platform",
              data: null,
            };
        }

        // Try to enhance with 1001tracklists data, but don't fail if it doesn't work
        if (setData.title && setData.artist) {
          try {
            const tracksFrom1001 = await search1001Tracklists(`${setData.artist} ${setData.title}`);
            setData.tracks = [...setData.tracks, ...tracksFrom1001];
          } catch (err) {
            console.warn(`[Scraper] Failed to search 1001tracklists, continuing with existing tracks:`, err);
          }
        }

        console.log(`[Scraper] Final scraped data:`, setData);

        return {
          success: true,
          error: null,
          data: setData,
        };
      } catch (error) {
        console.error(`[Scraper] Error during scraping:`, error);
        console.error(`[Scraper] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = error instanceof Error && error.stack ? error.stack.split('\n')[0] : '';
        return {
          success: false,
          error: `Failed to scrape URL: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`,
          data: null,
        };
      }
    }),

  searchTracks: publicProcedure
    .input(z.object({ query: z.string(), setTitle: z.string().optional() }))
    .mutation(async ({ input }) => {
      console.log(`[Scraper] Searching tracks for: ${input.query}`);
      
      const tracks = await search1001Tracklists(input.query);
      
      return {
        success: true,
        tracks,
      };
    }),

  searchSoundCloudSets: publicProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      console.log(`[Scraper] Searching SoundCloud for sets: ${input.query}`);
      
      const results: Array<{ title: string; artist: string; url: string; thumbnail?: string }> = [];
      
      try {
        const searchQuery = encodeURIComponent(input.query);
        const searchUrl = `https://soundcloud.com/search/sounds?q=${searchQuery}`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (response.ok) {
          const html = await response.text();
          
          const hydrationMatch = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
          if (hydrationMatch) {
            try {
              const hydrationData = JSON.parse(hydrationMatch[1]);
              
              for (const item of hydrationData) {
                if (item.hydratable === 'search' && item.data?.collection) {
                  for (const track of item.data.collection.slice(0, 10)) {
                    if (track.title && track.user?.username) {
                      results.push({
                        title: track.title,
                        artist: track.user.username,
                        url: track.permalink_url || `https://soundcloud.com/${track.user.permalink}/${track.permalink}`,
                        thumbnail: track.artwork_url?.replace('-large', '-t500x500'),
                      });
                    }
                  }
                }
              }
            } catch (e) {
              console.error('[Scraper] SoundCloud hydration parse error:', e);
            }
          }
        }
      } catch (error) {
        console.error('[Scraper] SoundCloud search error:', error);
      }
      
      return {
        success: true,
        results,
      };
    }),

  searchSoundCloudTracks: publicProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      console.log(`[Scraper] Searching SoundCloud for tracks: ${input.query}`);
      
      const results: Array<{ 
        title: string; 
        artist: string; 
        url: string; 
        thumbnail?: string;
        duration?: number;
        playCount?: number;
        genre?: string;
      }> = [];
      
      try {
        const searchQuery = encodeURIComponent(input.query);
        const searchUrl = `https://soundcloud.com/search/sounds?q=${searchQuery}`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (response.ok) {
          const html = await response.text();
          
          const hydrationMatch = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
          if (hydrationMatch) {
            try {
              const hydrationData = JSON.parse(hydrationMatch[1]);
              
              for (const item of hydrationData) {
                if (item.hydratable === 'search' && item.data?.collection) {
                  for (const track of item.data.collection.slice(0, 20)) {
                    if (track.title && track.user?.username && track.kind === 'track') {
                      const durationSeconds = track.duration ? Math.floor(track.duration / 1000) : undefined;
                      results.push({
                        title: track.title,
                        artist: track.user.username,
                        url: track.permalink_url || `https://soundcloud.com/${track.user.permalink}/${track.permalink}`,
                        thumbnail: track.artwork_url?.replace('-large', '-t500x500'),
                        duration: durationSeconds,
                        playCount: track.playback_count,
                        genre: track.genre,
                      });
                    }
                  }
                }
              }
            } catch (e) {
              console.error('[Scraper] SoundCloud hydration parse error:', e);
            }
          }
        }
      } catch (error) {
        console.error('[Scraper] SoundCloud track search error:', error);
      }
      
      console.log(`[Scraper] Found ${results.length} tracks from SoundCloud`);
      return {
        success: true,
        results,
      };
    }),

  get1001TracklistAudioLinks: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      console.log(`[Scraper] Fetching audio links from 1001tracklists: ${input.url}`);
      
      if (!input.url.includes('1001tracklists.com')) {
        return {
          success: false,
          error: 'URL must be from 1001tracklists.com',
          links: null,
          metadata: null,
        };
      }
      
      try {
        const result = await fetch1001TracklistDirect(input.url);
        
        return {
          success: true,
          error: null,
          links: result.links,
          metadata: {
            title: result.title,
            artist: result.artist,
            venue: result.venue,
            date: result.date,
            thumbnail: result.thumbnail,
            duration: result.duration,
            trackCount: result.tracks.length,
          },
        };
      } catch (error) {
        console.error('[Scraper] Error fetching 1001tracklists audio links:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch audio links',
          links: null,
          metadata: null,
        };
      }
    }),

  search1001Tracklists: publicProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      console.log(`[Scraper] Searching 1001tracklists for: ${input.query}`);
      
      const results: Array<{ title: string; artist: string; url: string; trackCount?: number }> = [];
      
      try {
        const searchQuery = encodeURIComponent(input.query);
        const searchUrl = `https://www.1001tracklists.com/search/result.php?search_selection=0&search_value=${searchQuery}`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (response.ok) {
          const html = await response.text();
          
          const tracklistPattern = /<a[^>]*href="(\/tracklist\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          const seen = new Set<string>();
          
          while ((match = tracklistPattern.exec(html)) !== null && results.length < 10) {
            const url = `https://www.1001tracklists.com${match[1]}`;
            const text = match[2].replace(/<[^>]+>/g, '').trim();
            
            if (text && !seen.has(url) && text.length > 5) {
              seen.add(url);
              const extracted = extractArtistFromTitle(text);
              results.push({
                title: text,
                artist: extracted.artist || 'Unknown',
                url,
              });
            }
          }
        }
      } catch (error) {
        console.error('[Scraper] 1001tracklists search error:', error);
      }
      
      return {
        success: true,
        results,
      };
    }),

  identifyTrack: publicProcedure
    .input(z.object({ 
      audioBase64: z.string(),
      timestamp: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log(`[ACRCloud] Starting track identification at timestamp: ${input.timestamp || 0}`);
      
      const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
      const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;
      const host = process.env.ACRCLOUD_HOST || 'identify-us-west-2.acrcloud.com';
      
      if (!accessKey || !accessSecret) {
        console.error('[ACRCloud] Missing credentials');
        return {
          success: false,
          error: 'ACRCloud credentials not configured',
          result: null,
        };
      }
      
      try {
        const httpMethod = 'POST';
        const httpUri = '/v1/identify';
        const dataType = 'audio';
        const signatureVersion = '1';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        
        const stringToSign = [
          httpMethod,
          httpUri,
          accessKey,
          dataType,
          signatureVersion,
          timestamp,
        ].join('\n');
        
        const signature = crypto
          .createHmac('sha1', accessSecret)
          .update(stringToSign)
          .digest('base64');
        
        const audioBuffer = Buffer.from(input.audioBase64, 'base64');
        
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const formParts: string[] = [];
        
        const addField = (name: string, value: string) => {
          formParts.push(`--${boundary}\r\n`);
          formParts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
          formParts.push(`${value}\r\n`);
        };
        
        addField('access_key', accessKey);
        addField('sample_bytes', audioBuffer.length.toString());
        addField('timestamp', timestamp);
        addField('signature', signature);
        addField('data_type', dataType);
        addField('signature_version', signatureVersion);
        
        const headerPart = formParts.join('');
        const filePart = `--${boundary}\r\nContent-Disposition: form-data; name="sample"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`;
        const endPart = `\r\n--${boundary}--\r\n`;
        
        // Convert all parts to Uint8Array for Vercel's fetch API compatibility
        const headerBytes = new Uint8Array(Buffer.from(headerPart));
        const filePartBytes = new Uint8Array(Buffer.from(filePart));
        const audioBytes = new Uint8Array(audioBuffer);
        const endBytes = new Uint8Array(Buffer.from(endPart));
        
        // Concatenate Uint8Arrays
        const totalLength = headerBytes.length + filePartBytes.length + audioBytes.length + endBytes.length;
        const body = new Uint8Array(totalLength);
        let offset = 0;
        body.set(headerBytes, offset);
        offset += headerBytes.length;
        body.set(filePartBytes, offset);
        offset += filePartBytes.length;
        body.set(audioBytes, offset);
        offset += audioBytes.length;
        body.set(endBytes, offset);
        
        console.log(`[ACRCloud] Sending request to ${host}`);
        
        const response = await fetch(`https://${host}${httpUri}`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        });
        
        const result = await response.json();
        console.log('[ACRCloud] Response:', JSON.stringify(result, null, 2));
        
        if (result.status?.code === 0 && result.metadata?.music?.length > 0) {
          const music = result.metadata.music[0];
          const artists = music.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist';
          const title = music.title || 'Unknown Track';
          const album = music.album?.name;
          const releaseDate = music.release_date;
          const label = music.label;
          const externalIds = music.external_ids || {};
          const externalMetadata = music.external_metadata || {};
          
          const spotifyId = externalMetadata.spotify?.track?.id;
          const youtubeId = externalMetadata.youtube?.vid;
          
          console.log(`[ACRCloud] Identified: ${artists} - ${title}`);
          
          return {
            success: true,
            error: null,
            result: {
              title,
              artist: artists,
              album,
              releaseDate,
              label,
              confidence: music.score || 100,
              duration: music.duration_ms ? Math.floor(music.duration_ms / 1000) : undefined,
              links: {
                spotify: spotifyId ? `https://open.spotify.com/track/${spotifyId}` : undefined,
                youtube: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined,
                isrc: externalIds.isrc,
              },
            },
          };
        }
        
        if (result.status?.code === 1001) {
          console.log('[ACRCloud] No match found');
          return {
            success: true,
            error: null,
            result: null,
          };
        }
        
        console.error('[ACRCloud] API error:', result.status);
        return {
          success: false,
          error: result.status?.msg || 'Unknown error from ACRCloud',
          result: null,
        };
      } catch (error) {
        console.error('[ACRCloud] Request error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to identify track',
          result: null,
        };
      }
    }),

  identifyTrackFromUrl: publicProcedure
    .input(z.object({ 
      audioUrl: z.string().url(),
      startSeconds: z.number().optional(),
      durationSeconds: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log(`[ACRCloud] ===== PROCEDURE CALLED =====`);
      console.log(`[ACRCloud] Received input:`, JSON.stringify(input, null, 2));
      console.log(`[ACRCloud] audioUrl type: ${typeof input.audioUrl}, value: ${input.audioUrl}`);
      console.log(`[ACRCloud] startSeconds type: ${typeof input.startSeconds}, value: ${input.startSeconds}`);
      console.log(`[ACRCloud] durationSeconds type: ${typeof input.durationSeconds}, value: ${input.durationSeconds}`);
      console.log(`[ACRCloud] Identifying track from URL: ${input.audioUrl}`);
      console.log(`[ACRCloud] Start: ${input.startSeconds ?? 0}s, Duration: ${input.durationSeconds ?? 15}s`);
      
      // Use the internal helper which handles SoundCloud/YouTube URL resolution
      const result = await identifyTrackFromUrlInternal(
        input.audioUrl,
        input.startSeconds ?? 0,
        input.durationSeconds ?? 15
      );
      
      console.log(`[ACRCloud] ===== PROCEDURE RETURNING =====`);
      console.log(`[ACRCloud] Result:`, JSON.stringify(result, null, 2));
      return result;
    }),
});
