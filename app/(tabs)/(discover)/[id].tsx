import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  Play, 
  Share2, 
  Plus, 
  ExternalLink, 
  Youtube, 
  Music2,
  Radio,
  ListMusic,
  MessageSquare,
  Sparkles,
  Users,
  Clock,
  CheckCircle,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import TrackCard from '@/components/TrackCard';
import AddTrackModal from '@/components/AddTrackModal';
import ContributorModal from '@/components/ContributorModal';
import { mockSetLists } from '@/mocks/tracks';
import { Track, SourceLink } from '@/types';

export default function SetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  
  const setList = useMemo(() => {
    const found = mockSetLists.find(s => s.id === id);
    if (found && tracks.length === 0) {
      setTracks(found.tracks);
    }
    return found;
  }, [id]);

  if (!setList) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Set not found</Text>
      </View>
    );
  }

  const sortedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [tracks]);

  const verifiedCount = sortedTracks.filter(t => t.verified).length;
  const communityCount = sortedTracks.filter(t => t.source === 'social' || t.source === 'manual').length;

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  };

  const formatPlays = (plays: number) => {
    if (plays >= 1000000) return `${(plays / 1000000).toFixed(1)}M`;
    if (plays >= 1000) return `${(plays / 1000).toFixed(0)}K`;
    return plays.toString();
  };

  const handleOpenSource = (link: SourceLink) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(link.url);
  };

  const handleAddTrack = (trackData: Partial<Track>) => {
    const newTrack: Track = {
      id: trackData.id || Date.now().toString(),
      title: trackData.title || '',
      artist: trackData.artist || '',
      album: trackData.album,
      duration: trackData.duration || 0,
      bpm: trackData.bpm,
      key: trackData.key,
      coverUrl: trackData.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date(),
      source: 'manual',
      timestamp: trackData.timestamp,
      contributedBy: 'You',
      verified: false,
    };
    
    setTracks(prev => [...prev, newTrack]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaved(!isSaved);
  };

  const getPlatformIcon = (platform: string, size: number = 18) => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={size} color="#FF0000" />;
      case 'soundcloud':
        return <Music2 size={size} color="#FF5500" />;
      case 'mixcloud':
        return <Radio size={size} color="#5000FF" />;
      case '1001tracklists':
        return <ListMusic size={size} color="#00D4AA" />;
      default:
        return <ExternalLink size={size} color={Colors.dark.textSecondary} />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'soundcloud': return 'SoundCloud';
      case 'mixcloud': return 'Mixcloud';
      case '1001tracklists': return '1001Tracklists';
      default: return 'Link';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerImage}>
          <Image 
            source={{ uri: setList.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop' }}
            style={styles.coverImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', Colors.dark.background]}
            style={styles.headerGradient}
          />
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={Colors.dark.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleInfo}>
                <Text style={styles.artist}>{setList.artist}</Text>
                <Text style={styles.title}>{setList.name}</Text>
              </View>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                {isSaved ? (
                  <BookmarkCheck size={24} color={Colors.dark.primary} fill={Colors.dark.primary} />
                ) : (
                  <Bookmark size={24} color={Colors.dark.text} />
                )}
              </Pressable>
            </View>
            
            {setList.venue && (
              <Text style={styles.venue}>{setList.venue}</Text>
            )}

            <View style={styles.quickStats}>
              {setList.plays && (
                <Text style={styles.quickStatText}>{formatPlays(setList.plays)} plays</Text>
              )}
              <Text style={styles.quickStatDot}>•</Text>
              <Text style={styles.quickStatText}>{formatTotalDuration(setList.totalDuration || 0)}</Text>
              <Text style={styles.quickStatDot}>•</Text>
              <Text style={styles.quickStatText}>{sortedTracks.length} tracks</Text>
            </View>
          </View>

          <View style={styles.linksSection}>
            <Text style={styles.sectionLabel}>Listen on</Text>
            <View style={styles.linksGrid}>
              {setList.sourceLinks.map((link, index) => (
                <Pressable 
                  key={index} 
                  style={styles.linkCard}
                  onPress={() => handleOpenSource(link)}
                >
                  <View style={styles.linkIconContainer}>
                    {getPlatformIcon(link.platform, 22)}
                  </View>
                  <Text style={styles.linkPlatform}>{getPlatformName(link.platform)}</Text>
                  {link.label && (
                    <Text style={styles.linkLabel}>{link.label}</Text>
                  )}
                  <ExternalLink size={14} color={Colors.dark.textMuted} style={styles.linkExternal} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(0, 212, 170, 0.15)' }]}>
                <Sparkles size={18} color={Colors.dark.primary} />
              </View>
              <Text style={styles.statValue}>{setList.tracksIdentified || sortedTracks.length}</Text>
              <Text style={styles.statLabel}>Identified</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <CheckCircle size={18} color={Colors.dark.success} />
              </View>
              <Text style={styles.statValue}>{verifiedCount}</Text>
              <Text style={styles.statLabel}>Verified</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Users size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.statValue}>{communityCount}</Text>
              <Text style={styles.statLabel}>Community</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(251, 146, 60, 0.15)' }]}>
                <MessageSquare size={18} color="#FB923C" />
              </View>
              <Text style={styles.statValue}>{setList.commentsScraped || 0}</Text>
              <Text style={styles.statLabel}>Scraped</Text>
            </View>
          </View>

          {setList.aiProcessed && (
            <View style={styles.aiInfoBanner}>
              <Sparkles size={16} color={Colors.dark.primary} />
              <Text style={styles.aiInfoText}>
                Tracklist built from {setList.commentsScraped?.toLocaleString()} comments & 1001Tracklists
              </Text>
            </View>
          )}

          <View style={styles.tracksSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.sectionTitle}>Tracklist</Text>
              <Pressable 
                style={styles.addTrackButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAddModal(true);
                }}
              >
                <Plus size={16} color={Colors.dark.primary} />
                <Text style={styles.addTrackText}>Add Track</Text>
              </Pressable>
            </View>

            {sortedTracks.map((track) => (
              <TrackCard 
                key={track.id} 
                track={track}
                showTimestamp
                onPress={() => {
                  if (setList.sourceLinks.length > 0 && track.timestamp) {
                    const youtubeLink = setList.sourceLinks.find(l => l.platform === 'youtube');
                    if (youtubeLink) {
                      const url = `${youtubeLink.url}&t=${track.timestamp}`;
                      Linking.openURL(url);
                    }
                  }
                }}
                onContributorPress={(username) => setSelectedContributor(username)}
              />
            ))}
            
            {sortedTracks.length === 0 && (
              <View style={styles.emptyTracks}>
                <Sparkles size={32} color={Colors.dark.textMuted} />
                <Text style={styles.emptyText}>No tracks identified yet</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to contribute! Add a track you recognize.
                </Text>
                <Pressable 
                  style={styles.emptyAddButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Plus size={16} color={Colors.dark.background} />
                  <Text style={styles.emptyAddButtonText}>Add First Track</Text>
                </Pressable>
              </View>
            )}

            {sortedTracks.length > 0 && (
              <View style={styles.missingTrackCta}>
                <Text style={styles.missingTrackText}>Know a track we missed?</Text>
                <Pressable 
                  style={styles.contributeButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAddModal(true);
                  }}
                >
                  <Text style={styles.contributeButtonText}>Contribute</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <AddTrackModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTrack}
        totalDuration={setList.totalDuration}
      />

      <ContributorModal
        visible={selectedContributor !== null}
        username={selectedContributor || ''}
        onClose={() => setSelectedContributor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerImage: {
    height: 300,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    marginTop: -60,
  },
  titleSection: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleInfo: {
    flex: 1,
    marginRight: 16,
  },
  artist: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    lineHeight: 30,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venue: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 8,
  },
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  quickStatText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  quickStatDot: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginHorizontal: 8,
  },
  linksSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  linkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkPlatform: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  linkLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  linkExternal: {
    marginLeft: 'auto',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  aiInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 10,
  },
  aiInfoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  tracksSection: {},
  tracksSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  addTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
  },
  addTrackText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
  },
  emptyTracks: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyAddButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  missingTrackCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  missingTrackText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  contributeButton: {
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  contributeButtonText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '600' as const,
  },
  errorText: {
    color: Colors.dark.text,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
});
