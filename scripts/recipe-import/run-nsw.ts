/** Full import of the NSW Government CC BY 4.0 recipe collection (text + photo). */
import fs from 'node:fs';
import { importNsw } from './nswgov';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const urls: string[] = JSON.parse(fs.readFileSync('/tmp/nsw-urls.json', 'utf8'));
  const existing = new Set<string>(JSON.parse(fs.readFileSync('recipe-data/all-recipes.json', 'utf8')).recipes.map((r: any) => r.slug));
  const out: any[] = []; const rejected: Record<string, number> = {};
  for (const [i, u] of urls.entries()) {
    const r = await importNsw(u, { theme: 'TBD' });
    if (r.ok) {
      if (existing.has(r.recipe.slug)) rejected['duplicate-of-existing'] = (rejected['duplicate-of-existing'] || 0) + 1;
      else out.push(r.recipe);
    } else { const k = r.reason.split(':')[0]; rejected[k] = (rejected[k] || 0) + 1; }
    if (i % 10 === 0) fs.writeFileSync('recipe-data/.staging/nsw.json', JSON.stringify(out, null, 1));
    process.stdout.write(`\r[${i + 1}/${urls.length}] kept=${out.length}   `);
    await sleep(300);
  }
  fs.writeFileSync('recipe-data/.staging/nsw.json', JSON.stringify(out, null, 1));
  console.log(`\nkept ${out.length}`);
  console.log('rejected:', JSON.stringify(rejected));
}
main();
