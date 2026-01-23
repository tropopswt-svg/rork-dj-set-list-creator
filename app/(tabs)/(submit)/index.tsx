import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Link2,
  Music,
  Plus,
  Clock,
  Trash2,
  Sparkles,
  CheckCircle,
  Youtube,
  ExternalLink,
  User,
  AlertTriangle,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { useSets } from '@/contexts/SetsContext';
import { Artist, SetList } from '@/types';

interface PendingTrack {
  id: string;
  title: string;
  artist: string;
  timestamp: string;
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
  durationSeconds?: number;
  bpm?: number;
  key?: string;
  album?: string;
  coverUrl?: string;
  sourceUrl?: string;
}

interface ParsedSet {
  id: string;
  name: string;
  artist: string;
  venue?: string;
  date?: string;
  coverUrl?: string;
  sourceUrl?: string;
  tracks: PendingTrack[];
}

interface ScrapedLinks {
  youtube?: string;
  soundcloud?: string;
  mixcloud?: string;
}

export default function SubmitScreen() {
  const { addSet, searchArtistsByQuery, findDuplicateSet, getArtistByName, normalizeArtistName } = useSets();
  
  const [setUrl, setSetUrl] = useState('');
  const [setName, setSetName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [venue, setVenue] = useState('');
  const [tracks, setTracks] = useState<PendingTrack[]>([]);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackTimestamp, setNewTrackTimestamp] = useState('');
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [thumbnail, setThumbnail] = useState('');
  const [platform, setPlatform] = useState('');
  const [links, setLinks] = useState<ScrapedLinks>({});

  const [devCsvText, setDevCsvText] = useState('');
  const [devParsedSets, setDevParsedSets] = useState<ParsedSet[]>([]);
  const [devCsvError, setDevCsvError] = useState('');
  
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [artistSuggestions, setArtistSuggestions] = useState<Artist[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<SetList | null>(null);

  const scrapeMutation = trpc.scraper.scrapeUrl.useMutation({
    onSuccess: (result) => {
      console.log('[Submit] Scrape result:', result);
      if (result.success && result.data) {
        const scrapedTitle = result.data.title || '';
        const scrapedArtist = result.data.artist || '';
        
        const normalizedArtist = scrapedArtist && scrapedArtist !== 'Unknown Artist' 
          ? normalizeArtistName(scrapedArtist) 
          : scrapedArtist;
        
        setSetName(scrapedTitle);
        setArtistName(normalizedArtist);
        setThumbnail(result.data.thumbnail || '');
        setPlatform(result.data.platform || '');
        setLinks(result.data.links || {});
        if (result.data.venue) setVenue(result.data.venue);
        
        const sourceUrl = Object.values(result.data.links || {}).find(Boolean);
        if (sourceUrl) {
          const duplicate = findDuplicateSet(sourceUrl, normalizedArtist, scrapedTitle);
          if (duplicate) {
            setDuplicateWarning(duplicate);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
        
        const existingArtist = getArtistByName(normalizedArtist);
        if (existingArtist) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        
        if (result.data.tracks && result.data.tracks.length > 0) {
          const seen = new Set<string>();
          const importedTracks: PendingTrack[] = result.data.tracks
            .filter(t => {
              const key = `${t.artist.toLowerCase()}-${t.title.toLowerCase()}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((t, i) => ({
              id: `imported-${Date.now()}-${i}`,
              title: t.title,
              artist: t.artist,
              timestamp: t.timestamp,
              confidence: t.confidence,
              source: t.source,
            }));
          setTracks(importedTracks);
          Alert.alert('Import Complete', `Found ${importedTracks.length} unique tracks from comments & tracklists`);
        } else {
          Alert.alert('Metadata Imported', 'Set details imported. Add tracks manually or wait for AI to scan comments.');
        }
      } else {
        Alert.alert('Import Failed', result.error || 'Could not import from this URL');
      }
    },
    onError: (error) => {
      console.error('[Submit] Scrape error:', error);
      Alert.alert('Error', 'Failed to scrape URL. Please try again.');
    },
  });

  const handleImportFromUrl = () => {
    if (!setUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL first');
      return;
    }
    
    let url = setUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    setDuplicateWarning(null);
    
    const existingDuplicate = findDuplicateSet(url);
    if (existingDuplicate) {
      setDuplicateWarning(existingDuplicate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    
    console.log('[Submit] Starting import for URL:', url);
    scrapeMutation.mutate({ url });
  };

  const isImportingReal = scrapeMutation.isPending;

  const handleArtistChange = useCallback((text: string) => {
    setArtistName(text);
    setDuplicateWarning(null);
    
    if (text.trim().length > 0) {
      const suggestions = searchArtistsByQuery(text);
      setArtistSuggestions(suggestions);
      setShowArtistSuggestions(suggestions.length > 0);
    } else {
      setShowArtistSuggestions(false);
      setArtistSuggestions([]);
    }
  }, [searchArtistsByQuery]);

  const handleSelectArtist = useCallback((artist: Artist) => {
    setArtistName(artist.name);
    setShowArtistSuggestions(false);
    Haptics.selectionAsync();
    
    if (setName.trim()) {
      const duplicate = findDuplicateSet(undefined, artist.name, setName);
      if (duplicate) {
        setDuplicateWarning(duplicate);
      }
    }
  }, [findDuplicateSet, setName]);

  const handleSetNameChange = useCallback((text: string) => {
    setSetName(text);
    setDuplicateWarning(null);
    
    if (artistName.trim() && text.trim()) {
      const duplicate = findDuplicateSet(undefined, artistName, text);
      if (duplicate) {
        setDuplicateWarning(duplicate);
      }
    }
  }, [findDuplicateSet, artistName]);

  const handleAddTrack = () => {
    if (!newTrackTitle.trim() || !newTrackArtist.trim()) {
      Alert.alert('Error', 'Please enter track title and artist');
      return;
    }

    const trackKey = `${newTrackArtist.toLowerCase().trim()}-${newTrackTitle.toLowerCase().trim()}`;
    const isDuplicate = tracks.some(t => 
      `${t.artist.toLowerCase()}-${t.title.toLowerCase()}` === trackKey
    );

    if (isDuplicate) {
      Alert.alert('Duplicate Track', 'This track is already in the list');
      return;
    }

    const newTrack: PendingTrack = {
      id: Date.now().toString(),
      title: newTrackTitle.trim(),
      artist: newTrackArtist.trim(),
      timestamp: newTrackTimestamp.trim() || '0:00',
    };

    setTracks([...tracks, newTrack]);
    setNewTrackTitle('');
    setNewTrackArtist('');
    setNewTrackTimestamp('');
    setIsAddingTrack(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveTrack = (id: string) => {
    setTracks(tracks.filter((t) => t.id !== id));
  };

  const handleSubmit = () => {
    if (!setName.trim() || !artistName.trim()) {
      Alert.alert('Error', 'Please fill in set name and artist');
      return;
    }

    if (duplicateWarning) {
      Alert.alert(
        'Duplicate Set',
        `This set already exists: "${duplicateWarning.name}" by ${duplicateWarning.artist}. Do you want to view it instead?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Existing', onPress: () => {} },
        ]
      );
      return;
    }

    const sourceLinks: SetList['sourceLinks'] = [];
    if (links.youtube) sourceLinks.push({ platform: 'youtube', url: links.youtube });
    if (links.soundcloud) sourceLinks.push({ platform: 'soundcloud', url: links.soundcloud });
    if (links.mixcloud) sourceLinks.push({ platform: 'mixcloud', url: links.mixcloud });

    const newSet: SetList = {
      id: Date.now().toString(),
      name: setName.trim(),
      artist: artistName.trim(),
      venue: venue.trim() || undefined,
      date: new Date(),
      tracks: tracks.map((t, i) => {
        const hasSource = Boolean(t.sourceUrl);
        return {
          id: `track-${Date.now()}-${i}`,
          title: t.title,
          artist: t.artist,
          timestamp: parseTimestamp(t.timestamp),
          duration: t.durationSeconds || 0,
          bpm: t.bpm,
          key: t.key,
          album: t.album,
          coverUrl: t.coverUrl || thumbnail || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
          addedAt: new Date(),
          source: hasSource ? 'link' : 'manual',
          trackLinks: t.sourceUrl ? [{ platform: detectTrackLinkPlatform(t.sourceUrl), url: t.sourceUrl }] : undefined,
          verified: false,
        };
      }),
      coverUrl: thumbnail || undefined,
      sourceLinks,
      totalDuration: tracks.reduce((sum, track) => sum + (track.durationSeconds || 0), 0),
      aiProcessed: false,
      commentsScraped: 0,
      tracksIdentified: tracks.length,
      plays: 0,
    };

    const result = addSet(newSet);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Set Submitted!',
        `Your set "${setName}" has been added. You'll earn points for each verified track.`,
        [{ text: 'OK', onPress: resetForm }]
      );
    } else if (result.duplicate) {
      Alert.alert(
        'Duplicate Found',
        `This set already exists: "${result.duplicate.name}" by ${result.duplicate.artist}`,
        [{ text: 'OK' }]
      );
    }
  };

  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const formatTimestamp = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const normalizeHeader = (header: string): string =>
    header.trim().toLowerCase().replace(/\s+/g, '_');

  const parseCsvRows = (csvText: string): string[][] => {
    const rows: string[][] = [];
    let current = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i += 1) {
      const char = csvText[i];
      const next = csvText[i + 1];
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
        continue;
      }
      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(current.trim());
        current = '';
        const hasValues = row.some(value => value.length > 0);
        if (hasValues) rows.push(row);
        row = [];
        continue;
      }
      current += char;
    }

    if (current.length > 0 || row.length > 0) {
      row.push(current.trim());
      const hasValues = row.some(value => value.length > 0);
      if (hasValues) rows.push(row);
    }

    return rows;
  };

  const parseNumber = (value?: string): number | undefined => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const detectTrackLinkPlatform = (
    url: string
  ): 'spotify' | 'beatport' | 'soundcloud' | 'bandcamp' | 'youtube' | 'apple_music' | 'other' => {
    const lower = url.toLowerCase();
    if (lower.includes('spotify.com')) return 'spotify';
    if (lower.includes('beatport.com')) return 'beatport';
    if (lower.includes('soundcloud.com')) return 'soundcloud';
    if (lower.includes('bandcamp.com')) return 'bandcamp';
    if (lower.includes('music.apple.com') || lower.includes('itunes.apple.com')) return 'apple_music';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return 'other';
  };

  const detectSourcePlatform = (
    url: string
  ): 'youtube' | 'soundcloud' | 'mixcloud' | '1001tracklists' | undefined => {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('soundcloud.com')) return 'soundcloud';
    if (lower.includes('mixcloud.com')) return 'mixcloud';
    if (lower.includes('1001tracklists.com')) return '1001tracklists';
    return undefined;
  };

  const parseCsvSets = (csvText: string): { sets: ParsedSet[]; error?: string } => {
    if (!csvText.trim()) {
      return { sets: [], error: 'Paste CSV content first.' };
    }

    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      return { sets: [], error: 'CSV needs a header row and at least one data row.' };
    }

    const headerRow = rows[0].map(normalizeHeader);
    const headerIndex = new Map<string, number>();
    headerRow.forEach((header, index) => {
      if (header) headerIndex.set(header, index);
    });

    const headerLookup = (aliases: string[]): number | undefined => {
      for (const alias of aliases) {
        const normalized = normalizeHeader(alias);
        if (headerIndex.has(normalized)) return headerIndex.get(normalized);
      }
      return undefined;
    };

    // Column indexes
    const typeIndex = headerLookup(['type']);
    const setNameIndex = headerLookup(['set_name']);
    const setArtistIndex = headerLookup(['set_artist']);
    const setVenueIndex = headerLookup(['set_venue']);
    const setDateIndex = headerLookup(['set_date']);
    const setCoverIndex = headerLookup(['set_cover_url']);
    const setSourceIndex = headerLookup(['set_source_url']);
    const trackTitleIndex = headerLookup(['track_title', 'track_name', 'title']);
    const trackArtistIndex = headerLookup(['track_artist', 'artist']);
    const timestampIndex = headerLookup(['timestamp_seconds', 'timestamp', 'track_time', 'time']);
    const durationIndex = headerLookup(['duration_seconds', 'duration']);
    const bpmIndex = headerLookup(['bpm']);
    const keyIndex = headerLookup(['key']);
    const albumIndex = headerLookup(['album']);
    const trackCoverIndex = headerLookup(['track_cover_url', 'cover_url', 'cover']);
    const trackSourceIndex = headerLookup(['track_source_url', 'source_url', 'track_url', 'url']);

    // Check if using hierarchical format (SET/TRACK rows)
    const hasTypeColumn = typeIndex !== undefined;

    if (hasTypeColumn) {
      // Hierarchical format: SET rows followed by TRACK rows
      const sets: ParsedSet[] = [];
      let currentSet: ParsedSet | null = null;
      let trackIndex = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowType = row[typeIndex]?.trim().toUpperCase();

        if (rowType === 'SET') {
          // Save previous set if exists
          if (currentSet && currentSet.name && currentSet.artist) {
            sets.push(currentSet);
          }
          // Start new set
          currentSet = {
            id: `set-${Date.now()}-${sets.length}`,
            name: setNameIndex !== undefined ? row[setNameIndex]?.trim() || '' : '',
            artist: setArtistIndex !== undefined ? row[setArtistIndex]?.trim() || '' : '',
            venue: setVenueIndex !== undefined ? row[setVenueIndex]?.trim() || undefined : undefined,
            date: setDateIndex !== undefined ? row[setDateIndex]?.trim() || undefined : undefined,
            coverUrl: setCoverIndex !== undefined ? row[setCoverIndex]?.trim() || undefined : undefined,
            sourceUrl: setSourceIndex !== undefined ? row[setSourceIndex]?.trim() || undefined : undefined,
            tracks: [],
          };
          trackIndex = 0;
        } else if (rowType === 'TRACK' && currentSet) {
          // Add track to current set
          const title = trackTitleIndex !== undefined ? row[trackTitleIndex]?.trim() || '' : '';
          const artist = trackArtistIndex !== undefined ? row[trackArtistIndex]?.trim() || '' : '';

          if (title && artist) {
            const timestampRaw = timestampIndex !== undefined ? row[timestampIndex]?.trim() : '';
            let timestampValue = timestampRaw || '0:00';
            if (timestampRaw && !timestampRaw.includes(':')) {
              const seconds = parseNumber(timestampRaw);
              if (seconds !== undefined) {
                timestampValue = formatTimestamp(seconds);
              }
            }

            currentSet.tracks.push({
              id: `track-${Date.now()}-${i}-${trackIndex}`,
              title,
              artist,
              timestamp: timestampValue,
              durationSeconds: durationIndex !== undefined ? parseNumber(row[durationIndex]?.trim()) : undefined,
              bpm: bpmIndex !== undefined ? parseNumber(row[bpmIndex]?.trim()) : undefined,
              key: keyIndex !== undefined ? row[keyIndex]?.trim() || undefined : undefined,
              album: albumIndex !== undefined ? row[albumIndex]?.trim() || undefined : undefined,
              coverUrl: trackCoverIndex !== undefined ? row[trackCoverIndex]?.trim() || undefined : undefined,
              sourceUrl: trackSourceIndex !== undefined ? row[trackSourceIndex]?.trim() || undefined : undefined,
            });
            trackIndex++;
          }
        }
      }

      // Don't forget the last set
      if (currentSet && currentSet.name && currentSet.artist) {
        sets.push(currentSet);
      }

      if (sets.length === 0) {
        return { sets: [], error: 'No valid SET rows found. Each SET row needs set_name and set_artist.' };
      }

      return { sets };
    } else {
      // Flat format: all tracks belong to one set (legacy support)
      if (trackTitleIndex === undefined || trackArtistIndex === undefined) {
        return { sets: [], error: 'CSV must include type column with SET/TRACK rows, or track_title and track_artist columns.' };
      }

      const tracks: PendingTrack[] = rows.slice(1).map((row, index) => {
        const title = row[trackTitleIndex]?.trim() || '';
        const artist = row[trackArtistIndex]?.trim() || '';
        const timestampRaw = timestampIndex !== undefined ? row[timestampIndex]?.trim() : '';

        let timestampValue = timestampRaw || '0:00';
        if (timestampRaw && !timestampRaw.includes(':')) {
          const seconds = parseNumber(timestampRaw);
          if (seconds !== undefined) {
            timestampValue = formatTimestamp(seconds);
          }
        }

        return {
          id: `dev-${Date.now()}-${index}`,
          title,
          artist,
          timestamp: timestampValue,
          durationSeconds: durationIndex !== undefined ? parseNumber(row[durationIndex]?.trim()) : undefined,
          bpm: bpmIndex !== undefined ? parseNumber(row[bpmIndex]?.trim()) : undefined,
          key: keyIndex !== undefined ? row[keyIndex]?.trim() || undefined : undefined,
          album: albumIndex !== undefined ? row[albumIndex]?.trim() || undefined : undefined,
          coverUrl: trackCoverIndex !== undefined ? row[trackCoverIndex]?.trim() || undefined : undefined,
          sourceUrl: trackSourceIndex !== undefined ? row[trackSourceIndex]?.trim() || undefined : undefined,
        };
      }).filter(track => track.title && track.artist);

      if (tracks.length === 0) {
        return { sets: [], error: 'No valid tracks found. Make sure rows have track_title and track_artist values.' };
      }

      // Return as single unnamed set (user will need to fill in set info)
      return {
        sets: [{
          id: `set-${Date.now()}`,
          name: 'Untitled Set',
          artist: 'Unknown Artist',
          tracks,
        }],
        error: 'Note: No SET rows found. Created one set with all tracks. Edit set name/artist before importing.',
      };
    }
  };

  const handleDevParseCsv = () => {
    const { sets: parsedSets, error } = parseCsvSets(devCsvText);
    if (error && parsedSets.length === 0) {
      setDevCsvError(error);
      setDevParsedSets([]);
      return;
    }
    setDevCsvError(error || '');
    setDevParsedSets(parsedSets);
    const totalTracks = parsedSets.reduce((sum, set) => sum + set.tracks.length, 0);
    Alert.alert('CSV Parsed', `Found ${parsedSets.length} set(s) with ${totalTracks} total tracks.`);
  };

  const handleDevCreateSets = () => {
    if (devParsedSets.length === 0) {
      Alert.alert('No Sets', 'Parse a CSV with SET/TRACK rows first.');
      return;
    }

    const invalidSets = devParsedSets.filter(s => !s.name.trim() || !s.artist.trim() || s.name === 'Untitled Set');
    if (invalidSets.length > 0) {
      Alert.alert('Missing Info', 'All sets need a valid name and artist. Check your CSV SET rows.');
      return;
    }

    let created = 0;
    let duplicates = 0;
    const fallbackCover = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop';

    for (const parsedSet of devParsedSets) {
      const sourceLinks: SetList['sourceLinks'] = [];
      if (parsedSet.sourceUrl) {
        const platform = detectSourcePlatform(parsedSet.sourceUrl);
        if (platform) {
          sourceLinks.push({ platform, url: parsedSet.sourceUrl });
        }
      }

      const parsedDate = parsedSet.date ? new Date(parsedSet.date) : new Date();
      const totalDuration = parsedSet.tracks.reduce((sum, track) => sum + (track.durationSeconds || 0), 0);

      const newSet: SetList = {
        id: `${Date.now()}-${created}`,
        name: parsedSet.name.trim(),
        artist: parsedSet.artist.trim(),
        venue: parsedSet.venue || undefined,
        date: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        tracks: parsedSet.tracks.map((track, index) => ({
          id: `track-${Date.now()}-${created}-${index}`,
          title: track.title,
          artist: track.artist,
          timestamp: parseTimestamp(track.timestamp),
          duration: track.durationSeconds || 0,
          bpm: track.bpm,
          key: track.key,
          album: track.album,
          coverUrl: track.coverUrl || parsedSet.coverUrl || fallbackCover,
          addedAt: new Date(),
          source: track.sourceUrl ? 'link' : 'manual',
          trackLinks: track.sourceUrl ? [{ platform: detectTrackLinkPlatform(track.sourceUrl), url: track.sourceUrl }] : undefined,
          verified: false,
        })),
        coverUrl: parsedSet.coverUrl || undefined,
        sourceLinks,
        totalDuration,
        aiProcessed: false,
        commentsScraped: 0,
        tracksIdentified: parsedSet.tracks.length,
        plays: 0,
      };

      const result = addSet(newSet);
      if (result.success) {
        created++;
      } else if (result.duplicate) {
        duplicates++;
      }
    }

    if (created > 0) {
      setDevCsvText('');
      setDevParsedSets([]);
      setDevCsvError('');
    }

    Alert.alert(
      'Import Complete',
      `Created ${created} set(s).${duplicates > 0 ? ` ${duplicates} duplicate(s) skipped.` : ''}`
    );
  };

  const resetForm = () => {
    setSetUrl('');
    setSetName('');
    setArtistName('');
    setVenue('');
    setTracks([]);
    setThumbnail('');
    setPlatform('');
    setLinks({});
    setDuplicateWarning(null);
    setShowArtistSuggestions(false);
  };

  const renderArtistSuggestion = ({ item }: { item: Artist }) => (
    <Pressable
      style={styles.suggestionItem}
      onPress={() => handleSelectArtist(item)}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.suggestionImage} />
      ) : (
        <View style={styles.suggestionImagePlaceholder}>
          <User size={16} color={Colors.dark.textMuted} />
        </View>
      )}
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName}>{item.name}</Text>
        <Text style={styles.suggestionMeta}>
          {item.setsCount} sets • {item.genres.slice(0, 2).join(', ') || 'Various'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Submit Set' }} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add a New Set</Text>
          <Text style={styles.headerSubtitle}>
            Submit a set and contribute tracks to earn points
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Set URL</Text>
          <View style={styles.urlInputRow}>
            <View style={styles.urlInputWrapper}>
              <Link2 size={18} color={Colors.dark.textMuted} />
              <TextInput
                style={styles.urlInput}
                placeholder="YouTube, SoundCloud, or Mixcloud URL"
                placeholderTextColor={Colors.dark.textMuted}
                value={setUrl}
                onChangeText={(text) => {
                  setSetUrl(text);
                  setDuplicateWarning(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable
              style={[styles.importButton, isImportingReal && styles.importButtonDisabled]}
              onPress={handleImportFromUrl}
              disabled={isImportingReal}
            >
              {isImportingReal ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Sparkles size={16} color="#fff" />
              )}
              <Text style={styles.importButtonText}>
                {isImportingReal ? 'Scanning...' : 'Import'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.helpText}>
            AI will scan comments & 1001tracklists for track IDs
          </Text>
        </View>

        {duplicateWarning && (
          <View style={styles.duplicateWarning}>
            <AlertTriangle size={18} color={Colors.dark.warning} />
            <View style={styles.duplicateContent}>
              <Text style={styles.duplicateTitle}>Set Already Exists</Text>
              <Text style={styles.duplicateText}>
                "{duplicateWarning.name}" by {duplicateWarning.artist}
              </Text>
            </View>
            <Pressable onPress={() => setDuplicateWarning(null)}>
              <X size={18} color={Colors.dark.textMuted} />
            </Pressable>
          </View>
        )}

        {thumbnail ? (
          <View style={styles.thumbnailSection}>
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
            <View style={styles.platformBadge}>
              <Text style={styles.platformText}>{platform.toUpperCase()}</Text>
            </View>
          </View>
        ) : null}

        {Object.keys(links).length > 0 && (
          <View style={styles.linksSection}>
            <Text style={styles.linksSectionTitle}>Available Links</Text>
            <View style={styles.linksRow}>
              {links.youtube && (
                <View style={styles.linkBadge}>
                  <Youtube size={14} color="#FF0000" />
                  <Text style={styles.linkText}>YouTube</Text>
                </View>
              )}
              {links.soundcloud && (
                <View style={styles.linkBadge}>
                  <ExternalLink size={14} color="#FF5500" />
                  <Text style={styles.linkText}>SoundCloud</Text>
                </View>
              )}
              {links.mixcloud && (
                <View style={styles.linkBadge}>
                  <ExternalLink size={14} color="#5000FF" />
                  <Text style={styles.linkText}>Mixcloud</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Set Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Set Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Boiler Room Berlin"
              placeholderTextColor={Colors.dark.textMuted}
              value={setName}
              onChangeText={handleSetNameChange}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DJ / Artist *</Text>
            <View style={styles.artistInputWrapper}>
              <User size={18} color={Colors.dark.textMuted} />
              <TextInput
                style={styles.artistInput}
                placeholder="e.g., Dixon"
                placeholderTextColor={Colors.dark.textMuted}
                value={artistName}
                onChangeText={handleArtistChange}
                onFocus={() => {
                  if (artistName.trim()) {
                    const suggestions = searchArtistsByQuery(artistName);
                    setArtistSuggestions(suggestions);
                    setShowArtistSuggestions(suggestions.length > 0);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowArtistSuggestions(false), 200);
                }}
              />
              {artistName.trim() && getArtistByName(artistName) && (
                <View style={styles.verifiedBadge}>
                  <CheckCircle size={14} color={Colors.dark.success} />
                </View>
              )}
            </View>
            
            {showArtistSuggestions && artistSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <FlatList
                  data={artistSuggestions}
                  renderItem={renderArtistSuggestion}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  keyboardShouldPersistTaps="handled"
                />
              </View>
            )}
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venue (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Kreuzberg Warehouse"
              placeholderTextColor={Colors.dark.textMuted}
              value={venue}
              onChangeText={setVenue}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Tracklist</Text>
              <Text style={styles.trackCount}>
                {tracks.length} track{tracks.length !== 1 ? 's' : ''} added
              </Text>
            </View>
            <Pressable
              style={styles.addTrackButton}
              onPress={() => setIsAddingTrack(true)}
            >
              <Plus size={18} color={Colors.dark.primary} />
              <Text style={styles.addTrackText}>Add Track</Text>
            </Pressable>
          </View>

          {isAddingTrack && (
            <View style={styles.addTrackForm}>
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Track Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Track name"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={newTrackTitle}
                    onChangeText={setNewTrackTitle}
                  />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 2 }]}>
                  <Text style={styles.inputLabel}>Artist *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Artist name"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={newTrackArtist}
                    onChangeText={setNewTrackArtist}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Timestamp</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0:00"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={newTrackTimestamp}
                    onChangeText={setNewTrackTimestamp}
                  />
                </View>
              </View>
              <View style={styles.formActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsAddingTrack(false);
                    setNewTrackTitle('');
                    setNewTrackArtist('');
                    setNewTrackTimestamp('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveTrackButton} onPress={handleAddTrack}>
                  <CheckCircle size={16} color="#fff" />
                  <Text style={styles.saveTrackText}>Add</Text>
                </Pressable>
              </View>
            </View>
          )}

          {tracks.length > 0 && (
            <View style={styles.tracksList}>
              {tracks.map((track, index) => (
                <View key={track.id} style={styles.trackItem}>
                  <View style={styles.trackIndex}>
                    <Text style={styles.trackIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </View>
                  <View style={styles.trackTimestamp}>
                    <Clock size={12} color={Colors.dark.textMuted} />
                    <Text style={styles.timestampText}>{track.timestamp}</Text>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveTrack(track.id)}
                  >
                    <Trash2 size={16} color={Colors.dark.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {tracks.length === 0 && !isAddingTrack && (
            <View style={styles.emptyTracks}>
              <Music size={32} color={Colors.dark.textMuted} />
              <Text style={styles.emptyText}>No tracks added yet</Text>
              <Text style={styles.emptySubtext}>
                Add tracks manually or import from URL
              </Text>
            </View>
          )}
        </View>

        <View style={styles.pointsInfo}>
          <View style={styles.pointsIcon}>
            <Sparkles size={18} color={Colors.dark.primary} />
          </View>
          <View style={styles.pointsContent}>
            <Text style={styles.pointsTitle}>Earn Points</Text>
            <Text style={styles.pointsDescription}>
              Each verified track you contribute = 1 point
            </Text>
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.devSection}>
            <Text style={styles.devTitle}>Dev Tools: CSV Import</Text>
            <Text style={styles.devSubtitle}>
              Bulk import sets with tracks. Use SET rows for set info, TRACK rows for tracks.
            </Text>
            <View style={styles.devDivider} />
            <Text style={styles.devLabel}>CSV Format</Text>
            <Text style={styles.devHint}>
              type, set_name, set_artist, set_venue, set_date, set_cover_url, set_source_url, track_title, track_artist, timestamp_seconds, ...
            </Text>
            <Text style={styles.devHint}>
              SET rows define a set. TRACK rows below belong to that set.
            </Text>
            <TextInput
              style={styles.devCsvInput}
              placeholder="Paste CSV with SET and TRACK rows here..."
              placeholderTextColor={Colors.dark.textMuted}
              value={devCsvText}
              onChangeText={setDevCsvText}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
            />
            {devCsvError ? <Text style={styles.devError}>{devCsvError}</Text> : null}
            
            {devParsedSets.length > 0 && (
              <View style={styles.devParsedPreview}>
                <Text style={styles.devLabel}>Parsed Sets Preview</Text>
                {devParsedSets.map((set, index) => (
                  <View key={set.id} style={styles.devSetPreview}>
                    <Text style={styles.devSetName}>{index + 1}. {set.name}</Text>
                    <Text style={styles.devSetMeta}>
                      {set.artist} • {set.tracks.length} tracks
                      {set.venue ? ` • ${set.venue}` : ''}
                      {set.date ? ` • ${set.date}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.devActions}>
              <Pressable style={styles.devSecondaryButton} onPress={handleDevParseCsv}>
                <Text style={styles.devSecondaryButtonText}>
                  Parse CSV ({devParsedSets.length} sets)
                </Text>
              </Pressable>
              <Pressable style={styles.devPrimaryButton} onPress={handleDevCreateSets}>
                <Text style={styles.devPrimaryButtonText}>Import All Sets</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable 
          style={[styles.submitButton, duplicateWarning && styles.submitButtonWarning]} 
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>Submit Set</Text>
        </Pressable>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  trackCount: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: -8,
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  urlInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  urlInput: {
    flex: 1,
    height: 48,
    color: Colors.dark.text,
    fontSize: 14,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 8,
  },
  duplicateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 67, 0.12)',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 67, 0.3)',
    gap: 12,
    marginBottom: 8,
  },
  duplicateContent: {
    flex: 1,
  },
  duplicateTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.warning,
    marginBottom: 2,
  },
  duplicateText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: Colors.dark.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  artistInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  artistInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 14,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  suggestionsContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  suggestionImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  suggestionMeta: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  addTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 8,
  },
  addTrackText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  addTrackForm: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  formRow: {
    flexDirection: 'row',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
  },
  saveTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  saveTrackText: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  tracksList: {
    gap: 8,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  trackIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackIndexText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  trackTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
  },
  timestampText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  removeButton: {
    padding: 6,
  },
  emptyTracks: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  pointsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  pointsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pointsContent: {
    flex: 1,
  },
  pointsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  pointsDescription: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: Colors.dark.primary,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonWarning: {
    backgroundColor: Colors.dark.warning,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  bottomPadding: {
    height: 40,
  },
  thumbnailSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.dark.surface,
  },
  platformBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  linksSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  linksSectionTitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  linkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  linkText: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '500' as const,
  },
  devSection: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  devTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  devSubtitle: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  devDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 12,
  },
  devLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  devGrid: {
    gap: 10,
    marginBottom: 12,
  },
  devInput: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    color: Colors.dark.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  devCsvInput: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    minHeight: 120,
    color: Colors.dark.text,
    fontSize: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  devError: {
    color: Colors.dark.error,
    fontSize: 12,
    marginBottom: 8,
  },
  devActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  devSecondaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  devSecondaryButtonText: {
    color: Colors.dark.text,
    fontWeight: '600' as const,
    fontSize: 13,
  },
  devPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
  },
  devPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700' as const,
    fontSize: 13,
  },
  devHint: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  devParsedPreview: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 8,
  },
  devSetPreview: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  devSetName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  devSetMeta: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
});
