const { createClient } = require('@supabase/supabase-js');

/**
 * Canonical venue database - maps variations to standard venue names with locations
 */
const VENUE_DATABASE = {
  // Ibiza
  'ushuaia': { name: 'Ushuaïa', location: 'Ibiza, Spain', aliases: ['ushuaïa', 'ushuaia ibiza'] },
  'hi ibiza': { name: 'Hï Ibiza', location: 'Ibiza, Spain', aliases: ['hï ibiza', 'hi-ibiza'] },
  'pacha': { name: 'Pacha', location: 'Ibiza, Spain', aliases: ['pacha ibiza', 'destino pacha'] },
  'amnesia': { name: 'Amnesia', location: 'Ibiza, Spain', aliases: ['amnesia ibiza'] },
  'dc10': { name: 'DC-10', location: 'Ibiza, Spain', aliases: ['dc-10', 'dc 10'] },
  'privilege': { name: 'Privilege', location: 'Ibiza, Spain', aliases: ['privilege ibiza'] },

  // Berlin
  'berghain': { name: 'Berghain', location: 'Berlin, Germany', aliases: ['berghain berlin'] },
  'tresor': { name: 'Tresor', location: 'Berlin, Germany', aliases: ['tresor berlin'] },
  'watergate': { name: 'Watergate', location: 'Berlin, Germany', aliases: [] },

  // London/UK
  'fabric': { name: 'Fabric', location: 'London, UK', aliases: ['fabric london'] },
  'printworks': { name: 'Printworks', location: 'London, UK', aliases: ['printworks london'] },
  'warehouse project': { name: 'The Warehouse Project', location: 'Manchester, UK', aliases: ['twp', 'whp'] },
  'depot': { name: 'Depot', location: 'UK', aliases: ['depot mayfield'] },
  'motion': { name: 'Motion', location: 'Bristol, UK', aliases: [] },

  // New York
  'brooklyn mirage': { name: 'Brooklyn Mirage', location: 'New York, USA', aliases: ['the brooklyn mirage', 'mirage'] },
  'avant gardner': { name: 'Avant Gardner', location: 'New York, USA', aliases: ['avant gardener'] },
  'output': { name: 'Output', location: 'Brooklyn, USA', aliases: ['output brooklyn'] },
  'nowadays': { name: 'Nowadays', location: 'New York, USA', aliases: [] },
  'hudson river': { name: 'Hudson River', location: 'New York, USA', aliases: ['hudson'] },

  // Miami
  'space miami': { name: 'Club Space', location: 'Miami, USA', aliases: ['club space', 'space'] },
  'e11even': { name: 'E11EVEN', location: 'Miami, USA', aliases: ['eleven', 'e11even miami'] },

  // LA
  'exchange la': { name: 'Exchange LA', location: 'Los Angeles, USA', aliases: ['exchange'] },
  'sound nightclub': { name: 'Sound Nightclub', location: 'Los Angeles, USA', aliases: ['sound la'] },

  // Amsterdam
  'de school': { name: 'De School', location: 'Amsterdam, Netherlands', aliases: [] },
  'shelter': { name: 'Shelter', location: 'Amsterdam, Netherlands', aliases: ['shelter amsterdam'] },

  // Festivals
  'tomorrowland': { name: 'Tomorrowland', location: 'Belgium', aliases: ['tomorrowland belgium'] },
  'coachella': { name: 'Coachella', location: 'California, USA', aliases: ['coachella festival', 'yuma'] },
  'awakenings': { name: 'Awakenings', location: 'Amsterdam, Netherlands', aliases: ['awakenings festival'] },
  'time warp': { name: 'Time Warp', location: 'Germany', aliases: ['timewarp'] },
  'movement': { name: 'Movement', location: 'Detroit, USA', aliases: ['movement detroit', 'demf'] },
  'ultra': { name: 'Ultra Music Festival', location: 'Miami, USA', aliases: ['ultra miami', 'umf'] },
  'edc': { name: 'EDC', location: 'Las Vegas, USA', aliases: ['electric daisy carnival', 'edc vegas', 'edc las vegas'] },
  'creamfields': { name: 'Creamfields', location: 'UK', aliases: ['creamfields uk'] },
  'mysteryland': { name: 'Mysteryland', location: 'Netherlands', aliases: [] },
  'sonar': { name: 'Sónar', location: 'Barcelona, Spain', aliases: ['sonar barcelona', 'sonar festival'] },
  'bpm festival': { name: 'BPM Festival', location: 'Various', aliases: ['bpm'] },

  // Radio/Online
  'bbc radio 1': { name: 'BBC Radio 1', location: 'UK', aliases: ['radio 1', 'bbc r1', 'radio one', 'radio 1 dance'] },
  'essential mix': { name: 'Essential Mix', location: 'BBC Radio 1', aliases: [] },
  'boiler room': { name: 'Boiler Room', location: 'Various', aliases: ['br'] },
  'cercle': { name: 'Cercle', location: 'Various', aliases: [] },
  'resident advisor': { name: 'Resident Advisor', location: 'Various', aliases: ['ra'] },

  // Events/Brands
  'circoloco': { name: 'Circoloco', location: 'Various', aliases: ['circo loco'] },
  'defected': { name: 'Defected', location: 'Various', aliases: ['defected records'] },
  'drumcode': { name: 'Drumcode', location: 'Various', aliases: ['drum code'] },
  'afterlife': { name: 'Afterlife', location: 'Various', aliases: [] },
  'ants': { name: 'ANTS', location: 'Ushuaïa Ibiza', aliases: ['ants ibiza', 'ants metalworks'] },
  'resistance': { name: 'Resistance', location: 'Various', aliases: ['ultra resistance'] },
  'elrow': { name: 'elrow', location: 'Various', aliases: ['el row'] },
  'music on': { name: 'Music On', location: 'Various', aliases: ['musicon'] },
  'raw cuts': { name: 'Raw Cuts', location: 'Various', aliases: [] },
  'teksupport': { name: 'Teksupport', location: 'New York, USA', aliases: ['tek support'] },
};

// Countries and states to strip from set names
const COUNTRIES_AND_STATES = [
  'usa', 'united states', 'uk', 'united kingdom', 'spain', 'germany', 'netherlands',
  'belgium', 'france', 'italy', 'portugal', 'croatia', 'mexico', 'brazil', 'australia',
  'japan', 'china', 'canada', 'argentina', 'colombia', 'chile', 'peru',
  'california', 'new york', 'florida', 'texas', 'nevada', 'colorado', 'arizona',
  'illinois', 'michigan', 'georgia', 'massachusetts', 'washington', 'oregon'
];

/**
 * Parse set info from the original full name
 */
function parseSetInfo(originalName) {
  if (!originalName) return { name: originalName, venue: null, location: null };

  const result = {
    name: originalName,
    venue: null,
    location: null,
  };

  const lowerName = originalName.toLowerCase();

  // Step 1: Check for known venues in the VENUE_DATABASE
  for (const [key, data] of Object.entries(VENUE_DATABASE)) {
    const allTerms = [key, ...data.aliases];
    for (const term of allTerms) {
      if (lowerName.includes(term)) {
        result.venue = data.name;
        result.location = data.location;
        break;
      }
    }
    if (result.venue) break;
  }

  // Step 2: Parse comma-separated parts
  const commaParts = originalName.split(/[,]/);

  if (commaParts.length >= 2) {
    const lastPart = commaParts[commaParts.length - 1].trim();
    const lastPartLower = lastPart.toLowerCase();

    // Check if last part is a country/state
    const isCountryOrState = COUNTRIES_AND_STATES.some(cs =>
      lastPartLower === cs || lastPartLower.includes(cs)
    );

    if (isCountryOrState) {
      if (!result.location) {
        result.location = lastPart;
      }

      if (commaParts.length > 2) {
        const secondLastPart = commaParts[commaParts.length - 2].trim();
        // Check if this is a venue
        for (const [key, data] of Object.entries(VENUE_DATABASE)) {
          if (secondLastPart.toLowerCase().includes(key)) {
            if (!result.venue) result.venue = data.name;
            if (!result.location || result.location === lastPart) result.location = data.location;
            break;
          }
        }
        result.name = commaParts.slice(0, -2).join(', ').trim();
      } else {
        result.name = commaParts.slice(0, -1).join(', ').trim();
      }
    } else {
      // Check if last part is a city that should be location
      const cityLocations = ['ibiza', 'berlin', 'london', 'amsterdam', 'new york', 'nyc', 'miami', 'los angeles', 'brooklyn'];
      const isCity = cityLocations.some(city => lastPartLower.includes(city));

      if (isCity && !result.location) {
        result.location = lastPart;
        result.name = commaParts.slice(0, -1).join(', ').trim();
      }
    }
  }

  // Step 3: Remove date patterns from name (e.g., "2025-08-02")
  result.name = result.name.replace(/\s*\d{4}-\d{2}-\d{2}\s*/g, '').trim();

  // Step 4: Clean up parentheses with just venue/location info
  if (result.venue && result.location) {
    // Remove redundant venue/location in parentheses
    const parenPattern = new RegExp(`\\s*\\([^)]*${result.venue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)`, 'gi');
    result.name = result.name.replace(parenPattern, '').trim();
  }

  // Step 5: Remove trailing country/state from name
  for (const cs of COUNTRIES_AND_STATES) {
    result.name = result.name.replace(new RegExp(`[,\\s]+${cs}[,\\s]*$`, 'gi'), '').trim();
  }

  // Step 6: Clean up extra commas, spaces, parentheses
  result.name = result.name
    .replace(/\(\s*\)/g, '') // Empty parentheses
    .replace(/,\s*,/g, ',') // Double commas
    .replace(/^[,\s]+|[,\s]+$/g, '') // Leading/trailing
    .replace(/\s+/g, ' ') // Multiple spaces
    .trim();

  // If name is empty after all that, use original
  if (!result.name || result.name.length < 3) {
    result.name = originalName;
  }

  return result;
}

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch all sets (database uses 'title' not 'name')
    const { data: sets, error: fetchError } = await supabase
      .from('sets')
      .select('id, title, venue, dj_name')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[Migration] Found ${sets.length} sets to process`);

    const results = {
      total: sets.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const set of sets) {
      try {
        // Parse the original title
        const parsed = parseSetInfo(set.title);

        // Check if anything changed
        const hasChanges =
          parsed.name !== set.title ||
          (parsed.venue && parsed.venue !== set.venue);

        if (!hasChanges) {
          results.skipped++;
          continue;
        }

        // Update the set (database uses 'title' not 'name')
        const updateData = {
          title: parsed.name,
        };

        // Only update venue if we found it and it's not already set
        if (parsed.venue && !set.venue) {
          updateData.venue = parsed.venue;
        }

        const { error: updateError } = await supabase
          .from('sets')
          .update(updateData)
          .eq('id', set.id);

        if (updateError) {
          console.error(`[Migration] Error updating set ${set.id}:`, updateError.message);
          results.errors++;
          results.details.push({
            id: set.id,
            original: set.title,
            error: updateError.message,
          });
        } else {
          results.updated++;
          results.details.push({
            id: set.id,
            original: set.title,
            newTitle: parsed.name,
            venue: parsed.venue,
          });
          console.log(`[Migration] Updated: "${set.title}" -> "${parsed.name}" | Venue: ${parsed.venue}`);
        }
      } catch (err) {
        console.error(`[Migration] Error processing set ${set.id}:`, err.message);
        results.errors++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Migration complete. Updated ${results.updated}/${results.total} sets.`,
      results,
    });
  } catch (error) {
    console.error('[Migration] Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
