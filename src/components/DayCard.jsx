import { MEAL_SECTIONS } from '../utils/mealPlan';

function PlusIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ImagePlaceholder() {
  return (
    <svg className="w-5 h-5 text-sand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function MealItem({ meal, dateKey, section, onRemove }) {
  const handleClick = () => {
    if (meal.recipeSlug) {
      window.location.href = `/recipes/${meal.recipeSlug}`;
    } else if (meal.extractedRecipe) {
      localStorage.setItem('simpler-recipes-extracted', JSON.stringify({
        recipe: meal.extractedRecipe,
        sourceUrl: meal.extractedRecipe.sourceUrl || '',
        savedId: meal.id
      }));
      window.location.href = '/recipe';
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(dateKey, section, meal.id);
  };

  return (
    <div
      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-sand-100 transition-colors cursor-pointer group"
      onClick={handleClick}
    >
      {meal.recipeImage ? (
        <img
          src={meal.recipeImage}
          alt=""
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-sand-200 flex items-center justify-center flex-shrink-0">
          <ImagePlaceholder />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-sand-800 truncate block">{meal.recipeTitle}</span>
        <span className="text-xs text-sand-500">{SECTION_LABELS[section]}</span>
      </div>
      <button
        onClick={handleRemove}
        className="p-1.5 text-sand-400 hover:text-sand-600 hover:bg-sand-200 rounded-md opacity-0 group-hover:opacity-100 transition-all"
        aria-label={`Remove ${meal.recipeTitle}`}
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function DayCard({ date, dateKey, meals, onAddMeal, onRemoveMeal }) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();

  // Flatten all meals into a single list with their section info
  const allMeals = MEAL_SECTIONS.flatMap(section =>
    meals[section].map(meal => ({ ...meal, section }))
  );

  return (
    <div className={`bg-sand-50 rounded-xl overflow-hidden ${isToday ? 'ring-2 ring-sand-400' : ''}`}>
      {/* Day header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg ${isToday ? 'bg-sand-900 text-white' : 'bg-sand-200 text-sand-700'}`}>
            <span className="text-[10px] font-medium uppercase leading-none">
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
            <span className="text-lg font-semibold leading-none mt-0.5">
              {date.getDate()}
            </span>
          </div>
          <div>
            <h3 className="font-medium text-sand-900">{dayName}</h3>
            {allMeals.length === 0 && (
              <p className="text-xs text-sand-500">No meals planned</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onAddMeal(dateKey, 'dinner')}
          className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-200 rounded-lg transition-colors"
          aria-label="Add meal"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Meals list */}
      {allMeals.length > 0 && (
        <div className="px-4 pb-4 pt-0 space-y-1">
          {allMeals.map(meal => (
            <MealItem
              key={meal.id}
              meal={meal}
              dateKey={dateKey}
              section={meal.section}
              onRemove={onRemoveMeal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
