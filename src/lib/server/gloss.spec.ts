import { afterEach, describe, expect, it } from 'vitest';
import { renderBody } from './markdown';
import { buildLexiconIndex, wordSlug, type LexiconWord } from './lexicon';
import {
	renderGlossBlock,
	resolveGlossLanguage,
	setGlossProvider,
	type GlossTarget
} from './gloss';

function w(word: string, over: Partial<LexiconWord> = {}): LexiconWord {
	return { word, meaning: null, pos: null, gloss: null, ipa: null, forms: [], id: wordSlug(word), ...over };
}

const index = buildLexiconIndex([
	w('kunǎy', { meaning: 'where', pos: 'wh-word', ipa: 'kunǎj' }),
	w('tsuhn', { meaning: 'your', pos: 'pronoun' }),
	w('plang', { meaning: 'city; hilltop', pos: 'noun' }),
	w('-ut', { meaning: 'in, at, on', gloss: 'LOC', pos: 'suffix' })
]);

const target: GlossTarget = {
	id: 'aurethia/people/languages/bajulan',
	name: 'Bajulan',
	code: 'bay',
	href: '/aurethia/people/languages/bajulan',
	dictionaryHref: '/aurethia/people/languages/bajulan/dictionary',
	index
};

afterEach(() => setGlossProvider(null));

describe('resolveGlossLanguage', () => {
	const codes = new Map([['bay', 'aurethia/people/languages/bajulan']]);
	it('matches by code or folder slug, case-insensitively', () => {
		expect(resolveGlossLanguage('bay', codes)).toBe('aurethia/people/languages/bajulan');
		expect(resolveGlossLanguage('Bajulan', codes)).toBe('aurethia/people/languages/bajulan');
	});
	it('ignores anything that is not a registered language', () => {
		expect(resolveGlossLanguage('js', codes)).toBeNull();
		expect(resolveGlossLanguage('', codes)).toBeNull();
		expect(resolveGlossLanguage(undefined, codes)).toBeNull();
	});
});

describe('renderGlossBlock', () => {
	it('glosses each word and links it into the dictionary', () => {
		const html = renderGlossBlock(target, 'Kunǎy tsuhn plangut?\n= Where is your city?');
		expect(html).toContain('class="bt-gloss-set"');
		expect(html).toContain('<span class="bt-gloss__g">where</span>');
		expect(html).toContain('<span class="bt-gloss__g">your</span>');
		expect(html).toContain('<span class="bt-gloss__g">city-LOC</span>');
		expect(html).toContain('href="/aurethia/people/languages/bajulan/dictionary#w-kunay"');
		expect(html).toContain('<p class="bt-gloss__tr">Where is your city?</p>');
		expect(html).toContain('lang="x-bay"');
	});

	it('keeps punctuation attached to the source word, not the lookup', () => {
		const html = renderGlossBlock(target, '“Kunǎy tsuhn?”');
		expect(html).toContain('“Kunǎy');
		expect(html).toContain('tsuhn?”');
		expect(html).toContain('bt-gloss__g">where<');
	});

	it('shows pronunciation and the meaning in the word card', () => {
		const html = renderGlossBlock(target, 'Kunǎy');
		expect(html).toContain('/kunǎj/');
		expect(html).toContain('wh-word');
		expect(html).toContain('bt-gloss__tip-meaning">where<');
	});

	it('marks affix-stripped matches as approximate and lists the breakdown', () => {
		const html = renderGlossBlock(target, 'plangut');
		expect(html).toContain('bt-gloss__w--approx');
		expect(html).toContain('<b>plang</b> city');
		expect(html).toContain('<b>ut</b> LOC');
	});

	it('flags unknown words without inventing a gloss', () => {
		const html = renderGlossBlock(target, 'zzzz');
		expect(html).toContain('bt-gloss__w--unknown');
		expect(html).toContain('Not in the dictionary yet');
		expect(html).toContain('bt-gloss__g">·<');
	});

	it('honours {override} glosses over the dictionary', () => {
		const html = renderGlossBlock(target, 'tsuhn{thine}');
		expect(html).toContain('bt-gloss__w--override');
		expect(html).toContain('bt-gloss__g">thine<');
		expect(html).not.toContain('>your<');
	});

	it('renders literal and free translation lines', () => {
		const html = renderGlossBlock(target, 'Kunǎy\n~ where\n= Where?');
		expect(html).toContain('<p class="bt-gloss__lit">where</p>');
		expect(html).toContain('<p class="bt-gloss__tr">Where?</p>');
	});

	it('renders one figure per blank-line-separated snippet', () => {
		const html = renderGlossBlock(target, 'Kunǎy\n\ntsuhn');
		expect(html.match(/<figure/g)).toHaveLength(2);
	});

	it('degrades to bare text when the language has no dictionary yet', () => {
		const html = renderGlossBlock({ ...target, index: null, dictionaryHref: null }, 'Kunǎy tsuhn');
		expect(html).toContain('bt-gloss--bare');
		expect(html).not.toContain('bt-gloss__g');
	});

	it('does not link words when there is no dictionary page', () => {
		const html = renderGlossBlock({ ...target, dictionaryHref: null }, 'Kunǎy');
		expect(html).not.toContain('<a ');
		expect(html).toContain('tabindex="0"');
	});

	it('escapes HTML in source, gloss overrides and translations', () => {
		const html = renderGlossBlock(target, '<b>x</b>{<i>}\n= a & b <u>');
		expect(html).not.toContain('<b>x');
		expect(html).toContain('&lt;b&gt;x');
		expect(html).toContain('a &amp; b &lt;u&gt;');
	});

	it('returns nothing for an empty block', () => {
		expect(renderGlossBlock(target, '   \n\n= just a translation')).toBe('');
	});
});

describe('language-tagged fences in markdown', () => {
	const codes = new Map([['bay', target.id]]);
	const render = (md: string) => renderBody(md, () => null, codes);

	it('renders a fence tagged with the language code', () => {
		setGlossProvider((id) => (id === target.id ? target : null));
		const html = render('Intro.\n\n```bay\nKunǎy tsuhn?\n= Where are you from?\n```\n');
		expect(html).toContain('bt-gloss-set');
		expect(html).toContain('bt-gloss__g">where<');
		expect(html).not.toContain('<pre>');
	});

	it('also accepts the language folder slug', () => {
		setGlossProvider((id) => (id === target.id ? target : null));
		expect(render('```bajulan\nKunǎy\n```\n')).toContain('bt-gloss-set');
	});

	it('leaves ordinary code fences and unregistered tags alone', () => {
		setGlossProvider((id) => (id === target.id ? target : null));
		expect(render('```js\nlet x = 1;\n```\n')).toContain('<pre><code class="language-js">');
		expect(render('```\nplain\n```\n')).toContain('<pre><code>');
	});

	it('falls back to a plain code block when no provider is registered', () => {
		setGlossProvider(null);
		expect(render('```bay\nKunǎy\n```\n')).toContain('<pre>');
	});
});
