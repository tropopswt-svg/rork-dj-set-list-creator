import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

// Event/Festival/Radio Show badge configurations
const EVENT_BADGES: Record<string, {
  label: string;
  shortLabel: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  isWide?: boolean; // For badges with more characters
  isEmoji?: boolean; // For emoji-based badges
  fontStyle?: 'normal' | 'italic' | 'handwritten'; // Special font styles
  hasSkyline?: boolean; // Special Chicago skyline background
  hasRadioSubtext?: boolean; // Show "RADIO" text below the main label
}> = {
  'circoloco': {
    label: 'Circoloco',
    shortLabel: 'C',
    backgroundColor: '#C41E3A', // Circoloco red
    textColor: '#F5E6D3', // Cream/off-white like their branding
    fontStyle: 'handwritten',
  },
  'circoloco-radio': {
    label: 'Circoloco Radio',
    shortLabel: 'C',
    backgroundColor: '#C41E3A', // Same Circoloco red
    textColor: '#F5E6D3', // Cream/off-white
    fontStyle: 'handwritten',
    hasRadioSubtext: true,
  },
  'bbc-radio-1': {
    label: 'BBC Radio 1',
    shortLabel: 'BBC1',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    isWide: true,
  },
  'coachella': {
    label: 'Coachella',
    shortLabel: '🌴',
    backgroundColor: '#FFE4B5', // Desert sand/golden
    textColor: '#000000',
    borderColor: '#DAA520',
    isEmoji: true,
  },
  'boiler-room': {
    label: 'Boiler Room',
    shortLabel: 'BR',
    backgroundColor: '#000000',
    textColor: '#00FF00', // Classic green terminal style
    borderColor: '#00FF00',
  },
  'cercle': {
    label: 'Cercle',
    shortLabel: '◯', // Circle symbol for Cercle
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  'defected': {
    label: 'Defected',
    shortLabel: 'D',
    backgroundColor: '#8B5CF6', // Defected purple
    textColor: '#FFFFFF',
  },
  'drumcode': {
    label: 'Drumcode',
    shortLabel: 'DC',
    backgroundColor: '#1C1C1C',
    textColor: '#C0C0C0',
    borderColor: '#C0C0C0',
  },
  'awakenings': {
    label: 'Awakenings',
    shortLabel: 'AW',
    backgroundColor: '#000000',
    textColor: '#00BFFF',
    borderColor: '#00BFFF',
  },
  'time-warp': {
    label: 'Time Warp',
    shortLabel: 'TW',
    backgroundColor: '#1A0033',
    textColor: '#FF00FF',
    borderColor: '#FF00FF',
  },
  'tomorrowland': {
    label: 'Tomorrowland',
    shortLabel: '🏰', // Castle representing the iconic mainstage
    backgroundColor: '#1A0A2E', // Deep purple/dark fantasy
    textColor: '#FFD700',
    borderColor: '#FFD700',
    isEmoji: true,
  },
  'burning-man': {
    label: 'Burning Man',
    shortLabel: '🏜️', // Desert
    backgroundColor: '#D2691E', // Desert brown/orange
    textColor: '#FFD700',
    borderColor: '#FF6B00',
    isEmoji: true,
  },
  'lollapalooza': {
    label: 'Lollapalooza',
    shortLabel: '🏙️', // Chicago skyline
    backgroundColor: '#1C1C1C',
    textColor: '#00D4FF',
    borderColor: '#00D4FF',
    isEmoji: true,
  },
  'ultra': {
    label: 'Ultra',
    shortLabel: 'U',
    backgroundColor: '#000000',
    textColor: '#00D4FF', // Ultra cyan/blue
    borderColor: '#00D4FF',
  },
  'dekmantel': {
    label: 'Dekmantel',
    shortLabel: 'DK',
    backgroundColor: '#FF6600', // Dekmantel orange
    textColor: '#FFFFFF',
  },
  'fabric': {
    label: 'Fabric',
    shortLabel: 'fab',
    backgroundColor: '#1A1A1A',
    textColor: '#FFFFFF',
    borderColor: '#333333',
    isWide: true,
  },
  'essential-mix': {
    label: 'Essential Mix',
    shortLabel: 'EM',
    backgroundColor: '#000000',
    textColor: '#FF4D00', // BBC Radio 1 orange accent
    borderColor: '#FF4D00',
  },
  'dj-mag': {
    label: 'DJ Mag',
    shortLabel: 'DJ',
    backgroundColor: '#E50914',
    textColor: '#FFFFFF',
  },
  'resident-advisor': {
    label: 'Resident Advisor',
    shortLabel: 'RA',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    borderColor: '#333333',
  },
  'exit': {
    label: 'EXIT Festival',
    shortLabel: 'EX',
    backgroundColor: '#E31837',
    textColor: '#FFFFFF',
  },
  'sonar': {
    label: 'Sónar',
    shortLabel: 'SN',
    backgroundColor: '#FFFF00',
    textColor: '#000000',
  },
  'dc10': {
    label: 'DC-10',
    shortLabel: '10',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  'amnesia': {
    label: 'Amnesia',
    shortLabel: 'AM',
    backgroundColor: '#000080',
    textColor: '#FFFFFF',
  },
  'pacha': {
    label: 'Pacha',
    shortLabel: 'PA',
    backgroundColor: '#E30613',
    textColor: '#FFFFFF',
  },
  'hi-ibiza': {
    label: 'Hï Ibiza',
    shortLabel: 'HI',
    backgroundColor: '#000000',
    textColor: '#00FFFF',
    borderColor: '#00FFFF',
  },
  'ushuaia': {
    label: 'Ushuaïa',
    shortLabel: 'US',
    backgroundColor: '#003366',
    textColor: '#FFD700',
  },
  'printworks': {
    label: 'Printworks',
    shortLabel: 'PW',
    backgroundColor: '#FF6600', // Printworks orange
    textColor: '#FFFFFF',
  },
  'berghain': {
    label: 'Berghain',
    shortLabel: 'B',
    backgroundColor: '#0A0A0A', // Very dark, minimalist
    textColor: '#FFFFFF',
    borderColor: '#333333',
  },
  'tresor': {
    label: 'Tresor',
    shortLabel: 'T',
    backgroundColor: '#000000',
    textColor: '#00FF00', // Green like old-school terminal
    borderColor: '#00FF00',
  },
  'house-calls': {
    label: 'House Calls',
    shortLabel: 'HC',
    backgroundColor: '#0a1628', // Dark night sky blue
    textColor: '#FFD700', // Gold text for visibility
    borderColor: '#4A90D9', // Lake Michigan blue
    hasSkyline: true, // Special flag for Chicago skyline effect
  },
  'obskur': {
    label: 'Obskür',
    shortLabel: 'OB',
    backgroundColor: '#0D0D0D',
    textColor: '#FFFFFF',
    borderColor: '#333333',
  },
  // NYC Event Series
  'raw-cuts': {
    label: 'Raw Cuts',
    shortLabel: 'RC',
    backgroundColor: '#1a1a1a',
    textColor: '#FF6B35', // Orange like NYC energy
    borderColor: '#FF6B35',
  },
  'cityfox': {
    label: 'Cityfox',
    shortLabel: '🦊',
    backgroundColor: '#FF4500', // Orange-red fox color
    textColor: '#FFFFFF',
    borderColor: '#FF6347',
    isEmoji: true,
  },
  'elsewhere': {
    label: 'Elsewhere',
    shortLabel: 'EW',
    backgroundColor: '#2D1B4E', // Purple/violet
    textColor: '#00FFFF',
    borderColor: '#00FFFF',
  },
  'good-room': {
    label: 'Good Room',
    shortLabel: 'GR',
    backgroundColor: '#228B22', // Forest green
    textColor: '#FFFFFF',
  },
  'knockdown': {
    label: 'Knockdown Center',
    shortLabel: 'KD',
    backgroundColor: '#4A4A4A', // Industrial gray
    textColor: '#FFFFFF',
    borderColor: '#666666',
  },
  'lot-radio': {
    label: 'The Lot Radio',
    shortLabel: '📻',
    backgroundColor: '#1a1a1a',
    textColor: '#FFFFFF',
    borderColor: '#FF6600',
    isEmoji: true,
  },
  // LA Event Series
  'factory-93': {
    label: 'Factory 93',
    shortLabel: 'F93',
    backgroundColor: '#000000',
    textColor: '#FF0000',
    borderColor: '#FF0000',
    isWide: true,
  },
  // Labels and Brands
  'music-on': {
    label: 'Music On',
    shortLabel: 'MO',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  'teksupport': {
    label: 'Teksupport',
    shortLabel: 'TEK',
    backgroundColor: '#1a1a1a',
    textColor: '#00FF41', // Matrix green
    borderColor: '#00FF41',
    isWide: true,
  },
  'elrow': {
    label: 'Elrow',
    shortLabel: '🎪',
    backgroundColor: '#FF1493', // Hot pink
    textColor: '#FFD700',
    borderColor: '#00CED1',
    isEmoji: true,
  },
  'afterlife': {
    label: 'Afterlife',
    shortLabel: 'AL',
    backgroundColor: '#0a0a0a',
    textColor: '#C0C0C0', // Silver
    borderColor: '#4a4a4a',
  },
  'hyte': {
    label: 'HYTE',
    shortLabel: 'HY',
    backgroundColor: '#000000',
    textColor: '#FF0000',
    borderColor: '#FF0000',
  },
  'paradise': {
    label: 'Paradise',
    shortLabel: '🌴',
    backgroundColor: '#006400', // Dark green
    textColor: '#FFD700',
    borderColor: '#32CD32',
    isEmoji: true,
  },
  'solid-grooves': {
    label: 'Solid Grooves',
    shortLabel: '▲', // Triangle like their geometric logo
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  'keinemusik': {
    label: 'Keinemusik',
    shortLabel: '&ME',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    borderColor: '#333333',
    isWide: true,
  },
  'toolroom': {
    label: 'Toolroom',
    shortLabel: 'TR',
    backgroundColor: '#E31837', // Red
    textColor: '#FFFFFF',
  },
  'dirtybird': {
    label: 'Dirtybird',
    shortLabel: '🐦',
    backgroundColor: '#000000',
    textColor: '#7CFC00', // Lawn green
    borderColor: '#7CFC00',
    isEmoji: true,
  },
  'hot-creations': {
    label: 'Hot Creations',
    shortLabel: 'HC',
    backgroundColor: '#FF4500', // Orange red
    textColor: '#FFFFFF',
  },
  'crosstown-rebels': {
    label: 'Crosstown Rebels',
    shortLabel: 'CR',
    backgroundColor: '#8B0000', // Dark red
    textColor: '#FFD700',
    borderColor: '#FFD700',
  },
  'anjunadeep': {
    label: 'Anjunadeep',
    shortLabel: 'AD',
    backgroundColor: '#1a3a5c', // Deep blue
    textColor: '#87CEEB', // Sky blue
    borderColor: '#87CEEB',
  },
  'anjunabeats': {
    label: 'Anjunabeats',
    shortLabel: 'AB',
    backgroundColor: '#000080', // Navy
    textColor: '#00BFFF',
    borderColor: '#00BFFF',
  },
  'knee-deep': {
    label: 'Knee Deep In Sound',
    shortLabel: 'KD',
    backgroundColor: '#1a1a2e',
    textColor: '#E94560',
    borderColor: '#E94560',
  },
  'tronic': {
    label: 'Tronic',
    shortLabel: 'T',
    backgroundColor: '#000000',
    textColor: '#00FFFF', // Cyan
    borderColor: '#00FFFF',
  },
  'suara': {
    label: 'Suara',
    shortLabel: 'SU',
    backgroundColor: '#2d0a3e', // Purple
    textColor: '#FF00FF',
    borderColor: '#FF00FF',
  },
  'octopus': {
    label: 'Octopus',
    shortLabel: '🐙',
    backgroundColor: '#000000',
    textColor: '#FF4500',
    borderColor: '#FF4500',
    isEmoji: true,
  },
  'intec': {
    label: 'Intec',
    shortLabel: 'IN',
    backgroundColor: '#000000',
    textColor: '#00FF00',
    borderColor: '#00FF00',
  },
  'minus': {
    label: 'Minus',
    shortLabel: '−',
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    borderColor: '#000000',
  },
  'kompakt': {
    label: 'Kompakt',
    shortLabel: 'K',
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    borderColor: '#000000',
  },
  'innervisions': {
    label: 'Innervisions',
    shortLabel: 'IV',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    borderColor: '#444444',
  },
  'diynamic': {
    label: 'Diynamic',
    shortLabel: 'DY',
    backgroundColor: '#1a1a1a',
    textColor: '#FFFFFF',
    borderColor: '#666666',
  },
  'nervous': {
    label: 'Nervous Records',
    shortLabel: 'NR',
    backgroundColor: '#FFD700', // Gold
    textColor: '#000000',
  },
  'resistance': {
    label: 'Resistance',
    shortLabel: 'R',
    backgroundColor: '#000000',
    textColor: '#FFD700',
    borderColor: '#FFD700',
  },
};

// Keywords to match in set names/venues for auto-detection
// Note: More specific matches should come before general ones (e.g., circoloco-radio before circoloco)
const EVENT_KEYWORDS: Record<string, string[]> = {
  'circoloco-radio': ['circoloco radio', 'circo loco radio'],
  'circoloco': ['circoloco', 'circo loco'],
  'bbc-radio-1': ['bbc radio 1', 'radio 1', 'bbc r1'],
  'coachella': ['coachella', 'do lab', 'dolab', 'yuma tent', 'sahara tent', 'mojave tent', 'gobi tent'],
  'boiler-room': ['boiler room'],
  'cercle': ['cercle'],
  'defected': ['defected'],
  'drumcode': ['drumcode', 'drum code'],
  'awakenings': ['awakenings'],
  'time-warp': ['time warp', 'timewarp'],
  'tomorrowland': ['tomorrowland'],
  'burning-man': ['burning man', 'burningman', 'playa', 'black rock city', 'robot heart', 'mayan warrior', 'camp question mark'],
  'lollapalooza': ['lollapalooza', 'lolla', 'lollapalooza chicago', 'perry stage', 'perrys stage'],
  'ultra': ['ultra music festival', 'ultra miami', 'umf'],
  'dekmantel': ['dekmantel'],
  'fabric': ['fabric london', 'fabriclive'],
  'essential-mix': ['essential mix'],
  'dj-mag': ['dj mag', 'djmag'],
  'resident-advisor': ['resident advisor', 'ra.'],
  'exit': ['exit festival'],
  'sonar': ['sonar', 'sónar'],
  'dc10': ['dc10', 'dc-10'],
  'amnesia': ['amnesia ibiza'],
  'pacha': ['pacha ibiza', 'pacha'],
  'hi-ibiza': ['hï ibiza', 'hi ibiza'],
  'ushuaia': ['ushuaïa', 'ushuaia'],
  'printworks': ['printworks'],
  'berghain': ['berghain'],
  'house-calls': ['house calls', 'housecalls'],
  'obskur': ['obskür', 'obskur'],
  'tresor': ['tresor berlin', 'tresor'],
  // NYC Event Series
  'raw-cuts': ['raw cuts', 'rawcuts'],
  'cityfox': ['cityfox', 'the cityfox', 'cityfox experience'],
  'elsewhere': ['elsewhere brooklyn', 'elsewhere nyc'],
  'good-room': ['good room', 'goodroom'],
  'knockdown': ['knockdown center', 'knockdown'],
  'lot-radio': ['lot radio', 'the lot radio'],
  // LA Event Series
  'factory-93': ['factory 93', 'factory93'],
  // Labels and Brands
  'music-on': ['music on', 'musicon', 'marco carola music on'],
  'teksupport': ['teksupport', 'tek support'],
  'elrow': ['elrow', 'el row'],
  'afterlife': ['afterlife', 'tale of us afterlife', 'afterlife voyage'],
  'hyte': ['hyte', 'hyte berlin', 'hyte amsterdam'],
  'paradise': ['paradise ibiza', 'jamie jones paradise'],
  'solid-grooves': ['solid grooves', 'solidgrooves'],
  'keinemusik': ['keinemusik', 'keine musik', '&me', 'rampa', 'adam port'],
  'toolroom': ['toolroom', 'toolroom records'],
  'dirtybird': ['dirtybird', 'dirty bird', 'dirtybird campout', 'claude vonstroke'],
  'hot-creations': ['hot creations', 'hotcreations'],
  'crosstown-rebels': ['crosstown rebels', 'crosstownrebels'],
  'anjunadeep': ['anjunadeep', 'anjuna deep'],
  'anjunabeats': ['anjunabeats', 'anjuna beats', 'above & beyond', 'abgt', 'group therapy'],
  'knee-deep': ['knee deep in sound', 'kneedeep', 'hot since 82'],
  'tronic': ['tronic music', 'tronic records', 'christian smith tronic'],
  'suara': ['suara music', 'suara records', 'coyu'],
  'octopus': ['octopus recordings', 'sian octopus'],
  'intec': ['intec digital', 'intec records', 'carl cox intec'],
  'minus': ['minus records', 'richie hawtin minus'],
  'kompakt': ['kompakt records', 'kompakt total'],
  'innervisions': ['innervisions', 'dixon innervisions', 'âme innervisions'],
  'diynamic': ['diynamic music', 'diynamic records', 'solomun diynamic'],
  'nervous': ['nervous records'],
  'resistance': ['resistance', 'ultra resistance', 'resistance miami'],
};

// Detect event from set name, venue, or event name
export function detectEvent(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const [eventId, keywords] of Object.entries(EVENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return eventId;
      }
    }
  }

  return null;
}

interface EventBadgeProps {
  eventId: string;
  size?: 'small' | 'medium';
  onPress?: (eventId: string) => void;
}

export default function EventBadge({ eventId, size = 'small', onPress }: EventBadgeProps) {
  const config = EVENT_BADGES[eventId];

  if (!config) {
    return null;
  }

  const isSmall = size === 'small';
  const badgeHeight = isSmall ? 14 : 26;
  const badgeWidth = config.isWide ? (isSmall ? 26 : 44) : badgeHeight;
  const fontSize = config.isEmoji
    ? (isSmall ? 9 : 16)
    : config.isWide
      ? (isSmall ? 5 : 9)
      : (isSmall ? 6 : 11);

  // Font style variations
  const getFontStyle = () => {
    if (config.fontStyle === 'handwritten') {
      return {
        fontStyle: 'italic' as const,
        fontWeight: '400' as const,
        fontSize: isSmall ? 9 : 16, // Larger for handwritten feel
        letterSpacing: 0,
      };
    }
    return {
      fontWeight: '900' as const,
      letterSpacing: -0.5,
    };
  };

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(eventId);
    }
  };

  // Special skyline badge for House Calls
  if (config.hasSkyline) {
    const skylineBadge = (
      <View
        style={[
          styles.badge,
          styles.skylineBadge,
          {
            width: badgeWidth,
            height: badgeHeight,
            borderColor: config.borderColor || config.backgroundColor,
          },
        ]}
      >
        {/* Night sky gradient background */}
        <View style={styles.skylineBackground}>
          <View style={styles.skylineGradientTop} />
          <View style={styles.skylineGradientBottom} />
        </View>
        {/* Chicago skyline silhouette at bottom */}
        <View style={styles.skylineSilhouette}>
          <View style={[styles.building, { height: 6, width: 2 }]} />
          <View style={[styles.building, { height: 10, width: 3 }]} />
          <View style={[styles.building, { height: 7, width: 2 }]} />
          <View style={[styles.building, { height: 12, width: 2 }]} />
          <View style={[styles.building, { height: 8, width: 3 }]} />
        </View>
        {/* HC text on top */}
        <Text
          style={[
            styles.badgeText,
            styles.skylineText,
            {
              color: config.textColor,
              fontSize,
            },
            getFontStyle(),
          ]}
        >
          {config.shortLabel}
        </Text>
      </View>
    );

    if (onPress) {
      return (
        <Pressable onPress={handlePress} hitSlop={4}>
          {skylineBadge}
        </Pressable>
      );
    }
    return skylineBadge;
  }

  // Special badge with "RADIO" subtext (for Circoloco Radio)
  if (config.hasRadioSubtext) {
    const radioHeight = isSmall ? 20 : 26;
    const radioWidth = isSmall ? 20 : 26;
    const radioBadge = (
      <View
        style={[
          styles.badge,
          styles.radioBadge,
          {
            width: radioWidth,
            height: radioHeight,
            backgroundColor: config.backgroundColor,
            borderColor: config.borderColor || config.backgroundColor,
          },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            {
              color: config.textColor,
              fontSize: isSmall ? 8 : 11,
            },
            getFontStyle(),
          ]}
        >
          {config.shortLabel}
        </Text>
        <Text
          style={[
            styles.radioSubtext,
            {
              color: config.textColor,
              fontSize: isSmall ? 3 : 4,
            },
          ]}
        >
          RADIO
        </Text>
      </View>
    );

    if (onPress) {
      return (
        <Pressable onPress={handlePress} hitSlop={4}>
          {radioBadge}
        </Pressable>
      );
    }
    return radioBadge;
  }

  const badgeContent = (
    <View
      style={[
        styles.badge,
        {
          width: badgeWidth,
          height: badgeHeight,
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor || config.backgroundColor,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            color: config.textColor,
            fontSize,
          },
          !config.isEmoji && getFontStyle(),
        ]}
      >
        {config.shortLabel}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={handlePress} hitSlop={4}>
        {badgeContent}
      </Pressable>
    );
  }

  return badgeContent;
}

// Get event label for display
export function getEventLabel(eventId: string): string {
  return EVENT_BADGES[eventId]?.label || eventId;
}

// Export for use in other components
export { EVENT_BADGES, EVENT_KEYWORDS };

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  // Chicago skyline badge styles
  skylineBadge: {
    overflow: 'hidden',
    backgroundColor: '#0a1628',
  },
  skylineBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  skylineGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#0f2847', // Lighter night sky at top
  },
  skylineGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#0a1628', // Darker at horizon
  },
  skylineSilhouette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 2,
  },
  building: {
    backgroundColor: '#1a1a2e', // Dark building silhouette
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  skylineText: {
    zIndex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Radio badge styles (for Circoloco Radio)
  radioBadge: {
    flexDirection: 'column',
    paddingVertical: 1,
    gap: 0,
  },
  radioSubtext: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: -1,
  },
});
