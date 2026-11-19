<script lang="ts">
	import TimelineDotNav from '#lib/components/TimelineDotNav.svelte';
	import type { TimelineDotPageData } from './timelineDotPage.load.ts';

	interface Props {
		data: TimelineDotPageData;
	}

	let { data }: Props = $props();
</script>

<TimelineDotNav nav={data} />

{#if data.status}
	<p class="dot-status" data-status={data.status}>{data.status}</p>
{/if}

{#if data.summaryHtml}
	<p class="dot-summary">
		<!-- trusted: server-rendered summary from the engine pipeline -->
		{@html data.summaryHtml}
	</p>
{/if}

{#if data.displayLabel}
	<p class="dot-dateline">{data.displayLabel}</p>
{/if}

{#if data.bodyHtml}
	<div class="dot-body">
		<!-- trusted: server-rendered markdown from the engine pipeline -->
		{@html data.bodyHtml}
	</div>
{/if}

<style>
	/* ── Summary ───────────────────────────────────────────────────── */
	.dot-summary {
		max-width: var(--prose-w, 48rem);
		margin: 0 auto var(--space-2);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--text-base);
		color: var(--ink-soft);
		text-align: center;
	}

	.dot-status {
		max-width: var(--prose-w, 48rem);
		margin: var(--space-3) auto 0;
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.1em;
		color: var(--accent-deep);
		text-align: center;
	}

	/* ── Dateline (display variant, only shown when it differs from heading) */
	.dot-dateline {
		max-width: var(--prose-w, 48rem);
		margin: 0 auto var(--space-6);
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
		text-align: center;
	}

	/* ── Body prose ────────────────────────────────────────────────── */
	.dot-body {
		max-width: var(--prose-w, 48rem);
		margin: var(--space-8) auto 0;
	}
</style>
