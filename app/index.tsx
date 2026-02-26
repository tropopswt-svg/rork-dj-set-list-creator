import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  SharedValue,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronUp, Heart, MessageCircle, Share2, CheckCircle, SkipForward, Music, Clock } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const API_BASE_URL =
  process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
  'https://rork-dj-set-list-creator.vercel.app';

interface MiniSet {
  id: string;
  name: string;
  artist: string;
  coverUrl?: string;
}

// ─── Filmstrip config ───────────────────────────────────────────────────
const MINI_W = 100;
const MINI_H = 130;
const CARD_GAP = 24;
const ROW_COUNT = 3;
const CARDS_PER_ROW = Math.ceil(SCREEN_WIDTH / (MINI_W + CARD_GAP)) * 3;
const ROW_TOTAL_WIDTH = CARDS_PER_ROW * (MINI_W + CARD_GAP);
const ROW_Y_OFFSETS = [-140, 0, 140];
const ROW_DIRECTIONS = [1, -1, 1];
const TRAVEL_DISTANCE = ROW_TOTAL_WIDTH * 0.7;

// Panel dimensions
const PANEL_WIDTH = (SCREEN_WIDTH - 48) / 2;
const PANEL_HEIGHT = 210;

// ─── Shazam-style S icon (flipped, red) ─────────────────────────────────
function ShazamIcon({ size = 24 }: { size?: number }) {
  return (
    <View style={{ transform: [{ rotate: '180deg' }] }}>
      <Svg width={size} height={size * 1.17} viewBox="0 0 24 28">
        <Path
          d="M 6 2 C 18 2 18 14 12 14"
          stroke="#C41E3A"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 18 26 C 6 26 6 14 12 14"
          stroke="#C41E3A"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

// ─── Mini YouTube icon ──────────────────────────────────────────────────
function YouTubeIcon() {
  return (
    <Svg width={22} height={16} viewBox="0 0 22 16">
      <Path
        d="M 3 1 L 19 1 Q 21 1 21 3 L 21 13 Q 21 15 19 15 L 3 15 Q 1 15 1 13 L 1 3 Q 1 1 3 1 Z"
        fill="#FF0000"
      />
      <Path d="M 9 4.5 L 15.5 8 L 9 11.5 Z" fill="white" />
    </Svg>
  );
}

// ─── Mini SoundCloud icon ───────────────────────────────────────────────
function SoundCloudIcon() {
  return (
    <Svg width={24} height={16} viewBox="0 0 24 16">
      <Path
        d="M 2 14 L 2 9 M 5 14 L 5 7 M 8 14 L 8 5 M 11 14 L 11 4 M 14 14 L 14 3 L 16 2 Q 20 1 22 3 Q 24 5 22 7 L 22 14 Z"
        fill="#FF7700"
        stroke="#FF7700"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── FilmstripCard ──────────────────────────────────────────────────────
function FilmstripCard({ set }: { set?: MiniSet }) {
  return (
    <View style={styles.miniCard}>
      {set?.coverUrl ? (
        <Image
          source={{ uri: set.coverUrl }}
          style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['rgba(60,60,60,0.4)', 'rgba(30,30,30,0.3)']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.miniCardGlass} />
      <View style={styles.miniCardShine} />
      {set && (
        <View style={styles.miniCardLabel}>
          <Text style={styles.miniCardName} numberOfLines={2}>{set.name}</Text>
          <Text style={styles.miniCardArtist} numberOfLines={1}>{set.artist}</Text>
        </View>
      )}
    </View>
  );
}

// ─── ShatterCard (card with individual shatter trajectory) ───────────
function ShatterCard({
  set,
  index,
  rowIndex,
  shatterProgress,
}: {
  set?: MiniSet;
  index: number;
  rowIndex: number;
  shatterProgress: SharedValue<number>;
}) {
  // Deterministic trajectory based on position
  const seed = (index * 7 + rowIndex * 13) % 17;
  const centerOffset = index - CARDS_PER_ROW / 2;
  const flyX = centerOffset * (60 + seed * 12);
  const flyY = ROW_Y_OFFSETS[rowIndex] < 0
    ? -(180 + seed * 25)
    : ROW_Y_OFFSETS[rowIndex] > 0
      ? (180 + seed * 25)
      : (seed % 2 === 0 ? -1 : 1) * (120 + seed * 20);
  const flyRotate = (seed % 2 === 0 ? 1 : -1) * (20 + seed * 4);

  const style = useAnimatedStyle(() => {
    const p = shatterProgress.value;
    return {
      transform: [
        { translateX: p * flyX },
        { translateY: p * flyY },
        { rotate: `${p * flyRotate}deg` },
        { scale: interpolate(p, [0, 0.5, 1], [1, 0.8, 0.3]) },
      ],
      opacity: interpolate(p, [0, 0.6, 1], [1, 0.5, 0]),
    };
  });

  return (
    <Animated.View style={style}>
      <FilmstripCard set={set} />
    </Animated.View>
  );
}

// ─── FilmstripRow ───────────────────────────────────────────────────────
function FilmstripRow({
  rowIndex,
  sets,
  translateX,
  crawl,
  shatterProgress,
}: {
  rowIndex: number;
  sets: MiniSet[];
  translateX: SharedValue<number>;
  crawl: SharedValue<number>;
  shatterProgress: SharedValue<number>;
}) {
  const direction = ROW_DIRECTIONS[rowIndex];
  const yOffset = ROW_Y_OFFSETS[rowIndex];

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * direction + crawl.value * direction }],
  }));

  return (
    <Animated.View
      style={[
        styles.filmstripRow,
        { top: '50%', marginTop: yOffset - MINI_H / 2 },
        style,
      ]}
    >
      {Array.from({ length: CARDS_PER_ROW }, (_, i) => (
        <ShatterCard
          key={i}
          set={sets.length > 0 ? sets[i % sets.length] : undefined}
          index={i}
          rowIndex={rowIndex}
          shatterProgress={shatterProgress}
        />
      ))}
    </Animated.View>
  );
}

// ─── Panel 1: Scroll the Feed (mini TikTok-style with scroll + double-tap) ─
const FEED_CARD_H = PANEL_HEIGHT - 44; // minus footer
const TRACK_NAMES = [
  'Strobe — Deadmau5',
  'ID — ID',
  'Losing It — Fisher',
];

function FeedMiniCardContent({
  set,
  index,
}: {
  set: MiniSet | null;
  index: number;
}) {
  return (
    <View style={[StyleSheet.absoluteFill]}>
      {set?.coverUrl ? (
        <Image
          source={{ uri: set.coverUrl }}
          style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['#1A1A1A', '#111', '#0A0A0A']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent']}
        locations={[0, 0.4]}
        style={[StyleSheet.absoluteFill, { height: '40%' }]}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        locations={[0.3, 1]}
        style={[StyleSheet.absoluteFill, { top: '50%' }]}
      />

      {/* Artist badge */}
      <View style={styles.feedArtistBadge}>
        <View style={styles.feedMiniAvatar} />
        <View>
          <Text style={styles.feedArtistName} numberOfLines={1}>
            {set?.artist || 'DJ Name'}
          </Text>
          <Text style={styles.feedArtistTime}>{index === 0 ? '2h ago' : '5h ago'}</Text>
        </View>
      </View>

      {/* Skip button */}
      <View style={styles.feedSkipWrap}>
        <View style={styles.feedSkipGlow} />
        <View style={styles.feedSkipBtn}>
          <SkipForward size={10} color="rgba(255,255,255,0.9)" />
        </View>
      </View>

      {/* Action column */}
      <View style={styles.feedActionCol}>
        <View style={styles.feedActionBtn}>
          <Heart size={8} color="rgba(255,255,255,0.8)" />
        </View>
        <View style={styles.feedActionBtn}>
          <MessageCircle size={8} color="rgba(255,255,255,0.8)" />
        </View>
        <View style={styles.feedActionBtn}>
          <Share2 size={8} color="rgba(255,255,255,0.8)" />
        </View>
      </View>

      {/* Bottom info */}
      <View style={styles.feedInfoPanel}>
        <Text style={styles.feedSetTitle} numberOfLines={1}>
          {set?.name || 'Set Name'}
        </Text>
        <View style={styles.feedMetaRow}>
          <View style={styles.feedMetaPill}>
            <Music size={6} color="rgba(255,255,255,0.7)" />
            <Text style={styles.feedMetaText}>47 tracks</Text>
          </View>
          <View style={styles.feedMetaPill}>
            <Clock size={6} color="rgba(255,255,255,0.7)" />
            <Text style={styles.feedMetaText}>2h 14m</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FeedDemoPanel({ delay, sets }: { delay: number; sets: MiniSet[] }) {
  const panelOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(30);

  // Track pill drift
  const pill1X = useSharedValue(-40);
  const pill2X = useSharedValue(-20);
  const pill3X = useSharedValue(-35);

  // Scroll between 2 cards
  const cardScrollY = useSharedValue(0);

  // Double-tap heart burst
  const doubleTapScale = useSharedValue(0);
  const doubleTapOpacity = useSharedValue(0);

  const set0 = sets.length > 0 ? sets[0] : null;
  const set1 = sets.length > 1 ? sets[1] : null;

  useEffect(() => {
    panelOpacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    panelTranslateY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 90 }));

    const demoDelay = delay + 500;

    // Track pills drift continuously
    pill1X.value = withDelay(demoDelay, withRepeat(
      withSequence(
        withTiming(PANEL_WIDTH - 55, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-40, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    ));
    pill2X.value = withDelay(demoDelay + 800, withRepeat(
      withSequence(
        withTiming(PANEL_WIDTH - 45, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-20, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    ));
    pill3X.value = withDelay(demoDelay + 1600, withRepeat(
      withSequence(
        withTiming(PANEL_WIDTH - 50, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
        withTiming(-35, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    ));

    // Cycle: show card 1, double-tap heart, scroll to card 2, pause, scroll back
    const runCycle = () => {
      // Reset
      cardScrollY.value = 0;
      doubleTapScale.value = 0;
      doubleTapOpacity.value = 0;

      // 2s: double-tap heart burst on card 1
      doubleTapOpacity.value = withDelay(2000, withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(800, withTiming(0, { duration: 300 })),
      ));
      doubleTapScale.value = withDelay(2000, withSequence(
        withSpring(1, { damping: 6, stiffness: 150 }),
        withDelay(800, withTiming(0, { duration: 300 })),
      ));

      // 3.5s: scroll up to card 2, then 6.5s: scroll back
      cardScrollY.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(3500, withTiming(-FEED_CARD_H, {
          duration: 600,
          easing: Easing.out(Easing.cubic),
        })),
        withDelay(2400, withTiming(0, {
          duration: 600,
          easing: Easing.out(Easing.cubic),
        })),
      );
    };

    const initialTimeout = setTimeout(runCycle, demoDelay);
    const interval = setInterval(runCycle, 9000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateY: panelTranslateY.value }],
  }));

  const pill1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: pill1X.value }],
  }));
  const pill2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: pill2X.value }],
  }));
  const pill3Style = useAnimatedStyle(() => ({
    transform: [{ translateX: pill3X.value }],
  }));

  const cardScrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardScrollY.value }],
  }));

  const doubleTapStyle = useAnimatedStyle(() => ({
    opacity: doubleTapOpacity.value,
    transform: [{ scale: doubleTapScale.value }],
  }));

  return (
    <Animated.View style={[styles.panelCard, panelStyle]}>
      <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.panelOverlay} />
      <LinearGradient
        colors={['rgba(255,255,255,0.3)', 'transparent']}
        style={styles.panelSheen}
      />
      <View style={styles.feedMiniCard}>
        {/* Two cards stacked, scrolling */}
        <Animated.View style={[styles.feedCardStack, cardScrollStyle]}>
          {/* Card 1 */}
          <View style={{ height: FEED_CARD_H, width: '100%' }}>
            <FeedMiniCardContent set={set0} index={0} />

            {/* Track pills with real names — on card 1 */}
            <Animated.View style={[styles.feedTrackPill, { top: '30%' }, pill1Style]}>
              <View style={styles.feedPillThumb} />
              <Text style={styles.feedPillText} numberOfLines={1}>{TRACK_NAMES[0]}</Text>
            </Animated.View>
            <Animated.View style={[styles.feedTrackPill, styles.feedTrackPillGold, { top: '44%' }, pill2Style]}>
              <View style={styles.feedPillThumb} />
              <Text style={[styles.feedPillText, { color: 'rgba(255,215,0,0.95)' }]} numberOfLines={1}>{TRACK_NAMES[1]}</Text>
            </Animated.View>
            <Animated.View style={[styles.feedTrackPill, { top: '56%' }, pill3Style]}>
              <View style={styles.feedPillThumb} />
              <Text style={styles.feedPillText} numberOfLines={1}>{TRACK_NAMES[2]}</Text>
            </Animated.View>

            {/* Double-tap heart burst */}
            <Animated.View style={[styles.feedDoubleTapHeart, doubleTapStyle]}>
              <Heart size={28} color="#EF4444" fill="#EF4444" />
            </Animated.View>
          </View>

          {/* Card 2 */}
          <View style={{ height: FEED_CARD_H, width: '100%' }}>
            <FeedMiniCardContent set={set1} index={1} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.panelFooter}>
        <Text style={styles.panelTitle}>Scroll the Feed</Text>
        <Text style={styles.panelSubtitle}>Swipe through sets. See every track.</Text>
      </View>
    </Animated.View>
  );
}

// ─── Panel 2: Identify Tracks (Shazam S inside ring + unreleased) ───────
function IdentifyDemoPanel({ delay }: { delay: number }) {
  const panelOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(30);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);
  const bar1 = useSharedValue(12);
  const bar2 = useSharedValue(20);
  const bar3 = useSharedValue(8);
  const bar4 = useSharedValue(16);
  const bar5 = useSharedValue(10);
  const resultY = useSharedValue(40);
  const resultOpacity = useSharedValue(0);
  const unreleasedY = useSharedValue(30);
  const unreleasedOpacity = useSharedValue(0);
  const [showUnreleased, setShowUnreleased] = useState(false);

  useEffect(() => {
    panelOpacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    panelTranslateY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 90 }));

    const demoDelay = delay + 500;

    // Ring pulse
    ringScale.value = withDelay(demoDelay, withRepeat(
      withSequence(
        withTiming(1.25, { duration: 1560, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1560, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    ));
    ringOpacity.value = withDelay(demoDelay, withRepeat(
      withSequence(
        withTiming(1, { duration: 1560, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1560, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    ));

    // Waveform bars
    const animateBar = (sv: SharedValue<number>, min: number, max: number, dur: number) => {
      sv.value = withDelay(demoDelay, withRepeat(
        withSequence(
          withTiming(max, { duration: dur, easing: Easing.inOut(Easing.ease) }),
          withTiming(min, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        ), -1, true,
      ));
    };
    animateBar(bar1, 6, 28, 520);
    animateBar(bar2, 8, 32, 715);
    animateBar(bar3, 4, 24, 455);
    animateBar(bar4, 10, 30, 624);
    animateBar(bar5, 5, 26, 546);

    // Alternate between "Identified!" and "Unreleased ID!" every cycle
    let isUnreleased = false;

    const showResult = () => {
      resultOpacity.value = 0;
      resultY.value = 40;
      unreleasedOpacity.value = 0;
      unreleasedY.value = 30;

      if (isUnreleased) {
        setShowUnreleased(true);
        unreleasedOpacity.value = withDelay(3900, withSpring(1, { damping: 12, stiffness: 100 }));
        unreleasedY.value = withDelay(3900, withSpring(0, { damping: 12, stiffness: 100 }));
      } else {
        setShowUnreleased(false);
        resultOpacity.value = withDelay(3900, withSpring(1, { damping: 12, stiffness: 100 }));
        resultY.value = withDelay(3900, withSpring(0, { damping: 12, stiffness: 100 }));
      }
      isUnreleased = !isUnreleased;
    };

    const initialTimeout = setTimeout(showResult, demoDelay);
    const interval = setInterval(showResult, 6500);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateY: panelTranslateY.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const barStyle = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({ height: sv.value }));

  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    transform: [{ translateY: resultY.value }],
  }));

  const unreleasedStyle = useAnimatedStyle(() => ({
    opacity: unreleasedOpacity.value,
    transform: [{ translateY: unreleasedY.value }],
  }));

  return (
    <Animated.View style={[styles.panelCard, panelStyle]}>
      <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.panelOverlay} />
      <LinearGradient
        colors={['rgba(255,255,255,0.3)', 'transparent']}
        style={styles.panelSheen}
      />
      <View style={[styles.panelDemo, { alignItems: 'center' }]}>
        {/* Pulsing ring with Shazam S centered inside */}
        <Animated.View style={[styles.identifyRingWrap, ringStyle]}>
          <View style={styles.identifyRing} />
          <View style={styles.identifyIconCenter}>
            <ShazamIcon size={22} />
          </View>
        </Animated.View>

        {/* Waveform bars */}
        <View style={styles.waveformContainer}>
          {[bar1, bar2, bar3, bar4, bar5].map((bar, i) => (
            <Animated.View key={i} style={[styles.waveformBar, barStyle(bar)]} />
          ))}
        </View>

        {/* Result cards — alternate between identified and unreleased */}
        <Animated.View style={[styles.identifyResult, resultStyle]}>
          <CheckCircle size={11} color="#4CAF50" />
          <Text style={styles.identifyResultText}>Identified!</Text>
        </Animated.View>

        <Animated.View style={[styles.identifyResultGold, unreleasedStyle]}>
          <Text style={styles.identifyGoldLabel}>Unreleased ID</Text>
        </Animated.View>
      </View>
      <View style={styles.panelFooter}>
        <Text style={styles.panelTitle}>Identify Tracks</Text>
        <Text style={styles.panelSubtitle}>Even unreleased & IDs. Instantly.</Text>
      </View>
    </Animated.View>
  );
}

// ─── Panel 3: Import Any Set (logos fly into bar → progress → result) ───
function ImportDemoPanel({ delay }: { delay: number }) {
  const panelOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(30);

  // Logo animations — each value gets ONE withSequence so no overwrites
  const ytX = useSharedValue(-50);
  const ytOpacity = useSharedValue(0);
  const scX = useSharedValue(50);
  const scOpacity = useSharedValue(0);

  // Bar + progress
  const barOpacity = useSharedValue(0);
  const progress = useSharedValue(0);
  const scanOpacity = useSharedValue(0);

  // Result
  const resultOpacity = useSharedValue(0);
  const resultScale = useSharedValue(0.5);

  useEffect(() => {
    panelOpacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    panelTranslateY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 90 }));

    const demoDelay = delay + 500;

    const runCycle = () => {
      // Each shared value gets a single withSequence — no overwrite bugs
      // YouTube: fly in from left → hold → fade out
      ytX.value = withSequence(
        withTiming(-50, { duration: 0 }),
        withSpring(0, { damping: 12, stiffness: 90 }),
        withDelay(800, withTiming(-10, { duration: 400 })),
      );
      ytOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 400 }),
        withDelay(1200, withTiming(0, { duration: 300 })),
      );

      // SoundCloud: fly in from right → hold → fade out (slightly staggered)
      scX.value = withSequence(
        withTiming(50, { duration: 0 }),
        withDelay(250, withSpring(0, { damping: 12, stiffness: 90 })),
        withDelay(600, withTiming(10, { duration: 400 })),
      );
      scOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(250, withTiming(1, { duration: 400 })),
        withDelay(950, withTiming(0, { duration: 300 })),
      );

      // Bar: appear after logos converge
      barOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(1800, withTiming(1, { duration: 400 })),
      );

      // Progress: fill after bar appears
      progress.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(2200, withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })),
      );

      // Scan label
      scanOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(2000, withTiming(1, { duration: 300 })),
        withDelay(3000, withTiming(0, { duration: 200 })),
      );

      // Result pops in after progress completes
      resultOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(5400, withSpring(1, { damping: 10, stiffness: 120 })),
      );
      resultScale.value = withSequence(
        withTiming(0.5, { duration: 0 }),
        withDelay(5400, withSpring(1, { damping: 8, stiffness: 120 })),
      );
    };

    const initialTimeout = setTimeout(runCycle, demoDelay);
    const interval = setInterval(runCycle, 7500);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateY: panelTranslateY.value }],
  }));

  const ytStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ytX.value }],
    opacity: ytOpacity.value,
  }));

  const scStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scX.value }],
    opacity: scOpacity.value,
  }));

  const importBarStyle = useAnimatedStyle(() => ({
    opacity: barOpacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
  }));

  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    transform: [{ scale: resultScale.value }],
  }));

  return (
    <Animated.View style={[styles.panelCard, panelStyle]}>
      <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.panelOverlay} />
      <LinearGradient
        colors={['rgba(255,255,255,0.3)', 'transparent']}
        style={styles.panelSheen}
      />
      <View style={[styles.panelDemo, { alignItems: 'center', justifyContent: 'center' }]}>
        {/* Flying platform logos — large and visible */}
        <View style={styles.importLogosRow}>
          <Animated.View style={[styles.importLogoBadge, ytStyle]}>
            <YouTubeIcon />
            <Text style={styles.importLogoLabel}>YouTube</Text>
          </Animated.View>
          <Animated.View style={[styles.importLogoBadge, scStyle]}>
            <SoundCloudIcon />
            <Text style={styles.importLogoLabel}>SoundCloud</Text>
          </Animated.View>
        </View>

        {/* Import progress bar */}
        <Animated.View style={[styles.importBar, importBarStyle]}>
          <View style={styles.importBarTrack}>
            <Animated.View style={[styles.importBarFill, progressBarStyle]} />
          </View>
        </Animated.View>

        {/* Scanning text */}
        <Animated.Text style={[styles.importScanText, scanStyle]}>
          Scanning tracks...
        </Animated.Text>

        {/* Result pop-in */}
        <Animated.View style={[styles.importResultBadge, resultStyle]}>
          <CheckCircle size={12} color="#4CAF50" />
          <Text style={styles.importResultText}>34 tracks found!</Text>
        </Animated.View>
      </View>
      <View style={styles.panelFooter}>
        <Text style={styles.panelTitle}>Import Any Set</Text>
        <Text style={styles.panelSubtitle}>Paste a link. Get every track.</Text>
      </View>
    </Animated.View>
  );
}

// ─── Panel 4: Build Your Crate (fanned thumbnails sticking out of a crate) ──
const CRATE_THUMB_W = 28;
const CRATE_THUMB_H = 40;
const CRATE_BOX_H = 38;
const NUM_CRATE_CARDS = 7;

function CrateDemoPanel({ delay, sets }: { delay: number; sets: MiniSet[] }) {
  const panelOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(30);

  // Swipe offset — controls which card is centered
  const swipeX = useSharedValue(0);
  const [isManual, setIsManual] = useState(false);

  // Auto-drift demo
  const autoX = useSharedValue(0);

  const crateCards = sets.length >= 5
    ? sets.slice(0, NUM_CRATE_CARDS)
    : Array.from({ length: NUM_CRATE_CARDS }, (_, i) => ({
        id: `c-${i}`,
        name: `Set ${i + 1}`,
        artist: `DJ ${i + 1}`,
        coverUrl: sets[i % Math.max(sets.length, 1)]?.coverUrl,
      }));

  useEffect(() => {
    panelOpacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    panelTranslateY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 90 }));

    // Gentle auto-drift
    const demoDelay = delay + 800;
    autoX.value = withDelay(demoDelay, withRepeat(
      withSequence(
        withTiming(18, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-18, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    ));
  }, [sets]);

  // Pan gesture — weighted feel
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setIsManual)(true);
    })
    .onUpdate((e) => {
      swipeX.value = Math.max(-40, Math.min(40, swipeX.value + e.changeX * 0.6));
    })
    .onEnd((e) => {
      swipeX.value = withSpring(0, {
        damping: 18,
        stiffness: 50,
        mass: 1.8,
        velocity: e.velocityX * 0.2,
      });
    });

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateY: panelTranslateY.value }],
  }));

  // Each card: fanned position + swipe offset shifts them, center card pops up
  const makeCardStyle = (index: number) => {
    const centerI = (NUM_CRATE_CARDS - 1) / 2;
    const baseOffset = (index - centerI);
    const baseRotate = baseOffset * 6; // fan rotation: -18 to +18 deg
    const baseX = baseOffset * 14;     // horizontal spread

    return useAnimatedStyle(() => {
      const offset = isManual ? swipeX.value : autoX.value;
      // Shift effective position with swipe
      const effectiveOffset = baseOffset - offset / 20;
      const dist = Math.abs(effectiveOffset);
      const closeness = Math.max(0, 1 - dist / (centerI + 1));

      // Selected card rises higher, scales up
      const liftY = interpolate(closeness, [0, 1], [0, -8]);
      const scale = interpolate(closeness, [0, 1], [0.88, 1.1]);
      const rotate = baseRotate + offset * 0.15;

      return {
        transform: [
          { translateX: baseX + offset * 0.6 },
          { translateY: liftY },
          { rotate: `${rotate}deg` },
          { scale },
        ],
        zIndex: Math.round(closeness * 10),
        opacity: interpolate(closeness, [0, 0.4, 1], [0.55, 0.8, 1]),
      };
    });
  };

  return (
    <Animated.View style={[styles.panelCard, panelStyle]}>
      <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.panelOverlay} />
      <LinearGradient
        colors={['rgba(255,255,255,0.3)', 'transparent']}
        style={styles.panelSheen}
      />
      <View style={[styles.panelDemo, { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 0 }]}>
        {/* Thumbnails fanned out, sticking up above crate */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.crateFanWrap}>
            {crateCards.map((set, i) => (
              <CrateFanCard key={set.id} set={set} index={i} style={makeCardStyle(i)} />
            ))}
          </View>
        </GestureDetector>

        {/* The crate box (sits below, overlapping thumbnails) */}
        <View style={styles.crateBox}>
          <LinearGradient
            colors={['#5C3D2E', '#4A3020', '#3A2418']}
            style={StyleSheet.absoluteFill}
          />
          {/* Wood grain lines */}
          {[0.2, 0.4, 0.6, 0.8].map((pos, i) => (
            <View key={i} style={[styles.crateGrain, { top: `${pos * 100}%` }]} />
          ))}
          {/* Count badge */}
          <View style={styles.crateBadge}>
            <Text style={styles.crateBadgeText}>{crateCards.length}</Text>
          </View>
        </View>
      </View>
      <View style={styles.panelFooter}>
        <Text style={styles.panelTitle}>Build Your Crate</Text>
        <Text style={styles.panelSubtitle}>Save. Collect. Share.</Text>
      </View>
    </Animated.View>
  );
}

function CrateFanCard({
  set,
  index,
  style,
}: {
  set: MiniSet;
  index: number;
  style: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <Animated.View style={[styles.crateFanCard, style]}>
      {set.coverUrl ? (
        <Image
          source={{ uri: set.coverUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['rgba(100,60,60,0.7)', 'rgba(60,40,40,0.6)']}
          style={StyleSheet.absoluteFill}
        />
      )}
    </Animated.View>
  );
}

// ─── Landing Screen ─────────────────────────────────────────────────────
export default function LandingScreen() {
  const router = useRouter();
  const [rowSets, setRowSets] = useState<MiniSet[][]>([[], [], []]);
  const [introComplete, setIntroComplete] = useState(false);

  // Fetch sets for the filmstrip
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sets?limit=50&sort=popular`);
        const data = await res.json();
        if (data.success && data.sets?.length) {
          const all: MiniSet[] = data.sets.map((s: any) => ({
            id: s.id,
            name: s.name,
            artist: s.artist,
            coverUrl: s.coverUrl,
          }));
          const shuffle = (arr: MiniSet[]) => {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
          };
          setRowSets([shuffle(all), shuffle(all), shuffle(all)]);
        }
      } catch {
        // silent
      }
    })();
  }, []);

  // Logo path — swoops around screen then up through filmstrip
  const logoX = useSharedValue(SCREEN_WIDTH * 0.5);   // start off-screen right
  const logoY = useSharedValue(SCREEN_HEIGHT * 0.4);   // start below
  const logoScale = useSharedValue(0.3);               // start small (far away)
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(15);               // slight tilt during flight

  // Filmstrip — runs continuously, fast
  const filmstripTranslateX = useSharedValue(-TRAVEL_DISTANCE);
  const filmstripCrawl = useSharedValue(0);

  // Shatter
  const shatterProgress = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  // Animation area height
  const animationAreaHeight = useSharedValue(SCREEN_HEIGHT * 0.48);

  // Header
  const headerOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);

  // Button
  const bottomSlide = useSharedValue(120);
  const bottomOpacity = useSharedValue(0);
  const chevronY = useSharedValue(0);

  useEffect(() => {
    // ─── 1. Filmstrip: constant fast scroll, never slows down ───
    filmstripTranslateX.value = withRepeat(
      withSequence(
        withTiming(-TRAVEL_DISTANCE, { duration: 0 }),
        withTiming(0, { duration: 4000, easing: Easing.linear }),
      ), -1,
    );

    // ─── 2. Logo swoops around screen then up through filmstrip ───
    // Starts tiny and far away (bottom-right), drifts in slowly, arcs around,
    // then accelerates upward through the filmstrip center
    //
    // Phase A (800-2200ms): appear far away bottom-right, slowly drift to bottom-left
    // Phase B (2200-3000ms): arc smoothly up the left side
    // Phase C (3000-3500ms): accelerate up through center of filmstrip (IMPACT)
    // Phase D (3500-4200ms): continue up to header, settle

    // X path: far right → drift left → arc center-left → center → hold
    logoX.value = withSequence(
      withTiming(SCREEN_WIDTH * 0.6, { duration: 0 }),
      withDelay(800, withTiming(-SCREEN_WIDTH * 0.3, { duration: 1400, easing: Easing.inOut(Easing.ease) })),
      withTiming(-SCREEN_WIDTH * 0.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 800 }),
    );

    // Y path: far below → drift up slightly → arc to center → shoot UP → header
    logoY.value = withSequence(
      withTiming(SCREEN_HEIGHT * 0.5, { duration: 0 }),
      withDelay(800, withTiming(SCREEN_HEIGHT * 0.25, { duration: 1400, easing: Easing.inOut(Easing.ease) })),
      withTiming(SCREEN_HEIGHT * 0.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      withTiming(-(SCREEN_HEIGHT * 0.06), { duration: 500, easing: Easing.in(Easing.quad) }),
      withSpring(-(SCREEN_HEIGHT * 0.18), { damping: 18, stiffness: 60 }),
    );

    // Scale: tiny (far away) → slowly growing → full at impact → settle to header
    logoScale.value = withSequence(
      withTiming(0.12, { duration: 0 }),
      withDelay(800, withTiming(0.35, { duration: 1400, easing: Easing.inOut(Easing.ease) })),
      withTiming(0.65, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      withTiming(1.15, { duration: 500, easing: Easing.in(Easing.quad) }),
      withTiming(1.0, { duration: 300, easing: Easing.out(Easing.ease) }),
      withSpring(0.7, { damping: 18, stiffness: 60 }),
    );

    // Rotation: gentle tilt during flight → gradually straighten
    logoRotate.value = withSequence(
      withTiming(10, { duration: 0 }),
      withDelay(800, withTiming(-5, { duration: 1400, easing: Easing.inOut(Easing.ease) })),
      withTiming(-2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
    );

    // Opacity: very gradual fade in — tiny dot first, fully visible by impact
    logoOpacity.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(800, withTiming(0.25, { duration: 700 })),
      withTiming(0.55, { duration: 700 }),
      withTiming(0.85, { duration: 800 }),
      withTiming(1, { duration: 300 }),
    );

    // ─── 3. IMPACT at ~3200ms — shatter + flash ───
    // Logo passes through center of filmstrip heading upward
    shatterProgress.value = withDelay(3150,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    flashOpacity.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(3100, withTiming(0.85, { duration: 80 })),
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }),
    );

    // ─── 4. Animation area collapses after shatter clears ───
    animationAreaHeight.value = withDelay(3800,
      withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) }));

    // ─── 5. Header/tagline appears ───
    headerOpacity.value = withDelay(3800, withTiming(1, { duration: 600 }));
    taglineOpacity.value = withDelay(4100, withTiming(1, { duration: 500 }));

    // ─── 6. Panels stagger in ───
    // Panel delays passed as props: 4300, 4500, 4700, 4900

    // ─── 7. Button slides up at 5400ms ───
    bottomOpacity.value = withDelay(5400, withTiming(1, { duration: 300 }));
    bottomSlide.value = withDelay(5400,
      withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }),
    );

    // ─── 8. Chevron bounce at 5900ms ───
    chevronY.value = withDelay(5900, withRepeat(
      withSequence(
        withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    ));

    // Enable scrolling after intro
    setTimeout(() => setIntroComplete(true), 5700);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateX: logoX.value },
      { translateY: logoY.value },
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const animationAreaStyle = useAnimatedStyle(() => ({
    height: animationAreaHeight.value,
    overflow: 'hidden' as const,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const bottomStyle = useAnimatedStyle(() => ({
    opacity: bottomOpacity.value,
    transform: [{ translateY: bottomSlide.value }],
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chevronY.value }],
  }));

  const navigateToDiscover = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(tabs)/(feed)');
  };

  const swipeUp = Gesture.Pan().onEnd((event) => {
    if (event.velocityY < -500) {
      runOnJS(navigateToDiscover)();
    }
  });

  return (
    <GestureDetector gesture={swipeUp}>
      <View style={styles.container}>
        {/* Glass background */}
        <View style={styles.glassBackground} pointerEvents="none">
          <View style={[styles.glassOrb, styles.glassOrb1]} />
          <View style={[styles.glassOrb, styles.glassOrb2]} />
          <View style={[styles.glassOrb, styles.glassOrb3]} />
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        </View>

        <ScrollView
          bounces
          scrollEnabled={introComplete}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <SafeAreaView edges={['top']}>
            {/* Animation area: filmstrip + logo flying in + shatter */}
            <Animated.View style={[styles.animationArea, animationAreaStyle]}>
              <View style={styles.filmstripContainer} pointerEvents="none">
                {Array.from({ length: ROW_COUNT }, (_, i) => (
                  <FilmstripRow
                    key={i}
                    rowIndex={i}
                    sets={rowSets[i]}
                    translateX={filmstripTranslateX}
                    crawl={filmstripCrawl}
                    shatterProgress={shatterProgress}
                  />
                ))}
              </View>

              {/* Impact flash */}
              <Animated.View style={[styles.impactFlash, flashStyle]} pointerEvents="none" />

              {/* Logo flies in from behind, through the filmstrip */}
              <Animated.Text style={[styles.logo, styles.logoOverFilmstrip, logoStyle]}>
                trakd
              </Animated.Text>
            </Animated.View>

            {/* Header (logo's final position) */}
            <Animated.View style={[styles.headerWrap, headerStyle]}>
              <Text style={styles.headerLogo}>trakd</Text>
              <Animated.Text style={[styles.tagline, taglineStyle]}>
                Every track. Every set.
              </Animated.Text>
            </Animated.View>

            {/* 2x2 Marketing Panels Grid */}
            <View style={styles.panelsGrid}>
              <FeedDemoPanel delay={4300} sets={rowSets[0]} />
              <IdentifyDemoPanel delay={4500} />
              <ImportDemoPanel delay={4700} />
              <CrateDemoPanel delay={4900} sets={rowSets[2]} />
            </View>

            {/* CTA */}
            <Animated.View style={[styles.buttonArea, bottomStyle]}>
              <Pressable style={styles.exploreButton} onPress={navigateToDiscover}>
                <Text style={styles.exploreButtonText}>Explore Sets</Text>
              </Pressable>

              <Animated.View style={[styles.swipeHint, chevronStyle]}>
                <ChevronUp size={24} color="rgba(0,0,0,0.3)" />
              </Animated.View>
              <Text style={styles.swipeHintText}>swipe up to explore</Text>
            </Animated.View>
          </SafeAreaView>
        </ScrollView>
      </View>
    </GestureDetector>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0EDE8',
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glassOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  glassOrb1: {
    width: 350,
    height: 350,
    top: -100,
    left: -70,
    backgroundColor: 'rgba(196, 30, 58, 0.18)',
  },
  glassOrb2: {
    width: 300,
    height: 300,
    top: 200,
    right: -100,
    backgroundColor: 'rgba(160, 50, 180, 0.12)',
  },
  glassOrb3: {
    width: 250,
    height: 250,
    bottom: 60,
    left: -20,
    backgroundColor: 'rgba(50, 100, 200, 0.1)',
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 52,
    fontWeight: '900',
    color: '#C41E3A',
    letterSpacing: -2,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(196, 30, 58, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  logoOverFilmstrip: {
    zIndex: 10,
    alignSelf: 'center',
  },
  animationArea: {
    width: '100%',
    justifyContent: 'center',
  },
  filmstripContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  filmstripRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: CARD_GAP,
    left: -(ROW_TOTAL_WIDTH - SCREEN_WIDTH) / 2,
  },
  impactFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 5,
  },
  miniCard: {
    width: MINI_W,
    height: MINI_H,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    borderTopColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  miniCardGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  miniCardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  miniCardLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingBottom: 6,
    paddingTop: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  miniCardName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 12,
  },
  miniCardArtist: {
    fontSize: 8,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // ─── Header ──────────────────────────────────────────────────────────
  headerWrap: {
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  headerLogo: {
    fontSize: 36,
    fontWeight: '900',
    color: '#C41E3A',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(196, 30, 58, 0.3)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 1,
    marginTop: 4,
    fontWeight: '500',
  },

  // ─── Panels Grid ─────────────────────────────────────────────────────
  panelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
    justifyContent: 'center',
    marginBottom: 24,
  },
  panelCard: {
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderTopColor: 'rgba(255,255,255,0.65)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  panelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  panelSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 1,
  },
  panelDemo: {
    flex: 1,
    padding: 12,
    overflow: 'hidden',
  },
  panelFooter: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.7)',
  },
  panelSubtitle: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.4)',
    marginTop: 2,
  },

  // ─── Panel 1: Feed Demo (mini TikTok card) ────────────────────────────
  feedMiniCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
    margin: 6,
    position: 'relative',
  },
  feedCardStack: {
    width: '100%',
  },
  feedDoubleTapHeart: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    zIndex: 20,
  },
  feedArtistBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 5,
  },
  feedMiniAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  feedArtistName: {
    fontSize: 6,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    maxWidth: 50,
  },
  feedArtistTime: {
    fontSize: 5,
    color: 'rgba(255,255,255,0.5)',
  },
  feedTrackPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 4,
  },
  feedTrackPillGold: {
    borderWidth: 0.5,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  feedPillThumb: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  feedPillText: {
    fontSize: 5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    maxWidth: 40,
  },
  feedSkipWrap: {
    position: 'absolute',
    top: '58%',
    alignSelf: 'center',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  feedSkipGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    opacity: 0.5,
  },
  feedSkipBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedActionCol: {
    position: 'absolute',
    right: 5,
    bottom: 30,
    gap: 6,
    zIndex: 5,
  },
  feedActionBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedInfoPanel: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 28,
    zIndex: 5,
  },
  feedSetTitle: {
    fontSize: 7,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  feedMetaRow: {
    flexDirection: 'row',
    gap: 4,
  },
  feedMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  feedMetaText: {
    fontSize: 5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },

  // ─── Panel 2: Identify Demo ──────────────────────────────────────────
  identifyRingWrap: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  identifyRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: '#C41E3A',
  },
  identifyIconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 28,
    marginBottom: 6,
  },
  waveformBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(196,30,58,0.5)',
  },
  identifyResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  identifyResultText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
  },
  identifyResultGold: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  identifyGoldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,185,0,1)',
    letterSpacing: 0.3,
  },

  // ─── Panel 3: Import Demo ────────────────────────────────────────────
  importLogosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
    height: 32,
  },
  importLogoBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    padding: 6,
  },
  importLogoLabel: {
    fontSize: 6,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.45)',
    marginTop: 3,
  },
  importBar: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 6,
  },
  importBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  importBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#C41E3A',
  },
  importScanText: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.35)',
    marginBottom: 4,
  },
  importResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  importResultText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
  },

  // ─── Panel 4: Crate Demo ─────────────────────────────────────────────
  crateFanWrap: {
    width: '100%',
    height: CRATE_THUMB_H + 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
    marginBottom: -12, // thumbnails overlap into the crate
  },
  crateFanCard: {
    position: 'absolute',
    width: CRATE_THUMB_W,
    height: CRATE_THUMB_H,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: '#2A1F1A',
  },
  crateBox: {
    width: '90%',
    height: CRATE_BOX_H,
    borderRadius: 6,
    overflow: 'hidden',
    zIndex: 3,
    borderWidth: 1,
    borderColor: 'rgba(80,55,35,0.5)',
  },
  crateGrain: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  crateBadge: {
    position: 'absolute',
    bottom: 5,
    right: 6,
    backgroundColor: 'rgba(196,30,58,0.7)',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crateBadgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#fff',
  },

  // ─── Button Area ──────────────────────────────────────────────────────
  buttonArea: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  exploreButton: {
    backgroundColor: '#C41E3A',
    paddingVertical: 20,
    paddingHorizontal: 64,
    borderRadius: 34,
    marginBottom: 16,
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  exploreButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
  },
  swipeHint: {
    alignItems: 'center',
    marginBottom: 2,
  },
  swipeHintText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.25)',
    marginBottom: 4,
  },
});
