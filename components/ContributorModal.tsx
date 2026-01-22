import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { X, Award, CheckCircle, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { mockUsers } from '@/mocks/tracks';

interface ContributorModalProps {
  visible: boolean;
  username: string;
  onClose: () => void;
}

export default function ContributorModal({
  visible,
  username,
  onClose,
}: ContributorModalProps) {
  const user = mockUsers.find((u) => u.username === username);

  if (!user) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <X size={20} color={Colors.dark.textMuted} />
          </Pressable>

          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          
          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statIcon}>
                <Award size={16} color={Colors.dark.primary} />
              </View>
              <Text style={styles.statValue}>{user.totalPoints}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(46, 204, 113, 0.15)' }]}>
                <CheckCircle size={16} color={Colors.dark.success} />
              </View>
              <Text style={styles.statValue}>{user.verifiedTracks}</Text>
              <Text style={styles.statLabel}>Verified</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(241, 196, 15, 0.15)' }]}>
                <Clock size={16} color={Colors.dark.warning} />
              </View>
              <Text style={styles.statValue}>{user.pendingTracks}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          {user.favoriteGenres && user.favoriteGenres.length > 0 && (
            <View style={styles.genresContainer}>
              {user.favoriteGenres.map((genre, index) => (
                <View key={index} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre}</Text>
                </View>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginBottom: 8,
  },
  bio: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 12,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.dark.border,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  genreTag: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  genreText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
});
