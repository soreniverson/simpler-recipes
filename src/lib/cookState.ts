/**
 * Per-recipe cooking state: checked-off ingredients and steps, and the current Cook Mode step.
 * Keyed by a recipe id (curated slug, or the recent-recipe id). Local only.
 *
 * State expires after 24h so yesterday's checkmarks don't greet you next week.
 */
import { readJson, writeJson, remove, emit } from './storage';

export const COOK_STATE_TTL_MS = 24 * 60 * 60 * 1000;
export const COOK_STATE_EVENT = 'sr:cook-state-changed';

export interface CookState {
  /** Indices of checked ingredients (flat index into recipe.ingredients). */
  ingredients: number[];
  /** Indices of completed steps. */
  steps: number[];
  /** Cook Mode current step index. */
  currentStep: number;
  /** Serving count the user scaled to (null = original). */
  servings: number | null;
  updatedAt: number;
}

const key = (id: string) => `sr:cook:${id}`;

export function emptyCookState(): CookState {
  return { ingredients: [], steps: [], currentStep: 0, servings: null, updatedAt: 0 };
}

export function getCookState(id: string): CookState {
  const s = readJson<CookState | null>(key(id), null);
  if (!s || typeof s !== 'object') return emptyCookState();
  if (!s.updatedAt || Date.now() - s.updatedAt > COOK_STATE_TTL_MS) {
    remove(key(id));
    return emptyCookState();
  }
  return {
    ingredients: Array.isArray(s.ingredients) ? s.ingredients.filter((n) => Number.isInteger(n)) : [],
    steps: Array.isArray(s.steps) ? s.steps.filter((n) => Number.isInteger(n)) : [],
    currentStep: Number.isInteger(s.currentStep) ? s.currentStep : 0,
    servings: typeof s.servings === 'number' && s.servings > 0 ? s.servings : null,
    updatedAt: s.updatedAt,
  };
}

export function setCookState(id: string, patch: Partial<CookState>): CookState {
  const next: CookState = { ...getCookState(id), ...patch, updatedAt: Date.now() };
  const isEmpty = !next.ingredients.length && !next.steps.length && next.currentStep === 0 && next.servings == null;
  if (isEmpty) remove(key(id));
  else writeJson(key(id), next);
  emit(COOK_STATE_EVENT, { id });
  return next;
}

export function toggleIngredient(id: string, index: number): CookState {
  const s = getCookState(id);
  const set = new Set(s.ingredients);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  return setCookState(id, { ingredients: [...set].sort((a, b) => a - b) });
}

export function toggleStep(id: string, index: number): CookState {
  const s = getCookState(id);
  const set = new Set(s.steps);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  return setCookState(id, { steps: [...set].sort((a, b) => a - b) });
}

export function resetCookState(id: string): void {
  remove(key(id));
  emit(COOK_STATE_EVENT, { id });
}
