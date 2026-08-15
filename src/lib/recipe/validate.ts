/**
 * Validation for recipe payloads that arrive from the client (share links, remix requests)
 * or from an LLM. Anything rendered from these must go through here first.
 *
 * Rules: sane lengths, string arrays only, images https-only, source URLs http(s) only,
 * unknown keys dropped. Returns a clean Recipe or a list of problems.
 */
import { z } from 'zod';
import type { Recipe } from './types';

const shortStr = (max: number) => z.string().trim().max(max);
const optShort = (max: number) => shortStr(max).nullish().transform((v) => (v ? v : null));

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((s) => /^https?:\/\//i.test(s), 'must be http(s)')
  .refine((s) => {
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  }, 'invalid url');

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((s) => /^https:\/\//i.test(s), 'must be https');

const lines = (maxItems: number, maxLen: number) =>
  z
    .array(z.string().trim().max(maxLen))
    .max(maxItems)
    .transform((arr) => arr.filter((s) => s.length > 0));

const section = z.object({
  name: optShort(120),
  items: lines(200, 600),
});

export const RecipeSchema = z
  .object({
    title: shortStr(200).min(1),
    description: optShort(600),
    ingredients: lines(200, 600),
    instructions: lines(200, 3000),
    ingredientGroups: z.array(section).max(40).optional(),
    instructionGroups: z.array(section).max(40).optional(),
    prepTime: optShort(40),
    cookTime: optShort(40),
    totalTime: optShort(40),
    prepMinutes: z.number().int().min(0).max(100000).nullish(),
    cookMinutes: z.number().int().min(0).max(100000).nullish(),
    totalMinutes: z.number().int().min(0).max(100000).nullish(),
    servings: optShort(80),
    yieldCount: z.number().min(0).max(10000).nullish(),
    image: httpsUrl.nullish().catch(null),
    author: optShort(120),
    siteName: optShort(120),
    sourceUrl: httpUrl.nullish().catch(null),
    canonicalUrl: httpUrl.nullish().catch(null),
    datePublished: optShort(40),
    keywords: z.array(shortStr(60)).max(30).optional(),
    category: optShort(80),
    cuisine: optShort(80),
    source: optShort(40),
    extractedVia: z.enum(['jsonld', 'microdata', 'html', 'ai', 'youtube', 'remix', 'unknown']).optional(),
  })
  .strip()
  .refine((r) => r.ingredients.length > 0 || r.instructions.length > 0, 'recipe has no ingredients or instructions');

export type ValidatedRecipe = z.infer<typeof RecipeSchema>;

export function validateRecipe(input: unknown): { ok: true; recipe: Recipe } | { ok: false; error: string } {
  const parsed = RecipeSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? `${first.path.join('.') || 'recipe'}: ${first.message}` : 'invalid recipe' };
  }
  const r = parsed.data as Recipe;
  // Groups must agree with the flat lists; if not, drop them rather than trust them.
  if (r.ingredientGroups && r.ingredientGroups.flatMap((g) => g.items).length !== r.ingredients.length) delete r.ingredientGroups;
  if (r.instructionGroups && r.instructionGroups.flatMap((g) => g.items).length !== r.instructions.length) delete r.instructionGroups;
  return { ok: true, recipe: r };
}

/** Rough size guard for JSON bodies (bytes of the serialized payload). */
export const MAX_SHARE_BYTES = 48 * 1024;
export const MAX_REMIX_BYTES = 32 * 1024;

export { safeHref, hostnameOf } from './href';
