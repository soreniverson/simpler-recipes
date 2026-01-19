/**
 * Sync utility for cross-device data synchronization via Supabase
 *
 * Strategy:
 * - On login: Pull remote data, merge with local (newer wins per data type)
 * - On data change: Push to Supabase if authenticated
 * - Offline-first: localStorage is always the source of truth locally
 */

import { supabase, isSupabaseConfigured } from './supabase';

// Storage keys (must match the individual utilities)
const STORAGE_KEYS = {
  favorites: 'simpler-recipes-favorites',
  mealPlans: 'simpler-recipes-meal-plan',
  pantry: 'simpler-recipes-pantry',
  settings: 'simpler-recipes-settings'
};

// Track last sync timestamps locally
const SYNC_TIMESTAMPS_KEY = 'simpler-recipes-sync-timestamps';

/**
 * Get local sync timestamps
 */
function getLocalTimestamps() {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(SYNC_TIMESTAMPS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save local sync timestamps
 */
function saveLocalTimestamps(timestamps) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_TIMESTAMPS_KEY, JSON.stringify(timestamps));
}

/**
 * Update a single timestamp
 */
function updateLocalTimestamp(dataType) {
  const timestamps = getLocalTimestamps();
  timestamps[dataType] = new Date().toISOString();
  saveLocalTimestamps(timestamps);
}

/**
 * Get local data for a specific type
 */
function getLocalData(dataType) {
  if (typeof window === 'undefined') return null;
  try {
    const key = STORAGE_KEYS[dataType];
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Save local data for a specific type (without triggering events)
 */
function saveLocalDataQuiet(dataType, data) {
  if (typeof window === 'undefined') return;
  const key = STORAGE_KEYS[dataType];
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Get current user ID
 */
async function getCurrentUserId() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Fetch remote user data from Supabase
 */
async function fetchRemoteData(userId) {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // No data exists yet - that's fine
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching remote data:', error);
    return null;
  }

  return data;
}

/**
 * Upsert user data to Supabase
 */
async function upsertRemoteData(userId, updates) {
  if (!supabase || !userId) return false;

  const { error } = await supabase
    .from('user_data')
    .upsert({
      user_id: userId,
      ...updates
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error saving remote data:', error);
    return false;
  }

  return true;
}

/**
 * Merge favorites data (combine folders and items, dedupe by ID)
 */
function mergeFavorites(local, remote) {
  if (!local && !remote) return { version: 2, folders: [], items: [] };
  if (!local) return remote;
  if (!remote) return local;

  // Merge folders by ID
  const foldersById = new Map();
  for (const folder of (remote.folders || [])) {
    foldersById.set(folder.id, folder);
  }
  for (const folder of (local.folders || [])) {
    // Local folders take precedence (more recent edits)
    foldersById.set(folder.id, folder);
  }

  // Merge items - dedupe by type+identifier
  const itemsMap = new Map();
  for (const item of (remote.items || [])) {
    const key = item.type === 'curated' ? `curated:${item.slug}` : `extracted:${item.id}`;
    itemsMap.set(key, item);
  }
  for (const item of (local.items || [])) {
    const key = item.type === 'curated' ? `curated:${item.slug}` : `extracted:${item.id}`;
    // Local items take precedence
    itemsMap.set(key, item);
  }

  return {
    version: 2,
    folders: Array.from(foldersById.values()),
    items: Array.from(itemsMap.values())
  };
}

/**
 * Merge meal plans data (combine by date, then by meal ID)
 */
function mergeMealPlans(local, remote) {
  if (!local && !remote) return { version: 1, plans: {} };
  if (!local) return remote;
  if (!remote) return local;

  const localPlans = local.plans || {};
  const remotePlans = remote.plans || {};
  const mergedPlans = {};

  // Get all date keys from both
  const allDates = new Set([...Object.keys(localPlans), ...Object.keys(remotePlans)]);

  for (const dateKey of allDates) {
    const localDay = localPlans[dateKey];
    const remoteDay = remotePlans[dateKey];

    if (!localDay) {
      mergedPlans[dateKey] = remoteDay;
    } else if (!remoteDay) {
      mergedPlans[dateKey] = localDay;
    } else {
      // Merge each section
      const sections = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
      mergedPlans[dateKey] = {};

      for (const section of sections) {
        const localMeals = localDay[section] || [];
        const remoteMeals = remoteDay[section] || [];

        // Dedupe by meal ID
        const mealsById = new Map();
        for (const meal of remoteMeals) {
          mealsById.set(meal.id, meal);
        }
        for (const meal of localMeals) {
          mealsById.set(meal.id, meal);
        }

        mergedPlans[dateKey][section] = Array.from(mealsById.values());
      }
    }
  }

  return { version: 1, plans: mergedPlans };
}

/**
 * Merge pantry data (combine by normalized name)
 */
function mergePantry(local, remote) {
  if (!local && !remote) return { version: 1, items: [] };
  if (!local) return remote;
  if (!remote) return local;

  const itemsByName = new Map();

  // Add remote items first
  for (const item of (remote.items || [])) {
    itemsByName.set(item.name, item);
  }

  // Local items take precedence
  for (const item of (local.items || [])) {
    itemsByName.set(item.name, item);
  }

  return {
    version: 1,
    items: Array.from(itemsByName.values())
  };
}

/**
 * Merge settings (simple shallow merge, local wins)
 */
function mergeSettings(local, remote) {
  return { ...(remote || {}), ...(local || {}) };
}

/**
 * Perform full sync on login
 * Merges local and remote data, saves merged result to both
 */
export async function syncOnLogin() {
  if (!isSupabaseConfigured()) return { success: false, reason: 'not_configured' };

  const userId = await getCurrentUserId();
  if (!userId) return { success: false, reason: 'not_authenticated' };

  try {
    // Fetch remote data
    const remoteData = await fetchRemoteData(userId);
    const localTimestamps = getLocalTimestamps();

    // Get local data
    const localFavorites = getLocalData('favorites');
    const localMealPlans = getLocalData('mealPlans');
    const localPantry = getLocalData('pantry');
    const localSettings = getLocalData('settings');

    // Determine what needs merging based on timestamps
    const updates = {};
    const now = new Date().toISOString();

    // Favorites
    const remoteFavoritesTime = remoteData?.favorites_updated_at;
    const localFavoritesTime = localTimestamps.favorites;

    if (localFavorites || remoteData?.favorites) {
      const merged = mergeFavorites(localFavorites, remoteData?.favorites);
      saveLocalDataQuiet('favorites', merged);
      updates.favorites = merged;
      updates.favorites_updated_at = now;
    }

    // Meal Plans
    if (localMealPlans || remoteData?.meal_plans) {
      const merged = mergeMealPlans(localMealPlans, remoteData?.meal_plans);
      saveLocalDataQuiet('mealPlans', merged);
      updates.meal_plans = merged;
      updates.meal_plans_updated_at = now;
    }

    // Pantry
    if (localPantry || remoteData?.pantry) {
      const merged = mergePantry(localPantry, remoteData?.pantry);
      saveLocalDataQuiet('pantry', merged);
      updates.pantry = merged;
      updates.pantry_updated_at = now;
    }

    // Settings
    if (localSettings || remoteData?.settings) {
      const merged = mergeSettings(localSettings, remoteData?.settings);
      saveLocalDataQuiet('settings', merged);
      updates.settings = merged;
      updates.settings_updated_at = now;
    }

    // Push merged data to remote
    if (Object.keys(updates).length > 0) {
      await upsertRemoteData(userId, updates);

      // Update local timestamps
      saveLocalTimestamps({
        favorites: now,
        mealPlans: now,
        pantry: now,
        settings: now
      });
    }

    // Dispatch events to update UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('favorites-changed'));
      window.dispatchEvent(new CustomEvent('meal-plan-changed'));
      window.dispatchEvent(new CustomEvent('pantry-changed'));
      window.dispatchEvent(new CustomEvent('settings-changed'));
    }

    return { success: true };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, reason: 'error', error };
  }
}

/**
 * Push a specific data type to remote
 * Called after local changes when user is authenticated
 */
export async function pushToRemote(dataType) {
  if (!isSupabaseConfigured()) return false;

  const userId = await getCurrentUserId();
  if (!userId) return false;

  const localData = getLocalData(dataType);
  if (!localData) return false;

  const now = new Date().toISOString();
  const columnMap = {
    favorites: { data: 'favorites', timestamp: 'favorites_updated_at' },
    mealPlans: { data: 'meal_plans', timestamp: 'meal_plans_updated_at' },
    pantry: { data: 'pantry', timestamp: 'pantry_updated_at' },
    settings: { data: 'settings', timestamp: 'settings_updated_at' }
  };

  const columns = columnMap[dataType];
  if (!columns) return false;

  const updates = {
    [columns.data]: localData,
    [columns.timestamp]: now
  };

  const success = await upsertRemoteData(userId, updates);

  if (success) {
    updateLocalTimestamp(dataType);
  }

  return success;
}

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated() {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

/**
 * Clear local sync state (on logout)
 */
export function clearSyncState() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SYNC_TIMESTAMPS_KEY);
}
