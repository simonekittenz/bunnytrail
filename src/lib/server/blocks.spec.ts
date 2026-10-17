import { describe, expect, it } from 'vitest';
import { renderBody } from './markdown';
import {
	parseIpaChart,
	parseParadigm,
	renderIpaChart,
	renderParadigm,
	renderStructuredBlock
} from './blocks';

const codes = new Map([['bay', 'aurethia/people/languages/bajulan']]);
const ctx = { languageCodes: codes };

const CONSONANTS = `
type: consonants
columns: [Bilabial, Alveolar, Velar]
rows:
  Nasal: {Bilabial: m, Alveolar: n, Velar: ŋ}
  Plosive: {Bilabial: p b, Alveolar: t d, Velar: k}
  Affricate: {Alveolar: "t͡s, d͡z"}
  Approximant: {Velar: w w̃}
voicing: [Plosive, Affricate]
spelling: {ŋ: ng, "t͡s": ts}
`;

describe('ipa-chart', () => {
	const html = () => renderIpaChart(parseIpaChart(CONSONANTS));

	it('renders a labelled grid with one row and column header each', () => {
		const h = html();
		expect(h).toContain('<table class="bt-ipa bt-ipa--consonants">');
		expect(h).toContain('<th scope="col">Bilabial</th>');
		expect(h).toContain('<th scope="row">Plosive</th>');
		expect(h.match(/<tr>/g)).toHaveLength(1 + 4); // header + 4 manners
	});

	it('marks empty cells so the gaps in the inventory show', () => {
		const h = html();
		// Affricate only has Alveolar → 2 of its 3 cells are empty.
		const affricate = h.slice(h.indexOf('Affricate'), h.indexOf('Approximant'));
		expect(affricate.match(/bt-ipa__cell--empty/g)).toHaveLength(2);
	});

	it('reads a pair as voiceless then voiced, and describes each sound', () => {
		const h = html();
		expect(h).toContain('title="voiceless bilabial plosive"');
		expect(h).toContain('title="voiced bilabial plosive"');
		expect(h).toContain('bt-ipa__sym--vl');
		expect(h).toContain('bt-ipa__sym--vd');
	});

	it('does not call a plain/nasal pair voiceless and voiced (only listed rows are voicing rows)', () => {
		const h = html();
		expect(h).toContain('title="velar approximant"'); // both w and w̃
		expect(h.match(/title="velar approximant"/g)).toHaveLength(2);
		expect(h).not.toContain('voiced velar approximant');
	});

	it('claims no voicing at all unless the chart asks for it', () => {
		const h = renderIpaChart(parseIpaChart('columns: [A]\nrows:\n  Plosive: {A: p b}\n'));
		expect(h).not.toContain('voice');
		expect(h).toContain('bt-ipa__sym--next'); // still divided by a hairline
	});

	it('accepts `voicing: all`, and rejects a row that does not exist', () => {
		const h = renderIpaChart(
			parseIpaChart('voicing: all\ncolumns: [A]\nrows:\n  Plosive: {A: p b}\n')
		);
		expect(h).toContain('title="voiceless a plosive"');
		expect(() =>
			parseIpaChart('voicing: [Nope]\ncolumns: [A]\nrows:\n  Plosive: {A: p b}\n')
		).toThrow(/no such row/);
	});

	it('leaves a lone symbol unmarked for voicing', () => {
		const h = html();
		expect(h).toContain('title="bilabial nasal"');
		expect(h).toContain('title="velar nasal"');
	});

	it('accepts comma- or space-separated symbols and keeps tie-barred affricates whole', () => {
		const h = html();
		expect(h).toContain('<span class="bt-ipa__ipa">t͡s</span>');
		expect(h).toContain('<span class="bt-ipa__ipa">d͡z</span>');
	});

	it('shows the spelling under a symbol when given', () => {
		const h = html();
		expect(h).toContain('<span class="bt-ipa__sp">ng</span>');
		expect(h).toContain('<span class="bt-ipa__sp">ts</span>');
		expect(h).not.toContain('bt-ipa__sp">m<'); // no spelling given for m
	});

	it('describes vowels by height and position, without voicing', () => {
		const h = renderIpaChart(
			parseIpaChart('type: vowels\ncolumns: [Front, Back]\nrows:\n  Close: {Front: i y, Back: u}\n')
		);
		expect(h).toContain('bt-ipa--vowels');
		expect(h).toContain('title="close front vowel"');
		expect(h).not.toContain('voiceless');
	});

	it('accepts `places` as an alias for `columns`, and a title as caption', () => {
		const h = renderIpaChart(parseIpaChart('title: Inventory\nplaces: [A]\nrows:\n  R: {A: x}\n'));
		expect(h).toContain('<caption>Inventory</caption>');
	});

	it('names the problem: unknown column, empty rows, bad type', () => {
		expect(() => parseIpaChart('columns: [A]\nrows:\n  R: {B: x}\n')).toThrow(
			/unknown column "B".*A/
		);
		expect(() => parseIpaChart('columns: [A]\nrows: {}\n')).toThrow(/empty/);
		expect(() => parseIpaChart('type: tones\ncolumns: [A]\nrows:\n  R: {A: x}\n')).toThrow(
			/consonants or vowels/
		);
		expect(() => parseIpaChart('rows:\n  R: {A: x}\n')).toThrow(/columns/);
	});

	it('escapes everything it prints', () => {
		const h = renderIpaChart(parseIpaChart('columns: ["<b>"]\nrows:\n  "&": {"<b>": "<i>"}\n'));
		expect(h).not.toContain('<b>');
		expect(h).toContain('&lt;b&gt;');
		expect(h).toContain('&amp;');
	});
});

const VERBS = `
title: "Non-finite: manyǐ"
note: "nominalization stem: manyan-"
columns: [Actor, Patient, Goal]
groups:
  - label: Non-resultative
    rows:
      Plain: [many|an, many|uh, many|ay]
      Weakest: [manyanauwi, manyuhwi, manyayauwi]
  - label: Resultative
    rows:
      Plain: [many|anu, many|u, many|ayu]
`;

describe('paradigm', () => {
	const html = () => renderParadigm(parseParadigm(VERBS, ctx));

	it('renders column headers, row headers and labelled group rows', () => {
		const h = html();
		expect(h).toContain('<table class="bt-paradigm">');
		expect(h).toContain('<th scope="col">Actor</th>');
		expect(h).toContain('<th scope="row">Weakest</th>');
		expect(h).toContain('<th scope="colgroup" colspan="4">Non-resultative</th>');
		expect(h).toContain('<th scope="colgroup" colspan="4">Resultative</th>');
	});

	it('repeats a row label in different groups without clashing', () => {
		expect(html().match(/<th scope="row">Plain<\/th>/g)).toHaveLength(2);
	});

	it('highlights the ending after a | and leaves other forms plain', () => {
		const h = html();
		expect(h).toContain('many<span class="bt-paradigm__end">an</span>');
		expect(h).toContain('<td>manyanauwi</td>');
	});

	it('puts title and note in the caption', () => {
		const h = html();
		expect(h).toContain('<span class="bt-paradigm__title">Non-finite: manyǐ</span>');
		expect(h).toContain('<span class="bt-paradigm__note">nominalization stem: manyan-</span>');
	});

	it('pads a short row with empty cells', () => {
		const h = renderParadigm(parseParadigm('columns: [A, B, C]\nrows:\n  R: [x]\n', ctx));
		expect(h).toContain('<td>x</td><td></td><td></td>');
	});

	it('works as a single ungrouped table', () => {
		const h = renderParadigm(
			parseParadigm('columns: [Sg, Pl]\nrows:\n  Nom: [a, b]\n  Acc: [c, d]\n', ctx)
		);
		expect(h).not.toContain('bt-paradigm__group');
		expect(h).toContain('<th scope="row">Acc</th>');
	});

	it('tags the table with the language when one is named', () => {
		const h = renderParadigm(
			parseParadigm('language: bajulan\ncolumns: [A]\nrows:\n  R: [x]\n', ctx)
		);
		expect(h).toContain('lang="x-bay"');
		expect(h).toContain('data-conlang="true"');
	});

	it('names the problem: unknown language, too many forms, both rows and groups, neither', () => {
		expect(() => parseParadigm('language: nope\ncolumns: [A]\nrows:\n  R: [x]\n', ctx)).toThrow(
			/unknown language "nope"/
		);
		expect(() => parseParadigm('columns: [A]\nrows:\n  R: [x, y]\n', ctx)).toThrow(
			/2 forms but only 1 columns/
		);
		expect(() =>
			parseParadigm('columns: [A]\nrows:\n  R: [x]\ngroups:\n  - rows:\n      R: [x]\n', ctx)
		).toThrow(/either/);
		expect(() => parseParadigm('columns: [A]\n', ctx)).toThrow(/needs `rows` or `groups`/);
		expect(() => parseParadigm('columns: [A]\nrows:\n  R: nope\n', ctx)).toThrow(/expected a list/);
	});

	it('escapes forms and labels', () => {
		const h = renderParadigm(parseParadigm('columns: ["<A>"]\nrows:\n  "a&b": ["<x>|<y>"]\n', ctx));
		expect(h).not.toContain('<x>');
		expect(h).toContain('&lt;x&gt;<span class="bt-paradigm__end">&lt;y&gt;</span>');
		expect(h).toContain('a&amp;b');
	});
});

describe('renderStructuredBlock', () => {
	it('ignores names that are not structured blocks', () => {
		expect(renderStructuredBlock('js', 'x', ctx)).toBeNull();
		expect(renderStructuredBlock(undefined, 'x', ctx)).toBeNull();
	});

	it('shows a visible error box for bad input instead of dropping the block', () => {
		const h = renderStructuredBlock('ipa-chart', 'columns: [A\n', ctx)!;
		expect(h).toContain('class="bt-block-error"');
		expect(h).toContain('ipa-chart');
		expect(renderStructuredBlock('paradigm', 'just text', ctx)).toContain('bt-block-error');
	});
});

describe('structured blocks in markdown', () => {
	const render = (md: string) => renderBody(md, () => null, codes);

	it('renders a fenced ipa-chart, wrapped once for scrolling like any table', () => {
		const html = render('Intro.\n\n```ipa-chart\ncolumns: [A]\nrows:\n  R: {A: x y}\n```\n');
		expect(html).toContain('class="bt-table bt-ipa bt-ipa--consonants"');
		expect(html.match(/bt-table-wrap/g)).toHaveLength(1);
		expect(html).not.toContain('<pre>');
	});

	it('renders a fenced paradigm', () => {
		const html = render('```paradigm\ncolumns: [A]\nrows:\n  R: [one|two]\n```\n');
		expect(html).toContain('class="bt-table bt-paradigm"');
		expect(html).toContain('bt-paradigm__end');
	});

	it('does not disturb ordinary fences or glossed language fences', () => {
		expect(render('```js\nx\n```\n')).toContain('<pre>');
	});
});
