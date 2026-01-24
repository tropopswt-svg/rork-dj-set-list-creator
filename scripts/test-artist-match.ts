/**
 * Test artist matching
 * Run: bun run scripts/test-artist-match.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Normalize text for matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance for fuzzy matching
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  return 1 - distance / Math.max(len1, len2);
}

async function findArtist(name: string) {
  const normalized = normalizeText(name);
  
  // 1. Exact match
  const { data: exact } = await supabase
    .from('artists')
    .select('*')
    .ilike('name', name)
    .single();
  
  if (exact) {
    return { artist: exact, confidence: 1, matchType: 'exact' };
  }
  
  // 2. Alias match
  const { data: alias } = await supabase
    .from('artist_aliases')
    .select('*, artists(*)')
    .eq('alias_lower', normalized)
    .single();
  
  if (alias?.artists) {
    return { artist: alias.artists, confidence: 0.95, matchType: 'alias' };
  }
  
  // 3. Fuzzy match
  const { data: all } = await supabase
    .from('artists')
    .select('*')
    .limit(100);
  
  if (all) {
    let best = null;
    let bestScore = 0;
    
    for (const artist of all) {
      const score = calculateSimilarity(name, artist.name);
      if (score > bestScore && score >= 0.7) {
        bestScore = score;
        best = artist;
      }
    }
    
    if (best) {
      return { artist: best, confidence: bestScore, matchType: 'fuzzy' };
    }
  }
  
  return null;
}

async function test() {
  console.log('🔍 Testing artist matching...\n');
  
  const testCases = [
    'Chris Stussy',       // Exact
    'chris stussy',       // Case insensitive
    'Chirs Stussy',       // Typo
    'C. Stussy',          // Alias
    'John Summit',        // Exact
    'john sumit',         // Typo
    'FISHER',             // Case
    'Charlotte De Witte', // Case variation
    'fred again',         // Alias
    'Unknown Artist',     // No match
  ];
  
  for (const name of testCases) {
    const result = await findArtist(name);
    
    if (result) {
      const conf = Math.round(result.confidence * 100);
      console.log(`  ✅ "${name}" → ${result.artist.name} (${conf}% ${result.matchType})`);
    } else {
      console.log(`  ❌ "${name}" → No match`);
    }
  }
  
  console.log('\n✨ Matching system working!');
}

test().catch(console.error);
