import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Settings, Award, Clock, CheckCircle, AlertCircle, ChevronRight, User, Sparkles, Edit3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import BubbleGlassLogo from '@/components/BubbleGlassLogo';
import { mockCurrentUser } from '@/mocks/tracks';
import { useSets } from '@/contexts/SetsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useContributions } from '@/hooks/useSocial';

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

// ── Glass Card wrapper ──────────────────────────────────────────────────
// Reusable frosted glass container with 3D depth
function GlassCard({ children, style, intensity = 25 }: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
}) {
  return (
    <View style={[glassStyles.card, style]}>
      {/* 3D shadow */}
      <View style={glassStyles.cardShadow} />
      {/* Glass face */}
      <View style={glassStyles.cardFace}>
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, glassStyles.cardTint]} />
        <View style={glassStyles.cardLightEdge} />
        {children}
      </View>
    </View>
  );
}

const glassStyles = StyleSheet.create({
  card: { position: 'relative' },
  cardShadow: {
    position: 'absolute',
    top: 4,
    left: 2,
    right: 2,
    bottom: -2,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  cardFace: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderTopColor: 'rgba(255,255,255,0.8)',
  },
  cardTint: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  cardLightEdge: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 1,
    zIndex: 2,
  },
});

export default function ProfileScreen() {
  const router = useRouter();
  const { sets } = useSets();
  const { isAuthenticated, isLoading, profile } = useAuth();
  const [contributionFilter, setContributionFilter] = useState<ContributionFilter>('all');
  const { contributions: rawContributions, isLoading: contribLoading } = useContributions();

  const mappedContributions = useMemo(() => {
    if (!rawContributions || rawContributions.length === 0) return [];
    return rawContributions.map((c: any) => ({
      id: c.id,
      setId: c.set_id,
      setName: c.set?.name || 'Unknown Set',
      trackTitle: c.track_title || 'Unknown Track',
      trackArtist: c.track_artist || 'Unknown Artist',
      timestamp: c.timestamp_seconds || 0,
      status: c.status,
      addedAt: new Date(c.created_at),
      points: c.points_awarded || 0,
    }));
  }, [rawContributions]);

  const user = useMemo(() => {
    if (isAuthenticated && profile) {
      const pending = mappedContributions.filter((c: any) => c.status === 'pending').length;
      return {
        displayName: profile.display_name || profile.username || 'User',
        username: profile.username || 'user',
        avatarUrl: profile.avatar_url || null,
        bio: profile.bio,
        favoriteGenres: profile.favorite_genres || [],
        totalPoints: profile.points || 0,
        verifiedTracks: profile.contributions_count || 0,
        pendingTracks: pending,
        contributions: mappedContributions,
        joinedAt: profile.created_at,
        followersCount: profile.followers_count || 0,
        followingCount: profile.following_count || 0,
      };
    }
    return { ...mockCurrentUser, avatarUrl: null };
  }, [isAuthenticated, profile, mappedContributions]);

  const filteredContributions = useMemo(() => {
    if (contributionFilter === 'all') return user.contributions || [];
    if (contributionFilter === 'points') return (user.contributions || []).filter((c: any) => c.points > 0);
    return (user.contributions || []).filter((c: any) => c.status === contributionFilter);
  }, [user.contributions, contributionFilter]);

  const handleGenrePress = (genre: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/genre/${encodeURIComponent(genre)}`);
  };

  const handleStatPress = (filter: ContributionFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      case 'verified': return '#2E7D32';
      case 'pending': return '#ED6C02';
      case 'rejected': return '#D32F2F';
      default: return Colors.dark.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle size={14} color="#2E7D32" />;
      case 'pending': return <Clock size={14} color="#ED6C02" />;
      case 'rejected': return <AlertCircle size={14} color="#D32F2F" />;
      default: return null;
    }
  };

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
  if (false && !isAuthenticated) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.headerBar}>
            <View style={styles.headerSpacer} />
            <BubbleGlassLogo size="medium" />
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loginPromptContainer}>
            <View style={styles.loginLogoWrapper}>
              <BubbleGlassLogo size="xlarge" />
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
      {/* ── Ambient glass background ── */}
      <View style={styles.glassBackground} pointerEvents="none">
        <View style={[styles.glassOrb, styles.glassOrb1]} />
        <View style={[styles.glassOrb, styles.glassOrb2]} />
        <View style={[styles.glassOrb, styles.glassOrb3]} />
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.headerBar}>
          <View style={styles.headerSpacer} />
          <BubbleGlassLogo size="medium" />
          <Pressable
            style={styles.settingsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/(profile)/settings');
            }}
          >
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
            <Settings size={20} color={Colors.dark.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* ── Avatar + Identity ── */}
          <View style={styles.profileHeader}>
            {/* 3D Glass avatar ring */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatarGlow} />
              <View style={styles.avatarRing}>
                <LinearGradient
                  colors={['#C41E3A', '#D64458', '#E8A0AA', '#C41E3A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={styles.avatarInner}>
                {user.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={styles.avatar}
                    placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
                    transition={250}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <User size={36} color="rgba(255,255,255,0.5)" />
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.displayName}>{user.displayName}</Text>
            <Text style={styles.username}>@{user.username}</Text>
            {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

            {/* ── Edit Profile Button ── */}
            <Pressable
              style={styles.editProfileButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/(tabs)/(profile)/settings', params: { section: 'edit-profile' } });
              }}
            >
              <Edit3 size={14} color={Colors.dark.text} />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </Pressable>

            {/* ── Glass follower pills ── */}
            <View style={styles.followRow}>
              <Pressable
                style={styles.followPill}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (profile?.id) router.push(`/(tabs)/(social)/followers/${profile.id}`);
                }}
              >
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, styles.followPillTint]} />
                <View style={styles.followPillLightEdge} />
                <Text style={styles.followNumber}>{user.followersCount}</Text>
                <Text style={styles.followLabel}>Followers</Text>
              </Pressable>

              <View style={styles.followDivider} />

              <Pressable
                style={styles.followPill}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (profile?.id) router.push(`/(tabs)/(social)/following/${profile.id}`);
                }}
              >
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, styles.followPillTint]} />
                <View style={styles.followPillLightEdge} />
                <Text style={styles.followNumber}>{user.followingCount}</Text>
                <Text style={styles.followLabel}>Following</Text>
              </Pressable>
            </View>

            {/* ── Glass genre tags ── */}
            {user.favoriteGenres && user.favoriteGenres.length > 0 && (
              <View style={styles.genresRow}>
                {user.favoriteGenres.map((genre: string, index: number) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [styles.genreTag, pressed && styles.genreTagPressed]}
                    onPress={() => handleGenrePress(genre)}
                  >
                    <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
                    <Text style={styles.genreText}>{genre}</Text>
                    <ChevronRight size={11} color={Colors.dark.textSecondary} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* ── Compact Stat Pills ── */}
          <View style={styles.statsRow}>
            <Pressable
              onPress={() => handleStatPress(contributionFilter === 'points' ? 'all' : 'points')}
              style={[styles.statPill, contributionFilter === 'points' && styles.statPillActive]}
            >
              <Award size={13} color={Colors.dark.primary} />
              <Text style={styles.statValue}>{user.totalPoints}</Text>
              <Text style={styles.statLabel}>pts</Text>
            </Pressable>

            <Pressable
              onPress={() => handleStatPress(contributionFilter === 'verified' ? 'all' : 'verified')}
              style={[styles.statPill, contributionFilter === 'verified' && styles.statPillActive]}
            >
              <CheckCircle size={13} color="#2E7D32" />
              <Text style={styles.statValue}>{user.verifiedTracks}</Text>
              <Text style={styles.statLabel}>verified</Text>
            </Pressable>

            <Pressable
              onPress={() => handleStatPress(contributionFilter === 'pending' ? 'all' : 'pending')}
              style={[styles.statPill, contributionFilter === 'pending' && styles.statPillActive]}
            >
              <Clock size={13} color="#ED6C02" />
              <Text style={styles.statValue}>{user.pendingTracks}</Text>
              <Text style={styles.statLabel}>pending</Text>
            </Pressable>
          </View>

          {/* ── Contributions Section ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>{getFilterLabel()}</Text>
                <Text style={styles.sectionSubtitle}>
                  {contributionFilter === 'all'
                    ? `Member since ${formatDate(user.joinedAt)}`
                    : `${filteredContributions.length} ${contributionFilter === 'points' ? 'with points' : contributionFilter}`
                  }
                </Text>
              </View>
              {contributionFilter !== 'all' && (
                <Pressable
                  style={styles.clearFilterPill}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setContributionFilter('all');
                  }}
                >
                  <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
                  <Text style={styles.clearFilterText}>Clear</Text>
                </Pressable>
              )}
            </View>

            {filteredContributions.length === 0 ? (
              <GlassCard>
                <View style={styles.emptyState}>
                  <Sparkles size={28} color={Colors.dark.textMuted} />
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
              </GlassCard>
            ) : (
              <View style={styles.contributionsList}>
                {filteredContributions.map((contribution: any) => (
                  <GlassCard key={contribution.id}>
                    <View style={styles.contributionContent}>
                      <View style={styles.contributionHeader}>
                        <View style={styles.contributionStatus}>
                          {getStatusIcon(contribution.status)}
                          <Text style={[styles.statusText, { color: getStatusColor(contribution.status) }]}>
                            {contribution.status}
                          </Text>
                        </View>
                        {contribution.points > 0 && (
                          <View style={styles.pointsBadge}>
                            <Text style={styles.pointsText}>+{contribution.points}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.trackTitle}>{contribution.trackTitle}</Text>
                      <Text style={styles.trackArtist}>{contribution.trackArtist}</Text>
                      <View style={styles.contributionMeta}>
                        <Text style={styles.setName} numberOfLines={1}>{contribution.setName}</Text>
                        <View style={styles.timestampPill}>
                          <Text style={styles.timestampText}>@ {formatTimestamp(contribution.timestamp)}</Text>
                        </View>
                      </View>
                      <Text style={styles.addedDate}>Added {formatDate(contribution.addedAt)}</Text>
                    </View>
                  </GlassCard>
                ))}
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
    backgroundColor: '#F5F0E8',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Ambient glass background ──
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glassOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  glassOrb1: {
    width: 280,
    height: 280,
    top: -60,
    right: -40,
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
  },
  glassOrb2: {
    width: 220,
    height: 220,
    top: 300,
    left: -60,
    backgroundColor: 'rgba(160, 50, 180, 0.08)',
  },
  glassOrb3: {
    width: 180,
    height: 180,
    bottom: 120,
    right: -30,
    backgroundColor: 'rgba(50, 100, 200, 0.06)',
  },

  // ── Header ──
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSpacer: {
    width: 40,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  // ── Login prompt ──
  loginPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
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
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 16,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.25)',
    borderTopColor: 'rgba(196, 30, 58, 0.35)',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C41E3A',
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5E6D3',
  },

  scrollContent: {
    paddingBottom: 100,
  },

  // ── Profile Header ──
  profileHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },

  // ── 3D Glass Avatar ──
  avatarContainer: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(196, 30, 58, 0.15)',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  avatarRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    overflow: 'hidden',
  },
  avatarInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#F0EDE8',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: '#2D2A26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  username: {
    fontSize: 15,
    color: Colors.dark.textMuted,
    fontWeight: '500',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
    lineHeight: 20,
  },

  // ── Edit Profile Button ──
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderTopColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 16,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
  },

  // ── Glass Follower Pills ──
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  followPill: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  followPillTint: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  followPillLightEdge: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 1,
    zIndex: 2,
  },
  followNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  followLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  followDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },

  // ── Glass Genre Tags ──
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  genreTag: {
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  genreTagPressed: {
    borderColor: 'rgba(196, 30, 58, 0.3)',
  },
  genreText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },

  // ── 3D Glass Stat Cards ──
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  statPillActive: {
    borderColor: 'rgba(196, 30, 58, 0.25)',
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },

  // ── Contributions Section ──
  section: {
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  clearFilterPill: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.2)',
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
  },
  clearFilterText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '700',
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },

  // ── Glass Contribution Cards ──
  contributionsList: {
    gap: 10,
  },
  contributionContent: {
    padding: 14,
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
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pointsBadge: {
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.15)',
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
    marginBottom: 8,
  },
  contributionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  setName: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  timestampPill: {
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timestampText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  addedDate: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },

});
