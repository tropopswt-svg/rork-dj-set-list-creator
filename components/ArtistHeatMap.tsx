import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { WORLD_MAP_PATH } from '@/constants/worldMap';

// Only import react-native-maps on native platforms
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps.MapView || null;
    Marker = Maps.Marker || null;
    Callout = Maps.Callout || null;
  } catch (e) {
    // react-native-maps not available
  }
}

const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';
const { width: screenWidth } = Dimensions.get('window');
const CIRCOLOCO_RED = '#C41E3A';

// Convert lat/lng to SVG coordinates (equirectangular, viewBox 0 0 1000 500)
function toSvgCoords(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng + 180) / 360 * 1000,
    y: (90 - lat) / 180 * 500,
  };
}

// Major cities/capitals for map labels
const MAP_LABELS = [
  { name: 'London', lat: 51.51, lng: -0.13 },
  { name: 'Berlin', lat: 52.52, lng: 13.41 },
  { name: 'Paris', lat: 48.86, lng: 2.35 },
  { name: 'Amsterdam', lat: 52.37, lng: 4.90 },
  { name: 'Ibiza', lat: 38.91, lng: 1.43 },
  { name: 'New York', lat: 40.71, lng: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Tokyo', lat: 35.68, lng: 139.69 },
  { name: 'Sydney', lat: -33.87, lng: 151.21 },
  { name: 'São Paulo', lat: -23.55, lng: -46.63 },
  { name: 'Dubai', lat: 25.20, lng: 55.27 },
  { name: 'Mumbai', lat: 19.08, lng: 72.88 },
  { name: 'Lagos', lat: 6.52, lng: 3.38 },
  { name: 'Miami', lat: 25.76, lng: -80.19 },
  { name: 'Barcelona', lat: 41.39, lng: 2.17 },
  { name: 'Moscow', lat: 55.76, lng: 37.62 },
  { name: 'Detroit', lat: 42.33, lng: -83.05 },
  { name: 'Manchester', lat: 53.48, lng: -2.24 },
  { name: 'Mexico City', lat: 19.43, lng: -99.13 },
  { name: 'Seoul', lat: 37.57, lng: 126.98 },
  { name: 'Bangkok', lat: 13.76, lng: 100.50 },
  { name: 'Cape Town', lat: -33.93, lng: 18.42 },
  { name: 'Buenos Aires', lat: -34.60, lng: -58.38 },
];

// Pulsing red dot marker for native map pins
function PulsingPin() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={pinStyles.container}>
      <Animated.View
        style={[
          pinStyles.pulseRing,
          { transform: [{ scale: pulse }], opacity: pulse.interpolate({ inputRange: [1, 1.8], outputRange: [0.6, 0] }) },
        ]}
      />
      <View style={pinStyles.dot} />
    </View>
  );
}

// Pulsing SVG dot for the SVG fallback map
function PulsingSvgPin({ x, y }: { x: number; y: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, [pulse]);

  const AnimatedCircle = Animated.createAnimatedComponent(Circle);
  const animatedR = pulse.interpolate({ inputRange: [0, 1], outputRange: [4, 10] });
  const animatedOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <>
      <AnimatedCircle cx={x} cy={y} r={animatedR} fill={CIRCOLOCO_RED} opacity={animatedOpacity} />
      <Circle cx={x} cy={y} r={3.5} fill={CIRCOLOCO_RED} stroke="#fff" strokeWidth={1} />
    </>
  );
}

const pinStyles = StyleSheet.create({
  container: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: CIRCOLOCO_RED },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: CIRCOLOCO_RED, borderWidth: 1.5, borderColor: '#fff' },
});

interface VenueData {
  name: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  setsCount: number;
  lastSetDate?: string;
}

interface ArtistHeatMapProps {
  artistId?: string;
  artistSlug?: string;
  backgroundMode?: boolean;
}

export default function ArtistHeatMap({ artistId, artistSlug, backgroundMode }: ArtistHeatMapProps) {
  const [venues, setVenues] = useState<VenueData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    fetchVenues();
  }, [artistId, artistSlug]);

  const fetchVenues = async () => {
    if (!artistId && !artistSlug) return;
    setIsLoading(true);
    try {
      const params = artistId
        ? `artistId=${artistId}`
        : `artistSlug=${artistSlug}`;
      const response = await fetch(`${API_BASE_URL}/api/artists/venues?${params}`);
      if (!response.ok) {
        if (__DEV__) console.warn('[ArtistHeatMap] API returned', response.status);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setVenues(data.venues || []);
      }
    } catch (error) {
      if (__DEV__) console.error('[ArtistHeatMap] Failed to fetch venues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate region to fit all markers
  const region = useMemo(() => {
    if (venues.length === 0) return null;

    const lats = venues.map(v => v.lat);
    const lngs = venues.map(v => v.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = Math.max(0.5, (maxLat - minLat) * 1.5);
    const lngDelta = Math.max(0.5, (maxLng - minLng) * 1.5);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [venues]);

  // Don't render if no venue data (unless background mode — show dark bg anyway)
  if (!backgroundMode && !isLoading && venues.length === 0) return null;

  // SVG world map — grey continents, labels, red pulsing pins
  const renderSvgMap = () => (
    <View style={backgroundMode ? styles.bgFallback : styles.fallbackMap}>
      <Svg
        viewBox="0 0 1000 500"
        style={backgroundMode ? StyleSheet.absoluteFill : { width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          {/* Subtle top-down gradient on continents for 3D depth */}
          <SvgGradient id="landGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#58585f" stopOpacity="1" />
            <Stop offset="1" stopColor="#3e3e44" stopOpacity="1" />
          </SvgGradient>
          {/* Vignette overlay */}
          <SvgGradient id="vignette" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.7" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.3" />
          </SvgGradient>
        </Defs>

        {/* Continent shapes with gradient fill + highlight stroke */}
        <Path d={WORLD_MAP_PATH} fill="url(#landGrad)" stroke="#6a6a70" strokeWidth={0.4} />

        {/* City labels */}
        {MAP_LABELS.map((label, idx) => {
          const { x, y } = toSvgCoords(label.lat, label.lng);
          return (
            <SvgText
              key={idx}
              x={x}
              y={y - 5}
              fill="rgba(255,255,255,0.25)"
              fontSize={7}
              fontWeight="500"
              textAnchor="middle"
            >
              {label.name}
            </SvgText>
          );
        })}

        {/* Pulsing venue pins */}
        {venues.map((venue, idx) => {
          const { x, y } = toSvgCoords(venue.lat, venue.lng);
          return <PulsingSvgPin key={idx} x={x} y={y} />;
        })}

        {/* Vignette for depth */}
        <Rect x="0" y="0" width="1000" height="500" fill="url(#vignette)" />
      </Svg>
    </View>
  );

  const renderNativeMap = () => {
    if (!MapView || !region) return renderSvgMap();

    return (
      <MapView
        style={backgroundMode ? styles.bgMap : styles.map}
        initialRegion={region}
        customMapStyle={darkMapStyle}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={!backgroundMode}
        zoomEnabled={!backgroundMode}
      >
        {venues.map((venue, idx) => (
          <Marker
            key={idx}
            coordinate={{ latitude: venue.lat, longitude: venue.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <PulsingPin />
            {Callout && !backgroundMode && (
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{venue.name}</Text>
                  <Text style={styles.calloutText}>
                    {venue.setsCount} set{venue.setsCount !== 1 ? 's' : ''}
                  </Text>
                  {venue.lastSetDate && (
                    <Text style={styles.calloutDate}>
                      Last: {new Date(venue.lastSetDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </Callout>
            )}
          </Marker>
        ))}
      </MapView>
    );
  };

  // Background mode: just the map, no chrome
  if (backgroundMode) {
    if (isLoading) {
      return <View style={styles.bgFallback} />;
    }
    // Always use SVG map in background mode for consistent grey look
    return renderSvgMap();
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setIsCollapsed(!isCollapsed)}>
        <View style={styles.headerLeft}>
          <MapPin size={16} color={Colors.dark.primary} />
          <Text style={styles.headerTitle}>Venue Map</Text>
          <View style={styles.venueBadge}>
            <Text style={styles.venueBadgeText}>{venues.length}</Text>
          </View>
        </View>
        {isCollapsed ? (
          <ChevronDown size={18} color={Colors.dark.textMuted} />
        ) : (
          <ChevronUp size={18} color={Colors.dark.textMuted} />
        )}
      </Pressable>

      {!isCollapsed && (
        isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.dark.primary} />
          </View>
        ) : (
          <View style={styles.mapContainer}>
            {renderNativeMap()}
          </View>
        )
      )}
    </View>
  );
}

// Greyed-out dark map styling — desaturated so red pins pop
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#2a2a2a' }, { saturation: -100 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#444444' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
];

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  venueBadge: {
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  venueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
  },
  mapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  callout: {
    padding: 8,
    minWidth: 120,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 12,
    color: '#666',
  },
  calloutDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  // Fallback styles
  fallbackMap: {
    backgroundColor: '#282830',
    borderRadius: 12,
    height: 220,
    marginTop: 8,
    overflow: 'hidden',
  },
  // Background mode styles
  bgMap: {
    ...StyleSheet.absoluteFillObject,
  },
  bgFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#282830',
  },
});
