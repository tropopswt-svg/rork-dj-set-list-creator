import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Music, Calendar, MapPin, Youtube, Music2, Sparkles, MessageSquare } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SetList } from '@/types';

interface SetListCardProps {
  setList: SetList;
  onPress?: () => void;
  large?: boolean;
}

export default function SetListCard({ setList, onPress, large }: SetListCardProps) {
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
        <Image 
          source={{ uri: setList.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop' }} 
          style={styles.largeCover}
        />
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
                <Text style={styles.trackCountText}>{setList.tracks.length} tracks</Text>
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
        <Image 
          source={{ uri: setList.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop' }} 
          style={styles.cover}
        />
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
        <Text style={styles.badgeText}>{setList.tracks.length}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: 68,
    height: 68,
    borderRadius: 12,
  },
  platformBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  venue: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    color: Colors.dark.textMuted,
    fontSize: 11,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  badge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: Colors.dark.background,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  largeContainer: {
    width: 260,
    height: 170,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 14,
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
    padding: 14,
  },
  largeContent: {},
  platformBadgeLarge: {
    position: 'absolute',
    top: -60,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeName: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  largeMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
  },
  bottomRowLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  trackCountText: {
    color: Colors.dark.text,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  commentsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  commentsCountText: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
    fontWeight: '500' as const,
  },
});
