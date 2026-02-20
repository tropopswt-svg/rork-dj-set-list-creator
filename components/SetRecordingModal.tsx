import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  ScrollView,
  TextInput,
  Easing,
} from 'react-native';
import {
  X,
  Music2,
  ExternalLink,
  CheckCircle,
  Disc3,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import {
  startSetRecording,
  stopSetRecording,
  getIdentifiedTracks,
  IdentifiedTrack,
} from './SetRecordingService';

const { width } = Dimensions.get('window');

interface SetRecordingModalProps {
  visible: boolean;
  onClose: () => void;
  onRecordingStart: () => void;
  onRecordingEnd: (tracks: IdentifiedTrack[], sessionId: string | null) => void;
  onSaveAsSet?: (tracks: IdentifiedTrack[], name: string, djName: string, venue: string) => void;
  isRecordingActive: boolean;
}

type ModalState = 'start' | 'active' | 'finished';

// Generate waveform bars
const generateBars = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const noise1 = Math.sin(i * 0.8) * 0.3;
    const noise2 = Math.sin(i * 1.7) * 0.2;
    const noise3 = Math.sin(i * 0.3) * 0.25;
    return Math.min(1, 0.35 + Math.abs(noise1 + noise2 + noise3));
  });

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimestamp(date: Date, startTime: Date): string {
  const diff = date.getTime() - startTime.getTime();
  return formatElapsed(diff);
}

// Waveform animation for recording state
const RecordingWaveform = ({ isActive }: { isActive: boolean }) => {
  const pulseAnims = useRef(
    Array.from({ length: 20 }, () => new Animated.Value(0))
  ).current;
  const bars = generateBars(20);

  useEffect(() => {
    if (isActive) {
      pulseAnims.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 80),
            Animated.timing(anim, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      pulseAnims.forEach((anim) => {
        anim.stopAnimation();
        anim.setValue(0);
      });
    }
    return () => pulseAnims.forEach((a) => a.stopAnimation());
  }, [isActive]);

  return (
    <View style={styles.waveformRow}>
      {bars.map((h, i) => {
        const scale = pulseAnims[i % pulseAnims.length].interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.waveformBar,
              {
                height: h * 40,
                transform: [{ scaleY: scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

export default function SetRecordingModal({
  visible,
  onClose,
  onRecordingStart,
  onRecordingEnd,
  onSaveAsSet,
  isRecordingActive,
}: SetRecordingModalProps) {
  const [modalState, setModalState] = useState<ModalState>('start');
  const [setName, setSetName] = useState('');
  const [djName, setDjName] = useState('');
  const [venue, setVenue] = useState('');
  const [tracks, setTracks] = useState<IdentifiedTrack[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [finishedDuration, setFinishedDuration] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotPulseAnim = useRef(new Animated.Value(1)).current;

  // When modal opens while recording is already active, show active state
  useEffect(() => {
    if (visible) {
      if (isRecordingActive) {
        setModalState('active');
        setTracks(getIdentifiedTracks());
      } else {
        setModalState('start');
        setTracks([]);
        setElapsed(0);
        setFinishedDuration(0);
        const defaultName = `Live Set - ${new Date().toLocaleDateString()}`;
        setSetName(defaultName);
        setDjName('');
        setVenue('');
      }
    }
  }, [visible, isRecordingActive]);

  // Timer
  useEffect(() => {
    if (modalState === 'active' && startTime) {
      const interval = setInterval(() => {
        setElapsed(Date.now() - startTime.getTime());
        setTracks(getIdentifiedTracks());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [modalState, startTime]);

  // Pulse animation for record button
  useEffect(() => {
    if (modalState === 'start') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
    pulseAnim.setValue(1);
  }, [modalState]);

  // Red dot pulse for active state
  useEffect(() => {
    if (modalState === 'active') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(dotPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [modalState]);

  const handleStartRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const now = new Date();
    setStartTime(now);
    setModalState('active');
    setTracks([]);

    try {
      await startSetRecording(
        {
          onTrackIdentified: (track) => {
            setTracks(getIdentifiedTracks());
          },
          onStatusChange: () => {},
        },
        { title: setName }
      );
      onRecordingStart();
    } catch (e) {
      console.error('[SetRecordingModal] Failed to start:', e);
      setModalState('start');
    }
  }, [onRecordingStart, setName]);

  const handleStopRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const result = await stopSetRecording();
    setFinishedDuration(result.duration);
    setTracks(result.tracks);
    setModalState('finished');
    onRecordingEnd(result.tracks, result.sessionId);
  }, [onRecordingEnd]);

  const handleSaveAsSet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onSaveAsSet) {
      onSaveAsSet(tracks, setName, djName, venue);
    }
    onClose();
  }, [tracks, setName, djName, venue, onSaveAsSet, onClose]);

  const handleClose = useCallback(() => {
    if (modalState === 'active') {
      // Don't close if recording - just dismiss modal, recording continues in background
      onClose();
    } else {
      onClose();
    }
  }, [modalState, onClose]);

  const renderStartState = () => (
    <View style={styles.startContent}>
      <Text style={styles.heroTitle}>Record a Set</Text>
      <Text style={styles.heroSubtitle}>
        Press record, put your phone away, and enjoy the set
      </Text>

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Pressable style={styles.recordButton} onPress={handleStartRecording}>
          <View style={styles.recordButtonOuter}>
            <View style={styles.recordButtonInner} />
          </View>
        </Pressable>
      </Animated.View>

      <TextInput
        style={styles.nameInput}
        value={setName}
        onChangeText={setSetName}
        placeholder="Set name (optional)"
        placeholderTextColor={Colors.dark.textMuted}
        selectionColor={Colors.dark.primary}
      />

      <View style={styles.instructionsList}>
        <Text style={styles.instructionItem}>
          Identifies tracks every ~60 seconds
        </Text>
        <Text style={styles.instructionItem}>
          Works with screen locked
        </Text>
        <Text style={styles.instructionItem}>
          Tap the banner to check progress
        </Text>
      </View>
    </View>
  );

  const renderActiveState = () => (
    <View style={styles.activeContent}>
      <View style={styles.activeHeader}>
        <Animated.View style={[styles.liveDot, { opacity: dotPulseAnim }]} />
        <Text style={styles.liveLabel}>RECORDING</Text>
      </View>

      <Text style={styles.elapsedTime}>{formatElapsed(elapsed)}</Text>

      <Text style={styles.trackCountLabel}>
        {tracks.length} track{tracks.length !== 1 ? 's' : ''} identified
      </Text>

      <RecordingWaveform isActive={true} />

      {tracks.length > 0 && (
        <ScrollView
          style={styles.trackList}
          contentContainerStyle={styles.trackListContent}
          showsVerticalScrollIndicator={false}
        >
          {tracks.map((track, index) => (
            <View key={`${track.title}-${index}`} style={styles.trackItem}>
              <View style={styles.trackItemLeft}>
                <Text style={styles.trackTimestamp}>
                  {startTime ? formatTimestamp(track.identifiedAt, startTime) : ''}
                </Text>
              </View>
              <View style={styles.trackItemInfo}>
                <Text style={styles.trackItemTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.trackItemArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
              </View>
              <Text style={styles.trackItemConfidence}>
                {track.confidence}%
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <Pressable style={styles.endButton} onPress={handleStopRecording}>
        <Text style={styles.endButtonText}>End Recording</Text>
      </Pressable>
    </View>
  );

  const renderFinishedState = () => (
    <ScrollView
      style={styles.finishedScroll}
      contentContainerStyle={styles.finishedContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.finishedHeader}>
        <CheckCircle size={48} color={Colors.dark.success} />
        <Text style={styles.finishedTitle}>Set Complete</Text>
        <Text style={styles.finishedSummary}>
          {tracks.length} track{tracks.length !== 1 ? 's' : ''} identified in{' '}
          {formatElapsed(finishedDuration)}
        </Text>
      </View>

      {tracks.length > 0 && (
        <View style={styles.finishedTrackList}>
          {tracks.map((track, index) => (
            <View key={`${track.title}-${index}`} style={styles.finishedTrackItem}>
              <View style={styles.finishedTrackNumber}>
                <Text style={styles.finishedTrackNumberText}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.finishedTrackInfo}>
                <Text style={styles.finishedTrackTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.finishedTrackArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
                {track.label && (
                  <Text style={styles.finishedTrackLabel}>{track.label}</Text>
                )}
              </View>
              {track.links?.spotify && (
                <Pressable style={styles.spotifyLink}>
                  <Music2 size={14} color="#1DB954" />
                  <ExternalLink size={10} color={Colors.dark.textMuted} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {onSaveAsSet && tracks.length > 0 && (
        <View style={styles.saveSection}>
          <Text style={styles.saveSectionTitle}>Save to your library</Text>
          <TextInput
            style={styles.saveInput}
            value={setName}
            onChangeText={setSetName}
            placeholder="Set name"
            placeholderTextColor={Colors.dark.textMuted}
            selectionColor={Colors.dark.primary}
          />
          <TextInput
            style={styles.saveInput}
            value={djName}
            onChangeText={setDjName}
            placeholder="DJ name"
            placeholderTextColor={Colors.dark.textMuted}
            selectionColor={Colors.dark.primary}
          />
          <TextInput
            style={styles.saveInput}
            value={venue}
            onChangeText={setVenue}
            placeholder="Venue / event (optional)"
            placeholderTextColor={Colors.dark.textMuted}
            selectionColor={Colors.dark.primary}
          />
        </View>
      )}

      <View style={styles.finishedActions}>
        {onSaveAsSet && tracks.length > 0 && (
          <Pressable style={styles.saveButton} onPress={handleSaveAsSet}>
            <Disc3 size={18} color="#fff" />
            <Text style={styles.saveButtonText}>Save as Set</Text>
          </Pressable>
        )}
        <Pressable style={styles.closeFinishedButton} onPress={onClose}>
          <Text style={styles.closeFinishedText}>Close</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Close / minimize button */}
        {modalState !== 'finished' && (
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={24} color={Colors.dark.text} />
          </Pressable>
        )}

        {modalState === 'start' && renderStartState()}
        {modalState === 'active' && renderActiveState()}
        {modalState === 'finished' && renderFinishedState()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  // Start state
  startContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 22,
  },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  recordButtonOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(196, 30, 58, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  nameInput: {
    width: width - 80,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    textAlign: 'center',
    marginBottom: 32,
  },
  instructionsList: {
    gap: 8,
    alignItems: 'center',
  },
  instructionItem: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },

  // Active state
  activeContent: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.dark.primary,
  },
  liveLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.dark.primary,
    letterSpacing: 2,
  },
  elapsedTime: {
    fontSize: 56,
    fontWeight: '200',
    color: Colors.dark.text,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  trackCountLabel: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginBottom: 24,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 2,
    marginBottom: 24,
  },
  waveformBar: {
    width: 3,
    backgroundColor: Colors.dark.primary,
    borderRadius: 2,
    opacity: 0.5,
  },
  trackList: {
    flex: 1,
    width: '100%',
  },
  trackListContent: {
    paddingBottom: 16,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
  },
  trackItemLeft: {
    width: 50,
    marginRight: 10,
  },
  trackTimestamp: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    fontVariant: ['tabular-nums'],
  },
  trackItemInfo: {
    flex: 1,
  },
  trackItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  trackItemArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  trackItemConfidence: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
    marginLeft: 8,
  },
  endButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 16,
    marginBottom: 40,
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Finished state
  finishedScroll: {
    flex: 1,
  },
  finishedContent: {
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  finishedHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  finishedTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  finishedSummary: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  finishedTrackList: {
    gap: 6,
    marginBottom: 32,
  },
  finishedTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
  },
  finishedTrackNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  finishedTrackNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  finishedTrackInfo: {
    flex: 1,
  },
  finishedTrackTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  finishedTrackArtist: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  finishedTrackLabel: {
    fontSize: 11,
    color: Colors.dark.primary,
    marginTop: 2,
  },
  spotifyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  saveSection: {
    marginBottom: 24,
  },
  saveSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  saveInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 8,
  },
  finishedActions: {
    gap: 12,
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 16,
    width: width - 48,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  closeFinishedButton: {
    paddingVertical: 14,
  },
  closeFinishedText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
});
