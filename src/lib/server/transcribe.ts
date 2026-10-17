/**
 * Spelling → pronunciation, from a language's own letter table.
 *
 * Given the letter→sound pairs of an `orthography` block (plus, optionally,
 * which two-letter onsets are legal and where stress falls), turn a written
 * word into a phonemic transcription: `kunǎy` → `kuˈnǎj`. Used to fill in
 * dictionary pronunciations nobody typed.
 *
 * What it does:
 *   - matches letters longest-first, so `eh`, `ts`, `ng` are one letter each,
 *     with tone marks allowed in the middle of a digraph (`ôh`);
 *   - carries tone marks onto the vowel of the transcription;
 *   - reads an apostrophe as a syllable break, so `a'u` is two vowels and
 *     `au` one;
 *   - finds syllables (a vowel plus the legal onset before it) to place stress.
 *
 * What it deliberately does not do: allophony (unreleased stops, dark l…).
 * The output is phonemic. Anything it can't read — an unknown letter,
 * punctuation — yields `null` rather than a half-right guess.
 */

import { parse as parseYaml } from 'yaml';

export type StressRule = 'final' | 'initial' | 'penultimate' | 'none';

export interface PronunciationRules {
	/** Spelling → sound, e.g. `eh` → `ɛ`. Keys are lowercase, without tone marks. */
	letters: ReadonlyMap<string, string>;
	/** Legal two-letter onsets, spelled in letters: `pt`, `pl`. */
	clusters: ReadonlySet<string>;
	stress: StressRule;
	/** Separate syllables with dots (`ma.ˈnjan`). */
	dots: boolean;
}

const STRESS_RULES: readonly StressRule[] = ['final', 'initial', 'penultimate', 'none'];

/** Base letters of vowel sounds, used to tell a nucleus from a consonant. */
const VOWEL_BASES = new Set([...'aeiouyɛɔæɑɒəɘɵøœɶɨʉɯɤʌɐɪʏʊɜɞɚɝ']);

const MARK_RE = /[\u0300-\u036f]/;
/** Sentence punctuation around a word (`tsey!`, `(sa)`); never the apostrophe, which is a hiatus mark. */
const EDGE_PUNCT_RE =
	/^[.,;:!?\u00a1\u00bf"\u201c\u201d\u2026()[\]\u00ab\u00bb]+|[.,;:!?\u00a1\u00bf"\u201c\u201d\u2026()[\]\u00ab\u00bb]+$/g;
const APOSTROPHE_RE = /['\u2019\u02BC]/;

function isVowelSound(sound: string): boolean {
	const first = sound.normalize('NFD')[0];
	return first !== undefined && VOWEL_BASES.has(first);
}

function str(v: unknown): string | null {
	if (typeof v === 'string') return v.trim() || null;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	return null;
}

/**
 * Read pronunciation rules out of an `orthography` block's parsed YAML.
 * Throws an `Error` with a message fit to show an author when the optional
 * `stress`, `clusters` or `syllables` keys are wrong.
 */
export function parsePronunciationRules(doc: Record<string, unknown>): PronunciationRules {
	const letters = new Map<string, string>();
	if (!Array.isArray(doc.groups)) throw new Error('`groups` must be a list');
	for (const g of doc.groups as unknown[]) {
		const lets = (g as Record<string, unknown> | null)?.letters;
		if (!lets || typeof lets !== 'object' || Array.isArray(lets)) continue;
		for (const [letter, sound] of Object.entries(lets as Record<string, unknown>)) {
			const key = letter.normalize('NFC').toLowerCase();
			const value = str(sound)?.replace(/^\/|\/$/g, '');
			// The first group to define a letter wins.
			if (value && !letters.has(key)) letters.set(key, value);
		}
	}

	let stress: StressRule = 'none';
	if (doc.stress !== undefined && doc.stress !== null) {
		const s = str(doc.stress);
		if (!s || !STRESS_RULES.includes(s as StressRule)) {
			throw new Error(`\`stress\` must be one of ${STRESS_RULES.join(', ')}`);
		}
		stress = s as StressRule;
	}

	const clusters = new Set<string>();
	if (doc.clusters !== undefined && doc.clusters !== null) {
		if (!Array.isArray(doc.clusters)) throw new Error('`clusters` must be a list of letter pairs');
		for (const c of doc.clusters as unknown[]) {
			const s = str(c);
			if (!s) throw new Error('`clusters` has an empty entry');
			clusters.add(s.normalize('NFC').toLowerCase());
		}
	}

	if (doc.syllables !== undefined && typeof doc.syllables !== 'boolean') {
		throw new Error('`syllables` must be true or false');
	}

	return { letters, clusters, stress, dots: doc.syllables === true };
}

interface Seg {
	vowel: boolean;
	/** The letter(s) as written, for matching clusters. */
	letter: string;
	/** The sound, with any tone mark already on it. */
	sound: string;
}

const HIATUS = 'hiatus' as const;
type Item = Seg | typeof HIATUS;

/** Put tone marks right after the first character of a vowel sound. */
function withMarks(sound: string, marks: string): string {
	if (!marks) return sound;
	const [head = '', ...rest] = [...sound];
	return head + marks + rest.join('');
}

/** Split one word into letters, or `null` if any part can't be read. */
function segment(word: string, rules: PronunciationRules, maxLen: number): Item[] | null {
	const bases: string[] = [];
	const marks: string[] = [];
	for (const ch of word.normalize('NFD').toLowerCase()) {
		if (MARK_RE.test(ch)) {
			if (bases.length === 0) return null;
			marks[bases.length - 1] += ch;
		} else {
			bases.push(ch);
			marks.push('');
		}
	}

	const items: Item[] = [];
	let i = 0;
	while (i < bases.length) {
		if (APOSTROPHE_RE.test(bases[i]!)) {
			items.push(HIATUS);
			i += 1;
			continue;
		}
		let matched = false;
		for (let len = Math.min(maxLen, bases.length - i); len >= 1 && !matched; len--) {
			const letter = bases.slice(i, i + len).join('');
			const sound = rules.letters.get(letter);
			if (sound === undefined) continue;
			const tone = marks.slice(i, i + len).join('');
			const vowel = isVowelSound(sound);
			if (tone && !vowel) return null; // a tone mark on a consonant isn't something we can place
			items.push({ vowel, letter, sound: vowel ? withMarks(sound, tone) : sound });
			i += len;
			matched = true;
		}
		if (!matched) return null;
	}
	return items;
}

/** Index of the first item of each syllable. */
function syllableStarts(items: Item[], rules: PronunciationRules): number[] {
	const nuclei: number[] = [];
	items.forEach((it, idx) => {
		if (it !== HIATUS && it.vowel) nuclei.push(idx);
	});
	const starts = [0];
	for (let k = 1; k < nuclei.length; k++) {
		const prev = nuclei[k - 1]!;
		const cur = nuclei[k]!;
		// Consonants since the last apostrophe (or the last vowel).
		let from = prev + 1;
		for (let j = prev + 1; j < cur; j++) if (items[j] === HIATUS) from = j + 1;
		const run = cur - from;
		if (run <= 0) {
			starts.push(cur);
		} else if (run === 1) {
			starts.push(cur - 1);
		} else {
			// Take the longest legal onset: a listed cluster, else one consonant.
			const a = items[cur - 2] as Seg;
			const b = items[cur - 1] as Seg;
			starts.push(rules.clusters.has(a.letter + b.letter) ? cur - 2 : cur - 1);
		}
	}
	return starts;
}

function stressedSyllable(count: number, rule: StressRule): number | null {
	if (count < 2) return null; // a one-syllable word needs no mark
	if (rule === 'final') return count - 1;
	if (rule === 'initial') return 0;
	if (rule === 'penultimate') return count - 2;
	return null;
}

function build(items: Item[], rules: PronunciationRules): string {
	const starts = syllableStarts(items, rules);
	const stressed = stressedSyllable(starts.length, rules.stress);
	let out = '';
	items.forEach((it, idx) => {
		const syl = starts.indexOf(idx);
		if (syl >= 0) {
			if (syl === stressed) out += 'ˈ';
			else if (syl > 0 && rules.dots) out += '.';
		}
		if (it !== HIATUS) out += it.sound;
	});
	return out;
}

/**
 * Transcribe a written word, or return `null` when any part of it isn't
 * covered by the rules. Hyphens and spaces separate words, each stressed
 * on its own; an affix (`-ut`, `pi-`) is left unstressed.
 */
export function transcribe(word: string, rules: PronunciationRules): string | null {
	const trimmed = word.trim();
	if (!trimmed || rules.letters.size === 0) return null;

	const isAffix = trimmed.startsWith('-') || trimmed.endsWith('-');
	const parts = trimmed
		.split(/[\s-]+/)
		.map((p) => p.replace(EDGE_PUNCT_RE, ''))
		.filter(Boolean);
	if (parts.length === 0) return null;

	const maxLen = Math.max(...[...rules.letters.keys()].map((k) => [...k].length));
	const effective = isAffix ? { ...rules, stress: 'none' as const } : rules;

	const out: string[] = [];
	for (const part of parts) {
		const items = segment(part, rules, maxLen);
		if (!items) return null;
		out.push(build(items, effective));
	}
	return out.join(' ').normalize('NFC');
}

// ── Finding the rules, and filling a dictionary ──────────────────────

const FENCE_RE = /^[ \t]*(`{3,}|~{3,})orthography[^\n]*\n([\s\S]*?)\n[ \t]*\1[ \t]*$/gm;

/**
 * The pronunciation rules written in a language's own pages: the first
 * ```orthography fence, across the given markdown bodies, that parses.
 * The letter table an author already wrote for readers is the single
 * source — nothing is declared twice. A fence that is malformed is
 * skipped here (it shows its error on the page itself).
 */
export function findPronunciationRules(bodies: readonly string[]): PronunciationRules | null {
	for (const body of bodies) {
		for (const m of body.matchAll(FENCE_RE)) {
			try {
				const doc = parseYaml(m[2]!);
				if (!doc || typeof doc !== 'object' || Array.isArray(doc)) continue;
				const rules = parsePronunciationRules(doc as Record<string, unknown>);
				if (rules.letters.size > 0) return rules;
			} catch {
				continue;
			}
		}
	}
	return null;
}

/**
 * Give every entry that has no pronunciation one generated from its
 * spelling. A pronunciation someone typed is never touched. Returns how
 * many were filled in.
 */
export function fillPronunciations<
	T extends { word: string; ipa: string | null; ipaAuto: boolean }
>(entries: readonly T[], rules: PronunciationRules): number {
	let filled = 0;
	for (const e of entries) {
		if (e.ipa) continue;
		const ipa = transcribe(e.word, rules);
		if (ipa) {
			e.ipa = ipa;
			e.ipaAuto = true;
			filled += 1;
		}
	}
	return filled;
}
