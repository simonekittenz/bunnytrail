<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import type { SectionNavItem } from '#lib/types.js';

	interface Props {
		items: SectionNavItem[];
		/** Slug of the current page: `overview`, a section slug, `dictionary` or `lineage`. */
		active: string;
	}

	let { items, active }: Props = $props();

	const ui = $derived(t(page.data.world.language));

	let navHeight = $state(0);
	const visible = $derived(items.length > 1);

	// Published so other sticky things (the dictionary's filter bar, the
	// table of contents) can sit just under the tabs instead of behind them.
	$effect(() => {
		const root = document.documentElement;
		root.style.setProperty('--bt-section-nav-h', `${visible ? navHeight : 0}px`);
		return () => root.style.removeProperty('--bt-section-nav-h');
	});

	function label(item: SectionNavItem): string {
		if (item.key === 'overview') return ui.section_overview;
		if (item.key === 'dictionary') return ui.section_dictionary;
		if (item.key === 'lineage') return ui.lineage_title;
		return item.title ?? item.slug;
	}
</script>

<!--
	Tab-style navigation across an entity's sub-pages (its overview,
	declared sections, and dictionary). Real links rather than client
	state, so every page is addressable, prerenderable and searchable.
	Styled to match the entity page's own tab bar.
-->
{#if visible}
	<nav class="bt-section-nav" aria-label={ui.section_nav_aria} bind:offsetHeight={navHeight}>
		{#each items as item (item.slug)}
			<a
				class="link"
				class:active={item.slug === active}
				href={item.href}
				aria-current={item.slug === active ? 'page' : undefined}
			>
				{label(item)}
			</a>
		{/each}
	</nav>
{/if}

<style>
	/* The tabs stay on screen while the page scrolls under them. */
	.bt-section-nav {
		position: sticky;
		top: 0;
		z-index: 6;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2) var(--space-4);
		margin: 0 0 var(--space-5) 0;
		padding: var(--space-3) 0 0;
		background: var(--page, var(--parchment));
		border-bottom: 1px solid var(--rule-hair);
	}

	.link {
		padding: 0 0 var(--space-2) 0;
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition:
			color 120ms ease,
			border-color 120ms ease;
	}

	.link:hover {
		color: var(--accent);
	}

	.link.active {
		color: var(--ink);
		border-bottom-color: var(--accent);
	}
</style>
