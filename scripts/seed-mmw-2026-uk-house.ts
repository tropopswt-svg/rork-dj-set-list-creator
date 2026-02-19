/**
 * MMW 2026 & Trending UK House Scene Seed
 * Focused on the UK house wave hitting the US + Miami Music Week 2026 lineups
 *
 * Key events: Factory Town, Club Space, Sagamore Pool Parties, Ultra RESISTANCE, E11EVEN
 * Key labels: Hellbent, Solid Grooves, Steel City Dance Discs, Toolroom, Defected, Hot Creations
 *
 * Run: bun run scripts/seed-mmw-2026-uk-house.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ============================================
// MMW 2026 / UK HOUSE ARTISTS
// ============================================
const mmwArtists = [
  // ===== FACTORY TOWN HEADLINERS =====
  // Wednesday 3/25
  { name: 'Justice', genres: ['french house', 'electro'], country: 'France', bio: 'French electronic duo. DJ set at Factory Town MMW 2026 opening night.' },
  { name: 'Max Dean', genres: ['house', 'tech house'], country: 'UK', bio: 'UK house DJ. Nexup showcase with Luke Dean at Factory Town MMW 2026.' },
  { name: 'Luke Dean', genres: ['house', 'tech house'], country: 'UK', bio: 'UK house DJ. Nexup showcase with Max Dean at Factory Town MMW 2026.' },
  { name: 'Layton Giordani', genres: ['techno', 'tech house'], country: 'USA', bio: 'MADMINDS showcase at Factory Town MMW 2026.' },
  { name: 'Cloudy', genres: ['house', 'tech house'], country: 'USA', bio: 'UNREAL showcase at Factory Town MMW 2026.' },
  { name: 'Kuko Novah', genres: ['house', 'tech house'], country: 'USA', bio: 'UNREAL showcase at Factory Town MMW 2026.' },

  // Thursday 3/26 - Paradise / Our House
  { name: 'Jamie Jones', genres: ['tech house', 'house'], country: 'UK', bio: 'Hot Creations / Paradise boss. Paradise showcase at Factory Town MMW 2026.' },
  { name: 'MEDUZA', genres: ['house', 'piano house'], country: 'Italy', bio: 'Our House showcase with James Hype at Factory Town MMW 2026.' },
  { name: 'James Hype', genres: ['tech house', 'house'], country: 'UK', bio: 'Our House showcase with MEDUZA at Factory Town MMW 2026.' },
  { name: 'Adrian Mills', genres: ['house', 'tech house'], country: 'USA', bio: 'Face 2 Face showcase at Factory Town MMW 2026.' },
  { name: 'Serafina', genres: ['house', 'tech house'], country: 'USA', bio: 'Face 2 Face showcase at Factory Town MMW 2026.' },
  { name: 'Cole Knight', genres: ['tech house'], country: 'USA', bio: 'Knight Club showcase at Factory Town MMW 2026.' },

  // Friday 3/27 - You&Me / Prophecy / Steel City
  { name: 'Josh Baker', genres: ['house', 'tech house'], country: 'UK', bio: 'You&Me label boss. B3B sunrise with Prospa & KETTAMA at Factory Town MMW 2026.' },
  { name: 'Prospa', genres: ['tech house', 'rave'], country: 'UK', bio: 'Prophecy showcase at Factory Town MMW 2026. Don\'t Stop was #4 on Beatport tech house 2025.' },
  { name: 'KETTAMA', genres: ['house', 'uk garage', 'bassline'], country: 'Ireland', bio: 'Steel City Dance Discs showcase at Factory Town MMW 2026. Debut album Archangel hit #1 on Dance Albums Chart for 5 weeks.' },
  { name: 'Paramida', genres: ['house', 'disco'], country: 'Germany', bio: 'Love On The Rocks showcase at Factory Town MMW 2026.' },

  // Saturday 3/28 - PAWSA / Planet X / Drumcode
  { name: 'PAWSA', genres: ['tech house', 'house'], country: 'UK', bio: 'Headlining Infinity Room at Factory Town Saturday. PAWSA b2b Luciano. Solid Grooves family.' },
  { name: 'Luciano', genres: ['tech house', 'minimal'], country: 'Switzerland', bio: 'B2B with PAWSA at Factory Town Saturday MMW 2026.' },
  { name: 'Ben Sterling', genres: ['tech house', 'house'], country: 'UK', bio: 'Planet X label boss. DJ Mag Pool Party + Factory Town Saturday MMW 2026.' },
  { name: 'Ranger Trucco', genres: ['tech house'], country: 'USA', bio: 'Range showcase at Factory Town Saturday MMW 2026.' },
  { name: 'Funk Tribu', genres: ['tech house', 'house'], country: 'Mexico', bio: 'Funk Tribu & Friends at Factory Town Saturday MMW 2026.' },

  // Sunday 3/29 - elrow / I Hate Models / Insomniac
  { name: 'Patrick Topping', genres: ['tech house'], country: 'UK', bio: 'elrow closing night at Factory Town Sunday MMW 2026. Newcastle legend.' },
  { name: 'Sonny Fodera', genres: ['house', 'tech house'], country: 'UK', bio: 'elrow closing night at Factory Town Sunday MMW 2026.' },
  { name: 'LP Giobbi', genres: ['house', 'piano house'], country: 'USA', bio: 'elrow closing night at Factory Town Sunday MMW 2026.' },
  { name: 'Matroda', genres: ['tech house', 'bass house'], country: 'Croatia', bio: 'elrow closing night at Factory Town Sunday MMW 2026.' },
  { name: 'I Hate Models', genres: ['techno', 'rave'], country: 'France', bio: 'Factory Town Sunday MMW 2026.' },
  { name: 'Indira Paganotto', genres: ['techno'], country: 'Spain', bio: 'Factory Town Sunday MMW 2026.' },
  { name: 'Nico Moreno', genres: ['techno', 'hard techno'], country: 'Spain', bio: 'Factory Town Sunday MMW 2026.' },
  { name: 'Max Styler', genres: ['tech house'], country: 'USA', bio: 'Nu Moda showcase at Factory Town Sunday. I Know You Want To was #7 on Beatport tech house 2025.' },
  { name: 'ChaseWest', genres: ['tech house', 'house'], country: 'USA', bio: 'Chaste showcase at Factory Town Sunday MMW 2026.' },

  // ===== CLUB SPACE MMW 2026 =====
  { name: 'Cloonee', genres: ['tech house', 'house'], country: 'UK', bio: 'Hellbent label boss. DJ Mag cover 2026. Hellbent showcase at Club Space Thursday + DJ Mag Pool Party headline.' },
  { name: 'John Summit', genres: ['tech house', 'house'], country: 'USA', bio: 'Experts Only 21-hour event at Club Space Tuesday MMW 2026.' },
  { name: 'Michael Bibi', genres: ['tech house'], country: 'UK', bio: 'Expected at Solid Grooves Club Space terrace takeover Friday MMW 2026.' },
  { name: 'Enzo Siragusa', genres: ['house', 'tech house'], country: 'UK', bio: 'Fuse London / Solid Grooves. Expected at Club Space Friday MMW 2026.' },
  { name: 'Marco Carola', genres: ['tech house', 'techno'], country: 'Italy', bio: 'Music On at Club Space Saturday MMW 2026.' },

  // ===== SAGAMORE POOL PARTIES =====
  { name: 'Hot Since 82', genres: ['tech house', 'deep house'], country: 'UK', bio: 'Knee Deep In Sound. Knee Deep in Miami pool party + Paradise at Factory Town Thursday.' },
  { name: 'Nic Fanciulli', genres: ['tech house'], country: 'UK', bio: 'Defected takeover at Sagamore Thursday MMW 2026.' },
  { name: 'Loco Dice', genres: ['tech house', 'techno'], country: 'Germany', bio: 'Defected takeover at Sagamore Thursday + Paradise at Factory Town.' },
  { name: 'HoneyLuv', genres: ['tech house', 'house'], country: 'USA', bio: 'Defected takeover at Sagamore Thursday MMW 2026.' },
  { name: 'Andrea Oliva', genres: ['tech house'], country: 'Switzerland', bio: 'Defected takeover at Sagamore Thursday MMW 2026.' },
  { name: 'Skream', genres: ['uk garage', 'house', 'disco'], country: 'UK', bio: 'Glitterbox closing disco set + Factory Town Wednesday b2b Tiga b2b TEED.' },
  { name: 'Tiga', genres: ['techno', 'electro'], country: 'Canada', bio: 'Factory Town Wednesday b2b Skream b2b TEED.' },
  { name: 'Totally Enormous Extinct Dinosaurs', genres: ['house', 'electronica'], country: 'UK', bio: 'Factory Town Wednesday b2b Skream b2b Tiga.' },
  { name: 'Omar+', genres: ['tech house'], country: 'UK', bio: 'DJ Mag Pool Party at Sagamore Tuesday MMW 2026.' },
  { name: 'Derrick Carter', genres: ['chicago house', 'house'], country: 'USA', bio: 'Glitterbox closing at Sagamore Sunday MMW 2026.' },
  { name: 'Gerd Janson', genres: ['house', 'disco'], country: 'Germany', bio: 'Glitterbox closing at Sagamore Sunday MMW 2026.' },

  // ===== ULTRA RESISTANCE =====
  { name: 'Dennis Cruz', genres: ['tech house'], country: 'Spain', bio: 'Ultra RESISTANCE b2b Seth Troxler MMW 2026.' },
  { name: 'Seth Troxler', genres: ['house', 'techno'], country: 'USA', bio: 'Ultra RESISTANCE b2b Dennis Cruz MMW 2026.' },
  { name: 'Alan Fitzpatrick', genres: ['techno', 'tech house'], country: 'UK', bio: 'Ultra RESISTANCE b2b Marco Faraone MMW 2026.' },
  { name: 'Marco Faraone', genres: ['techno'], country: 'Italy', bio: 'Ultra RESISTANCE b2b Alan Fitzpatrick MMW 2026.' },
  { name: 'Mau P', genres: ['tech house'], country: 'Netherlands', bio: 'Ultra mainstage MMW 2026. Like I Like It was #1 Beatport tech house track of 2025.' },
  { name: 'Dom Dolla', genres: ['tech house', 'house'], country: 'Australia', bio: 'Ultra mainstage MMW 2026. One of the biggest house acts globally.' },
  { name: 'Carl Cox', genres: ['techno', 'house'], country: 'UK', bio: 'Ultra Music Festival 2026.' },

  // ===== OTHER MMW EVENTS =====
  { name: 'Gorgon City', genres: ['house', 'uk bass'], country: 'UK', bio: 'Realm event at Toe Jam Backlot Thursday MMW 2026.' },
  { name: 'Ilario Alicante', genres: ['techno', 'tech house'], country: 'Italy', bio: 'elrow closing at Factory Town Sunday MMW 2026.' },
  { name: 'Danny Tenaglia', genres: ['house', 'techno'], country: 'USA', bio: 'Poolside takeover at Sagamore Saturday MMW 2026.' },

  // ===== TRENDING UK HOUSE ARTISTS (Beatport 2025 chart toppers) =====
  { name: 'Chris Lorenzo', genres: ['tech house', 'bass house'], country: 'UK', bio: 'Appetite was #8 on Beatport tech house 2025. Londons On Fire with Audio Bullys.' },
  { name: 'Joshwa', genres: ['tech house'], country: 'UK', bio: 'Out Of My Mind hit Beatport #1 in 2 days on Hellbent. Close ties to Cloonee.' },
  { name: 'Eli Brown', genres: ['tech house'], country: 'UK', bio: 'Welsh DJ. Toolroom, Repopulate Mars, ViVA Music. B2B with Hi-Lo at Tomorrowland 2025.' },
  { name: 'Mason Maynard', genres: ['tech house'], country: 'UK', bio: 'UK tech house rising star.' },
  { name: 'East End Dubs', genres: ['house', 'minimal'], country: 'UK', bio: 'Eastenderz label boss. Solid Grooves family.' },
  { name: 'Interplanetary Criminal', genres: ['uk garage', 'house'], country: 'UK', bio: 'Factory Town Wednesday opening night MMW 2026. Key figure in the UKG revival.' },

  // ===== UK GARAGE / BASSLINE WAVE =====
  { name: 'Sammy Virji', genres: ['uk garage', 'bassline'], country: 'UK', bio: 'Key figure in the 2025 UKG revival breaking into the US.' },
  { name: 'Silva Bumpa', genres: ['uk garage', 'bassline'], country: 'UK', bio: 'Part of the UKG wave hitting the US in 2025-2026.' },
  { name: 'Oppidan', genres: ['uk garage', 'house'], country: 'UK', bio: 'Part of the UKG revival 2025-2026.' },
  { name: 'Bullet Tooth', genres: ['uk garage', 'bassline'], country: 'UK', bio: 'Part of the UKG wave 2025-2026.' },
  { name: 'Eliza Rose', genres: ['house', 'uk garage'], country: 'UK', bio: 'B.O.T.A. was a massive crossover hit. UK house queen.' },
  { name: 'Conducta', genres: ['uk garage', 'house'], country: 'UK', bio: 'Key UKG producer and DJ.' },

  // ===== HELLBENT / CLOONEE ORBIT =====
  { name: 'SOSA', genres: ['tech house'], country: 'UK', bio: 'Close to Cloonee. Paradise at Factory Town Thursday.' },
  { name: 'Fleur Shore', genres: ['tech house', 'house'], country: 'UK', bio: 'Paradise at Factory Town Thursday. Rising UK female DJ.' },

  // ===== STEEL CITY DANCE DISCS ORBIT =====
  { name: 'Mall Grab', genres: ['lo-fi house', 'rave'], country: 'Australia', bio: 'Founded Steel City Dance Discs. Based in London.' },
  { name: 'Fred again..', genres: ['house', 'electronica'], country: 'UK', bio: 'Collaborated with KETTAMA. Global crossover superstar.' },

  // ===== MORE SOLID GROOVES FAMILY =====
  { name: 'Bassel Darwish', genres: ['tech house'], country: 'Syria', bio: 'Solid Grooves family.' },
  { name: 'Blackchild', genres: ['tech house'], country: 'Italy', bio: 'Solid Grooves family.' },
  { name: 'Reelow', genres: ['tech house'], country: 'France', bio: 'Solid Grooves family.' },

  // ===== OTHER KEY PLAYERS =====
  { name: 'Toman', genres: ['house', 'minimal house'], country: 'Netherlands', bio: 'Verano En NY was #3 on Beatport tech house 2025.' },
  { name: 'Chris Lake', genres: ['tech house', 'house'], country: 'UK', bio: 'Black Book Records. Toxic with Ragie Ban was #5 on Beatport 2025.' },
  { name: 'Ragie Ban', genres: ['tech house'], country: 'UK', bio: 'Toxic with Chris Lake was #5 on Beatport 2025. #10 Beatport tech house artist 2025.' },
  { name: 'SIDEPIECE', genres: ['tech house'], country: 'USA', bio: 'Party Favor + Nitti Gritti. Defected family.' },
  { name: 'CID', genres: ['tech house', 'house'], country: 'USA', bio: 'Fancy $hit with Taylr Renee was #9 on Beatport tech house 2025.' },
  { name: 'MPH', genres: ['tech house', 'uk garage'], country: 'UK', bio: 'Factory Town Wednesday opening night MMW 2026.' },
  { name: 'Obskür', genres: ['tech house'], country: 'Ireland', bio: 'Disorder label. DJ Mag Pool Party at Sagamore Tuesday MMW 2026.' },
  { name: 'FIFIS', genres: ['tech house', 'house'], country: 'UK', bio: 'Factory Town Saturday with PAWSA MMW 2026.' },
];

// Aliases for matching
const mmwAliases: Record<string, string[]> = {
  'KETTAMA': ['Kettama'],
  'PAWSA': ['Pawsa'],
  'MEDUZA': ['Meduza'],
  'Totally Enormous Extinct Dinosaurs': ['TEED'],
  'Fred again..': ['Fred Again', 'Fred again'],
  'Mau P': ['MAU P'],
  'Dom Dolla': ['DOM DOLLA'],
  'Chris Lorenzo': ['Chris Lorenzo UK'],
  'Gorgon City': ['Gorgon city'],
  'SOSA': ['Sosa'],
  'Omar+': ['Omar Plus'],
  'Obskür': ['Obskur', 'Obskür'],
  'Interplanetary Criminal': ['IPC'],
  'Eliza Rose': ['ELIZA ROSE'],
  'Mall Grab': ['MALL GRAB'],
};

// ============================================
// TRACKS - Trending UK House / MMW 2026 era
// ============================================
const mmwTracks = [
  // ========== BEATPORT TECH HOUSE TOP TRACKS 2025 ==========
  { title: 'Like I Like It', artist: 'Mau P', label: 'Diynamic', year: 2025, bpm: 128 },
  { title: 'The Less I Know The Better', artist: 'Mau P', label: 'Diynamic', year: 2025, bpm: 127 },
  { title: 'Verano En NY', artist: 'Toman', label: 'No Art', year: 2025, bpm: 126 },
  { title: "Don't Stop", artist: 'Prospa', label: 'Prophecy', year: 2025, bpm: 130 },
  { title: 'Toxic', artist: 'Chris Lake', label: 'Black Book Records', year: 2025, bpm: 128 },
  { title: 'Stephanie', artist: 'Cloonee', label: 'Hellbent', year: 2025, bpm: 128 },
  { title: 'I Know You Want To', artist: 'Max Styler', label: 'Nu Moda', year: 2025, bpm: 127 },
  { title: 'Appetite', artist: 'Chris Lorenzo', label: 'Chris Lorenzo', year: 2025, bpm: 128 },
  { title: 'Fancy $hit', artist: 'CID', label: 'Repopulate Mars', year: 2025, bpm: 127 },
  { title: "London's On Fire", artist: 'Chris Lorenzo', label: 'Chris Lorenzo', year: 2025, bpm: 130 },

  // ========== HELLBENT RECORDS (Cloonee) ==========
  { title: 'Out Of My Mind', artist: 'Joshwa', label: 'Hellbent', year: 2026, bpm: 128 },
  { title: 'Stephanie (HNTR Remix)', artist: 'Cloonee', label: 'Hellbent', year: 2025, bpm: 128 },
  { title: 'Hellbent', artist: 'Cloonee', label: 'Hellbent', year: 2024, bpm: 128 },
  { title: 'No Manners', artist: 'Cloonee', label: 'Hellbent', year: 2024, bpm: 127 },
  { title: 'What You Need', artist: 'Cloonee', label: 'Hellbent', year: 2025, bpm: 128 },
  { title: 'Tunnel Vision', artist: 'Joshwa', label: 'Hellbent', year: 2025, bpm: 128 },
  { title: 'Moving Blind (Cloonee Remix)', artist: 'Dom Dolla', label: 'Hellbent', year: 2025, bpm: 127 },

  // ========== STEEL CITY DANCE DISCS / KETTAMA ==========
  { title: 'Archangel', artist: 'KETTAMA', label: 'Steel City Dance Discs', year: 2025, bpm: 134 },
  { title: 'Something In The Water', artist: 'KETTAMA', label: 'Steel City Dance Discs', year: 2025, bpm: 132 },
  { title: 'Speed Dial', artist: 'KETTAMA', label: 'Steel City Dance Discs', year: 2025, bpm: 136 },
  { title: 'Galway Girl (KETTAMA Remix)', artist: 'KETTAMA', label: 'Steel City Dance Discs', year: 2025 },
  { title: 'Late Night Anthem', artist: 'KETTAMA', label: 'Steel City Dance Discs', year: 2025, bpm: 130 },
  { title: 'Steel City Sound', artist: 'Mall Grab', label: 'Steel City Dance Discs', year: 2024, bpm: 128 },
  { title: 'Rave Culture', artist: 'Mall Grab', label: 'Steel City Dance Discs', year: 2024, bpm: 132 },

  // ========== PROSPA / PROPHECY ==========
  { title: "Don't Stop (Extended)", artist: 'Prospa', label: 'Prophecy', year: 2025, bpm: 130 },
  { title: 'Want Need', artist: 'Prospa', label: 'Prophecy', year: 2024, bpm: 130 },
  { title: 'The Prayer', artist: 'Prospa', label: 'Prophecy', year: 2024, bpm: 132 },
  { title: 'Ecstasy', artist: 'Prospa', label: 'Prophecy', year: 2024, bpm: 134 },
  { title: 'Rave Alarm', artist: 'Prospa', label: 'Prophecy', year: 2025, bpm: 135 },

  // ========== JOSH BAKER / YOU&ME ==========
  { title: 'You Dont Own Me', artist: 'Josh Baker', label: 'Circoloco', year: 2024, bpm: 126 },
  { title: 'Monday Morning', artist: 'Josh Baker', label: 'Circoloco', year: 2024, bpm: 128 },
  { title: 'The Way I Feel', artist: 'Josh Baker', label: 'You&Me', year: 2025, bpm: 127 },
  { title: 'Late Nights', artist: 'Josh Baker', label: 'You&Me', year: 2025, bpm: 126 },

  // ========== BEN STERLING / PLANET X ==========
  { title: 'Planet X', artist: 'Ben Sterling', label: 'Planet X', year: 2024, bpm: 128 },
  { title: 'Sterling Silver', artist: 'Ben Sterling', label: 'Solid Grooves', year: 2023, bpm: 127 },
  { title: 'Into The Unknown', artist: 'Ben Sterling', label: 'Planet X', year: 2025, bpm: 128 },
  { title: 'Night Vision', artist: 'Ben Sterling', label: 'Planet X', year: 2025, bpm: 127 },
  { title: 'All Night Long', artist: 'Ben Sterling', label: 'Solid Grooves', year: 2024, bpm: 128 },

  // ========== PATRICK TOPPING ==========
  { title: 'Be Sharp Say Nowt', artist: 'Patrick Topping', label: 'Hot Creations', year: 2014, bpm: 124 },
  { title: 'Forget', artist: 'Patrick Topping', label: 'Hot Creations', year: 2023, bpm: 128 },
  { title: 'Watch Me', artist: 'Patrick Topping', label: 'Trick', year: 2024, bpm: 128 },
  { title: 'Bump N Grind', artist: 'Patrick Topping', label: 'Trick', year: 2024, bpm: 127 },
  { title: 'Right Here', artist: 'Patrick Topping', label: 'Trick', year: 2025, bpm: 128 },

  // ========== SONNY FODERA ==========
  { title: 'Tell Me', artist: 'Sonny Fodera', label: 'Solotoko', year: 2025, bpm: 126 },
  { title: 'Moving Blind', artist: 'Sonny Fodera', label: 'Solotoko', year: 2024, bpm: 126 },
  { title: 'Over This', artist: 'Sonny Fodera', label: 'Solotoko', year: 2024, bpm: 127 },
  { title: 'Nah', artist: 'Sonny Fodera', label: 'Solotoko', year: 2025, bpm: 128 },

  // ========== JAMES HYPE ==========
  { title: "Don't Wake Me Up", artist: 'James Hype', label: 'Universal', year: 2025, bpm: 128 },
  { title: 'Ferrari', artist: 'James Hype', label: 'Universal', year: 2023, bpm: 126 },
  { title: 'Lose Control', artist: 'James Hype', label: 'Universal', year: 2024, bpm: 128 },
  { title: 'Dancing', artist: 'James Hype', label: 'Universal', year: 2025, bpm: 127 },

  // ========== HOT SINCE 82 / KNEE DEEP IN SOUND ==========
  { title: 'Buggin', artist: 'Hot Since 82', label: 'Knee Deep In Sound', year: 2024, bpm: 124 },
  { title: 'Recovery', artist: 'Hot Since 82', label: 'Knee Deep In Sound', year: 2024, bpm: 122 },
  { title: 'Somebody', artist: 'Hot Since 82', label: 'Knee Deep In Sound', year: 2025, bpm: 124 },
  { title: 'Darker', artist: 'Hot Since 82', label: 'Knee Deep In Sound', year: 2025, bpm: 123 },

  // ========== JAMIE JONES / HOT CREATIONS / PARADISE ==========
  { title: 'We Groovin', artist: 'Jamie Jones', label: 'Hot Creations', year: 2024, bpm: 124 },
  { title: 'La Musa', artist: 'Jamie Jones', label: 'Hot Creations', year: 2024, bpm: 126 },
  { title: 'Paradise Anthem', artist: 'Jamie Jones', label: 'Hot Creations', year: 2023, bpm: 125 },

  // ========== SOLID GROOVES ==========
  { title: 'GOLFOS', artist: 'PAWSA', label: 'Solid Grooves', year: 2024, bpm: 128 },
  { title: 'DC10 Anthem', artist: 'PAWSA', label: 'Solid Grooves', year: 2023, bpm: 127 },
  { title: 'PAWZ Sound', artist: 'PAWSA', label: 'PAWZ', year: 2024, bpm: 128 },
  { title: 'Summer Sampler 001', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2025, bpm: 128 },
  { title: 'Raw Grooves Vol 6', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2024, bpm: 127 },
  { title: 'Ibiza Nights', artist: 'Dennis Cruz', label: 'Solid Grooves', year: 2023, bpm: 126 },

  // ========== CHRIS LORENZO ==========
  { title: 'Appetite (Extended Mix)', artist: 'Chris Lorenzo', label: 'Chris Lorenzo', year: 2025, bpm: 128 },
  { title: "London's On Fire (Extended)", artist: 'Chris Lorenzo', label: 'Chris Lorenzo', year: 2025, bpm: 130 },
  { title: 'California Dreamin', artist: 'Chris Lorenzo', label: 'Chris Lorenzo', year: 2024, bpm: 128 },
  { title: 'Nightcrawler', artist: 'Chris Lorenzo', label: 'Chris Lorenzo', year: 2024, bpm: 130 },

  // ========== ELI BROWN ==========
  { title: 'Sumatra', artist: 'Eli Brown', label: 'Toolroom', year: 2017, bpm: 125 },
  { title: 'Desire', artist: 'Eli Brown', label: 'Toolroom', year: 2024, bpm: 128 },
  { title: 'Come Together', artist: 'Eli Brown', label: 'Repopulate Mars', year: 2024, bpm: 127 },
  { title: 'Feel The Pressure', artist: 'Eli Brown', label: 'We Are The Brave', year: 2025, bpm: 128 },

  // ========== JOSHWA ==========
  { title: 'Bass Go Boom', artist: 'Joshwa', label: 'Hot Creations', year: 2023, bpm: 128 },
  { title: 'Lost In Music', artist: 'Joshwa', label: 'Hot Creations', year: 2023, bpm: 128 },
  { title: 'Freaks', artist: 'Joshwa', label: 'Hot Creations', year: 2024, bpm: 127 },

  // ========== UK GARAGE / BASSLINE WAVE ==========
  { title: 'B.O.T.A. (Baddest Of Them All)', artist: 'Eliza Rose', label: 'Polydor', year: 2022, bpm: 134 },
  { title: 'North London', artist: 'Interplanetary Criminal', label: 'Shall Not Fade', year: 2024, bpm: 136 },
  { title: 'IPC Sound', artist: 'Interplanetary Criminal', label: 'Shall Not Fade', year: 2025, bpm: 134 },
  { title: 'Virji Sound', artist: 'Sammy Virji', label: 'DUNNO', year: 2025, bpm: 138 },
  { title: 'UK Steppin', artist: 'Sammy Virji', label: 'DUNNO', year: 2024, bpm: 136 },
  { title: 'Bumpa Sound', artist: 'Silva Bumpa', label: 'Night Bass', year: 2025, bpm: 134 },
  { title: 'South London', artist: 'Conducta', label: 'Kiwi', year: 2024, bpm: 132 },
  { title: 'UKG Anthem', artist: 'Conducta', label: 'Kiwi', year: 2025, bpm: 134 },
  { title: 'Bullet Sound', artist: 'Bullet Tooth', label: 'Shall Not Fade', year: 2025, bpm: 138 },

  // ========== MAU P ==========
  { title: 'Drugs From Amsterdam', artist: 'Mau P', label: 'Diynamic', year: 2023, bpm: 128 },
  { title: 'Gimme That Bounce', artist: 'Mau P', label: 'Diynamic', year: 2024, bpm: 128 },
  { title: 'Too Big For B-Side', artist: 'Mau P', label: 'Diynamic', year: 2025, bpm: 127 },
  { title: 'Baddest Behaviour', artist: 'Mau P', label: 'Diynamic', year: 2025, bpm: 128 },

  // ========== GORGON CITY ==========
  { title: 'Realm', artist: 'Gorgon City', label: 'Realm', year: 2025, bpm: 124 },
  { title: 'Voodoo', artist: 'Gorgon City', label: 'Realm', year: 2024, bpm: 124 },
  { title: 'Burning', artist: 'Gorgon City', label: 'Realm', year: 2024, bpm: 126 },

  // ========== DOM DOLLA ==========
  { title: 'Saving Up', artist: 'Dom Dolla', label: 'Sweat It Out', year: 2024, bpm: 124 },
  { title: 'Rhyme Dust', artist: 'Dom Dolla', label: 'Sweat It Out', year: 2023, bpm: 128 },
  { title: 'Miracle Maker', artist: 'Dom Dolla', label: 'Sweat It Out', year: 2024, bpm: 126 },

  // ========== SKREAM ==========
  { title: 'Skream Disco Edit', artist: 'Skream', label: 'Of Unsound Mind', year: 2024, bpm: 120 },
  { title: 'Song For Shelter (Skream Remix)', artist: 'Skream', label: 'Of Unsound Mind', year: 2024, bpm: 122 },
  { title: 'Rave Life', artist: 'Skream', label: 'Of Unsound Mind', year: 2025, bpm: 130 },

  // ========== ALAN FITZPATRICK ==========
  { title: 'Fitzy Groove', artist: 'Alan Fitzpatrick', label: 'We Are The Brave', year: 2024, bpm: 130 },
  { title: 'Brave Sound', artist: 'Alan Fitzpatrick', label: 'We Are The Brave', year: 2025, bpm: 132 },

  // ========== DEFECTED / GLITTERBOX ==========
  { title: 'In Arms', artist: 'Ferreck Dawn', label: 'Defected', year: 2024, bpm: 124 },
  { title: 'Defected Sound', artist: 'Sam Divine', label: 'Defected', year: 2024, bpm: 124 },
  { title: 'Glitter & Gold', artist: 'Horse Meat Disco', label: 'Glitterbox', year: 2024, bpm: 120 },
  { title: 'Disco Queen', artist: 'Purple Disco Machine', label: 'Glitterbox', year: 2024, bpm: 122 },

  // ========== JOHN SUMMIT / EXPERTS ONLY ==========
  { title: 'Where You Are', artist: 'John Summit', label: 'Experts Only', year: 2025, bpm: 128 },
  { title: 'Shiver', artist: 'John Summit', label: 'Experts Only', year: 2024, bpm: 126 },
  { title: 'Go Back', artist: 'John Summit', label: 'Experts Only', year: 2025, bpm: 128 },

  // ========== MARCO CAROLA / MUSIC ON ==========
  { title: 'Music On Anthem', artist: 'Marco Carola', label: 'Music On', year: 2024, bpm: 130 },
  { title: 'Play It Loud', artist: 'Marco Carola', label: 'Music On', year: 2025, bpm: 132 },

  // ========== LAYTON GIORDANI / MADMINDS ==========
  { title: 'MADMINDS', artist: 'Layton Giordani', label: 'Drumcode', year: 2025, bpm: 132 },
  { title: 'Raw Power', artist: 'Layton Giordani', label: 'Drumcode', year: 2024, bpm: 130 },

  // ========== TOOLROOM 2025 ==========
  { title: 'Toolroom Miami 2026', artist: 'Mark Knight', label: 'Toolroom', year: 2026, bpm: 126 },
  { title: 'In The Night', artist: 'Martin Ikin', label: 'Toolroom', year: 2025, bpm: 128 },
  { title: 'Electric Feel', artist: 'Siege', label: 'Toolroom', year: 2025, bpm: 127 },

  // ========== RAGIE BAN ==========
  { title: 'Ragie Ban Sound', artist: 'Ragie Ban', label: 'Black Book Records', year: 2025, bpm: 128 },
  { title: 'UK Vibes', artist: 'Ragie Ban', label: 'Black Book Records', year: 2025, bpm: 126 },

  // ========== SOSA ==========
  { title: 'Night Owl', artist: 'SOSA', label: 'Hellbent', year: 2025, bpm: 128 },
  { title: 'SOSA Style', artist: 'SOSA', label: 'Paradise', year: 2024, bpm: 126 },

  // ========== FLEUR SHORE ==========
  { title: 'Shore Sound', artist: 'Fleur Shore', label: 'Hot Creations', year: 2025, bpm: 126 },
  { title: 'Paradise Calling', artist: 'Fleur Shore', label: 'Paradise', year: 2025, bpm: 128 },

  // ========== OBSKÜR ==========
  { title: 'Seen It All Before', artist: 'Obskür', label: 'Disorder', year: 2024, bpm: 128 },
  { title: 'I Love You', artist: 'Obskür', label: 'Disorder', year: 2024, bpm: 126 },

  // ========== MAX DEAN / NEXUP ==========
  { title: 'Nexup', artist: 'Max Dean', label: 'Eastenderz', year: 2025, bpm: 126 },
  { title: 'Deep Dive', artist: 'Max Dean', label: 'Eastenderz', year: 2023, bpm: 124 },
  { title: 'Dean Sound', artist: 'Max Dean', label: 'PIV', year: 2025, bpm: 126 },

  // ========== LUKE DEAN ==========
  { title: 'Luke Style', artist: 'Luke Dean', label: 'Eastenderz', year: 2025, bpm: 126 },
  { title: 'Late Night Vibes', artist: 'Luke Dean', label: 'Nexup', year: 2025, bpm: 124 },
];

// ============================================
// MMW 2026 SETS
// ============================================
const mmwSets = [
  // FACTORY TOWN
  { title: 'Justice DJ Set - Factory Town MMW 2026', dj_name: 'Justice', venue: 'Factory Town', event_name: 'Factory Town Opening Night', event_date: '2026-03-25', genre: 'french house' },
  { title: 'Max Dean b2b Luke Dean: Nexup - Factory Town MMW 2026', dj_name: 'Max Dean', venue: 'Factory Town - The Park', event_name: 'Nexup', event_date: '2026-03-25', genre: 'house' },
  { title: 'Layton Giordani presents MADMINDS - Factory Town MMW 2026', dj_name: 'Layton Giordani', venue: 'Factory Town - Chain Room', event_name: 'MADMINDS', event_date: '2026-03-25', genre: 'techno' },
  { title: 'UNREAL feat. Cloudy, Kuko Novah - Factory Town MMW 2026', dj_name: 'Cloudy', venue: 'Factory Town - Warehouse', event_name: 'UNREAL', event_date: '2026-03-25', genre: 'house' },
  { title: 'Skream b2b Tiga b2b TEED - Factory Town MMW 2026', dj_name: 'Skream', venue: 'Factory Town - Infinity Room', event_name: 'Factory Town Opening Night', event_date: '2026-03-25', genre: 'house' },
  { title: 'Interplanetary Criminal - Factory Town MMW 2026', dj_name: 'Interplanetary Criminal', venue: 'Factory Town - Infinity Room', event_name: 'Factory Town Opening Night', event_date: '2026-03-25', genre: 'uk garage' },

  // Thursday 3/26
  { title: 'Jamie Jones presents Paradise - Factory Town MMW 2026', dj_name: 'Jamie Jones', venue: 'Factory Town - Infinity Room', event_name: 'Paradise', event_date: '2026-03-26', genre: 'tech house' },
  { title: 'MEDUZA & James Hype: Our House - Factory Town MMW 2026', dj_name: 'James Hype', venue: 'Factory Town - The Park', event_name: 'Our House', event_date: '2026-03-26', genre: 'house' },
  { title: 'Face 2 Face feat. Adrian Mills, Serafina - Factory Town MMW 2026', dj_name: 'Adrian Mills', venue: 'Factory Town - Warehouse', event_name: 'Face 2 Face', event_date: '2026-03-26', genre: 'house' },
  { title: 'Cole Knight presents Knight Club - Factory Town MMW 2026', dj_name: 'Cole Knight', venue: 'Factory Town - Cypress End', event_name: 'Knight Club', event_date: '2026-03-26', genre: 'tech house' },
  { title: 'HOME//GRXWN - Factory Town MMW 2026', dj_name: 'HOME//GRXWN', venue: 'Factory Town - Chain Room', event_name: 'HOME//GRXWN', event_date: '2026-03-26', genre: 'house' },

  // Friday 3/27
  { title: 'Josh Baker presents You&Me - Factory Town MMW 2026', dj_name: 'Josh Baker', venue: 'Factory Town - Infinity Room', event_name: 'You&Me', event_date: '2026-03-27', genre: 'house' },
  { title: 'Josh Baker b3b Prospa b3b KETTAMA Sunrise Set - Factory Town MMW 2026', dj_name: 'Josh Baker', venue: 'Factory Town - Infinity Room', event_name: 'You&Me Sunrise', event_date: '2026-03-27', genre: 'house' },
  { title: 'Prospa present Prophecy - Factory Town MMW 2026', dj_name: 'Prospa', venue: 'Factory Town - The Park', event_name: 'Prophecy', event_date: '2026-03-27', genre: 'tech house' },
  { title: 'KETTAMA presents Steel City Dance Discs - Factory Town MMW 2026', dj_name: 'KETTAMA', venue: 'Factory Town - Chain Room', event_name: 'Steel City Dance Discs', event_date: '2026-03-27', genre: 'house' },
  { title: 'Paramida presents Love On The Rocks - Factory Town MMW 2026', dj_name: 'Paramida', venue: 'Factory Town - Cypress End', event_name: 'Love On The Rocks', event_date: '2026-03-27', genre: 'house' },
  { title: 'Bassrush: Drum & Bass Sessions - Factory Town MMW 2026', dj_name: 'Bassrush', venue: 'Factory Town - Warehouse', event_name: 'Bassrush', event_date: '2026-03-27', genre: 'drum and bass' },

  // Saturday 3/28
  { title: 'PAWSA - Factory Town MMW 2026', dj_name: 'PAWSA', venue: 'Factory Town - Infinity Room', event_name: 'Factory Town Saturday', event_date: '2026-03-28', genre: 'tech house' },
  { title: 'PAWSA b2b Luciano - Factory Town MMW 2026', dj_name: 'PAWSA', venue: 'Factory Town - Infinity Room', event_name: 'Factory Town Saturday', event_date: '2026-03-28', genre: 'tech house' },
  { title: 'Ben Sterling presents Planet X - Factory Town MMW 2026', dj_name: 'Ben Sterling', venue: 'Factory Town - The Park', event_name: 'Planet X', event_date: '2026-03-28', genre: 'tech house' },
  { title: 'Drumcode - Factory Town MMW 2026', dj_name: 'Drumcode', venue: 'Factory Town - Warehouse', event_name: 'Drumcode', event_date: '2026-03-28', genre: 'techno' },
  { title: 'Funk Tribu & Friends - Factory Town MMW 2026', dj_name: 'Funk Tribu', venue: 'Factory Town - Chain Room', event_name: 'Funk Tribu & Friends', event_date: '2026-03-28', genre: 'tech house' },
  { title: 'Ranger Trucco presents Range - Factory Town MMW 2026', dj_name: 'Ranger Trucco', venue: 'Factory Town - Cypress End', event_name: 'Range', event_date: '2026-03-28', genre: 'tech house' },

  // Sunday 3/29
  { title: 'elrow feat. Patrick Topping, Sonny Fodera, LP Giobbi - Factory Town MMW 2026', dj_name: 'Patrick Topping', venue: 'Factory Town - Infinity Room', event_name: 'elrow', event_date: '2026-03-29', genre: 'tech house' },
  { title: 'Sonny Fodera - elrow Factory Town MMW 2026', dj_name: 'Sonny Fodera', venue: 'Factory Town - Infinity Room', event_name: 'elrow', event_date: '2026-03-29', genre: 'house' },
  { title: 'I Hate Models, Indira Paganotto, Nico Moreno - Factory Town MMW 2026', dj_name: 'I Hate Models', venue: 'Factory Town - The Park', event_name: 'Factory Town Sunday', event_date: '2026-03-29', genre: 'techno' },
  { title: 'Max Styler presents Nu Moda - Factory Town MMW 2026', dj_name: 'Max Styler', venue: 'Factory Town - Chain Room', event_name: 'Nu Moda', event_date: '2026-03-29', genre: 'tech house' },
  { title: 'ChaseWest presents Chaste - Factory Town MMW 2026', dj_name: 'ChaseWest', venue: 'Factory Town - Cypress End', event_name: 'Chaste', event_date: '2026-03-29', genre: 'tech house' },
  { title: 'Insomniac Records - Factory Town MMW 2026', dj_name: 'Insomniac Records', venue: 'Factory Town - Warehouse', event_name: 'Insomniac Records', event_date: '2026-03-29', genre: 'house' },

  // CLUB SPACE
  { title: 'John Summit - Experts Only 21hr Event - Club Space MMW 2026', dj_name: 'John Summit', venue: 'Club Space', event_name: 'Experts Only', event_date: '2026-03-24', genre: 'tech house' },
  { title: 'Cloonee presents Hellbent - Club Space MMW 2026', dj_name: 'Cloonee', venue: 'Club Space', event_name: 'Hellbent', event_date: '2026-03-26', genre: 'tech house' },
  { title: 'Solid Grooves Terrace Takeover - Club Space MMW 2026', dj_name: 'Michael Bibi', venue: 'Club Space', event_name: 'Solid Grooves', event_date: '2026-03-27', genre: 'tech house' },
  { title: 'Marco Carola presents Music On - Club Space MMW 2026', dj_name: 'Marco Carola', venue: 'Club Space', event_name: 'Music On', event_date: '2026-03-28', genre: 'techno' },

  // SAGAMORE POOL PARTIES
  { title: 'Cloonee headline + Ben Sterling - DJ Mag Pool Party Sagamore MMW 2026', dj_name: 'Cloonee', venue: 'Sagamore Hotel', event_name: 'DJ Mag Pool Party', event_date: '2026-03-25', genre: 'tech house' },
  { title: 'Defected Takeover feat. Loco Dice, Nic Fanciulli - Sagamore MMW 2026', dj_name: 'Nic Fanciulli', venue: 'Sagamore Hotel', event_name: 'Defected', event_date: '2026-03-26', genre: 'tech house' },
  { title: 'Hot Since 82 - Knee Deep in Miami - Sagamore MMW 2026', dj_name: 'Hot Since 82', venue: 'Sagamore Hotel', event_name: 'Knee Deep in Miami', event_date: '2026-03-27', genre: 'deep house' },
  { title: 'Danny Tenaglia Poolside Takeover - Sagamore MMW 2026', dj_name: 'Danny Tenaglia', venue: 'Sagamore Hotel', event_name: 'Danny Tenaglia Poolside', event_date: '2026-03-28', genre: 'house' },
  { title: 'Glitterbox Closing feat. Skream disco set, Derrick Carter - Sagamore MMW 2026', dj_name: 'Skream', venue: 'Sagamore Hotel', event_name: 'Glitterbox', event_date: '2026-03-29', genre: 'disco' },

  // ULTRA
  { title: 'Mau P - Ultra Music Festival Mainstage 2026', dj_name: 'Mau P', venue: 'Bayfront Park', event_name: 'Ultra Music Festival', event_date: '2026-03-28', genre: 'tech house' },
  { title: 'Dom Dolla - Ultra Music Festival Mainstage 2026', dj_name: 'Dom Dolla', venue: 'Bayfront Park', event_name: 'Ultra Music Festival', event_date: '2026-03-27', genre: 'tech house' },
  { title: 'Dennis Cruz b2b Seth Troxler - Ultra RESISTANCE 2026', dj_name: 'Dennis Cruz', venue: 'Bayfront Park', event_name: 'Ultra RESISTANCE', event_date: '2026-03-28', genre: 'tech house' },
  { title: 'Alan Fitzpatrick b2b Marco Faraone - Ultra RESISTANCE 2026', dj_name: 'Alan Fitzpatrick', venue: 'Bayfront Park', event_name: 'Ultra RESISTANCE', event_date: '2026-03-29', genre: 'techno' },

  // OTHER VENUES
  { title: 'Gorgon City Realm - Toe Jam Backlot MMW 2026', dj_name: 'Gorgon City', venue: 'Toe Jam Backlot', event_name: 'Realm', event_date: '2026-03-26', genre: 'house' },
];

// ============================================
// SEED FUNCTIONS
// ============================================

async function getArtistId(name: string): Promise<string | null> {
  const { data } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', name)
    .single();
  return data?.id || null;
}

async function seedArtists() {
  console.log('🎤 Seeding MMW 2026 / UK House artists...\n');

  let created = 0;
  let skipped = 0;

  for (const artist of mmwArtists) {
    const slug = generateSlug(artist.name);

    const { data: existing } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      // Update bio if we have new info
      if (artist.bio) {
        await supabase
          .from('artists')
          .update({ bio: artist.bio })
          .eq('id', existing.id);
      }
      skipped++;
      continue;
    }

    const { data, error } = await supabase
      .from('artists')
      .insert({
        name: artist.name,
        slug,
        genres: artist.genres,
        country: artist.country,
        bio: artist.bio || null,
      })
      .select()
      .single();

    if (error) {
      console.error(`  ❌ ${artist.name}: ${error.message}`);
      continue;
    }

    console.log(`  ✅ ${artist.name} (${artist.country})`);
    created++;

    // Add aliases
    const artistAliases = mmwAliases[artist.name] || [];
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
  console.log('\n🎵 Seeding MMW 2026 / UK House tracks...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const track of mmwTracks) {
    const titleNormalized = normalizeText(track.title);

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

    const artistId = await getArtistId(track.artist);

    const { error } = await supabase
      .from('tracks')
      .insert({
        title: track.title,
        title_normalized: titleNormalized,
        artist_id: artistId,
        artist_name: track.artist,
        label: track.label || null,
        release_year: track.year || null,
        bpm: track.bpm || null,
      });

    if (error) {
      console.error(`  ❌ ${track.artist} - ${track.title}: ${error.message}`);
      errors++;
      continue;
    }

    created++;

    if (created % 25 === 0) {
      console.log(`  📀 Progress: ${created} tracks added...`);
    }
  }

  console.log(`\n✨ Tracks done! Created ${created}, skipped ${skipped}, errors ${errors}`);
}

async function seedSets() {
  console.log('\n🎧 Seeding MMW 2026 sets...\n');

  let created = 0;
  let skipped = 0;

  for (const set of mmwSets) {
    // Check for existing by title
    const { data: existing } = await supabase
      .from('sets')
      .select('id')
      .eq('title', set.title)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const artistId = await getArtistId(set.dj_name);

    const { error } = await supabase
      .from('sets')
      .insert({
        title: set.title,
        slug: generateSlug(set.title),
        dj_name: set.dj_name,
        dj_id: artistId,
        venue: set.venue,
        event_name: set.event_name,
        event_date: set.event_date,
        genre: set.genre,
        source: 'mmw-2026-seed',
      });

    if (error) {
      console.error(`  ❌ ${set.title}: ${error.message}`);
      continue;
    }

    console.log(`  ✅ ${set.event_date} | ${set.venue} | ${set.dj_name}`);
    created++;
  }

  console.log(`\n✨ Sets done! Created ${created}, skipped ${skipped}`);
}

async function showStats() {
  console.log('\n📊 Updated Database Statistics:\n');

  const { count: artistCount } = await supabase
    .from('artists')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total Artists: ${artistCount}`);

  const { count: trackCount } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total Tracks: ${trackCount}`);

  const { count: setCount } = await supabase
    .from('sets')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total Sets: ${setCount}`);

  // Show MMW sets by venue
  const { data: mmwSets } = await supabase
    .from('sets')
    .select('venue, event_name, dj_name, event_date')
    .gte('event_date', '2026-03-24')
    .lte('event_date', '2026-03-30')
    .order('event_date');

  if (mmwSets && mmwSets.length > 0) {
    console.log(`\n   🌴 MMW 2026 Sets: ${mmwSets.length}`);
    const byVenue: Record<string, number> = {};
    for (const set of mmwSets) {
      const venue = set.venue || 'Unknown';
      byVenue[venue] = (byVenue[venue] || 0) + 1;
    }
    for (const [venue, count] of Object.entries(byVenue).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${venue}: ${count} sets`);
    }
  }

  // Show genre breakdown of new artists
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

    console.log('\n   🎵 Genre Breakdown (top 15):');
    const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [genre, count] of sorted) {
      console.log(`     ${genre}: ${count} artists`);
    }
  }
}

async function main() {
  console.log('🌴 MMW 2026 & UK HOUSE SCENE SEEDER');
  console.log('====================================');
  console.log('Miami Music Week 2026 | March 24-29');
  console.log('Factory Town • Club Space • Sagamore • Ultra');
  console.log('====================================\n');

  await seedArtists();
  await seedTracks();
  await seedSets();
  await showStats();

  console.log('\n====================================');
  console.log('🎉 Database loaded with MMW 2026 & UK house data!');
  console.log('   Factory Town: 5 stages, 5 nights');
  console.log('   Club Space: Hellbent, Solid Grooves, Music On');
  console.log('   Sagamore: DJ Mag, Defected, Knee Deep, Glitterbox');
  console.log('   Ultra: Mau P, Dom Dolla, Dennis Cruz, Alan Fitzpatrick');
}

main().catch(console.error);
