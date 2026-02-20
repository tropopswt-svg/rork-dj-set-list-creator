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
import { WebView } from 'react-native-webview';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react-native';
import Colors from '@/constants/colors';

const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';
const { width: screenWidth } = Dimensions.get('window');
const CIRCOLOCO_RED = '#C41E3A';

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

// Build Leaflet HTML with grey tiles, auto-zoom to venues, pulsing red markers
function buildLeafletHtml(venues: VenueData[], interactive: boolean = true): string {
  const markers = venues.map(v => `[${v.lat}, ${v.lng}, "${v.name.replace(/"/g, '\\"')}", ${v.setsCount}]`).join(',');

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; }
  html, body, #map { width: 100%; height: 100%; background: #1a1a1e; }
  .leaflet-container { background: #1a1a1e !important; }
  .leaflet-control-zoom, .leaflet-control-attribution { display: none !important; }

  @keyframes pulse {
    0% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
    100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
  }
  .venue-marker {
    position: relative;
    width: 12px; height: 12px;
  }
  .venue-dot {
    width: 12px; height: 12px; border-radius: 50%;
    background: ${CIRCOLOCO_RED}; border: 2px solid rgba(255,255,255,0.8);
    position: absolute; top: 0; left: 0; z-index: 2;
  }
  .venue-pulse {
    width: 12px; height: 12px; border-radius: 50%;
    background: ${CIRCOLOCO_RED};
    position: absolute; top: 0; left: 0;
    left: 50%; top: 50%;
    animation: pulse 2s ease-out infinite;
  }

  /* Invisible zoom touch zone on right edge */
  .zoom-zone {
    position: absolute;
    right: 0;
    top: 0;
    width: 44px;
    height: 100%;
    z-index: 1000;
    touch-action: none;
  }
  .zoom-indicator {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 60px;
    border-radius: 2px;
    background: rgba(255,255,255,0.15);
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .zoom-indicator.active {
    opacity: 1;
  }
  .zoom-indicator-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    border-radius: 2px;
    background: ${CIRCOLOCO_RED};
  }
</style>
</head><body>
<div id="map"></div>
<div class="zoom-zone" id="zoomZone">
  <div class="zoom-indicator" id="zoomInd">
    <div class="zoom-indicator-fill" id="zoomFill"></div>
  </div>
</div>
<script>
  var venues = [${markers}];
  var map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    dragging: ${interactive},
    scrollWheelZoom: ${interactive},
    doubleClickZoom: ${interactive},
    touchZoom: ${interactive},
    boxZoom: false,
    keyboard: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, opacity: 0.6
  }).addTo(map);

  var bounds = [];
  venues.forEach(function(v) {
    var icon = L.divIcon({
      className: '',
      html: '<div class="venue-marker"><div class="venue-pulse"></div><div class="venue-dot"></div></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker([v[0], v[1]], { icon: icon, interactive: ${interactive} })
      ${interactive ? '.bindPopup("<b>" + v[2] + "</b><br>" + v[3] + " set" + (v[3]!==1?"s":""))' : ''}
      .addTo(map);
    bounds.push([v[0], v[1]]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  } else {
    map.setView([30, 0], 2);
  }

  // Invisible edge-swipe zoom
  var zone = document.getElementById('zoomZone');
  var ind = document.getElementById('zoomInd');
  var fill = document.getElementById('zoomFill');
  var startY = 0;
  var startZoom = 0;
  var dragging = false;
  var hideTimer = null;

  function updateFill() {
    var min = map.getMinZoom();
    var max = map.getMaxZoom();
    var pct = ((map.getZoom() - min) / (max - min)) * 100;
    fill.style.height = pct + '%';
  }

  function showInd() {
    ind.classList.add('active');
    updateFill();
    clearTimeout(hideTimer);
  }

  function hideInd() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function() {
      if (!dragging) ind.classList.remove('active');
    }, 800);
  }

  zone.addEventListener('touchstart', function(e) {
    dragging = true;
    startY = e.touches[0].clientY;
    startZoom = map.getZoom();
    showInd();
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });

  zone.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    var dy = startY - e.touches[0].clientY;
    var newZoom = startZoom + dy / 40;
    newZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), newZoom));
    map.setZoom(newZoom);
    updateFill();
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });

  zone.addEventListener('touchend', function() {
    dragging = false;
    hideInd();
  });

  map.on('zoom', function() { updateFill(); });
  setTimeout(updateFill, 500);
</script>
</body></html>`;
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

  // Don't render if no venue data (unless background mode — show dark bg anyway)
  if (!backgroundMode && !isLoading && venues.length === 0) return null;

  const leafletHtml = useMemo(
    () => buildLeafletHtml(venues, true),
    [venues]
  );

  const renderMap = () => (
    <WebView
      source={{ html: leafletHtml }}
      style={backgroundMode ? styles.bgMap : styles.map}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      javaScriptEnabled
      originWhitelist={['*']}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    />
  );

  // Background mode: just the map, no chrome
  if (backgroundMode) {
    if (isLoading) {
      return <View style={styles.bgFallback} />;
    }
    return (
      <View style={StyleSheet.absoluteFill}>
        {renderMap()}
      </View>
    );
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
  bgMap: {
    ...StyleSheet.absoluteFillObject,
  },
  bgFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1e',
  },
});
