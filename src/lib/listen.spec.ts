import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LISTEN_TEMPLATE,
	listenHref,
	resolveListenTemplate,
	stripToneMarks
} from './listen';

describe('resolveListenTemplate', () => {
	it('true means the default service', () => {
		expect(resolveListenTemplate(true)).toBe(DEFAULT_LISTEN_TEMPLATE);
		expect(DEFAULT_LISTEN_TEMPLATE).toContain('ipa-reader.com');
	});

	it('accepts an http(s) URL template that has {ipa}', () => {
		expect(resolveListenTemplate('https://example.com/say?ipa={ipa}')).toBe(
			'https://example.com/say?ipa={ipa}'
		);
		expect(resolveListenTemplate('  http://localhost:3000/{ipa}  ')).toBe(
			'http://localhost:3000/{ipa}'
		);
	});

	it('is off by default and for false', () => {
		expect(resolveListenTemplate(undefined)).toBeNull();
		expect(resolveListenTemplate(null)).toBeNull();
		expect(resolveListenTemplate(false)).toBeNull();
	});

	it('ignores anything that is not a usable link', () => {
		expect(resolveListenTemplate('https://example.com/say')).toBeNull(); // no {ipa}
		expect(resolveListenTemplate('javascript:alert({ipa})')).toBeNull(); // wrong scheme
		expect(resolveListenTemplate('data:text/html,{ipa}')).toBeNull();
		expect(resolveListenTemplate('{ipa}')).toBeNull(); // not a URL
		expect(resolveListenTemplate('')).toBeNull();
		expect(resolveListenTemplate(3)).toBeNull();
	});
});

describe('stripToneMarks', () => {
	it('removes every tone diacritic Bajulan uses: á à ǎ â', () => {
		expect(stripToneMarks('á')).toBe('a');
		expect(stripToneMarks('à')).toBe('a');
		expect(stripToneMarks('ǎ')).toBe('a');
		expect(stripToneMarks('â')).toBe('a');
		expect(stripToneMarks('kuˈnǎj')).toBe('kuˈnaj');
		expect(stripToneMarks('ɔ̂')).toBe('ɔ');
	});

	it('also removes macron, double accents and tone letters', () => {
		expect(stripToneMarks('ā')).toBe('a');
		expect(stripToneMarks('a\u030B')).toBe('a'); // double acute
		expect(stripToneMarks('a\u030F')).toBe('a'); // double grave
		expect(stripToneMarks('ma˥˩')).toBe('ma');
	});

	it('keeps the marks that change the sound: tie bars, nasalisation, non-syllabic', () => {
		expect(stripToneMarks('d͡ʑ')).toBe('d͡ʑ');
		expect(stripToneMarks('t͡ɕ')).toBe('t͡ɕ');
		expect(stripToneMarks('w̃ʰ')).toBe('w̃ʰ');
		expect(stripToneMarks('au̯')).toBe('au̯');
	});

	it('strips a tone mark that sits on a vowel carrying another mark', () => {
		expect(stripToneMarks('áu̯')).toBe('au̯');
		expect(stripToneMarks('ptiˈwáu̯')).toBe('ptiˈwau̯');
	});

	it('leaves toneless text alone', () => {
		expect(stripToneMarks('manˈjan')).toBe('manˈjan');
		expect(stripToneMarks('')).toBe('');
	});
});

describe('listenHref', () => {
	it('URL-encodes the pronunciation after dropping its tone marks', () => {
		expect(listenHref(DEFAULT_LISTEN_TEMPLATE, 'kuˈnǎj')).toBe(
			`https://ipa-reader.com/?text=${encodeURIComponent('kuˈnaj')}`
		);
	});

	it('sends no tone mark at all, but keeps a tie bar', () => {
		const href = listenHref(DEFAULT_LISTEN_TEMPLATE, 'baˈd͡ʑúr');
		expect(href).toBe(`https://ipa-reader.com/?text=${encodeURIComponent('baˈd͡ʑur')}`);
		expect(decodeURIComponent(href)).toContain('\u0361'); // tie bar survived
		expect(decodeURIComponent(href)).not.toMatch(/[\u0300-\u0302\u030C]/);
	});

	it('drops surrounding slashes and encodes anything that could break the URL', () => {
		expect(listenHref('https://x.test/?q={ipa}', '/a&b#c/')).toBe('https://x.test/?q=a%26b%23c');
	});
});
