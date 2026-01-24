import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Minimize2, 
  Maximize2,
  Volume2,
  VolumeX,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface YouTubePlayerProps {
  videoId: string;
  initialTimestamp?: number;
  onTimestampChange?: (timestamp: number) => void;
  onClose?: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

// Extract video ID from various YouTube URL formats
export const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^&?\s]+)/);
  return match ? match[1] : null;
};

// Format seconds to mm:ss or hh:mm:ss
const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function YouTubePlayer({
  videoId,
  initialTimestamp = 0,
  onTimestampChange,
  onClose,
  minimized = false,
  onToggleMinimize,
}: YouTubePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTimestamp);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const slideAnim = useRef(new Animated.Value(minimized ? 0 : 1)).current;

  // Send command to YouTube iframe
  const sendCommand = (func: string, args?: any) => {
    if (Platform.OS !== 'web' || !iframeRef.current?.contentWindow) return;
    
    const message = JSON.stringify({
      event: 'command',
      func,
      args: args || [],
    });
    
    iframeRef.current.contentWindow.postMessage(message, 'https://www.youtube.com');
  };

  // Animate minimize/maximize
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: minimized ? 0 : 1,
      friction: 10,
      tension: 80,
      useNativeDriver: false,
    }).start();
  }, [minimized]);

  // Seek when initialTimestamp changes (e.g., when user taps a track)
  const lastSeekTimestamp = useRef(initialTimestamp);
  useEffect(() => {
    if (playerReady && initialTimestamp !== lastSeekTimestamp.current) {
      lastSeekTimestamp.current = initialTimestamp;
      sendCommand('seekTo', [initialTimestamp, true]);
      sendCommand('playVideo');
      setCurrentTime(initialTimestamp);
      setIsPlaying(true);
    }
  }, [initialTimestamp, playerReady]);

  // Listen for messages from the YouTube iframe
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'onStateChange') {
          // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
          setIsPlaying(data.info === 1);
        } else if (data.event === 'onReady') {
          setPlayerReady(true);
        } else if (data.event === 'infoDelivery' && data.info) {
          if (data.info.currentTime !== undefined) {
            setCurrentTime(data.info.currentTime);
            onTimestampChange?.(Math.floor(data.info.currentTime));
          }
          if (data.info.duration !== undefined) {
            setDuration(data.info.duration);
          }
        }
      } catch (e) {
        // Not a JSON message, ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTimestampChange]);

  const togglePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      sendCommand('pauseVideo');
    } else {
      sendCommand('playVideo');
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isMuted) {
      sendCommand('unMute');
    } else {
      sendCommand('mute');
    }
    setIsMuted(!isMuted);
  };

  const seekTo = (seconds: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendCommand('seekTo', [seconds, true]);
    setCurrentTime(seconds);
  };

  const skipBack = () => {
    seekTo(Math.max(0, currentTime - 15));
  };

  const skipForward = () => {
    seekTo(Math.min(duration, currentTime + 15));
  };

  const handleMinimize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleMinimize?.();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendCommand('pauseVideo');
    onClose?.();
  };

  // Calculate animated styles
  const playerHeight = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 220],
  });

  const videoOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  const controlsOpacity = slideAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0, 0, 1],
  });

  // YouTube embed URL with API enabled
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${initialTimestamp}&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3`;

  if (Platform.OS !== 'web') {
    // For native, we'd use WebView - for now show a placeholder
    return (
      <View style={styles.nativeContainer}>
        <Text style={styles.nativeText}>YouTube player available on web</Text>
        <Pressable style={styles.nativeButton} onPress={onClose}>
          <Text style={styles.nativeButtonText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { height: playerHeight }]}>
      {/* Video iframe */}
      <Animated.View style={[styles.videoContainer, { opacity: videoOpacity }]}>
        {!minimized && (
          <iframe
            ref={iframeRef as any}
            src={embedUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 12,
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </Animated.View>

      {/* Minimized bar */}
      {minimized && (
        <View style={styles.minimizedBar}>
          <Pressable style={styles.miniPlayButton} onPress={togglePlay}>
            {isPlaying ? (
              <Pause size={18} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
            )}
          </Pressable>
          <View style={styles.miniInfo}>
            <Text style={styles.miniTimeText}>{formatTime(currentTime)}</Text>
            <View style={styles.miniProgressBg}>
              <View 
                style={[
                  styles.miniProgressFill, 
                  { width: duration ? `${(currentTime / duration) * 100}%` : '0%' }
                ]} 
              />
            </View>
          </View>
          <Pressable style={styles.miniButton} onPress={handleMinimize}>
            <ChevronUp size={20} color={Colors.dark.text} />
          </Pressable>
          <Pressable style={styles.miniButton} onPress={handleClose}>
            <X size={18} color={Colors.dark.textMuted} />
          </Pressable>
        </View>
      )}

      {/* Full controls */}
      {!minimized && (
        <Animated.View style={[styles.controls, { opacity: controlsOpacity }]}>
          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: duration ? `${(currentTime / duration) * 100}%` : '0%' }
                ]} 
              />
              <Pressable
                style={[
                  styles.progressHandle,
                  { left: duration ? `${(currentTime / duration) * 100}%` : '0%' }
                ]}
                onPress={() => {
                  // Could implement drag here
                }}
              />
            </View>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>

          {/* Control buttons */}
          <View style={styles.controlButtons}>
            <Pressable style={styles.controlButton} onPress={toggleMute}>
              {isMuted ? (
                <VolumeX size={20} color={Colors.dark.textSecondary} />
              ) : (
                <Volume2 size={20} color={Colors.dark.text} />
              )}
            </Pressable>

            <View style={styles.mainControls}>
              <Pressable style={styles.skipButton} onPress={skipBack}>
                <SkipBack size={22} color={Colors.dark.text} />
                <Text style={styles.skipText}>15</Text>
              </Pressable>

              <Pressable style={styles.playButton} onPress={togglePlay}>
                {isPlaying ? (
                  <Pause size={28} color={Colors.dark.background} fill={Colors.dark.background} />
                ) : (
                  <Play size={28} color={Colors.dark.background} fill={Colors.dark.background} />
                )}
              </Pressable>

              <Pressable style={styles.skipButton} onPress={skipForward}>
                <SkipForward size={22} color={Colors.dark.text} />
                <Text style={styles.skipText}>15</Text>
              </Pressable>
            </View>

            <View style={styles.rightControls}>
              <Pressable style={styles.controlButton} onPress={handleMinimize}>
                <ChevronDown size={20} color={Colors.dark.textSecondary} />
              </Pressable>
              <Pressable style={styles.controlButton} onPress={handleClose}>
                <X size={20} color={Colors.dark.textSecondary} />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  videoContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 8,
    marginBottom: 0,
  },
  controls: {
    padding: 12,
    paddingTop: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    fontVariant: ['tabular-nums'],
    minWidth: 45,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.dark.primary,
    borderRadius: 2,
  },
  progressHandle: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.dark.primary,
    marginLeft: -8,
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    padding: 8,
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  skipButton: {
    alignItems: 'center',
    padding: 8,
  },
  skipText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    marginTop: -4,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Minimized state
  minimizedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
  },
  miniPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInfo: {
    flex: 1,
  },
  miniTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  miniProgressBg: {
    height: 3,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 1.5,
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 1.5,
  },
  miniButton: {
    padding: 8,
  },
  // Native fallback
  nativeContainer: {
    padding: 20,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  nativeText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  nativeButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  nativeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.background,
  },
});
