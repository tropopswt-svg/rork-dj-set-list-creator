import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Play, Music, Youtube, Music2, ListMusic, AlertCircle, Calendar, MapPin, Ticket, Star, X, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SetList } from '@/types';

interface SetFeedCardProps {
  setList: SetList;
  onPress?: () => void;
  onArtistPress?: (artist: string) => void;
}

const coverImages = [
  'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=400&h=400&fit=crop',
];

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
  'Lightning in a Bottle': 'California, USA',
  'CRSSD': 'San Diego, USA',
  'III Points': 'Miami, USA',
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
  'Knee Deep In Sound': 'Ibiza, Spain',
  'Paradise': 'Ibiza, Spain',
  'Solid Grooves': 'Ibiza, Spain',
  'FUSE': 'London, UK',
  'Printworks': 'London, UK',
};

export default function SetFeedCard({ setList, onPress, onArtistPress }: SetFeedCardProps) {
  const [showArtistPicker, setShowArtistPicker] = useState(false);

  // Calculate dynamic font sizes based on content length
  const getArtistFontSize = (artists: string[], maxWidth: number = 180) => {
    const totalChars = artists.slice(0, 3).reduce((sum, a) => sum + a.length, 0);
    if (totalChars > 25 || artists.length > 2) return 9;
    if (totalChars > 18) return 10;
    return 11;
  };

  const getVenueFontSize = (venue: string) => {
    if (venue.length > 20) return 8;
    if (venue.length > 14) return 9;
    return 10;
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const handleArtistPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // If multiple artists, show picker popup
    if (artists.length > 1) {
      setShowArtistPicker(true);
    } else if (artists.length === 1) {
      onArtistPress?.(artists[0]);
    }
  };

  const handleSelectArtist = (artistName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowArtistPicker(false);
    onArtistPress?.(artistName);
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

  // Use database fields if available, fall back to parsed values, then venue lookup
  const venue = setList.venue || parsedVenue;
  const location = setList.location || parsedLocation || (venue ? VENUE_LOCATIONS[venue] : null);

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
  const searchableText = `${setList.name} ${setList.artist} ${venue || ''} ${location || ''}`.trim();

  const artistFontSize = getArtistFontSize(artists);
  const venueFontSize = venue ? getVenueFontSize(venue) : 10;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityLabel={searchableText}
    >
      {/* Venue badge - top right corner */}
      {venue && (
        <View style={styles.venueBadgeTopRight}>
          <Ticket size={venueFontSize} color={Colors.dark.primary} />
          <Text style={[styles.venueBadgeText, { fontSize: venueFontSize }]} numberOfLines={1}>{venue}</Text>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.coverContainer}>
          <Image
            source={{ uri: getCoverImage() }}
            style={styles.cover}
            contentFit="cover"
            onError={handleImageError}
            cachePolicy="memory-disk"
          />
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
          {/* Artists row - dynamically sized to fit */}
          <Pressable style={styles.artistSection} onPress={handleArtistPress} hitSlop={4}>
            <View style={styles.artistRow}>
              {artists.slice(0, 3).map((artist, index) => (
                <View key={index} style={[styles.artistChip, { paddingHorizontal: artistFontSize > 9 ? 8 : 6 }]}>
                  <Text style={[styles.artistText, { fontSize: artistFontSize }]} numberOfLines={1}>{artist}</Text>
                </View>
              ))}
              {artists.length > 3 && (
                <View style={[styles.artistMoreBadge, { paddingHorizontal: artistFontSize > 9 ? 10 : 7 }]}>
                  <Text style={[styles.artistMoreText, { fontSize: artistFontSize }]}>+{artists.length - 3}</Text>
                </View>
              )}
            </View>
          </Pressable>

          <Text style={styles.name} numberOfLines={2}>{cleanName || setList.name}</Text>

          <View style={styles.footer}>
            <View style={styles.metaRow}>
              {/* Left side: Platform icons + tracks count */}
              <View style={styles.leftStats}>
                {needsSource ? (
                  <View style={styles.needsSourceIcon}>
                    <AlertCircle size={14} color="#FF6B35" fill="rgba(255, 107, 53, 0.2)" />
                  </View>
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

              {/* Right side: Location + Status badges */}
              <View style={styles.rightStats}>
                {/* Location badge - moved to bottom right */}
                {location && (
                  <View style={styles.locationBadgeSmall}>
                    <MapPin size={9} color="#fff" />
                    <Text style={styles.locationBadgeTextSmall} numberOfLines={1}>{location}</Text>
                  </View>
                )}

                {/* IDentified status badge - square logo style */}
                {isIdentified ? (
                  <View style={styles.identifiedBadge}>
                    <Text style={styles.identifiedBadgeText}>ID</Text>
                  </View>
                ) : (
                  <View style={styles.unanalyzedBadge}>
                    <Text style={styles.unanalyzedBadgeText}>?</Text>
                  </View>
                )}
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
    maxWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
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
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  artistText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.dark.primary,
    letterSpacing: 0.3,
  },
  artistMoreBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  artistMoreText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#FFF',
  },
  name: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 17,
    marginBottom: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  locationBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#4B5563',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 90,
  },
  locationBadgeTextSmall: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600' as const,
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
  // IDentified badge - square "ID" logo style
  identifiedBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 5,
  },
  identifiedBadgeText: {
    fontSize: 10,
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
