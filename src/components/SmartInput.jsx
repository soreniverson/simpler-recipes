import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createSearchIndex, searchRecipes, getPrimaryMatch } from '../utils/searchIndex';

/**
 * Detect if input looks like a URL
 */
function looksLikeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return false;

  // Starts with http:// or https://
  if (/^https?:\/\//i.test(trimmed)) return true;

  // Starts with www.
  if (/^www\./i.test(trimmed)) return true;

  // Contains a domain-like pattern (word.word)
  if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed)) return true;

  return false;
}

function SearchIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function LinkIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

function MatchBadge({ field }) {
  const labels = { title: 'Title', tags: 'Tag', ingredients: 'Ingredient' };
  const colors = {
    title: 'bg-amber-100 text-amber-700',
    tags: 'bg-emerald-100 text-emerald-700',
    ingredients: 'bg-sky-100 text-sky-700',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[field] || 'bg-sand-100 text-sand-600'}`}>
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
      className="flex items-center gap-3 px-4 py-3 hover:bg-sand-100 transition-colors min-h-[44px]"
      role="option"
    >
      {recipe.image ? (
        <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-sand-200">
          <img src={recipe.image} alt="" width={40} height={40} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
      ) : (
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sand-200 flex items-center justify-center">
          <svg className="w-4 h-4 text-sand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sand-900 text-sm font-medium truncate">{recipe.title}</span>
          {primaryMatch && primaryMatch !== 'title' && <MatchBadge field={primaryMatch} />}
        </div>
        {recipe.totalTime && (
          <div className="flex items-center gap-1 text-xs text-sand-500">
            <ClockIcon />
            {recipe.totalTime}
          </div>
        )}
      </div>
    </a>
  );
}

function SearchDropdown({ results, query, isSearching, onResultClick, isUrl }) {
  if (isUrl) {
    return (
      <div
        className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-xl shadow-lg border border-sand-400 overflow-hidden z-50 p-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 text-sand-600">
          <LinkIcon className="w-5 h-5 text-sand-400" aria-hidden="true" />
          <span className="text-sm">Press Enter to extract recipe from this URL</span>
        </div>
      </div>
    );
  }

  if (query.trim().length < 2) return null;

  return (
    <div
      className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-xl shadow-lg border border-sand-400 overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
      role="listbox"
      aria-label="Search results"
    >
      {isSearching ? (
        <div className="text-center py-8" role="status" aria-live="polite">
          <div className="inline-block w-5 h-5 border-2 border-sand-300 border-t-sand-600 rounded-full animate-spin" aria-hidden="true"></div>
          <span className="sr-only">Searching...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-8 px-4" role="status" aria-live="polite">
          <p className="text-sand-500 text-sm">No recipes found for "{query}"</p>
        </div>
      ) : (
        <div>
          <div className="px-4 py-2 text-xs text-sand-500 border-b border-sand-100" role="status" aria-live="polite">
            {results.length} {results.length === 1 ? 'recipe' : 'recipes'} found
          </div>
          <div className="divide-y divide-sand-100">
            {results.slice(0, 8).map((result) => (
              <SearchResult key={result.recipe.slug} result={result} onClick={onResultClick} />
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

// Cached search data and Fuse instance (shared across all SmartInput instances)
let cachedSearchData = null;
let cachedFuseInstance = null;
let searchDataPromise = null;

async function loadSearchData() {
  // Return cached data if available
  if (cachedSearchData) {
    return cachedSearchData;
  }

  // Return pending promise if already loading
  if (searchDataPromise) {
    return searchDataPromise;
  }

  // Load search data on-demand
  searchDataPromise = fetch('/search-index.json')
    .then((res) => res.json())
    .then((data) => {
      cachedSearchData = data;
      cachedFuseInstance = createSearchIndex(data);
      return data;
    })
    .catch((err) => {
      console.error('Failed to load search index:', err);
      searchDataPromise = null;
      return null;
    });

  return searchDataPromise;
}

export default function SmartInput({
  variant = 'default', // 'default' | 'header'
  placeholder = 'Paste a URL or search recipes...',
  showKeyboardHint = false,
  onUrlSubmit,
  autoFocus = false,
}) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(!!cachedSearchData);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const isUrl = looksLikeUrl(value);

  // Load search data when input is focused or user starts typing
  const ensureSearchData = useCallback(async () => {
    if (!isDataLoaded) {
      await loadSearchData();
      setIsDataLoaded(true);
    }
  }, [isDataLoaded]);

  // Debounced search (only when not a URL)
  useEffect(() => {
    if (isUrl) {
      setResults([]);
      return;
    }

    const trimmedQuery = value.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    const timeoutId = setTimeout(async () => {
      // Ensure search data is loaded
      await ensureSearchData();

      if (cachedFuseInstance) {
        const searchResults = searchRecipes(cachedFuseInstance, trimmedQuery);
        setResults(searchResults);
      }
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [value, isUrl, ensureSearchData]);

  // Show URL hint when URL detected
  useEffect(() => {
    if (isUrl && value.trim().length > 5) {
      setIsOpen(true);
    }
  }, [isUrl, value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        // Preload search data when user uses keyboard shortcut
        ensureSearchData();
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ensureSearchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isUrl) return;

    setIsExtracting(true);
    setError(null);
    setIsOpen(false);

    try {
      let urlToFetch = value.trim();
      if (!/^https?:\/\//i.test(urlToFetch)) {
        urlToFetch = 'https://' + urlToFetch;
      }

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract recipe');
      }

      sessionStorage.setItem('extractedRecipe', JSON.stringify({
        recipe: data,
        sourceUrl: urlToFetch,
      }));

      if (onUrlSubmit) {
        onUrlSubmit(data, urlToFetch);
      } else {
        window.location.href = '/recipe';
      }
    } catch (err) {
      setError(err.message);
      setIsExtracting(false);
    }
  };

  const handleClear = useCallback(() => {
    setValue('');
    setResults([]);
    setIsOpen(false);
    setError(null);
  }, []);

  const handleResultClick = useCallback(() => {
    setIsOpen(false);
    setValue('');
  }, []);

  // Loading state
  if (isExtracting) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center px-4 z-50">
        <div className="text-center" role="status" aria-live="polite">
          <div className="inline-block w-8 h-8 border-2 border-sand-300 border-t-sand-700 rounded-full animate-spin mb-4"></div>
          <p className="text-sand-600 text-base">Extracting recipe...</p>
        </div>
      </div>
    );
  }

  const isHeader = variant === 'header';

  return (
    <div ref={containerRef} className={`relative ${isHeader ? 'flex-1 max-w-md' : 'w-full'}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {isUrl ? (
              <LinkIcon className={`${isHeader ? 'w-4 h-4' : 'w-5 h-5'} text-sand-400`} />
            ) : (
              <SearchIcon className={`${isHeader ? 'w-4 h-4' : 'w-5 h-5'} text-sand-400`} />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => {
              ensureSearchData(); // Preload search data on focus
              if (value.trim().length >= 2 || isUrl) setIsOpen(true);
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={`
              w-full transition-all
              ${isHeader
                ? 'pl-10 pr-16 py-2 bg-surface border border-sand-400 rounded-lg text-sand-900 text-sm placeholder:text-sand-500 focus:outline-none focus:ring-2 focus:ring-sand-500 focus:border-sand-500'
                : 'pl-12 pr-10 py-4 bg-surface border border-sand-400 rounded-xl text-sand-900 text-base placeholder:text-sand-500 focus:outline-none focus:ring-2 focus:ring-sand-500 focus:border-sand-500'
              }
            `}
            aria-label="Paste a URL or search recipes"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className={`absolute inset-y-0 flex items-center justify-center text-sand-400 hover:text-sand-600 transition-colors w-11 ${isHeader ? 'right-6' : 'right-1'}`}
              aria-label="Clear search"
            >
              <ClearIcon />
            </button>
          )}
          {isHeader && showKeyboardHint && !value && (
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-sand-400 bg-sand-100 rounded border border-sand-200">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          )}
        </div>
      </form>

      {error && (
        <p className="mt-2 text-red-600 text-sm" role="alert">{error}</p>
      )}

      {isOpen && (
        <SearchDropdown
          results={results}
          query={value}
          isSearching={isSearching}
          onResultClick={handleResultClick}
          isUrl={isUrl}
        />
      )}
    </div>
  );
}
