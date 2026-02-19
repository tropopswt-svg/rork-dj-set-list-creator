import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { HelpCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Track } from '@/types';

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_WIDTH = screenWidth - 48; // 24px padding on each side

// Generate procedural waveform bar heights
const generateBars = (count: number, seed: number = 0) => {
  return Array.from({ length: count }, (_, i) => {
    const noise1 = Math.sin((i + seed) * 0.8) * 0.3;
    const noise2 = Math.sin((i + seed) * 1.7) * 0.2;
    const noise3 = Math.sin((i + seed) * 0.3) * 0.25;
    const baseHeight = 0.35 + Math.abs(noise1 + noise2 + noise3);
    return Math.min(1, baseHeight);
  });
};

interface WaveformTimelineProps {
  tracks: Track[];
  totalDuration: number;
  onGapPress?: (timestamp: number) => void;
}

interface Segment {
  type: 'identified' | 'gap';
  startTime: number;
  endTime: number;
  track?: Track;
}

export default function WaveformTimeline({ tracks, totalDuration, onGapPress }: WaveformTimelineProps) {
  const segments = useMemo(() => {
    if (!tracks.length || totalDuration <= 0) return [];

    // Sort tracks by timestamp
    const sorted = [...tracks]
      .filter(t => t.timestamp !== undefined && t.timestamp >= 0)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (!sorted.length) return [];

    const segs: Segment[] = [];
    const avgTrackDuration = 210; // ~3.5 min

    // Gap before first track
    const firstTimestamp = sorted[0].timestamp || 0;
    if (firstTimestamp > 60) {
      segs.push({ type: 'gap', startTime: 0, endTime: firstTimestamp });
    }

    // Process each track
    for (let i = 0; i < sorted.length; i++) {
      const track = sorted[i];
      const timestamp = track.timestamp || 0;
      const isId = track.isId || track.title?.toLowerCase() === 'id';
      const nextTimestamp = i < sorted.length - 1
        ? (sorted[i + 1].timestamp || 0)
        : Math.min(timestamp + avgTrackDuration, totalDuration);

      const trackEnd = Math.min(nextTimestamp, timestamp + avgTrackDuration);

      segs.push({
        type: isId ? 'gap' : 'identified',
        startTime: timestamp,
        endTime: trackEnd,
        track,
      });

      // Gap between this track and next
      if (trackEnd < nextTimestamp && nextTimestamp - trackEnd > 60) {
        segs.push({ type: 'gap', startTime: trackEnd, endTime: nextTimestamp });
      }
    }

    // Gap after last track
    const lastTrack = sorted[sorted.length - 1];
    const lastEnd = (lastTrack.timestamp || 0) + avgTrackDuration;
    if (lastEnd < totalDuration - 60) {
      segs.push({ type: 'gap', startTime: lastEnd, endTime: totalDuration });
    }

    return segs;
  }, [tracks, totalDuration]);

  // Time markers
  const timeMarkers = useMemo(() => {
    if (totalDuration <= 0) return [];
    const interval = totalDuration > 3600 ? 1800 : 900; // 30min or 15min
    const markers: number[] = [];
    for (let t = interval; t < totalDuration; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration]);

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}`;
    return `${mins}m`;
  };

  if (!segments.length || totalDuration <= 0) return null;

  const identifiedCount = tracks.filter(t => !t.isId && t.title?.toLowerCase() !== 'id').length;
  const unidentifiedCount = tracks.filter(t => t.isId || t.title?.toLowerCase() === 'id').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Set Timeline</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.dark.success }]} />
            <Text style={styles.legendText}>{identifiedCount} ID'd</Text>
          </View>
          {unidentifiedCount > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.dark.primary }]} />
              <Text style={styles.legendText}>{unidentifiedCount} Unknown</Text>
            </View>
          )}
        </View>
      </View>

      {/* Waveform bar */}
      <View style={styles.waveformContainer}>
        {segments.map((seg, idx) => {
          const widthFraction = (seg.endTime - seg.startTime) / totalDuration;
          const segWidth = Math.max(2, widthFraction * TIMELINE_WIDTH);
          const barCount = Math.max(2, Math.floor(segWidth / 4));
          const bars = generateBars(barCount, idx * 7);
          const isGap = seg.type === 'gap';

          const SegmentWrapper = isGap && onGapPress ? Pressable : View;
          const wrapperProps = isGap && onGapPress ? {
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onGapPress(seg.startTime);
            },
          } : {};

          return (
            <SegmentWrapper
              key={`seg-${idx}`}
              style={[styles.segment, { width: segWidth }]}
              {...wrapperProps}
            >
              <View style={styles.barsContainer}>
                {bars.map((height, barIdx) => (
                  <View
                    key={barIdx}
                    style={[
                      styles.bar,
                      {
                        height: height * 28,
                        backgroundColor: isGap
                          ? 'rgba(196, 30, 58, 0.5)'
                          : 'rgba(74, 222, 128, 0.7)',
                      },
                    ]}
                  />
                ))}
              </View>
              {isGap && onGapPress && segWidth > 20 && (
                <View style={styles.gapIcon}>
                  <HelpCircle size={10} color={Colors.dark.primary} />
                </View>
              )}
            </SegmentWrapper>
          );
        })}
      </View>

      {/* Time markers */}
      <View style={styles.markersContainer}>
        <Text style={styles.markerText}>0:00</Text>
        {timeMarkers.map(t => (
          <Text
            key={t}
            style={[
              styles.markerText,
              { position: 'absolute', left: (t / totalDuration) * TIMELINE_WIDTH - 12 },
            ]}
          >
            {formatTime(t)}
          </Text>
        ))}
        <Text style={[styles.markerText, { position: 'absolute', right: 0 }]}>
          {formatTime(totalDuration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 1,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  gapIcon: {
    position: 'absolute',
    bottom: 0,
  },
  markersContainer: {
    flexDirection: 'row',
    height: 16,
    marginTop: 4,
    position: 'relative',
  },
  markerText: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
