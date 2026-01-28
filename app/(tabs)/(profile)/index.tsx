import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings, Award, Clock, CheckCircle, AlertCircle, X, ChevronRight, Music, Users, LogIn } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import IDentifiedLogo from '@/components/IDentifiedLogo';
import { mockCurrentUser } from '@/mocks/tracks';
import { useSets } from '@/contexts/SetsContext';
import { useAuth } from '@/contexts/AuthContext';

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTimestamp = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

type ContributionFilter = 'all' | 'verified' | 'pending' | 'points';

export default function ProfileScreen() {
  const router = useRouter();
  const { sets } = useSets();
  const { isAuthenticated, isLoading, profile } = useAuth();
  const [contributionFilter, setContributionFilter] = useState<ContributionFilter>('all');
  const [genreModalVisible, setGenreModalVisible] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  // Use authenticated profile data if available, otherwise mock data
  const user = useMemo(() => {
    if (isAuthenticated && profile) {
      return {
        displayName: profile.display_name || profile.username || 'User',
        username: profile.username || 'user',
        avatarUrl: profile.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop',
        bio: profile.bio,
        favoriteGenres: profile.favorite_genres || [],
        totalPoints: profile.points || 0,
        verifiedTracks: profile.contributions_count || 0,
        pendingTracks: 0,
        contributions: [],
        joinedAt: profile.created_at,
        followersCount: profile.followers_count || 0,
        followingCount: profile.following_count || 0,
      };
    }
    return {
      ...mockCurrentUser,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop',
    };
  }, [isAuthenticated, profile]);

  const filteredContributions = useMemo(() => {
    if (contributionFilter === 'all') return user.contributions || [];
    if (contributionFilter === 'points') return (user.contributions || []).filter((c: any) => c.points > 0);
    return (user.contributions || []).filter((c: any) => c.status === contributionFilter);
  }, [user.contributions, contributionFilter]);

  const setsByGenre = useMemo(() => {
    if (!selectedGenre) return [];
    const genreLower = selectedGenre.toLowerCase();
    return sets.filter(set =>
      set.name.toLowerCase().includes(genreLower) ||
      set.artist.toLowerCase().includes(genreLower) ||
      set.venue?.toLowerCase().includes(genreLower)
    );
  }, [sets, selectedGenre]);

  const handleGenrePress = (genre: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenre(genre);
    setGenreModalVisible(true);
  };

  const handleStatPress = (filter: ContributionFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setContributionFilter(filter);
  };

  const getFilterLabel = () => {
    switch (contributionFilter) {
      case 'verified': return 'Verified Submissions';
      case 'pending': return 'Pending Submissions';
      case 'points': return 'Points Earned';
      default: return 'Contribution History';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return Colors.dark.success;
      case 'pending':
        return Colors.dark.warning;
      case 'rejected':
        return Colors.dark.error;
      default:
        return Colors.dark.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={14} color={Colors.dark.success} />;
      case 'pending':
        return <Clock size={14} color={Colors.dark.warning} />;
      case 'rejected':
        return <AlertCircle size={14} color={Colors.dark.error} />;
      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.headerBar}>
            <View style={styles.headerSpacer} />
            <IDentifiedLogo size="medium" />
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loginPromptContainer}>
            <View style={styles.loginLogoWrapper}>
              <IDentifiedLogo size="xlarge" />
            </View>
            <Text style={styles.loginPromptTitle}>Join the community</Text>
            <Text style={styles.loginPromptText}>
              Create an account to track your contributions, earn points, and connect with other music lovers
            </Text>
            <Pressable
              style={styles.loginButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(auth)/login');
              }}
            >
              <Text style={styles.loginButtonText}>Log In</Text>
            </Pressable>
            <Pressable
              style={styles.signupButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(auth)/signup');
              }}
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
        <View style={styles.headerBar}>
          <View style={styles.headerSpacer} />
          <IDentifiedLogo size="medium" />
          <Pressable style={styles.settingsButton} onPress={() => router.push('/(tabs)/(profile)/settings')}>
            <Settings size={22} color={Colors.dark.text} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          {/* Followers/Following Row */}
          <View style={styles.followStatsRow}>
            <Pressable style={styles.followStat}>
              <Text style={styles.followStatNumber}>{user.followersCount}</Text>
              <Text style={styles.followStatLabel}>Followers</Text>
            </Pressable>
            <View style={styles.followStatDivider} />
            <Pressable style={styles.followStat}>
              <Text style={styles.followStatNumber}>{user.followingCount}</Text>
              <Text style={styles.followStatLabel}>Following</Text>
            </Pressable>
          </View>

          {user.favoriteGenres && user.favoriteGenres.length > 0 && (
            <View style={styles.genresRow}>
              {user.favoriteGenres.map((genre: string, index: number) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.genreTag,
                    pressed && styles.genreTagPressed
                  ]}
                  onPress={() => handleGenrePress(genre)}
                >
                  <Text style={styles.genreText}>{genre}</Text>
                  <ChevronRight size={12} color={Colors.dark.textSecondary} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.statsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.statCard,
              contributionFilter === 'points' && styles.statCardActive,
              pressed && styles.statCardPressed
            ]}
            onPress={() => handleStatPress(contributionFilter === 'points' ? 'all' : 'points')}
          >
            <View style={styles.statIconWrapper}>
              <Award size={20} color={Colors.dark.primary} />
            </View>
            <Text style={styles.statValue}>{user.totalPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.statCard,
              contributionFilter === 'verified' && styles.statCardActive,
              pressed && styles.statCardPressed
            ]}
            onPress={() => handleStatPress(contributionFilter === 'verified' ? 'all' : 'verified')}
          >
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(46, 204, 113, 0.15)' }]}>
              <CheckCircle size={20} color={Colors.dark.success} />
            </View>
            <Text style={styles.statValue}>{user.verifiedTracks}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.statCard,
              contributionFilter === 'pending' && styles.statCardActive,
              pressed && styles.statCardPressed
            ]}
            onPress={() => handleStatPress(contributionFilter === 'pending' ? 'all' : 'pending')}
          >
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(241, 196, 15, 0.15)' }]}>
              <Clock size={20} color={Colors.dark.warning} />
            </View>
            <Text style={styles.statValue}>{user.pendingTracks}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{getFilterLabel()}</Text>
              <Text style={styles.sectionSubtitle}>
                {contributionFilter === 'all'
                  ? `Member since ${formatDate(user.joinedAt)}`
                  : `${filteredContributions.length} ${contributionFilter === 'points' ? 'submissions with points' : contributionFilter + ' submissions'}`
                }
              </Text>
            </View>
            {contributionFilter !== 'all' && (
              <Pressable
                style={styles.clearFilterButton}
                onPress={() => setContributionFilter('all')}
              >
                <Text style={styles.clearFilterText}>Clear</Text>
              </Pressable>
            )}
          </View>

          {filteredContributions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {contributionFilter === 'all' ? 'No contributions yet' : `No ${contributionFilter} submissions`}
              </Text>
              <Text style={styles.emptySubtext}>
                {contributionFilter === 'all'
                  ? 'Start adding tracks to sets to earn points!'
                  : 'Check back later or try a different filter'
                }
              </Text>
            </View>
          ) : (
            <View style={styles.contributionsList}>
              {filteredContributions.map((contribution: any) => (
                <View key={contribution.id} style={styles.contributionCard}>
                  <View style={styles.contributionHeader}>
                    <View style={styles.contributionStatus}>
                      {getStatusIcon(contribution.status)}
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(contribution.status) },
                        ]}
                      >
                        {contribution.status}
                      </Text>
                    </View>
                    {contribution.points > 0 && (
                      <View style={styles.pointsBadge}>
                        <Text style={styles.pointsText}>+{contribution.points}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.trackTitle}>
                    {contribution.trackTitle}
                  </Text>
                  <Text style={styles.trackArtist}>
                    {contribution.trackArtist}
                  </Text>
                  <View style={styles.contributionMeta}>
                    <Text style={styles.setName} numberOfLines={1}>
                      {contribution.setName}
                    </Text>
                    <Text style={styles.timestamp}>
                      @ {formatTimestamp(contribution.timestamp)}
                    </Text>
                  </View>
                  <Text style={styles.addedDate}>
                    Added {formatDate(contribution.addedAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        </ScrollView>

        <Modal
          visible={genreModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setGenreModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedGenre} Sets</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setGenreModalVisible(false)}
              >
                <X size={24} color={Colors.dark.text} />
              </Pressable>
            </View>

            {setsByGenre.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Music size={48} color={Colors.dark.textMuted} />
                <Text style={styles.modalEmptyText}>No sets found for {selectedGenre}</Text>
                <Text style={styles.modalEmptySubtext}>Try exploring the Discover tab for more sets</Text>
              </View>
            ) : (
              <FlatList
                data={setsByGenre}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.genreSetCard,
                      pressed && styles.genreSetCardPressed
                    ]}
                    onPress={() => {
                      setGenreModalVisible(false);
                      router.push(`/(tabs)/(discover)/${item.id}`);
                    }}
                  >
                    <Image
                      source={{ uri: item.coverUrl }}
                      style={styles.genreSetImage}
                      contentFit="cover"
                    />
                    <View style={styles.genreSetInfo}>
                      <Text style={styles.genreSetName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.genreSetArtist}>{item.artist}</Text>
                      <Text style={styles.genreSetMeta}>
                        {item.tracks.length} tracks • {item.venue || 'Unknown venue'}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={Colors.dark.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </View>
        </Modal>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSpacer: {
    width: 38, // Match settingsButton width for centering
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  loginPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loginIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  loginLogoWrapper: {
    marginBottom: 16,
  },
  loginPromptTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  loginPromptText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  loginButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: Colors.dark.primary,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  username: {
    fontSize: 15,
    color: Colors.dark.textMuted,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  followStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 24,
  },
  followStat: {
    alignItems: 'center',
  },
  followStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  followStatLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  followStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.dark.border,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  genreTag: {
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  genreTagPressed: {
    backgroundColor: Colors.dark.surfaceLight,
    borderColor: Colors.dark.primary,
  },
  genreText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statCardActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  statCardPressed: {
    opacity: 0.8,
  },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  section: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  clearFilterButton: {
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  clearFilterText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  contributionsList: {
    gap: 12,
  },
  contributionCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  contributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contributionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  pointsBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  contributionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  setName: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  addedDate: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: {
    padding: 16,
  },
  modalEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  modalEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginTop: 16,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  genreSetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  genreSetCardPressed: {
    backgroundColor: Colors.dark.surfaceLight,
  },
  genreSetImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  genreSetInfo: {
    flex: 1,
    marginLeft: 12,
  },
  genreSetName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  genreSetArtist: {
    fontSize: 13,
    color: Colors.dark.primary,
    marginBottom: 2,
  },
  genreSetMeta: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
});
