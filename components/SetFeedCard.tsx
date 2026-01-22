import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Play, Music, Youtube, Music2, Radio, ListMusic, Clock, MessageSquare } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SetList } from '@/types';

interface SetFeedCardProps {
  setList: SetList;
  onPress?: () => void;
}

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

  const getPlatformIcons = () => {
    const platforms = setList.sourceLinks.map(l => l.platform);
    const unique = [...new Set(platforms)];
    
    return unique.slice(0, 3).map((platform, index) => {
      const iconProps = { size: 11 };
      switch (platform) {
        case 'youtube':
          return <Youtube key={index} {...iconProps} color="#FF0000" />;
        case 'soundcloud':
          return <Music2 key={index} {...iconProps} color="#FF5500" />;
        case 'mixcloud':
          return <Radio key={index} {...iconProps} color="#5000FF" />;
        case '1001tracklists':
          return <ListMusic key={index} {...iconProps} color={Colors.dark.primary} />;
        default:
          return null;
      }
    });
  };

  return (
    <Pressable 
      style={({ pressed }) => [styles.container, pressed && styles.pressed]} 
      onPress={handlePress}
    >
      <View style={styles.row}>
        <View style={styles.coverContainer}>
          <Image 
            source={{ uri: setList.coverUrl || 'https://i1.sndcdn.com/artworks-000149102513-l3t2u4-t500x500.jpg' }} 
            style={styles.cover}
          />
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Play size={16} color="#fff" fill="#fff" />
            </View>
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(setList.totalDuration || 0)}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.artist}>{setList.artist}</Text>
          <Text style={styles.name} numberOfLines={2}>{setList.name}</Text>
          
          {setList.venue && (
            <Text style={styles.venue} numberOfLines={1}>{setList.venue}</Text>
          )}

          <View style={styles.footer}>
            <View style={styles.stats}>
              {setList.plays && setList.plays > 0 && (
                <Text style={styles.statText}>{formatPlays(setList.plays)}</Text>
              )}
              <View style={styles.tracksStat}>
                <Music size={10} color={Colors.dark.textMuted} />
                <Text style={styles.statText}>{setList.tracksIdentified || setList.tracks.length}</Text>
              </View>
              {setList.commentsScraped && setList.commentsScraped > 0 && (
                <View style={styles.tracksStat}>
                  <MessageSquare size={10} color={Colors.dark.textMuted} />
                  <Text style={styles.statText}>{setList.commentsScraped}</Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              <View style={styles.platforms}>
                {getPlatformIcons()}
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
    marginBottom: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  row: {
    flexDirection: 'row',
    padding: 12,
  },
  coverContainer: {
    position: 'relative',
    width: 100,
    height: 100,
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
    backgroundColor: 'rgba(0,0,0,0.25)',
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
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 10,
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
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 18,
    marginBottom: 2,
  },
  venue: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  footer: {
    marginTop: 'auto',
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
    fontSize: 11,
    color: Colors.dark.textMuted,
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
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
});
