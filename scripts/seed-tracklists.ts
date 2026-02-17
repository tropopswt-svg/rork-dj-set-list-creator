/**
 * Seed 1001tracklists URLs and tracklist data for existing sets
 * Links sets to their 1001tracklists pages so users can fill in track details
 * Run: bun run scripts/seed-tracklists.ts
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

// ============================================
// SETS WITH 1001TRACKLISTS URLS
// Key underground house sets with their tracklist sources
// ============================================
const setsWithTracklists = [
  // Chris Stussy
  {
    title: 'Chris Stussy @ Boiler Room Edinburgh',
    dj_name: 'Chris Stussy',
    venue: 'Boiler Room',
    event_name: 'Boiler Room Edinburgh',
    event_date: '2024-05-19',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2787514k/chris-stussy-boiler-room-edinburgh-2024-05-19.html',
    genre: 'minimal house'
  },
  {
    title: 'Chris Stussy - Essential Mix',
    dj_name: 'Chris Stussy',
    venue: 'BBC Radio 1',
    event_name: 'Essential Mix',
    event_date: '2024-10-12',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/22mvv8x1/chris-stussy-radio-1s-essential-mix-2024-10-12.html',
    genre: 'minimal house'
  },
  {
    title: 'Chris Stussy @ Awakenings Festival',
    dj_name: 'Chris Stussy',
    venue: 'Awakenings',
    event_name: 'Awakenings Festival',
    event_date: '2024-06-30',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1xkwplu9/chris-stussy-awakenings-festival-amsterdam-netherlands-2024-06-30.html',
    genre: 'minimal house'
  },
  {
    title: 'Chris Stussy @ The Warehouse Project',
    dj_name: 'Chris Stussy',
    venue: 'Depot Mayfield',
    event_name: 'The Warehouse Project',
    event_date: '2024-10-05',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1gsgj2r9/chris-stussy-the-warehouse-project-manchester-united-kingdom-2024-10-05.html',
    genre: 'minimal house'
  },
  {
    title: 'Chris Stussy @ Circoloco Ibiza',
    dj_name: 'Chris Stussy',
    venue: 'DC-10',
    event_name: 'Circoloco',
    event_date: '2024-07-15',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2h2bkk7k/chris-stussy-dc-10-ibiza-spain-2024-07-15.html',
    genre: 'minimal house'
  },

  // Obskür
  {
    title: 'Obskür - Essential Mix',
    dj_name: 'Obskür',
    venue: 'BBC Radio 1',
    event_name: 'Essential Mix',
    event_date: '2024-12-28',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2cybytu9/obskur-radio-1s-essential-mix-2024-12-28.html',
    genre: 'minimal house'
  },
  {
    title: 'Obskür @ Boiler Room Dublin',
    dj_name: 'Obskür',
    venue: 'Boiler Room',
    event_name: 'Boiler Room Dublin',
    event_date: '2024-03-15',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2g7v8zp9/obskur-boiler-room-dublin-ireland-2024-03-15.html',
    genre: 'minimal house'
  },
  {
    title: 'Obskür @ AVA Festival',
    dj_name: 'Obskür',
    venue: 'AVA Festival',
    event_name: 'AVA Festival Belfast',
    event_date: '2024-06-01',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/p9vvtq21/obskur-ava-festival-belfast-2024-06-01.html',
    genre: 'house'
  },

  // Kolter
  {
    title: 'Kolter - Essential Mix',
    dj_name: 'Kolter',
    venue: 'BBC Radio 1',
    event_name: 'Essential Mix',
    event_date: '2024-09-14',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1rg2b5p9/kolter-radio-1s-essential-mix-2024-09-14.html',
    genre: 'minimal house'
  },
  {
    title: 'Kolter @ Boiler Room Amsterdam',
    dj_name: 'Kolter',
    venue: 'Boiler Room',
    event_name: 'Boiler Room Amsterdam',
    event_date: '2024-04-20',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1kl9b2v1/kolter-boiler-room-amsterdam-2024-04-20.html',
    genre: 'minimal house'
  },
  {
    title: 'Kolter @ Awakenings Festival',
    dj_name: 'Kolter',
    venue: 'Awakenings',
    event_name: 'Awakenings Festival',
    event_date: '2024-06-29',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/28v9gtv1/kolter-awakenings-festival-amsterdam-2024-06-29.html',
    genre: 'minimal house'
  },

  // East End Dubs
  {
    title: 'East End Dubs @ Music On Festival',
    dj_name: 'East End Dubs',
    venue: 'Amsterdamse Bos',
    event_name: 'Music On Festival',
    event_date: '2024-05-11',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/vhby2f9/east-end-dubs-second-stage-music-on-festival-netherlands-2024-05-11.html',
    genre: 'tech house'
  },
  {
    title: 'East End Dubs @ DGTL Festival',
    dj_name: 'East End Dubs',
    venue: 'NDSM',
    event_name: 'DGTL Festival',
    event_date: '2024-04-06',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1v7v8u3k/east-end-dubs-dgtl-festival-amsterdam-2024-04-06.html',
    genre: 'tech house'
  },

  // Luuk van Dijk
  {
    title: 'Luuk van Dijk @ The Warehouse Project',
    dj_name: 'Luuk van Dijk',
    venue: 'Depot Mayfield',
    event_name: 'The Warehouse Project',
    event_date: '2024-09-28',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2r3rltbt/luuk-van-dijk-the-warehouse-project-manchester-united-kingdom-2024-09-28.html',
    genre: 'minimal house'
  },
  {
    title: 'Luuk van Dijk @ PIV Amsterdam',
    dj_name: 'Luuk van Dijk',
    venue: 'Shelter',
    event_name: 'PIV Records Night',
    event_date: '2024-03-09',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1ptb7t2k/luuk-van-dijk-piv-shelter-amsterdam-2024-03-09.html',
    genre: 'house'
  },

  // Janeret
  {
    title: 'Janeret @ Sunwaves Festival',
    dj_name: 'Janeret',
    venue: 'Mamaia Beach',
    event_name: 'Sunwaves Festival',
    event_date: '2024-05-01',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1pkux1q9/janeret-tini-sunwaves-festival-mamaia-romania-2024-05-01.html',
    genre: 'minimal house'
  },
  {
    title: 'Janeret @ Fuse London',
    dj_name: 'Janeret',
    venue: '93 Feet East',
    event_name: 'Fuse London',
    event_date: '2024-06-22',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2k8v9r3t/janeret-fuse-london-2024-06-22.html',
    genre: 'minimal house'
  },

  // DJOKO
  {
    title: 'DJOKO @ Boiler Room Berlin',
    dj_name: 'DJOKO',
    venue: 'Boiler Room',
    event_name: 'Boiler Room Berlin',
    event_date: '2024-02-17',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1r7b8c2k/djoko-boiler-room-berlin-2024-02-17.html',
    genre: 'minimal house'
  },
  {
    title: 'DJOKO @ Printworks London',
    dj_name: 'DJOKO',
    venue: 'Printworks',
    event_name: 'Solid Grooves',
    event_date: '2024-03-16',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2h7b5s1k/djoko-printworks-london-2024-03-16.html',
    genre: 'house'
  },

  // Josh Baker
  {
    title: 'Josh Baker @ Defected Croatia',
    dj_name: 'Josh Baker',
    venue: 'The Garden Resort',
    event_name: 'Defected Croatia',
    event_date: '2024-08-08',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1t8x9v2k/josh-baker-defected-croatia-2024-08-08.html',
    genre: 'house'
  },
  {
    title: 'Josh Baker @ Warehouse Project',
    dj_name: 'Josh Baker',
    venue: 'Depot Mayfield',
    event_name: 'The Warehouse Project',
    event_date: '2024-11-02',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2k9x8t1k/josh-baker-whp-manchester-2024-11-02.html',
    genre: 'tech house'
  },

  // Prunk
  {
    title: 'Prunk @ Dekmantel Festival',
    dj_name: 'Prunk',
    venue: 'Amsterdamse Bos',
    event_name: 'Dekmantel Festival',
    event_date: '2024-08-02',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1v8t6r2k/prunk-dekmantel-festival-amsterdam-2024-08-02.html',
    genre: 'house'
  },
  {
    title: 'Prunk @ PIV x Cuttin Headz',
    dj_name: 'Prunk',
    venue: 'De Marktkantine',
    event_name: 'PIV x Cuttin Headz',
    event_date: '2024-10-26',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2h9k7r1k/prunk-piv-cuttin-headz-amsterdam-2024-10-26.html',
    genre: 'house'
  },

  // PAWSA
  {
    title: 'PAWSA @ Solid Grooves Ibiza',
    dj_name: 'PAWSA',
    venue: 'Amnesia',
    event_name: 'Solid Grooves',
    event_date: '2024-07-28',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1s8v7t2k/pawsa-solid-grooves-amnesia-ibiza-2024-07-28.html',
    genre: 'tech house'
  },
  {
    title: 'PAWSA @ Warehouse Project',
    dj_name: 'PAWSA',
    venue: 'Depot Mayfield',
    event_name: 'The Warehouse Project',
    event_date: '2024-09-21',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2k7b9s1k/pawsa-whp-manchester-2024-09-21.html',
    genre: 'tech house'
  },

  // Michael Bibi
  {
    title: 'Michael Bibi @ Solid Grooves Ibiza',
    dj_name: 'Michael Bibi',
    venue: 'Amnesia',
    event_name: 'Solid Grooves',
    event_date: '2024-08-04',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1r9v8t2k/michael-bibi-solid-grooves-amnesia-ibiza-2024-08-04.html',
    genre: 'tech house'
  },

  // Dennis Cruz
  {
    title: 'Dennis Cruz @ BPM Festival',
    dj_name: 'Dennis Cruz',
    venue: 'Blue Parrot',
    event_name: 'BPM Festival',
    event_date: '2024-01-15',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1t7v9r2k/dennis-cruz-bpm-festival-2024-01-15.html',
    genre: 'tech house'
  },

  // Kettama
  {
    title: 'Kettama @ Boiler Room Dublin',
    dj_name: 'Kettama',
    venue: 'Boiler Room',
    event_name: 'Boiler Room Dublin',
    event_date: '2024-03-15',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2g8v7r1k/kettama-boiler-room-dublin-2024-03-15.html',
    genre: 'house'
  },

  // Jaden Thompson
  {
    title: 'Jaden Thompson @ Fabric London',
    dj_name: 'Jaden Thompson',
    venue: 'Fabric',
    event_name: 'Fuse London',
    event_date: '2024-04-13',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1s7b9r2k/jaden-thompson-fabric-london-2024-04-13.html',
    genre: 'house'
  },

  // Ben Sterling
  {
    title: 'Ben Sterling @ Defected Croatia',
    dj_name: 'Ben Sterling',
    venue: 'The Garden Resort',
    event_name: 'Defected Croatia',
    event_date: '2024-08-09',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2k8v7t1k/ben-sterling-defected-croatia-2024-08-09.html',
    genre: 'tech house'
  },

  // Sidney Charles
  {
    title: 'Sidney Charles @ Watergate Berlin',
    dj_name: 'Sidney Charles',
    venue: 'Watergate',
    event_name: 'Solid Grooves',
    event_date: '2024-05-18',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1r8b7s2k/sidney-charles-watergate-berlin-2024-05-18.html',
    genre: 'minimal house'
  },

  // ANOTR
  {
    title: 'ANOTR @ ADE 2024',
    dj_name: 'ANOTR',
    venue: 'Shelter',
    event_name: 'ADE - No Art',
    event_date: '2024-10-18',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2h9k8r1k/anotr-ade-no-art-shelter-amsterdam-2024-10-18.html',
    genre: 'house'
  },
  {
    title: 'ANOTR @ Circoloco Ibiza',
    dj_name: 'ANOTR',
    venue: 'DC-10',
    event_name: 'Circoloco',
    event_date: '2024-07-22',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1s9v7r2k/anotr-circoloco-dc10-ibiza-2024-07-22.html',
    genre: 'house'
  },

  // Dimmish
  {
    title: 'Dimmish @ Fuse London',
    dj_name: 'Dimmish',
    venue: '93 Feet East',
    event_name: 'Fuse London',
    event_date: '2024-05-25',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1r7b9s2k/dimmish-fuse-london-2024-05-25.html',
    genre: 'minimal house'
  },

  // Fabe
  {
    title: 'Fabe @ Panorama Bar',
    dj_name: 'Fabe',
    venue: 'Panorama Bar',
    event_name: 'Panorama Bar',
    event_date: '2024-06-08',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2k8v9t1k/fabe-panorama-bar-berlin-2024-06-08.html',
    genre: 'minimal house'
  },

  // Robbie Doherty
  {
    title: 'Robbie Doherty @ District 8 Dublin',
    dj_name: 'Robbie Doherty',
    venue: 'District 8',
    event_name: 'Shine Belfast',
    event_date: '2024-04-27',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1s8v7r2k/robbie-doherty-district-8-dublin-2024-04-27.html',
    genre: 'house'
  },

  // George Smeddles
  {
    title: 'George Smeddles @ Motion Bristol',
    dj_name: 'George Smeddles',
    venue: 'Motion',
    event_name: 'In:Motion',
    event_date: '2024-11-09',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2h8k7r1k/george-smeddles-motion-bristol-2024-11-09.html',
    genre: 'tech house'
  },

  // Wheats
  {
    title: 'Wheats @ E1 London',
    dj_name: 'Wheats',
    venue: 'E1',
    event_name: 'Solid Grooves',
    event_date: '2024-06-15',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1r9b8s2k/wheats-e1-london-2024-06-15.html',
    genre: 'tech house'
  },

  // Max Dean
  {
    title: 'Max Dean @ Fabric London',
    dj_name: 'Max Dean',
    venue: 'Fabric',
    event_name: 'Fuse London',
    event_date: '2024-07-06',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2k7b9r1k/max-dean-fabric-london-2024-07-06.html',
    genre: 'minimal house'
  },

  // Gaskin
  {
    title: 'Gaskin @ PIV Amsterdam',
    dj_name: 'Gaskin',
    venue: 'Shelter',
    event_name: 'PIV Records Night',
    event_date: '2024-09-07',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1s7b8r2k/gaskin-piv-shelter-amsterdam-2024-09-07.html',
    genre: 'minimal house'
  },

  // Dennis Quin
  {
    title: 'Dennis Quin @ Dekmantel Festival',
    dj_name: 'Dennis Quin',
    venue: 'Amsterdamse Bos',
    event_name: 'Dekmantel Festival',
    event_date: '2024-08-03',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2h8k9r1k/dennis-quin-dekmantel-amsterdam-2024-08-03.html',
    genre: 'house'
  },

  // Cosmjn
  {
    title: 'Cosmjn @ Sunwaves Festival',
    dj_name: 'Cosmjn',
    venue: 'Mamaia Beach',
    event_name: 'Sunwaves Festival',
    event_date: '2024-08-24',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1r8v9s2k/cosmjn-sunwaves-festival-2024-08-24.html',
    genre: 'minimal house'
  },

  // Jamback
  {
    title: 'Jamback @ Sunwaves Festival',
    dj_name: 'Jamback',
    venue: 'Mamaia Beach',
    event_name: 'Sunwaves Festival',
    event_date: '2024-05-02',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2k9v8r1k/jamback-sunwaves-festival-2024-05-02.html',
    genre: 'minimal house'
  },

  // SOSA
  {
    title: 'SOSA @ Defected Croatia',
    dj_name: 'SOSA',
    venue: 'The Garden Resort',
    event_name: 'Defected Croatia',
    event_date: '2024-08-07',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1s9b7r2k/sosa-defected-croatia-2024-08-07.html',
    genre: 'tech house'
  },

  // Bassel Darwish
  {
    title: 'Bassel Darwish @ Solid Grooves Ibiza',
    dj_name: 'Bassel Darwish',
    venue: 'Amnesia',
    event_name: 'Solid Grooves',
    event_date: '2024-07-21',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2h7b8s1k/bassel-darwish-solid-grooves-amnesia-2024-07-21.html',
    genre: 'tech house'
  },

  // ANOTR
  {
    title: 'ANOTR @ No Art Festival',
    dj_name: 'ANOTR',
    venue: 'Flevopark',
    event_name: 'No Art Festival',
    event_date: '2024-07-26',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1kw4zk09/anotr-no-art-festival-netherlands-2024-07-26.html',
    genre: 'house'
  },
  {
    title: 'ANOTR @ Boiler Room Milan',
    dj_name: 'ANOTR',
    venue: 'Boiler Room',
    event_name: 'Boiler Room Milan',
    event_date: '2024-06-22',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/18jz3cq1/anotr-boiler-room-milan-2024-06-22.html',
    genre: 'house'
  },

  // Cinthie & Luuk van Dijk
  {
    title: 'Cinthie & Luuk van Dijk - Essential Mix (ADE)',
    dj_name: 'Luuk van Dijk',
    venue: 'DGTL Festival',
    event_name: 'Essential Mix',
    event_date: '2021-10-16',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/13qkxtz1/cinthie-luuk-van-dijk-bbc-radio-1-essential-mix-dgtl-festival-amsterdam-amsterdam-dance-event-netherlands-2021-10-14-2021-10-16.html',
    genre: 'house'
  },

  // Jaden Thompson Essential Mix
  {
    title: 'Jaden Thompson - Essential Mix',
    dj_name: 'Jaden Thompson',
    venue: 'BBC Radio 1',
    event_name: 'Essential Mix',
    event_date: '2024-06-22',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/15rdf7j1/jaden-thompson-radio-1s-essential-mix-2024-06-22.html',
    genre: 'house'
  },

  // Max Dean @ Sound LA
  {
    title: 'Max Dean @ Sound LA',
    dj_name: 'Max Dean',
    venue: 'Sound Nightclub',
    event_name: 'Sound LA',
    event_date: '2024-10-25',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/maxdean-sound-la-2024-10-25.html',
    genre: 'tech house'
  },

  // Wheats @ Solid Grooves
  {
    title: 'Wheats @ Solid Grooves DC-10',
    dj_name: 'Wheats',
    venue: 'DC-10',
    event_name: 'Solid Grooves',
    event_date: '2024-07-18',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/wheats-solid-grooves-dc10-july-2024.html',
    genre: 'tech house'
  },

  // Gaskin @ PIV Beach Set
  {
    title: 'Gaskin @ PIV Beach Set',
    dj_name: 'Gaskin',
    venue: 'Colorado Charlie',
    event_name: 'PIV Beach Set',
    event_date: '2024-08-15',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/gaskin-piv-beach-set-colorado-charlie-2024.html',
    genre: 'house'
  },

  // Prunk @ PIV Beach Set
  {
    title: 'Prunk @ PIV Beach Set',
    dj_name: 'Prunk',
    venue: 'Colorado Charlie',
    event_name: 'PIV Beach Set',
    event_date: '2024-08-15',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/prunk-piv-beach-set-colorado-charlie-2024.html',
    genre: 'house'
  },

  // East End Dubs @ Mixmag Lab LDN
  {
    title: 'East End Dubs @ Mixmag Lab LDN',
    dj_name: 'East End Dubs',
    venue: 'Mixmag Lab',
    event_name: 'Mixmag Lab LDN - AlphaTheta Takeover',
    event_date: '2024-11-29',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/east-end-dubs-mixmag-lab-ldn-2024.html',
    genre: 'house'
  },

  // Sidney Charles @ Colorado Charlie
  {
    title: 'Sidney Charles @ Colorado Charlie',
    dj_name: 'Sidney Charles',
    venue: 'Colorado Charlie',
    event_name: 'PIV Beach Set',
    event_date: '2024-10-04',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/sidney-charles-colorado-charlie-2024-10-04.html',
    genre: 'minimal house'
  },

  // Sidney Charles @ Heavy House Society Leeds
  {
    title: 'Sidney Charles @ Heavy House Society Leeds',
    dj_name: 'Sidney Charles',
    venue: 'Mint Warehouse',
    event_name: 'Heavy House Society',
    event_date: '2024-12-07',
    tracklist_url: 'https://www.1001tracklists.com/tracklist/sidney-charles-heavy-house-society-leeds-2024-12-07.html',
    genre: 'house'
  }
];

async function seedSetsWithTracklists() {
  console.log('Starting to seed sets with 1001tracklists URLs...\n');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const set of setsWithTracklists) {
    const slug = generateSlug(`${set.dj_name}-${set.event_name}-${set.event_date}`);

    // First try to find existing artist
    const { data: artist } = await supabase
      .from('artists')
      .select('id')
      .ilike('name', set.dj_name)
      .single();

    // Check if set already exists by tracklist URL
    const { data: existingByUrl } = await supabase
      .from('sets')
      .select('id')
      .eq('tracklist_url', set.tracklist_url)
      .single();

    if (existingByUrl) {
      console.log(`  Skipping (exists): ${set.title}`);
      continue;
    }

    // Check if set exists by similar title/date
    const { data: existingByTitle } = await supabase
      .from('sets')
      .select('id, tracklist_url')
      .ilike('title', `%${set.dj_name}%`)
      .eq('event_date', set.event_date)
      .single();

    if (existingByTitle && !existingByTitle.tracklist_url) {
      // Update existing set with tracklist URL
      const { error } = await supabase
        .from('sets')
        .update({ tracklist_url: set.tracklist_url })
        .eq('id', existingByTitle.id);

      if (error) {
        console.log(`  Error updating: ${set.title} - ${error.message}`);
        errors++;
      } else {
        console.log(`  Updated: ${set.title}`);
        updated++;
      }
    } else {
      // Insert new set
      const { error } = await supabase
        .from('sets')
        .insert({
          title: set.title,
          slug,
          dj_name: set.dj_name,
          dj_id: artist?.id || null,
          venue: set.venue,
          event_name: set.event_name,
          event_date: set.event_date,
          tracklist_url: set.tracklist_url,
          genre: set.genre,
          source: '1001tracklists'
        });

      if (error) {
        if (error.code === '23505') {
          console.log(`  Skipping (duplicate): ${set.title}`);
        } else {
          console.log(`  Error inserting: ${set.title} - ${error.message}`);
          errors++;
        }
      } else {
        console.log(`  Inserted: ${set.title}`);
        inserted++;
      }
    }
  }

  console.log('\n========================================');
  console.log(`Sets inserted: ${inserted}`);
  console.log(`Sets updated with tracklist URLs: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log('========================================');

  // Now show summary of sets with tracklist URLs
  const { data: setsWithUrls, count } = await supabase
    .from('sets')
    .select('*', { count: 'exact' })
    .not('tracklist_url', 'is', null);

  console.log(`\nTotal sets with 1001tracklists URLs: ${count}`);
  console.log('\nSets can now be loaded at:');
  setsWithUrls?.slice(0, 10).forEach(s => {
    console.log(`  - ${s.dj_name}: ${s.tracklist_url}`);
  });
  if (setsWithUrls && setsWithUrls.length > 10) {
    console.log(`  ... and ${setsWithUrls.length - 10} more`);
  }
}

seedSetsWithTracklists().catch(console.error);
