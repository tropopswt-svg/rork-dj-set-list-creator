import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Search, Plus, Clock, Sparkles, Music2 } from 'lucide-react-native';
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
  onClose,
  onSelectTrack,
  onAddNew,
}: FillGapModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DatabaseTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  // Auto-focus search on open
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSearchResults([]);
      setTimeout(() => searchInputRef.current?.focus(), 350);
    }
  }, [visible]);

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

  const handleSelectFromDatabase = (dbTrack: DatabaseTrack) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const track: Track = {
      id: `db-${dbTrack.id}-${Date.now()}`,
      title: dbTrack.title,
      artist: dbTrack.artist,
      duration: 0,
      coverUrl: '',
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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlayTap} onPress={onClose} />

        <View style={styles.container}>
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.timestampPill}>
                <Clock size={12} color="#FFF" />
                <Text style={styles.timestampPillText}>{formatTime(timestamp)}</Text>
              </View>
              <Text style={styles.headerTitle}>Fill this gap</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <X size={18} color={Colors.dark.textMuted} />
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Search size={16} color={Colors.dark.textMuted} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search by track or artist..."
                placeholderTextColor={Colors.dark.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  style={styles.clearButton}
                  onPress={() => setSearchQuery('')}
                  hitSlop={6}
                >
                  <X size={14} color={Colors.dark.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Results */}
          <ScrollView
            style={styles.resultsList}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isSearching ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="small" color={Colors.dark.primary} />
                <Text style={styles.stateText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              searchResults.map((track) => (
                <Pressable
                  key={track.id}
                  style={styles.resultItem}
                  onPress={() => handleSelectFromDatabase(track)}
                >
                  <View style={styles.resultIcon}>
                    <Music2 size={14} color={Colors.dark.primary} />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.resultArtist} numberOfLines={1}>{track.artist}</Text>
                  </View>
                  <View style={styles.addIcon}>
                    <Plus size={16} color={Colors.dark.primary} />
                  </View>
                </Pressable>
              ))
            ) : searchQuery.length >= 2 ? (
              <View style={styles.stateContainer}>
                <Text style={styles.stateText}>No results found</Text>
                <Text style={styles.stateSubtext}>Try different keywords or add manually</Text>
              </View>
            ) : (
              <View style={styles.stateContainer}>
                <Sparkles size={28} color={Colors.dark.textMuted} />
                <Text style={styles.stateText}>Search the track database</Text>
                <Text style={styles.stateSubtext}>Or add a new track manually below</Text>
              </View>
            )}
          </ScrollView>

          {/* Add manually button */}
          <View style={styles.footer}>
            <Pressable style={styles.addManualButton} onPress={handleAddNew}>
              <Plus size={16} color="#FFF" />
              <Text style={styles.addManualText}>Add Manually</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTap: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    backgroundColor: 'rgba(245, 240, 232, 0.92)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(156, 150, 142, 0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timestampPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(196, 30, 58, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomColor: 'rgba(196, 30, 58, 0.4)',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timestampPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderTopColor: 'rgba(255, 255, 255, 1)',
    borderBottomColor: 'rgba(232, 226, 217, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(45, 42, 38, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderTopColor: 'rgba(255, 255, 255, 1)',
    borderBottomColor: 'rgba(232, 226, 217, 0.5)',
    shadowColor: 'rgba(45, 42, 38, 0.08)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 226, 217, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsContent: {
    paddingBottom: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomColor: 'rgba(232, 226, 217, 0.5)',
    shadowColor: 'rgba(45, 42, 38, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
    gap: 12,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 1,
  },
  resultArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateContainer: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 20,
    gap: 6,
  },
  stateText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  stateSubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 34,
  },
  addManualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(196, 30, 58, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomColor: 'rgba(196, 30, 58, 0.4)',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  addManualText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
});
