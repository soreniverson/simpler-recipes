import { useState } from 'react';
import FavoriteButton from './FavoriteButton';

/**
 * Recipe card: photo, title, one quiet meta line. No pills, no zoom, no colored badges.
 * Pantry match (when the user has a pantry) is a plain sentence.
 */
export default function RecipeCard({ recipe, showFavorite = true, matchInfo, eager = false }) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasMatch = matchInfo && matchInfo.total > 0;
  const meta = [recipe.totalTime, hasMatch ? `${matchInfo.matched}/${matchInfo.total} in pantry` : null].filter(Boolean).join(' · ');

  return (
    <div className="relative h-full group">
      {showFavorite && (
        <div className="absolute top-2 right-2 z-10">
          <FavoriteButton slug={recipe.slug} size="small" className="!bg-black/30 !text-white backdrop-blur-sm hover:!bg-black/45 dark:!bg-black/40" />
        </div>
      )}
      <a href={`/recipes/${recipe.slug}/`} className="block h-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-700">
        <article className="h-full flex flex-col">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-sand-100 mb-2.5">
            {recipe.image && !imgFailed && (
              <img
                src={recipe.image}
                srcSet={recipe.imageSet || undefined}
                sizes={recipe.imageSet ? '(min-width: 1024px) 250px, (min-width: 640px) 33vw, 50vw' : undefined}
                alt=""
                width={400}
                height={300}
                className="w-full h-full object-cover dark:brightness-90 group-hover:opacity-95 transition-opacity"
                loading={eager ? 'eager' : 'lazy'}
                fetchpriority={eager ? 'high' : undefined}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
              />
            )}
          </div>
          <h2 className="text-[15px] font-medium leading-snug text-sand-900 line-clamp-2 group-hover:underline underline-offset-[3px] decoration-sand-300">{recipe.title}</h2>
          {meta && <p className="mt-0.5 text-[13px] text-sand-500 tabular">{meta}</p>}
        </article>
      </a>
    </div>
  );
}
