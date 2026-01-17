import { useLocation, Navigate, Link } from 'react-router-dom'
import ActionButtons from './ActionButtons'
import { formatFraction } from '../utils/formatFraction'

function RecipeDisplay() {
  const location = useLocation()
  const { recipe, sourceUrl } = location.state || {}

  if (!recipe) {
    return <Navigate to="/" replace />
  }

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="max-w-[1080px] mx-auto px-4 py-8 md:py-12">
        <nav className="mb-6 print:hidden">
          <Link
            to="/"
            className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm"
          >
            <BackIcon />
            <span className="ml-1">Back</span>
          </Link>
        </nav>

        <article className="bg-sand-50 rounded-2xl overflow-hidden shadow-sm print:shadow-none print:rounded-none">
          {recipe.image && (
            <div className="aspect-[21/9] overflow-hidden bg-sand-200 print:hidden">
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 md:p-10">
            <header className="mb-8 pb-6 border-b border-sand-200 print:border-sand-300">
              <h1 className="text-xl md:text-2xl font-medium tracking-tight-headline text-sand-900 mb-4">
                {recipe.title}
              </h1>

              <MetadataRow recipe={recipe} />

              {sourceUrl && (
                <p className="mt-4 text-xs text-sand-500 print:hidden">
                  Originally from{' '}
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sand-600 hover:text-sand-800 underline underline-offset-2"
                  >
                    {new URL(sourceUrl).hostname}
                  </a>
                </p>
              )}
            </header>

            <div className="grid md:grid-cols-[1fr,1.5fr] gap-8 md:gap-10">
              <section aria-labelledby="ingredients-heading">
                <h2
                  id="ingredients-heading"
                  className="text-sm font-medium text-sand-900 mb-4 uppercase tracking-wide"
                >
                  Ingredients
                </h2>
                <ul className="space-y-2">
                  {recipe.ingredients.map((ingredient, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2.5 text-sand-700 text-sm leading-relaxed"
                    >
                      <span className="w-1 h-1 rounded-full bg-sand-400 mt-2 flex-shrink-0" aria-hidden="true" />
                      <span>{formatFraction(ingredient)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="instructions-heading">
                <h2
                  id="instructions-heading"
                  className="text-sm font-medium text-sand-900 mb-4 uppercase tracking-wide"
                >
                  Instructions
                </h2>
                <ol className="space-y-4">
                  {recipe.instructions.map((instruction, index) => (
                    <li
                      key={index}
                      className="flex gap-3 text-sand-700 text-sm leading-relaxed"
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sand-200 text-sand-600 text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <ActionButtons recipe={recipe} sourceUrl={sourceUrl} />
          </div>
        </article>
      </div>
    </main>
  )
}

function MetadataRow({ recipe }) {
  const { prepTime, cookTime, servings } = recipe

  if (!prepTime && !cookTime && !servings) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {prepTime && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sand-200/60 text-sand-700 text-xs">
          <ClockIcon />
          Prep: {prepTime}
        </span>
      )}
      {cookTime && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sand-200/60 text-sand-700 text-xs">
          <ClockIcon />
          Cook: {cookTime}
        </span>
      )}
      {servings && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sand-200/60 text-sand-700 text-xs">
          <ServingsIcon />
          {servings} servings
        </span>
      )}
    </div>
  )
}

function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}

function ServingsIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export default RecipeDisplay
