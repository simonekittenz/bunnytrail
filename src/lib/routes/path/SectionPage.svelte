<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import SectionNav from '#lib/components/SectionNav.svelte';
	import type { SectionPageData } from './sectionPage.load';

	let { data }: { data: SectionPageData } = $props();

	const ui = $derived(t(page.data.world.language));
</script>

<svelte:head>
	<title>{data.section.title} · {data.entity.name} · {page.data.world.shortName}</title>
</svelte:head>

<article class="section">
	<PageHeader breadcrumbs={data.breadcrumbs} title={data.section.title} />

	<SectionNav items={data.nav} active={data.section.slug} />

	<div class="prose">
		{@html data.html}
	</div>

	{#if data.prev || data.next}
		<nav class="pager" aria-label={ui.section_nav_aria}>
			<span class="prev">
				{#if data.prev}
					<a href={data.prev.href}>
						<span class="label">{ui.section_prev}</span>
						<span class="title">
							← {data.prev.key === 'overview'
								? ui.section_overview
								: (data.prev.title ?? data.prev.slug)}
						</span>
					</a>
				{/if}
			</span>
			<span class="next">
				{#if data.next}
					<a href={data.next.href}>
						<span class="label">{ui.section_next}</span>
						<span class="title">
							{data.next.key === 'dictionary'
								? ui.section_dictionary
								: (data.next.title ?? data.next.slug)} →
						</span>
					</a>
				{/if}
			</span>
		</nav>
	{/if}
</article>

<style>
	.section {
		max-width: min(100%, 56rem);
		margin: 0 auto;
	}

	.prose {
		color: var(--ink);
	}

	/* Reference pages carry wide charts and glosses: the container is
	   generous, but running text keeps a readable measure. */
	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol),
	.prose :global(blockquote) {
		max-width: 44rem;
	}

	.prose :global(h2) {
		margin: var(--space-7) 0 var(--space-4);
		font-size: var(--text-xl);
	}

	.prose :global(h3) {
		margin: var(--space-6) 0 var(--space-3);
		font-size: var(--text-lg);
	}

	.prose :global(h4) {
		margin: var(--space-5) 0 var(--space-2);
		font-size: var(--text-base);
	}

	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 var(--space-4);
	}

	.prose :global(ul),
	.prose :global(ol) {
		padding-left: var(--space-5);
	}

	.prose :global(blockquote) {
		margin: var(--space-5) 0;
		padding-left: var(--space-4);
		border-left: 2px solid var(--rule);
		color: var(--ink-soft);
	}

	.pager {
		display: flex;
		justify-content: space-between;
		gap: var(--space-5);
		margin-top: var(--space-7);
		padding-top: var(--space-4);
		border-top: var(--rule-thin);
	}

	.pager a {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		color: var(--ink);
		text-decoration: none;
	}

	.pager .next a {
		align-items: flex-end;
		text-align: right;
	}

	.pager a:hover .title {
		color: var(--accent);
	}

	.label {
		font-size: var(--text-xs);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
	}

	.title {
		font-family: var(--font-display);
		font-size: var(--text-lg);
	}
</style>
