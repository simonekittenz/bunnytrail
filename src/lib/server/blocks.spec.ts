import { describe, expect, it } from 'vitest';
import { renderBody } from './markdown';
import {
	parseIpaChart,
	parseOrthography,
	parseParadigm,
	renderIpaChart,
	renderOrthography,
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

const LETTERS = `
language: bay
columns: [Bajulan, IPA]
groups:
  - label: Consonants
    letters: {b: b, y: j, n: n, x: ks}
  - label: Vowels
    letters: {a: a, uh: y}
notesTitle: Pronunciation notes
notes:
  - Coda /r/ → [ɻ]
  - au = /au̯/
`;

describe('orthography', () => {
	const html = () => renderOrthography(parseOrthography(LETTERS, ctx));

	it('lays the groups side by side under shared headings, padding the shorter one', () => {
		const h = html();
		expect(h).toContain('<th scope="colgroup" colspan="2">Consonants</th>');
		expect(h).toContain('<th scope="colgroup" colspan="2">Vowels</th>');
		expect(h.match(/<th scope="col"[^>]*>Bajulan<\/th>/g)).toHaveLength(2);
		// 4 consonants set the depth: 4 body rows, and Vowels run out after 2.
		expect(h.match(/<tr>/g)).toHaveLength(2 + 4);
		// Vowels (2 letters) leave 2 of the 4 rows short; each pads a letter and a sound cell.
		expect(h.match(/bt-orthography__none/g)).toHaveLength(2 * 2);
	});

	it('does not mistake the letters y and n for YAML booleans', () => {
		const h = html();
		expect(h).toContain(
			'<td class="bt-orthography__letter">y</td><td class="bt-orthography__ipa">/j/</td>'
		);
		expect(h).toContain(
			'<td class="bt-orthography__letter">n</td><td class="bt-orthography__ipa">/n/</td>'
		);
	});

	it('puts bare sounds in slashes and leaves bracketed ones alone', () => {
		const h = renderOrthography(
			parseOrthography('groups:\n  - letters: {a: a, r: "[ɻ]", p: "/p/"}\n', ctx)
		);
		expect(h).toContain('/a/');
		expect(h).toContain('>[ɻ]<');
		expect(h).toContain('>/p/<');
		expect(h).not.toContain('//p//');
	});

	it('renders the notes as a list in a box after the table', () => {
		const h = html();
		expect(h).toContain(
			'<aside class="bt-orthography__notes"><strong>Pronunciation notes</strong>'
		);
		expect(h).toContain('<li>Coda /r/ → [ɻ]</li>');
		expect(h.indexOf('</table>')).toBeLessThan(h.indexOf('<aside'));
	});

	it('tags the table with the language for the conlang font', () => {
		expect(html()).toContain('lang="x-bay" data-conlang="true"');
	});

	it('needs no group labels, notes or language', () => {
		const h = renderOrthography(parseOrthography('groups:\n  - letters: {a: a}\n', ctx));
		expect(h).not.toContain('colgroup');
		expect(h).not.toContain('<aside');
		expect(h).toContain('<th scope="col">Spelling</th><th scope="col">Sound</th>');
	});

	it('names the problem: no groups, no letters, bad columns, unknown language', () => {
		expect(() => parseOrthography('title: x\n', ctx)).toThrow(/groups/);
		expect(() => parseOrthography('groups:\n  - letters: {}\n', ctx)).toThrow(/no letters/);
		expect(() => parseOrthography('columns: [A]\ngroups:\n  - letters: {a: a}\n', ctx)).toThrow(
			/exactly two/
		);
		expect(() => parseOrthography('language: nope\ngroups:\n  - letters: {a: a}\n', ctx)).toThrow(
			/unknown language/
		);
	});

	it('rejects a repeated letter within a group instead of silently dropping one', () => {
		const h = renderStructuredBlock('orthography', 'groups:\n  - letters: {a: a, a: e}\n', ctx)!;
		expect(h).toContain('bt-block-error');
	});

	it('escapes letters, sounds and notes', () => {
		const h = renderOrthography(
			parseOrthography('groups:\n  - letters: {"<b>": "&"}\nnotes: ["<i>"]\n', ctx)
		);
		expect(h).not.toContain('<b>');
		expect(h).not.toContain('<i>');
		expect(h).toContain('&lt;b&gt;');
		expect(h).toContain('/&amp;/');
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

	it('renders a fenced orthography; only the table is wrapped, not the notes', () => {
		const html = render('```orthography\ngroups:\n  - letters: {a: a}\nnotes: [hello]\n```\n');
		expect(html).toContain('class="bt-table bt-orthography"');
		expect(html.match(/bt-table-wrap/g)).toHaveLength(1);
		expect(html.indexOf('</table></div>')).toBeLessThan(html.indexOf('<aside'));
	});

	it('does not disturb ordinary fences or glossed language fences', () => {
		expect(render('```js\nx\n```\n')).toContain('<pre>');
	});
});
