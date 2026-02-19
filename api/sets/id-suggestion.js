// API endpoint: /api/sets/id-suggestion
// Handles CRUD for track ID suggestions and voting

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export default async function handler(req, res) {
  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      // Fetch suggestions for a set (optionally filtered by track timestamp)
      const { setId, trackTimestamp } = req.query;

      if (!setId) {
        return res.status(400).json({ success: false, error: 'setId is required' });
      }

      let query = supabase
        .from('track_id_suggestions')
        .select('*, suggestion_votes(*)')
        .eq('set_id', setId)
        .order('votes_up', { ascending: false });

      if (trackTimestamp !== undefined) {
        query = query.eq('track_timestamp', parseInt(trackTimestamp));
      }

      const { data, error } = await query;

      if (error) throw error;

      return res.status(200).json({ success: true, suggestions: data || [] });
    }

    if (req.method === 'POST') {
      // Create a new suggestion
      const { setId, trackTimestamp, trackId, userId, suggestedTitle, suggestedArtist } = req.body;

      if (!setId || !userId || !suggestedTitle || !suggestedArtist) {
        return res.status(400).json({
          success: false,
          error: 'setId, userId, suggestedTitle, and suggestedArtist are required',
        });
      }

      const { data, error } = await supabase
        .from('track_id_suggestions')
        .insert({
          set_id: setId,
          track_timestamp: trackTimestamp || 0,
          track_id: trackId || null,
          user_id: userId,
          suggested_title: suggestedTitle,
          suggested_artist: suggestedArtist,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, suggestion: data });
    }

    if (req.method === 'PUT') {
      // Vote on a suggestion (upsert)
      const { suggestionId, userId, voteType } = req.body;

      if (!suggestionId || !userId || !voteType) {
        return res.status(400).json({
          success: false,
          error: 'suggestionId, userId, and voteType are required',
        });
      }

      if (!['up', 'down'].includes(voteType)) {
        return res.status(400).json({ success: false, error: 'voteType must be "up" or "down"' });
      }

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from('suggestion_votes')
        .select()
        .eq('suggestion_id', suggestionId)
        .eq('user_id', userId)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Same vote - remove it (toggle off)
          await supabase
            .from('suggestion_votes')
            .delete()
            .eq('id', existingVote.id);

          // Update counters
          const field = voteType === 'up' ? 'votes_up' : 'votes_down';
          await supabase.rpc('decrement_field', {
            table_name: 'track_id_suggestions',
            field_name: field,
            row_id: suggestionId,
          }).catch(() => {
            // Fallback: manual update
            return supabase
              .from('track_id_suggestions')
              .select(field)
              .eq('id', suggestionId)
              .single()
              .then(({ data }) => {
                return supabase
                  .from('track_id_suggestions')
                  .update({ [field]: Math.max(0, (data?.[field] || 1) - 1) })
                  .eq('id', suggestionId);
              });
          });

          return res.status(200).json({ success: true, action: 'removed' });
        } else {
          // Change vote direction
          await supabase
            .from('suggestion_votes')
            .update({ vote_type: voteType })
            .eq('id', existingVote.id);

          // Update counters (remove old, add new)
          const oldField = existingVote.vote_type === 'up' ? 'votes_up' : 'votes_down';
          const newField = voteType === 'up' ? 'votes_up' : 'votes_down';

          const { data: suggestion } = await supabase
            .from('track_id_suggestions')
            .select('votes_up, votes_down')
            .eq('id', suggestionId)
            .single();

          if (suggestion) {
            await supabase
              .from('track_id_suggestions')
              .update({
                [oldField]: Math.max(0, suggestion[oldField] - 1),
                [newField]: suggestion[newField] + 1,
              })
              .eq('id', suggestionId);
          }
        }
      } else {
        // New vote
        await supabase
          .from('suggestion_votes')
          .insert({
            suggestion_id: suggestionId,
            user_id: userId,
            vote_type: voteType,
          });

        // Update counter
        const field = voteType === 'up' ? 'votes_up' : 'votes_down';
        const { data: suggestion } = await supabase
          .from('track_id_suggestions')
          .select(field)
          .eq('id', suggestionId)
          .single();

        if (suggestion) {
          await supabase
            .from('track_id_suggestions')
            .update({ [field]: suggestion[field] + 1 })
            .eq('id', suggestionId);
        }
      }

      // Check if suggestion should be auto-accepted (5+ net upvotes)
      const { data: updated } = await supabase
        .from('track_id_suggestions')
        .select('votes_up, votes_down, status')
        .eq('id', suggestionId)
        .single();

      if (updated && updated.status === 'pending') {
        const netVotes = updated.votes_up - updated.votes_down;
        if (netVotes >= 5) {
          await supabase
            .from('track_id_suggestions')
            .update({ status: 'accepted' })
            .eq('id', suggestionId);

          return res.status(200).json({ success: true, action: 'voted', autoAccepted: true });
        }
      }

      return res.status(200).json({ success: true, action: 'voted' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[id-suggestion] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
