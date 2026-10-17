import { describe, expect, it } from 'vitest';
import {
	buildLexiconIndex,
	glossLabel,
	makeCollation,
	normalizeWord,
	parseSnippets,
	stripMarks,
	tokenizeLine,
	wordSlug,
	type LexiconWord
} from './lexicon';

function w(word: string, over: Partial<LexiconWord> = {}): LexiconWord {
	return {
		word,
		meaning: null,
		pos: null,
		gloss: null,
		ipa: null,
		forms: [],
		id: wordSlug(word),
		...over
	};
}

const words: LexiconWord[] = [
	w('manyan', { meaning: 'to love', pos: 'verb', forms: ['manyuh', 'manyay'] }),
	w('plang', { meaning: 'city; hilltop', pos: 'noun' }),
	w('bajur', { meaning: 'Bajur', pos: 'proper noun' }),
	w('-ut', { meaning: 'in, at, on', pos: 'suffix', gloss: 'LOC' }),
	w('-â', { meaning: 'to, toward', pos: 'suffix', gloss: 'ALL' }),
	w('kunǎy', { meaning: 'where', pos: 'wh-word' }),
	w('pi-', { meaning: 'inchoative', pos: 'prefix', gloss: 'INCH' }),
	w('plaleh', { meaning: 'to speak', pos: 'verb' }),
	w('ki-', { meaning: 'imperative', pos: 'prefix', gloss: 'IMP' }),
	w('tsuhn', { meaning: 'your', pos: 'pronoun' }),
	// homographs
	w('sa', { meaning: 'water', pos: 'noun' }),
	w('sa', { meaning: 'and', pos: 'conj' })
];

describe('normalizeWord / stripMarks', () => {
	it('lowercases and composes', () => {
		expect(normalizeWord('Manyǐ')).toBe('manyǐ');
		expect(normalizeWord('a\u0300')).toBe('à');
	});
	it('straightens curly apostrophes', () => {
		expect(normalizeWord('Do’an')).toBe("do'an");
	});
	it('ignores hiatus apostrophes when matching loosely', () => {
		expect(stripMarks("do'an")).toBe('doan');
		expect(stripMarks('do’an')).toBe('doan');
	});
	it('strips tone diacritics', () => {
		expect(stripMarks('kunǎy')).toBe('kunay');
		expect(stripMarks('ptiwaú')).toBe('ptiwau');
		expect(stripMarks('bajurôh')).toBe('bajuroh');
	});
});

describe('glossLabel', () => {
	it('prefers an explicit gloss', () => {
		expect(glossLabel({ gloss: 'LOC', meaning: 'in, at, on', pos: 'suffix' })).toBe('LOC');
	});
	it('takes the first meaning chunk and drops "to" on verbs', () => {
		expect(glossLabel({ gloss: null, meaning: 'to love', pos: 'verb' })).toBe('love');
		expect(glossLabel({ gloss: null, meaning: 'city; hilltop', pos: 'noun' })).toBe('city');
		expect(glossLabel({ gloss: null, meaning: 'to the east', pos: 'adv' })).toBe('to the east');
	});
	it('returns null when nothing is known', () => {
		expect(glossLabel({ gloss: null, meaning: null, pos: null })).toBeNull();
	});
});

describe('lexicon analysis', () => {
	const idx = buildLexiconIndex(words);

	it('matches headwords and listed forms exactly', () => {
		const a = idx.analyze('manyan')!;
		expect(a.entry?.word).toBe('manyan');
		expect(a.gloss).toBe('love');
		expect(a.approx).toBe(false);
		expect(idx.analyze('manyuh')!.entry?.word).toBe('manyan');
	});

	it('is case-insensitive', () => {
		expect(idx.analyze('Plang')!.entry?.word).toBe('plang');
	});

	it('falls back to a tone-insensitive match and flags it approx', () => {
		const a = idx.analyze('kunay')!;
		expect(a.entry?.word).toBe('kunǎy');
		expect(a.approx).toBe(true);
	});

	it('matches across a dropped or curly hiatus apostrophe', () => {
		const idx2 = buildLexiconIndex([w("do’an", { meaning: 'to walk', pos: 'verb' })]);
		expect(idx2.analyze("do'an")!.entry?.word).toBe("do’an");
		expect(idx2.analyze('doan')!.entry?.word).toBe("do’an");
		expect(idx2.analyze('doan')!.approx).toBe(true);
	});

	it('keeps homographs as alternatives', () => {
		const a = idx.analyze('sa')!;
		expect(a.entry?.meaning).toBe('water');
		expect(a.alts.map((e) => e.meaning)).toEqual(['and']);
	});

	it('strips a known suffix: plangut → city-LOC', () => {
		const a = idx.analyze('plangut')!;
		expect(a.gloss).toBe('city-LOC');
		expect(a.entry?.word).toBe('plang');
		expect(a.approx).toBe(true);
		expect(a.parts.map((p) => p.text)).toEqual(['plang', 'ut']);
	});

	it('strips a suffix whose tone differs on the surface form', () => {
		expect(idx.analyze('bajurâ')!.gloss).toBe('Bajur-ALL');
	});

	it('strips a prefix: piplang → INCH-city', () => {
		const a = idx.analyze('piplang')!;
		expect(a.gloss).toBe('INCH-city');
	});

	it('splits hyphenated chains and glosses each piece', () => {
		const a = idx.analyze('ki-plaleh')!;
		expect(a.gloss).toBe('IMP-speak');
		expect(a.parts.map((p) => p.text)).toEqual(['ki', 'plaleh']);
	});

	it('marks unknown pieces of a chain with ?', () => {
		const a = idx.analyze('plang-zzz')!;
		expect(a.gloss).toBe('city-?');
	});

	it('returns null for completely unknown words', () => {
		expect(idx.analyze('zzzzz')).toBeNull();
		expect(idx.analyze('')).toBeNull();
	});

	it('does not over-strip: a suffix needs a stem of at least two letters', () => {
		// "ut" alone is a suffix; with nothing in front there is no stem.
		expect(idx.analyze('ut')).toBeNull();
	});
});

describe('collation', () => {
	const order = ['a', 'b', 'ch', 'd', 'e', 'k', 'l', 'm', 'n', 'ng', 'o', 'p', 's', 'sh', 't', 'u'];
	const col = makeCollation(order);

	it('treats digraphs as single letters', () => {
		// "ch" sorts after "b" and before "d" — not between "c" and "d" via c+h
		const sorted = ['dan', 'chan', 'ban', 'ang'].sort(col.compare);
		expect(sorted).toEqual(['ang', 'ban', 'chan', 'dan']);
	});

	it('puts ng after n but before o', () => {
		const sorted = ['oba', 'nga', 'nab', 'nu'].sort(col.compare);
		expect(sorted).toEqual(['nab', 'nu', 'nga', 'oba']);
	});

	it('ignores tone marks for the primary order, breaking ties on them', () => {
		const sorted = ['bá', 'ba', 'bb'].sort(col.compare);
		expect(sorted[2]).toBe('bb');
		expect(sorted.slice(0, 2).sort()).toEqual(['ba', 'bá']);
	});

	it('exposes a string key whose plain order matches compare()', () => {
		const ws = ['sha', 'sa', 'ta', 'chu', 'ang'];
		const byKey = [...ws].sort((x, y) => (col.sortKey(x) < col.sortKey(y) ? -1 : 1));
		expect(byKey).toEqual([...ws].sort(col.compare));
	});

	it('sorts unlisted letters after listed ones', () => {
		expect(['zed', 'ban'].sort(col.compare)).toEqual(['ban', 'zed']);
	});

	it('falls back to the locale collator without an order', () => {
		const plain = makeCollation();
		expect(['b', 'á', 'a'].sort(plain.compare)).toEqual(['a', 'á', 'b']);
	});
});

describe('snippet parsing', () => {
	it('splits words from edge punctuation', () => {
		const toks = tokenizeLine('“Kunǎy tsuhn yawatlan?”');
		expect(toks.map((t) => t.text)).toEqual(['Kunǎy', 'tsuhn', 'yawatlan']);
		expect(toks[0]!.pre).toBe('“');
		expect(toks[2]!.post).toBe('?”');
	});

	it('keeps hyphens and inner apostrophes inside a word', () => {
		const toks = tokenizeLine("ki-plaleh don't");
		expect(toks.map((t) => t.text)).toEqual(['ki-plaleh', "don't"]);
	});

	it('reads {gloss} overrides, even before punctuation', () => {
		const [t] = tokenizeLine('yawatlu{from-born}.');
		expect(t!.text).toBe('yawatlu');
		expect(t!.override).toBe('from-born');
		expect(t!.post).toBe('.');
	});

	it('parses translation and literal lines, split on blank lines', () => {
		const snips = parseSnippets(
			['Se Zhiwan.', '~ I Zhiwan', '= I am Zhiwan.', '', 'Muhe whuhn.', '= Gladly.'].join('\n')
		);
		expect(snips).toHaveLength(2);
		expect(snips[0]!.literal).toBe('I Zhiwan');
		expect(snips[0]!.translation).toBe('I am Zhiwan.');
		expect(snips[1]!.tokens.map((t) => t.text)).toEqual(['Muhe', 'whuhn']);
	});

	it('joins multi-line source and ignores snippets with no source text', () => {
		const snips = parseSnippets('a b\nc d\n= x\n\n= only a translation');
		expect(snips).toHaveLength(1);
		expect(snips[0]!.tokens).toHaveLength(4);
	});
});

describe('wordSlug', () => {
	it('is ascii and anchor-safe', () => {
		expect(wordSlug('manyǐ')).toBe('manyi');
		expect(wordSlug('-ut')).toBe('sfx-ut');
		expect(wordSlug('pi-')).toBe('pi-pfx');
		expect(wordSlug('???')).toBe('word');
	});
});
