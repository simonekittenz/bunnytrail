import { describe, expect, it } from 'vitest';
import { inlineSvgFigures } from './inlineSvgs.js';

describe('inlineSvgFigures captions', () => {
	it('does not double-escape an already-escaped alt', async () => {
		const html = '<img src="/api/assets/x.png" alt="do&#39;ân &amp; kunu&#39;ak">';
		const out = await inlineSvgFigures(html);
		expect(out).toContain('<figcaption>do&#39;ân &amp; kunu&#39;ak</figcaption>');
		expect(out).toContain('alt="do&#39;ân &amp; kunu&#39;ak"');
		expect(out).not.toContain('&amp;#39;');
		expect(out).not.toContain('&amp;amp;');
	});

	it('keeps markup in the alt escaped', async () => {
		const html = '<img src="/api/assets/x.png" alt="a &lt;b&gt; &quot;c&quot;">';
		const out = await inlineSvgFigures(html);
		expect(out).toContain('<figcaption>a &lt;b&gt; &quot;c&quot;</figcaption>');
	});
});
