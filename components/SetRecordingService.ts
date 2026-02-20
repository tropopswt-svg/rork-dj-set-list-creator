import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

const RECORDING_DURATION_MS = 60000; // 60s continuous clips
const RECENT_TRACKS_BUFFER = 3;
const STORAGE_KEY = '@setrecording_state';
const RETRY_QUEUE_KEY = '@setrecording_retry_queue';

export interface IdentifiedTrack {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  label?: string;
  confidence: number;
  duration?: number;
  identifiedAt: Date;
  links: {
    spotify?: string;
    youtube?: string;
    isrc?: string;
  };
}

export interface RecordingStatus {
  isRecording: boolean;
  sessionId: string | null;
  trackCount: number;
  elapsedTime: number;
  startTime: Date | null;
}

interface PersistedState {
  sessionId: string;
  startTime: string;
  identifiedTracks: IdentifiedTrack[];
  title: string;
}

interface QueuedTrack {
  sessionId: string;
  track: IdentifiedTrack;
}

type TrackCallback = (track: IdentifiedTrack) => void;
type StatusCallback = (status: RecordingStatus) => void;

// Module state
let isRecording = false;
let sessionId: string | null = null;
let identifiedTracks: IdentifiedTrack[] = [];
let startTime: Date | null = null;
let recordingRef: Audio.Recording | null = null;
let onTrackIdentified: TrackCallback | null = null;
let onStatusChange: StatusCallback | null = null;
let shouldStop = false;
let sessionTitle: string = '';

function isDuplicate(track: { title: string; artist: string }): boolean {
  const recent = identifiedTracks.slice(0, RECENT_TRACKS_BUFFER);
  return recent.some(
    (t) =>
      t.artist.toLowerCase() === track.artist.toLowerCase() &&
      t.title.toLowerCase() === track.title.toLowerCase()
  );
}

function emitStatus() {
  if (onStatusChange) {
    onStatusChange(getRecordingStatus());
  }
}

async function persistState(): Promise<void> {
  if (!sessionId || !startTime) return;
  try {
    const state: PersistedState = {
      sessionId,
      startTime: startTime.toISOString(),
      identifiedTracks,
      title: sessionTitle,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[SetRecording] Failed to persist state:', e);
  }
}

async function clearPersistedState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[SetRecording] Failed to clear persisted state:', e);
  }
}

async function loadPersistedState(): Promise<PersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: PersistedState = JSON.parse(raw);
    // Rehydrate Date objects
    state.identifiedTracks = state.identifiedTracks.map((t) => ({
      ...t,
      identifiedAt: new Date(t.identifiedAt),
    }));
    return state;
  } catch (e) {
    console.error('[SetRecording] Failed to load persisted state:', e);
    return null;
  }
}

// --- Failed identification retry queue ---

async function enqueueFailedTrack(track: QueuedTrack): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RETRY_QUEUE_KEY);
    const queue: QueuedTrack[] = raw ? JSON.parse(raw) : [];
    queue.push(track);
    await AsyncStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[SetRecording] Failed to enqueue track:', e);
  }
}

async function processRetryQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RETRY_QUEUE_KEY);
    if (!raw) return;
    const queue: QueuedTrack[] = JSON.parse(raw);
    if (queue.length === 0) return;

    const remaining: QueuedTrack[] = [];
    for (const item of queue) {
      try {
        await fetch(`${API_URL}/api/sessions/${item.sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_track',
            track: {
              title: item.track.title,
              artist: item.track.artist,
              confidence: item.track.confidence,
              spotifyUrl: item.track.links?.spotify,
              album: item.track.album,
              label: item.track.label,
            },
          }),
        });
        // Success — don't re-add
      } catch {
        remaining.push(item);
      }
    }

    if (remaining.length > 0) {
      await AsyncStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(RETRY_QUEUE_KEY);
    }
  } catch (e) {
    console.error('[SetRecording] Failed to process retry queue:', e);
  }
}

// --- API helpers ---

async function createSession(title?: string): Promise<string | null> {
  try {
    const defaultTitle = `Live Set - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const response = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'anonymous',
        title: title || defaultTitle,
      }),
    });
    const data = await response.json();
    if (data.success && data.session) {
      return data.session.id;
    }
  } catch (e) {
    console.error('[SetRecording] Failed to create session:', e);
  }
  return null;
}

async function addTrackToSession(track: IdentifiedTrack): Promise<void> {
  if (!sessionId) return;
  try {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_track',
        track: {
          title: track.title,
          artist: track.artist,
          confidence: track.confidence,
          spotifyUrl: track.links?.spotify,
          album: track.album,
          label: track.label,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (e) {
    console.error('[SetRecording] Failed to add track to session, queuing for retry:', e);
    await enqueueFailedTrack({ sessionId: sessionId!, track });
  }
}

async function endSessionAPI(): Promise<void> {
  if (!sessionId) return;
  try {
    await fetch(`${API_URL}/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end' }),
    });
  } catch (e) {
    console.error('[SetRecording] Failed to end session:', e);
  }
}

// --- Core recording loop: continuous with zero gaps ---

async function sendClipForIdentification(uri: string): Promise<void> {
  try {
    const base64Audio = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const response = await fetch(`${API_URL}/api/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: base64Audio,
        audioFormat: Platform.OS === 'ios' ? 'm4a' : 'mp4',
      }),
    });

    // Clean up audio file
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {}

    if (!response.ok) {
      console.warn('[SetRecording] API error:', response.status);
      return;
    }

    const result = await response.json();

    if (result.success && result.result) {
      const track = result.result;

      if (!isDuplicate(track)) {
        const identified: IdentifiedTrack = {
          ...track,
          identifiedAt: new Date(),
        };
        identifiedTracks = [identified, ...identifiedTracks];
        await addTrackToSession(identified);
        await persistState();

        if (onTrackIdentified) {
          onTrackIdentified(identified);
        }
        emitStatus();
      }
    }
  } catch (e) {
    console.error('[SetRecording] Identification error:', e);
    // Clean up audio file on error
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {}
  }
}

async function recordingLoop(): Promise<void> {
  // Configure audio once for the entire session
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
  });

  while (!shouldStop) {
    try {
      // Start a new recording immediately (no gap)
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef = recording;

      // Wait for the recording duration
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, RECORDING_DURATION_MS);
        // Store timeout reference so stopSetRecording can clear it
        (recording as any).__timeout = timeout;
      });

      if (shouldStop) {
        try {
          await recording.stopAndUnloadAsync();
        } catch {}
        recordingRef = null;
        break;
      }

      // Stop this recording and grab the URI
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef = null;

      // The next iteration of the while loop will immediately start
      // a new recording — zero gap, mic stays active.

      // Send the finished clip for identification (fire-and-forget)
      if (uri) {
        sendClipForIdentification(uri);
      }

      // Also process any queued failed identifications
      processRetryQueue();
    } catch (e) {
      console.error('[SetRecording] Recording cycle error:', e);
      recordingRef = null;
      // Brief pause on error to avoid tight error loops, but keep going
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// --- Public API ---

export async function startSetRecording(
  callbacks?: {
    onTrackIdentified?: TrackCallback;
    onStatusChange?: StatusCallback;
  },
  options?: {
    title?: string;
  }
): Promise<void> {
  if (isRecording) return;

  // Check permission
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Microphone permission required');
  }

  // Set callbacks
  onTrackIdentified = callbacks?.onTrackIdentified || null;
  onStatusChange = callbacks?.onStatusChange || null;
  sessionTitle = options?.title || '';

  // Check for interrupted session in AsyncStorage
  const persisted = await loadPersistedState();
  if (persisted) {
    // Restore previously identified tracks (they survive app kill)
    sessionId = persisted.sessionId;
    startTime = new Date(persisted.startTime);
    identifiedTracks = persisted.identifiedTracks;
    sessionTitle = persisted.title || sessionTitle;
    shouldStop = false;
    isRecording = true;
    emitStatus();
  } else {
    // Fresh session
    shouldStop = false;
    identifiedTracks = [];
    startTime = new Date();
    isRecording = true;

    sessionId = await createSession(sessionTitle || undefined);
    await persistState();
    emitStatus();
  }

  // Process any queued tracks from previous failed attempts
  processRetryQueue();

  // Start the continuous recording loop (don't await - runs in background)
  recordingLoop().then(() => {
    isRecording = false;
    emitStatus();
  });
}

export async function stopSetRecording(): Promise<{
  tracks: IdentifiedTrack[];
  sessionId: string | null;
  duration: number;
}> {
  shouldStop = true;

  // Stop current recording if active
  if (recordingRef) {
    // Clear the recording timeout if it exists
    try {
      const timeout = (recordingRef as any).__timeout;
      if (timeout) clearTimeout(timeout);
    } catch {}
    try {
      await recordingRef.stopAndUnloadAsync();
    } catch {}
    recordingRef = null;
  }

  // End session on server
  await endSessionAPI();

  // Process any remaining queued tracks
  await processRetryQueue();

  const result = {
    tracks: [...identifiedTracks],
    sessionId,
    duration: startTime ? Date.now() - startTime.getTime() : 0,
  };

  // Clean up
  isRecording = false;
  sessionId = null;
  startTime = null;
  identifiedTracks = [];
  sessionTitle = '';
  onTrackIdentified = null;
  onStatusChange = null;

  // Clear persisted state
  await clearPersistedState();

  emitStatus();

  return result;
}

export function getRecordingStatus(): RecordingStatus {
  return {
    isRecording,
    sessionId,
    trackCount: identifiedTracks.length,
    elapsedTime: startTime ? Date.now() - startTime.getTime() : 0,
    startTime,
  };
}

export function getIdentifiedTracks(): IdentifiedTrack[] {
  return [...identifiedTracks];
}
