import { supabase } from './client';
import { PointsReason } from '@/types';

// Map reasons to categories for database
const REASON_TO_CATEGORY: Record<PointsReason, 'voting' | 'contributions' | 'track_ids'> = {
  vote_cast: 'voting',
  vote_correct: 'voting',
  source_added: 'contributions',
  track_confirmed: 'track_ids',
  first_import: 'contributions',
};

// Database transaction type
export interface DbPointTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  description: string | null;
  related_id: string | null;
  category: string;
  is_synced_from_anonymous: boolean;
  anonymous_user_id: string | null;
  created_at: string;
}

/**
 * Add points to the database for an authenticated user
 */
export async function addPointsToDatabase(
  userId: string,
  amount: number,
  reason: PointsReason,
  category: 'voting' | 'contributions' | 'track_ids',
  description?: string,
  relatedId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Insert transaction
    const { error: txError } = await supabase
      .from('point_transactions')
      .insert({
        user_id: userId,
        amount,
        reason,
        description: description || null,
        related_id: relatedId || null,
        category,
      });

    if (txError) {
      console.error('[PointsService] Error inserting transaction:', txError);
      return { success: false, error: txError.message };
    }

    // Update profile totals
    const columnMap = {
      voting: 'points_voting',
      contributions: 'points_contributions',
      track_ids: 'points_track_ids',
    };
    const categoryColumn = columnMap[category];

    // Get current values
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('points, points_voting, points_contributions, points_track_ids')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('[PointsService] Error fetching profile:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Update with new values
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        points: (profile.points || 0) + amount,
        [categoryColumn]: (profile[categoryColumn as keyof typeof profile] || 0) + amount,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[PointsService] Error updating profile:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[PointsService] Unexpected error:', error);
    return { success: false, error: 'Unexpected error' };
  }
}

/**
 * Get point transactions for a user
 */
export async function getPointsTransactions(
  userId: string,
  limit: number = 50
): Promise<DbPointTransaction[]> {
  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PointsService] Error fetching transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Check if user has already earned points for a specific action
 */
export async function hasEarnedPointsForDb(
  userId: string,
  reason: PointsReason,
  relatedId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('point_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', reason)
    .eq('related_id', relatedId)
    .limit(1);

  if (error) {
    console.error('[PointsService] Error checking duplicate:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Sync anonymous points to database when user logs in
 */
export async function syncAnonymousPoints(
  authUserId: string,
  localPoints: {
    total: number;
    breakdown: {
      voting: number;
      contributions: number;
      trackIds: number;
    };
    history: Array<{
      id: string;
      amount: number;
      reason: PointsReason;
      description: string;
      relatedId?: string;
      createdAt: Date;
    }>;
  },
  anonymousUserId: string
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  if (localPoints.history.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  try {
    // Check which transactions haven't been synced yet
    const existingRelatedIds = new Set<string>();

    // Get existing transactions to avoid duplicates
    const { data: existingTx } = await supabase
      .from('point_transactions')
      .select('reason, related_id')
      .eq('user_id', authUserId);

    if (existingTx) {
      existingTx.forEach(tx => {
        if (tx.related_id) {
          existingRelatedIds.add(`${tx.reason}:${tx.related_id}`);
        }
      });
    }

    // Filter out already synced transactions
    const toSync = localPoints.history.filter(tx => {
      if (!tx.relatedId) return true; // Always sync transactions without relatedId
      return !existingRelatedIds.has(`${tx.reason}:${tx.relatedId}`);
    });

    if (toSync.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    // Insert new transactions
    const transactions = toSync.map(tx => ({
      user_id: authUserId,
      amount: tx.amount,
      reason: tx.reason,
      description: tx.description,
      related_id: tx.relatedId || null,
      category: REASON_TO_CATEGORY[tx.reason],
      is_synced_from_anonymous: true,
      anonymous_user_id: anonymousUserId,
      created_at: tx.createdAt.toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('point_transactions')
      .insert(transactions);

    if (insertError) {
      console.error('[PointsService] Error syncing transactions:', insertError);
      return { success: false, syncedCount: 0, error: insertError.message };
    }

    // Calculate totals from synced transactions
    let votingTotal = 0;
    let contributionsTotal = 0;
    let trackIdsTotal = 0;

    toSync.forEach(tx => {
      const category = REASON_TO_CATEGORY[tx.reason];
      if (category === 'voting') votingTotal += tx.amount;
      else if (category === 'contributions') contributionsTotal += tx.amount;
      else if (category === 'track_ids') trackIdsTotal += tx.amount;
    });

    const totalPoints = votingTotal + contributionsTotal + trackIdsTotal;

    // Update profile totals
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('points, points_voting, points_contributions, points_track_ids')
      .eq('id', authUserId)
      .single();

    if (fetchError) {
      console.error('[PointsService] Error fetching profile for sync:', fetchError);
      return { success: false, syncedCount: toSync.length, error: fetchError.message };
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        points: (profile.points || 0) + totalPoints,
        points_voting: (profile.points_voting || 0) + votingTotal,
        points_contributions: (profile.points_contributions || 0) + contributionsTotal,
        points_track_ids: (profile.points_track_ids || 0) + trackIdsTotal,
      })
      .eq('id', authUserId);

    if (updateError) {
      console.error('[PointsService] Error updating profile totals:', updateError);
      return { success: false, syncedCount: toSync.length, error: updateError.message };
    }

    console.log(`[PointsService] Synced ${toSync.length} transactions, ${totalPoints} points`);
    return { success: true, syncedCount: toSync.length };
  } catch (error) {
    console.error('[PointsService] Unexpected sync error:', error);
    return { success: false, syncedCount: 0, error: 'Unexpected error during sync' };
  }
}

/**
 * Get category from reason
 */
export function getCategoryFromReason(reason: PointsReason): 'voting' | 'contributions' | 'track_ids' {
  return REASON_TO_CATEGORY[reason];
}
