import { useState, useCallback, useRef, useEffect } from 'react';
import SmartInput from './SmartInput';
import AuthModal from './AuthModal';
import { getFavoritesCount } from '../utils/favorites';
import { getPantryCount } from '../utils/pantry';
import { isMetric, toggleUnit, getThemePreference, setThemePreference } from '../utils/settings';
import { useAuth } from '../hooks/useAuth';

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

function PantryIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function CalendarIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function SettingsIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function UserIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export default function Header() {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [pantryCount, setPantryCount] = useState(0);
  const [useMetric, setUseMetric] = useState(false);
  const [themePreference, setThemePref] = useState('system');
  const mobileSearchRef = useRef(null);
  const settingsRef = useRef(null);
  const mobileSettingsRef = useRef(null);

  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();

  // Get initial favorites count and listen for changes
  useEffect(() => {
    setFavoritesCount(getFavoritesCount());

    const handleChange = () => {
      setFavoritesCount(getFavoritesCount());
    };

    window.addEventListener('favorites-changed', handleChange);
    return () => window.removeEventListener('favorites-changed', handleChange);
  }, []);

  // Get initial pantry count and listen for changes
  useEffect(() => {
    setPantryCount(getPantryCount());

    const handlePantryChange = () => {
      setPantryCount(getPantryCount());
    };

    window.addEventListener('pantry-changed', handlePantryChange);
    return () => window.removeEventListener('pantry-changed', handlePantryChange);
  }, []);

  // Get initial unit preference and listen for changes
  useEffect(() => {
    setUseMetric(isMetric());
    setThemePref(getThemePreference());

    const handleSettingsChange = () => {
      setUseMetric(isMetric());
      setThemePref(getThemePreference());
    };

    window.addEventListener('settings-changed', handleSettingsChange);
    return () => window.removeEventListener('settings-changed', handleSettingsChange);
  }, []);

  const handleUnitToggle = useCallback(() => {
    toggleUnit();
  }, []);

  const handleThemeChange = useCallback((theme) => {
    setThemePreference(theme);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(event.target)) {
        setIsMobileSearchOpen(false);
      }
      // Check both desktop and mobile settings refs
      const isInsideDesktopSettings = settingsRef.current && settingsRef.current.contains(event.target);
      const isInsideMobileSettings = mobileSettingsRef.current && mobileSettingsRef.current.contains(event.target);
      if (!isInsideDesktopSettings && !isInsideMobileSettings) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMobileSearchToggle = useCallback(() => {
    setIsMobileSearchOpen(prev => !prev);
  }, []);

  const handleSettingsToggle = useCallback(() => {
    setIsSettingsOpen(prev => !prev);
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
              variant="header"
              placeholder="Paste a URL or search recipes..."
              showKeyboardHint={true}
            />
          </div>

          {/* Right side - favorites, pantry, plan, settings */}
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0 justify-end">
            <a
              href="/favorites"
              className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Favorites"
            >
              <HeartIcon className="w-5 h-5" />
            </a>
            <a
              href="/plan"
              className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Meal Plan"
            >
              <CalendarIcon className="w-5 h-5" />
            </a>
            <a
              href="/pantry"
              className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Pantry"
            >
              <PantryIcon className="w-5 h-5" />
            </a>
            {/* Settings dropdown */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={handleSettingsToggle}
                className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Settings"
                aria-expanded={isSettingsOpen}
                aria-haspopup="menu"
                id="settings-button"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              {isSettingsOpen && (
                <div
                  className="absolute right-0 mt-1 w-48 bg-surface rounded-xl shadow-lg border border-sand-200 p-2.5 z-50"
                  role="menu"
                  aria-labelledby="settings-button"
                >
                  {/* Units picker */}
                  <div className="mb-2">
                    <div className="text-[11px] font-medium text-sand-500 mb-1">Measurements</div>
                    <div className="grid grid-cols-2 bg-sand-100 rounded p-0.5 gap-0.5" role="radiogroup">
                      <button
                        onClick={() => { if (useMetric) handleUnitToggle(); }}
                        className={`py-1 text-[11px] font-medium rounded transition-colors ${
                          !useMetric ? 'bg-surface text-sand-900' : 'text-sand-600 hover:text-sand-800'
                        }`}
                        role="radio"
                        aria-checked={!useMetric}
                      >
                        US
                      </button>
                      <button
                        onClick={() => { if (!useMetric) handleUnitToggle(); }}
                        className={`py-1 text-[11px] font-medium rounded transition-colors ${
                          useMetric ? 'bg-surface text-sand-900' : 'text-sand-600 hover:text-sand-800'
                        }`}
                        role="radio"
                        aria-checked={useMetric}
                      >
                        Metric
                      </button>
                    </div>
                  </div>

                  {/* Theme picker */}
                  <div className="mb-2">
                    <div className="text-[11px] font-medium text-sand-500 mb-1">Theme</div>
                    <div className="grid grid-cols-3 bg-sand-100 rounded p-0.5 gap-0.5" role="radiogroup">
                      {['system', 'light', 'dark'].map((theme) => (
                        <button
                          key={theme}
                          onClick={() => handleThemeChange(theme)}
                          className={`py-1 text-[11px] font-medium rounded transition-colors ${
                            themePreference === theme ? 'bg-surface text-sand-900' : 'text-sand-600 hover:text-sand-800'
                          }`}
                          role="radio"
                          aria-checked={themePreference === theme}
                        >
                          {theme.charAt(0).toUpperCase() + theme.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sign in/out */}
                  {!authLoading && (
                    <div className="pt-2 border-t border-sand-200">
                      {isAuthenticated ? (
                        <button
                          onClick={() => { signOut(); setIsSettingsOpen(false); }}
                          className="w-full py-1.5 text-[11px] font-medium text-sand-600 hover:text-sand-800 hover:bg-sand-100 rounded transition-colors"
                        >
                          Sign out
                        </button>
                      ) : (
                        <button
                          onClick={() => { setIsAuthModalOpen(true); setIsSettingsOpen(false); }}
                          className="w-full py-1.5 text-[11px] font-medium text-sand-600 hover:text-sand-800 hover:bg-sand-100 rounded transition-colors"
                        >
                          Sign in
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile icons */}
          <div className="flex sm:hidden items-center gap-1 ml-auto">
            <button
              onClick={handleMobileSearchToggle}
              className="p-2 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Search"
              aria-expanded={isMobileSearchOpen}
            >
              <SearchIcon className="w-5 h-5" />
            </button>
            <a
              href="/favorites"
              className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Favorites"
            >
              <HeartIcon className="w-5 h-5" />
            </a>
            <a
              href="/plan"
              className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Meal Plan"
            >
              <CalendarIcon className="w-5 h-5" />
            </a>
            <a
              href="/pantry"
              className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Pantry"
            >
              <PantryIcon className="w-5 h-5" />
            </a>
            {/* Settings dropdown (mobile) */}
            <div className="relative" ref={mobileSettingsRef}>
              <button
                onClick={handleSettingsToggle}
                className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Settings"
                aria-expanded={isSettingsOpen}
                aria-haspopup="menu"
                id="mobile-settings-button"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              {isSettingsOpen && (
                <div
                  className="absolute right-0 mt-1 w-48 bg-surface rounded-xl shadow-lg border border-sand-200 p-2.5 z-50"
                  role="menu"
                  aria-labelledby="mobile-settings-button"
                >
                  {/* Units picker */}
                  <div className="mb-2">
                    <div className="text-[11px] font-medium text-sand-500 mb-1">Measurements</div>
                    <div className="grid grid-cols-2 bg-sand-100 rounded p-0.5 gap-0.5" role="radiogroup">
                      <button
                        onClick={() => { if (useMetric) handleUnitToggle(); }}
                        className={`py-1 text-[11px] font-medium rounded transition-colors ${
                          !useMetric ? 'bg-surface text-sand-900' : 'text-sand-600 hover:text-sand-800'
                        }`}
                        role="radio"
                        aria-checked={!useMetric}
                      >
                        US
                      </button>
                      <button
                        onClick={() => { if (!useMetric) handleUnitToggle(); }}
                        className={`py-1 text-[11px] font-medium rounded transition-colors ${
                          useMetric ? 'bg-surface text-sand-900' : 'text-sand-600 hover:text-sand-800'
                        }`}
                        role="radio"
                        aria-checked={useMetric}
                      >
                        Metric
                      </button>
                    </div>
                  </div>

                  {/* Theme picker */}
                  <div className="mb-2">
                    <div className="text-[11px] font-medium text-sand-500 mb-1">Theme</div>
                    <div className="grid grid-cols-3 bg-sand-100 rounded p-0.5 gap-0.5" role="radiogroup">
                      {['system', 'light', 'dark'].map((theme) => (
                        <button
                          key={theme}
                          onClick={() => handleThemeChange(theme)}
                          className={`py-1 text-[11px] font-medium rounded transition-colors ${
                            themePreference === theme ? 'bg-surface text-sand-900' : 'text-sand-600 hover:text-sand-800'
                          }`}
                          role="radio"
                          aria-checked={themePreference === theme}
                        >
                          {theme.charAt(0).toUpperCase() + theme.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sign in/out */}
                  {!authLoading && (
                    <div className="pt-2 border-t border-sand-200">
                      {isAuthenticated ? (
                        <button
                          onClick={() => { signOut(); setIsSettingsOpen(false); }}
                          className="w-full py-1.5 text-[11px] font-medium text-sand-600 hover:text-sand-800 hover:bg-sand-100 rounded transition-colors"
                        >
                          Sign out
                        </button>
                      ) : (
                        <button
                          onClick={() => { setIsAuthModalOpen(true); setIsSettingsOpen(false); }}
                          className="w-full py-1.5 text-[11px] font-medium text-sand-600 hover:text-sand-800 hover:bg-sand-100 rounded transition-colors"
                        >
                          Sign in
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search (expanded) */}
        {isMobileSearchOpen && (
          <div ref={mobileSearchRef} className="sm:hidden pb-3">
            <SmartInput
              variant="header"
              placeholder="Paste a URL or search..."
              autoFocus={true}
            />
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign in to Simpler Recipes"
        description="Save unlimited recipes and sync across all your devices."
      />
    </header>
  );
}
