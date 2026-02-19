import { Tabs, useRouter, useSegments } from 'expo-router';
import { Disc3, Rss, Archive, User } from 'lucide-react-native';
import { StyleSheet, View, Pressable, Animated, Easing, Text } from 'react-native';
import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import FABActionModal from '@/components/FABActionModal';
import LiveIdentifyModal from '@/components/LiveIdentifyModal';
import SetRecordingModal from '@/components/SetRecordingModal';
import SetRecordingBanner from '@/components/SetRecordingBanner';
import { stopSetRecording, getRecordingStatus, IdentifiedTrack } from '@/components/SetRecordingService';
import { AuthGateModal } from '@/components/AuthGate';
import { useAuth } from '@/contexts/AuthContext';

// Animated Vinyl FAB with "trackd" text in center
const VinylFAB = ({ onPress, onLongPress }: { onPress: () => void; onLongPress?: () => void }) => {
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
};

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

  const handleFABPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowActionModal(true);
  };

  const handleFABLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowContinuousIdentifyModal(true);
  };

  const handleAddSet = () => {
    setShowActionModal(false);
    router.push('/(tabs)/(submit)');
  };

  const handleIdentify = () => {
    setShowActionModal(false);
    setShowIdentifyModal(true);
  };

  const handleRecordSet = () => {
    setShowActionModal(false);
    setShowRecordModal(true);
  };

  const handleRecordingStart = () => {
    setIsRecordingSet(true);
    setRecordingStartTime(new Date());
    setRecordingTrackCount(0);
  };

  const handleRecordingEnd = (tracks: IdentifiedTrack[]) => {
    setIsRecordingSet(false);
    setRecordingStartTime(null);
    setRecordingTrackCount(0);
  };

  const handleStopFromBanner = async () => {
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
  // TODO: Re-enable auth gate after testing
  const handleTabPress = (tabName: string, e: any) => {
    // Auth gate disabled for testing
    // const gatedTabs = ['(profile)', '(social)'];
    // if (gatedTabs.includes(tabName) && !isAuthenticated) {
    //   e.preventDefault();
    //   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    //   setAuthGateMessage(
    //     tabName === '(profile)'
    //       ? 'Create an account to build your music profile and track your contributions.'
    //       : 'Sign up to build your crate with saved sets and identified tracks.'
    //   );
    //   setShowAuthGate(true);
    // }
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
        name="(discover)"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Disc3 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(feed)"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Rss size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(submit)"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(social)"
        options={{
          title: 'Crate',
          tabBarIcon: ({ color, size }) => <Archive size={size} color={color} />,
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
        }}
        listeners={{
          tabPress: (e) => handleTabPress('(profile)', e),
        }}
      />
      <Tabs.Screen
        name="(library)"
        options={{
          href: null,
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
