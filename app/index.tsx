import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
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
import { ChevronUp } from 'lucide-react-native';
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

// ─── Flying mini-card config ────────────────────────────────────────────
const FLYING_COUNT = 5;
const CIRCLE_RADIUS = 120;
const MINI_W = 100;
const MINI_H = 130;

// Each card flies in from a different edge
const FLYING_CONFIGS = Array.from({ length: FLYING_COUNT }, (_, i) => {
  const side = i % 4;
  const spread = (Math.random() - 0.5) * SCREEN_WIDTH * 0.5;
  let startX: number, startY: number;
  switch (side) {
    case 0: startX = spread; startY = -SCREEN_HEIGHT * 0.55; break;
    case 1: startX = SCREEN_WIDTH * 0.65; startY = spread; break;
    case 2: startX = spread; startY = SCREEN_HEIGHT * 0.55; break;
    default: startX = -SCREEN_WIDTH * 0.65; startY = spread; break;
  }
  const slotAngle = (i / FLYING_COUNT) * 2 * Math.PI;
  return { startX, startY, slotAngle };
});

function FlyingMiniCard({
  index,
  set,
  arrivalProg,
  spinAngle,
  fadeProg,
}: {
  index: number;
  set?: MiniSet;
  arrivalProg: SharedValue<number>;
  spinAngle: SharedValue<number>;
  fadeProg: SharedValue<number>;
}) {
  const { startX, startY, slotAngle } = FLYING_CONFIGS[index];

  const style = useAnimatedStyle(() => {
    const angle = slotAngle + spinAngle.value;
    const cx = Math.cos(angle) * CIRCLE_RADIUS;
    const cy = Math.sin(angle) * CIRCLE_RADIUS;

    // Fly from off-screen to circle slot
    const x = startX + (cx - startX) * arrivalProg.value;
    const y = startY + (cy - startY) * arrivalProg.value;

    const spinRot = (angle * 180) / Math.PI * 0.15;
    const scale = interpolate(arrivalProg.value, [0, 1], [0.2, 1]);
    const opacity = Math.min(arrivalProg.value, 1 - fadeProg.value);

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${spinRot}deg` },
        { scale },
      ],
      opacity: Math.max(0, opacity),
    };
  });

  return (
    <Animated.View style={[styles.miniCard, style]}>
      {set?.coverUrl ? (
        <Image
          source={{ uri: set.coverUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['#2A2A2A', '#1A1A1A']}
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
    </Animated.View>
  );
}

// ─── Landing Screen ─────────────────────────────────────────────────────
export default function LandingScreen() {
  const router = useRouter();
  const [miniSets, setMiniSets] = useState<MiniSet[]>([]);

  // Fetch sets for the flying cards
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sets?limit=30&sort=popular`);
        const data = await res.json();
        if (data.success && data.sets?.length) {
          const withYtThumbs = data.sets.filter(
            (s: any) => s.coverUrl && s.coverUrl.includes('img.youtube.com'),
          );
          const source = withYtThumbs.length >= FLYING_COUNT
            ? withYtThumbs.slice(0, FLYING_COUNT)
            : withYtThumbs.concat(
                data.sets.filter((s: any) => s.coverUrl && !s.coverUrl.includes('img.youtube.com')),
              ).slice(0, FLYING_COUNT);
          setMiniSets(
            source.map((s: any) => ({
              id: s.id,
              name: s.name,
              artist: s.artist,
              coverUrl: s.coverUrl,
            })),
          );
        }
      } catch {
        // silent
      }
    })();
  }, []);

  // Logo
  const logoScale = useSharedValue(0);
  const logoTranslateY = useSharedValue(-60);
  const logoRotate = useSharedValue(-15);
  const logoOpacity = useSharedValue(0);

  // "hot sets" label
  const hotSetsLabelOpacity = useSharedValue(0);
  const hotSetsLabelTranslateY = useSharedValue(20);

  // Per-card staggered arrival to circle
  const arrivalProgs = Array.from({ length: FLYING_COUNT }, () => useSharedValue(0));
  const spinAngle = useSharedValue(0);
  const fadeProg = useSharedValue(0);

  // Button
  const bottomSlide = useSharedValue(120);
  const bottomOpacity = useSharedValue(0);
  const chevronY = useSharedValue(0);

  useEffect(() => {
    // 1. Logo
    logoOpacity.value = withDelay(150, withTiming(1, { duration: 500 }));
    logoScale.value = withDelay(150, withSpring(1, { damping: 6, stiffness: 120, mass: 0.7 }));
    logoTranslateY.value = withDelay(150, withSpring(0, { damping: 10, stiffness: 120 }));
    logoRotate.value = withDelay(150, withSequence(
      withSpring(6, { damping: 5, stiffness: 200 }),
      withSpring(-3, { damping: 6, stiffness: 180 }),
      withSpring(0, { damping: 10, stiffness: 140 }),
    ));

    // 2. Cards arrive one at a time (500ms apart, 600ms each)
    arrivalProgs.forEach((ap, i) => {
      ap.value = withDelay(500 + i * 500,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
      );
    });

    // 3. Slow spin
    spinAngle.value = withDelay(500,
      withTiming(Math.PI * 2, { duration: 5000, easing: Easing.out(Easing.quad) }),
    );

    // 4. "hot sets" label
    hotSetsLabelOpacity.value = withDelay(3200, withTiming(1, { duration: 500 }));
    hotSetsLabelTranslateY.value = withDelay(3200, withSpring(0, { damping: 14, stiffness: 120 }));

    // 5. Cards fade out
    fadeProg.value = withDelay(4200, withTiming(1, { duration: 500 }));

    // 6. Button flies in from bottom
    bottomOpacity.value = withDelay(4400, withTiming(1, { duration: 300 }));
    bottomSlide.value = withDelay(4400,
      withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }),
    );

    // 7. Chevron bounces forever
    chevronY.value = withDelay(5000, withRepeat(
      withSequence(
        withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    ));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoTranslateY.value },
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const hotSetsLabelStyle = useAnimatedStyle(() => ({
    opacity: hotSetsLabelOpacity.value,
    transform: [{ translateY: hotSetsLabelTranslateY.value }],
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
    router.replace('/(tabs)/(discover)');
  };

  const swipeUp = Gesture.Pan().onEnd((event) => {
    if (event.velocityY < -500) {
      runOnJS(navigateToDiscover)();
    }
  });

  const flyingIndices = useMemo(() => Array.from({ length: FLYING_COUNT }, (_, i) => i), []);

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

        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Logo */}
          <Animated.Text style={[styles.logo, logoStyle]}>trakd</Animated.Text>

          {/* Animation area */}
          <View style={styles.animationArea}>
            {/* Flying mini-cards */}
            <View style={styles.flyingCardsCenter} pointerEvents="none">
              {flyingIndices.map((i) => (
                <FlyingMiniCard
                  key={i}
                  index={i}
                  set={miniSets[i]}
                  arrivalProg={arrivalProgs[i]}
                  spinAngle={spinAngle}
                  fadeProg={fadeProg}
                />
              ))}
            </View>

            {/* "hot sets" label */}
            <Animated.View style={[styles.hotSetsLabelWrap, hotSetsLabelStyle]}>
              <Text style={styles.hotSetsLabel}>hot sets</Text>
              <View style={styles.hotSetsLine} />
            </Animated.View>
          </View>

          {/* Explore button — the main CTA */}
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
  animationArea: {
    height: SCREEN_HEIGHT * 0.4,
    width: '100%',
    overflow: 'visible',
  },
  flyingCardsCenter: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    width: 0,
    height: 0,
    zIndex: 15,
  },
  miniCard: {
    position: 'absolute',
    width: MINI_W,
    height: MINI_H,
    marginLeft: -MINI_W / 2,
    marginTop: -MINI_H / 2,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    borderTopColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
    backgroundColor: '#1a1a1a',
  },
  miniCardGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  miniCardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(255,255,255,0.22)',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  hotSetsLabelWrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    zIndex: 10,
  },
  hotSetsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.35)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  hotSetsLine: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(196, 30, 58, 0.3)',
    marginTop: 6,
  },
  buttonArea: {
    alignItems: 'center',
    paddingTop: 20,
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
