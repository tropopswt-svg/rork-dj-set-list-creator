import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { stopFeedAudio } from '@/lib/feedAudioController';
import { useAudioPreview } from '@/contexts/AudioPreviewContext';

interface AuthGateModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
}

export function AuthGateModal({
  visible,
  onClose,
  title = "Sign up to continue",
}: AuthGateModalProps) {
  const router = useRouter();
  const { stop: stopPreviewAudio } = useAudioPreview();

  const stopAllAudio = () => {
    stopFeedAudio();
    stopPreviewAudio();
  };

  const handleSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopAllAudio();
    onClose();
    router.push('/(auth)/signup');
  };

  const handleLogIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopAllAudio();
    onClose();
    router.push('/(auth)/login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>

          <Pressable style={styles.signUpButton} onPress={handleSignUp}>
            <UserPlus size={18} color="#fff" />
            <Text style={styles.signUpButtonText}>Create Free Account</Text>
          </Pressable>

          <Pressable style={styles.logInButton} onPress={handleLogIn}>
            <Text style={styles.logInButtonText}>Already have an account? Log In</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    backgroundColor: 'rgba(12, 12, 12, 0.9)',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomColor: 'rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    fontWeight: '700',
    color: '#F5E6D3',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196, 30, 58, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.3)',
    borderTopColor: 'rgba(255, 100, 120, 0.2)',
    borderBottomColor: 'rgba(100, 10, 20, 0.3)',
  },
  signUpButtonText: {
    color: '#F5E6D3',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  logInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginTop: 4,
  },
  logInButtonText: {
    color: 'rgba(245, 230, 211, 0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default AuthGateModal;
