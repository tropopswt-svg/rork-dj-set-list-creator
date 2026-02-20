import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Search, X, ChevronRight, Music } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getGenresWithCounts, type GenreInfo } from '@/lib/supabase/artistService';

export default function GenresScreen() {
  const router = useRouter();
  const [genres, setGenres] = useState<GenreInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadGenres();
  }, []);

  const loadGenres = async () => {
    setIsLoading(true);
    const data = await getGenresWithCounts();
    setGenres(data);
    setIsLoading(false);
  };

  const filteredGenres = useMemo(() => {
    if (!searchQuery) return genres;
    const q = searchQuery.toLowerCase();
    return genres.filter(g => g.genre.toLowerCase().includes(q));
  }, [genres, searchQuery]);

  const handleGenrePress = (genre: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/genre/${encodeURIComponent(genre)}`);
  };

  const renderGenreCard = ({ item }: { item: GenreInfo }) => (
    <Pressable
      style={({ pressed }) => [styles.genreCard, pressed && styles.genreCardPressed]}
      onPress={() => handleGenrePress(item.genre)}
    >
      <View style={styles.genreIconContainer}>
        <Music size={18} color={Colors.dark.primary} />
      </View>
      <View style={styles.genreInfo}>
        <Text style={styles.genreName}>{item.genre}</Text>
        <Text style={styles.genreCount}>
          {item.artistCount} artist{item.artistCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <ChevronRight size={18} color={Colors.dark.textMuted} />
    </Pressable>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          title: '',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </Pressable>
          ),
          headerTitle: () => (
            <Text style={styles.headerTitle}>Genres</Text>
          ),
        }}
      />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={18} color={Colors.dark.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search genres..."
              placeholderTextColor={Colors.dark.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={18} color={Colors.dark.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Results count */}
        {!isLoading && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {filteredGenres.length} genre{filteredGenres.length !== 1 ? 's' : ''}
              {searchQuery ? ` matching "${searchQuery}"` : ''}
            </Text>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredGenres}
            keyExtractor={(item) => item.genre}
            renderItem={renderGenreCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Music size={48} color={Colors.dark.textMuted} />
                <Text style={styles.emptyTitle}>No genres found</Text>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Try a different search term' : 'No genres available'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.dark.text,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsCount: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  genreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  genreCardPressed: {
    backgroundColor: Colors.dark.cardHover,
  },
  genreIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  genreInfo: {
    flex: 1,
  },
  genreName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  genreCount: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
});
