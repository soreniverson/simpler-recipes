/**
 * Phase A — cheap text harvest. One request per candidate, no images, no archive lookups.
 * Produces the pool that selection and the adversarial review run against.
 */
import fs from 'node:fs';
import { importMyPlate } from './myplate';

const OUT = 'recipe-data/.staging/pool.json';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const slugs: string[] = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).map((s: string) => s.replace('/recipes/', ''));
  const existing = new Set<string>(JSON.parse(fs.readFileSync('recipe-data/all-recipes.json', 'utf8')).recipes.map((r: any) => r.slug));
  fs.mkdirSync('recipe-data/.staging', { recursive: true });
  const pool: any[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
  const done = new Set(pool.map((p) => p.sourceSlug));
  let ok = 0, fail = 0;
  for (const [i, slug] of slugs.entries()) {
    if (done.has(slug)) continue;
    const res = await importMyPlate(`https://myplate.food/recipes/${slug}`, { theme: 'TBD', light: true });
    if (res.ok) {
      if (existing.has(res.recipe.slug)) { fail++; }
      else { pool.push({ ...res.recipe, sourceSlug: slug }); ok++; }
    } else fail++;
    if (i % 25 === 0) { fs.writeFileSync(OUT, JSON.stringify(pool)); process.stdout.write(`\r[${i}/${slugs.length}] ok=${ok} fail=${fail}   `); }
    await sleep(250);
  }
  fs.writeFileSync(OUT, JSON.stringify(pool));
  console.log(`\ndone: pool=${pool.length} ok=${ok} fail=${fail}`);
}
main();
