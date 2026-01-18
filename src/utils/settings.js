/**
 * User settings utility for managing preferences in localStorage
 * Currently handles measurement unit preference (metric vs imperial)
 */

const STORAGE_KEY = 'simpler-recipes-settings';

const DEFAULT_SETTINGS = {
  measurementUnit: 'imperial', // 'imperial' or 'metric'
};

/**
 * Get all settings from localStorage
 * @returns {object} Settings object
 */
function getSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to localStorage
 * @param {object} settings - Settings object to save
 */
function saveSettings(settings) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: { settings } }));
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Get the user's preferred measurement unit
 * @returns {'imperial' | 'metric'} The preferred unit system
 */
export function getPreferredUnit() {
  return getSettings().measurementUnit;
}

/**
 * Set the user's preferred measurement unit
 * @param {'imperial' | 'metric'} unit - The unit system to use
 */
export function setPreferredUnit(unit) {
  if (unit !== 'imperial' && unit !== 'metric') {
    console.warn(`Invalid unit "${unit}", defaulting to imperial`);
    unit = 'imperial';
  }

  const settings = getSettings();
  settings.measurementUnit = unit;
  saveSettings(settings);
}

/**
 * Check if the user prefers metric measurements
 * @returns {boolean} True if metric is preferred
 */
export function isMetric() {
  return getSettings().measurementUnit === 'metric';
}

/**
 * Toggle between metric and imperial
 * @returns {'imperial' | 'metric'} The new unit system
 */
export function toggleUnit() {
  const newUnit = isMetric() ? 'imperial' : 'metric';
  setPreferredUnit(newUnit);
  return newUnit;
}
