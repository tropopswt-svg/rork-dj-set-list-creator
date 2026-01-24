import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Link2, TrendingUp, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SetFeedCard from '@/components/SetFeedCard';
import ImportSetModal from '@/components/ImportSetModal';
import { mockSetLists } from '@/mocks/tracks';
import { SetList } from '@/types';
import { useDebounce } from '@/utils/hooks';
import { ImportResult } from '@/services/importService';

// Animated IDentified Logo Component with Scanner Effect
const IDentifiedLogo = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scannerAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Scanner bar sweeping across ID
    Animated.loop(
      Animated.sequence([
        Animated.timing(scannerAnim, { 
          toValue: 1, 
          duration: 800, 
          easing: Easing.inOut(Easing.ease), 
          useNativeDriver: true 
        }),
        Animated.delay(300),
        Animated.timing(scannerAnim, { 
          toValue: 0, 
          duration: 800, 
          easing: Easing.inOut(Easing.ease), 
          useNativeDriver: true 
        }),
        Animated.delay(500),
      ])
    ).start();

    // Glow pulse synced with scanner
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.8, duration: 400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    ).start();

    // Horizontal scan line effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Scanner bar translation (sweeps left to right across ID)
  const scannerTranslate = scannerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 50],
  });

  // Scan line translation (vertical sweep)
  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-12, 12, -12],
  });

  return (
    <Animated.View style={[logoStyles.container, { transform: [{ scale: pulseAnim }] }]}>
      {/* Main Logo */}
      <View style={logoStyles.logoWrapper}>
        {/* The ID part with scanner effect */}
        <View style={logoStyles.idScannerContainer}>
          {/* Glow background */}
          <Animated.View style={[logoStyles.idGlowBg, { opacity: glowAnim }]} />
          
          {/* Scanner corner brackets */}
          <View style={[logoStyles.scannerCorner, logoStyles.cornerTL]} />
          <View style={[logoStyles.scannerCorner, logoStyles.cornerTR]} />
          <View style={[logoStyles.scannerCorner, logoStyles.cornerBL]} />
          <View style={[logoStyles.scannerCorner, logoStyles.cornerBR]} />
          
          {/* ID Text */}
          <Text style={logoStyles.idText}>ID</Text>
          
          {/* Vertical scanning bar */}
          <Animated.View 
            style={[
              logoStyles.scannerBar,
              { transform: [{ translateX: scannerTranslate }] }
            ]} 
          />
          
          {/* Horizontal scan line */}
          <Animated.View 
            style={[
              logoStyles.scanLine,
              { transform: [{ translateY: scanLineTranslate }] }
            ]} 
          />
        </View>
        
        {/* entified part */}
        <Text style={logoStyles.entifiedText}>entified</Text>
      </View>
    </Animated.View>
  );
};

const logoStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // ID Scanner container with visual scanning effect
  idScannerContainer: {
    width: 50,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginRight: 2,
  },
  idGlowBg: {
    position: 'absolute',
    width: 44,
    height: 26,
    backgroundColor: Colors.dark.primary,
    borderRadius: 6,
  },
  // Scanner corner brackets
  scannerCorner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderColor: Colors.dark.primary,
    borderWidth: 2,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  idText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.dark.primary,
    letterSpacing: -0.5,
    zIndex: 2,
  },
  // Vertical scanner bar that sweeps across
  scannerBar: {
    position: 'absolute',
    width: 3,
    height: 36,
    backgroundColor: Colors.dark.primary,
    opacity: 0.9,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  // Horizontal scan line
  scanLine: {
    position: 'absolute',
    width: 54,
    height: 2,
    backgroundColor: Colors.dark.primary,
    opacity: 0.5,
  },
  entifiedText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
});

type FilterType = 'trending' | 'recent';

export default function DiscoverScreen() {
  const router = useRouter();
  const [setLists, setSetLists] = useState<SetList[]>(mockSetLists);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState<FilterType>('trending');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleImport = (result: ImportResult) => {
    if (!result.success || !result.setList) {
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setSetLists([result.setList, ...setLists]);
    setShowImportModal(false);

    router.push(`/(tabs)/(discover)/${result.setList.id}`);
  };

  const filteredSets = useMemo(() => {
    return setLists
      .filter(set => {
        if (!debouncedSearchQuery) return true;
        const query = debouncedSearchQuery.toLowerCase();
        return (
          set.name.toLowerCase().includes(query) ||
          set.artist.toLowerCase().includes(query) ||
          set.venue?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (activeFilter === 'trending') {
          return (b.plays || 0) - (a.plays || 0);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [setLists, debouncedSearchQuery, activeFilter]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <IDentifiedLogo />
          <View style={styles.headerSpacer}>
            <Pressable 
              style={styles.addButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowImportModal(true);
              }}
            >
              <Link2 size={18} color={Colors.dark.background} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.dark.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sets, artists, venues..."
            placeholderTextColor={Colors.dark.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          <Pressable 
            style={[styles.filterChip, activeFilter === 'trending' && styles.filterChipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveFilter('trending');
            }}
          >
            <TrendingUp size={14} color={activeFilter === 'trending' ? Colors.dark.background : Colors.dark.textSecondary} />
            <Text style={[styles.filterText, activeFilter === 'trending' && styles.filterTextActive]}>Trending</Text>
          </Pressable>
          <Pressable 
            style={[styles.filterChip, activeFilter === 'recent' && styles.filterChipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveFilter('recent');
            }}
          >
            <Clock size={14} color={activeFilter === 'recent' ? Colors.dark.background : Colors.dark.textSecondary} />
            <Text style={[styles.filterText, activeFilter === 'recent' && styles.filterTextActive]}>Recent</Text>
          </Pressable>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.dark.primary}
            />
          }
        >
          {filteredSets.map(setList => (
            <SetFeedCard 
              key={setList.id} 
              setList={setList}
              onPress={() => router.push(`/(tabs)/(discover)/${setList.id}`)}
            />
          ))}

          {filteredSets.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Search size={32} color={Colors.dark.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No sets found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different search or import a new set
              </Text>
            </View>
          )}
        </ScrollView>

        <ImportSetModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
      </SafeAreaView>
    </View>
  );
}

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
    width: 44,
    alignItems: 'flex-end',
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.dark.text,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  filterTextActive: {
    color: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
