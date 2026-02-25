import { Tabs, useRouter, useSegments } from 'expo-router';
import { Disc3, Rss, Archive, User, Search } from 'lucide-react-native';
import { StyleSheet, View, Pressable, Animated, Easing, Text } from 'react-native';
import React, { useRef, useEffect, useMemo, useState, useCallback, memo } from 'react';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import BubbleGlassLogo from '@/components/BubbleGlassLogo';
import FABActionModal from '@/components/FABActionModal';
import LiveIdentifyModal from '@/components/LiveIdentifyModal';
import SetRecordingModal from '@/components/SetRecordingModal';
import SetRecordingBanner from '@/components/SetRecordingBanner';
import { stopSetRecording, getRecordingStatus, IdentifiedTrack } from '@/components/SetRecordingService';

const API_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';
import { AuthGateModal } from '@/components/AuthGate';
import { stopFeedAudio, refreshFeed } from '@/lib/feedAudioController';
import { supabase } from '@/lib/supabase/client';

// Liquid glass FAB with BubbleGlassLogo — memoized to prevent animation restarts
const VinylFAB = memo(({ onPress, onLongPress }: { onPress: () => void; onLongPress?: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const innerRingAnim = useRef(new Animated.Value(0)).current;
  const ringPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous glow pulse — breathing red halo
    const glowPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.85,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.25,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    glowPulse.start();

    // Outer shimmer — continuous slow rotation
    const shimmerSpin = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmerSpin.start();

    // Inner ring — counter-rotation for depth
    const innerSpin = Animated.loop(
      Animated.timing(innerRingAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    innerSpin.start();

    // Ring scale pulse — rings breathe in/out
    const ringPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulseAnim, {
          toValue: 1.04,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulseAnim, {
          toValue: 0.97,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    ringPulse.start();

    // Glass face subtle scale pulse
    const scalePulse = Animated.loop(
      Animated.sequence([
        Animated.delay(6000),
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.97,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ])
    );
    scalePulse.start();

    return () => {
      glowPulse.stop();
      shimmerSpin.stop();
      innerSpin.stop();
      ringPulse.stop();
      scalePulse.stop();
    };
  }, []);

  const shimmerRotate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const innerRingRotate = innerRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <Pressable style={styles.fab} onPress={onPress} onLongPress={onLongPress} delayLongPress={500}>
      {/* Outer glow ring — breathing red pulse */}
      <Animated.View style={[styles.glowRing, { opacity: glowAnim, transform: [{ scale: ringPulseAnim }] }]} />
      {/* Outer spinning shimmer */}
      <Animated.View
        style={[
          styles.shimmerRing,
          { transform: [{ rotate: shimmerRotate }, { scale: ringPulseAnim }] },
        ]}
      />
      {/* Inner counter-rotating accent ring */}
      <Animated.View
        style={[
          styles.innerRing,
          { transform: [{ rotate: innerRingRotate }] },
        ]}
      />
      {/* 3D shadow */}
      <View style={styles.shadowLayer} />
      {/* Glass face with BubbleGlassLogo */}
      <Animated.View style={[styles.glassFace, { transform: [{ scale: scaleAnim }] }]}>
        <BubbleGlassLogo size="tiny" />
      </Animated.View>
    </Pressable>
  );
});

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  // Use ref for isAuthenticated — only needed in event handlers, not render output.
  // Avoids re-rendering the entire tab navigator on every auth state change.
  const isAuthenticatedRef = useRef(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      isAuthenticatedRef.current = !!session?.user;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      isAuthenticatedRef.current = !!session?.user;
    });
    return () => subscription.unsubscribe();
  }, []);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [showContinuousIdentifyModal, setShowContinuousIdentifyModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isRecordingSet, setIsRecordingSet] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [recordingTrackCount, setRecordingTrackCount] = useState(0);
  const [showAuthGate, setShowAuthGate] = useState(false);
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
    if (!isAuthenticatedRef.current) {
      setShowAuthGate(true);
      return;
    }
    setShowContinuousIdentifyModal(true);
  }, []);

  const handleAddSet = () => {
    setShowActionModal(false);
    if (!isAuthenticatedRef.current) {
      setShowAuthGate(true);
      return;
    }
    router.push('/(tabs)/(submit)');
  };

  const handleIdentify = () => {
    setShowActionModal(false);
    if (!isAuthenticatedRef.current) {
      setShowAuthGate(true);
      return;
    }
    setShowIdentifyModal(true);
  };

  const handleRecordSet = () => {
    setShowActionModal(false);
    if (!isAuthenticatedRef.current) {
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

  const handleTabPress = (tabName: string, e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (gatedTabs.includes(tabName) && !isAuthenticatedRef.current) {
      e.preventDefault();
      setShowAuthGate(true);
      return;
    }

    if (tabName === '(feed)' && segments[1] === '(feed)') {
      // Already on feed — scroll to top and refresh
      refreshFeed();
    } else if (tabName === '(discover)' && segments[1] === '(discover)' && segments.length > 2) {
      // Already on discover but deep in stack — pop back to index
      e.preventDefault();
      router.replace('/(tabs)/(discover)');
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
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(196, 30, 58, 0.45)',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  shimmerRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.35)',
    borderRightColor: 'rgba(196, 30, 58, 0.3)',
    borderBottomColor: 'rgba(196, 30, 58, 0.1)',
  },
  innerRing: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'transparent',
    borderTopColor: 'rgba(196, 30, 58, 0.2)',
    borderLeftColor: 'rgba(255,255,255,0.15)',
  },
  shadowLayer: {
    position: 'absolute',
    top: 11,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(80, 10, 20, 0.4)',
  },
  glassFace: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.2)',
    borderTopColor: 'rgba(255,255,255,0.25)',
    borderBottomColor: 'rgba(196, 30, 58, 0.1)',
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
