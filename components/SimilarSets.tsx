import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Music, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { getCoverImageUrl } from '@/utils/coverImage';

const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';
const CARD_WIDTH = 160;

interface SimilarSet {
  id: string;
  name: string;
  artist: string;
  venue?: string;
  date?: string;
  coverUrl?: string;
  trackCount: number;
  score: number;
  reason: string;
}

interface SimilarSetsProps {
  setId: string;
}

export default function SimilarSets({ setId }: SimilarSetsProps) {
  const router = useRouter();
  const [similarSets, setSimilarSets] = useState<SimilarSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSimilarSets();
  }, [setId]);

  const fetchSimilarSets = async () => {
    if (!setId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sets/similar?setId=${setId}`);
      if (!response.ok) {
        if (__DEV__) console.log('[SimilarSets] API returned', response.status);
        return;
      }
      const text = await response.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (data.success) {
        setSimilarSets(data.similarSets || []);
      }
    } catch (error) {
      if (__DEV__) console.log('[SimilarSets] Failed to fetch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/${id}`);
  };

  // Don't render section if no similar sets
  if (!isLoading && similarSets.length === 0) return null;

  const renderItem = ({ item }: { item: SimilarSet }) => (
    <Pressable style={styles.card} onPress={() => handlePress(item.id)}>
      {getCoverImageUrl(item.coverUrl) ? (
        <Image source={{ uri: getCoverImageUrl(item.coverUrl)! }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: Colors.dark.surface }]} />
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardArtist} numberOfLines={1}>{item.artist}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.reasonPill}>
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Sparkles size={16} color={Colors.dark.primary} />
          <Text style={styles.headerTitle}>If You Liked This...</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.dark.primary} />
        </View>
      ) : (
        <FlatList
          data={similarSets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  loadingContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingRight: 16,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardImage: {
    width: CARD_WIDTH,
    height: 100,
    backgroundColor: Colors.dark.surfaceLight,
  },
  cardImagePlaceholder: {
    width: CARD_WIDTH,
    height: 100,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    padding: 10,
  },
  cardName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
    lineHeight: 17,
  },
  cardArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    marginTop: 6,
  },
  reasonPill: {
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reasonText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
});
