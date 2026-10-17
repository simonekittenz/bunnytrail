<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import type { VocabEntry } from '#lib/types.js';

	interface Props {
		entries: VocabEntry[];
	}

	let { entries }: Props = $props();

	const ui = $derived(t(page.data.world.language));

	type SortCol = 'word' | 'pos' | 'meaning' | 'notes' | 'source';
	type SortDir = 'asc' | 'desc';

	let sortCol = $state<SortCol>('word');
	let sortDir = $state<SortDir>('asc');
	let query = $state('');

	/** True when at least one entry has a non-null sourceId. */
	const showSource = $derived(entries.some((e) => e.sourceId !== null));
	const showIpa = $derived(entries.some((e) => e.ipa));
	const showClass = $derived(entries.some((e) => e.cls));

	/** Lowercase and drop tone marks, so "kunay" finds "kunǎy". */
	function fold(s: string): string {
		return s.normalize('NFD').replace(/[\u0300-\u036f]+/g, '').toLowerCase();
	}

	/** Compare two nullable strings: non-null before null, then locale order. */
	function cmp(a: string | null, b: string | null): number {
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		return a.localeCompare(b);
	}

	const visible = $derived.by(() => {
		const q = fold(query.trim());
		if (!q) return entries;
		return entries.filter((e) =>
			[e.word, ...e.forms, e.meaning, e.pos, e.notes, e.ipa, e.cls, e.gloss].some(
				(field) => field && fold(field).includes(q)
			)
		);
	});

	const sorted = $derived.by(() => {
		const slice = [...visible];
		const dir = sortDir === 'asc' ? 1 : -1;
		slice.sort((a, b) => {
			let diff = 0;
			switch (sortCol) {
				// Dictionary order comes from the language's own alphabet.
				case 'word':
					diff = a.sortKey === b.sortKey ? cmp(a.word, b.word) : a.sortKey < b.sortKey ? -1 : 1;
					break;
				case 'pos':     diff = cmp(a.pos, b.pos); break;
				case 'meaning': diff = cmp(a.meaning, b.meaning); break;
				case 'notes':   diff = cmp(a.notes, b.notes); break;
				case 'source':  diff = cmp(a.sourceName, b.sourceName); break;
			}
			return diff * dir;
		});
		return slice;
	});

	const wordCount = $derived(entries.length);

	function toggleSort(col: SortCol) {
		if (sortCol === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortCol = col;
			sortDir = 'asc';
		}
	}

	function indicator(col: SortCol): string {
		if (sortCol !== col) return '';
		return sortDir === 'asc' ? '▲' : '▼';
	}
</script>

<div class="vocab-wrap">
	<div class="toolbar">
		<p class="word-count">
			{ui.dictionary_word_count(wordCount)}{#if query.trim() && visible.length !== wordCount}
				· {visible.length}{/if}
		</p>
		{#if wordCount > 12}
			<input
				class="filter"
				type="search"
				bind:value={query}
				placeholder={ui.dictionary_filter}
				aria-label={ui.dictionary_filter}
				autocomplete="off"
				spellcheck="false"
			/>
		{/if}
	</div>

	<div class="table-scroll">
		<table class="vocab-table">
			<thead>
				<tr>
					<th>
						<button class="sort-btn" class:active={sortCol === 'word'} onclick={() => toggleSort('word')}>
							Word{#if indicator('word')}<span class="sort-indicator" aria-hidden="true">{indicator('word')}</span>{/if}
						</button>
					</th>
					{#if showIpa}
						<th class="col-ipa"><span class="plain-head">IPA</span></th>
					{/if}
					<th class="col-pos">
						<button class="sort-btn" class:active={sortCol === 'pos'} onclick={() => toggleSort('pos')}>
							Pos{#if indicator('pos')}<span class="sort-indicator" aria-hidden="true">{indicator('pos')}</span>{/if}
						</button>
					</th>
					<th>
						<button class="sort-btn" class:active={sortCol === 'meaning'} onclick={() => toggleSort('meaning')}>
							Meaning{#if indicator('meaning')}<span class="sort-indicator" aria-hidden="true">{indicator('meaning')}</span>{/if}
						</button>
					</th>
					{#if showClass}
						<th class="col-class"><span class="plain-head">Class</span></th>
					{/if}
					<th>
						<button class="sort-btn" class:active={sortCol === 'notes'} onclick={() => toggleSort('notes')}>
							Notes{#if indicator('notes')}<span class="sort-indicator" aria-hidden="true">{indicator('notes')}</span>{/if}
						</button>
					</th>
					{#if showSource}
						<th>
							<button class="sort-btn" class:active={sortCol === 'source'} onclick={() => toggleSort('source')}>
								Source{#if indicator('source')}<span class="sort-indicator" aria-hidden="true">{indicator('source')}</span>{/if}
							</button>
						</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each sorted as entry (entry.id + (entry.sourceId ?? ''))}
					<tr id={entry.id ? `w-${entry.id}` : undefined}>
						<td class="cell-word">
							<span class="word-text">{entry.word}</span>
						</td>
						{#if showIpa}
							<td class="cell-ipa">
								{#if entry.ipa}<span class="ipa">/{entry.ipa}/</span>{/if}
							</td>
						{/if}
						<td class="cell-pos">
							{#if entry.pos}
								<span class="pos-label">{entry.pos}</span>
							{/if}
						</td>
						<td class="cell-meaning">
							{#if entry.meaning}{entry.meaning}{/if}
						</td>
						{#if showClass}
							<td class="cell-class">{entry.cls ?? ''}</td>
						{/if}
						<td class="cell-notes">
							{#if entry.notes}{entry.notes}{/if}
						</td>
						{#if showSource}
							<td class="cell-source">
								{#if entry.sourceHref && entry.sourceName}
									<a class="source-link" href={entry.sourceHref}>{entry.sourceName}</a>
								{:else if entry.sourceName}
									{entry.sourceName}
								{/if}
							</td>
						{/if}
					</tr>
				{/each}
				{#if sorted.length === 0}
					<tr>
						<td class="no-match" colspan="9">{ui.dictionary_no_match}</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<style>
	.vocab-wrap {
		margin-block: var(--space-4);
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin: 0 0 var(--space-4);
	}

	.word-count {
		margin: 0;
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}

	.filter {
		width: min(100%, 16rem);
		padding: var(--space-2) var(--space-3);
		font: inherit;
		font-size: var(--text-sm);
		color: var(--ink);
		background: var(--vellum);
		border: 1px solid var(--rule);
		border-radius: var(--radius-sm);
	}

	.filter:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.plain-head {
		display: inline-block;
		padding: var(--space-2) var(--space-4) var(--space-2) 0;
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.08em;
		font-weight: 600;
		color: var(--ink-faint);
	}

	.no-match {
		padding: var(--space-5) 0;
		color: var(--ink-faint);
		font-style: italic;
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.vocab-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
		color: var(--ink);
	}

	/* ── Header: a single bottom rule to separate from body ─────────── */
	.vocab-table thead tr {
		border-bottom: 1px solid var(--rule);
	}

	.vocab-table th {
		padding: 0;
		text-align: left;
		white-space: nowrap;
	}

	/* ── Sort buttons ─────────────────────────────────────────────── */
	.sort-btn {
		all: unset;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-4) var(--space-2) 0;
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.08em;
		font-weight: 600;
		color: var(--ink-faint);
		cursor: pointer;
		transition: color 150ms ease;
		user-select: none;
	}

	.sort-btn:hover,
	.sort-btn.active {
		color: var(--accent-deep);
	}

	.sort-indicator {
		font-size: 0.65em;
		color: var(--accent);
		vertical-align: middle;
	}

	/* ── Body rows: no borders, generous padding creates the rhythm ── */
	.vocab-table tbody tr {
		transition: background-color 100ms ease;
	}

	.vocab-table tbody tr:hover {
		background-color: color-mix(in srgb, var(--accent) 5%, transparent);
	}

	.vocab-table td {
		padding: var(--space-3) var(--space-4) var(--space-3) 0;
		vertical-align: baseline;
		line-height: var(--leading-normal);
	}

	/* ── Word column ─────────────────────────────────────────────── */
	.cell-word {
		white-space: nowrap;
		padding-right: var(--space-5);
	}

	.word-text {
		font-style: italic;
		font-family: var(--font-conlang);
	}

	/* Deep links from interlinear glosses land on `#w-<id>`. */
	.vocab-table tbody tr {
		scroll-margin-top: var(--space-6);
	}

	.vocab-table tbody tr:target {
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.cell-ipa {
		white-space: nowrap;
	}

	.ipa {
		font-family: var(--font-ipa);
		color: var(--ink-soft);
	}

	.cell-class {
		white-space: nowrap;
		font-size: var(--text-xs);
		color: var(--ink-faint);
	}

	/* ── Pos column ──────────────────────────────────────────────── */
	.col-pos { width: 1%; }

	.cell-pos { white-space: nowrap; }

	.pos-label {
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.06em;
		color: var(--ink-faint);
		padding-right: var(--space-4);
	}

	/* ── Meaning / Notes ─────────────────────────────────────────── */
	.cell-meaning { color: var(--ink); }
	.cell-notes   { color: var(--ink-soft, var(--ink-faint)); font-size: var(--text-sm); }

	/* ── Source links ────────────────────────────────────────────── */
	.cell-source { white-space: nowrap; }

	.source-link {
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.06em;
		color: var(--ink-faint);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-hair);
	}

	.source-link:hover {
		color: var(--accent);
		border-bottom-color: var(--accent-warm);
	}
</style>
