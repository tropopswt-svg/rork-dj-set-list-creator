import React, { useState } from 'react';
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
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

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
  const [setUrl, setSetUrl] = useState('');
  const [setName, setSetName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [venue, setVenue] = useState('');
  const [tracks, setTracks] = useState<PendingTrack[]>([]);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackTimestamp, setNewTrackTimestamp] = useState('');
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [thumbnail, setThumbnail] = useState('');
  const [platform, setPlatform] = useState('');
  const [links, setLinks] = useState<ScrapedLinks>({});

  const scrapeMutation = trpc.scraper.scrapeUrl.useMutation({
    onSuccess: (result) => {
      console.log('[Submit] Scrape result:', result);
      if (result.success && result.data) {
        setSetName(result.data.title || '');
        setArtistName(result.data.artist || '');
        setThumbnail(result.data.thumbnail || '');
        setPlatform(result.data.platform || '');
        setLinks(result.data.links || {});
        if (result.data.venue) setVenue(result.data.venue);
        
        if (result.data.tracks && result.data.tracks.length > 0) {
          const importedTracks: PendingTrack[] = result.data.tracks.map((t, i) => ({
            id: `imported-${Date.now()}-${i}`,
            title: t.title,
            artist: t.artist,
            timestamp: t.timestamp,
            confidence: t.confidence,
            source: t.source,
          }));
          setTracks(importedTracks);
          Alert.alert('Import Complete', `Found ${importedTracks.length} tracks from comments & tracklists`);
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
    
    console.log('[Submit] Starting import for URL:', url);
    scrapeMutation.mutate({ url });
  };

  const isImportingReal = scrapeMutation.isPending;

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

  const handleSubmit = () => {
    if (!setName.trim() || !artistName.trim()) {
      Alert.alert('Error', 'Please fill in set name and artist');
      return;
    }

    Alert.alert(
      'Set Submitted!',
      `Your set "${setName}" has been submitted for review. You'll earn points for each verified track.`,
      [
        {
          text: 'OK',
          onPress: () => {
            setSetUrl('');
            setSetName('');
            setArtistName('');
            setVenue('');
            setTracks([]);
            setThumbnail('');
            setPlatform('');
            setLinks({});
          },
        },
      ]
    );
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
                placeholder="YouTube, SoundCloud, or Mixcloud URL"
                placeholderTextColor={Colors.dark.textMuted}
                value={setUrl}
                onChangeText={setSetUrl}
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
              onChangeText={setSetName}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DJ / Artist *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dixon"
              placeholderTextColor={Colors.dark.textMuted}
              value={artistName}
              onChangeText={setArtistName}
            />
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

        <Pressable style={styles.submitButton} onPress={handleSubmit}>
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
