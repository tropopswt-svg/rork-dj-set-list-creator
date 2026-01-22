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
      const iconProps = { size: 12 };
      switch (platform) {
        case 'youtube':
          return <Youtube key={index} {...iconProps} color="#FF0000" />;
        case 'soundcloud':
          return <Music2 key={index} {...iconProps} color="#FF5500" />;
        case 'mixcloud':
          return <Radio key={index} {...iconProps} color="#5000FF" />;
        case '1001tracklists':
          return <ListMusic key={index} {...iconProps} color="#00D4AA" />;
        default:
          return null;
      }
    });
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.coverContainer}>
        <Image 
          source={{ uri: setList.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop' }} 
          style={styles.cover}
        />
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Play size={20} color={Colors.dark.text} fill={Colors.dark.text} />
          </View>
        </View>
        <View style={styles.durationBadge}>
          <Clock size={10} color={Colors.dark.text} />
          <Text style={styles.durationText}>{formatDuration(setList.totalDuration || 0)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.artist}>{setList.artist}</Text>
          <Text style={styles.date}>{formatDate(setList.date)}</Text>
        </View>

        <Text style={styles.name} numberOfLines={2}>{setList.name}</Text>
        
        {setList.venue && (
          <Text style={styles.venue} numberOfLines={1}>{setList.venue}</Text>
        )}

        <View style={styles.footer}>
          <View style={styles.stats}>
            {setList.plays && setList.plays > 0 && (
              <Text style={styles.statText}>{formatPlays(setList.plays)} plays</Text>
            )}
            <View style={styles.tracksStat}>
              <Music size={12} color={Colors.dark.textMuted} />
              <Text style={styles.statText}>{setList.tracksIdentified || setList.tracks.length} tracks</Text>
            </View>
            {setList.commentsScraped && setList.commentsScraped > 0 && (
              <View style={styles.tracksStat}>
                <MessageSquare size={12} color={Colors.dark.textMuted} />
                <Text style={styles.statText}>{setList.commentsScraped}</Text>
              </View>
            )}
          </View>

          <View style={styles.platforms}>
            {getPlatformIcons()}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverContainer: {
    position: 'relative',
    height: 180,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  content: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  artist: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  date: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  name: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  venue: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tracksStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  platforms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
