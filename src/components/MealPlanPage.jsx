import { useState, useEffect, useCallback } from 'react';
import DayCard from './DayCard';
import AddMealModal from './AddMealModal';
import {
  getWeekStart,
  getWeekDays,
  formatDateKey,
  getMealsForWeek,
  hasAnyMealsForWeek,
  addMeal,
  removeMeal
} from '../utils/mealPlan';

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

function CalendarIcon({ className = "w-12 h-12" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
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

  const weekDays = getWeekDays(weekStart);
  const hasAnyMeals = hasAnyMealsForWeek(weekStart);
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
          </div>
        </div>
      </header>

      {/* Week view */}
      {!hasAnyMeals ? (
        <div className="bg-sand-50 rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-sand-100 flex items-center justify-center text-sand-400">
              <CalendarIcon className="w-12 h-12" />
            </div>
          </div>
          <h2 className="text-lg font-medium text-sand-900 mb-2">
            No meals planned
          </h2>
          <p className="text-sand-600 text-sm mb-6 max-w-sm mx-auto">
            Click the + button on any day to start planning your meals for the week.
          </p>
        </div>
      ) : null}

      {/* Day cards - always show even when empty */}
      <div className="space-y-4">
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
    </div>
  );
}
