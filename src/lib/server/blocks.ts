/**
 * Structured reference blocks for markdown prose.
 *
 * Two fenced blocks whose body is YAML, for the grids a language
 * reference needs and plain markdown tables handle badly:
 *
 *   ```ipa-chart      a phoneme chart — places × manners, or vowel space
 *   ```paradigm       an inflection table — forms × grammatical categories
 *   ```orthography    spelling → sound correspondences, grouped, with notes
 *
 * Both emit an ordinary `<table>`; the markdown renderer's table pass
 * then wraps it for sideways scrolling like any other. A malformed block
 * renders a visible error box rather than vanishing, so the author sees
 * the problem on the page.
 *
 * Pure: no graph or filesystem access. The only context a block needs is
 * the language registry, to resolve an optional `language:` key.
 */
import { parse as parseYaml } from 'yaml';
import { resolveGlossLanguage } from './gloss';
import { parsePronunciationRules } from './transcribe';

export interface BlockContext {
	/** Registered language codes → entity ids, as for glossed fences. */
	languageCodes: ReadonlyMap<string, string>;
}

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

class BlockError extends Error {}

function fail(message: string): never {
	throw new BlockError(message);
}

function errorBox(block: string, message: string): string {
	return `<div class="bt-block-error" role="alert"><strong>${esc(block)}</strong> ${esc(message)}</div>\n`;
}

// ── Parsing helpers ──────────────────────────────────────────────────

function asRecord(v: unknown, what: string): Record<string, unknown> {
	if (v === null || typeof v !== 'object' || Array.isArray(v)) fail(`${what} must be a mapping`);
	return v as Record<string, unknown>;
}

function asString(v: unknown, what: string): string | null {
	if (v === undefined || v === null) return null;
	if (typeof v === 'string') return v.trim() || null;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	return fail(`${what} must be text`);
}

function asStringList(v: unknown, what: string): string[] {
	if (!Array.isArray(v) || v.length === 0) fail(`${what} must be a non-empty list`);
	return (v as unknown[]).map((x, i) => {
		const s = asString(x, `${what}[${i + 1}]`);
		if (!s) fail(`${what}[${i + 1}] is empty`);
		return s;
	});
}

function parseDoc(text: string): Record<string, unknown> {
	let doc: unknown;
	try {
		doc = parseYaml(text);
	} catch (err) {
		return fail(
			`couldn't read the YAML: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`
		);
	}
	return asRecord(doc, 'the block');
}

// ── ipa-chart ────────────────────────────────────────────────────────

interface IpaChart {
	type: 'consonants' | 'vowels';
	title: string | null;
	corner: string;
	columns: string[];
	rows: Array<{ label: string; cells: Map<string, string[]> }>;
	spelling: Map<string, string>;
	/** Rows where a two-symbol cell is a voiceless / voiced pair. */
	voicing: Set<string>;
}

/** Symbols in a cell are separated by spaces and/or commas. */
function symbols(v: unknown, where: string): string[] {
	if (v === undefined || v === null) return [];
	const raw = Array.isArray(v)
		? v.map((x) => asString(x, where) ?? '').join(' ')
		: asString(v, where);
	return (raw ?? '').split(/[\s,]+/).filter(Boolean);
}

export function parseIpaChart(text: string): IpaChart {
	const doc = parseDoc(text);
	const type = asString(doc.type, '`type`') ?? 'consonants';
	if (type !== 'consonants' && type !== 'vowels') fail('`type` must be consonants or vowels');

	const columns = asStringList(doc.columns ?? doc.places, '`columns`');
	const rowsRaw = asRecord(doc.rows, '`rows`');
	if (Object.keys(rowsRaw).length === 0) fail('`rows` is empty');

	const rows = Object.entries(rowsRaw).map(([label, value]) => {
		const cells = new Map<string, string[]>();
		if (value !== null && value !== undefined) {
			for (const [col, cell] of Object.entries(asRecord(value, `row "${label}"`))) {
				if (!columns.includes(col)) {
					fail(`row "${label}" uses unknown column "${col}" (columns are: ${columns.join(', ')})`);
				}
				const syms = symbols(cell, `row "${label}", column "${col}"`);
				if (syms.length) cells.set(col, syms);
			}
		}
		return { label, cells };
	});

	const spelling = new Map<string, string>();
	if (doc.spelling !== undefined && doc.spelling !== null) {
		for (const [sym, spell] of Object.entries(asRecord(doc.spelling, '`spelling`'))) {
			const s = asString(spell, `spelling for ${sym}`);
			if (s) spelling.set(sym, s);
		}
	}

	// Two symbols in a cell are only a voiceless/voiced pair where the author
	// says so: a plain/nasal glide pair like w w̃ must not be labelled "voiced".
	const voicing = new Set<string>();
	if (doc.voicing !== undefined && doc.voicing !== null && type === 'consonants') {
		const labels = rows.map((r) => r.label);
		if (doc.voicing === 'all') {
			for (const l of labels) voicing.add(l);
		} else {
			for (const l of asStringList(doc.voicing, '`voicing`')) {
				if (!labels.includes(l)) fail(`\`voicing\` lists "${l}" but there is no such row`);
				voicing.add(l);
			}
		}
	}

	return {
		type,
		title: asString(doc.title, '`title`'),
		corner: asString(doc.corner, '`corner`') ?? '',
		columns,
		rows,
		spelling,
		voicing
	};
}

/** "voiceless bilabial plosive" / "close front unrounded vowel". */
function describeSound(chart: IpaChart, row: string, col: string, voicing: string | null): string {
	if (chart.type === 'vowels') return `${row} ${col} vowel`.toLowerCase();
	return [voicing, col, row].filter(Boolean).join(' ').toLowerCase();
}

export function renderIpaChart(chart: IpaChart): string {
	const cols = chart.columns;
	const out: string[] = [`<table class="bt-ipa bt-ipa--${chart.type}">`];
	if (chart.title) out.push(`<caption>${esc(chart.title)}</caption>`);

	out.push('<thead><tr>');
	out.push(`<th scope="col">${esc(chart.corner)}</th>`);
	for (const c of cols) out.push(`<th scope="col">${esc(c)}</th>`);
	out.push('</tr></thead><tbody>');

	for (const row of chart.rows) {
		out.push(`<tr><th scope="row">${esc(row.label)}</th>`);
		for (const col of cols) {
			const syms = row.cells.get(col);
			if (!syms) {
				out.push('<td class="bt-ipa__cell bt-ipa__cell--empty"></td>');
				continue;
			}
			// Where the author marked the row as a voicing row, the first of two
			// symbols is voiceless and the second voiced (the IPA chart
			// convention). Anywhere else the symbols are just listed.
			const paired = chart.voicing.has(row.label) && syms.length === 2;
			const body = syms
				.map((sym, i) => {
					const voicing = paired ? (i === 0 ? 'voiceless' : 'voiced') : null;
					const spell = chart.spelling.get(sym);
					const label = describeSound(chart, row.label, col, voicing);
					const cls =
						(voicing ? ` bt-ipa__sym--${voicing === 'voiceless' ? 'vl' : 'vd'}` : '') +
						(i > 0 ? ' bt-ipa__sym--next' : '');
					return (
						`<span class="bt-ipa__sym${cls}" title="${esc(label)}" aria-label="${esc(label)}">` +
						`<span class="bt-ipa__ipa">${esc(sym)}</span>` +
						(spell ? `<span class="bt-ipa__sp">${esc(spell)}</span>` : '') +
						'</span>'
					);
				})
				.join('');
			out.push(`<td class="bt-ipa__cell">${body}</td>`);
		}
		out.push('</tr>');
	}
	out.push('</tbody></table>\n');
	return out.join('');
}

// ── paradigm ─────────────────────────────────────────────────────────

interface ParadigmRow {
	label: string;
	cells: string[];
}

interface ParadigmGroup {
	label: string | null;
	rows: ParadigmRow[];
}

interface Paradigm {
	title: string | null;
	note: string | null;
	corner: string;
	columns: string[];
	groups: ParadigmGroup[];
	/** Language code from `language:`, used for `lang=` and the conlang font. */
	languageCode: string | null;
}

function parseRows(v: unknown, columnCount: number, where: string): ParadigmRow[] {
	const rec = asRecord(v, where);
	if (Object.keys(rec).length === 0) fail(`${where} is empty`);
	return Object.entries(rec).map(([label, cells]) => {
		if (cells === null || cells === undefined) return { label, cells: [] };
		if (!Array.isArray(cells)) fail(`${where}, "${label}": expected a list of forms`);
		const list = (cells as unknown[]).map((c) => asString(c, `"${label}" form`) ?? '');
		if (list.length > columnCount) {
			fail(`${where}, "${label}": ${list.length} forms but only ${columnCount} columns`);
		}
		return { label, cells: list };
	});
}

export function parseParadigm(text: string, ctx: BlockContext): Paradigm {
	const doc = parseDoc(text);
	const columns = asStringList(doc.columns, '`columns`');

	if (doc.rows !== undefined && doc.groups !== undefined)
		fail('use either `rows` or `groups`, not both');
	let groups: ParadigmGroup[];
	if (doc.groups !== undefined) {
		if (!Array.isArray(doc.groups) || doc.groups.length === 0)
			fail('`groups` must be a non-empty list');
		groups = (doc.groups as unknown[]).map((g, i) => {
			const rec = asRecord(g, `group ${i + 1}`);
			return {
				label: asString(rec.label, `group ${i + 1} label`),
				rows: parseRows(rec.rows, columns.length, `group ${i + 1} rows`)
			};
		});
	} else if (doc.rows !== undefined) {
		groups = [{ label: null, rows: parseRows(doc.rows, columns.length, '`rows`') }];
	} else {
		return fail('needs `rows` or `groups`');
	}

	let languageCode: string | null = null;
	const langKey = asString(doc.language, '`language`');
	if (langKey) {
		const id = resolveGlossLanguage(langKey, ctx.languageCodes);
		if (!id) fail(`unknown language "${langKey}"`);
		for (const [code, langId] of ctx.languageCodes) {
			if (langId === id) {
				languageCode = code;
				break;
			}
		}
	}

	return {
		title: asString(doc.title, '`title`'),
		note: asString(doc.note, '`note`'),
		corner: asString(doc.corner, '`corner`') ?? '',
		columns,
		groups,
		languageCode
	};
}

/** `many|an` → stem plus a highlighted ending; text without `|` is left alone. */
function formHtml(cell: string): string {
	const bar = cell.indexOf('|');
	if (bar < 0) return esc(cell);
	return `${esc(cell.slice(0, bar))}<span class="bt-paradigm__end">${esc(cell.slice(bar + 1))}</span>`;
}

export function renderParadigm(p: Paradigm): string {
	const span = p.columns.length + 1;
	const lang = p.languageCode ? ` lang="x-${esc(p.languageCode)}" data-conlang="true"` : '';
	const out: string[] = [`<table class="bt-paradigm"${lang}>`];

	if (p.title || p.note) {
		out.push(
			'<caption>' +
				(p.title ? `<span class="bt-paradigm__title">${esc(p.title)}</span>` : '') +
				(p.note ? `<span class="bt-paradigm__note">${esc(p.note)}</span>` : '') +
				'</caption>'
		);
	}

	out.push('<thead><tr>');
	out.push(`<th scope="col">${esc(p.corner)}</th>`);
	for (const c of p.columns) out.push(`<th scope="col">${esc(c)}</th>`);
	out.push('</tr></thead><tbody>');

	for (const g of p.groups) {
		if (g.label) {
			out.push(
				`<tr class="bt-paradigm__group"><th scope="colgroup" colspan="${span}">${esc(g.label)}</th></tr>`
			);
		}
		for (const row of g.rows) {
			out.push(`<tr><th scope="row">${esc(row.label)}</th>`);
			for (let i = 0; i < p.columns.length; i++) {
				const cell = row.cells[i] ?? '';
				out.push(`<td>${cell ? formHtml(cell) : ''}</td>`);
			}
			out.push('</tr>');
		}
	}
	out.push('</tbody></table>\n');
	return out.join('');
}

// ── orthography ──────────────────────────────────────────────────────

interface OrthographyGroup {
	label: string | null;
	letters: Array<[string, string]>;
}

interface Orthography {
	title: string | null;
	/** Headings over the two columns of each group, e.g. `Bajulan` / `IPA`. */
	headings: [string, string];
	groups: OrthographyGroup[];
	notesTitle: string | null;
	notes: string[];
	languageCode: string | null;
}

export function parseOrthography(text: string, ctx: BlockContext): Orthography {
	const doc = parseDoc(text);

	// `stress`, `clusters` and `syllables` drive generated dictionary
	// pronunciations (see transcribe.ts); check them here so a typo shows
	// up on the page the author is looking at.
	try {
		parsePronunciationRules(doc);
	} catch (err) {
		fail(err instanceof Error ? err.message : String(err));
	}

	if (!Array.isArray(doc.groups) || doc.groups.length === 0)
		fail('`groups` must be a non-empty list');
	const groups = (doc.groups as unknown[]).map((g, i): OrthographyGroup => {
		const rec = asRecord(g, `group ${i + 1}`);
		const letters = asRecord(rec.letters, `group ${i + 1} \`letters\``);
		if (Object.keys(letters).length === 0) fail(`group ${i + 1} has no letters`);
		return {
			label: asString(rec.label, `group ${i + 1} label`),
			letters: Object.entries(letters).map(([letter, sound]): [string, string] => [
				letter,
				asString(sound, `sound for "${letter}"`) ?? ''
			])
		};
	});

	let headings: [string, string] = ['Spelling', 'Sound'];
	if (doc.columns !== undefined) {
		const cols = asStringList(doc.columns, '`columns`');
		if (cols.length !== 2) fail('`columns` must name exactly two headings, e.g. [Bajulan, IPA]');
		headings = [cols[0]!, cols[1]!];
	}

	let notes: string[] = [];
	if (doc.notes !== undefined && doc.notes !== null) notes = asStringList(doc.notes, '`notes`');

	let languageCode: string | null = null;
	const langKey = asString(doc.language, '`language`');
	if (langKey) {
		const id = resolveGlossLanguage(langKey, ctx.languageCodes);
		if (!id) fail(`unknown language "${langKey}"`);
		for (const [code, langId] of ctx.languageCodes) {
			if (langId === id) {
				languageCode = code;
				break;
			}
		}
	}

	return {
		title: asString(doc.title, '`title`'),
		headings,
		groups,
		notesTitle: asString(doc.notesTitle, '`notesTitle`'),
		notes,
		languageCode
	};
}

/** A sound in slashes unless the author already bracketed it (`[ɻ]`, `/b/`). */
function soundHtml(sound: string): string {
	if (!sound) return '';
	return /^[/[]/.test(sound) ? esc(sound) : `/${esc(sound)}/`;
}

export function renderOrthography(o: Orthography): string {
	const depth = Math.max(...o.groups.map((g) => g.letters.length));
	const lang = o.languageCode ? ` lang="x-${esc(o.languageCode)}" data-conlang="true"` : '';
	const out: string[] = [`<table class="bt-orthography"${lang}>`];
	if (o.title) out.push(`<caption>${esc(o.title)}</caption>`);

	out.push('<thead>');
	if (o.groups.some((g) => g.label)) {
		out.push('<tr>');
		for (const g of o.groups) {
			out.push(`<th scope="colgroup" colspan="2">${esc(g.label ?? '')}</th>`);
		}
		out.push('</tr>');
	}
	out.push('<tr>');
	o.groups.forEach((_, gi) => {
		const sep = gi > 0 ? ' class="bt-orthography__sep"' : '';
		out.push(
			`<th scope="col"${sep}>${esc(o.headings[0])}</th><th scope="col">${esc(o.headings[1])}</th>`
		);
	});
	out.push('</tr></thead><tbody>');

	for (let row = 0; row < depth; row++) {
		out.push('<tr>');
		o.groups.forEach((g, gi) => {
			const pair = g.letters[row];
			const sep = gi > 0 ? ' bt-orthography__sep' : '';
			if (!pair) {
				out.push(
					`<td class="bt-orthography__letter bt-orthography__none${sep}"></td><td class="bt-orthography__none"></td>`
				);
				return;
			}
			out.push(
				`<td class="bt-orthography__letter${sep}">${esc(pair[0])}</td>` +
					`<td class="bt-orthography__ipa">${soundHtml(pair[1])}</td>`
			);
		});
		out.push('</tr>');
	}
	out.push('</tbody></table>');

	if (o.notes.length) {
		out.push(
			'<aside class="bt-orthography__notes">' +
				(o.notesTitle ? `<strong>${esc(o.notesTitle)}</strong>` : '') +
				`<ul>${o.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></aside>`
		);
	}
	out.push('\n');
	return out.join('');
}

// ── Entry point ──────────────────────────────────────────────────────

export const STRUCTURED_BLOCKS = ['ipa-chart', 'paradigm', 'orthography'] as const;

/**
 * Render a fenced block by its info-string name, or `null` when the name
 * isn't a structured block (the caller then tries other handlers).
 */
export function renderStructuredBlock(
	name: string | undefined,
	text: string,
	ctx: BlockContext
): string | null {
	try {
		if (name === 'ipa-chart') return renderIpaChart(parseIpaChart(text));
		if (name === 'paradigm') return renderParadigm(parseParadigm(text, ctx));
		if (name === 'orthography') return renderOrthography(parseOrthography(text, ctx));
		return null;
	} catch (err) {
		if (err instanceof BlockError) return errorBox(name ?? 'block', err.message);
		throw err;
	}
}
