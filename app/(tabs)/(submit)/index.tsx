import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Link2,
  Music,
  Plus,
  Clock,
  Trash2,
  Sparkles,
  CheckCircle,
  Youtube,
  ExternalLink,
  User,
  AlertTriangle,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { useSets } from '@/contexts/SetsContext';
import { Artist, SetList } from '@/types';

interface PendingTrack {
  id: string;
  title: string;
  artist: string;
  timestamp: string;
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
}

interface ScrapedLinks {
  youtube?: string;
  soundcloud?: string;
  mixcloud?: string;
}

export default function SubmitScreen() {
  const { addSet, searchArtistsByQuery, findDuplicateSet, getArtistByName, normalizeArtistName } = useSets();
  
  const [setUrl, setSetUrl] = useState('');
  const [setName, setSetName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [venue, setVenue] = useState('');
  const [tracks, setTracks] = useState<PendingTrack[]>([]);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackTimestamp, setNewTrackTimestamp] = useState('');
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [thumbnail, setThumbnail] = useState('');
  const [platform, setPlatform] = useState('');
  const [links, setLinks] = useState<ScrapedLinks>({});
  
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [artistSuggestions, setArtistSuggestions] = useState<Artist[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<SetList | null>(null);

  const scrapeMutation = trpc.scraper.scrapeUrl.useMutation({
    onSuccess: (result) => {
      console.log('[Submit] Scrape result:', result);
      if (result.success && result.data) {
        const scrapedTitle = result.data.title || '';
        const scrapedArtist = result.data.artist || '';
        
        const normalizedArtist = scrapedArtist && scrapedArtist !== 'Unknown Artist' 
          ? normalizeArtistName(scrapedArtist) 
          : scrapedArtist;
        
        setSetName(scrapedTitle);
        setArtistName(normalizedArtist);
        setThumbnail(result.data.thumbnail || '');
        setPlatform(result.data.platform || '');
        setLinks(result.data.links || {});
        if (result.data.venue) setVenue(result.data.venue);
        
        const sourceUrl = Object.values(result.data.links || {}).find(Boolean);
        if (sourceUrl) {
          const duplicate = findDuplicateSet(sourceUrl, normalizedArtist, scrapedTitle);
          if (duplicate) {
            setDuplicateWarning(duplicate);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
        
        const existingArtist = getArtistByName(normalizedArtist);
        if (existingArtist) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        
        if (result.data.tracks && result.data.tracks.length > 0) {
          const seen = new Set<string>();
          const importedTracks: PendingTrack[] = result.data.tracks
            .filter(t => {
              const key = `${t.artist.toLowerCase()}-${t.title.toLowerCase()}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((t, i) => ({
              id: `imported-${Date.now()}-${i}`,
              title: t.title,
              artist: t.artist,
              timestamp: t.timestamp,
              confidence: t.confidence,
              source: t.source,
            }));
          setTracks(importedTracks);
          Alert.alert('Import Complete', `Found ${importedTracks.length} unique tracks from comments & tracklists`);
        } else {
          Alert.alert('Metadata Imported', 'Set details imported. Add tracks manually or wait for AI to scan comments.');
        }
      } else {
        Alert.alert('Import Failed', result.error || 'Could not import from this URL');
      }
    },
    onError: (error) => {
      console.error('[Submit] Scrape error:', error);
      Alert.alert('Error', 'Failed to scrape URL. Please try again.');
    },
  });

  const handleImportFromUrl = () => {
    if (!setUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL first');
      return;
    }
    
    let url = setUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    setDuplicateWarning(null);
    
    const existingDuplicate = findDuplicateSet(url);
    if (existingDuplicate) {
      setDuplicateWarning(existingDuplicate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    
    console.log('[Submit] Starting import for URL:', url);
    scrapeMutation.mutate({ url });
  };

  const isImportingReal = scrapeMutation.isPending;

  const handleArtistChange = useCallback((text: string) => {
    setArtistName(text);
    setDuplicateWarning(null);
    
    if (text.trim().length > 0) {
      const suggestions = searchArtistsByQuery(text);
      setArtistSuggestions(suggestions);
      setShowArtistSuggestions(suggestions.length > 0);
    } else {
      setShowArtistSuggestions(false);
      setArtistSuggestions([]);
    }
  }, [searchArtistsByQuery]);

  const handleSelectArtist = useCallback((artist: Artist) => {
    setArtistName(artist.name);
    setShowArtistSuggestions(false);
    Haptics.selectionAsync();
    
    if (setName.trim()) {
      const duplicate = findDuplicateSet(undefined, artist.name, setName);
      if (duplicate) {
        setDuplicateWarning(duplicate);
      }
    }
  }, [findDuplicateSet, setName]);

  const handleSetNameChange = useCallback((text: string) => {
    setSetName(text);
    setDuplicateWarning(null);
    
    if (artistName.trim() && text.trim()) {
      const duplicate = findDuplicateSet(undefined, artistName, text);
      if (duplicate) {
        setDuplicateWarning(duplicate);
      }
    }
  }, [findDuplicateSet, artistName]);

  const handleAddTrack = () => {
    if (!newTrackTitle.trim() || !newTrackArtist.trim()) {
      Alert.alert('Error', 'Please enter track title and artist');
      return;
    }

    const trackKey = `${newTrackArtist.toLowerCase().trim()}-${newTrackTitle.toLowerCase().trim()}`;
    const isDuplicate = tracks.some(t => 
      `${t.artist.toLowerCase()}-${t.title.toLowerCase()}` === trackKey
    );

    if (isDuplicate) {
      Alert.alert('Duplicate Track', 'This track is already in the list');
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveTrack = (id: string) => {
    setTracks(tracks.filter((t) => t.id !== id));
  };

  const handleSubmit = () => {
    if (!setName.trim() || !artistName.trim()) {
      Alert.alert('Error', 'Please fill in set name and artist');
      return;
    }

    if (duplicateWarning) {
      Alert.alert(
        'Duplicate Set',
        `This set already exists: "${duplicateWarning.name}" by ${duplicateWarning.artist}. Do you want to view it instead?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Existing', onPress: () => {} },
        ]
      );
      return;
    }

    const sourceLinks: SetList['sourceLinks'] = [];
    if (links.youtube) sourceLinks.push({ platform: 'youtube', url: links.youtube });
    if (links.soundcloud) sourceLinks.push({ platform: 'soundcloud', url: links.soundcloud });
    if (links.mixcloud) sourceLinks.push({ platform: 'mixcloud', url: links.mixcloud });

    const newSet: SetList = {
      id: Date.now().toString(),
      name: setName.trim(),
      artist: artistName.trim(),
      venue: venue.trim() || undefined,
      date: new Date(),
      tracks: tracks.map((t, i) => ({
        id: `track-${Date.now()}-${i}`,
        title: t.title,
        artist: t.artist,
        timestamp: parseTimestamp(t.timestamp),
        duration: 0,
        coverUrl: thumbnail || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        addedAt: new Date(),
        source: 'manual' as const,
        verified: false,
      })),
      coverUrl: thumbnail || undefined,
      sourceLinks,
      totalDuration: 0,
      aiProcessed: false,
      commentsScraped: 0,
      tracksIdentified: tracks.length,
      plays: 0,
    };

    const result = addSet(newSet);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Set Submitted!',
        `Your set "${setName}" has been added. You'll earn points for each verified track.`,
        [{ text: 'OK', onPress: resetForm }]
      );
    } else if (result.duplicate) {
      Alert.alert(
        'Duplicate Found',
        `This set already exists: "${result.duplicate.name}" by ${result.duplicate.artist}`,
        [{ text: 'OK' }]
      );
    }
  };

  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const resetForm = () => {
    setSetUrl('');
    setSetName('');
    setArtistName('');
    setVenue('');
    setTracks([]);
    setThumbnail('');
    setPlatform('');
    setLinks({});
    setDuplicateWarning(null);
    setShowArtistSuggestions(false);
  };

  const renderArtistSuggestion = ({ item }: { item: Artist }) => (
    <Pressable
      style={styles.suggestionItem}
      onPress={() => handleSelectArtist(item)}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.suggestionImage} />
      ) : (
        <View style={styles.suggestionImagePlaceholder}>
          <User size={16} color={Colors.dark.textMuted} />
        </View>
      )}
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName}>{item.name}</Text>
        <Text style={styles.suggestionMeta}>
          {item.setsCount} sets • {item.genres.slice(0, 2).join(', ') || 'Various'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Submit Set' }} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                placeholder="YouTube, SoundCloud, or Mixcloud URL"
                placeholderTextColor={Colors.dark.textMuted}
                value={setUrl}
                onChangeText={(text) => {
                  setSetUrl(text);
                  setDuplicateWarning(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable
              style={[styles.importButton, isImportingReal && styles.importButtonDisabled]}
              onPress={handleImportFromUrl}
              disabled={isImportingReal}
            >
              {isImportingReal ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Sparkles size={16} color="#fff" />
              )}
              <Text style={styles.importButtonText}>
                {isImportingReal ? 'Scanning...' : 'Import'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.helpText}>
            AI will scan comments & 1001tracklists for track IDs
          </Text>
        </View>

        {duplicateWarning && (
          <View style={styles.duplicateWarning}>
            <AlertTriangle size={18} color={Colors.dark.warning} />
            <View style={styles.duplicateContent}>
              <Text style={styles.duplicateTitle}>Set Already Exists</Text>
              <Text style={styles.duplicateText}>
                "{duplicateWarning.name}" by {duplicateWarning.artist}
              </Text>
            </View>
            <Pressable onPress={() => setDuplicateWarning(null)}>
              <X size={18} color={Colors.dark.textMuted} />
            </Pressable>
          </View>
        )}

        {thumbnail ? (
          <View style={styles.thumbnailSection}>
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
            <View style={styles.platformBadge}>
              <Text style={styles.platformText}>{platform.toUpperCase()}</Text>
            </View>
          </View>
        ) : null}

        {Object.keys(links).length > 0 && (
          <View style={styles.linksSection}>
            <Text style={styles.linksSectionTitle}>Available Links</Text>
            <View style={styles.linksRow}>
              {links.youtube && (
                <View style={styles.linkBadge}>
                  <Youtube size={14} color="#FF0000" />
                  <Text style={styles.linkText}>YouTube</Text>
                </View>
              )}
              {links.soundcloud && (
                <View style={styles.linkBadge}>
                  <ExternalLink size={14} color="#FF5500" />
                  <Text style={styles.linkText}>SoundCloud</Text>
                </View>
              )}
              {links.mixcloud && (
                <View style={styles.linkBadge}>
                  <ExternalLink size={14} color="#5000FF" />
                  <Text style={styles.linkText}>Mixcloud</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Set Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Set Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Boiler Room Berlin"
              placeholderTextColor={Colors.dark.textMuted}
              value={setName}
              onChangeText={handleSetNameChange}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DJ / Artist *</Text>
            <View style={styles.artistInputWrapper}>
              <User size={18} color={Colors.dark.textMuted} />
              <TextInput
                style={styles.artistInput}
                placeholder="e.g., Dixon"
                placeholderTextColor={Colors.dark.textMuted}
                value={artistName}
                onChangeText={handleArtistChange}
                onFocus={() => {
                  if (artistName.trim()) {
                    const suggestions = searchArtistsByQuery(artistName);
                    setArtistSuggestions(suggestions);
                    setShowArtistSuggestions(suggestions.length > 0);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowArtistSuggestions(false), 200);
                }}
              />
              {artistName.trim() && getArtistByName(artistName) && (
                <View style={styles.verifiedBadge}>
                  <CheckCircle size={14} color={Colors.dark.success} />
                </View>
              )}
            </View>
            
            {showArtistSuggestions && artistSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <FlatList
                  data={artistSuggestions}
                  renderItem={renderArtistSuggestion}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  keyboardShouldPersistTaps="handled"
                />
              </View>
            )}
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venue (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Kreuzberg Warehouse"
              placeholderTextColor={Colors.dark.textMuted}
              value={venue}
              onChangeText={setVenue}
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

        <Pressable 
          style={[styles.submitButton, duplicateWarning && styles.submitButtonWarning]} 
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>Submit Set</Text>
        </Pressable>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  duplicateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 67, 0.12)',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 67, 0.3)',
    gap: 12,
    marginBottom: 8,
  },
  duplicateContent: {
    flex: 1,
  },
  duplicateTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.warning,
    marginBottom: 2,
  },
  duplicateText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
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
  artistInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  artistInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 14,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  suggestionsContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  suggestionImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  suggestionMeta: {
    fontSize: 12,
    color: Colors.dark.textMuted,
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
  submitButtonWarning: {
    backgroundColor: Colors.dark.warning,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  bottomPadding: {
    height: 40,
  },
  thumbnailSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.dark.surface,
  },
  platformBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  linksSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  linksSectionTitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  linkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  linkText: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '500' as const,
  },
});
