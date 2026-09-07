import { useMemo, useState, useEffect, useCallback } from 'react';
import { isMetric } from '../../utils/settings';
import { preparedIngredientLines } from '../../lib/recipe/prepared';
import { ingredientGroups, servingsCount, ingredientsAsText } from '../../lib/recipe/display';
import { CheckIcon, CopyIcon, MinusIcon, PlusIcon, RotateIcon } from './Icons';

/**
 * Ingredients panel.
 *  - grouped ("For the sauce") when the recipe has sections
 *  - tap anywhere on a row to check it off (persists via cookState for 24h)
 *  - servings stepper ONLY when the recipe declares a real yield (never a made-up "4")
 *  - metric/US toggle honoured (global setting)
 */
export default function Ingredients({
  recipe,
  checked,          // Set<number>
  onToggle,         // (index) => void
  onReset,          // () => void
  servings,         // number | null (user-chosen)
  onServingsChange, // (n|null) => void
  compact = false,  // Cook Mode sheet variant
}) {
  const baseServings = servingsCount(recipe);
  const current = servings ?? baseServings;
  const isScaled = baseServings != null && current != null && current !== baseServings;

  const [useMetric, setUseMetric] = useState(false);
  useEffect(() => {
    setUseMetric(isMetric());
    const onChange = () => setUseMetric(isMetric());
    window.addEventListener('settings-changed', onChange);
    return () => window.removeEventListener('settings-changed', onChange);
  }, []);

  const lines = useMemo(() => preparedIngredientLines(recipe, current, useMetric), [recipe, current, useMetric]);

  const groups = ingredientGroups(recipe);
  const total = recipe.ingredients.length;
  const doneCount = checked.size;

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ingredientsAsText(recipe, lines));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }, [recipe, lines]);

  let flat = 0;

  return (
    // Card at every width — the ingredients and instructions panels share the site's
    // one card treatment (see CleanBoxCard, browse cards).
    <div data-ingredients className={compact ? '' : 'rounded-2xl border border-sand-200 bg-surface p-5'}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="ingredients-heading" className="font-mono text-[12px] uppercase tracking-[0.08em] text-sand-500">
          Ingredients
          {doneCount > 0 && (
            <span className="tabular font-normal normal-case tracking-normal"> {doneCount}/{total}</span>
          )}
        </h2>
        {doneCount > 0 && (
          <button type="button" onClick={onReset} className="text-[13px] text-sand-500 hover:text-sand-800 underline underline-offset-2 no-print">
            Clear checks
          </button>
        )}
      </div>

      {baseServings != null && (
        <div className="flex items-center gap-3 mb-3 no-print">
          <div className="inline-flex items-center rounded-lg border border-sand-300 bg-sand-50" role="group" aria-label="Servings">
            <button
              type="button"
              onClick={() => onServingsChange(Math.max(1, (current ?? baseServings) - 1))}
              disabled={(current ?? baseServings) <= 1}
              className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-l-lg text-sand-700 hover:bg-sand-100 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Fewer servings"
            >
              <MinusIcon className="w-4 h-4" />
            </button>
            <output className="min-w-[2.5rem] text-center text-[15px] font-medium tabular text-sand-900" aria-live="polite" aria-label="Servings">
              {formatCount(current)}
            </output>
            <button
              type="button"
              onClick={() => onServingsChange(Math.min(99, Math.ceil((current ?? baseServings) + 1)))}
              disabled={(current ?? baseServings) >= 99}
              className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-r-lg text-sand-700 hover:bg-sand-100 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="More servings"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[14px] text-sand-600">servings</span>
          {isScaled && (
            <button type="button" onClick={() => onServingsChange(null)} className="inline-flex items-center gap-1 text-[13px] text-sand-600 hover:text-sand-900 underline underline-offset-2">
              <RotateIcon className="w-3.5 h-3.5" /> Reset to {formatCount(baseServings)}
            </button>
          )}
        </div>
      )}
      {isScaled && (
        <p className="hidden print:block text-[12px] text-sand-600 mb-2">Scaled to {formatCount(current)} servings (original {formatCount(baseServings)}).</p>
      )}

      <div className={groups.length > 1 ? 'space-y-4' : ''}>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.name && <h3 className="text-[14px] font-medium text-sand-800 mt-1 mb-1">{g.name}</h3>}
            <ul className="divide-y divide-sand-200/45">
              {g.items.map(() => {
                const index = flat++;
                const done = checked.has(index);
                const text = lines[index] ?? recipe.ingredients[index];
                return (
                  <li key={index}>
                    <label className={`group flex items-start gap-3 py-2 cursor-pointer select-none -mx-2 px-2 rounded-lg hover:bg-sand-100/60 ${compact ? 'py-3' : ''}`}>
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={done}
                        onChange={() => onToggle(index)}
                        aria-label={text}
                      />
                      {/* Quiet affordance: the ingredient is the object, the checkbox supports it. */}
                      <span
                        aria-hidden="true"
                        className={`mt-[5px] shrink-0 w-[16px] h-[16px] rounded-[4px] border flex items-center justify-center transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sand-700 ${
                          done ? 'bg-sand-600 border-sand-600 text-sand-50' : 'border-sand-400 group-hover:border-sand-600'
                        }`}
                      >
                        {done && <CheckIcon className="w-3 h-3" />}
                      </span>
                      <span className={`text-[17px] leading-[1.55] lg:text-[16px] lg:leading-[1.6] ${done ? 'text-sand-500 line-through decoration-sand-400' : 'text-sand-900'} ${compact ? 'text-[18px]' : ''}`}>
                        {text}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="mt-3 pt-3 border-t border-sand-200 flex items-center justify-between no-print">
          <button type="button" onClick={handleCopy} className="btn-ghost btn-sm -ml-3" aria-live="polite">
            <CopyIcon className="w-4 h-4" />
            {copied ? 'Copied' : 'Copy list'}
          </button>
          {useMetric && <span className="text-[12px] text-sand-500">Metric</span>}
        </div>
      )}
    </div>
  );
}

function formatCount(n) {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
