import { useState, useEffect, useRef, useMemo } from 'react';
import { getFavorites, addExtractedFavorite } from '../utils/favorites';

function XIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SearchIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function SparklesIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function ImagePlaceholder() {
  return (
    <svg className="w-6 h-6 text-sand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function HeartIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  );
}

function RecipeItem({ recipe, isFavorite, onSelect, isSelected }) {
  return (
    <button
      onClick={() => onSelect(recipe)}
      className={`flex items-center gap-3 p-3 w-full text-left rounded-xl transition-colors ${
        isSelected
          ? 'bg-sand-200 ring-2 ring-sand-400'
          : 'hover:bg-sand-100'
      }`}
    >
      {recipe.image ? (
        <img
          src={recipe.image}
          alt=""
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-sand-200 flex items-center justify-center flex-shrink-0">
          <ImagePlaceholder />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-sand-900 truncate">{recipe.title}</span>
          {isFavorite && (
            <HeartIcon className="w-3 h-3 text-rose-500 flex-shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
}

function RecipePreview({ recipe, label }) {
  return (
    <div className="bg-sand-100 rounded-xl p-4 flex-1 min-w-0">
      <p className="text-xs font-medium text-sand-500 uppercase tracking-wide mb-2">{label}</p>
      {recipe.image && (
        <img
          src={recipe.image}
          alt=""
          className="w-full h-24 object-cover rounded-lg mb-3"
        />
      )}
      <h3 className="font-medium text-sand-900 text-sm truncate">{recipe.title}</h3>
      <p className="text-xs text-sand-500 mt-1">
        {recipe.ingredients?.length || 0} ingredients
      </p>
    </div>
  );
}

function ResultRecipeView({ recipe }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-sand-900">{recipe.title}</h3>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {recipe.prepTime && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-700 text-xs">
              Prep: {recipe.prepTime}
            </span>
          )}
          {recipe.cookTime && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-700 text-xs">
              Cook: {recipe.cookTime}
            </span>
          )}
          {recipe.servings && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-700 text-xs">
              {recipe.servings} servings
            </span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr,1.5fr] gap-4">
        <div>
          <h4 className="text-sm font-medium text-sand-700 mb-2">Ingredients</h4>
          <ul className="space-y-1">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="text-sm text-sand-600">{ing}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-medium text-sand-700 mb-2">Instructions</h4>
          <ol className="space-y-2">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="text-sm text-sand-600">
                <span className="font-medium text-sand-700">{i + 1}.</span> {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function RemixModal({ isOpen, onClose, baseRecipe, recipes = [], onSave }) {
  const [mode, setMode] = useState('prompt'); // 'prompt' or 'recipe'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState('input'); // 'input', 'loading', 'result'
  const [progressMessage, setProgressMessage] = useState('');
  const [resultRecipe, setResultRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const modalRef = useRef(null);
  const searchInputRef = useRef(null);
  const promptInputRef = useRef(null);

  // Load favorites
  useEffect(() => {
    if (isOpen) {
      const favs = getFavorites();
      setFavorites(favs);
      setSearchQuery('');
      setSelectedRecipe(null);
      setPrompt('');
      setStep('input');
      setResultRecipe(null);
      setError(null);
    }
  }, [isOpen]);

  // Focus appropriate input when mode changes
  useEffect(() => {
    if (isOpen && step === 'input') {
      setTimeout(() => {
        if (mode === 'recipe' && searchInputRef.current) {
          searchInputRef.current.focus();
        } else if (mode === 'prompt' && promptInputRef.current) {
          promptInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, mode, step]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Build list of recipes: favorites first, then others
  const { favoriteRecipes, otherRecipes } = useMemo(() => {
    const favoriteSlugs = new Set(favorites.filter(f => f.type === 'curated').map(f => f.slug));
    const extractedFavorites = favorites.filter(f => f.type === 'extracted');

    // Get curated favorites with full recipe data
    const curatedFavoriteRecipes = recipes.filter(r => r.slug && favoriteSlugs.has(r.slug));

    // Convert extracted favorites to recipe format
    const extractedRecipes = extractedFavorites.map(f => ({
      ...f.recipe,
      id: f.id,
      sourceUrl: f.sourceUrl,
      isExtracted: true
    }));

    // Combine favorites (excluding current base recipe)
    const allFavoriteRecipes = [...curatedFavoriteRecipes, ...extractedRecipes]
      .filter(r => r.title !== baseRecipe?.title);

    // Other recipes (non-favorites, excluding base recipe)
    const other = recipes
      .filter(r => !favoriteSlugs.has(r.slug) && r.title !== baseRecipe?.title);

    return { favoriteRecipes: allFavoriteRecipes, otherRecipes: other };
  }, [recipes, favorites, baseRecipe]);

  // Filter by search query
  const filteredFavorites = useMemo(() => {
    if (!searchQuery.trim()) return favoriteRecipes;
    const query = searchQuery.toLowerCase();
    return favoriteRecipes.filter(r => r.title.toLowerCase().includes(query));
  }, [favoriteRecipes, searchQuery]);

  const filteredOthers = useMemo(() => {
    if (!searchQuery.trim()) return otherRecipes;
    const query = searchQuery.toLowerCase();
    return otherRecipes.filter(r => r.title.toLowerCase().includes(query));
  }, [otherRecipes, searchQuery]);

  const handleRemix = async () => {
    if (mode === 'recipe' && !selectedRecipe) return;
    if (mode === 'prompt' && !prompt.trim()) return;

    setStep('loading');
    setError(null);
    setProgressMessage('Starting remix...');

    try {
      const response = await fetch('/api/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRecipe,
          secondRecipe: mode === 'recipe' ? selectedRecipe : undefined,
          prompt: mode === 'prompt' ? prompt : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remix recipe');
      }

      // Handle SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by double newlines
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim()) continue;

          const lines = message.split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (eventType && eventData) {
            try {
              const data = JSON.parse(eventData);

              if (eventType === 'progress') {
                setProgressMessage(data.step);
              } else if (eventType === 'complete') {
                setResultRecipe(data.recipe);
                setStep('result');
              } else if (eventType === 'error') {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              console.error('Failed to parse SSE data:', parseErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Remix error:', err);
      setError(err.message || 'Failed to remix recipe');
      setStep('input');
    }
  };

  const handleSave = () => {
    if (!resultRecipe) return;
    const id = addExtractedFavorite(resultRecipe, null);
    if (onSave) {
      onSave(resultRecipe, id);
    }
    onClose();
  };

  const handleTryAgain = () => {
    setStep('input');
    setResultRecipe(null);
    setError(null);
  };

  if (!isOpen || !baseRecipe) return null;

  const canRemix = mode === 'recipe' ? !!selectedRecipe : prompt.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-surface w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sand-200">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-sand-600" />
            <h2 className="text-lg font-medium text-sand-900">Remix Recipe</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'input' && (
            <>
              {/* Recipe previews */}
              <div className="flex gap-3 mb-4">
                <RecipePreview recipe={baseRecipe} label="Base Recipe" />
                <div className="flex items-center text-2xl text-sand-300 font-light">+</div>
                <div className="bg-sand-100 rounded-xl p-4 flex-1 min-w-0 flex items-center justify-center">
                  {mode === 'recipe' && selectedRecipe ? (
                    <div className="text-center">
                      <p className="text-xs font-medium text-sand-500 uppercase tracking-wide mb-2">Mix With</p>
                      <h3 className="font-medium text-sand-900 text-sm">{selectedRecipe.title}</h3>
                    </div>
                  ) : mode === 'prompt' && prompt ? (
                    <div className="text-center">
                      <p className="text-xs font-medium text-sand-500 uppercase tracking-wide mb-2">Modification</p>
                      <p className="text-sm text-sand-700 line-clamp-3">"{prompt}"</p>
                    </div>
                  ) : (
                    <p className="text-sm text-sand-400">Select below</p>
                  )}
                </div>
              </div>

              {/* Mode tabs */}
              <div className="flex gap-1 bg-sand-100 rounded-lg p-1 mb-4">
                <button
                  onClick={() => setMode('prompt')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    mode === 'prompt'
                      ? 'bg-surface text-sand-900 shadow-sm'
                      : 'text-sand-600 hover:text-sand-800'
                  }`}
                >
                  Describe Changes
                </button>
                <button
                  onClick={() => setMode('recipe')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    mode === 'recipe'
                      ? 'bg-surface text-sand-900 shadow-sm'
                      : 'text-sand-600 hover:text-sand-800'
                  }`}
                >
                  Combine Recipes
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {mode === 'prompt' ? (
                <div className="space-y-3">
                  <textarea
                    ref={promptInputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe how you want to modify this recipe... e.g., 'make it spicier', 'add Thai flavors', 'make it vegetarian', 'use ingredients I have: chicken, rice, broccoli'"
                    className="w-full h-32 px-4 py-3 text-sm bg-sand-50 border border-sand-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sand-300 focus:border-sand-300 resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {['Make it spicier', 'Make it vegetarian', 'Add more protein', 'Simplify it'].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setPrompt(suggestion)}
                        className="px-3 py-1.5 text-xs bg-sand-100 hover:bg-sand-200 text-sand-700 rounded-full transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search recipes to combine..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-sand-50 border border-sand-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sand-300 focus:border-sand-300"
                    />
                  </div>

                  {/* Recipe list */}
                  <div className="max-h-48 overflow-y-auto">
                    {filteredFavorites.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-xs font-medium text-sand-500 uppercase tracking-wide mb-2">
                          Favorites
                        </h3>
                        <div className="space-y-1">
                          {filteredFavorites.slice(0, 5).map(recipe => (
                            <RecipeItem
                              key={recipe.slug || recipe.id}
                              recipe={recipe}
                              isFavorite={true}
                              isSelected={selectedRecipe?.title === recipe.title}
                              onSelect={setSelectedRecipe}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {filteredOthers.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-sand-500 uppercase tracking-wide mb-2">
                          {filteredFavorites.length > 0 ? 'All Recipes' : 'Recipes'}
                        </h3>
                        <div className="space-y-1">
                          {filteredOthers.slice(0, 10).map(recipe => (
                            <RecipeItem
                              key={recipe.slug}
                              recipe={recipe}
                              isFavorite={false}
                              isSelected={selectedRecipe?.title === recipe.title}
                              onSelect={setSelectedRecipe}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {filteredFavorites.length === 0 && filteredOthers.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-sand-500 text-sm">No recipes found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-2 border-sand-300 border-t-sand-700 rounded-full animate-spin mb-4"></div>
              <p className="text-sand-600 text-sm">{progressMessage}</p>
            </div>
          )}

          {step === 'result' && resultRecipe && (
            <ResultRecipeView recipe={resultRecipe} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-sand-200 p-4">
          {step === 'input' && (
            <button
              onClick={handleRemix}
              disabled={!canRemix}
              className="w-full flex items-center justify-center gap-2 bg-sand-950 hover:bg-sand-900 disabled:bg-sand-300 disabled:cursor-not-allowed text-sand-50 font-medium py-3 px-4 rounded-xl transition-all text-sm shadow-sm hover:shadow-md"
            >
              <SparklesIcon className="w-4 h-4" />
              Remix
            </button>
          )}

          {step === 'result' && (
            <div className="flex gap-3">
              <button
                onClick={handleTryAgain}
                className="flex-1 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium py-3 px-4 rounded-xl transition-colors text-sm"
              >
                Try Again
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-sand-950 hover:bg-sand-900 text-sand-50 font-medium py-3 px-4 rounded-xl transition-all text-sm shadow-sm hover:shadow-md"
              >
                Save Recipe
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
