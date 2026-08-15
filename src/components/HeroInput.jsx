import { useEffect } from 'react';
import SmartInput from './SmartInput';
import RecentRecipes from './RecentRecipes';

/**
 * Homepage hero island: the paste box, three working examples, and the local "Recent" list.
 * Examples are from publishers that reliably serve our fetcher (Allrecipes blocks datacenter
 * IPs, so it must never be the demo).
 */
const EXAMPLES = [
  { name: 'Chicken Tikka Masala', url: 'https://www.recipetineats.com/chicken-tikka-masala/' },
  { name: 'Banana Bread', url: 'https://www.simplyrecipes.com/recipes/banana_bread/' },
  { name: 'Victoria Sponge', url: 'https://www.bbcgoodfood.com/recipes/classic-victoria-sandwich-recipe' },
];

export default function HeroInput() {
  // Web Share Target (installed app) and plain deep links: /?u=<url> runs immediately.
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('u');
    if (!u) return;
    const m = u.match(/https?:\/\/\S+/);
    if (!m) return;
    history.replaceState(null, '', '/');
    setTimeout(() => document.getElementById('hero-input')?.dispatchEvent(new CustomEvent('sr:extract', { detail: { url: m[0] } })), 50);
  }, []);
  return (
    <div>
      <SmartInput variant="default" placeholder="Paste a recipe link, or search" autoFocus id="hero-input" />
      <p className="mt-3 text-[14px] text-sand-600 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>Try:</span>
        {EXAMPLES.map((e, i) => (
          <span key={e.url} className="inline-flex items-center gap-x-2">
            {i > 0 && <span className="text-sand-400" aria-hidden="true">·</span>}
            <button
              type="button"
              className="text-sand-800 underline underline-offset-[3px] decoration-sand-400 hover:decoration-sand-800 py-1"
              onClick={() => {
                const input = document.getElementById('hero-input');
                if (!input) return;
                // Ask the real input to run this URL, exactly like a paste would.
                input.dispatchEvent(new CustomEvent('sr:extract', { detail: { url: e.url } }));
              }}
            >
              {e.name}
            </button>
          </span>
        ))}
      </p>
      <p className="mt-4 text-[13px] text-sand-500">Works with most recipe sites. Nothing is stored unless you save it. No account needed.</p>
      <RecentRecipes limit={5} />
    </div>
  );
}
