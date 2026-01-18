import { useState, useMemo } from 'react'

const EXAMPLE_RECIPES = [
  { name: "World's Best Lasagna", url: 'https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/' },
  { name: 'Banana Bread', url: 'https://www.allrecipes.com/recipe/20144/banana-banana-bread/' },
  { name: 'Chicken Tikka Masala', url: 'https://www.allrecipes.com/recipe/45736/chicken-tikka-masala/' },
  { name: 'Chocolate Chip Cookies', url: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/' },
  { name: 'Pad Thai', url: 'https://www.allrecipes.com/recipe/42968/pad-thai/' },
]

function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center px-4 z-50">
      <div className="text-center" role="status" aria-live="polite">
        <div className="inline-block w-8 h-8 border-2 border-sand-300 border-t-sand-700 rounded-full animate-spin mb-4"></div>
        <p className="text-sand-600 text-base">{message}</p>
      </div>
    </div>
  )
}

export default function RecipeExtractor() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

      // Store recipe data and navigate
      sessionStorage.setItem('extractedRecipe', JSON.stringify({
        recipe: data,
        sourceUrl: url.trim()
      }))
      window.location.href = '/recipe'
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

        {error && (
          <p id="url-error" className="text-red-600 text-sm" role="alert">
            {error}
          </p>
        )}

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
  )
}
