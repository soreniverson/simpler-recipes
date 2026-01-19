import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getShoppingList,
  toggleItem,
  removeItem,
  addCustomItem,
  clearCheckedItems,
  addCheckedToPantry,
  getShareableList,
  getListStats,
  getEventName,
  CATEGORY_ORDER,
  CATEGORY_LABELS
} from '../utils/shoppingList';
import { formatIngredient } from '../utils/ingredientParser';

function XIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function PantryIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function ShareIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  );
}

function ShoppingItem({ item, onToggle, onRemove }) {
  const displayText = formatIngredient(item);

  return (
    <div className={`flex items-start gap-3 py-2 ${item.checked ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onToggle(item.id)}
        className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
          item.checked
            ? 'bg-sand-700 border-sand-700 text-white'
            : 'border-sand-400 hover:border-sand-500'
        }`}
        aria-label={item.checked ? 'Mark as not purchased' : 'Mark as purchased'}
      >
        {item.checked && <CheckIcon className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm ${item.checked ? 'line-through text-sand-500' : 'text-sand-900'}`}>
          {displayText}
        </span>
        {item.inPantry && !item.checked && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600">
            <PantryIcon className="w-3 h-3" />
            in pantry
          </span>
        )}
        {item.recipes && item.recipes.length > 0 && (
          <p className="text-xs text-sand-500 mt-0.5 truncate">
            {item.recipes.join(', ')}
          </p>
        )}
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="flex-shrink-0 p-1 text-sand-400 hover:text-sand-600 hover:bg-sand-200 rounded transition-colors opacity-0 group-hover:opacity-100"
        aria-label={`Remove ${item.name}`}
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function CategorySection({ category, items, onToggle, onRemove }) {
  if (items.length === 0) return null;

  const uncheckedItems = items.filter(i => !i.checked);
  const checkedItems = items.filter(i => i.checked);

  return (
    <div className="mb-6">
      <h3 className="text-xs font-medium text-sand-500 uppercase tracking-wide mb-2">
        {CATEGORY_LABELS[category] || category}
      </h3>
      <div className="space-y-1">
        {uncheckedItems.map(item => (
          <div key={item.id} className="group">
            <ShoppingItem item={item} onToggle={onToggle} onRemove={onRemove} />
          </div>
        ))}
        {checkedItems.map(item => (
          <div key={item.id} className="group">
            <ShoppingItem item={item} onToggle={onToggle} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Toast({ message, isVisible, onHide }) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onHide, 2500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-sand-900 text-white text-sm rounded-lg shadow-lg">
      {message}
    </div>
  );
}

export default function ShoppingListSheet({ isOpen, onClose }) {
  const [list, setList] = useState({ items: [] });
  const [stats, setStats] = useState({ total: 0, checked: 0, unchecked: 0, percentComplete: 0 });
  const [newItemText, setNewItemText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [toast, setToast] = useState({ message: '', isVisible: false });
  const sheetRef = useRef(null);
  const inputRef = useRef(null);

  const showToast = useCallback((message) => {
    setToast({ message, isVisible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast(t => ({ ...t, isVisible: false }));
  }, []);

  const updateList = useCallback(() => {
    setList(getShoppingList());
    setStats(getListStats());
  }, []);

  useEffect(() => {
    updateList();
    window.addEventListener(getEventName(), updateList);
    return () => window.removeEventListener(getEventName(), updateList);
  }, [updateList]);

  // Focus input when add form opens
  useEffect(() => {
    if (showAddForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAddForm]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (showAddForm) {
          setShowAddForm(false);
          setNewItemText('');
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showAddForm]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleToggle = useCallback((itemId) => {
    toggleItem(itemId);
  }, []);

  const handleRemove = useCallback((itemId) => {
    removeItem(itemId);
  }, []);

  const handleAddItem = useCallback((e) => {
    e.preventDefault();
    if (newItemText.trim()) {
      addCustomItem(newItemText.trim());
      setNewItemText('');
      setShowAddForm(false);
    }
  }, [newItemText]);

  const handleClearChecked = useCallback(() => {
    clearCheckedItems();
  }, []);

  const handleAddToPantry = useCallback(() => {
    const count = addCheckedToPantry();
    if (count > 0) {
      showToast(`Added ${count} item${count > 1 ? 's' : ''} to pantry`);
    }
  }, [showToast]);

  const handleShare = useCallback(async () => {
    const text = getShareableList();

    try {
      // Try native share first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: 'Shopping List',
          text: text
        });
      } else {
        // Fall back to clipboard
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
      }
    } catch (err) {
      // User cancelled or error - try clipboard as fallback
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
      } catch {
        showToast('Unable to share');
      }
    }
  }, [showToast]);

  // Group items by category
  const itemsByCategory = {};
  CATEGORY_ORDER.forEach(cat => {
    itemsByCategory[cat] = list.items.filter(item => item.category === cat);
  });

  // Count checked items that aren't already in pantry (eligible for "Add to Pantry")
  const checkedNotInPantry = list.items.filter(i => i.checked && !i.inPantry).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel - side panel on desktop, bottom sheet on mobile */}
      <div
        ref={sheetRef}
        className="absolute bg-surface shadow-xl flex flex-col overflow-hidden
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
          sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:w-96 sm:h-full sm:max-h-full sm:rounded-none sm:rounded-l-2xl"
      >
        {/* Handle bar - mobile only */}
        <div className="flex justify-center py-3 sm:hidden">
          <div className="w-10 h-1 bg-sand-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-0 sm:pt-4 border-b border-sand-200">
          <div>
            <h2 className="text-lg font-medium text-sand-900">Shopping List</h2>
            {stats.total > 0 && (
              <p className="text-sm text-sand-500">
                {stats.checked} of {stats.total} items
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {stats.total > 0 && (
              <button
                onClick={handleShare}
                className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors"
                aria-label="Share list"
              >
                <ShareIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {stats.total > 0 && (
          <div className="h-1 bg-sand-100">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${stats.percentComplete}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 relative">
          {list.items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sand-600 mb-2">No items in your shopping list</p>
              <p className="text-sm text-sand-500">
                Generate a list from your meal plan to get started
              </p>
            </div>
          ) : (
            <>
              {CATEGORY_ORDER.map(category => (
                <CategorySection
                  key={category}
                  category={category}
                  items={itemsByCategory[category]}
                  onToggle={handleToggle}
                  onRemove={handleRemove}
                />
              ))}
            </>
          )}
          <Toast message={toast.message} isVisible={toast.isVisible} onHide={hideToast} />
        </div>

        {/* Footer actions */}
        <div className="border-t border-sand-200 p-4 bg-sand-50">
          {showAddForm ? (
            <form onSubmit={handleAddItem} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="Add item (e.g., 2 cups flour)"
                className="flex-1 px-3 py-2 text-sm bg-surface border border-sand-300 rounded-lg text-sand-900 placeholder:text-sand-500 focus:outline-none focus:ring-2 focus:ring-sand-400"
              />
              <button
                type="submit"
                disabled={!newItemText.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-sand-800 rounded-lg hover:bg-sand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewItemText('');
                }}
                className="px-3 py-2 text-sm font-medium text-sand-600 hover:text-sand-800 transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-sand-700 bg-surface border border-sand-300 rounded-lg hover:bg-sand-100 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Item
              </button>
              {checkedNotInPantry > 0 && (
                <button
                  onClick={handleAddToPantry}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                  title="Add checked items to your pantry"
                >
                  <PantryIcon className="w-4 h-4" />
                  To Pantry
                </button>
              )}
              {stats.checked > 0 && checkedNotInPantry === 0 && (
                <button
                  onClick={handleClearChecked}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-sand-600 bg-surface border border-sand-300 rounded-lg hover:bg-sand-100 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                  Clear Done
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
