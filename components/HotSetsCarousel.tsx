import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Music, Clock, MapPin } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.52;
const CARD_SPACING = 10;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const AUTO_ADVANCE_INTERVAL = 4500;
const RESUME_DELAY = 5000;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
  'https://rork-dj-set-list-creator.vercel.app';

interface HotSet {
  id: string;
  name: string;
  artist: string;
  artistImageUrl?: string;
  venue?: string;
  coverUrl?: string;
  trackCount?: number;
  totalDuration?: number;
  date: string;
}

interface HotSetsCarouselProps {
  onSetPress?: (setId: string) => void;
  onActiveIndexChange?: (index: number, total: number) => void;
  /** When true, auto-advance uses a slow smooth scroll instead of a fast snap */
  slowAutoAdvance?: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// --- Shimmer Placeholder (reanimated) ---
function ShimmerCard({ index }: { index: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.shimmerCard,
        animatedStyle,
        { marginLeft: index === 0 ? SIDE_PADDING : 0 },
      ]}
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
      <View style={styles.shimmerImageArea} />
      <View style={styles.shimmerTextArea}>
        <View style={styles.shimmerTitle} />
        <View style={styles.shimmerSubtitle} />
      </View>
    </Animated.View>
  );
}

// --- Single Card (reanimated — all interpolations on UI thread) ---
function HotSetCard({
  set,
  index,
  scrollX,
  onPress,
}: {
  set: HotSet;
  index: number;
  scrollX: SharedValue<number>;
  onPress: () => void;
}) {
  const pressAnim = useSharedValue(1);
  const cardCenter = index * SNAP_INTERVAL;

  const inputRange = [
    cardCenter - SNAP_INTERVAL * 2,
    cardCenter - SNAP_INTERVAL,
    cardCenter,
    cardCenter + SNAP_INTERVAL,
    cardCenter + SNAP_INTERVAL * 2,
  ];

  // Alternate directions per card — even cards fly up/left, odd cards fly down/right
  const isEven = index % 2 === 0;
  const yFar = isEven ? -35 : 40;   // even: fly up off-screen side, odd: fly down
  const yNear = isEven ? -12 : 16;
  const rFar = isEven ? -7 : 7;     // tilt direction matches vertical motion
  const rNear = isEven ? -3 : 3;

  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.68, 0.84, 1.0, 0.84, 0.68],
      Extrapolation.CLAMP
    );
    const cardOpacity = interpolate(
      scrollX.value,
      inputRange,
      [0.2, 0.55, 1.0, 0.55, 0.2],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [yFar, yNear, 0, -yNear, -yFar],
      Extrapolation.CLAMP
    );
    const rotateZ = interpolate(
      scrollX.value,
      inputRange,
      [rFar, rNear, 0, -rNear, -rFar],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { scale: scale * pressAnim.value },
        { translateY },
        { rotateZ: `${rotateZ}deg` },
      ],
      opacity: cardOpacity,
    };
  });

  const imageStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-50, -25, 0, 25, 50],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
      left: -50,
      right: -50,
    };
  });

  const handlePressIn = () => {
    pressAnim.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    pressAnim.value = withSpring(1, { damping: 12, stiffness: 150 });
  };

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        cardStyle,
        {
          marginLeft: index === 0 ? SIDE_PADDING : 0,
          marginRight: CARD_SPACING,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardPressable}
      >
        {/* Full-bleed cover image with parallax */}
        <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
          {set.coverUrl ? (
            <Image
              source={{ uri: set.coverUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              transition={300}
            />
          ) : (
            <LinearGradient
              colors={['#E8E0D8', '#D4C8BC', '#C8BEB4']}
              style={StyleSheet.absoluteFill}
            />
          )}
        </Animated.View>

        {/* Top edge highlight — glass sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
          style={styles.topEdge}
        />

        {/* Top badges — light frosted glass pills */}
        <View style={styles.badgeRow}>
          <View style={styles.rankBadgeWrap}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.badgeGlassOverlay} />
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
          {set.trackCount != null && set.trackCount > 0 && (
            <View style={styles.tracksBadgeWrap}>
              <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.badgeGlassOverlay} />
              <Music size={10} color="rgba(0,0,0,0.55)" />
              <Text style={styles.tracksText}>{set.trackCount}</Text>
            </View>
          )}
        </View>

        {/* Bottom frosted glass panel */}
        <View style={styles.glassPanel}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.glassPanelOverlay} />
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glassPanelSheen}
          />

          <View style={styles.glassPanelContent}>
            <Text style={styles.artistLabel} numberOfLines={1}>
              {set.artist.toUpperCase()}
            </Text>
            <Text style={styles.titleLabel} numberOfLines={2}>
              {set.name}
            </Text>
            <View style={styles.metaRow}>
              {set.venue ? (
                <View style={styles.metaPill}>
                  <MapPin size={9} color="rgba(0,0,0,0.4)" />
                  <Text style={styles.metaPillText} numberOfLines={1}>
                    {set.venue}
                  </Text>
                </View>
              ) : null}
              {set.totalDuration != null && set.totalDuration > 0 && (
                <View style={styles.metaPill}>
                  <Clock size={9} color="rgba(0,0,0,0.4)" />
                  <Text style={styles.metaPillText}>
                    {formatDuration(set.totalDuration)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// --- Main Carousel ---
export default function HotSetsCarousel({ onSetPress, onActiveIndexChange, slowAutoAdvance }: HotSetsCarouselProps) {
  const [hotSets, setHotSets] = useState<HotSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndex = useRef(0);

  // Continuous drift state (for slowAutoAdvance mode)
  const driftRaf = useRef<number | null>(null);
  const driftPos = useRef(0);
  const DRIFT_SPEED = 160; // pixels per second — fast glide

  // Fetch hot sets — prefer sets with cover art (YouTube thumbnails etc.)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fetch extra so we can filter to sets with images
        const res = await fetch(`${API_BASE_URL}/api/sets?limit=30&sort=popular`);
        const data = await res.json();
        if (mounted && data.success && data.sets?.length) {
          // Prefer sets with YouTube thumbnails
          const withYtThumbs = (data.sets as HotSet[]).filter(
            (s) => s.coverUrl && s.coverUrl.includes('img.youtube.com'),
          );
          const withCovers = (data.sets as HotSet[]).filter(
            (s) => s.coverUrl && s.coverUrl.length > 0 && !s.coverUrl.includes('img.youtube.com'),
          );
          // YouTube thumbnails first, then other covers, then fall back to all
          const combined = [...withYtThumbs, ...withCovers];
          setHotSets(combined.length >= 4 ? combined.slice(0, 12) : data.sets.slice(0, 10));
        }
      } catch {
        // silent — section hides on empty
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Notify parent of index changes
  useEffect(() => {
    onActiveIndexChange?.(activeIndex, hotSets.length);
  }, [activeIndex, hotSets.length]);

  // --- Continuous drift (slowAutoAdvance mode) ---
  const startDrift = useCallback(() => {
    if (driftRaf.current) cancelAnimationFrame(driftRaf.current);
    let lastTime = Date.now();
    const maxScroll = hotSets.length > 0
      ? (hotSets.length - 1) * SNAP_INTERVAL
      : 0;
    const tick = () => {
      if (isDragging.current) {
        // Paused while dragging — just keep scheduling
        lastTime = Date.now();
        driftRaf.current = requestAnimationFrame(tick);
        return;
      }
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      driftPos.current += DRIFT_SPEED * dt;
      // Wrap around seamlessly
      if (driftPos.current > maxScroll) {
        driftPos.current = 0;
      }
      scrollViewRef.current?.scrollTo({ x: driftPos.current, animated: false });
      // Update active index
      const idx = Math.round(driftPos.current / SNAP_INTERVAL);
      if (idx !== currentIndex.current) {
        currentIndex.current = idx;
        setActiveIndex(idx);
      }
      driftRaf.current = requestAnimationFrame(tick);
    };
    driftRaf.current = requestAnimationFrame(tick);
  }, [hotSets.length]);

  const stopDrift = useCallback(() => {
    if (driftRaf.current) {
      cancelAnimationFrame(driftRaf.current);
      driftRaf.current = null;
    }
  }, []);

  // --- Standard interval auto-advance (non-slow mode) ---
  const startAutoAdvance = useCallback(() => {
    if (autoAdvanceTimer.current) clearInterval(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setInterval(() => {
      if (isDragging.current || hotSets.length === 0) return;
      const nextIndex = (currentIndex.current + 1) % hotSets.length;
      currentIndex.current = nextIndex;
      setActiveIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SNAP_INTERVAL,
        animated: true,
      });
    }, AUTO_ADVANCE_INTERVAL);
  }, [hotSets.length]);

  // Boot whichever mode
  useEffect(() => {
    if (hotSets.length === 0) return;
    if (slowAutoAdvance) {
      startDrift();
    } else {
      startAutoAdvance();
    }
    return () => {
      if (autoAdvanceTimer.current) clearInterval(autoAdvanceTimer.current);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      stopDrift();
    };
  }, [hotSets.length, slowAutoAdvance, startAutoAdvance, startDrift, stopDrift]);

  const handleScrollBeginDrag = () => {
    isDragging.current = true;
    if (!slowAutoAdvance) {
      if (autoAdvanceTimer.current) clearInterval(autoAdvanceTimer.current);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    }
  };

  const handleScrollEndDrag = () => {
    isDragging.current = false;
    if (slowAutoAdvance) {
      // Sync drift position to where user left off
      // (scrollX is updated by the scroll handler on UI thread — read from the snap position)
      const snapIdx = Math.round(scrollX.value / SNAP_INTERVAL);
      driftPos.current = snapIdx * SNAP_INTERVAL;
      currentIndex.current = snapIdx;
      setActiveIndex(snapIdx);
    } else {
      resumeTimer.current = setTimeout(() => {
        startAutoAdvance();
      }, RESUME_DELAY);
    }
  };

  // Reanimated scroll handler — runs on UI thread for 60fps
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / SNAP_INTERVAL);
    currentIndex.current = idx;
    setActiveIndex(idx);
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.section}>
        <LinearGradient
          colors={['rgba(255,255,255,0.01)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.shimmerRow}>
          {[0, 1, 2].map((i) => (
            <ShimmerCard key={i} index={i} />
          ))}
        </View>
      </View>
    );
  }

  // Empty — hide entirely
  if (hotSets.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Glass / mirror background */}
      <LinearGradient
        colors={['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.mirrorLine1} />
      <View style={styles.mirrorLine2} />
      <View style={styles.mirrorLine3} />

      {/* Carousel — reanimated scroll handler for UI-thread interpolations */}
      <Animated.ScrollView
        ref={scrollViewRef as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        contentContainerStyle={{ paddingRight: SIDE_PADDING }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {hotSets.map((set, i) => (
          <HotSetCard
            key={set.id}
            set={set}
            index={i}
            scrollX={scrollX}
            onPress={() => onSetPress?.(set.id)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- Section ---
  section: {
    paddingTop: 6,
    paddingBottom: 14,
    marginBottom: 8,
  },
  mirrorLine1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  mirrorLine2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  mirrorLine3: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // --- Card ---
  cardOuter: {
    width: CARD_WIDTH,
    height: 155,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    borderTopColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  cardPressable: {
    flex: 1,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 2,
  },

  // --- Badges ---
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    zIndex: 2,
  },
  rankBadgeWrap: {
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  tracksBadgeWrap: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  badgeGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  rankText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: '700',
  },
  tracksText: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },

  // --- Glass panel (bottom overlay) ---
  glassPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
  glassPanelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  glassPanelSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  glassPanelContent: {
    padding: 12,
    paddingTop: 10,
  },
  artistLabel: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  titleLabel: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  metaPillText: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 10,
    fontWeight: '500',
    maxWidth: 100,
  },

  // --- Shimmer ---
  shimmerRow: {
    flexDirection: 'row',
    paddingTop: 6,
  },
  shimmerCard: {
    width: CARD_WIDTH,
    height: 155,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: CARD_SPACING,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  shimmerImageArea: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  shimmerTextArea: {
    padding: 12,
    paddingTop: 0,
  },
  shimmerTitle: {
    width: '65%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginBottom: 6,
  },
  shimmerSubtitle: {
    width: '40%',
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
});
