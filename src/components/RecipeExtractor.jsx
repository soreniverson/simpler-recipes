import { useState, useEffect, useCallback } from 'react';
import SmartInput from './SmartInput';

const EXAMPLE_RECIPES = [
  { name: "World's Best Lasagna", url: 'https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/' },
  { name: 'Banana Bread', url: 'https://www.allrecipes.com/recipe/20144/banana-banana-bread/' },
  { name: 'Chicken Tikka Masala', url: 'https://www.allrecipes.com/recipe/45736/chicken-tikka-masala/' },
  { name: 'Chocolate Chip Cookies', url: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/' },
  { name: 'Pad Thai', url: 'https://www.allrecipes.com/recipe/42968/pad-thai/' },
  { name: 'Homemade Pizza Dough', url: 'https://www.allrecipes.com/recipe/20171/quick-and-easy-pizza-crust/' },
  { name: 'Beef Stroganoff', url: 'https://www.allrecipes.com/recipe/16311/simple-beef-stroganoff/' },
  { name: 'Guacamole', url: 'https://www.allrecipes.com/recipe/14231/guacamole/' },
  { name: 'French Onion Soup', url: 'https://www.allrecipes.com/recipe/13309/rich-and-simple-french-onion-soup/' },
  { name: 'Chicken Parmesan', url: 'https://www.allrecipes.com/recipe/223042/chicken-parmesan/' },
];

export default function RecipeExtractor() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Cycle through recipes
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % EXAMPLE_RECIPES.length);
        setIsAnimating(false);
      }, 200);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const currentRecipe = EXAMPLE_RECIPES[currentIndex];

  const handleExampleClick = useCallback(() => {
    const input = document.querySelector('input[aria-label="Paste a URL or search recipes"]');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, currentRecipe.url);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  }, [currentRecipe.url]);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12">
      {/* Left side - Text content */}
      <div className="flex-1 lg:max-w-lg">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-sand-900 tracking-tight mb-4">
          Get clean, ad-free recipes in an instant.
        </h1>
        <p className="text-sand-600 text-base md:text-lg mb-8">
          Paste any recipe URL and skip the life stories, pop-ups, and endless scrolling.
        </p>

        <SmartInput
          variant="default"
          placeholder="Paste a URL or search recipes..."
        />

        <p className="mt-5 text-sand-500 text-sm">
          Try it with{' '}
          <button
            onClick={handleExampleClick}
            className="text-sand-700 hover:text-sand-900 underline underline-offset-2 transition-colors inline-block min-w-[140px] text-left"
          >
            <span
              className={`inline-block transition-all duration-200 ${
                isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
              }`}
            >
              {currentRecipe.name}
            </span>
          </button>
        </p>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block flex-shrink-0 w-80 xl:w-96">
        <div className="aspect-square rounded-2xl bg-sand-200 flex items-center justify-center overflow-hidden">
          {/* Placeholder - replace with actual image */}
          <div className="text-sand-400 text-center p-8">
            <svg className="w-16 h-16 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Hero image placeholder</p>
          </div>
        </div>
      </div>
    </div>
  );
}
