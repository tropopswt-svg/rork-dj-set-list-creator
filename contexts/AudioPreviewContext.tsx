import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Audio } from 'expo-av';

interface AudioPreviewContextType {
  currentTrackId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  failedTrackId: string | null;
  playPreview: (trackId: string, previewUrl: string) => Promise<void>;
  playDeezerPreview: (trackId: string, artist: string, title: string) => Promise<void>;
  stop: () => void;
}

const AudioPreviewContext = createContext<AudioPreviewContextType>({
  currentTrackId: null,
  isPlaying: false,
  isLoading: false,
  failedTrackId: null,
  playPreview: async () => {},
  playDeezerPreview: async () => {},
  stop: () => {},
});

export function AudioPreviewProvider({ children }: { children: React.ReactNode }) {
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failedTrackId, setFailedTrackId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const cleanup = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setCurrentTrackId(null);
  }, [cleanup]);

  const playFromUrl = useCallback(async (trackId: string, url: string) => {
    // If same track is playing, toggle off
    if (currentTrackId === trackId && isPlaying) {
      stop();
      return;
    }

    await cleanup();
    setCurrentTrackId(trackId);
    setIsLoading(true);
    setFailedTrackId(null);

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setCurrentTrackId(null);
              sound.unloadAsync();
              soundRef.current = null;
            }
          }
        }
      );

      soundRef.current = sound;
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      setIsPlaying(false);
      setFailedTrackId(trackId);
      setCurrentTrackId(null);
    }
  }, [currentTrackId, isPlaying, cleanup, stop]);

  const playPreview = useCallback(async (trackId: string, previewUrl: string) => {
    await playFromUrl(trackId, previewUrl);
  }, [playFromUrl]);

  const playDeezerPreview = useCallback(async (trackId: string, artist: string, title: string) => {
    if (currentTrackId === trackId && isPlaying) {
      stop();
      return;
    }

    await cleanup();
    setCurrentTrackId(trackId);
    setIsLoading(true);
    setFailedTrackId(null);

    try {
      const query = encodeURIComponent(`${artist} ${title}`);
      const res = await fetch(`https://api.deezer.com/search?q=${query}&limit=1`);
      const data = await res.json();
      const previewUrl = data?.data?.[0]?.preview;

      if (!previewUrl) {
        throw new Error('No Deezer preview found');
      }

      await playFromUrl(trackId, previewUrl);
    } catch {
      setIsLoading(false);
      setIsPlaying(false);
      setFailedTrackId(trackId);
      setCurrentTrackId(null);
    }
  }, [currentTrackId, isPlaying, cleanup, stop, playFromUrl]);

  return (
    <AudioPreviewContext.Provider
      value={{
        currentTrackId,
        isPlaying,
        isLoading,
        failedTrackId,
        playPreview,
        playDeezerPreview,
        stop,
      }}
    >
      {children}
    </AudioPreviewContext.Provider>
  );
}

export function useAudioPreview() {
  return useContext(AudioPreviewContext);
}
