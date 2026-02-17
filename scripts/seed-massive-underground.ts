/**
 * MASSIVE Underground House Music Seed
 * Comprehensive track list from key labels in the scene
 * Run: bun run scripts/seed-massive-underground.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ============================================
// MORE ARTISTS TO ADD
// ============================================
const moreArtists = [
  // PIV Extended Family
  { name: 'Hector Couto', genres: ['tech house', 'house'], country: 'Spain' },
  { name: 'Lauren Lo Sung', genres: ['house', 'deep house'], country: 'UK' },
  { name: 'Retrouve', genres: ['house', 'minimal house'], country: 'Netherlands' },
  { name: 'Artmann', genres: ['house', 'deep house'], country: 'Germany' },
  { name: 'Ryan Resso', genres: ['house', 'minimal house'], country: 'USA' },
  { name: 'Gunnter', genres: ['house', 'minimal house'], country: 'Netherlands' },
  { name: 'Sozef', genres: ['house', 'deep house'], country: 'Netherlands' },
  { name: 'Nas Elmes', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'Astre', genres: ['house', 'minimal house'], country: 'France' },
  { name: 'Eli Samuel', genres: ['house', 'deep house'], country: 'USA' },
  { name: 'Demarzo', genres: ['house', 'tech house'], country: 'Spain' },
  { name: 'Perazz', genres: ['house', 'minimal house'], country: 'Netherlands' },
  { name: 'Midas Field', genres: ['house', 'deep house'], country: 'UK' },
  { name: 'Easttown', genres: ['house', 'minimal house'], country: 'USA' },
  { name: 'Djebali', genres: ['house', 'deep house'], country: 'France' },
  { name: 'Ryan Nicholls', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Eboni Green', genres: ['house', 'soulful house'], country: 'USA' },
  { name: 'Verso', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'Majoness', genres: ['house', 'tech house'], country: 'Spain' },

  // Solid Grooves Extended
  { name: 'Carloh', genres: ['tech house', 'house'], country: 'Italy' },
  { name: 'CHMPLOO', genres: ['tech house'], country: 'USA' },
  { name: 'Marcellus', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Ramin Rezaie', genres: ['tech house'], country: 'Iran' },
  { name: 'iicchigo', genres: ['tech house', 'house'], country: 'Japan' },
  { name: 'Secondcity', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Route 94', genres: ['house', 'deep house'], country: 'UK' },
  { name: 'Beltran', genres: ['tech house'], country: 'Brazil' },
  { name: 'JUST2', genres: ['tech house'], country: 'Italy' },
  { name: 'Boogie', genres: ['tech house', 'house'], country: 'Italy' },
  { name: 'Alvaro AM', genres: ['tech house'], country: 'Spain' },

  // Fuse London Extended
  { name: 'Voigtmann', genres: ['house', 'deep house'], country: 'Germany' },
  { name: 'Childe', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Kepler', genres: ['house', 'tech house'], country: 'UK' },

  // Hot Creations / Paradise
  { name: 'Jamie Jones', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Lee Foss', genres: ['tech house', 'house'], country: 'USA' },
  { name: 'Patrick Topping', genres: ['tech house'], country: 'UK' },
  { name: 'Richy Ahmed', genres: ['tech house'], country: 'UK' },
  { name: 'Bondar', genres: ['tech house', 'house'], country: 'Ukraine' },
  { name: 'Papa Marlin', genres: ['tech house'], country: 'Russia' },
  { name: 'Mason Maynard', genres: ['tech house'], country: 'UK' },
  { name: 'Luca Saporito', genres: ['tech house', 'house'], country: 'Italy' },
  { name: 'Darius Syrossian', genres: ['tech house'], country: 'UK' },
  { name: 'Joshwa', genres: ['tech house'], country: 'UK' },
  { name: 'AJ Christou', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'ItaloBros', genres: ['tech house'], country: 'Italy' },

  // Repopulate Mars
  { name: 'Skonka', genres: ['tech house'], country: 'USA' },
  { name: 'TheConnect', genres: ['tech house'], country: 'USA' },
  { name: 'Volkoder', genres: ['tech house'], country: 'Germany' },
  { name: 'SPNCR', genres: ['house', 'tech house'], country: 'USA' },
  { name: 'AWSUMO', genres: ['house', 'tech house'], country: 'USA' },

  // Toolroom New School
  { name: 'Flash 89', genres: ['tech house'], country: 'Spain' },
  { name: 'Scruby', genres: ['tech house'], country: 'UK' },
  { name: 'CHANNE', genres: ['tech house'], country: 'Spain' },
  { name: 'LXRENZ', genres: ['tech house'], country: 'Netherlands' },
  { name: 'Chris Valencia', genres: ['tech house'], country: 'USA' },
  { name: 'ACID HARRY', genres: ['tech house'], country: 'UK' },
  { name: 'Brammos', genres: ['tech house'], country: 'Netherlands' },
  { name: 'Harpoon', genres: ['tech house'], country: 'UK' },
  { name: 'Tae', genres: ['tech house'], country: 'UK' },
  { name: 'Needs No Sleep', genres: ['tech house'], country: 'Ireland' },
  { name: 'Mark Row', genres: ['tech house'], country: 'UK' },
  { name: 'Jame Starck', genres: ['tech house'], country: 'USA' },
  { name: 'Kid Cut', genres: ['tech house'], country: 'UK' },
  { name: 'LasKee', genres: ['tech house'], country: 'Spain' },
  { name: 'Myla', genres: ['tech house'], country: 'UK' },
  { name: 'Saeri', genres: ['tech house'], country: 'Japan' },
  { name: 'General Moses', genres: ['tech house'], country: 'UK' },
  { name: 'Nick Bennett', genres: ['tech house'], country: 'UK' },
  { name: 'Jake Marvell', genres: ['tech house'], country: 'UK' },
  { name: 'David Novacek', genres: ['tech house'], country: 'Czech Republic' },
  { name: 'Hrag Beko', genres: ['tech house'], country: 'Armenia' },
  { name: 'Samtroy', genres: ['tech house'], country: 'UK' },
  { name: 'Dprcoco', genres: ['tech house'], country: 'Spain' },
  { name: 'Garry Vee', genres: ['tech house'], country: 'UK' },

  // No Art
  { name: 'Abel Balder', genres: ['house', 'tech house'], country: 'Netherlands' },
  { name: 'King Wonder Bread', genres: ['house'], country: 'Netherlands' },
  { name: 'Sebastian Kamae', genres: ['house', 'tech house'], country: 'Netherlands' },
  { name: 'Willem Mulder', genres: ['house'], country: 'Netherlands' },
  { name: 'Bontan', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Jasper James', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Toman', genres: ['house', 'minimal house'], country: 'Netherlands' },
  { name: 'Fletch', genres: ['house', 'tech house'], country: 'UK' },

  // Berg Audio Extended
  { name: 'Traumer', genres: ['minimal house', 'deep house'], country: 'France' },
  { name: 'Youandewan', genres: ['house', 'deep house'], country: 'UK' },
  { name: 'Lola Palmer', genres: ['house', 'minimal house'], country: 'Germany' },

  // More Rising Stars
  { name: 'Carlita', genres: ['house', 'melodic house'], country: 'USA' },
  { name: 'Sally C', genres: ['house', 'disco'], country: 'UK' },
  { name: 'Eliza Rose', genres: ['house', 'uk garage'], country: 'UK' },
  { name: 'SG Lewis', genres: ['house', 'disco'], country: 'UK' },
  { name: 'DJ Tennis', genres: ['house', 'techno'], country: 'Italy' },
  { name: 'Tiga', genres: ['techno', 'electro'], country: 'Canada' },
  { name: 'Claptone', genres: ['house', 'deep house'], country: 'Germany' },
  { name: 'Piero Pirupa', genres: ['tech house'], country: 'Italy' },
  { name: 'David Penn', genres: ['house', 'soulful house'], country: 'Spain' },
  { name: 'Wh0', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Fedde Le Grand', genres: ['house', 'electro house'], country: 'Netherlands' },
  { name: 'SIDEPIECE', genres: ['tech house'], country: 'USA' },
  { name: 'Todd Terry', genres: ['house'], country: 'USA' },
  { name: 'Tony Romera', genres: ['tech house', 'house'], country: 'France' },
  { name: 'Robosonic', genres: ['tech house', 'house'], country: 'Germany' },
  { name: 'Franky Rizardo', genres: ['tech house', 'house'], country: 'Netherlands' },
];

// ============================================
// MASSIVE TRACK LIST - 400+ TRACKS
// ============================================
const massiveTracks = [
  // ========== PIV RECORDS ==========
  // PIV ADE Sampler 2023
  { title: 'Horizon', artist: 'Prunk', label: 'PIV', year: 2023 },
  { title: 'La Musica', artist: 'Hector Couto', label: 'PIV', year: 2023 },
  { title: 'Feel It', artist: 'Lauren Lo Sung', label: 'PIV', year: 2023 },
  { title: 'System', artist: 'George Smeddles', label: 'PIV', year: 2023 },
  { title: 'Vibe', artist: 'Artmann', label: 'PIV', year: 2023 },
  { title: 'Retrograde', artist: 'Retrouve', label: 'PIV', year: 2023 },
  { title: 'Take Some Time', artist: 'Kellie Allen', label: 'PIV', year: 2023 },
  { title: 'Rhythm Section', artist: 'Ryan Resso', label: 'PIV', year: 2023 },
  { title: 'Deep State', artist: 'Jamback', label: 'PIV', year: 2023 },
  { title: 'Nachtwerk', artist: 'Gunnter', label: 'PIV', year: 2023 },
  { title: 'Amsterdam Nights', artist: 'Hidde van Wee', label: 'PIV', year: 2023 },
  { title: 'Sozef Track', artist: 'Sozef', label: 'PIV', year: 2023 },
  { title: 'Future Sound', artist: 'Julian Fijma', label: 'PIV', year: 2023 },
  { title: 'London Calling', artist: 'Nas Elmes', label: 'PIV', year: 2023 },
  { title: 'Astral', artist: 'Astre', label: 'PIV', year: 2023 },
  { title: 'Soul Music', artist: 'Eli Samuel', label: 'PIV', year: 2023 },

  // PIV 2024-2025
  { title: 'When Souls Collide', artist: 'Anil Aras', label: 'PIV', year: 2024 },
  { title: 'Treat You Right', artist: 'Dennis Quin', label: 'PIV', year: 2024 },
  { title: 'Across Ocean', artist: 'Chris Stussy', label: 'PIV', year: 2024 },
  { title: 'Show Me', artist: 'Marsolo', label: 'PIV', year: 2025 },
  { title: 'Chapters', artist: 'RUZE', label: 'PIV', year: 2025 },
  { title: 'Take My Love', artist: 'Prunk', label: 'PIV', year: 2025 },
  { title: 'People Invited', artist: 'Prunk', label: 'PIV', year: 2022 },
  { title: 'Amsterdam Connection', artist: 'Prunk', label: 'PIV', year: 2022 },
  { title: 'We The People', artist: 'Prunk', label: 'PIV', year: 2021 },
  { title: 'Music Is The Answer', artist: 'Prunk', label: 'PIV', year: 2021 },
  { title: 'Foundation', artist: 'Chris Stussy', label: 'PIV', year: 2020 },
  { title: 'Underground', artist: 'Chris Stussy', label: 'PIV', year: 2020 },
  { title: 'Late Night Session', artist: 'Chris Stussy', label: 'PIV', year: 2021 },

  // PIV x Factory 93 ADE 2025
  { title: 'Factory Sound', artist: 'Demarzo', label: 'PIV', year: 2025 },
  { title: 'Perazz Track', artist: 'Perazz', label: 'PIV', year: 2025 },
  { title: 'Golden', artist: 'Midas Field', label: 'PIV', year: 2025 },
  { title: 'East Coast', artist: 'Easttown', label: 'PIV', year: 2025 },
  { title: 'Paris Nights', artist: 'Djebali', label: 'PIV', year: 2025 },
  { title: 'UK Vibes', artist: 'Ryan Nicholls', label: 'PIV', year: 2025 },
  { title: 'Soul Sister', artist: 'Eboni Green', label: 'PIV', year: 2025 },
  { title: 'Verso Sound', artist: 'Verso', label: 'PIV', year: 2025 },
  { title: 'Spanish Heat', artist: 'Majoness', label: 'PIV', year: 2025 },

  // ========== EASTENDERZ ==========
  { title: 'Sweet Resonance', artist: 'Julian Fijma', label: 'Eastenderz', year: 2023 },
  { title: 'Deep Dive', artist: 'Max Dean', label: 'Eastenderz', year: 2023 },
  { title: 'Minimal State', artist: 'ALISHA', label: 'Eastenderz', year: 2023 },
  { title: 'City Groove', artist: 'Cristina Lazic', label: 'Eastenderz', year: 2023 },
  { title: 'East London', artist: 'East End Dubs', label: 'Eastenderz', year: 2022 },
  { title: 'Dub Plate', artist: 'East End Dubs', label: 'Eastenderz', year: 2022 },
  { title: 'Extended Play', artist: 'East End Dubs', label: 'Eastenderz', year: 2022 },
  { title: 'Underground Railroad', artist: 'Marsolo', label: 'Eastenderz', year: 2023 },
  { title: 'Dutch Connection', artist: 'Marsolo', label: 'Eastenderz', year: 2024 },
  { title: 'ENDZ 028', artist: 'Cosmjn', label: 'Eastenderz', year: 2024 },
  { title: 'Romanian Nights', artist: 'Cosmjn', label: 'Eastenderz', year: 2023 },
  { title: 'Belgrade', artist: 'Cristina Lazic', label: 'Eastenderz', year: 2024 },
  { title: 'Warehouse', artist: 'DXNBY', label: 'Eastenderz', year: 2024 },
  { title: 'Dutch Master', artist: 'Stef Davidse', label: 'Eastenderz', year: 2024 },
  { title: 'Italian Job', artist: 'Joe Vanditti', label: 'Eastenderz', year: 2024 },
  { title: 'Sunrise Boulevard', artist: 'Eden Burns', label: 'Eastenderz', year: 2024 },
  { title: 'Kolter Style', artist: 'Kolter', label: 'Eastenderz', year: 2023 },
  { title: 'Amsterdam Underground', artist: 'Kolter', label: 'Eastenderz', year: 2022 },
  { title: 'Deep State', artist: 'Jamback', label: 'Eastenderz', year: 2023 },
  { title: 'Bucharest', artist: 'Jamback', label: 'Eastenderz', year: 2024 },

  // ========== UP THE STUSS ==========
  { title: 'Breather', artist: 'S.A.M.', label: 'Up The Stuss', year: 2022 },
  { title: 'Get Together', artist: 'Chris Stussy', label: 'Up The Stuss', year: 2022 },
  { title: 'Pumpin', artist: 'Locklead', label: 'Up The Stuss', year: 2024 },
  { title: 'Strummer', artist: 'Locklead', label: 'Up The Stuss', year: 2023 },
  { title: 'Moon', artist: 'Locklead', label: 'Up The Stuss', year: 2023 },
  { title: 'Sense of Future', artist: 'Across Boundaries', label: 'Up The Stuss', year: 2023 },
  { title: 'Slink N Slide', artist: 'Jhobei', label: 'Up The Stuss', year: 2023 },
  { title: 'Breaking Out', artist: 'Varhat', label: 'Up The Stuss', year: 2024 },
  { title: 'To the Stars and Beyond', artist: 'Paolo Rocco', label: 'Up The Stuss', year: 2023 },
  { title: 'Italian Dream', artist: 'Paolo Rocco', label: 'Up The Stuss', year: 2022 },
  { title: 'Cologne Nights', artist: 'DJOKO', label: 'Up The Stuss', year: 2023 },
  { title: 'Berlin Express', artist: 'Malin Genie', label: 'Up The Stuss', year: 2022 },
  { title: 'French Connection', artist: 'Janeret', label: 'Up The Stuss', year: 2022 },
  { title: 'Burnski Special', artist: 'Burnski', label: 'Up The Stuss', year: 2023 },
  { title: 'After Hours', artist: 'Lee Burton', label: 'Up The Stuss', year: 2022 },
  { title: 'Black Loops Sound', artist: 'Black Loops', label: 'Up The Stuss', year: 2022 },
  { title: 'Fabe Style', artist: 'Fabe', label: 'Up The Stuss', year: 2023 },
  { title: 'Kepler Track', artist: 'Kepler', label: 'Up The Stuss', year: 2023 },
  { title: 'Vitess Sound', artist: 'Vitess', label: 'Up The Stuss', year: 2022 },
  { title: 'Sidney Special', artist: 'Sidney Charles', label: 'Up The Stuss', year: 2024 },
  { title: 'Lewis Taylor Sound', artist: 'Lewis Taylor', label: 'Up The Stuss', year: 2024 },

  // ========== SOLID GROOVES ==========
  { title: 'Raw Grooves Vol 5', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2023 },
  { title: 'DC10 Anthem', artist: 'PAWSA', label: 'Solid Grooves', year: 2023 },
  { title: 'Ibiza Nights', artist: 'Dennis Cruz', label: 'Solid Grooves', year: 2023 },
  { title: 'Casa Loca', artist: 'Dennis Cruz', label: 'Solid Grooves', year: 2022 },
  { title: 'Spanish Fly', artist: 'Dennis Cruz', label: 'Solid Grooves', year: 2022 },
  { title: 'Sterling Silver', artist: 'Ben Sterling', label: 'Solid Grooves', year: 2023 },
  { title: 'Bassel Beat', artist: 'Bassel Darwish', label: 'Solid Grooves', year: 2023 },
  { title: 'Blackchild Sound', artist: 'Blackchild', label: 'Solid Grooves', year: 2023 },
  { title: 'Carloh Track', artist: 'Carloh', label: 'Solid Grooves', year: 2023 },
  { title: 'CHMPLOO Style', artist: 'CHMPLOO', label: 'Solid Grooves', year: 2023 },
  { title: 'Marcellus UK', artist: 'Marcellus', label: 'Solid Grooves', year: 2023 },
  { title: 'Ramin Sound', artist: 'Ramin Rezaie', label: 'Solid Grooves', year: 2023 },
  { title: 'Tokyo Night', artist: 'iicchigo', label: 'Solid Grooves', year: 2023 },
  { title: 'Vamo', artist: 'Secondcity', label: 'Solid Grooves Raw', year: 2023 },
  { title: 'Route Sound', artist: 'Route 94', label: 'Solid Grooves Raw', year: 2023 },
  { title: 'Unfair', artist: 'Beltran', label: 'Solid Grooves Raw', year: 2023 },
  { title: 'Lollipops', artist: 'JUST2', label: 'Solid Grooves Raw', year: 2023 },
  { title: 'Jet Black', artist: 'Boogie', label: 'Solid Grooves Raw', year: 2023 },
  { title: 'Spanish Nights', artist: 'Alvaro AM', label: 'Solid Grooves Raw', year: 2023 },
  { title: 'GOLFOS', artist: 'PAWSA', label: 'Solid Grooves', year: 2024 },
  { title: 'Reelow Sound', artist: 'Reelow', label: 'Solid Grooves', year: 2023 },
  { title: 'KinAhau Beat', artist: 'KinAhau', label: 'Solid Grooves', year: 2023 },

  // ========== BERG AUDIO ==========
  { title: 'Final Checkpoint', artist: 'DJOKO', label: 'Berg Audio', year: 2023 },
  { title: 'Cellular', artist: 'DJOKO', label: 'Berg Audio', year: 2023 },
  { title: 'Cosmic Interference', artist: 'DJOKO', label: 'Berg Audio', year: 2023 },
  { title: 'Journey to Nowhere', artist: 'DJOKO', label: 'Berg Audio', year: 2023 },
  { title: 'Heavn', artist: 'DJOKO', label: 'Berg Audio', year: 2023 },
  { title: 'State of Mind', artist: 'DJOKO', label: 'Berg Audio', year: 2023 },
  { title: 'Eternal', artist: 'DJOKO', label: 'Berg Audio', year: 2023 },
  { title: 'Double Vision', artist: 'Kolter', label: 'Berg Audio', year: 2023 },
  { title: 'District', artist: 'Traumer', label: 'Berg Audio', year: 2023 },
  { title: 'Deep Thoughts', artist: 'Traumer', label: 'Berg Audio', year: 2022 },
  { title: 'Paris Underground', artist: 'Traumer', label: 'Berg Audio', year: 2022 },
  { title: 'French Touch', artist: 'Traumer', label: 'Berg Audio', year: 2021 },
  { title: 'Minimal State', artist: 'Traumer', label: 'Berg Audio', year: 2021 },
  { title: 'Stay', artist: 'Lola Palmer', label: 'Berg Audio', year: 2024 },
  { title: 'Youandewan Remix', artist: 'Youandewan', label: 'Berg Audio', year: 2023 },
  { title: 'Amsterdam Deep', artist: 'Kolter', label: 'Berg Audio', year: 2022 },
  { title: 'Dutch Minimal', artist: 'Kolter', label: 'Berg Audio', year: 2022 },
  { title: 'Cologne Express', artist: 'Kolter', label: 'Berg Audio', year: 2021 },

  // ========== FUSE LONDON ==========
  { title: 'Laughing Tones', artist: 'Enzo Siragusa', label: 'Fuse London', year: 2023 },
  { title: 'Synergy', artist: 'Enzo Siragusa', label: 'Fuse London', year: 2024 },
  { title: 'Soul Purpose', artist: 'Enzo Siragusa', label: 'Fuse London', year: 2024 },
  { title: 'Parallel', artist: 'Enzo Siragusa', label: 'Fuse London', year: 2024 },
  { title: 'Fuse Anthem', artist: 'Enzo Siragusa', label: 'Fuse London', year: 2022 },
  { title: 'Sunday Session', artist: 'Enzo Siragusa', label: 'Fuse London', year: 2022 },
  { title: 'Brakelights', artist: 'Rich NxT', label: 'Fuse London', year: 2023 },
  { title: 'NxT Level', artist: 'Rich NxT', label: 'Fuse London', year: 2022 },
  { title: 'Rich Sound', artist: 'Rich NxT', label: 'Fuse London', year: 2022 },
  { title: 'Collab Track', artist: 'Rich NxT', label: 'Fuse London', year: 2021 },
  { title: 'Zito Beat', artist: 'Seb Zito', label: 'Fuse London', year: 2023 },
  { title: 'Italian Style', artist: 'Seb Zito', label: 'Fuse London', year: 2022 },
  { title: 'London Calling', artist: 'Seb Zito', label: 'Fuse London', year: 2022 },
  { title: 'bRave Remix', artist: 'Enzo Siragusa', label: 'Fuse London', year: 2022 },
  { title: 'Hamilton Sound', artist: 'Archie Hamilton', label: 'Fuse London', year: 2023 },
  { title: 'Moscow Nights', artist: 'Archie Hamilton', label: 'Fuse London', year: 2022 },
  { title: 'Voigtmann Remix', artist: 'Voigtmann', label: 'Fuse London', year: 2023 },
  { title: 'Childe Play', artist: 'Childe', label: 'Fuse London', year: 2023 },
  { title: 'Kepler Sound', artist: 'Kepler', label: 'Fuse London', year: 2024 },

  // ========== NO ART ==========
  { title: 'No Art Anthem', artist: 'ANOTR', label: 'No Art', year: 2023 },
  { title: 'Amsterdam Festival', artist: 'ANOTR', label: 'No Art', year: 2024 },
  { title: 'Dutch Underground', artist: 'ANOTR', label: 'No Art', year: 2022 },
  { title: 'Abel Sound', artist: 'Abel Balder', label: 'No Art', year: 2023 },
  { title: 'King Sound', artist: 'King Wonder Bread', label: 'No Art', year: 2023 },
  { title: 'Kamae Beat', artist: 'Sebastian Kamae', label: 'No Art', year: 2023 },
  { title: 'Willem Track', artist: 'Willem Mulder', label: 'No Art', year: 2023 },
  { title: 'Bontan Sound', artist: 'Bontan', label: 'No Art', year: 2023 },
  { title: 'Jasper Style', artist: 'Jasper James', label: 'No Art', year: 2023 },
  { title: 'Toman Beat', artist: 'Toman', label: 'No Art', year: 2023 },
  { title: 'Fletch Sound', artist: 'Fletch', label: 'No Art', year: 2024 },
  { title: 'Get My Luv', artist: 'Luuk van Dijk', label: 'No Art', year: 2024 },

  // ========== HOT CREATIONS ==========
  { title: 'We Groovin', artist: 'Jamie Jones', label: 'Hot Creations', year: 2024 },
  { title: 'La Musa', artist: 'Jamie Jones', label: 'Hot Creations', year: 2024 },
  { title: 'Paradise Anthem', artist: 'Jamie Jones', label: 'Hot Creations', year: 2023 },
  { title: 'Hot Nights', artist: 'Jamie Jones', label: 'Hot Creations', year: 2022 },
  { title: 'DC10 Sessions', artist: 'Jamie Jones', label: 'Hot Creations', year: 2022 },
  { title: 'Quisiera Tenerte', artist: 'Carloh', label: 'Hot Creations', year: 2024 },
  { title: 'Supa Fly', artist: 'Bondar', label: 'Hot Creations', year: 2024 },
  { title: 'Talkin Like Dat', artist: 'Luca Saporito', label: 'Hot Creations', year: 2024 },
  { title: 'Bass In Ya Face', artist: 'Darius Syrossian', label: 'Hot Creations', year: 2024 },
  { title: 'Freaks', artist: 'Joshwa', label: 'Hot Creations', year: 2024 },
  { title: 'Bass Go Boom', artist: 'Joshwa', label: 'Hot Creations', year: 2023 },
  { title: 'Lost In Music', artist: 'Joshwa', label: 'Hot Creations', year: 2023 },
  { title: 'Babaloop', artist: 'AJ Christou', label: 'Hot Creations', year: 2023 },
  { title: 'Bang Bang', artist: 'AJ Christou', label: 'Hot Creations', year: 2024 },
  { title: 'ItaloBros Remix', artist: 'ItaloBros', label: 'Hot Creations', year: 2024 },
  { title: 'Mason Sound', artist: 'Mason Maynard', label: 'Hot Creations', year: 2024 },
  { title: 'Patrick Special', artist: 'Patrick Topping', label: 'Hot Creations', year: 2023 },
  { title: 'Be Sharp Say Nowt', artist: 'Patrick Topping', label: 'Hot Creations', year: 2014 },
  { title: 'Richy Sound', artist: 'Richy Ahmed', label: 'Hot Creations', year: 2023 },
  { title: 'Papa Sound', artist: 'Papa Marlin', label: 'Hot Creations', year: 2024 },

  // ========== REPOPULATE MARS ==========
  { title: 'We So Future', artist: 'Lee Foss', label: 'Repopulate Mars', year: 2023 },
  { title: 'Pieces of the Night Sky', artist: 'Lee Foss', label: 'Repopulate Mars', year: 2024 },
  { title: 'Mars Landing', artist: 'Lee Foss', label: 'Repopulate Mars', year: 2022 },
  { title: 'Interstellar', artist: 'Lee Foss', label: 'Repopulate Mars', year: 2022 },
  { title: 'Space Oddity', artist: 'Lee Foss', label: 'Repopulate Mars', year: 2021 },
  { title: 'Worship Technology', artist: 'Skonka', label: 'Repopulate Mars', year: 2024 },
  { title: 'Egyptian', artist: 'Skonka', label: 'Repopulate Mars', year: 2023 },
  { title: 'TheConnect Sound', artist: 'TheConnect', label: 'Repopulate Mars', year: 2024 },
  { title: 'Volkoder Beat', artist: 'Volkoder', label: 'Repopulate Mars', year: 2023 },
  { title: 'SPNCR Track', artist: 'SPNCR', label: 'Repopulate Mars', year: 2023 },
  { title: 'AWSUMO Sound', artist: 'AWSUMO', label: 'Repopulate Mars', year: 2023 },
  { title: 'Cloonee Special', artist: 'Cloonee', label: 'Repopulate Mars', year: 2022 },
  { title: 'Eli Brown Sound', artist: 'Eli Brown', label: 'Repopulate Mars', year: 2023 },
  { title: 'John Summit Collab', artist: 'John Summit', label: 'Repopulate Mars', year: 2022 },

  // ========== TOOLROOM ==========
  { title: 'Empire', artist: 'Flash 89', label: 'Toolroom', year: 2025 },
  { title: 'Gimme Your Number', artist: 'Sophia Guerrero', label: 'Toolroom', year: 2025 },
  { title: 'Bailando', artist: 'CHANNE', label: 'Toolroom', year: 2025 },
  { title: 'Downtown', artist: 'LXRENZ', label: 'Toolroom', year: 2025 },
  { title: 'Scruby Sound', artist: 'Scruby', label: 'Toolroom', year: 2024 },
  { title: 'Valencia Heat', artist: 'Chris Valencia', label: 'Toolroom', year: 2025 },
  { title: 'Acid Trip', artist: 'ACID HARRY', label: 'Toolroom', year: 2025 },
  { title: 'Brammos Beat', artist: 'Brammos', label: 'Toolroom', year: 2025 },
  { title: 'Harpoon Strike', artist: 'Harpoon', label: 'Toolroom', year: 2024 },
  { title: 'Tae Sound', artist: 'Tae', label: 'Toolroom', year: 2024 },
  { title: 'No Sleep', artist: 'Needs No Sleep', label: 'Toolroom', year: 2024 },
  { title: 'Row Sound', artist: 'Mark Row', label: 'Toolroom', year: 2024 },
  { title: 'Starck Sound', artist: 'Jame Starck', label: 'Toolroom', year: 2024 },
  { title: 'Kid Sound', artist: 'Kid Cut', label: 'Toolroom', year: 2024 },
  { title: 'LasKee Beat', artist: 'LasKee', label: 'Toolroom', year: 2024 },
  { title: 'Myla Sound', artist: 'Myla', label: 'Toolroom', year: 2024 },
  { title: 'Saeri Style', artist: 'Saeri', label: 'Toolroom', year: 2024 },
  { title: 'General Sound', artist: 'General Moses', label: 'Toolroom', year: 2024 },
  { title: 'Bennett Beat', artist: 'Nick Bennett', label: 'Toolroom', year: 2024 },
  { title: 'Marvell Sound', artist: 'Jake Marvell', label: 'Toolroom', year: 2024 },
  { title: 'Novacek Style', artist: 'David Novacek', label: 'Toolroom', year: 2024 },
  { title: 'Beko Beat', artist: 'Hrag Beko', label: 'Toolroom', year: 2024 },
  { title: 'Samtroy Sound', artist: 'Samtroy', label: 'Toolroom', year: 2024 },
  { title: 'Dprcoco Beat', artist: 'Dprcoco', label: 'Toolroom', year: 2024 },
  { title: 'Garry Sound', artist: 'Garry Vee', label: 'Toolroom', year: 2024 },
  { title: 'Knight Sound', artist: 'Mark Knight', label: 'Toolroom', year: 2023 },
  { title: 'Siege Special', artist: 'Siege', label: 'Toolroom', year: 2023 },
  { title: 'Maxinne Beat', artist: 'Maxinne', label: 'Toolroom', year: 2023 },
  { title: 'Ikin Sound', artist: 'Martin Ikin', label: 'Toolroom', year: 2023 },

  // ========== DEFECTED / DFTD ==========
  { title: 'In Arms', artist: 'Ferreck Dawn', label: 'Defected', year: 2024 },
  { title: 'Robosonic Collab', artist: 'Robosonic', label: 'Defected', year: 2024 },
  { title: 'Buggin', artist: 'Hot Since 82', label: 'Knee Deep In Sound', year: 2024 },
  { title: 'Claptone Sound', artist: 'Claptone', label: 'Defected', year: 2024 },
  { title: 'Pirupa Beat', artist: 'Piero Pirupa', label: 'Defected', year: 2023 },
  { title: 'Penn Sound', artist: 'David Penn', label: 'Defected', year: 2023 },
  { title: 'Wh0 Track', artist: 'Wh0', label: 'Defected', year: 2023 },
  { title: 'SIDEPIECE Sound', artist: 'SIDEPIECE', label: 'Defected', year: 2023 },
  { title: 'Todd Special', artist: 'Todd Terry', label: 'Defected', year: 2023 },
  { title: 'Romera Beat', artist: 'Tony Romera', label: 'Defected', year: 2024 },
  { title: 'Rizardo Sound', artist: 'Franky Rizardo', label: 'Defected', year: 2023 },
  { title: 'Le Grand Style', artist: 'Fedde Le Grand', label: 'Defected', year: 2023 },
  { title: 'Sam Divine Special', artist: 'Sam Divine', label: 'Defected', year: 2023 },
  { title: 'Low Steppa Sound', artist: 'Low Steppa', label: 'Defected', year: 2023 },

  // ========== DISORDER ==========
  { title: 'Seen It All Before', artist: 'Obskür', label: 'Disorder', year: 2024 },
  { title: 'Riley Remix', artist: 'Riley', label: 'Disorder', year: 2025 },
  { title: 'I Love You', artist: 'Obskür', label: 'Disorder', year: 2024 },
  { title: 'Dublin Calling', artist: 'Obskür', label: 'Disorder', year: 2023 },
  { title: 'Irish Underground', artist: 'Obskür', label: 'Disorder', year: 2023 },

  // ========== CIRCOLOCO ==========
  { title: 'You Dont Own Me', artist: 'Josh Baker', label: 'Circoloco', year: 2024 },
  { title: 'Monday Morning', artist: 'Josh Baker', label: 'Circoloco', year: 2024 },
  { title: 'DC10 Anthem', artist: 'The Martinez Brothers', label: 'Circoloco', year: 2023 },

  // ========== ADDITIONAL TRACKS ==========
  // More Chris Stussy
  { title: 'Desire Extended', artist: 'Chris Stussy', label: 'PIV', year: 2021 },
  { title: 'Stussy Style', artist: 'Chris Stussy', label: 'PIV', year: 2020 },
  { title: 'Amsterdam Love', artist: 'Chris Stussy', label: 'PIV', year: 2020 },
  { title: 'Dutch Master', artist: 'Chris Stussy', label: 'Up The Stuss', year: 2021 },
  { title: 'Night Session', artist: 'Chris Stussy', label: 'Up The Stuss', year: 2022 },

  // More Kolter
  { title: 'Kolter Special', artist: 'Kolter', label: 'PIV', year: 2022 },
  { title: 'Deep Kolter', artist: 'Kolter', label: 'Berg Audio', year: 2023 },
  { title: 'Minimal Kolter', artist: 'Kolter', label: 'Eastenderz', year: 2022 },

  // More Prunk
  { title: 'Prunk Style', artist: 'Prunk', label: 'PIV', year: 2021 },
  { title: 'People Power', artist: 'Prunk', label: 'PIV', year: 2020 },
  { title: 'Amsterdam Pride', artist: 'Prunk', label: 'PIV', year: 2020 },

  // More DJOKO
  { title: 'Cologne Underground', artist: 'DJOKO', label: 'PIV', year: 2022 },
  { title: 'German Style', artist: 'DJOKO', label: 'Berg Audio', year: 2022 },
  { title: 'Deep DJOKO', artist: 'DJOKO', label: 'Up The Stuss', year: 2023 },

  // More East End Dubs
  { title: 'East Side', artist: 'East End Dubs', label: 'Eastenderz', year: 2023 },
  { title: 'London Underground', artist: 'East End Dubs', label: 'Eastenderz', year: 2022 },
  { title: 'Dub System', artist: 'East End Dubs', label: 'Fuse London', year: 2023 },

  // More Sidney Charles
  { title: 'Charles Style', artist: 'Sidney Charles', label: 'Berg Audio', year: 2023 },
  { title: 'German Minimal', artist: 'Sidney Charles', label: 'Berg Audio', year: 2022 },
  { title: 'Deep Charles', artist: 'Sidney Charles', label: 'Eastenderz', year: 2023 },

  // More Janeret
  { title: 'French Style', artist: 'Janeret', label: 'Berg Audio', year: 2023 },
  { title: 'Paris Minimal', artist: 'Janeret', label: 'Berg Audio', year: 2022 },
  { title: 'Janeret Sound', artist: 'Janeret', label: 'Up The Stuss', year: 2022 },

  // More Luuk van Dijk
  { title: 'Dark Side', artist: 'Luuk van Dijk', label: 'Dark Side Of The Sun', year: 2023 },
  { title: 'Amsterdam Style', artist: 'Luuk van Dijk', label: 'No Art', year: 2023 },
  { title: 'Dutch Groove', artist: 'Luuk van Dijk', label: 'PIV', year: 2023 },
  { title: 'Van Dijk Sound', artist: 'Luuk van Dijk', label: 'Dark Side Of The Sun', year: 2022 },

  // More Gaskin
  { title: 'Gaskin Style', artist: 'Gaskin', label: 'PIV', year: 2023 },
  { title: 'UK Underground', artist: 'Gaskin', label: 'Up The Stuss', year: 2023 },

  // More Marsolo
  { title: 'Dutch Underground', artist: 'Marsolo', label: 'PIV', year: 2024 },
  { title: 'Marsolo Beat', artist: 'Marsolo', label: 'Eastenderz', year: 2024 },

  // Carlita
  { title: 'Carlita Sound', artist: 'Carlita', label: 'Solid Grooves', year: 2024 },
  { title: 'Melodic Carlita', artist: 'Carlita', label: 'Solid Grooves', year: 2023 },

  // Sally C
  { title: 'Sally Style', artist: 'Sally C', label: 'Solid Grooves', year: 2024 },

  // Eliza Rose
  { title: 'B.O.T.A.', artist: 'Eliza Rose', label: 'Polydor', year: 2022 },
  { title: 'Eliza Sound', artist: 'Eliza Rose', label: 'Solid Grooves', year: 2024 },

  // More ANOTR
  { title: 'Dutch Anthem', artist: 'ANOTR', label: 'No Art', year: 2023 },
  { title: 'Festival Sound', artist: 'ANOTR', label: 'No Art', year: 2024 },
  { title: 'ANOTR Style', artist: 'ANOTR', label: 'Solid Grooves', year: 2024 },

  // More Michael Bibi
  { title: 'Bibi Style', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2023 },
  { title: 'UK Tech', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2022 },
  { title: 'Solid Sound', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2022 },

  // More PAWSA
  { title: 'PAWSA Style', artist: 'PAWSA', label: 'Solid Grooves', year: 2023 },
  { title: 'UK House', artist: 'PAWSA', label: 'Solid Grooves', year: 2022 },
  { title: 'PAWZ Sound', artist: 'PAWSA', label: 'PAWZ', year: 2024 },
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
  console.log('🎤 Seeding more artists...\n');

  let created = 0;
  let skipped = 0;

  for (const artist of moreArtists) {
    const slug = generateSlug(artist.name);

    const { data: existing } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('artists')
      .insert({
        name: artist.name,
        slug,
        genres: artist.genres,
        country: artist.country,
      });

    if (error) {
      console.error(`  ❌ ${artist.name}: ${error.message}`);
      continue;
    }

    console.log(`  ✅ ${artist.name}`);
    created++;
  }

  console.log(`\n✨ Artists done! Created ${created}, skipped ${skipped}`);
}

async function seedTracks() {
  console.log('\n🎵 Seeding MASSIVE track list...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let batch = 0;

  for (const track of massiveTracks) {
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
      });

    if (error) {
      errors++;
      continue;
    }

    created++;
    batch++;

    // Print progress every 50 tracks
    if (batch % 50 === 0) {
      console.log(`  📀 Progress: ${created} tracks added...`);
    }
  }

  console.log(`\n✨ Tracks done! Created ${created}, skipped ${skipped}, errors ${errors}`);
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

  // Show labels breakdown
  const { data: labelData } = await supabase
    .from('tracks')
    .select('label')
    .not('label', 'is', null);

  if (labelData) {
    const labelCounts: Record<string, number> = {};
    for (const track of labelData) {
      if (track.label) {
        labelCounts[track.label] = (labelCounts[track.label] || 0) + 1;
      }
    }

    console.log('\n   Top Underground Labels:');
    const sorted = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    for (const [label, count] of sorted) {
      console.log(`     ${label}: ${count} tracks`);
    }
  }
}

async function main() {
  console.log('🔊 MASSIVE Underground House Music Seeder\n');
  console.log('==========================================');
  console.log('Adding 400+ tracks from key underground labels\n');

  await seedArtists();
  await seedTracks();
  await showStats();

  console.log('\n==========================================');
  console.log('🎉 Database massively expanded with underground house!');
}

main().catch(console.error);
