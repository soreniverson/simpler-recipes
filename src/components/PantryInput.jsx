import { useState, useEffect, useCallback, useRef } from 'react';
import { addPantryItem, hasPantryItem } from '../utils/pantry';

function PlusIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// Cached suggestions data
let cachedSuggestions = null;
let suggestionsPromise = null;

async function loadSuggestions() {
  if (cachedSuggestions) {
    return cachedSuggestions;
  }

  if (suggestionsPromise) {
    return suggestionsPromise;
  }

  suggestionsPromise = fetch('/pantry-suggestions.json')
    .then(res => res.json())
    .then(data => {
      cachedSuggestions = data.ingredients || [];
      return cachedSuggestions;
    })
    .catch(err => {
      console.error('Failed to load pantry suggestions:', err);
      suggestionsPromise = null;
      return [];
    });

  return suggestionsPromise;
}

function SuggestionItem({ suggestion, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm transition-colors min-h-[44px] ${
        isSelected ? 'bg-sand-100 text-sand-900' : 'text-sand-700 hover:bg-sand-50'
      }`}
      role="option"
      aria-selected={isSelected}
    >
      {suggestion}
    </button>
  );
}

export default function PantryInput({ onAdd, placeholder = "Add an ingredient..." }) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDataLoaded, setIsDataLoaded] = useState(!!cachedSuggestions);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Load suggestions when input is focused
  const ensureSuggestions = useCallback(async () => {
    if (!isDataLoaded) {
      await loadSuggestions();
      setIsDataLoaded(true);
    }
  }, [isDataLoaded]);

  // Debounced search
  useEffect(() => {
    const trimmedQuery = value.trim().toLowerCase();
    if (trimmedQuery.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    setIsOpen(true);
    setSelectedIndex(-1);

    const timeoutId = setTimeout(async () => {
      await ensureSuggestions();

      if (cachedSuggestions) {
        // Filter suggestions that match the query and aren't already in pantry
        const filtered = cachedSuggestions
          .filter(s =>
            s.toLowerCase().includes(trimmedQuery) &&
            !hasPantryItem(s)
          )
          .slice(0, 8);
        setSuggestions(filtered);
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [value, ensureSuggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = useCallback((ingredientName) => {
    const name = ingredientName || value.trim();
    if (!name) return;

    const added = addPantryItem(name);
    if (added) {
      if (onAdd) onAdd(name);
      setValue('');
      setSuggestions([]);
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }, [value, onAdd]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();
        handleAdd();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleAdd(suggestions[selectedIndex]);
        } else if (value.trim()) {
          handleAdd();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, suggestions, selectedIndex, value, handleAdd]);

  const handleClear = useCallback(() => {
    setValue('');
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <PlusIcon className="w-5 h-5 text-sand-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            ensureSuggestions();
            if (value.trim().length >= 1) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-3 bg-surface border border-sand-300 rounded-xl text-sand-900 text-sm placeholder:text-sand-500 focus:outline-none focus:ring-2 focus:ring-sand-500 focus:border-sand-500 transition-all"
          aria-label="Add ingredient to pantry"
          aria-autocomplete="list"
          aria-controls={isOpen ? 'pantry-suggestions' : undefined}
          aria-expanded={isOpen}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-2 flex items-center justify-center text-sand-400 hover:text-sand-600 transition-colors w-8"
            aria-label="Clear input"
          >
            <ClearIcon />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          id="pantry-suggestions"
          className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-xl shadow-lg border border-sand-200 overflow-hidden z-50 max-h-80 overflow-y-auto"
          role="listbox"
          aria-label="Ingredient suggestions"
        >
          <div className="py-1">
            {suggestions.map((suggestion, index) => (
              <SuggestionItem
                key={suggestion}
                suggestion={suggestion}
                isSelected={index === selectedIndex}
                onClick={() => handleAdd(suggestion)}
              />
            ))}
          </div>
        </div>
      )}

      {isOpen && value.trim() && suggestions.length === 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-xl shadow-lg border border-sand-200 overflow-hidden z-50 p-4"
          role="status"
        >
          <p className="text-sm text-sand-600">
            Press Enter to add "{value.trim()}"
          </p>
        </div>
      )}
    </div>
  );
}
