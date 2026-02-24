// Global audio playback context for track preview play buttons
// Single Audio.Sound instance — only one track plays at a time
import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import createContextHook from '@nkzw/create-context-hook';

// Strip parenthetical suffixes that break Deezer's strict matching
function cleanTitle(t: string) {
  return t.replace(/\s*\([^)]*\)\s*/g, '').trim();
}

export const [AudioPreviewProvider, useAudioPreview] = createContextHook(() => {
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failedTrackId, setFailedTrackId] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const genRef = useRef(0);
  const previewCache = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // Auto-clear failedTrackId after 2 seconds
  useEffect(() => {
    if (!failedTrackId) return;
    const timer = setTimeout(() => setFailedTrackId(null), 2000);
    return () => clearTimeout(timer);
  }, [failedTrackId]);

  const stop = useCallback(async () => {
    genRef.current++;
    setCurrentTrackId(null);
    setIsPlaying(false);
    setIsLoading(false);
    setProgress(0);

    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  const loadAndPlay = useCallback(async (gen: number, url: string, trackId: string): Promise<boolean> => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      if (genRef.current !== gen) return false;

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (genRef.current !== gen) return;
          if (!status.isLoaded) return;

          if (status.isPlaying && status.durationMillis) {
            setProgress(status.positionMillis / status.durationMillis);
          }

          if (status.didJustFinish) {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTrackId(null);
            soundRef.current?.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
        }
      );

      if (genRef.current !== gen) {
        await sound.unloadAsync().catch(() => {});
        return false;
      }

      soundRef.current = sound;
      setCurrentTrackId(trackId);
      setIsPlaying(true);
      setIsLoading(false);
      return true;
    } catch {
      if (genRef.current === gen) {
        setIsLoading(false);
        setCurrentTrackId(null);
        setFailedTrackId(trackId);
      }
      return false;
    }
  }, []);

  const playPreview = useCallback(async (trackId: string, previewUrl: string) => {
    // Same track — toggle pause/resume
    if (currentTrackId === trackId && soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }
    }

    genRef.current++;
    const gen = genRef.current;

    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    setCurrentTrackId(trackId);
    setIsPlaying(false);
    setIsLoading(true);
    setProgress(0);

    await loadAndPlay(gen, previewUrl, trackId);
  }, [currentTrackId, loadAndPlay]);

  /**
   * Search Deezer directly (same pattern as feed) then play.
   * Deezer API is free, no auth, no CORS issues on mobile.
   */
  const playDeezerPreview = useCallback(async (trackId: string, artist: string, title: string) => {
    // Same track — toggle pause/resume
    if (currentTrackId === trackId && soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }
    }

    // Check client-side cache
    if (previewCache.current.has(trackId)) {
      const cachedUrl = previewCache.current.get(trackId);
      if (cachedUrl) {
        await playPreview(trackId, cachedUrl);
        return;
      }
      setFailedTrackId(trackId);
      return;
    }

    // New track — stop current, search Deezer directly
    genRef.current++;
    const gen = genRef.current;

    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    setCurrentTrackId(trackId);
    setIsPlaying(false);
    setIsLoading(true);
    setProgress(0);

    const cleanedTitle = cleanTitle(title);
    const cleanedArtist = cleanTitle(artist);

    // Two-query strategy — same as feed: structured first, then simple
    const queries = [
      encodeURIComponent(`artist:"${cleanedArtist}" track:"${cleanedTitle}"`),
      encodeURIComponent(`${cleanedArtist} ${cleanedTitle}`),
    ];

    for (const q of queries) {
      if (genRef.current !== gen) return;
      try {
        const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`);
        if (genRef.current !== gen) return;
        const json = await res.json();
        const preview = json?.data?.[0]?.preview;
        if (preview) {
          previewCache.current.set(trackId, preview);
          await loadAndPlay(gen, preview, trackId);
          return;
        }
      } catch {}
    }

    // Nothing found
    if (genRef.current === gen) {
      previewCache.current.set(trackId, null);
      setIsLoading(false);
      setCurrentTrackId(null);
      setFailedTrackId(trackId);
    }
  }, [currentTrackId, playPreview, loadAndPlay]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  }, []);

  return {
    currentTrackId,
    isPlaying,
    isLoading,
    progress,
    failedTrackId,
    playPreview,
    playDeezerPreview,
    togglePlayPause,
    stop,
  };
});
