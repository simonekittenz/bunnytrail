import { describe, expect, it } from 'vitest';
import { DEFAULT_LISTEN_TEMPLATE, listenHref, resolveListenTemplate } from './listen';

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

describe('listenHref', () => {
	it('URL-encodes the pronunciation, tone marks and all', () => {
		expect(listenHref(DEFAULT_LISTEN_TEMPLATE, 'kuˈnǎj')).toBe(
			`https://ipa-reader.com/?text=${encodeURIComponent('kuˈnǎj')}`
		);
	});

	it('drops surrounding slashes and encodes anything that could break the URL', () => {
		expect(listenHref('https://x.test/?q={ipa}', '/a&b#c/')).toBe('https://x.test/?q=a%26b%23c');
	});
});
