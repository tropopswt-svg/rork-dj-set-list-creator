import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Link2,
  Music,
  Plus,
  Clock,
  Trash2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Disc3,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useFormValidation, validationRules } from '@/utils/hooks';
import { useSets } from '@/contexts/SetsContext';
import { SetList, Track, SourceLink } from '@/types';

type ImportStep = 'idle' | 'fetching_metadata' | 'fetching_comments' | 'extracting_tracks' | 'complete' | 'error';

interface ImportProgress {
  step: ImportStep;
  message: string;
  setName?: string;
  artistName?: string;
  thumbnail?: string;
  commentsFound?: number;
  tracksFound?: number;
  error?: string;
}

interface PendingTrack {
  id: string;
  title: string;
  artist: string;
  timestamp: string;
}

interface ScrapedSourceInfo {
  url: string;
  platform: 'youtube' | 'soundcloud';
  duration?: number;
  uploaderName?: string;
  isOfficial?: boolean;
  isUserRip?: boolean;
}

export default function SubmitScreen() {
  const router = useRouter();
  const { addSet } = useSets();
  
  const form = useFormValidation(
    {
      setUrl: '',
      setName: '',
      artistName: '',
      venue: '',
    },
    {
      setName: validationRules.required('Set name is required'),
      artistName: validationRules.required('Artist name is required'),
      setUrl: (value) => {
        if (!value) return null; // Optional
        return validationRules.url()(value);
      },
    }
  );

  const [tracks, setTracks] = useState<PendingTrack[]>([]);
  const [scrapedThumbnail, setScrapedThumbnail] = useState<string | null>(null);
  const [scrapedDuration, setScrapedDuration] = useState<string | null>(null);
  const [scrapedDurationSeconds, setScrapedDurationSeconds] = useState<number | null>(null);
  const [scrapedDate, setScrapedDate] = useState<string | null>(null);
  const [scrapedSourceInfo, setScrapedSourceInfo] = useState<ScrapedSourceInfo | null>(null);
  const [sourceLinks, setSourceLinks] = useState<{ youtube?: string; soundcloud?: string }>({});
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackTimestamp, setNewTrackTimestamp] = useState('');
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Import progress state
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    step: 'idle',
    message: '',
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for the loading indicator
  useEffect(() => {
    if (showImportModal && importProgress.step !== 'complete' && importProgress.step !== 'error') {
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
    }
  }, [showImportModal, importProgress.step, pulseAnim]);

  // State for import loading
  const [isImporting, setIsImporting] = useState(false);

  // API base URL from environment
  const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator-3um4.vercel.app';

  // Function to import from URL using the Vercel /api/import endpoint
  const scrapeUrl = async (url: string) => {
    setIsImporting(true);
    setShowImportModal(true);
    setImportProgress({
      step: 'fetching_metadata',
      message: 'Fetching set info...',
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch(`${API_BASE_URL}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();
      console.log('[Submit] Import result:', result);

      if (result.success && result.setList) {
        const setList = result.setList;
        const videoInfo = result.videoInfo;
        
        setImportProgress(prev => ({
          ...prev,
          step: 'fetching_comments',
          message: 'Scanning comments for tracks...',
          setName: setList.name,
          artistName: setList.artist,
          thumbnail: setList.coverUrl,
        }));

        // Auto-fill form with scraped data
        if (setList.name) {
          form.setValue('setName', setList.name);
        }
        if (setList.artist) {
          form.setValue('artistName', setList.artist);
        }
        if (setList.venue) {
          form.setValue('venue', setList.venue);
        }

        // Store additional data
        setScrapedThumbnail(setList.coverUrl || null);
        setScrapedDurationSeconds(setList.totalDuration || null);
        setScrapedDate(setList.date || null);
        if (setList.sourceLinks?.[0]) {
          setSourceLinks({ [setList.sourceLinks[0].platform]: setList.sourceLinks[0].url });
        }

        // Store source info - detect platform from response
        const detectedPlatform = setList.sourceLinks?.[0]?.platform || 
          (url.includes('soundcloud.com') ? 'soundcloud' : 'youtube');
        setScrapedSourceInfo({
          url: url,
          platform: detectedPlatform as 'youtube' | 'soundcloud',
          duration: setList.totalDuration,
          uploaderName: videoInfo?.channelTitle || result.soundcloudInfo?.artist,
        });

        // Convert scraped tracks to PendingTrack format
        const tracksFound = setList.tracks?.length || 0;
        if (setList.tracks && tracksFound > 0) {
          const pendingTracks: PendingTrack[] = setList.tracks.map((t: any, i: number) => ({
            id: `scraped-${Date.now()}-${i}`,
            title: t.title,
            artist: t.artist,
            timestamp: formatTimestamp(t.timestamp),
          }));
          setTracks(pendingTracks);
        }

        // Show complete state
        setTimeout(() => {
          setImportProgress(prev => ({
            ...prev,
            step: 'complete',
            message: tracksFound > 0 ? `Found ${tracksFound} tracks!` : 'Set info loaded',
            tracksFound,
            commentsFound: result.commentsCount || 0,
          }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 500);

      } else {
        setImportProgress({
          step: 'error',
          message: result.error || 'Could not import the URL',
          error: result.error,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      console.error('[Submit] Import error:', error);
      setImportProgress({
        step: 'error',
        message: error.message || 'Failed to connect to server',
        error: error.message,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsImporting(false);
    }
  };

  // Helper to format timestamp from seconds to string
  const formatTimestamp = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportProgress({ step: 'idle', message: '' });
  };

  const handleImportFromUrl = async () => {
    if (!form.values.setUrl.trim()) {
      form.setFieldTouched('setUrl');
      form.validateField('setUrl');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Please enter a URL first');
      return;
    }

    const urlError = validationRules.url()(form.values.setUrl);
    if (urlError) {
      form.setFieldTouched('setUrl');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid URL', 'Please enter a valid URL');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrapeUrl(form.values.setUrl.trim());
  };

  const handleAddTrack = () => {
    if (!newTrackTitle.trim() || !newTrackArtist.trim()) {
      Alert.alert('Error', 'Please enter track title and artist');
      return;
    }

    const newTrack: PendingTrack = {
      id: Date.now().toString(),
      title: newTrackTitle.trim(),
      artist: newTrackArtist.trim(),
      timestamp: newTrackTimestamp.trim() || '0:00',
    };

    setTracks([...tracks, newTrack]);
    setNewTrackTitle('');
    setNewTrackArtist('');
    setNewTrackTimestamp('');
    setIsAddingTrack(false);
  };

  const handleRemoveTrack = (id: string) => {
    setTracks(tracks.filter((t) => t.id !== id));
  };

  // Helper to parse timestamp string to seconds
  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  // Helper to parse duration string to seconds
  const parseDuration = (durationStr: string | undefined | null): number => {
    if (!durationStr) return 0;
    
    // Handle ISO 8601 duration format (PT1H30M45S)
    const isoMatch = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (isoMatch) {
      const hours = parseInt(isoMatch[1] || '0');
      const mins = parseInt(isoMatch[2] || '0');
      const secs = parseInt(isoMatch[3] || '0');
      return hours * 3600 + mins * 60 + secs;
    }
    
    // Handle colon-separated format "1:15:30" or "75:30"
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    
    // Handle plain seconds
    const seconds = parseInt(durationStr);
    return isNaN(seconds) ? 0 : seconds;
  };

  const handleSubmit = () => {
    if (!form.values.setName.trim() || !form.values.artistName.trim()) {
      Alert.alert('Error', 'Please fill in set name and artist');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Build source links array
    const links: SourceLink[] = [];
    
    if (scrapedSourceInfo) {
      links.push({
        platform: scrapedSourceInfo.platform,
        url: scrapedSourceInfo.url,
      });
    } else if (form.values.setUrl) {
      const url = form.values.setUrl;
      const platform = url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' 
        : url.includes('soundcloud.com') ? 'soundcloud' : null;
      if (platform) {
        links.push({ platform, url });
      }
    }

    // Convert PendingTracks to Track objects
    const convertedTracks: Track[] = tracks.map((t, i) => ({
      id: `track-${Date.now()}-${i}`,
      title: t.title,
      artist: t.artist,
      timestamp: parseTimestamp(t.timestamp),
      duration: 0,
      coverUrl: scrapedThumbnail || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date(),
      source: 'manual' as const,
      verified: false,
    }));

    // Create the SetList object
    const newSet: SetList = {
      id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: form.values.setName.trim(),
      artist: form.values.artistName.trim(),
      venue: form.values.venue.trim() || undefined,
      date: scrapedDate ? new Date(scrapedDate) : new Date(),
      tracks: convertedTracks,
      coverUrl: scrapedThumbnail || `https://picsum.photos/seed/${form.values.setName.replace(/\s/g, '')}/400/400`,
      sourceLinks: links.length > 0 ? links : undefined,
      totalDuration: parseDuration(scrapedDuration || ''),
      aiProcessed: tracks.length > 0,
      commentsScraped: 0,
      tracksIdentified: convertedTracks.length,
      plays: 0,
    };

    // Add to context
    const result = addSet(newSet);
    setIsSubmitting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Set Added!',
        `"${form.values.setName}" has been added to your library with ${convertedTracks.length} tracks.`,
        [
          {
            text: 'View Set',
            onPress: () => {
              // Reset form
              form.setValue('setUrl', '');
              form.setValue('setName', '');
              form.setValue('artistName', '');
              form.setValue('venue', '');
              setTracks([]);
              setScrapedThumbnail(null);
              setScrapedDuration(null);
              setScrapedDurationSeconds(null);
              setScrapedDate(null);
              setScrapedSourceInfo(null);
              setSourceLinks({});
              // Navigate to the set
              router.push(`/(tabs)/(discover)/${result.set.id}`);
            },
          },
          {
            text: 'Add Another',
            onPress: () => {
              form.setValue('setUrl', '');
              form.setValue('setName', '');
              form.setValue('artistName', '');
              form.setValue('venue', '');
              setTracks([]);
              setScrapedThumbnail(null);
              setScrapedDuration(null);
              setScrapedDurationSeconds(null);
              setScrapedDate(null);
              setScrapedSourceInfo(null);
              setSourceLinks({});
            },
          },
        ]
      );
    } else if (result.duplicate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Duplicate Set',
        'This set already exists in your library.',
        [
          {
            text: 'View Existing',
            onPress: () => router.push(`/(tabs)/(discover)/${result.duplicate!.id}`),
          },
          { text: 'OK' },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Submit Set' }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add a New Set</Text>
          <Text style={styles.headerSubtitle}>
            Submit a set and contribute tracks to earn points
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Set URL</Text>
          <View style={styles.urlInputRow}>
            <View style={styles.urlInputWrapper}>
              <Link2 size={18} color={Colors.dark.textMuted} />
              <TextInput
                style={styles.urlInput}
                placeholder="YouTube or SoundCloud URL"
                placeholderTextColor={Colors.dark.textMuted}
                value={form.values.setUrl}
                onChangeText={(text) => form.setValue('setUrl', text)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable
              style={[styles.importButton, isImporting && styles.importButtonDisabled]}
              onPress={handleImportFromUrl}
              disabled={isImporting}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Sparkles size={16} color="#fff" />
              )}
              <Text style={styles.importButtonText}>
                {isImporting ? 'Scanning...' : 'Import'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.helpText}>
            AI will scan comments & 1001tracklists for track IDs
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Set Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Set Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Boiler Room Berlin"
              placeholderTextColor={Colors.dark.textMuted}
              value={form.values.setName}
              onChangeText={(text) => form.setValue('setName', text)}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DJ / Artist *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dixon"
              placeholderTextColor={Colors.dark.textMuted}
              value={form.values.artistName}
              onChangeText={(text) => form.setValue('artistName', text)}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venue (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Kreuzberg Warehouse"
              placeholderTextColor={Colors.dark.textMuted}
              value={form.values.venue}
              onChangeText={(text) => form.setValue('venue', text)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Tracklist</Text>
              <Text style={styles.trackCount}>
                {tracks.length} track{tracks.length !== 1 ? 's' : ''} added
              </Text>
            </View>
            <Pressable
              style={styles.addTrackButton}
              onPress={() => setIsAddingTrack(true)}
            >
              <Plus size={18} color={Colors.dark.primary} />
              <Text style={styles.addTrackText}>Add Track</Text>
            </Pressable>
          </View>

          {isAddingTrack && (
            <View style={styles.addTrackForm}>
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Track Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Track name"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={newTrackTitle}
                    onChangeText={setNewTrackTitle}
                  />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 2 }]}>
                  <Text style={styles.inputLabel}>Artist *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Artist name"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={newTrackArtist}
                    onChangeText={setNewTrackArtist}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Timestamp</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0:00"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={newTrackTimestamp}
                    onChangeText={setNewTrackTimestamp}
                  />
                </View>
              </View>
              <View style={styles.formActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsAddingTrack(false);
                    setNewTrackTitle('');
                    setNewTrackArtist('');
                    setNewTrackTimestamp('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveTrackButton} onPress={handleAddTrack}>
                  <CheckCircle size={16} color="#fff" />
                  <Text style={styles.saveTrackText}>Add</Text>
                </Pressable>
              </View>
            </View>
          )}

          {tracks.length > 0 && (
            <View style={styles.tracksList}>
              {tracks.map((track, index) => (
                <View key={track.id} style={styles.trackItem}>
                  <View style={styles.trackIndex}>
                    <Text style={styles.trackIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </View>
                  <View style={styles.trackTimestamp}>
                    <Clock size={12} color={Colors.dark.textMuted} />
                    <Text style={styles.timestampText}>{track.timestamp}</Text>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveTrack(track.id)}
                  >
                    <Trash2 size={16} color={Colors.dark.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {tracks.length === 0 && !isAddingTrack && (
            <View style={styles.emptyTracks}>
              <Music size={32} color={Colors.dark.textMuted} />
              <Text style={styles.emptyText}>No tracks added yet</Text>
              <Text style={styles.emptySubtext}>
                Add tracks manually or import from URL
              </Text>
            </View>
          )}
        </View>

        <View style={styles.pointsInfo}>
          <View style={styles.pointsIcon}>
            <Sparkles size={18} color={Colors.dark.primary} />
          </View>
          <View style={styles.pointsContent}>
            <Text style={styles.pointsTitle}>Earn Points</Text>
            <Text style={styles.pointsDescription}>
              Each verified track you contribute = 1 point
            </Text>
          </View>
        </View>

        <Pressable style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Set</Text>
        </Pressable>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Import Progress Modal */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="fade"
        onRequestClose={closeImportModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Thumbnail Preview */}
            {importProgress.thumbnail && (
              <Image
                source={{ uri: importProgress.thumbnail }}
                style={styles.modalThumbnail}
                contentFit="cover"
              />
            )}
            
            {/* Loading Indicator */}
            {importProgress.step !== 'complete' && importProgress.step !== 'error' && (
              <Animated.View style={[styles.loadingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
                <Disc3 size={48} color={Colors.dark.primary} />
              </Animated.View>
            )}
            
            {/* Success Icon */}
            {importProgress.step === 'complete' && (
              <View style={[styles.loadingIconContainer, styles.successIconContainer]}>
                <CheckCircle size={48} color={Colors.dark.success} />
              </View>
            )}
            
            {/* Error Icon */}
            {importProgress.step === 'error' && (
              <View style={[styles.loadingIconContainer, styles.errorIconContainer]}>
                <AlertCircle size={48} color={Colors.dark.error} />
              </View>
            )}
            
            {/* Step Title */}
            <Text style={styles.modalTitle}>
              {importProgress.step === 'fetching_metadata' && 'Identifying Set...'}
              {importProgress.step === 'fetching_comments' && 'Scanning Comments...'}
              {importProgress.step === 'extracting_tracks' && 'Extracting Tracks...'}
              {importProgress.step === 'complete' && 'Import Complete!'}
              {importProgress.step === 'error' && 'Import Failed'}
            </Text>
            
            {/* Set Info Preview */}
            {(importProgress.setName || importProgress.artistName) && (
              <View style={styles.modalSetInfo}>
                {importProgress.artistName && (
                  <Text style={styles.modalArtist}>{importProgress.artistName}</Text>
                )}
                {importProgress.setName && (
                  <Text style={styles.modalSetName} numberOfLines={2}>{importProgress.setName}</Text>
                )}
              </View>
            )}
            
            {/* Progress Message */}
            <Text style={styles.modalMessage}>{importProgress.message}</Text>
            
            {/* Stats (on complete) */}
            {importProgress.step === 'complete' && (
              <View style={styles.modalStats}>
                <View style={styles.modalStatItem}>
                  <MessageSquare size={16} color={Colors.dark.textMuted} />
                  <Text style={styles.modalStatText}>
                    {importProgress.commentsFound || 0} comments scanned
                  </Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Music size={16} color={Colors.dark.primary} />
                  <Text style={styles.modalStatText}>
                    {importProgress.tracksFound || 0} tracks found
                  </Text>
                </View>
              </View>
            )}
            
            {/* Close Button */}
            {(importProgress.step === 'complete' || importProgress.step === 'error') && (
              <Pressable style={styles.modalButton} onPress={closeImportModal}>
                <Text style={styles.modalButtonText}>
                  {importProgress.step === 'complete' ? 'Continue' : 'Try Again'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  trackCount: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: -8,
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  urlInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  urlInput: {
    flex: 1,
    height: 48,
    color: Colors.dark.text,
    fontSize: 14,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: Colors.dark.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  addTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 8,
  },
  addTrackText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  addTrackForm: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  formRow: {
    flexDirection: 'row',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
  },
  saveTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  saveTrackText: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  tracksList: {
    gap: 8,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  trackIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackIndexText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  trackTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
  },
  timestampText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  removeButton: {
    padding: 6,
  },
  emptyTracks: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  pointsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  pointsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pointsContent: {
    flex: 1,
  },
  pointsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  pointsDescription: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: Colors.dark.primary,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  bottomPadding: {
    height: 40,
  },
  // Import Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalThumbnail: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 20,
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  errorIconContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSetInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalArtist: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    marginBottom: 4,
  },
  modalSetName: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  modalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalStatText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  modalButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
