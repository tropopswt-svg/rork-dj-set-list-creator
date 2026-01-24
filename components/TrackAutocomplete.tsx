import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Music, Check, Plus, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { searchTracks, isSupabaseConfigured } from '@/lib/supabase';
import type { DbTrack } from '@/lib/supabase/types';

interface TrackAutocompleteProps {
  title: string;
  artist: string;
  onChangeTitle: (text: string) => void;
  onChangeArtist: (text: string) => void;
  onSelectTrack?: (track: DbTrack) => void;
  titlePlaceholder?: string;
  artistPlaceholder?: string;
  showLabels?: boolean;
  style?: any;
}

export default function TrackAutocomplete({
  title,
  artist,
  onChangeTitle,
  onChangeArtist,
  onSelectTrack,
  titlePlaceholder = 'e.g., Strobe',
  artistPlaceholder = 'e.g., deadmau5',
  showLabels = true,
  style,
}: TrackAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<DbTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<DbTrack | null>(null);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isArtistFocused, setIsArtistFocused] = useState(false);

  // Debounced search
  useEffect(() => {
    const query = title || artist;
    if (!query || query.length < 2 || selectedTrack) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!isSupabaseConfigured()) {
        return;
      }

      setIsLoading(true);
      try {
        // Search by title and artist combined
        const searchQuery = title && artist ? `${title} ${artist}` : query;
        const results = await searchTracks(searchQuery, 6);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error('[TrackAutocomplete] Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [title, artist, selectedTrack]);

  const handleSelectTrack = (track: DbTrack) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTrack(track);
    onChangeTitle(track.title);
    onChangeArtist(track.artist_name);
    setShowSuggestions(false);
    onSelectTrack?.(track);
  };

  const handleTitleChange = (text: string) => {
    setSelectedTrack(null);
    onChangeTitle(text);
    if (text.length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleArtistChange = (text: string) => {
    setSelectedTrack(null);
    onChangeArtist(text);
    if (text.length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleFocus = (field: 'title' | 'artist') => {
    if (field === 'title') setIsTitleFocused(true);
    else setIsArtistFocused(true);
    
    const query = title || artist;
    if (query.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = (field: 'title' | 'artist') => {
    if (field === 'title') setIsTitleFocused(false);
    else setIsArtistFocused(false);
    
    // Delay hiding suggestions so tap can register
    setTimeout(() => {
      if (!isTitleFocused && !isArtistFocused) {
        setShowSuggestions(false);
      }
    }, 200);
  };

  const renderSuggestion = ({ item }: { item: DbTrack }) => (
    <Pressable
      style={styles.suggestionItem}
      onPress={() => handleSelectTrack(item)}
    >
      <View style={[
        styles.suggestionIcon,
        item.is_unreleased && styles.suggestionIconUnreleased,
      ]}>
        {item.is_unreleased ? (
          <AlertCircle size={16} color={Colors.dark.primary} />
        ) : (
          <Music size={16} color={Colors.dark.textMuted} />
        )}
      </View>
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionTitle} numberOfLines={1}>
          {item.title}
          {item.remix_artist_name && (
            <Text style={styles.remixText}> ({item.remix_artist_name} {item.remix_type || 'Remix'})</Text>
          )}
        </Text>
        <Text style={styles.suggestionArtist} numberOfLines={1}>
          {item.artist_name}
          {item.label && <Text style={styles.labelText}> • {item.label}</Text>}
        </Text>
      </View>
      <View style={styles.suggestionMeta}>
        {item.is_unreleased && (
          <View style={styles.unreleasedBadge}>
            <Text style={styles.unreleasedText}>Unreleased</Text>
          </View>
        )}
        {item.times_played > 0 && (
          <Text style={styles.playsText}>
            {item.times_played} plays
          </Text>
        )}
        <Check size={16} color={Colors.dark.primary} style={{ opacity: 0.5 }} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, style]}>
      {/* Title Input */}
      <View style={styles.inputGroup}>
        {showLabels && <Text style={styles.label}>Track Title *</Text>}
        <View style={[
          styles.inputContainer,
          isTitleFocused && styles.inputContainerFocused,
          selectedTrack && styles.inputContainerSelected,
        ]}>
          <Music size={18} color={selectedTrack ? Colors.dark.primary : Colors.dark.textMuted} />
          <TextInput
            style={styles.input}
            placeholder={titlePlaceholder}
            placeholderTextColor={Colors.dark.textMuted}
            value={title}
            onChangeText={handleTitleChange}
            onFocus={() => handleFocus('title')}
            onBlur={() => handleBlur('title')}
          />
          {isLoading && isTitleFocused && (
            <ActivityIndicator size="small" color={Colors.dark.primary} />
          )}
          {selectedTrack && (
            <View style={styles.selectedBadge}>
              <Check size={12} color={Colors.dark.success} />
            </View>
          )}
        </View>
      </View>

      {/* Artist Input */}
      <View style={styles.inputGroup}>
        {showLabels && <Text style={styles.label}>Artist *</Text>}
        <View style={[
          styles.inputContainer,
          isArtistFocused && styles.inputContainerFocused,
          selectedTrack && styles.inputContainerSelected,
        ]}>
          <TextInput
            style={[styles.input, { marginLeft: 0 }]}
            placeholder={artistPlaceholder}
            placeholderTextColor={Colors.dark.textMuted}
            value={artist}
            onChangeText={handleArtistChange}
            onFocus={() => handleFocus('artist')}
            onBlur={() => handleBlur('artist')}
          />
          {isLoading && isArtistFocused && (
            <ActivityIndicator size="small" color={Colors.dark.primary} />
          )}
        </View>
      </View>

      {selectedTrack && (
        <View style={styles.selectedInfo}>
          <Check size={12} color={Colors.dark.success} />
          <Text style={styles.selectedText}>
            Linked to track in database
            {selectedTrack.is_unreleased && ' (Unreleased)'}
          </Text>
        </View>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>Tracks in Database</Text>
          </View>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
          />
          {(title.length >= 2 || artist.length >= 2) && (
            <Pressable 
              style={styles.addNewOption}
              onPress={() => {
                setShowSuggestions(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Plus size={14} color={Colors.dark.textMuted} />
              <Text style={styles.addNewText}>
                Add as new track
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.dark.textSecondary,
    marginBottom: 6,
  },
  inputContainer: {
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
  inputContainerFocused: {
    borderColor: Colors.dark.primary,
  },
  inputContainerSelected: {
    borderColor: Colors.dark.success,
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.text,
    marginLeft: 10,
  },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  selectedText: {
    fontSize: 12,
    color: Colors.dark.success,
  },
  suggestionsContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    marginTop: -6,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  suggestionsHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  suggestionsTitle: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIconUnreleased: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  suggestionInfo: {
    flex: 1,
    marginLeft: 10,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  remixText: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.dark.textSecondary,
  },
  suggestionArtist: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  labelText: {
    color: Colors.dark.textMuted,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreleasedBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreleasedText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  playsText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  addNewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  addNewText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
});
