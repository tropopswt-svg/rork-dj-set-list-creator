/**
 * Seed initial artists into Supabase
 * Run: bun run scripts/seed-artists.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initial artists to seed
const artists = [
  { name: 'Chris Stussy', genres: ['house', 'tech house'], country: 'Netherlands' },
  { name: 'Seth Troxler', genres: ['house', 'techno'], country: 'USA' },
  { name: 'Peggy Gou', genres: ['house', 'techno', 'disco'], country: 'South Korea' },
  { name: 'John Summit', genres: ['tech house'], country: 'USA' },
  { name: 'Fisher', genres: ['tech house'], country: 'Australia' },
  { name: 'Charlotte de Witte', genres: ['techno'], country: 'Belgium' },
  { name: 'Amelie Lens', genres: ['techno'], country: 'Belgium' },
  { name: 'Adam Beyer', genres: ['techno'], country: 'Sweden' },
  { name: 'Carl Cox', genres: ['techno', 'house'], country: 'UK' },
  { name: 'Black Coffee', genres: ['afro house', 'deep house'], country: 'South Africa' },
  { name: 'Disclosure', genres: ['house', 'uk garage'], country: 'UK' },
  { name: 'Four Tet', genres: ['house', 'electronica'], country: 'UK' },
  { name: 'Fred again..', genres: ['house', 'uk garage'], country: 'UK' },
  { name: 'Skrillex', genres: ['dubstep', 'house', 'bass'], country: 'USA' },
  { name: 'Jamie Jones', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Patrick Topping', genres: ['tech house'], country: 'UK' },
  { name: 'Denis Sulta', genres: ['house'], country: 'UK' },
  { name: 'Sama\' Abdulhadi', genres: ['techno'], country: 'Palestine' },
  { name: 'Nina Kraviz', genres: ['techno', 'acid'], country: 'Russia' },
  { name: 'Richie Hawtin', genres: ['techno', 'minimal'], country: 'Canada' },
  { name: 'Tale Of Us', genres: ['melodic techno'], country: 'Italy' },
  { name: 'Solomun', genres: ['melodic house', 'indie dance'], country: 'Germany' },
  { name: 'Maceo Plex', genres: ['techno', 'house'], country: 'USA' },
  { name: 'ANNA', genres: ['techno'], country: 'Brazil' },
  { name: 'Honey Dijon', genres: ['house', 'disco'], country: 'USA' },
];

// Artist aliases for better matching
const aliases: Record<string, string[]> = {
  'Chris Stussy': ['C. Stussy', 'Stussy'],
  'John Summit': ['J Summit', 'Summit'],
  'Fisher': ['FISHER', 'Chris Lake & Fisher'],
  'Charlotte de Witte': ['Charlotte De Witte', 'KNTXT'],
  'Fred again..': ['Fred Again', 'Fred again', 'fredagain'],
  'Peggy Gou': ['Peggy Gou 페기구'],
  'Four Tet': ['Fourtet', '4tet', 'Kieran Hebden'],
  'Tale Of Us': ['Tale of Us', 'Afterlife'],
  'Sama\' Abdulhadi': ['Sama Abdulhadi', 'SAMA'],
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

async function seedArtists() {
  console.log('🎵 Seeding artists into Supabase...\n');

  let created = 0;
  let skipped = 0;

  for (const artist of artists) {
    const slug = generateSlug(artist.name);

    // Check if already exists
    const { data: existing } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      console.log(`  ⏭️  ${artist.name} (already exists)`);
      skipped++;
      continue;
    }

    // Insert artist
    const { data, error } = await supabase
      .from('artists')
      .insert({
        name: artist.name,
        slug,
        genres: artist.genres,
        country: artist.country,
      })
      .select()
      .single();

    if (error) {
      console.error(`  ❌ ${artist.name}: ${error.message}`);
      continue;
    }

    console.log(`  ✅ ${artist.name}`);
    created++;

    // Add aliases
    const artistAliases = aliases[artist.name] || [];
    const allAliases = [artist.name, ...artistAliases];

    for (const alias of allAliases) {
      const { error: aliasError } = await supabase
        .from('artist_aliases')
        .upsert({
          artist_id: data.id,
          alias,
          alias_lower: alias.toLowerCase().replace(/[^\w\s]/g, '').trim(),
        }, { onConflict: 'alias_lower' });

      if (aliasError && !aliasError.message.includes('duplicate')) {
        console.error(`    ⚠️  Alias "${alias}": ${aliasError.message}`);
      }
    }
  }

  console.log(`\n✨ Done! Created ${created}, skipped ${skipped}`);

  // Verify by counting
  const { count } = await supabase
    .from('artists')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total artists in database: ${count}`);
}

seedArtists().catch(console.error);
