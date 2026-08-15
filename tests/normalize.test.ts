import { describe, it, expect } from 'vitest';
import {
  decodeEntities,
  cleanText,
  stripStepNumbering,
  durationToMinutes,
  formatMinutes,
  minutesToIso,
  normalizeDuration,
  normalizeYield,
  normalizeImage,
  isIngredientHeader,
  groupIngredients,
  cleanIngredientLine,
  normalizeInstructions,
  splitInstructionString,
  normalizeAuthor,
  normalizeKeywords,
} from '../src/lib/recipe/normalize';

describe('text', () => {
  it('decodes named, decimal, hex entities', () => {
    expect(decodeEntities('Fish &amp; Chips &#39;n&#39; &quot;stuff&quot;')).toBe(`Fish & Chips 'n' "stuff"`);
    expect(decodeEntities('350&deg;F &frac12; cup caf&eacute; &rsquo;')).toBe('350°F ½ cup café ’');
    expect(decodeEntities('&#x2019;s &#8217;s &nbsp;')).toBe('’s ’s  ');
    expect(decodeEntities('no entities')).toBe('no entities');
    expect(decodeEntities(null)).toBe('');
  });
  it('cleanText strips tags and whitespace', () => {
    expect(cleanText('<p>Mix <b>well</b>.</p>\n\n<p>Then bake.</p>')).toBe('Mix well. Then bake.');
    expect(cleanText('  a  b  \t c ')).toBe('a b c');
    expect(cleanText('flour<br>sugar')).toBe('flour sugar');
    expect(cleanText(42)).toBe('42');
  });
  it('strips step numbering', () => {
    expect(stripStepNumbering('1. Preheat oven')).toBe('Preheat oven');
    expect(stripStepNumbering('Step 3: Add flour')).toBe('Add flour');
    expect(stripStepNumbering('2) Stir')).toBe('Stir');
    expect(stripStepNumbering('Step 12 Bake')).toBe('Bake');
    expect(stripStepNumbering('Add 2 cups')).toBe('Add 2 cups');
    expect(stripStepNumbering('350°F for 10 minutes')).toBe('350°F for 10 minutes');
  });
});

describe('durations', () => {
  it('parses ISO 8601 in all its ugliness', () => {
    expect(durationToMinutes('PT30M')).toBe(30);
    expect(durationToMinutes('PT1H30M')).toBe(90);
    expect(durationToMinutes('PT150M')).toBe(150);
    expect(durationToMinutes('P0Y0M0DT0H15M0.000S')).toBe(15);
    expect(durationToMinutes('P0DT4H15M')).toBe(255);
    expect(durationToMinutes('PT1H')).toBe(60);
    expect(durationToMinutes('PT45S')).toBe(1);
    expect(durationToMinutes('PT0S')).toBe(null);
    expect(durationToMinutes('P0D')).toBe(null);
    expect(durationToMinutes('PT')).toBe(null);
    expect(durationToMinutes('P1D')).toBe(1440);
    expect(durationToMinutes('PT1.5H')).toBe(90);
    expect(durationToMinutes('pt20m')).toBe(20);
  });
  it('parses human strings', () => {
    expect(durationToMinutes('1 hr 30 min')).toBe(90);
    expect(durationToMinutes('90 minutes')).toBe(90);
    expect(durationToMinutes('1.5 hours')).toBe(90);
    expect(durationToMinutes('45 mins')).toBe(45);
    expect(durationToMinutes('2 hours')).toBe(120);
    expect(durationToMinutes('1 hour 20 minutes')).toBe(80);
    expect(durationToMinutes('30')).toBe(30);
    expect(durationToMinutes('overnight')).toBe(null);
    expect(durationToMinutes('')).toBe(null);
    expect(durationToMinutes(null)).toBe(null);
    expect(durationToMinutes(25)).toBe(25);
    expect(durationToMinutes('1 ½ hours')).toBe(90);
    expect(durationToMinutes('2 days')).toBe(2880);
  });
  it('formats minutes', () => {
    expect(formatMinutes(30)).toBe('30 min');
    expect(formatMinutes(90)).toBe('1 hr 30 min');
    expect(formatMinutes(150)).toBe('2 hr 30 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(120)).toBe('2 hr');
    expect(formatMinutes(1500)).toBe('1 day 1 hr');
    expect(formatMinutes(0)).toBe(null);
    expect(formatMinutes(null)).toBe(null);
  });
  it('round-trips to ISO', () => {
    expect(minutesToIso(90)).toBe('PT1H30M');
    expect(minutesToIso(30)).toBe('PT30M');
    expect(minutesToIso(60)).toBe('PT1H');
    expect(minutesToIso(null)).toBe(undefined);
  });
  it('normalizeDuration end-to-end', () => {
    expect(normalizeDuration('P0Y0M0DT0H15M0.000S')).toBe('15 min');
    expect(normalizeDuration('PT150M')).toBe('2 hr 30 min');
    expect(normalizeDuration('150 min')).toBe('2 hr 30 min');
    expect(normalizeDuration('garbage')).toBe(null);
  });
});

describe('yield', () => {
  it('handles numbers and bare numeric strings', () => {
    expect(normalizeYield(4)).toEqual({ text: '4 servings', count: 4 });
    expect(normalizeYield('4')).toEqual({ text: '4 servings', count: 4 });
    expect(normalizeYield('12')).toEqual({ text: '12 servings', count: 12 });
    expect(normalizeYield(0)).toEqual({ text: null, count: null });
  });
  it('handles descriptive strings', () => {
    expect(normalizeYield('4 servings')).toEqual({ text: '4 servings', count: 4 });
    expect(normalizeYield('4 serving(s)')).toEqual({ text: '4 servings', count: 4 });
    expect(normalizeYield('6 servings')).toEqual({ text: '6 servings', count: 6 });
    expect(normalizeYield('Serves 4')).toEqual({ text: '4 servings', count: 4 });
    expect(normalizeYield('Serves 4-6')).toEqual({ text: '4–6 servings', count: 4 });
    expect(normalizeYield('serves 4 to 6')).toEqual({ text: '4–6 servings', count: 4 });
    expect(normalizeYield('Makes 12 cookies')).toEqual({ text: 'Makes 12 cookies', count: 12 });
    expect(normalizeYield('Cuts into 10 slices')).toEqual({ text: 'Cuts into 10 slices', count: 10 });
    expect(normalizeYield('1 9-inch pie')).toEqual({ text: '1 9-inch pie', count: 1 });
    expect(normalizeYield('Yield: 24')).toEqual({ text: '24 servings', count: 24 });
    expect(normalizeYield('Servings: 8')).toEqual({ text: '8 servings', count: 8 });
    expect(normalizeYield('4-6')).toEqual({ text: '4–6 servings', count: 4 });
    expect(normalizeYield('2 1/2 cups guacamole')).toEqual({ text: '2 1/2 cups guacamole', count: 2.5 });
    expect(normalizeYield('Makes 1½ dozen')).toEqual({ text: 'Makes 1½ dozen', count: 1.5 });
  });
  it('handles arrays and QuantitativeValue', () => {
    expect(normalizeYield(['4', '4 servings'])).toEqual({ text: '4 servings', count: 4 });
    expect(normalizeYield(['12', '12 muffins'])).toEqual({ text: '12 muffins', count: 12 });
    expect(normalizeYield([])).toEqual({ text: null, count: null });
    expect(normalizeYield({ '@type': 'QuantitativeValue', value: 6, unitText: 'portions' })).toEqual({ text: '6 portions', count: 6 });
  });
  it('rejects noise', () => {
    expect(normalizeYield('')).toEqual({ text: null, count: null });
    expect(normalizeYield('servings')).toEqual({ text: null, count: null });
    expect(normalizeYield(null)).toEqual({ text: null, count: null });
    expect(normalizeYield('a lot')).toEqual({ text: 'A lot', count: null });
  });
});

describe('image', () => {
  it('handles every shape', () => {
    expect(normalizeImage('https://x.com/a.jpg')).toBe('https://x.com/a.jpg');
    expect(normalizeImage(['https://x.com/a.jpg', 'https://x.com/b.jpg'])).toBe('https://x.com/a.jpg');
    expect(normalizeImage({ '@type': 'ImageObject', url: 'https://x.com/o.jpg' })).toBe('https://x.com/o.jpg');
    expect(normalizeImage({ contentUrl: 'https://x.com/c.jpg' })).toBe('https://x.com/c.jpg');
    expect(normalizeImage([{ url: 'https://x.com/1.jpg' }])).toBe('https://x.com/1.jpg');
    expect(normalizeImage('/img/a.jpg', 'https://site.com/recipes/x')).toBe('https://site.com/img/a.jpg');
    expect(normalizeImage('//cdn.site.com/a.jpg', 'https://site.com/')).toBe('https://cdn.site.com/a.jpg');
    expect(normalizeImage(null)).toBe(null);
    expect(normalizeImage('')).toBe(null);
    expect(normalizeImage('data:image/png;base64,xxx')).toBe(null);
    expect(normalizeImage(['data:x', 'https://x.com/real.jpg'])).toBe('https://x.com/real.jpg');
    expect(normalizeImage('https://x.com/1x1.gif')).toBe(null);
  });
});

describe('ingredients', () => {
  it('detects section headers conservatively', () => {
    expect(isIngredientHeader('For the sauce:')).toBe(true);
    expect(isIngredientHeader('For the Chicken Marinade')).toBe(true);
    expect(isIngredientHeader('Sauce:')).toBe(true);
    expect(isIngredientHeader('TOPPING')).toBe(true);
    expect(isIngredientHeader('2 cups flour')).toBe(false);
    expect(isIngredientHeader('Salt to taste')).toBe(false);
    expect(isIngredientHeader('1 (14 oz) can tomatoes')).toBe(false);
    expect(isIngredientHeader('For 2 people: 1 egg')).toBe(false);
    expect(isIngredientHeader('EVOO')).toBe(true); // acceptable false positive risk; documented
  });
  it('groups by embedded headers and cleans lines', () => {
    const g = groupIngredients(['For the dough:', '2 cups flour', '1 tsp salt', 'For the filling:', '3 apples', '', 'Toppings:', 'sugar']);
    expect(g).toEqual([
      { name: 'Dough', items: ['2 cups flour', '1 tsp salt'] },
      { name: 'Filling', items: ['3 apples'] },
      { name: 'Toppings', items: ['sugar'] },
    ]);
  });
  it('single unnamed group when no headers', () => {
    expect(groupIngredients(['a', 'b'])).toEqual([{ name: null, items: ['a', 'b'] }]);
  });
  it('cleans ingredient lines', () => {
    expect(cleanIngredientLine('400 g / 14 oz artichoke hearts in brine ((drained (Note 1)))')).toBe('400 g / 14 oz artichoke hearts in brine (drained (Note 1))');
    expect(cleanIngredientLine('1 cup ( , chopped)')).toBe('1 cup (chopped)');
    expect(cleanIngredientLine('- 2 eggs')).toBe('2 eggs');
    expect(cleanIngredientLine('▢ 1 tsp salt')).toBe('1 tsp salt');
    expect(cleanIngredientLine('2 cups flour ()')).toBe('2 cups flour');
    expect(cleanIngredientLine('1 tbsp butter , softened')).toBe('1 tbsp butter, softened');
    expect(cleanIngredientLine('&frac12; cup <b>sugar</b>')).toBe('½ cup sugar');
  });
});

describe('instructions', () => {
  it('handles HowToStep arrays', () => {
    const r = normalizeInstructions([
      { '@type': 'HowToStep', text: 'Preheat oven to 350°F.' },
      { '@type': 'HowToStep', text: '2. Mix flour and sugar.' },
      { '@type': 'HowToStep', name: 'Bake', text: 'Bake 20 minutes.' },
    ]);
    expect(r).toEqual([{ name: null, items: ['Preheat oven to 350°F.', 'Mix flour and sugar.', 'Bake 20 minutes.'] }]);
  });
  it('handles HowToSection with names', () => {
    const r = normalizeInstructions([
      { '@type': 'HowToSection', name: 'Make the dough', itemListElement: [{ '@type': 'HowToStep', text: 'Knead.' }, { '@type': 'HowToStep', text: 'Rest.' }] },
      { '@type': 'HowToSection', name: 'Bake', itemListElement: [{ '@type': 'HowToStep', text: 'Bake it.' }] },
    ]);
    expect(r).toEqual([
      { name: 'Make the dough', items: ['Knead.', 'Rest.'] },
      { name: 'Bake', items: ['Bake it.'] },
    ]);
  });
  it('handles plain strings and string arrays', () => {
    expect(normalizeInstructions('1. Do a. 2. Do b. 3. Do c.')).toEqual([{ name: null, items: ['Do a.', 'Do b.', 'Do c.'] }]);
    expect(normalizeInstructions('Do a.\nDo b.\n\nDo c.')).toEqual([{ name: null, items: ['Do a.', 'Do b.', 'Do c.'] }]);
    expect(normalizeInstructions(['1. Do a.', 'Step 2: Do b.'])).toEqual([{ name: null, items: ['Do a.', 'Do b.'] }]);
    expect(normalizeInstructions('<ol><li>First</li><li>Second &amp; third</li></ol>')).toEqual([{ name: null, items: ['First', 'Second & third'] }]);
    expect(normalizeInstructions('<p>Para one.</p><p>Para two.</p>')).toEqual([{ name: null, items: ['Para one.', 'Para two.'] }]);
  });
  it('drops duplicates and empties, strips html in step text', () => {
    expect(normalizeInstructions([{ text: 'Mix <em>well</em>.' }, { text: 'Mix well.' }, { text: '' }, null])).toEqual([{ name: null, items: ['Mix well.'] }]);
  });
  it('handles ItemList wrapper and nested steps with directions', () => {
    const r = normalizeInstructions({ '@type': 'ItemList', itemListElement: [{ '@type': 'HowToStep', itemListElement: [{ '@type': 'HowToDirection', text: 'Chop.' }, { '@type': 'HowToTip', text: 'Use a sharp knife.' }] }] });
    expect(r).toEqual([{ name: null, items: ['Chop.', 'Use a sharp knife.'] }]);
  });
  it('returns [] for nothing', () => {
    expect(normalizeInstructions(null)).toEqual([]);
    expect(normalizeInstructions([])).toEqual([]);
    expect(normalizeInstructions('')).toEqual([]);
  });
  it('splitInstructionString keeps text without numbering intact', () => {
    expect(splitInstructionString('Bake at 350 for 20 minutes until golden.')).toEqual(['Bake at 350 for 20 minutes until golden.']);
  });
});

describe('author & keywords', () => {
  it('author shapes', () => {
    expect(normalizeAuthor('Nagi')).toBe('Nagi');
    expect(normalizeAuthor({ '@type': 'Person', name: 'Nagi Maehashi' })).toBe('Nagi Maehashi');
    expect(normalizeAuthor([{ name: 'A' }, { name: 'B' }, 'A'])).toBe('A, B');
    expect(normalizeAuthor(null)).toBe(null);
    expect(normalizeAuthor({})).toBe(null);
  });
  it('keywords', () => {
    expect(normalizeKeywords('Chicken, Dinner , chicken', ['Quick'])).toEqual(['chicken', 'dinner', 'quick']);
    expect(normalizeKeywords(['a', 'b'])).toEqual(['a', 'b']);
    expect(normalizeKeywords(null)).toEqual([]);
  });
});
