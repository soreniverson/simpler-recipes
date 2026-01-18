import { useState, useCallback, useRef, useEffect } from 'react';
import SmartInput from './SmartInput';

function SearchIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

export default function Header({ recipes = [] }) {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef(null);

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

          {/* Right side spacer for balance + future icons */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 w-[120px] justify-end">
            {/* Placeholder for future favorites, meal plan icons */}
          </div>

          {/* Mobile search toggle */}
          <div className="flex sm:hidden items-center gap-2 ml-auto">
            <button
              onClick={handleMobileSearchToggle}
              className="p-2 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label="Search"
            >
              <SearchIcon className="w-5 h-5" />
            </button>
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
