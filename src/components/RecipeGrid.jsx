import { useState, useEffect, useMemo } from 'react';
import RecipeCard from './RecipeCard';
import { getPantryItems } from '../utils/pantry';
import { sortRecipesByMatch } from '../utils/ingredientMatcher';

/**
 * Grid of recipe cards. Every card is in the server HTML (crawlable links), but only the first
 * `pageSize` are visible; the rest are `hidden` until "Show more". Hidden cards' lazy images are
 * never fetched, so long browse pages (100+ recipes) don't load 100+ images up front.
 * When the pantry has items, the whole list is re-sorted by match before paging.
 */
export default function RecipeGrid({ recipes, showFavorite = true, pageSize = 24 }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [limit, setLimit] = useState(pageSize);

  // Load pantry items and listen for changes
  useEffect(() => {
    const updatePantry = () => {
      const items = getPantryItems();
      setPantryItems(items.map(i => i.name));
      setIsLoaded(true);
    };

    updatePantry();
    window.addEventListener('pantry-changed', updatePantry);
    return () => window.removeEventListener('pantry-changed', updatePantry);
  }, []);

  // Sort recipes by match percentage when pantry has items
  const sortedRecipes = useMemo(() => {
    if (pantryItems.length === 0) {
      return recipes.map(recipe => ({
        ...recipe,
        matchInfo: null
      }));
    }
    return sortRecipesByMatch(recipes, pantryItems);
  }, [recipes, pantryItems]);

  // Show original order briefly before sorting kicks in
  const displayRecipes = isLoaded ? sortedRecipes : recipes.map(r => ({ ...r, matchInfo: null }));
  const remaining = Math.max(0, displayRecipes.length - limit);

  return (
    <>
      <ul className="grid gap-x-5 gap-y-8 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
        {displayRecipes.map((recipe, i) => (
          <li key={recipe.slug} hidden={i >= limit}>
            <RecipeCard
              recipe={recipe}
              showFavorite={showFavorite}
              matchInfo={recipe.matchInfo}
              eager={i < 4}
            />
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            className="btn-secondary"
            onClick={(e) => {
              const first = limit;
              setLimit((l) => l + pageSize);
              // Keep keyboard users in place: focus the first newly revealed card.
              const list = e.currentTarget.parentElement?.previousElementSibling;
              requestAnimationFrame(() => list?.children?.[first]?.querySelector('a')?.focus());
            }}
          >
            Show {Math.min(pageSize, remaining)} more
            <span className="text-sand-500 font-normal"> · {remaining} left</span>
          </button>
        </div>
      )}
    </>
  );
}
