import { useEffect, useState } from 'react';
import { listRecentRecipes, forgetRecentRecipe, RECENT_EVENT } from '../lib/recentRecipes';
import { hostnameOf } from '../lib/recipe/href';

/**
 * "Recent" — the last few recipes simplified on this device. Local only; nothing is uploaded.
 * Renders nothing until there is something to show (no empty-state marketing).
 */
export default function RecentRecipes({ limit = 5 }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const load = () => setItems(listRecentRecipes(limit));
    load();
    window.addEventListener(RECENT_EVENT, load);
    return () => window.removeEventListener(RECENT_EVENT, load);
  }, [limit]);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-heading" className="mt-10">
      <div className="flex items-baseline justify-between mb-2">
        <h2 id="recent-heading" className="text-[13px] font-medium uppercase tracking-[0.06em] text-sand-500">Recent on this device</h2>
      </div>
      <ul className="divide-y divide-sand-200 border-y border-sand-200">
        {items.map((e) => (
          <li key={e.id} className="flex items-center gap-3">
            <a href={`/recipe?r=${e.id}`} className="flex-1 min-w-0 flex items-center gap-3 py-3 group">
              {e.recipe.image ? (
                <img src={e.recipe.image} alt="" width={44} height={44} loading="lazy" decoding="async" className="w-11 h-11 rounded-lg object-cover bg-sand-100 shrink-0 dark:brightness-90" referrerPolicy="no-referrer" />
              ) : (
                <span className="w-11 h-11 rounded-lg bg-sand-100 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block text-[15px] text-sand-900 truncate group-hover:underline underline-offset-2">{e.recipe.title}</span>
                <span className="block text-[13px] text-sand-500 truncate">{hostnameOf(e.sourceUrl) || 'saved locally'}</span>
              </span>
            </a>
            <button type="button" onClick={() => forgetRecentRecipe(e.id)} className="btn-icon text-sand-400 hover:text-sand-800 shrink-0" aria-label={`Remove ${e.recipe.title} from recent`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
