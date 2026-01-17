import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import LoadingState from './LoadingState'
import ErrorState from './ErrorState'
import { getCollectionIcon } from '../utils/collectionIcons'

const EXAMPLE_RECIPES = [
  { name: 'World\'s Best Lasagna', url: 'https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/' },
  { name: 'Banana Bread', url: 'https://www.allrecipes.com/recipe/20144/banana-banana-bread/' },
  { name: 'Chicken Tikka Masala', url: 'https://www.allrecipes.com/recipe/45736/chicken-tikka-masala/' },
  { name: 'Chocolate Chip Cookies', url: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/' },
  { name: 'Pad Thai', url: 'https://www.allrecipes.com/recipe/42968/pad-thai/' },
]

function HomePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [collections, setCollections] = useState(null)
  const navigate = useNavigate()

  const exampleRecipe = useMemo(() => {
    return EXAMPLE_RECIPES[Math.floor(Math.random() * EXAMPLE_RECIPES.length)]
  }, [])

  useEffect(() => {
    async function fetchCollections() {
      try {
        const response = await fetch('/api/recipes')
        if (response.ok) {
          const data = await response.json()
          setCollections(data.collections)
        }
      } catch (err) {
        console.error('Failed to load collections:', err)
      }
    }
    fetchCollections()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!url.trim()) {
      setError('Please enter a recipe URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract recipe')
      }

      navigate('/recipe', { state: { recipe: data, sourceUrl: url.trim() } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExampleClick = () => {
    setUrl(exampleRecipe.url)
  }

  if (loading) {
    return <LoadingState message="Extracting recipe..." />
  }

  return (
    <main id="main-content" className="min-h-screen">
      <div className="max-w-[1080px] mx-auto px-4 py-8 md:py-12">
        {/* Hero Card */}
        <section className="bg-sand-50 rounded-2xl p-6 md:p-10 shadow-sm mb-8">
          <div className="max-w-lg">
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight-headline text-sand-900 mb-2">
              Simpler Recipes
            </h1>
            <p className="text-sand-600 mb-8">
              Paste any recipe URL and get a clean, ad-free version you can read, print, or share.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="url-input" className="sr-only">
                  Recipe URL
                </label>
                <input
                  id="url-input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste recipe URL here..."
                  className="w-full px-4 py-3 text-sm border border-sand-300 rounded-lg focus:border-sand-500 focus:outline-none focus:ring-2 focus:ring-sand-200 transition-all bg-white"
                  aria-describedby={error ? 'url-error' : undefined}
                />
              </div>

              {error && <ErrorState message={error} id="url-error" inline />}

              <button
                type="submit"
                className="w-full sm:w-auto bg-sand-950 hover:bg-sand-900 text-sand-50 font-medium py-3 px-8 rounded-lg transition-all text-sm"
              >
                Simplify Recipe
              </button>
            </form>

            <p className="mt-6 text-sand-500 text-sm">
              Try it with{' '}
              <button
                onClick={handleExampleClick}
                className="text-sand-700 hover:text-sand-900 underline underline-offset-2 transition-colors"
              >
                {exampleRecipe.name}
              </button>
            </p>
          </div>
        </section>

        {/* Recipe Collections */}
        {collections && collections.length > 0 && (
          <section aria-labelledby="collections-heading">
            <header className="mb-6">
              <h2
                id="collections-heading"
                className="text-lg font-medium text-sand-900"
              >
                Browse recipes
              </h2>
            </header>

            <nav aria-label="Recipe collections">
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {collections.map((collection) => (
                  <li key={collection.slug}>
                    <Link
                      to={`/collection/${collection.slug}`}
                      className="flex items-start gap-4 h-full bg-sand-50 rounded-xl p-5 hover:bg-sand-100/80 transition-all group"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sand-200/60 flex items-center justify-center text-sand-600 group-hover:bg-sand-200 group-hover:text-sand-700 transition-colors">
                        {getCollectionIcon(collection.slug, "w-5 h-5")}
                      </div>
                      <article className="flex-1 min-w-0">
                        <h3 className="font-medium text-sand-900 group-hover:text-sand-950 mb-1 text-sm">
                          {collection.name}
                        </h3>
                        <p className="text-xs text-sand-500 line-clamp-2">
                          {collection.description}
                        </p>
                        <p className="text-xs text-sand-400 mt-2">
                          {collection.recipeCount} recipes
                        </p>
                      </article>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-sand-200 text-center">
          <p className="text-sand-400 text-xs mb-1">
            Works with AllRecipes, Food Network, Serious Eats, and most recipe sites.
          </p>
          <p className="text-sand-400 text-xs">
            <Link to="/privacy" className="hover:text-sand-600 transition-colors">
              Privacy Policy
            </Link>
          </p>
        </footer>
      </div>
    </main>
  )
}

export default HomePage
