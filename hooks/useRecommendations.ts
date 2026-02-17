// Hooks for recommendation features
// NOTE: For contact sync functionality, install: npx expo install expo-contacts expo-crypto
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as recommendationService from '@/lib/supabase/recommendationService';

// Lazy imports for optional contact sync dependencies
let Contacts: any = null;
let Crypto: any = null;

try {
  Contacts = require('expo-contacts');
  Crypto = require('expo-crypto');
} catch (e) {
  // Contact sync will be disabled if dependencies are not installed
  console.log('[Recommendations] expo-contacts or expo-crypto not installed. Contact sync disabled.');
}

// Re-export types
export type {
  ArtistRecommendation,
  UserRecommendation,
  ContactMatch,
} from '@/lib/supabase/recommendationService';

// ============================================
// RECOMMENDED ARTISTS HOOK
// ============================================

export function useRecommendedArtists(limit = 10) {
  const { user } = useAuth();
  const [artists, setArtists] = useState<recommendationService.ArtistRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setArtists([]);
      setIsLoading(false);
      return;
    }

    setIsRefreshing(true);

    // Check if recommendations need recalculating
    if (forceRefresh) {
      const isStale = await recommendationService.areRecommendationsStale(user.id);
      if (isStale) {
        await recommendationService.refreshUserRecommendations(user.id);
      }
    }

    const { data } = await recommendationService.getRecommendedArtists(user.id, limit);
    setArtists(data || []);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [user, limit]);

  useEffect(() => {
    refresh(true); // Force refresh on mount to check staleness
  }, [user?.id]);

  return {
    artists,
    isLoading,
    isRefreshing,
    refresh: () => refresh(false),
    forceRefresh: () => refresh(true),
  };
}

// ============================================
// RECOMMENDED USERS HOOK
// ============================================

export function useRecommendedUsers(limit = 20) {
  const { user } = useAuth();
  const [users, setUsers] = useState<recommendationService.UserRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    setIsRefreshing(true);

    // Check if recommendations need recalculating
    if (forceRefresh) {
      const isStale = await recommendationService.areRecommendationsStale(user.id);
      if (isStale) {
        await recommendationService.refreshUserRecommendations(user.id);
      }
    }

    const { data } = await recommendationService.getRecommendedUsers(user.id, limit);
    setUsers(data || []);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [user, limit]);

  useEffect(() => {
    refresh(true); // Force refresh on mount to check staleness
  }, [user?.id]);

  return {
    users,
    isLoading,
    isRefreshing,
    refresh: () => refresh(false),
    forceRefresh: () => refresh(true),
  };
}

// ============================================
// CONTACT SYNC HOOK
// ============================================

interface ContactSyncState {
  hasPermission: boolean | null;
  isLoading: boolean;
  isSyncing: boolean;
  contactMatches: recommendationService.ContactMatch[];
  error: string | null;
  isAvailable: boolean;
}

export function useContactSync() {
  const { user } = useAuth();
  const isAvailable = Contacts !== null && Crypto !== null;

  const [state, setState] = useState<ContactSyncState>({
    hasPermission: null,
    isLoading: false,
    isSyncing: false,
    contactMatches: [],
    error: isAvailable ? null : 'Contact sync not available. Install expo-contacts and expo-crypto.',
    isAvailable,
  });

  // Check permission status on mount
  useEffect(() => {
    if (!isAvailable || !Contacts) return;

    const checkPermission = async () => {
      const { status } = await Contacts.getPermissionsAsync();
      setState(prev => ({
        ...prev,
        hasPermission: status === 'granted',
      }));
    };
    checkPermission();
  }, [isAvailable]);

  // Request contact permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isAvailable || !Contacts) {
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      const granted = status === 'granted';

      setState(prev => ({
        ...prev,
        hasPermission: granted,
        isLoading: false,
      }));

      return granted;
    } catch (error) {
      console.error('[ContactSync] Permission error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to request contacts permission',
      }));
      return false;
    }
  }, [isAvailable]);

  // Hash a phone number using SHA-256
  const hashPhoneNumber = async (phone: string): Promise<string> => {
    if (!Crypto) throw new Error('Crypto not available');

    // Normalize phone number: remove all non-digits
    const normalized = phone.replace(/\D/g, '');
    // Hash with SHA-256
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      normalized
    );
    return hash;
  };

  // Sync contacts and find friends
  const syncContacts = useCallback(async () => {
    if (!user || !state.hasPermission || !isAvailable || !Contacts) {
      return;
    }

    setState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      // Fetch contacts with phone numbers
      const { data: contacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (!contacts || contacts.length === 0) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          contactMatches: [],
        }));
        return;
      }

      // Extract all phone numbers and hash them
      const phoneNumbers: string[] = [];
      for (const contact of contacts) {
        if (contact.phoneNumbers) {
          for (const phone of contact.phoneNumbers) {
            if (phone.number) {
              phoneNumbers.push(phone.number);
            }
          }
        }
      }

      // Hash all phone numbers
      const phoneHashes = await Promise.all(
        phoneNumbers.map(phone => hashPhoneNumber(phone))
      );

      // Store user's contacts for future matching
      await recommendationService.storePhoneContacts(user.id, phoneHashes);

      // Find friends who are on the platform
      const { data: matches } = await recommendationService.findFriendsFromContacts(
        user.id,
        phoneHashes
      );

      setState(prev => ({
        ...prev,
        isSyncing: false,
        contactMatches: matches || [],
      }));
    } catch (error) {
      console.error('[ContactSync] Sync error:', error);
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: 'Failed to sync contacts',
      }));
    }
  }, [user, state.hasPermission, isAvailable]);

  // Set user's own phone hash (for being discoverable)
  const setOwnPhoneHash = useCallback(async (phoneNumber: string) => {
    if (!user || !isAvailable) return;

    try {
      const hash = await hashPhoneNumber(phoneNumber);
      await recommendationService.updateUserPhoneHash(user.id, hash);
    } catch (error) {
      console.error('[ContactSync] Error setting phone hash:', error);
    }
  }, [user, isAvailable]);

  return {
    ...state,
    requestPermission,
    syncContacts,
    setOwnPhoneHash,
  };
}

// ============================================
// AFFINITY DATA HOOKS
// ============================================

export function useArtistAffinity(limit = 50) {
  const { user } = useAuth();
  const [affinity, setAffinity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setAffinity([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data } = await recommendationService.getUserArtistAffinity(user.id, limit);
    setAffinity(data || []);
    setIsLoading(false);
  }, [user, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { affinity, isLoading, refresh };
}

export function useSimilarUsers(limit = 20) {
  const { user } = useAuth();
  const [similarUsers, setSimilarUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSimilarUsers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data } = await recommendationService.getSimilarUsers(user.id, limit);
    setSimilarUsers(data || []);
    setIsLoading(false);
  }, [user, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { similarUsers, isLoading, refresh };
}
