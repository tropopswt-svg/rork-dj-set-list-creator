import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Line, Rect, Defs, LinearGradient as SvgGradient, Stop, Circle, Path } from 'react-native-svg';
import {
  Heart,
  Music,
  Bookmark,
  ChevronRight,
  Disc,
  User,
  Flame,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import BubbleGlassLogo from '@/components/BubbleGlassLogo';
import { useAuth } from '@/contexts/AuthContext';
import { getCoverImageUrl } from '@/utils/coverImage';
import { useSavedSets, useLikedSets, useContributions } from '@/hooks/useSocial';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ─── Animated Counter ───────────────────────────────────────
function AnimatedCounter({ value, color }: { value: number; color: string }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value,
      tension: 20,
      friction: 7,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const displayValue = animatedValue.interpolate({
    inputRange: [0, Math.max(value, 1)],
    outputRange: ['0', `${value}`],
    extrapolate: 'clamp',
  });

  return (
    <Animated.Text style={[styles.statValue, { color }]}>
      {value}
    </Animated.Text>
  );
}

// ─── 3D Press Wrapper ───────────────────────────────────────
function PressableCard({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(shadowAnim, {
        toValue: 0.5,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(shadowAnim, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
            opacity: shadowAnim.interpolate({
              inputRange: [0.5, 1],
              outputRange: [0.92, 1],
            }),
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Glass Stat Card (Liquid Glass) ─────────────────────────
function GlassStatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <PressableCard style={styles.glassStatCard}>
      <BlurView intensity={50} tint="light" style={styles.glassStatBlur}>
        {/* Top refraction edge */}
        <View style={styles.glassStatEdgeTop} />
        <View style={styles.glassStatInner}>
          <View style={[styles.glassStatIcon, { backgroundColor: `${color}15` }]}>
            <Icon size={18} color={color} />
          </View>
          <AnimatedCounter value={value} color="#1A1A1E" />
          <Text style={styles.glassStatLabel}>{label}</Text>
        </View>
        {/* Bottom refraction */}
        <View style={styles.glassStatEdgeBottom} />
      </BlurView>
    </PressableCard>
  );
}

// ─── Wood Grain SVG Pattern ─────────────────────────────────
function WoodGrain({ width, height }: { width: number; height: number }) {
  // Generate subtle wood grain lines
  const lines = [];
  for (let i = 0; i < 12; i++) {
    const y = (i / 12) * height + Math.sin(i * 1.3) * 4;
    const opacity = 0.04 + (i % 3) * 0.02;
    lines.push(
      <Line
        key={`grain-${i}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y + Math.sin(i * 0.7) * 6}
        stroke="#6B4226"
        strokeWidth={1 + (i % 2) * 0.5}
        opacity={opacity}
      />
    );
  }
  // Add a couple knot-like circles
  lines.push(
    <Rect key="knot-1" x={width * 0.7} y={height * 0.3} width={8} height={4} rx={2} fill="#6B4226" opacity={0.06} />,
    <Rect key="knot-2" x={width * 0.2} y={height * 0.7} width={6} height={3} rx={1.5} fill="#6B4226" opacity={0.05} />,
  );
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      {lines}
    </Svg>
  );
}

// ─── Animated Crate Browser ─────────────────────────────────
function CrateStack({
  sets,
  onPress,
}: {
  sets: any[];
  onPress: (setId: string) => void;
}) {
  const covers = sets.slice(0, 5);
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const recordAnims = useRef(sets.map(() => new Animated.Value(0))).current;
  const lidAnim = useRef(new Animated.Value(0)).current;

  if (covers.length === 0) return null;

  const openCrate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsOpen(true);

    // 1. Slide up the modal
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();

    // 2. Animate crate lid opening
    Animated.spring(lidAnim, {
      toValue: 1,
      tension: 40,
      friction: 8,
      useNativeDriver: true,
      delay: 150,
    }).start();

    // 3. Stagger records popping out
    const staggered = sets.slice(0, 20).map((_, i) =>
      Animated.spring(recordAnims[i] || new Animated.Value(0), {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
        delay: 200 + i * 60,
      })
    );
    Animated.stagger(60, staggered).start();
  };

  const closeCrate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Reverse: records drop back in
    const reverseAnims = sets.slice(0, 20).map((_, i) =>
      Animated.spring(recordAnims[i] || new Animated.Value(0), {
        toValue: 0,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      })
    );
    Animated.stagger(30, reverseAnims).start();

    // Lid closes
    Animated.spring(lidAnim, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Slide down
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
      delay: 150,
    }).start(() => setIsOpen(false));
  };

  const RECORD_SIZE = (SCREEN_WIDTH - 64 - 12) / 2; // 2 columns with wood-wall insets

  const renderCrateRecord = ({ item, index }: { item: any; index: number }) => {
    const set = item.set;
    if (!set) return null;
    const coverUrl = getCoverImageUrl(set.cover_url, set.id, set.venue);
    const anim = recordAnims[index] || new Animated.Value(1);

    return (
      <PressableCard
        style={[styles.crateModalRecord, { width: RECORD_SIZE, height: RECORD_SIZE + 56 }]}
        onPress={() => {
          closeCrate();
          setTimeout(() => onPress(set.id), 400);
        }}
      >
        <Animated.View
          style={{
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [80, 0],
                }),
              },
              {
                scale: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1],
                }),
              },
              {
                rotate: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['8deg', '0deg'],
                }),
              },
            ],
            opacity: anim,
          }}
        >
          <Image
            source={{ uri: coverUrl }}
            style={[styles.crateModalRecordImage, { width: RECORD_SIZE - 2, height: RECORD_SIZE - 2 }]}
            contentFit="cover"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={250}
          />
          <View style={styles.crateModalRecordVinylHole} />
          <Text style={styles.crateModalRecordTitle} numberOfLines={1}>
            {set.name}
          </Text>
          <Text style={styles.crateModalRecordArtist} numberOfLines={1}>
            {set.artist_name}
          </Text>
        </Animated.View>
      </PressableCard>
    );
  };

  return (
    <View style={styles.crateContainer}>
      <View style={styles.crateHeader}>
        <Text style={styles.crateTitle}>Your Crate</Text>
        <Text style={styles.crateCount}>{sets.length} sets</Text>
      </View>

      {/* Collapsed crate preview — liquid glass */}
      <PressableCard style={styles.crateStack} onPress={openCrate}>
        <BlurView intensity={50} tint="light" style={styles.crateStackGlass}>
          {/* Glass refraction edges */}
          <View style={styles.crateGlassEdgeTop} />
          <View style={styles.crateGlassEdgeBottom} />

          {/* Content row */}
          <View style={styles.crateStackContent}>
            <View style={styles.crateVisual}>
              {covers.map((savedSet, i) => {
                const set = savedSet.set;
                if (!set) return null;
                const offset = i * 14;
                const rotation = (i - 2) * 3;
                const zIndex = covers.length - i;
                const coverUrl = getCoverImageUrl(set.cover_url, set.id, set.venue);

                return (
                  <View
                    key={savedSet.id || i}
                    style={[
                      styles.crateRecord,
                      {
                        zIndex,
                        transform: [
                          { translateX: offset - 28 },
                          { rotate: `${rotation}deg` },
                        ],
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: coverUrl }}
                      style={styles.crateRecordImage}
                      contentFit="cover"
                      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                      transition={250}
                    />
                    <View style={styles.vinylHole} />
                  </View>
                );
              })}
            </View>

            <View style={styles.crateInfo}>
              <Text style={styles.crateInfoTitle}>
                {covers[0]?.set?.name || 'Your Collection'}
              </Text>
              <Text style={styles.crateInfoSub}>
                {covers[0]?.set?.artist_name}
              </Text>
              <View style={styles.crateBrowse}>
                <Text style={styles.crateBrowseText}>Browse Crate</Text>
                <ChevronRight size={14} color={Colors.dark.primary} />
              </View>
            </View>
          </View>
        </BlurView>
      </PressableCard>

      {/* ─── Full-screen Animated Crate Modal ─── */}
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeCrate}>
        <Animated.View
          style={[
            styles.crateModalOverlay,
            {
              opacity: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.crateModalContainer,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Crate lid */}
            <Animated.View
              style={[
                styles.crateModalLid,
                {
                  transform: [
                    { perspective: 800 },
                    {
                      rotateX: lidAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '-75deg'],
                      }),
                    },
                  ],
                  opacity: lidAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 0.6, 0.15],
                  }),
                },
              ]}
            >
              <LinearGradient
                colors={['#D4A574', '#B8864E', '#A0713A']}
                style={styles.crateModalLidGradient}
              >
                <WoodGrain width={SCREEN_WIDTH} height={60} />
                <View style={styles.crateModalLidPlank} />
                <View style={styles.crateModalLidPlank} />
                <View style={styles.crateModalLidPlank} />
                <View style={styles.crateModalLidHandle}>
                  <View style={styles.crateModalLidHandleBar} />
                </View>
                {/* Nail dots on lid */}
                <View style={[styles.crateNail, { position: 'absolute', top: 10, left: 16 }]} />
                <View style={[styles.crateNail, { position: 'absolute', top: 10, right: 16 }]} />
                <View style={[styles.crateNail, { position: 'absolute', bottom: 10, left: 16 }]} />
                <View style={[styles.crateNail, { position: 'absolute', bottom: 10, right: 16 }]} />
              </LinearGradient>
            </Animated.View>

            {/* Wood walls — left and right side rails */}
            <View style={styles.crateWallLeft}>
              <LinearGradient
                colors={['#C49660', '#A67842', '#8B6332']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.crateWallGradient}
              />
            </View>
            <View style={styles.crateWallRight}>
              <LinearGradient
                colors={['#C49660', '#A67842', '#8B6332']}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.crateWallGradient}
              />
            </View>

            {/* Wood bottom */}
            <View style={styles.crateBottom}>
              <LinearGradient
                colors={['#B8864E', '#A0713A', '#8B6332']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.crateBottomGradient}
              />
            </View>

            {/* Header bar */}
            <View style={styles.crateModalHeader}>
              <View style={styles.crateModalHeaderLeft}>
                <Text style={styles.crateModalTitle}>Your Crate</Text>
              </View>
              <Pressable style={styles.crateModalClose} onPress={closeCrate}>
                <Text style={styles.crateModalCloseText}>Done</Text>
              </Pressable>
            </View>

            <Text style={styles.crateModalSubtitle}>
              {sets.length} set{sets.length !== 1 ? 's' : ''} saved
            </Text>

            {/* Records grid */}
            <FlatList
              data={sets}
              renderItem={renderCrateRecord}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.crateModalRow}
              contentContainerStyle={styles.crateModalGrid}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─── Activity Sparkline (Liquid Glass) ──────────────────────
function ActivitySparkline({ contributions }: { contributions: any[] }) {
  const days = 7;
  const now = new Date();
  const counts: number[] = [];
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle pulse on the glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    // Shimmer sweep across the glass
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2500, useNativeDriver: true, delay: 2000 }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(4000),
      ])
    ).start();
  }, []);

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const count = contributions.filter((c) => {
      const d = new Date(c.created_at);
      return d >= dayStart && d <= dayEnd;
    }).length;
    counts.push(count);
  }

  const maxCount = Math.max(...counts, 1);
  const svgWidth = SCREEN_WIDTH - 64;
  const svgHeight = 48;
  const padding = 8;

  // Build smooth line points
  const linePoints = counts
    .map((count, i) => {
      const x = padding + (i / (days - 1)) * (svgWidth - padding * 2);
      const y = svgHeight - padding - (count / maxCount) * (svgHeight - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  // Build filled area path (line + close to bottom)
  const areaPoints = counts.map((count, i) => {
    const x = padding + (i / (days - 1)) * (svgWidth - padding * 2);
    const y = svgHeight - padding - (count / maxCount) * (svgHeight - padding * 2);
    return { x, y };
  });
  const firstX = areaPoints[0].x;
  const lastX = areaPoints[areaPoints.length - 1].x;
  const areaPath = `M${areaPoints.map(p => `${p.x},${p.y}`).join(' L')} L${lastX},${svgHeight} L${firstX},${svgHeight} Z`;

  const totalThisWeek = counts.reduce((a, b) => a + b, 0);
  const orderedLabels: string[] = [];
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    orderedLabels.push(dayLabels[d.getDay() === 0 ? 6 : d.getDay() - 1]);
  }

  return (
    <View style={styles.sparklineOuter}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.sparklineGlow,
          {
            opacity: pulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.6],
            }),
          },
        ]}
      />

      {/* Glass container */}
      <BlurView intensity={50} tint="light" style={styles.sparklineGlass}>
        {/* Inner refraction edge — top highlight */}
        <View style={styles.sparklineEdgeTop} />
        {/* Inner refraction edge — bottom subtle */}
        <View style={styles.sparklineEdgeBottom} />

        {/* Shimmer sweep */}
        <Animated.View
          style={[
            styles.sparklineShimmer,
            {
              transform: [{
                translateX: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
                }),
              }],
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 0.3, 0.7, 1],
                outputRange: [0, 0.4, 0.4, 0],
              }),
            },
          ]}
        />

        {/* Header */}
        <View style={styles.sparklineHeader}>
          <View style={styles.sparklineTitleRow}>
            <Flame size={15} color="#FF6B35" />
            <Text style={styles.sparklineTitle}>This Week</Text>
          </View>
          <View style={styles.sparklineStat}>
            <Text style={styles.sparklineStatValue}>{totalThisWeek}</Text>
            <Text style={styles.sparklineStatLabel}>IDs</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.sparklineSvg}>
          <Svg width={svgWidth} height={svgHeight}>
            <Defs>
              <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={Colors.dark.primary} stopOpacity="0.25" />
                <Stop offset="1" stopColor={Colors.dark.primary} stopOpacity="0.02" />
              </SvgGradient>
              <SvgGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={Colors.dark.primary} stopOpacity="0.6" />
                <Stop offset="0.5" stopColor={Colors.dark.primary} stopOpacity="1" />
                <Stop offset="1" stopColor={Colors.dark.primary} stopOpacity="0.6" />
              </SvgGradient>
            </Defs>
            {/* Filled area under line */}
            <Path d={areaPath} fill="url(#areaFill)" />
            {/* Main line */}
            <Polyline
              points={linePoints}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Data point dots */}
            {areaPoints.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={counts[i] > 0 ? 4 : 2.5}
                fill={counts[i] > 0 ? Colors.dark.primary : 'rgba(0,0,0,0.1)'}
                stroke={counts[i] > 0 ? 'rgba(255,255,255,0.8)' : 'transparent'}
                strokeWidth={counts[i] > 0 ? 1.5 : 0}
              />
            ))}
          </Svg>
        </View>

        {/* Day labels */}
        <View style={styles.sparklineDays}>
          {counts.map((count, i) => (
            <View key={i} style={styles.sparklineDayItem}>
              <Text
                style={[
                  styles.sparklineDayLabel,
                  count > 0 && styles.sparklineDayLabelActive,
                ]}
              >
                {orderedLabels[i]}
              </Text>
            </View>
          ))}
        </View>
      </BlurView>
    </View>
  );
}

// ─── Accent colors that cycle per card index ────────────────
const TRACK_ACCENTS = [
  { bg: '#C41E3A', glow: 'rgba(196,30,58,0.35)', gradient: ['#C41E3A', '#8B1528'] as [string, string] },
  { bg: '#FF6B35', glow: 'rgba(255,107,53,0.35)', gradient: ['#FF6B35', '#CC4400'] as [string, string] },
  { bg: '#6C5CE7', glow: 'rgba(108,92,231,0.35)', gradient: ['#6C5CE7', '#4834B0'] as [string, string] },
  { bg: '#00B894', glow: 'rgba(0,184,148,0.35)', gradient: ['#00B894', '#008060'] as [string, string] },
  { bg: '#E17055', glow: 'rgba(225,112,85,0.35)', gradient: ['#E17055', '#B84830'] as [string, string] },
  { bg: '#0984E3', glow: 'rgba(9,132,227,0.35)', gradient: ['#0984E3', '#0660A8'] as [string, string] },
];

// ─── Waveform Bars ──────────────────────────────────────────
function WaveformBars({ color, count = 7 }: { color: string; count?: number }) {
  const bars = useRef(
    Array.from({ length: count }, () => new Animated.Value(0.3 + Math.random() * 0.5))
  ).current;

  useEffect(() => {
    const animations = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 0.25 + Math.random() * 0.75,
            duration: 280 + i * 70,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.1 + Math.random() * 0.35,
            duration: 220 + i * 50,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.waveformContainer}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            {
              backgroundColor: color,
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Identified Track Card (Insane UX) ──────────────────────
function IdentifiedTrackCard({
  contribution,
  onPress,
  index,
}: {
  contribution: any;
  onPress: () => void;
  index: number;
}) {
  const accent = TRACK_ACCENTS[index % TRACK_ACCENTS.length];
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressRotateY = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.spring(entranceAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
      delay: index * 100,
    }).start();

    // Shimmer sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
          delay: 1000 + index * 300,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
      ])
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 0.92,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(pressRotateY, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(pressRotateY, {
        toValue: 0,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.trackCard,
          {
            transform: [
              {
                translateY: entranceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [60, 0],
                }),
              },
              {
                scale: Animated.multiply(
                  entranceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                  pressScale
                ),
              },
              { perspective: 800 },
              {
                rotateY: pressRotateY.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-6deg'],
                }),
              },
            ],
            opacity: entranceAnim,
          },
        ]}
      >
        {/* Glow border */}
        <Animated.View
          style={[
            styles.trackCardGlow,
            {
              shadowColor: accent.bg,
              shadowOpacity: glowPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.15, 0.4],
              }),
            },
          ]}
        />

        {/* Accent strip at top */}
        <LinearGradient
          colors={accent.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.trackCardAccentStrip}
        />

        {/* Shimmer overlay */}
        <Animated.View
          style={[
            styles.trackCardShimmer,
            {
              transform: [
                {
                  translateX: shimmerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-180, 180],
                  }),
                },
              ],
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 0.3, 0.7, 1],
                outputRange: [0, 0.6, 0.6, 0],
              }),
            },
          ]}
        />

        {/* Compact timestamp + waveform row */}
        <View style={styles.trackCardTop}>
          <View style={[styles.trackTimePill, { backgroundColor: `${accent.bg}12` }]}>
            <Text style={[styles.trackTimeText, { color: accent.bg }]}>
              {contribution.timestamp_seconds
                ? formatTimestamp(contribution.timestamp_seconds)
                : '--:--'}
            </Text>
            <View style={styles.trackTimeDivider} />
            <WaveformBars color={accent.bg} count={5} />
          </View>
          <Text style={styles.trackDate}>
            {formatTimeAgo(contribution.created_at)}
          </Text>
        </View>

        {/* Track info — big & bold */}
        <Text style={styles.trackTitle} numberOfLines={2}>
          {contribution.track_title || 'Unknown Track'}
        </Text>
        <Text style={[styles.trackArtist, { color: accent.bg }]} numberOfLines={1}>
          {contribution.track_artist || 'Unknown Artist'}
        </Text>

        {/* Set name — prominent */}
        {contribution.set && (
          <View style={styles.trackSetRow}>
            <Disc size={11} color="rgba(0,0,0,0.35)" />
            <Text style={styles.trackSetName} numberOfLines={1}>
              {contribution.set.name}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Saved Set Card (Liquid Glass) ──────────────────────────
function SavedSetCard({
  savedSet,
  onPress,
}: {
  savedSet: any;
  onPress: () => void;
}) {
  const set = savedSet.set;
  if (!set) return null;

  return (
    <PressableCard style={styles.savedSetCard} onPress={onPress}>
      <BlurView intensity={50} tint="light" style={styles.savedSetGlass}>
        <View style={styles.savedSetGlassEdge} />
        <Image
          source={{ uri: getCoverImageUrl(set.cover_url, set.id, set.venue) }}
          style={styles.savedSetImage}
          contentFit="cover"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={250}
        />
        <View style={styles.savedSetInfo}>
          <Text style={styles.savedSetName} numberOfLines={1}>
            {set.name}
          </Text>
          <Text style={styles.savedSetArtist} numberOfLines={1}>
            {set.artist_name}
          </Text>
          <Text style={styles.savedSetDate}>
            {formatTimeAgo(savedSet.created_at)}
          </Text>
        </View>
        <ChevronRight size={18} color="rgba(0,0,0,0.35)" />
      </BlurView>
    </PressableCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── Main Screen ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ─── Mock Data for Preview ──────────────────────────────────
const MOCK_SAVED_SETS = [
  {
    id: 'mock-1',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    set: { id: 'mock-set-1', name: 'Boiler Room Berlin', artist_name: 'Ben Böhmer', cover_url: 'https://img.youtube.com/vi/RvRhUHTV_8k/maxresdefault.jpg', venue: 'Printworks' },
  },
  {
    id: 'mock-2',
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    set: { id: 'mock-set-2', name: 'Tomorrowland Mainstage 2024', artist_name: 'Charlotte de Witte', cover_url: 'https://img.youtube.com/vi/DiLqnB0MxOs/maxresdefault.jpg', venue: 'Tomorrowland' },
  },
  {
    id: 'mock-3',
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    set: { id: 'mock-set-3', name: 'Cercle @ Torre de Belém', artist_name: 'Agents Of Time', cover_url: 'https://img.youtube.com/vi/VjWTnbMRUKs/maxresdefault.jpg', venue: 'Torre de Belém' },
  },
  {
    id: 'mock-4',
    created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
    set: { id: 'mock-set-4', name: 'Afterlife Tulum', artist_name: 'Tale Of Us', cover_url: 'https://img.youtube.com/vi/nVjsGKrE6E0/maxresdefault.jpg', venue: 'Zamna Tulum' },
  },
  {
    id: 'mock-5',
    created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
    set: { id: 'mock-set-5', name: 'DC-10 Closing Party', artist_name: 'Jamie Jones', cover_url: 'https://img.youtube.com/vi/Q_tCsGnqNIw/maxresdefault.jpg', venue: 'DC-10 Ibiza' },
  },
];

const MOCK_LIKED_SETS = MOCK_SAVED_SETS.slice(1, 4);

const now = new Date();
const MOCK_IDENTIFIED_TRACKS = [
  { id: 'mt-1', track_title: 'Nightfall', track_artist: 'Agents Of Time', timestamp_seconds: 1823, created_at: new Date(Date.now() - 1 * 3600000).toISOString(), set: { id: 'mock-set-3', name: 'Cercle @ Torre de Belém' } },
  { id: 'mt-2', track_title: 'Age of Love', track_artist: 'Charlotte de Witte', timestamp_seconds: 3420, created_at: new Date(Date.now() - 3 * 3600000).toISOString(), set: { id: 'mock-set-2', name: 'Tomorrowland Mainstage' } },
  { id: 'mt-3', track_title: 'Breathing', track_artist: 'Ben Böhmer', timestamp_seconds: 720, created_at: new Date(Date.now() - 5 * 3600000).toISOString(), set: { id: 'mock-set-1', name: 'Boiler Room Berlin' } },
  { id: 'mt-4', track_title: 'Nova', track_artist: 'Tale Of Us', timestamp_seconds: 2100, created_at: new Date(Date.now() - 12 * 3600000).toISOString(), set: { id: 'mock-set-4', name: 'Afterlife Tulum' } },
  { id: 'mt-5', track_title: 'Devotion', track_artist: 'Anyma', timestamp_seconds: 4500, created_at: new Date(Date.now() - 24 * 3600000).toISOString(), set: { id: 'mock-set-4', name: 'Afterlife Tulum' } },
  { id: 'mt-6', track_title: 'Running', track_artist: 'Jamie Jones', timestamp_seconds: 1200, created_at: new Date(Date.now() - 36 * 3600000).toISOString(), set: { id: 'mock-set-5', name: 'DC-10 Closing Party' } },
  { id: 'mt-7', track_title: 'Acid Rain', track_artist: 'Charlotte de Witte', timestamp_seconds: 5100, created_at: new Date(Date.now() - 48 * 3600000).toISOString(), set: { id: 'mock-set-2', name: 'Tomorrowland Mainstage' } },
  { id: 'mt-8', track_title: 'Fade Into You', track_artist: 'Agents Of Time', timestamp_seconds: 3000, created_at: new Date(Date.now() - 60 * 3600000).toISOString(), set: { id: 'mock-set-3', name: 'Cercle @ Torre de Belém' } },
  { id: 'mt-9', track_title: 'Afterlife', track_artist: 'Tale Of Us', timestamp_seconds: 600, created_at: new Date(Date.now() - 96 * 3600000).toISOString(), set: { id: 'mock-set-4', name: 'Afterlife Tulum' } },
  { id: 'mt-10', track_title: 'Beyond', track_artist: 'Ben Böhmer', timestamp_seconds: 2400, created_at: new Date(Date.now() - 120 * 3600000).toISOString(), set: { id: 'mock-set-1', name: 'Boiler Room Berlin' } },
  { id: 'mt-11', track_title: 'Sequence', track_artist: 'Stephan Bodzin', timestamp_seconds: 1500, created_at: new Date(Date.now() - 144 * 3600000).toISOString(), set: { id: 'mock-set-3', name: 'Cercle @ Torre de Belém' } },
  { id: 'mt-12', track_title: 'Opus', track_artist: 'Eric Prydz', timestamp_seconds: 3600, created_at: new Date(Date.now() - 150 * 3600000).toISOString(), set: { id: 'mock-set-2', name: 'Tomorrowland Mainstage' } },
];

const USE_MOCK_DATA = false;

export default function MyStuffScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { savedSets: realSavedSets, isLoading: savedLoading, refresh: refreshSaved } = useSavedSets();
  const { likedSets: realLikedSets, isLoading: likedLoading, refresh: refreshLiked } = useLikedSets();
  const {
    identifiedTracks: realIdentifiedTracks,
    isLoading: contributionsLoading,
    refresh: refreshContributions,
  } = useContributions();

  const savedSets = realSavedSets;
  const likedSets = realLikedSets;
  const identifiedTracks = realIdentifiedTracks;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refreshSaved(), refreshLiked(), refreshContributions()]);
    setIsRefreshing(false);
  }, [refreshSaved, refreshLiked, refreshContributions]);

  const navigateToSet = (setId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/${setId}`);
  };

  const isLoading = savedLoading || likedLoading || contributionsLoading;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Crate</Text>
          <Pressable
            style={styles.headerButton}
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/(tabs)/(profile)');
            }}
          >
            <BlurView intensity={50} tint="light" style={styles.headerButtonGlass}>
              <User size={20} color="#1A1A1E" />
            </BlurView>
          </Pressable>
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
          {/* ─── Activity Sparkline ─── */}
          {identifiedTracks.length > 0 && (
            <View style={styles.section}>
              <ActivitySparkline contributions={identifiedTracks} />
            </View>
          )}

          {/* ─── Vinyl Crate Stack ─── */}
          {savedSets.length > 0 && (
            <View style={styles.section}>
              <CrateStack sets={savedSets} onPress={navigateToSet} />
            </View>
          )}

          {/* ─── Identified Tracks ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Your IDs</Text>
              </View>
              {identifiedTracks.length > 0 && (
                <View style={styles.sectionCountPill}>
                  <Text style={styles.sectionCountText}>
                    {identifiedTracks.length}
                  </Text>
                </View>
              )}
            </View>

            {contributionsLoading ? (
              <ActivityIndicator
                color={Colors.dark.primary}
                style={styles.sectionLoader}
              />
            ) : identifiedTracks.length === 0 ? (
              <View style={styles.emptySection}>
                <Music size={28} color="rgba(0,0,0,0.35)" />
                <Text style={styles.emptyTitle}>No identified tracks yet</Text>
                <Text style={styles.emptyText}>
                  Contribute track IDs to sets to build your collection
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tracksContainer}
              >
                {identifiedTracks.slice(0, 10).map((contribution, i) => (
                  <IdentifiedTrackCard
                    key={contribution.id}
                    contribution={contribution}
                    index={i}
                    onPress={() => {
                      if (contribution.set?.id) {
                        navigateToSet(contribution.set.id);
                      }
                    }}
                  />
                ))}
                {identifiedTracks.length > 10 && (
                  <PressableCard style={styles.seeAllCard}>
                    <Text style={styles.seeAllText}>See All</Text>
                    <ChevronRight size={16} color={Colors.dark.primary} />
                  </PressableCard>
                )}
              </ScrollView>
            )}
          </View>

          {/* ─── Liked Sets ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Heart size={16} color={Colors.dark.error} />
                <Text style={styles.sectionTitle}>Liked Sets</Text>
              </View>
              {likedSets.length > 0 && (
                <View style={styles.sectionCountPill}>
                  <Text style={styles.sectionCountText}>
                    {likedSets.length}
                  </Text>
                </View>
              )}
            </View>

            {likedLoading ? (
              <ActivityIndicator
                color={Colors.dark.primary}
                style={styles.sectionLoader}
              />
            ) : likedSets.length === 0 ? (
              <View style={styles.emptySection}>
                <Heart size={28} color="rgba(0,0,0,0.35)" />
                <Text style={styles.emptyTitle}>No liked sets</Text>
                <Text style={styles.emptyText}>
                  Like sets to show your appreciation
                </Text>
              </View>
            ) : (
              <View style={styles.savedSetsList}>
                {likedSets.slice(0, 3).map((likedSet) => (
                  <SavedSetCard
                    key={likedSet.id}
                    savedSet={likedSet}
                    onPress={() => {
                      if (likedSet.set?.id) {
                        navigateToSet(likedSet.set.id);
                      }
                    }}
                  />
                ))}
                {likedSets.length > 3 && (
                  <Pressable style={styles.seeAllButton}>
                    <Text style={styles.seeAllButtonText}>
                      See All Liked Sets
                    </Text>
                    <ChevronRight size={16} color={Colors.dark.primary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── Styles ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1E',
    letterSpacing: -0.3,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  headerButtonGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // ─── Login Prompt ───
  loginPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loginLogoWrapper: {
    marginBottom: 8,
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1E',
    marginTop: 8,
  },
  loginPromptText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.45)',
    textAlign: 'center',
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.25)',
    borderTopColor: 'rgba(196, 30, 58, 0.35)',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C41E3A',
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5E6D3',
  },

  // ─── Glass Stat Cards (Liquid Glass) ───
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  glassStatCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.12)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 5,
  },
  glassStatBlur: {
    borderRadius: 20,
    padding: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  glassStatEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  glassStatEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  glassStatInner: {
    alignItems: 'center',
  },
  glassStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  glassStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.45)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Activity Sparkline (Liquid Glass) ───
  sparklineOuter: {
    marginHorizontal: 16,
    position: 'relative',
  },
  sparklineGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 28,
    backgroundColor: 'transparent',
    shadowColor: 'rgba(255,255,255,0.6)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 0,
  },
  sparklineGlass: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    shadowColor: 'rgba(0,0,0,0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  sparklineEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sparklineEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  sparklineShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ skewX: '-20deg' }],
  },
  sparklineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sparklineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparklineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1E',
  },
  sparklineStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  sparklineStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.dark.primary,
    letterSpacing: -0.5,
  },
  sparklineStatLabel: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.45)',
    fontWeight: '500',
  },
  sparklineSvg: {
    marginBottom: 10,
  },
  sparklineDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sparklineDayItem: {
    alignItems: 'center',
  },
  sparklineDayLabel: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.25)',
    fontWeight: '600',
  },
  sparklineDayLabelActive: {
    color: '#1A1A1E',
    fontWeight: '700',
  },

  // ─── Crate Stack (Liquid Glass) ───
  crateContainer: {
    paddingHorizontal: 16,
  },
  crateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  crateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1E',
    flex: 1,
  },
  crateCount: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.45)',
    fontWeight: '500',
  },
  crateStack: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.14)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  crateStackGlass: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  crateGlassEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 2,
  },
  crateGlassEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 2,
  },
  crateStackContent: {
    flexDirection: 'row',
  },
  crateVisual: {
    width: 120,
    height: 100,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crateRecord: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  crateRecordImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  vinylHole: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -6,
    marginLeft: -6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  crateInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  crateInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1E',
    marginBottom: 4,
  },
  crateInfoSub: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '500',
    marginBottom: 12,
  },
  crateBrowse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  crateBrowseText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.primary,
  },

  // ─── Crate Modal (Wooden Interior) ───
  crateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  crateModalContainer: {
    backgroundColor: '#EDE0D0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 0,
    maxHeight: '92%',
    minHeight: '70%',
    overflow: 'hidden',
  },
  crateModalLid: {
    height: 60,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    transformOrigin: 'top center',
  },
  crateModalLidGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
    position: 'relative',
  },
  crateModalLidPlank: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  crateModalLidHandle: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
  },
  crateModalLidHandleBar: {
    width: 52,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  crateNail: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(80,50,20,0.4)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,220,180,0.3)',
  },
  // Side walls in modal — thin wood rails
  crateWallLeft: {
    position: 'absolute',
    left: 0,
    top: 60,
    bottom: 0,
    width: 8,
    zIndex: 10,
    overflow: 'hidden',
  },
  crateWallRight: {
    position: 'absolute',
    right: 0,
    top: 60,
    bottom: 0,
    width: 8,
    zIndex: 10,
    overflow: 'hidden',
  },
  crateWallGradient: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(139,99,50,0.3)',
  },
  crateBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 6,
    zIndex: 10,
    overflow: 'hidden',
  },
  crateBottomGradient: {
    flex: 1,
  },
  crateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  crateModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  crateModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3A2010',
    letterSpacing: -0.5,
  },
  crateModalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  crateModalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5E34',
  },
  crateModalSubtitle: {
    fontSize: 13,
    color: '#8B7355',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  crateModalGrid: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  crateModalRow: {
    gap: 12,
    marginBottom: 16,
  },
  crateModalRecord: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F5EDE0',
    shadowColor: '#5A3714',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,99,50,0.12)',
  },
  crateModalRecordImage: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,99,50,0.15)',
  },
  crateModalRecordVinylHole: {
    position: 'absolute',
    top: '28%',
    left: '50%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: -7,
    marginLeft: -7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  crateModalRecordTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3A2010',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  crateModalRecordArtist: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8B5E34',
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 10,
  },

  // ─── Sections ───
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1E',
  },
  sectionCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  sectionLoader: {
    marginVertical: 20,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 32,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopColor: 'rgba(255,255,255,0.7)',
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1E',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ─── Track Cards (Liquid Glass + Animated) ───
  tracksContainer: {
    paddingHorizontal: 16,
    gap: 12,
    paddingVertical: 4,
  },
  trackCard: {
    width: 164,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopColor: 'rgba(255,255,255,0.7)',
    shadowColor: 'rgba(0,0,0,0.12)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  trackCardGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 0,
  },
  trackCardAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  trackCardShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ skewX: '-20deg' }],
  },
  trackCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trackTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trackTimeText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  trackTimeDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  // Waveform bars
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 14,
  },
  waveformBar: {
    width: 2.5,
    height: 14,
    borderRadius: 1.5,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1E',
    marginBottom: 2,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  trackArtist: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  trackSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trackSetName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.45)',
    flex: 1,
  },
  trackDate: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.35)',
    fontWeight: '500',
  },
  seeAllCard: {
    width: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
  },

  // ─── Saved/Liked Sets (Liquid Glass) ───
  savedSetsList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  savedSetCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.12)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  savedSetGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  savedSetGlassEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  savedSetImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  savedSetInfo: {
    flex: 1,
    marginLeft: 12,
  },
  savedSetName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1E',
    marginBottom: 2,
  },
  savedSetArtist: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  savedSetDate: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.35)',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  seeAllButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.primary,
  },
});
