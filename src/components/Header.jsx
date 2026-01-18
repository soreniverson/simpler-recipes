import { useState, useCallback, useRef, useEffect } from 'react';
import SmartInput from './SmartInput';
import { getFavoritesCount } from '../utils/favorites';

function SearchIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function HeartIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

export default function Header({ recipes = [] }) {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const mobileSearchRef = useRef(null);

  // Get initial favorites count and listen for changes
  useEffect(() => {
    setFavoritesCount(getFavoritesCount());

    const handleChange = () => {
      setFavoritesCount(getFavoritesCount());
    };

    window.addEventListener('favorites-changed', handleChange);
    return () => window.removeEventListener('favorites-changed', handleChange);
  }, []);

  // Close mobile search when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(event.target)) {
        setIsMobileSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMobileSearchToggle = useCallback(() => {
    setIsMobileSearchOpen(prev => !prev);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-sand-200">
      <div className="max-w-[1080px] mx-auto px-4">
        <div className="flex items-center h-14 gap-4">
          {/* Logo */}
          <a
            href="/"
            className="flex-shrink-0 flex items-center text-sand-900 font-medium text-base hover:text-sand-700 transition-colors"
          >
            Simpler Recipes
          </a>

          {/* Desktop Search - using SmartInput */}
          <div className="hidden sm:flex flex-1 justify-center items-center">
            <SmartInput
              recipes={recipes}
              variant="header"
              placeholder="Paste a URL or search recipes..."
              showKeyboardHint={true}
            />
          </div>

          {/* Right side - favorites icon */}
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0 w-[120px] justify-end">
            <a
              href="/favorites"
              className="relative p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label={`Favorites${favoritesCount > 0 ? ` (${favoritesCount})` : ''}`}
            >
              <HeartIcon className="w-5 h-5" />
              {favoritesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-sand-600 text-white text-[10px] font-medium rounded-full px-1">
                  {favoritesCount > 99 ? '99+' : favoritesCount}
                </span>
              )}
            </a>
          </div>

          {/* Mobile icons */}
          <div className="flex sm:hidden items-center gap-1 ml-auto">
            <button
              onClick={handleMobileSearchToggle}
              className="p-2 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label="Search"
            >
              <SearchIcon className="w-5 h-5" />
            </button>
            <a
              href="/favorites"
              className="relative p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label={`Favorites${favoritesCount > 0 ? ` (${favoritesCount})` : ''}`}
            >
              <HeartIcon className="w-5 h-5" />
              {favoritesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-sand-600 text-white text-[10px] font-medium rounded-full px-1">
                  {favoritesCount > 99 ? '99+' : favoritesCount}
                </span>
              )}
            </a>
          </div>
        </div>

        {/* Mobile Search (expanded) */}
        {isMobileSearchOpen && (
          <div ref={mobileSearchRef} className="sm:hidden pb-3">
            <SmartInput
              recipes={recipes}
              variant="header"
              placeholder="Paste a URL or search..."
              autoFocus={true}
            />
          </div>
        )}
      </div>
    </header>
  );
}
