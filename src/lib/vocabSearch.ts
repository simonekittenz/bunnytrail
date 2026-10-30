import type { VocabEntry } from '#lib/types.js';

/**
 * Which side of a dictionary entry a search looks at.
 *
 * - `word`: the language itself — the headword, its other forms and its
 *   pronunciation.
 * - `meaning`: the translation — the meaning, the short gloss and the notes.
 * - `all`: both of those, plus part of speech and class.
 */
export type SearchScope = 'all' | 'word' | 'meaning';

export const SEARCH_SCOPES: readonly SearchScope[] = ['all', 'word', 'meaning'];

/** Lowercase and drop tone marks, so "kunay" finds "kunǎy". */
export function fold(s: string): string {
	// U+0300–U+036F is the combining-diacritics block that holds tone marks.
	return s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]+/g, '')
		.toLowerCase();
}

type Searchable = Pick<
	VocabEntry,
	'word' | 'forms' | 'ipa' | 'meaning' | 'gloss' | 'notes' | 'pos' | 'cls'
>;

function fieldsFor(e: Searchable, scope: SearchScope): (string | null)[] {
	const language = [e.word, ...e.forms, e.ipa];
	const translation = [e.meaning, e.gloss, e.notes];
	switch (scope) {
		case 'word':
			return language;
		case 'meaning':
			return translation;
		default:
			return [...language, ...translation, e.pos, e.cls];
	}
}

/** Does `entry` match the already-folded query `q` within `scope`? An empty query matches everything. */
export function entryMatches(entry: Searchable, q: string, scope: SearchScope): boolean {
	if (!q) return true;
	return fieldsFor(entry, scope).some((field) => field && fold(field).includes(q));
}
