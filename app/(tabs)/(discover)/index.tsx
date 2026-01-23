import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Search, Link2, TrendingUp, Clock, Flame } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SetFeedCard from '@/components/SetFeedCard';
import ImportSetModal from '@/components/ImportSetModal';
import { useSets, useFilteredSets } from '@/contexts/SetsContext';
import { SetList } from '@/types';

type FilterType = 'trending' | 'recent';

export default function DiscoverScreen() {
  const router = useRouter();
  const { allArtists, addSet } = useSets();
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('trending');
  const [refreshing, setRefreshing] = useState(false);

  const filteredSets = useFilteredSets(searchQuery, activeFilter);

  const hotArtists = allArtists
    .filter(a => a.imageUrl)
    .sort((a, b) => (b.setsCount || 0) - (a.setsCount || 0))
    .slice(0, 8);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleImport = async (url: string, platform: 'youtube' | 'soundcloud' | 'mixcloud' | '1001tracklists') => {
    // The ImportSetModal now handles the scraping internally
    // This callback is called after successful scrape
    // We'll use the library screen's import logic as reference
    setShowImportModal(false);
    
    // The modal will handle the actual import and navigation
    // This is just a placeholder - the real work happens in ImportSetModal
  };

  const handleArtistPress = (artistName: string) => {
    Haptics.selectionAsync();
    setSearchQuery(artistName);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Pressable 
            style={styles.addButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowImportModal(true);
            }}
          >
            <Link2 size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Search size={16} color={Colors.dark.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sets, artists, venues..."
            placeholderTextColor={Colors.dark.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
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
          {!searchQuery && (
            <View style={styles.hotSection}>
              <View style={styles.sectionHeader}>
                <Flame size={16} color={Colors.dark.primary} />
                <Text style={styles.sectionTitle}>Hot Artists</Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hotArtistsContainer}
              >
                {hotArtists.map((artist) => (
                  <Pressable 
                    key={artist.id} 
                    style={styles.hotArtistItem}
                    onPress={() => handleArtistPress(artist.name)}
                  >
                    <View style={styles.hotArtistImageWrapper}>
                      <View style={styles.hotArtistGradientRing}>
                        <View style={styles.hotArtistInnerRing}>
                          <Image 
                            source={{ uri: artist.imageUrl }} 
                            style={styles.hotArtistImage}
                            contentFit="cover"
                          />
                        </View>
                      </View>
                    </View>
                    <Text style={styles.hotArtistName} numberOfLines={1}>{artist.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.filterRow}>
            <Pressable 
              style={[styles.filterChip, activeFilter === 'trending' && styles.filterChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter('trending');
              }}
            >
              <TrendingUp size={13} color={activeFilter === 'trending' ? '#fff' : Colors.dark.textSecondary} />
              <Text style={[styles.filterText, activeFilter === 'trending' && styles.filterTextActive]}>Trending</Text>
            </Pressable>
            <Pressable 
              style={[styles.filterChip, activeFilter === 'recent' && styles.filterChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter('recent');
              }}
            >
              <Clock size={13} color={activeFilter === 'recent' ? '#fff' : Colors.dark.textSecondary} />
              <Text style={[styles.filterText, activeFilter === 'recent' && styles.filterTextActive]}>Recent</Text>
            </Pressable>
          </View>

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
                <Search size={28} color={Colors.dark.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No sets found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different search or import a new set
              </Text>
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    letterSpacing: -0.3,
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
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.dark.text,
  },
  hotSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  hotArtistsContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  hotArtistItem: {
    alignItems: 'center',
    width: 76,
  },
  hotArtistImageWrapper: {
    marginBottom: 8,
  },
  hotArtistGradientRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.primary,
    padding: 2.5,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  hotArtistInnerRing: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    backgroundColor: Colors.dark.background,
    padding: 2.5,
  },
  hotArtistImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  hotArtistName: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.text,
    textAlign: 'center',
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
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
