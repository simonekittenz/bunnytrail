import { describe, expect, it } from 'vitest';
import {
	fillPronunciations,
	findPronunciationRules,
	parsePronunciationRules,
	transcribe,
	type PronunciationRules
} from './transcribe';

/** Bajulan's own letter table, as written on its orthography page. */
const BAJULAN = {
	groups: [
		{
			letters: {
				b: 'b',
				d: 'd',
				j: 'd͡ʑ',
				k: 'k',
				l: 'l',
				m: 'm',
				n: 'n',
				p: 'p',
				r: 'r',
				s: 's',
				t: 't',
				w: 'w',
				x: 'ks',
				y: 'j',
				z: 'z'
			}
		},
		{ letters: { ch: 't͡ɕ', dz: 'd͡z', ng: 'ŋ', sh: 'ɕ', fh: 'θ', ts: 't͡s', wh: 'w̃ʰ', zh: 'ʑ' } },
		{ letters: { a: 'a', e: 'e', eh: 'ɛ', i: 'i', uh: 'y', u: 'u', o: 'o', oh: 'ɔ', au: 'au̯' } }
	],
	clusters: ['pt', 'pl', 'kl', 'tl'],
	stress: 'final'
};

const rules = (over: Record<string, unknown> = {}): PronunciationRules =>
	parsePronunciationRules({ ...BAJULAN, ...over });

const say = (word: string, over: Record<string, unknown> = {}) => transcribe(word, rules(over));

describe('transcribe: the spec’s own words', () => {
	it('places final stress and carries the tone mark: kunǎy', () => {
		expect(say('kunǎy')).toBe('kuˈnǎj');
	});

	it('leaves a one-syllable word unmarked: zhib, tsuhn', () => {
		expect(say('zhib')).toBe('ʑib');
		expect(say('tsuhn')).toBe('t͡syn');
	});

	it('treats ny as coda + onset, not an onset cluster: manyan', () => {
		expect(say('manyan')).toBe('manˈjan');
	});

	it('keeps a coda z before wh: uzwhan', () => {
		expect(say('uzwhan')).toBe('uzˈw̃ʰan');
	});

	it('reads au as one vowel with the tone on its first element: ptiwaú', () => {
		expect(say('ptiwaú')).toBe('ptiˈwáu̯');
	});

	it('maps j, and handles an ordinary two-syllable word: Bajur', () => {
		expect(say('Bajur')).toBe('baˈd͡ʑur');
	});

	it('uses a legal cluster as the onset: yawatlan → jawa|tlan', () => {
		expect(say('yawatlan')).toBe('jawaˈtlan');
	});

	it('splits a non-cluster between syllables: dehnde', () => {
		expect(say('dehnde')).toBe('dɛnˈde');
	});

	it('writes x as /ks/ and counts it as one letter: xau', () => {
		expect(say('xau')).toBe('ksau̯');
	});

	it('ignores case', () => {
		expect(say('KUNǍY')).toBe(say('kunǎy'));
	});
});

describe('transcribe: digraphs, tones, hiatus', () => {
	it('matches a digraph even with a tone mark between its letters: ôh', () => {
		expect(say('-ôh')).toBe('ɔ̂');
		expect(say('dêh')).toBe('dɛ̂');
	});

	it('reads an apostrophe as a syllable break, so a’u is not au', () => {
		expect(say("a'u")).toBe('aˈu');
		expect(say('au')).toBe('au̯');
		expect(say('do’an')).toBe('doˈan'); // curly apostrophe
	});

	it('refuses a tone mark on a consonant rather than guessing', () => {
		expect(say('m̀a')).toBeNull();
	});
});

describe('transcribe: what it will not do', () => {
	it('returns null for letters, digits and punctuation it does not know', () => {
		expect(say('hello')).toBeNull(); // h is not a letter of this table
		expect(say('a1')).toBeNull();
		expect(say('?')).toBeNull();
		expect(say('')).toBeNull();
		expect(say('   ')).toBeNull();
	});

	it('ignores sentence punctuation around a word, but not inside it', () => {
		expect(say('tsey-tsey!')).toBe('t͡sej t͡sej');
		expect(say('(zhib)')).toBe('ʑib');
		expect(say('“zhib”…')).toBe('ʑib');
		expect(say('zh?ib')).toBeNull();
		expect(say('...')).toBeNull();
	});

	it('returns null for everything when the language has no letter table', () => {
		expect(transcribe('ba', parsePronunciationRules({ groups: [] }))).toBeNull();
	});
});

describe('transcribe: affixes and compounds', () => {
	it('drops the hyphen and leaves affixes unstressed', () => {
		expect(say('-ut')).toBe('ut');
		expect(say('pi-')).toBe('pi');
		expect(say('-aya')).toBe('aja'); // two syllables, still no mark
	});

	it('treats each part of a hyphenated word or phrase on its own', () => {
		expect(say('arang-arang')).toBe('aˈraŋ aˈraŋ');
		expect(say('xau-xau antiehn')).toBe('ksau̯ ksau̯ antiˈɛn');
	});
});

describe('transcribe: the rules are configurable', () => {
	it('stress: initial, penultimate, none', () => {
		expect(say('manyan', { stress: 'initial' })).toBe('ˈmanjan');
		expect(say('yawatlan', { stress: 'penultimate' })).toBe('jaˈwatlan');
		expect(say('manyan', { stress: 'none' })).toBe('manjan');
	});

	it('does not stress a one-syllable word whatever the rule', () => {
		expect(say('zhib', { stress: 'initial' })).toBe('ʑib');
	});

	it('syllables: true shows the other syllable breaks', () => {
		expect(say('yawatlan', { syllables: true })).toBe('ja.waˈtlan');
	});

	it('without a clusters list only one consonant can start a syllable', () => {
		expect(say('yawatlan', { clusters: [] })).toBe('jawatˈlan');
	});

	it('defaults to no stress when the language says nothing', () => {
		const r = parsePronunciationRules({ groups: BAJULAN.groups });
		expect(transcribe('manyan', r)).toBe('manjan');
	});
});

describe('parsePronunciationRules', () => {
	it('collects letters from every group and strips slashes from sounds', () => {
		const r = parsePronunciationRules({
			groups: [{ letters: { a: '/a/' } }, { letters: { b: 'b' } }]
		});
		expect([...r.letters]).toEqual([
			['a', 'a'],
			['b', 'b']
		]);
	});

	it('lets the first group win when a letter repeats', () => {
		const r = parsePronunciationRules({
			groups: [{ letters: { a: 'x' } }, { letters: { a: 'y' } }]
		});
		expect(r.letters.get('a')).toBe('x');
	});

	it('does not read y or n as booleans', () => {
		const r = parsePronunciationRules({ groups: [{ letters: { y: 'j', n: 'n' } }] });
		expect(r.letters.get('y')).toBe('j');
	});

	it('explains a bad stress, clusters or syllables value', () => {
		expect(() => rules({ stress: 'sideways' })).toThrow(
			/stress.*final, initial, penultimate, none/
		);
		expect(() => rules({ clusters: 'pt' })).toThrow(/clusters/);
		expect(() => rules({ clusters: [''] })).toThrow(/empty/);
		expect(() => rules({ syllables: 'yes' })).toThrow(/syllables/);
		expect(() => parsePronunciationRules({})).toThrow(/groups/);
	});
});

const FENCE = (body: string, marker = '```') =>
	`Intro.\n\n${marker}orthography\n${body}\n${marker}\n\nOutro.`;
const ONE_LETTER = 'groups:\n  - letters: {a: a, b: b}\nstress: final';

describe('findPronunciationRules', () => {
	it('reads the rules from the first orthography fence it finds', () => {
		const r = findPronunciationRules([FENCE(ONE_LETTER)])!;
		expect(r.letters.get('b')).toBe('b');
		expect(r.stress).toBe('final');
	});

	it('searches the bodies in order and stops at the first good fence', () => {
		const r = findPronunciationRules([
			'no fence here',
			FENCE('groups:\n  - letters: {x: first}'),
			FENCE('groups:\n  - letters: {x: second}')
		])!;
		expect(r.letters.get('x')).toBe('first');
	});

	it('skips a malformed fence and uses the next one', () => {
		const r = findPronunciationRules([FENCE('groups: [oops'), FENCE(ONE_LETTER)]);
		expect(r).not.toBeNull();
		expect(
			findPronunciationRules([FENCE('stress: sideways\ngroups:\n  - letters: {a: a}')])
		).toBeNull();
	});

	it('understands ~~~ fences and longer backtick fences', () => {
		expect(findPronunciationRules([FENCE(ONE_LETTER, '~~~')])).not.toBeNull();
		expect(findPronunciationRules([FENCE(ONE_LETTER, '````')])).not.toBeNull();
	});

	it('ignores other fences and finds nothing in plain prose', () => {
		expect(findPronunciationRules(['```js\ngroups: x\n```'])).toBeNull();
		expect(findPronunciationRules(['just prose'])).toBeNull();
		expect(findPronunciationRules([])).toBeNull();
	});

	it('ignores a fence with no letters', () => {
		expect(findPronunciationRules([FENCE('groups:\n  - letters: {}')])).toBeNull();
	});
});

describe('fillPronunciations', () => {
	const entry = (word: string, ipa: string | null = null) => ({ word, ipa, ipaAuto: false });

	it('fills in missing pronunciations and marks them as generated', () => {
		const entries = [entry('kunǎy'), entry('zhib')];
		expect(fillPronunciations(entries, rules())).toBe(2);
		expect(entries[0]).toMatchObject({ ipa: 'kuˈnǎj', ipaAuto: true });
		expect(entries[1]).toMatchObject({ ipa: 'ʑib', ipaAuto: true });
	});

	it('never overwrites a pronunciation someone wrote', () => {
		const entries = [entry('kunǎy', 'my own')];
		expect(fillPronunciations(entries, rules())).toBe(0);
		expect(entries[0]).toMatchObject({ ipa: 'my own', ipaAuto: false });
	});

	it('leaves words it cannot read without one', () => {
		const entries = [entry('Nebelheim'), entry('zhib')];
		expect(fillPronunciations(entries, rules())).toBe(1);
		expect(entries[0]).toMatchObject({ ipa: null, ipaAuto: false });
	});
});
