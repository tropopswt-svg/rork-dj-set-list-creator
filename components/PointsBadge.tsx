import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Sparkles, TrendingUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

interface PointsBadgeProps {
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  showBreakdown?: boolean;
}

export default function PointsBadge({ 
  onPress, 
  size = 'medium',
  showBreakdown = false,
}: PointsBadgeProps) {
  const { totalPoints, pointsBreakdown } = useUser();

  const formatPoints = (pts: number) => {
    if (pts >= 1000) {
      return `${(pts / 1000).toFixed(1)}K`;
    }
    return pts.toString();
  };

  const sizeStyles = {
    small: {
      container: styles.containerSmall,
      icon: 12,
      text: styles.textSmall,
    },
    medium: {
      container: styles.containerMedium,
      icon: 14,
      text: styles.textMedium,
    },
    large: {
      container: styles.containerLarge,
      icon: 18,
      text: styles.textLarge,
    },
  };

  const current = sizeStyles[size];

  if (showBreakdown) {
    return (
      <View style={styles.breakdownContainer}>
        <View style={styles.breakdownHeader}>
          <Sparkles size={20} color={Colors.dark.primary} />
          <Text style={styles.breakdownTotal}>{formatPoints(totalPoints)}</Text>
          <Text style={styles.breakdownLabel}>points</Text>
        </View>
        
        <View style={styles.breakdownGrid}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>{pointsBreakdown.voting}</Text>
            <Text style={styles.breakdownItemLabel}>Voting</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>{pointsBreakdown.correctVotes}</Text>
            <Text style={styles.breakdownItemLabel}>Correct</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>{pointsBreakdown.contributions}</Text>
            <Text style={styles.breakdownItemLabel}>Sources</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>{pointsBreakdown.trackIds}</Text>
            <Text style={styles.breakdownItemLabel}>Track IDs</Text>
          </View>
        </View>
      </View>
    );
  }

  const Badge = onPress ? Pressable : View;

  return (
    <Badge 
      style={[styles.container, current.container]}
      onPress={onPress}
    >
      <Sparkles size={current.icon} color={Colors.dark.primary} />
      <Text style={[styles.text, current.text]}>{formatPoints(totalPoints)}</Text>
    </Badge>
  );
}

// Inline points animation for when points are earned
export function PointsPopup({ amount, visible }: { amount: number; visible: boolean }) {
  if (!visible) return null;
  
  return (
    <View style={styles.popup}>
      <TrendingUp size={14} color={Colors.dark.success} />
      <Text style={styles.popupText}>+{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    borderRadius: 20,
    gap: 6,
  },
  containerSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  containerMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  containerLarge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  textSmall: {
    fontSize: 12,
  },
  textMedium: {
    fontSize: 14,
  },
  textLarge: {
    fontSize: 18,
  },
  breakdownContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  breakdownTotal: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  breakdownLabel: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginLeft: -4,
  },
  breakdownGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownItem: {
    alignItems: 'center',
    flex: 1,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  breakdownItemLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  popup: {
    position: 'absolute',
    top: -30,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  popupText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.success,
  },
});
