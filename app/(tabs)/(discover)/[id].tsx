import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator } from 'react-native';
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
  Scan,
  AlertTriangle,
  Brain,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import TrackCard from '@/components/TrackCard';
import TrackGapCard from '@/components/TrackGapCard';
import AddTrackModal from '@/components/AddTrackModal';
import ContributorModal from '@/components/ContributorModal';
import IdentifyTrackModal from '@/components/IdentifyTrackModal';
import { mockSetLists } from '@/mocks/tracks';
import { Track, SourceLink } from '@/types';
import { useSets } from '@/contexts/SetsContext';
import { trpc } from '@/lib/trpc';

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

interface TrackSuggestion {
  id: string;
  title: string;
  artist: string;
  duration: number;
  matchReason: string;
  confidence: number;
  featuredInCount: number;
}

interface GapAnalysisResult {
  gaps: TrackGap[];
  coverage: number;
  estimatedMissingTracks: number;
  confidence: number;
}

export default function SetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { trackRepository, getSetById } = useSets();
  const [showAddModal, setShowAddModal] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [identifyTimestamp, setIdentifyTimestamp] = useState(0);
  const [showGaps, setShowGaps] = useState(true);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisResult | null>(null);
  
  const gapAnalysisMutation = trpc.gapAnalysis.analyzeSet.useMutation({
    onSuccess: (data) => {
      console.log('[SetDetail] Gap analysis complete:', data);
      setGapAnalysis(data);
    },
    onError: (error) => {
      console.error('[SetDetail] Gap analysis error:', error);
    },
  });

  const scanSetFromUrlMutation = trpc.scraper.scanSetFromUrl.useMutation({
    onSuccess: (data) => {
      if (data.success && data.identified && data.identified.length > 0) {
        const newTracks: Track[] = data.identified.map((t) => ({
          id: `scan-${Date.now()}-${t.timestamp}`,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration ?? 0,
          coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
          addedAt: new Date(),
          source: 'ai',
          timestamp: t.timestamp,
          contributedBy: 'ACRCloud',
          verified: true,
          trackLinks: t.links.spotify ? [{ platform: 'spotify', url: t.links.spotify }] : undefined,
        }));
        setTracks((prev) => [...prev, ...newTracks]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => runGapAnalysis(), 300);
      }
    },
    onError: (err) => {
      console.error('[SetDetail] Scan set error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
  
  const setList = useMemo(() => {
    const contextSet = getSetById(id || '');
    if (contextSet) {
      if (tracks.length === 0) {
        setTracks(contextSet.tracks);
      }
      return contextSet;
    }
    const found = mockSetLists.find(s => s.id === id);
    if (found && tracks.length === 0) {
      setTracks(found.tracks);
    }
    return found;
  }, [id, getSetById]);

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

  const runGapAnalysis = useCallback(() => {
    if (!setList) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const repoTracks = trackRepository.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      featuredIn: t.featuredIn?.map(f => ({
        setId: f.setId,
        setName: f.setName,
        artist: f.artist,
        timestamp: f.timestamp,
      })),
    }));
    
    gapAnalysisMutation.mutate({
      setId: setList.id,
      setArtist: setList.artist,
      totalDuration: setList.totalDuration || 3600,
      tracks: sortedTracks.map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        timestamp: t.timestamp,
        verified: t.verified,
      })),
      repositoryTracks: repoTracks,
    });
  }, [setList, sortedTracks, trackRepository, gapAnalysisMutation]);

  useEffect(() => {
    if (setList && sortedTracks.length > 0 && !gapAnalysis && !gapAnalysisMutation.isPending) {
      const timer = setTimeout(() => {
        runGapAnalysis();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [setList, sortedTracks.length]);

  const tracksWithGaps = useMemo(() => {
    if (!gapAnalysis || !showGaps) {
      return sortedTracks.map(track => ({ type: 'track' as const, data: track }));
    }

    const items: Array<{ type: 'track'; data: Track } | { type: 'gap'; data: TrackGap }> = [];
    const gaps = [...gapAnalysis.gaps].sort((a, b) => a.startTime - b.startTime);
    
    let gapIndex = 0;
    
    for (const gap of gaps) {
      if (!gap.previousTrack) {
        items.push({ type: 'gap', data: gap });
        gapIndex++;
        break;
      }
    }
    
    for (const track of sortedTracks) {
      items.push({ type: 'track', data: track });
      
      const gapAfterTrack = gaps.find(g => g.previousTrack?.id === track.id);
      if (gapAfterTrack) {
        items.push({ type: 'gap', data: gapAfterTrack });
      }
    }
    
    return items;
  }, [sortedTracks, gapAnalysis, showGaps]);

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

  const handleOpenIdentify = (timestamp?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIdentifyTimestamp(timestamp || 0);
    setShowIdentifyModal(true);
  };

  const handleGapAddTrack = (timestamp: number) => {
    setIdentifyTimestamp(timestamp);
    setShowAddModal(true);
  };

  const handleGapSelectSuggestion = (suggestion: TrackSuggestion, timestamp: number) => {
    const newTrack: Track = {
      id: Date.now().toString(),
      title: suggestion.title,
      artist: suggestion.artist,
      duration: suggestion.duration,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date(),
      source: 'ai',
      timestamp,
      contributedBy: 'AI Suggestion',
      verified: false,
    };
    
    setTracks(prev => [...prev, newTrack]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setTimeout(() => runGapAnalysis(), 100);
  };

  const handleGapIdentify = (timestamp: number) => {
    handleOpenIdentify(timestamp);
  };

  const handleTrackIdentified = (identifiedTrack: {
    title: string;
    artist: string;
    album?: string;
    releaseDate?: string;
    label?: string;
    confidence: number;
    duration?: number;
    links: {
      spotify?: string;
      youtube?: string;
      isrc?: string;
    };
  }, timestamp: number) => {
    const newTrack: Track = {
      id: Date.now().toString(),
      title: identifiedTrack.title,
      artist: identifiedTrack.artist,
      album: identifiedTrack.album,
      duration: identifiedTrack.duration || 0,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      addedAt: new Date(),
      source: 'ai',
      timestamp,
      contributedBy: 'ACRCloud',
      verified: true,
      trackLinks: identifiedTrack.links.spotify ? [{ platform: 'spotify', url: identifiedTrack.links.spotify }] : undefined,
    };
    
    setTracks(prev => [...prev, newTrack]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getAudioUrl = (): string | undefined => {
    const youtubeLink = setList?.sourceLinks.find(l => l.platform === 'youtube');
    if (youtubeLink) return youtubeLink.url;
    const soundcloudLink = setList?.sourceLinks.find(l => l.platform === 'soundcloud');
    if (soundcloudLink) return soundcloudLink.url;
    const mixcloudLink = setList?.sourceLinks.find(l => l.platform === 'mixcloud');
    if (mixcloudLink) return mixcloudLink.url;
    return undefined;
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

          {gapAnalysis && gapAnalysis.gaps.length > 0 && (
            <View style={styles.gapAnalysisBanner}>
              <View style={styles.gapBannerHeader}>
                <View style={styles.gapBannerLeft}>
                  <Brain size={18} color="#FB923C" />
                  <View>
                    <Text style={styles.gapBannerTitle}>Gap Analysis</Text>
                    <Text style={styles.gapBannerSubtitle}>
                      {gapAnalysis.gaps.length} gap{gapAnalysis.gaps.length > 1 ? 's' : ''} detected • ~{gapAnalysis.estimatedMissingTracks} missing
                    </Text>
                  </View>
                </View>
                <View style={styles.gapBannerActions}>
                  <Pressable 
                    style={styles.refreshButton}
                    onPress={runGapAnalysis}
                    disabled={gapAnalysisMutation.isPending}
                  >
                    {gapAnalysisMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FB923C" />
                    ) : (
                      <RefreshCw size={16} color="#FB923C" />
                    )}
                  </Pressable>
                  <Pressable 
                    style={[styles.toggleGapsButton, !showGaps && styles.toggleGapsButtonOff]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowGaps(!showGaps);
                    }}
                  >
                    <Text style={[styles.toggleGapsText, !showGaps && styles.toggleGapsTextOff]}>
                      {showGaps ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.coverageBar}>
                <View style={[styles.coverageFill, { width: `${gapAnalysis.coverage}%` }]} />
              </View>
              <Text style={styles.coverageText}>{gapAnalysis.coverage}% coverage</Text>
            </View>
          )}

          {gapAnalysisMutation.isPending && !gapAnalysis && (
            <View style={styles.analyzingBanner}>
              <ActivityIndicator size="small" color={Colors.dark.primary} />
              <Text style={styles.analyzingText}>Analyzing tracklist for gaps...</Text>
            </View>
          )}

          <View style={styles.tracksSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.sectionTitle}>Tracklist</Text>
              <View style={styles.trackActions}>
                <Pressable 
                  style={styles.identifyButton}
                  onPress={() => handleOpenIdentify()}
                >
                  <Scan size={16} color="#8B5CF6" />
                  <Text style={styles.identifyButtonText}>Identify</Text>
                </Pressable>
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
            </View>

            {tracksWithGaps.map((item, index) => {
              if (item.type === 'gap') {
                return (
                  <TrackGapCard
                    key={item.data.id}
                    gap={item.data}
                    onAddTrack={handleGapAddTrack}
                    onSelectSuggestion={handleGapSelectSuggestion}
                    onIdentify={handleGapIdentify}
                  />
                );
              }
              return (
                <TrackCard 
                  key={item.data.id} 
                  track={item.data}
                  showTimestamp
                  onPress={() => {
                    if (setList.sourceLinks.length > 0 && item.data.timestamp) {
                      const youtubeLink = setList.sourceLinks.find(l => l.platform === 'youtube');
                      if (youtubeLink) {
                        const url = `${youtubeLink.url}&t=${item.data.timestamp}`;
                        Linking.openURL(url);
                      }
                    }
                  }}
                  onContributorPress={(username) => setSelectedContributor(username)}
                />
              );
            })}
            
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

      <IdentifyTrackModal
        visible={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        onIdentified={handleTrackIdentified}
        timestamp={identifyTimestamp}
        setTitle={setList.name}
        audioUrl={getAudioUrl()}
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
  gapAnalysisBanner: {
    backgroundColor: 'rgba(251, 146, 60, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.2)',
  },
  gapBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  gapBannerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  gapBannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FB923C',
  },
  gapBannerSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  gapBannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleGapsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
  },
  toggleGapsButtonOff: {
    backgroundColor: Colors.dark.surface,
  },
  toggleGapsText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FB923C',
  },
  toggleGapsTextOff: {
    color: Colors.dark.textMuted,
  },
  coverageBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  coverageFill: {
    height: '100%',
    backgroundColor: '#FB923C',
    borderRadius: 2,
  },
  coverageText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 6,
  },
  analyzingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 10,
  },
  analyzingText: {
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
  trackActions: {
    flexDirection: 'row',
    gap: 8,
  },
  identifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 20,
  },
  identifyButtonText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '500' as const,
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
