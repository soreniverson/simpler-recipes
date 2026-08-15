import { describe, it, expect } from 'vitest';
import { scaleIngredientLine, scaleIngredientLines, parseNumber, formatQuantity, findScalableNumbers } from '../src/lib/recipe/scale';

const s = (line: string, f: number) => scaleIngredientLine(line, f);

describe('parseNumber / formatQuantity', () => {
  it('parses all forms', () => {
    expect(parseNumber('1/2')).toBe(0.5);
    expect(parseNumber('1 1/2')).toBe(1.5);
    expect(parseNumber('2½')).toBe(2.5);
    expect(parseNumber('2 ½')).toBe(2.5);
    expect(parseNumber('½')).toBe(0.5);
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('3')).toBe(3);
    expect(parseNumber('abc')).toBe(null);
  });
  it('formats nicely and never strips zeros from integers', () => {
    expect(formatQuantity(440)).toBe('440');
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(1 / 3)).toBe('⅓');
    expect(formatQuantity(2 / 3)).toBe('⅔');
    expect(formatQuantity(0.125)).toBe('⅛');
    expect(formatQuantity(2.2)).toBe('2.2');
    expect(formatQuantity(10)).toBe('10');
  });
});

describe('scaleIngredientLine — the production bugs', () => {
  it('fractions', () => {
    expect(s('1/2 cup milk', 2)).toBe('1 cup milk');
    expect(s('1/8 tsp salt', 2)).toBe('¼ tsp salt');
    expect(s('1/3 cup flour', 2)).toBe('⅔ cup flour');
    expect(s('1/3 cup flour', 3)).toBe('1 cup flour');
    expect(s('½ cup butter', 3)).toBe('1½ cups butter');
    expect(s('1 1/2 cups water', 2)).toBe('3 cups water');
    expect(s('2½ cups sugar', 2)).toBe('5 cups sugar');
  });
  it('integers keep their zeros', () => {
    expect(s('400 g flour', 1.1)).toBe('440 g flour');
    expect(s('400 g flour', 2)).toBe('800 g flour');
    expect(s('10 g salt', 10)).toBe('100 g salt');
  });
  it('ranges scale both ends', () => {
    expect(s('1 - 2 tbsp oil', 2)).toBe('2 - 4 tbsp oil');
    expect(s('3-4 chicken thighs', 2)).toBe('6-8 chicken thighs');
    expect(s('2 to 3 tablespoons', 2)).toBe('4 to 6 tablespoons');
    expect(s('1–2 cloves garlic', 3)).toBe('3–6 cloves garlic');
  });
  it('dual units scale both halves; conversions in parens scale too', () => {
    expect(s('600g / 1.2lb chicken', 2)).toBe('1200g / 2½lb chicken'); // weight rounds to quarters
    expect(s('600 g / 1.2 lb chicken', 0.5)).toBe('300 g / ½ lb chicken');
    expect(s('1 lb / 500g beef', 2)).toBe('2 lb / 1000g beef');
    expect(s('10 g / 2 tsp salt', 1.5)).toBe('15 g / 3 tsp salt');
    expect(s('3 tbsp (45ml) oil', 2)).toBe('6 tbsp (90ml) oil');
    expect(s('1 cup (240 ml) milk', 0.5)).toBe('½ cup (120 ml) milk');
  });
  it('does not scale container sizes or description numbers', () => {
    expect(s('1 (14 oz) can tomatoes', 2)).toBe('2 (14 oz) can tomatoes');
    expect(s('2 cans (400g each) chickpeas', 2)).toBe('4 cans (400g each) chickpeas');
    expect(s('1 tsp salt, plus more for the 2 cups pasta water', 2)).toBe('2 tsp salt, plus more for the 2 cups pasta water');
    expect(s('4 chicken thighs, cut into 2cm pieces', 2)).toBe('8 chicken thighs, cut into 2cm pieces');
  });
  it('rounds like a cook', () => {
    expect(s('1 egg', 1.0833)).toBe('1 egg');
    expect(s('2 cloves garlic', 1.0833)).toBe('2 cloves garlic');
    expect(s('3 eggs', 1.5)).toBe('5 eggs');
    expect(s('3 eggs', 0.5)).toBe('2 eggs');
    expect(s('1 onion', 0.5)).toBe('½ onion');
    expect(s('1 egg', 2)).toBe('2 eggs');
    expect(s('2 large eggs', 0.5)).toBe('1 large egg');
    expect(s('1 onion', 1.75)).toBe('2 onions');
    expect(s('1 tsp cumin', 1.0833)).toBe('1⅛ tsp cumin'); // ⅛ tsp is a real measure
    expect(s('250 g flour', 1.1)).toBe('275 g flour');
    expect(s('333 ml stock', 1)).toBe('333 ml stock');
    expect(s('1 cup rice', 1.1)).toBe('1⅛ cups rice');
    expect(s('1 cup rice', 1.3)).toBe('1⅓ cups rice');
  });
  it('leaves unscalable lines alone', () => {
    expect(s('Salt to taste', 2)).toBe('Salt to taste');
    expect(s('Pinch of salt', 2)).toBe('Pinch of salt');
    expect(s('Olive oil, for frying', 2)).toBe('Olive oil, for frying');
    expect(s('Fresh parsley', 2)).toBe('Fresh parsley');
    expect(s('', 2)).toBe('');
  });
  it('factor 1 is identity', () => {
    expect(s('1/2 cup milk', 1)).toBe('1/2 cup milk');
    expect(scaleIngredientLines(['1/2 cup milk'], 4, 4)).toEqual(['1/2 cup milk']);
  });
  it('scaleIngredientLines uses from/to', () => {
    expect(scaleIngredientLines(['1 cup rice', '2 eggs'], 4, 8)).toEqual(['2 cups rice', '4 eggs']);
  });
});

describe('scaleIngredientLine — critique cases (Tikka Masala 4→7 and 4→1)', () => {
  const s = scaleIngredientLine;
  it('countables round to whole numbers and later parentheticals scale', () => {
    expect(s('6 cloves garlic, minced (~1½ tbsp)', 1.75)).toBe('11 cloves garlic, minced (~2⅔ tbsp)');
    expect(s('1 clove garlic', 2)).toBe('2 cloves garlic');
  });
  it('tiny tablespoon amounts become teaspoons; tiny cup amounts become tablespoons', () => {
    expect(s('1 tbsp fresh ginger (grated)', 0.25)).toBe('¾ tsp fresh ginger (grated)');
    expect(s('1 tablespoon vegetable oil', 0.25)).toBe('¾ teaspoon vegetable oil');
    expect(s('1 - 2 tbsp oil', 0.25)).toBe('¾ - 1½ tsp oil');
    expect(s('¼ cup water', 0.25)).toBe('1 tbsp water');
    expect(s('1⅓ cups (400ml) tomato passata', 0.25)).toBe('⅓ cup (100 ml) tomato passata'.replace(' ml', 'ml'));
  });
  it('units agree in number', () => {
    expect(s('1 cup flour', 2)).toBe('2 cups flour');
    expect(s('2 cups flour', 0.5)).toBe('1 cup flour');
    expect(s('2 tablespoons sugar', 0.5)).toBe('1 tablespoon sugar');
    expect(s('1 teaspoon salt', 3)).toBe('3 teaspoons salt');
  });
  it('sum parentheticals scale each part; container sizes still never scale', () => {
    expect(s('100 ml (⅓ cup + 1 tbsp) cream', 0.25)).toBe('25 ml (1⅓ tbsp + ¾ tsp) cream');
    expect(s('2 cans (400 g each) chopped tomatoes', 2)).toBe('4 cans (400 g each) chopped tomatoes');
    expect(s('1 can (14 oz) black beans', 2)).toBe('2 cans (14 oz) black beans');
    expect(s('1 (14 oz) can black beans', 2)).toBe('2 (14 oz) can black beans');
    expect(s('juice of 1 lemon', 2)).toBe('juice of 1 lemon');
  });
});
