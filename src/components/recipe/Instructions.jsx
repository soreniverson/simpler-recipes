import { instructionGroups } from '../../lib/recipe/display';
import { PlayIcon, CheckIcon } from './Icons';

/**
 * Instructions: plain numerals (no circles), 17px reading size, ~64ch measure, grouped sections,
 * tap a step to mark it done (persists 24h). Cook Mode is the primary action here.
 */
export default function Instructions({ recipe, done, onToggle, onCookMode }) {
  const groups = instructionGroups(recipe);
  const total = recipe.instructions.length;
  let flat = 0;

  return (
    <section aria-labelledby="instructions-heading">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="instructions-heading" className="text-[13px] font-medium uppercase tracking-[0.06em] text-sand-500">
          Instructions <span className="tabular text-sand-500 font-normal normal-case tracking-normal">{done.size > 0 ? `${done.size}/${total}` : total}</span>
        </h2>
        {total > 0 && (
          <button type="button" onClick={onCookMode} className="btn-primary btn-sm no-print lg:hidden">
            <PlayIcon className="w-4 h-4" />
            Cook Mode
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className="text-[15px] text-sand-600">This page didn't include step-by-step instructions. Check the original for the method.</p>
      ) : (
        <div className={groups.length > 1 ? 'space-y-7' : ''}>
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.name && <h3 className="text-[15px] font-medium text-sand-800 mb-3">{g.name}</h3>}
              <ol className="space-y-5">
                {g.items.map((step) => {
                  const index = flat++;
                  const isDone = done.has(index);
                  return (
                    <li key={index} className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => onToggle(index)}
                        aria-pressed={isDone}
                        aria-label={`Step ${index + 1}${isDone ? ', done' : ''}`}
                        className={`shrink-0 mt-[1px] w-7 h-7 -ml-1 rounded-full flex items-center justify-center text-[15px] font-medium tabular transition-colors no-print-bg ${
                          isDone ? 'bg-sand-800 text-sand-50' : 'text-sand-900 hover:bg-sand-100'
                        }`}
                      >
                        {isDone ? <CheckIcon className="w-4 h-4" /> : index + 1}
                      </button>
                      <p className={`max-w-[64ch] text-[17px] leading-[1.55] ${isDone ? 'text-sand-500' : 'text-sand-800'}`}>{step}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
