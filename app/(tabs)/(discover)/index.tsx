import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Search, Link2, TrendingUp, Clock, File } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SetFeedCard from '@/components/SetFeedCard';
import ImportSetModal from '@/components/ImportSetModal';
import { mockSetLists, mockUsers } from '@/mocks/tracks';
import { SetList } from '@/types';

type FilterType = 'trending' | 'recent';

const hotArtists = [
  { id: '1', name: 'Dixon', image: 'https://i1.sndcdn.com/avatars-yRPAjSgPbBr7tKDW-S5QKUQ-t500x500.jpg' },
  { id: '2', name: 'Âme', image: 'https://i1.sndcdn.com/avatars-000003875866-9tfo8r-t500x500.jpg' },
  { id: '3', name: 'Hunee', image: 'https://i1.sndcdn.com/avatars-000187309942-8gak9k-t500x500.jpg' },
  { id: '4', name: 'Ben Böhmer', image: 'https://i1.sndcdn.com/avatars-000335919042-c8i3vm-t500x500.jpg' },
  { id: '5', name: 'Chris Stussy', image: 'https://i1.sndcdn.com/avatars-000597139977-4pv4u3-t500x500.jpg' },
  { id: '6', name: 'Sama\'', image: 'https://i1.sndcdn.com/avatars-000336772399-82lf3w-t500x500.jpg' },
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
              <File size={16} color={Colors.dark.primary} />
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
                    <Image 
                      source={{ uri: artist.image }} 
                      style={styles.hotArtistImage}
                    />
                    <View style={styles.hotArtistRing} />
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
    borderRadius: 24,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: Colors.dark.text,
  },
  hotSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  hotArtistsContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  hotArtistItem: {
    alignItems: 'center',
    width: 72,
  },
  hotArtistImageWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  hotArtistImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  hotArtistRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  hotArtistName: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.dark.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
  },
  filterText: {
    fontSize: 12,
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
