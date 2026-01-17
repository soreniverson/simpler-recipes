import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import LoadingState from './LoadingState'
import ErrorState from './ErrorState'
import { getCollectionIcon } from '../utils/collectionIcons'

function CollectionPage() {
  const { slug } = useParams()
  const [collection, setCollection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchCollection() {
      try {
        const response = await fetch(`/api/recipes/collection/${slug}`)
        if (!response.ok) {
          throw new Error('Collection not found')
        }
        const data = await response.json()
        setCollection(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCollection()
  }, [slug])

  if (loading) {
    return <LoadingState message="Loading recipes..." />
  }

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="max-w-[1080px] mx-auto px-4 py-8 md:py-12">
        <nav className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm"
          >
            <BackIcon />
            <span className="ml-1">Back</span>
          </Link>
        </nav>

        <header className="flex items-start gap-4 mb-10">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-sand-200/60 flex items-center justify-center text-sand-600">
            {getCollectionIcon(slug, "w-6 h-6")}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-medium tracking-tight-headline text-sand-900 mb-1">
              {collection.theme.name}
            </h1>
            <p className="text-sand-600 text-sm">
              {collection.theme.description}
            </p>
            <p className="text-sand-400 text-xs mt-2">
              {collection.metadata.recipeCount} recipes
            </p>
          </div>
        </header>

        <section aria-label="Recipes in this collection">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collection.recipes.map((recipe) => (
              <li key={recipe.slug}>
                <Link
                  to={`/recipes/${recipe.slug}`}
                  className="block h-full bg-sand-50 rounded-xl overflow-hidden hover:bg-sand-100/80 transition-all group"
                >
                  <article>
                    {recipe.image ? (
                      <div className="aspect-[4/3] overflow-hidden bg-sand-200">
                        <img
                          src={recipe.image}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-sand-200 flex items-center justify-center">
                        <PlaceholderIcon />
                      </div>
                    )}
                    <div className="p-4">
                      <h2 className="text-sand-900 font-medium text-sm group-hover:text-sand-950 transition-colors mb-2 line-clamp-2">
                        {recipe.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        {recipe.totalTime && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-600 text-xs">
                            <ClockIcon />
                            {recipe.totalTime}
                          </span>
                        )}
                        {recipe.servings && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-600 text-xs">
                            {recipe.servings} servings
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}

function PlaceholderIcon() {
  return (
    <svg className="w-8 h-8 text-sand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

export default CollectionPage
