import { describe, expect, it } from 'vitest';
import { countWords, entityWordCount, hasProse } from './prose';

const sec = (body: string) => ({ slug: 's', title: 'S', body, toc: null, mdPath: '' });
const chap = (body: string) => ({ slug: 'c', order: 1, title: 'C', body, mdPath: '' });
const entity = (body: string, sections: string[] = [], summary?: string, chapters: string[] = []) =>
	({
		body,
		sections: sections.map(sec),
		chapters: chapters.map(chap),
		meta: { name: 'X', summary }
	}) as never;

describe('countWords', () => {
	it('counts whitespace-separated words', () => {
		expect(countWords('one two\nthree\t four')).toBe(4);
	});

	it('is zero for empty or blank text', () => {
		expect(countWords('')).toBe(0);
		expect(countWords('  \n ')).toBe(0);
	});
});

describe('entityWordCount', () => {
	it('adds section prose to the body and summary', () => {
		const e = entity('a b c', ['d e', 'f g h i'], 'j k');
		expect(entityWordCount(e)).toBe(3 + 2 + 4 + 2);
	});

	it('adds chapter prose too', () => {
		const e = entity('a b', ['c'], 'd', ['e f g', 'h']);
		expect(entityWordCount(e)).toBe(2 + 1 + 1 + 3 + 1);
	});

	it('counts an entity with no sections or chapters as before', () => {
		expect(entityWordCount(entity('a b', [], 'c'))).toBe(3);
	});
});

describe('hasProse', () => {
	it('is true for a body', () => {
		expect(hasProse(entity('words'))).toBe(true);
	});

	it('is true when only a section has prose', () => {
		expect(hasProse(entity('', ['grammar notes']))).toBe(true);
	});

	it('is true when only a chapter has prose', () => {
		expect(hasProse(entity('', [], undefined, ['once upon a time']))).toBe(true);
	});

	it('is false for an empty body and blank sections and chapters', () => {
		expect(hasProse(entity('  ', ['', '\n'], undefined, [' ']))).toBe(false);
	});
});
