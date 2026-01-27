import { Tabs, useRouter, useSegments } from 'expo-router';
import { Disc3, Rss, Users, Plus, User } from 'lucide-react-native';
import { StyleSheet, View, Pressable, Animated, Easing } from 'react-native';
import { useRef, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import FABActionModal from '@/components/FABActionModal';
import LiveIdentifyModal from '@/components/LiveIdentifyModal';

// Animated Vinyl FAB with spinning ring (like a record)
const VinylFAB = ({ onPress }: { onPress: () => void }) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous rotation like a vinyl record
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable style={styles.fab} onPress={onPress}>
      {/* Spinning vinyl ring */}
      <Animated.View style={[styles.vinylRing, { transform: [{ rotate: spin }] }]} />
      {/* Static center with plus icon */}
      <View style={styles.fabCenter}>
        <Plus size={22} color={Colors.dark.background} strokeWidth={3} />
      </View>
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
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylRing: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: Colors.dark.primary,
    borderTopColor: 'transparent',
    borderRightColor: 'rgba(226, 29, 72, 0.3)',
  },
  fabCenter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});
