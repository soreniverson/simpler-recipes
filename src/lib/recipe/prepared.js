import { scaleIngredientLines } from './scale';
import { formatFraction } from '../../utils/formatFraction';
import { isMetric } from '../../utils/settings';
import { convertIngredients } from '../../utils/measurements';
import { servingsCount } from './display';

/**
 * Ingredient lines exactly as the page shows them: scaled to the chosen servings, fractions
 * prettified, converted to metric when that setting is on. Used by the Ingredients list AND by
 * Copy/print so what you copy is what you see.
 */
export function preparedIngredientLines(recipe, servings, metric = isMetric()) {
  const base = servingsCount(recipe);
  const current = servings ?? base;
  let out = recipe.ingredients;
  if (base != null && current != null && current !== base) out = scaleIngredientLines(out, base, current);
  out = out.map(formatFraction);
  if (metric) out = convertIngredients(out, true);
  return out;
}
