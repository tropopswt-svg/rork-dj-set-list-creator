import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const ScrapedTrack = z.object({
  title: z.string(),
  artist: z.string(),
  timestamp: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.string(),
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
  links: z.object({
    youtube: z.string().optional(),
    soundcloud: z.string().optional(),
    mixcloud: z.string().optional(),
  }),
});

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

async function fetchYouTubeData(videoId: string): Promise<z.infer<typeof ScrapedSetData>> {
  console.log(`[Scraper] Fetching YouTube data for: ${videoId}`);
  
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    
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
        tracks: [],
        links: {
          youtube: `https://www.youtube.com/watch?v=${videoId}`,
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
    tracks: [],
    links: {
      youtube: `https://www.youtube.com/watch?v=${videoId}`,
    },
  };
}

async function fetchSoundCloudData(trackPath: string): Promise<z.infer<typeof ScrapedSetData>> {
  console.log(`[Scraper] Fetching SoundCloud data for: ${trackPath}`);
  
  try {
    const oembedUrl = `https://soundcloud.com/oembed?url=https://soundcloud.com/${trackPath}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[Scraper] SoundCloud oEmbed data:`, data);
      
      const thumbnailMatch = data.html?.match(/src="([^"]+)"/);
      
      return {
        title: data.title || "Unknown Set",
        artist: data.author_name || "Unknown Artist",
        thumbnail: data.thumbnail_url,
        platform: "soundcloud",
        tracks: [],
        links: {
          soundcloud: `https://soundcloud.com/${trackPath}`,
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
    tracks: [],
    links: {
      soundcloud: `https://soundcloud.com/${trackPath}`,
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
