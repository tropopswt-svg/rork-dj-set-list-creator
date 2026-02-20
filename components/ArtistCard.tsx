import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Music, Users, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowArtist } from '@/hooks/useSocial';
import ArtistAvatar from '@/components/ArtistAvatar';
import type { DbArtist } from '@/lib/supabase/types';

export default function ArtistCard({ artist, onPress }: { artist: DbArtist; onPress: () => void }) {
  const { user } = useAuth();
  const { isFollowing, isLoading, toggleFollow } = useFollowArtist(artist.id);

  const handleFollow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFollow();
  };

  return (
    <Pressable style={styles.artistCard} onPress={onPress}>
      <ArtistAvatar
        imageUrl={artist.image_url}
        name={artist.name}
        size={56}
        artistId={artist.id}
      />

      <View style={styles.artistInfo}>
        <View style={styles.artistNameRow}>
          <Text style={styles.artistName} numberOfLines={1}>
            {artist.name}
          </Text>
          {artist.verified && (
            <CheckCircle size={14} color={Colors.dark.primary} fill={Colors.dark.primary} />
          )}
        </View>

        {artist.genres && artist.genres.length > 0 && (
          <Text style={styles.artistGenres} numberOfLines={1}>
            {artist.genres.slice(0, 2).join(' • ')}
          </Text>
        )}

        <View style={styles.artistStats}>
          <View style={styles.statItem}>
            <Music size={12} color={Colors.dark.textMuted} />
            <Text style={styles.statText}>{artist.tracks_count || 0}</Text>
          </View>
          {(artist.followers_count ?? 0) > 0 && (
            <View style={styles.statItem}>
              <Users size={12} color={Colors.dark.textMuted} />
              <Text style={styles.statText}>{artist.followers_count}</Text>
            </View>
          )}
        </View>
      </View>

      {user && (
        <Pressable
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={handleFollow}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? Colors.dark.primary : '#fff'} />
          ) : (
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  artistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  artistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  artistNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  artistGenres: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  artistStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  followButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  followingButton: {
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  followingButtonText: {
    color: Colors.dark.primary,
  },
});
