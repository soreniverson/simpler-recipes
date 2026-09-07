/**
 * Search-surface report: what's live, what's due in the next 90 days.
 * Run: npm run search:report   (alias for: npx tsx scripts/search-report.ts)
 *
 * Read-only — it never publishes drafts or edits pages. It regenerates
 * docs/search/launch-manifest.json (deterministic from the registry + catalog)
 * and prints upcoming seasonal publish/refresh tasks from the calendar CSV.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BROWSE_PAGES, buildBrowsePages, MIN_RECIPES } from '../src/lib/browse';
import { SEARCH_PAGES } from '../src/lib/searchPages';

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'recipe-data', 'all-recipes.json'), 'utf-8'));
const built = buildBrowsePages(catalog.recipes);
const builtSlugs = new Set(built.map((p) => p.slug));

// Candidates that were evaluated and did NOT launch, with the honest reason.
// Keep in sync when adding collections; the gate result below is computed, not asserted.
const DRAFTS: { slug: string; intent: string; reason: string }[] = [
  { slug: 'pork', intent: 'pork recipes', reason: 'Only ~6 pork-primary recipes once bacon/ham-incidental dishes are excluded (< gate)' },
  { slug: 'eggs', intent: 'egg recipes', reason: 'Only ~6 true egg dishes once "eggplant" title matches are excluded (< gate)' },
  { slug: 'salmon', intent: 'salmon recipes', reason: '4 recipes (< gate)' },
  { slug: 'sheet-pan', intent: 'sheet pan dinners', reason: '5 loose matches; method evidence too weak (instruction-text matching caught slow-cooker recipes)' },
  { slug: 'slow-cooker', intent: 'slow cooker recipes', reason: '6 recipes (< gate)' },
  { slug: 'cookies', intent: 'cookie recipes', reason: '6 recipes (< gate); blocks a dedicated holiday-cookies page too' },
  { slug: 'stir-fry', intent: 'stir fry recipes', reason: '7 recipes (< gate); catalog also has two identically titled "Chicken Stir Fry" entries to reconcile' },
  { slug: 'lentils-chickpeas', intent: 'chickpea recipes', reason: '7 recipes (< gate)' },
  { slug: 'sandwiches', intent: 'sandwich recipes', reason: '6 recipes (< gate)' },
  { slug: '15-minute-meals', intent: '15 minute meals', reason: 'Consolidated into /browse/20-minute-recipes/ — same experience, near-duplicate intent' },
  { slug: 'thanksgiving-sides', intent: 'thanksgiving side dishes', reason: '0 matching recipes — no Thanksgiving coverage in the catalog' },
];

const manifest = {
  generated: 'run `npm run search:report` to regenerate',
  gate: `>= ${MIN_RECIPES} matching public curated recipes`,
  collections: BROWSE_PAGES.map((p) => {
    const b = built.find((x) => x.slug === p.slug);
    return {
      url: `/browse/${p.slug}/`,
      family: p.family,
      intent: p.intent,
      status: b ? 'published' : 'dropped-by-gate',
      recipes: b ? b.recipes.length : 0,
      published: p.published,
      seasonal: p.seasonal ?? null,
    };
  }),
  drafts: DRAFTS.map((d) => ({ url: `/browse/${d.slug}/`, status: 'draft', ...d })),
  pages: SEARCH_PAGES.map((p) => ({ url: p.path, family: p.family, status: 'published', published: p.published, updated: p.updated })),
};
const manifestPath = path.join(root, 'docs', 'search', 'launch-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// ---- Console report ----
console.log(`Collections live: ${built.length}/${BROWSE_PAGES.length} defined (gate: ${manifest.gate})`);
for (const p of BROWSE_PAGES) if (!builtSlugs.has(p.slug)) console.log(`  DROPPED BY GATE: /browse/${p.slug}/`);
console.log(`Drafts/backlog: ${DRAFTS.length} (see launch-manifest.json)`);
console.log(`Hand-written pages: ${SEARCH_PAGES.length}`);
console.log(`Manifest written: ${path.relative(root, manifestPath)}`);

// Seasonal tasks in the next 90 days, from the calendar CSV.
const csv = fs.readFileSync(path.join(root, 'docs', 'search', 'seasonal-calendar.csv'), 'utf-8');
const rowsRaw = csv.trim().split('\n').slice(1);
const now = new Date();
const horizon = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
console.log('\nSeasonal tasks due in the next 90 days:');
let due = 0;
for (const line of rowsRaw) {
  // Simple CSV split honoring quoted fields.
  const cols = line.match(/("([^"]*)"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
  const [event, , , by, , page, , status] = cols;
  const byDate = new Date(by);
  if (!isNaN(byDate.getTime()) && byDate <= horizon) {
    const overdue = byDate < now ? ' (OVERDUE)' : '';
    console.log(`  ${by}${overdue}  ${event}  → ${page || 'no page'}  [${status}]`);
    due++;
  }
}
if (!due) console.log('  none');
