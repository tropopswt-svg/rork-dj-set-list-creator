import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { X, Link2, Youtube, Music2, Sparkles, CheckCircle, MessageSquare } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface ImportSetModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (url: string, platform: 'youtube' | 'soundcloud' | 'mixcloud') => void;
}

type ProcessingStep = 'idle' | 'detecting' | 'fetching' | 'scraping' | 'analyzing' | 'building' | 'complete';

const STEP_MESSAGES: Record<ProcessingStep, string> = {
  idle: '',
  detecting: 'Detecting platform...',
  fetching: 'Fetching set metadata...',
  scraping: 'Scraping comments for track IDs...',
  analyzing: 'AI analyzing timestamps...',
  building: 'Building tracklist...',
  complete: 'Tracklist ready!',
};

export default function ImportSetModal({ visible, onClose, onImport }: ImportSetModalProps) {
  const [url, setUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [commentsFound, setCommentsFound] = useState(0);
  const [tracksFound, setTracksFound] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (processing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [processing]);

  const detectPlatform = (inputUrl: string): 'youtube' | 'soundcloud' | 'mixcloud' | null => {
    if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) return 'youtube';
    if (inputUrl.includes('soundcloud.com')) return 'soundcloud';
    if (inputUrl.includes('mixcloud.com')) return 'mixcloud';
    return null;
  };

  const simulateProcessing = async () => {
    const platform = detectPlatform(url);
    if (!platform) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const steps: ProcessingStep[] = ['detecting', 'fetching', 'scraping', 'analyzing', 'building', 'complete'];
    
    for (let i = 0; i < steps.length; i++) {
      setStep(steps[i]);
      
      Animated.timing(progressAnim, {
        toValue: (i + 1) / steps.length,
        duration: 400,
        useNativeDriver: false,
      }).start();

      if (steps[i] === 'scraping') {
        const targetComments = Math.floor(Math.random() * 500) + 200;
        for (let c = 0; c < targetComments; c += Math.floor(Math.random() * 30) + 10) {
          setCommentsFound(Math.min(c, targetComments));
          await new Promise(r => setTimeout(r, 50));
        }
        setCommentsFound(targetComments);
      }

      if (steps[i] === 'analyzing') {
        const targetTracks = Math.floor(Math.random() * 12) + 8;
        for (let t = 0; t < targetTracks; t++) {
          setTracksFound(t + 1);
          await new Promise(r => setTimeout(r, 200));
        }
      }

      await new Promise(r => setTimeout(r, steps[i] === 'complete' ? 500 : 1200));
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setTimeout(() => {
      onImport(url, platform);
      resetState();
    }, 800);
  };

  const resetState = () => {
    setUrl('');
    setProcessing(false);
    setStep('idle');
    setCommentsFound(0);
    setTracksFound(0);
    progressAnim.setValue(0);
  };

  const handleClose = () => {
    if (!processing) {
      resetState();
      onClose();
    }
  };

  const platform = detectPlatform(url);
  const isValidUrl = platform !== null;

  const getPlatformIcon = () => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={20} color="#FF0000" />;
      case 'soundcloud':
        return <Music2 size={20} color="#FF5500" />;
      default:
        return <Link2 size={20} color={Colors.dark.textMuted} />;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {!processing ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Import Set</Text>
                <Pressable onPress={handleClose} hitSlop={8}>
                  <X size={24} color={Colors.dark.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.subtitle}>
                Paste a YouTube or SoundCloud link and we'll build the tracklist from comments
              </Text>

              <View style={[styles.inputContainer, isValidUrl && styles.inputValid]}>
                {getPlatformIcon()}
                <TextInput
                  style={styles.input}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor={Colors.dark.textMuted}
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>

              {platform && (
                <View style={styles.platformBadge}>
                  {getPlatformIcon()}
                  <Text style={styles.platformText}>
                    {platform.charAt(0).toUpperCase() + platform.slice(1)} detected
                  </Text>
                </View>
              )}

              <View style={styles.features}>
                <View style={styles.featureRow}>
                  <MessageSquare size={16} color={Colors.dark.primary} />
                  <Text style={styles.featureText}>Scrapes comments for track IDs</Text>
                </View>
                <View style={styles.featureRow}>
                  <Sparkles size={16} color={Colors.dark.primary} />
                  <Text style={styles.featureText}>AI identifies timestamps</Text>
                </View>
              </View>

              <Pressable
                style={[styles.importButton, !isValidUrl && styles.importButtonDisabled]}
                onPress={simulateProcessing}
                disabled={!isValidUrl}
              >
                <Sparkles size={18} color={Colors.dark.background} />
                <Text style={styles.importButtonText}>Build Tracklist with AI</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.processingContainer}>
              <Animated.View style={[styles.processingIcon, { transform: [{ scale: pulseAnim }] }]}>
                {step === 'complete' ? (
                  <CheckCircle size={48} color={Colors.dark.success} />
                ) : (
                  <Sparkles size={48} color={Colors.dark.primary} />
                )}
              </Animated.View>

              <Text style={styles.processingTitle}>
                {step === 'complete' ? 'All Done!' : 'Processing...'}
              </Text>
              <Text style={styles.processingStep}>{STEP_MESSAGES[step]}</Text>

              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>

              <View style={styles.statsRow}>
                {commentsFound > 0 && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{commentsFound}</Text>
                    <Text style={styles.statLabel}>Comments</Text>
                  </View>
                )}
                {tracksFound > 0 && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{tracksFound}</Text>
                    <Text style={styles.statLabel}>Tracks Found</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
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
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputValid: {
    borderColor: Colors.dark.primary,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: Colors.dark.text,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  platformText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  features: {
    marginTop: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 28,
  },
  importButtonDisabled: {
    opacity: 0.4,
  },
  importButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  processingIcon: {
    marginBottom: 20,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  processingStep: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 24,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
});
