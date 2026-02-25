import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, Disc3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDecay,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Colors from '@/constants/colors';
import { SetList } from '@/types';
import { getSavedSets } from '@/utils/storage';
import { getCoverImageUrl } from '@/utils/coverImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Open crate dimensions
const CRATE_HORIZONTAL_PAD = 24;
const CRATE_WIDTH = SCREEN_WIDTH - CRATE_HORIZONTAL_PAD * 2;
const RECORD_WIDTH = 72;
const RECORD_GAP = 6;
const RECORD_STEP = RECORD_WIDTH + RECORD_GAP;
const VISIBLE_HEIGHT = 110;
const CRATE_RIM_HEIGHT = 60;
const CRATE_TOTAL_HEIGHT = VISIBLE_HEIGHT + CRATE_RIM_HEIGHT;

// Closed crate visual
const CLOSED_CRATE_W = 260;
const CLOSED_BODY_H = 140;
const PEEK_H = 65;
const PEEK_W = 42;

// Physics
const DECELERATION = 0.994;

// ─── Record Sleeve (open crate browsing) ───────────────────────
function RecordSleeve({
  set,
  index,
  scrollX,
  onPress,
}: {
  set: SetList;
  index: number;
  scrollX: Animated.SharedValue<number>;
  onPress: () => void;
}) {
  const coverUrl = getCoverImageUrl(set.coverUrl);

  const animStyle = useAnimatedStyle(() => {
    const offset = index * RECORD_STEP;
    const pos = offset + scrollX.value;
    const center = CRATE_WIDTH / 2 - RECORD_WIDTH / 2;
    const distFromCenter = pos - center;
    const normalizedDist = distFromCenter / (CRATE_WIDTH / 2);

    const rotateZ = interpolate(
      normalizedDist,
      [-1.5, 0, 1.5],
      [-3, 0, 3],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      Math.abs(normalizedDist),
      [0, 0.8, 1.5],
      [0, 2, 10],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      Math.abs(normalizedDist),
      [0, 1, 2],
      [1, 0.97, 0.93],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      Math.abs(normalizedDist),
      [0, 1.2, 1.8],
      [1, 0.7, 0.3],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX: pos },
        { translateY },
        { rotateZ: `${rotateZ}deg` },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.recordSleeve, animStyle]}>
      <Pressable style={styles.recordPressable} onPress={onPress}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.recordCover}
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={200}
          />
        ) : (
          <View style={[styles.recordCover, styles.recordCoverFallback]}>
            <Disc3 size={20} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        <View style={styles.recordLabel}>
          <Text style={styles.recordArtist} numberOfLines={1}>{set.artist}</Text>
        </View>
        <View style={styles.recordSheen} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Closed Vinyl Crate Visual ─────────────────────────────────
function ClosedCrateVisual({
  sets,
  floatY,
  onOpen,
}: {
  sets: SetList[];
  floatY: Animated.SharedValue<number>;
  onOpen: () => void;
}) {
  const previewSets = sets.slice(0, 7);
  const total = previewSets.length;

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <View style={closedStyles.wrapper}>
      <Pressable onPress={onOpen}>
        <Animated.View style={[closedStyles.outerCrate, floatStyle]}>
          {/* Glow underneath */}
          <View style={closedStyles.glow} />

          {/* Records peeking out the top */}
          <View style={closedStyles.peekRow}>
            {previewSets.map((set, i) => {
              const coverUrl = getCoverImageUrl(set.coverUrl);
              const centerIdx = (total - 1) / 2;
              const off = i - centerIdx;
              const rotation = off * 2.2;
              const height = PEEK_H - Math.abs(off) * 5;
              const xShift = off * (PEEK_W - 3);

              return (
                <View
                  key={set.id}
                  style={[
                    closedStyles.peekSleeve,
                    {
                      height,
                      transform: [
                        { translateX: xShift },
                        { rotateZ: `${rotation}deg` },
                      ],
                      zIndex: total - Math.abs(Math.round(off)),
                    },
                  ]}
                >
                  {coverUrl ? (
                    <Image
                      source={{ uri: coverUrl }}
                      style={closedStyles.peekCover}
                      transition={200}
                    />
                  ) : (
                    <View style={[closedStyles.peekCover, closedStyles.peekFallback]}>
                      <Disc3 size={11} color="rgba(255,255,255,0.25)" />
                    </View>
                  )}
                  <View style={closedStyles.peekSheen} />
                </View>
              );
            })}
          </View>

          {/* Crate body */}
          <View style={closedStyles.body}>
            {/* Side panels for 3D depth */}
            <View style={closedStyles.sideL} />
            <View style={closedStyles.sideR} />

            {/* Front face with slats */}
            <View style={closedStyles.front}>
              <View style={closedStyles.frontSlats}>
                <View style={closedStyles.slat} />
                <View style={closedStyles.slat} />
                <View style={closedStyles.slat} />
                <View style={closedStyles.slat} />
              </View>
            </View>

            {/* Set count badge */}
            <View style={closedStyles.badge}>
              <Text style={closedStyles.badgeText}>{sets.length}</Text>
            </View>

            {/* Bottom edge */}
            <View style={closedStyles.bottomEdge} />
          </View>
        </Animated.View>
      </Pressable>

      <Text style={closedStyles.hint}>Tap to dig</Text>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────
export default function LibraryScreen() {
  const router = useRouter();
  const [savedSets, setSavedSets] = useState<SetList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crateOpen, setCrateOpen] = useState(false);

  const scrollX = useSharedValue(0);
  const floatY = useSharedValue(0);
  const openAnim = useSharedValue(0);

  // Floating idle animation for closed crate
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const loadSavedSets = useCallback(async () => {
    try {
      const sets = await getSavedSets();
      setSavedSets(sets);
    } catch (error) {
      if (__DEV__) console.error('Error loading saved sets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedSets();
    }, [loadSavedSets])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSavedSets();
  }, [loadSavedSets]);

  const handleSetPress = useCallback((setList: SetList) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/${setList.id}`);
  }, [router]);

  const triggerEdgeHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const handleOpenCrate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCrateOpen(true);
    openAnim.value = 0;
    openAnim.value = withSpring(1, { damping: 18, stiffness: 100, mass: 1 });
  }, []);

  // Fade-in for open crate browser
  const openStyle = useAnimatedStyle(() => ({
    opacity: openAnim.value,
    transform: [
      { translateY: interpolate(openAnim.value, [0, 1], [30, 0], Extrapolation.CLAMP) },
    ],
  }));

  // Scroll bounds
  const contentWidth = savedSets.length * RECORD_STEP;
  const minScroll = Math.min(0, -(contentWidth - CRATE_WIDTH + RECORD_GAP));

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      const clamped = scrollX.value + e.changeX;
      scrollX.value = Math.max(minScroll - 40, Math.min(40, clamped));
    })
    .onEnd((e) => {
      if (scrollX.value > 0) {
        scrollX.value = withSpring(0, { damping: 20, stiffness: 150, mass: 1.2 });
        runOnJS(triggerEdgeHaptic)();
      } else if (scrollX.value < minScroll) {
        scrollX.value = withSpring(minScroll, { damping: 20, stiffness: 150, mass: 1.2 });
        runOnJS(triggerEdgeHaptic)();
      } else {
        scrollX.value = withDecay({
          velocity: e.velocityX,
          deceleration: DECELERATION,
          clamp: [minScroll, 0],
          rubberBandEffect: true,
          rubberBandFactor: 0.6,
        });
      }
    });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.dark.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Your Crate</Text>
            <Text style={styles.subtitle}>{savedSets.length} sets</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
            </View>
          ) : savedSets.length > 0 ? (
            !crateOpen ? (
              /* ─── Closed crate visual ─── */
              <ClosedCrateVisual
                sets={savedSets}
                floatY={floatY}
                onOpen={handleOpenCrate}
              />
            ) : (
              /* ─── Open crate browser ─── */
              <Animated.View style={[styles.crateSection, openStyle]}>
                <View style={styles.crateContainer}>
                  <GestureDetector gesture={panGesture}>
                    <Animated.View style={styles.recordsViewport}>
                      {savedSets.map((set, i) => (
                        <RecordSleeve
                          key={set.id}
                          set={set}
                          index={i}
                          scrollX={scrollX}
                          onPress={() => handleSetPress(set)}
                        />
                      ))}
                    </Animated.View>
                  </GestureDetector>

                  <View style={styles.crateFront}>
                    <View style={styles.crateFrontInner}>
                      <View style={styles.crateSlat} />
                      <View style={styles.crateSlat} />
                      <View style={styles.crateSlat} />
                    </View>
                  </View>
                </View>
                <View style={styles.crateShadow} />
              </Animated.View>
            )
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Bookmark size={40} color={Colors.dark.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No saved sets yet</Text>
              <Text style={styles.emptySubtitle}>
                Save sets from the discover tab to access them quickly here
              </Text>
              <Pressable
                style={styles.discoverButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/(discover)');
                }}
              >
                <Disc3 size={18} color="#F5E6D3" />
                <Text style={styles.discoverButtonText}>Discover Sets</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Closed Crate Styles ───────────────────────────────────────
const closedStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingTop: 50,
  },
  outerCrate: {
    width: CLOSED_CRATE_W,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    bottom: -8,
    width: '70%',
    height: 30,
    alignSelf: 'center',
    borderRadius: 100,
    backgroundColor: 'transparent',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 0,
  },
  peekRow: {
    width: CLOSED_CRATE_W,
    height: PEEK_H,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  peekSleeve: {
    position: 'absolute',
    bottom: 0,
    left: CLOSED_CRATE_W / 2 - PEEK_W / 2,
    width: PEEK_W,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 20, 22, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomColor: 'rgba(0,0,0,0.3)',
  },
  peekCover: {
    width: '100%',
    flex: 1,
  },
  peekFallback: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  body: {
    width: CLOSED_CRATE_W,
    height: CLOSED_BODY_H,
    backgroundColor: 'rgba(18, 18, 22, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderBottomColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
    position: 'relative',
  },
  sideL: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.04)',
  },
  sideR: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.04)',
  },
  front: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  frontSlats: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  slat: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 0.5,
  },
  badge: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    backgroundColor: 'rgba(196, 30, 58, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.35)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(245, 230, 211, 0.7)',
  },
  bottomEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  hint: {
    marginTop: 24,
    fontSize: 14,
    color: 'rgba(245, 230, 211, 0.3)',
    letterSpacing: 0.5,
  },
});

// ─── Open Crate / Main Styles ──────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: CRATE_HORIZONTAL_PAD,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: '#F5E6D3',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(245, 230, 211, 0.5)',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },

  // === Open crate ===
  crateSection: {
    paddingHorizontal: CRATE_HORIZONTAL_PAD,
    marginTop: 8,
  },
  crateContainer: {
    width: CRATE_WIDTH,
    height: CRATE_TOTAL_HEIGHT,
    position: 'relative',
  },
  recordsViewport: {
    width: CRATE_WIDTH,
    height: VISIBLE_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },

  // === Records ===
  recordSleeve: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RECORD_WIDTH,
    height: VISIBLE_HEIGHT,
  },
  recordPressable: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 20, 22, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderBottomColor: 'rgba(0,0,0,0.3)',
  },
  recordCover: {
    width: '100%',
    height: VISIBLE_HEIGHT - 28,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  recordCoverFallback: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordLabel: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  recordArtist: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  recordSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },

  // === Crate front panel ===
  crateFront: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CRATE_RIM_HEIGHT,
    backgroundColor: 'rgba(18, 18, 20, 0.95)',
    borderRadius: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderBottomColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  crateFrontInner: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  crateSlat: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 0.5,
  },

  // === Crate shadow ===
  crateShadow: {
    width: '90%',
    height: 20,
    alignSelf: 'center',
    marginTop: -2,
    borderRadius: 100,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },

  // === Empty state ===
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: '#F5E6D3',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(245, 230, 211, 0.5)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(196, 30, 58, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.3)',
  },
  discoverButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#F5E6D3',
  },
});
