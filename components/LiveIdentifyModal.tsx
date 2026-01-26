import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import {
  X,
  Radio,
  CheckCircle,
  AlertCircle,
  Disc3,
  ExternalLink,
  Music2,
  RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

const { width } = Dimensions.get('window');

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

interface LiveIdentifyModalProps {
  visible: boolean;
  onClose: () => void;
  onTrackIdentified?: (track: IdentifiedTrack) => void;
}

type IdentifyState = 'idle' | 'recording' | 'analyzing' | 'success' | 'no_match' | 'error';

const RECORDING_DURATION_MS = 10000; // 10 seconds recording

export default function LiveIdentifyModal({
  visible,
  onClose,
  onTrackIdentified,
}: LiveIdentifyModalProps) {
  const [state, setState] = useState<IdentifyState>('idle');
  const [progress, setProgress] = useState(0);
  const [identifiedTrack, setIdentifiedTrack] = useState<IdentifiedTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const identifyMutation = trpc.scraper.identifyTrackFromAudio.useMutation();

  // Request microphone permission
  useEffect(() => {
    if (visible) {
      (async () => {
        const { status } = await Audio.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        if (status !== 'granted') {
          setError('Microphone permission is required to identify tracks');
          setState('error');
        }
      })();
    }
  }, [visible]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setState('idle');
      setProgress(0);
      setIdentifiedTrack(null);
      setError(null);

      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
      stopRecording();
    }
  }, [visible]);

  // Wave animations for recording state
  useEffect(() => {
    if (state === 'recording' || state === 'analyzing') {
      // Pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Wave animations
      const animateWave = (anim: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      animateWave(waveAnim1, 0);
      animateWave(waveAnim2, 500);
      animateWave(waveAnim3, 1000);
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      waveAnim1.stopAnimation();
      waveAnim2.stopAnimation();
      waveAnim3.stopAnimation();
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      waveAnim3.setValue(0);
    }

    return () => {
      pulseAnim.stopAnimation();
      waveAnim1.stopAnimation();
      waveAnim2.stopAnimation();
      waveAnim3.stopAnimation();
    };
  }, [state]);

  const stopRecording = useCallback(async () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {
        // Recording may already be stopped
      }
      recordingRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    // Check if we're on web - audio recording doesn't work there
    if (Platform.OS === 'web') {
      setError('Audio recording is not available on web. Please use the Expo Go app on your phone to test this feature.');
      setState('error');
      return;
    }

    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant microphone permission to identify tracks.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setState('recording');
      setProgress(0);
      setError(null);
      setIdentifiedTrack(null);

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      // Progress timer
      const startTime = Date.now();
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min(elapsed / RECORDING_DURATION_MS, 1);
        setProgress(newProgress);

        if (elapsed >= RECORDING_DURATION_MS) {
          finishRecording();
        }
      }, 100);

    } catch (err) {
      console.error('[LiveIdentify] Failed to start recording:', err);
      setError('Failed to start recording. Please try again.');
      setState('error');
    }
  };

  const finishRecording = async () => {
    if (!recordingRef.current) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setState('analyzing');
      setProgress(1);

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }

      if (!uri) {
        throw new Error('No recording URI available');
      }

      console.log('[LiveIdentify] Recording saved to:', uri);

      // Read the audio file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      console.log('[LiveIdentify] Audio file size:', Math.round(base64Audio.length / 1024), 'KB');

      // Send to backend for identification
      const result = await identifyMutation.mutateAsync({
        audioBase64: base64Audio,
        audioFormat: Platform.OS === 'ios' ? 'm4a' : 'mp4',
      });

      if (result.success && result.result) {
        console.log('[LiveIdentify] Track identified:', result.result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIdentifiedTrack(result.result);
        setState('success');
        onTrackIdentified?.(result.result);
      } else if (result.success && !result.result) {
        console.log('[LiveIdentify] No match found');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setState('no_match');
      } else {
        console.error('[LiveIdentify] Error:', result.error);
        setError(result.error || 'Failed to identify track');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setState('error');
      }

      // Clean up the audio file
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (e) {
        // Ignore cleanup errors
      }

    } catch (err) {
      console.error('[LiveIdentify] Error during identification:', err);
      setError('Failed to identify track. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setState('error');
    }
  };

  const handleTryAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState('idle');
    setProgress(0);
    setIdentifiedTrack(null);
    setError(null);
  };

  const handleClose = () => {
    stopRecording();
    onClose();
  };

  const renderContent = () => {
    switch (state) {
      case 'idle':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.instructionText}>
              Tap to start listening
            </Text>
            <Pressable style={styles.idButton} onPress={startRecording}>
              <View style={styles.idButtonInner}>
                <Text style={styles.idButtonText}>ID</Text>
              </View>
            </Pressable>
            <Text style={styles.hintText}>
              Hold your phone near the music source
            </Text>
          </View>
        );

      case 'recording':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.listeningText}>Listening...</Text>
            <View style={styles.recordingContainer}>
              {/* Animated waves */}
              <Animated.View
                style={[
                  styles.wave,
                  {
                    opacity: waveAnim1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 0],
                    }),
                    transform: [
                      {
                        scale: waveAnim1.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 2],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.wave,
                  {
                    opacity: waveAnim2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 0],
                    }),
                    transform: [
                      {
                        scale: waveAnim2.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 2],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.wave,
                  {
                    opacity: waveAnim3.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 0],
                    }),
                    transform: [
                      {
                        scale: waveAnim3.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 2],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.recordingButton,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Text style={styles.recordingButtonText}>ID</Text>
              </Animated.View>
            </View>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress * 10)} / 10 seconds
            </Text>
          </View>
        );

      case 'analyzing':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.listeningText}>Analyzing...</Text>
            <View style={styles.recordingContainer}>
              <Animated.View
                style={[
                  styles.analyzingButton,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Disc3 size={48} color={Colors.dark.primary} strokeWidth={1.5} />
              </Animated.View>
            </View>
            <Text style={styles.hintText}>
              Searching our database...
            </Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.resultContent}>
            <View style={styles.successIcon}>
              <CheckCircle size={32} color={Colors.dark.success} />
            </View>
            <Text style={styles.successText}>Track Found!</Text>

            {identifiedTrack && (
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
                  {identifiedTrack.label && (
                    <Text style={styles.trackLabel}>{identifiedTrack.label}</Text>
                  )}
                </View>
              </View>
            )}

            {identifiedTrack && (
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceText}>
                  {identifiedTrack.confidence}% confidence
                </Text>
              </View>
            )}

            {identifiedTrack?.links && (identifiedTrack.links.spotify || identifiedTrack.links.youtube) && (
              <View style={styles.linksRow}>
                {identifiedTrack.links.spotify && (
                  <Pressable style={styles.linkChip}>
                    <Music2 size={14} color="#1DB954" />
                    <Text style={styles.linkChipText}>Spotify</Text>
                    <ExternalLink size={12} color={Colors.dark.textMuted} />
                  </Pressable>
                )}
                {identifiedTrack.links.youtube && (
                  <Pressable style={styles.linkChip}>
                    <Music2 size={14} color="#FF0000" />
                    <Text style={styles.linkChipText}>YouTube</Text>
                    <ExternalLink size={12} color={Colors.dark.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            <Pressable style={styles.tryAgainButton} onPress={handleTryAgain}>
              <RotateCcw size={18} color={Colors.dark.primary} />
              <Text style={styles.tryAgainText}>Identify Another</Text>
            </Pressable>
          </View>
        );

      case 'no_match':
        return (
          <View style={styles.resultContent}>
            <View style={styles.noMatchIcon}>
              <AlertCircle size={32} color="#cd6a6f" />
            </View>
            <Text style={styles.noMatchText}>No Match Found</Text>
            <Text style={styles.noMatchSubtext}>
              We could not identify this track. It might be an unreleased track, mashup, or remix.
            </Text>
            <Pressable style={styles.tryAgainButtonLarge} onPress={handleTryAgain}>
              <RotateCcw size={18} color="#fff" />
              <Text style={styles.tryAgainTextLarge}>Try Again</Text>
            </Pressable>
          </View>
        );

      case 'error':
        return (
          <View style={styles.resultContent}>
            <View style={styles.errorIcon}>
              <AlertCircle size={32} color={Colors.dark.error} />
            </View>
            <Text style={styles.errorText}>Something went wrong</Text>
            <Text style={styles.errorSubtext}>{error}</Text>
            <Pressable style={styles.tryAgainButtonLarge} onPress={handleTryAgain}>
              <RotateCcw size={18} color="#fff" />
              <Text style={styles.tryAgainTextLarge}>Try Again</Text>
            </Pressable>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Close button */}
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={28} color={Colors.dark.text} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Identify Track</Text>
          </View>

          {/* Content */}
          {renderContent()}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    padding: 8,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  instructionText: {
    fontSize: 18,
    color: Colors.dark.textSecondary,
    marginBottom: 40,
  },
  idButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  idButtonInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idButtonText: {
    fontSize: 64,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
  },
  hintText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: 32,
    textAlign: 'center',
  },
  listeningText: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 40,
  },
  recordingContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  wave: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: Colors.dark.primary,
  },
  recordingButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingButtonText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  analyzingButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.surface,
    borderWidth: 3,
    borderColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    width: width - 80,
    height: 6,
    backgroundColor: Colors.dark.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: 12,
  },
  resultContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 24,
  },
  trackCard: {
    width: width - 48,
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  trackCoverPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  trackLabel: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  confidenceBadge: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  linkChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tryAgainText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  noMatchIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(205, 106, 111, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noMatchText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  noMatchSubtext: {
    fontSize: 15,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
    lineHeight: 22,
  },
  tryAgainButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    width: width - 80,
  },
  tryAgainTextLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 15,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
    lineHeight: 22,
  },
});
