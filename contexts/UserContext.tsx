import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { UserPoints, PointsBreakdown, PointsTransaction, PointsReason } from '@/types';

const USER_POINTS_KEY = 'user_points';
const USER_ID_KEY = 'user_id';

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

  // Generate or load user ID
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Get or create user ID
      let storedUserId = await AsyncStorage.getItem(USER_ID_KEY);
      if (!storedUserId) {
        storedUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(USER_ID_KEY, storedUserId);
      }
      setUserId(storedUserId);

      // Load points
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
      console.error('[UserContext] Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePoints = useCallback(async (newPoints: UserPoints) => {
    await AsyncStorage.setItem(USER_POINTS_KEY, JSON.stringify(newPoints));
  }, []);

  /**
   * Add points to the user's total
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

      savePoints(newPoints);
      console.log('[UserContext] Points added:', amount, reason);
      return newPoints;
    });

    return amount;
  }, [savePoints]);

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
   */
  const hasEarnedPointsFor = useCallback((reason: PointsReason, relatedId: string): boolean => {
    return points.history.some(t => t.reason === reason && t.relatedId === relatedId);
  }, [points.history]);

  return {
    userId,
    totalPoints: points.total,
    pointsBreakdown: points.breakdown,
    isLoading,
    addPoints,
    getRecentTransactions,
    getPointsBreakdown,
    hasEarnedPointsFor,
    POINTS_VALUES, // Export for UI display
  };
});
