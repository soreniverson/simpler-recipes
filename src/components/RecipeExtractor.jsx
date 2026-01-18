import { useMemo } from 'react';
import SmartInput from './SmartInput';

const EXAMPLE_RECIPES = [
  { name: "World's Best Lasagna", url: 'https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/' },
  { name: 'Banana Bread', url: 'https://www.allrecipes.com/recipe/20144/banana-banana-bread/' },
  { name: 'Chicken Tikka Masala', url: 'https://www.allrecipes.com/recipe/45736/chicken-tikka-masala/' },
  { name: 'Chocolate Chip Cookies', url: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/' },
  { name: 'Pad Thai', url: 'https://www.allrecipes.com/recipe/42968/pad-thai/' },
];

export default function RecipeExtractor({ recipes = [] }) {
  const exampleRecipe = useMemo(() => {
    return EXAMPLE_RECIPES[Math.floor(Math.random() * EXAMPLE_RECIPES.length)];
  }, []);

  const handleExampleClick = () => {
    // Find the input and set its value
    const input = document.querySelector('input[aria-label="Paste a URL or search recipes"]');
    if (input) {
      // Trigger React's onChange by setting value and dispatching event
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, exampleRecipe.url);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  };

  return (
    <div className="text-center max-w-xl mx-auto">
      <p className="text-sand-600 text-lg mb-6">
        Paste any recipe URL and get a clean, ad-free version
      </p>

      <SmartInput
        recipes={recipes}
        variant="default"
        placeholder="Paste a URL or search recipes..."
      />

      <p className="mt-5 text-sand-500 text-sm">
        Try it with{' '}
        <button
          onClick={handleExampleClick}
          className="text-sand-700 hover:text-sand-900 underline underline-offset-2 transition-colors"
        >
          {exampleRecipe.name}
        </button>
      </p>
    </div>
  );
}
