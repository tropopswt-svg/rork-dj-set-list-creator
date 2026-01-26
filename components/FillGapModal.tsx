import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Search, Music, Plus, Clock, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Track } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

interface FillGapModalProps {
  visible: boolean;
  timestamp: number;
  unplacedTracks: Track[];
  onClose: () => void;
  onSelectTrack: (track: Track, timestamp: number) => void;
  onAddNew: () => void;
}

interface DatabaseTrack {
  id: string;
  title: string;
  artist: string;
  plays?: number;
}

export default function FillGapModal({
  visible,
  timestamp,
  unplacedTracks,
  onClose,
  onSelectTrack,
  onAddNew,
}: FillGapModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DatabaseTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'unplaced' | 'search'>('unplaced');

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  // Search database for tracks
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchTracks = async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/tracks/search?q=${encodeURIComponent(searchQuery)}&limit=20`
        );
        const data = await response.json();
        if (data.success && data.tracks) {
          setSearchResults(data.tracks);
        }
      } catch (error) {
        console.error('[FillGapModal] Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchTracks, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelectUnplaced = (track: Track) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectTrack(track, timestamp);
    onClose();
  };

  const handleSelectFromDatabase = (dbTrack: DatabaseTrack) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const track: Track = {
      id: `db-${dbTrack.id}-${Date.now()}`,
      title: dbTrack.title,
      artist: dbTrack.artist,
      duration: 0,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date(),
      source: 'database',
      timestamp: timestamp,
      verified: true,
    };
    onSelectTrack(track, timestamp);
    onClose();
  };

  const handleAddNew = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddNew();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Clock size={18} color={Colors.dark.primary} />
              <Text style={styles.headerTitle}>Fill Gap at {formatTime(timestamp)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={Colors.dark.textMuted} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === 'unplaced' && styles.tabActive]}
              onPress={() => setActiveTab('unplaced')}
            >
              <Text style={[styles.tabText, activeTab === 'unplaced' && styles.tabTextActive]}>
                Unplaced ({unplacedTracks.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'search' && styles.tabActive]}
              onPress={() => setActiveTab('search')}
            >
              <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
                Search All Tracks
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          {activeTab === 'unplaced' ? (
            <ScrollView style={styles.trackList} showsVerticalScrollIndicator={false}>
              {unplacedTracks.length > 0 ? (
                unplacedTracks.map((track, index) => (
                  <Pressable
                    key={track.id}
                    style={styles.trackItem}
                    onPress={() => handleSelectUnplaced(track)}
                  >
                    <View style={styles.trackIndex}>
                      <Text style={styles.trackIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                    </View>
                    <Plus size={18} color={Colors.dark.primary} />
                  </Pressable>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No unplaced tracks</Text>
                  <Text style={styles.emptySubtext}>Search the database or add a new track</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.searchSection}>
              {/* Search Input */}
              <View style={styles.searchInputContainer}>
                <Search size={16} color={Colors.dark.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by title or artist..."
                  placeholderTextColor={Colors.dark.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <X size={16} color={Colors.dark.textMuted} />
                  </Pressable>
                )}
              </View>

              {/* Search Results */}
              <ScrollView style={styles.trackList} showsVerticalScrollIndicator={false}>
                {isSearching ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator size="small" color={Colors.dark.primary} />
                    <Text style={styles.loadingText}>Searching...</Text>
                  </View>
                ) : searchResults.length > 0 ? (
                  searchResults.map((track) => (
                    <Pressable
                      key={track.id}
                      style={styles.trackItem}
                      onPress={() => handleSelectFromDatabase(track)}
                    >
                      <View style={styles.trackIconContainer}>
                        <Sparkles size={14} color={Colors.dark.primary} />
                      </View>
                      <View style={styles.trackInfo}>
                        <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                      </View>
                      <Plus size={18} color={Colors.dark.primary} />
                    </Pressable>
                  ))
                ) : searchQuery.length >= 2 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No tracks found</Text>
                    <Text style={styles.emptySubtext}>Try a different search term</Text>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Search the database</Text>
                    <Text style={styles.emptySubtext}>Type at least 2 characters to search</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Add New Button */}
          <Pressable style={styles.addNewButton} onPress={handleAddNew}>
            <Plus size={18} color={Colors.dark.background} />
            <Text style={styles.addNewButtonText}>Add New Track Manually</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  tabs: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.dark.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: Colors.dark.background,
  },
  trackList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  trackIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackIndexText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  trackIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${Colors.dark.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  searchSection: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
  },
  loadingState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    marginHorizontal: 12,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addNewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.background,
  },
});
