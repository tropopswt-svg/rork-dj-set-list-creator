/**
 * Efficient Track Library for managing thousands of tracks
 * Uses indexed storage with fast search capabilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '@/types';

const TRACK_LIBRARY_KEY = 'track_library_v2';
const TRACK_INDEX_KEY = 'track_index_v2';

interface TrackIndex {
  byArtist: Map<string, string[]>; // artist -> trackIds
  byTitle: Map<string, string[]>; // title -> trackIds
  byArtistTitle: Map<string, string>; // "artist-title" -> trackId
  allIds: Set<string>;
}

export class TrackLibrary {
  private tracks: Map<string, Track> = new Map();
  private index: TrackIndex = {
    byArtist: new Map(),
    byTitle: new Map(),
    byArtistTitle: new Map(),
    allIds: new Set(),
  };
  private loaded = false;

  /**
   * Load library from storage
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const [tracksJson, indexJson] = await Promise.all([
        AsyncStorage.getItem(TRACK_LIBRARY_KEY),
        AsyncStorage.getItem(TRACK_INDEX_KEY),
      ]);

      if (tracksJson) {
        const tracksArray: Track[] = JSON.parse(tracksJson);
        tracksArray.forEach(track => {
          // Convert date strings back to Date objects
          track.addedAt = new Date(track.addedAt);
          this.tracks.set(track.id, track);
        });
      }

      if (indexJson) {
        const indexData = JSON.parse(indexJson);
        this.index = {
          byArtist: new Map(indexData.byArtist || []),
          byTitle: new Map(indexData.byTitle || []),
          byArtistTitle: new Map(indexData.byArtistTitle || []),
          allIds: new Set(indexData.allIds || []),
        };
      } else {
        // Rebuild index if missing
        this.rebuildIndex();
      }

      this.loaded = true;
      console.log(`[TrackLibrary] Loaded ${this.tracks.size} tracks`);
    } catch (error) {
      console.error('[TrackLibrary] Error loading:', error);
      this.loaded = true; // Mark as loaded to prevent infinite loops
    }
  }

  /**
   * Save library to storage
   */
  private async save(): Promise<void> {
    try {
      const tracksArray = Array.from(this.tracks.values());
      const indexData = {
        byArtist: Array.from(this.index.byArtist.entries()),
        byTitle: Array.from(this.index.byTitle.entries()),
        byArtistTitle: Array.from(this.index.byArtistTitle.entries()),
        allIds: Array.from(this.index.allIds),
      };

      await Promise.all([
        AsyncStorage.setItem(TRACK_LIBRARY_KEY, JSON.stringify(tracksArray)),
        AsyncStorage.setItem(TRACK_INDEX_KEY, JSON.stringify(indexData)),
      ]);
    } catch (error) {
      console.error('[TrackLibrary] Error saving:', error);
    }
  }

  /**
   * Rebuild search index
   */
  private rebuildIndex(): void {
    this.index = {
      byArtist: new Map(),
      byTitle: new Map(),
      byArtistTitle: new Map(),
      allIds: new Set(),
    };

    this.tracks.forEach(track => {
      const artistKey = track.artist.toLowerCase().trim();
      const titleKey = track.title.toLowerCase().trim();
      const combinedKey = `${artistKey}-${titleKey}`;

      // Index by artist
      if (!this.index.byArtist.has(artistKey)) {
        this.index.byArtist.set(artistKey, []);
      }
      this.index.byArtist.get(artistKey)!.push(track.id);

      // Index by title
      if (!this.index.byTitle.has(titleKey)) {
        this.index.byTitle.set(titleKey, []);
      }
      this.index.byTitle.get(titleKey)!.push(track.id);

      // Index by artist-title combination
      this.index.byArtistTitle.set(combinedKey, track.id);

      // Add to all IDs
      this.index.allIds.add(track.id);
    });
  }

  /**
   * Add a track to the library
   */
  async addTrack(track: Track): Promise<{ success: boolean; duplicate?: Track }> {
    await this.load();

    const artistKey = track.artist.toLowerCase().trim();
    const titleKey = track.title.toLowerCase().trim();
    const combinedKey = `${artistKey}-${titleKey}`;

    // Check for duplicate
    const existingId = this.index.byArtistTitle.get(combinedKey);
    if (existingId) {
      const existing = this.tracks.get(existingId);
      if (existing) {
        return { success: false, duplicate: existing };
      }
    }

    // Add track
    const trackWithId = {
      ...track,
      id: track.id || `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.tracks.set(trackWithId.id, trackWithId);

    // Update index
    if (!this.index.byArtist.has(artistKey)) {
      this.index.byArtist.set(artistKey, []);
    }
    this.index.byArtist.get(artistKey)!.push(trackWithId.id);

    if (!this.index.byTitle.has(titleKey)) {
      this.index.byTitle.set(titleKey, []);
    }
    this.index.byTitle.get(titleKey)!.push(trackWithId.id);

    this.index.byArtistTitle.set(combinedKey, trackWithId.id);
    this.index.allIds.add(trackWithId.id);

    await this.save();
    return { success: true };
  }

  /**
   * Bulk add tracks
   */
  async bulkAddTracks(tracks: Track[]): Promise<{ success: number; failed: number; duplicates: Track[] }> {
    await this.load();

    let success = 0;
    let failed = 0;
    const duplicates: Track[] = [];

    for (const track of tracks) {
      const result = await this.addTrack(track);
      if (result.success) {
        success++;
      } else {
        failed++;
        if (result.duplicate) {
          duplicates.push(result.duplicate);
        }
      }
    }

    return { success, failed, duplicates };
  }

  /**
   * Get track by ID
   */
  async getTrack(id: string): Promise<Track | undefined> {
    await this.load();
    return this.tracks.get(id);
  }

  /**
   * Get track by artist and title
   */
  async getTrackByArtistTitle(artist: string, title: string): Promise<Track | undefined> {
    await this.load();
    const key = `${artist.toLowerCase().trim()}-${title.toLowerCase().trim()}`;
    const trackId = this.index.byArtistTitle.get(key);
    if (trackId) {
      return this.tracks.get(trackId);
    }
    return undefined;
  }

  /**
   * Search tracks
   */
  async searchTracks(query: string, limit: number = 50): Promise<Track[]> {
    await this.load();

    if (!query.trim()) {
      return Array.from(this.tracks.values()).slice(0, limit);
    }

    const normalizedQuery = query.toLowerCase().trim();
    const results = new Set<string>();

    // Search by artist
    for (const [artist, trackIds] of this.index.byArtist.entries()) {
      if (artist.includes(normalizedQuery)) {
        trackIds.forEach(id => results.add(id));
      }
    }

    // Search by title
    for (const [title, trackIds] of this.index.byTitle.entries()) {
      if (title.includes(normalizedQuery)) {
        trackIds.forEach(id => results.add(id));
      }
    }

    // Convert to tracks and sort by relevance
    const tracks = Array.from(results)
      .map(id => this.tracks.get(id))
      .filter((t): t is Track => t !== undefined)
      .sort((a, b) => {
        const aArtistMatch = a.artist.toLowerCase().includes(normalizedQuery);
        const bArtistMatch = b.artist.toLowerCase().includes(normalizedQuery);
        const aTitleMatch = a.title.toLowerCase().includes(normalizedQuery);
        const bTitleMatch = b.title.toLowerCase().includes(normalizedQuery);

        // Prioritize exact matches
        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;
        if (aArtistMatch && !bArtistMatch) return -1;
        if (!aArtistMatch && bArtistMatch) return 1;

        return 0;
      })
      .slice(0, limit);

    return tracks;
  }

  /**
   * Get all tracks
   */
  async getAllTracks(): Promise<Track[]> {
    await this.load();
    return Array.from(this.tracks.values());
  }

  /**
   * Get tracks by artist
   */
  async getTracksByArtist(artist: string): Promise<Track[]> {
    await this.load();
    const artistKey = artist.toLowerCase().trim();
    const trackIds = this.index.byArtist.get(artistKey) || [];
    return trackIds
      .map(id => this.tracks.get(id))
      .filter((t): t is Track => t !== undefined);
  }

  /**
   * Remove track
   */
  async removeTrack(trackId: string): Promise<boolean> {
    await this.load();
    const track = this.tracks.get(trackId);
    if (!track) return false;

    this.tracks.delete(trackId);
    this.index.allIds.delete(trackId);

    const artistKey = track.artist.toLowerCase().trim();
    const titleKey = track.title.toLowerCase().trim();
    const combinedKey = `${artistKey}-${titleKey}`;

    // Remove from indexes
    const artistTracks = this.index.byArtist.get(artistKey);
    if (artistTracks) {
      const index = artistTracks.indexOf(trackId);
      if (index > -1) artistTracks.splice(index, 1);
      if (artistTracks.length === 0) {
        this.index.byArtist.delete(artistKey);
      }
    }

    const titleTracks = this.index.byTitle.get(titleKey);
    if (titleTracks) {
      const index = titleTracks.indexOf(trackId);
      if (index > -1) titleTracks.splice(index, 1);
      if (titleTracks.length === 0) {
        this.index.byTitle.delete(titleKey);
      }
    }

    this.index.byArtistTitle.delete(combinedKey);

    await this.save();
    return true;
  }

  /**
   * Get library stats
   */
  async getStats(): Promise<{
    totalTracks: number;
    uniqueArtists: number;
    verifiedTracks: number;
    tracksWithLinks: number;
  }> {
    await this.load();

    const tracks = Array.from(this.tracks.values());
    const uniqueArtists = new Set(tracks.map(t => t.artist.toLowerCase().trim()));
    const verifiedTracks = tracks.filter(t => t.verified).length;
    const tracksWithLinks = tracks.filter(t => t.trackLinks && t.trackLinks.length > 0).length;

    return {
      totalTracks: tracks.length,
      uniqueArtists: uniqueArtists.size,
      verifiedTracks,
      tracksWithLinks,
    };
  }

  /**
   * Clear all tracks (use with caution!)
   */
  async clear(): Promise<void> {
    this.tracks.clear();
    this.index = {
      byArtist: new Map(),
      byTitle: new Map(),
      byArtistTitle: new Map(),
      allIds: new Set(),
    };
    await Promise.all([
      AsyncStorage.removeItem(TRACK_LIBRARY_KEY),
      AsyncStorage.removeItem(TRACK_INDEX_KEY),
    ]);
    this.loaded = false;
  }
}

// Singleton instance
export const trackLibrary = new TrackLibrary();
