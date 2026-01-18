import { useState, useEffect, useMemo, useCallback } from 'react';
import { createSearchIndex, searchRecipes, getPrimaryMatch } from '../utils/searchIndex';

function SearchIcon() {
  return (
    <svg
      className="w-5 h-5 text-sand-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
      />
    </svg>
  );
}

function MatchBadge({ field }) {
  const labels = {
    title: 'Title',
    tags: 'Tag',
    ingredients: 'Ingredient',
  };

  const colors = {
    title: 'bg-amber-100 text-amber-700',
    tags: 'bg-emerald-100 text-emerald-700',
    ingredients: 'bg-sky-100 text-sky-700',
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[field] || 'bg-sand-100 text-sand-600'}`}
    >
      {labels[field] || field}
    </span>
  );
}

function SearchResult({ result }) {
  const { recipe, matches } = result;
  const primaryMatch = getPrimaryMatch(matches);

  return (
    <a
      href={`/recipes/${recipe.slug}`}
      className="flex items-start gap-4 p-4 rounded-xl hover:bg-sand-100/80 transition-colors group"
    >
      {recipe.image ? (
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-sand-200">
          <img
            src={recipe.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-sand-200 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-sand-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sand-900 font-medium text-sm group-hover:text-sand-950 transition-colors truncate">
            {recipe.title}
          </h3>
          {primaryMatch && primaryMatch !== 'title' && (
            <MatchBadge field={primaryMatch} />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-sand-500">
          {recipe.totalTime && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon />
              {recipe.totalTime}
            </span>
          )}
          {recipe.servings && <span>{recipe.servings} servings</span>}
        </div>
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-[10px] text-sand-500 bg-sand-100 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

function NoResults({ query }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="text-sand-400 text-4xl mb-4">:/</p>
      <p className="text-sand-600 text-sm">
        No recipes found for "<span className="font-medium text-sand-700">{query}</span>"
      </p>
    </div>
  );
}

export default function RecipeSearch({ recipes }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Create Fuse index once when recipes load
  const fuse = useMemo(() => {
    if (!recipes || recipes.length === 0) return null;
    return createSearchIndex(recipes);
  }, [recipes]);

  // Debounced search
  useEffect(() => {
    if (!fuse) return;

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = setTimeout(() => {
      const searchResults = searchRecipes(fuse, trimmedQuery);
      setResults(searchResults);
      setIsSearching(false);
      setHasSearched(true);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [query, fuse]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, []);

  const showResults = hasSearched && query.trim().length >= 2;
  const showNoResults = showResults && results.length === 0 && !isSearching;

  return (
    <div className="w-full">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes by name, ingredient, or tag..."
          className="w-full pl-11 pr-10 py-3 bg-white border border-sand-200 rounded-xl text-sand-900 text-sm placeholder:text-sand-400 focus:outline-none focus:ring-2 focus:ring-sand-300 focus:border-transparent transition-shadow"
          aria-label="Search recipes"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-sand-400 hover:text-sand-600 transition-colors"
            aria-label="Clear search"
          >
            <ClearIcon />
          </button>
        )}
      </div>

      {/* Results */}
      {showResults && (
        <div className="mt-4">
          {isSearching ? (
            <div className="text-center py-8">
              <div className="inline-block w-5 h-5 border-2 border-sand-300 border-t-sand-600 rounded-full animate-spin"></div>
            </div>
          ) : showNoResults ? (
            <NoResults query={query.trim()} />
          ) : (
            <div className="bg-sand-50 rounded-xl divide-y divide-sand-100">
              <div className="px-4 py-2 text-xs text-sand-500">
                {results.length} {results.length === 1 ? 'recipe' : 'recipes'} found
              </div>
              {results.map((result) => (
                <SearchResult key={result.recipe.slug} result={result} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
