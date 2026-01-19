import { useState, useEffect, useMemo } from 'react';
import RecipeCard from './RecipeCard';
import { getPantryItems } from '../utils/pantry';
import { sortRecipesByMatch } from '../utils/ingredientMatcher';

export default function RecipeGrid({ recipes, showFavorite = true }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

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

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {displayRecipes.map(recipe => (
        <li key={recipe.slug}>
          <RecipeCard
            recipe={recipe}
            showFavorite={showFavorite}
            matchInfo={recipe.matchInfo}
          />
        </li>
      ))}
    </ul>
  );
}
