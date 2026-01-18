import { useState, useEffect, useCallback } from 'react';
import { isFavorite, toggleFavorite } from '../utils/favorites';

function HeartIcon({ filled, className = "w-5 h-5" }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

export default function FavoriteButton({
  slug,
  size = 'default', // 'small' | 'default' | 'large'
  showLabel = false,
  className = '',
}) {
  const [favorited, setFavorited] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check initial state on mount
  useEffect(() => {
    setFavorited(isFavorite(slug));

    // Listen for changes from other components
    const handleChange = () => {
      setFavorited(isFavorite(slug));
    };

    window.addEventListener('favorites-changed', handleChange);
    return () => window.removeEventListener('favorites-changed', handleChange);
  }, [slug]);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const newState = toggleFavorite(slug);
    setFavorited(newState);

    // Trigger animation
    if (newState) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [slug]);

  const sizeClasses = {
    small: 'p-1.5',
    default: 'p-2',
    large: 'p-2.5',
  };

  const iconSizes = {
    small: 'w-4 h-4',
    default: 'w-5 h-5',
    large: 'w-6 h-6',
  };

  return (
    <button
      onClick={handleClick}
      className={`
        ${sizeClasses[size]}
        rounded-full
        transition-all duration-200
        ${favorited
          ? 'text-sand-700 hover:text-sand-800 bg-sand-200 hover:bg-sand-300'
          : 'text-sand-400 hover:text-sand-600 hover:bg-sand-100'
        }
        ${isAnimating ? 'scale-125' : 'scale-100'}
        ${className}
      `}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorited}
    >
      <HeartIcon filled={favorited} className={iconSizes[size]} />
      {showLabel && (
        <span className="ml-1.5 text-sm">
          {favorited ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
}
