/**
 * Table-of-contents helpers — pure, so they're easy to test.
 *
 * A TOC is derived from the headings of already-rendered HTML (the
 * renderer gives every heading a stable `id`), so it can never disagree
 * with the page it sits next to.
 */
import type { TocItem, TocSetting } from '#lib/types.js';

/** `auto` shows a TOC once a page has at least this many h2/h3 headings. */
export const TOC_AUTO_MIN_HEADINGS = 4;

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&#x27;': "'",
	'&nbsp;': ' '
};

function plainText(html: string): string {
	return html
		.replace(/<[^>]+>/g, '')
		.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITIES[m] ?? m)
		.replace(/\s+/g, ' ')
		.trim();
}

/** Level-2 and level-3 headings that carry an id, in document order. */
export function extractHeadings(html: string): TocItem[] {
	const items: TocItem[] = [];
	const re = /<h([23])\b[^>]*?\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		const text = plainText(m[3]!);
		if (text) items.push({ id: m[2]!, text, level: Number(m[1]) as 2 | 3 });
	}
	return items;
}

/** Read a `toc:` value from frontmatter. Unknown values are ignored. */
export function parseTocSetting(v: unknown): TocSetting | null {
	if (v === true) return 'always';
	if (v === false) return 'never';
	if (v === 'auto' || v === 'always' || v === 'never') return v;
	return null;
}

/**
 * The headings to show, or `[]` when the TOC should be hidden.
 * A page's own setting beats the entity's, which beats `auto`.
 */
export function resolveToc(
	items: TocItem[],
	entity: TocSetting | null,
	page: TocSetting | null
): TocItem[] {
	const setting = page ?? entity ?? 'auto';
	if (setting === 'never' || items.length === 0) return [];
	if (setting === 'always') return items;
	return items.length >= TOC_AUTO_MIN_HEADINGS ? items : [];
}
