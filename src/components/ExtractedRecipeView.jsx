import { useState, useEffect, useCallback } from 'react'
import ScalableIngredients from './ScalableIngredients'
import RecipeInstructions from './RecipeInstructions'
import { addExtractedFavorite, isExtractedFavorite, removeExtractedFavorite } from '../utils/favorites'

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

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  )
}

function HeartIcon({ filled, className = "w-4 h-4" }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

export default function ExtractedRecipeView() {
  const [recipe, setRecipe] = useState(null)
  const [sourceUrl, setSourceUrl] = useState(null)
  const [shareUrl, setShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showLastFreeBanner, setShowLastFreeBanner] = useState(false)

  useEffect(() => {
    // Get recipe data from localStorage
    const stored = localStorage.getItem('simpler-recipes-extracted')
    if (stored) {
      const data = JSON.parse(stored)
      setRecipe(data.recipe)
      setSourceUrl(data.sourceUrl)
      // Check if this was the last free extraction
      if (data.isLastFree) {
        setShowLastFreeBanner(true)
        // Clear the flag so it doesn't show again on refresh
        data.isLastFree = false
        localStorage.setItem('simpler-recipes-extracted', JSON.stringify(data))
      }
      // Check if this recipe is already saved
      if (data.savedId && isExtractedFavorite(data.savedId)) {
        setSavedId(data.savedId)
      }
    } else {
      // Redirect to home if no recipe data
      window.location.href = '/'
    }
  }, [])

  const handleSave = useCallback(() => {
    if (savedId) {
      // Remove from favorites
      removeExtractedFavorite(savedId)
      setSavedId(null)
      // Update localStorage
      const stored = localStorage.getItem('simpler-recipes-extracted')
      if (stored) {
        const data = JSON.parse(stored)
        delete data.savedId
        localStorage.setItem('simpler-recipes-extracted', JSON.stringify(data))
      }
    } else {
      // Add to favorites
      const newId = addExtractedFavorite(recipe, sourceUrl)
      setSavedId(newId)
      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), 300)
      // Store the ID in localStorage so we can track it
      const stored = localStorage.getItem('simpler-recipes-extracted')
      if (stored) {
        const data = JSON.parse(stored)
        data.savedId = newId
        localStorage.setItem('simpler-recipes-extracted', JSON.stringify(data))
      }
    }
  }, [savedId, recipe, sourceUrl])

  const handleShare = async () => {
    setShareLoading(true)
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe, sourceUrl }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create share link')

      const url = `${window.location.origin}/r/${data.id}`
      setShareUrl(url)
      try {
        await navigator.clipboard.writeText(url)
      } catch {}
    } catch (err) {
      console.error('Share failed:', err)
    } finally {
      setShareLoading(false)
    }
  }

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-2 border-sand-300 border-t-sand-700 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="max-w-[1080px] mx-auto px-4 py-8 md:py-12">
        <nav className="mb-6 print:hidden">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'}
            className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm"
          >
            <BackIcon />
            <span className="ml-1">Back</span>
          </button>
        </nav>

        {/* Last free extraction banner */}
        {showLastFreeBanner && (
          <div className="mb-6 bg-sand-100 border border-sand-300 rounded-xl p-4 print:hidden">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-sand-200 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-sand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sand-900 font-medium text-sm">This was your last free extraction</p>
                <p className="text-sand-600 text-sm mt-1">
                  Create a free account to continue extracting recipes and sync across devices.
                </p>
                <button
                  className="mt-3 text-sm font-medium text-sand-900 hover:text-sand-700 underline underline-offset-2"
                  onClick={() => {
                    // TODO: Implement account creation
                    alert('Account creation coming soon!')
                  }}
                >
                  Create free account
                </button>
              </div>
              <button
                onClick={() => setShowLastFreeBanner(false)}
                className="flex-shrink-0 text-sand-400 hover:text-sand-600 transition-colors"
                aria-label="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

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
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h1 className="text-2xl md:text-3xl font-medium tracking-tight-headline text-sand-900">
                    {recipe.title}
                  </h1>
                  <button
                    onClick={handleSave}
                    className={`
                      flex-shrink-0 p-2.5 rounded-full transition-all duration-200 print:hidden
                      ${savedId
                        ? 'text-sand-700 hover:text-sand-800 bg-sand-200 hover:bg-sand-300'
                        : 'text-sand-400 hover:text-sand-600 hover:bg-sand-100'
                      }
                      ${isAnimating ? 'scale-125' : 'scale-100'}
                    `}
                    aria-label={savedId ? 'Remove from favorites' : 'Save to favorites'}
                    aria-pressed={!!savedId}
                  >
                    <HeartIcon filled={!!savedId} className="w-6 h-6" />
                  </button>
                </div>

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
              <RecipeInstructions
                instructions={recipe.instructions}
                recipeName={recipe.title}
              />

              {/* Share section */}
              <div className="no-print mt-8 pt-6 border-t border-sand-200">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleShare}
                    disabled={shareLoading}
                    className="flex items-center gap-2 bg-sand-950 hover:bg-sand-900 text-sand-50 font-medium py-2.5 px-4 rounded-lg transition-all text-sm shadow-sm hover:shadow-md disabled:opacity-50"
                  >
                    <ShareIcon />
                    {shareLoading ? 'Creating...' : 'Share Recipe'}
                  </button>
                </div>

                {shareUrl && (
                  <div className="mt-4 p-4 bg-sand-100 border border-sand-200 rounded-lg">
                    <p className="text-sand-700 text-sm mb-2">Link copied to clipboard</p>
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="w-full text-sm py-2 px-3 border border-sand-300 rounded-md bg-sand-50 text-sand-700"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                )}
              </div>
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
