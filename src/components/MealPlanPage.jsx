import { useState, useEffect, useCallback } from 'react';
import DayCard from './DayCard';
import AddMealModal from './AddMealModal';
import ShoppingListSheet from './ShoppingListSheet';
import {
  getWeekStart,
  getWeekDays,
  formatDateKey,
  getMealsForWeek,
  addMeal,
  removeMeal
} from '../utils/mealPlan';
import { generateShoppingListWithRecipes, getShoppingList, getListStats } from '../utils/shoppingList';

function ChevronLeftIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function ShoppingListIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function formatWeekHeader(weekStart) {
  const options = { month: 'short', day: 'numeric' };
  const endDate = new Date(weekStart);
  endDate.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toLocaleDateString('en-US', options);
  const endStr = endDate.toLocaleDateString('en-US', options);

  return `${startStr} - ${endStr}`;
}

export default function MealPlanPage({ recipes = [] }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [weekMeals, setWeekMeals] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState({ isOpen: false, dateKey: null, section: null });
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);
  const [shoppingListStats, setShoppingListStats] = useState({ total: 0, unchecked: 0 });

  const updateMeals = useCallback(() => {
    const meals = getMealsForWeek(weekStart);
    setWeekMeals(meals);
    setIsLoading(false);
  }, [weekStart]);

  useEffect(() => {
    updateMeals();
    window.addEventListener('meal-plan-changed', updateMeals);
    return () => window.removeEventListener('meal-plan-changed', updateMeals);
  }, [updateMeals]);

  const handlePrevWeek = useCallback(() => {
    setWeekStart(prev => {
      const newStart = new Date(prev);
      newStart.setDate(prev.getDate() - 7);
      return newStart;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart(prev => {
      const newStart = new Date(prev);
      newStart.setDate(prev.getDate() + 7);
      return newStart;
    });
  }, []);

  const handleToday = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
  }, []);

  const handleAddMeal = useCallback((dateKey, section) => {
    setModalState({ isOpen: true, dateKey, section });
  }, []);

  const handleRemoveMeal = useCallback((dateKey, section, mealId) => {
    removeMeal(dateKey, section, mealId);
  }, []);

  const handleSelectRecipe = useCallback((recipe) => {
    if (!modalState.dateKey || !modalState.section) return;

    const meal = recipe.slug
      ? {
          recipeSlug: recipe.slug,
          recipeTitle: recipe.title,
          recipeImage: recipe.image || null
        }
      : {
          recipeSlug: null,
          recipeTitle: recipe.title,
          recipeImage: recipe.image || null,
          extractedRecipe: recipe
        };

    addMeal(modalState.dateKey, modalState.section, meal);
    setModalState({ isOpen: false, dateKey: null, section: null });
  }, [modalState]);

  const handleCloseModal = useCallback(() => {
    setModalState({ isOpen: false, dateKey: null, section: null });
  }, []);

  const handleOpenShoppingList = useCallback(() => {
    // Generate/refresh the shopping list from current week's meals
    generateShoppingListWithRecipes(weekStart, recipes);
    setShoppingListStats(getListStats());
    setIsShoppingListOpen(true);
  }, [weekStart, recipes]);

  const handleCloseShoppingList = useCallback(() => {
    setIsShoppingListOpen(false);
  }, []);

  // Update shopping list stats when list changes
  useEffect(() => {
    const updateStats = () => {
      setShoppingListStats(getListStats());
    };
    window.addEventListener('shopping-list-changed', updateStats);
    return () => window.removeEventListener('shopping-list-changed', updateStats);
  }, []);

  const weekDays = getWeekDays(weekStart);
  const isCurrentWeek = formatDateKey(getWeekStart(new Date())) === formatDateKey(weekStart);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-sand-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with week navigation */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium text-sand-900">Meal Plan</h1>
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-xs font-medium text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
              >
                Today
              </button>
            )}
            <div className="flex items-center gap-1 bg-sand-100 rounded-lg p-1">
              <button
                onClick={handlePrevWeek}
                className="p-1.5 text-sand-600 hover:text-sand-900 hover:bg-sand-200 rounded-md transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="px-2 text-sm font-medium text-sand-700 min-w-[140px] text-center">
                {formatWeekHeader(weekStart)}
              </span>
              <button
                onClick={handleNextWeek}
                className="p-1.5 text-sand-600 hover:text-sand-900 hover:bg-sand-200 rounded-md transition-colors"
                aria-label="Next week"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleOpenShoppingList}
              className="relative p-2 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label="Shopping list"
            >
              <ShoppingListIcon className="w-5 h-5" />
              {shoppingListStats.unchecked > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] font-medium text-white bg-sand-900 rounded-full">
                  {shoppingListStats.unchecked > 9 ? '9+' : shoppingListStats.unchecked}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Day cards */}
      <div className="bg-sand-50 rounded-xl overflow-hidden divide-y divide-sand-200">
        {weekDays.map(day => {
          const dateKey = formatDateKey(day);
          const dayMeals = weekMeals[dateKey] || { breakfast: [], lunch: [], dinner: [], snack: [], dessert: [] };

          return (
            <DayCard
              key={dateKey}
              date={day}
              dateKey={dateKey}
              meals={dayMeals}
              onAddMeal={handleAddMeal}
              onRemoveMeal={handleRemoveMeal}
            />
          );
        })}
      </div>

      {/* Add Meal Modal */}
      <AddMealModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        onSelectRecipe={handleSelectRecipe}
        dateKey={modalState.dateKey}
        section={modalState.section}
        recipes={recipes}
      />

      {/* Shopping List Sheet */}
      <ShoppingListSheet
        isOpen={isShoppingListOpen}
        onClose={handleCloseShoppingList}
      />
    </div>
  );
}
