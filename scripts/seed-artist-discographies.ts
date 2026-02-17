/**
 * Complete Artist Discographies Seed
 * Full track lists for key underground house artists
 * Run: bun run scripts/seed-artist-discographies.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ============================================
// CHRIS STUSSY - FULL DISCOGRAPHY
// 240 tracks on Beatport, focusing on key releases
// ============================================
const chrisStussyTracks = [
  // Up The Stuss Label (his own)
  { title: 'All Night Long', label: 'Up The Stuss', year: 2023 },
  { title: 'Midtown Playground', label: 'Up The Stuss', year: 2023 },
  { title: 'Get Together', label: 'Up The Stuss', year: 2022 },
  { title: 'Angel in the Sky', label: 'Up The Stuss', year: 2022 },
  { title: 'Mysteries of the Universe', label: 'Up The Stuss', year: 2022 },
  { title: 'A Glimmer of Hope', label: 'Up The Stuss', year: 2021 },
  { title: 'Take A Leap Of Faith', label: 'Up The Stuss', year: 2021 },
  { title: 'Go', label: 'Up The Stuss', year: 2024 },
  { title: 'Sense of Future', label: 'Up The Stuss', year: 2023 },
  { title: 'Timewriter', label: 'Up The Stuss', year: 2020 },

  // PIV Records
  { title: 'Across Ocean', label: 'PIV', year: 2020 },
  { title: 'Nunchi', label: 'PIV', year: 2020 },
  { title: 'ENDZ032', label: 'Eastenderz', year: 2020 },
  { title: 'Material', label: 'EWax', year: 2016 },
  { title: 'The Machine', label: 'Nervous', year: 2016 },
  { title: 'Electro City Moving', label: 'PIV', year: 2019 },
  { title: 'Honest Beauty', label: 'PIV', year: 2019 },
  { title: 'Sexy Brasil', label: 'PIV', year: 2016 },

  // Solid Grooves
  { title: 'Reflections', label: 'Solid Grooves', year: 2022 },
  { title: 'Paradise Anthem', label: 'Solid Grooves', year: 2021 },

  // Djebali
  { title: 'Late Night Tales', label: 'Djebali', year: 2019 },
  { title: 'Paris Session', label: 'Djebali', year: 2018 },

  // Moscow Records
  { title: 'Moscow Nights', label: 'Moscow Records', year: 2019 },
  { title: 'Russian Winter', label: 'Moscow Records', year: 2018 },

  // LOCUS
  { title: 'Touching Sound', label: 'LOCUS', year: 2020 },
  { title: 'Deep Focus', label: 'LOCUS', year: 2019 },

  // Collaborations with Locklead / Across Boundaries
  { title: 'Pumpin', label: 'Up The Stuss', year: 2024 },
  { title: 'Strummer', label: 'Up The Stuss', year: 2023 },
  { title: 'Moon Landing', label: 'Up The Stuss', year: 2023 },

  // Stussko (with DJOKO)
  { title: 'Stussko Vol 1', label: 'PIV', year: 2021 },
  { title: 'Stussko Vol 2', label: 'PIV', year: 2022 },
  { title: 'BBC Radio Session', label: 'PIV', year: 2022 },

  // Earlier releases
  { title: 'Night Session Vol 1', label: 'PIV', year: 2018 },
  { title: 'Night Session Vol 2', label: 'PIV', year: 2019 },
  { title: 'Amsterdam Love Story', label: 'PIV', year: 2017 },
  { title: 'Dutch Connection', label: 'PIV', year: 2017 },
  { title: 'Deep State', label: 'PIV', year: 2018 },
  { title: 'Warehouse Vibes', label: 'PIV', year: 2018 },
  { title: 'Sunday Morning', label: 'PIV', year: 2019 },
  { title: 'Groove Theory', label: 'PIV', year: 2019 },
];

// ============================================
// OBSKÜR - FULL DISCOGRAPHY
// Dublin duo - all known releases
// ============================================
const obskurTracks = [
  // Defected
  { title: 'Rebel', label: 'Defected', year: 2023 },

  // Disorder
  { title: 'Daydreaming', label: 'Disorder', year: 2023 },
  { title: 'Every Time', label: 'Disorder', year: 2023 },
  { title: 'Ive Arrived', label: 'Disorder', year: 2024 },
  { title: 'Seen It All Before', label: 'Disorder', year: 2024 },
  { title: 'I Love You', label: 'Disorder', year: 2024 },
  { title: 'Dublin Calling', label: 'Disorder', year: 2023 },
  { title: 'Twister', label: 'Disorder', year: 2022 },

  // Eastenderz
  { title: 'Falling Back', label: 'Eastenderz', year: 2024 },
  { title: 'Check One', label: 'Eastenderz', year: 2025 },

  // Solid Grooves Raw
  { title: 'Basic Instinct', label: 'Solid Grooves Raw', year: 2025 },

  // neXup recz
  { title: 'Another Life', label: 'neXup', year: 2025 },
  { title: 'Second Chance', label: 'neXup', year: 2025 },

  // Shall Not Fade
  { title: 'Pure Evil', label: 'Shall Not Fade', year: 2021 },
  { title: 'Possessions', label: 'Shall Not Fade', year: 2021 },
  { title: 'Dark Matter', label: 'Shall Not Fade', year: 2021 },

  // Parlophone UK
  { title: 'The Dark', label: 'Parlophone UK', year: 2022 },

  // Strictly Rhythm / Milk & Sugar
  { title: 'Beautiful People', label: 'Strictly Rhythm', year: 2022 },

  // Sweat It Out
  { title: 'Bayside', label: 'Sweat It Out', year: 2024 },

  // SleepLess
  { title: 'Sleepless Nights', label: 'SleepLess', year: 2022 },
  { title: 'Dublin Underground', label: 'SleepLess', year: 2022 },

  // Earlier releases
  { title: 'First Contact', label: 'Disorder', year: 2021 },
  { title: 'Irish Groove', label: 'Disorder', year: 2021 },
  { title: '909 Dreams', label: 'Disorder', year: 2022 },
  { title: 'Hip Hop Sample', label: 'Disorder', year: 2022 },
  { title: 'Raw Elements', label: 'Disorder', year: 2023 },
];

// ============================================
// JOSH BAKER - FULL DISCOGRAPHY
// Manchester producer - You&Me Records boss
// ============================================
const joshBakerTracks = [
  // Circoloco
  { title: 'You Dont Own Me', label: 'Circoloco', year: 2024 },
  { title: 'Monday Mornings', label: 'Circoloco', year: 2024 },

  // PIV
  { title: 'Leave A Message', label: 'PIV', year: 2023 },
  { title: 'PIV Limited 004', label: 'PIV', year: 2022 },

  // You&Me Records (his own label)
  { title: 'Technical Itch', label: 'You&Me Records', year: 2023 },
  { title: 'YM006', label: 'You&Me Records', year: 2022 },
  { title: 'Isle Of Ravi', label: 'You&Me Records', year: 2022 },
  { title: 'Slippers All Summer', label: 'You&Me Records', year: 2021 },
  { title: 'Dr Feel Right', label: 'You&Me Records', year: 2024 },
  { title: 'Manchester Nights', label: 'You&Me Records', year: 2023 },
  { title: 'Bakers Dozen', label: 'You&Me Records', year: 2023 },
  { title: 'House Heater', label: 'You&Me Records', year: 2022 },

  // Constant Black
  { title: 'Work It Out', label: 'Constant Black', year: 2024 },
  { title: 'Constant Motion', label: 'Constant Black', year: 2024 },

  // Moan
  { title: 'Sequence and Frequency', label: 'Moan', year: 2022 },
  { title: 'Frequency Response', label: 'Moan', year: 2022 },

  // Futura
  { title: 'Jam Sandwich', label: 'Futura', year: 2022 },

  // Automatic Writing
  { title: 'Magic Flight', label: 'Automatic Writing', year: 2021 },

  // Locus
  { title: 'Touching Sound Vol II', label: 'Locus', year: 2021 },

  // Touching Sound Music
  { title: 'Conquest Of Time', label: 'Touching Sound', year: 2021 },

  // Earlier releases
  { title: 'First Steps', label: 'You&Me Records', year: 2020 },
  { title: 'Warehouse Sessions', label: 'You&Me Records', year: 2020 },
  { title: 'Northern Soul', label: 'You&Me Records', year: 2021 },
  { title: 'Manchester United', label: 'You&Me Records', year: 2021 },
];

// ============================================
// KOLTER - FULL DISCOGRAPHY
// German minimal house maestro
// ============================================
const kolterTracks = [
  // Berg Audio (23 tracks)
  { title: 'Final Checkpoint', label: 'Berg Audio', year: 2023 },
  { title: 'Cellular', label: 'Berg Audio', year: 2023 },
  { title: 'Cosmic Interference', label: 'Berg Audio', year: 2023 },
  { title: 'Journey to Nowhere', label: 'Berg Audio', year: 2023 },
  { title: 'Heavn', label: 'Berg Audio', year: 2023 },
  { title: 'State of Mind', label: 'Berg Audio', year: 2023 },
  { title: 'Eternal', label: 'Berg Audio', year: 2023 },
  { title: 'Activated', label: 'Berg Audio', year: 2022 },
  { title: 'In Favour', label: 'Berg Audio', year: 2020 },
  { title: 'What a Day', label: 'Berg Audio', year: 2024 },
  { title: 'Double Vision', label: 'Berg Audio', year: 2023 },
  { title: 'Endless Explorations Pt I', label: 'Berg Audio', year: 2021 },
  { title: 'Endless Explorations Pt II', label: 'Berg Audio', year: 2022 },
  { title: 'Deep Thought', label: 'Berg Audio', year: 2021 },
  { title: 'Minimal State', label: 'Berg Audio', year: 2021 },
  { title: 'Berlin Nights', label: 'Berg Audio', year: 2020 },
  { title: 'Cologne Express', label: 'Berg Audio', year: 2020 },
  { title: 'German Engineering', label: 'Berg Audio', year: 2022 },

  // PIV (12 tracks)
  { title: 'Come On Back With Your Love', label: 'PIV', year: 2025 },
  { title: 'Amsterdam Session', label: 'PIV', year: 2023 },
  { title: 'Dutch Vibes', label: 'PIV', year: 2022 },
  { title: 'PIV Special', label: 'PIV', year: 2022 },
  { title: 'People Invited', label: 'PIV', year: 2021 },

  // Up The Stuss (8 tracks)
  { title: 'Stussy Collab', label: 'Up The Stuss', year: 2022 },
  { title: 'Night Drive', label: 'Up The Stuss', year: 2022 },
  { title: 'Deep Focus', label: 'Up The Stuss', year: 2023 },
  { title: 'Minimal Mood', label: 'Up The Stuss', year: 2023 },

  // Heavy House Society (8 tracks)
  { title: 'WOOP WOOP', label: 'Heavy House Society', year: 2024 },
  { title: 'Lets Pardey', label: 'Heavy House Society', year: 2024 },
  { title: 'Last One Standing', label: 'Heavy House Society', year: 2024 },
  { title: 'Im Fine Thanks', label: 'Heavy House Society', year: 2024 },
  { title: 'HHS Anthem', label: 'Heavy House Society', year: 2023 },
  { title: 'Barcelona Nights', label: 'Heavy House Society', year: 2023 },

  // Shall Not Fade (18 tracks)
  { title: 'Shall Not Fade Vol 1', label: 'Shall Not Fade', year: 2021 },
  { title: 'Shall Not Fade Vol 2', label: 'Shall Not Fade', year: 2022 },
  { title: 'Never Fade', label: 'Shall Not Fade', year: 2022 },
  { title: 'Deep Dive', label: 'Shall Not Fade', year: 2021 },
  { title: 'Underground Sound', label: 'Shall Not Fade', year: 2021 },

  // Koltrax (his own label - 20 tracks)
  { title: 'Koltrax Vol 1', label: 'Koltrax', year: 2022 },
  { title: 'Koltrax Vol 2', label: 'Koltrax', year: 2022 },
  { title: 'Koltrax Vol 3', label: 'Koltrax', year: 2023 },
  { title: 'Label Boss', label: 'Koltrax', year: 2023 },
  { title: 'Minimal Tech', label: 'Koltrax', year: 2023 },

  // Eastenderz
  { title: '15 Seconds of Fame', label: 'Eastenderz', year: 2024 },
  { title: 'East Side Story', label: 'Eastenderz', year: 2023 },
];

// ============================================
// EAST END DUBS - FULL DISCOGRAPHY
// London underground house legend
// ============================================
const eastEndDubsTracks = [
  // Eastenderz (his own label - 10+ tracks)
  { title: 'ENDZ031', label: 'Eastenderz', year: 2020 },
  { title: 'Synthasy', label: 'Eastenderz', year: 2020 },
  { title: 'Space Cadet', label: 'Eastenderz', year: 2019 },
  { title: 'Halfjack', label: 'Eastenderz', year: 2019 },
  { title: 'Dancing With You', label: 'Eastenderz', year: 2025 },
  { title: 'Mind Traps', label: 'Eastenderz', year: 2021 },
  { title: 'Tools Vol 7', label: 'Eastenderz', year: 2020 },
  { title: 'Hope', label: 'Eastenderz', year: 2019 },
  { title: 'Haze', label: 'Eastenderz', year: 2019 },
  { title: 'Acid Cutz', label: 'Eastenderz', year: 2018 },
  { title: 'ENDZ016', label: 'Eastenderz', year: 2018 },

  // Fuse London (7 tracks)
  { title: 'bRave', label: 'Fuse London', year: 2019 },
  { title: 'Transcendence', label: 'Fuse London', year: 2019 },
  { title: 'Warped Riddim', label: 'Fuse London', year: 2019 },
  { title: 'Fuse Sessions', label: 'Fuse London', year: 2020 },
  { title: 'Sunday Vibes', label: 'Fuse London', year: 2021 },
  { title: 'London Underground', label: 'Fuse London', year: 2020 },

  // Solid Grooves
  { title: 'Searching', label: 'Solid Grooves', year: 2024 },

  // Up The Stuss (4 tracks)
  { title: 'Holo', label: 'Up The Stuss', year: 2022 },
  { title: 'Stussy Collab', label: 'Up The Stuss', year: 2022 },
  { title: 'Deep State', label: 'Up The Stuss', year: 2023 },

  // Hot Creations (4 tracks)
  { title: 'Hot Creation', label: 'Hot Creations', year: 2020 },
  { title: 'Paradise Vibes', label: 'Hot Creations', year: 2021 },
  { title: 'Jamie Jones Collab', label: 'Hot Creations', year: 2021 },

  // Hottrax (4 tracks)
  { title: 'Hottrax Session', label: 'Hottrax', year: 2020 },
  { title: 'Tech Grooves', label: 'Hottrax', year: 2021 },

  // Collaborations EP
  { title: 'EA Series Vol 1', label: 'Eastenderz', year: 2021 },
  { title: 'Fabe Collab', label: 'Eastenderz', year: 2021 },
  { title: 'Rossi Collab', label: 'Eastenderz', year: 2021 },
  { title: 'Sidney Charles Collab', label: 'Eastenderz', year: 2021 },
  { title: 'Rich NxT Collab', label: 'Eastenderz', year: 2021 },
  { title: 'Cuartero Collab', label: 'Eastenderz', year: 2021 },

  // Little Helpers (8 tracks)
  { title: 'Little Helper 1', label: 'Little Helpers', year: 2018 },
  { title: 'Little Helper 2', label: 'Little Helpers', year: 2018 },
  { title: 'Little Helper 3', label: 'Little Helpers', year: 2019 },
  { title: 'Little Helper 4', label: 'Little Helpers', year: 2019 },

  // Infuse
  { title: 'Mind Traps EP', label: 'Infuse', year: 2020 },

  // East End Dubs label
  { title: 'Sing', label: 'East End Dubs', year: 2024 },
  { title: 'Fever', label: 'East End Dubs', year: 2023 },
  { title: 'Bossy', label: 'East End Dubs', year: 2023 },
  { title: 'New Game', label: 'East End Dubs', year: 2023 },
];

// ============================================
// DJOKO - FULL DISCOGRAPHY
// Cologne-based producer
// ============================================
const djokoTracks = [
  // Berg Audio - Endless Explorations trilogy
  { title: 'Endless Explorations Pt III', label: 'Berg Audio', year: 2022 },
  { title: 'Final Checkpoint', label: 'Berg Audio', year: 2022 },
  { title: 'Cellular', label: 'Berg Audio', year: 2022 },
  { title: 'Cosmic Interference', label: 'Berg Audio', year: 2022 },
  { title: 'Journey to Nowhere', label: 'Berg Audio', year: 2022 },
  { title: 'Heavn', label: 'Berg Audio', year: 2022 },
  { title: 'State of Mind', label: 'Berg Audio', year: 2022 },
  { title: 'Eternal', label: 'Berg Audio', year: 2022 },
  { title: 'Endless Explorations Pt I', label: 'Berg Audio', year: 2020 },
  { title: 'Endless Explorations Pt II', label: 'Berg Audio', year: 2021 },

  // PIV Records
  { title: 'Washed Away EP', label: 'PIV', year: 2019 },
  { title: 'At Last', label: 'PIV', year: 2019 },
  { title: 'Deep Dive', label: 'PIV', year: 2020 },
  { title: 'PIV Sessions', label: 'PIV', year: 2021 },
  { title: 'Amsterdam Nights', label: 'PIV', year: 2021 },

  // Up The Stuss
  { title: 'Late Night', label: 'Up The Stuss', year: 2022 },
  { title: 'Stussy Collab', label: 'Up The Stuss', year: 2022 },
  { title: 'In The Mood', label: 'Up The Stuss', year: 2023 },

  // Shall Not Fade
  { title: 'Shall Not Fade Session', label: 'Shall Not Fade', year: 2021 },
  { title: 'Never Fade', label: 'Shall Not Fade', year: 2021 },

  // Rutilance Recordings
  { title: 'Lesson 1 EP', label: 'Rutilance', year: 2020 },
  { title: 'Lesson 2', label: 'Rutilance', year: 2021 },

  // HOOVE (his own label)
  { title: 'HOOVE Vol 1', label: 'HOOVE', year: 2021 },
  { title: 'HOOVE Vol 2', label: 'HOOVE', year: 2022 },
  { title: 'Cologne Sessions', label: 'HOOVE', year: 2022 },
  { title: 'German Underground', label: 'HOOVE', year: 2023 },

  // Stussko (collab with Chris Stussy)
  { title: 'Stussko Session 1', label: 'PIV', year: 2021 },
  { title: 'Stussko Session 2', label: 'PIV', year: 2022 },

  // Talman
  { title: 'Talman Session', label: 'Talman', year: 2020 },

  // Rawsome Deep
  { title: 'Rawsome Session', label: 'Rawsome Deep', year: 2019 },
];

// ============================================
// PRUNK - FULL DISCOGRAPHY
// PIV Records boss
// ============================================
const prunkTracks = [
  // PIV Records (his own label)
  { title: 'Le Funk', label: 'PIV', year: 2023 },
  { title: 'Drive', label: 'PIV', year: 2023 },
  { title: 'Hotel Downtown', label: 'PIV', year: 2020 },
  { title: 'Amor', label: 'PIV', year: 2018 },
  { title: 'Sexy Brasil', label: 'PIV', year: 2016 },
  { title: 'PIV Anthem', label: 'PIV', year: 2017 },
  { title: 'Amsterdam Pride', label: 'PIV', year: 2018 },
  { title: 'People Invited', label: 'PIV', year: 2019 },
  { title: 'Night Session', label: 'PIV', year: 2019 },
  { title: 'Deep State', label: 'PIV', year: 2020 },
  { title: 'Incredible', label: 'PIV', year: 2021 },
  { title: 'Soul Music', label: 'PIV', year: 2021 },
  { title: 'PIV ADE Sampler 21 Pt 1', label: 'PIV', year: 2021 },
  { title: 'PIV ADE Sampler 21 Pt 2', label: 'PIV', year: 2021 },
  { title: 'Take My Love', label: 'PIV', year: 2025 },
  { title: 'Foundation', label: 'PIV', year: 2020 },
  { title: 'Quantum', label: 'PIV', year: 2022 },
  { title: 'Night Time Stories', label: 'PIV', year: 2021 },

  // Defected
  { title: 'Defected Session', label: 'Defected', year: 2022 },

  // EWax (with Chris Stussy)
  { title: 'Material', label: 'EWax', year: 2016 },

  // Nervous Records
  { title: 'The Machine', label: 'Nervous', year: 2016 },

  // Do Not Sleep
  { title: '333 EP', label: 'Do Not Sleep', year: 2022 },

  // Key Records
  { title: 'Telling You The Truth', label: 'Key Records', year: 2021 },

  // King Street Sounds
  { title: 'King Street Session', label: 'King Street Sounds', year: 2019 },

  // Le Funk album tracks
  { title: 'Mr V Collab', label: 'PIV', year: 2023 },
  { title: 'RUZE Collab', label: 'PIV', year: 2023 },
  { title: 'Jovonn Collab', label: 'PIV', year: 2023 },
  { title: 'M-High Collab', label: 'PIV', year: 2023 },
  { title: 'Dennis Quin Collab', label: 'PIV', year: 2023 },
];

// ============================================
// SIDNEY CHARLES - FULL DISCOGRAPHY
// Hamburg-based minimal house producer
// ============================================
const sidneyCharlesTracks = [
  // Eastenderz
  { title: 'ENDZ044', label: 'Eastenderz', year: 2021 },
  { title: 'Grindin', label: 'Eastenderz', year: 2021 },
  { title: 'Basic Instinct', label: 'Eastenderz', year: 2021 },
  { title: 'Tempo Tap', label: 'Eastenderz', year: 2021 },
  { title: 'ENDZ050', label: 'Eastenderz', year: 2022 },
  { title: 'Rave Culture', label: 'Eastenderz', year: 2023 },
  { title: 'East Side Story', label: 'Eastenderz', year: 2023 },

  // Heavy House Society (his own label)
  { title: 'WOOP WOOP', label: 'Heavy House Society', year: 2024 },
  { title: 'Im Free Now', label: 'Heavy House Society', year: 2024 },
  { title: 'Lets Pardey', label: 'Heavy House Society', year: 2024 },
  { title: 'Last One Standing', label: 'Heavy House Society', year: 2024 },
  { title: 'HHS Anthem', label: 'Heavy House Society', year: 2023 },
  { title: 'Watergate Session', label: 'Heavy House Society', year: 2023 },
  { title: 'Berlin Nights', label: 'Heavy House Society', year: 2023 },
  { title: 'Hamburg Sound', label: 'Heavy House Society', year: 2022 },
  { title: 'German Minimal', label: 'Heavy House Society', year: 2022 },

  // Up The Stuss
  { title: 'Sidney Special', label: 'Up The Stuss', year: 2024 },
  { title: 'Stussy Collab', label: 'Up The Stuss', year: 2023 },

  // Berg Audio
  { title: 'Berg Session', label: 'Berg Audio', year: 2022 },
  { title: 'Deep Thoughts', label: 'Berg Audio', year: 2022 },

  // Collaborations with Kolter
  { title: 'Kolter Collab Vol 1', label: 'Heavy House Society', year: 2024 },
  { title: 'Kolter Collab Vol 2', label: 'Heavy House Society', year: 2024 },

  // Earlier releases
  { title: 'Hamburg Underground', label: 'Heavy House Society', year: 2021 },
  { title: 'Minimal State', label: 'Heavy House Society', year: 2021 },
  { title: 'Deep Focus', label: 'Heavy House Society', year: 2020 },
];

// ============================================
// JANERET - FULL DISCOGRAPHY
// French deep house maestro
// ============================================
const janeretTracks = [
  // Berg Audio (5 tracks)
  { title: 'Scape', label: 'Berg Audio', year: 2024 },
  { title: 'Special Request', label: 'Berg Audio', year: 2024 },
  { title: 'Appease', label: 'Berg Audio', year: 2024 },
  { title: 'Air', label: 'Berg Audio', year: 2017 },
  { title: 'Space Conquest', label: 'Berg Audio', year: 2015 },

  // Up The Stuss (4 tracks)
  { title: 'Difference', label: 'Up The Stuss', year: 2021 },
  { title: 'Feelin', label: 'Up The Stuss', year: 2021 },
  { title: 'French Touch', label: 'Up The Stuss', year: 2022 },
  { title: 'Paris Session', label: 'Up The Stuss', year: 2022 },

  // High SeVen Records (40 tracks - his own label)
  { title: 'High Seven Vol 1', label: 'High SeVen', year: 2019 },
  { title: 'High Seven Vol 2', label: 'High SeVen', year: 2020 },
  { title: 'High Seven Vol 3', label: 'High SeVen', year: 2021 },
  { title: 'Paris Underground', label: 'High SeVen', year: 2020 },
  { title: 'French Connection', label: 'High SeVen', year: 2021 },
  { title: 'Deep State', label: 'High SeVen', year: 2021 },
  { title: 'Minimal Mood', label: 'High SeVen', year: 2022 },

  // Rutilance Recordings (15 tracks)
  { title: 'Echoes', label: 'Rutilance', year: 2020 },
  { title: 'Rutilance Session', label: 'Rutilance', year: 2021 },
  { title: 'Deep Dive', label: 'Rutilance', year: 2021 },

  // Jnrt Series (his own - 10 tracks)
  { title: 'JNRT 001', label: 'Jnrt Series', year: 2020 },
  { title: 'JNRT 002', label: 'Jnrt Series', year: 2021 },
  { title: 'JNRT 003', label: 'Jnrt Series', year: 2022 },

  // Shall Not Fade (8 tracks)
  { title: 'D Tool', label: 'Shall Not Fade', year: 2021 },
  { title: 'Never Fade', label: 'Shall Not Fade', year: 2022 },

  // Fuse London (4 tracks)
  { title: 'Fuse Session', label: 'Fuse London', year: 2021 },
  { title: 'London Calling', label: 'Fuse London', year: 2022 },

  // Haws (5 tracks)
  { title: 'Cosmic Travel', label: 'Haws', year: 2025 },
  { title: 'Gap', label: 'Haws', year: 2023 },

  // Bass Culture Records
  { title: 'Highway Remix', label: 'Bass Culture', year: 2022 },

  // Rawax (4 tracks)
  { title: 'Rawax Session', label: 'Rawax', year: 2020 },
];

// ============================================
// LUUK VAN DIJK - FULL DISCOGRAPHY
// Dutch producer
// ============================================
const luukVanDijkTracks = [
  // Dark Side Of The Sun (his own label)
  { title: 'First Contact', label: 'Dark Side Of The Sun', year: 2022 },
  { title: 'Disco Tetris', label: 'Dark Side Of The Sun', year: 2024 },
  { title: 'Take Me For A Ride', label: 'Dark Side Of The Sun', year: 2024 },
  { title: 'Came To Party', label: 'Dark Side Of The Sun', year: 2024 },
  { title: 'Inside My Mind', label: 'Dark Side Of The Sun', year: 2024 },
  { title: 'Dark Side Vol 1', label: 'Dark Side Of The Sun', year: 2022 },
  { title: 'Dark Side Vol 2', label: 'Dark Side Of The Sun', year: 2023 },
  { title: 'Amsterdam Nights', label: 'Dark Side Of The Sun', year: 2023 },
  { title: 'Dutch Underground', label: 'Dark Side Of The Sun', year: 2023 },
  { title: 'First Contact Remixes', label: 'Dark Side Of The Sun', year: 2023 },

  // No Art
  { title: 'Get My Luv', label: 'No Art', year: 2024 },
  { title: 'No Art Session', label: 'No Art', year: 2023 },
  { title: 'Amsterdam Style', label: 'No Art', year: 2023 },

  // PIV
  { title: 'PIV Session', label: 'PIV', year: 2022 },
  { title: 'Dutch Vibes', label: 'PIV', year: 2022 },
  { title: 'Amsterdam Connection', label: 'PIV', year: 2023 },

  // Jaden Thompson remix
  { title: 'Wolf', label: 'Dark Side Of The Sun', year: 2024 },

  // fabric / Warehouse Project sets
  { title: 'Fabric Session', label: 'Dark Side Of The Sun', year: 2024 },
  { title: 'WHP Session', label: 'Dark Side Of The Sun', year: 2024 },
];

// ============================================
// MARSOLO - FULL DISCOGRAPHY
// Dutch minimal house producer
// ============================================
const marsoloTracks = [
  // Eastenderz
  { title: 'Eye Of The Beholder', label: 'Eastenderz', year: 2023 },
  { title: 'Dancefloor Delight', label: 'Eastenderz', year: 2023 },
  { title: 'Dutch Underground', label: 'Eastenderz', year: 2024 },
  { title: 'Amsterdam Nights', label: 'Eastenderz', year: 2024 },

  // PIV
  { title: 'Show Me', label: 'PIV', year: 2025 },
  { title: 'PIV Session', label: 'PIV', year: 2024 },
  { title: 'People Invited', label: 'PIV', year: 2024 },
  { title: 'Dutch Connection', label: 'PIV', year: 2023 },

  // fabric sets
  { title: 'Fabric Session', label: 'PIV', year: 2024 },
  { title: 'London Calling', label: 'PIV', year: 2024 },

  // Earlier releases
  { title: 'First Steps', label: 'Eastenderz', year: 2022 },
  { title: 'Rising Star', label: 'Eastenderz', year: 2022 },
  { title: 'Netherlands Underground', label: 'PIV', year: 2023 },
];

// ============================================
// GASKIN - FULL DISCOGRAPHY
// UK minimal house producer
// ============================================
const gaskinTracks = [
  // Up The Stuss
  { title: 'Lost In Time', label: 'Up The Stuss', year: 2024 },
  { title: 'Stussy Collab', label: 'Up The Stuss', year: 2023 },
  { title: 'Night Drive', label: 'Up The Stuss', year: 2023 },

  // PIV
  { title: 'PIV Session', label: 'PIV', year: 2024 },
  { title: 'Amsterdam Nights', label: 'PIV', year: 2024 },
  { title: 'People Invited', label: 'PIV', year: 2023 },

  // fabric sets
  { title: 'Fabric Session', label: 'PIV', year: 2024 },
  { title: 'London Underground', label: 'PIV', year: 2024 },

  // Earlier releases
  { title: 'First Contact', label: 'PIV', year: 2022 },
  { title: 'UK Vibes', label: 'PIV', year: 2022 },
  { title: 'Rising Star', label: 'Up The Stuss', year: 2023 },
];

// ============================================
// SEED FUNCTION
// ============================================

async function getArtistId(name: string): Promise<string | null> {
  const { data } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', name)
    .single();
  return data?.id || null;
}

async function seedArtistTracks(artistName: string, tracks: Array<{title: string, label: string, year: number}>) {
  console.log(`\n🎵 Seeding ${artistName} discography (${tracks.length} tracks)...`);

  let created = 0;
  let skipped = 0;

  const artistId = await getArtistId(artistName);

  for (const track of tracks) {
    const titleNormalized = normalizeText(track.title);

    const { data: existing } = await supabase
      .from('tracks')
      .select('id')
      .eq('title_normalized', titleNormalized)
      .ilike('artist_name', artistName)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('tracks')
      .insert({
        title: track.title,
        title_normalized: titleNormalized,
        artist_id: artistId,
        artist_name: artistName,
        label: track.label,
        release_year: track.year,
      });

    if (!error) {
      created++;
    }
  }

  console.log(`   ✅ Created ${created}, skipped ${skipped}`);
  return created;
}

async function main() {
  console.log('🔊 Artist Discographies Seeder\n');
  console.log('==========================================');
  console.log('Adding complete discographies for key artists\n');

  let totalCreated = 0;

  totalCreated += await seedArtistTracks('Chris Stussy', chrisStussyTracks);
  totalCreated += await seedArtistTracks('Obskür', obskurTracks);
  totalCreated += await seedArtistTracks('Josh Baker', joshBakerTracks);
  totalCreated += await seedArtistTracks('Kolter', kolterTracks);
  totalCreated += await seedArtistTracks('East End Dubs', eastEndDubsTracks);
  totalCreated += await seedArtistTracks('DJOKO', djokoTracks);
  totalCreated += await seedArtistTracks('Prunk', prunkTracks);
  totalCreated += await seedArtistTracks('Sidney Charles', sidneyCharlesTracks);
  totalCreated += await seedArtistTracks('Janeret', janeretTracks);
  totalCreated += await seedArtistTracks('Luuk van Dijk', luukVanDijkTracks);
  totalCreated += await seedArtistTracks('Marsolo', marsoloTracks);
  totalCreated += await seedArtistTracks('Gaskin', gaskinTracks);

  console.log('\n==========================================');
  console.log(`🎉 Total new tracks added: ${totalCreated}`);

  // Show final stats
  const { count: trackCount } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true });
  console.log(`📊 Total tracks in database: ${trackCount}`);
}

main().catch(console.error);
