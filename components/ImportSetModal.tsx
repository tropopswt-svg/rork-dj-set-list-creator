import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Animated,
  FlatList,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Link2, Youtube, Music2, Sparkles, CheckCircle, MessageSquare, Search, ExternalLink, ListMusic } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { useSets } from '@/contexts/SetsContext';
import { useRouter } from 'expo-router';
import { SetList, Track } from '@/types';

interface ImportSetModalProps {
  visible: boolean;
  onClose: () => void;
  onImport?: (url: string, platform: 'youtube' | 'soundcloud' | 'mixcloud' | '1001tracklists', scrapedData?: any) => void;
}

type ProcessingStep = 'idle' | 'detecting' | 'fetching' | 'scraping' | 'analyzing' | 'building' | 'complete';
type SearchTab = 'url' | 'soundcloud' | '1001tracklists';

interface SearchResult {
  title: string;
  artist: string;
  url: string;
  thumbnail?: string;
  trackCount?: number;
}

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
  const router = useRouter();
  const { addSet, findDuplicateSet, normalizeArtistName } = useSets();
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('url');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [commentsFound, setCommentsFound] = useState(0);
  const [tracksFound, setTracksFound] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
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
        setError(result.error || 'Failed to import set');
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
      
      setError(errorMessage);
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

  useEffect(() => {
    setSearchResults([]);
    setSearchQuery('');
  }, [activeTab]);

  const detectPlatform = (inputUrl: string): 'youtube' | 'soundcloud' | 'mixcloud' | '1001tracklists' | null => {
    if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) return 'youtube';
    if (inputUrl.includes('soundcloud.com')) return 'soundcloud';
    if (inputUrl.includes('mixcloud.com')) return 'mixcloud';
    if (inputUrl.includes('1001tracklists.com')) return '1001tracklists';
    return null;
  };

  const handleImport = async () => {
    const platform = detectPlatform(url);
    if (!platform) {
      setError('Unsupported URL. Please use YouTube, SoundCloud, Mixcloud, or 1001tracklists.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!url.trim()) {
      setError('Please enter a URL');
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
      setError(`${errorMsg}. Please start the server with: bun run server`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setProcessing(true);
    setError(null);
    setStep('detecting');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate progress through steps
    const steps: ProcessingStep[] = ['detecting', 'fetching', 'scraping', 'analyzing', 'building'];
    let currentStepIndex = 0;

    progressIntervalRef.current = setInterval(() => {
      if (currentStepIndex < steps.length - 1) {
        currentStepIndex++;
        setStep(steps[currentStepIndex]);
        Animated.timing(progressAnim, {
          toValue: (currentStepIndex + 1) / (steps.length + 1),
          duration: 500,
          useNativeDriver: false,
        }).start();
      } else {
        // Clear interval when we reach the last step
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
    }, 1500);

    // Start the actual scrape
    try {
      scrapeMutation.mutate({ url: urlToScrape });
    } catch (err) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setError('Failed to start import');
      setProcessing(false);
      setStep('idle');
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchResults([]);
    
    if (activeTab === 'soundcloud') {
      soundcloudSearch.mutate({ query: searchQuery });
    } else if (activeTab === '1001tracklists') {
      tracklistSearch.mutate({ query: searchQuery });
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUrl(result.url);
    // Switch to URL tab and trigger import
    setActiveTab('url');
    setTimeout(() => {
      handleImport();
    }, 100);
  };

  const resetState = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setUrl('');
    setSearchQuery('');
    setProcessing(false);
    setStep('idle');
    setCommentsFound(0);
    setTracksFound(0);
    setSearchResults([]);
    setError(null);
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
      case '1001tracklists':
        return <ListMusic size={20} color="#00D4AA" />;
      default:
        return <Link2 size={20} color={Colors.dark.textMuted} />;
    }
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <Pressable style={styles.resultItem} onPress={() => handleSelectResult(item)}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.resultThumbnail} />
      ) : (
        <View style={styles.resultThumbnailPlaceholder}>
          <Music2 size={20} color={Colors.dark.textMuted} />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.resultArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <ExternalLink size={18} color={Colors.dark.textMuted} />
    </Pressable>
  );

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

              <View style={styles.tabs}>
                <Pressable
                  style={[styles.tab, activeTab === 'url' && styles.tabActive]}
                  onPress={() => setActiveTab('url')}
                >
                  <Link2 size={16} color={activeTab === 'url' ? Colors.dark.primary : Colors.dark.textMuted} />
                  <Text style={[styles.tabText, activeTab === 'url' && styles.tabTextActive]}>URL</Text>
                </Pressable>
                <Pressable
                  style={[styles.tab, activeTab === 'soundcloud' && styles.tabActive]}
                  onPress={() => setActiveTab('soundcloud')}
                >
                  <Music2 size={16} color={activeTab === 'soundcloud' ? '#FF5500' : Colors.dark.textMuted} />
                  <Text style={[styles.tabText, activeTab === 'soundcloud' && styles.tabTextActive]}>SoundCloud</Text>
                </Pressable>
                <Pressable
                  style={[styles.tab, activeTab === '1001tracklists' && styles.tabActive]}
                  onPress={() => setActiveTab('1001tracklists')}
                >
                  <ListMusic size={16} color={activeTab === '1001tracklists' ? '#00D4AA' : Colors.dark.textMuted} />
                  <Text style={[styles.tabText, activeTab === '1001tracklists' && styles.tabTextActive]}>1001TL</Text>
                </Pressable>
              </View>

              {activeTab === 'url' ? (
                <>
                  <Text style={styles.subtitle}>
                    Paste a YouTube, SoundCloud, Mixcloud, or 1001tracklists link
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
                        {platform === '1001tracklists' ? '1001Tracklists' : platform.charAt(0).toUpperCase() + platform.slice(1)} detected
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
                    <View style={styles.featureRow}>
                      <ListMusic size={16} color={Colors.dark.primary} />
                      <Text style={styles.featureText}>Cross-references 1001tracklists</Text>
                    </View>
                  </View>

                  {error && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <Pressable
                    style={[styles.importButton, (!isValidUrl || processing) && styles.importButtonDisabled]}
                    onPress={handleImport}
                    disabled={!isValidUrl || processing}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Sparkles size={18} color="#fff" />
                    )}
                    <Text style={styles.importButtonText}>
                      {processing ? 'Importing...' : 'Build Tracklist with AI'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    {activeTab === 'soundcloud' 
                      ? 'Search for DJ sets on SoundCloud' 
                      : 'Search for tracklists on 1001tracklists'}
                  </Text>

                  <View style={styles.searchRow}>
                    <View style={styles.searchInputContainer}>
                      <Search size={18} color={Colors.dark.textMuted} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder={activeTab === 'soundcloud' ? 'Dixon Boiler Room...' : 'Keinemusik Ibiza...'}
                        placeholderTextColor={Colors.dark.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                      />
                    </View>
                    <Pressable
                      style={[styles.searchButton, (!searchQuery.trim() || isSearching) && styles.searchButtonDisabled]}
                      onPress={handleSearch}
                      disabled={!searchQuery.trim() || isSearching}
                    >
                      <Text style={styles.searchButtonText}>{isSearching ? '...' : 'Search'}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.resultsContainer}>
                    {isSearching ? (
                      <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Searching {activeTab === 'soundcloud' ? 'SoundCloud' : '1001tracklists'}...</Text>
                      </View>
                    ) : searchResults.length > 0 ? (
                      <FlatList
                        data={searchResults}
                        renderItem={renderSearchResult}
                        keyExtractor={(item, index) => `${item.url}-${index}`}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.resultsList}
                      />
                    ) : searchQuery.trim() && !isSearching ? (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No results found</Text>
                        <Text style={styles.emptySubtext}>Try a different search term</Text>
                      </View>
                    ) : (
                      <View style={styles.emptyContainer}>
                        <Search size={32} color={Colors.dark.textMuted} />
                        <Text style={styles.emptyText}>Search for sets</Text>
                        <Text style={styles.emptySubtext}>
                          {activeTab === 'soundcloud' 
                            ? 'Find DJ mixes and live sets' 
                            : 'Find complete tracklists'}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
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
    backgroundColor: 'rgba(45, 42, 38, 0.7)',
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
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.dark.surface,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textMuted,
  },
  tabTextActive: {
    color: Colors.dark.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.dark.text,
  },
  searchButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  resultsContainer: {
    minHeight: 250,
    maxHeight: 350,
  },
  resultsList: {
    gap: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  resultThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.dark.border,
  },
  resultThumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  resultArtist: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
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
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    fontSize: 13,
    color: Colors.dark.error,
    textAlign: 'center',
  },
});
