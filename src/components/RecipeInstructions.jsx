import { useState } from 'react';
import CookMode from './CookMode';

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
    </svg>
  );
}

export default function RecipeInstructions({ instructions, recipeName }) {
  const [showCookMode, setShowCookMode] = useState(false);

  return (
    <>
      <section aria-labelledby="instructions-heading">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="instructions-heading"
            className="text-sm font-medium text-sand-900 uppercase tracking-wide"
          >
            Instructions
          </h2>
          <button
            onClick={() => setShowCookMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-sand-600 hover:text-sand-800 hover:bg-sand-100 rounded-lg transition-colors print:hidden"
          >
            <PlayIcon />
            Cook Mode
          </button>
        </div>
        <ol className="space-y-4">
          {instructions.map((instruction, index) => (
            <li
              key={index}
              className="flex gap-3 text-sand-700 text-sm leading-relaxed"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sand-200 text-sand-500 text-[10px] flex items-center justify-center font-medium">
                {index + 1}
              </span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>
      </section>

      {showCookMode && (
        <CookMode
          instructions={instructions}
          recipeName={recipeName}
          onClose={() => setShowCookMode(false)}
        />
      )}
    </>
  );
}
