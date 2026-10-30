/**
 * Conlang lexicon helpers — pure functions, no graph or filesystem access.
 *
 * Three jobs:
 *
 *   1. **Collation** — sort a dictionary in the language's own alphabet
 *      order (`ch`, `ng`, `dz` are single letters), ignoring tone marks.
 *   2. **Lookup** — build an index over a language's words so a surface
 *      token from running text can be resolved to its entry.
 *   3. **Analysis** — when a token isn't a headword, try the cheap
 *      morphology a lexicon can express: hyphenated compounds and
 *      stripping known suffix / prefix entries (`-ut`, `pi-`, …).
 *
 * Tone marks are grammatical in tonal languages, so every step tries the
 * exact (tone-marked) form first and only then falls back to a
 * tone-insensitive match, flagging the result as `approx`.
 */

/** The slice of a dictionary entry that lookup and analysis need. */
export interface LexiconWord {
	/** Headword. A leading `-` marks a suffix, a trailing `-` a prefix. */
	word: string;
	meaning: string | null;
	pos: string | null;
	/** Short interlinear label (`LOC`, `love`). Falls back to `meaning`. */
	gloss: string | null;
	ipa: string | null;
	/** Extra surface forms that should resolve to this entry. */
	forms: string[];
	/** Stable anchor id on the dictionary page. */
	id: string;
}

export interface AnalysisPart {
	/** The piece of the surface token this part covers. */
	text: string;
	entry: LexiconWord | null;
}

export interface Analysis {
	/** Token exactly as written. */
	surface: string;
	/** The matched headword when the token is a single word, else the stem. */
	entry: LexiconWord | null;
	/** Other entries sharing the same form (homographs). */
	alts: LexiconWord[];
	/** Interlinear label, e.g. `love-LOC`. `null` if nothing is known. */
	gloss: string | null;
	/** Longer meaning of the main entry. */
	meaning: string | null;
	/** Morpheme breakdown when more than one piece was involved. */
	parts: AnalysisPart[];
	/** True when the match ignored tone marks or went through affix stripping. */
	approx: boolean;
}

export interface LexiconIndex {
	analyze(token: string): Analysis | null;
}

// ── Normalisation ────────────────────────────────────────────────────

/** NFC + lowercase, with curly apostrophes straightened. The canonical lookup key. */
export function normalizeWord(s: string): string {
	return s.normalize('NFC').toLowerCase().replace(/[\u2019\u02BC]/g, "'");
}

/**
 * Remove tone diacritics and hiatus apostrophes — `ǎ` → `a`, `do'an` →
 * `doan`. Both are optional or variable in ordinary writing, so loose
 * matching and sorting ignore them.
 */
export function stripMarks(s: string): string {
	// U+0300–U+036F is the combining-diacritics block that holds tone marks. Spelled
	// out because the offline iPad runtime can't parse Unicode property escapes.
	return s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]+/g, '')
		.normalize('NFC')
		.replace(/['\u2019\u02BC]/g, '');
}

/** Trim the affix hyphen off an entry word, returning the bare form. */
function bareAffix(word: string): string {
	return word.replace(/^-+|-+$/g, '');
}

type AffixKind = 'suffix' | 'prefix' | null;

function affixKind(word: string): AffixKind {
	const startsDash = word.startsWith('-');
	const endsDash = word.endsWith('-');
	if (startsDash && !endsDash) return 'suffix';
	if (endsDash && !startsDash) return 'prefix';
	return null;
}

// ── Collation ────────────────────────────────────────────────────────

export interface Collation {
	/** Fixed-width key: plain string comparison orders words correctly. */
	sortKey(word: string): string;
	compare(a: string, b: string): number;
	/**
	 * The alphabet letter a word files under — the first letter of its
	 * collation split, so `chan` is `ch`, not `c`. Lowercase, as the alphabet
	 * lists it; empty for a word with no letters at all.
	 */
	letter(word: string): string;
}

/**
 * Build a collation for a language.
 *
 * `order` lists the alphabet's letters in sort order (digraphs allowed —
 * `['a','b','ch','d',…]`). Words are split greedily, longest letter
 * first, so `ch` sorts as one letter rather than `c` + `h`. Tone marks
 * are ignored for the primary order and only used to break ties. Letters
 * not in the list sort after all listed ones, by code point.
 *
 * With no `order`, falls back to the locale collator.
 */
export function makeCollation(order?: readonly string[]): Collation {
	const letters = (order ?? []).map((l) => stripMarks(normalizeWord(l))).filter(Boolean);
	if (letters.length === 0) {
		const lc = new Intl.Collator(undefined, { sensitivity: 'base' });
		return {
			sortKey: (w) => stripMarks(normalizeWord(w)),
			compare: (a, b) => lc.compare(a, b) || normalizeWord(a).localeCompare(normalizeWord(b)),
			letter: (w) => [...stripMarks(normalizeWord(w)).replace(/^-+|-+$/g, '')][0] ?? ''
		};
	}

	const rank = new Map<string, number>();
	letters.forEach((l, i) => {
		if (!rank.has(l)) rank.set(l, i);
	});
	const maxLen = Math.max(...letters.map((l) => [...l].length));
	const WIDTH = 4;
	const enc = (n: number) => n.toString(36).padStart(WIDTH, '0');

	const sortKey = (word: string): string => {
		const chars = [...stripMarks(normalizeWord(word)).replace(/^-+|-+$/g, '')];
		let key = '';
		let i = 0;
		while (i < chars.length) {
			let matched = false;
			for (let len = Math.min(maxLen, chars.length - i); len >= 1; len--) {
				const r = rank.get(chars.slice(i, i + len).join(''));
				if (r !== undefined) {
					key += enc(r);
					i += len;
					matched = true;
					break;
				}
			}
			if (!matched) {
				key += enc(letters.length + 1 + (chars[i]!.codePointAt(0) ?? 0));
				i += 1;
			}
		}
		return key;
	};

	const letter = (word: string): string => {
		const chars = [...stripMarks(normalizeWord(word)).replace(/^-+|-+$/g, '')];
		if (chars.length === 0) return '';
		for (let len = Math.min(maxLen, chars.length); len >= 1; len--) {
			const candidate = chars.slice(0, len).join('');
			if (rank.has(candidate)) return candidate;
		}
		return chars[0]!;
	};

	return {
		sortKey,
		letter,
		compare: (a, b) => {
			const ka = sortKey(a);
			const kb = sortKey(b);
			if (ka !== kb) return ka < kb ? -1 : 1;
			return normalizeWord(a).localeCompare(normalizeWord(b));
		}
	};
}

// ── Short labels ─────────────────────────────────────────────────────

/** The label shown under a word in an interlinear gloss. */
export function glossLabel(e: Pick<LexiconWord, 'gloss' | 'meaning' | 'pos'>): string | null {
	if (e.gloss && e.gloss.trim()) return e.gloss.trim();
	if (!e.meaning) return null;
	let m = e.meaning.split(/[;,(]|\s\/\s/)[0]!.trim();
	if (e.pos && /^v/i.test(e.pos)) m = m.replace(/^to\s+/i, '');
	return m || null;
}

// ── Index + analysis ─────────────────────────────────────────────────

interface Affix {
	entry: LexiconWord;
	/** Tone-stripped, lowercase, hyphen-free form used for matching. */
	base: string;
	/** Human display form (`-ut`). */
	display: string;
}

const MAX_AFFIX_DEPTH = 2;

export function buildLexiconIndex(words: readonly LexiconWord[]): LexiconIndex {
	/** exact (tone-marked) form → entries */
	const exact = new Map<string, LexiconWord[]>();
	/** tone-stripped form → entries */
	const loose = new Map<string, LexiconWord[]>();
	const suffixes: Affix[] = [];
	const prefixes: Affix[] = [];

	const add = (map: Map<string, LexiconWord[]>, key: string, w: LexiconWord) => {
		const arr = map.get(key);
		if (!arr) map.set(key, [w]);
		else if (!arr.includes(w)) arr.push(w);
	};

	for (const w of words) {
		const forms = [w.word, ...w.forms];
		const kind = affixKind(w.word);
		if (kind) {
			for (const f of forms) {
				const base = stripMarks(normalizeWord(bareAffix(f)));
				if (!base) continue;
				(kind === 'suffix' ? suffixes : prefixes).push({ entry: w, base, display: f });
			}
			continue;
		}
		for (const f of forms) {
			const key = normalizeWord(f);
			if (!key || /\s/.test(key)) continue; // phrases aren't token-addressable
			add(exact, key, w);
			add(loose, stripMarks(key), w);
		}
	}
	suffixes.sort((a, b) => b.base.length - a.base.length);
	prefixes.sort((a, b) => b.base.length - a.base.length);

	const compose = (
		surface: string,
		parts: AnalysisPart[],
		approx: boolean,
		stem: AnalysisPart | null,
		alts: LexiconWord[]
	): Analysis => {
		const labels = parts.map((p) => (p.entry ? (glossLabel(p.entry) ?? '?') : '?'));
		const anyKnown = parts.some((p) => p.entry);
		const main = stem?.entry ?? parts.find((p) => p.entry)?.entry ?? null;
		return {
			surface,
			entry: main,
			alts,
			gloss: anyKnown ? labels.join('-') : null,
			meaning: main?.meaning ?? null,
			parts: parts.length > 1 ? parts : [],
			approx
		};
	};

	/** Whole-word match, exact first and then tone-insensitive. */
	const direct = (token: string): Analysis | null => {
		const key = normalizeWord(token);
		const hit = exact.get(key);
		if (hit) {
			return compose(token, [{ text: token, entry: hit[0]! }], false, null, hit.slice(1));
		}
		const soft = loose.get(stripMarks(key));
		if (soft) {
			return compose(token, [{ text: token, entry: soft[0]! }], true, null, soft.slice(1));
		}
		return null;
	};

	/** Peel known affixes off a token. Operates on tone-stripped text. */
	const peel = (token: string, depth: number): Analysis | null => {
		const base = stripMarks(normalizeWord(token));
		const whole = direct(token);
		if (whole) return whole;
		if (depth >= MAX_AFFIX_DEPTH) return null;

		for (const sfx of suffixes) {
			if (base.length - sfx.base.length < 2 || !base.endsWith(sfx.base)) continue;
			const stemText = token.slice(0, token.length - sfx.base.length);
			const stem = peel(stemText || base.slice(0, base.length - sfx.base.length), depth + 1);
			if (stem?.entry || (stem && stem.parts.length)) {
				const parts = [
					...(stem.parts.length ? stem.parts : [{ text: stem.surface, entry: stem.entry }]),
					{ text: sfx.display.replace(/^-+/, ''), entry: sfx.entry }
				];
				return compose(token, parts, true, { text: stem.surface, entry: stem.entry }, stem.alts);
			}
		}
		for (const pfx of prefixes) {
			if (base.length - pfx.base.length < 2 || !base.startsWith(pfx.base)) continue;
			const stemText = token.slice(pfx.base.length);
			const stem = peel(stemText || base.slice(pfx.base.length), depth + 1);
			if (stem?.entry || (stem && stem.parts.length)) {
				const parts = [
					{ text: pfx.display.replace(/-+$/, ''), entry: pfx.entry },
					...(stem.parts.length ? stem.parts : [{ text: stem.surface, entry: stem.entry }])
				];
				return compose(token, parts, true, { text: stem.surface, entry: stem.entry }, stem.alts);
			}
		}
		return null;
	};

	const analyze = (token: string): Analysis | null => {
		const t = token.normalize('NFC');
		if (!t) return null;

		// 1. The whole token is a headword or a listed form.
		const whole = direct(t);
		if (whole) return whole;

		// 2. Hyphenated compound / clitic chain: gloss each piece.
		if (t.includes('-')) {
			const pieces = t.split('-').filter(Boolean);
			if (pieces.length > 1) {
				const parts: AnalysisPart[] = [];
				let approx = false;
				let known = 0;
				for (let i = 0; i < pieces.length; i++) {
					const piece = pieces[i]!;
					// A piece with a hyphen on its right is a prefix, one with a
					// hyphen on its left a suffix — try those entries first.
					const base = stripMarks(normalizeWord(piece));
					const aff =
						(i < pieces.length - 1 ? prefixes.find((x) => x.base === base) : undefined) ??
						(i > 0 ? suffixes.find((x) => x.base === base) : undefined);
					if (aff) {
						known += 1;
						parts.push({ text: piece, entry: aff.entry });
						continue;
					}
					const a = peel(piece, 0);
					if (a?.entry) {
						known += 1;
						if (a.approx) approx = true;
						if (a.parts.length) parts.push(...a.parts);
						else parts.push({ text: piece, entry: a.entry });
					} else {
						parts.push({ text: piece, entry: null });
					}
				}
				if (known > 0) {
					const out = compose(t, parts, approx, null, []);
					out.parts = parts;
					return out;
				}
			}
		}

		// 3. Known suffixes / prefixes around a known stem.
		return peel(t, 0);
	};

	return { analyze };
}

// ── Snippet parsing ──────────────────────────────────────────────────

export interface SnippetToken {
	kind: 'word' | 'punct';
	/** Leading punctuation, the word, and trailing punctuation are split so
	 *  only the word is looked up but the whole chunk still reads naturally. */
	pre: string;
	text: string;
	post: string;
	/** Author-supplied gloss from `word{gloss}`; overrides the lexicon. */
	override: string | null;
}

export interface Snippet {
	tokens: SnippetToken[];
	/** Free translation (`= …` lines). */
	translation: string | null;
	/** Literal / word-for-word translation (`~ …` lines). */
	literal: string | null;
}

const EDGE_PUNCT = /[\s.,;:!?¡¿"“”„‘’'()[\]…—–«»]/u;

function splitEdges(chunk: string): { pre: string; core: string; post: string } {
	const chars = [...chunk];
	let a = 0;
	let b = chars.length;
	while (a < b && EDGE_PUNCT.test(chars[a]!)) a++;
	while (b > a && EDGE_PUNCT.test(chars[b - 1]!)) b--;
	return {
		pre: chars.slice(0, a).join(''),
		core: chars.slice(a, b).join(''),
		post: chars.slice(b).join('')
	};
}

/** Split one line of running text into words and punctuation. */
export function tokenizeLine(line: string): SnippetToken[] {
	const out: SnippetToken[] = [];
	for (const chunk of line.split(/\s+/).filter(Boolean)) {
		const { pre, core, post } = splitEdges(chunk);
		if (!core) {
			out.push({ kind: 'punct', pre: '', text: chunk, post: '', override: null });
			continue;
		}
		let text = core;
		let override: string | null = null;
		const ov = core.match(/^(.*?)\{([^}]*)\}$/);
		if (ov && ov[1]) {
			text = ov[1];
			override = ov[2]!.trim();
		}
		out.push({ kind: 'word', pre, text, post, override });
	}
	return out;
}

/**
 * Parse the body of a language-tagged fence into snippets.
 *
 *     Muhe whuhn ptiwaú uzwhan.
 *     ~ gladly I welcome-you our-home
 *     = I gladly welcome you to our home.
 *
 * Blank lines separate snippets. Lines starting with `=` are the free
 * translation, lines starting with `~` the literal one; everything else
 * is source text in the language. `word{gloss}` overrides the lookup.
 */
export function parseSnippets(text: string): Snippet[] {
	const snippets: Snippet[] = [];
	for (const block of text.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
		const source: string[] = [];
		const translation: string[] = [];
		const literal: string[] = [];
		for (const raw of block.split('\n')) {
			const line = raw.trim();
			if (!line) continue;
			if (line.startsWith('=')) translation.push(line.slice(1).trim());
			else if (line.startsWith('~')) literal.push(line.slice(1).trim());
			else source.push(line);
		}
		if (source.length === 0) continue;
		snippets.push({
			tokens: source.flatMap((l) => tokenizeLine(l)),
			translation: translation.length ? translation.join(' ') : null,
			literal: literal.length ? literal.join(' ') : null
		});
	}
	return snippets;
}

/** URL-safe, ASCII anchor for a headword (`manyǐ` → `manyi`). */
export function wordSlug(word: string): string {
	const s = stripMarks(normalizeWord(word))
		.replace(/^-+/, 'sfx-')
		.replace(/-+$/, '-pfx')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return s || 'word';
}
