// API endpoint to normalize venue names, artist names, and deduplicate data in the database
import { createClient } from '@supabase/supabase-js';

// Use service role key for write operations
function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// ============================================
// Canonical venue database (same as import.js)
// ============================================
const VENUE_ALIAS_MAP = {
  // Ibiza
  'ushuaia': 'Ushuaïa', 'ushuaïa': 'Ushuaïa', 'ushuaia ibiza': 'Ushuaïa', 'ushuaïa ibiza': 'Ushuaïa',
  'hi ibiza': 'Hï Ibiza', 'hï ibiza': 'Hï Ibiza', 'hi-ibiza': 'Hï Ibiza',
  'pacha': 'Pacha', 'pacha ibiza': 'Pacha',
  'amnesia': 'Amnesia', 'amnesia ibiza': 'Amnesia',
  'dc10': 'DC-10', 'dc-10': 'DC-10', 'dc 10': 'DC-10', 'dc-10 ibiza': 'DC-10',
  'privilege': 'Privilege', 'privilege ibiza': 'Privilege',
  'eden': 'Eden', 'eden ibiza': 'Eden',

  // Berlin
  'berghain': 'Berghain', 'berghain berlin': 'Berghain',
  'tresor': 'Tresor', 'tresor berlin': 'Tresor',
  'watergate': 'Watergate', 'watergate berlin': 'Watergate',

  // London/UK
  'fabric': 'Fabric', 'fabric london': 'Fabric',
  'printworks': 'Printworks', 'printworks london': 'Printworks',
  'warehouse project': 'The Warehouse Project', 'the warehouse project': 'The Warehouse Project', 'twp': 'The Warehouse Project', 'whp': 'The Warehouse Project',
  'depot': 'Depot', 'depot mayfield': 'Depot',
  'motion': 'Motion', 'motion bristol': 'Motion',
  'xoyo': 'XOYO', 'xoyo london': 'XOYO',
  'e1': 'E1 London', 'e1 london': 'E1 London', 'studio spaces': 'E1 London',
  'fuse': 'FUSE', 'fuse london': 'FUSE',

  // New York
  'brooklyn mirage': 'Brooklyn Mirage', 'the brooklyn mirage': 'Brooklyn Mirage', 'mirage': 'Brooklyn Mirage',
  'avant gardner': 'Avant Gardner', 'avant gardener': 'Avant Gardner',
  'output': 'Output', 'output brooklyn': 'Output',
  'nowadays': 'Nowadays',
  'elsewhere': 'Elsewhere', 'elsewhere brooklyn': 'Elsewhere',
  'good room': 'Good Room', 'goodroom': 'Good Room',
  'knockdown center': 'Knockdown Center', 'knockdown': 'Knockdown Center',
  'the lot radio': 'The Lot Radio', 'lot radio': 'The Lot Radio',
  'raw cuts': 'Raw Cuts', 'rawcuts': 'Raw Cuts', 'raw cuts nyc': 'Raw Cuts',
  'teksupport': 'Teksupport', 'tek support': 'Teksupport', 'teksupport nyc': 'Teksupport',
  'cityfox': 'Cityfox', 'the cityfox': 'Cityfox', 'cityfox experience': 'Cityfox',

  // Chicago
  'smartbar': 'Smartbar', 'smart bar': 'Smartbar',
  'spybar': 'Spybar', 'spy bar': 'Spybar',
  'sound-bar': 'Sound-Bar', 'soundbar chicago': 'Sound-Bar',
  'radius': 'Radius Chicago', 'radius chicago': 'Radius Chicago',

  // Miami
  'space miami': 'Club Space', 'club space': 'Club Space', 'space terrace': 'Club Space',
  'e11even': 'E11EVEN', 'eleven': 'E11EVEN', 'e11even miami': 'E11EVEN',
  'do not sit': 'Do Not Sit On The Furniture', 'do not sit on the furniture': 'Do Not Sit On The Furniture', 'dnsotf': 'Do Not Sit On The Furniture',
  'treehouse': 'Treehouse Miami', 'treehouse miami': 'Treehouse Miami',

  // LA
  'exchange la': 'Exchange LA', 'exchange': 'Exchange LA',
  'sound nightclub': 'Sound Nightclub', 'sound la': 'Sound Nightclub', 'sound nightclub la': 'Sound Nightclub',
  'factory 93': 'Factory 93', 'factory93': 'Factory 93',
  'incognito': 'Incognito', 'incognito la': 'Incognito',

  // Amsterdam
  'de school': 'De School',
  'shelter': 'Shelter', 'shelter amsterdam': 'Shelter',

  // Festivals
  'tomorrowland': 'Tomorrowland', 'tomorrowland belgium': 'Tomorrowland',
  'coachella': 'Coachella', 'coachella festival': 'Coachella',
  'awakenings': 'Awakenings', 'awakenings festival': 'Awakenings',
  'time warp': 'Time Warp', 'timewarp': 'Time Warp',
  'movement': 'Movement', 'movement detroit': 'Movement', 'demf': 'Movement',
  'ultra': 'Ultra Music Festival', 'ultra miami': 'Ultra Music Festival', 'umf': 'Ultra Music Festival', 'ultra music festival': 'Ultra Music Festival',
  'edc': 'EDC', 'electric daisy carnival': 'EDC', 'edc vegas': 'EDC', 'edc las vegas': 'EDC',
  'creamfields': 'Creamfields', 'creamfields uk': 'Creamfields',
  'mysteryland': 'Mysteryland',
  'sonar': 'Sónar', 'sónar': 'Sónar', 'sonar barcelona': 'Sónar', 'sonar festival': 'Sónar',
  'bpm festival': 'BPM Festival', 'bpm': 'BPM Festival',
  'burning man': 'Burning Man', 'burningman': 'Burning Man', 'robot heart': 'Burning Man', 'mayan warrior': 'Burning Man',
  'lollapalooza': 'Lollapalooza', 'lolla': 'Lollapalooza', 'lollapalooza chicago': 'Lollapalooza',
  'electric forest': 'Electric Forest', 'e forest': 'Electric Forest',
  'lightning in a bottle': 'Lightning in a Bottle', 'lib': 'Lightning in a Bottle',
  'outsidelands': 'Outside Lands', 'outside lands': 'Outside Lands', 'osl': 'Outside Lands',
  'holy ship': 'Holy Ship!', 'holyship': 'Holy Ship!',
  'shambhala': 'Shambhala',
  'day zero': 'Day Zero', 'dayzero': 'Day Zero',
  'zamna': 'Zamna', 'zamna tulum': 'Zamna',

  // Radio/Online
  'bbc radio 1': 'BBC Radio 1', 'radio 1': 'BBC Radio 1', 'bbc r1': 'BBC Radio 1', 'radio one': 'BBC Radio 1',
  'essential mix': 'Essential Mix',
  'boiler room': 'Boiler Room',
  'cercle': 'Cercle',
  'resident advisor': 'Resident Advisor',

  // Events/Brands
  'circoloco': 'Circoloco', 'circo loco': 'Circoloco',
  'defected': 'Defected', 'defected records': 'Defected',
  'drumcode': 'Drumcode', 'drum code': 'Drumcode',
  'afterlife': 'Afterlife',
  'ants': 'ANTS', 'ants ibiza': 'ANTS',
  'resistance': 'Resistance', 'ultra resistance': 'Resistance',
  'elrow': 'elrow', 'el row': 'elrow',
  'music on': 'Music On', 'musicon': 'Music On',
  'paradise': 'Paradise', 'paradise ibiza': 'Paradise',
  'solid grooves': 'Solid Grooves', 'solidgrooves': 'Solid Grooves',
  'keinemusik': 'Keinemusik', 'keine musik': 'Keinemusik',
  'hyte': 'HYTE', 'hyte ibiza': 'HYTE', 'hyte berlin': 'HYTE',
  'toolroom': 'Toolroom', 'toolroom records': 'Toolroom',
  'dirtybird': 'Dirtybird', 'dirty bird': 'Dirtybird', 'dirtybird campout': 'Dirtybird',
  'hot creations': 'Hot Creations', 'hotcreations': 'Hot Creations',
  'house calls': 'House Calls', 'housecalls': 'House Calls',
  'obskur': 'Obskür', 'obskür': 'Obskür', 'obskur music': 'Obskür',
};

function normalizeVenueName(venueName) {
  if (!venueName) return venueName;
  const trimmed = venueName.trim();
  const lower = trimmed.toLowerCase();

  // Exact match
  if (VENUE_ALIAS_MAP[lower]) return VENUE_ALIAS_MAP[lower];

  // Substring match — longest alias first
  const sortedKeys = Object.keys(VENUE_ALIAS_MAP).sort((a, b) => b.length - a.length);
  for (const alias of sortedKeys) {
    if (alias.length >= 4 && lower.includes(alias)) {
      return VENUE_ALIAS_MAP[alias];
    }
  }

  return trimmed;
}

function normalizeArtistName(artistName) {
  if (!artistName) return artistName;
  let normalized = artistName.trim();
  normalized = normalized.replace(/\s{2,}/g, ' ');
  normalized = normalized.replace(/\bb2b\b/gi, 'B2B');
  normalized = normalized.replace(/^[\s,.\-|]+|[\s,.\-|]+$/g, '');
  return normalized;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ready',
      description: 'POST to normalize venue names, artist names, and deduplicate data.',
      actions: ['normalize-venues', 'normalize-artists', 'normalize-tracks', 'all'],
      usage: 'POST with { "action": "all" } or { "action": "normalize-venues", "dryRun": true }',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { action = 'all', dryRun = false } = req.body || {};
    const results = {};

    // ========== NORMALIZE VENUES ==========
    if (action === 'normalize-venues' || action === 'all') {
      const { data: sets, error } = await supabase
        .from('sets')
        .select('id, venue')
        .not('venue', 'is', null)
        .neq('venue', '');

      if (error) throw error;

      const venueChanges = [];
      for (const set of sets || []) {
        const normalized = normalizeVenueName(set.venue);
        if (normalized !== set.venue) {
          venueChanges.push({ id: set.id, old: set.venue, new: normalized });
        }
      }

      if (!dryRun && venueChanges.length > 0) {
        for (const change of venueChanges) {
          await supabase
            .from('sets')
            .update({ venue: change.new })
            .eq('id', change.id);
        }
      }

      results.venues = {
        total: (sets || []).length,
        changed: venueChanges.length,
        dryRun,
        changes: venueChanges.slice(0, 50), // Show first 50
      };
    }

    // ========== NORMALIZE ARTISTS ==========
    if (action === 'normalize-artists' || action === 'all') {
      const { data: sets, error } = await supabase
        .from('sets')
        .select('id, dj_name')
        .not('dj_name', 'is', null)
        .neq('dj_name', '');

      if (error) throw error;

      const artistChanges = [];
      for (const set of sets || []) {
        const normalized = normalizeArtistName(set.dj_name);
        if (normalized !== set.dj_name) {
          artistChanges.push({ id: set.id, old: set.dj_name, new: normalized });
        }
      }

      if (!dryRun && artistChanges.length > 0) {
        for (const change of artistChanges) {
          await supabase
            .from('sets')
            .update({ dj_name: change.new })
            .eq('id', change.id);
        }
      }

      results.artists = {
        total: (sets || []).length,
        changed: artistChanges.length,
        dryRun,
        changes: artistChanges.slice(0, 50),
      };
    }

    // ========== NORMALIZE TRACK ARTISTS ==========
    if (action === 'normalize-tracks' || action === 'all') {
      const { data: tracks, error } = await supabase
        .from('set_tracks')
        .select('id, artist_name, track_title')
        .not('artist_name', 'is', null);

      if (error) throw error;

      const trackChanges = [];
      for (const track of tracks || []) {
        const normalizedArtist = normalizeArtistName(track.artist_name);
        const normalizedTitle = track.track_title ? track.track_title.trim().replace(/\s{2,}/g, ' ') : track.track_title;

        if (normalizedArtist !== track.artist_name || normalizedTitle !== track.track_title) {
          const update = {};
          if (normalizedArtist !== track.artist_name) update.artist_name = normalizedArtist;
          if (normalizedTitle !== track.track_title) update.track_title = normalizedTitle;

          trackChanges.push({
            id: track.id,
            oldArtist: track.artist_name,
            newArtist: normalizedArtist,
            oldTitle: track.track_title,
            newTitle: normalizedTitle,
            update,
          });
        }
      }

      if (!dryRun && trackChanges.length > 0) {
        for (const change of trackChanges) {
          await supabase
            .from('set_tracks')
            .update(change.update)
            .eq('id', change.id);
        }
      }

      results.tracks = {
        total: (tracks || []).length,
        changed: trackChanges.length,
        dryRun,
        changes: trackChanges.slice(0, 50),
      };
    }

    return res.status(200).json({
      success: true,
      dryRun,
      results,
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: error.message });
  }
}
