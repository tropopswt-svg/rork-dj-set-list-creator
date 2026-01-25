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
  KeyboardAvoidingView,
  ScrollView,
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
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifiedTrack, setIdentifiedTrack] = useState<IdentifiedTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const identifyMutation = trpc.scraper.identifyTrackFromUrl.useMutation();

  useEffect(() => {
    if (visible) {
      const totalSeconds = initialTimestamp;
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      
      setHours(hrs > 0 ? hrs.toString() : '');
      setMinutes(mins.toString());
      setSeconds(secs.toString().padStart(2, '0'));
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

  const parseTimestamp = (): number => {
    const hrs = parseInt(hours) || 0;
    const mins = parseInt(minutes) || 0;
    const secs = parseInt(seconds) || 0;
    return hrs * 3600 + mins * 60 + secs;
  };

  const formatTimestamp = (): string => {
    const hrs = parseInt(hours) || 0;
    const mins = parseInt(minutes) || 0;
    const secs = parseInt(seconds) || 0;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleHoursChange = (text: string) => {
    const num = text.replace(/[^0-9]/g, '');
    if (num === '') {
      setHours('');
      return;
    }
    const val = parseInt(num);
    // Limit to max 3 hours (reasonable for a DJ set)
    if (val <= 3) {
      setHours(num);
    }
  };

  const handleMinutesChange = (text: string) => {
    const num = text.replace(/[^0-9]/g, '');
    if (num === '') {
      setMinutes('');
      return;
    }
    const val = parseInt(num);
    // Limit to max 59 minutes
    if (val <= 59) {
      setMinutes(num);
    }
  };

  const handleSecondsChange = (text: string) => {
    const num = text.replace(/[^0-9]/g, '');
    if (num === '') {
      setSeconds('');
      return;
    }
    const val = parseInt(num);
    // Limit to max 59 seconds
    if (val <= 59) {
      setSeconds(num.padStart(2, '0'));
    }
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

    const startSeconds = parseTimestamp();
    console.log(`[Identify] Starting identification at ${startSeconds}s (${formatTimestamp()}) from ${audioUrl}`);

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
        // Show more detailed error message to help debug
        let errorMessage = result.error || 'Failed to identify track';
        if (result.error?.includes('Could not resolve')) {
          errorMessage = `${result.error}\n\nCheck:\n- YouTube: Is yt-dlp installed? (YT_DLP_PATH in .env)\n- SoundCloud: Is SOUNDCLOUD_CLIENT_ID set?`;
        } else if (result.error?.includes('ACRCloud')) {
          errorMessage = `${result.error}\n\nPossible causes:\n- Stream URL not accessible to ACRCloud\n- Track not in ACRCloud database\n- Network/API issue`;
        }
        setError(errorMessage);
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
      onIdentified(identifiedTrack, parseTimestamp());
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
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayInner} onPress={onClose}>
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
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
                <View style={styles.timestampInputs}>
                  <View style={styles.timestampField}>
                    <TextInput
                      style={[styles.timestampInput, !hours && styles.timestampInputOptional]}
                      value={hours}
                      onChangeText={handleHoursChange}
                      placeholder="0"
                      placeholderTextColor={Colors.dark.textMuted}
                      keyboardType="number-pad"
                      maxLength={1}
                    />
                    <Text style={styles.timestampLabel}>hr</Text>
                  </View>
                  <Text style={styles.timestampColon}>:</Text>
                  <View style={styles.timestampField}>
                    <TextInput
                      style={styles.timestampInput}
                      value={minutes}
                      onChangeText={handleMinutesChange}
                      placeholder="0"
                      placeholderTextColor={Colors.dark.textMuted}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.timestampLabel}>min</Text>
                  </View>
                  <Text style={styles.timestampColon}>:</Text>
                  <View style={styles.timestampField}>
                    <TextInput
                      style={styles.timestampInput}
                      value={seconds}
                      onChangeText={handleSecondsChange}
                      placeholder="00"
                      placeholderTextColor={Colors.dark.textMuted}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.timestampLabel}>sec</Text>
                  </View>
                </View>
                <Text style={styles.hint}>
                  Enter the time in the set where you want to identify a track (max 3 hours)
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
                Analyzing audio at {formatTimestamp()}
              </Text>
              <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 16 }} />
            </View>
          )}

          {noMatch && (
            <View style={styles.resultContainer}>
              <View style={styles.noMatchIcon}>
                <AlertCircle size={32} color="#cd6a6f" />
              </View>
              <Text style={styles.noMatchText}>No Match Found</Text>
              <Text style={styles.noMatchSubtext}>
                The track couldn&apos;t be identified. This might be an unreleased track, mashup, or remix.
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
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayInner: {
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
    maxHeight: '90%',
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
  timestampInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timestampField: {
    alignItems: 'center',
  },
  timestampInput: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 16,
    width: 80,
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  timestampInputOptional: {
    opacity: 0.6,
  },
  timestampLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 4,
    fontWeight: '500' as const,
  },
  timestampColon: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
    marginHorizontal: 4,
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
    backgroundColor: 'rgba(205, 106, 111, 0.15)',
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
