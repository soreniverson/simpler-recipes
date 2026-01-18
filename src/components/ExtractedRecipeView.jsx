import { useState, useEffect } from 'react'
import ScalableIngredients from './ScalableIngredients'

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

export default function ExtractedRecipeView() {
  const [recipe, setRecipe] = useState(null)
  const [sourceUrl, setSourceUrl] = useState(null)
  const [shareUrl, setShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)

  useEffect(() => {
    // Get recipe data from sessionStorage
    const stored = sessionStorage.getItem('extractedRecipe')
    if (stored) {
      const data = JSON.parse(stored)
      setRecipe(data.recipe)
      setSourceUrl(data.sourceUrl)
    } else {
      // Redirect to home if no recipe data
      window.location.href = '/'
    }
  }, [])

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
      <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-12">
        <nav className="mb-6 print:hidden">
          <a
            href="/"
            className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm"
          >
            <BackIcon />
            <span className="ml-1">Back</span>
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
