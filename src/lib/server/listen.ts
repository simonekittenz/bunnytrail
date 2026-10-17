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
 * pronunciation (URL-encoded, without slashes). Anything else is ignored.
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

/** Fill a template with a pronunciation. */
export function listenHref(template: string, ipa: string): string {
	return template.replace('{ipa}', encodeURIComponent(ipa.replace(/^\/|\/$/g, '')));
}
