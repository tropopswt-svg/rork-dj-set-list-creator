import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Helper to find artist ID
async function getArtistId(name: string): Promise<string | null> {
  const { data } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', name)
    .single();
  return data?.id || null;
}

// Comprehensive track list organized by era and genre
const tracks = [
  // ==========================================
  // CLASSIC CHICAGO HOUSE (1984-1992)
  // ==========================================
  { title: 'Your Love', artist: 'Frankie Knuckles', label: 'Trax Records', year: 1987 },
  { title: 'The Whistle Song', artist: 'Frankie Knuckles', label: 'Virgin', year: 1991 },
  { title: 'Baby Wants to Ride', artist: 'Frankie Knuckles', label: 'Trax Records', year: 1987 },
  { title: 'Move Your Body', artist: 'Marshall Jefferson', label: 'Trax Records', year: 1986 },
  { title: 'Open Our Eyes', artist: 'Marshall Jefferson', label: 'Trax Records', year: 1988 },
  { title: 'Can You Feel It', artist: 'Larry Heard', label: 'Trax Records', year: 1986 },
  { title: 'Mystery of Love', artist: 'Larry Heard', label: 'Trax Records', year: 1985 },
  { title: 'Washing Machine', artist: 'Larry Heard', label: 'Trax Records', year: 1986 },
  { title: 'Beyond the Clouds', artist: 'Larry Heard', label: 'Black Market', year: 1989 },
  { title: 'Acid Tracks', artist: 'Phuture', label: 'Trax Records', year: 1987 },
  { title: 'Jack Your Body', artist: 'Steve Silk Hurley', label: 'DJ International', year: 1986 },
  { title: 'Love Cant Turn Around', artist: 'Farley Jackmaster Funk', label: 'DJ International', year: 1986 },
  
  // ==========================================
  // CLASSIC DETROIT TECHNO (1985-1995)
  // ==========================================
  { title: 'Strings of Life', artist: 'Derrick May', label: 'Transmat', year: 1987 },
  { title: 'Nude Photo', artist: 'Derrick May', label: 'Transmat', year: 1987 },
  { title: 'The Dance', artist: 'Derrick May', label: 'Transmat', year: 1989 },
  { title: 'No UFOs', artist: 'Juan Atkins', label: 'Metroplex', year: 1985 },
  { title: 'Night Drive', artist: 'Juan Atkins', label: 'Metroplex', year: 1985 },
  { title: 'Big Fun', artist: 'Kevin Saunderson', label: 'Virgin', year: 1988 },
  { title: 'Good Life', artist: 'Kevin Saunderson', label: 'Virgin', year: 1988 },
  { title: 'The Bells', artist: 'Jeff Mills', label: 'Purpose Maker', year: 1996 },
  { title: 'Phase 4', artist: 'Jeff Mills', label: 'Tresor', year: 1994 },
  { title: 'At First Sight', artist: 'Carl Craig', label: 'Planet E', year: 1992 },
  { title: 'Bug in the Bassbin', artist: 'Carl Craig', label: 'Planet E', year: 1990 },
  { title: 'Minimal Nation', artist: 'Robert Hood', label: 'M-Plant', year: 1994 },
  { title: 'Never Grow Old', artist: 'Robert Hood', label: 'M-Plant', year: 2010 },
  
  // ==========================================
  // CLASSIC DEEP HOUSE
  // ==========================================
  { title: 'Rain', artist: 'Kerri Chandler', label: 'Madhouse', year: 1995 },
  { title: 'Bar A Thym', artist: 'Kerri Chandler', label: 'Deeply Rooted', year: 1998 },
  { title: 'Atmosphere', artist: 'Kerri Chandler', label: 'Large', year: 2003 },
  { title: 'Elements of Life', artist: 'Louie Vega', label: 'Vega Records', year: 2003 },
  { title: 'Being With U', artist: 'Masters At Work', label: 'MAW Records', year: 1997 },
  { title: 'Shejah', artist: 'Moodymann', label: 'KDJ', year: 2000 },
  { title: 'I Cant Kick This Feeling', artist: 'Moodymann', label: 'KDJ', year: 2004 },
  { title: 'Falling Up', artist: 'Theo Parrish', label: 'Sound Signature', year: 2001 },
  { title: 'Summertime Is Here', artist: 'Theo Parrish', label: 'Sound Signature', year: 2007 },
  
  // ==========================================
  // UK GARAGE CLASSICS
  // ==========================================
  { title: 'Finally', artist: 'Kings of Tomorrow', label: 'Distance', year: 2000 },
  { title: 'Flowers', artist: 'Armand Van Helden', label: 'FFRR', year: 1999 },
  { title: 'U Dont Know Me', artist: 'Armand Van Helden', label: 'Southern Fried', year: 1999 },
  { title: 'Sweet Like Chocolate', artist: 'Shanks & Bigfoot', label: 'Pepper', year: 1999 },
  { title: 'RIP Groove', artist: 'Double 99', label: 'Ice Cream', year: 1997 },
  { title: 'Another Chance', artist: 'Roger Sanchez', label: 'Defected', year: 2001 },
  
  // ==========================================
  // 2000s HOUSE CLASSICS
  // ==========================================
  { title: 'Most Precious Love', artist: 'Blaze', label: 'Defected', year: 2005 },
  { title: 'Compost Black Label 1', artist: 'Âme', label: 'Compost', year: 2006 },
  { title: 'Rej', artist: 'Âme', label: 'Innervisions', year: 2006 },
  { title: 'Where We At', artist: 'Âme', label: 'Innervisions', year: 2007 },
  { title: 'My Friend', artist: 'Dixon', label: 'Innervisions', year: 2007 },
  { title: 'Synrise', artist: 'Stimming', label: 'Diynamic', year: 2008 },
  { title: 'Inspector Norse', artist: 'Todd Terje', label: 'Olsen', year: 2012 },
  { title: 'Ragysh', artist: 'Todd Terje', label: 'Olsen', year: 2009 },
  { title: 'Amygdala', artist: 'DJ Koze', label: 'Pampa', year: 2013 },
  { title: 'Pick Up', artist: 'DJ Koze', label: 'Pampa', year: 2018 },
  { title: 'Seeing Aliens', artist: 'DJ Koze', label: 'Pampa', year: 2018 },
  
  // ==========================================
  // MINIMAL / ROMANIAN
  // ==========================================
  { title: 'Vinyl Speed Adjust', artist: 'Raresh', label: 'a:rpia:r', year: 2008 },
  { title: 'Capriciu', artist: 'Rhadoo', label: 'a:rpia:r', year: 2010 },
  { title: 'Niste Nebunii', artist: 'Rhadoo', label: 'a:rpia:r', year: 2011 },
  { title: 'Cezanne', artist: 'Petre Inspirescu', label: 'a:rpia:r', year: 2009 },
  { title: 'Arpiar 14', artist: 'Praslea', label: 'a:rpia:r', year: 2012 },
  { title: 'Aletheia', artist: 'Arapu', label: 'Metereze', year: 2016 },
  { title: 'The Brothers', artist: 'Ricardo Villalobos', label: 'Cadenza', year: 2006 },
  { title: 'Easy Lee', artist: 'Ricardo Villalobos', label: 'Playhouse', year: 2003 },
  { title: 'Fizheuer Ziepp', artist: 'Ricardo Villalobos', label: 'Playhouse', year: 2004 },
  { title: 'Dexter', artist: 'Ricardo Villalobos', label: 'Sei Es Drum', year: 2005 },
  
  // ==========================================
  // BERGHAIN / BERLIN TECHNO
  // ==========================================
  { title: 'Subzero', artist: 'Ben Klock', label: 'Klockworks', year: 2009 },
  { title: 'Dawning', artist: 'Ben Klock', label: 'Ostgut Ton', year: 2010 },
  { title: 'Catenaccio', artist: 'Ben Klock', label: 'Klockworks', year: 2011 },
  { title: 'Dawning', artist: 'Marcel Dettmann', label: 'Ostgut Ton', year: 2007 },
  { title: 'Vertigo', artist: 'Marcel Dettmann', label: 'Ostgut Ton', year: 2013 },
  { title: 'Death By House', artist: 'Len Faki', label: 'Podium', year: 2008 },
  { title: 'Rainbow Delta', artist: 'Len Faki', label: 'Figure', year: 2009 },
  { title: 'Black Asteroid', artist: 'DVS1', label: 'Mistress', year: 2012 },
  { title: 'Innervisions', artist: 'Function', label: 'Sandwell District', year: 2010 },
  { title: 'Awake', artist: 'Etapp Kyle', label: 'Klockworks', year: 2015 },
  { title: 'FJAAK', artist: 'FJAAK', label: 'FJAAK', year: 2016 },
  { title: 'Age of Love', artist: 'Charlotte de Witte', label: 'KNTXT', year: 2021 },
  
  // ==========================================
  // MELODIC TECHNO / AFTERLIFE
  // ==========================================
  { title: 'Voodoo', artist: 'Tale Of Us', label: 'Afterlife', year: 2016 },
  { title: 'Unity', artist: 'Tale Of Us', label: 'Afterlife', year: 2014 },
  { title: 'Endless', artist: 'Tale Of Us', label: 'Afterlife', year: 2016 },
  { title: 'Nova', artist: 'Mind Against', label: 'Afterlife', year: 2015 },
  { title: 'Gravity', artist: 'Adriatique', label: 'Afterlife', year: 2017 },
  { title: 'Ebony', artist: 'Adriatique', label: 'Siamese', year: 2018 },
  { title: 'Never Cry Wolf', artist: 'Stephan Bodzin', label: 'Herzblut', year: 2007 },
  { title: 'Singularity', artist: 'Stephan Bodzin', label: 'Herzblut', year: 2016 },
  { title: 'Strand', artist: 'Stephan Bodzin', label: 'Afterlife', year: 2019 },
  { title: 'Conjure Superstar', artist: 'Maceo Plex', label: 'Ellum', year: 2012 },
  { title: 'Frisky', artist: 'Maceo Plex', label: 'Crosstown Rebels', year: 2014 },
  { title: 'Solar', artist: 'Maceo Plex', label: 'Kompakt', year: 2017 },
  { title: 'Running', artist: 'Artbat', label: 'UPPERGROUND', year: 2018 },
  { title: 'Atlas', artist: 'Artbat', label: 'Diynamic', year: 2019 },
  { title: 'Tabu', artist: 'Artbat', label: 'UPPERGROUND', year: 2020 },
  { title: 'Space Date', artist: 'Boris Brejcha', label: 'Fckng Serious', year: 2016 },
  { title: 'Gravity', artist: 'Boris Brejcha', label: 'Ultra', year: 2019 },
  { title: 'Camelphat', artist: 'CamelPhat', label: 'Defected', year: 2017 },
  { title: 'Cola', artist: 'CamelPhat', label: 'Defected', year: 2017 },
  { title: 'Breathe', artist: 'CamelPhat', label: 'Defected', year: 2018 },
  { title: 'Rabbit Hole', artist: 'CamelPhat', label: 'RCA', year: 2020 },
  { title: 'Hyperion', artist: 'Anyma', label: 'Afterlife', year: 2022 },
  { title: 'Sentient', artist: 'Anyma', label: 'Afterlife', year: 2023 },
  { title: 'The Answer', artist: 'Massano', label: 'Afterlife', year: 2023 },
  
  // ==========================================
  // TECH HOUSE HITS
  // ==========================================
  { title: 'Where You Are', artist: 'John Summit', label: 'Repopulate Mars', year: 2020 },
  { title: 'Deep End', artist: 'John Summit', label: 'Defected', year: 2020 },
  { title: 'Make Me Feel', artist: 'John Summit', label: 'Defected', year: 2021 },
  { title: 'La Danza', artist: 'John Summit', label: 'Insomniac', year: 2022 },
  { title: 'Comfort Zone', artist: 'John Summit', label: 'Experts Only', year: 2023 },
  { title: 'Losing It', artist: 'Fisher', label: 'Catch & Release', year: 2018 },
  { title: 'Ya Kidding', artist: 'Fisher', label: 'Catch & Release', year: 2019 },
  { title: 'Freaks', artist: 'Fisher', label: 'Catch & Release', year: 2021 },
  { title: 'Rumble', artist: 'Skrillex', label: 'OWSLA', year: 2023 },
  { title: 'Turn Off The Lights', artist: 'Chris Lake', label: 'Black Book', year: 2018 },
  { title: 'I Want You', artist: 'Chris Lake', label: 'Black Book', year: 2019 },
  { title: 'In The Yuma', artist: 'Chris Lake', label: 'Black Book', year: 2020 },
  { title: 'San Frandisco', artist: 'Dom Dolla', label: 'Sweat It Out', year: 2019 },
  { title: 'Rhyme Dust', artist: 'Dom Dolla', label: 'Three Six Zero', year: 2021 },
  { title: 'Miracle Maker', artist: 'Dom Dolla', label: 'Sweat It Out', year: 2022 },
  { title: 'Ferrari', artist: 'James Hype', label: 'Big Beat', year: 2022 },
  { title: 'Drums', artist: 'James Hype', label: 'Big Beat', year: 2023 },
  { title: 'Wet', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2019 },
  { title: 'La Pasion', artist: 'Michael Bibi', label: 'Solid Grooves', year: 2020 },
  
  // ==========================================
  // KEINEMUSIK / MELODIC HOUSE
  // ==========================================
  { title: 'Your Mind', artist: 'Adam Port', label: 'Keinemusik', year: 2017 },
  { title: 'Shifter', artist: '&ME', label: 'Keinemusik', year: 2019 },
  { title: 'Save My Soul', artist: '&ME', label: 'Keinemusik', year: 2016 },
  { title: 'The Rapture', artist: 'Rampa', label: 'Keinemusik', year: 2017 },
  { title: 'Muyè', artist: 'Keinemusik', label: 'Keinemusik', year: 2021 },
  { title: 'Workxx', artist: 'Keinemusik', label: 'Keinemusik', year: 2022 },
  { title: 'Better', artist: 'Damian Lazarus', label: 'Crosstown Rebels', year: 2015 },
  { title: 'Vermillion', artist: 'Damian Lazarus', label: 'Crosstown Rebels', year: 2012 },
  { title: 'Dark Star', artist: 'Hot Since 82', label: 'Knee Deep In Sound', year: 2014 },
  { title: 'Buggin', artist: 'Hot Since 82', label: 'Knee Deep In Sound', year: 2016 },
  
  // ==========================================
  // AFRO HOUSE
  // ==========================================
  { title: 'We Dance Again', artist: 'Black Coffee', label: 'Ultra', year: 2015 },
  { title: 'Drive', artist: 'Black Coffee', label: 'Ultra', year: 2017 },
  { title: '10 Missed Calls', artist: 'Black Coffee', label: 'Ultra', year: 2019 },
  { title: 'Wish You Were Here', artist: 'Black Coffee', label: 'Ultra', year: 2021 },
  { title: 'Izulu', artist: 'Themba', label: 'Yoshitoshi', year: 2020 },
  { title: 'Sound of Freedom', artist: 'Themba', label: 'Armada', year: 2021 },
  { title: 'Adorn', artist: 'Enoo Napa', label: 'Get Physical', year: 2019 },
  
  // ==========================================
  // DISCO / NU-DISCO
  // ==========================================
  { title: 'Strandbar', artist: 'Todd Terje', label: 'Olsen', year: 2009 },
  { title: 'Preben Remansen', artist: 'Todd Terje', label: 'Olsen', year: 2010 },
  { title: 'Delorean Dynamite', artist: 'Todd Terje', label: 'Olsen', year: 2012 },
  { title: 'I Believe In Miracles', artist: 'Dimitri From Paris', label: 'BBE', year: 2000 },
  { title: 'Sacre Francais', artist: 'Dimitri From Paris', label: 'Yellow Productions', year: 1996 },
  { title: 'Track 4', artist: 'Four Tet', label: 'Text', year: 2019 },
  { title: 'Baby', artist: 'Four Tet', label: 'Text', year: 2020 },
  { title: 'Insides', artist: 'Four Tet', label: 'Text', year: 2021 },
  { title: 'Nang', artist: 'Floating Points', label: 'Ninja Tune', year: 2017 },
  { title: 'LesAlpx', artist: 'Floating Points', label: 'Ninja Tune', year: 2019 },
  { title: 'Body', artist: 'Folamour', label: 'FHUO', year: 2018 },
  { title: 'The Power', artist: 'Folamour', label: 'FHUO', year: 2019 },
  { title: 'In Your Arms', artist: 'Purple Disco Machine', label: 'Sweat It Out', year: 2021 },
  { title: 'Hypnotized', artist: 'Purple Disco Machine', label: 'Sony', year: 2020 },
  { title: 'Dopamine', artist: 'Purple Disco Machine', label: 'Sony', year: 2022 },
  
  // ==========================================
  // UK BASS / GARAGE MODERN
  // ==========================================
  { title: 'So U Kno', artist: 'Overmono', label: 'XL Recordings', year: 2022 },
  { title: 'Gunk', artist: 'Overmono', label: 'XL Recordings', year: 2023 },
  { title: 'Arla', artist: 'Overmono', label: 'XL Recordings', year: 2023 },
  { title: 'Ellipsis', artist: 'Joy Orbison', label: 'Hinge Finger', year: 2018 },
  { title: 'Flight FM', artist: 'Joy Orbison', label: 'XL Recordings', year: 2021 },
  { title: 'To Have and To Hold', artist: 'Kettama', label: 'Shall Not Fade', year: 2020 },
  { title: 'Mind X', artist: 'Interplanetary Criminal', label: 'Higher Ground', year: 2020 },
  { title: 'Higher', artist: 'Conducta', label: 'Kiwi Rekords', year: 2019 },
  
  // ==========================================
  // LO-FI HOUSE
  // ==========================================
  { title: 'Thru You', artist: 'Ross From Friends', label: 'Brainfeeder', year: 2018 },
  { title: 'Epiphany', artist: 'Ross From Friends', label: 'Brainfeeder', year: 2018 },
  { title: 'I Selezioni', artist: 'Mall Grab', label: 'Steel City Dance Discs', year: 2016 },
  { title: 'Sun Ra', artist: 'Mall Grab', label: 'Steel City Dance Discs', year: 2017 },
  { title: 'U', artist: 'DJ Seinfeld', label: 'Lobster Theremin', year: 2017 },
  { title: 'How U Make Me Feel', artist: 'DJ Seinfeld', label: 'Lobster Theremin', year: 2017 },
  { title: 'Sakura', artist: 'DJ Boring', label: 'E-Beamz', year: 2016 },
  
  // ==========================================
  // FEMALE ARTISTS
  // ==========================================
  { title: 'Object Blue', artist: 'Peggy Gou', label: 'Ninja Tune', year: 2018 },
  { title: 'It Makes You Forget', artist: 'Peggy Gou', label: 'Ninja Tune', year: 2018 },
  { title: 'Nabi', artist: 'Peggy Gou', label: 'XL Recordings', year: 2023 },
  { title: 'I Believe', artist: 'Peggy Gou', label: 'XL Recordings', year: 2023 },
  { title: 'Ectasy', artist: 'Helena Hauff', label: 'Ninja Tune', year: 2018 },
  { title: 'Barrow Boot Boys', artist: 'Helena Hauff', label: 'Werkdiscs', year: 2015 },
  { title: 'Honey', artist: 'Honey Dijon', label: 'Classic', year: 2017 },
  { title: 'Not About You', artist: 'Honey Dijon', label: 'Classic', year: 2018 },
  { title: 'Estacy', artist: 'Sofia Kourtesis', label: 'Ninja Tune', year: 2021 },
  { title: 'By Your Side', artist: 'Sofia Kourtesis', label: 'Ninja Tune', year: 2023 },
  { title: 'Be Free', artist: 'HAAi', label: 'Mute', year: 2022 },
  { title: 'Bodies of Water', artist: 'HAAi', label: 'Mute', year: 2022 },
  { title: 'Retrograde', artist: 'Avalon Emerson', label: 'Whities', year: 2019 },
  { title: 'Church of Melody', artist: 'Avalon Emerson', label: 'Another Dove', year: 2023 },
  { title: 'Galaxy', artist: 'The Blessed Madonna', label: 'We Still Believe', year: 2020 },
  { title: 'Blue Heaven', artist: 'Jayda G', label: 'Ninja Tune', year: 2021 },
  { title: 'Both of Us', artist: 'Jayda G', label: 'Ninja Tune', year: 2019 },
  
  // ==========================================
  // PROGRESSIVE HOUSE CLASSICS
  // ==========================================
  { title: 'Arena', artist: 'Sasha', label: 'deconstruction', year: 1999 },
  { title: 'Xpander', artist: 'Sasha', label: 'Deconstruction', year: 1999 },
  { title: 'Wavy Gravy', artist: 'Sasha', label: 'Last Night on Earth', year: 2015 },
  { title: 'Heaven Scent', artist: 'John Digweed', label: 'Bedrock', year: 2000 },
  { title: 'Gypsy', artist: 'Joris Voorn', label: 'Rejected', year: 2010 },
  { title: 'Form', artist: 'Joris Voorn', label: 'Rejected', year: 2018 },
  { title: 'Pjanoo', artist: 'Eric Prydz', label: 'Data', year: 2008 },
  { title: 'Call on Me', artist: 'Eric Prydz', label: 'Data', year: 2004 },
  { title: 'Opus', artist: 'Eric Prydz', label: 'Virgin', year: 2016 },
  { title: 'Every Day', artist: 'Eric Prydz', label: 'Pryda', year: 2012 },
  { title: 'Shadows', artist: 'Yotto', label: 'Anjunadeep', year: 2017 },
  { title: 'Turning', artist: 'Yotto', label: 'Anjunadeep', year: 2019 },
  
  // ==========================================
  // CURRENT UNRELEASED / ID TRACKS
  // ==========================================
  { title: 'Unreleased ID', artist: 'Chris Stussy', label: '', year: 2024, is_unreleased: true },
  { title: 'Rotterdam ID', artist: 'Chris Stussy', label: '', year: 2024, is_unreleased: true },
  { title: 'Night Drive ID', artist: 'Chris Stussy', label: '', year: 2024, is_unreleased: true },
  { title: 'Berghain Intro ID', artist: 'Ben Klock', label: '', year: 2024, is_unreleased: true },
  { title: 'Closing Track ID', artist: 'Ben Klock', label: '', year: 2024, is_unreleased: true },
  { title: 'Afterlife ID 001', artist: 'Tale Of Us', label: '', year: 2024, is_unreleased: true },
  { title: 'Afterlife ID 002', artist: 'Tale Of Us', label: '', year: 2024, is_unreleased: true },
  { title: 'Mayan Warrior ID', artist: 'Damian Lazarus', label: '', year: 2024, is_unreleased: true },
  { title: 'Robot Heart ID', artist: '&ME', label: '', year: 2024, is_unreleased: true },
  { title: 'Burning Man ID', artist: 'Keinemusik', label: '', year: 2024, is_unreleased: true },
  { title: 'Defected ID', artist: 'John Summit', label: '', year: 2024, is_unreleased: true },
  { title: 'Ibiza Closing ID', artist: 'Fisher', label: '', year: 2024, is_unreleased: true },
  { title: 'Movement ID', artist: 'Dixon', label: '', year: 2024, is_unreleased: true },
  { title: 'DC10 ID', artist: 'Hot Since 82', label: '', year: 2024, is_unreleased: true },
  { title: 'Hi Ibiza ID', artist: 'Black Coffee', label: '', year: 2024, is_unreleased: true },
  { title: 'Warung ID', artist: 'Maceo Plex', label: '', year: 2024, is_unreleased: true },
  { title: 'Awakenings ID', artist: 'Artbat', label: '', year: 2024, is_unreleased: true },
  { title: 'Fabric ID', artist: 'Overmono', label: '', year: 2024, is_unreleased: true },
  { title: 'Printworks ID', artist: 'Four Tet', label: '', year: 2024, is_unreleased: true },
  { title: 'Coachella ID', artist: 'Dom Dolla', label: '', year: 2024, is_unreleased: true },
];

async function seedTracks() {
  console.log('🎵 Starting large track seed...\n');
  
  let created = 0;
  let skipped = 0;
  let unreleased = 0;
  const labelCounts: Record<string, number> = {};

  for (const track of tracks) {
    const titleNormalized = normalizeText(track.title);
    const artistNormalized = normalizeText(track.artist);
    
    // Get artist ID if exists
    const artistId = await getArtistId(track.artist);
    
    // Count labels
    if (track.label) {
      labelCounts[track.label] = (labelCounts[track.label] || 0) + 1;
    }
    
    // Check if track already exists
    const { data: existing } = await supabase
      .from('tracks')
      .select('id')
      .eq('title_normalized', titleNormalized)
      .eq('artist_name', track.artist)
      .single();

    if (existing) {
      skipped++;
      continue;
    }
    
    // Insert track
    const { data, error } = await supabase
      .from('tracks')
      .insert({
        title: track.title,
        title_normalized: titleNormalized,
        artist_id: artistId,
        artist_name: track.artist,
        label: track.label || null,
        release_year: track.year,
        is_unreleased: track.is_unreleased || false,
        times_played: 0,
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating "${track.title}":`, error.message);
    } else {
      created++;
      if (track.is_unreleased) unreleased++;
    }
  }

  console.log(`\n✅ Created ${created} tracks (${skipped} already existed)`);
  console.log(`🔒 Including ${unreleased} unreleased/ID tracks`);
  console.log('\n📀 Top Labels:');
  
  const sortedLabels = Object.entries(labelCounts)
    .filter(([label]) => label)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  for (const [label, count] of sortedLabels) {
    console.log(`   ${label}: ${count}`);
  }
  
  console.log('\n🎵 Track seed complete!');
}

seedTracks().catch(console.error);
