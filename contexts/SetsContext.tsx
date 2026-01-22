import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { SetList, Artist } from '@/types';
import { mockSetLists } from '@/mocks/tracks';
import { mockArtists, searchArtists, findArtistByName } from '@/mocks/artists';

const SETS_STORAGE_KEY = 'saved_sets';
const ARTISTS_STORAGE_KEY = 'custom_artists';

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
  const [sets, setSets] = useState<SetList[]>(mockSetLists);
  const [savedSetIds, setSavedSetIds] = useState<Set<string>>(new Set());
  const [customArtists, setCustomArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const [savedSetsJson, customArtistsJson] = await Promise.all([
        AsyncStorage.getItem(SETS_STORAGE_KEY),
        AsyncStorage.getItem(ARTISTS_STORAGE_KEY),
      ]);

      if (savedSetsJson) {
        const savedIds = JSON.parse(savedSetsJson) as string[];
        setSavedSetIds(new Set(savedIds));
      }

      if (customArtistsJson) {
        const artists = JSON.parse(customArtistsJson) as Artist[];
        setCustomArtists(artists);
      }
    } catch (error) {
      console.error('[SetsContext] Error loading saved data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const allArtists = useMemo(() => {
    const artistMap = new Map<string, Artist>();
    
    mockArtists.forEach(a => artistMap.set(a.name.toLowerCase(), a));
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
    
    const artistExists = allArtists.some(a => a.name.toLowerCase() === newSet.artist.toLowerCase());
    if (!artistExists && newSet.artist) {
      const newArtist: Artist = {
        id: `artist-${Date.now()}`,
        name: newSet.artist,
        imageUrl: newSet.coverUrl,
        genres: [],
        setsCount: 1,
      };
      setCustomArtists(prev => {
        const updated = [...prev, newArtist];
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

  return {
    sets,
    savedSets,
    allArtists,
    isLoading,
    addSet,
    toggleSaveSet,
    isSetSaved,
    getSetById,
    findDuplicateSet,
    searchArtistsByQuery,
    getArtistByName,
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
