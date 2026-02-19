/**
 * Canonical venue normalization — maps common variations to a single canonical name.
 * Used client-side in browse/filter UIs and server-side in cleanup scripts.
 *
 * Key format: lowercase alias → canonical name
 */
const VENUE_ALIAS_MAP: Record<string, string> = {
  // Ibiza
  'ushuaia': 'Ushuaïa',
  'ushuaïa': 'Ushuaïa',
  'ushuaia ibiza': 'Ushuaïa',
  'ushuaïa ibiza': 'Ushuaïa',
  'hi ibiza': 'Hï Ibiza',
  'hï ibiza': 'Hï Ibiza',
  'hi-ibiza': 'Hï Ibiza',
  'pacha': 'Pacha',
  'pacha ibiza': 'Pacha',
  'amnesia': 'Amnesia',
  'amnesia ibiza': 'Amnesia',
  'dc10': 'DC-10',
  'dc-10': 'DC-10',
  'dc 10': 'DC-10',
  'dc-10 ibiza': 'DC-10',
  'privilege': 'Privilege',
  'privilege ibiza': 'Privilege',
  'eden': 'Eden',
  'eden ibiza': 'Eden',

  // Berlin
  'berghain': 'Berghain',
  'berghain berlin': 'Berghain',
  'tresor': 'Tresor',
  'tresor berlin': 'Tresor',
  'watergate': 'Watergate',
  'watergate berlin': 'Watergate',

  // London/UK
  'fabric': 'Fabric',
  'fabric london': 'Fabric',
  'printworks': 'Printworks',
  'printworks london': 'Printworks',
  'warehouse project': 'The Warehouse Project',
  'the warehouse project': 'The Warehouse Project',
  'twp': 'The Warehouse Project',
  'whp': 'The Warehouse Project',
  'depot': 'Depot',
  'depot mayfield': 'Depot',
  'motion': 'Motion',
  'motion bristol': 'Motion',
  'xoyo': 'XOYO',
  'xoyo london': 'XOYO',
  'e1': 'E1 London',
  'e1 london': 'E1 London',
  'studio spaces': 'E1 London',
  'fuse': 'FUSE',
  'fuse london': 'FUSE',

  // New York
  'brooklyn mirage': 'Brooklyn Mirage',
  'the brooklyn mirage': 'Brooklyn Mirage',
  'mirage': 'Brooklyn Mirage',
  'avant gardner': 'Avant Gardner',
  'avant gardener': 'Avant Gardner',
  'output': 'Output',
  'output brooklyn': 'Output',
  'nowadays': 'Nowadays',
  'elsewhere': 'Elsewhere',
  'elsewhere brooklyn': 'Elsewhere',
  'good room': 'Good Room',
  'goodroom': 'Good Room',
  'knockdown center': 'Knockdown Center',
  'knockdown': 'Knockdown Center',
  'the lot radio': 'The Lot Radio',
  'lot radio': 'The Lot Radio',

  // NYC Event Series
  'raw cuts': 'Raw Cuts',
  'rawcuts': 'Raw Cuts',
  'raw cuts nyc': 'Raw Cuts',
  'teksupport': 'Teksupport',
  'tek support': 'Teksupport',
  'teksupport nyc': 'Teksupport',
  'cityfox': 'Cityfox',
  'the cityfox': 'Cityfox',
  'cityfox experience': 'Cityfox',
  'mister saturday night': 'Mister Saturday Night',
  'mister sunday': 'Mister Saturday Night',

  // Chicago
  'navy pier': 'Navy Pier',
  'navypier': 'Navy Pier',
  'spybar': 'Spybar',
  'spy bar': 'Spybar',
  'sound-bar': 'Sound-Bar',
  'soundbar chicago': 'Sound-Bar',
  'prysm': 'Prysm',
  'prysm nightclub': 'Prysm',
  'radius': 'Radius Chicago',
  'radius chicago': 'Radius Chicago',
  'smartbar': 'Smartbar',
  'smart bar': 'Smartbar',
  'primary': 'Primary',
  'primary chicago': 'Primary',

  // Miami
  'space miami': 'Club Space',
  'club space': 'Club Space',
  'space': 'Club Space',
  'space terrace': 'Club Space',
  'e11even': 'E11EVEN',
  'eleven': 'E11EVEN',
  'e11even miami': 'E11EVEN',
  'do not sit': 'Do Not Sit On The Furniture',
  'do not sit on the furniture': 'Do Not Sit On The Furniture',
  'dnsotf': 'Do Not Sit On The Furniture',
  'treehouse': 'Treehouse Miami',
  'treehouse miami': 'Treehouse Miami',

  // LA
  'exchange la': 'Exchange LA',
  'exchange': 'Exchange LA',
  'sound nightclub': 'Sound Nightclub',
  'sound la': 'Sound Nightclub',
  'sound nightclub la': 'Sound Nightclub',
  'factory 93': 'Factory 93',
  'factory93': 'Factory 93',
  'incognito': 'Incognito',
  'incognito la': 'Incognito',

  // Amsterdam
  'de school': 'De School',
  'shelter': 'Shelter',
  'shelter amsterdam': 'Shelter',

  // Festivals
  'tomorrowland': 'Tomorrowland',
  'tomorrowland belgium': 'Tomorrowland',
  'coachella': 'Coachella',
  'coachella festival': 'Coachella',
  'awakenings': 'Awakenings',
  'awakenings festival': 'Awakenings',
  'time warp': 'Time Warp',
  'timewarp': 'Time Warp',
  'movement': 'Movement',
  'movement detroit': 'Movement',
  'demf': 'Movement',
  'ultra': 'Ultra Music Festival',
  'ultra miami': 'Ultra Music Festival',
  'umf': 'Ultra Music Festival',
  'ultra music festival': 'Ultra Music Festival',
  'edc': 'EDC',
  'electric daisy carnival': 'EDC',
  'edc vegas': 'EDC',
  'edc las vegas': 'EDC',
  'creamfields': 'Creamfields',
  'creamfields uk': 'Creamfields',
  'mysteryland': 'Mysteryland',
  'sonar': 'Sónar',
  'sónar': 'Sónar',
  'sonar barcelona': 'Sónar',
  'sonar festival': 'Sónar',
  'bpm festival': 'BPM Festival',
  'bpm': 'BPM Festival',
  'burning man': 'Burning Man',
  'burningman': 'Burning Man',
  'playa': 'Burning Man',
  'black rock city': 'Burning Man',
  'robot heart': 'Burning Man',
  'mayan warrior': 'Burning Man',
  'lollapalooza': 'Lollapalooza',
  'lolla': 'Lollapalooza',
  'lollapalooza chicago': 'Lollapalooza',
  'electric forest': 'Electric Forest',
  'e forest': 'Electric Forest',
  'lightning in a bottle': 'Lightning in a Bottle',
  'lib': 'Lightning in a Bottle',
  'lightning bottle': 'Lightning in a Bottle',
  'outsidelands': 'Outside Lands',
  'outside lands': 'Outside Lands',
  'osl': 'Outside Lands',
  'holy ship': 'Holy Ship!',
  'holyship': 'Holy Ship!',
  'shambhala': 'Shambhala',
  'day zero': 'Day Zero',
  'dayzero': 'Day Zero',
  'zamna': 'Zamna',
  'zamna tulum': 'Zamna',

  // Radio/Online
  'bbc radio 1': 'BBC Radio 1',
  'radio 1': 'BBC Radio 1',
  'bbc r1': 'BBC Radio 1',
  'radio one': 'BBC Radio 1',
  'essential mix': 'Essential Mix',
  'boiler room': 'Boiler Room',
  'br': 'Boiler Room',
  'cercle': 'Cercle',
  'resident advisor': 'Resident Advisor',
  'ra': 'Resident Advisor',

  // Events/Brands
  'circoloco': 'Circoloco',
  'circo loco': 'Circoloco',
  'defected': 'Defected',
  'defected records': 'Defected',
  'drumcode': 'Drumcode',
  'drum code': 'Drumcode',
  'afterlife': 'Afterlife',
  'ants': 'ANTS',
  'ants ibiza': 'ANTS',
  'resistance': 'Resistance',
  'ultra resistance': 'Resistance',
  'elrow': 'elrow',
  'el row': 'elrow',
  'music on': 'Music On',
  'musicon': 'Music On',
  'paradise': 'Paradise',
  'paradise ibiza': 'Paradise',
  'solid grooves': 'Solid Grooves',
  'solidgrooves': 'Solid Grooves',
  'keinemusik': 'Keinemusik',
  'keine musik': 'Keinemusik',
  'hyte': 'HYTE',
  'hyte ibiza': 'HYTE',
  'hyte berlin': 'HYTE',
  'toolroom': 'Toolroom',
  'toolroom records': 'Toolroom',
  'dirtybird': 'Dirtybird',
  'dirty bird': 'Dirtybird',
  'dirtybird campout': 'Dirtybird',
  'hot creations': 'Hot Creations',
  'hotcreations': 'Hot Creations',

  // Radio Shows / Event Series
  'house calls': 'House Calls',
  'housecalls': 'House Calls',
  'obskur': 'Obskür',
  'obskür': 'Obskür',
  'obskur music': 'Obskür',
};

/**
 * Normalize a venue name to its canonical form.
 * Returns the canonical name if found, otherwise returns the original trimmed.
 */
export function normalizeVenueName(venueName: string): string {
  if (!venueName) return venueName;

  const trimmed = venueName.trim();
  const lower = trimmed.toLowerCase();

  // Exact match in alias map
  if (VENUE_ALIAS_MAP[lower]) {
    return VENUE_ALIAS_MAP[lower];
  }

  // Substring match — check if the venue name contains a known alias
  // Sort keys by length descending to match the most specific alias first
  const sortedKeys = Object.keys(VENUE_ALIAS_MAP).sort((a, b) => b.length - a.length);
  for (const alias of sortedKeys) {
    if (alias.length >= 4 && lower.includes(alias)) {
      return VENUE_ALIAS_MAP[alias];
    }
  }

  return trimmed;
}

/**
 * Normalize an artist/DJ name for deduplication.
 * - Trims whitespace
 * - Normalizes "b2b" variations to "B2B"
 * - Collapses multiple spaces
 * - Preserves original casing otherwise (artist names are proper nouns)
 */
export function normalizeArtistName(artistName: string): string {
  if (!artistName) return artistName;

  let normalized = artistName.trim();

  // Collapse multiple spaces
  normalized = normalized.replace(/\s{2,}/g, ' ');

  // Normalize b2b variations: "b2b", "B2b", "b2B" → "B2B"
  normalized = normalized.replace(/\bb2b\b/gi, 'B2B');

  // Remove trailing/leading special characters that aren't part of the name
  normalized = normalized.replace(/^[\s,.\-|]+|[\s,.\-|]+$/g, '');

  return normalized;
}

/**
 * Get the canonical venue name for database matching.
 * When querying getVenueSets(), we need to match all variations.
 * This returns all known aliases for a canonical venue name.
 */
export function getVenueAliases(canonicalName: string): string[] {
  const aliases: string[] = [canonicalName];
  const lowerCanonical = canonicalName.toLowerCase();

  for (const [alias, canonical] of Object.entries(VENUE_ALIAS_MAP)) {
    if (canonical.toLowerCase() === lowerCanonical) {
      aliases.push(alias);
    }
  }

  return [...new Set(aliases)];
}
