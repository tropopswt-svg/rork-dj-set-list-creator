import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { X, Youtube, Music2, Sparkles, Check, AlertCircle, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';

interface AddSourceModalProps {
  visible: boolean;
  platform: 'youtube' | 'soundcloud';
  setName: string;
  setArtist?: string;
  onClose: () => void;
  onImport: (url: string) => Promise<{ success: boolean; stats?: any; error?: string }>;
}

type ImportStep = 'input' | 'validating' | 'warning' | 'importing' | 'success' | 'error';

export default function AddSourceModal({
  visible,
  platform,
  setName,
  setArtist,
  onClose,
  onImport,
}: AddSourceModalProps) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<ImportStep>('input');
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [pulseAnim] = useState(new Animated.Value(1));

  // Auto-paste from clipboard when modal opens
  useEffect(() => {
    if (visible && step === 'input') {
      const checkClipboard = async () => {
        try {
          const clipboardContent = await Clipboard.getStringAsync();
          if (clipboardContent) {
            const content = clipboardContent.toLowerCase();
            // Check if clipboard contains a URL matching the platform
            if (platform === 'youtube' && (content.includes('youtube.com') || content.includes('youtu.be'))) {
              setUrl(clipboardContent.trim());
            } else if (platform === 'soundcloud' && content.includes('soundcloud.com')) {
              setUrl(clipboardContent.trim());
            }
          }
        } catch (err) {
          // Clipboard access may be denied, just ignore
          console.log('Clipboard access error:', err);
        }
      };
      checkClipboard();
    }
  }, [visible, platform]);

  // Pulse animation
  useEffect(() => {
    if (step === 'importing' || step === 'validating') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [step]);

  // Check if the video title/description contains set info
  const validateSourceMatch = (title: string): { matches: boolean; warning?: string } => {
    if (!title) return { matches: true }; // Can't validate, assume ok

    const titleLower = title.toLowerCase();
    const setNameLower = setName.toLowerCase();
    const artistLower = setArtist?.toLowerCase() || '';

    // Extract words from set name and artist for flexible matching
    const setNameWords = setNameLower.split(/[\s\-_@]+/).filter(w => w.length > 2);
    const artistWords = artistLower.split(/[\s\-_@]+/).filter(w => w.length > 2);

    // Check if any significant set name words appear in the title
    const nameMatch = setNameWords.some(word => titleLower.includes(word));

    // Check if any significant artist words appear in the title
    const artistMatch = artistWords.some(word => titleLower.includes(word));

    // If neither set name nor artist match, show warning
    if (!nameMatch && !artistMatch && artistWords.length > 0) {
      return {
        matches: false,
        warning: `This video title doesn't appear to match the set.\n\nVideo: "${title}"\n\nExpected: "${setArtist}" - "${setName}"\n\nAre you sure this is the correct video?`
      };
    }

    return { matches: true };
  };

  const handleValidate = async () => {
    if (!url.trim()) return;

    // Validate URL matches platform
    const urlLower = url.toLowerCase();
    if (platform === 'youtube' && !urlLower.includes('youtube.com') && !urlLower.includes('youtu.be')) {
      setError('Please enter a valid YouTube URL');
      setStep('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (platform === 'soundcloud' && !urlLower.includes('soundcloud.com')) {
      setError('Please enter a valid SoundCloud URL');
      setStep('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Check for channel/profile URLs instead of video/track URLs
    if (platform === 'youtube') {
      if (urlLower.includes('/channel/') || urlLower.includes('/c/') || urlLower.includes('/@')) {
        setError('Please enter a YouTube video URL, not a channel URL');
        setStep('error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    setStep('validating');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Try to get video title for validation
      let title = '';

      if (platform === 'youtube') {
        // Try oEmbed to get video title
        const videoUrl = encodeURIComponent(url.trim());
        const oembedUrl = `https://www.youtube.com/oembed?url=${videoUrl}&format=json`;
        try {
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            title = data.title || '';
          }
        } catch {
          // oEmbed failed, skip validation
        }
      }

      // If we got a title, validate it
      if (title) {
        const validation = validateSourceMatch(title);
        if (!validation.matches) {
          setWarningMessage(validation.warning || '');
          setStep('warning');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
      }

      // Proceed with import
      proceedWithImport();
    } catch {
      // Validation failed, proceed anyway
      proceedWithImport();
    }
  };

  const proceedWithImport = async () => {
    setStep('importing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await onImport(url.trim());

      if (result.success) {
        setStats(result.stats);
        setStep('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(result.error || 'Import failed');
        setStep('error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setStep('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleClose = () => {
    setUrl('');
    setStep('input');
    setStats(null);
    setError('');
    setWarningMessage('');
    onClose();
  };

  const getPlatformIcon = () => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={32} color="#FF0000" />;
      case 'soundcloud':
        return <Music2 size={32} color="#FF5500" />;
    }
  };

  const getPlatformName = () => {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'soundcloud': return 'SoundCloud';
    }
  };

  const getPlatformColor = () => {
    switch (platform) {
      case 'youtube': return '#FF0000';
      case 'soundcloud': return '#FF5500';
    }
  };

  const getPlaceholder = () => {
    switch (platform) {
      case 'youtube': return 'https://youtube.com/watch?v=...';
      case 'soundcloud': return 'https://soundcloud.com/...';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: `${getPlatformColor()}20` }]}>
              {getPlatformIcon()}
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <X size={20} color={Colors.dark.textMuted} />
            </Pressable>
          </View>

          {/* Content based on step */}
          {step === 'input' && (
            <>
              <Text style={styles.title}>Add {getPlatformName()} Link</Text>
              <Text style={styles.subtitle}>
                Merge track identifications from {getPlatformName()} into &quot;{setName}&quot;
              </Text>

              <TextInput
                style={styles.input}
                placeholder={getPlaceholder()}
                placeholderTextColor={Colors.dark.textMuted}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              <View style={styles.infoBox}>
                <Sparkles size={16} color={Colors.dark.primary} />
                <Text style={styles.infoText}>
                  We&apos;ll scan comments for additional track IDs and merge them with existing tracks.
                  Earn +25 points for contributing!
                </Text>
              </View>

              <Pressable
                style={[styles.importButton, !url.trim() && styles.importButtonDisabled]}
                onPress={handleValidate}
                disabled={!url.trim()}
              >
                <Text style={styles.importButtonText}>Import & Merge</Text>
              </Pressable>
            </>
          )}

          {step === 'validating' && (
            <View style={styles.centerContent}>
              <Animated.View style={[styles.importingIcon, { transform: [{ scale: pulseAnim }] }]}>
                <Sparkles size={40} color={Colors.dark.primary} />
              </Animated.View>
              <Text style={styles.importingTitle}>Verifying...</Text>
              <Text style={styles.importingSubtitle}>
                Checking if this matches the set
              </Text>
              <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 20 }} />
            </View>
          )}

          {step === 'warning' && (
            <View style={styles.centerContent}>
              <View style={styles.warningIcon}>
                <AlertTriangle size={40} color="#FB923C" />
              </View>
              <Text style={styles.warningTitle}>Possible Mismatch</Text>
              <Text style={styles.warningMessage}>{warningMessage}</Text>

              <View style={styles.warningButtons}>
                <Pressable style={styles.proceedButton} onPress={proceedWithImport}>
                  <Text style={styles.proceedButtonText}>Import Anyway</Text>
                </Pressable>
                <Pressable style={styles.cancelButton} onPress={() => setStep('input')}>
                  <Text style={styles.cancelButtonText}>Go Back</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === 'importing' && (
            <View style={styles.centerContent}>
              <Animated.View style={[styles.importingIcon, { transform: [{ scale: pulseAnim }] }]}>
                <Sparkles size={40} color={Colors.dark.primary} />
              </Animated.View>
              <Text style={styles.importingTitle}>Scanning {getPlatformName()}...</Text>
              <Text style={styles.importingSubtitle}>
                Fetching comments and matching tracks
              </Text>
              <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 20 }} />
            </View>
          )}

          {step === 'success' && (
            <View style={styles.centerContent}>
              <View style={styles.successIcon}>
                <Check size={40} color={Colors.dark.success} />
              </View>
              <Text style={styles.successTitle}>Merge Complete!</Text>
              
              {stats && (
                <View style={styles.statsContainer}>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Tracks matched</Text>
                    <Text style={styles.statValue}>{stats.matched || 0}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>New tracks added</Text>
                    <Text style={styles.statValue}>{stats.newFromSecondary || 0}</Text>
                  </View>
                  {stats.conflictsCreated > 0 && (
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Conflicts (need votes)</Text>
                      <Text style={[styles.statValue, { color: '#FB923C' }]}>
                        {stats.conflictsCreated}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.pointsEarned}>
                <Sparkles size={16} color={Colors.dark.primary} />
                <Text style={styles.pointsText}>+25 points earned!</Text>
              </View>

              <Pressable style={styles.doneButton} onPress={handleClose}>
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          )}

          {step === 'error' && (
            <View style={styles.centerContent}>
              <View style={styles.errorIcon}>
                <AlertCircle size={40} color={Colors.dark.error} />
              </View>
              <Text style={styles.errorTitle}>Import Failed</Text>
              <Text style={styles.errorMessage}>{error}</Text>

              <View style={styles.errorButtons}>
                <Pressable style={styles.retryButton} onPress={() => setStep('input')}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </Pressable>
                <Pressable style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  importButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  importingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  importingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  importingSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 20,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  pointsEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  doneButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  doneButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '600',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  warningIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  warningMessage: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  warningButtons: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  proceedButton: {
    backgroundColor: '#FB923C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  proceedButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
