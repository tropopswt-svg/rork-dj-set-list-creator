import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter, Link, useLocalSearchParams } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import BubbleGlassLogo from '@/components/BubbleGlassLogo';
import { useAuth } from '@/contexts/AuthContext';
import { stopFeedAudio } from '@/lib/feedAudioController';
import { useAudioPreview } from '@/contexts/AudioPreviewContext';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
  const { stop: stopPreviewAudio } = useAudioPreview();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);

  // Stop any playing audio when login screen mounts
  useEffect(() => {
    stopFeedAudio();
    stopPreviewAudio();
  }, []);

  // Check if user just verified their email
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search || '');
      const hashParams = new URLSearchParams(window.location.hash?.replace('#', '?') || '');

      const type = params.type || urlParams.get('type') || hashParams.get('type');
      const accessToken = hashParams.get('access_token');

      if (type === 'signup' || type === 'email_confirm' || accessToken) {
        setShowVerifiedModal(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Clear the hash to prevent showing modal on refresh
        if (window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }
  }, [params]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    const { error: signInError } = await signIn(email, password);

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
    } else {
      router.replace('/(tabs)/(feed)');
    }
  };

  const handleGoogleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    const { error: googleError } = await signInWithGoogle();

    setIsLoading(false);

    if (googleError) {
      setError(googleError.message);
    }
  };

  const handleAppleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    const { error: appleError } = await signInWithApple();

    setIsLoading(false);

    if (appleError) {
      setError(appleError.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Email Verified Success Modal */}
      <Modal
        visible={showVerifiedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVerifiedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <CheckCircle size={48} color={Colors.dark.success} />
            </View>
            <Text style={styles.modalTitle}>You're All Set!</Text>
            <Text style={styles.modalMessage}>
              Your email has been verified successfully. You can now log in to your trakd account.
            </Text>
            <Pressable
              style={styles.modalButton}
              onPress={() => setShowVerifiedModal(false)}
            >
              <Text style={styles.modalButtonText}>Continue to Login</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <BubbleGlassLogo size="large" />
          <Text style={styles.subtitle}>Welcome back</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Mail size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.dark.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.dark.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
            >
              {showPassword ? (
                <EyeOff size={20} color={Colors.dark.textMuted} />
              ) : (
                <Eye size={20} color={Colors.dark.textMuted} />
              )}
            </Pressable>
          </View>

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>
          </Link>

          <Pressable
            style={[styles.loginButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <Pressable
            style={styles.socialButton}
            onPress={handleGoogleLogin}
            disabled={isLoading}
          >
            <Text style={styles.socialButtonText}>Google</Text>
          </Pressable>

          {Platform.OS === 'ios' && (
            <Pressable
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleLogin}
              disabled={isLoading}
            >
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>Apple</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign Up</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginTop: 12,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: Colors.dark.text,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    marginHorizontal: 16,
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  appleButton: {
    backgroundColor: '#fff',
  },
  socialButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '500',
  },
  appleButtonText: {
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
