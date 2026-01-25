import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Animated,
} from 'react-native';
import { X, Link2, Youtube, Music2, Sparkles, CheckCircle, MessageSquare, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { importSet, ImportProgress, ImportResult } from '@/services/importService';

interface ImportSetModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (result: ImportResult) => void;
}

type ProcessingStep = 'idle' | 'detecting' | 'fetching' | 'scraping' | 'analyzing' | 'building' | 'complete' | 'error';

const STEP_MESSAGES: Record<ProcessingStep, string> = {
  idle: '',
  detecting: 'Detecting platform...',
  fetching: 'Fetching set metadata...',
  scraping: 'Scraping comments for track IDs...',
  analyzing: 'AI analyzing timestamps...',
  building: 'Building tracklist...',
  complete: 'Tracklist ready!',
  error: 'Import failed',
};

export default function ImportSetModal({ visible, onClose, onImport }: ImportSetModalProps) {
  const [url, setUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [commentsFound, setCommentsFound] = useState(0);
  const [tracksFound, setTracksFound] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const detectPlatform = (inputUrl: string): 'youtube' | 'soundcloud' | null => {
    if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) return 'youtube';
    if (inputUrl.includes('soundcloud.com')) return 'soundcloud';
    return null;
  };

  const handleImportPress = async () => {
    const platform = detectPlatform(url);
    if (!platform) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!url.trim()) {
      setErrorMessage('Please enter a URL');
      return;
    }

    let urlToScrape = url.trim();
    if (!urlToScrape.startsWith('http://') && !urlToScrape.startsWith('https://')) {
      urlToScrape = 'https://' + urlToScrape;
    }

    // Check if backend is reachable before attempting scrape
    const backendUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3001';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const healthCheck = await fetch(`${backendUrl}/`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      if (!healthCheck.ok) {
        throw new Error('Backend returned non-OK status');
      }
    } catch (error) {
      const isTimeout = error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'));
      const errorMsg = isTimeout
        ? `Backend server not responding at ${backendUrl}`
        : `Cannot connect to backend server at ${backendUrl}`;
      setErrorMessage(`${errorMsg}. Please start the server with: bun run server`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setProcessing(true);
    setErrorMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const stepProgress: Record<ProcessingStep, number> = {
      idle: 0,
      detecting: 0.1,
      fetching: 0.3,
      scraping: 0.5,
      analyzing: 0.7,
      building: 0.9,
      complete: 1,
      error: 0,
    };

    const handleProgress = (progress: ImportProgress) => {
      setStep(progress.step);
      setCommentsFound(progress.commentsFound || 0);
      setTracksFound(progress.tracksFound || 0);

      if (progress.error) {
        setErrorMessage(progress.error);
      }

      Animated.timing(progressAnim, {
        toValue: stepProgress[progress.step] || 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    };

    try {
      const result = await importSet(url, handleProgress);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setTimeout(() => {
          onImport(result);
          resetState();
        }, 800);
      } else {
        setStep('error');
        setErrorMessage(result.error || 'Import failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      setStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Import failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const resetState = () => {
    setUrl('');
    setProcessing(false);
    setStep('idle');
    setCommentsFound(0);
    setTracksFound(0);
    setErrorMessage(null);
    progressAnim.setValue(0);
  };

  const handleClose = () => {
    if (!processing || step === 'error') {
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
                Paste a YouTube or SoundCloud link and we&apos;ll build the tracklist from comments
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
                onPress={handleImportPress}
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
                ) : step === 'error' ? (
                  <AlertCircle size={48} color={Colors.dark.error || '#FF6B6B'} />
                ) : (
                  <Sparkles size={48} color={Colors.dark.primary} />
                )}
              </Animated.View>

              <Text style={styles.processingTitle}>
                {step === 'complete' ? 'All Done!' : step === 'error' ? 'Import Failed' : 'Processing...'}
              </Text>
              <Text style={styles.processingStep}>
                {step === 'error' && errorMessage ? errorMessage : STEP_MESSAGES[step]}
              </Text>

              {step !== 'error' && (
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
              )}

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

              {step === 'error' && (
                <View style={styles.errorActions}>
                  <Pressable style={styles.retryButton} onPress={() => resetState()}>
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </Pressable>
                  <Pressable style={styles.cancelButton} onPress={handleClose}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              )}
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
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  retryButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  cancelButton: {
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
});
