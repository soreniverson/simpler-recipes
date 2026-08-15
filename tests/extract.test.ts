import { describe, it, expect } from 'vitest';
import { extractJsonLdBlocks, parseJsonLoose, findRecipeNodes, selectRecipeNode, recipeFromJsonLd } from '../src/lib/recipe/jsonld';
import { extractRecipeFromHtml } from '../src/lib/recipe/extract';

const wrap = (json: unknown | string, extraHead = '') =>
  `<!doctype html><html><head><title>T</title>${extraHead}<script type="application/ld+json">${typeof json === 'string' ? json : JSON.stringify(json)}</script></head><body><h1>Body</h1></body></html>`;

const baseRecipe = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Test &amp; Cookies',
  image: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg'],
  prepTime: 'PT15M',
  cookTime: 'PT1H30M',
  totalTime: 'PT1H45M',
  recipeYield: ['24', '24 cookies'],
  recipeIngredient: ['2 cups flour', '1 cup sugar', 'For the glaze:', '1 cup powdered sugar'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Preheat the oven.' },
    { '@type': 'HowToStep', text: 'Mix.' },
  ],
  author: { '@type': 'Person', name: 'Jane Doe' },
  keywords: 'cookies, dessert',
  recipeCategory: 'Dessert',
  recipeCuisine: 'American',
  description: 'Great cookies',
  url: 'https://example.com/cookies/',
  datePublished: '2020-01-02T10:00:00Z',
};

describe('extractJsonLdBlocks / parseJsonLoose', () => {
  it('finds blocks regardless of attribute order/quotes', () => {
    const html = `<script type=application/ld+json>{"@type":"Recipe","name":"a","recipeIngredient":["x"]}</script>
      <script data-x="1" type='application/ld+json' id="y">{"@type":"WebPage"}</script>`;
    expect(extractJsonLdBlocks(html)).toHaveLength(2);
  });
  it('recovers from trailing commas and raw newlines in strings', () => {
    expect(parseJsonLoose('{"a": "line1\nline2", "b": [1,2,],}')).toEqual({ a: 'line1 line2', b: [1, 2] });
  });
  it('recovers from CDATA/comment wrappers', () => {
    expect(parseJsonLoose('<!-- {"a":1} -->')).toEqual({ a: 1 });
    expect(parseJsonLoose('//<![CDATA[\n{"a":1}\n//]]>')).toEqual({ a: 1 });
  });
  it('splits concatenated top-level objects', () => {
    expect(parseJsonLoose('{"a":1}{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
  });
  it('returns undefined for hopeless junk', () => {
    expect(parseJsonLoose('not json at all')).toBeUndefined();
    expect(parseJsonLoose('')).toBeUndefined();
  });
});

describe('findRecipeNodes', () => {
  it('finds at root, array root, @graph, mainEntity, and array @type', () => {
    expect(findRecipeNodes({ '@type': 'Recipe' })).toHaveLength(1);
    expect(findRecipeNodes([{ '@type': 'WebPage' }, { '@type': 'Recipe' }])).toHaveLength(1);
    expect(findRecipeNodes({ '@graph': [{ '@type': 'WebSite' }, { '@type': ['Recipe', 'NewsArticle'] }] })).toHaveLength(1);
    expect(findRecipeNodes({ '@type': 'WebPage', mainEntity: { '@type': 'Recipe' } })).toHaveLength(1);
    expect(findRecipeNodes({ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', item: { '@type': 'Recipe' } }] })).toHaveLength(1);
    expect(findRecipeNodes({ '@type': 'recipe' })).toHaveLength(1);
    expect(findRecipeNodes({ '@type': 'https://schema.org/Recipe' })).toHaveLength(1);
    expect(findRecipeNodes({ '@type': 'Article' })).toHaveLength(0);
    expect(findRecipeNodes(null)).toHaveLength(0);
  });
});

describe('selectRecipeNode', () => {
  it('prefers the node with the most content and matching URL', () => {
    const teaser = { '@type': 'Recipe', name: 'Related', recipeIngredient: ['a'], url: 'https://x.com/other' };
    const real = { '@type': 'Recipe', name: 'Real', recipeIngredient: ['a', 'b', 'c'], recipeInstructions: ['x', 'y'], url: 'https://x.com/real/' };
    const { node, candidates } = selectRecipeNode([teaser, real], 'https://www.x.com/real');
    expect(node.name).toBe('Real');
    expect(candidates).toBe(2);
  });
  it('matching URL beats slightly more content', () => {
    const other = { '@type': 'Recipe', name: 'Other', recipeIngredient: ['a', 'b', 'c', 'd'], recipeInstructions: ['x', 'y', 'z'], url: 'https://x.com/other' };
    const mine = { '@type': 'Recipe', name: 'Mine', recipeIngredient: ['a', 'b', 'c'], recipeInstructions: ['x', 'y'], mainEntityOfPage: { '@id': 'https://x.com/mine/' } };
    expect(selectRecipeNode([other, mine], 'https://x.com/mine').node.name).toBe('Mine');
  });
});

describe('recipeFromJsonLd', () => {
  it('maps a full node', () => {
    const r = recipeFromJsonLd(baseRecipe, 'https://example.com/cookies/')!;
    expect(r.title).toBe('Test & Cookies');
    expect(r.image).toBe('https://img.example.com/a.jpg');
    expect(r.prepTime).toBe('15 min');
    expect(r.cookTime).toBe('1 hr 30 min');
    expect(r.totalTime).toBe('1 hr 45 min');
    expect(r.prepMinutes).toBe(15);
    expect(r.totalMinutes).toBe(105);
    expect(r.servings).toBe('24 cookies');
    expect(r.yieldCount).toBe(24);
    expect(r.ingredients).toEqual(['2 cups flour', '1 cup sugar', '1 cup powdered sugar']);
    expect(r.ingredientGroups).toEqual([
      { name: null, items: ['2 cups flour', '1 cup sugar'] },
      { name: 'Glaze', items: ['1 cup powdered sugar'] },
    ]);
    expect(r.instructions).toEqual(['Preheat the oven.', 'Mix.']);
    expect(r.instructionGroups).toBeUndefined();
    expect(r.author).toBe('Jane Doe');
    expect(r.keywords).toEqual(['cookies', 'dessert', 'american']);
    expect(r.category).toBe('Dessert');
    expect(r.cuisine).toBe('American');
    expect(r.description).toBe('Great cookies');
    expect(r.datePublished).toBe('2020-01-02');
    expect(r.canonicalUrl).toBe(null); // same as page
    expect(r.sourceUrl).toBe('https://example.com/cookies/');
    expect(r.extractedVia).toBe('jsonld');
  });
  it('computes total when missing and fixes bogus totals', () => {
    const r = recipeFromJsonLd({ ...baseRecipe, totalTime: undefined })!;
    expect(r.totalMinutes).toBe(105);
    const r2 = recipeFromJsonLd({ ...baseRecipe, totalTime: 'PT0M' })!;
    expect(r2.totalMinutes).toBe(105);
  });
  it('handles Food Network style durations and yields', () => {
    const r = recipeFromJsonLd({ ...baseRecipe, prepTime: 'P0Y0M0DT0H15M0.000S', cookTime: 'P0Y0M0DT4H15M0.000S', recipeYield: '6 servings' })!;
    expect(r.prepTime).toBe('15 min');
    expect(r.cookTime).toBe('4 hr 15 min');
    expect(r.servings).toBe('6 servings');
  });
  it('handles yield "4 serving(s)" and yield as number', () => {
    expect(recipeFromJsonLd({ ...baseRecipe, recipeYield: '4 serving(s)' })!.servings).toBe('4 servings');
    expect(recipeFromJsonLd({ ...baseRecipe, recipeYield: 4 })!.servings).toBe('4 servings');
    expect(recipeFromJsonLd({ ...baseRecipe, recipeYield: undefined })!.servings).toBe(null);
    expect(recipeFromJsonLd({ ...baseRecipe, recipeYield: undefined })!.yieldCount).toBe(null);
  });
  it('handles HowToSection instructions', () => {
    const r = recipeFromJsonLd({
      ...baseRecipe,
      recipeInstructions: [
        { '@type': 'HowToSection', name: 'Dough', itemListElement: [{ '@type': 'HowToStep', text: 'Knead.' }] },
        { '@type': 'HowToSection', name: 'Bake', itemListElement: [{ '@type': 'HowToStep', text: 'Bake.' }] },
      ],
    })!;
    expect(r.instructions).toEqual(['Knead.', 'Bake.']);
    expect(r.instructionGroups).toEqual([
      { name: 'Dough', items: ['Knead.'] },
      { name: 'Bake', items: ['Bake.'] },
    ]);
  });
  it('handles string instructions and html in steps', () => {
    const r = recipeFromJsonLd({ ...baseRecipe, recipeInstructions: '<p>Step one &amp; more.</p><p>Step two.</p>' })!;
    expect(r.instructions).toEqual(['Step one & more.', 'Step two.']);
  });
  it('handles ImageObject and string image', () => {
    expect(recipeFromJsonLd({ ...baseRecipe, image: { '@type': 'ImageObject', url: 'https://x.com/i.jpg' } })!.image).toBe('https://x.com/i.jpg');
    expect(recipeFromJsonLd({ ...baseRecipe, image: 'https://x.com/s.jpg' })!.image).toBe('https://x.com/s.jpg');
    expect(recipeFromJsonLd({ ...baseRecipe, image: undefined })!.image).toBe(null);
  });
  it('returns null when there is neither ingredients nor instructions', () => {
    expect(recipeFromJsonLd({ '@type': 'Recipe', name: 'Empty' })).toBe(null);
  });
  it('author as array / string / org', () => {
    expect(recipeFromJsonLd({ ...baseRecipe, author: 'Chef' })!.author).toBe('Chef');
    expect(recipeFromJsonLd({ ...baseRecipe, author: [{ name: 'A' }, { name: 'B' }] })!.author).toBe('A, B');
  });
  it('sets canonicalUrl when the node URL differs from the fetched URL', () => {
    const r = recipeFromJsonLd({ ...baseRecipe, url: 'https://example.com/canonical-cookies/' }, 'https://example.com/cookies/?amp')!;
    expect(r.canonicalUrl).toBe('https://example.com/canonical-cookies/');
  });
});

describe('extractRecipeFromHtml', () => {
  it('uses JSON-LD when available', () => {
    const out = extractRecipeFromHtml(wrap(baseRecipe), 'https://example.com/cookies/');
    expect(out.method).toBe('jsonld');
    expect(out.recipe!.title).toBe('Test & Cookies');
    expect(out.candidates).toBe(1);
  });
  it('fills image and site name from og tags when JSON-LD lacks them', () => {
    const html = wrap({ ...baseRecipe, image: undefined }, '<meta property="og:image" content="/img/og.jpg"><meta property="og:site_name" content="Example Kitchen">');
    const out = extractRecipeFromHtml(html, 'https://example.com/cookies/');
    expect(out.recipe!.image).toBe('https://example.com/img/og.jpg');
    expect(out.recipe!.siteName).toBe('Example Kitchen');
  });
  it('falls back to microdata', () => {
    const html = `<html><head><title>Micro</title></head><body>
      <div itemscope itemtype="http://schema.org/Recipe">
        <h1 itemprop="name">Micro Soup</h1>
        <img itemprop="image" src="/soup.jpg">
        <meta itemprop="prepTime" content="PT10M">
        <span itemprop="recipeYield">4 servings</span>
        <ul><li itemprop="recipeIngredient">1 onion</li><li itemprop="recipeIngredient">2 carrots</li></ul>
        <ol itemprop="recipeInstructions"><li>Chop.</li><li>Simmer.</li></ol>
      </div></body></html>`;
    const out = extractRecipeFromHtml(html, 'https://micro.example.com/soup');
    expect(out.method).toBe('microdata');
    expect(out.recipe).toMatchObject({
      title: 'Micro Soup',
      ingredients: ['1 onion', '2 carrots'],
      instructions: ['Chop.', 'Simmer.'],
      prepTime: '10 min',
      servings: '4 servings',
      yieldCount: 4,
      image: 'https://micro.example.com/soup.jpg',
    });
  });
  it('falls back to structural heuristics', () => {
    const html = `<html><head><title>Grandma's Bread - Blog</title><meta property="og:image" content="https://b.com/bread.jpg"></head><body>
      <h1>Grandma's Bread</h1><p>Long story about my childhood…</p>
      <h2>Ingredients</h2><ul><li>3 cups flour</li><li>1 tsp yeast</li><li>1 cup water</li></ul>
      <h2>Instructions</h2><ol><li>Mix everything.</li><li>Rise 1 hour.</li><li>Bake at 450°F.</li></ol>
      <h2>Comments</h2><ul><li>Great!</li></ul></body></html>`;
    const out = extractRecipeFromHtml(html, 'https://b.com/bread');
    expect(out.method).toBe('html');
    expect(out.recipe).toMatchObject({
      title: "Grandma's Bread",
      ingredients: ['3 cups flour', '1 tsp yeast', '1 cup water'],
      instructions: ['Mix everything.', 'Rise 1 hour.', 'Bake at 450°F.'],
      image: 'https://b.com/bread.jpg',
    });
  });
  it('returns null recipe for a non-recipe page', () => {
    const html = `<html><head><title>About</title></head><body><h1>About us</h1><p>We are a company.</p><ul><li>a</li></ul></body></html>`;
    const out = extractRecipeFromHtml(html, 'https://x.com/about');
    expect(out.recipe).toBe(null);
    expect(out.method).toBe('unknown');
  });
  it('picks the real recipe when a page has several', () => {
    const html = wrap({
      '@graph': [
        { '@type': 'Recipe', name: 'Teaser', recipeIngredient: ['x'], url: 'https://x.com/teaser' },
        { ...baseRecipe, url: 'https://x.com/cookies/' },
      ],
    });
    const out = extractRecipeFromHtml(html, 'https://x.com/cookies');
    expect(out.recipe!.title).toBe('Test & Cookies');
    expect(out.candidates).toBe(2);
  });
  it('survives a broken JSON-LD block alongside a good one', () => {
    const html = `<script type="application/ld+json">{ this is broken</script>` + wrap(baseRecipe);
    expect(extractRecipeFromHtml(html).recipe!.title).toBe('Test & Cookies');
  });
});

describe('@id reference resolution (Yoast/RankMath graphs)', () => {
  it('resolves author, image and publisher references', () => {
    const html = wrap({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', '@id': 'https://x.com/#organization', name: 'X Kitchen' },
        { '@type': 'Person', '@id': 'https://x.com/#/schema/person/1', name: 'Nagi' },
        { '@type': 'ImageObject', '@id': 'https://x.com/r/#primaryimage', url: 'https://x.com/img/primary.jpg' },
        { '@type': 'WebPage', '@id': 'https://x.com/r/', isPartOf: { '@id': 'https://x.com/#website' } },
        { '@type': 'WebSite', '@id': 'https://x.com/#website', name: 'X Kitchen Site', publisher: { '@id': 'https://x.com/#organization' } },
        {
          '@type': 'Recipe',
          name: 'Ref Recipe',
          author: { '@id': 'https://x.com/#/schema/person/1' },
          image: { '@id': 'https://x.com/r/#primaryimage' },
          isPartOf: { '@id': 'https://x.com/r/' },
          recipeIngredient: ['1 egg'],
          recipeInstructions: [{ '@type': 'HowToStep', text: 'Cook.' }],
        },
      ],
    });
    const out = extractRecipeFromHtml(html, 'https://x.com/r/');
    expect(out.recipe!.author).toBe('Nagi');
    expect(out.recipe!.image).toBe('https://x.com/img/primary.jpg');
  });
});

describe('half-empty structured data borrows from the page', () => {
  it('fills empty recipeInstructions from an Instructions heading + list', () => {
    const html = `<html><head><title>T</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Pioneer Roast', recipeIngredient: ['1 roast', '2 onions'], recipeInstructions: [] })}</script></head>
      <body><h1>Pioneer Roast</h1><h2>Ingredients</h2><ul><li>1 roast</li><li>2 onions</li></ul><h2>Directions</h2><ol><li>Sear the roast.</li><li>Braise 3 hours.</li></ol></body></html>`;
    const out = extractRecipeFromHtml(html, 'https://tpw.example.com/roast');
    expect(out.method).toBe('jsonld');
    expect(out.recipe!.ingredients).toEqual(['1 roast', '2 onions']);
    expect(out.recipe!.instructions).toEqual(['Sear the roast.', 'Braise 3 hours.']);
  });
});

describe('ingredient sections borrowed from plugin markup', () => {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Tikka',
    recipeIngredient: ['1 kg chicken', '1 cup yoghurt', '2 tsp garam masala', '1 onion', '400 g passata', '1 cup cream'],
    recipeInstructions: [{ '@type': 'HowToSection', name: 'Chicken:', itemListElement: [{ '@type': 'HowToStep', text: 'Marinate.' }] }, { '@type': 'HowToSection', name: 'Sauce:', itemListElement: [{ '@type': 'HowToStep', text: 'Simmer.' }] }],
  };
  const wprm = (counts: number[]) =>
    `<div class="wprm-recipe-ingredients-container">${counts
      .map((c, i) => `<div class="wprm-recipe-ingredient-group"><h4 class="wprm-recipe-group-name">${['Marinade:', 'Sauce:'][i]}</h4><ul>${'<li class="wprm-recipe-ingredient">x</li>'.repeat(c)}</ul></div>`)
      .join('')}</div>`;
  const page = (body: string) => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>${body}</body></html>`;

  it('regroups a flat JSON-LD list when section counts add up', () => {
    const { recipe } = extractRecipeFromHtml(page(wprm([3, 3])), 'https://x.com/r');
    expect(recipe!.ingredientGroups!.map((g) => [g.name, g.items.length])).toEqual([['Marinade', 3], ['Sauce', 3]]);
    expect(recipe!.ingredientGroups![1].items[0]).toBe('1 onion');
    expect(recipe!.instructionGroups!.map((g) => g.name)).toEqual(['Chicken', 'Sauce']);
  });
  it('leaves the list flat when counts disagree', () => {
    const { recipe } = extractRecipeFromHtml(page(wprm([3, 4])), 'https://x.com/r');
    expect(recipe!.ingredientGroups).toBeUndefined();
    expect(recipe!.ingredients).toHaveLength(6);
  });
});

describe('hardening (adversarial QA)', () => {
  it('title from {@value} / arrays; author never equals the recipe', () => {
    const ld = { '@type': 'Recipe', '@id': '#r', name: { '@value': 'Real Title' }, author: { '@id': '#r' }, recipeIngredient: ['1 cup x', '2 tsp y'], recipeInstructions: 'Mix.' };
    const { recipe } = extractRecipeFromHtml(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`, 'https://x.com/');
    expect(recipe!.title).toBe('Real Title');
    expect(recipe!.author ?? null).toBeNull();
  });
  it('rejects negative/absurd durations and yields', () => {
    const ld = { '@type': 'Recipe', name: 'T', prepTime: 'PT-5M', cookTime: 'PT9999999H', recipeYield: '-3', recipeIngredient: ['1 cup x', '2 tsp y'], recipeInstructions: 'Mix.' };
    const { recipe } = extractRecipeFromHtml(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`, 'https://x.com/');
    expect(recipe!.prepMinutes ?? null).toBeNull();
    expect(recipe!.cookMinutes ?? null).toBeNull();
    expect(recipe!.servings ?? null).toBeNull();
    expect(recipe!.yieldCount ?? null).toBeNull();
  });
  it('clips absurdly long lines so the result stays shareable', () => {
    const ld = { '@type': 'Recipe', name: 'T', recipeIngredient: ['1 cup ' + 'x'.repeat(2000), '2 tsp y'], recipeInstructions: 'Mix.' };
    const { recipe } = extractRecipeFromHtml(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`, 'https://x.com/');
    expect(recipe!.ingredients[0].length).toBeLessThanOrEqual(500);
  });
  it('does not mistake a nav list under an "Ingredients" heading for a recipe', () => {
    const html = `<h1>Site</h1><h2>Ingredients</h2><ul><li>Home</li><li>Recipes</li><li>About</li></ul><h2>Directions</h2><ol><li>Terms</li><li>Privacy</li></ol>`;
    expect(extractRecipeFromHtml(html, 'https://x.com/').recipe).toBeNull();
  });
  it('survives pathological nesting quickly', () => {
    const html = '<div>'.repeat(200000) + 'x' + '</div>'.repeat(200000);
    const t = Date.now();
    expect(extractRecipeFromHtml(html, 'https://x.com/').recipe).toBeNull();
    expect(Date.now() - t).toBeLessThan(4000);
  });
});
