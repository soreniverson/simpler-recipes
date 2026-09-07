/**
 * Per-publisher rules for turning a listing page into candidate recipe URLs.
 *
 * Recipe URLs are DISCOVERED from the publisher's own category/collection pages —
 * never guessed — because a guessed slug is a 404 and a 404 is a silently missing
 * recipe. `isRecipeUrl` keeps category/tag/author/print pages out of the candidate set.
 */
export interface SiteRule {
  host: RegExp;
  isRecipeUrl: (u: URL) => boolean;
}

const seg = (u: URL) => u.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
const BAD = /^(category|categories|tag|tags|author|about|contact|privacy|shop|recipes?-?index|collection|collections|cuisine|search|page|topic|gallery|article|how-to|guides?|reviews?|news|holidays?-occasions?|ingredients?|everyday-cooking|world-cuisine|food-news-trends|kitchen-tips|longform|video|web-stories|amp)$/i;
// Feeds, APIs, static files and site furniture that share the one-segment shape with recipes.
const JUNK = /^(feed|wp-json|wp-content|wp-admin|xmlrpc\.php|comments|cookbooks?|recipes|subscribe|newsletter|nagi-recipetin-eats|work-with-me|faq|terms|disclosure|meal-plans?|cookbook|store|my-account|cart|checkout|login|register|sitemap.*)$/i;
const hasExt = (s: string) => /\.(php|xml|json|rss|jpg|jpeg|png|gif|webp|pdf|css|js)$/i.test(s);
/** A real recipe slug: multi-word, not furniture, not a file. */
const slugOk = (s: string) => s.includes('-') && !BAD.test(s) && !JUNK.test(s) && !hasExt(s) && s.length > 6;

export const SITES: SiteRule[] = [
  {
    // https://www.recipetineats.com/thai-red-curry-with-chicken/
    host: /(^|\.)recipetineats\.com$/i,
    isRecipeUrl: (u) => { const s = seg(u); return s.length === 1 && slugOk(s[0]); },
  },
  {
    // https://www.bbcgoodfood.com/recipes/next-level-chilli-con-carne
    host: /(^|\.)bbcgoodfood\.com$/i,
    isRecipeUrl: (u) => { const s = seg(u); return s.length === 2 && s[0] === 'recipes' && slugOk(s[1]); },
  },
  {
    // https://www.allrecipes.com/recipe/20144/banana-banana-bread/
    host: /(^|\.)allrecipes\.com$/i,
    isRecipeUrl: (u) => { const s = seg(u); return (s[0] === 'recipe' && s.length >= 2 && /^\d+$/.test(s[1])) || (s.length === 1 && /-recipe-\d+$/.test(s[0])); },
  },
  {
    // https://www.budgetbytes.com/black-bean-quesadillas/  (single segment)
    host: /(^|\.)budgetbytes\.com$/i,
    isRecipeUrl: (u) => { const s = seg(u); return s.length === 1 && slugOk(s[0]); },
  },
  {
    // https://www.simplyrecipes.com/shakshuka-recipe-5216349
    host: /(^|\.)simplyrecipes\.com$/i,
    isRecipeUrl: (u) => { const s = seg(u); return s.length === 1 && /-recipe[s]?-\d+$/.test(s[0]); },
  },
  {
    // https://cookieandkate.com/best-guacamole-recipe/
    host: /(^|\.)cookieandkate\.com$/i,
    isRecipeUrl: (u) => { const s = seg(u); return s.length === 1 && slugOk(s[0]); },
  },
  {
    host: /(^|\.)loveandlemons\.com$/i,
    isRecipeUrl: (u) => { const s = seg(u); return s.length === 1 && slugOk(s[0]); },
  },
  {
    host: /(^|\.)themediterraneandish\.com$/i,
    isRecipeUrl: (u) => { const s = seg(u); return s.length === 1 && slugOk(s[0]); },
  },
];

export function ruleFor(u: URL): SiteRule | null {
  return SITES.find((s) => s.host.test(u.hostname)) ?? null;
}
