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

export default function SetFeedCard({ setList, onPress, onArtistPress }: SetFeedCardProps) {
  const [showArtistPicker, setShowArtistPicker] = useState(false);

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

    // Try to remove artist name(s) from the beginning and extract the set/event name
    // Pattern 1: "Artist @ Venue, Location" -> extract "Venue, Location"
    const atMatch = workingName.match(/@\s*(.+)$/);
    if (atMatch) {
      const afterAt = atMatch[1].trim();
      const parts = afterAt.split(',').map(p => p.trim());

      if (parts.length >= 2) {
        venue = parts[0];
        location = parts.slice(1).join(', ');
      } else if (parts.length === 1) {
        venue = parts[0];
      }

      // Display the full venue/event string
      workingName = afterAt;
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

    return { cleanName: workingName, eventDate, venue, location };
  };

  // Format event date for display (e.g., "May 26, 2025")
  const formatEventDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const { cleanName, eventDate, venue, location } = parseSetName(setList.name, artists);

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
  const needsSource = !setList.sourceLinks.some(
    l => l.platform === 'youtube' || l.platform === 'soundcloud'
  );

  // Check if set is fully IDentified (all tracks found, no gaps)
  const trackCount = setList.tracksIdentified || setList.trackCount || setList.tracks?.length || 0;
  const isFullyIdentified = trackCount > 0 && !setList.hasGaps && setList.aiProcessed;

  // Keep full name for search indexing
  const searchableText = `${setList.name} ${setList.artist} ${venue || ''} ${location || ''}`.trim();

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityLabel={searchableText}
    >
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
          {/* Top section: Artists on left, Location badges on right */}
          <View style={styles.topRow}>
            <Pressable style={styles.artistSection} onPress={handleArtistPress} hitSlop={4}>
              <View style={styles.artistRow}>
                {artists.slice(0, 2).map((artist, index) => (
                  <View key={index} style={styles.artistItem}>
                    <Text style={styles.artist} numberOfLines={1}>{artist}</Text>
                    {index < Math.min(artists.length, 2) - 1 && (
                      <Text style={styles.artistSeparator}>|</Text>
                    )}
                  </View>
                ))}
                {artists.length > 2 && (
                  <View style={styles.artistMoreBadge}>
                    <Text style={styles.artistMoreText}>+{artists.length - 2}</Text>
                  </View>
                )}
              </View>
            </Pressable>
            {(venue || location) && (
              <View style={styles.badgeSection}>
                {venue && (
                  <View style={styles.venueBadge}>
                    <Ticket size={8} color={Colors.dark.primary} />
                    <Text style={styles.venueBadgeText} numberOfLines={1}>{venue}</Text>
                  </View>
                )}
                {location && (
                  <View style={styles.locationBadge}>
                    <MapPin size={8} color="#6B7280" />
                    <Text style={styles.locationBadgeText} numberOfLines={1}>{location}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <Text style={styles.name} numberOfLines={2}>{cleanName || setList.name}</Text>

          <View style={styles.footer}>
            <View style={styles.metaRow}>
              <View style={styles.platforms}>
                {needsSource ? (
                  <View style={styles.needsSourceBadge}>
                    <AlertCircle size={10} color={Colors.dark.primary} />
                    <Text style={styles.needsSourceText}>Add source</Text>
                  </View>
                ) : (
                  getPlatformIcons()
                )}
              </View>
              <View style={styles.statsRow}>
                {eventDate && (
                  <View style={styles.eventDateBadge}>
                    <Calendar size={9} color={Colors.dark.primary} />
                    <Text style={styles.eventDateText}>{formatEventDate(eventDate)}</Text>
                  </View>
                )}
                <View style={styles.tracksStat}>
                  <Music size={10} color={Colors.dark.textMuted} />
                  <Text style={styles.statText}>{setList.tracksIdentified || setList.trackCount || setList.tracks?.length || 0}</Text>
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
    marginBottom: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    position: 'relative',
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  artistSection: {
    flex: 1,
    marginRight: 8,
    maxWidth: '55%',
  },
  badgeSection: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 1,
    maxWidth: '45%',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    padding: 10,
  },
  coverContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    borderRadius: 8,
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
    justifyContent: 'center',
  },
  artistRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    marginBottom: 1,
    overflow: 'hidden',
  },
  artistItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artist: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    textShadowColor: `${Colors.dark.primary}60`,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  artistSeparator: {
    fontSize: 11,
    fontWeight: '400' as const,
    color: Colors.dark.primary,
    opacity: 0.4,
    marginHorizontal: 6,
  },
  artistMoreBadge: {
    backgroundColor: `${Colors.dark.primary}25`,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  artistMoreText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  name: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 17,
    marginBottom: 4,
  },
  footer: {
    marginTop: 'auto',
  },
  venueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${Colors.dark.primary}18`,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 80,
    flexShrink: 1,
  },
  venueBadgeText: {
    fontSize: 8,
    color: Colors.dark.primary,
    fontWeight: '600' as const,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 70,
    flexShrink: 1,
  },
  locationBadgeText: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tracksStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statText: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
  },
  eventDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${Colors.dark.primary}12`,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventDateText: {
    fontSize: 9,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  platforms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  needsSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  needsSourceText: {
    fontSize: 9,
    color: Colors.dark.primary,
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
