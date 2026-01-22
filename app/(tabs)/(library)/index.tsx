import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, Clock, Music, Disc3, Link2, Plus, Sparkles, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { useSets } from '@/contexts/SetsContext';
import { trpc } from '@/lib/trpc';
import { SetList } from '@/types';

export default function LibraryScreen() {
  const router = useRouter();
  const { savedSets, addSet, toggleSaveSet, findDuplicateSet } = useSets();
  const [showImportForm, setShowImportForm] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  const scrapeMutation = trpc.scraper.scrapeUrl.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        const sourceLinks: SetList['sourceLinks'] = [];
        if (result.data.links.youtube) sourceLinks.push({ platform: 'youtube', url: result.data.links.youtube });
        if (result.data.links.soundcloud) sourceLinks.push({ platform: 'soundcloud', url: result.data.links.soundcloud });
        if (result.data.links.mixcloud) sourceLinks.push({ platform: 'mixcloud', url: result.data.links.mixcloud });

        const newSet: SetList = {
          id: Date.now().toString(),
          name: result.data.title || 'Unknown Set',
          artist: result.data.artist || 'Unknown Artist',
          venue: result.data.venue,
          date: new Date(),
          tracks: result.data.tracks.map((t, i) => ({
            id: `track-${Date.now()}-${i}`,
            title: t.title,
            artist: t.artist,
            timestamp: parseTimestamp(t.timestamp),
            duration: 0,
            coverUrl: result.data?.thumbnail || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
            addedAt: new Date(),
            source: 'ai' as const,
            verified: false,
          })),
          coverUrl: result.data.thumbnail,
          sourceLinks,
          totalDuration: 0,
          aiProcessed: true,
          commentsScraped: result.data.comments?.length || 0,
          tracksIdentified: result.data.tracks.length,
          plays: 0,
        };

        const addResult = addSet(newSet);
        
        if (addResult.success) {
          toggleSaveSet(addResult.set.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            'Set Added to Library',
            `"${newSet.name}" by ${newSet.artist} has been added with ${newSet.tracks.length} tracks.`,
            [{ text: 'View', onPress: () => router.push(`/(tabs)/(discover)/${addResult.set.id}`) }]
          );
        } else if (addResult.duplicate) {
          toggleSaveSet(addResult.duplicate.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert(
            'Set Already Exists',
            `"${addResult.duplicate.name}" is already in your library.`,
            [{ text: 'View', onPress: () => router.push(`/(tabs)/(discover)/${addResult.duplicate?.id}`) }]
          );
        }

        setShowImportForm(false);
        setImportUrl('');
      } else {
        Alert.alert('Import Failed', result.error || 'Could not import from this URL');
      }
    },
    onError: (error) => {
      console.error('[Library] Import error:', error);
      Alert.alert('Error', 'Failed to import set. Please try again.');
    },
  });

  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const handleImport = () => {
    if (!importUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    let url = importUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const duplicate = findDuplicateSet(url);
    if (duplicate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Set Already Exists',
        `"${duplicate.name}" by ${duplicate.artist} is already in the library.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View', onPress: () => router.push(`/(tabs)/(discover)/${duplicate.id}`) },
        ]
      );
      return;
    }

    scrapeMutation.mutate({ url });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

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
          <View>
            <Text style={styles.title}>Library</Text>
            <Text style={styles.subtitle}>{savedSets.length} saved sets</Text>
          </View>
          <Pressable
            style={styles.addButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowImportForm(!showImportForm);
            }}
          >
            {showImportForm ? (
              <X size={18} color="#fff" />
            ) : (
              <Plus size={18} color="#fff" />
            )}
          </Pressable>
        </View>

        {showImportForm && (
          <View style={styles.importForm}>
            <Text style={styles.importTitle}>Import Set from URL</Text>
            <View style={styles.importInputRow}>
              <View style={styles.importInputWrapper}>
                <Link2 size={16} color={Colors.dark.textMuted} />
                <TextInput
                  style={styles.importInput}
                  placeholder="SoundCloud, YouTube, or Mixcloud URL"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={importUrl}
                  onChangeText={setImportUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Pressable
                style={[styles.importButton, scrapeMutation.isPending && styles.importButtonDisabled]}
                onPress={handleImport}
                disabled={scrapeMutation.isPending}
              >
                {scrapeMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Sparkles size={16} color="#fff" />
                )}
              </Pressable>
            </View>
            <Text style={styles.importHint}>
              Paste a link to automatically import set details and tracklist
            </Text>
          </View>
        )}

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {savedSets.length > 0 ? (
            <View style={styles.setsList}>
              {savedSets.map((setList) => (
                <Pressable 
                  key={setList.id} 
                  style={styles.setCard}
                  onPress={() => handleSetPress(setList)}
                >
                  <Image 
                    source={{ uri: setList.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop' }} 
                    style={styles.setCover}
                  />
                  <View style={styles.setInfo}>
                    <Text style={styles.setArtist}>{setList.artist}</Text>
                    <Text style={styles.setName} numberOfLines={1}>{setList.name}</Text>
                    <View style={styles.setMeta}>
                      <View style={styles.metaItem}>
                        <Clock size={12} color={Colors.dark.textMuted} />
                        <Text style={styles.metaText}>{formatDuration(setList.totalDuration || 0)}</Text>
                      </View>
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
                Import sets from SoundCloud or 1001Tracklists, or save them from the discover tab
              </Text>
              <Pressable 
                style={styles.discoverButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowImportForm(true);
                }}
              >
                <Link2 size={18} color={Colors.dark.background} />
                <Text style={styles.discoverButtonText}>Import from URL</Text>
              </Pressable>
              <Pressable 
                style={styles.secondaryButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/(discover)');
                }}
              >
                <Disc3 size={18} color={Colors.dark.primary} />
                <Text style={styles.secondaryButtonText}>Discover Sets</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importForm: {
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  importTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  importInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  importInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  importInput: {
    flex: 1,
    height: 44,
    color: Colors.dark.text,
    fontSize: 14,
  },
  importButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
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
    paddingTop: 60,
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
    marginBottom: 12,
  },
  discoverButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.background,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
});
