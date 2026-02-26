import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Radio, CheckCircle, AlertCircle, Loader } from 'lucide-react-native';

const ACR_TEAL = '#00BFA5';
const ACR_TEAL_DIM = 'rgba(0, 191, 165, 0.12)';
const ACR_TEAL_BORDER = 'rgba(0, 191, 165, 0.25)';

const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

// Poll interval and timeout
const POLL_INTERVAL_MS = 10_000; // 10 seconds
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface AcrScanButtonProps {
  setId: string;
  acrScanStatus: string | null;
  hasSourceUrl: boolean;
  onScanComplete: (tracks: any[]) => void;
  onError: (message: string) => void;
}

export default function AcrScanButton({
  setId,
  acrScanStatus: initialStatus,
  hasSourceUrl,
  onScanComplete,
  onError,
}: AcrScanButtonProps) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [submitting, setSubmitting] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTime = useRef<number>(0);

  // Sync external status prop
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // Pulsing animation for scanning state
  useEffect(() => {
    if (status === 'submitted' || status === 'processing') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  // Start polling when status is submitted/processing
  const startPolling = useCallback(() => {
    if (pollTimer.current) return; // already polling
    pollStartTime.current = Date.now();

    pollTimer.current = setInterval(async () => {
      // Timeout check
      if (Date.now() - pollStartTime.current > POLL_TIMEOUT_MS) {
        stopPolling();
        setStatus('failed');
        onError('Scan timed out after 10 minutes');
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/sets/acr-scan-status?setId=${setId}`
        );
        const data = await response.json();

        if (data.status === 'completed') {
          stopPolling();
          setStatus('completed');
          onScanComplete(data.tracks || []);
        } else if (data.status === 'failed') {
          stopPolling();
          setStatus('failed');
          onError(data.error || 'Scan failed');
        } else if (data.status === 'processing') {
          setStatus('processing');
        }
      } catch {
        // Network error — keep polling, don't fail immediately
      }
    }, POLL_INTERVAL_MS);
  }, [setId, onScanComplete, onError]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Auto-start polling if we mount with an in-progress status
  useEffect(() => {
    if (status === 'submitted' || status === 'processing') {
      startPolling();
    }
    return () => stopPolling();
  }, [status, startPolling, stopPolling]);

  // Submit scan
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/sets/acr-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      setStatus(data.status || 'submitted');
      startPolling();
    } catch (err: any) {
      onError(err.message || 'Failed to submit scan');
    } finally {
      setSubmitting(false);
    }
  };

  // Don't render if no source URL and never scanned
  if (!hasSourceUrl && !status) return null;

  // Completed state — green badge
  if (status === 'completed') {
    return (
      <View style={styles.badge}>
        <View style={styles.badgeShadow} />
        <View style={[styles.badgeFace, styles.completedFace]}>
          <View style={styles.badgeShine} />
          <CheckCircle size={12} color="#4CAF50" />
          <Text style={styles.completedText}>ACR Scanned</Text>
        </View>
      </View>
    );
  }

  // Failed state — retry button
  if (status === 'failed') {
    return (
      <Pressable
        style={({ pressed }) => [styles.badge, pressed && { transform: [{ scale: 0.92 }], opacity: 0.8 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <View style={styles.badgeShadow} />
        <View style={[styles.badgeFace, styles.failedFace]}>
          <View style={styles.badgeShine} />
          <AlertCircle size={12} color="#EF5350" />
          <Text style={styles.failedText}>{submitting ? 'Retrying...' : 'Retry Scan'}</Text>
        </View>
      </Pressable>
    );
  }

  // Scanning state — pulsing
  if (status === 'submitted' || status === 'processing') {
    return (
      <Animated.View style={[styles.badge, { opacity: pulseAnim }]}>
        <View style={styles.badgeShadow} />
        <View style={[styles.badgeFace, styles.scanningFace]}>
          <View style={styles.badgeShine} />
          <Radio size={12} color={ACR_TEAL} />
          <Text style={styles.scanningText}>Scanning...</Text>
        </View>
      </Animated.View>
    );
  }

  // Default — never scanned, has source URL
  if (!hasSourceUrl) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.badge, pressed && { transform: [{ scale: 0.92 }], opacity: 0.8 }]}
      onPress={handleSubmit}
      disabled={submitting}
    >
      <View style={styles.badgeShadow} />
      <View style={[styles.badgeFace, styles.defaultFace]}>
        <View style={styles.badgeShine} />
        <Radio size={12} color={ACR_TEAL} />
        <Text style={styles.defaultText}>
          {submitting ? 'Submitting...' : 'Fingerprint Scan'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    marginTop: 8,
  },
  badgeShadow: {
    position: 'absolute',
    bottom: -2,
    left: 4,
    right: 4,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  badgeFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  badgeShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  // Default — teal accent
  defaultFace: {
    backgroundColor: ACR_TEAL_DIM,
    borderColor: ACR_TEAL_BORDER,
    borderTopColor: 'rgba(0, 191, 165, 0.35)',
    borderBottomColor: 'rgba(0, 100, 85, 0.15)',
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '700',
    color: ACR_TEAL,
    letterSpacing: 0.3,
  },
  // Scanning — pulsing teal
  scanningFace: {
    backgroundColor: ACR_TEAL_DIM,
    borderColor: ACR_TEAL_BORDER,
    borderTopColor: 'rgba(0, 191, 165, 0.35)',
    borderBottomColor: 'rgba(0, 100, 85, 0.15)',
  },
  scanningText: {
    fontSize: 10,
    fontWeight: '700',
    color: ACR_TEAL,
    letterSpacing: 0.3,
  },
  // Completed — green
  completedFace: {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderColor: 'rgba(76, 175, 80, 0.2)',
    borderTopColor: 'rgba(76, 175, 80, 0.3)',
    borderBottomColor: 'rgba(40, 100, 40, 0.15)',
  },
  completedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
    letterSpacing: 0.3,
  },
  // Failed — red
  failedFace: {
    backgroundColor: 'rgba(239, 83, 80, 0.08)',
    borderColor: 'rgba(239, 83, 80, 0.2)',
    borderTopColor: 'rgba(239, 83, 80, 0.3)',
    borderBottomColor: 'rgba(150, 40, 40, 0.15)',
  },
  failedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF5350',
    letterSpacing: 0.3,
  },
});
