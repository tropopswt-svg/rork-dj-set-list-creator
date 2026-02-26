import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Music, MapPin, Youtube, Music2, Sparkles, MessageSquare } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SetList } from '@/types';
import { getFallbackImage, getVenueImage } from '@/utils/coverImage';

interface SetListCardProps {
  setList: SetList;
  onPress?: () => void;
  large?: boolean;
}

export default function SetListCard({ setList, onPress, large }: SetListCardProps) {
  const [imageError, setImageError] = useState(false);
  const [triedHqFallback, setTriedHqFallback] = useState(false);

  const getCoverImage = useCallback((): string | null => {
    if (setList.coverUrl) {
      if (imageError && setList.coverUrl.includes('maxresdefault')) {
        if (!triedHqFallback) return setList.coverUrl.replace('maxresdefault', 'hqdefault');
        return null;
      }
      return setList.coverUrl;
    }
    return null;
  }, [setList.coverUrl, imageError, triedHqFallback]);

  const handleImageError = useCallback(() => {
    console.log(`[SetListCard] Image error for set: ${setList.name}`);
    if (!triedHqFallback && setList.coverUrl?.includes('maxresdefault')) {
      console.log('[SetListCard] Trying hqdefault fallback');
      setTriedHqFallback(true);
      setImageError(true);
    } else {
      console.log('[SetListCard] Using stock fallback image');
      setTriedHqFallback(true);
      setImageError(true);
    }
  }, [triedHqFallback, setList.coverUrl, setList.name]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const getPlatformIcon = () => {
    switch (setList.sourcePlatform) {
      case 'youtube':
        return <Youtube size={12} color="#FF0000" />;
      case 'soundcloud':
        return <Music2 size={12} color="#FF5500" />;
      default:
        return null;
    }
  };

  if (large) {
    return (
      <Pressable style={styles.largeContainer} onPress={handlePress}>
        {getCoverImage() ? (
          <Image
            source={{ uri: getCoverImage()! }}
            style={styles.largeCover}
            onError={handleImageError}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={250}
          />
        ) : (
          <View style={[styles.largeCover, { backgroundColor: Colors.dark.surface }]} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.9)']}
          style={styles.largeGradient}
        >
          <View style={styles.largeContent}>
            {setList.sourcePlatform && (
              <View style={styles.platformBadgeLarge}>
                {getPlatformIcon()}
              </View>
            )}
            <Text style={styles.largeName} numberOfLines={1}>{setList.name}</Text>
            <View style={styles.largeMetaRow}>
              {setList.venue && (
                <View style={styles.metaItem}>
                  <MapPin size={12} color={Colors.dark.primary} />
                  <Text style={styles.metaText}>{setList.venue}</Text>
                </View>
              )}
              {setList.aiProcessed && (
                <View style={styles.metaItem}>
                  <Sparkles size={12} color={Colors.dark.primary} />
                  <Text style={styles.metaText}>AI Built</Text>
                </View>
              )}
            </View>
            <View style={styles.bottomRowLarge}>
              <View style={styles.trackCount}>
                <Music size={12} color={Colors.dark.text} />
                <Text style={styles.trackCountText}>{setList.trackCount || setList.tracks.length} tracks</Text>
              </View>
              {setList.commentsScraped && (
                <View style={styles.commentsCount}>
                  <MessageSquare size={10} color={Colors.dark.textSecondary} />
                  <Text style={styles.commentsCountText}>{setList.commentsScraped}</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.coverContainer}>
        {getCoverImage() ? (
          <Image
            source={{ uri: getCoverImage()! }}
            style={styles.cover}
            onError={handleImageError}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={250}
          />
        ) : (
          <View style={[styles.cover, { backgroundColor: Colors.dark.surface }]} />
        )}
        {setList.sourcePlatform && (
          <View style={styles.platformBadge}>
            {setList.sourcePlatform === 'youtube' ? (
              <Youtube size={10} color="#FF0000" />
            ) : (
              <Music2 size={10} color="#FF5500" />
            )}
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{setList.name}</Text>
        {setList.venue && (
          <View style={styles.venueRow}>
            <MapPin size={11} color={Colors.dark.textMuted} />
            <Text style={styles.venue} numberOfLines={1}>{setList.venue}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.date}>{formatDate(setList.date)}</Text>
          {setList.aiProcessed && (
            <View style={styles.aiTag}>
              <Sparkles size={10} color={Colors.dark.primary} />
              <Text style={styles.aiTagText}>AI</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{setList.trackCount || setList.tracks.length}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 10,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  platformBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 3,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 3,
  },
  venue: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  date: {
    color: Colors.dark.textMuted,
    fontSize: 10,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(206, 138, 75, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  badge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  largeContainer: {
    width: 240,
    height: 155,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  largeCover: {
    width: '100%',
    height: '100%',
  },
  largeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    justifyContent: 'flex-end',
    padding: 12,
  },
  largeContent: {},
  platformBadgeLarge: {
    position: 'absolute',
    top: -55,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 5,
  },
  largeMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
  },
  bottomRowLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trackCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500' as const,
  },
  commentsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  commentsCountText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '500' as const,
  },
});
