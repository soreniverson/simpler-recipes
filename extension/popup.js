// Recipe parsing utilities (same as server-side)

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str;

  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

function parseDuration(duration) {
  if (!duration) return null;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;

  const parts = [];
  if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} min`);

  return parts.join(' ') || null;
}

function parseInstructions(instructions) {
  if (!instructions) return [];

  if (typeof instructions === 'string') {
    return instructions
      .split(/\n|(?=\d+\.\s)/)
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }

  if (Array.isArray(instructions)) {
    return instructions.flatMap((item) => {
      if (typeof item === 'object' && item !== null) {
        if (item['@type'] === 'HowToStep') {
          return item.text || item.name || '';
        }
        if (item['@type'] === 'HowToSection') {
          return parseInstructions(item.itemListElement);
        }
        if (item.text) return item.text;
        if (item.name) return item.name;
      }
      if (typeof item === 'string') {
        return item.replace(/^\d+\.\s*/, '').trim();
      }
      return '';
    }).filter(Boolean);
  }

  return [];
}

function parseImage(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return parseImage(image[0]);
  if (typeof image === 'object') return image.url || image.contentUrl || null;
  return null;
}

function parseYield(recipeYield) {
  if (!recipeYield) return null;
  if (typeof recipeYield === 'number') return String(recipeYield);
  if (typeof recipeYield === 'string') return recipeYield;
  if (Array.isArray(recipeYield)) return recipeYield[0]?.toString() || null;
  return null;
}

function findRecipeInJsonLd(jsonLd) {
  if (!jsonLd) return null;

  if (jsonLd['@type'] === 'Recipe') return jsonLd;
  if (Array.isArray(jsonLd['@type']) && jsonLd['@type'].includes('Recipe')) return jsonLd;

  if (Array.isArray(jsonLd)) {
    for (const item of jsonLd) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  if (jsonLd['@graph'] && Array.isArray(jsonLd['@graph'])) {
    for (const item of jsonLd['@graph']) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  return null;
}

// Content script to inject and extract JSON-LD
function extractJsonLdFromPage() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const results = [];

  scripts.forEach(script => {
    try {
      const json = JSON.parse(script.textContent);
      results.push(json);
    } catch (e) {
      // Invalid JSON, skip
    }
  });

  return results;
}

// UI Functions
function showState(stateId) {
  document.querySelectorAll('.state').forEach(el => el.classList.add('hidden'));
  document.getElementById(stateId).classList.remove('hidden');
}

function showError(message) {
  document.getElementById('error-message').textContent = message;
  showState('error');
}

function renderRecipe(recipe, sourceUrl) {
  // Title
  document.getElementById('recipe-title').textContent = recipe.title;

  // Meta
  const metaHtml = [];
  if (recipe.prepTime) {
    metaHtml.push(`<span class="meta-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      Prep: ${recipe.prepTime}
    </span>`);
  }
  if (recipe.cookTime) {
    metaHtml.push(`<span class="meta-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      Cook: ${recipe.cookTime}
    </span>`);
  }
  if (recipe.servings) {
    metaHtml.push(`<span class="meta-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
      Serves: ${recipe.servings}
    </span>`);
  }
  document.getElementById('recipe-meta').innerHTML = metaHtml.join('');

  // Ingredients
  const ingredientsList = document.getElementById('ingredients-list');
  ingredientsList.innerHTML = recipe.ingredients
    .map(ing => `<li>${escapeHtml(ing)}</li>`)
    .join('');

  // Instructions
  const instructionsList = document.getElementById('instructions-list');
  instructionsList.innerHTML = recipe.instructions
    .map(inst => `<li>${escapeHtml(inst)}</li>`)
    .join('');

  // Source link
  const sourceLink = document.getElementById('source-link');
  try {
    const hostname = new URL(sourceUrl).hostname;
    sourceLink.href = sourceUrl;
    sourceLink.textContent = `Source: ${hostname}`;
  } catch {
    sourceLink.style.display = 'none';
  }

  // Set up actions
  document.getElementById('copy-btn').onclick = () => copyIngredients(recipe.ingredients);
  document.getElementById('print-btn').onclick = () => window.print();

  showState('recipe');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function copyIngredients(ingredients) {
  const text = ingredients.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copy-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M5 13l4 4L19 7"/>
    </svg> Copied!`;
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

// Main extraction logic
async function extractRecipe() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      showError('Could not access the current tab.');
      return;
    }

    // Inject and execute the extraction script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJsonLdFromPage,
    });

    if (!results || !results[0]?.result) {
      showError('Could not extract data from this page.');
      return;
    }

    const jsonLdScripts = results[0].result;

    // Find recipe in JSON-LD
    let recipeSchema = null;
    for (const script of jsonLdScripts) {
      recipeSchema = findRecipeInJsonLd(script);
      if (recipeSchema) break;
    }

    if (!recipeSchema) {
      showError('No recipe found on this page. Try a recipe page from AllRecipes, Food Network, or similar sites.');
      return;
    }

    // Parse the recipe
    const recipe = {
      title: decodeHtmlEntities(recipeSchema.name) || 'Untitled Recipe',
      ingredients: Array.isArray(recipeSchema.recipeIngredient)
        ? recipeSchema.recipeIngredient.map(decodeHtmlEntities)
        : [],
      instructions: parseInstructions(recipeSchema.recipeInstructions).map(decodeHtmlEntities),
      prepTime: parseDuration(recipeSchema.prepTime),
      cookTime: parseDuration(recipeSchema.cookTime),
      servings: parseYield(recipeSchema.recipeYield),
      image: parseImage(recipeSchema.image),
    };

    // Validate
    if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
      showError('Recipe found but appears to be incomplete.');
      return;
    }

    renderRecipe(recipe, tab.url);

  } catch (err) {
    console.error('Extraction error:', err);
    showError('Failed to extract recipe. Make sure you\'re on a recipe page.');
  }
}

// Start extraction when popup opens
document.addEventListener('DOMContentLoaded', extractRecipe);
