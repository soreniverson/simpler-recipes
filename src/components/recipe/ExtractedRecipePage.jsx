import { useEffect, useState } from 'react';
import RecipeView from './RecipeView';
import RemixButton from '../RemixButton';
import ErrorBoundary from '../ErrorBoundary';
import { getRecentRecipe, latestRecentRecipe, touchRecentRecipe, listRecentRecipes } from '../../lib/recentRecipes';
import { hostnameOf } from '../../lib/recipe/href';

/**
 * /recipe?r=<id> — renders a recipe extracted on this device (stored locally, never uploaded).
 * Legacy /recipe (no id) → most recent. Missing → gentle empty state with the recent list.
 */
export default function ExtractedRecipePage() {
  const [entry, setEntry] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('r');
    let e = id ? getRecentRecipe(id) : latestRecentRecipe();
    if (e) {
      touchRecentRecipe(e.id);
      // Normalise the URL so refresh/back/forward always resolve to this exact recipe.
      if (!id) history.replaceState(null, '', `/recipe?r=${e.id}`);
      document.title = `${e.recipe.title} · Simpler Recipes`;
    }
    setEntry(e || null);
  }, []);

  if (entry === undefined) {
    return (
      <main id="main-content" className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8" aria-busy="true">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-2/3 bg-sand-200 rounded" />
          <div className="h-4 w-1/3 bg-sand-200 rounded" />
          <div className="h-4 w-1/2 bg-sand-200 rounded" />
        </div>
      </main>
    );
  }

  if (!entry) return <NotFound />;

  const { recipe, sourceUrl, id } = entry;
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <ErrorBoundary fallback={<Broken />}>
        <RecipeView recipe={recipe} recipeId={id} sourceUrl={sourceUrl} variant="extracted" remix={<RemixButton recipe={recipe} variant="link" />} />
      </ErrorBoundary>
    </main>
  );
}

function Broken() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="text-[22px] font-semibold text-sand-900">This saved recipe can’t be shown</h1>
      <p className="mt-2 text-[15px] text-sand-600">The copy on this device looks damaged. Paste the original link again to get a fresh one.</p>
      <a href="/" className="btn-primary mt-6">Simplify a recipe</a>
    </div>
  );
}

function NotFound() {
  const recent = listRecentRecipes(8);
  return (
    <main id="main-content" className="max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="text-[22px] font-semibold text-sand-900">No recipe here</h1>
      <p className="mt-2 text-[15px] text-sand-600">This recipe was extracted on another device or browser, or the link is incomplete. Extracted recipes stay on the device that made them.</p>
      <a href="/" className="btn-primary mt-6">Simplify a recipe</a>
      {recent.length > 0 && (
        <section className="mt-12 text-left" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="text-[13px] font-medium uppercase tracking-[0.06em] text-sand-500 mb-3">Recent on this device</h2>
          <ul className="divide-y divide-sand-200">
            {recent.map((e) => (
              <li key={e.id}>
                <a href={`/recipe?r=${e.id}`} className="flex items-center justify-between gap-4 py-3 hover:text-sand-900">
                  <span className="text-[15px] text-sand-800 truncate">{e.recipe.title}</span>
                  <span className="text-[13px] text-sand-500 shrink-0">{hostnameOf(e.sourceUrl)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
