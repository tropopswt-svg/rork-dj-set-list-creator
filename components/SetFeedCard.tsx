import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Animated, Alert, Platform } from 'react-native';
import EventBadge, { detectEvent, EVENT_BADGES } from './EventBadge';
import { Image } from 'expo-image';
import { Play, Music, Youtube, Music2, AlertCircle, Calendar, MapPin, Star, X, User, HelpCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SetList } from '@/types';
import { getFallbackImage, getVenueImage } from '@/utils/coverImage';
import { BLURHASH } from '@/constants/colors';

interface SetFeedCardProps {
  setList: SetList;
  onPress?: () => void;
  onLongPress?: () => void;
  onArtistPress?: (artist: string) => void;
  onEventPress?: (eventId: string) => void;
  isSelected?: boolean; // Whether this card is the main/centered one in the scroll wheel
  accentOpacity?: Animated.AnimatedInterpolation<number>; // 0-1 opacity for white accent bar overlay
  solidness?: Animated.AnimatedInterpolation<number>; // 0 = liquid glass, 1 = solid dark
  fillProgress?: Animated.AnimatedInterpolation<number>; // 0-1 for liquid fill effect on chips
  fillDirection?: Animated.AnimatedInterpolation<number>; // 1 = fill up, -1 = drain down
}

// Festival/Event to actual geographic location mapping (for deduplication)
// When venue IS a festival, we show this as the location instead of repeating the festival name
const FESTIVAL_LOCATIONS: Record<string, string> = {
  // Major festivals with specific locations
  'Coachella': 'Indio, California',
  'Tomorrowland': 'Boom, Belgium',
  'Burning Man': 'Black Rock Desert, Nevada',
  'EDC': 'Las Vegas, Nevada',
  'EDC Las Vegas': 'Las Vegas, Nevada',
  'Ultra': 'Miami, Florida',
  'Ultra Music Festival': 'Miami, Florida',
  'Lollapalooza': 'Grant Park, Chicago',
  'Awakenings': 'Spaarnwoude, Netherlands',
  'Time Warp': 'Mannheim, Germany',
  'Dekmantel': 'Amsterdamse Bos, Netherlands',
  'Sónar': 'Barcelona, Spain',
  'Primavera Sound': 'Barcelona, Spain',
  'Movement': 'Hart Plaza, Detroit',
  'Movement Detroit': 'Hart Plaza, Detroit',
  'Exit Festival': 'Novi Sad, Serbia',
  'Electric Forest': 'Rothbury, Michigan',
  'Outside Lands': 'Golden Gate Park, San Francisco',
  'Lightning in a Bottle': 'Bakersfield, California',
  'CRSSD': 'Waterfront Park, San Diego',
  'III Points': 'Wynwood, Miami',
  'Shambhala': 'Salmo River Ranch, BC',
  'Day Zero': 'Tulum, Mexico',
  'BPM Festival': 'Costa Rica',
  'ADE': 'Amsterdam, Netherlands',
  'Creamfields': 'Daresbury, UK',
  // Ibiza clubs (venue IS the destination)
  'Ushuaïa': 'Playa d\'en Bossa, Ibiza',
  'Hï Ibiza': 'Playa d\'en Bossa, Ibiza',
  'Pacha': 'Ibiza Town, Ibiza',
  'Amnesia': 'San Rafael, Ibiza',
  'DC-10': 'Playa d\'en Bossa, Ibiza',
  'Privilege': 'San Rafael, Ibiza',
  // Berlin clubs
  'Berghain': 'Kreuzberg, Berlin',
  'Tresor': 'Mitte, Berlin',
  'Watergate': 'Kreuzberg, Berlin',
  // Burning Man camps/art cars
  'Robot Heart': 'Black Rock City, Nevada',
  'Mayan Warrior': 'Black Rock City, Nevada',
  'Camp Question Mark': 'Black Rock City, Nevada',
  // Coachella stages
  'Yuma': 'Indio, California',
  'Yuma Stage': 'Indio, California',
  'Yuma Tent': 'Indio, California',
  'Sahara': 'Indio, California',
  'Sahara Stage': 'Indio, California',
  'Gobi': 'Indio, California',
  'Gobi Stage': 'Indio, California',
  'Mojave': 'Indio, California',
  'Mojave Stage': 'Indio, California',
  'Do LaB': 'Indio, California',
  // Lollapalooza stages
  'Perry Stage': 'Grant Park, Chicago',
  'Perrys Stage': 'Grant Park, Chicago',
  // Radio shows/podcasts (use the broadcast origin as location)
  'BBC Radio 1': 'London, UK',
  'Essential Mix': 'London, UK',
  'Boiler Room': 'Various Locations',
  'Cercle': 'Various Locations',
  'Defected Radio': 'London, UK',
  'Drumcode Radio': 'Stockholm, Sweden',
  // Label parties (event-based, travels)
  'Circoloco': 'Various Locations',
  'Defected': 'Various Locations',
  'elrow': 'Various Locations',
};

// Venue to location mapping for deriving location from venue
const VENUE_LOCATIONS: Record<string, string> = {
  // Ibiza
  'Ushuaïa': 'Ibiza, Spain',
  'Hï Ibiza': 'Ibiza, Spain',
  'Pacha': 'Ibiza, Spain',
  'Amnesia': 'Ibiza, Spain',
  'DC-10': 'Ibiza, Spain',
  'Privilege': 'Ibiza, Spain',
  'ANTS': 'Ibiza, Spain',
  // Berlin
  'Berghain': 'Berlin, Germany',
  'Tresor': 'Berlin, Germany',
  'Watergate': 'Berlin, Germany',
  'Sisyphos': 'Berlin, Germany',
  'RSO': 'Berlin, Germany',
  'Kater Blau': 'Berlin, Germany',
  // London
  'Fabric': 'London, UK',
  'Printworks': 'London, UK',
  'Ministry of Sound': 'London, UK',
  'XOYO': 'London, UK',
  'E1': 'London, UK',
  // UK
  'The Warehouse Project': 'Manchester, UK',
  'Motion': 'Bristol, UK',
  'Creamfields': 'UK',
  // New York
  'Brooklyn Mirage': 'New York, USA',
  'Avant Gardner': 'New York, USA',
  'Nowadays': 'New York, USA',
  'Hudson River': 'New York, USA',
  'Teksupport': 'New York, USA',
  'Knockdown Center': 'New York, USA',
  'Elsewhere': 'New York, USA',
  // Miami
  'Club Space': 'Miami, USA',
  'E11EVEN': 'Miami, USA',
  'Ultra Music Festival': 'Miami, USA',
  'Ultra': 'Miami, USA',
  // Los Angeles
  'Exchange LA': 'Los Angeles, USA',
  'Sound Nightclub': 'Los Angeles, USA',
  'Academy LA': 'Los Angeles, USA',
  // Las Vegas
  'EDC': 'Las Vegas, USA',
  'EDC Las Vegas': 'Las Vegas, USA',
  // Coachella stages
  'Coachella': 'California, USA',
  'Yuma': 'Coachella, California',
  'Yuma Stage': 'Coachella, California',
  'Yuma Tent': 'Coachella, California',
  'Sahara': 'Coachella, California',
  'Sahara Stage': 'Coachella, California',
  'Gobi': 'Coachella, California',
  'Gobi Stage': 'Coachella, California',
  'Mojave': 'Coachella, California',
  'Mojave Stage': 'Coachella, California',
  'Do LaB': 'Coachella, California',
  // Amsterdam
  'De School': 'Amsterdam, Netherlands',
  'Shelter': 'Amsterdam, Netherlands',
  'Awakenings': 'Amsterdam, Netherlands',
  'Paradiso': 'Amsterdam, Netherlands',
  // Other festivals
  'Tomorrowland': 'Belgium',
  'Time Warp': 'Germany',
  'Movement': 'Detroit, USA',
  'Movement Detroit': 'Detroit, USA',
  'Sónar': 'Barcelona, Spain',
  'Primavera Sound': 'Barcelona, Spain',
  'Dekmantel': 'Amsterdam, Netherlands',
  'ADE': 'Amsterdam, Netherlands',
  'BPM Festival': 'Mexico',
  'Burning Man': 'Nevada, USA',
  'Black Rock City': 'Nevada, USA',
  'Robot Heart': 'Burning Man, Nevada',
  'Mayan Warrior': 'Burning Man, Nevada',
  'Lightning in a Bottle': 'California, USA',
  'CRSSD': 'San Diego, USA',
  'III Points': 'Miami, USA',
  'Lollapalooza': 'Chicago, USA',
  'Perry Stage': 'Lollapalooza, Chicago',
  'Perrys Stage': 'Lollapalooza, Chicago',
  // Chicago venues
  'Navy Pier': 'Chicago, USA',
  'Spybar': 'Chicago, USA',
  'Sound-Bar': 'Chicago, USA',
  'Prysm': 'Chicago, USA',
  'Radius Chicago': 'Chicago, USA',
  'House Calls': 'Chicago, USA',
  'Obskür': 'Various',
  'Obskur': 'Various',
  'Electric Forest': 'Michigan, USA',
  'Outside Lands': 'San Francisco, USA',
  'Holy Ship': 'Cruise',
  'Shambhala': 'British Columbia, Canada',
  'Day Zero': 'Tulum, Mexico',
  'Zamna': 'Tulum, Mexico',
  'Exit Festival': 'Serbia',
  // Radio Shows
  'BBC Radio 1 Dance': 'London, UK',
  'Radio 1 Essential Mix': 'London, UK',
  'Pete Tong': 'London, UK',
  'Danny Howard': 'London, UK',
  'Annie Mac': 'London, UK',
  'Circoloco Radio': 'Ibiza, Spain',
  'Defected Radio': 'London, UK',
  'Defected Broadcasting House': 'London, UK',
  'Toolroom Radio': 'London, UK',
  'Drumcode Radio': 'Stockholm, Sweden',
  'Drumcode Live': 'Stockholm, Sweden',
  'Adam Beyer Drumcode': 'Stockholm, Sweden',
  'Afterlife Voyage': 'Italy',
  'Tale Of Us Afterlife': 'Italy',
  'Anjunadeep Edition': 'London, UK',
  'Anjunabeats Worldwide': 'London, UK',
  'Group Therapy Radio': 'London, UK',
  'ABGT': 'London, UK',
  'Solomun +1': 'Ibiza, Spain',
  'Keinemusik Radio': 'Berlin, Germany',
  'Diynamic Radio': 'Hamburg, Germany',
  'Innervisions Radio': 'Berlin, Germany',
  'Kompakt Podcast': 'Cologne, Germany',
  'Resident Advisor': 'Berlin, Germany',
  'RA Podcast': 'Berlin, Germany',
  'Mixmag': 'London, UK',
  'Mixmag Lab': 'London, UK',
  'DJ Mag': 'London, UK',
  'Rinse FM': 'London, UK',
  'NTS Radio': 'London, UK',
  'Red Light Radio': 'Amsterdam, Netherlands',
  'Worldwide FM': 'London, UK',
  'KCRW': 'Los Angeles, USA',
  'Sirius XM': 'New York, USA',
  'Apple Music 1': 'Los Angeles, USA',
  'Beats 1': 'Los Angeles, USA',
  // Live stream platforms
  'Boiler Room': 'London, UK',
  'Cercle': 'Paris, France',
  'HÖR Berlin': 'Berlin, Germany',
  'HOR Berlin': 'Berlin, Germany',
  // Labels/brands (event-based, location varies)
  'Circoloco': 'Ibiza, Spain',
  'Defected': 'London, UK',
  'Drumcode': 'Stockholm, Sweden',
  'Afterlife': 'Ibiza, Spain',
  'Resistance': 'Miami, USA',
  'elrow': 'Barcelona, Spain',
  'Music On': 'Ibiza, Spain',
  'Destino': 'Ibiza, Spain',
  'Destino Ibiza': 'Ibiza, Spain',
  'Blue Marlin': 'Ibiza, Spain',
  'Blue Marlin Ibiza': 'Ibiza, Spain',
  'Pikes': 'Ibiza, Spain',
  'Pikes Ibiza': 'Ibiza, Spain',
  'Las Dalias': 'Ibiza, Spain',
  'Akasha': 'Ibiza, Spain',
  'Cova Santa': 'Ibiza, Spain',
  'Heart Ibiza': 'Ibiza, Spain',
  'Eden': 'Ibiza, Spain',
  'Es Paradis': 'Ibiza, Spain',
  'Cafe Mambo': 'Ibiza, Spain',
  'Cafe del Mar': 'Ibiza, Spain',
  'Knee Deep In Sound': 'Ibiza, Spain',
  'Paradise': 'Ibiza, Spain',
  'Solid Grooves': 'Ibiza, Spain',
  'FUSE': 'London, UK',
};

const SetFeedCard = React.memo(function SetFeedCard({ setList, onPress, onLongPress, onArtistPress, onEventPress, isSelected = false, accentOpacity, solidness, fillProgress, fillDirection }: SetFeedCardProps) {
  const [showArtistPicker, setShowArtistPicker] = useState(false);

  // Calculate dynamic font sizes based on content length and venue presence
  // NEVER truncate - instead scale down font size to fit
  const getArtistChipStyle = (artists: string[], hasVenue: boolean = false) => {
    const totalChars = artists.slice(0, 2).reduce((sum, a) => sum + a.length, 0);
    const longestName = Math.max(...artists.slice(0, 2).map(a => a.length));

    // Base sizes - scale down based on content
    let fontSize = 11;
    let paddingH = 8;
    let paddingV = 3;

    if (hasVenue) {
      // With venue badge, we have less horizontal space
      if (totalChars > 28 || longestName > 16) {
        fontSize = 7;
        paddingH = 4;
        paddingV = 2;
      } else if (totalChars > 22 || longestName > 13) {
        fontSize = 8;
        paddingH = 5;
        paddingV = 2;
      } else if (totalChars > 16 || longestName > 10) {
        fontSize = 9;
        paddingH = 6;
        paddingV = 3;
      } else {
        fontSize = 10;
        paddingH = 7;
        paddingV = 3;
      }
    } else {
      // No venue badge - more room
      if (totalChars > 30 || longestName > 18) {
        fontSize = 8;
        paddingH = 5;
        paddingV = 2;
      } else if (totalChars > 24 || longestName > 14) {
        fontSize = 9;
        paddingH = 6;
        paddingV = 3;
      } else if (totalChars > 18) {
        fontSize = 10;
        paddingH = 7;
        paddingV = 3;
      }
    }

    return { fontSize, paddingH, paddingV };
  };

  // Get display artists - show full names, never truncate
  // Only limit to 2 artists max, show +N for more
  const getDisplayArtists = (allArtists: string[], hasVenue: boolean) => {
    if (allArtists.length === 0) return { display: [], hasMore: false, moreCount: 0 };

    if (allArtists.length === 1) {
      return {
        display: [allArtists[0]], // Full name, no truncation
        hasMore: false,
        moreCount: 0
      };
    }

    // Show first two artists with full names
    return {
      display: [allArtists[0], allArtists[1]],
      hasMore: allArtists.length > 2,
      moreCount: allArtists.length - 2
    };
  };

  const getVenueFontSize = (venue: string) => {
    if (venue.length > 20) return 8;
    if (venue.length > 14) return 9;
    return 10;
  };

  // Smart venue name shortening - keep critical info, remove fluff
  const shortenVenueName = (venue: string, maxLength: number = 18): string => {
    if (!venue) return '';

    let shortened = venue;

    // Step 1: Apply specific known transformations
    const specificReplacements: [RegExp, string][] = [
      // River/water venues → City + Boat/River
      [/Hudson River Boat Party/i, 'NYC Boat Party'],
      [/Hudson River/i, 'NYC Hudson'],
      [/East River Ferry/i, 'NYC Ferry'],
      [/East River/i, 'NYC East River'],
      [/Thames Boat Party/i, 'Thames Boat'],
      [/Thames/i, 'London Thames'],

      // BBC Radio patterns - simplify heavily
      [/BBC Radio 1 in Ibiza/i, 'Radio 1 Ibiza'],
      [/BBC Radio 1 Ibiza/i, 'Radio 1 Ibiza'],
      [/Radio 1 Main Stage/i, 'Radio 1'],
      [/(\d+)\s+Ibiza\s+Radio\s*1?\s*Main Stage/i, 'Radio 1 Ibiza'],
      [/Ibiza Radio 1 Main Stage/i, 'Radio 1 Ibiza'],
      [/BBC Radio 1 Dance/i, 'Radio 1 Dance'],
      [/BBC Radio 1/i, 'Radio 1'],

      // Festival stages - remove "Stage" suffix when venue is clear
      [/Yuma (?:Tent|Stage)/i, 'Yuma'],
      [/Sahara (?:Tent|Stage)/i, 'Sahara'],
      [/Gobi (?:Tent|Stage)/i, 'Gobi'],
      [/Mojave (?:Tent|Stage)/i, 'Mojave'],
      [/Perry(?:'?s)? Stage/i, 'Perrys'],
      [/Do\s?LaB Stage/i, 'Do LaB'],
      [/Heineken House/i, 'Heineken'],
      [/Main Stage/i, 'Main'],

      // Location expansions → abbreviations
      [/New York City/i, 'NYC'],
      [/New York/i, 'NYC'],
      [/Los Angeles/i, 'LA'],
      [/San Francisco/i, 'SF'],
      [/San Diego/i, 'SD'],
      [/Las Vegas/i, 'Vegas'],
      [/Brooklyn/i, 'BK'],

      // Tomorrowland stages
      [/Tomorrowland Main Stage/i, 'TML Main'],
      [/Tomorrowland Freedom/i, 'TML Freedom'],
      [/Tomorrowland/i, 'TML'],

      // Other festival abbreviations
      [/Electric Daisy Carnival/i, 'EDC'],
      [/Ultra Music Festival/i, 'Ultra'],
      [/Burning Man/i, 'BM'],
      [/Black Rock City/i, 'BRC'],

      // Club/venue clarifications
      [/Brooklyn Mirage/i, 'BK Mirage'],
      [/Avant Gardner/i, 'Avant Gardner'],
      [/Knockdown Center/i, 'Knockdown'],
      [/Ministry of Sound/i, 'MoS'],
      [/Warehouse Project/i, 'WHP'],

      // Common venue words to abbreviate/remove
      [/Music Festival/i, 'Fest'],
      [/Festival/i, 'Fest'],
      [/Warehouse/i, 'WH'],
      [/Broadcasting House/i, 'Studio'],
      [/Pop[- ]?Up/i, 'Pop-Up'],
      [/Nightclub/i, ''],
      [/Night Club/i, ''],
    ];

    for (const [pattern, replacement] of specificReplacements) {
      shortened = shortened.replace(pattern, replacement);
    }

    // Step 2: If still too long, apply generic shortening
    if (shortened.length > maxLength) {
      // Remove common suffixes that add little info
      const removableSuffixes = [
        /\s+Stage$/i,
        /\s+Tent$/i,
        /\s+Arena$/i,
        /\s+Room$/i,
        /\s+Hall$/i,
        /\s+Club$/i,
        /\s+Venue$/i,
      ];

      for (const suffix of removableSuffixes) {
        if (shortened.length > maxLength) {
          shortened = shortened.replace(suffix, '');
        }
      }
    }

    // Step 3: If still too long, try removing numbers at start (like "528 Ibiza...")
    if (shortened.length > maxLength) {
      shortened = shortened.replace(/^\d+\s+/, '');
    }

    // Step 4: If still too long, truncate with ellipsis but try to break at word boundary
    if (shortened.length > maxLength) {
      const truncated = shortened.substring(0, maxLength - 1);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.6) {
        // Break at word boundary if it's not too far back
        shortened = truncated.substring(0, lastSpace) + '…';
      } else {
        shortened = truncated + '…';
      }
    }

    return shortened.trim();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const handleArtistPress = (artistName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onArtistPress?.(artistName);
  };

  const handleMorePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowArtistPicker(true);
  };

  const handleSelectArtist = (artistName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowArtistPicker(false);
    onArtistPress?.(artistName);
  };

  // Handle trakd badge press - show explanation popup
  const handleTrackdBadgePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'trakd Status',
      isIdentified
        ? `This set has been trakd! ${trackCount} track${trackCount !== 1 ? 's' : ''} ${trackCount !== 1 ? 'have' : 'has'} been identified.\n\n` +
          (isFullyIdentified
            ? 'Fully trakd - all tracks in this set have been found!'
            : 'Some tracks may still be unidentified or have gaps.')
        : 'This set has not been trakd yet.\n\n' +
          'Once analyzed, we\'ll identify the tracks played in this set using audio fingerprinting and tracklist databases.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  // Handle unanalyzed badge press - show explanation
  const handleUnanalyzedBadgePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Not Yet trakd',
      'This set hasn\'t been trakd yet.\n\n' +
      'Tap the set to view details and start the trakd process.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  // Handle needs source icon press - explain how to add a link
  const handleNeedsSourcePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Source Link Required',
      'This set needs a YouTube or SoundCloud link to get trakd.\n\n' +
      'How to add a link:\n' +
      '1. Tap on this set to open it\n' +
      '2. Look for the "Add Source" button\n' +
      '3. Paste a YouTube or SoundCloud URL\n\n' +
      'What happens next:\n' +
      'Once linked, trakd will analyze the audio to automatically identify every track played!',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  // Parse multiple artists from name (handles &, and, vs, b2b, b3b patterns)
  const parseArtists = (artistString: string): string[] => {
    // Split on common separators: &, " and ", " vs ", " b2b ", " b3b ", " B2B ", " B3B "
    const separatorPattern = /\s*(?:&|,|\s+and\s+|\s+vs\.?\s+|\s+[bB]2[bB]\s+|\s+[bB]3[bB]\s+)\s*/;
    return artistString.split(separatorPattern).map(a => a.trim()).filter(a => a.length > 0);
  };

  // Extract artists - check if set name contains more artists than the artist field
  const getArtists = (): string[] => {
    // First check if the set name starts with multiple artists before " - " or " @ "
    const nameMatch = setList.name.match(/^(.+?)\s*[-–@]\s*/);
    if (nameMatch) {
      const potentialArtists = parseArtists(nameMatch[1]);
      // If set name has more artists than the artist field, use those
      if (potentialArtists.length > 1) {
        return potentialArtists;
      }
    }
    // Otherwise parse the artist field
    return parseArtists(setList.artist);
  };

  const artists = getArtists();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Helper to escape regex special characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Common countries/regions that appear in DJ set names
  const KNOWN_COUNTRIES = [
    'Germany', 'Spain', 'UK', 'USA', 'Netherlands', 'Belgium', 'France', 'Italy',
    'Australia', 'Brazil', 'Argentina', 'Mexico', 'Canada', 'Japan', 'Portugal',
    'Switzerland', 'Austria', 'Poland', 'Czech Republic', 'Croatia', 'Greece',
    'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Scotland', 'England',
    'Colombia', 'Chile', 'Peru', 'South Africa', 'India', 'Thailand', 'Indonesia',
    'United States', 'United Kingdom', 'The Netherlands', 'Ibiza', 'Mallorca',
  ];

  // Country to flag emoji mapping
  const COUNTRY_FLAGS: Record<string, string> = {
    'Germany': '🇩🇪',
    'Spain': '🇪🇸',
    'UK': '🇬🇧',
    'USA': '🇺🇸',
    'Netherlands': '🇳🇱',
    'The Netherlands': '🇳🇱',
    'Belgium': '🇧🇪',
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'Australia': '🇦🇺',
    'Brazil': '🇧🇷',
    'Argentina': '🇦🇷',
    'Mexico': '🇲🇽',
    'Canada': '🇨🇦',
    'Japan': '🇯🇵',
    'Portugal': '🇵🇹',
    'Switzerland': '🇨🇭',
    'Austria': '🇦🇹',
    'Poland': '🇵🇱',
    'Czech Republic': '🇨🇿',
    'Croatia': '🇭🇷',
    'Greece': '🇬🇷',
    'Sweden': '🇸🇪',
    'Norway': '🇳🇴',
    'Denmark': '🇩🇰',
    'Finland': '🇫🇮',
    'Ireland': '🇮🇪',
    'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Colombia': '🇨🇴',
    'Chile': '🇨🇱',
    'Peru': '🇵🇪',
    'South Africa': '🇿🇦',
    'India': '🇮🇳',
    'Thailand': '🇹🇭',
    'Indonesia': '🇮🇩',
    'United States': '🇺🇸',
    'United Kingdom': '🇬🇧',
    'Ibiza': '🇪🇸',
    'Mallorca': '🇪🇸',
    'California': '🇺🇸',
    'Nevada': '🇺🇸',
    'New York': '🇺🇸',
    'Miami': '🇺🇸',
    'Los Angeles': '🇺🇸',
    'Detroit': '🇺🇸',
    'San Diego': '🇺🇸',
    'Las Vegas': '🇺🇸',
    'London': '🇬🇧',
    'Manchester': '🇬🇧',
    'Bristol': '🇬🇧',
    'Berlin': '🇩🇪',
    'Hamburg': '🇩🇪',
    'Cologne': '🇩🇪',
    'Stockholm': '🇸🇪',
    'Amsterdam': '🇳🇱',
    'Barcelona': '🇪🇸',
    'Paris': '🇫🇷',
    'Coachella': '🇺🇸',
  };

  // Parse location into city and country - strip country/state names, show only city
  const parseLocation = (loc: string): { city: string | null; country: string | null; flag: string | null } => {
    if (!loc) return { city: null, country: null, flag: null };

    const parts = loc.split(',').map(p => p.trim());

    // Check if any part matches a known country/state with a flag
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      const flag = COUNTRY_FLAGS[part];
      if (flag) {
        // Only take the first part as city (strip all country/state info)
        const city = parts[0] !== part ? parts[0] : null;
        return { city, country: part, flag };
      }
    }

    // Check if the whole string is a known location with a flag
    const directFlag = COUNTRY_FLAGS[loc];
    if (directFlag) {
      return { city: null, country: loc, flag: directFlag };
    }

    // No country found - take only the first part as city
    return { city: parts[0], country: null, flag: null };
  };

  // Get smart location that avoids duplicating venue/festival name
  // If venue is a festival (e.g., "Coachella"), return actual location (e.g., "Indio, California")
  // instead of repeating "Coachella" in both venue and location badges
  const getSmartLocation = (venue: string | null, rawLocation: string | null): string | null => {
    if (!venue) return rawLocation;

    // Check if venue is a festival with a known actual location
    const festivalLocation = FESTIVAL_LOCATIONS[venue];
    if (festivalLocation) {
      // Don't show "Various Locations" - it's not helpful
      if (festivalLocation === 'Various Locations') {
        return null;
      }
      return festivalLocation;
    }

    // If rawLocation contains the venue name, try to extract just the geographic part
    if (rawLocation) {
      const venueLower = venue.toLowerCase();
      const locLower = rawLocation.toLowerCase();

      // If location starts with or contains venue name, it's likely redundant
      if (locLower.includes(venueLower) || venueLower.includes(locLower)) {
        // Try to get location from VENUE_LOCATIONS instead
        const venueLocation = VENUE_LOCATIONS[venue];
        if (venueLocation && !venueLocation.toLowerCase().includes(venueLower)) {
          return venueLocation;
        }
        return null; // Don't show redundant location
      }
    }

    return rawLocation;
  };

  // Parse set name to extract venue, location, and date
  // Remove artist name(s) if they appear at the start (since they're shown separately)
  const parseSetName = (name: string, artistNames: string[]) => {
    let workingName = name;
    let eventDate: Date | null = null;
    let venue: string | null = null;
    let location: string | null = null;

    // First, extract date from end
    const datePatterns = [
      /\s*(\d{4}-\d{2}-\d{2})\s*$/,  // 2025-05-26
      /\s*(\d{2}-\d{2}-\d{4})\s*$/,  // 26-05-2025
      /\s*(\d{2}\/\d{2}\/\d{4})\s*$/, // 26/05/2025
    ];

    for (const pattern of datePatterns) {
      const match = workingName.match(pattern);
      if (match) {
        workingName = workingName.replace(pattern, '').trim();
        const dateStr = match[1];

        if (dateStr.includes('-') && dateStr.indexOf('-') === 4) {
          eventDate = new Date(dateStr);
        } else if (dateStr.includes('-')) {
          const [day, month, year] = dateStr.split('-');
          eventDate = new Date(`${year}-${month}-${day}`);
        } else if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          eventDate = new Date(`${year}-${month}-${day}`);
        }
        break;
      }
    }

    // Extract location in parentheses at the end: "Event Name (Berlin, Germany)"
    const parenMatch = workingName.match(/\s*\(([^)]+)\)\s*$/);
    if (parenMatch) {
      const parenContent = parenMatch[1].trim();
      // Check if it contains a known country
      const hasCountry = KNOWN_COUNTRIES.some(c =>
        parenContent.toLowerCase().includes(c.toLowerCase())
      );
      if (hasCountry) {
        location = parenContent;
        workingName = workingName.replace(/\s*\([^)]+\)\s*$/, '').trim();
      }
    }

    // Try to remove artist name(s) from the beginning and extract the set/event name
    // Pattern 1: "Artist @ Venue, Location" -> extract venue and location separately
    const atMatch = workingName.match(/@\s*(.+)$/);
    if (atMatch) {
      const afterAt = atMatch[1].trim();
      const parts = afterAt.split(',').map(p => p.trim());

      if (parts.length >= 2) {
        venue = parts[0];
        // Check if last part is a known country/location
        const lastPart = parts[parts.length - 1];
        const hasKnownLocation = KNOWN_COUNTRIES.some(c =>
          lastPart.toLowerCase().includes(c.toLowerCase())
        );
        if (hasKnownLocation || parts.length > 2) {
          location = location || parts.slice(1).join(', ');
        }
        // Only show venue in the name - location will be shown as badge
        workingName = parts[0];
      } else if (parts.length === 1) {
        venue = parts[0];
        workingName = parts[0];
      }
    } else {
      // Pattern 2: "Artist1 & Artist2 & Artist3 - Set Name" -> extract "Set Name"
      // Match everything before " - " or " – " and check if it contains our artists
      const dashMatch = workingName.match(/^(.+?)\s*[-–]\s*(.+)$/);
      if (dashMatch) {
        const beforeDash = dashMatch[1].trim();
        const afterDash = dashMatch[2].trim();

        // Check if the part before dash contains any of our artists
        const containsArtist = artistNames.some(artist =>
          beforeDash.toLowerCase().includes(artist.toLowerCase())
        );

        if (containsArtist) {
          workingName = afterDash;
        }
      } else {
        // Pattern 3: Check if name starts with single artist and has colon/pipe separator
        const artistName = artistNames[0] || '';
        const colonMatch = workingName.match(new RegExp(`^${escapeRegex(artistName)}\\s*[:\\|]\\s*(.+)$`, 'i'));
        if (colonMatch) {
          workingName = colonMatch[1].trim();
        }
      }
    }

    // Final pass: check if workingName ends with a known country and extract it
    if (!location) {
      for (const country of KNOWN_COUNTRIES) {
        // Match ", Country" or " Country" at end (but not as part of a word)
        const countryPattern = new RegExp(`[,\\s]+${escapeRegex(country)}\\s*$`, 'i');
        if (countryPattern.test(workingName)) {
          location = country;
          workingName = workingName.replace(countryPattern, '').trim();
          break;
        }
      }
    }

    return { cleanName: workingName, eventDate, venue, location };
  };

  // Format event date for display (e.g., "May 26, 2025")
  const formatEventDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const { cleanName, eventDate, venue: parsedVenue, location: parsedLocation } = parseSetName(setList.name, artists);

  // Stage to parent festival mapping
  const STAGE_TO_FESTIVAL: Record<string, string | null> = {
    'yuma': 'Coachella',
    'yuma stage': 'Coachella',
    'yuma tent': 'Coachella',
    'sahara': 'Coachella',
    'sahara stage': 'Coachella',
    'sahara tent': 'Coachella',
    'gobi': 'Coachella',
    'gobi stage': 'Coachella',
    'mojave': 'Coachella',
    'mojave stage': 'Coachella',
    'do lab': 'Coachella',
    'dolab': 'Coachella',
    'main stage': null, // Generic, need context
    'mainstage': null,
    'perrys': 'Lollapalooza',
    'perrys stage': 'Lollapalooza',
    'perry stage': 'Lollapalooza',
    'carl cox megastructure': 'Ultra',
    'megastructure': 'Ultra',
    'resistance': 'Ultra',
    'worldwide stage': 'Ultra',
    'arcadia': 'Tomorrowland',
    'freedom stage': 'Tomorrowland',
    'neon garden': 'EDC',
    'circuit grounds': 'EDC',
    'kinetic field': 'EDC',
    'cosmic meadow': 'EDC',
    'bass pod': 'EDC',
  };

  // Event series that travel to different venues
  const TRAVELING_EVENTS = ['defected', 'elrow', 'circoloco', 'music on', 'solid grooves', 'afterlife', 'keinemusik', 'hyte', 'paradise', 'drumcode', 'ants', 'pure', 'pyramid'];

  // Known event series names to detect
  const EVENT_SERIES = ['music on', 'circoloco', 'defected', 'elrow', 'afterlife', 'hyte', 'paradise', 'solid grooves', 'ants', 'pure'];

  // Known Ibiza venues for context
  const IBIZA_VENUES = ['ushuaia', 'hi ibiza', 'hï ibiza', 'pacha', 'amnesia', 'dc-10', 'dc10', 'privilege', 'destino', 'blue marlin', 'pikes', 'eden', 'es paradis', 'cafe mambo', 'heart ibiza', 'cova santa'];

  // Format display name nicely - focus on event/venue, not artist (artist shown in chips)
  const formatDisplayName = (): string => {
    const originalName = setList.name;
    const eventVenue = setList.venue || parsedVenue;
    const eventLocation = setList.location || parsedLocation;
    const eventName = setList.eventName;
    const year = eventDate ? eventDate.getFullYear() : (setList.date ? new Date(setList.date).getFullYear() : null);
    const lowerOriginal = originalName.toLowerCase();

    // Extract event descriptors (closing, opening, etc.)
    const isClosing = /\bclosing\b/i.test(originalName);
    const isOpening = /\bopening\b/i.test(originalName);
    const isParty = /\bparty\b/i.test(originalName);

    // Detect if this is an event series (like Music On, Circoloco)
    let detectedEventSeries: string | null = null;
    for (const series of EVENT_SERIES) {
      if (lowerOriginal.includes(series) || eventName?.toLowerCase().includes(series) || eventVenue?.toLowerCase().includes(series)) {
        // Capitalize properly
        detectedEventSeries = series.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    // Detect physical venue from name (look for known venues)
    let physicalVenue: string | null = null;
    for (const venue of IBIZA_VENUES) {
      if (lowerOriginal.includes(venue)) {
        // Capitalize properly
        if (venue === 'hi ibiza' || venue === 'hï ibiza') physicalVenue = 'Hï Ibiza';
        else if (venue === 'dc-10' || venue === 'dc10') physicalVenue = 'DC-10';
        else physicalVenue = venue.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    // Check if venue is actually a stage name, map to parent festival
    let displayVenue = eventVenue;
    if (eventVenue) {
      const lowerVenue = eventVenue.toLowerCase();
      const parentFestival = STAGE_TO_FESTIVAL[lowerVenue];
      if (parentFestival) {
        displayVenue = parentFestival;
      }
    }

    // Build the display name
    let result = '';

    // Case 1: Event series at a physical venue (e.g., "Music On @ Destino")
    if (detectedEventSeries && physicalVenue && detectedEventSeries.toLowerCase() !== physicalVenue.toLowerCase()) {
      result = `${detectedEventSeries} ${physicalVenue}`;
    }
    // Case 2: Event series with location (traveling event)
    else if (detectedEventSeries) {
      result = detectedEventSeries;
      if (eventLocation) {
        const city = eventLocation.split(',')[0].trim();
        if (!result.toLowerCase().includes(city.toLowerCase())) {
          result += ` ${city}`;
        }
      }
    }
    // Case 3: Physical venue with event type (e.g., "Hi Ibiza Closing Party")
    else if (physicalVenue || displayVenue) {
      result = physicalVenue || displayVenue || '';

      // Add descriptor if meaningful
      if (isClosing) {
        result += ' Closing';
        if (isParty) result += ' Party';
      } else if (isOpening) {
        result += ' Opening';
        if (isParty) result += ' Party';
      }

      // For traveling events, add location
      const isTraveling = result && TRAVELING_EVENTS.some(e => result.toLowerCase().includes(e));
      if (isTraveling && eventLocation) {
        const city = eventLocation.split(',')[0].trim();
        if (!result.toLowerCase().includes(city.toLowerCase())) {
          result += ` ${city}`;
        }
      } else if (year && !result.includes(String(year)) && !isClosing && !isOpening) {
        // Add year for fixed-location festivals (but not for closing/opening parties)
        result += ` ${year}`;
      }
    }
    // Case 4: Use cleaned name
    else if (cleanName && cleanName !== originalName) {
      result = cleanName;
    }
    // Case 5: Fallback - clean up the original name
    else {
      result = originalName;

      // Remove artist prefix if present
      for (const artist of artists) {
        const artistPattern = new RegExp(`^${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–@|:]\\s*`, 'i');
        result = result.replace(artistPattern, '');
      }

      // Remove date suffix
      result = result.replace(/\s*\d{4}[-/]\d{2}[-/]\d{2}\s*$/, '').trim();
    }

    return result.trim() || originalName;
  };

  // Use database fields if available, fall back to parsed values, then venue lookup
  const venue = setList.venue || parsedVenue;
  const rawLocation = setList.location || parsedLocation || (venue ? VENUE_LOCATIONS[venue] : null);

  // Get smart location that avoids duplicating venue name (for festivals/events)
  const smartLocation = getSmartLocation(venue, rawLocation);

  // Parse location into city and country/flag
  const { city: locationCity, flag: locationFlag } = parseLocation(smartLocation || '');

  const [imageError, setImageError] = useState(false);
  const [triedHqFallback, setTriedHqFallback] = useState(false);

  const getSetFallbackImage = useCallback((): string | null => {
    if (setList.artistImageUrl) return setList.artistImageUrl;
    return null;
  }, [setList.artistImageUrl]);

  const getCoverImage = useCallback((): string | null => {
    if (imageError && triedHqFallback) {
      return getSetFallbackImage();
    }

    if (setList.coverUrl) {
      if (imageError && setList.coverUrl.includes('maxresdefault')) {
        return setList.coverUrl.replace('maxresdefault', 'hqdefault');
      }
      return setList.coverUrl;
    }

    return getSetFallbackImage();
  }, [setList.coverUrl, imageError, triedHqFallback, getSetFallbackImage]);

  const handleImageError = useCallback(() => {
    console.log(`[SetFeedCard] Image error for set: ${setList.name}`);
    if (!triedHqFallback && setList.coverUrl?.includes('maxresdefault')) {
      console.log('[SetFeedCard] Trying hqdefault fallback');
      setTriedHqFallback(true);
      setImageError(true);
    } else {
      console.log('[SetFeedCard] Using stock fallback image');
      setTriedHqFallback(true);
      setImageError(true);
    }
  }, [triedHqFallback, setList.coverUrl, setList.name]);

  const getPlatformIcons = () => {
    const platforms = (setList.sourceLinks || []).map(l => l.platform);
    const unique = [...new Set(platforms)];

    return unique.slice(0, 3).map((platform, index) => {
      const iconProps = { size: 16 };
      switch (platform) {
        case 'youtube':
          return null;
        case 'soundcloud':
          return <Music2 key={index} {...iconProps} color="#FF5500" />;
        default:
          return null;
      }
    });
  };

  // Check if set needs analyzable sources (YouTube or SoundCloud)
  const hasAnalyzableSource = (setList.sourceLinks || []).some(
    l => l.platform === 'youtube' || l.platform === 'soundcloud'
  );
  const needsSource = !hasAnalyzableSource;

  // Check if set has been trackd (analyzed via YouTube/SoundCloud)
  const trackCount = setList.tracksIdentified || setList.trackCount || setList.tracks?.length || 0;
  const isIdentified = hasAnalyzableSource && (setList.aiProcessed || trackCount > 0);
  const isFullyIdentified = trackCount > 0 && !setList.hasGaps && setList.aiProcessed;

  // Keep full name for search indexing
  const searchableText = `${setList.name} ${setList.artist} ${venue || ''} ${smartLocation || ''}`.trim();

  // Detect festival/radio show event from name, venue, or event name
  const detectedEvent = useMemo(() => {
    const textToSearch = `${setList.name} ${venue || ''} ${setList.eventName || ''}`;
    return detectEvent(textToSearch);
  }, [setList.name, venue, setList.eventName]);

  const artistChipStyle = getArtistChipStyle(artists, !!venue);
  // Apply smart shortening to venue name for display
  const displayVenue = venue ? shortenVenueName(venue) : null;
  const venueFontSize = displayVenue ? getVenueFontSize(displayVenue) : 10;

  // Get smart display artists that won't overlap with venue badge
  const { display: displayArtists, hasMore: showMoreButton, moreCount } = getDisplayArtists(artists, !!venue);
  const actualMoreCount = moreCount ?? (artists.length - displayArtists.length);

  // Dynamic badge sizing based on available space
  // Count how many badges will be displayed
  const badgeCount = useMemo(() => {
    let count = 1; // Always have status badge (T'D or ?)
    if (locationCity || smartLocation) count++; // Location icon
    if (locationFlag) count++; // Flag
    if (detectedEvent) count++; // Event badge
    return count;
  }, [locationCity, smartLocation, locationFlag, detectedEvent]);

  // Get display name length for space calculation
  const displayNameLength = formatDisplayName().length;

  // Calculate badge size scale: more space = bigger badges
  // Scale from 1.0 (minimum, 4 badges + long name) to 1.5 (maximum, 1-2 badges + short name)
  const badgeSizeScale = useMemo(() => {
    // Fewer badges = more space
    const badgeSpaceFactor = Math.max(0, (4 - badgeCount) * 0.1); // 0 to 0.3
    // Shorter name = more space (under 25 chars is "short")
    const nameSpaceFactor = displayNameLength < 25 ? 0.2 : displayNameLength < 35 ? 0.1 : 0;
    // Combined scale: 1.0 to 1.5
    return Math.min(1.5, 1.0 + badgeSpaceFactor + nameSpaceFactor);
  }, [badgeCount, displayNameLength]);

  // Dynamic badge dimensions
  const dynamicBadgeSize = {
    locationIcon: Math.round(14 * badgeSizeScale),
    locationIconPin: Math.round(8 * badgeSizeScale),
    flagEmoji: Math.round(8 * badgeSizeScale),
    trackdWidth: Math.round(16 * badgeSizeScale),
    trackdHeight: Math.round(14 * badgeSizeScale),
    trackdFont: Math.round(6 * badgeSizeScale),
    unanalyzedSize: Math.round(12 * badgeSizeScale),
    unanalyzedFont: Math.round(7 * badgeSizeScale),
    tracksPaddingH: Math.round(4 * badgeSizeScale),
    tracksPaddingV: Math.round(1.5 * badgeSizeScale),
    tracksFont: Math.round(6.5 * badgeSizeScale),
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.container, isIdentified && styles.containerAnalyzed, pressed && styles.pressed]}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityLabel={searchableText}
    >
      {/* Solid background layer — fades in when card is centered */}
      {solidness && (
        <Animated.View
          style={[
            styles.solidBg,
            { opacity: solidness },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Dark shade overlay — fades in when card is centered/hovered */}
      {accentOpacity && (
        <Animated.View
          style={[
            styles.hoverShade,
            { opacity: accentOpacity },
          ]}
          pointerEvents="none"
        />
      )}

      {/* trackd badge - top left corner, floating like venue badge */}
      {isIdentified && (
        <Pressable onPress={handleTrackdBadgePress} hitSlop={4} style={styles.trackdBadgeFloating}>
          <Text style={styles.trackdBadgeFloatingText}>trakd</Text>
        </Pressable>
      )}

      {/* Venue badge - top right corner — liquid glass */}
      {displayVenue && (
        <Animated.View
          style={[
            styles.venueBadgeTopRight,
            solidness && {
              backgroundColor: solidness.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.10)'],
                extrapolate: 'clamp',
              }),
              borderColor: solidness.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.venueBadgeText,
              { fontSize: venueFontSize },
              solidness && {
                color: solidness.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(245,230,211,0.5)', '#F5E6D3'],
                  extrapolate: 'clamp',
                }),
              },
            ]}
            numberOfLines={1}
          >
            {displayVenue}
          </Animated.Text>
        </Animated.View>
      )}

      <View style={styles.row}>
        <View style={styles.coverContainer}>
          {getCoverImage() ? (
            <Image
              source={{ uri: getCoverImage()! }}
              style={styles.cover}
              contentFit="cover"
              placeholder={{ blurhash: BLURHASH.coverDark }}
              transition={300}
              onError={handleImageError}
              cachePolicy="memory-disk"
            />
          ) : (
            <Image
              style={styles.cover}
              placeholder={{ blurhash: BLURHASH.coverDark }}
              contentFit="cover"
            />
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Play size={14} color="#fff" fill="#fff" />
            </View>
          </View>
          {(setList.totalDuration || 0) > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(setList.totalDuration || 0)}</Text>
            </View>
          )}
          {isFullyIdentified && (
            <View style={styles.completeBadge}>
              <Star size={10} color="#FFD700" fill="#FFD700" />
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Artists row - smart truncation to prevent overlap with venue badge */}
          <View style={styles.artistSection}>
            <Animated.View style={styles.artistRow}>
              {displayArtists.map((artist, index) => {
                // Find original artist for the press handler
                const originalArtist = artists.find(a => a.startsWith(artist.replace('…', ''))) || artist;
                return (
                  <Pressable
                    key={index}
                    onPress={() => handleArtistPress(originalArtist)}
                    hitSlop={4}
                  >
                    {({ pressed }) => (
                      <Animated.View
                        style={[
                          styles.artistChip,
                          styles.artistChipWithFill,
                          {
                            paddingHorizontal: artistChipStyle.paddingH,
                            paddingVertical: artistChipStyle.paddingV,
                          },
                          solidness && {
                            backgroundColor: solidness.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.10)'],
                              extrapolate: 'clamp',
                            }),
                            borderColor: solidness.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)'],
                              extrapolate: 'clamp',
                            }),
                          },
                          pressed && styles.artistChipPressed
                        ]}
                      >
                        <View style={styles.chipTextContainer}>
                          <Animated.Text
                            style={[
                              styles.artistText,
                              { fontSize: artistChipStyle.fontSize },
                              solidness && {
                                color: solidness.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['rgba(245,230,211,0.5)', '#F5E6D3'],
                                  extrapolate: 'clamp',
                                }),
                              },
                              pressed && styles.artistTextPressed
                            ]}
                            numberOfLines={1}
                          >
                            {artist}
                          </Animated.Text>
                        </View>
                      </Animated.View>
                    )}
                  </Pressable>
                );
              })}
              {(showMoreButton || actualMoreCount > 0) && (
                <Pressable onPress={handleMorePress} hitSlop={4}>
                  {({ pressed }) => (
                    <Animated.View
                      style={[
                        styles.artistMoreBadge,
                        {
                          paddingHorizontal: artistChipStyle.paddingH + 2,
                          paddingVertical: artistChipStyle.paddingV,
                        },
                        isSelected && styles.artistMoreBadgeSelected,
                        pressed && styles.artistMoreBadgePressed
                      ]}
                    >
                      <Text
                        style={[
                          styles.artistMoreText,
                          { fontSize: artistChipStyle.fontSize },
                          isSelected && styles.artistMoreTextSelected,
                          pressed && styles.artistTextPressed
                        ]}
                      >
                        +{actualMoreCount}
                      </Text>
                    </Animated.View>
                  )}
                </Pressable>
              )}
            </Animated.View>
          </View>

          {/* Set name with accent bar - max 50 chars to prevent layout issues */}
          <View style={styles.nameContainer}>
            <View style={styles.nameAccent}>
              {accentOpacity && (
                <Animated.View style={[styles.nameAccentWhite, { opacity: accentOpacity }]} />
              )}
            </View>
            <Text
              style={[styles.name, isIdentified && styles.nameTrackd]}
              numberOfLines={2}
            >
              {formatDisplayName().length > 50
                ? formatDisplayName().substring(0, 47) + '...'
                : formatDisplayName()}
            </Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.metaRow}>
              {/* Left side: Platform icons + tracks count */}
              <View style={styles.leftStats}>
                {needsSource ? (
                  <Pressable onPress={handleNeedsSourcePress} hitSlop={8}>
                    <View style={styles.needsSourceIcon}>
                      <AlertCircle size={14} color="#FF6B35" fill="rgba(255, 107, 53, 0.2)" />
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.platforms}>
                    {getPlatformIcons()}
                  </View>
                )}
                {/* Tracks count badge — liquid glass */}
                <Animated.View style={[styles.tracksBadge, {
                  paddingHorizontal: dynamicBadgeSize.tracksPaddingH,
                  paddingVertical: dynamicBadgeSize.tracksPaddingV,
                }, solidness && {
                  backgroundColor: solidness.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.10)'],
                    extrapolate: 'clamp',
                  }),
                  borderColor: solidness.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)'],
                    extrapolate: 'clamp',
                  }),
                }]}>
                  <Animated.Text style={[styles.tracksBadgeText, { fontSize: dynamicBadgeSize.tracksFont },
                    solidness && {
                      color: solidness.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['rgba(245,230,211,0.5)', '#D4C4B0'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}>
                    {trackCount} {trackCount === 1 ? 'trak' : 'traks'}
                  </Animated.Text>
                </Animated.View>
              </View>

              {/* Right side: all badges in a single row - fade in/out based on scroll position */}
              <Animated.View style={[styles.rightStats, accentOpacity ? { opacity: accentOpacity } : { opacity: isSelected ? 1 : 0 }]}>
                <View style={styles.rightBadgesRow}>
                  {/* Blue location icon - clickable to show full location */}
                  {(locationCity || smartLocation) && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Alert.alert('Location', smartLocation || locationCity || '', [{ text: 'OK' }]);
                      }}
                      hitSlop={4}
                    >
                      <View style={[styles.locationIconBadge, {
                        width: dynamicBadgeSize.locationIcon,
                        height: dynamicBadgeSize.locationIcon
                      }]}>
                        <MapPin size={dynamicBadgeSize.locationIconPin} color="#fff" />
                      </View>
                    </Pressable>
                  )}
                  {/* Flag badge */}
                  {locationFlag && (
                    <View style={styles.flagBadge}>
                      <Text style={[styles.flagEmoji, { fontSize: dynamicBadgeSize.flagEmoji }]}>{locationFlag}</Text>
                    </View>
                  )}
                  {/* Event/Festival badge */}
                  {detectedEvent && (
                    <EventBadge
                      eventId={detectedEvent}
                      size={badgeSizeScale > 1.2 ? 'medium' : 'small'}
                      onPress={onEventPress}
                    />
                  )}
                  {/* Unanalyzed badge - only show when NOT identified */}
                  {!isIdentified && (
                    <Pressable onPress={handleUnanalyzedBadgePress} hitSlop={4}>
                      <View style={[styles.unanalyzedBadge, {
                        width: dynamicBadgeSize.unanalyzedSize,
                        height: dynamicBadgeSize.unanalyzedSize,
                      }]}>
                        <Text style={[styles.unanalyzedBadgeText, { fontSize: dynamicBadgeSize.unanalyzedFont }]}>?</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            </View>
          </View>
        </View>
      </View>

      {/* Artist Picker Modal */}
      <Modal
        visible={showArtistPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowArtistPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowArtistPicker(false)}
        >
          <View style={styles.artistPickerContainer}>
            <View style={styles.artistPickerHeader}>
              <Text style={styles.artistPickerTitle}>Select Artist</Text>
              <Pressable onPress={() => setShowArtistPicker(false)} hitSlop={8}>
                <X size={18} color={Colors.dark.textMuted} />
              </Pressable>
            </View>
            {artists.map((artist, index) => (
              <Pressable
                key={index}
                style={styles.artistPickerItem}
                onPress={() => handleSelectArtist(artist)}
              >
                <User size={14} color={Colors.dark.primary} />
                <Text style={styles.artistPickerItemText}>{artist}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Pressable>
  );
}, (prev, next) =>
  prev.setList.id === next.setList.id &&
  prev.isSelected === next.isSelected
);

export default SetFeedCard;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 14,
    height: 108,
    backgroundColor: 'rgba(12, 12, 12, 0.35)', // liquid glass base
    borderRadius: 14,
    overflow: 'visible',
    // Heavy 3D shadow stack
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderTopColor: 'rgba(255, 255, 255, 0.12)', // glass top highlight
    borderBottomColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 2,
    position: 'relative',
  },
  containerAnalyzed: {
    borderColor: 'rgba(196, 30, 58, 0.2)',
    borderTopColor: 'rgba(196, 30, 58, 0.15)',
    borderBottomColor: 'rgba(100, 10, 20, 0.3)',
  },
  solidBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0C0C0C',
    borderRadius: 13,
    borderWidth: 0,
  },
  hoverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 1,
  },
  trackdBadgeFloating: {
    position: 'absolute',
    top: -6,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.75)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 223, 100, 0.6)',
    borderBottomColor: 'rgba(160, 120, 20, 0.3)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  trackdBadgeFloatingText: {
    fontSize: 7.5,
    color: '#FFF8E7',
    fontWeight: '900' as const,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(120, 80, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },
  venueBadgeTopRight: {
    position: 'absolute',
    top: -8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderTopColor: 'rgba(255, 255, 255, 0.10)',
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
    maxWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  venueBadgeWithFill: {
    overflow: 'hidden',
  },
  venueFillOverlay: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    left: -1,
    right: -1,
    backgroundColor: '#C41E3A', // Circoloco red
    borderRadius: 10,
  },
  venueContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  venueBadgeSelected: {
    backgroundColor: 'rgba(196, 30, 58, 0.45)',
    borderColor: 'rgba(196, 30, 58, 0.5)',
    borderWidth: 1,
  },
  venueBadgeTextSelected: {
    color: '#FFF8F0',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.975 }],
  },
  row: {
    flexDirection: 'row',
    padding: 12,
    height: 108, // Fixed height to ensure consistent card heights for scroll centering
    zIndex: 2,
  },
  coverContainer: {
    position: 'relative',
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 230, 211, 0.12)',
    borderBottomColor: 'rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  eventPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 10,
    padding: 4,
  },
  eventPlaceholderEmoji: {
    fontSize: 24,
    fontWeight: '900' as const,
    letterSpacing: -1,
  },
  eventPlaceholderLabel: {
    fontSize: 8,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  eventPlaceholderRadio: {
    fontSize: 6,
    fontWeight: '800' as const,
    letterSpacing: 1,
    marginTop: -2,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 8,
    fontWeight: '600' as const,
    color: '#fff',
  },
  completeBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 3,
    borderRadius: 10,
  },
  content: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'space-between', // Push footer to bottom, giving title more room
    overflow: 'hidden', // Prevent content overflow that could affect height
    height: 84, // Slightly taller than cover to fit badges
  },
  // Artist chips row
  artistSection: {
    marginBottom: 3,
  },
  artistRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap', // Prevent wrapping to ensure consistent card height
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  artistChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderTopColor: 'rgba(255, 255, 255, 0.10)',
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  artistChipWithFill: {
    overflow: 'hidden',
  },
  chipFillOverlay: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    left: -1,
    right: -1,
    backgroundColor: '#C41E3A', // Circoloco red
    borderRadius: 11,
  },
  chipTextContainer: {
    zIndex: 10,
  },
  chipFillOverlayBottom: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    zIndex: 1,
  },
  chipFillOverlayTop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    zIndex: 1,
  },
  artistChipSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
  },
  artistChipPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  artistText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    fontWeight: '700' as const,
    color: 'rgba(245, 230, 211, 0.5)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  artistTextSelected: {
    color: '#F5E6D3',
  },
  artistTextPressed: {
    color: '#FFFFFF',
  },
  artistMoreBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dashed',
  },
  artistMoreBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'solid',
  },
  artistMoreBadgePressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderStyle: 'solid',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  artistMoreText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(245, 230, 211, 0.5)',
  },
  artistMoreTextSelected: {
    color: '#F5E6D3',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingLeft: 2,
  },
  nameAccent: {
    width: 3,
    minHeight: 16,
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
    marginRight: 8,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  nameAccentWhite: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    fontWeight: '800' as const,
    color: '#F5E6D3',
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nameTrackd: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  // Location row - more prominent
  locationRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#2563EB',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationBadgeText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '600' as const,
  },
  venueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.dark.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: `${Colors.dark.primary}40`,
  },
  venueBadgeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    fontWeight: '700' as const,
    color: 'rgba(245, 230, 211, 0.5)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  platforms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leftStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  rightBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  // Flag badge
  flagBadge: {
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 1,
    paddingVertical: 0,
    borderRadius: 2,
  },
  flagEmoji: {
    fontSize: 8,
  },
  // Blue location icon badge - square, clickable to show full location
  locationIconBadge: {
    width: 14,
    height: 14,
    backgroundColor: '#2563EB',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Tracks count badge
  tracksBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tracksBadgeText: {
    fontSize: 8,
    color: 'rgba(245, 230, 211, 0.5)',
    fontWeight: '700' as const,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    letterSpacing: 0.3,
  },
  // trackd badge - inline small pill
  trackdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  trackdBadgeText: {
    fontSize: 7,
    color: '#fff',
    fontWeight: '900' as const,
    letterSpacing: -0.5,
  },
  // Unanalyzed badge - smaller square with "?"
  unanalyzedBadge: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.5)',
    borderRadius: 2,
  },
  unanalyzedBadgeText: {
    fontSize: 7,
    color: '#fff',
    fontWeight: '700' as const,
  },
  needsSourceIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  needsSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.4)',
  },
  needsSourceText: {
    fontSize: 10,
    color: '#FF6B35',
    fontWeight: '600' as const,
  },
  // Artist Picker Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  artistPickerContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    minWidth: 220,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  artistPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  artistPickerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  artistPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  artistPickerItemText: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: '500' as const,
  },
});
