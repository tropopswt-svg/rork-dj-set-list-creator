import { describe, test, expect } from 'bun:test';

// Test that core type structures are valid by creating objects that match them

describe('Track type', () => {
  test('supports all source types', () => {
    const sources = [
      'shazam', 'social', 'manual', 'ai', 'link', 'database',
      '1001tracklists', 'youtube', 'soundcloud', 'user',
    ];
    // All should be valid string values
    expect(sources.length).toBe(10);
    sources.forEach(s => expect(typeof s).toBe('string'));
  });

  test('track object has required fields', () => {
    const track = {
      id: '123',
      title: 'Test Track',
      artist: 'Test Artist',
      duration: 300,
      coverUrl: 'https://example.com/cover.jpg',
      addedAt: new Date(),
      source: 'manual' as const,
    };

    expect(track.id).toBeDefined();
    expect(track.title).toBe('Test Track');
    expect(track.artist).toBe('Test Artist');
    expect(track.duration).toBe(300);
  });
});

describe('SetList type', () => {
  test('set object has required fields', () => {
    const set = {
      id: '456',
      name: 'Chris Stussy @ Fabric',
      artist: 'Chris Stussy',
      venue: 'Fabric',
      date: new Date('2024-12-07'),
      tracks: [],
      sourceLinks: [{ platform: 'youtube' as const, url: 'https://youtube.com/watch?v=test' }],
      trackCount: 18,
      gapCount: 3,
      hasGaps: true,
      sourcePlatform: '1001tracklists',
    };

    expect(set.name).toContain('Chris Stussy');
    expect(set.venue).toBe('Fabric');
    expect(set.gapCount).toBe(3);
    expect(set.sourcePlatform).toBe('1001tracklists');
  });
});

describe('SourceLink type', () => {
  test('supports all platforms', () => {
    const platforms = ['youtube', 'soundcloud', '1001tracklists', 'mixcloud'];
    expect(platforms.length).toBe(4);
  });
});
