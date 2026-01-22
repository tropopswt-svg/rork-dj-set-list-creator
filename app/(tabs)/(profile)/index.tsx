import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Award, Clock, CheckCircle, AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { mockCurrentUser } from '@/mocks/tracks';

const formatDate = (date: Date) => {
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

export default function ProfileScreen() {
  const user = {
    ...mockCurrentUser,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop',
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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable style={styles.settingsButton}>
            <Settings size={22} color={Colors.dark.text} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          <View style={styles.genresRow}>
            {user.favoriteGenres?.map((genre, index) => (
              <View key={index} style={styles.genreTag}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrapper}>
              <Award size={20} color={Colors.dark.primary} />
            </View>
            <Text style={styles.statValue}>{user.totalPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(46, 204, 113, 0.15)' }]}>
              <CheckCircle size={20} color={Colors.dark.success} />
            </View>
            <Text style={styles.statValue}>{user.verifiedTracks}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(241, 196, 15, 0.15)' }]}>
              <Clock size={20} color={Colors.dark.warning} />
            </View>
            <Text style={styles.statValue}>{user.pendingTracks}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contribution History</Text>
          <Text style={styles.sectionSubtitle}>
            Member since {formatDate(user.joinedAt)}
          </Text>

          {user.contributions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No contributions yet</Text>
              <Text style={styles.emptySubtext}>
                Start adding tracks to sets to earn points!
              </Text>
            </View>
          ) : (
            <View style={styles.contributionsList}>
              {user.contributions.map((contribution) => (
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
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
    fontWeight: '700' as const,
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
  },
  genreText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500' as const,
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
    fontWeight: '700' as const,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  pointsBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.dark.primary,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
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
    fontWeight: '500' as const,
  },
  addedDate: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
});
