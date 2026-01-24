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
import { X, Link2, Youtube, Music2, Sparkles, CheckCircle, MessageSquare, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { importSet, ImportProgress, ImportResult } from '@/services/importService';
import { SetList } from '@/types';

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

  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrapeMutation = trpc.scraper.scrapeUrl.useMutation({
    onSuccess: (result) => {
      console.log('[ImportModal] Scrape result:', result);
      
      // Clear progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (result.success && result.data) {
        setStep('complete');
        setTracksFound(result.data.tracks.length);
        setCommentsFound(result.data.comments?.length || 0);
        
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start();
        
        // Create the set from scraped data
        const sourceLinks: SetList['sourceLinks'] = [];
        if (result.data.links.youtube) sourceLinks.push({ platform: 'youtube', url: result.data.links.youtube });
        if (result.data.links.soundcloud) sourceLinks.push({ platform: 'soundcloud', url: result.data.links.soundcloud });
        if (result.data.links.mixcloud) sourceLinks.push({ platform: 'mixcloud', url: result.data.links.mixcloud });
        
        // Add the original URL if not already in links
        const platform = detectPlatform(url);
        if (platform && !sourceLinks.some(l => l.platform === platform)) {
          sourceLinks.push({ platform, url });
        }

        const normalizedArtist = result.data.artist && result.data.artist !== 'Unknown Artist' 
          ? normalizeArtistName(result.data.artist) 
          : result.data.artist || 'Unknown Artist';

        const newSet: SetList = {
          id: `imported-${Date.now()}`,
          name: result.data.title || 'Imported Set',
          artist: normalizedArtist,
          venue: result.data.venue,
          date: result.data.date ? (typeof result.data.date === 'string' ? new Date(result.data.date) : new Date()) : new Date(),
          tracks: result.data.tracks.map((t, i) => ({
            id: `track-${Date.now()}-${i}`,
            title: t.title,
            artist: t.artist,
            timestamp: parseTimestamp(t.timestamp),
            duration: 0,
            coverUrl: result.data.thumbnail || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
            addedAt: new Date(),
            source: 'ai' as const,
            verified: false,
          })),
          coverUrl: result.data.thumbnail,
          sourceLinks: sourceLinks.length > 0 ? sourceLinks : [{ platform: platform as 'youtube' | 'soundcloud' | 'mixcloud', url }],
          totalDuration: result.data.duration ? parseDuration(result.data.duration) : 0,
          aiProcessed: true,
          commentsScraped: result.data.comments?.length || 0,
          tracksIdentified: result.data.tracks.length,
          plays: 0,
        };

        const addResult = addSet(newSet);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        setTimeout(() => {
          if (onImport) {
            onImport(url, platform || 'youtube', result.data);
          }
          resetState();
          onClose();
          
          // Navigate to the set detail page
          if (addResult.success) {
            router.push(`/(tabs)/(discover)/${addResult.set.id}`);
          } else if (addResult.duplicate) {
            router.push(`/(tabs)/(discover)/${addResult.duplicate.id}`);
          }
        }, 1000);
      } else {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setErrorMessage(result.error || 'Failed to import set');
        setStep('idle');
        setProcessing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    onError: (error) => {
      console.error('[ImportModal] Scrape error:', error);
      console.error('[ImportModal] Error details:', {
        message: error.message,
        data: error.data,
        shape: error.shape,
        cause: error.cause,
        stack: error.stack,
      });
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Try to extract more detailed error message
      let errorMessage = 'Failed to scrape URL';
      
      // Check for connection errors first
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
        const backendUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3001';
        errorMessage = `Cannot connect to backend server at ${backendUrl}. Please start the server with: bun run server`;
      } else if (error.data?.zodError) {
        errorMessage = `Invalid input: ${error.data.zodError.message}`;
      } else if (error.data?.httpStatus === 404) {
        errorMessage = 'Backend server not found. Is the server running on port 3001?';
      } else if (error.data?.httpStatus) {
        errorMessage = `Server error (${error.data.httpStatus}): ${error.message || 'Unknown error'}`;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.cause) {
        errorMessage = `Network error: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`;
      }
      
      setErrorMessage(errorMessage);
      setStep('idle');
      setProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const parseDuration = (durationStr: string): number => {
    // Parse duration string like "1:15:30" or "75:30" or "4530"
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    const seconds = parseInt(durationStr);
    return isNaN(seconds) ? 0 : seconds;
  };

  const soundcloudSearch = trpc.scraper.searchSoundCloudSets.useMutation({
    onSuccess: (data) => {
      console.log('[ImportModal] SoundCloud search results:', data);
      if (data.success) {
        setSearchResults(data.results);
      }
    },
  });

  const tracklistSearch = trpc.scraper.search1001Tracklists.useMutation({
    onSuccess: (data) => {
      console.log('[ImportModal] 1001tracklists search results:', data);
      if (data.success) {
        setSearchResults(data.results);
      }
    },
  });

  const isSearching = soundcloudSearch.isPending || tracklistSearch.isPending;

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
