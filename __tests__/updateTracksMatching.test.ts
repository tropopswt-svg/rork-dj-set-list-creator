import { describe, test, expect } from 'bun:test';

// ─── Copy the pure functions from api/sets/update-tracks.js ───
// These are not exported, so we inline them here for unit testing.

function normalize(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinSim(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const m: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return 1 - m[a.length][b.length] / Math.max(a.length, b.length);
}

function similarity(s1: string | null | undefined, s2: string | null | undefined): number {
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  if (n1 === n2) return 1;
  if (!n1 || !n2) return 0;

  if (n1.includes(n2) || n2.includes(n1)) return 0.85;

  const words1 = n1.split(' ');
  const words2 = n2.split(' ');
  let matches = 0;

  for (const w1 of words1) {
    let bestWordMatch = 0;
    for (const w2 of words2) {
      if (w1 === w2) { bestWordMatch = 1; break; }
      if (w1.includes(w2) || w2.includes(w1)) { bestWordMatch = Math.max(bestWordMatch, 0.8); continue; }
      if (w1.length >= 3 && w2.length >= 3) {
        const lev = levenshteinSim(w1, w2);
        if (lev > 0.75) bestWordMatch = Math.max(bestWordMatch, lev);
      }
    }
    matches += bestWordMatch;
  }

  return matches / Math.max(words1.length, words2.length);
}

// ─── Replicate the matching logic from update-tracks.js ───

const MATCH_THRESHOLD = 0.6;
const NEAR_DUP_THRESHOLD = 0.5;

interface ScrapedTrack {
  title: string;
  artist: string;
  timestamp?: number;
}

interface ExistingTrack {
  track_title: string;
  artist_name: string;
}

interface MatchResult {
  match: ExistingTrack | null;
  score: number;
  strategy: string;
}

/** Main matching logic — mirrors lines 145-173 of update-tracks.js */
function findBestMatch(scraped: ScrapedTrack, existingTracks: ExistingTrack[]): MatchResult {
  let bestMatch: ExistingTrack | null = null;
  let bestScore = 0;
  let bestStrategy = 'normal';

  for (const existing of existingTracks) {
    // Strategy 1: Normal
    const titleScore = similarity(scraped.title, existing.track_title);
    const artistScore = similarity(scraped.artist, existing.artist_name);
    const normalScore = titleScore * 0.7 + artistScore * 0.3;

    // Strategy 2: Swapped (×0.9 penalty)
    const swapTitleScore = similarity(scraped.title, existing.artist_name);
    const swapArtistScore = similarity(scraped.artist, existing.track_title);
    const swapScore = (swapTitleScore * 0.7 + swapArtistScore * 0.3) * 0.9;

    // Strategy 3: Combined (×0.95 penalty)
    const scrapedCombined = `${scraped.title || ''} ${scraped.artist || ''}`.trim();
    const existingCombined = `${existing.track_title || ''} ${existing.artist_name || ''}`.trim();
    const combinedScore = similarity(scrapedCombined, existingCombined) * 0.95;

    let score = normalScore;
    let strategy = 'normal';
    if (swapScore > score) { score = swapScore; strategy = 'swap'; }
    if (combinedScore > score) { score = combinedScore; strategy = 'combined'; }

    if (score > bestScore && score >= MATCH_THRESHOLD) {
      bestScore = score;
      bestMatch = existing;
      bestStrategy = strategy;
    }
  }

  return { match: bestMatch, score: bestScore, strategy: bestStrategy };
}

/** Near-duplicate check — mirrors lines 217-235 of update-tracks.js */
function isNearDuplicate(scraped: ScrapedTrack, existingTracks: ExistingTrack[]): { isDup: boolean; strategy: string; score: number } {
  for (const existing of existingTracks) {
    const titleSim = similarity(scraped.title, existing.track_title);
    const swapTitleSim = similarity(scraped.title, existing.artist_name);
    const swapArtistSim = similarity(scraped.artist, existing.track_title);
    const swapSim = swapTitleSim * 0.7 + swapArtistSim * 0.3;
    const scrapedAll = `${scraped.title || ''} ${scraped.artist || ''}`.trim();
    const existingAll = `${existing.track_title || ''} ${existing.artist_name || ''}`.trim();
    const combinedSim = similarity(scrapedAll, existingAll);

    const dupScore = Math.max(titleSim, swapSim, combinedSim);
    const dupStrategy = dupScore === titleSim ? 'title' : dupScore === swapSim ? 'swap' : 'combined';

    if (dupScore >= NEAR_DUP_THRESHOLD) {
      return { isDup: true, strategy: dupStrategy, score: dupScore };
    }
  }
  return { isDup: false, strategy: 'none', score: 0 };
}

// ─── Tests ───

describe('similarity()', () => {
  test('identical strings → 1.0', () => {
    expect(similarity('Kolter', 'Kolter')).toBe(1);
  });

  test('case insensitive match → 1.0', () => {
    expect(similarity('kolter', 'KOLTER')).toBe(1);
  });

  test('completely different strings → low score', () => {
    expect(similarity('Kolter', 'Bicep')).toBeLessThan(0.3);
  });

  test('empty vs non-empty → 0', () => {
    expect(similarity('', 'Kolter')).toBe(0);
    expect(similarity(null, 'Kolter')).toBe(0);
  });

  test('partial word overlap', () => {
    const score = similarity('Be Good to Me', 'Be Good 2 Me');
    expect(score).toBeGreaterThan(0.5);
  });
});

describe('Main matching — findBestMatch()', () => {
  const existingTracks: ExistingTrack[] = [
    { track_title: '15 Seconds of Fame', artist_name: 'Kolter' },
    { track_title: 'Lovely Day', artist_name: 'Bill Withers' },
    { track_title: 'Be Good to Me', artist_name: 'Kaskade' },
    { track_title: 'Dreaming', artist_name: 'Bicep' },
  ];

  test('normal match: exact title and artist', () => {
    const result = findBestMatch(
      { title: '15 Seconds of Fame', artist: 'Kolter' },
      existingTracks
    );
    expect(result.match?.track_title).toBe('15 Seconds of Fame');
    expect(result.strategy).toBe('normal');
    expect(result.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  test('SWAP match: YouTube "Title - Artist" parsed as artist/title reversed', () => {
    // YouTube comment: "15 Seconds of Fame - Kolter"
    // Parsed as: title="15 Seconds of Fame", artist="Kolter" BUT
    // Actually the commenter wrote it as "Title - Artist" so scraper got:
    // artist="15 Seconds of Fame", title="Kolter"
    const result = findBestMatch(
      { title: 'Kolter', artist: '15 Seconds of Fame' },
      existingTracks
    );
    expect(result.match?.track_title).toBe('15 Seconds of Fame');
    expect(result.match?.artist_name).toBe('Kolter');
    // Both swap and combined detect this — combined wins (0.95 > 0.9) when all words match
    expect(['swap', 'combined']).toContain(result.strategy);
    expect(result.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  test('swap match score for Kolter example is ~0.9', () => {
    const result = findBestMatch(
      { title: 'Kolter', artist: '15 Seconds of Fame' },
      existingTracks
    );
    // (1.0 * 0.7 + 1.0 * 0.3) * 0.9 = 0.9
    expect(result.score).toBeCloseTo(0.9, 1);
  });

  test('normal match is preferred over swap when fields are correct', () => {
    const result = findBestMatch(
      { title: '15 Seconds of Fame', artist: 'Kolter' },
      existingTracks
    );
    // Normal = 1.0, Swap = 0.9 → normal wins
    expect(result.strategy).toBe('normal');
    expect(result.score).toBeGreaterThan(0.9);
  });

  test('swap match: another example with different track', () => {
    const result = findBestMatch(
      { title: 'Bill Withers', artist: 'Lovely Day' },
      existingTracks
    );
    expect(result.match?.track_title).toBe('Lovely Day');
    // Both swap and combined detect reversed fields
    expect(['swap', 'combined']).toContain(result.strategy);
    expect(result.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  test('combined match: words split across fields differently', () => {
    // Scraped as one big title with no artist
    const result = findBestMatch(
      { title: 'Bicep Dreaming', artist: '' },
      existingTracks
    );
    expect(result.match?.track_title).toBe('Dreaming');
    expect(result.match?.artist_name).toBe('Bicep');
    expect(result.strategy).toBe('combined');
    expect(result.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  test('no match for completely unrelated track', () => {
    const result = findBestMatch(
      { title: 'Sandstorm', artist: 'Darude' },
      existingTracks
    );
    expect(result.match).toBeNull();
    expect(result.score).toBeLessThan(MATCH_THRESHOLD);
  });

  test('swap does not create false positives between unrelated tracks', () => {
    // "Dreaming" vs "Lovely Day" — swap should not accidentally match these
    const result = findBestMatch(
      { title: 'Dreaming', artist: 'Bicep' },
      existingTracks
    );
    // Should match the correct track via normal, not some other track via swap
    expect(result.match?.track_title).toBe('Dreaming');
    expect(result.strategy).toBe('normal');
  });
});

describe('Near-duplicate detection — isNearDuplicate()', () => {
  const existingTracks: ExistingTrack[] = [
    { track_title: '15 Seconds of Fame', artist_name: 'Kolter' },
    { track_title: 'Lovely Day', artist_name: 'Bill Withers' },
    { track_title: 'Be Good to Me', artist_name: 'Kaskade' },
  ];

  test('title-only near-duplicate (original behavior)', () => {
    const result = isNearDuplicate(
      { title: 'Be Good 2 Me', artist: 'Kaskade' },
      existingTracks
    );
    expect(result.isDup).toBe(true);
  });

  test('swapped fields detected as near-duplicate', () => {
    const result = isNearDuplicate(
      { title: 'Kolter', artist: '15 Seconds of Fame' },
      existingTracks
    );
    expect(result.isDup).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(NEAR_DUP_THRESHOLD);
  });

  test('combined fields detected as near-duplicate', () => {
    const result = isNearDuplicate(
      { title: 'Bill Withers Lovely Day', artist: '' },
      existingTracks
    );
    expect(result.isDup).toBe(true);
  });

  test('unrelated track is NOT a near-duplicate', () => {
    const result = isNearDuplicate(
      { title: 'Sandstorm', artist: 'Darude' },
      existingTracks
    );
    expect(result.isDup).toBe(false);
  });
});

describe('Edge cases', () => {
  test('empty scraped title and artist', () => {
    const result = findBestMatch(
      { title: '', artist: '' },
      [{ track_title: 'Test', artist_name: 'Artist' }]
    );
    expect(result.match).toBeNull();
  });

  test('empty existing tracks list', () => {
    const result = findBestMatch(
      { title: 'Something', artist: 'Someone' },
      []
    );
    expect(result.match).toBeNull();
  });

  test('null/undefined in scraped fields', () => {
    const result = findBestMatch(
      { title: null as any, artist: undefined as any },
      [{ track_title: 'Test', artist_name: 'Artist' }]
    );
    expect(result.match).toBeNull();
  });

  test('special characters in track names', () => {
    const existing = [{ track_title: "Don't Stop 'Til You Get Enough", artist_name: 'Michael Jackson' }];
    const result = findBestMatch(
      { title: "Dont Stop Til You Get Enough", artist: 'Michael Jackson' },
      existing
    );
    expect(result.match).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  test('swap match with partial artist/title overlap', () => {
    // Scraped: artist="Take Me Higher", title="DJ Snake"
    // Existing: track_title="Take Me Higher", artist_name="DJ Snake"
    const existing = [{ track_title: 'Take Me Higher', artist_name: 'DJ Snake' }];
    const result = findBestMatch(
      { title: 'DJ Snake', artist: 'Take Me Higher' },
      existing
    );
    expect(result.match).not.toBeNull();
    expect(['swap', 'combined']).toContain(result.strategy);
    expect(result.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  test('picks the best match among multiple candidates', () => {
    const existing = [
      { track_title: 'Dreams', artist_name: 'Fleetwood Mac' },
      { track_title: 'Dreaming', artist_name: 'Bicep' },
    ];
    const result = findBestMatch(
      { title: 'Dreaming', artist: 'Bicep' },
      existing
    );
    expect(result.match?.track_title).toBe('Dreaming');
    expect(result.match?.artist_name).toBe('Bicep');
  });

  test('swap does not override a better normal match', () => {
    // If "Kolter" happens to be both an artist and a track title for different entries
    const existing = [
      { track_title: 'Kolter', artist_name: 'SomeProducer' },
      { track_title: '15 Seconds of Fame', artist_name: 'Kolter' },
    ];
    // Scraped with correct fields
    const result = findBestMatch(
      { title: 'Kolter', artist: 'SomeProducer' },
      existing
    );
    expect(result.match?.track_title).toBe('Kolter');
    expect(result.strategy).toBe('normal');
  });
});
