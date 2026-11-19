<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import type { TimelineDotNav } from '#lib/types.js';

	let { nav }: { nav: TimelineDotNav } = $props();

	const ui = $derived(t(page.data.world?.language));

	/** Append `?thread=<path>` to a dot href when a thread context is active. */
	function withThread(href: string): string {
		if (!nav.thread) return href;
		return `${href}?thread=${encodeURIComponent(nav.thread)}`;
	}
</script>

<div class="dot-nav">
	{#if nav.thread}
		<a class="dot-nav__thread-link" href="/{nav.thread}"><span class="up-arrow" aria-hidden="true">↑</span>{nav.threadTitle}</a>
	{:else}
		<a class="dot-nav__timeline-link" href={nav.timelineHref}><span class="up-arrow" aria-hidden="true">↑</span>{nav.timelineTitle}</a>
	{/if}

	<div class="dot-nav__strip-wrap">
		{#if nav.parentThreadBack}
			<a class="dot-nav__parent-nav dot-nav__parent-nav--back" href={nav.parentThreadBack.href}>
				<span class="dot-nav__parent-nav-arrow" aria-hidden="true">←</span>{ui.timeline_dot_back_in(nav.parentThreadBack.label)}
			</a>
		{/if}

		<div class="dot-nav__strip" role="navigation" aria-label={ui.timeline_dot_nav_aria}>
		<div class="dot-nav__line" aria-hidden="true"></div>

		{#if nav.prev}
			<a class="dot-nav__neighbour dot-nav__neighbour--prev" href={withThread(nav.prev.href)} aria-label={ui.timeline_dot_go_to_aria(nav.prev.label)}>
				<span class="dot-nav__neighbour-year">{nav.prev.label}</span>
				<span class="dot-nav__pip"></span>
				{#if nav.prev.crossThread}
					<span class="dot-nav__cross-thread">{nav.prev.crossThread.title}</span>
				{/if}
			</a>
		{:else}
			<span class="dot-nav__neighbour dot-nav__neighbour--prev dot-nav__neighbour--empty" aria-hidden="true"></span>
		{/if}

		<div class="dot-nav__current">
			<span class="dot-nav__current-year">{nav.label}</span>
			<span class="dot-nav__pip dot-nav__pip--current"></span>
		</div>

		{#if nav.next}
			<a class="dot-nav__neighbour dot-nav__neighbour--next" href={withThread(nav.next.href)} aria-label={ui.timeline_dot_go_to_aria(nav.next.label)}>
				<span class="dot-nav__neighbour-year">{nav.next.label}</span>
				<span class="dot-nav__pip"></span>
				{#if nav.next.crossThread}
					<span class="dot-nav__cross-thread">{nav.next.crossThread.title}</span>
				{/if}
			</a>
		{:else}
			<span class="dot-nav__neighbour dot-nav__neighbour--next dot-nav__neighbour--empty" aria-hidden="true"></span>
		{/if}
	</div>
		{#if nav.parentThreadForward}
			<a class="dot-nav__parent-nav dot-nav__parent-nav--forward" href={nav.parentThreadForward.href}>
				{ui.timeline_dot_forward_in(nav.parentThreadForward.label)}<span class="dot-nav__parent-nav-arrow" aria-hidden="true">→</span>
			</a>
		{/if}
	</div>
</div>

{#if nav.subThread}
	<div class="dot-subthread"><a class="dot-subthread__link" href={nav.subThread.href}>{nav.subThread.title}</a></div>
{/if}

<style>
	/* ── Wrapper ───────────────────────────────────────────────────── */
	.dot-nav {
		max-width: var(--prose-w, 48rem);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	.dot-nav__timeline-link {
		display: flex;
		justify-content: center;
		align-items: baseline;
		gap: 0.35em;
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
		text-decoration: none;
	}
	.dot-nav__timeline-link:hover {
		color: var(--accent-warm);
	}
	.dot-nav__timeline-link .up-arrow {
		font-variant: normal;
		letter-spacing: 0;
	}

	.dot-nav__thread-link {
		display: flex;
		justify-content: center;
		align-items: baseline;
		gap: 0.35em;
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.14em;
		color: var(--ink-faint);
		text-decoration: none;
	}
	.dot-nav__thread-link:hover {
		color: var(--accent-warm);
	}
	.dot-nav__thread-link .up-arrow {
		font-variant: normal;
		letter-spacing: 0;
	}

	.dot-subthread {
		max-width: var(--prose-w, 48rem);
		margin: 0 auto;
		margin-top: var(--space-4);
		text-align: center;
	}
	.dot-subthread__link {
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
		text-decoration: none;
	}
	.dot-subthread__link:hover {
		color: var(--accent-warm);
	}

	/* ── Strip wrapper (holds parent-nav + strip together) ─────────── */
	.dot-nav__strip-wrap {
		position: relative;
		width: 100%;
	}

	.dot-nav__parent-nav {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4em;
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: var(--text-xs, 0.75rem);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
		text-decoration: none;
		transition: color 200ms ease;
	}
	.dot-nav__parent-nav:hover {
		color: var(--accent-warm);
	}
	.dot-nav__parent-nav-arrow {
		font-variant: normal;
		letter-spacing: 0;
	}
	.dot-nav__parent-nav--forward {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-2);
		margin-bottom: 0;
	}

	/* ── Strip ─────────────────────────────────────────────────────── */
	/* Three columns: the outer two are equal and flexible, the centre
	   is intrinsic width. This keeps the current year anchored at the
	   true centre regardless of whether neighbours exist. */
	.dot-nav__strip {
		position: relative;
		width: 100%;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: end;
		padding-bottom: 10px; /* room for pip below the baseline */
	}

	/* Horizontal spine — full width, aligned to the pip row */
	.dot-nav__line {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 10px; /* matches strip padding-bottom */
		height: 2px;
		background: linear-gradient(
			to right,
			transparent 0%,
			var(--accent-deep) 8%,
			var(--accent-deep) 92%,
			transparent 100%
		);
		opacity: 0.35;
		/* Align to pip centre: pips are 10px tall, half = 5px */
		transform: translateY(calc(50% - 5px));
	}

	/* ── Neighbour dots (prev / next) ──────────────────────────────── */
	.dot-nav__neighbour {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		text-decoration: none;
		color: inherit;
		transition: transform 200ms ease;
		position: relative;
		z-index: 1;
	}

	.dot-nav__neighbour--prev {
		justify-self: start;
		padding-left: 10%;
	}

	.dot-nav__neighbour--next {
		justify-self: end;
		padding-right: 10%;
	}

	.dot-nav__neighbour--empty {
		pointer-events: none;
	}

	.dot-nav__cross-thread {
		position: absolute;
		top: calc(100% + var(--space-1));
		left: 50%;
		transform: translateX(-50%);
		white-space: nowrap;
		font-family: var(--font-serif);
		font-size: var(--text-xs, 0.75rem);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
		transition: color 200ms ease;
	}
	.dot-nav__neighbour:hover .dot-nav__cross-thread {
		color: var(--accent-warm);
	}

	.dot-nav__neighbour:not(.dot-nav__neighbour--empty):hover {
		transform: none; /* no vertical lift — pip grows instead */
	}

	.dot-nav__neighbour-year {
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
		transition: color 200ms ease, transform 200ms ease;
		display: inline-block; /* transform needs a block context */
	}

	.dot-nav__neighbour:hover .dot-nav__neighbour-year {
		color: var(--accent-warm);
		transform: scale(1.25);
	}

	/* ── Current dot ───────────────────────────────────────────────── */
	.dot-nav__current {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		position: relative;
		z-index: 1;
	}

	.dot-nav__current-year {
		font-family: var(--font-display);
		font-size: var(--text-5xl, 3.5rem);
		line-height: 1;
		color: var(--ink);
	}

	/* ── Pips ──────────────────────────────────────────────────────── */
	.dot-nav__pip {
		display: block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background-color: var(--accent);
		opacity: 0.45;
		transition: opacity 200ms ease, transform 200ms ease;
		position: relative;
		z-index: 1;
	}

	.dot-nav__neighbour:hover .dot-nav__pip {
		opacity: 1;
		transform: scale(1.25);
	}

	.dot-nav__pip--current {
		width: 14px;
		height: 14px;
		opacity: 1;
	}
</style>
