import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { 
  AlertTriangle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Plus,
  Music2,
  TrendingUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface TrackSuggestion {
  id: string;
  title: string;
  artist: string;
  duration: number;
  matchReason: string;
  confidence: number;
  featuredInCount: number;
}

interface TrackGap {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  previousTrack: { id: string; title: string; artist: string } | null;
  nextTrack: { id: string; title: string; artist: string } | null;
  estimatedTracks: number;
  suggestions: TrackSuggestion[];
  confidence: 'high' | 'medium' | 'low';
}

interface TrackGapCardProps {
  gap: TrackGap;
  onAddTrack: (timestamp: number) => void;
  onSelectSuggestion: (suggestion: TrackSuggestion, timestamp: number) => void;
  onIdentify: (timestamp: number) => void;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getConfidenceColor(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high': return Colors.dark.success;
    case 'medium': return '#FB923C';
    case 'low': return Colors.dark.error;
  }
}

function getConfidenceLabel(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high': return 'Likely 1 track';
    case 'medium': return 'Possible gap';
    case 'low': return 'Uncertain';
  }
}

export default function TrackGapCard({ 
  gap, 
  onAddTrack, 
  onSelectSuggestion,
  onIdentify,
}: TrackGapCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };

  const handleAddTrack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddTrack(gap.startTime);
  };

  const handleIdentify = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onIdentify(gap.startTime);
  };

  const handleSelectSuggestion = (suggestion: TrackSuggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectSuggestion(suggestion, gap.startTime);
  };

  const confidenceColor = getConfidenceColor(gap.confidence);

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={handleToggle}>
        <View style={styles.headerLeft}>
          <View style={[styles.gapIndicator, { backgroundColor: `${confidenceColor}20` }]}>
            <AlertTriangle size={16} color={confidenceColor} />
          </View>
          <View style={styles.gapInfo}>
            <View style={styles.timestampRow}>
              <Text style={styles.timestamp}>
                {formatTimestamp(gap.startTime)} → {formatTimestamp(gap.endTime)}
              </Text>
              <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}20` }]}>
                <Text style={[styles.confidenceText, { color: confidenceColor }]}>
                  {getConfidenceLabel(gap.confidence)}
                </Text>
              </View>
            </View>
            <View style={styles.gapDetails}>
              <Clock size={12} color={Colors.dark.textMuted} />
              <Text style={styles.gapDuration}>{formatDuration(gap.duration)} gap</Text>
              {gap.estimatedTracks > 0 && (
                <>
                  <Text style={styles.gapDot}>•</Text>
                  <Text style={styles.estimatedTracks}>
                    ~{gap.estimatedTracks} track{gap.estimatedTracks > 1 ? 's' : ''} missing
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {expanded ? (
            <ChevronUp size={20} color={Colors.dark.textMuted} />
          ) : (
            <ChevronDown size={20} color={Colors.dark.textMuted} />
          )}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.contextSection}>
            {gap.previousTrack && (
              <View style={styles.contextTrack}>
                <Text style={styles.contextLabel}>After:</Text>
                <Text style={styles.contextTrackName} numberOfLines={1}>
                  {gap.previousTrack.artist} - {gap.previousTrack.title}
                </Text>
              </View>
            )}
            {gap.nextTrack && (
              <View style={styles.contextTrack}>
                <Text style={styles.contextLabel}>Before:</Text>
                <Text style={styles.contextTrackName} numberOfLines={1}>
                  {gap.nextTrack.artist} - {gap.nextTrack.title}
                </Text>
              </View>
            )}
          </View>

          {gap.suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <View style={styles.suggestionHeader}>
                <Sparkles size={14} color={Colors.dark.primary} />
                <Text style={styles.suggestionTitle}>AI Suggestions</Text>
              </View>
              {gap.suggestions.slice(0, 3).map((suggestion) => (
                <Pressable
                  key={suggestion.id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(suggestion)}
                >
                  <View style={styles.suggestionInfo}>
                    <View style={styles.suggestionIcon}>
                      <Music2 size={14} color={Colors.dark.textSecondary} />
                    </View>
                    <View style={styles.suggestionText}>
                      <Text style={styles.suggestionTrack} numberOfLines={1}>
                        {suggestion.title}
                      </Text>
                      <Text style={styles.suggestionArtist} numberOfLines={1}>
                        {suggestion.artist}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.suggestionMeta}>
                    {suggestion.featuredInCount > 0 && (
                      <View style={styles.featuredBadge}>
                        <TrendingUp size={10} color={Colors.dark.primary} />
                        <Text style={styles.featuredText}>{suggestion.featuredInCount}</Text>
                      </View>
                    )}
                    <View style={[
                      styles.confidenceBar,
                      { 
                        width: `${Math.min(suggestion.confidence, 100)}%`,
                        backgroundColor: suggestion.confidence > 50 ? Colors.dark.primary : Colors.dark.textMuted,
                      }
                    ]} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.identifyButton} onPress={handleIdentify}>
              <Sparkles size={14} color="#8B5CF6" />
              <Text style={styles.identifyText}>Identify Track</Text>
            </Pressable>
            <Pressable style={styles.addButton} onPress={handleAddTrack}>
              <Plus size={14} color={Colors.dark.primary} />
              <Text style={styles.addText}>Add Manually</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(251, 146, 60, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.2)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gapIndicator: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gapInfo: {
    flex: 1,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  gapDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  gapDuration: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginLeft: 2,
  },
  gapDot: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  estimatedTracks: {
    fontSize: 12,
    color: '#FB923C',
    fontWeight: '500' as const,
  },
  headerRight: {
    marginLeft: 8,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(251, 146, 60, 0.15)',
  },
  contextSection: {
    paddingTop: 12,
    gap: 6,
  },
  contextTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    width: 45,
  },
  contextTrackName: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  suggestionsSection: {
    marginTop: 12,
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
    borderRadius: 10,
    padding: 10,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  suggestionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    flex: 1,
  },
  suggestionTrack: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.text,
  },
  suggestionArtist: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  suggestionMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  featuredText: {
    fontSize: 10,
    color: Colors.dark.primary,
    fontWeight: '600' as const,
  },
  confidenceBar: {
    height: 3,
    borderRadius: 2,
    minWidth: 20,
    maxWidth: 50,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  identifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 10,
    borderRadius: 8,
  },
  identifyText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#8B5CF6',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dark.surface,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
});
