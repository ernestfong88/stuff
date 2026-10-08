import { readFileSync } from 'node:fs';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { docxText, documentXmlText, recipeFileKind, rtfText } from '../model/recipeFile';
import { nameFromFile, parseDuration, parseIngredientLine, parseQty, parseRecipeDoc, sampleFromPhoto } from '../model/recipeImport';

const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

describe('recipe import: amounts', () => {
  it('reads whole numbers, decimals, fractions and fraction glyphs', () => {
    expect(parseQty('2')).toBe(2);
    expect(parseQty('0.5')).toBe(0.5);
    expect(parseQty('1/2')).toBe(0.5);
    expect(parseQty('1 1/2')).toBe(1.5);
    expect(parseQty('1½')).toBe(1.5);
    expect(parseQty('1 ½')).toBe(1.5);
    expect(parseQty('¾')).toBe(0.75);
    expect(parseQty('2⁄3')).toBeCloseTo(0.667, 3);
  });

  it('splits an ingredient line into amount, unit and name', () => {
    expect(parseIngredientLine('1½ cups all-purpose flour, sifted')).toEqual({ qty: 1.5, unit: 'cup', name: 'all-purpose flour, sifted' });
    expect(parseIngredientLine('- 2 Tablespoons olive oil')).toEqual({ qty: 2, unit: 'tbsp', name: 'olive oil' });
    expect(parseIngredientLine('• 1 tsp. kosher salt')).toEqual({ qty: 1, unit: 'tsp', name: 'kosher salt' });
    expect(parseIngredientLine('2-3 cloves garlic, minced')).toEqual({ qty: 2, unit: 'cloves', name: 'garlic, minced' });
    expect(parseIngredientLine('1 to 2 pinches of cayenne')).toEqual({ qty: 1, unit: 'pinch', name: 'cayenne' });
    expect(parseIngredientLine('8 fl oz heavy cream')).toEqual({ qty: 8, unit: 'fl oz', name: 'heavy cream' });
    expect(parseIngredientLine('1 (14 oz) can diced tomatoes')).toEqual({ qty: 1, unit: 'can', name: 'diced tomatoes (14 oz)' });
    expect(parseIngredientLine('500 g penne')).toEqual({ qty: 500, unit: 'g', name: 'penne' });
    expect(parseIngredientLine('1 qt chicken stock')).toEqual({ qty: 1, unit: 'qt', name: 'chicken stock' });
    expect(parseIngredientLine('2 large eggs')).toEqual({ qty: 2, unit: '', name: 'large eggs' });
    expect(parseIngredientLine('1 T butter')).toEqual({ qty: 1, unit: 'tbsp', name: 'butter' });
    expect(parseIngredientLine('1 t vanilla')).toEqual({ qty: 1, unit: 'tsp', name: 'vanilla' });
    expect(parseIngredientLine('3 garlic cloves')).toEqual({ qty: 3, unit: '', name: 'garlic cloves' });
  });

  it("doesn't take a timing or a step for an ingredient", () => {
    expect(parseIngredientLine('20 minutes, stirring often')).toBeNull();
    expect(parseIngredientLine('350°F oven')).toBeNull();
    expect(parseIngredientLine('Salt to taste')).toBeNull();
  });

  it('reads times', () => {
    expect(parseDuration('45 minutes')).toBe(45);
    expect(parseDuration('1 hr')).toBe(60);
    expect(parseDuration('1 hr 15 min')).toBe(75);
    expect(parseDuration('1½ hours')).toBe(90);
    expect(parseDuration('20-25 mins')).toBe(20);
    expect(parseDuration('until golden')).toBeNull();
  });
});

describe('recipe import: whole recipes', () => {
  it('reads a recipe card with headings, bullets, numbered steps and a wrapped line', () => {
    const { recipe: r, unplaced, suggestedAllergens } = parseRecipeDoc(fixture('shepherds-pie.txt'), 'shepherds-pie');
    expect(r.name).toBe("Shepherd's Pie");
    expect(r.cat).toBe('Entrees');
    expect(r.desc).toMatch(/^A Sunday favourite/);
    expect(r.baseServings).toBe(8);
    expect(r.prepMin).toBe(25);
    expect(r.cookMin).toBe(70);
    expect(r.ingredients).toHaveLength(12);
    expect(r.ingredients?.[0]).toEqual({ qty: 2, unit: 'lb', name: 'ground lamb' });
    expect(r.ingredients?.[5]).toEqual({ qty: 1.5, unit: 'cup', name: 'beef stock' });
    expect(r.ingredients?.[7]).toEqual({ qty: 0.5, unit: 'cup', name: 'frozen peas' });
    expect(r.ingredients?.[11]).toEqual({ qty: 0, unit: '', name: 'Salt and pepper, to taste' });
    expect(r.method).toHaveLength(5);
    expect(r.method?.[1]).toBe('Brown the lamb in a large pan, then add the onion, carrot and garlic and cook until soft, about 8 minutes.');
    expect(r.plating).toEqual(['Spoon a square portion onto a warm plate, crust side up.']);
    expect(r.garnish).toBe('chopped parsley');
    expect(r.equipment).toEqual(['9x13 pan', 'large saute pan', 'potato masher']);
    expect(r.cookNotes).toMatch(/Holds hot for 45 minutes[\s\S]*Chef Ana's binder/);
    expect(unplaced).toEqual([]);
    expect(suggestedAllergens).toEqual(expect.arrayContaining(['Milk']));
  });

  it('reads a pasted recipe with no headings at all', () => {
    const { recipe: r } = parseRecipeDoc(
      'Meatloaf\nServes 8\n2 lb ground beef\n1 cup breadcrumbs\n2 eggs\n½ cup ketchup\nMix gently, form a loaf and bake at 350 for 45 minutes.\nRest 10 minutes before slicing.',
    );
    expect(r.name).toBe('Meatloaf');
    expect(r.baseServings).toBe(8);
    expect(r.ingredients?.map((i) => i.name)).toEqual(['ground beef', 'breadcrumbs', 'eggs', 'ketchup']);
    expect(r.method).toEqual(['Mix gently, form a loaf and bake at 350 for 45 minutes.', 'Rest 10 minutes before slicing.']);
  });

  it('reads Markdown with "Directions", "Step N" and a yield in servings', () => {
    const { recipe: r } = parseRecipeDoc(
      [
        '# Lemon Cheesecake Bars',
        '**Yield:** 2 trays (24 servings)',
        '**Prep time:** 30 minutes',
        '**Bake time:** 40 minutes',
        '',
        '## Ingredients',
        '* 2 cups flour',
        '* 1/2 cup powdered sugar',
        '* 1 cup butter, softened',
        '* 4 eggs',
        '* 1 1/2 cups sugar',
        '* 1/3 cup lemon juice',
        '',
        '## Directions',
        'Step 1: Heat the oven to 350°F.',
        'Step 2: Press the crust into the pan and bake 20 minutes.',
        'Step 3: Whisk the filling, pour over the crust and bake 20 minutes more.',
      ].join('\n'),
    );
    expect(r.name).toBe('Lemon Cheesecake Bars');
    expect(r.cat).toBe('Desserts');
    expect(r.baseServings).toBe(24);
    expect(r.prepMin).toBe(30);
    expect(r.cookMin).toBe(40);
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients?.[5]).toEqual({ qty: 1 / 3, unit: 'cup', name: 'lemon juice' });
    expect(r.method).toHaveLength(3);
    expect(r.method?.[0]).toBe('Heat the oven to 350°F.');
  });

  it('keeps unnumbered method paragraphs as steps and "Instructions" as the method', () => {
    const { recipe: r } = parseRecipeDoc(
      'Tomato Bisque\n\nINGREDIENTS:\n2 tbsp butter\n1 onion, chopped\n28 oz canned tomatoes\n2 cups cream\n\nINSTRUCTIONS:\nMelt the butter and soften the onion.\nAdd the tomatoes and simmer 20 minutes.\nBlend smooth and stir in the cream.',
    );
    expect(r.cat).toBe('Starters');
    expect(r.ingredients).toHaveLength(4);
    expect(r.method).toHaveLength(3);
  });

  it("lists what it couldn't place instead of dropping it", () => {
    const { recipe: r, unplaced } = parseRecipeDoc(
      'Chicken Pot Pie\nBy Grandma Rose, from her church cookbook\nTotal time: 2 hours\n\nIngredients\nFor the filling:\n2 lb chicken thighs\n\nMethod\n1. Bake.',
    );
    expect(r.name).toBe('Chicken Pot Pie');
    expect(r.cat).toBe('Entrees');
    expect(unplaced).toEqual(['By Grandma Rose, from her church cookbook', 'Total time: 2 hours', 'For the filling:']);
  });

  it('names the recipe from the file when the text has no title', () => {
    expect(parseRecipeDoc('2 cups rice\n4 cups water', 'Coconut Rice').recipe.name).toBe('Coconut Rice');
    expect(nameFromFile('coconut-rice_final.docx')).toBe('Coconut Rice Final');
    expect(nameFromFile('IMG_2041.HEIC')).toBe('');
  });

  it('fills a sample from the stand-in AI for a photo, marked AI drafted', () => {
    const blank = sampleFromPhoto('');
    expect(blank.recipe.name).toBe('Meatloaf');
    expect(blank.recipe.ingredients?.length).toBeGreaterThan(0);
    expect(blank.recipe.aiDrafted).toEqual(expect.arrayContaining(['ingredients', 'method']));
    const named = sampleFromPhoto('Herb Crusted Salmon');
    expect(named.recipe.name).toBe('Herb Crusted Salmon');
    expect(named.recipe.ingredients?.[0].name).toMatch(/salmon/);
    expect(named.suggestedAllergens).toContain('Fish');
  });
});

describe('recipe import: files', () => {
  it('knows the kind of file', () => {
    expect(recipeFileKind('Pie.DOCX')).toBe('docx');
    expect(recipeFileKind('pie.md')).toBe('text');
    expect(recipeFileKind('pie.rtf')).toBe('rtf');
    expect(recipeFileKind('pie.pdf')).toBe('pdf');
    expect(recipeFileKind('IMG_1.heic')).toBe('image');
    expect(recipeFileKind('scan', 'image/jpeg')).toBe('image');
    expect(recipeFileKind('old.doc')).toBe('doc');
    expect(recipeFileKind('sheet.xlsx')).toBe('other');
  });

  it('reads the text of a Word document, keeping paragraphs, headings and list items', async () => {
    const doc = new Document({
      numbering: {
        config: [{ reference: 'steps', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'left' }] }],
      },
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Herb Roasted Chicken')] }),
            new Paragraph('Serves 6 · Prep 15 min · Cook 1 hr'),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Ingredients')] }),
            new Paragraph({ text: '1 whole chicken (4 lb)', bullet: { level: 0 } }),
            new Paragraph({
              children: [new TextRun('2 tbsp '), new TextRun({ text: 'butter', bold: true }), new TextRun(', softened')],
              bullet: { level: 0 },
            }),
            new Paragraph({ text: '1 tsp salt & pepper', bullet: { level: 0 } }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Method')] }),
            new Paragraph({ text: 'Rub the chicken with the butter.', numbering: { reference: 'steps', level: 0 } }),
            new Paragraph({ text: 'Roast at 425°F until 165°F inside.', numbering: { reference: 'steps', level: 0 } }),
          ],
        },
      ],
    });
    const buf = await Packer.toBuffer(doc);
    const text = await docxText(buf);
    expect(text.split('\n')).toEqual([
      '# Herb Roasted Chicken',
      'Serves 6 · Prep 15 min · Cook 1 hr',
      '# Ingredients',
      '• 1 whole chicken (4 lb)',
      '• 2 tbsp butter, softened',
      '• 1 tsp salt & pepper',
      '# Method',
      '• Rub the chicken with the butter.',
      '• Roast at 425°F until 165°F inside.',
    ]);
    const { recipe: r } = parseRecipeDoc(text);
    expect(r.name).toBe('Herb Roasted Chicken');
    expect(r.baseServings).toBe(6);
    expect(r.prepMin).toBe(15);
    expect(r.cookMin).toBe(60);
    expect(r.ingredients).toEqual([
      { qty: 1, unit: '', name: 'whole chicken (4 lb)' },
      { qty: 2, unit: 'tbsp', name: 'butter, softened' },
      { qty: 1, unit: 'tsp', name: 'salt & pepper' },
    ]);
    expect(r.method).toEqual(['Rub the chicken with the butter.', 'Roast at 425°F until 165°F inside.']);
  });

  it('keeps tabs and line breaks, and skips deleted text and tab stops', () => {
    const xml =
      '<w:document><w:body>' +
      '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t>2</w:t><w:tab/><w:t xml:space="preserve">cups &amp; more</w:t></w:r></w:p>' +
      '<w:p/>' +
      '<w:p><w:r><w:t>Line one</w:t><w:br/><w:t>Line two</w:t><w:delText>gone</w:delText></w:r></w:p>' +
      '</w:body></w:document>';
    expect(documentXmlText(xml)).toBe('2\tcups & more\n\nLine one\nLine two');
  });

  it("explains a zip that isn't a Word document", async () => {
    const zip = new JSZip();
    zip.file('hello.txt', 'hi');
    await expect(docxText(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/Word document/);
  });

  it('reads RTF as text', () => {
    const rtf =
      "{\\rtf1\\ansi{\\fonttbl{\\f0 Helvetica;}}{\\*\\generator Word;}\\pard\\b Pancakes\\b0\\par\n{\\listtext\\'b7\\tab}1 cup flour\\par\n{\\listtext\\'b7\\tab}2 eggs\\par\nCaf\\'e9 \\u8211? whisk\\par}";
    expect(rtfText(rtf)).toBe('Pancakes\n·\t1 cup flour\n·\t2 eggs\nCafé – whisk');
    const { recipe: r } = parseRecipeDoc(rtfText(rtf));
    expect(r.name).toBe('Pancakes');
    expect(r.ingredients).toHaveLength(2);
    expect(rtfText('plain text')).toBe('plain text');
  });
});
