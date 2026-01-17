import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import LoadingState from './LoadingState'
import ErrorState from './ErrorState'
import ActionButtons from './ActionButtons'

function SharedRecipe() {
  const { id } = useParams()
  const [recipe, setRecipe] = useState(null)
  const [sourceUrl, setSourceUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const response = await fetch(`/api/share/${id}`)
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
  }, [id])

  if (loading) {
    return <LoadingState message="Loading shared recipe..." />
  }

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <nav className="no-print mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm"
          >
            <BackIcon />
            <span className="ml-1">Extract your own recipe</span>
          </Link>
        </nav>

        <article className="bg-sand-50 rounded-2xl shadow-md p-6 md:p-10">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight-headline text-sand-900 mb-4">
              {recipe.title}
            </h1>

            {recipe.image && (
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-full h-64 object-cover rounded-xl mb-5"
              />
            )}

            <MetadataRow recipe={recipe} />
          </header>

          <section aria-labelledby="ingredients-heading" className="mb-10">
            <h2 id="ingredients-heading" className="text-lg font-medium text-sand-900 mb-4">
              Ingredients
            </h2>
            <ul className="space-y-2.5">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index} className="flex items-start text-sand-800">
                  <span className="text-sand-400 mr-3 select-none" aria-hidden="true">–</span>
                  <span>{ingredient}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="instructions-heading">
            <h2 id="instructions-heading" className="text-lg font-medium text-sand-900 mb-4">
              Instructions
            </h2>
            <ol className="space-y-5">
              {recipe.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 border border-sand-300 text-sand-500 rounded-full flex items-center justify-center text-xs font-medium mr-4 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sand-800 leading-relaxed">{instruction}</span>
                </li>
              ))}
            </ol>
          </section>

          <ActionButtons recipe={recipe} sourceUrl={sourceUrl} />

          {sourceUrl && (
            <footer className="mt-10 pt-6 border-t border-sand-200 no-print">
              <p className="text-sand-400 text-sm">
                Source:{' '}
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sand-600 hover:text-sand-900 transition-colors"
                >
                  {new URL(sourceUrl).hostname}
                </a>
              </p>
            </footer>
          )}
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
    <div className="flex flex-wrap gap-5 text-sm text-sand-600">
      {prepTime && (
        <div className="flex items-center gap-1.5">
          <ClockIcon />
          <span>Prep: {prepTime}</span>
        </div>
      )}
      {cookTime && (
        <div className="flex items-center gap-1.5">
          <ClockIcon />
          <span>Cook: {cookTime}</span>
        </div>
      )}
      {servings && (
        <div className="flex items-center gap-1.5">
          <ServingsIcon />
          <span>Serves: {servings}</span>
        </div>
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
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ServingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

export default SharedRecipe
