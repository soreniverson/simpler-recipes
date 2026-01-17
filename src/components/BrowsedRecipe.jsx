import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import LoadingState from './LoadingState'
import ErrorState from './ErrorState'
import { formatFraction } from '../utils/formatFraction'

function BrowsedRecipe() {
  const { slug } = useParams()
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchRecipe() {
      try {
        const response = await fetch(`/api/recipes/${slug}`)
        if (!response.ok) {
          throw new Error('Recipe not found')
        }
        const data = await response.json()
        setRecipe(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRecipe()
  }, [slug])

  const handlePrint = () => {
    window.print()
  }

  const handleCopyIngredients = async () => {
    if (!recipe) return

    const ingredientText = recipe.ingredients.map(i => formatFraction(i)).join('\n')
    try {
      await navigator.clipboard.writeText(ingredientText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (loading) {
    return <LoadingState message="Loading recipe..." />
  }

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="max-w-[1080px] mx-auto px-4 py-8 md:py-12">
        <nav className="mb-6 flex items-center justify-between print:hidden">
          <Link
            to="/"
            className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm"
          >
            <BackIcon />
            <span className="ml-1">Back</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyIngredients}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label="Copy ingredients to clipboard"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label="Print recipe"
            >
              <PrintIcon />
              <span>Print</span>
            </button>
          </div>
        </nav>

        <article className="bg-sand-50 rounded-2xl overflow-hidden shadow-sm print:shadow-none print:rounded-none">
          {/* Hero Image */}
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

              {recipe.source && (
                <p className="mt-4 text-xs text-sand-500">
                  Originally from{' '}
                  <a
                    href={recipe.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sand-600 hover:text-sand-800 underline underline-offset-2"
                  >
                    {recipe.source.name}
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

            {recipe.tags && recipe.tags.length > 0 && (
              <footer className="mt-8 pt-6 border-t border-sand-200 print:hidden">
                <div className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs text-sand-500 bg-sand-100 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </footer>
            )}
          </div>
        </article>
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

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}

export default BrowsedRecipe
