<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import { listenHref } from '#lib/listen.js';
	import { entryMatches, fold, SEARCH_SCOPES, type SearchScope } from '#lib/vocabSearch.js';
	import type { VocabEntry } from '#lib/types.js';

	interface Props {
		entries: VocabEntry[];
		/** URL template with `{ipa}` for the "hear it" link; null hides the icon. */
		listenTemplate?: string | null;
		/** The language's name, used to label the "search the word" option. */
		languageName?: string | null;
	}

	let { entries, listenTemplate = null, languageName = null }: Props = $props();

	const ui = $derived(t(page.data.world.language));

	type SortCol = 'word' | 'pos' | 'meaning' | 'notes' | 'source';
	type SortDir = 'asc' | 'desc';

	let sortCol = $state<SortCol>('word');
	let sortDir = $state<SortDir>('asc');
	let query = $state('');
	let scope = $state<SearchScope>('all');

	/** True when at least one entry has a non-null sourceId. */
	const showSource = $derived(entries.some((e) => e.sourceId !== null));
	const showIpa = $derived(entries.some((e) => e.ipa));
	const showClass = $derived(entries.some((e) => e.cls));

	const scopeLabel = $derived<Record<SearchScope, string>>({
		all: ui.dictionary_scope_all,
		word: languageName || ui.dictionary_scope_word,
		meaning: ui.dictionary_scope_meaning
	});

	const placeholder = $derived(
		scope === 'word'
			? ui.dictionary_filter_word
			: scope === 'meaning'
				? ui.dictionary_filter_meaning
				: ui.dictionary_filter
	);

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
		return entries.filter((e) => entryMatches(e, q, scope));
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

	// ── Current letter ──────────────────────────────────────────────
	// While the list is in dictionary order, the sticky bar shows the
	// letter of the first row still visible below it.
	let bar = $state<HTMLElement>();
	let body = $state<HTMLTableSectionElement>();
	let currentLetter = $state('');
	let frame = 0;

	/** "ch" → "Ch": a digraph is one letter, capitalised like a name. */
	function display(letter: string): string {
		const [first = '', ...rest] = [...letter];
		return first.toLocaleUpperCase() + rest.join('');
	}

	function updateLetter() {
		frame = 0;
		if (!bar || !body || sortCol !== 'word' || sorted.length === 0) {
			currentLetter = '';
			return;
		}
		const rows = body.rows;
		const line = bar.getBoundingClientRect().bottom;
		// First row more than half clear of the bar, so one that is mostly
		// tucked underneath it doesn't name the letter.
		const clear = (row: HTMLTableRowElement) => {
			const r = row.getBoundingClientRect();
			return r.top + r.height / 2 > line;
		};
		let lo = 0;
		let hi = Math.min(rows.length, sorted.length) - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (clear(rows[mid]!)) hi = mid;
			else lo = mid + 1;
		}
		currentLetter = sorted[lo]?.letter ?? '';
	}

	function scheduleLetter() {
		if (!frame) frame = requestAnimationFrame(updateLetter);
	}

	// Re-read after the list, its order or the layout changes.
	$effect(() => {
		void sorted;
		void sortCol;
		updateLetter();
	});
</script>

<svelte:window onscroll={scheduleLetter} onresize={scheduleLetter} />

<div class="vocab-wrap">
	<div class="vocab-bar" class:vocab-bar--searchable={wordCount > 12} bind:this={bar}>
		{#if wordCount > 12}
			<span
				class="vocab-letter"
				class:vocab-letter--empty={!currentLetter}
				role="img"
				aria-label={currentLetter ? `${ui.dictionary_letter_aria}: ${display(currentLetter)}` : undefined}
				aria-hidden={currentLetter ? undefined : 'true'}>{currentLetter ? display(currentLetter) : ''}</span
			>
		{/if}
		<p class="vocab-count">
			{ui.dictionary_word_count(wordCount)}{#if query.trim() && visible.length !== wordCount}
				· {visible.length}{/if}
		</p>
		{#if wordCount > 12}
			<input
				class="vocab-filter"
				type="search"
				bind:value={query}
				{placeholder}
				aria-label={placeholder}
				autocomplete="off"
				spellcheck="false"
			/>
			<div class="vocab-scope" role="radiogroup" aria-label={ui.dictionary_scope_label}>
				{#each SEARCH_SCOPES as option (option)}
					<button
						type="button"
						role="radio"
						class="vocab-scope__opt"
						class:active={scope === option}
						aria-checked={scope === option}
						onclick={() => (scope = option)}
					>
						{scopeLabel[option]}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="table-scroll bt-scroll-fade">
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
			<tbody bind:this={body}>
				{#each sorted as entry (entry.id + (entry.sourceId ?? ''))}
					<tr id={entry.id ? `w-${entry.id}` : undefined}>
						<td class="cell-word">
							<span class="word-text">{entry.word}</span>
						</td>
						{#if showIpa}
							<td class="cell-ipa">
								{#if entry.ipa}<span
										class="ipa"
										class:ipa--auto={entry.ipaAuto}
										title={entry.ipaAuto ? ui.dictionary_ipa_auto : undefined}>/{entry.ipa}/</span
									>{#if listenTemplate}
										<a
											class="listen"
											href={listenHref(listenTemplate, entry.ipa)}
											target="_blank"
											rel="noopener noreferrer"
											title={ui.dictionary_listen}
											aria-label={`${ui.dictionary_listen}: ${entry.word}`}
										>
											<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
												<path fill="currentColor" d="M2 6v4h3l4 3V3L5 6H2z" />
												<path
													fill="none"
													stroke="currentColor"
													stroke-width="1.3"
													stroke-linecap="round"
													d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.7a6 6 0 0 1 0 8.6"
												/>
											</svg>
										</a>
									{/if}{/if}
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

	/* The bar is prefixed `vocab-` on purpose: CollectionPage.css ships global,
	   unscoped `.toolbar` and `.filter` rules that would otherwise override
	   these and push the search box off the page. */
	.vocab-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		margin: 0 0 var(--space-4);
	}

	/* With a search box the bar stays put while the list scrolls under it. */
	.vocab-bar--searchable {
		position: sticky;
		top: 0;
		z-index: 5;
		display: grid;
		grid-template-columns: 2.5rem auto minmax(8rem, 1fr) auto;
		grid-template-areas: 'letter count search scope';
		align-items: center;
		padding: var(--space-3) 0;
		background: var(--page, var(--parchment));
		border-bottom: 1px solid var(--rule-hair);
	}

	.vocab-count {
		grid-area: count;
		margin: 0;
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
		white-space: nowrap;
	}

	/* The letter the list has scrolled to. */
	.vocab-letter {
		grid-area: letter;
		font-family: var(--font-conlang, var(--font-display));
		font-size: var(--text-xl);
		line-height: 1;
		text-align: center;
		color: var(--accent-deep);
	}

	.vocab-letter--empty {
		visibility: hidden;
	}

	.vocab-filter {
		grid-area: search;
		justify-self: end;
		width: min(100%, 16rem);
		padding: var(--space-2) var(--space-3);
		font: inherit;
		font-size: var(--text-sm);
		color: var(--ink);
		background: var(--vellum);
		border: 1px solid var(--rule);
		border-radius: var(--radius-sm);
	}

	.vocab-filter:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	/* "Search in: Both | Word | Translation" as a small segmented control. */
	.vocab-scope {
		grid-area: scope;
		display: inline-flex;
		border: 1px solid var(--rule);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.vocab-scope__opt {
		all: unset;
		box-sizing: border-box;
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.08em;
		font-weight: 600;
		color: var(--ink-faint);
		cursor: pointer;
		transition:
			color 150ms ease,
			background-color 150ms ease;
	}

	.vocab-scope__opt + .vocab-scope__opt {
		border-left: 1px solid var(--rule-hair);
	}

	.vocab-scope__opt:hover {
		color: var(--accent-deep);
	}

	.vocab-scope__opt.active {
		color: var(--ink);
		background: var(--parchment-soft);
	}

	.vocab-scope__opt:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	/* Narrow screens: letter and search share the first row, the count and
	   scope switch sit under them, so the sticky bar stays short. */
	@media (max-width: 40rem) {
		.vocab-bar--searchable {
			grid-template-columns: 2rem minmax(0, 1fr);
			grid-template-areas:
				'letter search'
				'count scope';
			gap: var(--space-2) var(--space-3);
		}

		.vocab-filter {
			justify-self: stretch;
			width: 100%;
		}

		.vocab-scope {
			justify-self: end;
		}
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
		scroll-margin-top: 7rem;
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

	/* The speaker icon that opens the pronunciation in an outside reader. */
	.listen {
		display: inline-flex;
		margin-left: var(--space-2);
		vertical-align: -0.1em;
		color: var(--ink-faint);
		border-radius: var(--radius-sm);
	}

	.listen:hover {
		color: var(--accent);
	}

	.listen:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* A pronunciation worked out from the spelling, not written down. */
	.ipa--auto {
		cursor: help;
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
