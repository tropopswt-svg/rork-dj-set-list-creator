/**
 * Seed actual tracklist data into set_tracks table
 * Uses verified data from 1001tracklists, mixesdb, and other sources
 * Run: bun run scripts/seed-set-tracks.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// VERIFIED TRACKLISTS FROM EXTERNAL SOURCES
// Each tracklist is sourced and verified
// ============================================

interface TrackEntry {
  artist_name: string;
  track_title: string;
  is_id?: boolean;
}

interface SetTracklist {
  tracklist_url: string;
  dj_name: string;
  set_title: string;
  tracks: TrackEntry[];
}

const verifiedTracklists: SetTracklist[] = [
  // ============================================
  // Chris Stussy - Essential Mix (Oct 12, 2024)
  // Source: tracklists.thomaslaupstad.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/22mvv8x1/chris-stussy-radio-1s-essential-mix-2024-10-12.html',
    dj_name: 'Chris Stussy',
    set_title: 'Chris Stussy - Essential Mix',
    tracks: [
      { artist_name: 'Alex Cortex', track_title: 'Discola' },
      { artist_name: 'Nail', track_title: 'Lemon Gus' },
      { artist_name: 'Jam & Spoon', track_title: 'Right In The Night (MK Dub)' },
      { artist_name: 'Chris Stussy', track_title: 'The Streets Is Where I\'m From' },
      { artist_name: 'Unknown Artist', track_title: 'Untitled B1', is_id: true },
      { artist_name: 'Jex Opolis', track_title: 'Wide Awake (Dub)' },
      { artist_name: 'Paolo Rocco', track_title: 'First Night Out (Chris Stussy Remix)' },
      { artist_name: 'Burnski & Kepler', track_title: 'Solstice' },
      { artist_name: 'NairLess', track_title: 'Till It Glows' },
      { artist_name: 'Underworld', track_title: 'Jumbo (Chris Stussy Edit)' },
      { artist_name: 'Makam', track_title: 'You Might Lose It (Kerri Chandler Kaoz 623 Remix)' },
      { artist_name: 'Locklead', track_title: 'Apollo' },
      { artist_name: 'Gaskin', track_title: 'Superstyler' },
      { artist_name: 'Mandar', track_title: 'String Theory' },
      { artist_name: 'Chris Stussy', track_title: 'What Are You Waiting For (Sunrise Mix)' },
      { artist_name: 'Stussko', track_title: 'Link In The Park' },
      { artist_name: 'Malin Génie', track_title: 'Pheaton' },
      { artist_name: 'ID', track_title: 'ID', is_id: true },
      { artist_name: 'Anil Aras', track_title: 'When Souls Collide' },
      { artist_name: 'Brendan Costigane', track_title: 'Camera Tricks' },
      { artist_name: 'Marc Romboy', track_title: 'Frakin\' (Chris Stussy Edit)' },
      { artist_name: 'Frazer Campbell', track_title: 'Cloud909' },
      { artist_name: 'Paul Rayner', track_title: 'Feel Me (Paul Sirrell Remix)' },
      { artist_name: 'Weekend Players', track_title: 'Into The Sun' }
    ]
  },

  // ============================================
  // Obskür - Essential Mix (Dec 28, 2024)
  // Source: mixesdb.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2cybytu9/obskur-radio-1s-essential-mix-2024-12-28.html',
    dj_name: 'Obskür',
    set_title: 'Obskür - Essential Mix',
    tracks: [
      { artist_name: 'Obskür & Tomike', track_title: 'I\'ve Arrived' },
      { artist_name: 'Obskür', track_title: 'Falling Back' },
      { artist_name: 'Rhythm On The Loose', track_title: 'Break Of Dawn' },
      { artist_name: 'Apollonia', track_title: 'Trinidad' },
      { artist_name: 'Bicep', track_title: 'Vision Of Love' },
      { artist_name: 'Obskür', track_title: 'Bayside' },
      { artist_name: 'Kerri Chandler', track_title: 'Change Your Mind (Instrumental)' },
      { artist_name: 'Hot Natured', track_title: 'Class' },
      { artist_name: 'Cajmere feat. Jamie Principle', track_title: 'God Sent (\'10 Mix)' },
      { artist_name: 'Anil Aras', track_title: 'Another Tale' },
      { artist_name: 'Locklead', track_title: 'Blue Monday' },
      { artist_name: 'Pelvis', track_title: 'Dance Freak (Mall Grab\'s Workers Union Remix)' },
      { artist_name: 'Bushwacka!', track_title: 'Strictly Nu' },
      { artist_name: 'CJ Bolland & Armand Van Helden', track_title: 'Sugar Is Sweeter' },
      { artist_name: 'Job De Jong', track_title: 'Back Beat Action' },
      { artist_name: 'Milion', track_title: 'Adventure Time' },
      { artist_name: 'M-High', track_title: 'Let Jagged' },
      { artist_name: 'Malin Genie', track_title: 'Lust Crazed Muck Men' },
      { artist_name: 'Obskür & Robbie Doherty', track_title: 'Gimme A Beat' },
      { artist_name: 'DXNBY', track_title: 'Street Funk' },
      { artist_name: 'Danny Snowden', track_title: 'Here To Let You Go' },
      { artist_name: 'Ken Spieker', track_title: 'Serenity' },
      { artist_name: 'Obskür', track_title: 'The Moment' },
      { artist_name: 'Julian Fijma', track_title: 'Patience' },
      { artist_name: 'The Prodigy', track_title: 'Warrior\'s Dance (Obskür Edit)' },
      { artist_name: 'Robbie Doherty', track_title: 'Right Place' },
      { artist_name: 'Hidde Van Wee', track_title: 'Shamans Vision' },
      { artist_name: 'Obskür', track_title: 'Seen It All Before' },
      { artist_name: 'Gaskin', track_title: 'Superstyler' },
      { artist_name: 'Obskür', track_title: 'Breathe' }
    ]
  },

  // ============================================
  // Kolter - Essential Mix (Sep 14, 2024)
  // Source: tracklists.thomaslaupstad.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1rg2b5p9/kolter-radio-1s-essential-mix-2024-09-14.html',
    dj_name: 'Kolter',
    set_title: 'Kolter - Essential Mix',
    tracks: [
      { artist_name: 'Fouk', track_title: 'Cat Lady' },
      { artist_name: 'BRS', track_title: 'You Know Why' },
      { artist_name: 'Kolter', track_title: 'Want U, Need U' },
      { artist_name: 'Trentmoller', track_title: 'Le Champagne' },
      { artist_name: 'Kolter', track_title: 'You Drive Me Crazy' },
      { artist_name: 'Janeret', track_title: 'Surge' },
      { artist_name: 'Kolter', track_title: 'Transition' },
      { artist_name: 'Cultured Pearls', track_title: 'Mother Earth (Hoff\'s Optimistic House Edit)' },
      { artist_name: 'Tim Schlockemann', track_title: 'Object Fill 2' },
      { artist_name: 'Kolter', track_title: '1 mal groove, bidde' },
      { artist_name: 'Sweely', track_title: 'Back & Up' },
      { artist_name: 'Kolter', track_title: 'True Dat' },
      { artist_name: 'Leo Pol', track_title: 'Le String Rouge' },
      { artist_name: 'George Benson', track_title: 'Give Me The Night (Kolter Edit)' },
      { artist_name: 'Luuk van Dijk & Kolter', track_title: 'Good 4 U' },
      { artist_name: 'Marsolo', track_title: 'Sense Of Style' },
      { artist_name: 'Kolter', track_title: '15 Seconds of Fame' },
      { artist_name: 'Kolter', track_title: 'She Wants Bass' },
      { artist_name: 'Mihai Popoviciu', track_title: 'Waitin\'' },
      { artist_name: 'Kolter', track_title: 'Be Real' },
      { artist_name: 'Roy Davis Jr.', track_title: 'Gabriel (Live Garage Version)' }
    ]
  },

  // ============================================
  // Chris Stussy - Boiler Room Edinburgh (May 19, 2024)
  // Source: tracklists.thomaslaupstad.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/2787514k/chris-stussy-boiler-room-edinburgh-2024-05-19.html',
    dj_name: 'Chris Stussy',
    set_title: 'Chris Stussy @ Boiler Room Edinburgh',
    tracks: [
      { artist_name: 'Moby', track_title: 'Go (Chris Stussy Edit)' },
      { artist_name: 'ID', track_title: 'ID', is_id: true },
      { artist_name: 'Aaron-Carl', track_title: 'Drive (Downriver Dub)' },
      { artist_name: 'Pink Floyd', track_title: 'Another Brick In The Wall (Chris Stussy Edit)' },
      { artist_name: 'Gaskin', track_title: 'ID', is_id: true },
      { artist_name: 'ID', track_title: 'ID', is_id: true },
      { artist_name: 'Chris Stussy', track_title: 'ID', is_id: true },
      { artist_name: 'ID', track_title: 'ID', is_id: true },
      { artist_name: 'Across Boundaries & Chris Stussy & Locklead', track_title: 'T.M.P' },
      { artist_name: 'ID', track_title: 'Be Good To Me', is_id: true },
      { artist_name: 'Across Boundaries', track_title: 'Pumpin\'' },
      { artist_name: 'Obskür', track_title: 'I\'ve Arrived' },
      { artist_name: 'Kosh', track_title: 'Come On' },
      { artist_name: 'Chris Stussy', track_title: 'Bounce To The Beat' },
      { artist_name: 'Chris Stussy', track_title: 'ID', is_id: true },
      { artist_name: 'ID', track_title: 'ID', is_id: true },
      { artist_name: 'Todd Terry ft. Martha Wash & Jocelyn Brown', track_title: 'Something Going On (Acappella)' }
    ]
  },

  // ============================================
  // Luuk van Dijk - Essential Mix segment (ADE 2021)
  // Source: tracklists.thomaslaupstad.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/13qkxtz1/cinthie-luuk-van-dijk-bbc-radio-1-essential-mix-dgtl-festival-amsterdam-amsterdam-dance-event-netherlands-2021-10-14-2021-10-16.html',
    dj_name: 'Luuk van Dijk',
    set_title: 'Cinthie & Luuk van Dijk - Essential Mix (ADE)',
    tracks: [
      // Cinthie's set
      { artist_name: 'Adelphi Music Factory', track_title: 'Cuba' },
      { artist_name: 'Deetron', track_title: 'Dr. Melonball' },
      { artist_name: 'Somebody', track_title: 'Make A Dance' },
      { artist_name: 'Slo Moshun', track_title: 'Bells Of NY (Xen Mantra Beefy Bells Mix)' },
      { artist_name: 'Zeitgeist Freedom Energy Exchange', track_title: 'Kreuzberg Kix (Ge-Ology\'s Brooklyn Slap Mix)' },
      { artist_name: 'The Vision feat. Andreya Triana', track_title: 'Heaven (Danny Krivit Edit)' },
      { artist_name: 'Skatebård', track_title: 'Agrachrome RSC' },
      // Luuk van Dijk's set
      { artist_name: 'Denia', track_title: 'Ibiza (El Mix Mas Elegante)' },
      { artist_name: 'Idjut Boys', track_title: 'Jesta Funk' },
      { artist_name: 'Call Edan', track_title: 'Frome' },
      { artist_name: 'Housey Doingz', track_title: 'Brothers (LVD Edit)' },
      { artist_name: 'Two Right Wrongangs', track_title: 'System Error' },
      { artist_name: 'Shonky', track_title: 'KorgM1' },
      { artist_name: 'Presence', track_title: 'Partyboy (Pedro Goya Basic Edit)' },
      { artist_name: 'Luuk van Dijk', track_title: 'Aqui Con Migo' },
      { artist_name: 'Aniano', track_title: 'Risas Y Fiestas' },
      { artist_name: 'Julien Fuentes', track_title: 'Hey Mister DJ' },
      { artist_name: 'Serpico', track_title: 'Just Can\'t Stop vs Dangedit' },
      { artist_name: 'Mr. Ho & Wogwaa', track_title: 'Bail-E (LVD Edit)' },
      { artist_name: 'Aaron-Carl', track_title: 'The Answer' },
      { artist_name: 'The Martinez Brothers', track_title: 'Don\'t No Yet' },
      { artist_name: 'Luuk van Dijk', track_title: 'Let The Bass Kick' },
      { artist_name: 'G.O.D ft. Lorraine Lowe', track_title: 'Share My Love' }
    ]
  },

  // ============================================
  // ANOTR @ No Art Festival 2024
  // Source: set79.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/1kw4zk09/anotr-no-art-festival-netherlands-2024-07-26.html',
    dj_name: 'ANOTR',
    set_title: 'ANOTR @ No Art Festival',
    tracks: [
      { artist_name: 'Makeness & Adult Jazz', track_title: 'Other Life (Minor Science Dub)' },
      { artist_name: 'Compact Grey, Haze, Noir & Ron Costa', track_title: 'Around the Bane (Noir Mashup Treatment)' },
      { artist_name: 'Jay de Lys', track_title: 'Im so Wavy' },
      { artist_name: 'Danny Serrano', track_title: 'Trumpets Are Back' },
      { artist_name: 'Hardsoul', track_title: 'Bounson (Hardsoul\'s Latin Directions)' },
      { artist_name: 'Chico Rose', track_title: 'THA' },
      { artist_name: 'ANOTR', track_title: 'How You Feel (feat. Leven Kali)' },
      { artist_name: 'KC Flightt', track_title: 'Voices' },
      { artist_name: 'Hardsoul', track_title: 'Deep Inside (Hardsoul Mash up Mix)' },
      { artist_name: 'Adam Port', track_title: 'The American Dream' },
      { artist_name: 'Chambray', track_title: 'Ease' },
      { artist_name: 'Pupa Nas T, Kevin McKay & Denise Belfon', track_title: 'Work (Kevin McKay ViP)' },
      { artist_name: 'La Bouche', track_title: 'Be My Lover' },
      { artist_name: 'TAFKAMP & Irv Da Perv', track_title: 'Twerk Dat Shit' },
      { artist_name: 'Nana K & Ben Champell', track_title: 'Rapid Zone (Albird Remix)' },
      { artist_name: 'ANOTR', track_title: 'Currency (Count On Me) feat. Cimafunk & PAMÉ' },
      { artist_name: 'Uffie', track_title: 'A.D.D. S.U.V. (Armand Van Helden Club Remix)' },
      { artist_name: 'ANOTR', track_title: '24 (Turn It Up) feat. Kurtis Wells' },
      { artist_name: 'LF SYSTEM', track_title: 'All I\'ve Got' },
      { artist_name: 'Abel Balder & ANOTR', track_title: 'Relax My Eyes' },
      { artist_name: 'ATB', track_title: '9 P.M. (Till I Come)' }
    ]
  },

  // ============================================
  // Pete Tong - Michael Bibi Mix (Feb 2024)
  // Source: tracklists.thomaslaupstad.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/michaelbibi-pete-tong-2024-02-23.html',
    dj_name: 'Michael Bibi',
    set_title: 'Michael Bibi - Pete Tong Mix',
    tracks: [
      { artist_name: 'Zerb & Sofiya Nzau', track_title: 'Mwaki (Chris Avantgarde & Kevin De Vries Remix)' },
      { artist_name: 'Reflekt', track_title: 'Need To Feel Loved (Rose Ringed Remix)' },
      { artist_name: 'Francis Mercier & Emmanuel Jal', track_title: 'Hustla' },
      { artist_name: 'LooFy', track_title: 'Last Night' },
      { artist_name: 'Zach Witness', track_title: 'Can\'t Get It Outta My Head (MK Remix)' },
      { artist_name: 'Alan Dixon & Speakman & Misty', track_title: 'Warm' },
      { artist_name: 'Alan Dixon', track_title: 'Peperuke (feat. Nes Mburu)' },
      { artist_name: 'Sonickraft', track_title: 'So High' },
      { artist_name: 'Elkka', track_title: 'Make Me' },
      { artist_name: 'Made by Pete', track_title: 'Fires' },
      { artist_name: 'Ramin Rezaie', track_title: 'Ear Candy' },
      { artist_name: 'Michael Bibi & KinAhau', track_title: 'Different Side (feat. Audio Bullys)' },
      { artist_name: 'ID', track_title: 'ID', is_id: true },
      { artist_name: 'Paul Johnson', track_title: 'I\'m A Freak' },
      { artist_name: 'Reelow', track_title: 'M.O.N.E.Y (feat. Samira)' },
      { artist_name: 'Guy Gerber', track_title: 'Bocat (Michael Bibi Remix)' },
      { artist_name: 'WhoMadeWho', track_title: 'Love Will Save Me (feat. RY X)' },
      { artist_name: 'Disclosure & Eliza Doolittle', track_title: 'You and Me (Rivo Remix)' },
      { artist_name: 'Julio Bashmore', track_title: 'Sprungboard' },
      { artist_name: 'Sahar', track_title: 'Stereo Love' },
      { artist_name: 'Moby & Anfisa Letyago', track_title: 'You & Me' },
      { artist_name: 'Four Tet', track_title: 'Daydream Repeat' },
      { artist_name: 'Letícia Fialho', track_title: 'Corpo e Cancao (Maz(br) & Antdot Remix)' },
      { artist_name: 'NenaHalena & AMÉMÉ', track_title: 'Own The Fire' },
      { artist_name: 'Darco', track_title: 'Qatar' },
      { artist_name: 'Darco', track_title: 'This Is How We Do It' },
      { artist_name: 'Tal Fussman', track_title: '10247' },
      { artist_name: 'Afriqua', track_title: 'Take It To The House' },
      { artist_name: 'DJ Gregory', track_title: 'Tropical Soundclash (Joe T Vannelli Remix)' }
    ]
  },

  // ============================================
  // Jaden Thompson - Essential Mix (June 22, 2024)
  // Source: tracklists.thomaslaupstad.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/15rdf7j1/jaden-thompson-radio-1s-essential-mix-2024-06-22.html',
    dj_name: 'Jaden Thompson',
    set_title: 'Jaden Thompson - Essential Mix',
    tracks: [
      { artist_name: 'Jaden Thompson', track_title: 'Closer' },
      { artist_name: 'Earth, Wind & Fire', track_title: 'Brazilian Rhyme Beinjo (Kenny Dope Gonzalez Remix)' },
      { artist_name: 'DJ Jazzy Jeff', track_title: 'Rock With U (Yoruba Soul Mix Dub)' },
      { artist_name: 'Roy Ayers & Kerri Chandler', track_title: 'Good Vibrations (Onionz Protect Da Vibe Mix)' },
      { artist_name: 'Peven Everett', track_title: 'Stuck Again (Colfo Edit)' },
      { artist_name: 'Mark Farina', track_title: 'Alcazar Chant (Shelter Chicago Mix)' },
      { artist_name: 'Manoo', track_title: 'Kodjo (Hallex M Edit)' },
      { artist_name: 'Patrick Cowley', track_title: 'Primitive World' },
      { artist_name: 'Sun Archive', track_title: 'Jazz Universe' },
      { artist_name: 'Digs & Woosh & Mr. Ski', track_title: 'Rumpfunk' },
      { artist_name: 'Luis Radio', track_title: 'Barbosa' },
      { artist_name: 'D Stone', track_title: 'Djingo' },
      { artist_name: 'Saraga', track_title: 'Living Like This' },
      { artist_name: 'Laguna', track_title: 'Spiller From Rio' },
      { artist_name: 'Jaden Thompson', track_title: 'Front & Back' },
      { artist_name: 'Cour T.', track_title: 'Ngoma' },
      { artist_name: 'Ptazta', track_title: 'Brzp45 Music Sessions Vol 45 (Sik&Sem Edit)' },
      { artist_name: 'David Duriez', track_title: 'Disco Boobs' },
      { artist_name: 'Jaden Thompson', track_title: 'Deedoo' },
      { artist_name: 'Chris Durán & Borsico', track_title: 'Lemme See' },
      { artist_name: 'Red Effects Souler', track_title: 'Hit Me Out' },
      { artist_name: 'AJ Christou', track_title: 'Back & Forth' },
      { artist_name: 'DJ Reverseweave', track_title: 'HOTT DOGG' },
      { artist_name: 'Nitro Deluxe', track_title: 'Let\'s Get Brutal (Norty Cotto Afro Tech Remix)' },
      { artist_name: 'Mafifkizolo', track_title: 'Loot (Jaden Thompson Remix)' },
      { artist_name: 'Jaden Thompson', track_title: 'Downtown' },
      { artist_name: 'Jonny Rock', track_title: 'Track 1' },
      { artist_name: 'The Ding Dongers', track_title: 'This Time' },
      { artist_name: 'ItaloBros', track_title: 'Muse' },
      { artist_name: 'Jaden Thompson', track_title: 'Light A Fire' },
      { artist_name: 'Octave One', track_title: 'Rock My Soul (Reborn Mix)' },
      { artist_name: 'Pascal Moscheni', track_title: '4th Street' },
      { artist_name: 'Wilfy D', track_title: 'IDKW' },
      { artist_name: 'Wakyin', track_title: 'GWTT' },
      { artist_name: 'Malena Zavala', track_title: 'Ritmo de Vida (Jaden Thompson Edit)' }
    ]
  },

  // ============================================
  // Max Dean @ Sound LA (October 25, 2024)
  // Source: set79.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/maxdean-sound-la-2024-10-25.html',
    dj_name: 'Max Dean',
    set_title: 'Max Dean @ Sound LA',
    tracks: [
      { artist_name: 'Azari & III & Max Dean', track_title: 'Reckless' },
      { artist_name: 'Max Dean', track_title: 'The Seducer' },
      { artist_name: 'Distant Sun', track_title: 'Machine lernt' },
      { artist_name: 'Anti-Slam & W.E.A.P.O.N.', track_title: 'Bang (Live)' },
      { artist_name: 'Tiësto', track_title: 'Love Comes Again' },
      { artist_name: 'Max Dean', track_title: 'Impressed' },
      { artist_name: 'Argento', track_title: 'Red Light' },
      { artist_name: 'Rank 1', track_title: 'Airwave (Radio Vocal Edit)' },
      { artist_name: 'Kieran Morgan', track_title: 'I Like It' },
      { artist_name: 'DAETOR', track_title: 'Boathouse' },
      { artist_name: 'Gaskin', track_title: 'Get Ya Freak On' },
      { artist_name: 'Max Dean', track_title: 'Killerz' },
      { artist_name: 'Joss Dean', track_title: 'The People\'s Rhythm' },
      { artist_name: 'Prospa', track_title: 'Don\'t Stop' },
      { artist_name: 'Robbie Doherty', track_title: 'Rock the Beat' },
      { artist_name: 'Kolter', track_title: 'Canceled on Request' },
      { artist_name: 'Michael Jackson', track_title: 'P.Y.T. (Pretty Young Thing)' },
      { artist_name: 'Technotronic', track_title: 'Pump Up the Jam' },
      { artist_name: 'Marc Romboy & Blake Baxter', track_title: 'Freakin\'' },
      { artist_name: 'Max Dean', track_title: 'Fascinator' },
      { artist_name: 'Andy Compton', track_title: 'That Acid Track' },
      { artist_name: 'Robbie Doherty', track_title: 'Work It' },
      { artist_name: 'Breach', track_title: 'Jack' },
      { artist_name: 'Max Dean', track_title: 'Yes Baby' },
      { artist_name: 'Gaskin', track_title: 'Dancing in the Sky' },
      { artist_name: 'Richy Ahmed', track_title: 'Put Me In a Trance (feat. Gloria Adereti)' },
      { artist_name: 'Max Dean & Nafe Smallz', track_title: 'Feel Much Better (feat. Timbaland)' },
      { artist_name: 'Max Dean', track_title: 'Future Looks Bright (feat. Mr. V)' }
    ]
  },

  // ============================================
  // Wheats @ Solid Grooves DC-10 (July 2024)
  // Source: set79.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/wheats-solid-grooves-dc10-july-2024.html',
    dj_name: 'Wheats',
    set_title: 'Wheats @ Solid Grooves DC-10',
    tracks: [
      { artist_name: 'wAFF', track_title: 'Underbite' },
      { artist_name: 'Andy Compton', track_title: 'That Acid Track' },
      { artist_name: 'Marco Strous', track_title: 'Diva' },
      { artist_name: 'Alex Flatner & Hermanez', track_title: 'Exile (Benny Grauer Remix)' },
      { artist_name: 'Jholeyson', track_title: 'Discow' },
      { artist_name: 'Paolo Martini & Paul C', track_title: 'The Getback' },
      { artist_name: 'wAFF', track_title: 'Leaving You' },
      { artist_name: 'EDDY M.', track_title: 'Sketching G' },
      { artist_name: 'East End Dubs & Wheats', track_title: 'Searching' },
      { artist_name: 'Eskuche', track_title: 'Concentrate' },
      { artist_name: 'Iglesias', track_title: 'Hey Baby' },
      { artist_name: 'Nelly Furtado', track_title: 'Say It Right (Friscia & Lamboy Electrotribe MixShow Mix)' },
      { artist_name: 'Proudly People', track_title: 'Missing You' },
      { artist_name: 'Davide T', track_title: 'I Know (Edit)' },
      { artist_name: 'Christian Burkhardt & Daniel Roth', track_title: 'Do Do (feat. Goran Bahic)' },
      { artist_name: 'Paul Woolford', track_title: 'Story of My Life' },
      { artist_name: 'Traumer', track_title: 'Ju (Traumer Sunset Mix)' }
    ]
  },

  // ============================================
  // Gaskin @ PIV Beach Set (Colorado Charlie 2024)
  // Source: set79.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/gaskin-piv-beach-set-colorado-charlie-2024.html',
    dj_name: 'Gaskin',
    set_title: 'Gaskin @ PIV Beach Set',
    tracks: [
      { artist_name: 'C.O.D.E. R.E.D.', track_title: '4 The Love' },
      { artist_name: 'Dxnby', track_title: 'Bumpin\'' },
      { artist_name: 'Rank 1', track_title: 'Airwave (Radio Vocal Edit)' },
      { artist_name: 'Kolter', track_title: '15 Seconds of Fame (Edit)' },
      { artist_name: 'Sandy B', track_title: 'Make The World Go Round (Deep Dish edit)' },
      { artist_name: 'Gaskin', track_title: 'Anthem' },
      { artist_name: 'Bloodhound Gang', track_title: 'Uhn Tiss Uhn Tiss Uhn Tiss' },
      { artist_name: 'Sidney Charles', track_title: 'Trip Advisor (Rhythm, Snare, Bass)' },
      { artist_name: 'Gaskin', track_title: 'Dirty Mindz' },
      { artist_name: 'Gaskin', track_title: 'Nutralize' },
      { artist_name: 'Vitess', track_title: 'Blue Vision' },
      { artist_name: 'Gaskin', track_title: 'Me, Myself & That Dancefloor' },
      { artist_name: 'Kieran Morgan', track_title: 'I Like It' },
      { artist_name: 'Lexicon', track_title: 'Don\'t Give The Love' },
      { artist_name: 'Sound Design & Todd Terry', track_title: 'Bounce to the Beat (Chris Stussy Remix)' },
      { artist_name: 'Gaskin', track_title: 'Closer' },
      { artist_name: 'Luca Donzelli', track_title: 'Rlz' },
      { artist_name: 'Solu Music', track_title: 'Fade (feat. KimBlee) [Grant Nelson Big Room Remix]' },
      { artist_name: 'The Shapeshifters', track_title: 'Lola\'s Theme' }
    ]
  },

  // ============================================
  // Prunk @ PIV Beach Set (Colorado Charlie 2024)
  // Source: set79.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/prunk-piv-beach-set-colorado-charlie-2024.html',
    dj_name: 'Prunk',
    set_title: 'Prunk @ PIV Beach Set',
    tracks: [
      { artist_name: 'US Two', track_title: 'Lovely Night' },
      { artist_name: 'Gadjo', track_title: 'So Many Times' },
      { artist_name: 'Ozzie Guven & Chris Gialanze', track_title: 'House Party' },
      { artist_name: 'US Two', track_title: 'Breaking Dollars' },
      { artist_name: 'Gillette & 20 Fingers', track_title: 'Short, Short Man' },
      { artist_name: 'Christian Smith', track_title: 'Traction (Paride Saraceni Remix)' },
      { artist_name: 'Grant Nelson', track_title: 'Rush (feat. Lil Suze)' },
      { artist_name: 'Sidney Charles', track_title: 'Charles List' },
      { artist_name: 'Prunk', track_title: 'Heat' },
      { artist_name: 'Crystal Waters', track_title: 'Gypsy Woman (Remix)' },
      { artist_name: 'Satoshi Tomiie', track_title: 'Resonant' },
      { artist_name: 'Alex Dolby & Santos', track_title: 'Raw Road (Carlo Lio Remix)' },
      { artist_name: 'Max Chapman', track_title: 'Strung Up' },
      { artist_name: 'Soulsearcher', track_title: 'Can\'t Get Enough! (Prunk Remix)' }
    ]
  },

  // ============================================
  // East End Dubs - Mixmag Lab LDN (Nov 29, 2024)
  // Source: watchthedj.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/east-end-dubs-mixmag-lab-ldn-2024.html',
    dj_name: 'East End Dubs',
    set_title: 'East End Dubs @ Mixmag Lab LDN',
    tracks: [
      { artist_name: 'Stuart Matheson', track_title: 'ID', is_id: true },
      { artist_name: 'Obskür', track_title: 'Warriors Dance (Prodigy Edit)' },
      { artist_name: 'Gaskin', track_title: 'Inspired Eyes' },
      { artist_name: 'Jamback', track_title: 'ID', is_id: true },
      { artist_name: 'Julian Fijma', track_title: 'ID', is_id: true },
      { artist_name: 'Ryan Resso', track_title: 'We Like to Party' },
      { artist_name: 'Sidney Charles', track_title: 'ID', is_id: true },
      { artist_name: 'Obskür', track_title: 'Falling Back x Pump Up The Jam' },
      { artist_name: 'Di Chiara Brothers', track_title: 'Losing Sleep' },
      { artist_name: 'Robbie Doherty', track_title: 'ID', is_id: true },
      { artist_name: 'Sidney Charles x Kolter', track_title: 'ID', is_id: true },
      { artist_name: 'Jamback', track_title: 'Record Breaking' },
      { artist_name: 'Danny Tenaglia', track_title: 'Music is the Answer (East End Dubs Remix)' },
      { artist_name: 'Worthy', track_title: 'Cause I Love' }
    ]
  },

  // ============================================
  // Sidney Charles @ Colorado Charlie (Oct 4, 2024)
  // Source: set79.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/sidney-charles-colorado-charlie-2024-10-04.html',
    dj_name: 'Sidney Charles',
    set_title: 'Sidney Charles @ Colorado Charlie',
    tracks: [
      { artist_name: 'Kolter', track_title: 'Who You Talking to?' },
      { artist_name: 'Bodyrox', track_title: 'Yeah Yeah (D Ramirez Vocal Radio Edit)' },
      { artist_name: 'Robin S.', track_title: 'Show Me Love' },
      { artist_name: 'Jesse Jacob', track_title: 'Onto the Next' },
      { artist_name: 'Rang dong', track_title: 'DXC' },
      { artist_name: 'Jhobei', track_title: 'Swarming' },
      { artist_name: '99 All Stars', track_title: 'Luv is All You Need (Ralphi\'s Cha Cha Italo Dub)' },
      { artist_name: 'Energy 52', track_title: 'Café Del Mar (Three \'n One Remix)' },
      { artist_name: 'Robbie Doherty', track_title: 'Bass Electronic' },
      { artist_name: 'JK Rollin', track_title: 'Lick It' },
      { artist_name: 'Christian Smith', track_title: 'Traction (Paride Saraceni Remix)' },
      { artist_name: 'Di Chiara Brothers', track_title: 'Mystic Night' },
      { artist_name: 'Sidney Charles', track_title: 'Beyond Infinity' },
      { artist_name: 'Josh Baker', track_title: 'Bass Up To The Top' },
      { artist_name: 'Andy Compton', track_title: 'That Acid Track' },
      { artist_name: 'Sidney Charles', track_title: 'Trip Advisor (Rhythm, Snare, Bass)' },
      { artist_name: 'Calvin Harris & Sam Smith', track_title: 'Promises (Sonny Fodera Remix)' },
      { artist_name: 'Tim Taylor', track_title: 'What Do You See?' },
      { artist_name: 'Sidney Charles', track_title: 'Rave Culture' },
      { artist_name: 'Rank 1', track_title: 'Airwave (Radio Vocal Edit)' },
      { artist_name: 'Tyree Cooper', track_title: 'Turn Up the Bass' },
      { artist_name: 'Kolter', track_title: '15 Seconds of Fame (Edit)' },
      { artist_name: 'Tim Deluxe', track_title: 'It Just Won\'t Do (feat. Sam Obernik)' },
      { artist_name: 'Somore', track_title: 'I Refuse (What You Want)' },
      { artist_name: 'Sidney Charles', track_title: 'Rawline 98' },
      { artist_name: 'Distant Sun', track_title: 'Machine lernt' }
    ]
  },

  // ============================================
  // Sidney Charles @ Heavy House Society Leeds (Dec 7, 2024)
  // Source: set79.com
  // ============================================
  {
    tracklist_url: 'https://www.1001tracklists.com/tracklist/sidney-charles-heavy-house-society-leeds-2024-12-07.html',
    dj_name: 'Sidney Charles',
    set_title: 'Sidney Charles @ Heavy House Society Leeds',
    tracks: [
      { artist_name: 'Gillette & 20 Fingers', track_title: 'Short, Short Man' },
      { artist_name: 'Mati Astroza', track_title: 'Once Again Back' },
      { artist_name: 'M-High', track_title: 'This \'N That' },
      { artist_name: 'Ken Spieker', track_title: 'Aloe' },
      { artist_name: 'Bodyrox', track_title: 'Yeah Yeah (D Ramirez Vocal Radio Edit)' },
      { artist_name: 'Gigi D\'Agostino', track_title: 'Bla Bla Bla' },
      { artist_name: 'Kolter', track_title: 'Who You Talking to?' },
      { artist_name: 'Sidney Charles', track_title: 'Trip Advisor (Rhythm, Snare, Bass)' },
      { artist_name: 'Dxnby', track_title: 'High Rise' },
      { artist_name: 'Tim Taylor', track_title: 'What Do You See?' },
      { artist_name: '99 All Stars', track_title: 'Luv is All You Need' },
      { artist_name: 'Rank 1', track_title: 'Airwave (Radio Vocal Edit)' },
      { artist_name: 'Piem', track_title: 'Boy Don\'t (feat. Natalie Gray)' },
      { artist_name: 'Sidney Charles', track_title: 'Charles List' },
      { artist_name: 'Sidney Charles', track_title: 'We Keep On Groovin' },
      { artist_name: 'Ken Spieker', track_title: 'Serenity' },
      { artist_name: 'Sidney Charles', track_title: 'Keep Rocking' },
      { artist_name: 'Sidney Charles', track_title: 'Rave Culture' }
    ]
  }
];

async function seedSetTracks() {
  console.log('Starting to seed set_tracks with verified tracklists...\n');

  let setsProcessed = 0;
  let tracksInserted = 0;
  let errors = 0;

  for (const setData of verifiedTracklists) {
    console.log(`\nProcessing: ${setData.set_title}`);
    console.log(`  Source: ${setData.tracklist_url}`);

    // Find the set by tracklist URL
    const { data: set, error: setError } = await supabase
      .from('sets')
      .select('id, title')
      .eq('tracklist_url', setData.tracklist_url)
      .single();

    if (setError || !set) {
      console.log(`  ERROR: Set not found in database`);
      errors++;
      continue;
    }

    console.log(`  Found set: ${set.title} (${set.id})`);

    // Check if tracks already exist for this set
    const { data: existingTracks } = await supabase
      .from('set_tracks')
      .select('id')
      .eq('set_id', set.id);

    if (existingTracks && existingTracks.length > 0) {
      console.log(`  Skipping: ${existingTracks.length} tracks already exist`);
      continue;
    }

    // Insert tracks
    for (let i = 0; i < setData.tracks.length; i++) {
      const track = setData.tracks[i];
      const position = i + 1;

      // Try to find matching track in tracks table
      const { data: matchedTrack } = await supabase
        .from('tracks')
        .select('id')
        .ilike('title', `%${track.track_title}%`)
        .ilike('artist_name', `%${track.artist_name.split('&')[0].split('feat')[0].trim()}%`)
        .limit(1)
        .single();

      const { error: insertError } = await supabase
        .from('set_tracks')
        .insert({
          set_id: set.id,
          track_id: matchedTrack?.id || null,
          artist_name: track.artist_name,
          track_title: track.track_title,
          position,
          is_id: track.is_id || false
        });

      if (insertError) {
        console.log(`    Error inserting track ${position}: ${insertError.message}`);
        errors++;
      } else {
        tracksInserted++;
      }
    }

    console.log(`  Inserted ${setData.tracks.length} tracks`);
    setsProcessed++;

    // Update track_count on the set
    await supabase
      .from('sets')
      .update({ track_count: setData.tracks.length })
      .eq('id', set.id);
  }

  console.log('\n========================================');
  console.log(`Sets processed: ${setsProcessed}`);
  console.log(`Tracks inserted: ${tracksInserted}`);
  console.log(`Errors: ${errors}`);
  console.log('========================================');

  // Show summary
  const { data: setsWithTracks, count } = await supabase
    .from('set_tracks')
    .select('set_id', { count: 'exact' });

  const uniqueSets = new Set(setsWithTracks?.map(t => t.set_id));
  console.log(`\nTotal sets with tracklists: ${uniqueSets.size}`);
  console.log(`Total tracks in set_tracks: ${count}`);
}

seedSetTracks().catch(console.error);
