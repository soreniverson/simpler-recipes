import { useState } from 'react';
import FavoriteButton from './FavoriteButton';
import { track, surface } from '../lib/track';

/**
 * Recipe card: photo, title, one quiet meta line. No pills, no zoom, no colored badges.
 * Pantry match (when the user has a pantry) is a plain sentence.
 */
export default function RecipeCard({ recipe, showFavorite = true, matchInfo, eager = false, visible = true }) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasMatch = matchInfo && matchInfo.total > 0;
  const meta = [recipe.totalTime, hasMatch ? `${matchInfo.matched}/${matchInfo.total} in pantry` : null].filter(Boolean).join(' · ');

  return (
    <div className="relative h-full group">
      {showFavorite && (
        <div className="absolute top-2 right-2 z-10">
          {/* 44px tap target, but the scrim is a soft radial rather than a hard chip: the mark stays
              legible over pale photography without reading as a badge. */}
          <FavoriteButton
            slug={recipe.slug}
            size="small"
            className="!text-white [background:radial-gradient(circle,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.28)_48%,rgba(0,0,0,0)_72%)] hover:!text-white"
          />
        </div>
      )}
      <a
        href={`/recipes/${recipe.slug}/`}
        onClick={() => track('recipe_card_open', { surface: surface(), slug: recipe.slug })}
        className="block h-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-700"
      >
        <article className="h-full flex flex-col">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-sand-100 mb-2.5">
            {/* Only mount the image while the card is inside the visible window. Cards beyond
                it live in a hidden <li>, and a lazy <img> that was display:none at parse time
                does not reliably start loading when it is later revealed — which happens
                whenever the pantry re-sort promotes a card from further down the list. Mounting
                on demand guarantees a fresh element that loads immediately. */}
            {visible && recipe.image && !imgFailed && (
              <img
                src={recipe.image}
                srcSet={recipe.imageSet || undefined}
                sizes={recipe.imageSet ? '(min-width: 1024px) 340px, 50vw' : undefined}
                alt=""
                width={520}
                height={390}
                className="w-full h-full object-cover dark:brightness-90 group-hover:opacity-95 transition-opacity"
                loading={eager ? 'eager' : 'lazy'}
                fetchpriority={eager ? 'high' : undefined}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
              />
            )}
          </div>
          <h2 className="font-serif text-[16px] font-medium leading-snug text-sand-900 line-clamp-2 group-hover:underline underline-offset-[3px] decoration-sand-300">{recipe.title}</h2>
          {meta && <p className="mt-1 font-mono text-[12px] text-sand-500">{meta}</p>}
        </article>
      </a>
    </div>
  );
}
