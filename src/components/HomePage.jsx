import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import LoadingState from './LoadingState'
import ErrorState from './ErrorState'

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
  const navigate = useNavigate()

  const exampleRecipe = useMemo(() => {
    return EXAMPLE_RECIPES[Math.floor(Math.random() * EXAMPLE_RECIPES.length)]
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
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight-headline text-sand-900 mb-3">
          Simpler Recipes
        </h1>
        <p className="text-sand-600 mb-10 text-lg">
          Paste any recipe URL and get a clean, ad-free version you can read, print, or share.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full px-4 py-4 text-base border border-sand-300 rounded-lg focus:border-sand-500 focus:outline-none focus:ring-2 focus:ring-sand-200 transition-all bg-sand-50 shadow-xs"
              aria-describedby={error ? 'url-error' : undefined}
            />
          </div>

          {error && <ErrorState message={error} id="url-error" inline />}

          <button
            type="submit"
            className="w-full bg-sand-950 hover:bg-sand-900 text-sand-50 font-medium py-4 px-6 rounded-lg transition-all text-base shadow-sm hover:shadow-md"
          >
            Simplify Recipe
          </button>
        </form>

        <p className="mt-8 text-sand-500 text-sm">
          Try it with{' '}
          <button
            onClick={handleExampleClick}
            className="text-sand-700 hover:text-sand-900 underline underline-offset-2 transition-colors"
          >
            {exampleRecipe.name}
          </button>
        </p>

        <footer className="mt-20 text-sand-400 text-sm space-y-2">
          <p>Works with AllRecipes, Food Network, Serious Eats, and most recipe sites.</p>
          <p>
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
