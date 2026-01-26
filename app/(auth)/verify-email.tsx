import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function VerifyEmailScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Mail size={48} color={Colors.dark.primary} />
        </View>

        <Text style={styles.title}>Verify your email</Text>

        <Text style={styles.description}>
          We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
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

        <Pressable
          style={styles.loginButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </Pressable>

        <Pressable
          style={styles.resendButton}
          onPress={() => {
            // TODO: Implement resend verification email
          }}
        >
          <Text style={styles.resendButtonText}>Resend verification email</Text>
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
    marginBottom: 32,
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
    padding: 12,
  },
  resendButtonText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
