import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { createSearchIndex, searchRecipes } from '../utils/searchIndex';
import { getAnonymousToken } from '../utils/anonymousToken';
import { looksLikeUrl, normalizeUrl } from '../lib/url';
import { rememberRecipe } from '../lib/recentRecipes';
import { hostnameOf } from '../lib/recipe/href';
import { track, surface } from '../lib/track';

const AuthModal = lazy(() => import('./AuthModal'));

/* ---------- icons (local; tiny) ---------- */
const SearchIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const LinkIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.1 1.1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.1-1.1" />
  </svg>
);
const ArrowIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const CloseIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const Spinner = ({ className = 'w-5 h-5' }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/* ---------- search index (module-level cache, Fuse loaded with it) ---------- */
let searchData = null;
let fuse = null;
let loading = null;
function loadSearch() {
  if (fuse) return Promise.resolve(fuse);
  if (loading) return loading;
  loading = fetch('/search-index.json')
    .then((r) => r.json())
    .then((data) => {
      searchData = data;
      fuse = createSearchIndex(data);
      return fuse;
    })
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}

const ERROR_ACTIONS = new Set(['timeout', 'network-error', 'http-error', 'no-recipe', 'too-large', 'unsupported-content-type', 'server-error', 'rate-limited']);

/**
 * The paste-or-search box.
 *
 *  - paste a URL → runs immediately (a URL pasted into a "paste a recipe link" box is unambiguous)
 *  - type/paste anything else → instant local search with ↑/↓/Enter/Esc (ARIA combobox)
 *  - extraction progress shows inline ("Fetching recipetineats.com…"), Esc/× cancels
 *  - errors are plain English with the server's hint and a way forward
 */
export default function SmartInput({ variant = 'default', placeholder = 'Paste a recipe link, or search', autoFocus = false, id = 'recipe-url', bindShortcut = true }) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null); // { code, error, hint, url }
  const [limit, setLimit] = useState(null); // { message, isAuthenticated, url }
  const [authOpen, setAuthOpen] = useState(false);
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const esRef = useRef(null);
  const reqRef = useRef(0);
  const listId = `${id}-results`;

  const isUrl = looksLikeUrl(value);
  const isHeader = variant === 'header';

  useEffect(() => {
    getAnonymousToken();
    return () => esRef.current?.close();
  }, []);

  // ---- search ----
  useEffect(() => {
    if (isUrl || value.trim().length < 2) {
      setResults([]);
      setActive(-1);
      if (!isUrl) setOpen(false);
      return;
    }
    const q = value.trim();
    const my = ++reqRef.current;
    const t = setTimeout(async () => {
      const f = await loadSearch();
      if (my !== reqRef.current) return; // stale
      setResults(f ? searchRecipes(f, q, 24) : []);
      setActive(-1);
      setShowAll(false);
      setOpen(true);
    }, 120);
    return () => clearTimeout(t);
  }, [value, isUrl]);

  // ---- outside click ----
  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ---- ⌘K ----
  useEffect(() => {
    if (!bindShortcut) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        loadSearch();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [bindShortcut]);

  const cancel = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setBusy(false);
    setProgress('');
  }, []);

  const extract = useCallback(
    (raw) => {
      const n = normalizeUrl(raw);
      if (!n.ok) {
        setError({ code: 'invalid-url', error: "That doesn't look like a web address.", hint: 'Paste the full link to the recipe page, starting with https://.' });
        return;
      }
      const url = n.url;
      const host = hostnameOf(url) || 'the site';
      setError(null);
      setLimit(null);
      setOpen(false);
      setBusy(true);
      setProgress(`Fetching ${host}…`);
      // Funnel events carry the route only — never the pasted URL.
      track('clean_start', { surface: surface() });
      esRef.current?.close();
      const es = new EventSource(`/api/extract-stream?url=${encodeURIComponent(url)}`);
      esRef.current = es;
      const stop = () => {
        es.close();
        if (esRef.current === es) esRef.current = null;
      };
      es.addEventListener('progress', (e) => {
        try {
          setProgress(JSON.parse(e.data).step || 'Working…');
        } catch {}
      });
      es.addEventListener('limit_reached', (e) => {
        stop();
        track('clean_error', { surface: surface(), code: 'limit-reached' });
        try {
          const d = JSON.parse(e.data);
          setLimit({ message: d.message, isAuthenticated: !!d.isAuthenticated, url });
        } catch {
          setLimit({ message: 'You have used your free AI extractions.', isAuthenticated: false, url });
        }
        setBusy(false);
        setProgress('');
      });
      es.addEventListener('complete', (e) => {
        stop();
        try {
          const d = JSON.parse(e.data);
          const rid = rememberRecipe(d.recipe, url);
          track('clean_success', { surface: surface(), method: d.method || 'unknown', cached: !!d.cached });
          setProgress('Done');
          window.location.assign(`/recipe?r=${rid}`);
        } catch {
          setError({ code: 'server-error', error: 'Something went wrong on our side.', hint: 'Please try again.' });
          setBusy(false);
          setProgress('');
        }
      });
      // Server "error" events carry data; the native EventSource error does not.
      es.addEventListener('error', (e) => {
        if (esRef.current !== es) return; // already handled
        stop();
        let payload = null;
        try {
          if (e.data) payload = JSON.parse(e.data);
        } catch {}
        track('clean_error', { surface: surface(), code: (payload && payload.code) || 'network-error' });
        setError(payload && payload.error ? payload : { code: 'network-error', error: `We couldn't reach ${host}.`, hint: 'Check your connection and try again.', url });
        setBusy(false);
        setProgress('');
      });
    },
    []
  );

  // Programmatic "run this URL" (homepage examples). Same path as a paste.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onExtract = (e) => {
      const url = e.detail?.url;
      if (!url) return;
      setValue(url);
      extract(url);
    };
    el.addEventListener('sr:extract', onExtract);
    return () => el.removeEventListener('sr:extract', onExtract);
  }, [extract]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    if (isUrl) return extract(value.trim());
    if (open && active >= 0 && results[active]) {
      window.location.assign(`/recipes/${results[active].recipe.slug}/`);
      return;
    }
    if (results.length) window.location.assign(`/recipes/${results[0].recipe.slug}/`);
  };

  const onPaste = (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (looksLikeUrl(text.trim())) {
      e.preventDefault();
      setValue(text.trim());
      extract(text.trim());
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (busy) cancel();
      else if (open) setOpen(false);
      else if (value) setValue('');
      else inputRef.current?.blur();
      setError(null);
      return;
    }
    if (!open || !results.length) return;
    const shown = showAll ? results.length : Math.min(results.length, 8);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % shown);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? shown - 1 : a - 1));
    } else if (e.key === 'Home' && active >= 0) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && active >= 0) {
      e.preventDefault();
      setActive(shown - 1);
    }
  };

  const shownResults = showAll ? results : results.slice(0, 8);
  const activeId = active >= 0 && shownResults[active] ? `${listId}-opt-${active}` : undefined;
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const inputClass = isHeader
    ? 'h-10 pl-10 pr-10 rounded-lg text-[16px] lg:text-[14px]'
    : 'h-14 sm:h-16 pl-12 sm:pl-14 pr-14 rounded-2xl text-[16px] sm:text-[18px] shadow-sm';

  return (
    <div ref={boxRef} className={`relative ${isHeader ? 'w-full max-w-md' : 'w-full'}`}>
      <form onSubmit={onSubmit} role="search" aria-label={isHeader ? 'Search recipes or paste a link' : 'Paste a recipe link'} noValidate>
        <div className="relative">
          <div className={`absolute inset-y-0 left-0 flex items-center pointer-events-none text-sand-500 ${isHeader ? 'pl-3' : 'pl-4 sm:pl-5'}`}>
            {busy ? <Spinner className={isHeader ? 'w-4 h-4' : 'w-5 h-5'} /> : isUrl ? <LinkIcon className={isHeader ? 'w-4 h-4' : 'w-5 h-5'} /> : <SearchIcon className={isHeader ? 'w-4 h-4' : 'w-5 h-5'} />}
          </div>
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={busy ? progress : value}
            readOnly={busy}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
              if (limit) setLimit(null);
            }}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            aria-label={isHeader ? 'Search recipes or paste a recipe link' : 'Recipe link or search'}
            onFocus={() => {
              loadSearch();
              if (!isUrl && value.trim().length >= 2) setOpen(true);
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint={isUrl ? 'go' : 'search'}
            inputMode="search"
            role="combobox"
            aria-expanded={open && !isUrl && results.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-busy={busy}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`w-full bg-surface border border-sand-300 text-sand-900 placeholder:text-sand-500 focus:border-sand-700 focus:outline-none transition-colors ${busy ? 'text-sand-600' : ''} ${inputClass}`}
          />
          <div className={`absolute inset-y-0 right-0 flex items-center ${isHeader ? 'pr-1' : 'pr-2'}`}>
            {busy ? (
              <button type="button" onClick={cancel} className="btn-icon" aria-label="Cancel">
                <CloseIcon />
              </button>
            ) : isUrl ? (
              <button type="submit" className={`inline-flex items-center justify-center rounded-xl bg-sand-900 text-sand-50 hover:bg-sand-800 ${isHeader ? 'w-8 h-8 rounded-md' : 'w-11 h-11'}`} aria-label="Get recipe">
                <ArrowIcon className={isHeader ? 'w-4 h-4' : 'w-5 h-5'} />
              </button>
            ) : value ? (
              <button type="button" onClick={() => { setValue(''); setError(null); inputRef.current?.focus(); }} className="btn-icon" aria-label="Clear">
                <CloseIcon />
              </button>
            ) : isHeader ? (
              <kbd className="hidden lg:inline-flex items-center gap-0.5 mr-2 px-1.5 h-6 text-[11px] text-sand-500 bg-sand-100 rounded border border-sand-200 pointer-events-none" aria-hidden="true">
                ⌘K
              </kbd>
            ) : null}
          </div>
        </div>
      </form>

      {/* Errors */}
      {error && !busy && (
        <div id={`${id}-error`} role="alert" className={`mt-3 rounded-xl border border-sand-300 bg-sand-50 ${isHeader ? 'absolute left-0 right-0 z-50 shadow-md p-3 text-[13px]' : 'p-4 text-[15px]'}`}>
          <p className="text-sand-900 font-medium">{error.error}</p>
          {error.hint && <p className="text-sand-600 mt-1">{error.hint}</p>}
          {ERROR_ACTIONS.has(error.code) && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {error.url && (
                <a href={error.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sand-800 underline underline-offset-[3px] decoration-sand-300 hover:decoration-sand-800">
                  Open the original ↗
                </a>
              )}
              {error.code !== 'no-recipe' && (
                <button type="button" onClick={() => extract(value)} className="text-sand-800 underline underline-offset-[3px] decoration-sand-300 hover:decoration-sand-800">
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI quota reached */}
      {limit && !busy && (
        <div role="status" className={`mt-3 rounded-xl border border-sand-300 bg-sand-50 ${isHeader ? 'absolute left-0 right-0 z-50 shadow-md p-3 text-[13px]' : 'p-4 text-[15px]'}`}>
          <p className="text-sand-900 font-medium">This page needs our AI reader</p>
          <p className="text-sand-600 mt-1">{limit.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {!limit.isAuthenticated && (
              <button type="button" onClick={() => setAuthOpen(true)} className="btn-primary btn-sm">
                Create free account
              </button>
            )}
            <a href={limit.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sand-800 underline underline-offset-[3px] decoration-sand-300 hover:decoration-sand-800">
              Open the original ↗
            </a>
          </div>
        </div>
      )}

      {/* Search results */}
      {open && !isUrl && !busy && value.trim().length >= 2 && (
        <div className={`absolute left-0 right-0 z-50 mt-2 rounded-xl border border-sand-200 bg-surface shadow-md overflow-hidden ${isHeader ? '' : 'sm:rounded-2xl'}`}>
          {results.length === 0 ? (
            <div className="px-4 py-5 text-[14px] text-sand-600" role="status">
              Nothing in our recipes for “{value.trim()}”. Paste a link to get any recipe.
            </div>
          ) : (
            <>
              <ul id={listId} role="listbox" aria-label="Recipe results" className="max-h-[60vh] overflow-y-auto divide-y divide-sand-100">
                {shownResults.map((r, i) => (
                  <li key={r.recipe.slug} role="option" id={`${listId}-opt-${i}`} aria-selected={i === active}>
                    <a
                      href={`/recipes/${r.recipe.slug}/`}
                      className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 min-h-[52px] ${i === active ? 'bg-sand-200' : 'hover:bg-sand-100'}`}
                      onMouseEnter={() => setActive(i)}
                      tabIndex={-1}
                    >
                      {r.recipe.thumb || r.recipe.image ? (
                        <img src={r.recipe.thumb || r.recipe.image} alt="" width={40} height={40} loading="lazy" decoding="async" className="w-10 h-10 rounded-lg object-cover bg-sand-100 shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="w-10 h-10 rounded-lg bg-sand-100 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] text-sand-900 truncate">{r.recipe.title}</span>
                        {r.recipe.totalTime && <span className="block text-[13px] text-sand-500 tabular">{r.recipe.totalTime}</span>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              {results.length > 8 && !showAll && (
                <button type="button" onClick={() => setShowAll(true)} className="w-full text-left px-4 py-2.5 text-[13px] text-sand-600 hover:bg-sand-100 border-t border-sand-100">
                  Show {results.length - 8} more
                </button>
              )}
              <p className="sr-only" role="status" aria-live="polite">
                {results.length} results
              </p>
            </>
          )}
        </div>
      )}

      {authOpen && (
        <Suspense fallback={null}>
          <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} title="Keep going with a free account" description="You've used your free AI reads. A free account gets 30 a month and keeps your favorites on every device." />
        </Suspense>
      )}
    </div>
  );
}
