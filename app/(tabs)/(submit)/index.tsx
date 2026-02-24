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
import { useRef } from 'react';
import ArtistAutocomplete from '@/components/ArtistAutocomplete';
import TrackAutocomplete from '@/components/TrackAutocomplete';
import type { DbArtist, DbTrack } from '@/lib/supabase/types';
import { linkImportedSet, enhanceTracksWithDatabase, artistExists } from '@/lib/supabase';
import { getPublicTrackStatus } from '@/lib/trackStatus';

type ImportStep = 
  | 'idle' 
  | 'fetching_metadata' 
  | 'scanning_comments' 
  | 'extracting_tracks' 
  | 'matching_database'
  | 'complete' 
  | 'error';

interface ImportProgress {
  step: ImportStep;
  message: string;
  setName?: string;
  artistName?: string;
  thumbnail?: string;
  // Phase 1: Comments scanned
  commentsScanned?: number;
  // Phase 2: Tracks extracted
  tracksFound?: number;
  // Phase 3: Database matching
  tracksLinked?: number;
  tracksUnreleased?: number;
  artistLinked?: boolean;
  // Error
  error?: string;
}

interface PendingTrack {
  id: string;
  title: string;
  artist: string;
  timestamp: string;
  isLinked?: boolean;       // Track matched in database
  isUnreleased?: boolean;   // Marked as unreleased
  dbTrackId?: string;       // Database track ID if linked
  dbArtistId?: string;      // Database artist ID if linked
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
  const { addSet, updateSet } = useSets();
  
  // Ref to track submitted set ID for background matching
  const submittedSetIdRef = useRef<string | null>(null);
  
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
  
  // Background matching state (runs after modal closes)
  const [isMatching, setIsMatching] = useState(false);
  const [matchingProgress, setMatchingProgress] = useState({
    total: 0,
    matched: 0,
    unreleased: 0,
  });

  // Pulse animation for the loading indicator
  useEffect(() => {
    if (showImportModal && importProgress.step !== 'extracting_tracks' && importProgress.step !== 'error') {
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
  const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

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

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error (${response.status})`);
      }
      const result = await response.json();
      if (__DEV__) console.log('[Submit] Import result:', result);

      if (result.success && result.setList) {
        const setList = result.setList;
        const videoInfo = result.videoInfo;
        const commentsCount = result.commentsCount || 0;
        
        // ============================================
        // PHASE 1: Show comments scanned
        // ============================================
        setImportProgress(prev => ({
          ...prev,
          step: 'scanning_comments',
          message: commentsCount > 0 
            ? `Scanned ${commentsCount.toLocaleString()} comments` 
            : 'Analyzing set metadata...',
          setName: setList.name,
          artistName: setList.artist,
          thumbnail: setList.coverUrl,
          commentsScanned: commentsCount,
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

        // Small delay to show Phase 1
        await new Promise(resolve => setTimeout(resolve, 600));

        // ============================================
        // PHASE 2: Extract tracks - STOP HERE for user action
        // ============================================
        const tracksFound = setList.tracks?.length || 0;

        let pendingTracks: PendingTrack[] = [];
        if (setList.tracks && tracksFound > 0) {
          // Create basic pending tracks
          pendingTracks = setList.tracks.map((t: any, i: number) => ({
            id: `scraped-${Date.now()}-${i}`,
            title: t.title,
            artist: t.artist,
            timestamp: formatTimestamp(t.timestamp),
          }));
          
          setTracks(pendingTracks);
        }
        
        // Show Phase 2 complete with Continue button
        setImportProgress(prev => ({
          ...prev,
          step: 'extracting_tracks',
          message: tracksFound > 0 
            ? `Ready to IDentify ${tracksFound} track${tracksFound !== 1 ? 's' : ''}`
            : 'No tracks found - you can add them manually',
          tracksFound,
        }));
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      } else {
        setImportProgress({
          step: 'error',
          message: result.error || 'Could not import the URL',
          error: result.error,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      if (__DEV__) console.error('[Submit] Import error:', error);
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

  // Run background matching (Phase 3) after user presses Continue
  const handleContinueAndMatch = async () => {
    // Close the modal first
    setShowImportModal(false);
    
    // If we have tracks to match, start background matching
    if (tracks.length > 0) {
      setIsMatching(true);
      setMatchingProgress({ total: tracks.length, matched: 0, unreleased: 0 });
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      try {
        const enhanced = await enhanceTracksWithDatabase(
          tracks.map(t => ({ title: t.title, artist: t.artist }))
        );
        
        // Update tracks with database matches
        const updatedTracks = tracks.map((track, i) => {
          const dbTrack = enhanced[i]?.dbTrack;
          const isUnreleased = dbTrack?.is_unreleased || false;
          const isReleased = !isUnreleased && !!dbTrack && !!dbTrack.spotify_url;

          const merged = {
            ...track,
            isLinked: !!dbTrack,
            isUnreleased,
            isReleased,
            dbTrackId: dbTrack?.id,
            dbArtistId: enhanced[i]?.dbArtist?.id,
          };

          return {
            ...merged,
            trackStatus: getPublicTrackStatus(merged),
          };
        });
        
        setTracks(updatedTracks);
        
        const linkedCount = updatedTracks.filter(t => t.isLinked).length;
        const unreleasedCount = updatedTracks.filter(t => t.isUnreleased).length;
        
        setMatchingProgress({
          total: tracks.length,
          matched: linkedCount,
          unreleased: unreleasedCount,
        });
        
        if (__DEV__) console.log(`[Submit] Background match: ${linkedCount} linked, ${unreleasedCount} unreleased`);
        
        // If set was already submitted, update it in context
        if (submittedSetIdRef.current) {
          const convertedTracks: Track[] = updatedTracks.map((t, i) => ({
            id: `track-${Date.now()}-${i}`,
            title: t.title,
            artist: t.artist,
            timestamp: parseTimestamp(t.timestamp),
            duration: 0,
            coverUrl: scrapedThumbnail || undefined,
            addedAt: new Date(),
            source: 'manual' as const,
            verified: false,
            isUnreleased: t.isUnreleased,
            isReleased: t.isReleased,
            trackStatus: t.trackStatus,
          }));
          
          updateSet(submittedSetIdRef.current, {
            tracks: convertedTracks,
            isMatchingInProgress: false,
            matchingStats: {
              total: tracks.length,
              matched: linkedCount,
              unreleased: unreleasedCount,
            },
          });
          if (__DEV__) console.log(`[Submit] Updated set ${submittedSetIdRef.current} with matching results`);
        }
        
        // Also check artist
        if (form.values.artistName) {
          const artistCheck = await artistExists(form.values.artistName);
          if (artistCheck.exists) {
            if (__DEV__) console.log(`[Submit] Artist ${form.values.artistName} found in database`);
          }
        }
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        if (__DEV__) console.warn('[Submit] Background matching error:', error);
        // If set was submitted, mark matching as done even on error
        if (submittedSetIdRef.current) {
          updateSet(submittedSetIdRef.current, {
            isMatchingInProgress: false,
          });
        }
      } finally {
        // Keep showing results for a moment, then hide
        setTimeout(() => {
          setIsMatching(false);
        }, 2000);
      }
    } else {
      setImportProgress({ step: 'idle', message: '' });
    }
  };
  
  // Helper to parse timestamp string to seconds (defined early for handleContinueAndMatch)
  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
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
      coverUrl: scrapedThumbnail || undefined,
      addedAt: new Date(),
      source: 'manual' as const,
      verified: false,
      isUnreleased: t.isUnreleased,
    }));

    // Create the SetList object
    const newSetId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSet: SetList = {
      id: newSetId,
      name: form.values.setName.trim(),
      artist: form.values.artistName.trim(),
      venue: form.values.venue.trim() || undefined,
      date: scrapedDate ? new Date(scrapedDate) : new Date(),
      tracks: convertedTracks,
      coverUrl: scrapedThumbnail || `https://picsum.photos/seed/${form.values.setName.replace(/\s/g, '')}/400/400`,
      sourceLinks: links.length > 0 ? links : [],
      totalDuration: parseDuration(scrapedDuration || ''),
      aiProcessed: tracks.length > 0,
      commentsScraped: 0,
      tracksIdentified: convertedTracks.length,
      plays: 0,
      // Mark as matching in progress if background matching is still running
      isMatchingInProgress: isMatching,
      matchingStats: isMatching ? undefined : (matchingProgress.matched > 0 ? matchingProgress : undefined),
    };
    
    // Store the set ID so background matching can update it
    submittedSetIdRef.current = newSetId;

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
          <ArtistAutocomplete
            value={form.values.artistName}
            onChangeText={(text) => form.setValue('artistName', text)}
            placeholder="e.g., Dixon"
            label="DJ / Artist"
            onSelectArtist={(artist) => {
              // Optionally store the artist ID for linking
              if (__DEV__) console.log('[Submit] Selected artist:', artist.name, artist.id);
            }}
          />
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
              <TrackAutocomplete
                title={newTrackTitle}
                artist={newTrackArtist}
                onChangeTitle={setNewTrackTitle}
                onChangeArtist={setNewTrackArtist}
                titlePlaceholder="Track name"
                artistPlaceholder="Artist name"
                onSelectTrack={(track) => {
                  if (__DEV__) console.log('[Submit] Selected track:', track.title, track.id);
                }}
              />
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
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

          {/* Inline IDentified Matching Progress */}
          {isMatching && (
            <View style={styles.matchingBanner}>
              <ActivityIndicator size="small" color={Colors.dark.primary} />
              <View style={styles.matchingInfo}>
                <Text style={styles.matchingTitle}>IDentifying tracks...</Text>
                <Text style={styles.matchingSubtext}>
                  Matching {matchingProgress.total} tracks to database
                </Text>
              </View>
              <Sparkles size={18} color={Colors.dark.primary} />
            </View>
          )}
          
          {/* Matching Complete Banner */}
          {!isMatching && matchingProgress.matched > 0 && (
            <View style={styles.matchingCompleteBanner}>
              <CheckCircle size={16} color={Colors.dark.success} />
              <Text style={styles.matchingCompleteText}>
                {matchingProgress.matched} matched
                {matchingProgress.unreleased > 0 && ` • ${matchingProgress.unreleased} unreleased`}
              </Text>
            </View>
          )}

          {tracks.length > 0 && (
            <View style={styles.tracksList}>
              {tracks.map((track, index) => (
                <View key={track.id} style={[
                  styles.trackItem,
                  track.isLinked && styles.trackItemLinked,
                ]}>
                  <View style={[
                    styles.trackIndex,
                    track.isLinked && styles.trackIndexLinked,
                  ]}>
                    {track.isLinked ? (
                      <CheckCircle size={14} color={Colors.dark.success} />
                    ) : (
                      <Text style={styles.trackIndexText}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </View>
                  {track.isUnreleased && (
                    <View style={styles.unreleasedBadge}>
                      <Text style={styles.unreleasedText}>Unreleased</Text>
                    </View>
                  )}
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

      {/* Import Progress Modal - IDentified Processing */}
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
            
            {/* trakd Branding */}
            <View style={styles.identifiedBranding}>
              <Sparkles size={16} color={Colors.dark.primary} />
              <Text style={styles.identifiedText}>trakd</Text>
            </View>
            
            {/* Loading Indicator - During fetching/scanning */}
            {(importProgress.step === 'fetching_metadata' || importProgress.step === 'scanning_comments') && (
              <Animated.View style={[styles.loadingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
                <Disc3 size={48} color={Colors.dark.primary} />
              </Animated.View>
            )}
            
            {/* Success Icon - Ready to continue */}
            {importProgress.step === 'extracting_tracks' && (
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
              {importProgress.step === 'fetching_metadata' && 'Fetching Set Info...'}
              {importProgress.step === 'scanning_comments' && 'Scanning Comments...'}
              {importProgress.step === 'extracting_tracks' && 'Tracks Found!'}
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
            
            {/* Phase Progress Indicators - Simple 2 phase */}
            {importProgress.step !== 'fetching_metadata' && importProgress.step !== 'error' && (
              <View style={styles.phaseIndicators}>
                {/* Phase 1: Comments Scanned */}
                <View style={[styles.phaseItem, styles.phaseItemActive]}>
                  <View style={[
                    styles.phaseIcon,
                    importProgress.step !== 'scanning_comments' && styles.phaseIconComplete,
                  ]}>
                    {importProgress.step === 'scanning_comments' ? (
                      <ActivityIndicator size="small" color={Colors.dark.primary} />
                    ) : (
                      <MessageSquare size={14} color={Colors.dark.success} />
                    )}
                  </View>
                  <Text style={styles.phaseLabel}>Scanned</Text>
                  <Text style={styles.phaseValue}>
                    {importProgress.commentsScanned?.toLocaleString() || '0'}
                  </Text>
                </View>
                
                {/* Phase 2: Tracks Found */}
                <View style={[
                  styles.phaseItem,
                  importProgress.step === 'extracting_tracks' && styles.phaseItemActive,
                ]}>
                  <View style={[
                    styles.phaseIcon,
                    importProgress.step === 'extracting_tracks' && styles.phaseIconComplete,
                  ]}>
                    <Music size={14} color={
                      importProgress.step === 'extracting_tracks' 
                        ? Colors.dark.success 
                        : Colors.dark.textMuted
                    } />
                  </View>
                  <Text style={styles.phaseLabel}>Found</Text>
                  <Text style={styles.phaseValue}>
                    {importProgress.tracksFound || '0'}
                  </Text>
                </View>
              </View>
            )}
            
            {/* Next Step Hint */}
            {importProgress.step === 'extracting_tracks' && (importProgress.tracksFound || 0) > 0 && (
              <View style={styles.nextStepHint}>
                <Sparkles size={14} color={Colors.dark.primary} />
                <Text style={styles.nextStepText}>
                  Continue to IDentify released & unreleased tracks
                </Text>
              </View>
            )}
            
            {/* Continue Button - at Phase 2 */}
            {importProgress.step === 'extracting_tracks' && (
              <Pressable style={styles.modalButton} onPress={handleContinueAndMatch}>
                <Text style={styles.modalButtonText}>Continue</Text>
              </Pressable>
            )}
            
            {/* Error Button */}
            {importProgress.step === 'error' && (
              <Pressable style={styles.modalButton} onPress={closeImportModal}>
                <Text style={styles.modalButtonText}>Try Again</Text>
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
  trackItemLinked: {
    borderColor: 'rgba(34, 197, 94, 0.3)',
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
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
  trackIndexLinked: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  trackIndexText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
  },
  unreleasedBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  unreleasedText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
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
  // IDentified Branding
  identifiedBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  identifiedText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.dark.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Artist row with badge
  modalArtistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Phase Indicators
  phaseIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  phaseItem: {
    alignItems: 'center',
    opacity: 0.4,
  },
  phaseItemActive: {
    opacity: 1,
  },
  phaseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  phaseIconComplete: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  phaseLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phaseValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginTop: 2,
  },
  // Final stats badges
  modalFinalStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  finalStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 16,
  },
  finalStatBadgeUnreleased: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  finalStatText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.success,
  },
  finalStatTextUnreleased: {
    color: Colors.dark.primary,
  },
  // Next step hint in modal
  nextStepHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  nextStepText: {
    fontSize: 12,
    color: Colors.dark.primary,
    flex: 1,
  },
  // Inline matching banner
  matchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  matchingInfo: {
    flex: 1,
  },
  matchingTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  matchingSubtext: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  // Matching complete banner
  matchingCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  matchingCompleteText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.success,
  },
});
