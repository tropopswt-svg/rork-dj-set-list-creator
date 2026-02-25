import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const FEED_API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

// Simple hash to pick a consistent color per artist name
function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#EF4444', '#F97316',
    '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
    '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// In-memory cache so we don't re-fetch the same artist image within a session
const imageCache = new Map<string, string | null>();

interface ArtistAvatarProps {
  imageUrl?: string | null;
  name: string;
  size?: number;
  artistId?: string | null;
}

export default function ArtistAvatar({ imageUrl, name, size = 40, artistId }: ArtistAvatarProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(imageUrl || null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (imageUrl) {
      setResolvedUrl(imageUrl);
      return;
    }

    // Check in-memory cache
    const cacheKey = name.toLowerCase().trim();
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey);
      if (cached) setResolvedUrl(cached);
      return;
    }

    // Fetch from API in the background
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const params = new URLSearchParams({ name });
        if (artistId) params.append('artistId', artistId);
        const resp = await fetch(`${FEED_API_BASE_URL}/api/artist-image?${params}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.imageUrl) {
          imageCache.set(cacheKey, data.imageUrl);
          setResolvedUrl(data.imageUrl);
        } else {
          imageCache.set(cacheKey, null);
        }
      } catch {
        // Silently fail — initials fallback stays visible
      }
    })();
  }, [imageUrl, name, artistId]);

  if (resolvedUrl) {
    return (
      <Image
        source={{ uri: resolvedUrl }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        contentFit="cover"
        placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
        transition={250}
        onError={() => setResolvedUrl(null)}
      />
    );
  }

  const bg = hashColor(name);
  const initials = getInitials(name);
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.initialsContainer,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initialsText, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#2a2a2a',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
