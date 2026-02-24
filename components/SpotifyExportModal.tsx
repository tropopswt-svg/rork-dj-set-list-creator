/**
 * SpotifyExportModal — Export a set's tracklist as a Spotify playlist.
 *
 * Three states:
 * - Idle: confirmation screen with track count and export button
 * - Exporting: progress bar with phase-specific messages
 * - Done/Error: results summary with "Open in Spotify" and unmatched tracks
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Music2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  LogOut,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Track } from '@/types';
import { getPublicTrackStatus } from '@/lib/trackStatus';
import {
  isSpotifyConnected,
  getSpotifyDisplayName,
  disconnectSpotify,
} from '@/services/spotifyAuth';
import {
  exportSetToSpotify,
  ExportProgress,
  ExportResult,
} from '@/services/spotifyExportService';

// ============================================
// Constants
// ============================================

const SPOTIFY_GREEN = '#1DB954';

// ============================================
// Props
// ============================================

interface SpotifyExportModalProps {
  visible: boolean;
  onClose: () => void;
  setName: string;
  artist: string;
  tracks: Track[];
}

// ============================================
// Component
// ============================================

type ModalState = 'idle' | 'exporting' | 'done';

export default function SpotifyExportModal({
  visible,
  onClose,
  setName,
  artist,
  tracks,
}: SpotifyExportModalProps) {
  const [state, setState] = useState<ModalState>('idle');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [connected, setConnected] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  // Check connection status when modal opens
  useEffect(() => {
    if (visible) {
      setState('idle');
      setProgress(null);
      setResult(null);
      setShowUnmatched(false);
      checkConnection();
    }
  }, [visible]);

  const checkConnection = async () => {
    const isConnected = await isSpotifyConnected();
    setConnected(isConnected);
    if (isConnected) {
      const name = await getSpotifyDisplayName();
      setDisplayName(name);
    } else {
      setDisplayName(null);
    }
  };

  const handleExport = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('exporting');

    const exportResult = await exportSetToSpotify(setName, artist, tracks, (p) => {
      setProgress(p);
    });

    setResult(exportResult);
    setState('done');

    if (exportResult.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [setName, artist, tracks]);

  const handleOpenSpotify = useCallback(() => {
    if (result?.playlistUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(result.playlistUrl);
    }
  }, [result]);

  const handleDisconnect = useCallback(async () => {
    await disconnectSpotify();
    setConnected(false);
    setDisplayName(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleClose = () => {
    if (state === 'exporting') return; // Don't close while exporting
    onClose();
  };

  const eligibleTracks = tracks.filter((t) => getPublicTrackStatus(t) === 'released');

  // Group unmatched tracks by reason
  const unmatchedByReason = result?.tracksNotFound.reduce(
    (acc, t) => {
      acc[t.reason] = acc[t.reason] || [];
      acc[t.reason].push(t);
      return acc;
    },
    {} as Record<string, typeof result.tracksNotFound>,
  );

  const reasonLabels: Record<string, string> = {
    unreleased: 'Unreleased',
    id: 'Unidentified (ID)',
    not_found: 'Not found on Spotify',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Music2 size={20} color={SPOTIFY_GREEN} />
              <Text style={styles.headerTitle}>Export to Spotify</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={8} disabled={state === 'exporting'}>
              <X size={24} color={state === 'exporting' ? Colors.dark.textMuted : Colors.dark.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            {/* ===================== IDLE STATE ===================== */}
            {state === 'idle' && (
              <View>
                <Text style={styles.description}>
                  Create a Spotify playlist from this set's tracklist.
                </Text>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{tracks.length}</Text>
                    <Text style={styles.statLabel}>Total tracks</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statNumber, { color: SPOTIFY_GREEN }]}>{eligibleTracks.length}</Text>
                    <Text style={styles.statLabel}>Eligible</Text>
                  </View>
                  {tracks.length - eligibleTracks.length > 0 && (
                    <View style={styles.statBox}>
                      <Text style={[styles.statNumber, { color: Colors.dark.textMuted }]}>
                        {tracks.length - eligibleTracks.length}
                      </Text>
                      <Text style={styles.statLabel}>Skipped</Text>
                    </View>
                  )}
                </View>

                {tracks.length - eligibleTracks.length > 0 && (
                  <View style={styles.infoBox}>
                    <AlertCircle size={14} color={Colors.dark.warning} />
                    <Text style={styles.infoText}>
                      Unreleased and unidentified tracks will be skipped.
                    </Text>
                  </View>
                )}

                {connected && displayName && (
                  <View style={styles.connectedRow}>
                    <View style={styles.connectedInfo}>
                      <View style={[styles.connectedDot, { backgroundColor: SPOTIFY_GREEN }]} />
                      <Text style={styles.connectedText}>
                        Connected as <Text style={styles.connectedName}>{displayName}</Text>
                      </Text>
                    </View>
                    <Pressable onPress={handleDisconnect} hitSlop={8}>
                      <LogOut size={16} color={Colors.dark.textMuted} />
                    </Pressable>
                  </View>
                )}

                <Pressable style={styles.exportButton} onPress={handleExport}>
                  <Music2 size={18} color="#FFFFFF" />
                  <Text style={styles.exportButtonText}>
                    {connected ? 'Export to Spotify' : 'Connect & Export'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ===================== EXPORTING STATE ===================== */}
            {state === 'exporting' && progress && (
              <View>
                <Text style={styles.exportingTitle}>
                  {progress.phase === 'authenticating' && 'Connecting to Spotify...'}
                  {progress.phase === 'resolving' && 'Matching tracks...'}
                  {progress.phase === 'creating' && 'Creating playlist...'}
                  {progress.phase === 'adding' && 'Adding tracks...'}
                </Text>

                <Text style={styles.exportingMessage} numberOfLines={2}>
                  {progress.message}
                </Text>

                {/* Progress bar */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width:
                          progress.total > 0
                            ? `${Math.round((progress.current / progress.total) * 100)}%`
                            : '0%',
                      },
                    ]}
                  />
                </View>

                <Text style={styles.progressText}>
                  {progress.current} / {progress.total}
                </Text>

                <ActivityIndicator size="small" color={SPOTIFY_GREEN} style={styles.spinner} />
              </View>
            )}

            {/* ===================== DONE STATE ===================== */}
            {state === 'done' && result && (
              <View>
                {result.success ? (
                  <>
                    <View style={styles.successHeader}>
                      <CheckCircle size={32} color={SPOTIFY_GREEN} />
                      <Text style={styles.successTitle}>Playlist Created!</Text>
                    </View>

                    <View style={styles.resultStats}>
                      <Text style={styles.resultStatText}>
                        <Text style={[styles.resultStatBold, { color: SPOTIFY_GREEN }]}>
                          {result.tracksAdded}
                        </Text>{' '}
                        of {result.totalTracks} tracks added
                      </Text>
                    </View>

                    {result.playlistUrl && (
                      <Pressable style={styles.openSpotifyButton} onPress={handleOpenSpotify}>
                        <ExternalLink size={18} color="#FFFFFF" />
                        <Text style={styles.openSpotifyText}>Open in Spotify</Text>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.errorHeader}>
                      <AlertCircle size={32} color={Colors.dark.error} />
                      <Text style={styles.errorTitle}>Export Failed</Text>
                    </View>
                    <Text style={styles.errorMessage}>{result.error}</Text>
                  </>
                )}

                {/* Unmatched tracks */}
                {result.tracksNotFound.length > 0 && (
                  <View style={styles.unmatchedSection}>
                    <Pressable
                      style={styles.unmatchedHeader}
                      onPress={() => setShowUnmatched(!showUnmatched)}
                    >
                      <Text style={styles.unmatchedHeaderText}>
                        {result.tracksNotFound.length} track{result.tracksNotFound.length !== 1 ? 's' : ''} not added
                      </Text>
                      {showUnmatched ? (
                        <ChevronUp size={18} color={Colors.dark.textMuted} />
                      ) : (
                        <ChevronDown size={18} color={Colors.dark.textMuted} />
                      )}
                    </Pressable>

                    {showUnmatched && unmatchedByReason && (
                      <View style={styles.unmatchedList}>
                        {Object.entries(unmatchedByReason).map(([reason, items]) => (
                          <View key={reason}>
                            <Text style={styles.unmatchedReasonLabel}>
                              {reasonLabels[reason] || reason}
                            </Text>
                            {items.map((t, i) => (
                              <Text key={`${reason}-${i}`} style={styles.unmatchedTrack}>
                                {t.artist} — {t.title}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <Pressable style={styles.doneButton} onPress={handleClose}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// Styles
// ============================================

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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  scrollContent: {
    maxHeight: 500,
  },

  // — Idle —
  description: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(237, 108, 2, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 17,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  connectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  connectedName: {
    fontWeight: '600',
    color: Colors.dark.text,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPOTIFY_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginTop: 4,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // — Exporting —
  exportingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  exportingMessage: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    minHeight: 36,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: SPOTIFY_GREEN,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  spinner: {
    marginTop: 8,
  },

  // — Done —
  successHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  resultStats: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resultStatText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  resultStatBold: {
    fontWeight: '700',
    fontSize: 17,
  },
  openSpotifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPOTIFY_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 16,
  },
  openSpotifyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.error,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },

  // — Unmatched tracks —
  unmatchedSection: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  unmatchedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  unmatchedHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  unmatchedList: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  unmatchedReasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  unmatchedTrack: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    paddingLeft: 8,
  },

  // — Done button —
  doneButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
});
