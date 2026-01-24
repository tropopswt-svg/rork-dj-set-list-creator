import React, { useState, useEffect } from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { artistExists, getArtistSlug } from '@/lib/supabase';

interface ArtistLinkProps {
  name: string;
  style?: any;
  showBadge?: boolean;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Clickable artist name that links to the artist profile page
 * Shows a checkmark badge if the artist exists in the database
 */
export default function ArtistLink({ 
  name, 
  style, 
  showBadge = true,
  size = 'medium',
}: ArtistLinkProps) {
  const router = useRouter();
  const [hasProfile, setHasProfile] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    checkArtist();
  }, [name]);

  const checkArtist = async () => {
    const result = await artistExists(name);
    setHasProfile(result.exists);
    setSlug(result.slug || getArtistSlug(name));
  };

  const handlePress = () => {
    if (hasProfile && slug) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/(tabs)/(discover)/artist/${slug}`);
    }
  };

  const fontSize = size === 'small' ? 12 : size === 'large' ? 18 : 14;
  const badgeSize = size === 'small' ? 10 : size === 'large' ? 14 : 12;

  if (!hasProfile) {
    return (
      <Text style={[styles.text, { fontSize }, style]}>
        {name}
      </Text>
    );
  }

  return (
    <Pressable 
      onPress={handlePress}
      style={styles.container}
    >
      <Text style={[styles.link, { fontSize }, style]}>
        {name}
      </Text>
      {showBadge && (
        <View style={styles.badge}>
          <CheckCircle size={badgeSize} color={Colors.dark.primary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    color: Colors.dark.textSecondary,
  },
  link: {
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  badge: {
    opacity: 0.8,
  },
});
