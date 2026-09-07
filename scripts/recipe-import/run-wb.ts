/** Import the Wikibooks Cookbook "Indian recipes" category. */
import fs from 'node:fs';
import { safeFetch } from '../../src/lib/safeFetch';
import { importWikibooks } from './wikibooks';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const r = await safeFetch('https://en.wikibooks.org/w/api.php?format=json&action=query&list=categorymembers&cmtitle=Category:Indian%20recipes&cmlimit=500&cmtype=page', { maxBytes: 4_000_000 });
  const titles: string[] = JSON.parse(r.body).query.categorymembers.map((m: any) => m.title).filter((t: string) => t.startsWith('Cookbook:'));
  console.log('category members:', titles.length);
  const out: any[] = []; const rejected: Record<string, number> = {};
  for (const [i, t] of titles.entries()) {
    const res = await importWikibooks(t, { theme: 'Indian Cuisine' });
    if (res.ok) out.push(res.recipe); else { const k = res.reason.split(':')[0]; rejected[k] = (rejected[k] || 0) + 1; }
    if (i % 10 === 0) fs.writeFileSync('recipe-data/.staging/wikibooks.json', JSON.stringify(out, null, 1));
    process.stdout.write(`\r[${i + 1}/${titles.length}] kept=${out.length}   `);
    await sleep(250);
  }
  fs.mkdirSync('recipe-data/.staging', { recursive: true });
  fs.writeFileSync('recipe-data/.staging/wikibooks.json', JSON.stringify(out, null, 1));
  console.log(`\nkept ${out.length}`); console.log('rejected:', JSON.stringify(rejected));
}
main();
