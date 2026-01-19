import FavoriteButton from './FavoriteButton';

function ClockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}

function ImagePlaceholder() {
  return (
    <svg className="w-8 h-8 text-sand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

export default function RecipeCard({ recipe, showFavorite = true, matchInfo }) {
  // matchInfo: { matched: number, total: number, percentage: number } | undefined
  const hasMatch = matchInfo && matchInfo.total > 0;
  const isFullMatch = hasMatch && matchInfo.matched === matchInfo.total;

  return (
    <div className="relative h-full bg-sand-50 rounded-xl overflow-hidden hover:bg-sand-100/80 transition-all group">
      {/* Favorite button - positioned in top right of image */}
      {showFavorite && (
        <div className="absolute top-2 right-2 z-10">
          <FavoriteButton slug={recipe.slug} size="small" />
        </div>
      )}

      <a href={`/recipes/${recipe.slug}`} className="block h-full">
        <article className="h-full flex flex-col">
          {recipe.image ? (
            <div className="aspect-[4/3] overflow-hidden bg-sand-200">
              <img
                src={recipe.image}
                alt={`${recipe.title}`}
                width={400}
                height={300}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : (
            <div className="aspect-[4/3] bg-sand-200 flex items-center justify-center">
              <ImagePlaceholder />
            </div>
          )}
          <div className="p-4 flex-1 flex flex-col">
            <h2 className="text-sand-900 font-medium text-sm group-hover:text-sand-950 transition-colors mb-2 line-clamp-2">
              {recipe.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-auto">
              {hasMatch && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  isFullMatch
                    ? 'bg-emerald-100 text-emerald-700'
                    : matchInfo.percentage >= 70
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-sand-200/60 text-sand-600'
                }`}>
                  {isFullMatch && <CheckCircleIcon />}
                  {matchInfo.matched}/{matchInfo.total} ingredients
                </span>
              )}
              {recipe.totalTime && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-600 text-xs">
                  <ClockIcon />
                  {recipe.totalTime}
                </span>
              )}
              {recipe.servings && !hasMatch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-600 text-xs">
                  {recipe.servings} servings
                </span>
              )}
            </div>
          </div>
        </article>
      </a>
    </div>
  );
}
