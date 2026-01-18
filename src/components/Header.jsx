import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createSearchIndex, searchRecipes, getPrimaryMatch } from '../utils/searchIndex';

function SearchIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
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

function SearchResult({ result, onClick }) {
  const { recipe, matches } = result;
  const primaryMatch = getPrimaryMatch(matches);

  return (
    <a
      href={`/recipes/${recipe.slug}`}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-sand-100 transition-colors"
    >
      {recipe.image ? (
        <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-sand-200">
          <img
            src={recipe.image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sand-200 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-sand-400"
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
        <div className="flex items-center gap-2">
          <span className="text-sand-900 text-sm font-medium truncate">
            {recipe.title}
          </span>
          {primaryMatch && primaryMatch !== 'title' && (
            <MatchBadge field={primaryMatch} />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-sand-500">
          {recipe.totalTime && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon />
              {recipe.totalTime}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

function SearchDropdown({ results, query, isSearching, onResultClick }) {
  if (query.trim().length < 2) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-sand-200 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
      {isSearching ? (
        <div className="text-center py-8">
          <div className="inline-block w-5 h-5 border-2 border-sand-300 border-t-sand-600 rounded-full animate-spin"></div>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-8 px-4">
          <p className="text-sand-500 text-sm">
            No recipes found for "{query}"
          </p>
        </div>
      ) : (
        <div>
          <div className="px-4 py-2 text-xs text-sand-500 border-b border-sand-100">
            {results.length} {results.length === 1 ? 'recipe' : 'recipes'} found
          </div>
          <div className="divide-y divide-sand-100">
            {results.slice(0, 8).map((result) => (
              <SearchResult
                key={result.recipe.slug}
                result={result}
                onClick={onResultClick}
              />
            ))}
          </div>
          {results.length > 8 && (
            <div className="px-4 py-2 text-xs text-sand-400 border-t border-sand-100 text-center">
              +{results.length - 8} more results
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header({ recipes = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Create Fuse index
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
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    const timeoutId = setTimeout(() => {
      const searchResults = searchRecipes(fuse, trimmedQuery);
      setResults(searchResults);
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [query, fuse]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsMobileSearchOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsMobileSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsMobileSearchOpen(false);
        inputRef.current?.blur();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }, []);

  const handleResultClick = useCallback(() => {
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    setQuery('');
  }, []);

  const handleMobileSearchToggle = useCallback(() => {
    setIsMobileSearchOpen(prev => !prev);
    if (!isMobileSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isMobileSearchOpen]);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-sand-200">
      <div className="max-w-[1080px] mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Logo */}
          <a
            href="/"
            className="flex-shrink-0 text-sand-900 font-medium text-base hover:text-sand-700 transition-colors"
          >
            Simpler Recipes
          </a>

          {/* Desktop Search */}
          <div
            ref={searchRef}
            className="hidden sm:block relative flex-1 max-w-md"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="w-4 h-4 text-sand-400" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
                placeholder="Search recipes..."
                className="w-full pl-9 pr-8 py-2 bg-sand-100 border-0 rounded-lg text-sand-900 text-sm placeholder:text-sand-400 focus:outline-none focus:ring-2 focus:ring-sand-300 transition-shadow"
                aria-label="Search recipes"
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sand-400 hover:text-sand-600 transition-colors"
                  aria-label="Clear search"
                >
                  <ClearIcon />
                </button>
              )}
              <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
                <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-sand-400 bg-sand-200/50 rounded">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>

            {/* Search Results Dropdown */}
            {isOpen && (
              <SearchDropdown
                results={results}
                query={query}
                isSearching={isSearching}
                onResultClick={handleResultClick}
              />
            )}
          </div>

          {/* Right side - future home of favorites, meal plan */}
          <div className="flex items-center gap-2">
            {/* Mobile search toggle */}
            <button
              onClick={handleMobileSearchToggle}
              className="sm:hidden p-2 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label="Search"
            >
              <SearchIcon className="w-5 h-5" />
            </button>

            {/* Placeholder for future icons */}
            {/* <button className="p-2 text-sand-400 hover:text-sand-600 rounded-lg transition-colors" aria-label="Favorites">
              <HeartIcon />
            </button> */}
          </div>
        </div>

        {/* Mobile Search (expanded) */}
        {isMobileSearchOpen && (
          <div ref={searchRef} className="sm:hidden pb-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="w-4 h-4 text-sand-400" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
                placeholder="Search recipes..."
                className="w-full pl-9 pr-8 py-2.5 bg-sand-100 border-0 rounded-lg text-sand-900 text-sm placeholder:text-sand-400 focus:outline-none focus:ring-2 focus:ring-sand-300 transition-shadow"
                aria-label="Search recipes"
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sand-400 hover:text-sand-600 transition-colors"
                  aria-label="Clear search"
                >
                  <ClearIcon />
                </button>
              )}
            </div>

            {/* Mobile Search Results */}
            {isOpen && (
              <SearchDropdown
                results={results}
                query={query}
                isSearching={isSearching}
                onResultClick={handleResultClick}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}
