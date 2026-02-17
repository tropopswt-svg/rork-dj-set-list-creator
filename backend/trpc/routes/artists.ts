import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { getArtistImageMusicBrainz, getPlaceholderAvatar } from "../../../lib/artistImages";

// Create Supabase client for backend use
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const artistsRouter = createTRPCRouter({
  /**
   * Get artist image (tries MusicBrainz, falls back to placeholder)
   */
  getImage: publicProcedure
    .input(z.object({ artistName: z.string() }))
    .query(async ({ input }) => {
      // Try MusicBrainz first
      const mbImage = await getArtistImageMusicBrainz(input.artistName);
      if (mbImage) {
        return { imageUrl: mbImage, source: 'musicbrainz' };
      }
      // Fall back to placeholder
      return { imageUrl: getPlaceholderAvatar(input.artistName), source: 'placeholder' };
    }),

  /**
   * Get placeholder avatar URL for an artist
   */
  getPlaceholder: publicProcedure
    .input(z.object({ artistName: z.string() }))
    .query(async ({ input }) => {
      return { imageUrl: getPlaceholderAvatar(input.artistName) };
    }),

  /**
   * Enrich a single artist with image and save to database
   */
  enrichArtist: publicProcedure
    .input(z.object({ artistId: z.string() }))
    .mutation(async ({ input }) => {
      // Get artist from database
      const { data: artist, error: fetchError } = await supabase
        .from('artists')
        .select('id, name, image_url')
        .eq('id', input.artistId)
        .single();

      if (fetchError || !artist) {
        return { success: false, error: 'Artist not found' };
      }

      // Skip if already has image (and it's not a placeholder)
      if (artist.image_url && !artist.image_url.includes('ui-avatars.com')) {
        return { success: true, skipped: true, imageUrl: artist.image_url };
      }

      // Try MusicBrainz
      const imageUrl = await getArtistImageMusicBrainz(artist.name);

      if (!imageUrl) {
        // Use placeholder as last resort
        const placeholder = getPlaceholderAvatar(artist.name);
        return { success: true, imageUrl: placeholder, source: 'placeholder' };
      }

      // Update artist in database
      const { error: updateError } = await supabase
        .from('artists')
        .update({
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.artistId);

      if (updateError) {
        return { success: false, error: 'Failed to update artist' };
      }

      return { success: true, imageUrl, source: 'musicbrainz' };
    }),

  /**
   * Batch enrich multiple artists with images
   */
  enrichArtists: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      onlyMissingImages: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      // Get artists that need enrichment
      let query = supabase
        .from('artists')
        .select('id, name, image_url')
        .order('tracks_count', { ascending: false })
        .limit(input.limit);

      if (input.onlyMissingImages) {
        // Get artists without images or with placeholder images
        query = query.or('image_url.is.null,image_url.ilike.%ui-avatars.com%');
      }

      const { data: artists, error: fetchError } = await query;

      if (fetchError || !artists) {
        return { success: false, error: 'Failed to fetch artists', enriched: 0 };
      }

      let enrichedCount = 0;
      const results: Array<{ name: string; success: boolean; imageUrl?: string; source?: string }> = [];

      for (const artist of artists) {
        // Try MusicBrainz
        const imageUrl = await getArtistImageMusicBrainz(artist.name);

        if (imageUrl) {
          const { error: updateError } = await supabase
            .from('artists')
            .update({
              image_url: imageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', artist.id);

          if (!updateError) {
            enrichedCount++;
            results.push({ name: artist.name, success: true, imageUrl, source: 'musicbrainz' });
          } else {
            results.push({ name: artist.name, success: false });
          }
        } else {
          results.push({ name: artist.name, success: false, source: 'not_found' });
        }

        // Delay between requests (MusicBrainz rate limit is 1 req/sec)
        await new Promise(resolve => setTimeout(resolve, 1100));
      }

      return {
        success: true,
        enriched: enrichedCount,
        total: artists.length,
        results,
      };
    }),
});
