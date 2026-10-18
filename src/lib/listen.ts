/**
 * "Hear it" links for pronunciations.
 *
 * A language can set `listen:` in its frontmatter to show a small speaker
 * icon beside each dictionary pronunciation. The icon links out to a
 * service that reads IPA aloud; the engine never calls anything itself.
 *
 *   listen: true                                   # ipa-reader.com
 *   listen: https://example.com/say?ipa={ipa}      # any service
 *
 * The URL must be http(s) and contain `{ipa}`, which is replaced with the
 * pronunciation (URL-encoded, without slashes, and without tone marks —
 * readers skip a character that carries one). Anything else is ignored.
 *
 * Lives outside `server/` because the dictionary table builds its links in
 * the browser as well as on the server.
 */

export const DEFAULT_LISTEN_TEMPLATE = 'https://ipa-reader.com/?text={ipa}';

/** The URL template a `listen:` value stands for, or `null` for no links. */
export function resolveListenTemplate(value: unknown): string | null {
	if (value === true) return DEFAULT_LISTEN_TEMPLATE;
	if (typeof value !== 'string') return null;
	const template = value.trim();
	if (!template.includes('{ipa}')) return null;
	try {
		const probe = new URL(template.replace('{ipa}', 'x'));
		return probe.protocol === 'http:' || probe.protocol === 'https:' ? template : null;
	} catch {
		return null;
	}
}

/**
 * Tone diacritics: grave, acute, circumflex, macron, double acute, caron,
 * double grave, and the Chao tone letters. Deliberately *not* every
 * combining mark — tie bars (`d͡ʑ`), nasalisation (`w̃`) and the
 * non-syllabic mark (`au̯`) change the sound and must survive.
 */
const TONE_MARKS = /[\u0300\u0301\u0302\u0304\u030B\u030C\u030F\u02E5-\u02E9]/g;

/** A pronunciation without its tone marks: `kuˈnǎj` → `kuˈnaj`. */
export function stripToneMarks(ipa: string): string {
	return ipa.normalize('NFD').replace(TONE_MARKS, '').normalize('NFC');
}

/** Fill a template with a pronunciation. */
export function listenHref(template: string, ipa: string): string {
	const bare = ipa.replace(/^\/|\/$/g, '');
	return template.replace('{ipa}', encodeURIComponent(stripToneMarks(bare)));
}
