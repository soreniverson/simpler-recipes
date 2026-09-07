/** Full import of the federally-authored Nutrition.gov recipes (text + photo). */
import fs from 'node:fs';
import { importNutritionGov } from './nutritiongov';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const urls: string[] = fs.readFileSync(process.argv[2], 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const existing = new Set<string>(JSON.parse(fs.readFileSync('recipe-data/all-recipes.json', 'utf8')).recipes.map((r: any) => r.slug));
  const out: any[] = []; const rejected: Record<string, number> = {};
  for (const [i, u] of urls.entries()) {
    const r = await importNutritionGov(u, { theme: 'TBD' });
    if (r.ok) {
      if (existing.has(r.recipe.slug)) rejected['duplicate-of-existing'] = (rejected['duplicate-of-existing'] || 0) + 1;
      else out.push({ ...r.recipe, creator: r.creator });
    } else {
      const key = r.reason.split(':')[0];
      rejected[key] = (rejected[key] || 0) + 1;
    }
    process.stdout.write(`\r[${i + 1}/${urls.length}] kept=${out.length}   `);
    await sleep(350);
  }
  fs.mkdirSync('recipe-data/.staging', { recursive: true });
  fs.writeFileSync('recipe-data/.staging/nutritiongov.json', JSON.stringify(out, null, 1));
  console.log(`\nkept ${out.length}`);
  console.log('rejected:', JSON.stringify(rejected, null, 1));
}
main();
