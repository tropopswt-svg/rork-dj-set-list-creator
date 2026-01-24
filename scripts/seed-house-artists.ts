/**
 * Seed house music artists into Supabase
 * Run: bun run scripts/seed-house-artists.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

// House music artists - organized by subgenre
const artists = [
  // Tech House
  { name: 'Chris Lake', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Green Velvet', genres: ['tech house', 'acid house'], country: 'USA' },
  { name: 'Claude VonStroke', genres: ['tech house', 'dirtybird'], country: 'USA' },
  { name: 'Solardo', genres: ['tech house'], country: 'UK' },
  { name: 'Michael Bibi', genres: ['tech house'], country: 'UK' },
  { name: 'Dom Dolla', genres: ['tech house', 'house'], country: 'Australia' },
  { name: 'Vintage Culture', genres: ['tech house', 'house'], country: 'Brazil' },
  { name: 'Cloonee', genres: ['tech house'], country: 'UK' },
  { name: 'James Hype', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Matroda', genres: ['tech house', 'bass house'], country: 'Croatia' },
  { name: 'ACRAZE', genres: ['tech house'], country: 'USA' },
  { name: 'Wade', genres: ['tech house'], country: 'Spain' },
  { name: 'Eli Brown', genres: ['tech house'], country: 'UK' },
  { name: 'Biscits', genres: ['tech house'], country: 'UK' },
  { name: 'DONT BLINK', genres: ['tech house'], country: 'USA' },
  { name: 'Mau P', genres: ['tech house'], country: 'Netherlands' },
  { name: 'PAWSA', genres: ['tech house'], country: 'UK' },
  { name: 'Rebūke', genres: ['tech house', 'techno'], country: 'Ireland' },
  { name: 'Latmun', genres: ['tech house'], country: 'UK' },
  { name: 'Detlef', genres: ['tech house'], country: 'UK' },
  { name: 'Camelphat', genres: ['tech house', 'melodic house'], country: 'UK' },
  { name: 'Eats Everything', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Nic Fanciulli', genres: ['tech house'], country: 'UK' },
  { name: 'Loco Dice', genres: ['tech house', 'techno'], country: 'Germany' },
  { name: 'Marco Carola', genres: ['tech house', 'techno'], country: 'Italy' },
  { name: 'Joseph Capriati', genres: ['tech house', 'techno'], country: 'Italy' },
  { name: 'Hot Since 82', genres: ['tech house', 'deep house'], country: 'UK' },
  
  // Deep House
  { name: 'Lane 8', genres: ['deep house', 'progressive house'], country: 'USA' },
  { name: 'Ben Böhmer', genres: ['deep house', 'melodic house'], country: 'Germany' },
  { name: 'Yotto', genres: ['deep house', 'progressive house'], country: 'Finland' },
  { name: 'Tinlicker', genres: ['deep house', 'progressive house'], country: 'Netherlands' },
  { name: 'Nora En Pure', genres: ['deep house', 'indie dance'], country: 'Switzerland' },
  { name: 'Bob Moses', genres: ['deep house', 'indie dance'], country: 'Canada' },
  { name: 'Maya Jane Coles', genres: ['deep house', 'tech house'], country: 'UK' },
  { name: 'Kerri Chandler', genres: ['deep house', 'garage'], country: 'USA' },
  { name: 'Louie Vega', genres: ['deep house', 'soulful house'], country: 'USA' },
  { name: 'Larry Heard', genres: ['deep house'], country: 'USA' },
  { name: 'Moodymann', genres: ['deep house', 'detroit house'], country: 'USA' },
  { name: 'Theo Parrish', genres: ['deep house', 'detroit house'], country: 'USA' },
  
  // Classic / Chicago House
  { name: 'Frankie Knuckles', genres: ['chicago house', 'house'], country: 'USA' },
  { name: 'Marshall Jefferson', genres: ['chicago house'], country: 'USA' },
  { name: 'Ron Trent', genres: ['deep house', 'chicago house'], country: 'USA' },
  { name: 'Derrick Carter', genres: ['chicago house', 'house'], country: 'USA' },
  { name: 'DJ Sneak', genres: ['chicago house', 'tech house'], country: 'USA' },
  
  // UK House / Garage
  { name: 'Conducta', genres: ['uk garage', 'house'], country: 'UK' },
  { name: 'Interplanetary Criminal', genres: ['uk garage', 'house'], country: 'UK' },
  { name: 'Sammy Virji', genres: ['uk garage', 'house'], country: 'UK' },
  { name: 'Nia Archives', genres: ['jungle', 'uk garage'], country: 'UK' },
  { name: 'Salute', genres: ['uk garage', 'house'], country: 'UK' },
  { name: 'Skream', genres: ['uk garage', 'house', 'dubstep'], country: 'UK' },
  { name: 'Artwork', genres: ['uk garage', 'house'], country: 'UK' },
  { name: 'Todd Edwards', genres: ['uk garage', 'house'], country: 'USA' },
  { name: 'MJ Cole', genres: ['uk garage'], country: 'UK' },
  { name: 'El-B', genres: ['uk garage'], country: 'UK' },
  
  // Progressive House
  { name: 'Cristoph', genres: ['progressive house', 'melodic techno'], country: 'UK' },
  { name: 'Jeremy Olander', genres: ['progressive house'], country: 'Sweden' },
  { name: 'Fehrplay', genres: ['progressive house'], country: 'Norway' },
  { name: 'Guy J', genres: ['progressive house', 'deep house'], country: 'Israel' },
  { name: 'Hernan Cattaneo', genres: ['progressive house'], country: 'Argentina' },
  { name: 'John Digweed', genres: ['progressive house', 'techno'], country: 'UK' },
  { name: 'Sasha', genres: ['progressive house'], country: 'UK' },
  { name: 'Nick Warren', genres: ['progressive house'], country: 'UK' },
  { name: 'Guy Mantzur', genres: ['progressive house', 'melodic house'], country: 'Israel' },
  { name: 'Khen', genres: ['progressive house'], country: 'Israel' },
  
  // Melodic House / Afro House
  { name: 'Keinemusik', genres: ['melodic house', 'afro house'], country: 'Germany' },
  { name: '&ME', genres: ['melodic house', 'afro house'], country: 'Germany' },
  { name: 'Rampa', genres: ['melodic house', 'afro house'], country: 'Germany' },
  { name: 'Adam Port', genres: ['melodic house', 'house'], country: 'Germany' },
  { name: 'Mano Le Tough', genres: ['melodic house'], country: 'Ireland' },
  { name: 'Âme', genres: ['melodic house', 'deep house'], country: 'Germany' },
  { name: 'Dixon', genres: ['melodic house', 'deep house'], country: 'Germany' },
  { name: 'Adriatique', genres: ['melodic house', 'melodic techno'], country: 'Switzerland' },
  { name: 'Mind Against', genres: ['melodic house', 'melodic techno'], country: 'Italy' },
  { name: 'Massano', genres: ['melodic house', 'afro house'], country: 'Italy' },
  { name: 'BLOND:ISH', genres: ['melodic house', 'afro house'], country: 'Canada' },
  { name: 'Bedouin', genres: ['melodic house', 'organic house'], country: 'USA' },
  { name: 'Damian Lazarus', genres: ['melodic house'], country: 'UK' },
  
  // Afro House Specialists
  { name: 'Enoo Napa', genres: ['afro house', 'afro tech'], country: 'South Africa' },
  { name: 'Da Capo', genres: ['afro house'], country: 'South Africa' },
  { name: 'Kususa', genres: ['afro house', 'afro tech'], country: 'South Africa' },
  { name: 'Sun-El Musician', genres: ['afro house'], country: 'South Africa' },
  { name: 'Themba', genres: ['afro house', 'afro tech'], country: 'South Africa' },
  { name: 'Caiiro', genres: ['afro house'], country: 'South Africa' },
  
  // Disco / Nu-Disco
  { name: 'Purple Disco Machine', genres: ['nu-disco', 'house'], country: 'Germany' },
  { name: 'The Blessed Madonna', genres: ['disco', 'house'], country: 'USA' },
  { name: 'Horse Meat Disco', genres: ['disco', 'house'], country: 'UK' },
  { name: 'Midland', genres: ['house', 'disco'], country: 'UK' },
  { name: 'Todd Terje', genres: ['nu-disco', 'space disco'], country: 'Norway' },
  { name: 'Lindstrøm', genres: ['nu-disco', 'space disco'], country: 'Norway' },
  { name: 'Prins Thomas', genres: ['nu-disco', 'cosmic disco'], country: 'Norway' },
  
  // Bass House
  { name: 'Jauz', genres: ['bass house', 'dubstep'], country: 'USA' },
  { name: 'Habstrakt', genres: ['bass house'], country: 'France' },
  { name: 'Joyryde', genres: ['bass house'], country: 'UK' },
  { name: 'AC Slater', genres: ['bass house', 'night bass'], country: 'USA' },
  { name: 'Dr. Fresch', genres: ['bass house', 'g-house'], country: 'USA' },
  { name: 'Drezo', genres: ['bass house', 'g-house'], country: 'USA' },
  { name: 'Malaa', genres: ['bass house', 'g-house'], country: 'France' },
  { name: 'Tchami', genres: ['future house', 'bass house'], country: 'France' },
  { name: 'Wax Motif', genres: ['bass house', 'g-house'], country: 'Australia' },
  
  // Future House / Mainstream
  { name: 'Oliver Heldens', genres: ['future house', 'house'], country: 'Netherlands' },
  { name: 'Don Diablo', genres: ['future house'], country: 'Netherlands' },
  { name: 'Martin Garrix', genres: ['future house', 'big room'], country: 'Netherlands' },
  { name: 'Tiësto', genres: ['house', 'trance'], country: 'Netherlands' },
  { name: 'David Guetta', genres: ['house', 'edm'], country: 'France' },
  { name: 'Calvin Harris', genres: ['house', 'edm'], country: 'UK' },
  { name: 'Diplo', genres: ['house', 'moombahton'], country: 'USA' },
  { name: 'Major Lazer', genres: ['house', 'dancehall'], country: 'USA' },
  { name: 'Duke Dumont', genres: ['house', 'deep house'], country: 'UK' },
  { name: 'MK', genres: ['house', 'deep house'], country: 'USA' },
  { name: 'Gorgon City', genres: ['house', 'uk bass'], country: 'UK' },
  { name: 'Sonny Fodera', genres: ['house', 'tech house'], country: 'Australia' },
  { name: 'John Digweed', genres: ['progressive house', 'techno'], country: 'UK' },
  
  // PIV / Solid Grooves Artists
  { name: 'Prunk', genres: ['house', 'tech house'], country: 'Netherlands' },
  { name: 'East End Dubs', genres: ['house', 'minimal'], country: 'UK' },
  { name: 'Dennis Cruz', genres: ['tech house'], country: 'Spain' },
  { name: 'Enzo Siragusa', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Archie Hamilton', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Rossi.', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'wAFF', genres: ['tech house'], country: 'UK' },
  
  // Legends / Pioneers
  { name: 'Masters At Work', genres: ['house', 'garage'], country: 'USA' },
  { name: 'Armand Van Helden', genres: ['house', 'disco'], country: 'USA' },
  { name: 'Roger Sanchez', genres: ['house'], country: 'USA' },
  { name: 'David Morales', genres: ['house'], country: 'USA' },
  { name: 'Danny Tenaglia', genres: ['house', 'techno'], country: 'USA' },
  { name: 'Tony Humphries', genres: ['house', 'garage'], country: 'USA' },
  { name: 'Junior Vasquez', genres: ['house', 'tribal'], country: 'USA' },
  { name: 'Eric Prydz', genres: ['progressive house', 'techno'], country: 'Sweden' },
  { name: 'deadmau5', genres: ['progressive house', 'electro house'], country: 'Canada' },
  { name: 'Fatboy Slim', genres: ['big beat', 'house'], country: 'UK' },
  { name: 'Chemical Brothers', genres: ['big beat', 'house'], country: 'UK' },
  { name: 'Basement Jaxx', genres: ['house', 'uk garage'], country: 'UK' },
  { name: 'Daft Punk', genres: ['french house', 'disco'], country: 'France' },
  { name: 'Justice', genres: ['french house', 'electro'], country: 'France' },
  { name: 'Cassius', genres: ['french house'], country: 'France' },
  
  // More Current Artists
  { name: 'LP Giobbi', genres: ['house', 'piano house'], country: 'USA' },
  { name: 'John Digweed', genres: ['progressive house'], country: 'UK' },
  { name: 'CamelPhat', genres: ['melodic house', 'tech house'], country: 'UK' },
  { name: 'Meduza', genres: ['house', 'piano house'], country: 'Italy' },
  { name: 'Rüfüs Du Sol', genres: ['house', 'indie dance'], country: 'Australia' },
  { name: 'Boris Brejcha', genres: ['minimal techno', 'high-tech minimal'], country: 'Germany' },
  { name: 'Stephan Bodzin', genres: ['melodic techno', 'live'], country: 'Germany' },
  { name: 'Bonobo', genres: ['downtempo', 'house'], country: 'UK' },
  { name: 'Caribou', genres: ['house', 'electronica'], country: 'Canada' },
  { name: 'Jamie xx', genres: ['house', 'uk bass'], country: 'UK' },
  { name: 'Floating Points', genres: ['house', 'electronica'], country: 'UK' },
  { name: 'Ross From Friends', genres: ['house', 'lo-fi house'], country: 'UK' },
  { name: 'Mall Grab', genres: ['lo-fi house', 'rave'], country: 'Australia' },
  { name: 'DJ Seinfeld', genres: ['lo-fi house'], country: 'Sweden' },
  { name: 'DJ Boring', genres: ['lo-fi house'], country: 'Australia' },
];

// Aliases for better matching
const aliases: Record<string, string[]> = {
  'Chris Lake': ['Chris Lake & Fisher'],
  'Green Velvet': ['Cajmere', 'Cajual'],
  'Claude VonStroke': ['Barclay Crenshaw'],
  'Eric Prydz': ['Pryda', 'Cirez D', 'Tonja Holma'],
  'deadmau5': ['Deadmau5', 'dead mau5', 'Testpilot'],
  'CamelPhat': ['Camelphat', 'Camel Phat'],
  'The Blessed Madonna': ['The Black Madonna'],
  'Daft Punk': ['Thomas Bangalter', 'Guy-Manuel'],
  'Masters At Work': ['MAW', 'Louie Vega & Kenny Dope'],
  'Chemical Brothers': ['The Chemical Brothers'],
  'Rüfüs Du Sol': ['Rufus Du Sol', 'RUFUS', 'Rüfüs'],
  'Âme': ['Ame'],
  '&ME': ['And Me'],
  'Rebūke': ['Rebuke'],
  'BLOND:ISH': ['Blondish', 'Blond:ish'],
};

async function seedArtists() {
  console.log('🎵 Seeding house music artists into Supabase...\n');

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
      await supabase
        .from('artist_aliases')
        .upsert({
          artist_id: data.id,
          alias,
          alias_lower: alias.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim(),
        }, { onConflict: 'alias_lower' })
        .then(() => {});
    }
  }

  console.log(`\n✨ Done! Created ${created}, skipped ${skipped} (already existed)`);

  // Verify by counting
  const { count } = await supabase
    .from('artists')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total artists in database: ${count}`);
  
  // Show genre breakdown
  const { data: genreData } = await supabase
    .from('artists')
    .select('genres');
  
  if (genreData) {
    const genreCounts: Record<string, number> = {};
    for (const artist of genreData) {
      for (const genre of artist.genres || []) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }
    
    console.log('\n📊 Genre breakdown:');
    const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [genre, count] of sorted) {
      console.log(`   ${genre}: ${count}`);
    }
  }
}

seedArtists().catch(console.error);
