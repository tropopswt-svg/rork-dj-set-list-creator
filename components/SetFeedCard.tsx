import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing, Alert } from 'react-native';
import EventBadge, { detectEvent, EVENT_BADGES } from './EventBadge';
import { Image } from 'expo-image';
import { Play, Music, Youtube, Music2, ListMusic, AlertCircle, Calendar, MapPin, Ticket, Star, X, User, HelpCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SetList } from '@/types';

interface SetFeedCardProps {
  setList: SetList;
  onPress?: () => void;
  onArtistPress?: (artist: string) => void;
  onEventPress?: (eventId: string) => void;
  isSelected?: boolean; // Whether this card is the main/centered one in the scroll wheel
}

const coverImages = [
  'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=400&h=400&fit=crop',
];

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
  'BBC Radio 1': 'UK',
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
  'BBC Radio 1': 'London, UK',
  'BBC Radio 1 Dance': 'London, UK',
  'Essential Mix': 'London, UK',
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
  'Printworks': 'London, UK',
};

export default function SetFeedCard({ setList, onPress, onArtistPress, onEventPress, isSelected = false }: SetFeedCardProps) {
  const [showArtistPicker, setShowArtistPicker] = useState(false);

  // Pulsing glow animation for selected card's artist chips
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSelected) {
      // Start pulsing glow animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [isSelected, glowAnim]);

  // Interpolate glow values
  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const glowShadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 12],
  });

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

  // Handle TRACK'D badge press - show explanation popup
  const handleTrackdBadgePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'TRACK\'D Status',
      isIdentified
        ? `This set has been TRACK'D! ${trackCount} track${trackCount !== 1 ? 's' : ''} ${trackCount !== 1 ? 'have' : 'has'} been identified.\n\n` +
          (isFullyIdentified
            ? '⭐ Fully TRACK\'D - all tracks in this set have been found!'
            : 'Some tracks may still be unidentified or have gaps.')
        : 'This set has not been TRACK\'D yet.\n\n' +
          'Once analyzed, we\'ll identify the tracks played in this set using audio fingerprinting and tracklist databases.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  // Handle unanalyzed badge press - show explanation
  const handleUnanalyzedBadgePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Not Yet TRACK\'D',
      'This set hasn\'t been TRACK\'D yet.\n\n' +
      'Tap the set to view details and start the TRACK\'D process.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  // Handle needs source icon press - explain how to add a link
  const handleNeedsSourcePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Source Link Required',
      'This set needs a YouTube or SoundCloud link to get TRACK\'D.\n\n' +
      '📎 How to add a link:\n' +
      '1. Tap on this set to open it\n' +
      '2. Look for the "Add Source" button\n' +
      '3. Paste a YouTube or SoundCloud URL\n\n' +
      '🎵 What happens next:\n' +
      'Once linked, TRACK\'D will analyze the audio to automatically identify every track played!',
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

  // Parse location into city and country
  const parseLocation = (loc: string): { city: string | null; country: string | null; flag: string | null } => {
    if (!loc) return { city: null, country: null, flag: null };

    const parts = loc.split(',').map(p => p.trim());

    // Check if any part matches a known country
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      const flag = COUNTRY_FLAGS[part];
      if (flag) {
        const city = parts.slice(0, i).join(', ') || null;
        return { city, country: part, flag };
      }
    }

    // Check if the whole string is a known location with a flag
    const directFlag = COUNTRY_FLAGS[loc];
    if (directFlag) {
      return { city: null, country: loc, flag: directFlag };
    }

    // No country found, treat whole thing as city
    return { city: loc, country: null, flag: null };
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
  const STAGE_TO_FESTIVAL: Record<string, string> = {
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

  const getFallbackImage = useCallback(() => {
    const index = parseInt(setList.id) % coverImages.length;
    return coverImages[index] || coverImages[0];
  }, [setList.id]);

  const getCoverImage = useCallback(() => {
    if (imageError && triedHqFallback) {
      return getFallbackImage();
    }
    
    if (setList.coverUrl) {
      if (imageError && setList.coverUrl.includes('maxresdefault')) {
        return setList.coverUrl.replace('maxresdefault', 'hqdefault');
      }
      return setList.coverUrl;
    }
    
    return getFallbackImage();
  }, [setList.coverUrl, imageError, triedHqFallback, getFallbackImage]);

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
    const platforms = setList.sourceLinks.map(l => l.platform);
    const unique = [...new Set(platforms)];

    return unique.slice(0, 3).map((platform, index) => {
      const iconProps = { size: 16 };
      switch (platform) {
        case 'youtube':
          return <Youtube key={index} {...iconProps} color="#FF0000" />;
        case 'soundcloud':
          return <Music2 key={index} {...iconProps} color="#FF5500" />;
        case '1001tracklists':
          return <ListMusic key={index} {...iconProps} color={Colors.dark.primary} />;
        default:
          return null;
      }
    });
  };

  // Check if set needs analyzable sources (YouTube or SoundCloud)
  const hasAnalyzableSource = setList.sourceLinks.some(
    l => l.platform === 'youtube' || l.platform === 'soundcloud'
  );
  const needsSource = !hasAnalyzableSource;

  // Check if set has been IDentified (analyzed via YouTube/SoundCloud)
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

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityLabel={searchableText}
    >
      {/* Venue badge - top right corner */}
      {displayVenue && (
        <Animated.View
          style={[
            styles.venueBadgeTopRight,
            isSelected && styles.venueBadgeSelected,
            isSelected && {
              shadowColor: Colors.dark.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: glowShadowOpacity,
              shadowRadius: glowShadowRadius,
            },
          ]}
        >
          <Ticket size={venueFontSize} color={isSelected ? '#FFF8F0' : Colors.dark.primary} />
          <Text
            style={[
              styles.venueBadgeText,
              { fontSize: venueFontSize },
              isSelected && styles.venueBadgeTextSelected,
            ]}
            numberOfLines={1}
          >
            {displayVenue}
          </Text>
        </Animated.View>
      )}

      <View style={styles.row}>
        <View style={styles.coverContainer}>
          {/* Show event-branded placeholder if no YouTube source but we detect an event */}
          {needsSource && detectedEvent && EVENT_BADGES[detectedEvent] ? (
            <View
              style={[
                styles.eventPlaceholder,
                {
                  backgroundColor: EVENT_BADGES[detectedEvent].backgroundColor,
                  borderColor: EVENT_BADGES[detectedEvent].borderColor || EVENT_BADGES[detectedEvent].backgroundColor,
                },
              ]}
            >
              <Text style={[
                styles.eventPlaceholderEmoji,
                { color: EVENT_BADGES[detectedEvent].textColor },
                EVENT_BADGES[detectedEvent].isEmoji && { fontSize: 32 },
                EVENT_BADGES[detectedEvent].fontStyle === 'handwritten' && { fontStyle: 'italic', fontWeight: '400', fontSize: 32 },
              ]}>
                {EVENT_BADGES[detectedEvent].shortLabel}
              </Text>
              {/* Show RADIO subtext for radio shows */}
              {EVENT_BADGES[detectedEvent].hasRadioSubtext && (
                <Text style={[
                  styles.eventPlaceholderRadio,
                  { color: EVENT_BADGES[detectedEvent].textColor },
                ]}>
                  RADIO
                </Text>
              )}
              <Text style={[
                styles.eventPlaceholderLabel,
                { color: EVENT_BADGES[detectedEvent].textColor },
              ]} numberOfLines={1}>
                {EVENT_BADGES[detectedEvent].label}
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: getCoverImage() }}
              style={styles.cover}
              contentFit="cover"
              onError={handleImageError}
              cachePolicy="memory-disk"
            />
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Play size={14} color="#fff" fill="#fff" />
            </View>
          </View>
          {(setList.totalDuration || 0) > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(setList.totalDuration)}</Text>
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
                          {
                            paddingHorizontal: artistChipStyle.paddingH,
                            paddingVertical: artistChipStyle.paddingV,
                          },
                          isSelected && styles.artistChipSelected,
                          isSelected && {
                            shadowColor: Colors.dark.primary,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: glowShadowOpacity,
                            shadowRadius: glowShadowRadius,
                          },
                          pressed && styles.artistChipPressed
                        ]}
                      >
                        <Text
                          style={[
                            styles.artistText,
                            { fontSize: artistChipStyle.fontSize },
                            isSelected && styles.artistTextSelected,
                            pressed && styles.artistTextPressed
                          ]}
                          numberOfLines={1}
                        >
                          {artist}
                        </Text>
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
                        isSelected && {
                          shadowColor: Colors.dark.primary,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: glowShadowOpacity,
                          shadowRadius: glowShadowRadius,
                        },
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

          {/* Set name with accent bar */}
          <View style={styles.nameContainer}>
            <View style={[styles.nameAccent, isSelected && styles.nameAccentSelected]} />
            <Text
              style={[styles.name, isSelected && styles.nameSelected]}
              numberOfLines={2}
            >
              {formatDisplayName()}
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
                {/* Tracks count badge */}
                <View style={styles.tracksBadge}>
                  <Text style={styles.tracksBadgeText}>
                    {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                  </Text>
                </View>
              </View>

              {/* Right side: Location on top, Event + Status badges below */}
              <View style={styles.rightStats}>
                {/* Location badge - blue box on top */}
                {locationCity && (
                  <View style={[
                    styles.locationBadgeBlue,
                    locationCity.length > 12 && styles.locationBadgeWrap,
                  ]}>
                    <MapPin size={10} color="#fff" />
                    <Text
                      style={styles.locationBadgeBlueText}
                      numberOfLines={locationCity.length > 12 ? 2 : 1}
                    >
                      {locationCity}
                    </Text>
                    {locationFlag && (
                      <Text style={styles.locationFlagSmall}>{locationFlag}</Text>
                    )}
                  </View>
                )}

                {/* Bottom row: Event badge + Status badge */}
                <View style={styles.rightStatsRow}>
                  {/* Event/Festival badge - clickable to filter by event */}
                  {detectedEvent && (
                    <EventBadge eventId={detectedEvent} size="small" onPress={onEventPress} />
                  )}

                  {/* TRACK'D status badge - pressable to show explanation */}
                  {isIdentified ? (
                    <Pressable onPress={handleTrackdBadgePress} hitSlop={4}>
                      <View style={styles.trackdBadge}>
                        <Text style={styles.trackdBadgeText}>T'D</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <Pressable onPress={handleUnanalyzedBadgePress} hitSlop={4}>
                      <View style={styles.unanalyzedBadge}>
                        <Text style={styles.unanalyzedBadgeText}>?</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>
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
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    position: 'relative',
  },
  venueBadgeTopRight: {
    position: 'absolute',
    top: -8,
    right: 8,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    maxWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  venueBadgeSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  venueBadgeTextSelected: {
    color: '#FFF8F0',
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  row: {
    flexDirection: 'row',
    padding: 12,
  },
  coverContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
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
    justifyContent: 'space-between',
  },
  // Artist chips row
  artistSection: {
    marginBottom: 3,
  },
  artistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  artistChip: {
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.dark.primary,
  },
  artistChipSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  artistChipPressed: {
    backgroundColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  artistText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.dark.primary,
    letterSpacing: 0.3,
  },
  artistTextSelected: {
    color: '#FFF8F0', // Cream white for selected state
  },
  artistTextPressed: {
    color: '#fff',
  },
  artistMoreBadge: {
    backgroundColor: 'rgba(226, 29, 72, 0.25)', // Subtle primary tint - shows it's different/clickable
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    borderStyle: 'dashed',
  },
  artistMoreBadgeSelected: {
    backgroundColor: Colors.dark.primary,
    borderStyle: 'solid',
  },
  artistMoreBadgePressed: {
    backgroundColor: Colors.dark.primary,
    borderStyle: 'solid',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  artistMoreText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: Colors.dark.primary,
  },
  artistMoreTextSelected: {
    color: '#FFF',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
    paddingLeft: 2,
  },
  nameAccent: {
    width: 3,
    minHeight: 16,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    marginRight: 8,
    alignSelf: 'stretch',
  },
  nameAccentSelected: {
    backgroundColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 17,
  },
  nameSelected: {
    color: Colors.dark.primary,
    fontWeight: '700' as const,
  },
  // Location row - more prominent
  locationRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4B5563',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  locationBadgeText: {
    fontSize: 10,
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
    color: Colors.dark.primary,
    fontWeight: '600' as const,
  },
  footer: {
    marginTop: 'auto',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
    justifyContent: 'flex-end',
  },
  rightStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  // Blue location badge - rectangle on top, wraps if too long
  locationBadgeBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minHeight: 20,
  },
  locationBadgeWrap: {
    maxWidth: 80,
    flexWrap: 'wrap',
  },
  locationBadgeBlueText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700' as const,
    flexShrink: 1,
  },
  locationFlagSmall: {
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Tracks count badge - teal/cyan color
  tracksBadge: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tracksBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700' as const,
  },
  // TRACK'D badge - square logo style
  trackdBadge: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 5,
  },
  trackdBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '900' as const,
    letterSpacing: -0.5,
  },
  // Unanalyzed badge - smaller square with "?"
  unanalyzedBadge: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    borderRadius: 4,
  },
  unanalyzedBadgeText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '700' as const,
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
