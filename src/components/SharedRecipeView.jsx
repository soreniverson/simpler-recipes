import { useState, useEffect } from 'react'
import ScalableIngredients from './ScalableIngredients'

function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center" role="status" aria-live="polite">
        <div className="inline-block w-8 h-8 border-2 border-sand-300 border-t-sand-700 rounded-full animate-spin mb-4"></div>
        <p className="text-sand-600 text-base">{message}</p>
      </div>
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-sand-400 text-4xl mb-6">:/</p>
        <h1 className="text-xl font-medium text-sand-900 mb-2">Something went wrong</h1>
        <p className="text-sand-600 mb-8" role="alert">{message}</p>
        <a
          href="/"
          className="inline-block bg-sand-950 hover:bg-sand-900 text-sand-50 font-medium py-3 px-6 rounded-lg transition-all text-sm shadow-sm hover:shadow-md"
        >
          Try another recipe
        </a>
      </div>
    </main>
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

export default function SharedRecipeView({ recipeId: propRecipeId }) {
  const [recipe, setRecipe] = useState(null)
  const [sourceUrl, setSourceUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Use prop if provided, otherwise extract from URL (fallback for client-side routing)
    let recipeId = propRecipeId
    if (!recipeId && typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/')
      recipeId = pathParts[pathParts.length - 1]
    }

    if (!recipeId) {
      setError('No recipe ID provided')
      setLoading(false)
      return
    }

    const fetchRecipe = async () => {
      try {
        const response = await fetch(`/api/share/${recipeId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Recipe not found')
        }

        setRecipe(data.recipe)
        setSourceUrl(data.sourceUrl)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRecipe()
  }, [propRecipeId])

  if (loading) {
    return <LoadingState message="Loading shared recipe..." />
  }

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="max-w-[1080px] mx-auto px-4 py-8 md:py-12">
        <nav className="mb-6 print:hidden">
          <a
            href="/"
            className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm"
          >
            <BackIcon />
            <span className="ml-1">Extract your own recipe</span>
          </a>
        </nav>

        {/* Two-column layout for desktop */}
        <div className="lg:grid lg:grid-cols-[1fr,340px] lg:gap-8 lg:items-start">
          {/* Main content card (left) */}
          <article className="bg-sand-50 rounded-2xl overflow-hidden shadow-sm print:shadow-none print:rounded-none">
            {recipe.image && (
              <div className="aspect-[16/9] lg:aspect-[2/1] overflow-hidden bg-sand-200 print:hidden">
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-6 md:p-8">
              <header className="mb-8 pb-6 border-b border-sand-200 print:border-sand-300">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight-headline text-sand-900 mb-4">
                  {recipe.title}
                </h1>

                <div className="flex flex-wrap items-center gap-2">
                  {recipe.prepTime && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sand-200/60 text-sand-700 text-xs">
                      <ClockIcon />
                      Prep: {recipe.prepTime}
                    </span>
                  )}
                  {recipe.cookTime && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sand-200/60 text-sand-700 text-xs">
                      <ClockIcon />
                      Cook: {recipe.cookTime}
                    </span>
                  )}
                  {recipe.servings && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sand-200/60 text-sand-700 text-xs">
                      <ServingsIcon />
                      {recipe.servings} servings
                    </span>
                  )}
                </div>

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

              {/* Instructions */}
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
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sand-200 text-sand-600 text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </article>

          {/* Ingredients sidebar (right) - shown below on mobile, sticky on desktop */}
          <aside className="mt-6 lg:mt-0 lg:sticky lg:top-8">
            <ScalableIngredients
              ingredients={recipe.ingredients}
              servings={recipe.servings}
            />
          </aside>
        </div>
      </div>
    </main>
  )
}
