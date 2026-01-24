import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { X, Upload, FileSpreadsheet, Music, List, Check, AlertCircle, Copy, Trash2, Search, Plus, Cloud, Database } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSets } from '@/contexts/SetsContext';
import { SetList, Track } from '@/types';
import { trpc } from '@/lib/trpc.js';

type TabType = 'sets' | 'tracks' | 'soundcloud' | 'repository';

interface ParsedSet {
  name: string;
  artist: string;
  venue?: string;
  date: string;
  sourceUrl?: string;
  coverUrl?: string;
  valid: boolean;
  error?: string;
}

interface ParsedTrack {
  title: string;
  artist: string;
  timestamp: string;
  timestampSeconds: number;
  valid: boolean;
  error?: string;
}

interface SoundCloudTrack {
  title: string;
  artist: string;
  url: string;
  thumbnail?: string;
  duration?: number;
  playCount?: number;
  genre?: string;
}

const SETS_CSV_EXAMPLE = `name,artist,venue,date,sourceUrl,coverUrl
Ultra Miami 2024,Fisher,Miami,2024-03-24,https://soundcloud.com/fisher/ultra-2024,https://example.com/cover.jpg
Tomorrowland 2024,Charlotte de Witte,Belgium,2024-07-21,https://youtube.com/watch?v=xxx,`;

const TRACKS_CSV_EXAMPLE = `title,artist,timestamp
Losing It,Fisher,0:00
Bad Memories,Meduza,4:32
Cola,CamelPhat,12:45
Your Mind,Adam Beyer,1:02:30`;

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(p => parseInt(p, 10));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPlayCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

function parseCSV(text: string): string[][] {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === '\t') && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
}

export default function DevToolsScreen() {
  const router = useRouter();
  const { addSet, getSetById, sets, addTracksToSet, addTrackToRepository, trackRepository, removeTrackFromRepository } = useSets();
  const [activeTab, setActiveTab] = useState<TabType>('sets');
  const [setsInput, setSetsInput] = useState('');
  const [tracksInput, setTracksInput] = useState('');
  const [selectedSetId, setSelectedSetId] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: number; failed: number } | null>(null);
  
  const [soundcloudQuery, setSoundcloudQuery] = useState('');
  const [soundcloudResults, setSoundcloudResults] = useState<SoundCloudTrack[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [repoSearchQuery, setRepoSearchQuery] = useState('');

  const searchSoundCloud = trpc.scraper.searchSoundCloudTracks.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSoundcloudResults(data.results);
        console.log('[DevTools] SoundCloud search returned', data.results.length, 'results');
      }
    },
    onError: (error) => {
      console.error('[DevTools] SoundCloud search error:', error);
      Alert.alert('Search Error', 'Failed to search SoundCloud. Please try again.');
    },
  });

  const parsedSets = useMemo((): ParsedSet[] => {
    if (!setsInput.trim()) return [];
    
    const rows = parseCSV(setsInput);
    if (rows.length < 2) return [];
    
    const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, ''));
    const dataRows = rows.slice(1);
    
    return dataRows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });
      
      const name = obj['name'] || obj['setname'] || obj['title'] || '';
      const artist = obj['artist'] || obj['dj'] || '';
      const venue = obj['venue'] || obj['location'] || '';
      const date = obj['date'] || '';
      const sourceUrl = obj['sourceurl'] || obj['url'] || obj['link'] || '';
      const coverUrl = obj['coverurl'] || obj['cover'] || obj['image'] || '';
      
      const errors: string[] = [];
      if (!name) errors.push('Missing name');
      if (!artist) errors.push('Missing artist');
      if (!date) errors.push('Missing date');
      
      return {
        name,
        artist,
        venue,
        date,
        sourceUrl,
        coverUrl,
        valid: errors.length === 0,
        error: errors.join(', '),
      };
    }).filter(s => s.name || s.artist);
  }, [setsInput]);

  const parsedTracks = useMemo((): ParsedTrack[] => {
    if (!tracksInput.trim()) return [];
    
    const rows = parseCSV(tracksInput);
    if (rows.length < 2) return [];
    
    const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, ''));
    const dataRows = rows.slice(1);
    
    return dataRows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });
      
      const title = obj['title'] || obj['track'] || obj['trackname'] || obj['name'] || '';
      const artist = obj['artist'] || '';
      const timestamp = obj['timestamp'] || obj['time'] || obj['start'] || '0:00';
      
      const errors: string[] = [];
      if (!title) errors.push('Missing title');
      if (!artist) errors.push('Missing artist');
      
      const timestampSeconds = parseTimestamp(timestamp);
      
      return {
        title,
        artist,
        timestamp,
        timestampSeconds,
        valid: errors.length === 0,
        error: errors.join(', '),
      };
    }).filter(t => t.title || t.artist);
  }, [tracksInput]);

  const filteredRepository = useMemo(() => {
    if (!repoSearchQuery.trim()) return trackRepository.slice(0, 50);
    const query = repoSearchQuery.toLowerCase();
    return trackRepository.filter(t => 
      t.title.toLowerCase().includes(query) ||
      t.artist.toLowerCase().includes(query)
    ).slice(0, 50);
  }, [trackRepository, repoSearchQuery]);

  const handleImportSets = useCallback(() => {
    const validSets = parsedSets.filter(s => s.valid);
    if (validSets.length === 0) {
      Alert.alert('No Valid Sets', 'Please check your CSV format and try again.');
      return;
    }

    let success = 0;
    let failed = 0;

    validSets.forEach(ps => {
      const newSet: SetList = {
        id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: ps.name,
        artist: ps.artist,
        venue: ps.venue,
        date: new Date(ps.date),
        tracks: [],
        coverUrl: ps.coverUrl || `https://picsum.photos/seed/${ps.name.replace(/\s/g, '')}/400/400`,
        sourceLinks: ps.sourceUrl ? [{
          platform: ps.sourceUrl.includes('soundcloud') ? 'soundcloud' : 
                   ps.sourceUrl.includes('youtube') ? 'youtube' :
                   ps.sourceUrl.includes('mixcloud') ? 'mixcloud' : 'soundcloud',
          url: ps.sourceUrl,
        }] : [],
        plays: Math.floor(Math.random() * 10000),
      };

      const result = addSet(newSet);
      if (result.success) {
        success++;
        console.log('[DevTools] Set imported:', ps.name);
      } else {
        failed++;
        console.log('[DevTools] Set duplicate:', ps.name);
      }
    });

    setImportStatus({ success, failed });
    setSetsInput('');
    
    Alert.alert(
      'Import Complete',
      `Successfully imported: ${success}\nDuplicates/Failed: ${failed}`,
      [{ text: 'OK' }]
    );
  }, [parsedSets, addSet]);

  const handleImportTracks = useCallback(() => {
    if (!selectedSetId) {
      Alert.alert('Select a Set', 'Please select a set to add tracks to.');
      return;
    }

    const validTracks = parsedTracks.filter(t => t.valid);
    if (validTracks.length === 0) {
      Alert.alert('No Valid Tracks', 'Please check your CSV format and try again.');
      return;
    }

    const set = getSetById(selectedSetId);
    if (!set) {
      Alert.alert('Set Not Found', 'The selected set could not be found.');
      return;
    }

    const newTracks: Track[] = validTracks.map((pt, index) => ({
      id: `track-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      title: pt.title,
      artist: pt.artist,
      duration: 0,
      coverUrl: `https://picsum.photos/seed/${pt.title.replace(/\s/g, '')}/200/200`,
      addedAt: new Date(),
      source: 'manual' as const,
      timestamp: pt.timestampSeconds,
      verified: true,
    }));

    addTracksToSet(selectedSetId, newTracks);
    console.log('[DevTools] Tracks imported:', newTracks.length, 'to set:', set.name);
    
    Alert.alert(
      'Import Complete',
      `Successfully imported ${newTracks.length} tracks to "${set.name}".`,
      [{ text: 'OK' }]
    );
    
    setTracksInput('');
  }, [selectedSetId, parsedTracks, getSetById, addTracksToSet]);

  const copyExample = useCallback((type: 'sets' | 'tracks') => {
    const text = type === 'sets' ? SETS_CSV_EXAMPLE : TRACKS_CSV_EXAMPLE;
    if (type === 'sets') {
      setSetsInput(text);
    } else {
      setTracksInput(text);
    }
  }, []);

  const handleSoundCloudSearch = useCallback(() => {
    if (!soundcloudQuery.trim()) return;
    console.log('[DevTools] Searching SoundCloud for:', soundcloudQuery);
    searchSoundCloud.mutate({ query: soundcloudQuery });
  }, [soundcloudQuery, searchSoundCloud]);

  const toggleTrackSelection = useCallback((url: string) => {
    setSelectedTracks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  }, []);

  const handleAddSelectedToRepository = useCallback(() => {
    if (selectedTracks.size === 0) {
      Alert.alert('No Tracks Selected', 'Please select tracks to add to the repository.');
      return;
    }

    let success = 0;
    let failed = 0;

    soundcloudResults.forEach(track => {
      if (selectedTracks.has(track.url)) {
        const newTrack: Track = {
          id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: track.title,
          artist: track.artist,
          duration: track.duration || 0,
          coverUrl: track.thumbnail || `https://picsum.photos/seed/${track.title.replace(/\s/g, '')}/200/200`,
          addedAt: new Date(),
          source: 'link' as const,
          verified: false,
          trackLinks: [{ platform: 'soundcloud', url: track.url }],
        };

        const result = addTrackToRepository(newTrack);
        if (result.success) {
          success++;
        } else {
          failed++;
        }
      }
    });

    setSelectedTracks(new Set());
    
    Alert.alert(
      'Import Complete',
      `Added: ${success}\nDuplicates: ${failed}`,
      [{ text: 'OK' }]
    );
  }, [selectedTracks, soundcloudResults, addTrackToRepository]);

  const handleAddSingleTrack = useCallback((track: SoundCloudTrack) => {
    const newTrack: Track = {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: track.title,
      artist: track.artist,
      duration: track.duration || 0,
      coverUrl: track.thumbnail || `https://picsum.photos/seed/${track.title.replace(/\s/g, '')}/200/200`,
      addedAt: new Date(),
      source: 'link' as const,
      verified: false,
      trackLinks: [{ platform: 'soundcloud', url: track.url }],
    };

    const result = addTrackToRepository(newTrack);
    if (result.success) {
      Alert.alert('Added', `"${track.title}" added to repository.`);
    } else {
      Alert.alert('Duplicate', 'This track is already in the repository.');
    }
  }, [addTrackToRepository]);

  const handleRemoveFromRepository = useCallback((trackId: string, trackTitle: string) => {
    Alert.alert(
      'Remove Track',
      `Remove "${trackTitle}" from repository?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeTrackFromRepository(trackId) },
      ]
    );
  }, [removeTrackFromRepository]);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <FileSpreadsheet size={24} color={Colors.dark.primary} />
            <Text style={styles.headerTitle}>Dev Tools</Text>
          </View>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <X size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'sets' && styles.activeTab]}
              onPress={() => setActiveTab('sets')}
            >
              <List size={16} color={activeTab === 'sets' ? Colors.dark.primary : Colors.dark.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'sets' && styles.activeTabText]}>
                Sets
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'tracks' && styles.activeTab]}
              onPress={() => setActiveTab('tracks')}
            >
              <Music size={16} color={activeTab === 'tracks' ? Colors.dark.primary : Colors.dark.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'tracks' && styles.activeTabText]}>
                Tracks
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'soundcloud' && styles.activeTab]}
              onPress={() => setActiveTab('soundcloud')}
            >
              <Cloud size={16} color={activeTab === 'soundcloud' ? Colors.dark.primary : Colors.dark.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'soundcloud' && styles.activeTabText]}>
                SoundCloud
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'repository' && styles.activeTab]}
              onPress={() => setActiveTab('repository')}
            >
              <Database size={16} color={activeTab === 'repository' ? Colors.dark.primary : Colors.dark.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'repository' && styles.activeTabText]}>
                Repository ({trackRepository.length})
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'sets' ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Bulk Import Sets (CSV/TSV)</Text>
                <TouchableOpacity 
                  style={styles.exampleButton}
                  onPress={() => copyExample('sets')}
                >
                  <Copy size={14} color={Colors.dark.primary} />
                  <Text style={styles.exampleButtonText}>Load Example</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.helpText}>
                Paste CSV data with headers: name, artist, venue, date, sourceUrl, coverUrl
              </Text>
              
              <TextInput
                style={styles.csvInput}
                multiline
                placeholder={SETS_CSV_EXAMPLE}
                placeholderTextColor={Colors.dark.textSecondary + '60'}
                value={setsInput}
                onChangeText={setSetsInput}
                textAlignVertical="top"
              />

              {parsedSets.length > 0 && (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>
                    Preview ({parsedSets.filter(s => s.valid).length} valid / {parsedSets.length} total)
                  </Text>
                  <ScrollView style={styles.previewList} nestedScrollEnabled>
                    {parsedSets.slice(0, 10).map((ps, index) => (
                      <View key={index} style={[styles.previewItem, !ps.valid && styles.previewItemInvalid]}>
                        <View style={styles.previewItemHeader}>
                          {ps.valid ? (
                            <Check size={14} color={Colors.dark.success} />
                          ) : (
                            <AlertCircle size={14} color={Colors.dark.error} />
                          )}
                          <Text style={styles.previewItemTitle} numberOfLines={1}>
                            {ps.artist} - {ps.name}
                          </Text>
                        </View>
                        {ps.venue && (
                          <Text style={styles.previewItemSub}>{ps.venue} • {ps.date}</Text>
                        )}
                        {ps.error && (
                          <Text style={styles.previewItemError}>{ps.error}</Text>
                        )}
                      </View>
                    ))}
                    {parsedSets.length > 10 && (
                      <Text style={styles.moreText}>+{parsedSets.length - 10} more...</Text>
                    )}
                  </ScrollView>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setSetsInput('')}
                >
                  <Trash2 size={18} color={Colors.dark.textSecondary} />
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.importButton, parsedSets.filter(s => s.valid).length === 0 && styles.importButtonDisabled]}
                  onPress={handleImportSets}
                  disabled={parsedSets.filter(s => s.valid).length === 0}
                >
                  <Upload size={18} color="#fff" />
                  <Text style={styles.importButtonText}>
                    Import {parsedSets.filter(s => s.valid).length} Sets
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : activeTab === 'tracks' ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Bulk Import Tracks (CSV/TSV)</Text>
                <TouchableOpacity 
                  style={styles.exampleButton}
                  onPress={() => copyExample('tracks')}
                >
                  <Copy size={14} color={Colors.dark.primary} />
                  <Text style={styles.exampleButtonText}>Load Example</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Select Target Set</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.setsScroll}
              >
                {sets.slice(0, 20).map(set => (
                  <TouchableOpacity
                    key={set.id}
                    style={[styles.setChip, selectedSetId === set.id && styles.setChipSelected]}
                    onPress={() => setSelectedSetId(set.id)}
                  >
                    <Text 
                      style={[styles.setChipText, selectedSetId === set.id && styles.setChipTextSelected]}
                      numberOfLines={1}
                    >
                      {set.artist} - {set.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.helpText}>
                Paste CSV data with headers: title, artist, timestamp (e.g., 1:23:45 or 4:32)
              </Text>
              
              <TextInput
                style={styles.csvInput}
                multiline
                placeholder={TRACKS_CSV_EXAMPLE}
                placeholderTextColor={Colors.dark.textSecondary + '60'}
                value={tracksInput}
                onChangeText={setTracksInput}
                textAlignVertical="top"
              />

              {parsedTracks.length > 0 && (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>
                    Preview ({parsedTracks.filter(t => t.valid).length} valid / {parsedTracks.length} total)
                  </Text>
                  <ScrollView style={styles.previewList} nestedScrollEnabled>
                    {parsedTracks.slice(0, 15).map((pt, index) => (
                      <View key={index} style={[styles.previewItem, !pt.valid && styles.previewItemInvalid]}>
                        <View style={styles.previewItemHeader}>
                          {pt.valid ? (
                            <Check size={14} color={Colors.dark.success} />
                          ) : (
                            <AlertCircle size={14} color={Colors.dark.error} />
                          )}
                          <Text style={styles.previewItemTitle} numberOfLines={1}>
                            {pt.artist} - {pt.title}
                          </Text>
                        </View>
                        <Text style={styles.previewItemSub}>
                          @ {formatTimestamp(pt.timestampSeconds)}
                        </Text>
                        {pt.error && (
                          <Text style={styles.previewItemError}>{pt.error}</Text>
                        )}
                      </View>
                    ))}
                    {parsedTracks.length > 15 && (
                      <Text style={styles.moreText}>+{parsedTracks.length - 15} more...</Text>
                    )}
                  </ScrollView>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setTracksInput('')}
                >
                  <Trash2 size={18} color={Colors.dark.textSecondary} />
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.importButton, 
                    (parsedTracks.filter(t => t.valid).length === 0 || !selectedSetId) && styles.importButtonDisabled
                  ]}
                  onPress={handleImportTracks}
                  disabled={parsedTracks.filter(t => t.valid).length === 0 || !selectedSetId}
                >
                  <Upload size={18} color="#fff" />
                  <Text style={styles.importButtonText}>
                    Import {parsedTracks.filter(t => t.valid).length} Tracks
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : activeTab === 'soundcloud' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search SoundCloud Tracks</Text>
              <Text style={styles.helpText}>
                Search for tracks on SoundCloud and add them to your repository
              </Text>

              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search tracks, artists..."
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={soundcloudQuery}
                  onChangeText={setSoundcloudQuery}
                  onSubmitEditing={handleSoundCloudSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={[styles.searchButton, searchSoundCloud.isPending && styles.searchButtonDisabled]}
                  onPress={handleSoundCloudSearch}
                  disabled={searchSoundCloud.isPending}
                >
                  {searchSoundCloud.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Search size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>

              {soundcloudResults.length > 0 && (
                <>
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsCount}>{soundcloudResults.length} results</Text>
                    {selectedTracks.size > 0 && (
                      <TouchableOpacity
                        style={styles.addSelectedButton}
                        onPress={handleAddSelectedToRepository}
                      >
                        <Plus size={16} color="#fff" />
                        <Text style={styles.addSelectedText}>Add {selectedTracks.size} Selected</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView style={styles.resultsScroll} nestedScrollEnabled>
                    {soundcloudResults.map((track, index) => (
                      <TouchableOpacity
                        key={`${track.url}-${index}`}
                        style={[
                          styles.trackResult,
                          selectedTracks.has(track.url) && styles.trackResultSelected
                        ]}
                        onPress={() => toggleTrackSelection(track.url)}
                        onLongPress={() => handleAddSingleTrack(track)}
                      >
                        {track.thumbnail ? (
                          <Image source={{ uri: track.thumbnail }} style={styles.trackThumbnail} />
                        ) : (
                          <View style={[styles.trackThumbnail, styles.trackThumbnailPlaceholder]}>
                            <Music size={20} color={Colors.dark.textSecondary} />
                          </View>
                        )}
                        <View style={styles.trackInfo}>
                          <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                          <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                          <View style={styles.trackMeta}>
                            {track.duration && (
                              <Text style={styles.trackMetaText}>{formatDuration(track.duration)}</Text>
                            )}
                            {track.playCount !== undefined && (
                              <Text style={styles.trackMetaText}>▶ {formatPlayCount(track.playCount)}</Text>
                            )}
                            {track.genre && (
                              <Text style={styles.trackMetaText}>{track.genre}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.trackActions}>
                          {selectedTracks.has(track.url) ? (
                            <View style={styles.selectedBadge}>
                              <Check size={16} color="#fff" />
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.addButton}
                              onPress={() => handleAddSingleTrack(track)}
                            >
                              <Plus size={18} color={Colors.dark.primary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {!searchSoundCloud.isPending && soundcloudResults.length === 0 && soundcloudQuery && (
                <View style={styles.emptyState}>
                  <Cloud size={48} color={Colors.dark.textSecondary} />
                  <Text style={styles.emptyStateText}>No results found</Text>
                  <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Track Repository</Text>
              <Text style={styles.helpText}>
                {trackRepository.length} tracks in your repository
              </Text>

              <TextInput
                style={styles.repoSearchInput}
                placeholder="Search repository..."
                placeholderTextColor={Colors.dark.textSecondary}
                value={repoSearchQuery}
                onChangeText={setRepoSearchQuery}
              />

              {filteredRepository.length > 0 ? (
                <ScrollView style={styles.repoList} nestedScrollEnabled>
                  {filteredRepository.map((track) => (
                    <View key={track.id} style={styles.repoTrack}>
                      {track.coverUrl ? (
                        <Image source={{ uri: track.coverUrl }} style={styles.repoThumbnail} />
                      ) : (
                        <View style={[styles.repoThumbnail, styles.trackThumbnailPlaceholder]}>
                          <Music size={16} color={Colors.dark.textSecondary} />
                        </View>
                      )}
                      <View style={styles.repoTrackInfo}>
                        <Text style={styles.repoTrackTitle} numberOfLines={1}>{track.title}</Text>
                        <Text style={styles.repoTrackArtist} numberOfLines={1}>{track.artist}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleRemoveFromRepository(track.id, track.title)}
                      >
                        <Trash2 size={16} color={Colors.dark.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyState}>
                  <Database size={48} color={Colors.dark.textSecondary} />
                  <Text style={styles.emptyStateText}>
                    {repoSearchQuery ? 'No matching tracks' : 'Repository is empty'}
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    {repoSearchQuery ? 'Try a different search' : 'Add tracks from SoundCloud'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.formatGuide}>
            <Text style={styles.formatGuideTitle}>Tips</Text>
            <Text style={styles.formatGuideText}>
              • Use CSV tab for bulk imports{'\n'}
              • SoundCloud: Search and add tracks to repository{'\n'}
              • Long press on SoundCloud result to quick-add{'\n'}
              • Repository tracks can be used for track matching
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 8,
  },
  tabsScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
  },
  activeTab: {
    backgroundColor: Colors.dark.primary + '20',
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  activeTabText: {
    color: Colors.dark.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  exampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.primary + '20',
  },
  exampleButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  setsScroll: {
    marginBottom: 16,
  },
  setChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    marginRight: 8,
    maxWidth: 200,
  },
  setChipSelected: {
    backgroundColor: Colors.dark.primary,
  },
  setChipText: {
    fontSize: 13,
    color: Colors.dark.text,
  },
  setChipTextSelected: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  csvInput: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.dark.text,
    minHeight: 150,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  preview: {
    marginTop: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 12,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  previewList: {
    maxHeight: 200,
  },
  previewItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.dark.background,
    marginBottom: 6,
  },
  previewItemInvalid: {
    backgroundColor: Colors.dark.error + '15',
  },
  previewItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewItemTitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.text,
    flex: 1,
  },
  previewItemSub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    marginLeft: 22,
  },
  previewItemError: {
    fontSize: 11,
    color: Colors.dark.error,
    marginTop: 4,
    marginLeft: 22,
  },
  moreText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  importButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
  },
  importButtonDisabled: {
    backgroundColor: Colors.dark.primary + '40',
  },
  importButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  formatGuide: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
  },
  formatGuideTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  formatGuideText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: Colors.dark.primary + '60',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  addSelectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addSelectedText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  resultsScroll: {
    maxHeight: 400,
  },
  trackResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  trackResultSelected: {
    backgroundColor: Colors.dark.primary + '20',
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  trackThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: Colors.dark.border,
  },
  trackThumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  trackArtist: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  trackMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  trackMetaText: {
    fontSize: 11,
    color: Colors.dark.textSecondary + 'aa',
  },
  trackActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  repoSearchInput: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  repoList: {
    maxHeight: 400,
  },
  repoTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  repoThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: Colors.dark.border,
  },
  repoTrackInfo: {
    flex: 1,
    gap: 2,
  },
  repoTrackTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  repoTrackArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
