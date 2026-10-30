<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import LineagePersonChip from '#lib/components/LineagePersonChip.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { LineageOverviewData } from './load';

	let { data }: { data: LineageOverviewData } = $props();

	const ui = $derived(t(page.data.world.language));

	let query = $state('');

	const fold = (s: string) =>
		s
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();

	const filtered = $derived.by(() => {
		const needle = fold(query.trim());
		if (needle === '') return data.everyone;
		return data.everyone.filter((p) => fold(p.name).includes(needle));
	});

	const lineageHref = (id: string) => `/${id}/lineage`;
</script>

<svelte:head>
	<title>{ui.lineage_title} · {page.data.world.shortName}</title>
</svelte:head>

<article class="lineage-overview">
	<PageHeader title={ui.lineage_title} subtitle={ui.lineage_overview_lede} />

	<section class="roots">
		<h2>{ui.lineage_roots_heading}</h2>
		{#each data.groups as group, g (g)}
			{#if data.groups.length > 1 && group.label}
				<h3>{group.label}</h3>
			{/if}
			<ul class="root-list">
				{#each group.roots as root (root.person.id)}
					<li class="root">
						<span class="couple">
							<LineagePersonChip person={root.person} href={lineageHref(root.person.id)} />
							{#each root.partners as partner (partner.id)}
								<span
									class="mark"
									role="img"
									aria-label={ui.lineage_partnership}
									title={ui.lineage_partnership}>⚭</span
								>
								<LineagePersonChip person={partner} href={lineageHref(partner.id)} />
							{/each}
						</span>
						<span class="descendants">{ui.lineage_count_descendants(root.descendants)}</span>
					</li>
				{/each}
			</ul>
		{/each}
	</section>

	<section class="everyone">
		<h2>
			{ui.lineage_everyone_heading}
			<span class="count">{ui.lineage_people_count(filtered.length)}</span>
		</h2>
		<input
			class="people-filter"
			type="search"
			bind:value={query}
			placeholder={ui.lineage_filter}
			aria-label={ui.lineage_filter}
		/>
		{#if filtered.length === 0}
			<p class="empty"><em>{ui.lineage_no_match}</em></p>
		{:else}
			<ul class="people">
				{#each filtered as person (person.id)}
					<li>
						<a
							class={person.kind ? `bt-link bt-link--kind-${person.kind}` : 'bt-link'}
							href={lineageHref(person.id)}
							data-bt-slug={person.id.split('/').at(-1)}
							data-bt-kind={person.kind ?? undefined}>{person.name}</a
						>
						{#if person.life}<span class="life">{person.life}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</article>

<style>
	.lineage-overview {
		max-width: min(100%, 64rem);
		margin: 0 auto;
	}

	h2 {
		font-size: var(--text-xl);
		margin: var(--space-7) 0 var(--space-4);
		text-align: center;
	}

	h3 {
		margin: var(--space-5) 0 var(--space-3);
		font-size: var(--text-sm);
		font-weight: normal;
		font-variant-caps: all-small-caps;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.count {
		margin-left: var(--space-2);
		font-size: var(--text-sm);
		font-weight: normal;
		color: var(--ink-faint);
	}

	.root-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-3);
	}

	.root {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--rule-hair);
		border-radius: var(--radius-sm);
	}

	.couple {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: var(--space-2);
	}

	.mark {
		color: var(--ink-faint);
		cursor: help;
	}

	.descendants,
	.life {
		font-size: var(--text-xs);
		color: var(--ink-faint);
	}

	.people-filter {
		display: block;
		width: min(100%, 22rem);
		margin: 0 auto var(--space-5);
		padding: var(--space-2) var(--space-3);
		font: inherit;
		font-size: var(--text-sm);
		color: var(--ink);
		background: var(--parchment);
		border: 1px solid var(--rule-hair);
		border-radius: var(--radius-sm);
	}

	.people-filter:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.people {
		columns: 16rem;
		column-gap: var(--space-5);
	}

	.people li {
		break-inside: avoid;
		padding: var(--space-1) 0;
		font-size: var(--text-sm);
	}

	.people a {
		color: var(--accent);
		text-decoration: none;
	}

	.people a:hover {
		text-decoration: underline;
	}

	.people .life {
		margin-left: var(--space-1);
	}

	.empty {
		text-align: center;
		color: var(--ink-faint);
	}
</style>
