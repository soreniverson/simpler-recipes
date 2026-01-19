/**
 * Meal Plan utility for managing weekly meal planning
 * Uses localStorage with custom events for reactive updates
 *
 * Data structure:
 * {
 *   version: 1,
 *   plans: {
 *     "2026-01-20": {
 *       breakfast: [{ id, recipeSlug?, recipeTitle, recipeImage?, extractedRecipe?, addedAt }],
 *       lunch: [],
 *       dinner: [],
 *       snack: [],
 *       dessert: []
 *     }
 *   }
 * }
 *
 * Sync: Changes are automatically pushed to Supabase when user is authenticated
 */

import { pushToRemote } from './sync.js';

const STORAGE_KEY = 'simpler-recipes-meal-plan';
const CURRENT_VERSION = 1;

export const MEAL_SECTIONS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Get the meal plan data from localStorage
 * @returns {{ version: number, plans: object }}
 */
function getData() {
  if (typeof window === 'undefined') {
    return { version: CURRENT_VERSION, plans: {} };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { version: CURRENT_VERSION, plans: {} };
    }
    const data = JSON.parse(stored);
    if (!data.version) {
      data.version = CURRENT_VERSION;
    }
    if (!data.plans) {
      data.plans = {};
    }
    return data;
  } catch {
    return { version: CURRENT_VERSION, plans: {} };
  }
}

/**
 * Save meal plan data to localStorage and dispatch event
 * Also triggers remote sync if user is authenticated
 * @param {{ version: number, plans: object }} data
 */
function saveData(data) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('meal-plan-changed', {
    detail: { plans: data.plans }
  }));

  // Sync to remote (fire-and-forget, don't block UI)
  pushToRemote('mealPlans').catch(() => {
    // Silently fail - offline or not authenticated
  });
}

/**
 * Get an empty day structure
 * @returns {object}
 */
function createEmptyDay() {
  return {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    dessert: []
  };
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 * @param {Date} date
 * @returns {string}
 */
export function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get the Monday of the week containing the given date
 * @param {Date} date
 * @returns {Date}
 */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust to Monday (day 1), if Sunday (day 0) go back 6 days
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get array of 7 dates starting from the week start
 * @param {Date} weekStart
 * @returns {Date[]}
 */
export function getWeekDays(weekStart) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * Get meals for a specific date
 * @param {string} dateKey - ISO date string (YYYY-MM-DD)
 * @returns {object}
 */
export function getMealsForDate(dateKey) {
  const data = getData();
  return data.plans[dateKey] || createEmptyDay();
}

/**
 * Get meals for an entire week
 * @param {Date} weekStart - Monday of the week
 * @returns {object} - Object keyed by date string
 */
export function getMealsForWeek(weekStart) {
  const data = getData();
  const result = {};
  const days = getWeekDays(weekStart);

  for (const day of days) {
    const dateKey = formatDateKey(day);
    result[dateKey] = data.plans[dateKey] || createEmptyDay();
  }

  return result;
}

/**
 * Add a meal to a specific date and section
 * @param {string} dateKey - ISO date string
 * @param {string} section - breakfast, lunch, dinner, snack, or dessert
 * @param {object} meal - { recipeSlug?, recipeTitle, recipeImage?, extractedRecipe? }
 * @returns {string} The generated meal ID
 */
export function addMeal(dateKey, section, meal) {
  if (typeof window === 'undefined') return null;
  if (!MEAL_SECTIONS.includes(section)) return null;

  const data = getData();

  if (!data.plans[dateKey]) {
    data.plans[dateKey] = createEmptyDay();
  }

  const id = generateId();
  const mealEntry = {
    id,
    ...meal,
    addedAt: Date.now()
  };

  data.plans[dateKey][section].push(mealEntry);
  saveData(data);

  return id;
}

/**
 * Remove a meal from a specific date and section
 * @param {string} dateKey - ISO date string
 * @param {string} section - breakfast, lunch, dinner, snack, or dessert
 * @param {string} mealId - The meal's ID
 */
export function removeMeal(dateKey, section, mealId) {
  if (typeof window === 'undefined') return;
  if (!MEAL_SECTIONS.includes(section)) return;

  const data = getData();

  if (!data.plans[dateKey]) return;

  data.plans[dateKey][section] = data.plans[dateKey][section].filter(
    meal => meal.id !== mealId
  );

  // Clean up empty days to save space
  const dayMeals = data.plans[dateKey];
  const isEmpty = MEAL_SECTIONS.every(s => dayMeals[s].length === 0);
  if (isEmpty) {
    delete data.plans[dateKey];
  }

  saveData(data);
}

/**
 * Check if a week has any meals planned
 * @param {Date} weekStart - Monday of the week
 * @returns {boolean}
 */
export function hasAnyMealsForWeek(weekStart) {
  const weekMeals = getMealsForWeek(weekStart);
  return Object.values(weekMeals).some(day =>
    MEAL_SECTIONS.some(section => day[section].length > 0)
  );
}

/**
 * Get total meal count for a week
 * @param {Date} weekStart - Monday of the week
 * @returns {number}
 */
export function getMealCountForWeek(weekStart) {
  const weekMeals = getMealsForWeek(weekStart);
  let count = 0;
  for (const day of Object.values(weekMeals)) {
    for (const section of MEAL_SECTIONS) {
      count += day[section].length;
    }
  }
  return count;
}

/**
 * Clear all meals for a specific date
 * @param {string} dateKey - ISO date string
 */
export function clearMealsForDate(dateKey) {
  if (typeof window === 'undefined') return;

  const data = getData();
  delete data.plans[dateKey];
  saveData(data);
}

/**
 * Clear all meal plans
 */
export function clearAllMealPlans() {
  if (typeof window === 'undefined') return;

  saveData({ version: CURRENT_VERSION, plans: {} });
}
