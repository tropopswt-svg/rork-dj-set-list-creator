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
import { mockSetLists } from '@/mocks/tracks';
import { SetList } from '@/types';

type FilterType = 'trending' | 'recent';

const hotArtists = [
  { id: '1', name: 'Dixon', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop' },
  { id: '2', name: 'Âme', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop' },
  { id: '3', name: 'Hunee', image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=200&h=200&fit=crop' },
  { id: '4', name: 'Ben Böhmer', image: 'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=200&h=200&fit=crop' },
  { id: '5', name: 'Chris Stussy', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop' },
  { id: '6', name: 'Sama\'', image: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=200&h=200&fit=crop' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [setLists, setSetLists] = useState<SetList[]>(mockSetLists);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('trending');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleImport = (url: string, platform: 'youtube' | 'soundcloud' | 'mixcloud') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const newSet: SetList = {
      id: Date.now().toString(),
      name: 'New Imported Set',
      artist: 'Unknown Artist',
      venue: 'Processing...',
      date: new Date(),
      tracks: [],
      sourceLinks: [{ platform, url }],
      totalDuration: 0,
      aiProcessed: false,
      commentsScraped: 0,
      tracksIdentified: 0,
      plays: 0,
    };
    
    setSetLists([newSet, ...setLists]);
    setShowImportModal(false);
    
    router.push(`/(tabs)/(discover)/${newSet.id}`);
  };

  const filteredSets = setLists
    .filter(set => 
      set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      set.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      set.venue?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (activeFilter === 'trending') {
        return (b.plays || 0) - (a.plays || 0);
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

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
                  onPress={() => {
                    Haptics.selectionAsync();
                  }}
                >
                  <View style={styles.hotArtistImageWrapper}>
                    <View style={styles.hotArtistGradientRing}>
                      <View style={styles.hotArtistInnerRing}>
                        <Image 
                          source={{ uri: artist.image }} 
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
