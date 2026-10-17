<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import type { SectionNavItem } from '#lib/types.js';

	interface Props {
		items: SectionNavItem[];
		/** Slug of the current page: `overview`, a section slug, or `dictionary`. */
		active: string;
	}

	let { items, active }: Props = $props();

	const ui = $derived(t(page.data.world.language));

	function label(item: SectionNavItem): string {
		if (item.key === 'overview') return ui.section_overview;
		if (item.key === 'dictionary') return ui.section_dictionary;
		return item.title ?? item.slug;
	}
</script>

<!--
	Tab-style navigation across an entity's sub-pages (its overview,
	declared sections, and dictionary). Real links rather than client
	state, so every page is addressable, prerenderable and searchable.
	Styled to match the entity page's own tab bar.
-->
{#if items.length > 1}
	<nav class="bt-section-nav" aria-label={ui.section_nav_aria}>
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
	.bt-section-nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2) var(--space-4);
		margin: 0 0 var(--space-5) 0;
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
