import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Comprehensive list of house/techno artists organized by genre
const artists = [
  // ==========================================
  // LEGENDS / PIONEERS
  // ==========================================
  { name: 'Frankie Knuckles', genres: ['house', 'chicago house'], country: 'USA' },
  { name: 'Larry Heard', genres: ['deep house', 'chicago house'], country: 'USA' },
  { name: 'Marshall Jefferson', genres: ['house', 'chicago house'], country: 'USA' },
  { name: 'Ron Hardy', genres: ['house', 'chicago house'], country: 'USA' },
  { name: 'Derrick May', genres: ['techno', 'detroit techno'], country: 'USA' },
  { name: 'Juan Atkins', genres: ['techno', 'detroit techno'], country: 'USA' },
  { name: 'Kevin Saunderson', genres: ['techno', 'detroit techno'], country: 'USA' },
  { name: 'Jeff Mills', genres: ['techno', 'detroit techno'], country: 'USA' },
  { name: 'Carl Craig', genres: ['techno', 'detroit techno'], country: 'USA' },
  { name: 'Robert Hood', genres: ['minimal techno', 'detroit techno'], country: 'USA' },
  { name: 'Moodymann', genres: ['deep house', 'detroit house'], country: 'USA' },
  { name: 'Theo Parrish', genres: ['deep house', 'detroit house'], country: 'USA' },
  { name: 'Kerri Chandler', genres: ['deep house', 'garage'], country: 'USA' },
  { name: 'Louie Vega', genres: ['house', 'garage'], country: 'USA' },
  { name: 'Kenny Dope', genres: ['house', 'garage'], country: 'USA' },
  { name: 'Todd Terry', genres: ['house', 'garage'], country: 'USA' },
  { name: 'Danny Tenaglia', genres: ['house', 'progressive house'], country: 'USA' },
  { name: 'David Morales', genres: ['house', 'garage'], country: 'USA' },
  { name: 'Armand Van Helden', genres: ['house', 'disco house'], country: 'USA' },
  { name: 'Roger Sanchez', genres: ['house', 'tribal house'], country: 'USA' },
  
  // ==========================================
  // EUROPEAN LEGENDS
  // ==========================================
  { name: 'Sven Väth', genres: ['techno', 'trance'], country: 'Germany' },
  { name: 'Richie Hawtin', genres: ['minimal techno', 'techno'], country: 'Canada' },
  { name: 'Ricardo Villalobos', genres: ['minimal techno', 'deep house'], country: 'Chile' },
  { name: 'Laurent Garnier', genres: ['techno', 'house'], country: 'France' },
  { name: 'Carl Cox', genres: ['techno', 'house'], country: 'UK' },
  { name: 'Sasha', genres: ['progressive house', 'techno'], country: 'UK' },
  { name: 'John Digweed', genres: ['progressive house', 'techno'], country: 'UK' },
  { name: 'Pete Tong', genres: ['house', 'progressive house'], country: 'UK' },
  { name: 'Paul Oakenfold', genres: ['trance', 'progressive house'], country: 'UK' },
  { name: 'DJ Harvey', genres: ['disco', 'house'], country: 'UK' },
  { name: 'Andrew Weatherall', genres: ['techno', 'house'], country: 'UK' },
  { name: 'Layo & Bushwacka!', genres: ['progressive house', 'techno'], country: 'UK' },
  
  // ==========================================
  // DEEP HOUSE
  // ==========================================
  { name: 'Dixon', genres: ['deep house', 'melodic house'], country: 'Germany' },
  { name: 'Âme', genres: ['deep house', 'melodic house'], country: 'Germany' },
  { name: 'Henrik Schwarz', genres: ['deep house', 'tech house'], country: 'Germany' },
  { name: 'Michael Mayer', genres: ['deep house', 'minimal'], country: 'Germany' },
  { name: 'Stimming', genres: ['deep house', 'melodic house'], country: 'Germany' },
  { name: 'Recondite', genres: ['deep house', 'techno'], country: 'Germany' },
  { name: 'Dominik Eulberg', genres: ['deep house', 'techno'], country: 'Germany' },
  { name: 'Damian Lazarus', genres: ['deep house', 'melodic house'], country: 'UK' },
  { name: 'Lee Burridge', genres: ['deep house', 'progressive house'], country: 'UK' },
  { name: 'Nick Warren', genres: ['progressive house', 'deep house'], country: 'UK' },
  { name: 'Hernan Cattaneo', genres: ['progressive house', 'deep house'], country: 'Argentina' },
  { name: 'Guy J', genres: ['progressive house', 'deep house'], country: 'Israel' },
  { name: 'Patrice Bäumel', genres: ['deep house', 'techno'], country: 'Netherlands' },
  { name: '&ME', genres: ['deep house', 'melodic house'], country: 'Germany' },
  { name: 'Rampa', genres: ['deep house', 'melodic house'], country: 'Germany' },
  { name: 'Adam Port', genres: ['deep house', 'melodic house'], country: 'Germany' },
  
  // ==========================================
  // TECH HOUSE
  // ==========================================
  { name: 'Chris Stussy', genres: ['tech house', 'house'], country: 'Netherlands' },
  { name: 'Prunk', genres: ['tech house', 'house'], country: 'Netherlands' },
  { name: 'Dennis Cruz', genres: ['tech house', 'house'], country: 'Spain' },
  { name: 'Archie Hamilton', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'East End Dubs', genres: ['tech house', 'minimal'], country: 'UK' },
  { name: 'Darius Syrossian', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Skream', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Eats Everything', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Hot Since 82', genres: ['tech house', 'deep house'], country: 'UK' },
  { name: 'Patrick Topping', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Richy Ahmed', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'wAFF', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Solardo', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Latmun', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Ilario Alicante', genres: ['tech house', 'techno'], country: 'Italy' },
  { name: 'Marco Carola', genres: ['tech house', 'techno'], country: 'Italy' },
  { name: 'Joseph Capriati', genres: ['techno', 'tech house'], country: 'Italy' },
  { name: 'Loco Dice', genres: ['tech house', 'techno'], country: 'Germany' },
  { name: 'Luciano', genres: ['tech house', 'minimal'], country: 'Switzerland' },
  { name: 'tINI', genres: ['tech house', 'minimal'], country: 'Germany' },
  
  // ==========================================
  // MINIMAL / ROMANIAN MINIMAL
  // ==========================================
  { name: 'Raresh', genres: ['minimal', 'deep house'], country: 'Romania' },
  { name: 'Rhadoo', genres: ['minimal', 'deep house'], country: 'Romania' },
  { name: 'Petre Inspirescu', genres: ['minimal', 'deep house'], country: 'Romania' },
  { name: 'Praslea', genres: ['minimal', 'deep house'], country: 'Romania' },
  { name: 'Barac', genres: ['minimal', 'deep house'], country: 'Romania' },
  { name: 'SIT', genres: ['minimal', 'deep house'], country: 'Romania' },
  { name: 'Arapu', genres: ['minimal', 'deep house'], country: 'Romania' },
  { name: 'Cristi Cons', genres: ['minimal', 'house'], country: 'Romania' },
  { name: 'Cezar', genres: ['minimal', 'deep house'], country: 'Romania' },
  { name: 'Zip', genres: ['minimal', 'deep house'], country: 'Germany' },
  { name: 'Sonja Moonear', genres: ['minimal', 'deep house'], country: 'Switzerland' },
  { name: 'Margaret Dygas', genres: ['minimal', 'deep house'], country: 'Poland' },
  { name: 'Binh', genres: ['minimal', 'house'], country: 'Vietnam' },
  { name: 'Cab Drivers', genres: ['minimal', 'deep house'], country: 'Germany' },
  { name: 'Livio & Roby', genres: ['minimal', 'tech house'], country: 'Romania' },
  
  // ==========================================
  // TECHNO
  // ==========================================
  { name: 'Ben Klock', genres: ['techno'], country: 'Germany' },
  { name: 'Marcel Dettmann', genres: ['techno'], country: 'Germany' },
  { name: 'Len Faki', genres: ['techno'], country: 'Germany' },
  { name: 'DVS1', genres: ['techno'], country: 'USA' },
  { name: 'Function', genres: ['techno'], country: 'USA' },
  { name: 'Surgeon', genres: ['techno', 'industrial'], country: 'UK' },
  { name: 'Regis', genres: ['techno', 'industrial'], country: 'UK' },
  { name: 'Blawan', genres: ['techno', 'electro'], country: 'UK' },
  { name: 'Rødhåd', genres: ['techno'], country: 'Germany' },
  { name: 'Etapp Kyle', genres: ['techno'], country: 'Ukraine' },
  { name: 'Oscar Mulero', genres: ['techno', 'industrial'], country: 'Spain' },
  { name: 'Rebekah', genres: ['techno'], country: 'UK' },
  { name: 'Paula Temple', genres: ['techno', 'industrial'], country: 'UK' },
  { name: 'Dax J', genres: ['techno'], country: 'UK' },
  { name: 'FJAAK', genres: ['techno'], country: 'Germany' },
  { name: 'Kobosil', genres: ['techno'], country: 'Germany' },
  { name: 'Freddy K', genres: ['techno'], country: 'Italy' },
  { name: 'Clouds', genres: ['techno'], country: 'Germany' },
  { name: 'Ansome', genres: ['techno', 'industrial'], country: 'UK' },
  { name: 'I Hate Models', genres: ['techno', 'industrial'], country: 'France' },
  { name: 'SNTS', genres: ['techno', 'industrial'], country: 'Spain' },
  { name: 'Ancient Methods', genres: ['techno', 'industrial'], country: 'Germany' },
  { name: 'Perc', genres: ['techno', 'industrial'], country: 'UK' },
  { name: 'Truncate', genres: ['techno'], country: 'USA' },
  { name: 'AnD', genres: ['techno', 'electro'], country: 'UK' },
  
  // ==========================================
  // MELODIC TECHNO / PROGRESSIVE
  // ==========================================
  { name: 'Tale Of Us', genres: ['melodic techno', 'progressive'], country: 'Italy' },
  { name: 'Stephan Bodzin', genres: ['melodic techno', 'techno'], country: 'Germany' },
  { name: 'Maceo Plex', genres: ['melodic techno', 'techno'], country: 'USA' },
  { name: 'Mind Against', genres: ['melodic techno', 'progressive'], country: 'Italy' },
  { name: 'Adriatique', genres: ['melodic techno', 'progressive'], country: 'Switzerland' },
  { name: 'Fideles', genres: ['melodic techno', 'progressive'], country: 'Poland' },
  { name: 'Mathame', genres: ['melodic techno', 'progressive'], country: 'Italy' },
  { name: 'Agents Of Time', genres: ['melodic techno', 'progressive'], country: 'Italy' },
  { name: 'Artbat', genres: ['melodic techno', 'progressive'], country: 'Ukraine' },
  { name: 'Boris Brejcha', genres: ['minimal techno', 'melodic techno'], country: 'Germany' },
  { name: 'Joris Voorn', genres: ['techno', 'progressive house'], country: 'Netherlands' },
  { name: 'Colyn', genres: ['melodic techno', 'progressive'], country: 'Netherlands' },
  { name: 'Yotto', genres: ['progressive house', 'melodic techno'], country: 'Finland' },
  { name: 'Anyma', genres: ['melodic techno', 'progressive'], country: 'Italy' },
  { name: 'Massano', genres: ['melodic techno', 'techno'], country: 'Italy' },
  { name: 'Kevin de Vries', genres: ['melodic techno', 'techno'], country: 'Netherlands' },
  { name: 'Afterlife', genres: ['melodic techno'], country: 'Italy' },
  
  // ==========================================
  // DISCO / NU-DISCO / FUNKY HOUSE
  // ==========================================
  { name: 'Dimitri From Paris', genres: ['disco', 'house'], country: 'France' },
  { name: 'DJ Koze', genres: ['house', 'disco'], country: 'Germany' },
  { name: 'Todd Terje', genres: ['disco', 'house'], country: 'Norway' },
  { name: 'Prins Thomas', genres: ['disco', 'house'], country: 'Norway' },
  { name: 'Lindstrøm', genres: ['disco', 'house'], country: 'Norway' },
  { name: 'Horse Meat Disco', genres: ['disco', 'house'], country: 'UK' },
  { name: 'Joey Negro', genres: ['disco', 'house'], country: 'UK' },
  { name: 'Late Nite Tuff Guy', genres: ['disco', 'house'], country: 'Australia' },
  { name: 'Purple Disco Machine', genres: ['disco house', 'house'], country: 'Germany' },
  { name: 'Folamour', genres: ['disco', 'house'], country: 'France' },
  { name: 'Jungle', genres: ['disco', 'funk'], country: 'UK' },
  { name: 'Psychemagik', genres: ['disco', 'house'], country: 'UK' },
  { name: 'Aeroplane', genres: ['disco', 'house'], country: 'Belgium' },
  
  // ==========================================
  // AFRO HOUSE
  // ==========================================
  { name: 'Black Coffee', genres: ['afro house', 'deep house'], country: 'South Africa' },
  { name: 'Culoe De Song', genres: ['afro house', 'deep house'], country: 'South Africa' },
  { name: 'Da Capo', genres: ['afro house', 'deep house'], country: 'South Africa' },
  { name: 'Themba', genres: ['afro house', 'melodic house'], country: 'South Africa' },
  { name: 'Enoo Napa', genres: ['afro house', 'deep house'], country: 'South Africa' },
  { name: 'Floyd Lavine', genres: ['afro house', 'house'], country: 'South Africa' },
  { name: 'Hyenah', genres: ['afro house', 'house'], country: 'Germany' },
  { name: 'Pablo Fierro', genres: ['afro house', 'house'], country: 'Cape Verde' },
  { name: 'Djeff', genres: ['afro house', 'house'], country: 'Angola' },
  
  // ==========================================
  // MAINSTREAM / COMMERCIAL HOUSE
  // ==========================================
  { name: 'John Summit', genres: ['tech house', 'house'], country: 'USA' },
  { name: 'Fisher', genres: ['tech house', 'house'], country: 'Australia' },
  { name: 'Chris Lake', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Dom Dolla', genres: ['tech house', 'house'], country: 'Australia' },
  { name: 'James Hype', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Michael Bibi', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'CamelPhat', genres: ['house', 'melodic house'], country: 'UK' },
  { name: 'Gorgon City', genres: ['house', 'bass house'], country: 'UK' },
  { name: 'MK', genres: ['house', 'deep house'], country: 'USA' },
  { name: 'Claptone', genres: ['house', 'deep house'], country: 'Germany' },
  { name: 'Duke Dumont', genres: ['house', 'deep house'], country: 'UK' },
  { name: 'Disclosure', genres: ['house', 'garage'], country: 'UK' },
  { name: 'Diplo', genres: ['house', 'bass'], country: 'USA' },
  { name: 'Tiësto', genres: ['house', 'progressive house'], country: 'Netherlands' },
  { name: 'David Guetta', genres: ['house', 'progressive house'], country: 'France' },
  { name: 'Calvin Harris', genres: ['house', 'progressive house'], country: 'UK' },
  { name: 'Deadmau5', genres: ['progressive house', 'electro house'], country: 'Canada' },
  { name: 'Eric Prydz', genres: ['progressive house', 'techno'], country: 'Sweden' },
  
  // ==========================================
  // UK GARAGE / BASS
  // ==========================================
  { name: 'El-B', genres: ['garage', 'bass'], country: 'UK' },
  { name: 'DJ EZ', genres: ['garage', 'bass'], country: 'UK' },
  { name: 'Conducta', genres: ['garage', 'bass'], country: 'UK' },
  { name: 'Interplanetary Criminal', genres: ['garage', 'bass'], country: 'UK' },
  { name: 'Kettama', genres: ['garage', 'house'], country: 'Ireland' },
  { name: 'Overmono', genres: ['bass', 'techno'], country: 'UK' },
  { name: 'Joy Orbison', genres: ['garage', 'bass'], country: 'UK' },
  { name: 'Ben UFO', genres: ['bass', 'techno'], country: 'UK' },
  { name: 'Pearson Sound', genres: ['bass', 'techno'], country: 'UK' },
  { name: 'Pangaea', genres: ['bass', 'techno'], country: 'UK' },
  { name: 'Four Tet', genres: ['house', 'bass'], country: 'UK' },
  { name: 'Floating Points', genres: ['house', 'bass'], country: 'UK' },
  { name: 'Ross From Friends', genres: ['house', 'lo-fi house'], country: 'UK' },
  { name: 'Mall Grab', genres: ['house', 'lo-fi house'], country: 'Australia' },
  { name: 'DJ Seinfeld', genres: ['house', 'lo-fi house'], country: 'Sweden' },
  
  // ==========================================
  // BREAKBEAT / ELECTRO
  // ==========================================
  { name: 'The Prodigy', genres: ['breakbeat', 'big beat'], country: 'UK' },
  { name: 'The Chemical Brothers', genres: ['breakbeat', 'big beat'], country: 'UK' },
  { name: 'Fatboy Slim', genres: ['breakbeat', 'big beat'], country: 'UK' },
  { name: 'Helena Hauff', genres: ['electro', 'techno'], country: 'Germany' },
  { name: 'DJ Stingray', genres: ['electro', 'techno'], country: 'USA' },
  { name: 'Objekt', genres: ['electro', 'techno'], country: 'Germany' },
  { name: 'Dj Assault', genres: ['electro', 'ghetto tech'], country: 'USA' },
  { name: 'DJ Godfather', genres: ['electro', 'ghetto tech'], country: 'USA' },
  { name: 'Special Request', genres: ['breakbeat', 'jungle'], country: 'UK' },
  { name: 'DJ Bone', genres: ['techno', 'electro'], country: 'USA' },
  { name: 'Jensen Interceptor', genres: ['electro', 'techno'], country: 'Australia' },
  
  // ==========================================
  // CURRENT UNDERGROUND FAVORITES
  // ==========================================
  { name: 'DJ Boring', genres: ['house', 'deep house'], country: 'Australia' },
  { name: 'CCL', genres: ['house', 'deep house'], country: 'Germany' },
  { name: 'Nick Leon', genres: ['house', 'club'], country: 'USA' },
  { name: 'Special Interest', genres: ['industrial', 'punk'], country: 'USA' },
  { name: 'Job Jobse', genres: ['house', 'techno'], country: 'Netherlands' },
  { name: 'Palms Trax', genres: ['house', 'disco'], country: 'UK' },
  { name: 'Avalon Emerson', genres: ['house', 'techno'], country: 'USA' },
  { name: 'Peggy Gou', genres: ['house', 'techno'], country: 'South Korea' },
  { name: 'HAAi', genres: ['techno', 'house'], country: 'Australia' },
  { name: 'Honey Dijon', genres: ['house', 'techno'], country: 'USA' },
  { name: 'The Blessed Madonna', genres: ['house', 'disco'], country: 'USA' },
  { name: 'Jayda G', genres: ['house', 'disco'], country: 'Canada' },
  { name: 'Sofia Kourtesis', genres: ['house', 'techno'], country: 'Peru' },
  { name: 'Shanti Celeste', genres: ['house', 'disco'], country: 'UK' },
  { name: 'Octo Octa', genres: ['house', 'trance'], country: 'USA' },
  { name: 'Eris Drew', genres: ['house', 'trance'], country: 'USA' },
  { name: 'DJ Python', genres: ['reggaeton', 'ambient'], country: 'USA' },
  { name: 'Chaos In The CBD', genres: ['house', 'deep house'], country: 'New Zealand' },
  { name: 'Laurence Guy', genres: ['house', 'deep house'], country: 'UK' },
  { name: 'Bradley Zero', genres: ['house', 'disco'], country: 'UK' },
  { name: 'Batu', genres: ['techno', 'bass'], country: 'UK' },
  { name: 'Objekt', genres: ['techno', 'electro'], country: 'Germany' },
  { name: 'Call Super', genres: ['techno', 'house'], country: 'UK' },
];

// Artist aliases for common variations
const aliases: Record<string, string[]> = {
  'Larry Heard': ['Mr. Fingers', 'Fingers Inc.'],
  'Louie Vega': ['Masters At Work'],
  'Kenny Dope': ['Masters At Work', 'Dope Wax'],
  'Richie Hawtin': ['Plastikman', 'F.U.S.E.'],
  'Robert Hood': ['Floorplan', 'Monobox'],
  'Kevin Saunderson': ['Inner City', 'E-Dancer', 'Reese'],
  'Juan Atkins': ['Model 500', 'Cybotron'],
  'Jeff Mills': ['The Wizard', 'Purpose Maker'],
  'Carl Craig': ['Paperclip People', '69', 'Innerzone Orchestra'],
  'Eric Prydz': ['Pryda', 'Cirez D', 'Tonja Holma'],
  'Deadmau5': ['Testpilot'],
  'Boris Brejcha': ['Boris Brejcha High-Tech Minimal'],
  'Fisher': ['FISHER'],
  'Skream': ['Oliver Jones'],
  'Four Tet': ['Kieran Hebden', 'KH'],
  'Floating Points': ['Sam Shepherd'],
  'Joy Orbison': ['Joy O'],
  'Maceo Plex': ['Maetrik', 'Mariel Ito'],
  'Seth Troxler': ['Troxler'],
  'Jamie Jones': ['Hot Natured'],
  'Dixon': ['Steffen Berkhahn'],
  'Joey Negro': ['Dave Lee', 'Z Records', 'Jakatta'],
  'Fatboy Slim': ['Norman Cook', 'Beats International'],
  'Armand Van Helden': ['AVH', 'Duck Sauce'],
  'Calvin Harris': ['Love Regenerator'],
  'The Blessed Madonna': ['The Black Madonna'],
  'DJ Koze': ['Koze'],
  'Purple Disco Machine': ['PDM'],
};

async function seedArtists() {
  console.log('🎧 Starting large artist seed...\n');
  
  let created = 0;
  let skipped = 0;
  const genreCounts: Record<string, number> = {};

  for (const artist of artists) {
    const slug = generateSlug(artist.name);
    const nameNormalized = artist.name.toLowerCase().trim();
    
    // Count genres
    artist.genres.forEach(g => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
    
    // Try to insert artist
    const { data, error } = await supabase
      .from('artists')
      .upsert({
        name: artist.name,
        slug,
        genres: artist.genres,
        country: artist.country,
      }, {
        onConflict: 'slug',
        ignoreDuplicates: true,
      })
      .select()
      .single();

    if (error && !error.message.includes('duplicate')) {
      console.error(`❌ Error creating ${artist.name}:`, error.message);
    } else if (data) {
      created++;
      
      // Add aliases if any
      const artistAliases = aliases[artist.name];
      if (artistAliases) {
        for (const alias of artistAliases) {
          await supabase
            .from('artist_aliases')
            .upsert({
              artist_id: data.id,
              alias: alias,
              alias_lower: alias.toLowerCase(),
            }, {
              onConflict: 'alias_lower',
              ignoreDuplicates: true,
            });
        }
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Created ${created} artists (${skipped} already existed)`);
  console.log('\n📊 Genre breakdown:');
  
  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  for (const [genre, count] of sortedGenres) {
    console.log(`   ${genre}: ${count}`);
  }
  
  console.log('\n🎧 Artist seed complete!');
}

seedArtists().catch(console.error);
