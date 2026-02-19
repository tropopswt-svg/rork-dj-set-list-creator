import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, Clock, Music, Disc3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { SetList } from '@/types';
import { getSavedSets } from '@/utils/storage';

export default function LibraryScreen() {
  const router = useRouter();
  const [savedSets, setSavedSets] = useState<SetList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const loadSavedSets = useCallback(async () => {
    try {
      const sets = await getSavedSets();
      setSavedSets(sets);
    } catch (error) {
      if (__DEV__) console.error('Error loading saved sets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedSets();
    }, [loadSavedSets])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSavedSets();
  }, [loadSavedSets]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSetPress = (setList: SetList) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/${setList.id}`);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Saved</Text>
          <Text style={styles.subtitle}>{savedSets.length} sets</Text>
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
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
            </View>
          ) : savedSets.length > 0 ? (
            <View style={styles.setsList}>
              {savedSets.map((setList) => (
                <Pressable 
                  key={setList.id} 
                  style={styles.setCard}
                  onPress={() => handleSetPress(setList)}
                >
                  <Image 
                    source={{ uri: setList.coverUrl || undefined }} 
                    style={styles.setCover}
                  />
                  <View style={styles.setInfo}>
                    <Text style={styles.setArtist}>{setList.artist}</Text>
                    <Text style={styles.setName} numberOfLines={1}>{setList.name}</Text>
                    <View style={styles.setMeta}>
                      {(setList.totalDuration || 0) > 0 && (
                        <View style={styles.metaItem}>
                          <Clock size={12} color={Colors.dark.textMuted} />
                          <Text style={styles.metaText}>{formatDuration(setList.totalDuration || 0)}</Text>
                        </View>
                      )}
                      <View style={styles.metaItem}>
                        <Music size={12} color={Colors.dark.textMuted} />
                        <Text style={styles.metaText}>{setList.tracks.length} tracks</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.setDate}>{formatDate(setList.date)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Bookmark size={40} color={Colors.dark.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No saved sets yet</Text>
              <Text style={styles.emptySubtitle}>
                Save sets from the discover tab to access them quickly here
              </Text>
              <Pressable 
                style={styles.discoverButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/(discover)');
                }}
              >
                <Disc3 size={18} color={Colors.dark.background} />
                <Text style={styles.discoverButtonText}>Discover Sets</Text>
              </Pressable>
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  setsList: {
    paddingHorizontal: 20,
  },
  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  setCover: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  setInfo: {
    flex: 1,
    marginLeft: 14,
  },
  setArtist: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    marginBottom: 2,
  },
  setName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  setMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  setDate: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  discoverButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.background,
  },
});
