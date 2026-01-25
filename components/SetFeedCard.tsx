import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Play, Music, Youtube, Music2, ListMusic, MessageSquare, AlertCircle, Calendar, MapPin, Ticket } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SetList } from '@/types';

interface SetFeedCardProps {
  setList: SetList;
  onPress?: () => void;
}

const coverImages = [
  'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=400&h=400&fit=crop',
];

export default function SetFeedCard({ setList, onPress }: SetFeedCardProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatPlays = (plays: number) => {
    if (plays >= 1000000) return `${(plays / 1000000).toFixed(1)}M`;
    if (plays >= 1000) return `${(plays / 1000).toFixed(0)}K`;
    return plays.toString();
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  // Parse set name to extract venue, location, and date
  // Format: "Artist @ Venue/Event, Location YYYY-MM-DD" or "Event Name YYYY-MM-DD"
  const parseSetName = (name: string) => {
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

    // Now parse venue and location from the remaining name
    // Pattern: "Artist @ Venue, City, Country" or "Venue, City, Country" or "Event - Venue"
    const atMatch = workingName.match(/@\s*(.+)$/);
    if (atMatch) {
      const afterAt = atMatch[1].trim();
      // Split by comma to get venue and location parts
      const parts = afterAt.split(',').map(p => p.trim());

      if (parts.length >= 2) {
        // First part is venue, rest is location
        venue = parts[0];
        location = parts.slice(1).join(', ');
      } else if (parts.length === 1) {
        // Just venue, no separate location
        venue = parts[0];
      }

      // Clean name is everything before @
      workingName = workingName.replace(/@\s*.+$/, '').trim();
    } else {
      // No @ symbol - try splitting by comma for radio shows etc
      // e.g., "Marsolo - Circoloco Radio 429"
      const dashMatch = workingName.match(/^(.+?)\s*-\s*(.+)$/);
      if (dashMatch) {
        venue = dashMatch[2].trim();
        workingName = dashMatch[1].trim();
      }
    }

    return { cleanName: workingName, eventDate, venue, location };
  };

  // Format event date for display (e.g., "May 26, 2025")
  const formatEventDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const { cleanName, eventDate, venue, location } = parseSetName(setList.name);

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
      const iconProps = { size: 12 };
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

  return (
    <Pressable 
      style={({ pressed }) => [styles.container, pressed && styles.pressed]} 
      onPress={handlePress}
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
              <Play size={18} color="#fff" fill="#fff" />
            </View>
          </View>
          {(setList.totalDuration || 0) > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(setList.totalDuration)}</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.artist}>{setList.artist}</Text>
          <Text style={styles.name} numberOfLines={2}>{cleanName || setList.name}</Text>

          <View style={styles.footer}>
            {/* Venue and Location badges row */}
            <View style={styles.badgesRow}>
              {venue && (
                <View style={styles.venueBadge}>
                  <Ticket size={9} color={Colors.dark.primary} />
                  <Text style={styles.venueBadgeText} numberOfLines={1}>{venue}</Text>
                </View>
              )}
              {location && (
                <View style={styles.locationBadge}>
                  <MapPin size={9} color="#6B7280" />
                  <Text style={styles.locationBadgeText} numberOfLines={1}>{location}</Text>
                </View>
              )}
            </View>

            <View style={styles.stats}>
              {eventDate && (
                <View style={styles.eventDateBadge}>
                  <Calendar size={10} color={Colors.dark.primary} />
                  <Text style={styles.eventDateText}>{formatEventDate(eventDate)}</Text>
                </View>
              )}
              <View style={styles.tracksStat}>
                <Music size={11} color={Colors.dark.textMuted} />
                <Text style={styles.statText}>{setList.tracksIdentified || setList.trackCount || setList.tracks?.length || 0}</Text>
              </View>
              {setList.commentsScraped && setList.commentsScraped > 0 && (
                <View style={styles.tracksStat}>
                  <MessageSquare size={11} color={Colors.dark.textMuted} />
                  <Text style={styles.statText}>{setList.commentsScraped}</Text>
                </View>
              )}
            </View>
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
              <Text style={styles.date}>{formatDate(setList.date)}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  row: {
    flexDirection: 'row',
    padding: 10,
  },
  coverContainer: {
    position: 'relative',
    width: 85,
    height: 85,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  durationText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#fff',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  artist: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    marginBottom: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 18,
    marginBottom: 1,
  },
  footer: {
    marginTop: 'auto',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  venueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${Colors.dark.primary}12`,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '60%',
  },
  venueBadgeText: {
    fontSize: 9,
    color: Colors.dark.primary,
    fontWeight: '600' as const,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '50%',
  },
  locationBadgeText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  tracksStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
  },
  eventDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.dark.primary}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventDateText: {
    fontSize: 10,
    color: Colors.dark.primary,
    fontWeight: '600' as const,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  platforms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  date: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
  },
  needsSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  needsSourceText: {
    fontSize: 9,
    color: Colors.dark.primary,
    fontWeight: '600' as const,
  },
});
