import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Heart, Music, Clock, Bookmark, ChevronRight, Disc, Settings, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import IDentifiedLogo from '@/components/IDentifiedLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedSets, useLikedSets, useContributions } from '@/hooks/useSocial';

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Identified Track Card Component
function IdentifiedTrackCard({ contribution, onPress }: { contribution: any; onPress: () => void }) {
  return (
    <Pressable style={styles.trackCard} onPress={onPress}>
      <View style={styles.trackCardHeader}>
        <View style={styles.trackIconContainer}>
          <Music size={16} color={Colors.dark.primary} />
        </View>
        <Text style={styles.trackTimestamp}>
          {contribution.timestamp_seconds ? formatTimestamp(contribution.timestamp_seconds) : '--:--'}
        </Text>
      </View>
      <Text style={styles.trackTitle} numberOfLines={2}>
        {contribution.track_title || 'Unknown Track'}
      </Text>
      <Text style={styles.trackArtist} numberOfLines={1}>
        {contribution.track_artist || 'Unknown Artist'}
      </Text>
      {contribution.set && (
        <View style={styles.trackSetInfo}>
          <Disc size={10} color={Colors.dark.textMuted} />
          <Text style={styles.trackSetName} numberOfLines={1}>
            {contribution.set.name}
          </Text>
        </View>
      )}
      <Text style={styles.trackDate}>{formatTimeAgo(contribution.created_at)}</Text>
    </Pressable>
  );
}

// Saved Set Card Component
function SavedSetCard({ savedSet, onPress }: { savedSet: any; onPress: () => void }) {
  const set = savedSet.set;
  if (!set) return null;

  return (
    <Pressable style={styles.savedSetCard} onPress={onPress}>
      <Image
        source={{ uri: set.cover_url || 'https://via.placeholder.com/64' }}
        style={styles.savedSetImage}
        contentFit="cover"
      />
      <View style={styles.savedSetInfo}>
        <Text style={styles.savedSetName} numberOfLines={1}>
          {set.name}
        </Text>
        <Text style={styles.savedSetArtist} numberOfLines={1}>
          {set.artist_name}
        </Text>
        <View style={styles.savedSetMeta}>
          <Text style={styles.savedSetDate}>
            Saved {formatTimeAgo(savedSet.created_at)}
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color={Colors.dark.textMuted} />
    </Pressable>
  );
}

// Stats Card Component
function StatsCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function MyStuffScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { savedSets, isLoading: savedLoading, refresh: refreshSaved } = useSavedSets();
  const { likedSets, isLoading: likedLoading, refresh: refreshLiked } = useLikedSets();
  const { identifiedTracks, isLoading: contributionsLoading, refresh: refreshContributions } = useContributions();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refreshSaved(), refreshLiked(), refreshContributions()]);
    setIsRefreshing(false);
  }, [refreshSaved, refreshLiked, refreshContributions]);

  const navigateToSet = (setId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/${setId}`);
  };

  const isLoading = savedLoading || likedLoading || contributionsLoading;

  // Not logged in view
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <IDentifiedLogo size="medium" />
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loginPromptContainer}>
            <View style={styles.loginLogoWrapper}>
              <IDentifiedLogo size="xlarge" />
            </View>
            <Text style={styles.loginPromptTitle}>Your personal crate</Text>
            <Text style={styles.loginPromptText}>
              Log in to save sets, track your identified songs, and build your crate
            </Text>
            <Pressable
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginButtonText}>Log In</Text>
            </Pressable>
            <Pressable
              style={styles.signupButton}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.signupButtonText}>Create Account</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Crate</Text>
          <Pressable
            style={styles.headerButton}
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/(tabs)/(profile)');
            }}
          >
            <User size={22} color={Colors.dark.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.dark.primary}
            />
          }
        >
          {/* Quick Stats */}
          <View style={styles.statsSection}>
            <StatsCard
              icon={Music}
              label="Track'd"
              value={identifiedTracks.length}
              color={Colors.dark.primary}
            />
            <StatsCard
              icon={Bookmark}
              label="Saved"
              value={savedSets.length}
              color={Colors.dark.success}
            />
            <StatsCard
              icon={Heart}
              label="Liked"
              value={likedSets.length}
              color={Colors.dark.error}
            />
          </View>

          {/* Identified Tracks Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Music size={18} color={Colors.dark.primary} />
                <Text style={styles.sectionTitle}>My Identified Tracks</Text>
              </View>
              {identifiedTracks.length > 0 && (
                <Text style={styles.sectionCount}>{identifiedTracks.length}</Text>
              )}
            </View>

            {contributionsLoading ? (
              <ActivityIndicator color={Colors.dark.primary} style={styles.sectionLoader} />
            ) : identifiedTracks.length === 0 ? (
              <View style={styles.emptySection}>
                <Music size={32} color={Colors.dark.textMuted} />
                <Text style={styles.emptyTitle}>No identified tracks yet</Text>
                <Text style={styles.emptyText}>
                  Use Shazam or contribute track IDs to sets to build your collection
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tracksContainer}
              >
                {identifiedTracks.slice(0, 10).map((contribution) => (
                  <IdentifiedTrackCard
                    key={contribution.id}
                    contribution={contribution}
                    onPress={() => {
                      if (contribution.set?.id) {
                        navigateToSet(contribution.set.id);
                      }
                    }}
                  />
                ))}
                {identifiedTracks.length > 10 && (
                  <Pressable
                    style={styles.seeAllCard}
                    onPress={() => {
                      Haptics.selectionAsync();
                      // Could navigate to a full list screen
                    }}
                  >
                    <Text style={styles.seeAllText}>See All</Text>
                    <ChevronRight size={16} color={Colors.dark.primary} />
                  </Pressable>
                )}
              </ScrollView>
            )}
          </View>

          {/* Saved Sets Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Bookmark size={18} color={Colors.dark.success} />
                <Text style={styles.sectionTitle}>Saved Sets</Text>
              </View>
              {savedSets.length > 0 && (
                <Text style={styles.sectionCount}>{savedSets.length}</Text>
              )}
            </View>

            {savedLoading ? (
              <ActivityIndicator color={Colors.dark.primary} style={styles.sectionLoader} />
            ) : savedSets.length === 0 ? (
              <View style={styles.emptySection}>
                <Bookmark size={32} color={Colors.dark.textMuted} />
                <Text style={styles.emptyTitle}>No saved sets</Text>
                <Text style={styles.emptyText}>
                  Save sets while browsing to find them here later
                </Text>
              </View>
            ) : (
              <View style={styles.savedSetsList}>
                {savedSets.slice(0, 5).map((savedSet) => (
                  <SavedSetCard
                    key={savedSet.id}
                    savedSet={savedSet}
                    onPress={() => {
                      if (savedSet.set?.id) {
                        navigateToSet(savedSet.set.id);
                      }
                    }}
                  />
                ))}
                {savedSets.length > 5 && (
                  <Pressable style={styles.seeAllButton}>
                    <Text style={styles.seeAllButtonText}>See All Saved Sets</Text>
                    <ChevronRight size={16} color={Colors.dark.primary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Liked Sets Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Heart size={18} color={Colors.dark.error} />
                <Text style={styles.sectionTitle}>Liked Sets</Text>
              </View>
              {likedSets.length > 0 && (
                <Text style={styles.sectionCount}>{likedSets.length}</Text>
              )}
            </View>

            {likedLoading ? (
              <ActivityIndicator color={Colors.dark.primary} style={styles.sectionLoader} />
            ) : likedSets.length === 0 ? (
              <View style={styles.emptySection}>
                <Heart size={32} color={Colors.dark.textMuted} />
                <Text style={styles.emptyTitle}>No liked sets</Text>
                <Text style={styles.emptyText}>
                  Like sets to show your appreciation
                </Text>
              </View>
            ) : (
              <View style={styles.savedSetsList}>
                {likedSets.slice(0, 3).map((likedSet) => (
                  <SavedSetCard
                    key={likedSet.id}
                    savedSet={likedSet}
                    onPress={() => {
                      if (likedSet.set?.id) {
                        navigateToSet(likedSet.set.id);
                      }
                    }}
                  />
                ))}
                {likedSets.length > 3 && (
                  <Pressable style={styles.seeAllButton}>
                    <Text style={styles.seeAllButtonText}>See All Liked Sets</Text>
                    <ChevronRight size={16} color={Colors.dark.primary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loginPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loginLogoWrapper: {
    marginBottom: 8,
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 8,
  },
  loginPromptText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  // Stats Section
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  // Section Styles
  section: {
    marginTop: 8,
    paddingBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  sectionCount: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionLoader: {
    marginVertical: 20,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
    marginHorizontal: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Track Cards
  tracksContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  trackCard: {
    width: 140,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  trackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${Colors.dark.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTimestamp: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  trackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
    lineHeight: 17,
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.dark.primary,
    marginBottom: 8,
  },
  trackSetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  trackSetName: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    flex: 1,
  },
  trackDate: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },
  seeAllCard: {
    width: 80,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  // Saved Sets
  savedSetsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  savedSetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  savedSetImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  savedSetInfo: {
    flex: 1,
    marginLeft: 12,
  },
  savedSetName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  savedSetArtist: {
    fontSize: 13,
    color: Colors.dark.primary,
    marginBottom: 4,
  },
  savedSetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedSetDate: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  seeAllButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.primary,
  },
});
