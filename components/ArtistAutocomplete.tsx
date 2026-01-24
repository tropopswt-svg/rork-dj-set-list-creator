import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { User, Check, Plus, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { searchArtists, findArtistMatches, isSupabaseConfigured } from '@/lib/supabase';
import type { DbArtist, ArtistMatch } from '@/lib/supabase/types';

interface ArtistAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectArtist?: (artist: DbArtist) => void;
  placeholder?: string;
  label?: string;
  showLabel?: boolean;
  style?: any;
}

export default function ArtistAutocomplete({
  value,
  onChangeText,
  onSelectArtist,
  placeholder = 'e.g., Chris Stussy',
  label = 'DJ / Artist',
  showLabel = true,
  style,
}: ArtistAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<ArtistMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<DbArtist | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!value || value.length < 2 || selectedArtist) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!isSupabaseConfigured()) {
        return;
      }

      setIsLoading(true);
      try {
        const matches = await findArtistMatches(value, 6);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      } catch (error) {
        console.error('[ArtistAutocomplete] Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, selectedArtist]);

  const handleSelectArtist = (match: ArtistMatch) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedArtist(match.artist);
    onChangeText(match.artist.name);
    setShowSuggestions(false);
    onSelectArtist?.(match.artist);
  };

  const handleTextChange = (text: string) => {
    setSelectedArtist(null);
    onChangeText(text);
    if (text.length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (value.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Delay hiding suggestions so tap can register
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return Colors.dark.success;
    if (confidence >= 0.8) return Colors.dark.primary;
    return Colors.dark.textMuted;
  };

  const renderSuggestion = ({ item }: { item: ArtistMatch }) => (
    <Pressable
      style={styles.suggestionItem}
      onPress={() => handleSelectArtist(item)}
    >
      <View style={styles.suggestionIcon}>
        <User size={16} color={Colors.dark.textMuted} />
      </View>
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName}>{item.artist.name}</Text>
        {item.artist.genres && item.artist.genres.length > 0 && (
          <Text style={styles.suggestionGenres}>
            {item.artist.genres.slice(0, 2).join(' • ')}
          </Text>
        )}
      </View>
      <View style={styles.suggestionMeta}>
        <View style={[
          styles.confidenceBadge,
          { backgroundColor: `${getConfidenceColor(item.confidence)}20` }
        ]}>
          <Text style={[
            styles.confidenceText,
            { color: getConfidenceColor(item.confidence) }
          ]}>
            {Math.round(item.confidence * 100)}%
          </Text>
        </View>
        <Check size={16} color={Colors.dark.primary} style={{ opacity: 0.5 }} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, style]}>
      {showLabel && <Text style={styles.label}>{label} *</Text>}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputContainerFocused,
        selectedArtist && styles.inputContainerSelected,
      ]}>
        <User size={18} color={selectedArtist ? Colors.dark.primary : Colors.dark.textMuted} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.dark.textMuted}
          value={value}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {isLoading && (
          <ActivityIndicator size="small" color={Colors.dark.primary} />
        )}
        {selectedArtist && (
          <View style={styles.selectedBadge}>
            <Check size={12} color={Colors.dark.success} />
          </View>
        )}
      </View>

      {selectedArtist && (
        <View style={styles.selectedInfo}>
          <Check size={12} color={Colors.dark.success} />
          <Text style={styles.selectedText}>
            Linked to artist profile
          </Text>
        </View>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>Artists in Database</Text>
          </View>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item) => item.artist.id}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
          />
          {value.length >= 2 && (
            <Pressable 
              style={styles.addNewOption}
              onPress={() => {
                setShowSuggestions(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Plus size={14} color={Colors.dark.textMuted} />
              <Text style={styles.addNewText}>
                Use "{value}" as new artist
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
    marginTop: 6,
    paddingHorizontal: 4,
  },
  selectedText: {
    fontSize: 12,
    color: Colors.dark.success,
  },
  suggestionsContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    marginTop: 8,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionInfo: {
    flex: 1,
    marginLeft: 10,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  suggestionGenres: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
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
