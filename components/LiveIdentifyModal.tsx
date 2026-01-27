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

// API URL for identify endpoint
const API_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

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

// Generate waveform bars similar to TrackdLogo
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

// Animated Waveform Component for button - slower, subtler
const ScanningWaveform = ({ isActive }: { isActive: boolean }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const pulseAnims = useRef(
    Array.from({ length: 24 }, () => new Animated.Value(0))
  ).current;

  const bars = generateBars(24);

  useEffect(() => {
    if (isActive) {
      // Much slower scrolling - gentle flow
      Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: 12000, // Much slower
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Gentle pulse animations with longer durations
      pulseAnims.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 100), // More stagger
            Animated.timing(anim, {
              toValue: 1,
              duration: 800, // Slower pulse
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 800,
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
            outputRange: [1, 1.15], // Much subtler scale
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

// Circular Progress Ring Component - 15 second timer
// Uses two animated half-circles to create smooth progress effect
const ProgressRing = ({ progress, size = 200, strokeWidth = 4 }: { progress: Animated.Value; size?: number; strokeWidth?: number }) => {
  const halfSize = size / 2;

  // First half: rotates from -180 to 0 (covers right side, 0-50%)
  const firstHalfRotation = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '0deg', '0deg'],
    extrapolate: 'clamp',
  });

  // Second half: rotates from -180 to 0 (covers left side, 50-100%)
  const secondHalfRotation = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '-180deg', '0deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[progressRingStyles.container, { width: size, height: size }]}>
      {/* Background ring (subtle) */}
      <View style={[progressRingStyles.backgroundRing, {
        width: size,
        height: size,
        borderRadius: halfSize,
        borderWidth: strokeWidth,
      }]} />

      {/* Right half container (clips to right side) */}
      <View style={[progressRingStyles.halfClip, {
        width: halfSize,
        height: size,
        left: halfSize,
      }]}>
        <Animated.View style={[progressRingStyles.halfCircle, {
          width: size,
          height: size,
          borderRadius: halfSize,
          borderWidth: strokeWidth,
          left: -halfSize,
          transform: [{ rotate: firstHalfRotation }],
        }]} />
      </View>

      {/* Left half container (clips to left side) */}
      <View style={[progressRingStyles.halfClip, {
        width: halfSize,
        height: size,
        left: 0,
      }]}>
        <Animated.View style={[progressRingStyles.halfCircle, {
          width: size,
          height: size,
          borderRadius: halfSize,
          borderWidth: strokeWidth,
          left: 0,
          transform: [{ rotate: secondHalfRotation }],
        }]} />
      </View>
    </View>
  );
};

const progressRingStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundRing: {
    position: 'absolute',
    borderColor: 'rgba(255, 255, 255, 0.06)', // Very subtle background
  },
  halfClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  halfCircle: {
    position: 'absolute',
    borderColor: 'transparent',
    borderTopColor: 'rgba(255, 255, 255, 0.2)', // Dim white - stealth mode
    borderRightColor: 'rgba(255, 255, 255, 0.2)',
  },
});

// Full-screen vertical background waveform - slow and subtle
const BackgroundWaveform = ({ isActive }: { isActive: boolean }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const pulseAnims = useRef(
    Array.from({ length: 40 }, () => new Animated.Value(0))
  ).current;

  // Generate more bars for full screen coverage
  const bars = generateBars(40);

  useEffect(() => {
    if (isActive) {
      // Very slow vertical scroll - barely perceptible movement
      Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: 20000, // Much slower
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Very gentle pulse animations
      pulseAnims.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 150), // More stagger
            Animated.timing(anim, {
              toValue: 1,
              duration: 1200, // Much slower
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 1200,
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
            outputRange: [1, 1.1], // Much subtler
          });
          const opacity = pulseAnims[pulseIndex].interpolate({
            inputRange: [0, 1],
            outputRange: [0.04, 0.1], // Much more subtle
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
  const floatAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current; // Dark overlay opacity
  const overlaySlideAnim = useRef(new Animated.Value(-1)).current; // Overlay slide (for lock effect)
  const progressAnim = useRef(new Animated.Value(0)).current; // Ring progress (0-1)
  const listeningPulseAnim = useRef(new Animated.Value(0)).current; // Listening text pulse

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
      overlayAnim.setValue(0);
      overlaySlideAnim.setValue(-1);
      progressAnim.setValue(0);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
      overlayAnim.setValue(0);
      overlaySlideAnim.setValue(-1);
      progressAnim.setValue(0);
      stopRecording();
    }
  }, [visible]);

  // Pulse, glow, and floating animations
  useEffect(() => {
    if (state === 'idle' || state === 'recording') {
      // Very gentle pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 2000, // Slower
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Gentle glow
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.5,
            duration: 1500, // Slower
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Very slow floating animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 4000, // Very slow
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      glowAnim.stopAnimation();
      glowAnim.setValue(0.2);
      floatAnim.stopAnimation();
      floatAnim.setValue(0);
    }

    return () => {
      pulseAnim.stopAnimation();
      floatAnim.stopAnimation();
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

    // Reset overlay, progress, and listening pulse
    progressAnim.stopAnimation();
    listeningPulseAnim.stopAnimation();
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

      // Animate dark overlay in (screen locker swipe-down effect) - slow dramatic lockdown
      overlaySlideAnim.setValue(-1);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(overlaySlideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Start progress ring animation (15 seconds)
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: RECORDING_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: false, // Can't use native driver for interpolated rotation
      }).start();

      // Start listening text pulse animation - faster, more visible
      listeningPulseAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(listeningPulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(listeningPulseAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

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
      const response = await fetch(`${API_URL}/api/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64: base64Audio,
          audioFormat: Platform.OS === 'ios' ? 'm4a' : 'mp4',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json();

      // Fade/slide out overlay when showing results
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(overlaySlideAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

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

    // Fade/slide out overlay
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlaySlideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    progressAnim.setValue(0);
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
                  {
                    transform: [
                      { scale: pulseAnim },
                      { translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -8], // Very subtle float
                      })}
                    ]
                  }
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
            <View style={styles.recordingOuter}>
              {/* Progress Ring Timer */}
              <ProgressRing progress={progressAnim} size={200} strokeWidth={4} />
              <Animated.View
                style={[
                  styles.recordingGlow,
                  { opacity: glowAnim }
                ]}
              />
              <Animated.View
                style={[
                  styles.recordingButton,
                  {
                    transform: [
                      { translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -8],
                      })}
                    ]
                  }
                ]}
              >
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
              </Animated.View>
            </View>
            {/* Stealth status text - above secret message */}
            <Animated.View
              style={[
                styles.stealthListeningContainer,
                {
                  opacity: listeningPulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.08, 0.28],
                  }),
                },
              ]}
            >
              <Text style={styles.stealthListeningDots}>...</Text>
              <Text style={styles.stealthListeningText}>Listening</Text>
            </Animated.View>
            {/* Secret message */}
            <Text style={styles.secretMessage}>
              Shhh... We Won't Let Anyone Know You Don't Know Ball 😏
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
              <AlertCircle size={32} color="#C41E3A" />
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

        {/* Dark overlay - screen locker swipe effect during scanning */}
        <Animated.View
          style={[
            styles.darkOverlay,
            {
              opacity: 0.95, // Solid opacity - no fade, just slide
              transform: [{
                translateY: overlaySlideAnim.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-screenHeight * 1.1, 0, screenHeight * 1.1],
                }),
              }],
            },
          ]}
          pointerEvents={isScanning ? 'auto' : 'none'}
        />

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Close button - fades out during scanning (locked) */}
          <Animated.View style={[styles.closeButtonContainer, {
            opacity: overlaySlideAnim.interpolate({
              inputRange: [-1, -0.5, 0],
              outputRange: [1, 0.5, 0],
              extrapolate: 'clamp',
            }),
          }]}>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <X size={24} color={Colors.dark.text} />
            </Pressable>
          </Animated.View>

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
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 5,
  },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
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
  // ID Button styles - rounded square box like logo
  idButtonOuter: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idButtonGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 32,
    backgroundColor: Colors.dark.primary,
  },
  idButton: {
    width: 160,
    height: 160,
    borderRadius: 28,
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
  stealthListeningContainer: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stealthListeningDots: {
    fontSize: 35,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.12)',
    letterSpacing: 2,
    marginRight: -8,
  },
  stealthListeningText: {
    fontSize: 35,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.12)',
    letterSpacing: 5,
    textTransform: 'uppercase',
  },
  secretMessage: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  listeningText: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.3)', // Dim text - stealth mode
    marginBottom: 40,
  },
  // Recording button styles - rounded square box
  recordingOuter: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 36,
    backgroundColor: 'rgba(30, 30, 30, 0.5)', // Subtle dark glow - stealth mode
  },
  recordingButton: {
    width: 160,
    height: 160,
    borderRadius: 28,
    backgroundColor: '#0a0a0a', // Near black - stealth mode
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)', // Very subtle border
  },
  recordingWaveContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.15, // More subtle waveform in stealth mode
  },
  recordingIdText: {
    fontSize: 64,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.25)', // Dim text - hard to see from distance
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
