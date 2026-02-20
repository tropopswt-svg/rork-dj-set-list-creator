import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react-native';
import Colors from '@/constants/colors';

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

  // Get marker color based on frequency
  const getMarkerColor = (setsCount: number) => {
    if (setsCount >= 5) return '#EF4444'; // Red - frequent
    if (setsCount >= 3) return '#F97316'; // Orange
    if (setsCount >= 2) return '#FBBF24'; // Yellow
    return Colors.dark.textMuted; // Muted - single appearance
  };

  // Don't render if no venue data (unless background mode — show dark bg anyway)
  if (!backgroundMode && !isLoading && venues.length === 0) return null;

  // Fallback if react-native-maps not available
  const renderFallbackMap = () => (
    <View style={backgroundMode ? styles.bgFallback : styles.fallbackMap}>
      {!backgroundMode && (
        <>
          <MapPin size={32} color={Colors.dark.textMuted} />
          <Text style={styles.fallbackText}>
            {venues.length} venue{venues.length !== 1 ? 's' : ''}
          </Text>
        </>
      )}
      {venues.map((venue, idx) => (
        <View key={idx} style={backgroundMode ? styles.bgFallbackDotContainer : styles.fallbackVenueItem}>
          {backgroundMode ? (
            <View
              style={[
                styles.bgFallbackDot,
                { backgroundColor: getMarkerColor(venue.setsCount) },
              ]}
            />
          ) : (
            <>
              <View style={[styles.fallbackDot, { backgroundColor: getMarkerColor(venue.setsCount) }]} />
              <Text style={styles.fallbackVenueName}>{venue.name}</Text>
              <Text style={styles.fallbackVenueCount}>
                {venue.setsCount} set{venue.setsCount !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </View>
      ))}
    </View>
  );

  const renderMap = () => {
    if (!MapView || !region) return renderFallbackMap();

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
            pinColor={getMarkerColor(venue.setsCount)}
          >
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
    return renderMap();
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
            {renderMap()}
          </View>
        )
      )}
    </View>
  );
}

// Dark map styling for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
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
  // Fallback styles (when react-native-maps not installed)
  fallbackMap: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    alignItems: 'center',
    gap: 12,
  },
  fallbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  fallbackVenueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 4,
  },
  fallbackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fallbackVenueName: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.text,
  },
  fallbackVenueCount: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  // Background mode styles
  bgMap: {
    ...StyleSheet.absoluteFillObject,
  },
  bgFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
  },
  bgFallbackDotContainer: {
    position: 'absolute' as const,
  },
  bgFallbackDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
});
