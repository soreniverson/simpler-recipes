import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Ingredients from './Ingredients';
import Instructions from './Instructions';
import CookMode from './CookMode';
import { getCookState, toggleIngredient, toggleStep, setCookState, resetCookState, COOK_STATE_EVENT } from '../../lib/cookState';
import { metaLine, sourceInfo, recipeAsText, displayTimes, displayServings } from '../../lib/recipe/display';
import { safeImageSrc } from '../../lib/recipe/href';
import { isFavorite, toggleFavorite, getExtractedFavorites, addExtractedFavorite, removeExtractedFavorite } from '../../utils/favorites';
import { PlayIcon, HeartIcon, ShareIcon, PrintIcon, CopyIcon, ExternalIcon, SparklesIcon, ImagePlaceholderIcon } from './Icons';

/**
 * The recipe page. One component for curated (/recipes/slug), extracted (/recipe?r=id) and shared (/r/id).
 *
 * Layout: image → title → meta line → source → actions; then Ingredients FIRST in DOM (mobile order),
 * placed in a sticky right column on desktop; Instructions on the left.
 *
 * props:
 *   recipe      Recipe (new model) or legacy curated/shared shape
 *   recipeId    stable id for cook state (slug | recent id | share id)
 *   sourceUrl   where it came from (curated: recipe.source.url)
 *   variant     'curated' | 'extracted' | 'shared'
 *   shareId     for shared pages (used to build the canonical share URL)
 *   remix       optional render-prop for the Remix control (kept out of this component's bundle)
 *
 * @param {{ recipe: any, recipeId: string, sourceUrl?: string | null, variant?: 'curated' | 'extracted' | 'shared', shareId?: string, remix?: any, children?: any }} props
 */
export default function RecipeView({ recipe, recipeId, sourceUrl, variant = 'curated', shareId, remix, children }) {
  const src = useMemo(() => sourceInfo(recipe, sourceUrl), [recipe, sourceUrl]);
  const meta = useMemo(() => metaLine(recipe), [recipe]);
  const times = useMemo(() => displayTimes(recipe), [recipe]);

  // ---- cook state (checked ingredients/steps, servings, current step) ----
  const [state, setState] = useState(() => ({ ingredients: [], steps: [], currentStep: 0, servings: null }));
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setState(getCookState(recipeId));
    setHydrated(true);
    const onChange = (e) => {
      if (!e.detail || e.detail.id === recipeId) setState(getCookState(recipeId));
    };
    window.addEventListener(COOK_STATE_EVENT, onChange);
    return () => window.removeEventListener(COOK_STATE_EVENT, onChange);
  }, [recipeId]);

  const checked = useMemo(() => new Set(state.ingredients), [state.ingredients]);
  const doneSteps = useMemo(() => new Set(state.steps), [state.steps]);
  const onToggleIngredient = useCallback((i) => setState(toggleIngredient(recipeId, i)), [recipeId]);
  const onToggleStep = useCallback((i) => setState(toggleStep(recipeId, i)), [recipeId]);
  const onResetIngredients = useCallback(() => setState(setCookState(recipeId, { ingredients: [] })), [recipeId]);
  const onServingsChange = useCallback((n) => setState(setCookState(recipeId, { servings: n })), [recipeId]);
  const onStepChange = useCallback((n) => setState(setCookState(recipeId, { currentStep: n })), [recipeId]);

  // ---- cook mode ----
  const [cooking, setCooking] = useState(false);
  const openCook = useCallback(() => setCooking(true), []);
  const closeCook = useCallback(() => setCooking(false), []);
  const onCookDone = useCallback(() => {
    // Finished cooking: clear the step position and checks so next time starts fresh.
    resetCookState(recipeId);
    setState(getCookState(recipeId));
  }, [recipeId]);

  // ---- favorites ----
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const check = () => {
      if (variant === 'curated' && recipe.slug) setSaved(isFavorite(recipe.slug));
      else if (src.url) setSaved(getExtractedFavorites().some((f) => f.sourceUrl === src.url));
    };
    check();
    window.addEventListener('favorites-changed', check);
    return () => window.removeEventListener('favorites-changed', check);
  }, [recipe.slug, src.url, variant]);
  const onSave = useCallback(() => {
    if (variant === 'curated' && recipe.slug) {
      toggleFavorite(recipe.slug);
      return;
    }
    const existing = getExtractedFavorites().find((f) => f.sourceUrl === src.url);
    if (existing) removeExtractedFavorite(existing.id);
    else addExtractedFavorite(recipe, src.url || '');
    // favorites emit 'favorites-changed' → effect above updates
  }, [variant, recipe, src.url]);

  // ---- share ----
  const [shareState, setShareState] = useState('idle'); // idle | working | copied | native | error
  const shareTimeout = useRef(null);
  const onShare = useCallback(async () => {
    setShareState('working');
    try {
      let url;
      if (variant === 'curated' && recipe.slug) url = `${location.origin}/recipes/${recipe.slug}/`;
      else if (variant === 'shared' && shareId) url = `${location.origin}/r/${shareId}`;
      else {
        const res = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe, sourceUrl: src.url }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.id) throw new Error(data.error || 'share failed');
        url = `${location.origin}/r/${data.id}`;
      }
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        try {
          await navigator.share({ title: recipe.title, url });
          setShareState('native');
        } catch (e) {
          if (e && e.name === 'AbortError') {
            setShareState('idle');
            return;
          }
          await navigator.clipboard.writeText(url);
          setShareState('copied');
        }
      } else {
        await navigator.clipboard.writeText(url);
        setShareState('copied');
      }
    } catch {
      setShareState('error');
    }
    clearTimeout(shareTimeout.current);
    shareTimeout.current = setTimeout(() => setShareState('idle'), 2200);
  }, [variant, recipe, shareId, src.url]);

  // ---- copy ----
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(recipeAsText(recipe, src.url));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }, [recipe, src.url]);

  const onPrint = useCallback(() => window.print(), []);

  const image = safeImageSrc(recipe.image);
  const [imgFailed, setImgFailed] = useState(false);
  const cookProgress = state.currentStep > 0 && state.currentStep < recipe.instructions.length - 1;

  return (
    <article data-recipe-view className="max-w-[1080px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
      {/* ---------- Header ---------- */}
      <header className="mb-7 sm:mb-9 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:items-start">
        {image && !imgFailed && (
          <div className="-mx-4 sm:mx-0 mb-5 lg:mb-0 lg:order-2 sm:rounded-2xl overflow-hidden bg-sand-100 aspect-[16/10] max-h-[240px] sm:max-h-[360px] lg:max-h-none lg:aspect-[4/3] print:hidden">
            <img
              src={image}
              alt=""
              width={800}
              height={600}
              className="w-full h-full object-cover dark:brightness-90"
              loading="eager"
              fetchpriority="high"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
            />
          </div>
        )}
        <div className="lg:order-1 min-w-0">
          <h1 className="text-[26px] sm:text-[32px] leading-[1.15] font-semibold tracking-[-0.015em] text-sand-900 [text-wrap:balance]">{recipe.title}</h1>

          {(meta.length > 0 || times.total) && (
            <p data-meta className="mt-2 text-[14px] sm:text-[15px] text-sand-600 tabular flex flex-wrap gap-x-2 gap-y-1">
              {meta.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  {m}
                  {i < meta.length - 1 && <span className="text-sand-400" aria-hidden="true">·</span>}
                </span>
              ))}
            </p>
          )}

          {(src.name || src.url) && (
            <p className="mt-2 text-[14px] sm:text-[15px] text-sand-600">
              {variant === 'shared' ? 'Shared from ' : 'From '}
              {src.url ? (
                <a href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sand-800 underline underline-offset-[3px] decoration-sand-400 hover:decoration-sand-800 inline-flex items-center gap-1">
                  {src.name}
                  <ExternalIcon className="w-3.5 h-3.5 text-sand-500" />
                </a>
              ) : (
                <span className="text-sand-800">{src.name}</span>
              )}
              {src.author && <span className="text-sand-500"> · {src.author}</span>}
            </p>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2 no-print">
            {recipe.instructions.length > 0 && (
              <button type="button" onClick={openCook} className="btn-primary w-full sm:w-auto">
                <PlayIcon className="w-4 h-4" />
                {hydrated && cookProgress ? `Resume step ${state.currentStep + 1}` : 'Cook Mode'}
              </button>
            )}
            <button type="button" onClick={onSave} className={`btn-ghost ${saved ? 'text-sand-900' : ''}`} aria-pressed={saved}>
              <HeartIcon filled={saved} className="w-[18px] h-[18px]" />
              {saved ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={onShare} className="btn-ghost" disabled={shareState === 'working'} aria-live="polite">
              <ShareIcon className="w-[18px] h-[18px]" />
              {shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Couldn’t share' : shareState === 'working' ? 'Sharing…' : 'Share'}
            </button>
            <button type="button" onClick={onPrint} className="btn-ghost hidden sm:inline-flex">
              <PrintIcon className="w-[18px] h-[18px]" />
              Print
            </button>
            <button type="button" onClick={onCopy} className="btn-ghost hidden sm:inline-flex" aria-live="polite">
              <CopyIcon className="w-[18px] h-[18px]" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </header>

      {/* ---------- Body ---------- */}
      <div data-body className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:items-start">
        <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain mb-8 lg:mb-0 print:mb-4" aria-labelledby="ingredients-heading">
          <Ingredients
            recipe={recipe}
            checked={checked}
            onToggle={onToggleIngredient}
            onReset={onResetIngredients}
            servings={state.servings}
            onServingsChange={onServingsChange}
          />
        </aside>

        <div className="lg:col-start-1 lg:row-start-1 min-w-0">
          <Instructions recipe={recipe} done={doneSteps} onToggle={onToggleStep} onCookMode={openCook} />

          {/* Secondary: remix (opt-in, AI) + tags */}
          <div className="mt-10 pt-6 border-t border-sand-200 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-sand-600 no-print">
            {remix ? (
              <span className="inline-flex items-center gap-1.5">
                <SparklesIcon className="w-4 h-4 text-sand-500" />
                {remix}
              </span>
            ) : null}
            {src.url && (
              <a href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 hover:text-sand-900 underline underline-offset-[3px] decoration-sand-300">
                View original on {src.name}
                <ExternalIcon className="w-3.5 h-3.5" />
              </a>
            )}
            <span className="sm:hidden inline-flex items-center gap-4">
              <button type="button" onClick={onPrint} className="inline-flex items-center gap-1.5 hover:text-sand-900">
                <PrintIcon className="w-4 h-4" /> Print
              </button>
              <button type="button" onClick={onCopy} className="inline-flex items-center gap-1.5 hover:text-sand-900">
                <CopyIcon className="w-4 h-4" /> {copied ? 'Copied' : 'Copy'}
              </button>
            </span>
          </div>
          {children}
        </div>
      </div>

      {/* Print-only source line */}
      {src.url && (
        <p className="hidden print-source text-sand-700">
          Source: {src.name} — {src.url}
        </p>
      )}

      {cooking && (
        <CookMode
          recipe={recipe}
          currentStep={state.currentStep}
          onStepChange={onStepChange}
          checkedIngredients={checked}
          onToggleIngredient={onToggleIngredient}
          onResetIngredients={onResetIngredients}
          servings={state.servings}
          onServingsChange={onServingsChange}
          onClose={closeCook}
          onStepDone={onCookDone}
        />
      )}
    </article>
  );
}

// Re-export for pages that want a placeholder when the image is missing.
export { ImagePlaceholderIcon };
