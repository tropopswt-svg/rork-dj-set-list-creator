import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';
import { Session, User, AuthError } from '@supabase/supabase-js';

// Profile type matching database schema
export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  followers_count: number;
  following_count: number;
  sets_saved_count: number;
  contributions_count: number;
  points: number;
  points_voting: number;
  points_contributions: number;
  points_track_ids: number;
  favorite_genres: string[];
  is_public: boolean;
  show_contributions: boolean;
  show_favorites: boolean;
  push_notifications: boolean;
  email_notifications: boolean;
  weekly_digest: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  // Auth state
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Auth actions
  signUp: (email: string, password: string, username: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithApple: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;

  // Profile actions
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from database (or create if doesn't exist)
  const fetchProfile = useCallback(async (userId: string, userData?: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        if (__DEV__) console.log('[Auth] Profile not found, creating...');
        const newProfile = {
          id: userId,
          username: userData?.user_metadata?.username || userData?.email?.split('@')[0] || null,
          display_name: userData?.user_metadata?.full_name || userData?.user_metadata?.name || null,
          avatar_url: userData?.user_metadata?.avatar_url || null,
        };

        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          if (__DEV__) console.error('[Auth] Error creating profile:', createError);
          return null;
        }

        return created as Profile;
      }

      if (error) {
        if (__DEV__) console.error('[Auth] Error fetching profile:', error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      if (__DEV__) console.error('[Auth] Error fetching profile:', error);
      return null;
    }
  }, []);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user, fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Fetch profile in background (don't block)
      if (session?.user) {
        fetchProfile(session.user.id, session.user).then(setProfile);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (__DEV__) console.log('[Auth] Auth state changed:', event);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch profile in background (don't block login)
        fetchProfile(session.user.id, session.user).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign up with email/password
  const signUp = async (email: string, password: string, username: string, displayName?: string) => {
    try {
      // Check if username is taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();

      if (existingUser) {
        return { error: { message: 'Username is already taken' } as AuthError };
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            full_name: displayName || username,
          },
        },
      });

      return { error };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign up error:', error);
      return { error: error as AuthError };
    }
  };

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { error };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign in error:', error);
      return { error: error as AuthError };
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: Platform.OS === 'web'
            ? window.location.origin
            : 'trackd://auth/callback',
        },
      });

      return { error };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Google sign in error:', error);
      return { error: error as AuthError };
    }
  };

  // Sign in with Apple
  const signInWithApple = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: Platform.OS === 'web'
            ? window.location.origin
            : 'trackd://auth/callback',
        },
      });

      return { error };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Apple sign in error:', error);
      return { error: error as AuthError };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);

      // Clear any cached data
      await AsyncStorage.removeItem('supabase.auth.token');
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign out error:', error);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: Platform.OS === 'web'
          ? `${window.location.origin}/reset-password`
          : 'trackd://auth/reset-password',
      });

      return { error };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Reset password error:', error);
      return { error: error as AuthError };
    }
  };

  // Delete account
  const deleteAccount = async () => {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    try {
      // Delete user's profile first (cascade should handle related data)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        if (__DEV__) console.error('[Auth] Error deleting profile:', profileError);
        return { error: new Error(profileError.message) };
      }

      // Sign out the user (Supabase admin API would be needed to fully delete auth user)
      await signOut();

      return { error: null };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Delete account error:', error);
      return { error: error as Error };
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        return { error: new Error(error.message) };
      }

      // Refresh profile data
      await refreshProfile();

      return { error: null };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Update profile error:', error);
      return { error: error as Error };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    resetPassword,
    deleteAccount,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
