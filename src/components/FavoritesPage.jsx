import { useState, useEffect, useCallback } from 'react';
import RecipeCard from './RecipeCard';
import { getCuratedFavorites, getExtractedFavorites, removeExtractedFavorite } from '../utils/favorites';

function HeartIcon({ className = "w-12 h-12", filled = false }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}

function ImagePlaceholder() {
  return (
    <svg className="w-8 h-8 text-sand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ExtractedRecipeCard({ item, onRemove }) {
  const { id, recipe, sourceUrl } = item;

  const handleClick = () => {
    // Store in sessionStorage and navigate to /recipe
    sessionStorage.setItem('extractedRecipe', JSON.stringify({
      recipe,
      sourceUrl,
      savedId: id
    }));
    window.location.href = '/recipe';
  };

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(id);
  };

  // Calculate total time if available
  const totalTime = recipe.totalTime || (recipe.prepTime && recipe.cookTime ? null : recipe.prepTime || recipe.cookTime);

  return (
    <div className="relative h-full bg-sand-50 rounded-xl overflow-hidden hover:bg-sand-100/80 transition-all group">
      {/* Favorite button */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={handleRemove}
          className="p-1.5 rounded-full transition-all duration-200 text-sand-700 hover:text-sand-800 bg-sand-200 hover:bg-sand-300"
          aria-label="Remove from favorites"
        >
          <HeartIcon filled className="w-4 h-4" />
        </button>
      </div>

      <button onClick={handleClick} className="block h-full w-full text-left">
        <article className="h-full flex flex-col">
          {recipe.image ? (
            <div className="aspect-[4/3] overflow-hidden bg-sand-200">
              <img
                src={recipe.image}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="aspect-[4/3] bg-sand-200 flex items-center justify-center">
              <ImagePlaceholder />
            </div>
          )}
          <div className="p-4 flex-1 flex flex-col">
            <h2 className="text-sand-900 font-medium text-sm group-hover:text-sand-950 transition-colors mb-2 line-clamp-2">
              {recipe.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-auto">
              {totalTime && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-600 text-xs">
                  <ClockIcon />
                  {totalTime}
                </span>
              )}
              {recipe.servings && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-600 text-xs">
                  {recipe.servings} servings
                </span>
              )}
              {sourceUrl && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-100 text-sand-500 text-xs">
                  {new URL(sourceUrl).hostname.replace('www.', '')}
                </span>
              )}
            </div>
          </div>
        </article>
      </button>
    </div>
  );
}

export default function FavoritesPage({ recipes }) {
  const [curatedFavorites, setCuratedFavorites] = useState([]);
  const [extractedFavorites, setExtractedFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const updateFavorites = useCallback(() => {
    const curatedSlugs = getCuratedFavorites();
    const curated = recipes.filter(recipe => curatedSlugs.includes(recipe.slug));
    setCuratedFavorites(curated);

    const extracted = getExtractedFavorites();
    setExtractedFavorites(extracted);

    setIsLoading(false);
  }, [recipes]);

  useEffect(() => {
    updateFavorites();

    window.addEventListener('favorites-changed', updateFavorites);
    return () => window.removeEventListener('favorites-changed', updateFavorites);
  }, [updateFavorites]);

  const handleRemoveExtracted = useCallback((id) => {
    removeExtractedFavorite(id);
  }, []);

  const totalCount = curatedFavorites.length + extractedFavorites.length;

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
        <h1 className="text-lg font-medium text-sand-900 flex items-center gap-2">
          Favorites
          {totalCount > 0 && (
            <span className="text-sand-500 font-normal">({totalCount})</span>
          )}
        </h1>
      </header>

      {totalCount === 0 ? (
        <div className="bg-sand-50 rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-sand-100 flex items-center justify-center text-sand-400">
              <HeartIcon className="w-12 h-12" />
            </div>
          </div>
          <h2 className="text-lg font-medium text-sand-900 mb-2">
            No favorites yet
          </h2>
          <p className="text-sand-600 text-sm mb-6 max-w-sm mx-auto">
            Browse recipes or paste a URL to extract one, then tap the heart icon to save it here.
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
            {extractedFavorites.map(item => (
              <li key={item.id}>
                <ExtractedRecipeCard item={item} onRemove={handleRemoveExtracted} />
              </li>
            ))}
            {curatedFavorites.map(recipe => (
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
