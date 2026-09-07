/**
 * Registry for hand-written search landing pages (editorial, tool, comparisons).
 * The sitemap reads `updated` for honest lastmod values; bump it when the page's
 * content materially changes (comparison facts re-checked, copy rewritten) — not
 * on every deploy.
 */
export interface SearchPage {
  /** Site-relative path with trailing slash, e.g. '/recipe-cleaner/'. */
  path: string;
  family: 'editorial' | 'tool' | 'comparison';
  published: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD — last material content change
}

export const SEARCH_PAGES: SearchPage[] = [
  { path: '/recipe-cleaner/', family: 'tool', published: '2026-09-06', updated: '2026-09-06' },
  { path: '/why-recipe-sites-have-long-stories/', family: 'editorial', published: '2026-09-06', updated: '2026-09-06' },
  { path: '/alternatives/just-the-recipe/', family: 'comparison', published: '2026-09-06', updated: '2026-09-06' },
  { path: '/compare/simpler-vs-paprika/', family: 'comparison', published: '2026-09-06', updated: '2026-09-06' },
];
