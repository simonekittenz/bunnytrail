/**
 * Interlinear glossing for language-tagged code fences.
 *
 *     ```bajulan
 *     Kunǎy tsuhn yawatlan?
 *     = Where are you from?
 *     ```
 *
 * The fence's info string names a language (its short code or its folder
 * slug). Each word is looked up in that language's dictionary and
 * rendered with its gloss underneath; hovering or focusing a word opens
 * a card with the full entry. Everything is server-rendered HTML + CSS —
 * no client JavaScript — so it works in prerendered builds and on the
 * offline iPad bundle alike.
 *
 * This module stays free of any graph import: the host registers a
 * provider with `setGlossProvider`, which keeps `markdown.ts` testable.
 */
import {
	glossLabel,
	parseSnippets,
	type Analysis,
	type LexiconIndex,
	type Snippet,
	type SnippetToken
} from './lexicon';

/** What the renderer needs to know about a language. */
export interface GlossTarget {
	id: string;
	name: string;
	/** Short code (`bay`), if the language has one. */
	code: string | null;
	/** Link to the language entity. */
	href: string;
	/** Link to its dictionary page, when it has one; word cards deep-link into it. */
	dictionaryHref: string | null;
	/** Word lookup. `null` when the language has no dictionary yet. */
	index: LexiconIndex | null;
}

type GlossProvider = (langId: string) => GlossTarget | null;

let provider: GlossProvider | null = null;

/** Register how language ids resolve to dictionaries. Called once by the graph. */
export function setGlossProvider(fn: GlossProvider | null): void {
	provider = fn;
}

export function getGlossTarget(langId: string): GlossTarget | null {
	return provider ? provider(langId) : null;
}

/**
 * Map a fence info string to a language entity id, or `null` when it
 * doesn't name a registered language. Accepts the short code (`bay`) or
 * the entity's folder slug (`bajulan`), case-insensitively.
 */
export function resolveGlossLanguage(
	info: string | undefined,
	languageCodes: ReadonlyMap<string, string>
): string | null {
	const key = (info ?? '').trim().toLowerCase();
	if (!key) return null;
	const byCode = languageCodes.get(key);
	if (byCode) return byCode;
	for (const id of languageCodes.values()) {
		if (id.slice(id.lastIndexOf('/') + 1).toLowerCase() === key) return id;
	}
	return null;
}

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

type WordState = 'found' | 'approx' | 'unknown' | 'override' | 'bare';

function stateOf(token: SnippetToken, a: Analysis | null, hasIndex: boolean): WordState {
	if (token.override !== null) return 'override';
	if (!hasIndex) return 'bare';
	if (!a || a.gloss === null) return 'unknown';
	return a.approx ? 'approx' : 'found';
}

/** The popover for a word: headword, pronunciation, meaning, breakdown. */
function renderCard(token: SnippetToken, a: Analysis | null, state: WordState): string {
	if (state === 'bare') return '';
	if (state === 'override') {
		return `<span class="bt-gloss__tip" role="tooltip"><span class="bt-gloss__tip-note">${esc(
			token.override ?? ''
		)}</span></span>`;
	}
	if (state === 'unknown' || !a) {
		return `<span class="bt-gloss__tip" role="tooltip"><span class="bt-gloss__tip-note">Not in the dictionary yet.</span></span>`;
	}

	const e = a.entry;
	const bits: string[] = [];
	if (e) {
		const head = e.word.replace(/^-+|-+$/g, '') !== a.surface.toLowerCase() ? e.word : null;
		if (head) bits.push(`<span class="bt-gloss__tip-head">${esc(head)}</span>`);
		if (e.ipa) bits.push(`<span class="bt-gloss__tip-ipa">/${esc(e.ipa)}/</span>`);
		if (e.pos) bits.push(`<span class="bt-gloss__tip-pos">${esc(e.pos)}</span>`);
	}
	const lines: string[] = [];
	if (bits.length) lines.push(`<span class="bt-gloss__tip-top">${bits.join(' ')}</span>`);
	if (a.meaning) lines.push(`<span class="bt-gloss__tip-meaning">${esc(a.meaning)}</span>`);

	if (a.parts.length > 1) {
		const parts = a.parts
			.map((p) => {
				const label = p.entry ? (glossLabel(p.entry) ?? '?') : '?';
				return `<span class="bt-gloss__tip-part"><b>${esc(p.text)}</b> ${esc(label)}</span>`;
			})
			.join('');
		lines.push(`<span class="bt-gloss__tip-parts">${parts}</span>`);
	}
	if (a.alts.length) {
		const alt = a.alts
			.map((x) => `${esc(x.word)}${x.meaning ? ` “${esc(x.meaning)}”` : ''}`)
			.join('; ');
		lines.push(`<span class="bt-gloss__tip-alts">Also: ${alt}</span>`);
	}
	if (state === 'approx') {
		lines.push(
			`<span class="bt-gloss__tip-note">Matched loosely (tone or ending differs).</span>`
		);
	}
	return `<span class="bt-gloss__tip" role="tooltip">${lines.join('')}</span>`;
}

function renderToken(token: SnippetToken, target: GlossTarget): string {
	if (token.kind === 'punct') {
		return `<span class="bt-gloss__p">${esc(token.text)}</span>`;
	}
	const hasIndex = target.index !== null;
	const analysis = token.override !== null ? null : (target.index?.analyze(token.text) ?? null);
	const state = stateOf(token, analysis, hasIndex);

	const gloss =
		state === 'override'
			? (token.override ?? '')
			: state === 'found' || state === 'approx'
				? (analysis?.gloss ?? '')
				: state === 'unknown'
					? '·'
					: '';

	const src = `${esc(token.pre)}${esc(token.text)}${esc(token.post)}`;
	const card = renderCard(token, analysis, state);
	const inner =
		`<span class="bt-gloss__src">${src}</span>` +
		(gloss !== '' ? `<span class="bt-gloss__g">${esc(gloss)}</span>` : '') +
		card;

	const entry = analysis?.entry;
	if (entry && target.dictionaryHref && (state === 'found' || state === 'approx')) {
		return `<a class="bt-gloss__w bt-gloss__w--${state}" href="${esc(
			`${target.dictionaryHref}#w-${entry.id}`
		)}">${inner}</a>`;
	}
	return `<span class="bt-gloss__w bt-gloss__w--${state}" tabindex="0">${inner}</span>`;
}

function renderSnippet(snippet: Snippet, target: GlossTarget): string {
	const words = snippet.tokens.map((t) => renderToken(t, target)).join('');
	const lit = snippet.literal
		? `<p class="bt-gloss__lit">${esc(snippet.literal)}</p>`
		: '';
	const tr = snippet.translation
		? `<p class="bt-gloss__tr">${esc(snippet.translation)}</p>`
		: '';
	const bare = target.index === null ? ' bt-gloss--bare' : '';
	return `<figure class="bt-gloss${bare}" lang="x-${esc(target.code ?? 'conlang')}" data-language="${esc(
		target.id
	)}"><div class="bt-gloss__line">${words}</div>${lit}${tr}</figure>`;
}

/** Render the body of a language-tagged fence as one gloss figure per snippet. */
export function renderGlossBlock(target: GlossTarget, text: string): string {
	const snippets = parseSnippets(text);
	if (snippets.length === 0) return '';
	return `<div class="bt-gloss-set">${snippets.map((s) => renderSnippet(s, target)).join('')}</div>\n`;
}
