<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import type { TocItem } from '#lib/types.js';

	interface Props {
		items: TocItem[];
	}

	let { items }: Props = $props();

	const ui = $derived(t(page.data.world.language));

	/** Id of the heading currently nearest the top of the viewport. */
	let activeId = $state<string | null>(null);

	/** Open on wide screens (sticky side column); folded on narrow ones. */
	let open = $state(true);

	// Progressive enhancement: the list works as plain anchor links without
	// any script. With one, fold it away on narrow screens (where it sits
	// above the text) and highlight the section being read.
	onMount(() => {
		if (window.matchMedia('(max-width: 60rem)').matches) open = false;

		const headings = items
			.map((i) => document.getElementById(i.id))
			.filter((el): el is HTMLElement => el !== null);
		if (headings.length === 0 || typeof IntersectionObserver === 'undefined') return;

		const visible = new Set<string>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) visible.add(e.target.id);
					else visible.delete(e.target.id);
				}
				// The topmost heading still in the reading band wins; if none is
				// (we're between two), keep the previous one.
				const first = headings.find((h) => visible.has(h.id));
				if (first) activeId = first.id;
			},
			{ rootMargin: '0px 0px -70% 0px' }
		);
		for (const h of headings) observer.observe(h);
		return () => observer.disconnect();
	});
</script>

<!--
	"On this page": a table of contents for a long document, built from its
	h2/h3 headings (see server/toc.ts). A <details> so narrow screens can
	fold it away; wide screens keep it open in a sticky side column.
-->
{#if items.length > 0}
	<nav class="toc" aria-label={ui.toc_title}>
		<details bind:open>
			<summary>{ui.toc_title}</summary>
			<ol>
				{#each items as item (item.id)}
					<li class:sub={item.level === 3}>
						<a
							href={`#${item.id}`}
							class:active={item.id === activeId}
							aria-current={item.id === activeId ? 'location' : undefined}
						>
							{item.text}
						</a>
					</li>
				{/each}
			</ol>
		</details>
	</nav>
{/if}

<style>
	.toc {
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
	}

	summary {
		cursor: pointer;
		padding: 0 0 var(--space-2);
		font-family: var(--font-serif);
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::after {
		content: '▸';
		display: inline-block;
		margin-left: var(--space-2);
		transition: transform 0.15s;
	}

	details[open] > summary::after {
		transform: rotate(90deg);
	}

	ol {
		margin: 0;
		padding: 0;
		list-style: none;
		border-left: 1px solid var(--rule-hair);
	}

	li {
		margin: 0;
	}

	li.sub a {
		padding-left: var(--space-5);
		font-size: var(--text-xs);
	}

	a {
		display: block;
		padding: 0.2rem var(--space-3);
		margin-left: -1px;
		border-left: 1px solid transparent;
		color: var(--ink-soft);
		text-decoration: none;
	}

	a:hover {
		color: var(--accent);
	}

	a.active {
		color: var(--ink);
		border-left-color: var(--accent);
	}
</style>
