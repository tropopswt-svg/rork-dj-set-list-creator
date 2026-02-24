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
import { Lock, UserPlus, LogIn } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface AuthGateModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export function AuthGateModal({
  visible,
  onClose,
  title = "Create a Free Account",
  message = "Sign up to start discovering and identifying tracks from your favorite sets.",
}: AuthGateModalProps) {
  const router = useRouter();

  const handleSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    router.push('/(auth)/signup');
  };

  const handleLogIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          <View style={styles.iconContainer}>
            <Lock size={32} color={Colors.dark.primary} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.features}>
            <Text style={styles.featureItem}>✓ Import sets from YouTube & SoundCloud</Text>
            <Text style={styles.featureItem}>✓ Identify tracks with AI</Text>
            <Text style={styles.featureItem}>✓ Vote on conflicts & earn points</Text>
            <Text style={styles.featureItem}>✓ Build your music profile</Text>
          </View>

          <Pressable style={styles.signUpButton} onPress={handleSignUp}>
            <UserPlus size={20} color="#fff" />
            <Text style={styles.signUpButtonText}>Create Free Account</Text>
          </Pressable>

          <Pressable style={styles.logInButton} onPress={handleLogIn}>
            <LogIn size={18} color={Colors.dark.primary} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: 'rgba(12, 12, 12, 0.85)',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 360,
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
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(196, 30, 58, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.2)',
    borderTopColor: 'rgba(255, 100, 120, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    fontWeight: '800',
    color: '#F5E6D3',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: 'rgba(245, 230, 211, 0.6)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  features: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  featureItem: {
    fontSize: 13,
    color: 'rgba(245, 230, 211, 0.55)',
    marginBottom: 8,
    lineHeight: 20,
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196, 30, 58, 0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.3)',
    borderTopColor: 'rgba(255, 100, 120, 0.2)',
    borderBottomColor: 'rgba(100, 10, 20, 0.3)',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signUpButtonText: {
    color: '#F5E6D3',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  logInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    marginTop: 8,
  },
  logInButtonText: {
    color: 'rgba(245, 230, 211, 0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default AuthGateModal;
