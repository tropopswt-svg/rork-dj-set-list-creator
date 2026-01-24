import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context.js";

const TrackInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  duration: z.number(),
  timestamp: z.number().optional(),
  verified: z.boolean().optional(),
});

const FeaturedInSchema = z.object({
  setId: z.string(),
  setName: z.string(),
  artist: z.string(),
  timestamp: z.number(),
});

const RepositoryTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  duration: z.number(),
  featuredIn: z.array(FeaturedInSchema).optional(),
});

export interface GapAnalysisResult {
  gaps: TrackGap[];
  coverage: number;
  estimatedMissingTracks: number;
  confidence: number;
}

export interface TrackGap {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  previousTrack: { id: string; title: string; artist: string } | null;
  nextTrack: { id: string; title: string; artist: string } | null;
  estimatedTracks: number;
  suggestions: TrackSuggestion[];
  confidence: 'high' | 'medium' | 'low';
}

export interface TrackSuggestion {
  id: string;
  title: string;
  artist: string;
  duration: number;
  matchReason: string;
  confidence: number;
  featuredInCount: number;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function estimateTracksInGap(gapDuration: number, avgTrackDuration: number = 300): number {
  if (gapDuration < 120) return 0;
  if (gapDuration < 240) return 1;
  return Math.max(1, Math.round(gapDuration / avgTrackDuration));
}

function calculateGapConfidence(
  gapDuration: number, 
  hasContextTracks: boolean,
  suggestionsCount: number
): 'high' | 'medium' | 'low' {
  if (gapDuration > 600 && suggestionsCount === 0) return 'low';
  if (gapDuration > 180 && gapDuration < 480 && hasContextTracks) return 'high';
  if (suggestionsCount > 0) return 'medium';
  return 'low';
}

function findSuggestionsForGap(
  gapDuration: number,
  repositoryTracks: z.infer<typeof RepositoryTrackSchema>[],
  setArtist: string,
  previousTrack: { title: string; artist: string } | null,
  nextTrack: { title: string; artist: string } | null
): TrackSuggestion[] {
  const suggestions: TrackSuggestion[] = [];
  const tolerance = 60;
  
  for (const track of repositoryTracks) {
    if (track.duration <= 0) continue;
    
    const durationDiff = Math.abs(track.duration - gapDuration);
    const fitsInGap = durationDiff <= tolerance || track.duration <= gapDuration + 30;
    
    if (!fitsInGap && gapDuration < 600) continue;
    
    let confidence = 0;
    const reasons: string[] = [];
    
    if (track.artist.toLowerCase() === setArtist.toLowerCase()) {
      confidence += 30;
      reasons.push('Same artist as set');
    }
    
    if (track.featuredIn && track.featuredIn.length > 0) {
      const featuredCount = track.featuredIn.length;
      confidence += Math.min(featuredCount * 10, 40);
      reasons.push(`Featured in ${featuredCount} other sets`);
    }
    
    if (durationDiff <= 30) {
      confidence += 20;
      reasons.push('Duration matches gap');
    } else if (durationDiff <= tolerance) {
      confidence += 10;
      reasons.push('Duration approximately matches');
    }
    
    if (confidence > 20) {
      suggestions.push({
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        matchReason: reasons.join(', '),
        confidence,
        featuredInCount: track.featuredIn?.length || 0,
      });
    }
  }
  
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

export const gapAnalysisRouter = createTRPCRouter({
  analyzeSet: publicProcedure
    .input(z.object({
      setId: z.string(),
      setArtist: z.string(),
      totalDuration: z.number(),
      tracks: z.array(TrackInputSchema),
      repositoryTracks: z.array(RepositoryTrackSchema).optional(),
    }))
    .mutation(async ({ input }) => {
      console.log('[GapAnalysis] Analyzing set:', input.setId);
      console.log('[GapAnalysis] Total duration:', input.totalDuration, 'seconds');
      console.log('[GapAnalysis] Tracks count:', input.tracks.length);
      
      const { tracks, totalDuration, repositoryTracks = [], setArtist } = input;
      
      if (tracks.length === 0) {
        return {
          gaps: [{
            id: 'gap-full-set',
            startTime: 0,
            endTime: totalDuration,
            duration: totalDuration,
            previousTrack: null,
            nextTrack: null,
            estimatedTracks: estimateTracksInGap(totalDuration),
            suggestions: [],
            confidence: 'low' as const,
          }],
          coverage: 0,
          estimatedMissingTracks: estimateTracksInGap(totalDuration),
          confidence: 0,
        };
      }
      
      const sortedTracks = [...tracks]
        .filter(t => t.timestamp !== undefined)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      if (sortedTracks.length === 0) {
        return {
          gaps: [],
          coverage: 0,
          estimatedMissingTracks: 0,
          confidence: 0,
        };
      }
      
      const gaps: TrackGap[] = [];
      let totalCoveredTime = 0;
      
      const firstTrackStart = sortedTracks[0].timestamp || 0;
      if (firstTrackStart > 120) {
        const gapDuration = firstTrackStart;
        const suggestions = findSuggestionsForGap(
          gapDuration, 
          repositoryTracks, 
          setArtist,
          null,
          { title: sortedTracks[0].title, artist: sortedTracks[0].artist }
        );
        
        gaps.push({
          id: `gap-intro-${Date.now()}`,
          startTime: 0,
          endTime: firstTrackStart,
          duration: gapDuration,
          previousTrack: null,
          nextTrack: {
            id: sortedTracks[0].id,
            title: sortedTracks[0].title,
            artist: sortedTracks[0].artist,
          },
          estimatedTracks: estimateTracksInGap(gapDuration),
          suggestions,
          confidence: calculateGapConfidence(gapDuration, true, suggestions.length),
        });
      }
      
      for (let i = 0; i < sortedTracks.length; i++) {
        const currentTrack = sortedTracks[i];
        const nextTrack = sortedTracks[i + 1];
        
        const trackStart = currentTrack.timestamp || 0;
        const trackDuration = currentTrack.duration || 240;
        const trackEnd = trackStart + trackDuration;
        
        totalCoveredTime += trackDuration;
        
        if (nextTrack) {
          const nextStart = nextTrack.timestamp || 0;
          const gapStart = Math.min(trackEnd, nextStart);
          const gapDuration = nextStart - gapStart;
          
          if (gapDuration > 90) {
            const suggestions = findSuggestionsForGap(
              gapDuration,
              repositoryTracks,
              setArtist,
              { title: currentTrack.title, artist: currentTrack.artist },
              { title: nextTrack.title, artist: nextTrack.artist }
            );
            
            gaps.push({
              id: `gap-${i}-${Date.now()}`,
              startTime: gapStart,
              endTime: nextStart,
              duration: gapDuration,
              previousTrack: {
                id: currentTrack.id,
                title: currentTrack.title,
                artist: currentTrack.artist,
              },
              nextTrack: {
                id: nextTrack.id,
                title: nextTrack.title,
                artist: nextTrack.artist,
              },
              estimatedTracks: estimateTracksInGap(gapDuration),
              suggestions,
              confidence: calculateGapConfidence(gapDuration, true, suggestions.length),
            });
          }
        }
      }
      
      const lastTrack = sortedTracks[sortedTracks.length - 1];
      const lastTrackEnd = (lastTrack.timestamp || 0) + (lastTrack.duration || 240);
      
      if (totalDuration - lastTrackEnd > 120) {
        const gapDuration = totalDuration - lastTrackEnd;
        const suggestions = findSuggestionsForGap(
          gapDuration,
          repositoryTracks,
          setArtist,
          { title: lastTrack.title, artist: lastTrack.artist },
          null
        );
        
        gaps.push({
          id: `gap-outro-${Date.now()}`,
          startTime: lastTrackEnd,
          endTime: totalDuration,
          duration: gapDuration,
          previousTrack: {
            id: lastTrack.id,
            title: lastTrack.title,
            artist: lastTrack.artist,
          },
          nextTrack: null,
          estimatedTracks: estimateTracksInGap(gapDuration),
          suggestions,
          confidence: calculateGapConfidence(gapDuration, true, suggestions.length),
        });
      }
      
      const coverage = totalDuration > 0 
        ? Math.min(100, Math.round((totalCoveredTime / totalDuration) * 100))
        : 0;
      
      const estimatedMissing = gaps.reduce((sum, gap) => sum + gap.estimatedTracks, 0);
      
      const overallConfidence = sortedTracks.length > 0
        ? Math.min(100, Math.round(
            (coverage * 0.4) + 
            (sortedTracks.filter(t => t.verified).length / sortedTracks.length * 40) +
            (gaps.length === 0 ? 20 : Math.max(0, 20 - gaps.length * 2))
          ))
        : 0;
      
      console.log('[GapAnalysis] Found', gaps.length, 'gaps');
      console.log('[GapAnalysis] Coverage:', coverage + '%');
      console.log('[GapAnalysis] Estimated missing:', estimatedMissing);
      
      return {
        gaps,
        coverage,
        estimatedMissingTracks: estimatedMissing,
        confidence: overallConfidence,
      };
    }),
});
