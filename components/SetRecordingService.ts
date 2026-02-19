import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

const RECORDING_DURATION_MS = 15000;
const WAIT_BETWEEN_CYCLES_MS = 45000;
const RECENT_TRACKS_BUFFER = 3;

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

type TrackCallback = (track: IdentifiedTrack) => void;
type StatusCallback = (status: RecordingStatus) => void;

// Module state
let isRecording = false;
let sessionId: string | null = null;
let identifiedTracks: IdentifiedTrack[] = [];
let startTime: Date | null = null;
let loopTimeout: ReturnType<typeof setTimeout> | null = null;
let recordingRef: Audio.Recording | null = null;
let onTrackIdentified: TrackCallback | null = null;
let onStatusChange: StatusCallback | null = null;
let shouldStop = false;

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

async function createSession(): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'anonymous',
        title: `Live Set - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
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
    await fetch(`${API_URL}/api/sessions/${sessionId}`, {
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
  } catch (e) {
    console.error('[SetRecording] Failed to add track to session:', e);
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

async function recordAndIdentify(): Promise<void> {
  if (shouldStop) return;

  try {
    // Configure audio for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    // Record 15s clip
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef = recording;

    // Wait for recording duration
    await new Promise<void>((resolve) => {
      loopTimeout = setTimeout(resolve, RECORDING_DURATION_MS);
    });

    if (shouldStop) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {}
      recordingRef = null;
      return;
    }

    // Stop and get URI
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recordingRef = null;

    if (!uri) {
      console.warn('[SetRecording] No recording URI');
      return;
    }

    // Read as base64 and send to API
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

      // Check deduplication
      if (!isDuplicate(track)) {
        const identified: IdentifiedTrack = {
          ...track,
          identifiedAt: new Date(),
        };
        identifiedTracks = [identified, ...identifiedTracks];
        await addTrackToSession(identified);

        if (onTrackIdentified) {
          onTrackIdentified(identified);
        }
        emitStatus();
      }
    }
  } catch (e) {
    console.error('[SetRecording] Recording cycle error:', e);
    // Continue loop on error - don't crash
  }
}

async function recordingLoop(): Promise<void> {
  while (!shouldStop) {
    await recordAndIdentify();
    if (shouldStop) break;

    // Wait between cycles
    await new Promise<void>((resolve) => {
      loopTimeout = setTimeout(resolve, WAIT_BETWEEN_CYCLES_MS);
    });
  }
}

export async function startSetRecording(
  callbacks?: {
    onTrackIdentified?: TrackCallback;
    onStatusChange?: StatusCallback;
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

  // Reset state
  shouldStop = false;
  identifiedTracks = [];
  startTime = new Date();
  isRecording = true;

  // Create session
  sessionId = await createSession();
  emitStatus();

  // Start the loop (don't await - runs in background)
  recordingLoop().then(() => {
    // Loop ended
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

  // Clear any pending timeout
  if (loopTimeout) {
    clearTimeout(loopTimeout);
    loopTimeout = null;
  }

  // Stop current recording if active
  if (recordingRef) {
    try {
      await recordingRef.stopAndUnloadAsync();
    } catch {}
    recordingRef = null;
  }

  // End session
  await endSessionAPI();

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
  onTrackIdentified = null;
  onStatusChange = null;
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
