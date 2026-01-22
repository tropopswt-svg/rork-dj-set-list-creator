import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { X, Music, User, Link2, Sparkles, AlertCircle, ExternalLink, Search, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Track, TrackLink } from '@/types';
import { useSets } from '@/contexts/SetsContext';

interface AddTrackModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (track: Partial<Track>) => void;
  totalDuration?: number;
}

type TabType = 'link' | 'manual';
type LinkPlatform = 'spotify' | 'beatport' | 'soundcloud' | 'bandcamp' | 'youtube' | 'apple_music' | 'other';

const PLATFORM_COLORS: Record<LinkPlatform, string> = {
  spotify: '#1DB954',
  beatport: '#94D500',
  soundcloud: '#FF5500',
  bandcamp: '#629AA9',
  youtube: '#FF0000',
  apple_music: '#FC3C44',
  other: Colors.dark.textMuted,
};

const PLATFORM_NAMES: Record<LinkPlatform, string> = {
  spotify: 'Spotify',
  beatport: 'Beatport',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  youtube: 'YouTube',
  apple_music: 'Apple Music',
  other: 'Other',
};

export default function AddTrackModal({ visible, onClose, onAdd, totalDuration }: AddTrackModalProps) {
  const { searchTracksInRepository, trackRepository } = useSets();
  const [activeTab, setActiveTab] = useState<TabType>('link');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [timestampMin, setTimestampMin] = useState('');
  const [timestampSec, setTimestampSec] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [isUnreleased, setIsUnreleased] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedFromLink, setFetchedFromLink] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFromRepo, setSelectedFromRepo] = useState(false);

  const trackSuggestions = useMemo(() => {
    const query = title.trim() || artist.trim();
    if (!query || query.length < 2 || selectedFromRepo) return [];
    return searchTracksInRepository(query).slice(0, 6);
  }, [title, artist, searchTracksInRepository, selectedFromRepo]);

  const handleSelectTrack = (track: Track) => {
    setTitle(track.title);
    setArtist(track.artist);
    setShowSuggestions(false);
    setSelectedFromRepo(true);
    if (track.trackLinks && track.trackLinks.length > 0) {
      setTrackUrl(track.trackLinks[0].url);
    }
  };

  const detectPlatform = (url: string): LinkPlatform => {
    if (url.includes('spotify.com') || url.includes('open.spotify')) return 'spotify';
    if (url.includes('beatport.com')) return 'beatport';
    if (url.includes('soundcloud.com')) return 'soundcloud';
    if (url.includes('bandcamp.com')) return 'bandcamp';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('music.apple.com')) return 'apple_music';
    return 'other';
  };

  const parseTimestamp = (): number => {
    const min = parseInt(timestampMin) || 0;
    const sec = parseInt(timestampSec) || 0;
    return min * 60 + sec;
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFetchFromLink = () => {
    if (!trackUrl.trim()) return;
    
    setIsFetching(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setTimeout(() => {
      const platform = detectPlatform(trackUrl);
      if (platform === 'spotify') {
        setTitle('Melodic Dreams');
        setArtist('Unknown Artist');
      } else if (platform === 'soundcloud') {
        setTitle('Underground Groove');
        setArtist('Local Producer');
      } else {
        setTitle('Track Title');
        setArtist('Artist Name');
      }
      setFetchedFromLink(true);
      setIsFetching(false);
    }, 1200);
  };

  const handleSubmit = () => {
    if (!title.trim() || !artist.trim()) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const trackLinks: TrackLink[] = [];
    if (trackUrl.trim()) {
      trackLinks.push({
        platform: detectPlatform(trackUrl),
        url: trackUrl.trim(),
      });
    }

    const newTrack: Partial<Track> = {
      id: Date.now().toString(),
      title: title.trim(),
      artist: artist.trim(),
      timestamp: parseTimestamp(),
      source: trackUrl.trim() ? 'link' : 'manual',
      contributedBy: 'You',
      verified: false,
      addedAt: new Date(),
      duration: 0,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      isUnreleased: isUnreleased,
      trackLinks: trackLinks.length > 0 ? trackLinks : undefined,
    };

    onAdd(newTrack);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle('');
    setArtist('');
    setTimestampMin('');
    setTimestampSec('');
    setTrackUrl('');
    setIsUnreleased(false);
    setFetchedFromLink(false);
    setActiveTab('link');
    setShowSuggestions(false);
    setSelectedFromRepo(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid = title.trim() && artist.trim();
  const detectedPlatform = trackUrl ? detectPlatform(trackUrl) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Track ID</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <X size={24} color={Colors.dark.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === 'link' && styles.tabActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('link');
              }}
            >
              <Link2 size={16} color={activeTab === 'link' ? Colors.dark.primary : Colors.dark.textMuted} />
              <Text style={[styles.tabText, activeTab === 'link' && styles.tabTextActive]}>
                By Link
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'manual' && styles.tabActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('manual');
              }}
            >
              <Music size={16} color={activeTab === 'manual' ? Colors.dark.primary : Colors.dark.textMuted} />
              <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>
                Manual / Unreleased
              </Text>
            </Pressable>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            style={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.timestampSection}>
              <Text style={styles.label}>Timestamp in set</Text>
              <View style={styles.timestampInputs}>
                <View style={styles.timestampField}>
                  <TextInput
                    style={styles.timestampInput}
                    placeholder="00"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={timestampMin}
                    onChangeText={(t) => setTimestampMin(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.timestampLabel}>min</Text>
                </View>
                <Text style={styles.timestampColon}>:</Text>
                <View style={styles.timestampField}>
                  <TextInput
                    style={styles.timestampInput}
                    placeholder="00"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={timestampSec}
                    onChangeText={(t) => setTimestampSec(t.replace(/[^0-9]/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.timestampLabel}>sec</Text>
                </View>
                {totalDuration && (
                  <Text style={styles.totalDuration}>
                    / {formatDuration(totalDuration)}
                  </Text>
                )}
              </View>
            </View>

            {activeTab === 'link' && (
              <View style={styles.linkSection}>
                <Text style={styles.label}>Track Link</Text>
                <View style={styles.linkInputRow}>
                  <View style={styles.linkInputContainer}>
                    {detectedPlatform && (
                      <View style={[styles.platformIndicator, { backgroundColor: `${PLATFORM_COLORS[detectedPlatform]}20` }]}>
                        <Text style={[styles.platformIndicatorText, { color: PLATFORM_COLORS[detectedPlatform] }]}>
                          {PLATFORM_NAMES[detectedPlatform]}
                        </Text>
                      </View>
                    )}
                    <TextInput
                      style={styles.linkInput}
                      placeholder="Paste Spotify, Beatport, SoundCloud link..."
                      placeholderTextColor={Colors.dark.textMuted}
                      value={trackUrl}
                      onChangeText={(text) => {
                        setTrackUrl(text);
                        setFetchedFromLink(false);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Pressable
                    style={[styles.fetchButton, isFetching && styles.fetchButtonDisabled]}
                    onPress={handleFetchFromLink}
                    disabled={isFetching || !trackUrl.trim()}
                  >
                    {isFetching ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Sparkles size={14} color="#fff" />
                        <Text style={styles.fetchButtonText}>Fetch</Text>
                      </>
                    )}
                  </Pressable>
                </View>
                
                {fetchedFromLink && (
                  <View style={styles.fetchedBadge}>
                    <ExternalLink size={12} color={Colors.dark.success} />
                    <Text style={styles.fetchedText}>Track info loaded from link</Text>
                  </View>
                )}

                <View style={styles.platformHints}>
                  <Text style={styles.platformHintsText}>
                    Supports: Spotify, Beatport, SoundCloud, Bandcamp, YouTube, Apple Music
                  </Text>
                </View>
              </View>
            )}

            {activeTab === 'manual' && (
              <View style={styles.unreleasedSection}>
                <Pressable
                  style={[styles.unreleasedToggle, isUnreleased && styles.unreleasedToggleActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsUnreleased(!isUnreleased);
                  }}
                >
                  <AlertCircle size={16} color={isUnreleased ? Colors.dark.primary : Colors.dark.textMuted} />
                  <Text style={[styles.unreleasedToggleText, isUnreleased && styles.unreleasedToggleTextActive]}>
                    Mark as Unreleased / ID
                  </Text>
                  <View style={[styles.checkbox, isUnreleased && styles.checkboxActive]}>
                    {isUnreleased && <View style={styles.checkboxInner} />}
                  </View>
                </Pressable>
                {isUnreleased && (
                  <Text style={styles.unreleasedHint}>
                    This track has not been officially released yet
                  </Text>
                )}
              </View>
            )}

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Track Title</Text>
                {trackRepository.length > 0 && (
                  <View style={styles.repoHint}>
                    <Search size={10} color={Colors.dark.primary} />
                    <Text style={styles.repoHintText}>{trackRepository.length} tracks in library</Text>
                  </View>
                )}
              </View>
              <View style={styles.inputContainer}>
                <Music size={18} color={Colors.dark.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={isUnreleased ? "e.g. Unreleased ID" : "e.g. Strobe"}
                  placeholderTextColor={Colors.dark.textMuted}
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    setSelectedFromRepo(false);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
              </View>
              
              {showSuggestions && trackSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <View style={styles.suggestionsHeader}>
                    <Search size={12} color={Colors.dark.textMuted} />
                    <Text style={styles.suggestionsTitle}>From Track Library</Text>
                  </View>
                  {trackSuggestions.map((track) => (
                    <Pressable
                      key={track.id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectTrack(track)}
                    >
                      <Image 
                        source={{ uri: track.coverUrl }} 
                        style={styles.suggestionCover}
                      />
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text style={styles.suggestionArtist} numberOfLines={1}>
                          {track.artist}
                        </Text>
                      </View>
                      <Check size={16} color={Colors.dark.primary} style={styles.suggestionCheck} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Artist</Text>
              <View style={styles.inputContainer}>
                <User size={18} color={Colors.dark.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={isUnreleased ? "e.g. Unknown / ID" : "e.g. deadmau5"}
                  placeholderTextColor={Colors.dark.textMuted}
                  value={artist}
                  onChangeText={(text) => {
                    setArtist(text);
                    setSelectedFromRepo(false);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
              </View>
              {selectedFromRepo && (
                <View style={styles.selectedBadge}>
                  <Check size={12} color={Colors.dark.success} />
                  <Text style={styles.selectedText}>Selected from library</Text>
                </View>
              )}
            </View>

            <View style={styles.infoBox}>
              <Sparkles size={16} color={Colors.dark.primary} />
              <Text style={styles.infoText}>
                {activeTab === 'link' 
                  ? "Adding a link helps others find and buy the track. You'll earn extra points for verified links!"
                  : "Can not find the track anywhere? Add it manually. Perfect for unreleased IDs or bootlegs."
                }
              </Text>
            </View>
          </ScrollView>

          <Pressable
            style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid}
          >
            <Text style={styles.submitButtonText}>
              {isUnreleased ? 'Add Unreleased Track' : 'Add Track ID'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.dark.surface,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textMuted,
  },
  tabTextActive: {
    color: Colors.dark.primary,
  },
  scrollContent: {
    maxHeight: 400,
  },
  timestampSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timestampInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampField: {
    alignItems: 'center',
  },
  timestampInput: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    width: 70,
    height: 56,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  timestampLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  timestampColon: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
    marginHorizontal: 8,
  },
  totalDuration: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginLeft: 16,
  },
  linkSection: {
    marginBottom: 16,
  },
  linkInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  linkInputContainer: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    justifyContent: 'center',
  },
  platformIndicator: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
    marginTop: 10,
  },
  platformIndicatorText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  linkInput: {
    fontSize: 14,
    color: Colors.dark.text,
    paddingVertical: 12,
  },
  fetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    minWidth: 80,
  },
  fetchButtonDisabled: {
    opacity: 0.5,
  },
  fetchButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  fetchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  fetchedText: {
    fontSize: 12,
    color: Colors.dark.success,
  },
  platformHints: {
    marginTop: 8,
  },
  platformHintsText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  unreleasedSection: {
    marginBottom: 16,
  },
  unreleasedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  unreleasedToggleActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  unreleasedToggleText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  unreleasedToggleTextActive: {
    color: Colors.dark.primary,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary,
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  unreleasedHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 8,
    marginLeft: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.dark.text,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  labelRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  repoHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  repoHintText: {
    fontSize: 10,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
  },
  suggestionsContainer: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  suggestionsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  suggestionsTitle: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  suggestionCover: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: Colors.dark.surface,
  },
  suggestionInfo: {
    flex: 1,
    marginLeft: 10,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  suggestionArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  suggestionCheck: {
    opacity: 0.5,
  },
  selectedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  selectedText: {
    fontSize: 12,
    color: Colors.dark.success,
  },
});
