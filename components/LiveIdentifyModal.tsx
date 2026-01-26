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
  Easing,
} from 'react-native';
import { Audio } from 'expo-av';
import {
  X,
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

// 15 seconds is optimal for ACRCloud - gives enough audio for accurate fingerprinting
// especially for tracks with long intros or ambient sections
const RECORDING_DURATION_MS = 15000;

// Generate waveform bars similar to IDentifiedLogo
const generateBars = (barCount: number) => {
  return Array.from({ length: barCount }, (_, i) => {
    const noise1 = Math.sin(i * 0.8) * 0.3;
    const noise2 = Math.sin(i * 1.7) * 0.2;
    const noise3 = Math.sin(i * 0.3) * 0.25;
    const baseHeight = 0.35 + Math.abs(noise1 + noise2 + noise3);
    return Math.min(1, baseHeight);
  });
};

const { height: screenHeight } = Dimensions.get('window');

// Animated Waveform Component for button
const ScanningWaveform = ({ isActive }: { isActive: boolean }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const pulseAnims = useRef(
    Array.from({ length: 24 }, () => new Animated.Value(0))
  ).current;

  const bars = generateBars(24);

  useEffect(() => {
    if (isActive) {
      // Scrolling animation at 128 BPM
      Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: 3750,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Individual bar pulse animations with staggered delays
      pulseAnims.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 50),
            Animated.timing(anim, {
              toValue: 1,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      scrollAnim.stopAnimation();
      scrollAnim.setValue(0);
      pulseAnims.forEach(anim => {
        anim.stopAnimation();
        anim.setValue(0);
      });
    }

    return () => {
      scrollAnim.stopAnimation();
      pulseAnims.forEach(anim => anim.stopAnimation());
    };
  }, [isActive]);

  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  return (
    <View style={styles.waveformContainer}>
      <Animated.View
        style={[
          styles.waveformInner,
          { transform: [{ translateX }] },
        ]}
      >
        {[...bars, ...bars].map((barHeight, idx) => {
          const pulseIndex = idx % pulseAnims.length;
          const scale = pulseAnims[pulseIndex].interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.4],
          });

          return (
            <Animated.View
              key={idx}
              style={[
                styles.waveformBar,
                {
                  height: barHeight * 60,
                  transform: [{ scaleY: scale }],
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
};

// Full-screen vertical background waveform
const BackgroundWaveform = ({ isActive }: { isActive: boolean }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const pulseAnims = useRef(
    Array.from({ length: 40 }, () => new Animated.Value(0))
  ).current;

  // Generate more bars for full screen coverage
  const bars = generateBars(40);

  useEffect(() => {
    if (isActive) {
      // Vertical scrolling animation - smooth continuous flow
      Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Staggered pulse animations for each bar
      pulseAnims.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 80),
            Animated.timing(anim, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      scrollAnim.stopAnimation();
      scrollAnim.setValue(0);
      pulseAnims.forEach(anim => {
        anim.stopAnimation();
        anim.setValue(0);
      });
    }

    return () => {
      scrollAnim.stopAnimation();
      pulseAnims.forEach(anim => anim.stopAnimation());
    };
  }, [isActive]);

  // Vertical scroll translation
  const translateY = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -screenHeight * 0.5],
  });

  return (
    <View style={styles.backgroundWaveformContainer}>
      <Animated.View
        style={[
          styles.backgroundWaveformInner,
          { transform: [{ translateY }] },
        ]}
      >
        {[...bars, ...bars, ...bars].map((barHeight, idx) => {
          const pulseIndex = idx % pulseAnims.length;
          const scale = pulseAnims[pulseIndex].interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.5],
          });
          const opacity = pulseAnims[pulseIndex].interpolate({
            inputRange: [0, 1],
            outputRange: [0.08, 0.2],
          });

          return (
            <Animated.View
              key={idx}
              style={[
                styles.backgroundWaveformBar,
                {
                  width: barHeight * width * 0.6,
                  opacity,
                  transform: [{ scaleX: scale }],
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
};

export default function LiveIdentifyModal({
  visible,
  onClose,
  onTrackIdentified,
}: LiveIdentifyModalProps) {
  const [state, setState] = useState<IdentifyState>('idle');
  const [identifiedTrack, setIdentifiedTrack] = useState<IdentifiedTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
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
      setIdentifiedTrack(null);
      setError(null);

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

  // Pulse and glow animations
  useEffect(() => {
    if (state === 'idle' || state === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      glowAnim.stopAnimation();
      glowAnim.setValue(0.3);
    }

    return () => {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
    };
  }, [state]);

  const stopRecording = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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
      setError(null);
      setIdentifiedTrack(null);

      // Configure audio mode for optimal recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording with high quality settings
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      // Auto-finish after duration
      timeoutRef.current = setTimeout(() => {
        finishRecording();
      }, RECORDING_DURATION_MS);

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

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
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
              Tap to identify
            </Text>
            <Pressable style={styles.idButtonOuter} onPress={startRecording}>
              <Animated.View
                style={[
                  styles.idButtonGlow,
                  { opacity: glowAnim }
                ]}
              />
              <Animated.View
                style={[
                  styles.idButton,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <View style={styles.idButtonWaveContainer}>
                  <ScanningWaveform isActive={false} />
                </View>
                <Text style={styles.idButtonText}>ID</Text>
              </Animated.View>
            </Pressable>
            <Text style={styles.hintText}>
              Hold your phone near the music
            </Text>
          </View>
        );

      case 'recording':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.listeningText}>Listening...</Text>
            <View style={styles.recordingOuter}>
              <Animated.View
                style={[
                  styles.recordingGlow,
                  { opacity: glowAnim }
                ]}
              />
              <View style={styles.recordingButton}>
                <View style={styles.recordingWaveContainer}>
                  <ScanningWaveform isActive={true} />
                </View>
                <Animated.Text
                  style={[
                    styles.recordingIdText,
                    { transform: [{ scale: pulseAnim }] }
                  ]}
                >
                  ID
                </Animated.Text>
              </View>
            </View>
            <Text style={styles.hintText}>
              Scanning audio...
            </Text>
          </View>
        );

      case 'analyzing':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.listeningText}>Analyzing...</Text>
            <View style={styles.analyzingOuter}>
              <Animated.View
                style={[
                  styles.analyzingButton,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <Disc3 size={48} color={Colors.dark.primary} strokeWidth={1.5} />
              </Animated.View>
            </View>
            <Text style={styles.hintText}>
              Searching database...
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
                  {identifiedTrack.confidence}% match
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

  const isScanning = state === 'recording' || state === 'analyzing';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Background waveform - only visible during scanning */}
        {isScanning && <BackgroundWaveform isActive={isScanning} />}

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
  // ID Button styles
  idButtonOuter: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idButtonGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.dark.primary,
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
    overflow: 'hidden',
  },
  idButtonWaveContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
  },
  idButtonText: {
    fontSize: 72,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -3,
    zIndex: 2,
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
  // Recording button styles
  recordingOuter: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.dark.primary,
  },
  recordingButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 20,
    overflow: 'hidden',
  },
  recordingWaveContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIdText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -2,
    zIndex: 2,
  },
  // Waveform styles
  waveformContainer: {
    width: 160,
    height: 80,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    gap: 3,
  },
  waveformBar: {
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 2,
  },
  // Background waveform (vertical, full-screen)
  backgroundWaveformContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 0,
  },
  backgroundWaveformInner: {
    alignItems: 'center',
    gap: 8,
  },
  backgroundWaveformBar: {
    height: 6,
    backgroundColor: Colors.dark.primary,
    borderRadius: 3,
  },
  // Analyzing styles
  analyzingOuter: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.dark.surface,
    borderWidth: 3,
    borderColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Result styles
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
