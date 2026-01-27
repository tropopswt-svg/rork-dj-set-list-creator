import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${Colors.dark.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  features: {
    alignSelf: 'stretch',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
  },
  featureItem: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    gap: 8,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AuthGateModal;
