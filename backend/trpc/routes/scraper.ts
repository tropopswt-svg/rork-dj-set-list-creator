import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

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

  return null;
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
  
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${youtubeUrl}&format=json`;
    const response = await fetch(oembedUrl);
    
    comments = await fetchYouTubeComments(videoId);
    tracks = extractTracksFromComments(comments);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[Scraper] YouTube oEmbed data:`, data);
      
      const titleParts = data.title?.split(' - ') || [];
      const artist = data.author_name || titleParts[0] || 'Unknown Artist';
      const title = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : data.title || 'Unknown Set';
      
      return {
        title,
        artist,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        platform: "youtube",
        tracks,
        comments,
        links: {
          youtube: youtubeUrl,
        },
      };
    }
  } catch (error) {
    console.error(`[Scraper] YouTube oEmbed error:`, error);
  }

  return {
    title: "Unknown Set",
    artist: "Unknown Artist",
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
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
  
  try {
    const oembedUrl = `https://soundcloud.com/oembed?url=${soundcloudUrl}&format=json`;
    const response = await fetch(oembedUrl);
    
    comments = await fetchSoundCloudComments(soundcloudUrl);
    tracks = extractTracksFromComments(comments);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[Scraper] SoundCloud oEmbed data:`, data);
      
      return {
        title: data.title || "Unknown Set",
        artist: data.author_name || "Unknown Artist",
        thumbnail: data.thumbnail_url,
        platform: "soundcloud",
        tracks,
        comments,
        links: {
          soundcloud: soundcloudUrl,
        },
      };
    }
  } catch (error) {
    console.error(`[Scraper] SoundCloud oEmbed error:`, error);
  }

  const parts = trackPath.split('/');
  return {
    title: parts[1]?.replace(/-/g, ' ') || "Unknown Set",
    artist: parts[0]?.replace(/-/g, ' ') || "Unknown Artist",
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
  
  try {
    const oembedUrl = `https://www.mixcloud.com/oembed/?url=https://www.mixcloud.com/${trackPath}/&format=json`;
    const response = await fetch(oembedUrl);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[Scraper] Mixcloud oEmbed data:`, data);
      
      return {
        title: data.title || "Unknown Set",
        artist: data.author_name || "Unknown Artist",
        thumbnail: data.image,
        platform: "mixcloud",
        tracks: [],
        links: {
          mixcloud: `https://www.mixcloud.com/${trackPath}/`,
        },
      };
    }
  } catch (error) {
    console.error(`[Scraper] Mixcloud oEmbed error:`, error);
  }

  const parts = trackPath.split('/');
  return {
    title: parts[1]?.replace(/-/g, ' ') || "Unknown Set",
    artist: parts[0]?.replace(/-/g, ' ') || "Unknown Artist",
    platform: "mixcloud",
    tracks: [],
    links: {
      mixcloud: `https://www.mixcloud.com/${trackPath}/`,
    },
  };
}

async function search1001Tracklists(query: string): Promise<z.infer<typeof ScrapedTrack>[]> {
  console.log(`[Scraper] Searching 1001tracklists for: ${query}`);
  return [];
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
          error: "Unsupported URL format. Please use YouTube, SoundCloud, or Mixcloud links.",
          data: null,
        };
      }

      console.log(`[Scraper] Extracted platform: ${extracted.platform}, ID: ${extracted.id}`);

      let setData: z.infer<typeof ScrapedSetData>;

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
        default:
          return {
            success: false,
            error: "Unsupported platform",
            data: null,
          };
      }

      if (setData.title && setData.artist) {
        const tracksFrom1001 = await search1001Tracklists(`${setData.artist} ${setData.title}`);
        setData.tracks = [...setData.tracks, ...tracksFrom1001];
      }

      console.log(`[Scraper] Final scraped data:`, setData);

      return {
        success: true,
        error: null,
        data: setData,
      };
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
});
