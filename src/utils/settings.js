/**
 * User settings utility for managing preferences in localStorage
 * Handles measurement unit preference (metric vs imperial) and theme preference
 */

const STORAGE_KEY = 'simpler-recipes-settings';

const DEFAULT_SETTINGS = {
  measurementUnit: 'imperial', // 'imperial' or 'metric'
  theme: 'system', // 'light', 'dark', or 'system'
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

// ============ Theme Settings ============

/**
 * Get the user's theme preference
 * @returns {'light' | 'dark' | 'system'} The theme preference
 */
export function getThemePreference() {
  return getSettings().theme;
}

/**
 * Set the user's theme preference
 * @param {'light' | 'dark' | 'system'} theme - The theme to use
 */
export function setThemePreference(theme) {
  if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
    console.warn(`Invalid theme "${theme}", defaulting to system`);
    theme = 'system';
  }

  const settings = getSettings();
  settings.theme = theme;
  saveSettings(settings);
  applyTheme(theme);
}

/**
 * Get the effective theme (resolving 'system' to actual preference)
 * @returns {'light' | 'dark'} The effective theme
 */
export function getEffectiveTheme() {
  const preference = getThemePreference();
  if (preference === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return preference;
}

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
export function isDarkMode() {
  return getEffectiveTheme() === 'dark';
}

/**
 * Apply theme to document
 * @param {'light' | 'dark' | 'system'} theme - The theme to apply
 */
export function applyTheme(theme) {
  if (typeof window === 'undefined') return;

  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  if (effectiveTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Initialize theme on page load
 * Should be called as early as possible to prevent flash
 */
export function initializeTheme() {
  if (typeof window === 'undefined') return;

  const theme = getThemePreference();
  applyTheme(theme);

  // Listen for OS theme changes when using 'system'
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (getThemePreference() === 'system') {
      applyTheme('system');
      window.dispatchEvent(new CustomEvent('settings-changed'));
    }
  });
}
