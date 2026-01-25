import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Link2, TrendingUp, Clock, Database } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SetFeedCard from '@/components/SetFeedCard';
import IDentifiedLogo from '@/components/IDentifiedLogo';
import ImportSetModal from '@/components/ImportSetModal';
import { mockSetLists } from '@/mocks/tracks';
import { SetList } from '@/types';
import { useDebounce } from '@/utils/hooks';
import { ImportResult } from '@/services/importService';

// API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

type FilterType = 'trending' | 'recent';

export default function DiscoverScreen() {
  const router = useRouter();
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [dbSets, setDbSets] = useState<SetList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState<FilterType>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [dbStats, setDbStats] = useState({ sets: 0, tracks: 0 });

  // Fetch sets from database
  const fetchSets = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sets?limit=50&sort=${activeFilter === 'trending' ? 'popular' : 'recent'}`);
      const data = await response.json();

      if (data.success && data.sets) {
        // Transform API response to match SetList type
        const transformedSets: SetList[] = data.sets.map((set: any) => ({
          id: set.id,
          name: set.name,
          artist: set.artist,
          venue: set.venue,
          date: new Date(set.date),
          totalDuration: set.totalDuration || 0,
          coverUrl: set.coverUrl || 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
          plays: set.trackCount * 10, // Estimate plays from track count
          tracks: [],
          sourceLinks: set.sourceLinks || [],
          trackCount: set.trackCount,
          source: 'database',
        }));
        setDbSets(transformedSets);
        setDbStats({ sets: data.total || transformedSets.length, tracks: 0 });
        console.log('[Discover] Loaded', transformedSets.length, 'sets from database');
      }
    } catch (error) {
      console.error('[Discover] Failed to fetch sets:', error);
      // Fallback to mock data if API fails
      setDbSets([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  // Load sets on mount and when filter changes
  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  // Combine database sets with any local/mock sets
  useEffect(() => {
    // Prioritize database sets, add mock sets as fallback demos
    const combined = [...dbSets];
    // Only add mock sets if we have no database sets
    if (combined.length === 0) {
      combined.push(...mockSetLists);
    }
    setSetLists(combined);
  }, [dbSets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSets();
    setRefreshing(false);
  }, [fetchSets]);

  const handleImport = (result: ImportResult) => {
    if (!result.success || !result.setList) {
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setSetLists([result.setList, ...setLists]);
    setShowImportModal(false);

    router.push(`/(tabs)/(discover)/${result.setList.id}`);
  };

  const filteredSets = useMemo(() => {
    return setLists
      .filter(set => {
        if (!debouncedSearchQuery) return true;
        const query = debouncedSearchQuery.toLowerCase();
        return (
          set.name.toLowerCase().includes(query) ||
          set.artist.toLowerCase().includes(query) ||
          set.venue?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (activeFilter === 'trending') {
          return (b.plays || 0) - (a.plays || 0);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [setLists, debouncedSearchQuery, activeFilter]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <IDentifiedLogo />
          <View style={styles.headerSpacer}>
            <Pressable 
              style={styles.addButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowImportModal(true);
              }}
            >
              <Link2 size={18} color={Colors.dark.background} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.dark.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sets, artists, venues..."
            placeholderTextColor={Colors.dark.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, activeFilter === 'trending' && styles.filterChipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveFilter('trending');
            }}
          >
            <TrendingUp size={14} color={activeFilter === 'trending' ? Colors.dark.background : Colors.dark.textSecondary} />
            <Text style={[styles.filterText, activeFilter === 'trending' && styles.filterTextActive]}>Popular</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, activeFilter === 'recent' && styles.filterChipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveFilter('recent');
            }}
          >
            <Clock size={14} color={activeFilter === 'recent' ? Colors.dark.background : Colors.dark.textSecondary} />
            <Text style={[styles.filterText, activeFilter === 'recent' && styles.filterTextActive]}>Recent</Text>
          </Pressable>
          {dbStats.sets > 0 && (
            <View style={styles.dbBadge}>
              <Database size={12} color={Colors.dark.primary} />
              <Text style={styles.dbBadgeText}>{dbStats.sets} sets</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.dark.primary}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
              <Text style={styles.loadingText}>Loading sets...</Text>
            </View>
          ) : (
            <>
              {filteredSets.map(setList => (
                <SetFeedCard
                  key={setList.id}
                  setList={setList}
                  onPress={() => router.push(`/(tabs)/(discover)/${setList.id}`)}
                />
              ))}

              {filteredSets.length === 0 && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Search size={32} color={Colors.dark.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>No sets found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try a different search or import a new set
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <ImportSetModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSpacer: {
    width: 44,
    alignItems: 'flex-end',
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.dark.text,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  filterTextActive: {
    color: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  dbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  dbBadgeText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
});
