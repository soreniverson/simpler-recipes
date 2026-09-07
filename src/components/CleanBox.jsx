import SmartInput from './SmartInput';

/**
 * Embeddable paste box for landing pages (tool page, browse collections, editorial).
 * Same extraction flow as the homepage hero — SmartInput owns progress, errors and
 * limits — without the homepage-only extras (Recent list, share-target handling).
 */
const DEFAULT_EXAMPLES = [
  { name: 'Chicken Tikka Masala', url: 'https://www.recipetineats.com/chicken-tikka-masala/' },
  { name: 'Banana Bread', url: 'https://www.simplyrecipes.com/recipes/banana_bread/' },
];

export default function CleanBox({ id = 'clean-box', examples = false, autoFocus = false }) {
  const list = examples === true ? DEFAULT_EXAMPLES : examples || [];
  return (
    <div>
      <SmartInput variant="default" placeholder="Paste a recipe link" autoFocus={autoFocus} id={id} bindShortcut={false} />
      {list.length > 0 && (
        <p className="mt-3.5 text-[14px] text-sand-600 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Try:</span>
          {list.map((e) => (
            <button
              key={e.url}
              type="button"
              className="text-sand-800 underline underline-offset-[3px] decoration-sand-300 hover:decoration-sand-800 py-1"
              onClick={() => {
                const input = document.getElementById(id);
                // Ask the real input to run this URL, exactly like a paste would.
                if (input) input.dispatchEvent(new CustomEvent('sr:extract', { detail: { url: e.url } }));
              }}
            >
              {e.name}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
