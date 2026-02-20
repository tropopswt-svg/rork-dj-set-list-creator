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
import Svg, { Polyline } from 'react-native-svg';
import {
  Heart,
  Music,
  Clock,
  Bookmark,
  ChevronRight,
  Disc,
  Disc3,
  User,
  Flame,
  TrendingUp,
  Sparkles,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import TrackdLogo from '@/components/TrackdLogo';
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

// ─── Glass Stat Card ────────────────────────────────────────
function GlassStatCard({
  icon: Icon,
  label,
  value,
  color,
  gradientColors,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  gradientColors: [string, string];
}) {
  return (
    <PressableCard style={styles.glassStatCard}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassStatGradient}
      >
        <View style={styles.glassStatInner}>
          <View style={[styles.glassStatIcon, { backgroundColor: `${color}20` }]}>
            <Icon size={18} color={color} />
          </View>
          <AnimatedCounter value={value} color={Colors.dark.text} />
          <Text style={styles.glassStatLabel}>{label}</Text>
        </View>
        {/* Highlight edge */}
        <View style={styles.glassHighlight} />
      </LinearGradient>
    </PressableCard>
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

  const RECORD_SIZE = (SCREEN_WIDTH - 48 - 12) / 2; // 2 columns, 16px padding + 12px gap

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
        <Disc3 size={18} color={Colors.dark.primary} />
        <Text style={styles.crateTitle}>Your Crate</Text>
        <Text style={styles.crateCount}>{sets.length} sets</Text>
      </View>

      {/* Collapsed crate preview */}
      <PressableCard style={styles.crateStack} onPress={openCrate}>
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
                <View style={styles.crateModalLidPlank} />
                <View style={styles.crateModalLidPlank} />
                <View style={styles.crateModalLidPlank} />
                <View style={styles.crateModalLidHandle}>
                  <View style={styles.crateModalLidHandleBar} />
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Header bar */}
            <View style={styles.crateModalHeader}>
              <View style={styles.crateModalHeaderLeft}>
                <Disc3 size={20} color={Colors.dark.primary} />
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

// ─── Activity Sparkline ─────────────────────────────────────
function ActivitySparkline({ contributions }: { contributions: any[] }) {
  // Build last 7 days activity
  const days = 7;
  const now = new Date();
  const counts: number[] = [];

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
  const svgHeight = 40;
  const padding = 4;

  const points = counts
    .map((count, i) => {
      const x = padding + (i / (days - 1)) * (svgWidth - padding * 2);
      const y = svgHeight - padding - (count / maxCount) * (svgHeight - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const totalThisWeek = counts.reduce((a, b) => a + b, 0);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayIndex = now.getDay();
  const orderedLabels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    orderedLabels.push(dayLabels[d.getDay() === 0 ? 6 : d.getDay() - 1]);
  }

  return (
    <View style={styles.sparklineContainer}>
      <View style={styles.sparklineHeader}>
        <View style={styles.sparklineTitleRow}>
          <Flame size={16} color="#FF6B35" />
          <Text style={styles.sparklineTitle}>This Week</Text>
        </View>
        <View style={styles.sparklineStat}>
          <Text style={styles.sparklineStatValue}>{totalThisWeek}</Text>
          <Text style={styles.sparklineStatLabel}>IDs</Text>
        </View>
      </View>
      <View style={styles.sparklineSvg}>
        <Svg width={svgWidth} height={svgHeight}>
          <Polyline
            points={points}
            fill="none"
            stroke={Colors.dark.primary}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      {/* Day dots */}
      <View style={styles.sparklineDays}>
        {counts.map((count, i) => (
          <View key={i} style={styles.sparklineDayItem}>
            <View
              style={[
                styles.sparklineDot,
                count > 0 && styles.sparklineDotActive,
                count > 0 && { backgroundColor: Colors.dark.primary },
              ]}
            />
            <Text style={styles.sparklineDayLabel}>{orderedLabels[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Identified Track Card (Enhanced) ───────────────────────
function IdentifiedTrackCard({
  contribution,
  onPress,
}: {
  contribution: any;
  onPress: () => void;
}) {
  return (
    <PressableCard style={styles.trackCard} onPress={onPress}>
      <View style={styles.trackCardHeader}>
        <LinearGradient
          colors={[`${Colors.dark.primary}30`, `${Colors.dark.primary}10`]}
          style={styles.trackIconGradient}
        >
          <Music size={14} color={Colors.dark.primary} />
        </LinearGradient>
        <Text style={styles.trackTimestamp}>
          {contribution.timestamp_seconds
            ? formatTimestamp(contribution.timestamp_seconds)
            : '--:--'}
        </Text>
      </View>
      <Text style={styles.trackTitle} numberOfLines={2}>
        {contribution.track_title || 'Unknown Track'}
      </Text>
      <Text style={styles.trackArtist} numberOfLines={1}>
        {contribution.track_artist || 'Unknown Artist'}
      </Text>
      {contribution.set && (
        <View style={styles.trackSetInfo}>
          <Disc size={10} color={Colors.dark.textMuted} />
          <Text style={styles.trackSetName} numberOfLines={1}>
            {contribution.set.name}
          </Text>
        </View>
      )}
      <Text style={styles.trackDate}>
        {formatTimeAgo(contribution.created_at)}
      </Text>
    </PressableCard>
  );
}

// ─── Saved Set Card (Enhanced) ──────────────────────────────
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
      <Image
        source={{ uri: getCoverImageUrl(set.cover_url, set.id, set.venue) }}
        style={styles.savedSetImage}
        contentFit="cover"
      />
      <View style={styles.savedSetInfo}>
        <Text style={styles.savedSetName} numberOfLines={1}>
          {set.name}
        </Text>
        <Text style={styles.savedSetArtist} numberOfLines={1}>
          {set.artist_name}
        </Text>
        <View style={styles.savedSetMeta}>
          <Text style={styles.savedSetDate}>
            Saved {formatTimeAgo(savedSet.created_at)}
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color={Colors.dark.textMuted} />
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

const USE_MOCK_DATA = true; // Flip to false to use real data

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

  // Use mock data if real data is empty
  const savedSets = USE_MOCK_DATA && realSavedSets.length === 0 ? MOCK_SAVED_SETS : realSavedSets;
  const likedSets = USE_MOCK_DATA && realLikedSets.length === 0 ? MOCK_LIKED_SETS : realLikedSets;
  const identifiedTracks = USE_MOCK_DATA && realIdentifiedTracks.length === 0 ? MOCK_IDENTIFIED_TRACKS : realIdentifiedTracks;

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

  // Not logged in view
  if (false && !isAuthenticated) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <TrackdLogo size="medium" />
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loginPromptContainer}>
            <View style={styles.loginLogoWrapper}>
              <TrackdLogo size="xlarge" />
            </View>
            <Text style={styles.loginPromptTitle}>Your personal crate</Text>
            <Text style={styles.loginPromptText}>
              Log in to save sets, track your identified songs, and build your
              crate
            </Text>
            <Pressable
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginButtonText}>Log In</Text>
            </Pressable>
            <Pressable
              style={styles.signupButton}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.signupButtonText}>Create Account</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

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
            <User size={22} color={Colors.dark.text} />
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
          {/* ─── Glass Stats ─── */}
          <View style={styles.statsSection}>
            <GlassStatCard
              icon={Music}
              label="Track'd"
              value={identifiedTracks.length}
              color={Colors.dark.primary}
              gradientColors={['#FFFFFF', '#FFF5F7']}
            />
            <GlassStatCard
              icon={Bookmark}
              label="Saved"
              value={savedSets.length}
              color={Colors.dark.success}
              gradientColors={['#FFFFFF', '#F0FFF4']}
            />
            <GlassStatCard
              icon={Heart}
              label="Liked"
              value={likedSets.length}
              color={Colors.dark.error}
              gradientColors={['#FFFFFF', '#FFF5F5']}
            />
          </View>

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
                <Sparkles size={16} color={Colors.dark.primary} />
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
                <Music size={28} color={Colors.dark.textMuted} />
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
                {identifiedTracks.slice(0, 10).map((contribution) => (
                  <IdentifiedTrackCard
                    key={contribution.id}
                    contribution={contribution}
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

          {/* ─── Saved Sets ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Bookmark size={16} color={Colors.dark.success} />
                <Text style={styles.sectionTitle}>Saved Sets</Text>
              </View>
              {savedSets.length > 0 && (
                <View style={styles.sectionCountPill}>
                  <Text style={styles.sectionCountText}>
                    {savedSets.length}
                  </Text>
                </View>
              )}
            </View>

            {savedLoading ? (
              <ActivityIndicator
                color={Colors.dark.primary}
                style={styles.sectionLoader}
              />
            ) : savedSets.length === 0 ? (
              <View style={styles.emptySection}>
                <Bookmark size={28} color={Colors.dark.textMuted} />
                <Text style={styles.emptyTitle}>No saved sets</Text>
                <Text style={styles.emptyText}>
                  Save sets while browsing to find them here later
                </Text>
              </View>
            ) : (
              <View style={styles.savedSetsList}>
                {savedSets.slice(0, 5).map((savedSet) => (
                  <SavedSetCard
                    key={savedSet.id}
                    savedSet={savedSet}
                    onPress={() => {
                      if (savedSet.set?.id) {
                        navigateToSet(savedSet.set.id);
                      }
                    }}
                  />
                ))}
                {savedSets.length > 5 && (
                  <Pressable style={styles.seeAllButton}>
                    <Text style={styles.seeAllButtonText}>
                      See All Saved Sets
                    </Text>
                    <ChevronRight size={16} color={Colors.dark.primary} />
                  </Pressable>
                )}
              </View>
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
                <Heart size={28} color={Colors.dark.textMuted} />
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
    backgroundColor: Colors.dark.background,
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
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
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
    color: Colors.dark.text,
    marginTop: 8,
  },
  loginPromptText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.primary,
  },

  // ─── Glass Stat Cards ───
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  glassStatCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  glassStatGradient: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassStatInner: {
    alignItems: 'center',
  },
  glassStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  glassStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Activity Sparkline ───
  sparklineContainer: {
    marginHorizontal: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sparklineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sparklineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparklineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  sparklineStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  sparklineStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  sparklineStatLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  sparklineSvg: {
    marginBottom: 8,
  },
  sparklineDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sparklineDayItem: {
    alignItems: 'center',
    gap: 4,
  },
  sparklineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.border,
  },
  sparklineDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sparklineDayLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },

  // ─── Crate Stack ───
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
    color: Colors.dark.text,
    flex: 1,
  },
  crateCount: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  crateStack: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    borderColor: 'rgba(255,255,255,0.3)',
  },
  crateRecordShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  crateInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  crateInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
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
    backgroundColor: `${Colors.dark.primary}12`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  crateBrowseText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.primary,
  },

  // ─── Crate Modal ───
  crateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  crateModalContainer: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 0,
    maxHeight: '92%',
    minHeight: '70%',
    overflow: 'hidden',
  },
  crateModalLid: {
    height: 56,
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
    paddingHorizontal: 20,
    gap: 8,
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
    top: 18,
    alignSelf: 'center',
  },
  crateModalLidHandleBar: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  crateModalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  crateModalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  crateModalSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  crateModalGrid: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  crateModalRow: {
    gap: 12,
    marginBottom: 16,
  },
  crateModalRecord: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  crateModalRecordImage: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    color: Colors.dark.text,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  crateModalRecordArtist: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.dark.primary,
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
    color: Colors.dark.text,
  },
  sectionCountPill: {
    backgroundColor: `${Colors.dark.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 10,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ─── Track Cards ───
  tracksContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  trackCard: {
    width: 150,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  trackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackIconGradient: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTimestamp: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  trackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 2,
    lineHeight: 17,
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500',
    marginBottom: 8,
  },
  trackSetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  trackSetName: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    flex: 1,
  },
  trackDate: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },
  seeAllCard: {
    width: 80,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
  },

  // ─── Saved Sets ───
  savedSetsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  savedSetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  savedSetImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  savedSetInfo: {
    flex: 1,
    marginLeft: 12,
  },
  savedSetName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  savedSetArtist: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  savedSetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedSetDate: {
    fontSize: 11,
    color: Colors.dark.textMuted,
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
