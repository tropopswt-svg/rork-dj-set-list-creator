import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  Users,
  Sparkles,
  Contact,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchUsers } from '@/hooks/useSocial';
import { useRecommendedUsers, useContactSync } from '@/hooks/useRecommendations';
import UserCard from '@/components/UserCard';

export default function FindFriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Search results
  const { results: searchResults, isLoading: searchLoading } = useSearchUsers(searchQuery);

  // Recommended users
  const {
    users: recommendedUsers,
    isLoading: recommendedLoading,
    refresh: refreshRecommended,
  } = useRecommendedUsers(15);

  // Contact sync
  const {
    hasPermission,
    isSyncing,
    contactMatches,
    isAvailable: contactSyncAvailable,
    requestPermission,
    syncContacts,
  } = useContactSync();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshRecommended();
    if (hasPermission) {
      await syncContacts();
    }
    setIsRefreshing(false);
  }, [refreshRecommended, hasPermission, syncContacts]);

  const handleContactSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!hasPermission) {
      const granted = await requestPermission();
      if (granted) {
        await syncContacts();
      }
    } else {
      await syncContacts();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    Haptics.selectionAsync();
  };

  const isSearching = searchQuery.length >= 2;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          title: 'Find Friends',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </Pressable>
          ),
        }}
      />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={20} color={Colors.dark.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username or name"
              placeholderTextColor={Colors.dark.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={clearSearch}>
                <X size={18} color={Colors.dark.textMuted} />
              </Pressable>
            )}
          </View>
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
          {/* Search Results */}
          {isSearching && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              {searchLoading ? (
                <ActivityIndicator
                  color={Colors.dark.primary}
                  style={styles.loader}
                />
              ) : searchResults.length > 0 ? (
                searchResults.map((resultUser) => (
                  <UserCard
                    key={resultUser.id}
                    user={resultUser}
                    showBio
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No users found</Text>
                </View>
              )}
            </View>
          )}

          {/* Contact Sync Section */}
          {!isSearching && contactSyncAvailable && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Contact size={20} color={Colors.dark.primary} />
                <Text style={styles.sectionTitle}>From Your Contacts</Text>
              </View>

              {hasPermission === null ? (
                <ActivityIndicator color={Colors.dark.primary} style={styles.loader} />
              ) : !hasPermission ? (
                <Pressable style={styles.syncButton} onPress={handleContactSync}>
                  <Contact size={20} color="#fff" />
                  <Text style={styles.syncButtonText}>Sync Contacts</Text>
                </Pressable>
              ) : isSyncing ? (
                <View style={styles.syncingContainer}>
                  <ActivityIndicator color={Colors.dark.primary} />
                  <Text style={styles.syncingText}>Syncing contacts...</Text>
                </View>
              ) : contactMatches.length > 0 ? (
                contactMatches.map((match) => (
                  <UserCard
                    key={match.user_id}
                    user={{
                      id: match.user_id,
                      username: match.username,
                      display_name: match.display_name,
                      avatar_url: match.avatar_url,
                    }}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    No contacts found on TRACK'D
                  </Text>
                  <Pressable style={styles.resyncButton} onPress={handleContactSync}>
                    <Text style={styles.resyncText}>Try Again</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Recommended Users Section */}
          {!isSearching && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Sparkles size={20} color={Colors.dark.primary} />
                <Text style={styles.sectionTitle}>Suggested For You</Text>
              </View>

              {recommendedLoading ? (
                <ActivityIndicator
                  color={Colors.dark.primary}
                  style={styles.loader}
                />
              ) : recommendedUsers.length > 0 ? (
                recommendedUsers.map((recUser) => (
                  <UserCard
                    key={recUser.user_id}
                    user={{
                      id: recUser.user_id,
                      username: recUser.username,
                      display_name: recUser.display_name,
                      avatar_url: recUser.avatar_url,
                    }}
                    mutualCount={recUser.mutual_followers}
                    reason={
                      recUser.is_contact
                        ? 'In your contacts'
                        : recUser.common_likes > 0
                        ? `${recUser.common_likes} likes in common`
                        : recUser.common_artists > 0
                        ? `${recUser.common_artists} artists in common`
                        : undefined
                    }
                    showStats
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Users size={32} color={Colors.dark.textMuted} />
                  <Text style={styles.emptyTitle}>No suggestions yet</Text>
                  <Text style={styles.emptySubtext}>
                    Like more sets and follow artists to get personalized recommendations
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  loader: {
    marginVertical: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  syncingText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  resyncButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resyncText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.primary,
  },
});
