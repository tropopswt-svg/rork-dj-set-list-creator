import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { SetList, Artist, Track } from '@/types';
import { trackLibrary } from '@/lib/TrackLibrary';

const SETS_STORAGE_KEY = 'saved_sets';
const ARTISTS_STORAGE_KEY = 'custom_artists';
const SUBMITTED_SETS_KEY = 'submitted_sets';
const TRACK_REPOSITORY_KEY = 'track_repository';

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .replace(/[?#].*$/, '');
}

function normalizeSetKey(artist: string, name: string): string {
  return `${artist.toLowerCase().trim()}-${name.toLowerCase().trim()}`;
}

export const [SetsProvider, useSets] = createContextHook(() => {
  const [sets, setSets] = useState<SetList[]>([]);
  const [savedSetIds, setSavedSetIds] = useState<Set<string>>(new Set());
  const [customArtists, setCustomArtists] = useState<Artist[]>([]);
  const [submittedSets, setSubmittedSets] = useState<SetList[]>([]);
  const [trackRepository, setTrackRepository] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      // Load TrackLibrary first
      await trackLibrary.load();
      
      // Migrate old track repository to new library if needed
      const trackRepoJson = await AsyncStorage.getItem(TRACK_REPOSITORY_KEY);
      if (trackRepoJson) {
        const oldTracks = JSON.parse(trackRepoJson) as Track[];
        if (oldTracks.length > 0) {
          console.log('[SetsContext] Migrating', oldTracks.length, 'tracks to new library...');
          const result = await trackLibrary.bulkAddTracks(oldTracks);
          console.log('[SetsContext] Migration complete:', result.success, 'added,', result.failed, 'duplicates');
          // Keep old storage for now, can remove later
        }
      }

      const [savedSetsJson, customArtistsJson, submittedSetsJson] = await Promise.all([
        AsyncStorage.getItem(SETS_STORAGE_KEY),
        AsyncStorage.getItem(ARTISTS_STORAGE_KEY),
        AsyncStorage.getItem(SUBMITTED_SETS_KEY),
      ]);

      if (savedSetsJson) {
        const savedIds = JSON.parse(savedSetsJson) as string[];
        setSavedSetIds(new Set(savedIds));
      }

      if (customArtistsJson) {
        const artists = JSON.parse(customArtistsJson) as Artist[];
        setCustomArtists(artists);
      }

      if (submittedSetsJson) {
        const submitted = JSON.parse(submittedSetsJson) as SetList[];
        // Convert date strings to Date objects
        const parsedSets = submitted.map(set => ({
          ...set,
          date: new Date(set.date),
          tracks: set.tracks.map(track => ({
            ...track,
            addedAt: new Date(track.addedAt),
          })),
        }));
        setSubmittedSets(parsedSets);
        setSets(parsedSets);
      }

      // Load tracks from new library
      const libraryTracks = await trackLibrary.getAllTracks();
      setTrackRepository(libraryTracks);
      console.log('[SetsContext] Loaded', libraryTracks.length, 'tracks from library');
    } catch (error) {
      console.error('[SetsContext] Error loading saved data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const allArtists = useMemo(() => {
    const artistMap = new Map<string, Artist>();
    
    customArtists.forEach(a => artistMap.set(a.name.toLowerCase(), a));
    
    sets.forEach(set => {
      const key = set.artist.toLowerCase();
      if (!artistMap.has(key)) {
        artistMap.set(key, {
          id: `set-artist-${set.id}`,
          name: set.artist,
          imageUrl: set.coverUrl,
          genres: [],
          setsCount: 1,
        });
      } else {
        const existing = artistMap.get(key)!;
        artistMap.set(key, { ...existing, setsCount: (existing.setsCount || 0) + 1 });
      }
    });

    return Array.from(artistMap.values());
  }, [customArtists, sets]);

  const savedSets = useMemo(() => {
    return sets.filter(s => savedSetIds.has(s.id));
  }, [sets, savedSetIds]);

  const findDuplicateSet = useCallback((url?: string, artist?: string, name?: string): SetList | null => {
    if (url) {
      const normalizedUrl = normalizeUrl(url);
      const found = sets.find(set => 
        set.sourceLinks.some(link => normalizeUrl(link.url) === normalizedUrl)
      );
      if (found) return found;
    }

    if (artist && name) {
      const key = normalizeSetKey(artist, name);
      const found = sets.find(set => normalizeSetKey(set.artist, set.name) === key);
      if (found) return found;
    }

    return null;
  }, [sets]);

  const addSet = useCallback((newSet: SetList): { success: boolean; duplicate?: SetList; set: SetList } => {
    const sourceUrl = newSet.sourceLinks[0]?.url;
    const duplicate = findDuplicateSet(sourceUrl, newSet.artist, newSet.name);

    if (duplicate) {
      console.log('[SetsContext] Duplicate set found:', duplicate.name);
      return { success: false, duplicate, set: duplicate };
    }

    const setWithId = { ...newSet, id: newSet.id || Date.now().toString() };
    setSets(prev => [setWithId, ...prev]);
    
    setSubmittedSets(prev => {
      const updated = [setWithId, ...prev];
      AsyncStorage.setItem(SUBMITTED_SETS_KEY, JSON.stringify(updated));
      return updated;
    });
    
    const artistKey = newSet.artist.toLowerCase().trim();
    const artistExists = allArtists.some(a => a.name.toLowerCase().trim() === artistKey);
    
    if (!artistExists && newSet.artist && newSet.artist !== 'Unknown Artist') {
      const newArtist: Artist = {
        id: `artist-${Date.now()}`,
        name: newSet.artist.trim(),
        imageUrl: newSet.coverUrl,
        genres: [],
        setsCount: 1,
      };
      setCustomArtists(prev => {
        const alreadyExists = prev.some(a => a.name.toLowerCase().trim() === artistKey);
        if (alreadyExists) return prev;
        const updated = [...prev, newArtist];
        AsyncStorage.setItem(ARTISTS_STORAGE_KEY, JSON.stringify(updated));
        console.log('[SetsContext] New artist created:', newArtist.name);
        return updated;
      });
    } else {
      setCustomArtists(prev => {
        const updated = prev.map(a => {
          if (a.name.toLowerCase().trim() === artistKey) {
            return { ...a, setsCount: (a.setsCount || 0) + 1 };
          }
          return a;
        });
        AsyncStorage.setItem(ARTISTS_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }

    console.log('[SetsContext] Set added:', setWithId.name);
    return { success: true, set: setWithId };
  }, [findDuplicateSet, allArtists]);

  const toggleSaveSet = useCallback(async (setId: string) => {
    setSavedSetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      AsyncStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  }, []);

  const isSetSaved = useCallback((setId: string) => {
    return savedSetIds.has(setId);
  }, [savedSetIds]);

  const getSetById = useCallback((id: string) => {
    return sets.find(s => s.id === id);
  }, [sets]);

  const searchArtistsByQuery = useCallback((query: string) => {
    if (!query.trim()) return allArtists.slice(0, 8);
    
    const normalizedQuery = query.toLowerCase().trim();
    return allArtists
      .filter(artist => artist.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(normalizedQuery);
        const bStarts = b.name.toLowerCase().startsWith(normalizedQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return (b.setsCount || 0) - (a.setsCount || 0);
      })
      .slice(0, 10);
  }, [allArtists]);

  const getArtistByName = useCallback((name: string) => {
    return allArtists.find(a => a.name.toLowerCase() === name.toLowerCase());
  }, [allArtists]);

  const addArtist = useCallback((name: string, imageUrl?: string): Artist => {
    const normalizedName = name.toLowerCase().trim();
    const existing = allArtists.find(a => a.name.toLowerCase().trim() === normalizedName);
    
    if (existing) {
      console.log('[SetsContext] Artist already exists:', existing.name);
      return existing;
    }

    const newArtist: Artist = {
      id: `artist-${Date.now()}`,
      name: name.trim(),
      imageUrl,
      genres: [],
      setsCount: 0,
    };

    setCustomArtists(prev => {
      const updated = [...prev, newArtist];
      AsyncStorage.setItem(ARTISTS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    console.log('[SetsContext] Artist added:', newArtist.name);
    return newArtist;
  }, [allArtists]);

  const normalizeArtistName = useCallback((name: string): string => {
    const found = allArtists.find(a => 
      a.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    return found ? found.name : name.trim();
  }, [allArtists]);

  const getSetsByArtist = useCallback((artistName: string) => {
    const normalized = artistName.toLowerCase().trim();
    return sets.filter(s => s.artist.toLowerCase().trim() === normalized);
  }, [sets]);

  const addTracksToSet = useCallback((setId: string, newTracks: Track[]) => {
    setSets(prev => {
      const updated = prev.map(set => {
        if (set.id === setId) {
          const existingTimestamps = new Set(set.tracks.map(t => t.timestamp));
          const uniqueTracks = newTracks.filter(t => !existingTimestamps.has(t.timestamp));
          const mergedTracks = [...set.tracks, ...uniqueTracks].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          return { ...set, tracks: mergedTracks };
        }
        return set;
      });

      const updatedSet = updated.find(s => s.id === setId);
      if (updatedSet) {
        setSubmittedSets(prev => {
          const newSubmitted = prev.map(s => s.id === setId ? updatedSet : s);
          if (!prev.find(s => s.id === setId)) {
            newSubmitted.push(updatedSet);
          }
          AsyncStorage.setItem(SUBMITTED_SETS_KEY, JSON.stringify(newSubmitted));
          return newSubmitted;
        });
      }

      console.log('[SetsContext] Added', newTracks.length, 'tracks to set:', setId);
      return updated;
    });
  }, []);

  const bulkImportSets = useCallback((newSets: SetList[]): { success: number; failed: number } => {
    let success = 0;
    let failed = 0;

    newSets.forEach(newSet => {
      const result = addSet(newSet);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    });

    console.log('[SetsContext] Bulk import complete:', success, 'success,', failed, 'failed');
    return { success, failed };
  }, [addSet]);

  const addTrackToRepository = useCallback(async (track: Track): Promise<{ success: boolean; duplicate?: Track }> => {
    const result = await trackLibrary.addTrack(track);
    if (result.success) {
      // Update local state
      const libraryTracks = await trackLibrary.getAllTracks();
      setTrackRepository(libraryTracks);
    }
    return result;
  }, []);

  const bulkAddTracksToRepository = useCallback(async (tracks: Track[]): Promise<{ success: number; failed: number }> => {
    const result = await trackLibrary.bulkAddTracks(tracks);
    // Update local state
    const libraryTracks = await trackLibrary.getAllTracks();
    setTrackRepository(libraryTracks);
    console.log('[SetsContext] Bulk track import complete:', result.success, 'success,', result.failed, 'duplicates');
    return { success: result.success, failed: result.failed };
  }, []);

  const getTrackFromRepository = useCallback(async (artist: string, title: string): Promise<Track | undefined> => {
    return await trackLibrary.getTrackByArtistTitle(artist, title);
  }, []);

  const searchTracksInRepository = useCallback(async (query: string): Promise<Track[]> => {
    return await trackLibrary.searchTracks(query, 50);
  }, []);

  const removeTrackFromRepository = useCallback(async (trackId: string) => {
    await trackLibrary.removeTrack(trackId);
    const libraryTracks = await trackLibrary.getAllTracks();
    setTrackRepository(libraryTracks);
    console.log('[SetsContext] Track removed from repository:', trackId);
  }, []);

  return {
    sets,
    savedSets,
    submittedSets,
    trackRepository,
    allArtists,
    isLoading,
    addSet,
    addArtist,
    toggleSaveSet,
    isSetSaved,
    getSetById,
    getSetsByArtist,
    findDuplicateSet,
    searchArtistsByQuery,
    getArtistByName,
    normalizeArtistName,
    addTracksToSet,
    bulkImportSets,
    addTrackToRepository,
    bulkAddTracksToRepository,
    getTrackFromRepository,
    searchTracksInRepository,
    removeTrackFromRepository,
  };
});

export function useFilteredSets(searchQuery: string, filter: 'trending' | 'recent') {
  const { sets } = useSets();
  
  return useMemo(() => {
    return sets
      .filter(set =>
        set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.venue?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (filter === 'trending') {
          return (b.plays || 0) - (a.plays || 0);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [sets, searchQuery, filter]);
}
