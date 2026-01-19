import { useState, useEffect, useRef, useMemo } from 'react';
import { MEAL_SECTIONS } from '../utils/mealPlan';
import { getFavorites } from '../utils/favorites';

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

const SECTION_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  dessert: 'Dessert'
};

function RecipeItem({ recipe, isFavorite, onSelect }) {
  return (
    <button
      onClick={() => onSelect(recipe)}
      className="flex items-center gap-3 p-3 w-full text-left rounded-xl hover:bg-sand-100 transition-colors"
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
        {recipe.totalTime && (
          <span className="text-xs text-sand-500">{recipe.totalTime}</span>
        )}
      </div>
    </button>
  );
}

export default function AddMealModal({ isOpen, onClose, onSelectRecipe, dateKey, section, recipes }) {
  const [selectedSection, setSelectedSection] = useState(section || 'dinner');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState([]);
  const modalRef = useRef(null);
  const searchInputRef = useRef(null);

  // Update selected section when prop changes
  useEffect(() => {
    if (section) {
      setSelectedSection(section);
    }
  }, [section]);

  // Load favorites
  useEffect(() => {
    if (isOpen) {
      const favs = getFavorites();
      setFavorites(favs);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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

  // Build list of recipes: favorites first (with full data), then others
  const { favoriteRecipes, otherRecipes } = useMemo(() => {
    const favoriteSlugs = new Set(favorites.filter(f => f.type === 'curated').map(f => f.slug));
    const extractedFavorites = favorites.filter(f => f.type === 'extracted');

    // Get curated favorites with full recipe data
    const curatedFavoriteRecipes = recipes.filter(r => favoriteSlugs.has(r.slug));

    // Convert extracted favorites to recipe format
    const extractedRecipes = extractedFavorites.map(f => ({
      ...f.recipe,
      id: f.id,
      sourceUrl: f.sourceUrl,
      isExtracted: true
    }));

    // Combine favorites
    const allFavoriteRecipes = [...curatedFavoriteRecipes, ...extractedRecipes];

    // Other recipes (non-favorites)
    const otherRecipes = recipes.filter(r => !favoriteSlugs.has(r.slug));

    return { favoriteRecipes: allFavoriteRecipes, otherRecipes };
  }, [recipes, favorites]);

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

  const handleSelect = (recipe) => {
    onSelectRecipe(recipe);
  };

  if (!isOpen) return null;

  const dateObj = dateKey ? new Date(dateKey + 'T12:00:00') : new Date();
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-surface w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sand-200">
          <div>
            <h2 className="text-lg font-medium text-sand-900">Add Meal</h2>
            <p className="text-sm text-sand-500">{dateStr}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Meal type picker */}
        <div className="px-4 py-3 border-b border-sand-100">
          <div className="flex gap-1 bg-sand-100 rounded-lg p-1 overflow-x-auto">
            {MEAL_SECTIONS.map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`flex-1 min-w-fit px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedSection === sec
                    ? 'bg-surface text-sand-900 shadow-sm'
                    : 'text-sand-600 hover:text-sand-800'
                }`}
              >
                {SECTION_LABELS[sec]}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-sand-100">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-sand-50 border border-sand-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sand-300 focus:border-sand-300"
            />
          </div>
        </div>

        {/* Recipe list */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredFavorites.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-medium text-sand-500 uppercase tracking-wide mb-2">
                Favorites
              </h3>
              <div className="space-y-1">
                {filteredFavorites.map(recipe => (
                  <RecipeItem
                    key={recipe.slug || recipe.id}
                    recipe={recipe}
                    isFavorite={true}
                    onSelect={handleSelect}
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
                {filteredOthers.map(recipe => (
                  <RecipeItem
                    key={recipe.slug}
                    recipe={recipe}
                    isFavorite={false}
                    onSelect={handleSelect}
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
    </div>
  );
}
