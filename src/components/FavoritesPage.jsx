import { useState, useEffect } from 'react';
import RecipeCard from './RecipeCard';
import { getFavorites } from '../utils/favorites';

function HeartIcon({ className = "w-12 h-12" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

export default function FavoritesPage({ recipes }) {
  const [favoriteRecipes, setFavoriteRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateFavorites = () => {
      const favoriteSlugs = getFavorites();
      const filtered = recipes.filter(recipe => favoriteSlugs.includes(recipe.slug));
      setFavoriteRecipes(filtered);
      setIsLoading(false);
    };

    updateFavorites();

    // Listen for changes
    window.addEventListener('favorites-changed', updateFavorites);
    return () => window.removeEventListener('favorites-changed', updateFavorites);
  }, [recipes]);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-sand-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-xl md:text-2xl font-medium tracking-tight text-sand-900 mb-2">
          Your Favorites
        </h1>
        <p className="text-sand-600 text-sm">
          {favoriteRecipes.length === 0
            ? 'Save recipes by clicking the heart icon'
            : `${favoriteRecipes.length} saved recipe${favoriteRecipes.length === 1 ? '' : 's'}`
          }
        </p>
      </header>

      {favoriteRecipes.length === 0 ? (
        <div className="bg-sand-50 rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-sand-100 flex items-center justify-center text-sand-400">
              <HeartIcon />
            </div>
          </div>
          <h2 className="text-lg font-medium text-sand-900 mb-2">
            No favorites yet
          </h2>
          <p className="text-sand-600 text-sm mb-6 max-w-sm mx-auto">
            Browse our recipe collections and tap the heart icon on any recipe to save it here.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-colors text-sm"
          >
            Browse Recipes
          </a>
        </div>
      ) : (
        <section aria-label="Favorite recipes">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteRecipes.map(recipe => (
              <li key={recipe.slug}>
                <RecipeCard recipe={recipe} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
