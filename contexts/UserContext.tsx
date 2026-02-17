import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { UserPoints, PointsBreakdown, PointsTransaction, PointsReason, PointsSyncState } from '@/types';
import { useAuth } from './AuthContext';
import {
  addPointsToDatabase,
  hasEarnedPointsForDb,
  syncAnonymousPoints,
  getCategoryFromReason,
} from '@/lib/supabase';

const USER_POINTS_KEY = 'user_points';
const USER_ID_KEY = 'user_id';
const POINTS_SYNCED_KEY = 'points_synced'; // Track if we've migrated this session

// Points values for different actions
const POINTS_VALUES: Record<PointsReason, number> = {
  vote_cast: 5,
  vote_correct: 10,
  source_added: 25,
  track_confirmed: 15,
  first_import: 10,
};

// Descriptions for point reasons
const POINTS_DESCRIPTIONS: Record<PointsReason, string> = {
  vote_cast: 'Voted on a track conflict',
  vote_correct: 'Voted for the winning track',
  source_added: 'Added a new source link to a set',
  track_confirmed: 'Track identification confirmed',
  first_import: 'First to import this set',
};

export const [UserProvider, useUser] = createContextHook(() => {
  const { user, isAuthenticated, profile, refreshProfile } = useAuth();

  const [userId, setUserId] = useState<string>('');
  const [points, setPoints] = useState<UserPoints>({
    oderId: '',
    total: 0,
    breakdown: {
      voting: 0,
      correctVotes: 0,
      contributions: 0,
      trackIds: 0,
    },
    history: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [syncState, setSyncState] = useState<PointsSyncState>('idle');

  // Track if we've already synced for this auth session
  const hasSyncedRef = useRef(false);
  const previousAuthState = useRef<boolean>(false);

  // Generate or load anonymous user ID
  useEffect(() => {
    loadUserData();
  }, []);

  // Handle login migration: sync anonymous points to database
  useEffect(() => {
    const handleAuthChange = async () => {
      // Detect login transition (was not authenticated, now is)
      const justLoggedIn = isAuthenticated && !previousAuthState.current;
      previousAuthState.current = isAuthenticated;

      if (justLoggedIn && user && !hasSyncedRef.current) {
        if (__DEV__) console.log('[UserContext] User logged in, checking for points to sync...');
        await migrateAnonymousPoints();
      }

      // When logged out, reset sync state
      if (!isAuthenticated) {
        hasSyncedRef.current = false;
      }
    };

    handleAuthChange();
  }, [isAuthenticated, user]);

  const loadUserData = async () => {
    try {
      // Get or create anonymous user ID (used for tracking before login)
      let storedUserId = await AsyncStorage.getItem(USER_ID_KEY);
      if (!storedUserId) {
        storedUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(USER_ID_KEY, storedUserId);
      }
      setUserId(storedUserId);

      // Load local points
      const pointsJson = await AsyncStorage.getItem(USER_POINTS_KEY);
      if (pointsJson) {
        const loaded = JSON.parse(pointsJson) as UserPoints;
        // Parse dates
        loaded.history = loaded.history.map(t => ({
          ...t,
          createdAt: new Date(t.createdAt),
        }));
        setPoints(loaded);
      } else {
        // Initialize points for new user
        const newPoints: UserPoints = {
          oderId: storedUserId,
          total: 0,
          breakdown: {
            voting: 0,
            correctVotes: 0,
            contributions: 0,
            trackIds: 0,
          },
          history: [],
        };
        setPoints(newPoints);
      }
    } catch (error) {
      if (__DEV__) console.error('[UserContext] Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePoints = useCallback(async (newPoints: UserPoints) => {
    await AsyncStorage.setItem(USER_POINTS_KEY, JSON.stringify(newPoints));
  }, []);

  /**
   * Migrate anonymous points to database when user logs in
   */
  const migrateAnonymousPoints = async () => {
    if (!user || !points.history.length) {
      if (__DEV__) console.log('[UserContext] No points to migrate');
      return;
    }

    // Check if already synced in a previous session
    const syncedKey = `${POINTS_SYNCED_KEY}_${user.id}`;
    const alreadySynced = await AsyncStorage.getItem(syncedKey);
    if (alreadySynced) {
      if (__DEV__) console.log('[UserContext] Points already synced for this user');
      hasSyncedRef.current = true;
      return;
    }

    setSyncState('syncing');
    if (__DEV__) console.log('[UserContext] Migrating anonymous points to database...');

    try {
      const result = await syncAnonymousPoints(
        user.id,
        {
          total: points.total,
          breakdown: {
            voting: points.breakdown.voting,
            contributions: points.breakdown.contributions,
            trackIds: points.breakdown.trackIds,
          },
          history: points.history,
        },
        userId
      );

      if (result.success) {
        if (__DEV__) console.log(`[UserContext] Synced ${result.syncedCount} transactions`);
        // Mark as synced
        await AsyncStorage.setItem(syncedKey, 'true');
        hasSyncedRef.current = true;

        // Clear local points after successful sync
        const emptyPoints: UserPoints = {
          oderId: userId,
          total: 0,
          breakdown: {
            voting: 0,
            correctVotes: 0,
            contributions: 0,
            trackIds: 0,
          },
          history: [],
        };
        setPoints(emptyPoints);
        await savePoints(emptyPoints);

        // Refresh profile to get updated totals from database
        await refreshProfile();

        setSyncState('synced');
      } else {
        if (__DEV__) console.error('[UserContext] Sync failed:', result.error);
        setSyncState('error');
      }
    } catch (error) {
      if (__DEV__) console.error('[UserContext] Migration error:', error);
      setSyncState('error');
    }
  };

  /**
   * Add points to the user's total
   * - Always updates local state first (optimistic UI)
   * - If authenticated: syncs to database
   * - If anonymous: saves to AsyncStorage only
   */
  const addPoints = useCallback(async (
    reason: PointsReason,
    relatedId?: string,
    customDescription?: string
  ): Promise<number> => {
    const amount = POINTS_VALUES[reason];
    const description = customDescription || POINTS_DESCRIPTIONS[reason];

    const transaction: PointsTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      amount,
      reason,
      description,
      relatedId,
      createdAt: new Date(),
    };

    // Always update local state first (optimistic UI)
    setPoints(prev => {
      const newBreakdown = { ...prev.breakdown };

      // Update breakdown based on reason
      switch (reason) {
        case 'vote_cast':
        case 'vote_correct':
          newBreakdown.voting += amount;
          if (reason === 'vote_correct') {
            newBreakdown.correctVotes += amount;
          }
          break;
        case 'source_added':
        case 'first_import':
          newBreakdown.contributions += amount;
          break;
        case 'track_confirmed':
          newBreakdown.trackIds += amount;
          break;
      }

      const newPoints: UserPoints = {
        ...prev,
        total: prev.total + amount,
        breakdown: newBreakdown,
        history: [transaction, ...prev.history].slice(0, 100), // Keep last 100
      };

      // Save to AsyncStorage (non-blocking)
      if (!isAuthenticated) {
        savePoints(newPoints);
      }

      if (__DEV__) console.log('[UserContext] Points added locally:', amount, reason);
      return newPoints;
    });

    // If authenticated, sync to database
    if (isAuthenticated && user) {
      const category = getCategoryFromReason(reason);
      const result = await addPointsToDatabase(
        user.id,
        amount,
        reason,
        category,
        description,
        relatedId
      );

      if (result.success) {
        if (__DEV__) console.log('[UserContext] Points synced to database:', amount, reason);
        // Refresh profile to update displayed totals
        refreshProfile();
      } else {
        if (__DEV__) console.error('[UserContext] Failed to sync points:', result.error);
        // Points are still saved locally, will sync on next login
      }
    }

    return amount;
  }, [isAuthenticated, user, savePoints, refreshProfile]);

  /**
   * Get recent point transactions
   */
  const getRecentTransactions = useCallback((limit: number = 10): PointsTransaction[] => {
    return points.history.slice(0, limit);
  }, [points.history]);

  /**
   * Get points breakdown for display
   */
  const getPointsBreakdown = useCallback((): PointsBreakdown => {
    return points.breakdown;
  }, [points.breakdown]);

  /**
   * Check if user has earned points for a specific action
   * Checks both local history and database (if authenticated)
   */
  const hasEarnedPointsFor = useCallback(async (reason: PointsReason, relatedId: string): Promise<boolean> => {
    // First check local history
    const localMatch = points.history.some(t => t.reason === reason && t.relatedId === relatedId);
    if (localMatch) {
      return true;
    }

    // If authenticated, also check database
    if (isAuthenticated && user) {
      return await hasEarnedPointsForDb(user.id, reason, relatedId);
    }

    return false;
  }, [points.history, isAuthenticated, user]);

  /**
   * Synchronous version for quick local checks (doesn't check database)
   */
  const hasEarnedPointsForLocal = useCallback((reason: PointsReason, relatedId: string): boolean => {
    return points.history.some(t => t.reason === reason && t.relatedId === relatedId);
  }, [points.history]);

  // Use profile points when authenticated, local points when anonymous
  const displayTotal = isAuthenticated && profile ? profile.points : points.total;
  const displayBreakdown: PointsBreakdown = isAuthenticated && profile
    ? {
        voting: profile.points_voting || 0,
        correctVotes: 0, // Not tracked separately in profile
        contributions: profile.points_contributions || 0,
        trackIds: profile.points_track_ids || 0,
      }
    : points.breakdown;

  return {
    userId: isAuthenticated && user ? user.id : userId,
    totalPoints: displayTotal,
    pointsBreakdown: displayBreakdown,
    isLoading,
    syncState,
    isAuthenticated,
    addPoints,
    getRecentTransactions,
    getPointsBreakdown,
    hasEarnedPointsFor,
    hasEarnedPointsForLocal,
    POINTS_VALUES, // Export for UI display
  };
});
