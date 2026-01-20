import { useState, useEffect } from 'react';
import RemixModal from './RemixModal';

function SparklesIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

export default function RemixButton({ recipe, variant = 'default', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [savedMessage, setSavedMessage] = useState('');

  // Load all recipes for the selector
  useEffect(() => {
    async function loadRecipes() {
      try {
        const response = await fetch('/api/recipes/all');
        if (response.ok) {
          const data = await response.json();
          setRecipes(data.recipes || []);
        }
      } catch (err) {
        console.error('Failed to load recipes:', err);
      }
    }
    loadRecipes();
  }, []);

  const handleSave = (newRecipe, id) => {
    setSavedMessage('Recipe saved to favorites!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  // Convert recipe prop to the expected format if needed
  const normalizedRecipe = {
    title: recipe.title,
    ingredients: recipe.ingredients || [],
    instructions: recipe.instructions || [],
    prepTime: recipe.prepTime || null,
    cookTime: recipe.cookTime || null,
    servings: recipe.servings || null,
    image: recipe.image || null,
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors ${className}`}
          aria-label="Remix recipe"
          title="Remix recipe"
        >
          <SparklesIcon className="w-5 h-5" />
        </button>

        {savedMessage && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-sand-900 text-sand-50 px-4 py-2 rounded-lg shadow-lg text-sm">
            {savedMessage}
          </div>
        )}

        <RemixModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          baseRecipe={normalizedRecipe}
          recipes={recipes}
          onSave={handleSave}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium py-2.5 px-4 rounded-lg transition-all text-sm ${className}`}
      >
        <SparklesIcon className="w-4 h-4" />
        Remix
      </button>

      {savedMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-sand-900 text-sand-50 px-4 py-2 rounded-lg shadow-lg text-sm">
          {savedMessage}
        </div>
      )}

      <RemixModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        baseRecipe={normalizedRecipe}
        recipes={recipes}
        onSave={handleSave}
      />
    </>
  );
}
