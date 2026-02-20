import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, Animated, Dimensions, Easing, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform, Share } from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Music, Heart, MessageCircle, Share2, MapPin, Headphones, Clock, Send, Reply, Trash2, X, Volume2, VolumeX } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useSets } from '@/contexts/SetsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowing, useLikeSet, useComments } from '@/hooks/useSocial';
import { getArtistSets } from '@/lib/supabase/artistService';
import ArtistAvatar from '@/components/ArtistAvatar';
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

  // Distribute lanes vertically — avoid top badge area (top 12%) and bottom panel (bottom 28%)
  const usableTop = cardHeight * 0.14;
  const usableHeight = cardHeight * 0.55;
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

// ── Feed Card ───────────────────────────────────────────────────────────
// Immersive TikTok-style card with frosted glass overlays and 3D depth
function FeedCard({ item, onPress, cardHeight, onOpenComments, onTracksLoaded }: { item: any; onPress: () => void; cardHeight: number; onOpenComments: (setId: string) => void; onTracksLoaded?: (setId: string, tracks: any[]) => void }) {
  const { user } = useAuth();
  const { isLiked, likeCount, isLoading: likeLoading, toggleLike } = useLikeSet(item.set.id);
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

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

      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ flex: 1 }}>
        <View style={[styles.feedHero, { height: cardHeight }]}>
          {/* Cover fallback: cover → artist image → dark gradient */}
          {(item.set.image || item.artist.image) ? (
            <Image
              source={{ uri: item.set.image || item.artist.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : (
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

export default function FeedScreen() {
  const router = useRouter();
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

  // ── Audio Preview State ──
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentPlayingRef = useRef<string | null>(null);
  const visibleSetIdRef = useRef<string | null>(null);
  const tracksCacheRef = useRef<Map<string, any[]>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [nowPlaying, setNowPlaying] = useState<{ title: string; artist: string } | null>(null);

  // Configure audio session
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // Sync muted state to ref and active sound
  useEffect(() => {
    isMutedRef.current = isMuted;
    soundRef.current?.setVolumeAsync(isMuted ? 0 : 0.7).catch(() => {});
  }, [isMuted]);

  // Play an audio preview for a set's tracks
  // Priority: Spotify preview → Deezer preview (free, no auth, reliable)
  const playPreviewFromTracks = useCallback(async (setId: string, tracks: any[]) => {
    if (currentPlayingRef.current === setId) return;

    // Stop current playback
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }

    currentPlayingRef.current = setId;

    // 1. Try Spotify preview first
    const spotifyTrack = (tracks || []).find((t: any) => t.previewUrl);
    if (spotifyTrack) {
      if (__DEV__) console.log(`[Feed Audio] Spotify preview: ${spotifyTrack.title}`);
      const played = await tryPlayUrl(setId, spotifyTrack.previewUrl, spotifyTrack.title, spotifyTrack.artist);
      if (played) return;
    }

    // 2. Fallback: search Deezer for a preview (free API, 30s MP3 previews)
    const candidates = (tracks || []).filter((t: any) => !t.isId && t.title && t.title !== 'Unknown' && t.title !== 'ID');
    for (const track of candidates.slice(0, 3)) {
      if (currentPlayingRef.current !== setId) return; // user scrolled away
      try {
        const q = encodeURIComponent(`artist:"${track.artist}" track:"${track.title}"`);
        const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`);
        const data = await res.json();
        const preview = data?.data?.[0]?.preview;
        if (preview) {
          if (__DEV__) console.log(`[Feed Audio] Deezer preview: ${track.title}`);
          const played = await tryPlayUrl(setId, preview, track.title, track.artist);
          if (played) return;
        }
      } catch {}
    }

    // No preview available
    if (__DEV__) console.log(`[Feed Audio] No preview found for set ${setId}`);
    setNowPlaying(null);
  }, []);

  // Helper: attempt to play a URL, returns true on success
  const tryPlayUrl = useCallback(async (setId: string, url: string, title: string, artist: string): Promise<boolean> => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, isLooping: true, volume: isMutedRef.current ? 0 : 0.7 }
      );
      // Stale check: user may have scrolled during load
      if (currentPlayingRef.current !== setId) {
        await sound.unloadAsync();
        return false;
      }
      soundRef.current = sound;
      setNowPlaying({ title, artist });
      return true;
    } catch (err) {
      if (__DEV__) console.log('[Feed Audio] Playback error:', err);
      return false;
    }
  }, []);

  // Called by FeedCard when track data loads
  const handleTracksLoaded = useCallback((setId: string, tracks: any[]) => {
    tracksCacheRef.current.set(setId, tracks);
    // If this is the currently visible card, start playing
    if (visibleSetIdRef.current === setId) {
      playPreviewFromTracks(setId, tracks);
    }
  }, [playPreviewFromTracks]);

  // Called when a card scrolls into center position
  const handleSetBecameVisible = useCallback(async (setId: string) => {
    visibleSetIdRef.current = setId;

    // Try cached tracks first
    const cached = tracksCacheRef.current.get(setId);
    if (cached) {
      playPreviewFromTracks(setId, cached);
      return;
    }

    // Not cached yet — fetch independently (don't rely on FeedCard's tracksIdentified check)
    try {
      const res = await fetch(`${FEED_API_BASE_URL}/api/sets/${setId}`);
      const data = await res.json();
      if (data.success && data.set?.tracks?.length > 0) {
        tracksCacheRef.current.set(setId, data.set.tracks);
        // Check we're still viewing this card
        if (visibleSetIdRef.current === setId) {
          playPreviewFromTracks(setId, data.set.tracks);
        }
        // Trigger Spotify enrichment in background if needed
        if (data.needsEnrichment) {
          fetch(`${FEED_API_BASE_URL}/api/spotify-enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'enrich-set', setId }),
          }).catch(() => {});
        }
      } else if (__DEV__) {
        console.log(`[Feed Audio] No tracks found for set ${setId}`);
      }
    } catch (err) {
      if (__DEV__) console.log('[Feed Audio] Track fetch error:', err);
    }
  }, [playPreviewFromTracks]);

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
    // Reset audio — new data will trigger playback for the first card
    soundRef.current?.stopAsync().catch(() => {});
    soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    currentPlayingRef.current = null;
    visibleSetIdRef.current = null;
    setNowPlaying(null);
  };

  const loadFollowedArtistSets = async () => {
    setLoadingSets(true);
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
    setLoadingSets(false);
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

  // Heights for layout calculations
  const HEADER_HEIGHT = 38;
  const CATEGORY_BAR_HEIGHT = 44;
  const TAB_BAR_HEIGHT = 80;

  const fullFeedHeight = feedAreaHeight > 0
    ? feedAreaHeight
    : SCREEN_HEIGHT - insets.top - HEADER_HEIGHT - CATEGORY_BAR_HEIGHT - TAB_BAR_HEIGHT;
  const CARD_GAP = 10;
  const cardPageHeight = fullFeedHeight - CARD_GAP - 16; // slightly shorter cards

  // ── Audio: detect visible card from paging scroll ──
  const handleMomentumScrollEnd = useCallback((e: any) => {
    if (fullFeedHeight <= 0) return;
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / fullFeedHeight);
    if (index >= 0 && index < realFeedItems.length) {
      handleSetBecameVisible(realFeedItems[index].set.id);
    }
  }, [fullFeedHeight, realFeedItems, handleSetBecameVisible]);

  // Auto-play first card when feed data loads
  useEffect(() => {
    if (realFeedItems.length > 0 && !visibleSetIdRef.current) {
      handleSetBecameVisible(realFeedItems[0].set.id);
    }
  }, [realFeedItems.length, handleSetBecameVisible]);

  const renderFeedCard = useCallback(({ item }: { item: any }) => (
    <View style={{ height: fullFeedHeight, justifyContent: 'center', paddingVertical: CARD_GAP / 2 }}>
      <FeedCard
        item={item}
        cardHeight={cardPageHeight}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Stop audio when navigating to set detail
          soundRef.current?.stopAsync().catch(() => {});
          soundRef.current?.unloadAsync().catch(() => {});
          soundRef.current = null;
          currentPlayingRef.current = null;
          setNowPlaying(null);
          router.push(`/(tabs)/(discover)/${item.set.id}`);
        }}
        onOpenComments={(setId) => setCommentSheetSetId(setId)}
        onTracksLoaded={handleTracksLoaded}
      />
    </View>
  ), [cardPageHeight, fullFeedHeight, router, handleTracksLoaded]);

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

        {/* ── Category tab bar ── */}
        <View style={styles.categoryBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {FEED_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => handleCategoryChange(cat.key)}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                >
                  {isActive && (
                    <>
                      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                      <View style={[StyleSheet.absoluteFill, styles.categoryTabActiveTint]} />
                    </>
                  )}
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <LinearGradient
            colors={['#F0EDE8', 'rgba(240,237,232,0)']}
            style={styles.categoryFade}
            pointerEvents="none"
          />
        </View>

        {/* Now playing indicator */}
        {nowPlaying && !isMuted && (
          <View style={styles.nowPlayingBar}>
            <Music size={10} color="#C41E3A" />
            <Text style={styles.nowPlayingText} numberOfLines={1}>
              {nowPlaying.title} — {nowPlaying.artist}
            </Text>
          </View>
        )}

        {/* TikTok-style paging feed */}
        <View
          style={styles.feedScrollWrapper}
          onLayout={(e) => setFeedAreaHeight(e.nativeEvent.layout.height)}
        >
          {loadingSets ? (
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
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.feedListContent}
              onMomentumScrollEnd={handleMomentumScrollEnd}
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
                  router.push('/(tabs)/(discover)');
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
        onClose={() => setCommentSheetSetId(null)}
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

  // ── Now Playing bar ──
  nowPlayingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: 'rgba(196, 30, 58, 0.06)',
  },
  nowPlayingText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(0,0,0,0.45)',
    letterSpacing: -0.2,
  },

  // ── Category tab bar ──
  categoryBar: {
    paddingTop: 2,
    paddingBottom: 4,
    zIndex: 10,
    backgroundColor: '#F0EDE8',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  categoryTabActive: {
    borderColor: 'rgba(196, 30, 58, 0.2)',
    shadowColor: 'rgba(196, 30, 58, 0.25)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryTabActiveTint: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(0, 0, 0, 0.35)',
    letterSpacing: -0.2,
  },
  categoryTabTextActive: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#C41E3A',
    letterSpacing: -0.3,
  },
  categoryFade: {
    position: 'absolute',
    bottom: -16,
    left: 0,
    right: 0,
    height: 16,
    zIndex: 10,
  },

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
