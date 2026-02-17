/**
 * Seed underground/minimal tech house artists, tracks, and sets
 * Focused on the Chris Stussy / PIV / Solid Grooves / Eastenderz scene
 * Run: bun run scripts/seed-underground-house.ts
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
// UNDERGROUND / MINIMAL TECH HOUSE ARTISTS
// The new wave - Chris Stussy, Obskür, Josh Baker style
// ============================================
const undergroundArtists = [
  // PIV Records Core
  { name: 'Chris Stussy', genres: ['minimal house', 'deep house', 'tech house'], country: 'Netherlands' },
  { name: 'Prunk', genres: ['house', 'deep house'], country: 'Netherlands' },
  { name: 'Luuk van Dijk', genres: ['house', 'minimal house'], country: 'Netherlands' },
  { name: 'Kolter', genres: ['minimal house', 'deep house'], country: 'Netherlands' },
  { name: 'Marsolo', genres: ['minimal house', 'deep house'], country: 'Netherlands' },
  { name: 'Gaskin', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'M-High', genres: ['house', 'deep house'], country: 'Netherlands' },
  { name: 'Dennis Quin', genres: ['house', 'disco house'], country: 'Netherlands' },
  { name: 'Jesse Maas', genres: ['house', 'minimal house'], country: 'Netherlands' },

  // Obskür & Irish Scene
  { name: 'Obskür', genres: ['house', 'tech house', 'minimal house'], country: 'Ireland' },
  { name: 'Kettama', genres: ['house', 'breakbeat'], country: 'Ireland' },

  // UK Underground
  { name: 'Josh Baker', genres: ['house', 'tech house', 'minimal house'], country: 'UK' },
  { name: 'Jaden Thompson', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Max Dean', genres: ['minimal house', 'tech house'], country: 'UK' },
  { name: 'Wheats', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Ben Sterling', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Robbie Doherty', genres: ['house', 'tech house'], country: 'Ireland' },
  { name: 'George Smeddles', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'ALISHA', genres: ['minimal house', 'tech house'], country: 'UK' },
  { name: 'Kellie Allen', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Ellia Jaya', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'Charlie Banks', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'RUZE', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Rossi.', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'SOSA', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Laidlaw', genres: ['minimal house', 'tech house'], country: 'UK' },
  { name: 'BLONDi', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Grace Arribas', genres: ['house', 'minimal house'], country: 'UK' },

  // European Underground
  { name: 'DJOKO', genres: ['house', 'minimal house', 'tech house'], country: 'Germany' },
  { name: 'Sidney Charles', genres: ['minimal house', 'tech house'], country: 'Germany' },
  { name: 'Janeret', genres: ['minimal house', 'deep house'], country: 'France' },
  { name: 'Dimmish', genres: ['minimal house', 'tech house'], country: 'Italy' },
  { name: 'Julian Fijma', genres: ['minimal house', 'deep house'], country: 'Netherlands' },
  { name: 'Hidde van Wee', genres: ['house', 'minimal house'], country: 'Netherlands' },
  { name: 'Jamback', genres: ['minimal house', 'deep house'], country: 'Romania' },
  { name: 'Cosmjn', genres: ['minimal house', 'deep house'], country: 'Romania' },
  { name: 'S.A.M.', genres: ['house', 'deep house'], country: 'France' },
  { name: 'Malin Genie', genres: ['house', 'electro'], country: 'Germany' },
  { name: 'Varhat', genres: ['house', 'minimal house'], country: 'France' },
  { name: 'Paolo Rocco', genres: ['house', 'deep house'], country: 'Italy' },
  { name: 'Burnski', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Locklead', genres: ['house', 'minimal house'], country: 'Netherlands' },
  { name: 'Anil Aras', genres: ['house', 'minimal house'], country: 'Turkey' },
  { name: 'Across Boundaries', genres: ['house', 'minimal house'], country: 'Netherlands' },
  { name: 'Lee Burton', genres: ['house', 'deep house'], country: 'UK' },
  { name: 'Jhobei', genres: ['house', 'minimal house'], country: 'Spain' },

  // Solid Grooves / Tech House Scene
  { name: 'PAWSA', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Michael Bibi', genres: ['tech house', 'house'], country: 'UK' },
  { name: 'Dennis Cruz', genres: ['tech house', 'house'], country: 'Spain' },
  { name: 'ANOTR', genres: ['house', 'tech house'], country: 'Netherlands' },
  { name: 'Bassel Darwish', genres: ['tech house'], country: 'Syria' },
  { name: 'Reelow', genres: ['tech house', 'house'], country: 'Spain' },
  { name: 'KinAhau', genres: ['tech house'], country: 'Spain' },
  { name: 'Blackchild', genres: ['tech house', 'afro house'], country: 'Italy' },
  { name: 'Theo Nasa', genres: ['minimal house', 'tech house'], country: 'UK' },
  { name: 'Fabe', genres: ['minimal house', 'house'], country: 'Germany' },

  // Fuse London / Berg Audio Scene
  { name: 'Enzo Siragusa', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Archie Hamilton', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Rossko', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'Seb Zito', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Rich NxT', genres: ['house', 'tech house'], country: 'UK' },

  // Dirtybird / US Scene Newer Artists
  { name: 'Prospa', genres: ['tech house', 'rave'], country: 'UK' },
  { name: 'Mau P', genres: ['tech house'], country: 'Netherlands' },
  { name: 'Biscits', genres: ['tech house'], country: 'UK' },
  { name: 'Disco Lines', genres: ['tech house', 'house'], country: 'USA' },
  { name: 'LP Giobbi', genres: ['house', 'piano house'], country: 'USA' },

  // Rising Stars 2024-2025
  { name: 'Cristina Lazic', genres: ['minimal house', 'tech house'], country: 'Serbia' },
  { name: 'DXNBY', genres: ['minimal house', 'deep house'], country: 'UK' },
  { name: 'Stef Davidse', genres: ['minimal house', 'deep house'], country: 'Netherlands' },
  { name: 'Joe Vanditti', genres: ['minimal house', 'tech house'], country: 'Italy' },
  { name: 'Eden Burns', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'Riley', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Tomike', genres: ['house', 'vocal house'], country: 'Nigeria' },
  { name: 'SHELLS', genres: ['house', 'uk garage'], country: 'UK' },
  { name: 'Jansons', genres: ['house', 'tech house'], country: 'UK' },
  { name: 'Lewis Taylor', genres: ['house', 'minimal house'], country: 'UK' },
  { name: 'Sophia Guerrero', genres: ['tech house'], country: 'USA' },
  { name: 'Fletcher Kerr', genres: ['tech house'], country: 'UK' },
  { name: 'Mitch Vice', genres: ['tech house'], country: 'UK' },
  { name: 'Sandy Groove', genres: ['tech house'], country: 'UK' },
];

// Artist aliases
const artistAliases: Record<string, string[]> = {
  'Chris Stussy': ['Stussy', 'Stussko'],
  'Obskür': ['Obskur'],
  'PAWSA': ['Pawsa'],
  'DJOKO': ['Djoko'],
  'ANOTR': ['Anotr'],
  'S.A.M.': ['SAM', 'Get Together'],
  'Rossi.': ['Rossi'],
  'SOSA': ['Sosa UK'],
  'ALISHA': ['Alisha'],
  'SHELLS': ['Shells'],
};

// ============================================
// UNDERGROUND TRACKS (2020-2025)
// ============================================
const undergroundTracks = [
  // Chris Stussy
  { title: 'All Night Long', artist: 'Chris Stussy', label: 'Up The Stuss', year: 2023 },
  { title: 'For The Music', artist: 'Chris Stussy', label: 'Up The Stuss', year: 2022 },
  { title: 'Why Dont You', artist: 'Chris Stussy', label: 'Up The Stuss', year: 2022 },
  { title: 'Desire', artist: 'Chris Stussy', label: 'PIV', year: 2021 },
  { title: 'Midtown Playground', artist: 'Chris Stussy', label: 'PIV', year: 2021 },
  { title: 'Together', artist: 'Chris Stussy', label: 'PIV', year: 2020 },
  { title: 'Slow Down', artist: 'Chris Stussy', label: 'PIV', year: 2021 },
  { title: 'Never Compromise', artist: 'Chris Stussy', label: 'PIV', year: 2020 },
  { title: 'Reflections', artist: 'Chris Stussy', label: 'Solid Grooves', year: 2022 },

  // Obskür
  { title: 'Rebel', artist: 'Obskür', label: 'Defected', year: 2023 },
  { title: 'Daydreaming', artist: 'Obskür', label: 'Disorder', year: 2023 },
  { title: 'Every Time', artist: 'Obskür', label: 'Disorder', year: 2023 },
  { title: 'Ive Arrived', artist: 'Obskür', label: 'Disorder', year: 2024 },
  { title: 'Falling Back', artist: 'Obskür', label: 'Eastenderz', year: 2024 },
  { title: 'Check One', artist: 'Obskür', label: 'Eastenderz', year: 2025 },
  { title: 'Basic Instinct', artist: 'Obskür', label: 'Solid Grooves Raw', year: 2025 },
  { title: 'Another Life', artist: 'Obskür', label: 'neXup', year: 2025 },
  { title: 'Bayside', artist: 'Obskür', label: 'Disorder', year: 2024 },

  // Josh Baker
  { title: 'Leave A Message', artist: 'Josh Baker', label: 'PIV', year: 2023 },
  { title: 'Dr Feel Right', artist: 'Josh Baker', label: 'You&Me', year: 2024 },
  { title: 'You Dont Own Me', artist: 'Josh Baker', label: 'Circoloco', year: 2024 },

  // Prunk
  { title: 'Night Time Stories', artist: 'Prunk', label: 'PIV', year: 2021 },
  { title: 'Quantum', artist: 'Prunk', label: 'PIV', year: 2022 },

  // Luuk van Dijk
  { title: 'First Contact', artist: 'Luuk van Dijk', label: 'Dark Side Of The Sun', year: 2022 },
  { title: 'Disco Tetris', artist: 'Luuk van Dijk', label: 'Dark Side Of The Sun', year: 2024 },
  { title: 'Take Me For A Ride', artist: 'Luuk van Dijk', label: 'Dark Side Of The Sun', year: 2024 },
  { title: 'Get My Luv', artist: 'Luuk van Dijk', label: 'No Art', year: 2024 },
  { title: 'Came To Party', artist: 'Luuk van Dijk', label: 'Dark Side Of The Sun', year: 2024 },
  { title: 'Inside My Mind', artist: 'Luuk van Dijk', label: 'Dark Side Of The Sun', year: 2024 },

  // Kolter
  { title: '15 Seconds of Fame', artist: 'Kolter', label: 'Berg Audio', year: 2024 },
  { title: 'Im Fine Thanks', artist: 'Kolter', label: 'Berg Audio', year: 2024 },
  { title: 'WOOP WOOP', artist: 'Kolter', label: 'HHS', year: 2024 },
  { title: 'Lets Pardey', artist: 'Kolter', label: 'HHS', year: 2024 },
  { title: 'Last One Standing', artist: 'Kolter', label: 'HHS', year: 2024 },

  // Sidney Charles
  { title: 'Im Free Now', artist: 'Sidney Charles', label: 'HHS', year: 2024 },
  { title: 'WOOP WOOP', artist: 'Sidney Charles', label: 'HHS', year: 2024 },

  // Janeret
  { title: 'Scape', artist: 'Janeret', label: 'Berg Audio', year: 2024 },
  { title: 'Special Request', artist: 'Janeret', label: 'Berg Audio', year: 2024 },
  { title: 'Appease', artist: 'Janeret', label: 'Berg Audio', year: 2024 },

  // East End Dubs
  { title: 'Searching', artist: 'East End Dubs', label: 'Solid Grooves', year: 2024 },
  { title: 'Sing', artist: 'East End Dubs', label: 'East End Dubs', year: 2024 },
  { title: 'Dancing With You', artist: 'East End Dubs', label: 'East End Dubs', year: 2024 },
  { title: 'Fever', artist: 'East End Dubs', label: 'East End Dubs', year: 2023 },
  { title: 'Bossy', artist: 'East End Dubs', label: 'East End Dubs', year: 2023 },
  { title: 'bRave', artist: 'East End Dubs', label: 'Fuse London', year: 2022 },
  { title: 'Holo', artist: 'East End Dubs', label: 'Up The Stuss', year: 2022 },
  { title: 'New Game', artist: 'East End Dubs', label: 'Eastenderz', year: 2023 },

  // Marsolo
  { title: 'Eye Of The Beholder', artist: 'Marsolo', label: 'Eastenderz', year: 2023 },
  { title: 'Dancefloor Delight', artist: 'Marsolo', label: 'Eastenderz', year: 2023 },

  // Max Dean
  { title: 'Cant Slow Down', artist: 'Max Dean', label: 'Eastenderz', year: 2023 },
  { title: 'In You', artist: 'Max Dean', label: 'Four Thirty Two', year: 2024 },

  // ALISHA
  { title: 'Visions', artist: 'ALISHA', label: 'Eastenderz', year: 2023 },

  // Julian Fijma
  { title: 'Bad City', artist: 'Julian Fijma', label: 'Eastenderz', year: 2024 },

  // Jaden Thompson
  { title: 'Downtown', artist: 'Jaden Thompson', label: 'Toolroom', year: 2024 },
  { title: 'Wolf', artist: 'Jaden Thompson', label: 'Dark Side Of The Sun', year: 2024, remix_type: 'Remix' },

  // DJOKO
  { title: 'In The Mood', artist: 'DJOKO', label: 'PIV', year: 2023 },
  { title: 'Late Night', artist: 'DJOKO', label: 'Up The Stuss', year: 2022 },

  // PAWSA
  { title: 'Pick Up The Phone', artist: 'PAWSA', label: 'PAWZ', year: 2024 },
  { title: 'Dirty Cash', artist: 'PAWSA', label: 'PAWZ', year: 2024, remix_type: 'Rework' },
  { title: 'Body', artist: 'PAWSA', label: 'Solid Grooves', year: 2023 },

  // Michael Bibi
  { title: 'One Life', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2024 },
  { title: 'Hanging Tree', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2023 },

  // Wheats
  { title: 'Searching', artist: 'Wheats', label: 'Solid Grooves', year: 2024 },
  { title: 'O La', artist: 'Wheats', label: 'Solid Grooves', year: 2021 },

  // Prospa
  { title: 'Prayer', artist: 'Prospa', label: 'Mother', year: 2024 },
  { title: 'Ecstasy', artist: 'Prospa', label: 'Mother', year: 2023 },
  { title: 'Want Need', artist: 'Prospa', label: 'Mother', year: 2022 },

  // Mau P (more tracks)
  { title: 'Gimme That Bounce', artist: 'Mau P', label: 'Hellcat', year: 2023 },
  { title: 'Metro', artist: 'Mau P', label: 'Hellcat', year: 2024 },
  { title: 'MERTHER', artist: 'Mau P', label: 'Defected', year: 2025 },

  // Biscits (more tracks)
  { title: 'Cant Hold Back', artist: 'Biscits', label: 'Toolroom', year: 2024 },
  { title: 'Do It Right', artist: 'Biscits', label: 'Toolroom', year: 2023 },

  // Up The Stuss Label Releases
  { title: 'Pheaton', artist: 'Malin Genie', label: 'Up The Stuss', year: 2024 },
  { title: 'Lost In Time', artist: 'Gaskin', label: 'Up The Stuss', year: 2024 },
  { title: 'Freedom', artist: 'Lee Burton', label: 'Up The Stuss', year: 2023 },
  { title: 'Sunrise', artist: 'Varhat', label: 'Up The Stuss', year: 2023 },
  { title: 'Night Drive', artist: 'Jhobei', label: 'Up The Stuss', year: 2023 },
  { title: 'Amsterdam', artist: 'Hidde van Wee', label: 'Up The Stuss', year: 2024 },
  { title: 'Dreams', artist: 'Locklead', label: 'Up The Stuss', year: 2024 },
  { title: 'Voyage', artist: 'Anil Aras', label: 'Up The Stuss', year: 2024 },
  { title: 'Horizons', artist: 'Across Boundaries', label: 'Up The Stuss', year: 2024 },

  // Fuse London
  { title: 'In The Club', artist: 'Enzo Siragusa', label: 'Fuse London', year: 2023 },
  { title: 'Get Down', artist: 'Archie Hamilton', label: 'Fuse London', year: 2023 },
  { title: 'Midnight', artist: 'Seb Zito', label: 'Fuse London', year: 2022 },
  { title: 'Feel It', artist: 'Rich NxT', label: 'Fuse London', year: 2023 },

  // Dennis Cruz / GOLFOS
  { title: 'La Mezcla', artist: 'Dennis Cruz', label: 'Solid Grooves', year: 2024 },
  { title: 'Fiesta', artist: 'Dennis Cruz', label: 'Solid Grooves', year: 2023 },

  // ANOTR
  { title: 'Vertigo', artist: 'ANOTR', label: 'No Art', year: 2024 },
  { title: 'Rave', artist: 'ANOTR', label: 'No Art', year: 2023 },

  // Kettama
  { title: 'Primark', artist: 'Kettama', label: 'Ninja Tune', year: 2023 },
  { title: 'Dublin Intro', artist: 'Kettama', label: 'Kettama', year: 2022 },

  // Robbie Doherty
  { title: 'Pour The Milk', artist: 'Robbie Doherty', label: 'Armada Subjekt', year: 2020 },
  { title: 'Groove', artist: 'Robbie Doherty', label: 'PIV', year: 2024 },

  // Rising Stars Tracks
  { title: 'Midnight Express', artist: 'Cristina Lazic', label: 'Eastenderz', year: 2024 },
  { title: 'Deep Inside', artist: 'DXNBY', label: 'Eastenderz', year: 2024 },
  { title: 'Feel The Beat', artist: 'Stef Davidse', label: 'Berg Audio', year: 2024 },
  { title: 'Rhythm', artist: 'Joe Vanditti', label: 'Eastenderz', year: 2024 },
  { title: 'Sunset', artist: 'Eden Burns', label: 'PIV', year: 2024 },
  { title: 'Move Your Body', artist: 'Riley', label: 'Disorder', year: 2025 },
  { title: 'Sunshine', artist: 'Tomike', label: 'Disorder', year: 2024 },
  { title: 'Rebel', artist: 'SHELLS', label: 'Defected', year: 2023 },
  { title: 'Underground', artist: 'Jansons', label: 'Toolroom', year: 2024 },
  { title: 'City Lights', artist: 'Lewis Taylor', label: 'Up The Stuss', year: 2024 },
];

// ============================================
// SETS WITH VENUES - Underground Scene
// ============================================
const undergroundSets = [
  // Chris Stussy Sets
  {
    title: 'Chris Stussy Boiler Room Edinburgh',
    dj_name: 'Chris Stussy',
    venue: 'Boiler Room Edinburgh',
    event_name: 'Boiler Room',
    event_date: '2024-05-19',
    genre: 'minimal house',
    youtube_url: 'https://www.youtube.com/watch?v=ChrisStussyBR',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2787514k/chris-stussy-boiler-room-edinburgh-2024-05-19.html',
  },
  {
    title: 'Chris Stussy Mixmag Lab London',
    dj_name: 'Chris Stussy',
    venue: 'Mixmag Lab London',
    event_name: 'Mixmag The Lab',
    event_date: '2023-03-31',
    genre: 'minimal house',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2r0kc9ut/chris-stussy-mixmag-the-lab-london-2023-03-31.html',
  },
  {
    title: 'Chris Stussy BBC Radio 1 Essential Mix',
    dj_name: 'Chris Stussy',
    venue: 'BBC Radio 1',
    event_name: 'Essential Mix',
    event_date: '2024-10-12',
    genre: 'minimal house',
  },
  {
    title: 'Chris Stussy Time Warp Sao Paulo',
    dj_name: 'Chris Stussy',
    venue: 'Time Warp Sao Paulo',
    event_name: 'Time Warp',
    event_date: '2024-05-03',
    genre: 'minimal house',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1x0w05h9/chris-stussy-time-warp-sao-paulo-2024-05-03.html',
  },
  {
    title: 'Chris Stussy Up The Stuss Sessions Roundhouse',
    dj_name: 'Chris Stussy',
    venue: 'The Roundhouse London',
    event_name: 'Up The Stuss Sessions',
    event_date: '2025-01-15',
    genre: 'minimal house',
  },
  {
    title: 'Chris Stussy DC10 Circoloco',
    dj_name: 'Chris Stussy',
    venue: 'DC-10 Ibiza',
    event_name: 'Circoloco',
    event_date: '2024-07-22',
    genre: 'minimal house',
  },
  {
    title: 'Chris Stussy Hi Ibiza',
    dj_name: 'Chris Stussy',
    venue: 'Hi Ibiza',
    event_name: 'Paradise',
    event_date: '2024-08-14',
    genre: 'minimal house',
  },

  // Josh Baker Sets
  {
    title: 'Josh Baker Boiler Room London',
    dj_name: 'Josh Baker',
    venue: 'Boiler Room London',
    event_name: 'Boiler Room',
    event_date: '2025-09-11',
    genre: 'house',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1mt63xqk/josh-baker-boiler-room-london-2025-09-11.html',
  },
  {
    title: 'Josh Baker NYC Pop Up Raw Cuts',
    dj_name: 'Josh Baker',
    venue: 'Raw Cuts NYC',
    event_name: 'Bakers Dozen',
    event_date: '2025-06-21',
    genre: 'house',
  },

  // Obskür Sets
  {
    title: 'Obskür BBC Radio 1 Essential Mix',
    dj_name: 'Obskür',
    venue: 'BBC Radio 1',
    event_name: 'Essential Mix',
    event_date: '2024-08-24',
    genre: 'house',
  },

  // PIV Label Sets
  {
    title: 'Prunk fabric London PIV Takeover',
    dj_name: 'Prunk',
    venue: 'fabric London',
    event_name: 'fabric x PIV',
    event_date: '2024-12-20',
    genre: 'house',
  },
  {
    title: 'Luuk van Dijk fabric London PIV',
    dj_name: 'Luuk van Dijk',
    venue: 'fabric London',
    event_name: 'fabric x PIV',
    event_date: '2024-12-20',
    genre: 'house',
  },
  {
    title: 'Luuk van Dijk Warehouse Project Manchester',
    dj_name: 'Luuk van Dijk',
    venue: 'Warehouse Project Manchester',
    event_name: 'WHP',
    event_date: '2024-09-28',
    genre: 'house',
  },
  {
    title: 'Marsolo fabric London PIV',
    dj_name: 'Marsolo',
    venue: 'fabric London',
    event_name: 'fabric x PIV',
    event_date: '2024-12-20',
    genre: 'minimal house',
  },
  {
    title: 'PIV Records 10 Years Motion Bristol',
    dj_name: 'Prunk',
    venue: 'Motion Bristol',
    event_name: '10 Years of PIV Records',
    event_date: '2025-02-28',
    genre: 'house',
  },
  {
    title: 'Gaskin fabric London PIV',
    dj_name: 'Gaskin',
    venue: 'fabric London',
    event_name: 'fabric x PIV',
    event_date: '2024-12-20',
    genre: 'minimal house',
  },
  {
    title: 'Jaden Thompson fabric London PIV',
    dj_name: 'Jaden Thompson',
    venue: 'fabric London',
    event_name: 'fabric x PIV',
    event_date: '2024-12-20',
    genre: 'house',
  },

  // Eastenderz Sets
  {
    title: 'East End Dubs Eastenderz ADE',
    dj_name: 'East End Dubs',
    venue: 'Transformatorhuis Amsterdam',
    event_name: 'Eastenderz ADE',
    event_date: '2024-10-17',
    genre: 'minimal house',
  },
  {
    title: 'East End Dubs Music On Festival',
    dj_name: 'East End Dubs',
    venue: 'Music On Festival Amsterdam',
    event_name: 'Music On Festival',
    event_date: '2024-05-11',
    genre: 'tech house',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/vhby2f9/east-end-dubs-music-on-festival-2024-05-11.html',
  },
  {
    title: 'East End Dubs Superior Ingredients NYC',
    dj_name: 'East End Dubs',
    venue: 'Superior Ingredients NYC',
    event_name: 'Gray Area',
    event_date: '2024-11-09',
    genre: 'minimal house',
  },
  {
    title: 'Kolter Eastenderz ADE',
    dj_name: 'Kolter',
    venue: 'Transformatorhuis Amsterdam',
    event_name: 'Eastenderz ADE',
    event_date: '2024-10-17',
    genre: 'minimal house',
  },
  {
    title: 'ALISHA Eastenderz ADE',
    dj_name: 'ALISHA',
    venue: 'Transformatorhuis Amsterdam',
    event_name: 'Eastenderz ADE',
    event_date: '2024-10-17',
    genre: 'minimal house',
  },

  // Solid Grooves Sets
  {
    title: 'PAWSA Solid Grooves DC10 Opening',
    dj_name: 'PAWSA',
    venue: 'DC-10 Ibiza',
    event_name: 'Solid Grooves Opening',
    event_date: '2024-06-06',
    genre: 'tech house',
  },
  {
    title: 'Michael Bibi Solid Grooves DC10',
    dj_name: 'Michael Bibi',
    venue: 'DC-10 Ibiza',
    event_name: 'Solid Grooves',
    event_date: '2024-06-06',
    genre: 'tech house',
  },
  {
    title: 'Dennis Cruz Solid Grooves DC10',
    dj_name: 'Dennis Cruz',
    venue: 'DC-10 Ibiza',
    event_name: 'Solid Grooves',
    event_date: '2024-06-06',
    genre: 'tech house',
  },
  {
    title: 'ANOTR Solid Grooves DC10',
    dj_name: 'ANOTR',
    venue: 'DC-10 Ibiza',
    event_name: 'Solid Grooves',
    event_date: '2024-06-06',
    genre: 'house',
  },
  {
    title: 'Ben Sterling Solid Grooves DC10',
    dj_name: 'Ben Sterling',
    venue: 'DC-10 Ibiza',
    event_name: 'Solid Grooves',
    event_date: '2024-07-25',
    genre: 'tech house',
  },
  {
    title: 'PAWSA Martinez Brothers Solid Grooves Venezia',
    dj_name: 'PAWSA',
    venue: 'Solid Grooves Venezia',
    event_name: 'Solid Grooves',
    event_date: '2024-08-03',
    genre: 'tech house',
  },
  {
    title: 'Michael Bibi One Life Finsbury Park',
    dj_name: 'Michael Bibi',
    venue: 'Finsbury Park London',
    event_name: 'One Life',
    event_date: '2024-07-06',
    genre: 'tech house',
  },
  {
    title: 'Michael Bibi One Life Ushuaia',
    dj_name: 'Michael Bibi',
    venue: 'Ushuaia Ibiza',
    event_name: 'One Life Tour',
    event_date: '2024-08-07',
    genre: 'tech house',
  },

  // Fuse London Sets
  {
    title: 'Enzo Siragusa Fuse London',
    dj_name: 'Enzo Siragusa',
    venue: 'Village Underground London',
    event_name: 'Fuse',
    event_date: '2024-04-13',
    genre: 'house',
  },
  {
    title: 'Archie Hamilton Fuse London',
    dj_name: 'Archie Hamilton',
    venue: 'Village Underground London',
    event_name: 'Fuse',
    event_date: '2024-04-13',
    genre: 'house',
  },
  {
    title: 'Seb Zito Fuse London',
    dj_name: 'Seb Zito',
    venue: 'Village Underground London',
    event_name: 'Fuse',
    event_date: '2024-04-13',
    genre: 'house',
  },

  // Sidney Charles / Heavy House Society
  {
    title: 'Sidney Charles Heavy House Society Barcelona',
    dj_name: 'Sidney Charles',
    venue: 'INPUT Barcelona',
    event_name: 'Heavy House Society',
    event_date: '2024-03-16',
    genre: 'minimal house',
  },
  {
    title: 'Kolter Heavy House Society Barcelona',
    dj_name: 'Kolter',
    venue: 'INPUT Barcelona',
    event_name: 'Heavy House Society',
    event_date: '2024-03-16',
    genre: 'minimal house',
  },
  {
    title: 'Fabe Heavy House Society Barcelona',
    dj_name: 'Fabe',
    venue: 'INPUT Barcelona',
    event_name: 'Heavy House Society',
    event_date: '2024-03-16',
    genre: 'minimal house',
  },

  // Janeret Sets
  {
    title: 'Janeret Sunwaves Festival',
    dj_name: 'Janeret',
    venue: 'Sunwaves Festival Mamaia',
    event_name: 'Sunwaves',
    event_date: '2024-05-01',
    genre: 'minimal house',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1pkux1q9/janeret-sunwaves-festival-2024-05-01.html',
  },

  // DJOKO Sets
  {
    title: 'DJOKO Rex Club Paris',
    dj_name: 'DJOKO',
    venue: 'Rex Club Paris',
    event_name: 'Rex Club',
    event_date: '2024-03-22',
    genre: 'house',
  },
  {
    title: 'DJOKO DC10 Ibiza',
    dj_name: 'DJOKO',
    venue: 'DC-10 Ibiza',
    event_name: 'Circoloco',
    event_date: '2024-08-05',
    genre: 'house',
  },
  {
    title: 'DJOKO Tomorrowland',
    dj_name: 'DJOKO',
    venue: 'Tomorrowland Belgium',
    event_name: 'Tomorrowland',
    event_date: '2024-07-21',
    genre: 'house',
  },

  // Music On Sets
  {
    title: 'PAWSA Music On Pacha',
    dj_name: 'PAWSA',
    venue: 'Pacha Ibiza',
    event_name: 'Music On',
    event_date: '2024-07-26',
    genre: 'tech house',
  },
  {
    title: 'Marco Carola PAWSA Music On',
    dj_name: 'PAWSA',
    venue: 'Pacha Ibiza',
    event_name: 'Music On',
    event_date: '2024-07-26',
    genre: 'tech house',
  },

  // Amsterdam Underground
  {
    title: 'Luuk van Dijk Shelter Amsterdam',
    dj_name: 'Luuk van Dijk',
    venue: 'Shelter Amsterdam',
    event_name: 'Dark Side Of The Sun',
    event_date: '2024-11-02',
    genre: 'house',
  },

  // Kettama Sets
  {
    title: 'Kettama Warehouse Project',
    dj_name: 'Kettama',
    venue: 'Warehouse Project Manchester',
    event_name: 'WHP',
    event_date: '2024-10-19',
    genre: 'house',
  },

  // Prospa Sets
  {
    title: 'Prospa Printworks London',
    dj_name: 'Prospa',
    venue: 'Printworks London',
    event_name: 'Prospa Live',
    event_date: '2024-03-09',
    genre: 'tech house',
  },
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
  console.log('🎤 Seeding underground house artists...\n');

  let created = 0;
  let skipped = 0;

  for (const artist of undergroundArtists) {
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
    const aliases = artistAliases[artist.name] || [];
    const allAliases = [artist.name, ...aliases];

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
  console.log('\n🎵 Seeding underground tracks...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const track of undergroundTracks) {
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
        remix_type: track.remix_type || null,
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
  console.log('\n🎧 Seeding underground sets with venues...\n');

  let created = 0;
  let skipped = 0;

  for (const set of undergroundSets) {
    const slug = generateSlug(set.title);

    const { data: existing } = await supabase
      .from('sets')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const djId = await getArtistId(set.dj_name);

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
        tracklist_url: set.tracklist_url || null,
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

    console.log('\n   Top Labels:');
    const sorted = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [label, count] of sorted) {
      console.log(`     ${label}: ${count} tracks`);
    }
  }

  // Show unique venues
  const { data: venues } = await supabase
    .from('sets')
    .select('venue')
    .not('venue', 'is', null);

  if (venues) {
    const uniqueVenues = [...new Set(venues.map(v => v.venue))].filter(Boolean);
    console.log(`\n   Unique Venues: ${uniqueVenues.length}`);
    console.log('\n   Featured Venues:');
    uniqueVenues.slice(0, 15).forEach(v => console.log(`     - ${v}`));
  }
}

async function main() {
  console.log('🔊 TRACK\'D Underground House Music Seeder\n');
  console.log('==========================================');
  console.log('Focus: PIV / Solid Grooves / Eastenderz / Up The Stuss scene\n');

  await seedArtists();
  await seedTracks();
  await seedSets();
  await showStats();

  console.log('\n==========================================');
  console.log('🎉 Database updated with underground house music!');
}

main().catch(console.error);
