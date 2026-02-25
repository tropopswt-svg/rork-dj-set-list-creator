import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Volume2,
  VolumeX,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

// Only import WebView on native — it's not needed on web and would break SSR
const WebView = Platform.OS !== 'web'
  ? require('react-native-webview').default
  : null;

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

// HTML template for native WebView — loads YouTube IFrame API and bridges
// messages back to React Native via window.ReactNativeWebView.postMessage.
export const buildNativeHTML = (videoId: string, startTime: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#000;overflow:hidden}
    #player{width:100%;height:100%}
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var tag=document.createElement('script');
    tag.src="https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    var player;
    var pollId;

    function onYouTubeIframeAPIReady(){
      player=new YT.Player('player',{
        videoId:'${videoId}',
        playerVars:{
          playsinline:1,
          start:${Math.floor(startTime)},
          rel:0,
          modestbranding:1,
          iv_load_policy:3,
          controls:0,
          origin:'https://rork-dj-set-list-creator.vercel.app'
        },
        events:{
          onReady:function(){
            player.unMute();player.setVolume(100);player.playVideo();
            var dur=player.getDuration()||0;
            window.ReactNativeWebView.postMessage(JSON.stringify({event:'onReady',info:{duration:dur}}));
            pollId=setInterval(function(){
              if(player&&player.getCurrentTime){
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  event:'timeUpdate',
                  info:{currentTime:player.getCurrentTime(),duration:player.getDuration()}
                }));
              }
            },500);
          },
          onStateChange:function(e){
            window.ReactNativeWebView.postMessage(JSON.stringify({event:'onStateChange',info:e.data}));
          }
        }
      });
    }

    window.handleCommand=function(cmd){
      if(!player)return;
      try{
        switch(cmd.func){
          case 'playVideo':player.playVideo();break;
          case 'pauseVideo':player.pauseVideo();break;
          case 'seekTo':player.seekTo(cmd.args[0],cmd.args[1]);break;
          case 'mute':player.mute();break;
          case 'unMute':player.unMute();break;
        }
      }catch(e){}
    };
  </script>
</body>
</html>`;

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
  const webViewRef = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(minimized ? 0 : 1)).current;

  const isNative = Platform.OS !== 'web';

  // Send command to YouTube player (works on both web + native)
  const sendCommand = useCallback((func: string, args?: any) => {
    if (isNative) {
      if (!webViewRef.current) return;
      const js = `window.handleCommand(${JSON.stringify({ func, args: args || [] })}); true;`;
      webViewRef.current.injectJavaScript(js);
    } else {
      if (!iframeRef.current?.contentWindow) return;
      const message = JSON.stringify({ event: 'command', func, args: args || [] });
      iframeRef.current.contentWindow.postMessage(message, 'https://www.youtube.com');
    }
  }, [isNative]);

  // Handle messages from the player (native WebView)
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.event === 'onReady') {
        setPlayerReady(true);
        if (data.info?.duration) setDuration(data.info.duration);
      } else if (data.event === 'onStateChange') {
        // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
        setIsPlaying(data.info === 1);
      } else if (data.event === 'timeUpdate' && data.info) {
        if (data.info.currentTime !== undefined) {
          setCurrentTime(data.info.currentTime);
          onTimestampChange?.(Math.floor(data.info.currentTime));
        }
        if (data.info.duration !== undefined && data.info.duration > 0) {
          setDuration(data.info.duration);
        }
      }
    } catch (e) {
      // Not a JSON message
    }
  }, [onTimestampChange]);

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
  }, [initialTimestamp, playerReady, sendCommand]);

  // Listen for messages from the YouTube iframe (web only)
  useEffect(() => {
    if (isNative) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;

      try {
        const data = JSON.parse(event.data);

        if (data.event === 'onStateChange') {
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
  }, [isNative, onTimestampChange]);

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
    outputRange: [60, 100],
  });

  const videoOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  const controlsOpacity = slideAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0, 0, 1],
  });

  // Native: full YouTube mobile page (no embed restrictions)
  // Web: embed URL with JS API for custom controls
  const nativeUrl = `https://m.youtube.com/watch?v=${videoId}&t=${Math.floor(initialTimestamp)}s`;
  const webEmbedUrl = `https://www.youtube.com/embed/${videoId}?start=${initialTimestamp}&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3`;

  // ── Video element (platform-specific) ──────────────────────────────
  const renderVideo = () => {
    if (isNative && WebView) {
      return (
        <WebView
          ref={webViewRef}
          source={{ html: buildNativeHTML(videoId, initialTimestamp), baseUrl: 'https://rork-dj-set-list-creator.vercel.app' }}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={false}
          scrollEnabled={false}
          bounces={false}
          onMessage={handleWebViewMessage}
        />
      );
    }

    // Web: use iframe directly
    return (
      <iframe
        ref={iframeRef as any}
        src={webEmbedUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: 12,
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  };

  return (
    <Animated.View style={[styles.container, { height: playerHeight }]}>
      {/* Video */}
      <Animated.View style={[styles.videoContainer, { opacity: videoOpacity }]}>
        {!minimized && renderVideo()}
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

      {/* Compact single-row controls */}
      {!minimized && (
        <Animated.View style={[styles.controls, { opacity: controlsOpacity }]}>
          <View style={styles.controlButtons}>
            <Pressable style={styles.controlButton} onPress={toggleMute}>
              {isMuted ? (
                <VolumeX size={16} color={Colors.dark.textSecondary} />
              ) : (
                <Volume2 size={16} color={Colors.dark.text} />
              )}
            </Pressable>

            <Pressable style={styles.controlButton} onPress={skipBack}>
              <SkipBack size={16} color={Colors.dark.text} />
            </Pressable>

            <Pressable style={styles.compactPlayButton} onPress={togglePlay}>
              {isPlaying ? (
                <Pause size={18} color={Colors.dark.background} fill={Colors.dark.background} />
              ) : (
                <Play size={18} color={Colors.dark.background} fill={Colors.dark.background} />
              )}
            </Pressable>

            <Pressable style={styles.controlButton} onPress={skipForward}>
              <SkipForward size={16} color={Colors.dark.text} />
            </Pressable>

            <Text style={styles.compactTimeText}>{formatTime(currentTime)}</Text>

            <View style={styles.compactProgressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: duration ? `${(currentTime / duration) * 100}%` : '0%' }
                ]}
              />
            </View>

            <Pressable style={styles.controlButton} onPress={handleMinimize}>
              <ChevronDown size={16} color={Colors.dark.textSecondary} />
            </Pressable>
            <Pressable style={styles.controlButton} onPress={handleClose}>
              <X size={16} color={Colors.dark.textSecondary} />
            </Pressable>
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
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginTop: 6,
  },
  controls: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  controlButton: {
    padding: 6,
  },
  compactPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    fontVariant: ['tabular-nums'],
    marginHorizontal: 4,
    minWidth: 36,
  },
  compactProgressBar: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 1.5,
    position: 'relative',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.dark.primary,
    borderRadius: 1.5,
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
});
