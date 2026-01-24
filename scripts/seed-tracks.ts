/**
 * Seed popular tracks into Supabase
 * Run: bun run scripts/seed-tracks.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Get artist ID by name
async function getArtistId(name: string): Promise<string | null> {
  const { data } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', name)
    .single();
  return data?.id || null;
}

// Popular house/techno tracks
const tracks = [
  // Tech House Bangers
  { title: 'Cola', artist: 'Camelphat', remix_artist: 'Elderbrook', label: 'Defected', year: 2017 },
  { title: 'Losing It', artist: 'Fisher', label: 'Catch & Release', year: 2018 },
  { title: 'Turn Off The Lights', artist: 'Chris Lake', remix_artist: 'Fisher', label: 'Black Book', year: 2022 },
  { title: 'La Bomba', artist: 'Green Velvet', label: 'Relief', year: 1999 },
  { title: 'Flash', artist: 'Green Velvet', label: 'Relief', year: 2001 },
  { title: 'Who Is Ready To Jump', artist: 'Claude VonStroke', label: 'Dirtybird', year: 2006 },
  { title: 'Move Your Body', artist: 'Marshall Jefferson', label: 'Trax', year: 1986 },
  { title: 'Pump Up The Jam', artist: 'Patrick Topping', label: 'Hot Creations', year: 2021 },
  { title: 'Be Sharp Say Nowt', artist: 'Patrick Topping', label: 'Hot Creations', year: 2014 },
  { title: 'San Frandisco', artist: 'Dom Dolla', label: 'Sweat It Out', year: 2019 },
  { title: 'Miracle Maker', artist: 'Dom Dolla', remix_artist: 'Clementine Douglas', label: 'Three Six Zero', year: 2023 },
  { title: 'Rhyme Dust', artist: 'MK', remix_artist: 'Dom Dolla', label: 'Area 10', year: 2022 },
  { title: 'Ritual', artist: 'John Summit', remix_artist: 'Hayla', label: 'Defected', year: 2022 },
  { title: 'Where You Are', artist: 'John Summit', label: 'Defected', year: 2021 },
  { title: 'La Danza', artist: 'John Summit', label: 'Experts Only', year: 2023 },
  { title: 'Beauty Sleep', artist: 'John Summit', label: 'Defected', year: 2022 },
  { title: 'Adieu', artist: 'Cloonee', label: 'Repopulate Mars', year: 2020 },
  { title: 'Do It To It', artist: 'ACRAZE', remix_artist: 'Cherish', label: 'Thrive', year: 2021 },
  { title: 'Drugs From Amsterdam', artist: 'Mau P', label: 'Hellcat', year: 2022 },
  
  // Deep House / Melodic
  { title: 'Strobe', artist: 'deadmau5', label: 'mau5trap', year: 2009 },
  { title: 'I Remember', artist: 'deadmau5', remix_artist: 'Kaskade', label: 'mau5trap', year: 2008 },
  { title: 'The Veldt', artist: 'deadmau5', label: 'mau5trap', year: 2012 },
  { title: 'Opus', artist: 'Eric Prydz', label: 'Pryda', year: 2016 },
  { title: 'Call On Me', artist: 'Eric Prydz', label: 'Data', year: 2004 },
  { title: 'Pjanoo', artist: 'Eric Prydz', label: 'Data', year: 2008 },
  { title: 'Rise', artist: 'Lane 8', label: 'This Never Happened', year: 2015 },
  { title: 'Brightest Lights', artist: 'Lane 8', label: 'This Never Happened', year: 2020 },
  { title: 'Beyond', artist: 'Ben Böhmer', label: 'Anjunadeep', year: 2019 },
  { title: 'Breathing', artist: 'Ben Böhmer', label: 'Anjunadeep', year: 2020 },
  { title: 'Nova', artist: 'Yotto', label: 'Anjunadeep', year: 2018 },
  { title: 'Hyperfall', artist: 'Yotto', label: 'Odd One Out', year: 2018 },
  { title: 'Come With Me', artist: 'Nora En Pure', label: 'Enormous Tunes', year: 2013 },
  { title: 'Lake Arrowhead', artist: 'Nora En Pure', label: 'Purified', year: 2018 },
  
  // Classic House
  { title: 'Finally', artist: 'Kings of Tomorrow', label: 'Defected', year: 2000 },
  { title: 'Show Me Love', artist: 'Robin S', label: 'Big Beat', year: 1993 },
  { title: 'Gypsy Woman', artist: 'Crystal Waters', label: 'Mercury', year: 1991 },
  { title: 'Insomnia', artist: 'Faithless', label: 'Cheeky', year: 1995 },
  { title: 'Born Slippy', artist: 'Underworld', label: 'Junior Boys Own', year: 1995 },
  { title: 'Sing It Back', artist: 'Moloko', label: 'Echo', year: 1999 },
  { title: 'Music Sounds Better With You', artist: 'Stardust', label: 'Roulé', year: 1998 },
  
  // Techno
  { title: 'Acid Phase', artist: 'Adam Beyer', label: 'Drumcode', year: 2017 },
  { title: 'Your Mind', artist: 'Adam Beyer', remix_artist: 'Bart Skils', label: 'Drumcode', year: 2016 },
  { title: 'I Hate Models', artist: 'Charlotte de Witte', is_unreleased: true },
  { title: 'Rave On Time', artist: 'Charlotte de Witte', label: 'KNTXT', year: 2023 },
  { title: 'Closer', artist: 'Amelie Lens', label: 'Lenske', year: 2019 },
  { title: 'Hypnotized', artist: 'Amelie Lens', label: 'Lenske', year: 2020 },
  { title: 'Accelerator', artist: 'Carl Cox', label: 'Intec', year: 2014 },
  { title: 'Oh Yes Oh Yes', artist: 'Carl Cox', label: 'Intec', year: 2016 },
  { title: 'Age of Love', artist: 'Charlotte de Witte', remix_type: 'Remix', label: 'KNTXT', year: 2021 },
  
  // Melodic Techno / Afterlife
  { title: 'Monument', artist: 'Tale Of Us', label: 'Afterlife', year: 2017 },
  { title: 'Ricordi', artist: 'Tale Of Us', label: 'Afterlife', year: 2022 },
  { title: 'Nova', artist: 'Tale Of Us', label: 'Afterlife', year: 2023 },
  { title: 'Argia', artist: 'Mind Against', label: 'Afterlife', year: 2019 },
  { title: 'Atlant', artist: 'Mind Against', label: 'Afterlife', year: 2017 },
  { title: 'Innervisions', artist: 'Adriatique', label: 'Afterlife', year: 2019 },
  { title: 'Solomun', artist: 'Customer Is King', label: 'Diynamic', year: 2012 },
  { title: 'Teardrops', artist: 'Solomun', label: 'Diynamic', year: 2022 },
  
  // Keinemusik / Melodic House
  { title: 'Please Dont Go', artist: '&ME', label: 'Keinemusik', year: 2020 },
  { title: 'The Rapture', artist: '&ME', label: 'Keinemusik', year: 2019 },
  { title: 'Every Wall Is A Door', artist: 'Rampa', label: 'Keinemusik', year: 2021 },
  { title: 'Move', artist: 'Adam Port', label: 'Keinemusik', year: 2020 },
  { title: 'Planet Keinemusik', artist: 'Keinemusik', label: 'Keinemusik', year: 2023 },
  
  // UK Garage / Fred again..
  { title: 'Marea (We Lost Dancing)', artist: 'Fred again..', remix_artist: 'The Blessed Madonna', label: 'Atlantic', year: 2022 },
  { title: 'Turn On The Lights again..', artist: 'Fred again..', remix_artist: 'Future', label: 'Atlantic', year: 2022 },
  { title: 'Delilah (Pull Me Out of This)', artist: 'Fred again..', label: 'Atlantic', year: 2021 },
  { title: 'Rumble', artist: 'Skrillex', remix_artist: 'Fred again..', remix_type: 'with', label: 'Atlantic', year: 2023 },
  { title: 'Baby Again', artist: 'Fred again..', remix_artist: 'Skrillex', label: 'Atlantic', year: 2023 },
  { title: 'Leavemealone', artist: 'Fred again..', label: 'Atlantic', year: 2022 },
  
  // Disclosure
  { title: 'Latch', artist: 'Disclosure', remix_artist: 'Sam Smith', label: 'PMR', year: 2012 },
  { title: 'White Noise', artist: 'Disclosure', remix_artist: 'AlunaGeorge', label: 'PMR', year: 2013 },
  { title: 'You & Me', artist: 'Disclosure', remix_artist: 'Flume', remix_type: 'Flume Remix', label: 'PMR', year: 2014 },
  { title: 'When A Fire Starts To Burn', artist: 'Disclosure', label: 'PMR', year: 2013 },
  { title: 'F For You', artist: 'Disclosure', remix_artist: 'Mary J Blige', label: 'PMR', year: 2013 },
  
  // Four Tet / Jamie xx
  { title: 'Only Human', artist: 'Four Tet', label: 'Text', year: 2019 },
  { title: 'Baby', artist: 'Four Tet', label: 'Text', year: 2020 },
  { title: 'Gosh', artist: 'Jamie xx', label: 'Young', year: 2015 },
  { title: 'I Know Theres Gonna Be Good Times', artist: 'Jamie xx', remix_artist: 'Young Thug', label: 'Young', year: 2015 },
  { title: 'Loud Places', artist: 'Jamie xx', remix_artist: 'Romy', label: 'Young', year: 2015 },
  
  // Afro House
  { title: 'Superman', artist: 'Black Coffee', remix_artist: 'Bucie', label: 'Soulistic', year: 2015 },
  { title: '10 Missed Calls', artist: 'Black Coffee', label: 'Ultra', year: 2020 },
  { title: 'Drive', artist: 'Black Coffee', remix_artist: 'David Guetta', label: 'Ultra', year: 2018 },
  { title: 'Vula', artist: 'Themba', label: 'Armada', year: 2020 },
  { title: 'Sound of Freedom', artist: 'Bob Sinclar', label: 'Defected', year: 2006 },
  
  // Peggy Gou
  { title: 'It Makes You Forget', artist: 'Peggy Gou', label: 'Gudu', year: 2018 },
  { title: 'Starry Night', artist: 'Peggy Gou', label: 'Gudu', year: 2019 },
  { title: 'I Believe In Love Again', artist: 'Peggy Gou', label: 'XL', year: 2024 },
  
  // Chris Stussy / PIV
  { title: 'Slow Down', artist: 'Chris Stussy', label: 'PIV', year: 2021 },
  { title: 'Never Compromise', artist: 'Chris Stussy', label: 'PIV', year: 2020 },
  { title: 'Reflections', artist: 'Chris Stussy', label: 'Solid Grooves', year: 2022 },
  { title: 'Night Time Stories', artist: 'Prunk', label: 'PIV', year: 2021 },
  { title: 'Minimal Groove', artist: 'East End Dubs', label: 'FUSE', year: 2021 },
  
  // Some Unreleased / IDs that DJs play
  { title: 'Unreleased ID', artist: 'Fisher', is_unreleased: true },
  { title: 'Tech House ID', artist: 'John Summit', is_unreleased: true },
  { title: 'Festival ID', artist: 'Chris Lake', is_unreleased: true },
  { title: 'Afterlife ID', artist: 'Tale Of Us', is_unreleased: true },
  { title: 'KNTXT ID', artist: 'Charlotte de Witte', is_unreleased: true },
  { title: 'Keinemusik ID', artist: 'Keinemusik', is_unreleased: true },
  { title: 'Defected ID', artist: 'John Summit', is_unreleased: true },
];

async function seedTracks() {
  console.log('🎵 Seeding tracks into Supabase...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const track of tracks) {
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
    
    // Get remix artist ID if applicable
    let remixArtistId = null;
    if (track.remix_artist) {
      remixArtistId = await getArtistId(track.remix_artist);
    }

    // Insert track
    const { error } = await supabase
      .from('tracks')
      .insert({
        title: track.title,
        title_normalized: titleNormalized,
        artist_id: artistId,
        artist_name: track.artist,
        remix_artist_id: remixArtistId,
        remix_artist_name: track.remix_artist || null,
        remix_type: track.remix_type || (track.remix_artist ? 'feat.' : null),
        label: track.label || null,
        release_year: track.year || null,
        is_unreleased: track.is_unreleased || false,
      });

    if (error) {
      console.error(`  ❌ ${track.artist} - ${track.title}: ${error.message}`);
      errors++;
      continue;
    }

    const status = track.is_unreleased ? '🔒' : '✅';
    console.log(`  ${status} ${track.artist} - ${track.title}`);
    created++;
  }

  console.log(`\n✨ Done! Created ${created}, skipped ${skipped}, errors ${errors}`);

  // Count totals
  const { count: totalTracks } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true });

  const { count: unreleasedCount } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true })
    .eq('is_unreleased', true);

  console.log(`📊 Total tracks: ${totalTracks}`);
  console.log(`🔒 Unreleased tracks: ${unreleasedCount}`);
}

seedTracks().catch(console.error);
