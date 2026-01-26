import { Tabs, useRouter, useSegments } from 'expo-router';
import { Disc3, Rss, Users, Plus, User } from 'lucide-react-native';
import { StyleSheet, View, Pressable, Animated, Easing } from 'react-native';
import { useRef, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import FABActionModal from '@/components/FABActionModal';
import LiveIdentifyModal from '@/components/LiveIdentifyModal';

// Animated Vinyl FAB with Plus
const VinylFAB = ({ onPress }: { onPress: () => void }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous rotation
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Subtle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable style={styles.fab} onPress={onPress}>
      <Animated.View style={[styles.fabOuter, { transform: [{ scale: pulse }] }]}>
        {/* Vinyl grooves */}
        <Animated.View style={[styles.vinylDisc, { transform: [{ rotate: spin }] }]}>
          <View style={styles.groove1} />
          <View style={styles.groove2} />
          <View style={styles.groove3} />
        </Animated.View>
        {/* Center label with plus */}
        <View style={styles.centerLabel}>
          <Plus size={18} color="#fff" strokeWidth={3} />
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [showActionModal, setShowActionModal] = useState(false);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);

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
          title: 'Social',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: Colors.dark.surface,
    borderTopColor: Colors.dark.border,
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
  },
  fabOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  vinylDisc: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groove1: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  groove2: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  groove3: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  centerLabel: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
