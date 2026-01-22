import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  Pressable, 
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { 
  X, 
  Radio, 
  Music2, 
  CheckCircle, 
  AlertCircle,
  Disc3,
  ExternalLink,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface IdentifiedTrack {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  label?: string;
  confidence: number;
  duration?: number;
  links: {
    spotify?: string;
    youtube?: string;
    isrc?: string;
  };
}

interface IdentifyTrackModalProps {
  visible: boolean;
  onClose: () => void;
  onIdentified: (track: IdentifiedTrack, timestamp: number) => void;
  timestamp?: number;
  setTitle?: string;
  audioUrl?: string;
}

export default function IdentifyTrackModal({
  visible,
  onClose,
  onIdentified,
  timestamp: initialTimestamp = 0,
  setTitle,
  audioUrl,
}: IdentifyTrackModalProps) {
  const [timestamp, setTimestamp] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifiedTrack, setIdentifiedTrack] = useState<IdentifiedTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const identifyMutation = trpc.scraper.identifyTrackFromUrl.useMutation();

  useEffect(() => {
    if (visible) {
      const mins = Math.floor(initialTimestamp / 60);
      const secs = initialTimestamp % 60;
      setTimestamp(`${mins}:${secs.toString().padStart(2, '0')}`);
      setIdentifiedTrack(null);
      setError(null);
      setNoMatch(false);
    }
  }, [visible, initialTimestamp]);

  useEffect(() => {
    if (isIdentifying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isIdentifying]);

  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parseInt(ts) || 0;
  };

  const handleIdentify = async () => {
    if (!audioUrl) {
      setError('No audio source available for this set. Try adding the track manually.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsIdentifying(true);
    setError(null);
    setNoMatch(false);
    setIdentifiedTrack(null);

    const startSeconds = parseTimestamp(timestamp);
    console.log(`[Identify] Starting identification at ${startSeconds}s from ${audioUrl}`);

    try {
      const result = await identifyMutation.mutateAsync({
        audioUrl,
        startSeconds,
        durationSeconds: 15,
      });

      if (result.success && result.result) {
        console.log('[Identify] Track identified:', result.result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIdentifiedTrack(result.result);
      } else if (result.success && !result.result) {
        console.log('[Identify] No match found');
        setNoMatch(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        console.error('[Identify] Error:', result.error);
        setError(result.error || 'Failed to identify track');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      console.error('[Identify] Request failed:', err);
      setError('Failed to connect to identification service');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleConfirm = () => {
    if (identifiedTrack) {
      onIdentified(identifiedTrack, parseTimestamp(timestamp));
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Identify Track</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={24} color={Colors.dark.textSecondary} />
            </Pressable>
          </View>

          {setTitle && (
            <Text style={styles.setTitle}>From: {setTitle}</Text>
          )}

          <View style={styles.timestampSection}>
            <Text style={styles.label}>Timestamp</Text>
            <TextInput
              style={styles.timestampInput}
              value={timestamp}
              onChangeText={setTimestamp}
              placeholder="0:00"
              placeholderTextColor={Colors.dark.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.hint}>
              Enter the time in the set where you want to identify a track
            </Text>
          </View>

          {!identifiedTrack && !isIdentifying && !noMatch && !error && (
            <Pressable 
              style={styles.identifyButton}
              onPress={handleIdentify}
            >
              <Radio size={20} color={Colors.dark.background} />
              <Text style={styles.identifyButtonText}>Identify Track</Text>
            </Pressable>
          )}

          {isIdentifying && (
            <View style={styles.identifyingContainer}>
              <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
                <Radio size={32} color={Colors.dark.primary} />
              </Animated.View>
              <Text style={styles.identifyingText}>Listening...</Text>
              <Text style={styles.identifyingSubtext}>
                Analyzing audio at {timestamp}
              </Text>
              <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 16 }} />
            </View>
          )}

          {noMatch && (
            <View style={styles.resultContainer}>
              <View style={styles.noMatchIcon}>
                <AlertCircle size={32} color="#F59E0B" />
              </View>
              <Text style={styles.noMatchText}>No Match Found</Text>
              <Text style={styles.noMatchSubtext}>
                The track couldn't be identified. This might be an unreleased track, mashup, or remix.
              </Text>
              <Pressable 
                style={styles.retryButton}
                onPress={() => {
                  setNoMatch(false);
                }}
              >
                <Text style={styles.retryButtonText}>Try Different Timestamp</Text>
              </Pressable>
            </View>
          )}

          {error && (
            <View style={styles.resultContainer}>
              <View style={styles.errorIcon}>
                <AlertCircle size={32} color={Colors.dark.error} />
              </View>
              <Text style={styles.errorText}>Identification Failed</Text>
              <Text style={styles.errorSubtext}>{error}</Text>
              <Pressable 
                style={styles.retryButton}
                onPress={() => {
                  setError(null);
                }}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          )}

          {identifiedTrack && (
            <View style={styles.resultContainer}>
              <View style={styles.successIcon}>
                <CheckCircle size={32} color={Colors.dark.success} />
              </View>
              <Text style={styles.successText}>Track Identified!</Text>
              
              <View style={styles.trackCard}>
                <View style={styles.trackCoverPlaceholder}>
                  <Disc3 size={32} color={Colors.dark.primary} />
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={2}>
                    {identifiedTrack.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {identifiedTrack.artist}
                  </Text>
                  {identifiedTrack.album && (
                    <Text style={styles.trackAlbum} numberOfLines={1}>
                      {identifiedTrack.album}
                    </Text>
                  )}
                  {identifiedTrack.label && (
                    <Text style={styles.trackLabel}>{identifiedTrack.label}</Text>
                  )}
                </View>
              </View>

              <View style={styles.confidenceBadge}>
                <Sparkles size={14} color={Colors.dark.primary} />
                <Text style={styles.confidenceText}>
                  {identifiedTrack.confidence}% confidence
                </Text>
              </View>

              {(identifiedTrack.links.spotify || identifiedTrack.links.youtube) && (
                <View style={styles.linksRow}>
                  {identifiedTrack.links.spotify && (
                    <Pressable 
                      style={styles.linkChip}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          const Linking = require('react-native').Linking;
                          Linking.openURL(identifiedTrack.links.spotify!);
                        }
                      }}
                    >
                      <Music2 size={14} color="#1DB954" />
                      <Text style={styles.linkChipText}>Spotify</Text>
                      <ExternalLink size={12} color={Colors.dark.textMuted} />
                    </Pressable>
                  )}
                  {identifiedTrack.links.youtube && (
                    <Pressable 
                      style={styles.linkChip}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          const Linking = require('react-native').Linking;
                          Linking.openURL(identifiedTrack.links.youtube!);
                        }
                      }}
                    >
                      <Music2 size={14} color="#FF0000" />
                      <Text style={styles.linkChipText}>YouTube</Text>
                      <ExternalLink size={12} color={Colors.dark.textMuted} />
                    </Pressable>
                  )}
                </View>
              )}

              <Pressable 
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <CheckCircle size={18} color={Colors.dark.background} />
                <Text style={styles.confirmButtonText}>Add to Tracklist</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  setTitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginBottom: 20,
  },
  timestampSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  timestampInput: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  identifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  identifyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.background,
  },
  identifyingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  pulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  identifyingText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  identifyingSubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  resultContainer: {
    alignItems: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 20,
  },
  noMatchIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noMatchText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  noMatchSubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  trackCard: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    borderRadius: 14,
    padding: 14,
    width: '100%',
    gap: 14,
    marginBottom: 12,
  },
  trackCoverPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
  },
  trackAlbum: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  trackLabel: {
    fontSize: 11,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.primary,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  linkChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.text,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.background,
  },
});
