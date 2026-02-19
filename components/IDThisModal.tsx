import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { X, ThumbsUp, ThumbsDown, Send, HelpCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Track, IDSuggestion } from '@/types';
import { useUser } from '@/contexts/UserContext';

const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

interface IDThisModalProps {
  visible: boolean;
  onClose: () => void;
  track: Track | null;
  setId: string;
}

export default function IDThisModal({ visible, onClose, track, setId }: IDThisModalProps) {
  const { userId, addPoints } = useUser();
  const [suggestedArtist, setSuggestedArtist] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [suggestions, setSuggestions] = useState<IDSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});

  // Fetch existing suggestions when modal opens
  useEffect(() => {
    if (visible && setId && track) {
      fetchSuggestions();
    }
    if (!visible) {
      setSuggestedArtist('');
      setSuggestedTitle('');
    }
  }, [visible, setId, track]);

  const fetchSuggestions = useCallback(async () => {
    if (!setId || !track) return;
    setIsLoading(true);
    try {
      const timestamp = track.timestamp || 0;
      const response = await fetch(
        `${API_BASE_URL}/api/sets/id-suggestion?setId=${setId}&trackTimestamp=${timestamp}`
      );
      const data = await response.json();
      if (data.success) {
        setSuggestions(data.suggestions || []);
        // Build user vote map
        const votes: Record<string, 'up' | 'down'> = {};
        for (const s of data.suggestions || []) {
          const userVote = s.suggestion_votes?.find((v: any) => v.user_id === userId);
          if (userVote) {
            votes[s.id] = userVote.vote_type;
          }
        }
        setUserVotes(votes);
      }
    } catch (error) {
      if (__DEV__) console.error('[IDThis] Failed to fetch suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setId, track, userId]);

  const handleSubmit = async () => {
    if (!suggestedArtist.trim() || !suggestedTitle.trim() || !track) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sets/id-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId,
          trackTimestamp: track.timestamp || 0,
          trackId: track.id,
          userId,
          suggestedTitle: suggestedTitle.trim(),
          suggestedArtist: suggestedArtist.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await addPoints('id_suggestion' as any, setId, 'Suggested a track ID');
        setSuggestedArtist('');
        setSuggestedTitle('');
        fetchSuggestions();
      }
    } catch (error) {
      if (__DEV__) console.error('[IDThis] Failed to submit suggestion:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (suggestionId: string, voteType: 'up' | 'down') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update
    setUserVotes(prev => {
      if (prev[suggestionId] === voteType) {
        const next = { ...prev };
        delete next[suggestionId];
        return next;
      }
      return { ...prev, [suggestionId]: voteType };
    });

    setSuggestions(prev =>
      prev.map(s => {
        if (s.id !== suggestionId) return s;
        const currentVote = userVotes[suggestionId];
        let votesUp = s.votes_up;
        let votesDown = s.votes_down;

        // Remove old vote
        if (currentVote === 'up') votesUp--;
        if (currentVote === 'down') votesDown--;

        // Add new vote (unless toggling off)
        if (currentVote !== voteType) {
          if (voteType === 'up') votesUp++;
          if (voteType === 'down') votesDown++;
        }

        return { ...s, votes_up: Math.max(0, votesUp), votes_down: Math.max(0, votesDown) };
      })
    );

    try {
      await fetch(`${API_BASE_URL}/api/sets/id-suggestion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, userId, voteType }),
      });
    } catch (error) {
      if (__DEV__) console.error('[IDThis] Vote failed:', error);
      fetchSuggestions(); // Revert on failure
    }
  };

  const formatTimestamp = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayInner} onPress={onClose}>
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <HelpCircle size={20} color={Colors.dark.primary} />
                  <Text style={styles.title}>ID This Track</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={8}>
                  <X size={24} color={Colors.dark.textSecondary} />
                </Pressable>
              </View>

              {/* Track context */}
              {track && (
                <View style={styles.trackContext}>
                  <Text style={styles.trackContextLabel}>
                    Unknown track at {formatTimestamp(track.timestamp || 0)}
                  </Text>
                  {track.artist && track.artist.toLowerCase() !== 'id' && (
                    <Text style={styles.trackContextArtist}>
                      Possible artist: {track.artist}
                    </Text>
                  )}
                </View>
              )}

              {/* Submit new suggestion */}
              <View style={styles.submitSection}>
                <Text style={styles.sectionLabel}>Suggest an ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Artist name"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={suggestedArtist}
                  onChangeText={setSuggestedArtist}
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Track title"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={suggestedTitle}
                  onChangeText={setSuggestedTitle}
                  autoCapitalize="words"
                />
                <Pressable
                  style={[
                    styles.submitButton,
                    (!suggestedArtist.trim() || !suggestedTitle.trim()) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!suggestedArtist.trim() || !suggestedTitle.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Send size={14} color="#fff" />
                      <Text style={styles.submitButtonText}>Submit</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* Existing suggestions */}
              <View style={styles.suggestionsSection}>
                <Text style={styles.sectionLabel}>
                  Community Suggestions ({suggestions.length})
                </Text>

                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={Colors.dark.primary}
                    style={{ marginVertical: 16 }}
                  />
                ) : suggestions.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No suggestions yet. Be the first to ID this track!
                  </Text>
                ) : (
                  suggestions.map((suggestion) => {
                    const netVotes = suggestion.votes_up - suggestion.votes_down;
                    const userVote = userVotes[suggestion.id];

                    return (
                      <View key={suggestion.id} style={styles.suggestionCard}>
                        <View style={styles.suggestionInfo}>
                          <Text style={styles.suggestionTitle}>
                            {suggestion.suggested_title}
                          </Text>
                          <Text style={styles.suggestionArtist}>
                            {suggestion.suggested_artist}
                          </Text>
                          {suggestion.status === 'accepted' && (
                            <View style={styles.acceptedBadge}>
                              <Text style={styles.acceptedText}>Accepted</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.voteSection}>
                          <Pressable
                            style={[
                              styles.voteButton,
                              userVote === 'up' && styles.voteButtonActive,
                            ]}
                            onPress={() => handleVote(suggestion.id, 'up')}
                          >
                            <ThumbsUp
                              size={14}
                              color={userVote === 'up' ? Colors.dark.success : Colors.dark.textMuted}
                            />
                          </Pressable>
                          <Text
                            style={[
                              styles.voteCount,
                              netVotes > 0 && styles.voteCountPositive,
                              netVotes < 0 && styles.voteCountNegative,
                            ]}
                          >
                            {netVotes > 0 ? '+' : ''}{netVotes}
                          </Text>
                          <Pressable
                            style={[
                              styles.voteButton,
                              userVote === 'down' && styles.voteButtonActiveDown,
                            ]}
                            onPress={() => handleVote(suggestion.id, 'down')}
                          >
                            <ThumbsDown
                              size={14}
                              color={userVote === 'down' ? Colors.dark.error : Colors.dark.textMuted}
                            />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayInner: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  trackContext: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  trackContextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  trackContextArtist: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  submitSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  suggestionsSection: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  suggestionArtist: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  acceptedBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  acceptedText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.success,
  },
  voteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 12,
  },
  voteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteButtonActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  voteButtonActiveDown: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  voteCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    minWidth: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  voteCountPositive: {
    color: Colors.dark.success,
  },
  voteCountNegative: {
    color: Colors.dark.error,
  },
});
