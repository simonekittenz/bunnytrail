import { describe, expect, it } from 'vitest';
import { renderBody } from './markdown';
import { extractHeadings, parseTocSetting, resolveToc, TOC_AUTO_MIN_HEADINGS } from './toc';
import type { TocItem } from '#lib/types.js';

const item = (id: string, level: 2 | 3 = 2): TocItem => ({ id, text: id, level });

describe('extractHeadings', () => {
	it('returns h2 and h3 with their ids, in order', () => {
		const html = '<h1 id="t">T</h1><h2 id="a">A</h2><p>x</p><h3 id="b">B</h3><h4 id="c">C</h4>';
		expect(extractHeadings(html)).toEqual([
			{ id: 'a', text: 'A', level: 2 },
			{ id: 'b', text: 'B', level: 3 }
		]);
	});

	it('flattens inline markup and decodes entities', () => {
		const html = '<h2 id="p">Particles &amp; <em>Clauses</em> <a href="/x">here</a></h2>';
		expect(extractHeadings(html)[0]!.text).toBe('Particles & Clauses here');
	});

	it('skips headings without an id and empty ones', () => {
		expect(extractHeadings('<h2>No id</h2><h2 id="e"> </h2>')).toEqual([]);
	});

	it('agrees with the ids the renderer actually emits, including duplicates', () => {
		const html = renderBody(
			'## Examples\n\ntext\n\n### Examples\n\nmore\n\n## Café Ünder\n',
			() => null
		);
		expect(extractHeadings(html).map((h) => h.id)).toEqual([
			'examples',
			'examples-2',
			'cafe-under'
		]);
	});
});

describe('parseTocSetting', () => {
	it('accepts the three words and booleans', () => {
		expect(parseTocSetting('auto')).toBe('auto');
		expect(parseTocSetting('always')).toBe('always');
		expect(parseTocSetting('never')).toBe('never');
		expect(parseTocSetting(true)).toBe('always');
		expect(parseTocSetting(false)).toBe('never');
	});
	it('ignores anything else', () => {
		expect(parseTocSetting('sometimes')).toBeNull();
		expect(parseTocSetting(undefined)).toBeNull();
		expect(parseTocSetting(3)).toBeNull();
	});
});

describe('resolveToc', () => {
	const few = [item('a'), item('b')];
	const many = Array.from({ length: TOC_AUTO_MIN_HEADINGS }, (_, i) => item(`h${i}`));

	it('hides a small page and shows a big one by default', () => {
		expect(resolveToc(few, null, null)).toEqual([]);
		expect(resolveToc(many, null, null)).toEqual(many);
	});
	it('lets the entity force it on or off', () => {
		expect(resolveToc(few, 'always', null)).toEqual(few);
		expect(resolveToc(many, 'never', null)).toEqual([]);
	});
	it("lets a page override its entity's setting", () => {
		expect(resolveToc(many, 'always', 'never')).toEqual([]);
		expect(resolveToc(few, 'never', 'always')).toEqual(few);
	});
	it('never shows an empty TOC, even when forced', () => {
		expect(resolveToc([], 'always', 'always')).toEqual([]);
	});
});
