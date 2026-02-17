import { Tabs, useRouter, useSegments } from 'expo-router';
import { Disc3, Rss, Archive, User } from 'lucide-react-native';
import { StyleSheet, View, Pressable, Animated, Easing, Text } from 'react-native';
import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import FABActionModal from '@/components/FABActionModal';
import LiveIdentifyModal from '@/components/LiveIdentifyModal';
import { AuthGateModal } from '@/components/AuthGate';
import { useAuth } from '@/contexts/AuthContext';

// Animated Vinyl FAB with TRACK'D text - TRACK wraps around, D in center
const VinylFAB = ({ onPress }: { onPress: () => void }) => {
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

  // Letters for TRACK' centered at top of button
  const trackLetters = ['T', 'R', 'A', 'C', 'K', "'"];
  const radius = 24; // Distance from center to letters
  const angleSpan = 100; // Smaller arc centered at top
  const startAngle = -90 - (angleSpan / 2); // Center around top (-90 degrees)
  const angleStep = angleSpan / (trackLetters.length - 1);

  return (
    <Pressable style={styles.fab} onPress={onPress}>
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
      {/* TRACK' letters wrapped around the center */}
      {trackLetters.map((letter, index) => {
        const angle = startAngle + (index * angleStep);
        const angleRad = (angle * Math.PI) / 180;
        const x = Math.cos(angleRad) * radius;
        const y = Math.sin(angleRad) * radius;
        return (
          <Text
            key={index}
            style={[
              styles.trackLetter,
              {
                transform: [
                  { translateX: x },
                  { translateY: y },
                  { rotate: `${angle + 90}deg` },
                ],
              },
            ]}
          >
            {letter}
          </Text>
        );
      })}
      {/* Center with D - pulses */}
      <Animated.View style={[styles.fabCenter, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.fabText}>D</Text>
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
    if (segments.length === 3 && segments[2] === 'index') {
      return mainTabs.includes(segments[1]);
    }

    return false;
  }, [segments]);

  const handleFABPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isAuthenticated) {
      setAuthGateMessage('Sign up to import sets and identify tracks from your favorite DJ mixes.');
      setShowAuthGate(true);
      return;
    }
    setShowActionModal(true);
  };

  const handleAddSet = () => {
    setShowActionModal(false);
    router.push('/(tabs)/(submit)');
  };

  const handleIdentify = () => {
    setShowActionModal(false);
    setShowIdentifyModal(true);
  };

  // Gate certain tabs for unauthenticated users
  const handleTabPress = (tabName: string, e: any) => {
    const gatedTabs = ['(profile)', '(social)'];
    if (gatedTabs.includes(tabName) && !isAuthenticated) {
      e.preventDefault();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAuthGateMessage(
        tabName === '(profile)'
          ? 'Create an account to build your music profile and track your contributions.'
          : 'Sign up to build your crate with saved sets and identified tracks.'
      );
      setShowAuthGate(true);
    }
  };

  return (
    <View style={styles.container}>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.textMuted,
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

      {showFAB && <VinylFAB onPress={handleFABPress} />}

      <FABActionModal
        visible={showActionModal}
        onClose={() => setShowActionModal(false)}
        onAddSet={handleAddSet}
        onIdentify={handleIdentify}
      />

      <LiveIdentifyModal
        visible={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
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
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  trackLetter: {
    position: 'absolute',
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '800',
  },
});
