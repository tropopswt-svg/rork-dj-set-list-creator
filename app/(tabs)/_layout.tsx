import { Tabs, useRouter, useSegments } from 'expo-router';
import { Disc3, Rss, Archive, User, Search } from 'lucide-react-native';
import { StyleSheet, View, Pressable, Animated, Easing, Text } from 'react-native';
import React, { useRef, useEffect, useMemo, useState, useCallback, memo } from 'react';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import FABActionModal from '@/components/FABActionModal';
import LiveIdentifyModal from '@/components/LiveIdentifyModal';
import SetRecordingModal from '@/components/SetRecordingModal';
import SetRecordingBanner from '@/components/SetRecordingBanner';
import { stopSetRecording, getRecordingStatus, IdentifiedTrack } from '@/components/SetRecordingService';

const API_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';
import { AuthGateModal } from '@/components/AuthGate';
import { useAuth } from '@/contexts/AuthContext';
import { stopFeedAudio, refreshFeed } from '@/lib/feedAudioController';

// Animated Vinyl FAB with "trackd" text in center — memoized to prevent animation restarts
const VinylFAB = memo(({ onPress, onLongPress }: { onPress: () => void; onLongPress?: () => void }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinCircleOpacity = useRef(new Animated.Value(0)).current;
  const spinCircleRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle pulse every 15 seconds
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(15000),
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 150,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Every 30 seconds, show a spinning accent circle
    const spinCircleAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(30000),
        // Fade in
        Animated.timing(spinCircleOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Spin 3 times
        Animated.timing(spinCircleRotation, {
          toValue: 3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Fade out
        Animated.timing(spinCircleOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        // Reset rotation
        Animated.timing(spinCircleRotation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    spinCircleAnimation.start();

    return () => {
      pulseAnimation.stop();
      spinCircleAnimation.stop();
    };
  }, []);

  const spinCircleSpin = spinCircleRotation.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['0deg', '360deg', '720deg', '1080deg'],
  });

  return (
    <Pressable style={styles.fab} onPress={onPress} onLongPress={onLongPress} delayLongPress={500}>
      {/* Multiple vinyl grooves (static) */}
      <View style={styles.vinylGroove1} />
      <View style={styles.vinylGroove2} />
      <View style={styles.vinylGroove3} />
      {/* Spinning accent circle that appears every 30s */}
      <Animated.View
        style={[
          styles.spinCircle,
          {
            opacity: spinCircleOpacity,
            transform: [{ rotate: spinCircleSpin }],
          },
        ]}
      />
      {/* Center with trackd - pulses */}
      <Animated.View style={[styles.fabCenter, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.fabText}>trak<Text style={styles.fabTextD}>d</Text></Text>
      </Animated.View>
    </Pressable>
  );
});

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated } = useAuth();
  const [showActionModal, setShowActionModal] = useState(false);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [showContinuousIdentifyModal, setShowContinuousIdentifyModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isRecordingSet, setIsRecordingSet] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [recordingTrackCount, setRecordingTrackCount] = useState(0);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateMessage, setAuthGateMessage] = useState('');
  const lastSessionIdRef = useRef<string | null>(null);

  // Admin menu trigger - tap Discover tab 3 times, hold on 3rd
  const discoverTapCount = useRef(0);
  const discoverTapTimer = useRef<NodeJS.Timeout | null>(null);
  const discoverLongPressTimer = useRef<NodeJS.Timeout | null>(null);
  const discoverPressStart = useRef<number>(0);

  // Only show FAB on main tab index pages
  const showFAB = useMemo(() => {
    // segments looks like: ['(tabs)', '(discover)'] for index
    // or ['(tabs)', '(discover)', '[id]'] for detail pages
    // We want to show FAB only when on the main index pages
    const mainTabs = ['(discover)', '(feed)', '(social)', '(profile)'];

    // Check if we're on a main tab and at the index level (no further segments)
    if (segments.length === 2) {
      const currentTab = segments[1];
      return mainTabs.includes(currentTab);
    }

    // For (discover), check if it's index.tsx (no third segment or third segment is 'index')
    if (segments.length === 3 && (segments[2] as string) === 'index') {
      return mainTabs.includes(segments[1]);
    }

    return false;
  }, [segments]);

  const handleFABPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowActionModal(true);
  }, []);

  const handleFABLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!isAuthenticated) {
      setAuthGateMessage('Sign up to identify tracks playing nearby.');
      setShowAuthGate(true);
      return;
    }
    setShowContinuousIdentifyModal(true);
  }, [isAuthenticated]);

  const handleAddSet = () => {
    setShowActionModal(false);
    if (!isAuthenticated) {
      setAuthGateMessage('Sign up to submit and identify DJ sets.');
      setShowAuthGate(true);
      return;
    }
    router.push('/(tabs)/(submit)');
  };

  const handleIdentify = () => {
    setShowActionModal(false);
    if (!isAuthenticated) {
      setAuthGateMessage('Sign up to identify tracks playing nearby.');
      setShowAuthGate(true);
      return;
    }
    setShowIdentifyModal(true);
  };

  const handleRecordSet = () => {
    setShowActionModal(false);
    if (!isAuthenticated) {
      setAuthGateMessage('Sign up to record and identify live sets.');
      setShowAuthGate(true);
      return;
    }
    setShowRecordModal(true);
  };

  const handleRecordingStart = () => {
    setIsRecordingSet(true);
    setRecordingStartTime(new Date());
    setRecordingTrackCount(0);
  };

  const handleRecordingEnd = (tracks: IdentifiedTrack[], sid: string | null) => {
    if (sid) {
      lastSessionIdRef.current = sid;
    }
    setIsRecordingSet(false);
    setRecordingStartTime(null);
    setRecordingTrackCount(0);
  };

  const handleSaveAsSet = useCallback(async (tracks: IdentifiedTrack[], name: string, djName?: string, venue?: string) => {
    const sid = lastSessionIdRef.current;
    if (!sid) {
      console.error('[Layout] No session ID to save as set');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_as_set',
          title: name,
          dj_name: djName || undefined,
          venue: venue || undefined,
        }),
      });
      const data = await response.json();
      if (data.success && data.setId) {
        lastSessionIdRef.current = null;
        router.push(`/(tabs)/(discover)/${data.setId}`);
      }
    } catch (e) {
      console.error('[Layout] Failed to save as set:', e);
    }
  }, [router]);

  const handleStopFromBanner = async () => {
    // Capture sessionId before stopSetRecording clears it
    const status = getRecordingStatus();
    if (status.sessionId) {
      lastSessionIdRef.current = status.sessionId;
    }
    const result = await stopSetRecording();
    setIsRecordingSet(false);
    setRecordingStartTime(null);
    setRecordingTrackCount(0);
    // Open modal to show results
    setShowRecordModal(true);
  };

  // Poll track count while recording
  useEffect(() => {
    if (!isRecordingSet) return;
    const interval = setInterval(() => {
      const status = getRecordingStatus();
      setRecordingTrackCount(status.trackCount);
    }, 2000);
    return () => clearInterval(interval);
  }, [isRecordingSet]);

  // Gate certain tabs for unauthenticated users
  const gatedTabs = ['(social)', '(profile)'];
  const gateMessages: Record<string, string> = {
    '(social)': 'Sign up to save tracks to your Crate and build your collection.',
    '(profile)': 'Sign up to create your DJ profile and track your activity.',
  };

  const handleTabPress = (tabName: string, e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (gatedTabs.includes(tabName) && !isAuthenticated) {
      e.preventDefault();
      setAuthGateMessage(gateMessages[tabName] || '');
      setShowAuthGate(true);
      return;
    }

    if (tabName === '(feed)' && segments[1] === '(feed)') {
      // Already on feed — scroll to top and refresh
      refreshFeed();
    } else if (tabName !== '(feed)') {
      // Switching away from feed — stop audio
      stopFeedAudio();
    }
  };

  return (
    <View style={styles.container}>
      {isRecordingSet && recordingStartTime && (
        <SetRecordingBanner
          startTime={recordingStartTime}
          trackCount={recordingTrackCount}
          onPress={() => setShowRecordModal(true)}
          onStop={handleStopFromBanner}
        />
      )}
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="(feed)"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarItemStyle: { flex: 1, overflow: 'visible', justifyContent: 'center', alignItems: 'center' },
          tabBarIcon: ({ focused }) => (
            <View style={{ overflow: 'visible', minWidth: 60, alignItems: 'center', marginTop: -4 }}>
              <Text style={{
                color: focused ? '#C41E3A' : 'rgba(255, 255, 255, 0.5)',
                fontSize: 18,
                fontWeight: '900',
                letterSpacing: -0.3,
              }}>
                trakd
              </Text>
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => handleTabPress('(feed)', e),
        }}
      />
      <Tabs.Screen
        name="(submit)"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="(discover)"
        options={{
          title: 'Dig',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
          tabBarItemStyle: { flex: 1 },
        }}
        listeners={{
          tabPress: (e) => handleTabPress('(discover)', e),
        }}
      />
      <Tabs.Screen
        name="(social)"
        options={{
          title: 'Crate',
          tabBarIcon: ({ color, size }) => <Archive size={size} color={color} />,
          tabBarItemStyle: { flex: 1 },
        }}
        listeners={{
          tabPress: (e) => handleTabPress('(social)', e),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          tabBarItemStyle: { flex: 1 },
        }}
        listeners={{
          tabPress: (e) => handleTabPress('(profile)', e),
        }}
      />
      <Tabs.Screen
        name="(library)"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>

      {showFAB && <VinylFAB onPress={handleFABPress} onLongPress={handleFABLongPress} />}

      <FABActionModal
        visible={showActionModal}
        onClose={() => setShowActionModal(false)}
        onAddSet={handleAddSet}
        onIdentify={handleIdentify}
        onRecordSet={handleRecordSet}
      />

      <LiveIdentifyModal
        visible={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
      />

      <LiveIdentifyModal
        visible={showContinuousIdentifyModal}
        onClose={() => setShowContinuousIdentifyModal(false)}
        continuousMode={true}
      />

      <SetRecordingModal
        visible={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onRecordingStart={handleRecordingStart}
        onRecordingEnd={handleRecordingEnd}
        onSaveAsSet={handleSaveAsSet}
        isRecordingActive={isRecordingSet}
      />

      <AuthGateModal
        visible={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        message={authGateMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: '#0A0A0A',
    borderTopColor: '#1A1A1A',
    borderTopWidth: 1,
    paddingTop: 8,
    height: 85,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    zIndex: 100,
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylGroove1: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.25)',
  },
  vinylGroove2: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.35)',
  },
  vinylGroove3: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.45)',
  },
  spinCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: Colors.dark.primary,
    borderRightColor: 'rgba(196, 30, 58, 0.5)',
  },
  fabCenter: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    color: Colors.dark.background,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  fabTextD: {
    fontWeight: '900',
    fontSize: 12,
  },
});
