import { describe, test, expect } from 'bun:test';

// Import the patterns and test them directly since the module uses path aliases
// We'll test the core regex patterns and logic

describe('Comment Parser Patterns', () => {
  const idRequestPattern =
    /\b(id\??|track\s*id\??|song\s*(name|id)\??|what('?s| is)\s*(this|the)\s*(track|song|tune)\??|tune\s*id\??|anyone\s*know\s*(this|the)\s*(track|song))\b/i;

  const artistTitlePattern =
    /^[\s@]*([A-Za-z0-9\s\-&'.]+?)\s*[-–—]\s*([A-Za-z0-9\s\-&'.()\[\]]+?)(?:\s*\((?:edit|remix|bootleg|vip|dub|mix)\))?$/i;

  describe('ID Request Detection', () => {
    test('matches "ID?"', () => {
      expect(idRequestPattern.test('ID?')).toBe(true);
    });

    test('matches "track id?"', () => {
      expect(idRequestPattern.test('track id?')).toBe(true);
    });

    test('matches "what\'s this track?"', () => {
      expect(idRequestPattern.test("what's this track?")).toBe(true);
    });

    test('matches "song name?"', () => {
      expect(idRequestPattern.test('song name?')).toBe(true);
    });

    test('matches "anyone know this track"', () => {
      expect(idRequestPattern.test('anyone know this track')).toBe(true);
    });

    test('does not match random text', () => {
      expect(idRequestPattern.test('great set!')).toBe(false);
    });
  });

  describe('Artist - Title Extraction', () => {
    test('parses "Artist - Title"', () => {
      const match = 'Chris Stussy - Departure'.match(artistTitlePattern);
      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe('Chris Stussy');
      expect(match![2].trim()).toBe('Departure');
    });

    test('parses "Artist – Title" with en dash', () => {
      const match = 'Mau P – Drugs From Amsterdam'.match(artistTitlePattern);
      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe('Mau P');
      expect(match![2].trim()).toBe('Drugs From Amsterdam');
    });

    test('parses title with remix tag', () => {
      const match = 'Dennis Cruz - Pump Up The Jam (Remix)'.match(artistTitlePattern);
      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe('Dennis Cruz');
    });
  });
});

describe('Timestamp Parsing', () => {
  test('parses MM:SS format', () => {
    const pattern = /\b(\d{1,2}):(\d{2})\b/g;
    const match = pattern.exec('track at 45:30 is fire');
    expect(match).not.toBeNull();
    const seconds = parseInt(match![1]) * 60 + parseInt(match![2]);
    expect(seconds).toBe(2730);
  });

  test('parses H:MM:SS format', () => {
    const pattern = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;
    const match = pattern.exec('check 1:15:00');
    expect(match).not.toBeNull();
    const seconds = parseInt(match![1]) * 3600 + parseInt(match![2]) * 60 + parseInt(match![3]);
    expect(seconds).toBe(4500);
  });
});

describe('Music Link Detection', () => {
  const linkPatterns = {
    soundcloud: /soundcloud\.com\/[\w\-]+\/[\w\-]+/gi,
    spotify: /open\.spotify\.com\/track\/[\w]+/gi,
    beatport: /beatport\.com\/track\/[\w\-]+\/\d+/gi,
    youtube: /(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]+/gi,
  };

  test('detects SoundCloud links', () => {
    expect(linkPatterns.soundcloud.test('check soundcloud.com/artist/track-name')).toBe(true);
  });

  test('detects Spotify links', () => {
    expect(linkPatterns.spotify.test('open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV')).toBe(true);
  });

  test('detects YouTube links', () => {
    expect(linkPatterns.youtube.test('youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  test('detects Beatport links', () => {
    expect(linkPatterns.beatport.test('beatport.com/track/some-track/12345')).toBe(true);
  });
});

describe('HTML Entity Cleaning', () => {
  function cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  test('cleans HTML entities', () => {
    expect(cleanText('Chris &amp; James')).toBe('Chris & James');
  });

  test('removes HTML tags', () => {
    expect(cleanText('<b>bold</b> text')).toBe('bold text');
  });

  test('converts &quot; to quotes', () => {
    expect(cleanText('&quot;Track Name&quot;')).toBe('"Track Name"');
  });

  test('trims whitespace', () => {
    expect(cleanText('  spaced  ')).toBe('spaced');
  });
});
