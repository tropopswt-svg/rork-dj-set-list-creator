import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Send, Volume2, ExternalLink, Youtube, Music2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Colors from '@/constants/colors';

interface AudioPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitIdentification: (artist: string, title: string) => void;
  sourceUrl: string | null;
  sourcePlatform: 'youtube' | 'soundcloud' | null;
  timestamp: number; // in seconds
  trackArtist?: string; // pre-fill if we have partial ID
}

export default function AudioPreviewModal({
  visible,
  onClose,
  onSubmitIdentification,
  sourceUrl,
  sourcePlatform,
  timestamp,
  trackArtist,
}: AudioPreviewModalProps) {
  const [artistInput, setArtistInput] = useState(trackArtist || '');
  const [titleInput, setTitleInput] = useState('');
  const [hasListened, setHasListened] = useState(false);

  // Reset inputs when modal opens
  useEffect(() => {
    if (visible) {
      setArtistInput(trackArtist || '');
      setTitleInput('');
      setHasListened(false);
    }
  }, [visible, trackArtist]);

  const formatTimestamp = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get URL with timestamp for direct playback
  const getPlaybackUrl = (): string | null => {
    if (!sourceUrl || !sourcePlatform) return null;

    if (sourcePlatform === 'youtube') {
      // Convert to youtube.com/watch URL with timestamp
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
      ];
      for (const pattern of patterns) {
        const match = sourceUrl.match(pattern);
        if (match) {
          const videoId = match[1];
          return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestamp)}s`;
        }
      }
      return sourceUrl;
    }

    if (sourcePlatform === 'soundcloud') {
      // SoundCloud doesn't support timestamp in URL for sets easily
      // Just return the URL and user can seek
      return sourceUrl;
    }

    return sourceUrl;
  };

  const handleListen = async () => {
    const url = getPlaybackUrl();
    if (!url) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHasListened(true);

    // Open in in-app browser
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      controlsColor: Colors.dark.primary,
      toolbarColor: Colors.dark.surface,
    });
  };

  const handleSubmit = () => {
    if (!artistInput.trim() || !titleInput.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmitIdentification(artistInput.trim(), titleInput.trim());
    onClose();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!sourceUrl || !sourcePlatform) {
    return null;
  }

  const PlatformIcon = sourcePlatform === 'youtube' ? Youtube : Music2;
  const platformColor = sourcePlatform === 'youtube' ? '#FF0000' : '#FF5500';
  const platformName = sourcePlatform === 'youtube' ? 'YouTube' : 'SoundCloud';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Volume2 size={20} color={Colors.dark.primary} />
              <Text style={styles.headerTitle}>Identify Track</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={8}>
              <X size={24} color={Colors.dark.textSecondary} />
            </Pressable>
          </View>

          {/* Listen Button */}
          <View style={styles.listenSection}>
            <Text style={styles.listenLabel}>Step 1: Listen to the track</Text>
            <Pressable style={styles.listenButton} onPress={handleListen}>
              <View style={[styles.platformIcon, { backgroundColor: `${platformColor}20` }]}>
                <PlatformIcon size={24} color={platformColor} />
              </View>
              <View style={styles.listenButtonContent}>
                <Text style={styles.listenButtonTitle}>Open in {platformName}</Text>
                <Text style={styles.listenButtonSubtitle}>
                  Starts at {formatTimestamp(timestamp)}
                </Text>
              </View>
              <ExternalLink size={20} color={Colors.dark.textMuted} />
            </Pressable>
            {hasListened && (
              <View style={styles.listenedBadge}>
                <Text style={styles.listenedText}>Opened - come back when you've identified it</Text>
              </View>
            )}
          </View>

          {/* Identification Form */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Step 2: Enter track details</Text>
            <View style={styles.form}>
              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, styles.inputHalf]}>
                  <Text style={styles.inputLabel}>Artist</Text>
                  <TextInput
                    style={styles.input}
                    value={artistInput}
                    onChangeText={setArtistInput}
                    placeholder="Artist name"
                    placeholderTextColor={Colors.dark.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={[styles.inputContainer, styles.inputHalf]}>
                  <Text style={styles.inputLabel}>Track Title</Text>
                  <TextInput
                    style={styles.input}
                    value={titleInput}
                    onChangeText={setTitleInput}
                    placeholder="Track title"
                    placeholderTextColor={Colors.dark.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  (!artistInput.trim() || !titleInput.trim()) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!artistInput.trim() || !titleInput.trim()}
              >
                <Send size={18} color="#FFF" />
                <Text style={styles.submitButtonText}>Submit Identification</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  content: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  listenSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  listenLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  listenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  platformIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenButtonContent: {
    flex: 1,
  },
  listenButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  listenButtonSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  listenedBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  listenedText: {
    fontSize: 12,
    color: '#22C55E',
    textAlign: 'center',
  },
  formSection: {
    paddingHorizontal: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  form: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputContainer: {
    gap: 4,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  input: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    borderRadius: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
