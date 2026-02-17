import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Mail, CheckCircle, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResendEmail = async () => {
    if (!email) {
      setResendError('Email address not available. Please try signing up again.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        setResendError(error.message);
      } else {
        setResendSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      setResendError(err.message || 'Failed to resend verification email');
    }

    setIsResending(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Mail size={48} color={Colors.dark.primary} />
        </View>

        <Text style={styles.title}>Verify your email</Text>

        <Text style={styles.description}>
          We've sent a verification link to{email ? ` ${email}` : ' your email address'}. Please check your inbox and click the link to verify your account.
        </Text>

        <View style={styles.tips}>
          <View style={styles.tipRow}>
            <CheckCircle size={16} color={Colors.dark.primary} />
            <Text style={styles.tipText}>Check your spam folder</Text>
          </View>
          <View style={styles.tipRow}>
            <CheckCircle size={16} color={Colors.dark.primary} />
            <Text style={styles.tipText}>The link expires in 24 hours</Text>
          </View>
        </View>

        {resendSuccess && (
          <View style={styles.successMessage}>
            <CheckCircle size={16} color={Colors.dark.success} />
            <Text style={styles.successText}>Verification email sent!</Text>
          </View>
        )}

        {resendError && (
          <View style={styles.errorMessage}>
            <Text style={styles.errorText}>{resendError}</Text>
          </View>
        )}

        <Pressable
          style={styles.loginButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </Pressable>

        <Pressable
          style={[styles.resendButton, isResending && styles.resendButtonDisabled]}
          onPress={handleResendEmail}
          disabled={isResending}
        >
          {isResending ? (
            <ActivityIndicator size="small" color={Colors.dark.primary} />
          ) : (
            <>
              <RefreshCw size={16} color={Colors.dark.primary} />
              <Text style={styles.resendButtonText}>Resend verification email</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${Colors.dark.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  tips: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tipText: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.dark.success}20`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  successText: {
    fontSize: 14,
    color: Colors.dark.success,
    fontWeight: '500',
  },
  errorMessage: {
    backgroundColor: `${Colors.dark.error}20`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.error,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 16,
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
