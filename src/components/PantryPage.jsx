import { useState, useEffect, useCallback } from 'react';
import PantryInput from './PantryInput';
import {
  getPantryItems,
  removePantryItem,
  addPantryItems,
  clearPantry,
  isFirstPantryUse,
  markPantryOnboardingSeen,
  COMMON_STAPLES
} from '../utils/pantry';

function PackageIcon({ className = "w-12 h-12" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
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

function SparklesIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function PantryItem({ item, onRemove }) {
  return (
    <button
      onClick={() => onRemove(item.id)}
      className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-sand-100 hover:bg-sand-200 rounded-full transition-colors text-sm"
      aria-label={`Remove ${item.name} from pantry`}
    >
      <span className="text-sand-700 capitalize">{item.name}</span>
      <XIcon className="w-3 h-3 text-sand-400 group-hover:text-sand-600" />
    </button>
  );
}

function StaplesOnboarding({ onAddStaples, onDismiss }) {
  return (
    <div className="bg-sand-50 border border-sand-200 rounded-xl p-5 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sand-100 flex items-center justify-center text-sand-500">
          <SparklesIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sand-900 text-sm mb-1">
            Quick start with common staples?
          </h3>
          <p className="text-sand-600 text-xs mb-3">
            Add items like salt, pepper, olive oil, and garlic that most kitchens already have.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onAddStaples}
              className="inline-flex items-center px-3 py-1.5 bg-sand-900 text-white text-xs font-medium rounded-lg hover:bg-sand-800 transition-colors"
            >
              Add staples
            </button>
            <button
              onClick={onDismiss}
              className="inline-flex items-center px-3 py-1.5 text-sand-600 text-xs hover:text-sand-800 transition-colors"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-sand-50 rounded-2xl p-12 text-center">
      <div className="flex justify-center mb-4">
        <div className="w-20 h-20 rounded-full bg-sand-100 flex items-center justify-center text-sand-400">
          <PackageIcon className="w-12 h-12" />
        </div>
      </div>
      <h2 className="text-lg font-medium text-sand-900 mb-2">
        Your pantry is empty
      </h2>
      <p className="text-sand-600 text-sm mb-2 max-w-sm mx-auto">
        Add ingredients you have on hand, and we'll show you which recipes you can make.
      </p>
    </div>
  );
}

export default function PantryPage() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const updateItems = useCallback(() => {
    setItems(getPantryItems());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Check for first use
    if (isFirstPantryUse()) {
      setShowOnboarding(true);
    }
    updateItems();

    window.addEventListener('pantry-changed', updateItems);
    return () => window.removeEventListener('pantry-changed', updateItems);
  }, [updateItems]);

  const handleRemove = useCallback((id) => {
    removePantryItem(id);
  }, []);

  const handleAddStaples = useCallback(() => {
    addPantryItems(COMMON_STAPLES);
    setShowOnboarding(false);
  }, []);

  const handleDismissOnboarding = useCallback(() => {
    markPantryOnboardingSeen();
    setShowOnboarding(false);
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Remove all items from your pantry?')) {
      clearPantry();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-sand-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-medium text-sand-900 flex items-center gap-2">
          My Pantry
          {items.length > 0 && (
            <span className="text-sand-500 font-normal">({items.length})</span>
          )}
        </h1>
        <p className="text-sand-600 text-sm mt-1">
          Add what you have, see what you can make
        </p>
      </header>

      {/* Onboarding prompt */}
      {showOnboarding && items.length === 0 && (
        <StaplesOnboarding
          onAddStaples={handleAddStaples}
          onDismiss={handleDismissOnboarding}
        />
      )}

      {/* Add ingredient input */}
      <div className="mb-6">
        <PantryInput />
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Ingredients grid */}
          <section aria-label="Pantry items">
            <div className="flex flex-wrap gap-2">
              {items.map(item => (
                <PantryItem
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </section>

          {/* Clear all button */}
          <div className="mt-8 pt-6 border-t border-sand-200">
            <button
              onClick={handleClearAll}
              className="text-sand-500 text-sm hover:text-sand-700 transition-colors"
            >
              Clear all items
            </button>
          </div>
        </>
      )}

    </div>
  );
}
