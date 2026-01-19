import { useState, useEffect, useCallback, useRef } from 'react';
import RecipeCard from './RecipeCard';
import {
  getCuratedFavorites,
  getExtractedFavorites,
  removeExtractedFavorite,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveFavorite,
  getFavoritesInFolder,
  getFolderCount
} from '../utils/favorites';

function HeartIcon({ className = "w-12 h-12", filled = false }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function FolderIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}

function ImagePlaceholder() {
  return (
    <svg className="w-8 h-8 text-sand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function FolderCard({ folder, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 bg-sand-50 rounded-xl hover:bg-sand-100 transition-colors text-left w-full"
    >
      <div className="w-10 h-10 rounded-lg bg-sand-200 flex items-center justify-center text-sand-500">
        <FolderIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sand-900 text-sm truncate">{folder.name}</h3>
        <p className="text-xs text-sand-500">{count} {count === 1 ? 'recipe' : 'recipes'}</p>
      </div>
    </button>
  );
}

function CheckIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CreateFolderButton({ onCreate }) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const formRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      setName('');
      setIsCreating(false);
    }
  };

  const handleCancel = useCallback(() => {
    setIsCreating(false);
    setName('');
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Click outside to cancel
  useEffect(() => {
    if (!isCreating) return;

    const handleClickOutside = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCreating, handleCancel]);

  if (isCreating) {
    return (
      <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-3 p-4 bg-sand-50 rounded-xl">
        <div className="w-10 h-10 rounded-lg bg-sand-200 flex items-center justify-center text-sand-500">
          <FolderIcon className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Folder name"
          className="flex-1 min-w-0 px-0 py-0 text-sm font-medium text-sand-900 bg-transparent border-none focus:outline-none placeholder:text-sand-400"
          autoFocus
        />
        {name.trim() && (
          <button
            type="submit"
            className="w-7 h-7 rounded-md bg-sand-900 text-white flex items-center justify-center hover:bg-sand-800 transition-colors"
            aria-label="Create folder"
          >
            <CheckIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </form>
    );
  }

  return (
    <button
      onClick={() => setIsCreating(true)}
      className="flex items-center gap-3 p-4 bg-sand-50 rounded-xl hover:bg-sand-100 transition-colors text-left w-full border-2 border-dashed border-sand-200"
    >
      <div className="w-10 h-10 rounded-lg bg-sand-100 flex items-center justify-center text-sand-400">
        <PlusIcon className="w-5 h-5" />
      </div>
      <span className="text-sm text-sand-500">New folder</span>
    </button>
  );
}

function MoveToFolderMenu({ folders, currentFolderId, onMove, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-sand-200 z-20 overflow-hidden">
      <div className="px-3 py-2 border-b border-sand-100">
        <span className="text-xs font-medium text-sand-500">Move to folder</span>
      </div>
      <div className="py-1">
        <button
          onClick={() => { onMove(null); onClose(); }}
          className={`w-full px-3 py-2 text-left text-sm hover:bg-sand-50 transition-colors flex items-center gap-2 ${!currentFolderId ? 'text-sand-900 font-medium' : 'text-sand-600'}`}
        >
          {!currentFolderId && <CheckIcon className="w-3 h-3" />}
          <span className={!currentFolderId ? '' : 'ml-5'}>Unfiled</span>
        </button>
        {folders.map(folder => (
          <button
            key={folder.id}
            onClick={() => { onMove(folder.id); onClose(); }}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-sand-50 transition-colors flex items-center gap-2 ${folder.id === currentFolderId ? 'text-sand-900 font-medium' : 'text-sand-600'}`}
          >
            {folder.id === currentFolderId && <CheckIcon className="w-3 h-3" />}
            <span className={folder.id === currentFolderId ? '' : 'ml-5'}>{folder.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExtractedRecipeCard({ item, onRemove, folders, onMove }) {
  const { id, recipe, sourceUrl, folderId } = item;
  const [showMenu, setShowMenu] = useState(false);

  const handleClick = () => {
    localStorage.setItem('simpler-recipes-extracted', JSON.stringify({
      recipe,
      sourceUrl,
      savedId: id
    }));
    window.location.href = '/recipe';
  };

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(id);
  };

  const totalTime = recipe.totalTime || recipe.prepTime || recipe.cookTime;

  return (
    <div className="relative h-full bg-sand-50 rounded-xl overflow-hidden hover:bg-sand-100/80 transition-all group">
      {/* Action buttons */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        {folders.length > 0 && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1.5 rounded-full transition-all duration-200 text-sand-500 hover:text-sand-700 bg-sand-200/80 hover:bg-sand-300 flex items-center justify-center"
              aria-label="Move to folder"
              title="Move to folder"
            >
              <FolderIcon className="w-4 h-4" />
            </button>
            {showMenu && (
              <MoveToFolderMenu
                folders={folders}
                currentFolderId={folderId}
                onMove={(targetId) => onMove(id, 'extracted', targetId)}
                onClose={() => setShowMenu(false)}
              />
            )}
          </div>
        )}
        <button
          onClick={handleRemove}
          className="p-1.5 rounded-full transition-all duration-200 text-sand-700 hover:text-sand-800 bg-sand-200 hover:bg-sand-300 flex items-center justify-center"
          aria-label="Remove from favorites"
        >
          <HeartIcon filled className="w-4 h-4" />
        </button>
      </div>

      <button onClick={handleClick} className="block h-full w-full text-left">
        <article className="h-full flex flex-col">
          {recipe.image ? (
            <div className="aspect-[4/3] overflow-hidden bg-sand-200">
              <img
                src={recipe.image}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="aspect-[4/3] bg-sand-200 flex items-center justify-center">
              <ImagePlaceholder />
            </div>
          )}
          <div className="p-4 flex-1 flex flex-col">
            <h2 className="text-sand-900 font-medium text-sm group-hover:text-sand-950 transition-colors mb-2 line-clamp-2">
              {recipe.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-auto">
              {totalTime && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-200/60 text-sand-600 text-xs">
                  <ClockIcon />
                  {totalTime}
                </span>
              )}
              {sourceUrl && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-100 text-sand-500 text-xs">
                  {new URL(sourceUrl).hostname.replace('www.', '')}
                </span>
              )}
            </div>
          </div>
        </article>
      </button>
    </div>
  );
}

function CuratedRecipeCard({ recipe, folders, currentFolderId, onMove }) {
  const [showMenu, setShowMenu] = useState(false);

  if (folders.length === 0) {
    return <RecipeCard recipe={recipe} />;
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowMenu(!showMenu); }}
            className="p-1.5 rounded-full transition-all duration-200 text-sand-500 hover:text-sand-700 bg-sand-200/80 hover:bg-sand-300 flex items-center justify-center"
            aria-label="Move to folder"
            title="Move to folder"
          >
            <FolderIcon className="w-4 h-4" />
          </button>
          {showMenu && (
            <MoveToFolderMenu
              folders={folders}
              currentFolderId={currentFolderId}
              onMove={(targetId) => onMove(recipe.slug, 'curated', targetId)}
              onClose={() => setShowMenu(false)}
            />
          )}
        </div>
      </div>
      <RecipeCard recipe={recipe} />
    </div>
  );
}

function FolderView({ folder, items, recipes, folders, onBack, onRename, onDelete, onRemoveExtracted, onMove }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const handleRename = (e) => {
    e.preventDefault();
    if (editName.trim()) {
      onRename(folder.id, editName.trim());
      setIsEditing(false);
    }
  };

  const extractedItems = items.filter(i => i.type === 'extracted');
  const curatedSlugs = items.filter(i => i.type === 'curated').map(i => i.slug);
  const curatedItems = recipes.filter(r => curatedSlugs.includes(r.slug));

  return (
    <div>
      <header className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm mb-4"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span className="ml-1">Back</span>
        </button>

        <div className="flex items-center justify-between">
          {isEditing ? (
            <form onSubmit={handleRename} className="flex items-center gap-2 flex-1 mr-4">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-1.5 text-lg font-medium bg-white border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sand-500"
                autoFocus
              />
              <button type="submit" className="px-3 py-1.5 text-sm bg-sand-900 text-white rounded-lg">Save</button>
              <button type="button" onClick={() => { setIsEditing(false); setEditName(folder.name); }} className="px-3 py-1.5 text-sm text-sand-600">Cancel</button>
            </form>
          ) : (
            <h1 className="text-lg font-medium text-sand-900 flex items-center gap-2">
              <FolderIcon className="w-5 h-5 text-sand-500" />
              {folder.name}
              <span className="text-sand-500 font-normal">({items.length})</span>
            </h1>
          )}

          {!isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-sand-500 hover:text-sand-700 transition-colors"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${folder.name}"? Recipes will be moved to Unfiled.`)) {
                    onDelete(folder.id);
                    onBack();
                  }
                }}
                className="text-sm text-sand-500 hover:text-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="bg-sand-50 rounded-2xl p-12 text-center">
          <p className="text-sand-600 text-sm">No recipes in this folder yet.</p>
          <p className="text-sand-500 text-xs mt-2">Use the menu on any recipe to move it here.</p>
        </div>
      ) : (
        <section aria-label="Recipes in folder">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {extractedItems.map(item => (
              <li key={item.id}>
                <ExtractedRecipeCard
                  item={item}
                  onRemove={onRemoveExtracted}
                  folders={folders}
                  onMove={onMove}
                />
              </li>
            ))}
            {curatedItems.map(recipe => (
              <li key={recipe.slug}>
                <CuratedRecipeCard
                  recipe={recipe}
                  folders={folders}
                  currentFolderId={folder.id}
                  onMove={onMove}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function FavoritesPage({ recipes }) {
  const [folders, setFolders] = useState([]);
  const [allFavorites, setAllFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState(null);

  const updateData = useCallback(() => {
    setFolders(getFolders());
    const curatedSlugs = getCuratedFavorites();
    const extracted = getExtractedFavorites();

    // Merge curated with full recipe data including folderId
    const curatedWithFolder = curatedSlugs.map(slug => {
      const recipe = recipes.find(r => r.slug === slug);
      const favItem = getFavoritesInFolder(null).find(f => f.type === 'curated' && f.slug === slug)
        || folders.flatMap(folder => getFavoritesInFolder(folder.id)).find(f => f.type === 'curated' && f.slug === slug);
      return recipe ? { ...recipe, folderId: favItem?.folderId } : null;
    }).filter(Boolean);

    setAllFavorites([...extracted, ...curatedWithFolder.map(r => ({ type: 'curated', slug: r.slug, folderId: r.folderId }))]);
    setIsLoading(false);
  }, [recipes]);

  useEffect(() => {
    updateData();
    window.addEventListener('favorites-changed', updateData);
    return () => window.removeEventListener('favorites-changed', updateData);
  }, [updateData]);

  const handleCreateFolder = useCallback((name) => {
    createFolder(name);
  }, []);

  const handleRemoveExtracted = useCallback((id) => {
    removeExtractedFavorite(id);
  }, []);

  const handleMove = useCallback((itemId, type, folderId) => {
    moveFavorite(itemId, type, folderId);
  }, []);

  // Get unfiled items
  const unfiledItems = allFavorites.filter(f => !f.folderId);
  const unfiledExtracted = getExtractedFavorites().filter(e => !e.folderId);
  const unfiledCuratedSlugs = getCuratedFavorites().filter(slug => {
    const item = allFavorites.find(f => f.type === 'curated' && f.slug === slug);
    return !item?.folderId;
  });
  const unfiledCurated = recipes.filter(r => unfiledCuratedSlugs.includes(r.slug));

  const totalCount = allFavorites.length;

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-sand-500">Loading...</p>
      </div>
    );
  }

  // Show folder view if a folder is selected
  if (activeFolder) {
    const folder = folders.find(f => f.id === activeFolder);
    if (!folder) {
      setActiveFolder(null);
      return null;
    }
    const folderItems = getFavoritesInFolder(activeFolder);
    return (
      <FolderView
        folder={folder}
        items={folderItems}
        recipes={recipes}
        folders={folders}
        onBack={() => setActiveFolder(null)}
        onRename={renameFolder}
        onDelete={deleteFolder}
        onRemoveExtracted={handleRemoveExtracted}
        onMove={handleMove}
      />
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-medium text-sand-900 flex items-center gap-2">
          Favorites
          {totalCount > 0 && (
            <span className="text-sand-500 font-normal">({totalCount})</span>
          )}
        </h1>
      </header>

      {totalCount === 0 && folders.length === 0 ? (
        <div className="bg-sand-50 rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-sand-100 flex items-center justify-center text-sand-400">
              <HeartIcon className="w-12 h-12" />
            </div>
          </div>
          <h2 className="text-lg font-medium text-sand-900 mb-2">
            No favorites yet
          </h2>
          <p className="text-sand-600 text-sm mb-6 max-w-sm mx-auto">
            Browse recipes or paste a URL to extract one, then tap the heart icon to save it here.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-colors text-sm"
          >
            Browse Recipes
          </a>
        </div>
      ) : (
        <>
          {/* Folders section */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-sand-700 mb-3">Folders</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map(folder => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  count={getFolderCount(folder.id)}
                  onClick={() => setActiveFolder(folder.id)}
                />
              ))}
              <CreateFolderButton onCreate={handleCreateFolder} />
            </div>
          </section>

          {/* Unfiled recipes */}
          {(unfiledExtracted.length > 0 || unfiledCurated.length > 0) && (
            <section>
              <h2 className="text-sm font-medium text-sand-700 mb-3">
                Unfiled
                <span className="text-sand-500 font-normal ml-2">({unfiledExtracted.length + unfiledCurated.length})</span>
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {unfiledExtracted.map(item => (
                  <li key={item.id}>
                    <ExtractedRecipeCard
                      item={item}
                      onRemove={handleRemoveExtracted}
                      folders={folders}
                      onMove={handleMove}
                    />
                  </li>
                ))}
                {unfiledCurated.map(recipe => (
                  <li key={recipe.slug}>
                    <CuratedRecipeCard
                      recipe={recipe}
                      folders={folders}
                      currentFolderId={null}
                      onMove={handleMove}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
