/**
 * Seed additional house music content into Supabase
 * Run: bun run scripts/seed-more-house-music.ts
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

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// ADDITIONAL HOUSE MUSIC ARTISTS
// ============================================
const additionalArtists = [
  // Underground House
  { name: 'Honey Dijon', genres: ['house', 'disco'], country: 'USA' },
  { name: 'Jayda G', genres: ['house', 'disco'], country: 'Canada' },
  { name: 'DJ Koze', genres: ['deep house', 'indie dance'], country: 'Germany' },
  { name: 'DJ Harvey', genres: ['disco', 'house'], country: 'UK' },
  { name: 'Andrew Weatherall', genres: ['house', 'techno'], country: 'UK' },
  { name: 'Hunee', genres: ['house', 'disco'], country: 'South Korea' },
  { name: 'Antal', genres: ['house', 'disco'], country: 'Netherlands' },
  { name: 'Palms Trax', genres: ['house', 'italo disco'], country: 'UK' },
  { name: 'Paramida', genres: ['house', 'electro'], country: 'Germany' },
  { name: 'Zip', genres: ['minimal', 'house'], country: 'Germany' },

  // Chicago / Detroit Legends
  { name: 'Gene Farris', genres: ['chicago house', 'tech house'], country: 'USA' },
  { name: 'DJ Pierre', genres: ['acid house', 'chicago house'], country: 'USA' },
  { name: 'Cajmere', genres: ['chicago house', 'house'], country: 'USA' },
  { name: 'Felix Da Housecat', genres: ['electroclash', 'house'], country: 'USA' },
  { name: 'Paul Johnson', genres: ['chicago house', 'ghetto house'], country: 'USA' },
  { name: 'Boo Williams', genres: ['chicago house', 'deep house'], country: 'USA' },
  { name: 'Mike Dunn', genres: ['chicago house'], country: 'USA' },
  { name: 'Roy Davis Jr.', genres: ['chicago house', 'deep house'], country: 'USA' },

  // UK Scene
  { name: 'Bicep', genres: ['house', 'breakbeat'], country: 'UK' },
  { name: 'TSHA', genres: ['house', 'uk bass'], country: 'UK' },
  { name: 'HAAi', genres: ['house', 'techno'], country: 'Australia' },
  { name: 'Denis Sulta', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Hammer', genres: ['house', 'uk garage'], country: 'UK' },
  { name: 'Shanti Celeste', genres: ['house', 'disco'], country: 'UK' },
  { name: 'Peach', genres: ['house', 'disco'], country: 'UK' },
  { name: 'Call Super', genres: ['house', 'techno'], country: 'UK' },
  { name: 'Joy Orbison', genres: ['house', 'uk bass'], country: 'UK' },
  { name: 'Ben UFO', genres: ['house', 'uk bass'], country: 'UK' },
  { name: 'Objekt', genres: ['techno', 'electro'], country: 'UK' },
  { name: 'Pangaea', genres: ['house', 'uk bass'], country: 'UK' },
  { name: 'Pearson Sound', genres: ['house', 'uk bass'], country: 'UK' },

  // Ibiza / European Scene
  { name: 'Marco Faraone', genres: ['tech house', 'techno'], country: 'Italy' },
  { name: 'Paco Osuna', genres: ['tech house', 'techno'], country: 'Spain' },
  { name: 'Cuartero', genres: ['tech house'], country: 'Spain' },
  { name: 'Richy Ahmed', genres: ['tech house'], country: 'UK' },
  { name: 'Steve Lawler', genres: ['tech house', 'techno'], country: 'UK' },
  { name: 'Yousef', genres: ['tech house'], country: 'UK' },
  { name: 'Hector Couto', genres: ['tech house'], country: 'Spain' },
  { name: 'Santé', genres: ['tech house'], country: 'Germany' },
  { name: 'Sidney Charles', genres: ['tech house'], country: 'Germany' },
  { name: 'Darius Syrossian', genres: ['tech house'], country: 'UK' },

  // Rising Stars / Current Scene
  { name: 'Chaos In The CBD', genres: ['deep house', 'house'], country: 'New Zealand' },
  { name: 'Kettama', genres: ['house', 'breakbeat'], country: 'Ireland' },
  { name: 'salute', genres: ['uk garage', 'house'], country: 'UK' },
  { name: 'Logic1000', genres: ['house', 'uk garage'], country: 'Australia' },
  { name: 'CC:DISCO!', genres: ['house', 'disco'], country: 'Australia' },
  { name: 'Skin On Skin', genres: ['house', 'uk bass'], country: 'Australia' },
  { name: 'Young Marco', genres: ['house', 'disco'], country: 'Netherlands' },
  { name: 'Job Jobse', genres: ['house', 'techno'], country: 'Netherlands' },
  { name: 'Carista', genres: ['house', 'disco'], country: 'Netherlands' },

  // Dirtybird / US Tech House
  { name: 'Justin Martin', genres: ['tech house', 'dirtybird'], country: 'USA' },
  { name: 'Ardalan', genres: ['tech house', 'dirtybird'], country: 'USA' },
  { name: 'Walker & Royce', genres: ['tech house', 'dirtybird'], country: 'USA' },
  { name: 'Will Clarke', genres: ['tech house'], country: 'UK' },
  { name: 'Shiba San', genres: ['tech house', 'bass house'], country: 'France' },
  { name: 'Kyle Watson', genres: ['tech house', 'bass house'], country: 'South Africa' },

  // Defected / Glitterbox
  { name: 'Sam Divine', genres: ['house', 'vocal house'], country: 'UK' },
  { name: 'Simon Dunmore', genres: ['house', 'disco'], country: 'UK' },
  { name: 'Low Steppa', genres: ['house', 'bass house'], country: 'UK' },
  { name: 'Riva Starr', genres: ['tech house', 'house'], country: 'Italy' },
  { name: 'Ferreck Dawn', genres: ['house', 'tech house'], country: 'Netherlands' },
  { name: 'Melvo Baptiste', genres: ['house', 'disco'], country: 'UK' },

  // Toolroom
  { name: 'Mark Knight', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Siege', genres: ['tech house'], country: 'UK' },
  { name: 'Maxinne', genres: ['tech house'], country: 'UK' },
  { name: 'Martin Ikin', genres: ['tech house'], country: 'UK' },

  // Soulful / Vocal House
  { name: 'Dennis Ferrer', genres: ['house', 'soulful house'], country: 'USA' },
  { name: 'Osunlade', genres: ['afro house', 'deep house'], country: 'USA' },
  { name: 'Jimpster', genres: ['deep house'], country: 'UK' },
  { name: 'Charles Webster', genres: ['deep house'], country: 'UK' },
  { name: 'Henrik Schwarz', genres: ['house', 'live'], country: 'Germany' },

  // Crosstown Rebels
  { name: 'Art Department', genres: ['house', 'tech house'], country: 'Canada' },
  { name: 'Seth Troxler', genres: ['house', 'tech house'], country: 'USA' },
  { name: 'tINI', genres: ['tech house', 'house'], country: 'Germany' },
  { name: 'Nicole Moudaber', genres: ['techno', 'tech house'], country: 'UK' },
];

// Artist aliases for matching
const additionalAliases: Record<string, string[]> = {
  'Bicep': ['Bicep Music', 'Feel My Bicep'],
  'DJ Koze': ['Koze', 'Adolf Noise'],
  'Cajmere': ['Green Velvet'],
  'Felix Da Housecat': ['Aphrohead', 'Thee Maddkatt Courtship'],
  'Joy Orbison': ['Joy O'],
  'Chaos In The CBD': ['CITCBD'],
  'Walker & Royce': ['Walker and Royce'],
};

// ============================================
// ADDITIONAL TRACKS
// ============================================
const additionalTracks = [
  // Classic House Anthems
  { title: 'Your Love', artist: 'Frankie Knuckles', label: 'Trax', year: 1987 },
  { title: 'Can You Feel It', artist: 'Mr. Fingers', label: 'Trax', year: 1986 },
  { title: 'Love Cant Turn Around', artist: 'Farley Jackmaster Funk', label: 'House', year: 1986 },
  { title: 'Jack Your Body', artist: 'Steve Silk Hurley', label: 'DJ International', year: 1986 },
  { title: 'House Nation', artist: 'House Master Boyz', label: 'Dance Mania', year: 1987 },
  { title: 'French Kiss', artist: 'Lil Louis', label: 'FFRR', year: 1989 },
  { title: 'Promised Land', artist: 'Joe Smooth', label: 'DJ International', year: 1987 },
  { title: 'Good Life', artist: 'Inner City', label: '10 Records', year: 1988 },
  { title: 'Big Fun', artist: 'Inner City', label: '10 Records', year: 1988 },
  { title: 'No Way Back', artist: 'Adonis', label: 'Trax', year: 1986 },

  // Bicep
  { title: 'Glue', artist: 'Bicep', label: 'Ninja Tune', year: 2017 },
  { title: 'Opal', artist: 'Bicep', label: 'Ninja Tune', year: 2021 },
  { title: 'Atlas', artist: 'Bicep', label: 'Ninja Tune', year: 2021 },
  { title: 'Apricots', artist: 'Bicep', label: 'Ninja Tune', year: 2021 },
  { title: 'Saku', artist: 'Bicep', label: 'Ninja Tune', year: 2023 },

  // Honey Dijon
  { title: 'Downtown', artist: 'Honey Dijon', label: 'Classic', year: 2023 },
  { title: 'Love Is A State of Mind', artist: 'Honey Dijon', label: 'Classic', year: 2023 },
  { title: 'Not About You', artist: 'Honey Dijon', label: 'Classic', year: 2023 },

  // DJ Koze
  { title: 'Pick Up', artist: 'DJ Koze', label: 'Pampa', year: 2018 },
  { title: 'Seeing Aliens', artist: 'DJ Koze', label: 'Pampa', year: 2018 },
  { title: 'Muddy Funster', artist: 'DJ Koze', label: 'Pampa', year: 2018 },

  // Tech House Bangers 2023-2025
  { title: 'My Humps', artist: 'Biscits', label: 'Toolroom', year: 2023 },
  { title: 'Escape', artist: 'Mau P', label: 'Hellcat', year: 2023 },
  { title: 'Your Body', artist: 'Mau P', label: 'Hellcat', year: 2024 },
  { title: 'Superstar', artist: 'Biscits', label: 'Toolroom', year: 2024 },
  { title: 'Played Out', artist: 'Dom Dolla', label: 'Sweat It Out', year: 2024 },
  { title: 'Saving Up', artist: 'Dom Dolla', label: 'Sweat It Out', year: 2024 },
  { title: 'Eat Sleep Rave Repeat', artist: 'Fatboy Slim', label: 'Skint', year: 2013 },
  { title: 'Praise You', artist: 'Fatboy Slim', label: 'Skint', year: 1999 },
  { title: 'Right Here Right Now', artist: 'Fatboy Slim', label: 'Skint', year: 1999 },
  { title: 'Rockafeller Skank', artist: 'Fatboy Slim', label: 'Skint', year: 1998 },

  // Disclosure New Era
  { title: 'Waterfall', artist: 'Disclosure', label: 'Island', year: 2023 },
  { title: 'Simply Wont Do', artist: 'Disclosure', label: 'Island', year: 2023 },
  { title: 'Higher Than Ever Before', artist: 'Disclosure', label: 'Island', year: 2024 },

  // Seth Troxler / Underground
  { title: 'Voices', artist: 'Seth Troxler', label: 'Crosstown Rebels', year: 2019 },
  { title: 'Turn Around', artist: 'Honey Dijon', label: 'Classic', year: 2017 },

  // Defected Classics
  { title: 'My Feeling', artist: 'Junior Jack', label: 'Defected', year: 2002 },
  { title: 'E Samba', artist: 'Junior Jack', label: 'Defected', year: 2003 },
  { title: 'Another Chance', artist: 'Roger Sanchez', label: 'Defected', year: 2001 },
  { title: 'I Believe', artist: 'Simian Mobile Disco', label: 'Wichita', year: 2007 },
  { title: 'Hustler', artist: 'Simian Mobile Disco', label: 'Wichita', year: 2007 },

  // TSHA
  { title: 'Sister', artist: 'TSHA', label: 'Ninja Tune', year: 2022 },
  { title: 'Only L', artist: 'TSHA', label: 'Ninja Tune', year: 2022 },
  { title: 'Giving Up', artist: 'TSHA', label: 'Ninja Tune', year: 2022 },

  // HAAi
  { title: 'Bodies of Water', artist: 'HAAi', label: 'Mute', year: 2022 },
  { title: 'Baby Dont Cry', artist: 'HAAi', label: 'Mute', year: 2022 },

  // Classic Acid House
  { title: 'Acid Tracks', artist: 'Phuture', label: 'Trax', year: 1987 },
  { title: 'We Call It Acieed', artist: 'D Mob', label: 'FFRR', year: 1988 },
  { title: 'Pacific State', artist: '808 State', label: 'ZTT', year: 1989 },
  { title: 'Voodoo Ray', artist: 'A Guy Called Gerald', label: 'Rham!', year: 1988 },

  // Modern Deep House
  { title: 'Midnight', artist: 'Chaos In The CBD', label: 'Rhythm Section', year: 2019 },
  { title: 'Venue Nights', artist: 'Chaos In The CBD', label: 'Rhythm Section', year: 2021 },
  { title: 'Emotional Education', artist: 'Chaos In The CBD', label: 'Rhythm Section', year: 2021 },

  // Dirtybird
  { title: 'OKAY', artist: 'Shiba San', label: 'Dirtybird', year: 2014 },
  { title: 'Burn Like Fire', artist: 'Shiba San', label: 'Dirtybird', year: 2015 },
  { title: 'Dont Trip', artist: 'Claude VonStroke', label: 'Dirtybird', year: 2016 },
  { title: 'Take Flight', artist: 'Walker & Royce', label: 'Dirtybird', year: 2017 },

  // UK Garage Classics
  { title: 'Finally', artist: 'CeCe Peniston', label: 'A&M', year: 1991 },
  { title: 'Flowers', artist: 'Sweet Female Attitude', label: 'Milkk', year: 2000 },
  { title: 'Rewind', artist: 'Artful Dodger', label: 'FFRR', year: 2000 },
  { title: 'Movin Too Fast', artist: 'Artful Dodger', label: 'FFRR', year: 1999 },
  { title: 'Sincere', artist: 'MJ Cole', label: 'Talkin Loud', year: 2000 },
  { title: 'Crazy Love', artist: 'MJ Cole', label: 'Talkin Loud', year: 2000 },

  // Mark Knight / Toolroom
  { title: 'All 4 Love', artist: 'Mark Knight', label: 'Toolroom', year: 2020 },
  { title: 'Yebisah', artist: 'Mark Knight', label: 'Toolroom', year: 2019 },
  { title: 'In The Dark', artist: 'Siege', label: 'Toolroom', year: 2022 },

  // Fisher Tracks
  { title: 'Freaks', artist: 'Fisher', label: 'Catch & Release', year: 2021 },
  { title: 'Stop It', artist: 'Fisher', label: 'Catch & Release', year: 2020 },
  { title: 'Yeah The Girls', artist: 'Fisher', label: 'Catch & Release', year: 2019 },

  // Solardo
  { title: 'XTC', artist: 'Solardo', label: 'Ultra', year: 2019 },
  { title: 'Be Somebody', artist: 'Solardo', label: 'Solotoko', year: 2021 },
  { title: 'Tribesmen', artist: 'Solardo', label: 'Solotoko', year: 2020 },
];

// ============================================
// ICONIC SETS WITH VENUES
// ============================================
const iconicSets = [
  // Boiler Room Sets
  {
    title: 'Honey Dijon Boiler Room NYC',
    dj_name: 'Honey Dijon',
    venue: 'Boiler Room NYC',
    event_name: 'Boiler Room',
    event_date: '2023-06-15',
    genre: 'house',
    youtube_url: 'https://youtube.com/honeydijonBR',
  },
  {
    title: 'Bicep Boiler Room London',
    dj_name: 'Bicep',
    venue: 'Boiler Room London',
    event_name: 'Boiler Room',
    event_date: '2017-10-20',
    genre: 'house',
    youtube_url: 'https://youtube.com/bicepBR',
  },
  {
    title: 'DJ Koze Boiler Room Berlin',
    dj_name: 'DJ Koze',
    venue: 'Boiler Room Berlin',
    event_name: 'Boiler Room',
    event_date: '2019-04-12',
    genre: 'deep house',
  },

  // Ibiza Sets
  {
    title: 'Carl Cox Space Ibiza Closing',
    dj_name: 'Carl Cox',
    venue: 'Space Ibiza',
    event_name: 'Music Is Revolution',
    event_date: '2016-09-20',
    genre: 'techno',
  },
  {
    title: 'Fisher Hi Ibiza',
    dj_name: 'Fisher',
    venue: 'Hi Ibiza',
    event_name: 'Fisher presents Catch & Release',
    event_date: '2023-07-14',
    genre: 'tech house',
  },
  {
    title: 'The Martinez Brothers DC-10',
    dj_name: 'The Martinez Brothers',
    venue: 'DC-10 Ibiza',
    event_name: 'Circoloco',
    event_date: '2023-08-21',
    genre: 'house',
  },
  {
    title: 'Tale Of Us Amnesia',
    dj_name: 'Tale Of Us',
    venue: 'Amnesia Ibiza',
    event_name: 'Afterlife',
    event_date: '2023-07-28',
    genre: 'melodic techno',
  },
  {
    title: 'Keinemusik Ushuaia',
    dj_name: 'Keinemusik',
    venue: 'Ushuaia Ibiza',
    event_name: 'Keinemusik',
    event_date: '2023-08-04',
    genre: 'melodic house',
  },

  // UK Club Sets
  {
    title: 'Denis Sulta Warehouse Project',
    dj_name: 'Denis Sulta',
    venue: 'Warehouse Project Manchester',
    event_name: 'WHP Opening',
    event_date: '2023-09-29',
    genre: 'house',
  },
  {
    title: 'Four Tet Printworks',
    dj_name: 'Four Tet',
    venue: 'Printworks London',
    event_name: 'Four Tet All Night',
    event_date: '2023-04-08',
    genre: 'house',
  },
  {
    title: 'Skream Fabric',
    dj_name: 'Skream',
    venue: 'Fabric London',
    event_name: 'Fabriclive',
    event_date: '2023-11-10',
    genre: 'house',
  },
  {
    title: 'The Blessed Madonna Phonox',
    dj_name: 'The Blessed Madonna',
    venue: 'Phonox London',
    event_name: 'We Still Believe',
    event_date: '2023-05-13',
    genre: 'disco house',
  },

  // Berlin Sets
  {
    title: 'Dixon Panorama Bar',
    dj_name: 'Dixon',
    venue: 'Panorama Bar Berlin',
    event_name: 'Innervisions',
    event_date: '2023-02-18',
    genre: 'melodic house',
  },
  {
    title: 'Ben Klock Berghain',
    dj_name: 'Ben Klock',
    venue: 'Berghain Berlin',
    event_name: 'Klubnacht',
    event_date: '2023-03-11',
    genre: 'techno',
  },
  {
    title: 'Hunee Panorama Bar',
    dj_name: 'Hunee',
    venue: 'Panorama Bar Berlin',
    event_name: 'Panorama Bar',
    event_date: '2023-06-03',
    genre: 'house',
  },

  // Festival Sets
  {
    title: 'Chris Lake EDC Las Vegas',
    dj_name: 'Chris Lake',
    venue: 'EDC Las Vegas',
    event_name: 'Electric Daisy Carnival',
    event_date: '2023-05-20',
    genre: 'tech house',
  },
  {
    title: 'John Summit Coachella',
    dj_name: 'John Summit',
    venue: 'Coachella',
    event_name: 'Coachella 2024',
    event_date: '2024-04-14',
    genre: 'tech house',
  },
  {
    title: 'Dom Dolla Tomorrowland',
    dj_name: 'Dom Dolla',
    venue: 'Tomorrowland Belgium',
    event_name: 'Tomorrowland',
    event_date: '2023-07-22',
    genre: 'tech house',
  },
  {
    title: 'Jamie xx Glastonbury',
    dj_name: 'Jamie xx',
    venue: 'Glastonbury Festival',
    event_name: 'Glastonbury',
    event_date: '2023-06-24',
    genre: 'house',
  },
  {
    title: 'Peggy Gou Primavera',
    dj_name: 'Peggy Gou',
    venue: 'Primavera Sound Barcelona',
    event_name: 'Primavera Sound',
    event_date: '2023-06-02',
    genre: 'house',
  },

  // US Club Sets
  {
    title: 'Claude VonStroke Dirtybird Campout',
    dj_name: 'Claude VonStroke',
    venue: 'Dirtybird Campout',
    event_name: 'Dirtybird Campout',
    event_date: '2023-10-06',
    genre: 'tech house',
  },
  {
    title: 'Seth Troxler Output Brooklyn',
    dj_name: 'Seth Troxler',
    venue: 'Output Brooklyn',
    event_name: 'Visionquest',
    event_date: '2019-12-31',
    genre: 'house',
  },
  {
    title: 'Black Coffee Brooklyn Mirage',
    dj_name: 'Black Coffee',
    venue: 'Brooklyn Mirage',
    event_name: 'Black Coffee All Night',
    event_date: '2023-08-19',
    genre: 'afro house',
  },

  // Historic Club Sets
  {
    title: 'Frankie Knuckles Paradise Garage',
    dj_name: 'Frankie Knuckles',
    venue: 'Paradise Garage NYC',
    event_name: 'Paradise Garage',
    event_date: '1985-06-15',
    genre: 'house',
  },
  {
    title: 'Larry Levan Paradise Garage',
    dj_name: 'Larry Levan',
    venue: 'Paradise Garage NYC',
    event_name: 'Paradise Garage',
    event_date: '1984-09-22',
    genre: 'disco house',
  },
];

async function getArtistId(name: string): Promise<string | null> {
  const { data } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', name)
    .single();
  return data?.id || null;
}

async function seedArtists() {
  console.log('🎤 Seeding additional house music artists...\n');

  let created = 0;
  let skipped = 0;

  for (const artist of additionalArtists) {
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
    const artistAliases = additionalAliases[artist.name] || [];
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

  console.log(`\n✨ Artists done! Created ${created}, skipped ${skipped}`);
}

async function seedTracks() {
  console.log('\n🎵 Seeding additional tracks...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const track of additionalTracks) {
    const titleNormalized = normalizeText(track.title);

    // Check if track already exists
    const { data: existing } = await supabase
      .from('tracks')
      .select('id')
      .eq('title_normalized', titleNormalized)
      .ilike('artist_name', track.artist)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Get artist ID
    const artistId = await getArtistId(track.artist);

    // Insert track
    const { error } = await supabase
      .from('tracks')
      .insert({
        title: track.title,
        title_normalized: titleNormalized,
        artist_id: artistId,
        artist_name: track.artist,
        label: track.label || null,
        release_year: track.year || null,
      });

    if (error) {
      console.error(`  ❌ ${track.artist} - ${track.title}: ${error.message}`);
      errors++;
      continue;
    }

    console.log(`  ✅ ${track.artist} - ${track.title}`);
    created++;
  }

  console.log(`\n✨ Tracks done! Created ${created}, skipped ${skipped}, errors ${errors}`);
}

async function seedSets() {
  console.log('\n🎧 Seeding iconic sets with venues...\n');

  let created = 0;
  let skipped = 0;

  for (const set of iconicSets) {
    const slug = generateSlug(set.title);

    // Check if already exists
    const { data: existing } = await supabase
      .from('sets')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Get artist ID
    const djId = await getArtistId(set.dj_name);

    // Insert set
    const { error } = await supabase
      .from('sets')
      .insert({
        title: set.title,
        slug,
        dj_name: set.dj_name,
        dj_id: djId,
        venue: set.venue,
        event_name: set.event_name,
        event_date: set.event_date,
        genre: set.genre,
        youtube_url: set.youtube_url || null,
        soundcloud_url: set.soundcloud_url || null,
      });

    if (error) {
      console.error(`  ❌ ${set.title}: ${error.message}`);
      continue;
    }

    console.log(`  ✅ ${set.title} @ ${set.venue}`);
    created++;
  }

  console.log(`\n✨ Sets done! Created ${created}, skipped ${skipped}`);
}

async function showStats() {
  console.log('\n📊 Database Statistics:\n');

  const { count: artistCount } = await supabase
    .from('artists')
    .select('*', { count: 'exact', head: true });
  console.log(`   Artists: ${artistCount}`);

  const { count: trackCount } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true });
  console.log(`   Tracks: ${trackCount}`);

  const { count: setCount } = await supabase
    .from('sets')
    .select('*', { count: 'exact', head: true });
  console.log(`   Sets: ${setCount}`);

  // Show unique venues
  const { data: venues } = await supabase
    .from('sets')
    .select('venue')
    .not('venue', 'is', null);

  if (venues) {
    const uniqueVenues = [...new Set(venues.map(v => v.venue))].filter(Boolean);
    console.log(`   Unique Venues: ${uniqueVenues.length}`);
    console.log('\n   Top Venues:');
    uniqueVenues.slice(0, 10).forEach(v => console.log(`     - ${v}`));
  }
}

async function main() {
  console.log('🏠 TRACK\'D House Music Database Seeder\n');
  console.log('=========================================\n');

  await seedArtists();
  await seedTracks();
  await seedSets();
  await showStats();

  console.log('\n=========================================');
  console.log('🎉 All done! Database updated live on Vercel.');
}

main().catch(console.error);
