import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import SmartInput from './SmartInput';
import { getFavoritesCount } from '../utils/favorites';
import { isMetric, toggleUnit, getThemePreference, setThemePreference } from '../utils/settings';
import { useAuth } from '../hooks/useAuth';

const AuthModal = lazy(() => import('./AuthModal'));

const I = ({ d, className = 'w-5 h-5', sw = 1.75 }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const HeartIcon = (p) => <I {...p} d={<path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />} />;
const SearchIcon = (p) => <I {...p} d={<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>} />;
const MenuIcon = (p) => <I {...p} d={<path d="M4 7h16M4 12h16M4 17h16" />} />;
const CloseIcon = (p) => <I {...p} sw={2} d={<path d="M6 6l12 12M18 6L6 18" />} />;
const ChevronDown = (p) => <I {...p} sw={2} d={<path d="m6 9 6 6 6-6" />} />;

/**
 * Global header. Utility-first: logo, one search/paste box, Favorites, and a single "More" menu
 * holding the secondary features (Meal plan, Pantry) and settings.
 *
 * `showSearch=false` on the homepage (the hero already has the box — two identical inputs on one
 * screen was the cause of a real bug and pure noise).
 */
export default function Header({ showSearch = true }) {
  const [mobileSearch, setMobileSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [metric, setMetric] = useState(false);
  const [theme, setTheme] = useState('system');
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null); // desktop trigger
  const mobileBtnRef = useRef(null); // phone trigger (separately rendered)
  const { isAuthenticated, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    const refresh = () => {
      setFavCount(getFavoritesCount());
      setMetric(isMetric());
      setTheme(getThemePreference());
    };
    refresh();
    window.addEventListener('favorites-changed', refresh);
    window.addEventListener('settings-changed', refresh);
    return () => {
      window.removeEventListener('favorites-changed', refresh);
      window.removeEventListener('settings-changed', refresh);
    };
  }, []);

  // Close menu on outside click / Escape; return focus to the trigger.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !menuBtnRef.current?.contains(e.target) && !mobileBtnRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        (menuBtnRef.current?.offsetParent ? menuBtnRef.current : mobileBtnRef.current)?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  return (
    <header data-site-header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 border-b border-sand-200 print:hidden">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-3">
          <a href="/" className="shrink-0 text-[16px] font-semibold tracking-[-0.01em] text-sand-900 hover:text-sand-700 py-2 -my-2">
            Simpler Recipes
          </a>

          {/* Desktop search */}
          {showSearch && (
            <div className="hidden sm:flex flex-1 justify-center">
              <SmartInput variant="header" placeholder="Paste a recipe link, or search" id="header-search" />
            </div>
          )}
          {!showSearch && <div className="flex-1" />}

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 shrink-0 ml-auto" aria-label="Primary">
            <a href="/favorites" className="btn-ghost btn-sm relative -mr-1" aria-label={favCount ? `Favorites, ${favCount} saved` : 'Favorites'}>
              <HeartIcon className="w-[18px] h-[18px]" />
              <span className="hidden md:inline">Favorites</span>
              {favCount > 0 && <span className="text-[12px] tabular text-sand-500">{favCount}</span>}
            </a>
            <div className="relative">
              <button
                ref={menuBtnRef}
                type="button"
                onClick={toggleMenu}
                className="btn-ghost btn-sm"
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
                aria-controls="header-more"
              >
                More
                <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div ref={menuRef} id="header-more" role="dialog" aria-label="More" className="absolute right-0 mt-2 w-64 rounded-xl border border-sand-200 bg-surface shadow-lg p-2 z-50">
                  <MenuLinks onNavigate={() => setMenuOpen(false)} />
                  <Settings metric={metric} theme={theme} />
                  {!authLoading && (
                    <div className="mt-2 pt-2 border-t border-sand-200">
                      {isAuthenticated ? (
                        <button type="button" onClick={() => { signOut(); setMenuOpen(false); }} className="w-full text-left px-3 h-10 rounded-lg text-[14px] text-sand-700 hover:bg-sand-100">
                          Sign out
                        </button>
                      ) : (
                        <button type="button" onClick={() => { setAuthOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 h-10 rounded-lg text-[14px] text-sand-700 hover:bg-sand-100">
                          Sign in <span className="text-sand-500">· sync favorites</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Mobile controls */}
          <div className="flex sm:hidden items-center gap-1 ml-auto">
            {showSearch && (
              <button type="button" onClick={() => { setMobileSearch((v) => !v); setMenuOpen(false); }} className="btn-icon" aria-label={mobileSearch ? 'Close search' : 'Search or paste a link'} aria-expanded={mobileSearch} aria-controls="mobile-search">
                {mobileSearch ? <CloseIcon /> : <SearchIcon />}
              </button>
            )}
            <button ref={mobileBtnRef} type="button" onClick={() => { toggleMenu(); setMobileSearch(false); }} className="btn-icon" aria-label="Menu" aria-expanded={menuOpen} aria-controls="mobile-menu">
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {mobileSearch && showSearch && (
          <div id="mobile-search" className="sm:hidden pb-3">
            <SmartInput variant="header" placeholder="Paste a recipe link, or search" autoFocus id="mobile-search-input" bindShortcut={false} />
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div ref={menuRef} id="mobile-menu" role="dialog" aria-label="Menu" className="sm:hidden absolute inset-x-0 top-full bg-surface border-b border-sand-200 shadow-lg p-2 z-50">
          <a href="/favorites" className="flex items-center gap-3 px-3 h-12 rounded-lg text-[15px] text-sand-800 hover:bg-sand-100">
            <HeartIcon className="w-5 h-5 text-sand-500" /> Favorites {favCount > 0 && <span className="text-sand-500 tabular">{favCount}</span>}
          </a>
          <MenuLinks onNavigate={() => setMenuOpen(false)} big />
          <Settings metric={metric} theme={theme} />
          {!authLoading && (
            <div className="mt-2 pt-2 border-t border-sand-200 px-1 pb-1">
              {isAuthenticated ? (
                <button type="button" onClick={() => { signOut(); setMenuOpen(false); }} className="btn-ghost w-full">Sign out</button>
              ) : (
                <button type="button" onClick={() => { setAuthOpen(true); setMenuOpen(false); }} className="btn-secondary w-full">Sign in to sync favorites</button>
              )}
            </div>
          )}
        </div>
      )}

      {authOpen && (
        <Suspense fallback={null}>
          <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} title="Sign in" description="Keep your favorites on every device." />
        </Suspense>
      )}
    </header>
  );
}

function MenuLinks({ big = false }) {
  const cls = big ? 'flex items-center gap-3 px-3 h-12 rounded-lg text-[15px] text-sand-800 hover:bg-sand-100' : 'flex items-center px-3 h-10 rounded-lg text-[14px] text-sand-800 hover:bg-sand-100';
  return (
    <>
      <a href="/plan" className={cls}>Meal plan</a>
      <a href="/pantry" className={cls}>Pantry</a>
    </>
  );
}

function Seg({ label, value, options, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-[13px] text-sand-600">{label}</span>
      <div className="inline-flex rounded-lg bg-sand-100 p-0.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-2.5 h-8 rounded-md text-[13px] font-medium transition-colors ${value === o.value ? 'bg-surface text-sand-900 shadow-sm' : 'text-sand-600 hover:text-sand-900'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Settings({ metric, theme }) {
  return (
    <div className="mt-2 pt-2 border-t border-sand-200">
      <Seg label="Units" value={metric ? 'metric' : 'us'} options={[{ value: 'us', label: 'US' }, { value: 'metric', label: 'Metric' }]} onChange={(v) => { if ((v === 'metric') !== metric) toggleUnit(); }} />
      <Seg label="Appearance" value={theme} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(v) => setThemePreference(v)} />
    </div>
  );
}
