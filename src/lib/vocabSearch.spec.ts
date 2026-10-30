import { describe, expect, it } from 'vitest';
import { entryMatches, fold } from './vocabSearch';

const entry = {
	word: 'kunǎy',
	forms: ['kunay-lu'],
	ipa: "ku'nai",
	meaning: 'where',
	gloss: 'where-Q',
	notes: 'asks about a place',
	pos: 'pronoun',
	cls: 'interrogative'
};

describe('fold', () => {
	it('lowercases and drops tone marks', () => {
		expect(fold('Kunǎy')).toBe('kunay');
	});
});

describe('entryMatches', () => {
	it('matches everything for an empty query', () => {
		expect(entryMatches(entry, '', 'word')).toBe(true);
	});

	it('finds the language side in "word" scope, tone-insensitively', () => {
		expect(entryMatches(entry, 'kunay', 'word')).toBe(true);
		expect(entryMatches(entry, 'kunay-lu', 'word')).toBe(true);
		expect(entryMatches(entry, "ku'n", 'word')).toBe(true);
	});

	it('does not look at the translation in "word" scope', () => {
		expect(entryMatches(entry, 'where', 'word')).toBe(false);
		expect(entryMatches(entry, 'place', 'word')).toBe(false);
	});

	it('finds the translation side in "meaning" scope', () => {
		expect(entryMatches(entry, 'where', 'meaning')).toBe(true);
		expect(entryMatches(entry, 'where-q', 'meaning')).toBe(true);
		expect(entryMatches(entry, 'a place', 'meaning')).toBe(true);
	});

	it('does not look at the language side in "meaning" scope', () => {
		expect(entryMatches(entry, 'kunay', 'meaning')).toBe(false);
		expect(entryMatches(entry, "ku'nai", 'meaning')).toBe(false);
	});

	it('searches both sides, plus part of speech and class, in "all" scope', () => {
		expect(entryMatches(entry, 'kunay', 'all')).toBe(true);
		expect(entryMatches(entry, 'where', 'all')).toBe(true);
		expect(entryMatches(entry, 'pronoun', 'all')).toBe(true);
		expect(entryMatches(entry, 'interrog', 'all')).toBe(true);
		expect(entryMatches(entry, 'zzz', 'all')).toBe(false);
	});

	it('copes with missing fields', () => {
		const bare = {
			...entry,
			ipa: null,
			meaning: null,
			gloss: null,
			notes: null,
			pos: null,
			cls: null,
			forms: []
		};
		expect(entryMatches(bare, 'kunay', 'word')).toBe(true);
		expect(entryMatches(bare, 'x', 'meaning')).toBe(false);
	});
});
