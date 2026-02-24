import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, Animated, Dimensions, Easing, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform, Share } from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Music, Heart, MessageCircle, Share2, MapPin, Headphones, Clock, Send, Reply, Trash2, X, Volume2, VolumeX, SkipForward } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useSets } from '@/contexts/SetsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowing, useLikeSet, useComments } from '@/hooks/useSocial';
import { getArtistSets } from '@/lib/supabase/artistService';
import ArtistAvatar from '@/components/ArtistAvatar';
import { registerFeedAudioStop, unregisterFeedAudioStop, registerFeedRefresh, unregisterFeedRefresh } from '@/lib/feedAudioController';
import DoubleTapHeart from '@/components/DoubleTapHeart';
import type { CommentWithUser } from '@/hooks/useSocial';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Format count for display (1234 → 1.2K, etc.)
function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Glass Action Button ─────────────────────────────────────────────────
// Frosted circular button with 3D depth — like the physical toggle in the SHAKE/STIR design
function GlassActionButton({ children, onPress, label, isActive, activeColor, disabled }: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  isActive?: boolean;
  activeColor?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={styles.glassActionOuter}>
      {/* 3D shadow layer */}
      <View style={styles.glassActionShadow} />
      {/* Glass face */}
      <View style={styles.glassActionFace}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.glassActionTint]} />
        {children}
      </View>
      <Text style={[styles.glassActionLabel, isActive && { color: activeColor || '#fff' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Liquid Glass Skip Button ─────────────────────────────────────────────
// 3D frosted glass circle centered on each feed card — tapping skips to next preview
function LiquidGlassSkipButton({ onPress }: { onPress: () => void }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Slow continuous shimmer rotation
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Subtle pulse glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      shimmerAnim.stopAnimation();
      glowAnim.stopAnimation();
    };
  }, []);

  const shimmerRotate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Bounce animation on tap
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[lgStyles.container, { transform: [{ scale: scaleAnim }] }]}>
      {/* Outer glow ring */}
      <Animated.View style={[lgStyles.glowRing, { opacity: glowAnim }]} />
      {/* Spinning shimmer accent */}
      <Animated.View style={[lgStyles.shimmerRing, { transform: [{ rotate: shimmerRotate }] }]} />
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={lgStyles.pressable}
      >
        {/* Glass outline only — no fill */}
        <View style={lgStyles.glassFace}>
          <SkipForward size={26} color="rgba(255,255,255,0.75)" fill="rgba(255,255,255,0.08)" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const lgStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '63%',
    marginTop: -40, // half of 80
    zIndex: 15,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: 'rgba(255,255,255,0.4)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  shimmerRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.35)',
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  pressable: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  glassFace: {
    flex: 1,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.2)',
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
});

// ── Floating Track Pill ──────────────────────────────────────────────────
// A single track pill that drifts slowly from left to right
const { width: SCREEN_WIDTH } = Dimensions.get('window');

function FloatingTrackPill({ track, index, laneCount, cardHeight }: {
  track: { title: string; artist: string; coverUrl?: string; isId?: boolean };
  index: number;
  laneCount: number;
  cardHeight: number;
}) {
  // Start each pill at a random position up to 3/4 through its journey
  // so when you scroll to a set, some are already mid-drift
  const startOffset = useMemo(() => {
    const totalRange = SCREEN_WIDTH + 380; // full travel distance (-300 to SCREEN_WIDTH+80)
    const maxStart = totalRange * 0.75;
    return -300 + Math.random() * maxStart;
  }, []);

  const translateX = useRef(new Animated.Value(startOffset)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  // Quick stagger so pills appear fast when you land on a set,
  // but slow drift across the screen. Longer names drift a touch slower.
  const textLen = track.title.length + (track.artist?.length || 0);
  const extraForLength = Math.min(textLen * 60, 3000);
  const fullDuration = 14000 + index * 1400 + extraForLength;
  const delay = index * 800; // fast initial cascade

  useEffect(() => {
    // Calculate how far through the journey this pill already is
    const totalRange = SCREEN_WIDTH + 380;
    const alreadyTraveled = startOffset - (-300);
    const remainingFraction = 1 - (alreadyTraveled / totalRange);
    const firstRunDuration = Math.round(fullDuration * remainingFraction);

    const timeout = setTimeout(() => {
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // First run: finish the partial journey from the random start
      Animated.timing(translateX, {
        toValue: SCREEN_WIDTH + 80,
        duration: firstRunDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        // Then loop from the beginning
        Animated.loop(
          Animated.sequence([
            Animated.timing(translateX, {
              toValue: -300,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(translateX, {
              toValue: SCREEN_WIDTH + 80,
              duration: fullDuration,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    }, delay);

    return () => {
      clearTimeout(timeout);
      translateX.stopAnimation();
      fadeIn.stopAnimation();
    };
  }, []);

  // Distribute lanes vertically — avoid top area (now-playing bar ~18%) and bottom panel (bottom 28%)
  const usableTop = cardHeight * 0.20;
  const usableHeight = cardHeight * 0.50;
  const laneY = usableTop + (index / Math.max(laneCount - 1, 1)) * usableHeight;

  const isGold = track.isId === true;

  return (
    <Animated.View
      style={[
        styles.floatingTrackPill,
        isGold && styles.floatingTrackPillGold,
        {
          top: laneY,
          opacity: fadeIn,
          transform: [{ translateX }],
        },
      ]}
    >
      {track.coverUrl ? (
        <Image
          source={{ uri: track.coverUrl }}
          style={styles.floatingTrackThumb}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <Music size={12} color={isGold ? 'rgba(255,215,0,0.8)' : 'rgba(255,255,255,0.5)'} />
      )}
      <View style={styles.floatingTrackText}>
        <Text style={[styles.floatingTrackTitle, isGold && styles.floatingTrackTitleGold]} numberOfLines={1}>{track.title}</Text>
        {track.artist ? (
          <Text style={[styles.floatingTrackArtist, isGold && styles.floatingTrackArtistGold]} numberOfLines={1}>{track.artist}</Text>
        ) : null}
      </View>
      {isGold && <Text style={styles.floatingTrackIdBadge}>ID</Text>}
    </Animated.View>
  );
}

// ── Floating Tracks Container ────────────────────────────────────────────
// Overlays drifting track pills on the feed card
function FloatingTracks({ tracks, cardHeight }: {
  tracks: { title: string; artist: string; coverUrl?: string; isId?: boolean }[];
  cardHeight: number;
}) {
  const displayTracks = useMemo(() => tracks.slice(0, 5), [tracks]);

  if (displayTracks.length === 0) return null;

  return (
    <View style={styles.floatingTracksContainer} pointerEvents="none">
      {displayTracks.map((track, i) => (
        <FloatingTrackPill
          key={`${track.title}-${i}`}
          track={track}
          index={i}
          laneCount={displayTracks.length}
          cardHeight={cardHeight}
        />
      ))}
    </View>
  );
}

// ── Time ago helper ──────────────────────────────────────────────────────
function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'now';
}

// ── Comment Sheet ────────────────────────────────────────────────────────
// TikTok-style bottom sheet for comments
function CommentSheet({ visible, onClose, setId }: { visible: boolean; onClose: () => void; setId: string }) {
  const router = useRouter();
  const { isAuthenticated, user, profile } = useAuth();
  const { comments, isLoading, isSubmitting, addComment, deleteComment } = useComments(setId);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await addComment(text.trim(), replyingTo || undefined);
    if (!result?.error) {
      setText('');
      setReplyingTo(null);
    }
  };

  const handleDelete = async (commentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteComment(commentId);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <View style={csStyles.overlay}>
        <Pressable style={csStyles.backdrop} onPress={handleClose} />
        <Animated.View style={[csStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Glass background layers */}
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, csStyles.glassTint]} />
          {/* Top light edge — glass refraction */}
          <View style={csStyles.glassTopEdge} />

          {/* Handle bar */}
          <View style={csStyles.handleBar}>
            <View style={csStyles.handle} />
          </View>

          {/* Header */}
          <View style={csStyles.header}>
            <Text style={csStyles.headerTitle}>
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <X size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          {/* Comments list */}
          <ScrollView
            style={csStyles.list}
            contentContainerStyle={csStyles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isLoading ? (
              <View style={csStyles.centered}>
                <ActivityIndicator color="rgba(255,255,255,0.5)" />
              </View>
            ) : comments.length === 0 ? (
              <View style={csStyles.centered}>
                <Text style={csStyles.emptyText}>No comments yet</Text>
                <Text style={csStyles.emptySubtext}>Start the conversation</Text>
              </View>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={csStyles.commentRow}>
                  <Image
                    source={{ uri: comment.user?.avatar_url || 'https://via.placeholder.com/36' }}
                    style={csStyles.avatar}
                  />
                  <View style={csStyles.commentBody}>
                    <View style={csStyles.commentMeta}>
                      <Text style={csStyles.username}>
                        {comment.user?.display_name || comment.user?.username || 'User'}
                      </Text>
                      <Text style={csStyles.time}>{formatTimeAgo(comment.created_at)}</Text>
                    </View>
                    <Text style={csStyles.commentText}>{comment.content}</Text>
                    <View style={csStyles.actions}>
                      <Pressable
                        style={csStyles.action}
                        onPress={() => { Haptics.selectionAsync(); setReplyingTo(comment.id); }}
                      >
                        <Reply size={13} color="rgba(255,255,255,0.4)" />
                        <Text style={csStyles.actionText}>Reply</Text>
                      </Pressable>
                      {user?.id === comment.user_id && (
                        <Pressable
                          style={csStyles.action}
                          onPress={() => handleDelete(comment.id)}
                        >
                          <Trash2 size={13} color="rgba(255,255,255,0.4)" />
                        </Pressable>
                      )}
                    </View>

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <View style={csStyles.replies}>
                        {comment.replies.map((reply) => (
                          <View key={reply.id} style={csStyles.replyRow}>
                            <Image
                              source={{ uri: reply.user?.avatar_url || 'https://via.placeholder.com/28' }}
                              style={csStyles.replyAvatar}
                            />
                            <View style={{ flex: 1 }}>
                              <View style={csStyles.commentMeta}>
                                <Text style={csStyles.replyUsername}>
                                  {reply.user?.display_name || reply.user?.username || 'User'}
                                </Text>
                                <Text style={csStyles.time}>{formatTimeAgo(reply.created_at)}</Text>
                              </View>
                              <Text style={csStyles.replyText}>{reply.content}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Reply indicator */}
          {replyingTo && (
            <View style={csStyles.replyBar}>
              <Text style={csStyles.replyBarText}>Replying to comment</Text>
              <Pressable onPress={() => setReplyingTo(null)}>
                <Text style={csStyles.replyBarCancel}>Cancel</Text>
              </Pressable>
            </View>
          )}

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={10}
          >
            <View style={csStyles.inputRow}>
              <BlurView intensity={60} tint="dark" style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} />
              {isAuthenticated ? (
                <>
                  <Image
                    source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/32' }}
                    style={csStyles.inputAvatar}
                  />
                  <TextInput
                    style={csStyles.input}
                    placeholder={replyingTo ? 'Reply...' : 'Add a comment...'}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={1000}
                  />
                  <Pressable
                    style={[csStyles.sendBtn, (!text.trim() || isSubmitting) && csStyles.sendBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!text.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Send size={16} color="#fff" />
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable style={csStyles.loginBtn} onPress={() => router.push('/(auth)/login')}>
                  <Text style={csStyles.loginBtnText}>Log in to comment</Text>
                </Pressable>
              )}
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Comment Sheet Styles ─────────────────────────────────────────────────
const csStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: 'rgba(20, 20, 20, 0.55)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  glassTint: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  glassTopEdge: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    zIndex: 10,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    zIndex: 2,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  list: {
    flex: 1,
    zIndex: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  commentBody: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  time: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  commentText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  replies: {
    marginTop: 12,
    paddingLeft: 10,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  replyRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  replyUsername: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  replyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 17,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    zIndex: 2,
  },
  replyBarText: {
    fontSize: 13,
    color: '#C41E3A',
  },
  replyBarCancel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 28, // extra padding for home indicator
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    gap: 10,
    overflow: 'hidden',
    zIndex: 2,
  },
  inputAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: '#fff',
    maxHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#C41E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  loginBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginBtnText: {
    fontSize: 14,
    color: '#C41E3A',
    fontWeight: '600',
  },
});

// ── Glass Waveform ──────────────────────────────────────────────────────
// Animated transparent glass waveform bars for the now-playing indicator
const WAVE_BAR_COUNT = 5;
function GlassWaveform() {
  const anims = useRef(
    Array.from({ length: WAVE_BAR_COUNT }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300 + Math.random() * 200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.25 + Math.random() * 0.15,
            duration: 350 + Math.random() * 250,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={waveStyles.container}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            waveStyles.bar,
            { transform: [{ scaleY: anim }] },
          ]}
        />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 18,
  },
  bar: {
    width: 3,
    height: 18,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});

// ── Now Playing Bar (on-card) ────────────────────────────────────────────
// Ultra-transparent glass outline. Empty until a track loads, then shows
// waveform + track info. Heart button to save the track.
function NowPlayingBar({ nowPlaying, isMuted }: { nowPlaying?: { title: string; artist: string } | null; isMuted?: boolean }) {
  const [liked, setLiked] = useState(false);
  const heartBounce = useRef(new Animated.Value(1)).current;
  const isPlaying = !!nowPlaying && !isMuted;

  // Reset liked state when track changes
  const lastTrack = useRef(nowPlaying?.title);
  if (nowPlaying?.title !== lastTrack.current) {
    lastTrack.current = nowPlaying?.title;
    if (liked) setLiked(false);
  }

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(prev => !prev);
    Animated.sequence([
      Animated.spring(heartBounce, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(heartBounce, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
  };

  return (
    <View style={npStyles.card}>
      <View style={npStyles.inner}>
        {isPlaying && <GlassWaveform />}
        <View style={npStyles.text}>
          {isPlaying && (
            <>
              <Text style={npStyles.title} numberOfLines={1}>{nowPlaying.title}</Text>
              <Text style={npStyles.artist} numberOfLines={1}>{nowPlaying.artist}</Text>
            </>
          )}
        </View>
        <Pressable onPress={handleSave} hitSlop={10} style={npStyles.saveBtn}>
          <Animated.View style={{ transform: [{ scale: heartBounce }] }}>
            <Heart
              size={16}
              color={liked ? '#EF4444' : 'rgba(255,255,255,0.35)'}
              fill={liked ? '#EF4444' : 'none'}
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const npStyles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderTopColor: 'rgba(255,255,255,0.1)',
    zIndex: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 10,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.8)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  artist: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.4)',
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Feed Card ───────────────────────────────────────────────────────────
// Immersive TikTok-style card with frosted glass overlays and 3D depth
function FeedCard({ item, onPress, cardHeight, onOpenComments, onTracksLoaded, onSkipTrack, nowPlaying, isMuted }: { item: any; onPress: () => void; cardHeight: number; onOpenComments: (setId: string) => void; onTracksLoaded?: (setId: string, tracks: any[]) => void; onSkipTrack?: (setId: string) => void; nowPlaying?: { title: string; artist: string } | null; isMuted?: boolean }) {
  const { user } = useAuth();
  const { isLiked, likeCount, isLoading: likeLoading, toggleLike } = useLikeSet(item.set.id);
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const lastTapTime = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);

  // Fetch tracks for floating track cards
  const [floatingTracks, setFloatingTracks] = useState<{ title: string; artist: string; coverUrl?: string; isId?: boolean }[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (item.set.tracksIdentified > 0) {
      (async () => {
        try {
          const res = await fetch(`${FEED_API_BASE_URL}/api/sets/${item.set.id}`);
          const data = await res.json();
          if (!cancelled && data.success && data.set?.tracks?.length > 0) {
            const allTracks = data.set.tracks;
            setFloatingTracks(
              allTracks
                .filter((t: any) => t.title && t.title !== 'ID')
                .slice(0, 8)
                .map((t: any) => ({
                  title: t.title,
                  artist: t.artist || '',
                  coverUrl: t.coverUrl || undefined,
                  isId: t.isId || false,
                }))
            );
            // Pass full track data up for audio preview
            onTracksLoaded?.(item.set.id, allTracks);
          }
        } catch {}
      })();
    }
    return () => { cancelled = true; };
  }, [item.set.id, item.set.tracksIdentified]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    toggleLike();
  };

  const handleComment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenComments(item.set.id);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const url = `https://trakd.app/set/${item.set.id}`;
      const artistName = item.artist.name || 'Unknown';
      const setName = item.set.name || 'Set';
      await Share.share({
        message: Platform.OS === 'android'
          ? `Check out ${setName} by ${artistName} on trakd\n${url}`
          : `Check out ${setName} by ${artistName} on trakd`,
        url: Platform.OS === 'ios' ? url : undefined,
        title: `${setName} — ${artistName}`,
      });
    } catch (error) {
      if (__DEV__) console.log('Share error:', error);
    }
  };

  const displayLikeCount = likeCount ?? item.set.likeCount ?? 0;
  const commentCount = item.set.commentCount ?? 0;

  return (
    <Animated.View style={[styles.feedCard, { height: cardHeight, transform: [{ scale: scaleAnim }] }]}>
      {/* Outer glow ring for 3D lift */}
      <View style={styles.feedCardGlow} />

      <Pressable
        onPress={() => {
          const now = Date.now();
          if (now - lastTapTime.current < 300) {
            // Double-tap → like
            if (tapTimer.current) {
              clearTimeout(tapTimer.current);
              tapTimer.current = null;
            }
            lastTapTime.current = 0;
            if (!isLiked) {
              handleLike();
            }
            setShowDoubleTapHeart(true);
          } else {
            // First tap — wait for possible second tap
            lastTapTime.current = now;
            tapTimer.current = setTimeout(() => {
              tapTimer.current = null;
              onPress();
            }, 300);
          }
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        <View style={[styles.feedHero, { height: cardHeight }]}>
          {/* Cover fallback: cover → artist image → dark gradient */}
          {(item.set.image || item.artist.image) ? (() => {
            const imgUri = item.set.image || item.artist.image;
            const isExternalThumb = imgUri && (imgUri.includes('img.youtube.com') || imgUri.includes('sndcdn.com'));
            return (
              <Image
                source={{ uri: imgUri }}
                style={isExternalThumb
                  ? [StyleSheet.absoluteFill, { transform: [{ scale: 0.92 }] }]
                  : StyleSheet.absoluteFill}
                contentFit={isExternalThumb ? 'contain' : 'cover'}
                cachePolicy="memory-disk"
                transition={200}
              />
            );
          })() : (
            <LinearGradient
              colors={['#1A1A1A', '#111', '#0A0A0A']}
              style={StyleSheet.absoluteFill}
            />
          )}
          {!item.set.image && !item.artist.image && (
            <View style={styles.feedHeroPlaceholder}>
              <Headphones size={40} color="rgba(255,255,255,0.08)" />
            </View>
          )}

          {/* Gradient overlays — darker for glass contrast */}
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent']}
            locations={[0, 0.35]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            locations={[0.4, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* ── Floating track cards ── */}
          {floatingTracks.length > 0 && (
            <FloatingTracks tracks={floatingTracks} cardHeight={cardHeight} />
          )}

          {/* ── Centered liquid glass skip button ── */}
          {onSkipTrack && (
            <LiquidGlassSkipButton onPress={() => onSkipTrack(item.set.id)} />
          )}

          {/* ── Glass action column (right side) ── */}
          <View style={styles.feedActionColumn}>
            <GlassActionButton
              onPress={handleLike}
              label={formatCount(displayLikeCount)}
              isActive={isLiked}
              activeColor="#EF4444"
              disabled={likeLoading}
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart
                  size={22}
                  color={isLiked ? '#EF4444' : '#fff'}
                  fill={isLiked ? '#EF4444' : 'none'}
                />
              </Animated.View>
            </GlassActionButton>

            <GlassActionButton onPress={handleComment} label={formatCount(commentCount)}>
              <MessageCircle size={20} color="#fff" />
            </GlassActionButton>

            <GlassActionButton onPress={handleShare} label="Share">
              <Share2 size={19} color="#fff" />
            </GlassActionButton>
          </View>

          {/* ── Glass artist badge (top-left) ── */}
          <View style={styles.feedArtistBadge}>
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.feedArtistBadgeTint]} />
            {/* Top light edge — glass refraction */}
            <View style={styles.feedArtistBadgeLightEdge} />
            <View style={styles.feedArtistBadgeInner}>
              <ArtistAvatar
                imageUrl={item.artist.image}
                name={item.artist.name}
                size={24}
              />
              <Text style={styles.feedBadgeArtistName} numberOfLines={1}>{item.artist.name}</Text>
              <View style={styles.feedBadgeDot} />
              <Text style={styles.feedBadgeTime}>{item.set.date}</Text>
            </View>
          </View>

          {/* ── Glass now-playing bar (always visible, centered under artist badge) ── */}
          <NowPlayingBar nowPlaying={nowPlaying} isMuted={isMuted} />

          {/* ── Floating glass info panel (bottom) ── */}
          <View style={styles.feedInfoPanel}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.feedInfoPanelTint]} />
            {/* Light edge along top */}
            <View style={styles.feedInfoPanelLightEdge} />
            <View style={styles.feedInfoPanelContent}>
              <Text style={styles.feedInfoTitle} numberOfLines={2}>{item.set.name}</Text>
              <View style={styles.feedInfoMeta}>
                {item.set.venue ? (
                  <View style={styles.feedInfoMetaPill}>
                    <MapPin size={10} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.feedInfoMetaText}>{item.set.venue}</Text>
                  </View>
                ) : null}
                {item.set.duration ? (
                  <View style={styles.feedInfoMetaPill}>
                    <Clock size={10} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.feedInfoMetaText}>{item.set.duration}</Text>
                  </View>
                ) : null}
                {item.set.tracksIdentified > 0 && (
                  <View style={styles.feedInfoMetaPill}>
                    <Music size={10} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.feedInfoMetaText}>{item.set.tracksIdentified} tracks</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </Pressable>
      <DoubleTapHeart
        visible={showDoubleTapHeart}
        onComplete={() => setShowDoubleTapHeart(false)}
      />
    </Animated.View>
  );
}

// API base URL for fetching recent sets
const FEED_API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';


type FeedCategory = 'for_you' | 'new' | 'popular' | 'deep_cuts';

const FEED_CATEGORIES: { key: FeedCategory; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'new', label: 'New Sets' },
  { key: 'popular', label: 'Most Popular' },
  { key: 'deep_cuts', label: 'Deep Cuts' },
];

// ── Category Carousel ────────────────────────────────────────────────────
// Scrollable horizontal carousel. The centered item is the active one — it's
// large and "hovering" in front; items on the sides are small + receded.
// Swiping or tapping slides a new item to center.

const CAR_ITEM_W = 120; // fixed width per slot so snapping works

function CategoryCarousel(props: {
  categories: { key: FeedCategory; label: string }[];
  activeCategory: FeedCategory;
  onCategoryChange: (cat: FeedCategory) => void;
}) {
  const { categories, activeCategory, onCategoryChange } = props;
  const scrollXRef = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const activeIdx = categories.findIndex(c => c.key === activeCategory);
  const isUserScroll = useRef(false);

  // When activeCategory changes via tap, scroll to it
  useEffect(() => {
    if (!isUserScroll.current) {
      flatListRef.current?.scrollToOffset({
        offset: activeIdx * CAR_ITEM_W,
        animated: true,
      });
    }
    isUserScroll.current = false;
  }, [activeIdx]);

  const sidePad = (SCREEN_WIDTH - CAR_ITEM_W) / 2;

  const handleScrollEnd = useCallback((e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / CAR_ITEM_W);
    const clamped = Math.max(0, Math.min(idx, categories.length - 1));
    if (categories[clamped].key !== activeCategory) {
      isUserScroll.current = true;
      onCategoryChange(categories[clamped].key);
    }
  }, [categories, activeCategory, onCategoryChange]);

  const renderItem = useCallback(({ item, index }: { item: { key: FeedCategory; label: string }; index: number }) => {
    // Interpolate based on scroll position — center item at index*CAR_ITEM_W
    const inputRange = [
      (index - 1) * CAR_ITEM_W,
      index * CAR_ITEM_W,
      (index + 1) * CAR_ITEM_W,
    ];
    const scale = scrollXRef.interpolate({
      inputRange,
      outputRange: [0.72, 1.05, 0.72],
      extrapolate: 'clamp',
    });
    const itemOpacity = scrollXRef.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp',
    });
    const translateY = scrollXRef.interpolate({
      inputRange,
      outputRange: [2, -3, 2],
      extrapolate: 'clamp',
    });

    const isCenter = item.key === activeCategory;

    return (
      <Pressable
        onPress={() => onCategoryChange(item.key)}
        style={{ width: CAR_ITEM_W, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={[
          carStyles.pill,
          isCenter && carStyles.pillCenter,
          {
            transform: [{ scale }, { translateY }],
            opacity: itemOpacity,
          },
        ]}>
          <Text
            style={isCenter ? carStyles.txtCenter : carStyles.txtSide}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </Animated.View>
      </Pressable>
    );
  }, [activeCategory, onCategoryChange, scrollXRef]);

  return (
    <View style={carStyles.bar}>
      <Animated.FlatList
        ref={flatListRef}
        data={categories}
        keyExtractor={(item: { key: string }) => item.key}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CAR_ITEM_W}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePad }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollXRef } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        getItemLayout={(_: any, index: number) => ({
          length: CAR_ITEM_W,
          offset: CAR_ITEM_W * index,
          index,
        })}
      />
    </View>
  );
}

const carStyles = StyleSheet.create({
  bar: {
    height: 48,
    backgroundColor: '#F0EDE8',
    zIndex: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  pillCenter: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderColor: 'rgba(196,30,58,0.25)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: 'rgba(196,30,58,0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  txtCenter: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#C41E3A',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  txtSide: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(0,0,0,0.35)',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});

export default function FeedScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { sets } = useSets();
  const { user, profile } = useAuth();
  const { followedArtists, isLoading: followingLoading } = useFollowing();
  const [refreshing, setRefreshing] = useState(false);
  const [followedArtistSets, setFollowedArtistSets] = useState<any[]>([]);
  const [recentDbSets, setRecentDbSets] = useState<any[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [feedAreaHeight, setFeedAreaHeight] = useState(0);
  const [activeCategory, setActiveCategory] = useState<FeedCategory>('for_you');
  const [commentSheetSetId, setCommentSheetSetId] = useState<string | null>(null);
  const feedListRef = useRef<FlatList>(null);

  // ── Audio Preview ──
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioGenRef = useRef(0);           // generation counter — prevents stale async ops
  const visibleSetIdRef = useRef<string | null>(null);
  const tracksCacheRef = useRef<Map<string, any[]>>(new Map());
  const fetchAbortRef = useRef<AbortController | null>(null);
  const hasAutoPlayedRef = useRef(false);  // ensures auto-play only fires once
  const audioDisabledRef = useRef(false);  // kill switch — blocks all playback until user scrolls
  const trackIndexRef = useRef<Map<string, number>>(new Map()); // per-set track index for skip
  const skipToNextTrackRef = useRef<((setId: string) => void) | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [nowPlaying, setNowPlaying] = useState<{ title: string; artist: string } | null>(null);
  const isScrollingRef = useRef(false);
  const scrollCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPlayedOnceRef = useRef(false); // fade in volume on first play

  // Configure audio session once
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    return () => { stopAudio(); };
  }, []);

  // Register stop callback so tab layout can stop audio on tab switch
  useEffect(() => {
    registerFeedAudioStop(stopAudio);
    return () => { unregisterFeedAudioStop(); };
  }, [stopAudio]);

  // Sync muted state
  useEffect(() => {
    isMutedRef.current = isMuted;
    soundRef.current?.setVolumeAsync(isMuted ? 0 : 0.7).catch(() => {});
  }, [isMuted]);

  // ── Core helpers ──

  const stopAudio = useCallback((disable = true) => {
    if (disable) audioDisabledRef.current = true;
    audioGenRef.current++;
    visibleSetIdRef.current = null;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    if (soundRef.current) {
      const s = soundRef.current;
      soundRef.current = null;
      s.stopAsync().then(() => s.unloadAsync()).catch(() => {});
    }
    setNowPlaying(null);
  }, []);

  const loadAndPlay = useCallback(async (gen: number, url: string, title: string, artist: string): Promise<boolean> => {
    if (audioGenRef.current !== gen) return false;
    const targetVol = isMutedRef.current ? 0 : 0.7;
    const isFirstPlay = !hasPlayedOnceRef.current;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, isLooping: true, volume: isFirstPlay ? 0 : targetVol }
      );
      if (audioGenRef.current !== gen) {
        sound.unloadAsync().catch(() => {});
        return false;
      }
      // Unload any previous sound that snuck in
      if (soundRef.current) {
        const old = soundRef.current;
        soundRef.current = null;
        old.stopAsync().then(() => old.unloadAsync()).catch(() => {});
      }
      soundRef.current = sound;
      setNowPlaying({ title, artist });
      hasPlayedOnceRef.current = true;
      // Gentle fade-in on first play (0 → target over ~1.5s)
      if (isFirstPlay && targetVol > 0) {
        const steps = 8;
        const stepMs = 180;
        for (let i = 1; i <= steps; i++) {
          await new Promise(r => setTimeout(r, stepMs));
          if (audioGenRef.current !== gen) return true; // scrolled away, sound already set
          await sound.setVolumeAsync(targetVol * (i / steps)).catch(() => {});
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Main play logic ──

  const playPreviewForSet = useCallback(async (setId: string, tracks: any[]) => {
    if (audioDisabledRef.current) return;
    // Bump generation — any in-flight work from previous calls becomes stale
    stopAudio(false);
    const gen = audioGenRef.current;
    visibleSetIdRef.current = setId;

    // Only use verified tracks (not IDs or unknowns)
    const verified = (tracks || []).filter(
      (t: any) => !t.isId && t.title && t.title !== 'Unknown' && t.title !== 'ID'
        && t.artist && t.artist !== 'Unknown' && t.artist !== 'ID'
    );

    // Shuffle so each scroll plays a different track
    const shuffled = [...verified].sort(() => Math.random() - 0.5);

    // 1. Try Spotify previews first (random order)
    const spotifyTrack = shuffled.find((t: any) => t.previewUrl);
    if (spotifyTrack) {
      if (await loadAndPlay(gen, spotifyTrack.previewUrl, spotifyTrack.title, spotifyTrack.artist)) return;
    }

    // 2. Deezer fallback — try up to 5 random verified tracks
    const candidates = shuffled.filter((t: any) => !t.previewUrl).slice(0, 5);
    const cleanTitle = (t: string) => t.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const track of candidates) {
      if (audioGenRef.current !== gen) return;
      const title = cleanTitle(track.title);
      const artist = cleanTitle(track.artist);
      if (!title || !artist) continue;
      try {
        for (const q of [
          encodeURIComponent(`artist:"${artist}" track:"${title}"`),
          encodeURIComponent(`${artist} ${title}`),
        ]) {
          if (audioGenRef.current !== gen) return;
          const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=3`);
          if (audioGenRef.current !== gen) return;
          const json = await res.json();
          // Validate result actually matches — prevent wrong artist/song
          const match = (json?.data || []).find((d: any) => {
            if (!d.preview) return false;
            const rArtist = normalize(d.artist?.name || '');
            const rTitle = normalize(d.title || '');
            const qArtist = normalize(artist);
            const qTitle = normalize(title);
            // Artist must be a substring match (handles "feat." variants)
            const artistOk = rArtist.includes(qArtist) || qArtist.includes(rArtist);
            // Title must share significant overlap
            const titleOk = rTitle.includes(qTitle) || qTitle.includes(rTitle);
            return artistOk && titleOk;
          });
          if (match && await loadAndPlay(gen, match.preview, track.title, track.artist)) return;
        }
      } catch {}
    }
  }, [stopAudio, loadAndPlay]);

  // ── Skip to next track ──

  const skipToNextTrack = useCallback(async (setId: string) => {
    const tracks = tracksCacheRef.current.get(setId);
    if (!tracks || tracks.length === 0) return;

    // Re-enable audio if it was disabled (user interacting)
    audioDisabledRef.current = false;

    // Filter to verified tracks only
    const verified = tracks.filter(
      (t: any) => !t.isId && t.title && t.title !== 'Unknown' && t.title !== 'ID'
        && t.artist && t.artist !== 'Unknown' && t.artist !== 'ID'
    );
    if (verified.length === 0) return;

    // Get current index and advance
    const currentIdx = trackIndexRef.current.get(setId) ?? -1;
    const nextIdx = (currentIdx + 1) % verified.length;
    trackIndexRef.current.set(setId, nextIdx);

    const track = verified[nextIdx];

    // Stop current audio
    stopAudio(false);
    const gen = audioGenRef.current;
    visibleSetIdRef.current = setId;

    // 1. Try Spotify preview first
    if (track.previewUrl) {
      if (await loadAndPlay(gen, track.previewUrl, track.title, track.artist)) return;
    }

    // 2. Deezer fallback
    const cleanTitle = (t: string) => t.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const title = cleanTitle(track.title);
    const artist = cleanTitle(track.artist);
    if (!title || !artist) return;

    try {
      for (const q of [
        encodeURIComponent(`artist:"${artist}" track:"${title}"`),
        encodeURIComponent(`${artist} ${title}`),
      ]) {
        if (audioGenRef.current !== gen) return;
        const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=3`);
        if (audioGenRef.current !== gen) return;
        const json = await res.json();
        const match = (json?.data || []).find((d: any) => {
          if (!d.preview) return false;
          const rArtist = normalize(d.artist?.name || '');
          const rTitle = normalize(d.title || '');
          const qArtist = normalize(artist);
          const qTitle = normalize(title);
          const artistOk = rArtist.includes(qArtist) || qArtist.includes(rArtist);
          const titleOk = rTitle.includes(qTitle) || qTitle.includes(rTitle);
          return artistOk && titleOk;
        });
        if (match && await loadAndPlay(gen, match.preview, track.title, track.artist)) return;
      }
    } catch {}

    // If this track had no preview, try the next one automatically
    if (verified.length > 1) {
      // Already incremented nextIdx, just recurse with a small guard
      const attempted = trackIndexRef.current.get(setId) ?? 0;
      if (attempted < verified.length) {
        trackIndexRef.current.set(setId, nextIdx);
        // Use setTimeout to avoid deep recursion in same call
        setTimeout(() => skipToNextTrackRef.current?.(setId), 0);
      }
    }
  }, [stopAudio, loadAndPlay]);

  // Keep ref in sync for recursive calls
  skipToNextTrackRef.current = skipToNextTrack;

  // ── Visibility handling ──

  const handleSetBecameVisible = useCallback(async (setId: string) => {
    if (audioDisabledRef.current) return;
    if (visibleSetIdRef.current === setId && soundRef.current) return; // already playing this

    // Stop old audio immediately
    stopAudio(false);
    visibleSetIdRef.current = setId;
    const gen = audioGenRef.current;

    // Try cache
    const cached = tracksCacheRef.current.get(setId);
    if (cached) {
      playPreviewForSet(setId, cached);
      return;
    }

    // Fetch tracks
    const abort = new AbortController();
    fetchAbortRef.current = abort;
    try {
      const res = await fetch(`${FEED_API_BASE_URL}/api/sets/${setId}`, { signal: abort.signal });
      const data = await res.json();
      if (audioGenRef.current !== gen) return; // scrolled away during fetch

      if (data.success && data.set?.tracks?.length > 0) {
        tracksCacheRef.current.set(setId, data.set.tracks);
        playPreviewForSet(setId, data.set.tracks);
        // Background enrichment
        if (data.needsEnrichment) {
          fetch(`${FEED_API_BASE_URL}/api/spotify-enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'enrich-set', setId }),
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // expected on fast scroll
    }
  }, [stopAudio, playPreviewForSet]);

  // Called by FeedCard when its track data loads (supplements cache)
  const handleTracksLoaded = useCallback((setId: string, tracks: any[]) => {
    tracksCacheRef.current.set(setId, tracks);
    // If this card is visible and no audio is playing yet, start
    if (visibleSetIdRef.current === setId && !soundRef.current) {
      playPreviewForSet(setId, tracks);
    }
  }, [playPreviewForSet]);

  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(prev => !prev);
  }, []);

  // Map category to API sort param
  const categoryToSort = (cat: FeedCategory): string => {
    switch (cat) {
      case 'for_you': return 'for_you';
      case 'new': return 'new';
      case 'popular': return 'popular';
      case 'deep_cuts': return 'deep_cuts';
      default: return 'recent';
    }
  };

  // Load sets for the active category (re-fetch on login/logout for personalization)
  useEffect(() => {
    loadCategorySets(activeCategory);
  }, [activeCategory, user?.id]);

  // Load sets from database for followed artists (for_you)
  useEffect(() => {
    if (user && followedArtists.length > 0 && !followingLoading) {
      loadFollowedArtistSets();
    }
  }, [user, followedArtists, followingLoading]);

  const loadCategorySets = async (category: FeedCategory) => {
    try {
      const sort = categoryToSort(category);
      let url = `${FEED_API_BASE_URL}/api/sets?limit=20&sort=${sort}`;
      // Pass user_id for personalized For You scoring
      if (sort === 'for_you' && user?.id) {
        url += `&user_id=${encodeURIComponent(user.id)}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success && data.sets) {
        setRecentDbSets(data.sets);
      }
    } catch (error) {
      if (__DEV__) console.error('[Feed] Error loading sets:', error);
    }
  };

  const handleCategoryChange = (cat: FeedCategory) => {
    if (cat === activeCategory) return;
    Haptics.selectionAsync();
    setActiveCategory(cat);
    // Scroll back to top when switching tabs
    feedListRef.current?.scrollToOffset({ offset: 0, animated: false });
    // Stop audio cleanly — new data will trigger playback for the first card
    stopAudio();
    visibleSetIdRef.current = null;
  };

  const loadFollowedArtistSets = async () => {
    // Only show blocking loader if we have nothing rendered yet.
    const shouldBlock = followedArtistSets.length === 0 && recentDbSets.length === 0;
    if (shouldBlock) setLoadingSets(true);
    try {
      const artistIds = followedArtists
        .map(f => f.following_artist?.id)
        .filter(Boolean) as string[];

      const setsPromises = artistIds.map(id => getArtistSets(id, 10));
      const setsResults = await Promise.all(setsPromises);

      const allSets = setsResults.flat();
      const uniqueSets = allSets.filter((set, index, self) =>
        index === self.findIndex(s => s.id === set.id)
      );

      setFollowedArtistSets(uniqueSets);
    } catch (error) {
      if (__DEV__) console.error('[Feed] Error loading followed artist sets:', error);
    }
    if (shouldBlock) setLoadingSets(false);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const followedArtistNames = useMemo(() => {
    if (!user || followedArtists.length === 0) return [];
    return followedArtists
      .map(f => f.following_artist?.name?.toLowerCase())
      .filter(Boolean) as string[];
  }, [user, followedArtists]);

  const getYTThumb = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  };

  const realFeedItems = useMemo(() => {
    // "For You" with followed artists gets priority
    if (activeCategory === 'for_you' && user && followedArtistSets.length > 0) {
      return followedArtistSets
        .sort((a, b) => new Date(b.created_at || b.event_date).getTime() - new Date(a.created_at || a.event_date).getTime())
        .slice(0, 20)
        .map(set => ({
          id: set.id,
          type: 'new_set' as const,
          artist: {
            id: set.dj_name,
            name: set.dj_name,
            image: null,
            following: true,
          },
          set: {
            id: set.id,
            name: set.title || set.name,
            venue: set.venue || '',
            date: formatDate(new Date(set.created_at || set.event_date)),
            image: getYTThumb(set.youtube_url) || null,
            duration: set.duration_seconds ? formatDuration(set.duration_seconds) : '',
            tracksIdentified: set.track_count || 0,
          },
          timestamp: new Date(set.created_at || set.event_date),
        }));
    }

    if (recentDbSets.length > 0) {
      return recentDbSets.map(set => ({
        id: set.id,
        type: 'new_set' as const,
        artist: {
          id: set.artist,
          name: set.artist,
          image: set.artistImageUrl || null,
          following: false,
        },
        set: {
          id: set.id,
          name: set.name,
          venue: set.venue || '',
          date: formatDate(new Date(set.date)),
          image: set.coverUrl || null,
          duration: set.totalDuration ? formatDuration(set.totalDuration) : '',
          tracksIdentified: set.trackCount || 0,
        },
        timestamp: new Date(set.date),
      }));
    }

    return sets
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map(set => ({
        id: set.id,
        type: 'new_set' as const,
        artist: {
          id: set.artist,
          name: set.artist,
          image: null,
          following: true,
        },
        set: {
          id: set.id,
          name: set.name,
          venue: set.venue || '',
          date: formatDate(set.date),
          image: set.coverUrl || null,
          duration: set.totalDuration ? formatDuration(set.totalDuration) : '',
          tracksIdentified: set.tracksIdentified || set.tracks.length,
        },
        timestamp: set.date,
      }));
  }, [sets, user, followedArtistSets, recentDbSets, activeCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadCategorySets(activeCategory),
      activeCategory === 'for_you' && user && followedArtists.length > 0 ? loadFollowedArtistSets() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [user, followedArtists, activeCategory]);

  // Scroll to top and refresh — called when user re-taps the Feed tab
  const scrollToTopAndRefresh = useCallback(() => {
    feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
    onRefresh();
  }, [onRefresh]);

  // Register refresh callback so tab layout can trigger it
  useEffect(() => {
    registerFeedRefresh(scrollToTopAndRefresh);
    return () => { unregisterFeedRefresh(); };
  }, [scrollToTopAndRefresh]);

  // Heights for layout calculations
  const HEADER_HEIGHT = 38;
  const CATEGORY_BAR_HEIGHT = 44;
  const TAB_BAR_HEIGHT = 80;

  const fullFeedHeight = feedAreaHeight > 0
    ? feedAreaHeight
    : SCREEN_HEIGHT - insets.top - HEADER_HEIGHT - CATEGORY_BAR_HEIGHT - TAB_BAR_HEIGHT;
  const CARD_GAP = 10;
  const cardPageHeight = fullFeedHeight - CARD_GAP - 16; // slightly shorter cards

  // ── Scroll tracking: suppress accidental taps during/after scroll ──
  const handleScrollBegin = useCallback(() => {
    isScrollingRef.current = true;
    audioDisabledRef.current = false; // user is scrolling on feed — re-enable audio
    if (scrollCooldownRef.current) clearTimeout(scrollCooldownRef.current);
  }, []);

  const handleScrollEnd = useCallback((e: any) => {
    // Mark scrolling done after a short cooldown (prevents tap-on-land)
    if (scrollCooldownRef.current) clearTimeout(scrollCooldownRef.current);
    scrollCooldownRef.current = setTimeout(() => { isScrollingRef.current = false; }, 300);

    if (fullFeedHeight <= 0) return;
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / fullFeedHeight);
    if (index >= 0 && index < realFeedItems.length) {
      handleSetBecameVisible(realFeedItems[index].set.id);
    }
  }, [fullFeedHeight, realFeedItems, handleSetBecameVisible]);

  // Auto-play first card when feed data loads (fires once only)
  useEffect(() => {
    if (realFeedItems.length > 0 && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      handleSetBecameVisible(realFeedItems[0].set.id);
    }
  }, [realFeedItems.length, handleSetBecameVisible]);

  const renderFeedCard = useCallback(({ item }: { item: any }) => (
    <View style={{ height: fullFeedHeight, justifyContent: 'center', paddingVertical: CARD_GAP / 2 }}>
      <FeedCard
        item={item}
        cardHeight={cardPageHeight}
        onPress={() => {
          // Suppress accidental taps during/right-after scroll
          if (isScrollingRef.current) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          stopAudio();
          router.push(`/(tabs)/(discover)/${item.set.id}`);
        }}
        onOpenComments={(setId) => { stopAudio(); setCommentSheetSetId(setId); }}
        onTracksLoaded={handleTracksLoaded}
        onSkipTrack={skipToNextTrack}
        nowPlaying={nowPlaying}
        isMuted={isMuted}
      />
    </View>
  ), [cardPageHeight, fullFeedHeight, router, handleTracksLoaded, stopAudio, skipToNextTrack, nowPlaying, isMuted]);

  return (
    <View style={styles.container}>
      {/* Ambient glass background with colored orbs */}
      <View style={styles.glassBackground} pointerEvents="none">
        <View style={[styles.glassOrb, styles.glassOrb1]} />
        <View style={[styles.glassOrb, styles.glassOrb2]} />
        <View style={[styles.glassOrb, styles.glassOrb3]} />
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
      </View>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Fixed header */}
        <View style={styles.header}>
          <Text style={styles.headerLogo}>trakd</Text>
          <Pressable onPress={toggleMute} hitSlop={12} style={styles.muteButton}>
            {isMuted ? (
              <VolumeX size={20} color="rgba(0,0,0,0.4)" />
            ) : (
              <Volume2 size={20} color="#C41E3A" />
            )}
          </Pressable>
        </View>

        {/* ── Category carousel ── */}
        <CategoryCarousel
          categories={FEED_CATEGORIES}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
        />

        {/* TikTok-style paging feed */}
        <View
          style={styles.feedScrollWrapper}
          onLayout={(e) => setFeedAreaHeight(e.nativeEvent.layout.height)}
        >
          {loadingSets && realFeedItems.length === 0 ? (
            <View style={styles.loadingFeed}>
              <ActivityIndicator color={Colors.dark.primary} />
              <Text style={styles.loadingFeedText}>Loading sets...</Text>
            </View>
          ) : realFeedItems.length > 0 ? (
            <FlatList
              ref={feedListRef}
              data={realFeedItems}
              renderItem={renderFeedCard}
              keyExtractor={(item) => item.id}
              pagingEnabled
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.feedListContent}
              onScrollBeginDrag={handleScrollBegin}
              onMomentumScrollEnd={handleScrollEnd}
              onScrollEndDrag={handleScrollEnd}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={Colors.dark.primary}
                />
              }
            />
          ) : (
            <View style={styles.emptyFeed}>
              <Text style={styles.emptyFeedText}>
                {user && followedArtists.length > 0
                  ? 'No sets from followed artists'
                  : 'No sets yet'}
              </Text>
              <Text style={styles.emptyFeedSubtext}>
                {user && followedArtists.length > 0
                  ? 'Sets from artists you follow will appear here'
                  : 'Follow artists to see their latest sets'}
              </Text>
              <Pressable
                style={styles.browseButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/(tabs)/(feed)');
                }}
              >
                <Text style={styles.browseButtonText}>Browse All Sets</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* TikTok-style comment bottom sheet */}
      <CommentSheet
        visible={!!commentSheetSetId}
        setId={commentSheetSetId || ''}
        onClose={() => {
          setCommentSheetSetId(null);
          // Resume audio for the visible card
          if (visibleSetIdRef.current) {
            handleSetBecameVisible(visibleSetIdRef.current);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0EDE8',
  },
  // ── Ambient background ──
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glassOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  glassOrb1: {
    width: 300,
    height: 300,
    top: -80,
    left: -50,
    backgroundColor: 'rgba(196, 30, 58, 0.15)',
  },
  glassOrb2: {
    width: 250,
    height: 250,
    top: 250,
    right: -80,
    backgroundColor: 'rgba(160, 50, 180, 0.1)',
  },
  glassOrb3: {
    width: 200,
    height: 200,
    bottom: 80,
    left: 10,
    backgroundColor: 'rgba(50, 100, 200, 0.08)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerLogo: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#C41E3A',
    letterSpacing: -0.5,
  },
  muteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },

  // (now playing moved into card)

  // (category styles moved to carouselStyles)

  // ── Feed scroll area ──
  feedScrollWrapper: {
    flex: 1,
    zIndex: 5,
  },
  feedListContent: {
    paddingHorizontal: 10,
  },

  // ── 3D Card ──
  feedCard: {
    borderRadius: 20,
    overflow: 'hidden',
    // Multi-layer shadow for 3D depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  feedCardGlow: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  feedHero: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#0A0A0A',
  },
  feedHeroPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Glass Action Buttons (right column) ──
  feedActionColumn: {
    position: 'absolute',
    right: 10,
    bottom: 90,
    alignItems: 'center',
    gap: 14,
    zIndex: 10,
  },
  glassActionOuter: {
    alignItems: 'center',
    gap: 4,
  },
  glassActionShadow: {
    position: 'absolute',
    top: 3,
    left: 2,
    right: 2,
    bottom: -1,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  glassActionFace: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    // Top highlight
    borderTopColor: 'rgba(255,255,255,0.35)',
  },
  glassActionTint: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glassActionLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Glass Artist Badge (top-left) ──
  feedArtistBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    // 3D lift
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  feedArtistBadgeTint: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  feedArtistBadgeLightEdge: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1,
    zIndex: 2,
  },
  feedArtistBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 7,
  },
  feedBadgeArtistName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
    maxWidth: 140,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  feedBadgeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  feedBadgeTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },

  // (now playing styles moved to npStyles)

  // ── Floating Glass Info Panel (bottom) ──
  feedInfoPanel: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 62, // leave room for action column
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    // 3D lift
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  feedInfoPanelTint: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  feedInfoPanelLightEdge: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    zIndex: 2,
  },
  feedInfoPanelContent: {
    padding: 12,
  },
  feedInfoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  feedInfoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  feedInfoMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  feedInfoMetaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600' as const,
  },

  // ── Floating Track Pills ──
  floatingTracksContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 3,
  },
  floatingTrackPill: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  floatingTrackPillGold: {
    backgroundColor: 'rgba(40, 30, 0, 0.7)',
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  floatingTrackThumb: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  floatingTrackText: {
    flexShrink: 1,
    gap: 1,
  },
  floatingTrackTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: 'rgba(255, 255, 255, 0.92)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  floatingTrackTitleGold: {
    color: 'rgba(255, 215, 0, 0.95)',
  },
  floatingTrackArtist: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  floatingTrackArtistGold: {
    color: 'rgba(255, 215, 0, 0.65)',
  },
  floatingTrackIdBadge: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: 'rgba(255, 215, 0, 0.9)',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },

  // ── Empty / Loading states ──
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFeedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyFeedSubtext: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
  },
  browseButton: {
    marginTop: 16,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loadingFeed: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingFeedText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
  },
});
