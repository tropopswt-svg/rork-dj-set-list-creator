import AsyncStorage from '@react-native-async-storage/async-storage';
import { SetList } from '@/types';

const STORAGE_KEYS = {
  SAVED_SETS: '@rork:saved_sets',
  USER_PREFERENCES: '@rork:user_preferences',
  SUBMITTED_SETS: '@rork:submitted_sets',
} as const;

export interface UserPreferences {
  theme?: 'dark' | 'light';
  defaultPlatform?: 'youtube' | 'soundcloud' | 'mixcloud';
  notificationsEnabled?: boolean;
}

// Saved Sets Storage
export const saveSetToLibrary = async (setList: SetList): Promise<void> => {
  try {
    const savedSets = await getSavedSets();
    const exists = savedSets.some(s => s.id === setList.id);
    
    if (!exists) {
      const updated = [setList, ...savedSets];
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SETS, JSON.stringify(updated));
    }
  } catch (error) {
    console.error('Error saving set to library:', error);
    throw new Error('Failed to save set to library');
  }
};

export const removeSetFromLibrary = async (setId: string): Promise<void> => {
  try {
    const savedSets = await getSavedSets();
    const updated = savedSets.filter(s => s.id !== setId);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SETS, JSON.stringify(updated));
  } catch (error) {
    console.error('Error removing set from library:', error);
    throw new Error('Failed to remove set from library');
  }
};

export const getSavedSets = async (): Promise<SetList[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SETS);
    if (!data) return [];
    
    const sets = JSON.parse(data);
    // Convert date strings back to Date objects
    return sets.map((set: any) => ({
      ...set,
      date: new Date(set.date),
      tracks: set.tracks?.map((track: any) => ({
        ...track,
        addedAt: new Date(track.addedAt),
      })) || [],
    }));
  } catch (error) {
    console.error('Error getting saved sets:', error);
    return [];
  }
};

export const isSetSaved = async (setId: string): Promise<boolean> => {
  try {
    const savedSets = await getSavedSets();
    return savedSets.some(s => s.id === setId);
  } catch (error) {
    console.error('Error checking if set is saved:', error);
    return false;
  }
};

// User Preferences Storage
export const saveUserPreferences = async (preferences: UserPreferences): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving user preferences:', error);
    throw new Error('Failed to save user preferences');
  }
};

export const getUserPreferences = async (): Promise<UserPreferences> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (!data) return {};
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return {};
  }
};

// Submitted Sets Storage
export const saveSubmittedSet = async (setList: SetList): Promise<void> => {
  try {
    const submitted = await getSubmittedSets();
    const updated = [setList, ...submitted];
    await AsyncStorage.setItem(STORAGE_KEYS.SUBMITTED_SETS, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving submitted set:', error);
    throw new Error('Failed to save submitted set');
  }
};

export const getSubmittedSets = async (): Promise<SetList[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SUBMITTED_SETS);
    if (!data) return [];
    
    const sets = JSON.parse(data);
    return sets.map((set: any) => ({
      ...set,
      date: new Date(set.date),
      tracks: set.tracks?.map((track: any) => ({
        ...track,
        addedAt: new Date(track.addedAt),
      })) || [],
    }));
  } catch (error) {
    console.error('Error getting submitted sets:', error);
    return [];
  }
};

// Clear all storage (useful for testing or logout)
export const clearAllStorage = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SAVED_SETS,
      STORAGE_KEYS.USER_PREFERENCES,
      STORAGE_KEYS.SUBMITTED_SETS,
    ]);
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw new Error('Failed to clear storage');
  }
};
