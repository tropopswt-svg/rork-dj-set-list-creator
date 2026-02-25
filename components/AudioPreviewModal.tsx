import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import {
  X,
  Send,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Youtube,
  Music2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { extractYouTubeId, buildNativeHTML } from './YouTubePlayer';

// Only import WebView on native
const WebView = Platform.OS !== 'web'
  ? require('react-native-webview').default
  : null;

interface AudioPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitIdentification: (artist: string, title: string) => void;
  sourceUrl: string | null;
  sourcePlatform: 'youtube' | 'soundcloud' | null;
  timestamp: number; // in seconds
  trackArtist?: string; // pre-fill if we have partial ID
}

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(timestamp);
  const webViewRef = useRef<any>(null);

  const videoId = sourceUrl && sourcePlatform === 'youtube'
    ? extractYouTubeId(sourceUrl)
    : null;

  const isNative = Platform.OS !== 'web';
  const isSoundCloud = sourcePlatform === 'soundcloud';

  // Reset state when opening
  useEffect(() => {
    if (visible) {
      setArtistInput(trackArtist || '');
      setTitleInput('');
      setIsPlaying(false);
      setIsMuted(false);
      setCurrentTime(timestamp);
    }
  }, [visible, trackArtist, timestamp]);

  // Send command to YouTube IFrame API via WebView
  const sendCommand = useCallback((func: string, args?: any) => {
    if (!isNative || !webViewRef.current) return;
    const js = `window.handleCommand(${JSON.stringify({ func, args: args || [] })}); true;`;
    webViewRef.current.injectJavaScript(js);
  }, [isNative]);

  // Handle messages from YouTube IFrame API
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.event === 'onReady') {
        setIsPlaying(true);
      } else if (data.event === 'onStateChange') {
        setIsPlaying(data.info === 1);
      } else if (data.event === 'timeUpdate' && data.info) {
        if (data.info.currentTime !== undefined) {
          setCurrentTime(data.info.currentTime);
        }
      }
    } catch (e) {}
  }, []);

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

  const skipBack = () => {
    const newTime = Math.max(0, currentTime - 15);
    sendCommand('seekTo', [newTime, true]);
    setCurrentTime(newTime);
  };

  const skipForward = () => {
    const newTime = currentTime + 15;
    sendCommand('seekTo', [newTime, true]);
    setCurrentTime(newTime);
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
    sendCommand('pauseVideo');
    onClose();
  };

  if (!visible) return null;
  if (!sourceUrl || !sourcePlatform) return null;
  if (sourcePlatform === 'youtube' && !videoId) return null;

  // SoundCloud: Widget API HTML with desktop context to avoid "listen in app"
  const buildSoundCloudHTML = (url: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#1a1a2e;overflow:hidden}iframe{width:100%;height:100%;border:none}</style>
</head>
<body>
  <iframe id="sc" allow="autoplay"
    src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&show_artwork=false&visual=false&color=%23C41E3A&buying=false&sharing=false&download=false&show_playcount=false&show_user=false"></iframe>
  <script src="https://w.soundcloud.com/player/api.js"></script>
  <script>
    var widget=SC.Widget('sc');
    widget.bind(SC.Widget.Events.READY,function(){
      widget.play();
      widget.setVolume(100);
      window.ReactNativeWebView.postMessage(JSON.stringify({event:'onReady'}));
    });
    widget.bind(SC.Widget.Events.PLAY_PROGRESS,function(d){
      window.ReactNativeWebView.postMessage(JSON.stringify({event:'timeUpdate',info:{currentTime:d.currentPosition/1000}}));
    });
    widget.bind(SC.Widget.Events.PLAY,function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({event:'onStateChange',info:1}));
    });
    widget.bind(SC.Widget.Events.PAUSE,function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({event:'onStateChange',info:2}));
    });
  </script>
</body>
</html>`;

  const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // SoundCloud widget URL for web fallback
  const soundcloudWidgetUrl = isSoundCloud && sourceUrl
    ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(sourceUrl)}&auto_play=true&start_track=0&show_artwork=false&visual=false&color=%23C41E3A`
    : null;

  // Web YouTube embed URL
  const webYoutubeEmbedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?start=${Math.floor(timestamp)}&autoplay=1&playsinline=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3`
    : null;

  const renderPlayer = () => {
    if (isNative && WebView) {
      if (isSoundCloud) {
        return (
          <WebView
            source={{ html: buildSoundCloudHTML(sourceUrl!), baseUrl: 'https://rork-dj-set-list-creator.vercel.app' }}
            style={{ flex: 1, backgroundColor: '#1a1a2e' }}
            userAgent={DESKTOP_UA}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            bounces={false}
            onMessage={handleWebViewMessage}
          />
        );
      }
      // YouTube: use IFrame API with baseUrl for proper Referer
      return (
        <WebView
          ref={webViewRef}
          source={{ html: buildNativeHTML(videoId!, timestamp), baseUrl: 'https://rork-dj-set-list-creator.vercel.app' }}
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

    // Web: use iframe
    const embedUrl = isSoundCloud ? soundcloudWidgetUrl! : webYoutubeEmbedUrl!;
    return (
      <iframe
        src={embedUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header row: platform icon + time + close */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isSoundCloud
            ? <Music2 size={16} color="#FF5500" />
            : <Youtube size={16} color="#FF0000" />
          }
          <Text style={styles.headerTime}>Listening at {formatTime(currentTime)}</Text>
        </View>
        <Pressable onPress={handleClose} hitSlop={8} style={styles.closeButton}>
          <X size={18} color={Colors.dark.textSecondary} />
        </Pressable>
      </View>

      {/* Player sliver */}
      <View style={[styles.playerSliver, isSoundCloud && styles.playerSliverSC]}>
        {renderPlayer()}
      </View>

      {/* Mini controls for YouTube */}
      {!isSoundCloud && (
        <View style={styles.miniControls}>
          <Pressable style={styles.ctrlBtn} onPress={toggleMute}>
            {isMuted
              ? <VolumeX size={14} color={Colors.dark.textSecondary} />
              : <Volume2 size={14} color={Colors.dark.text} />
            }
          </Pressable>
          <Pressable style={styles.ctrlBtn} onPress={skipBack}>
            <SkipBack size={14} color={Colors.dark.text} />
          </Pressable>
          <Pressable style={styles.playBtn} onPress={togglePlay}>
            {isPlaying
              ? <Pause size={14} color="#FFF" fill="#FFF" />
              : <Play size={14} color="#FFF" fill="#FFF" />
            }
          </Pressable>
          <Pressable style={styles.ctrlBtn} onPress={skipForward}>
            <SkipForward size={14} color={Colors.dark.text} />
          </Pressable>
        </View>
      )}

      {/* Inline ID form */}
      <View style={styles.formRow}>
        <TextInput
          style={styles.input}
          value={artistInput}
          onChangeText={setArtistInput}
          placeholder="Artist"
          placeholderTextColor={Colors.dark.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={titleInput}
          onChangeText={setTitleInput}
          placeholder="Title"
          placeholderTextColor={Colors.dark.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.submitBtn, (!artistInput.trim() || !titleInput.trim()) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!artistInput.trim() || !titleInput.trim()}
        >
          <Send size={16} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTime: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 4,
  },
  playerSliver: {
    height: 40,
    marginHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  playerSliverSC: {
    height: 60,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  ctrlBtn: {
    padding: 6,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  submitBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
});
