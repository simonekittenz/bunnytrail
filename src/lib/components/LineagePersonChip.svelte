<script lang="ts">
	import { page } from '$app/state';
	import { formatDate } from '#lib/dates.js';
	import { t } from '#lib/i18n.js';
	import type { LineagePerson } from '#lib/server/lineageView.js';

	interface Props {
		person: LineagePerson;
		/** The focus person: emphasised and marked as current. */
		current?: boolean;
		/** Link target; defaults to the person's own page. */
		href?: string;
		showPlace?: boolean;
		/** A half-sibling of the focus person: dashed outline. */
		half?: boolean;
		/** One line (name and years) for dense groups; implies no place. */
		compact?: boolean;
	}

	let {
		person,
		current = false,
		href,
		showPlace = true,
		half = false,
		compact = false
	}: Props = $props();

	const ui = $derived(t(page.data.world.language));

	const slug = $derived(person.id.split('/').at(-1) ?? person.id);
	const target = $derived(href ?? `/${person.id}`);
	const linkClass = $derived(
		['bt-link', person.kind ? `bt-link--kind-${person.kind}` : ''].filter(Boolean).join(' ')
	);

	const tooltip = $derived.by(() => {
		const fmt = (value: string) =>
			formatDate(value, page.data.world.dateFormat, page.data.world.language);
		const parts: string[] = [];
		if (half) parts.push(ui.lineage_half_sibling);
		if (person.birth) parts.push(ui.lineage_born(fmt(person.birth)));
		if (person.death) parts.push(ui.lineage_died(fmt(person.death)));
		return parts.length > 0 ? parts.join(' · ') : undefined;
	});
</script>

<div
	class={[
		'bt-lineage-person',
		{
			'bt-lineage-person--current': current,
			'bt-lineage-person--half': half,
			'bt-lineage-person--compact': compact
		}
	]}
	title={tooltip}
>
	<a
		class={linkClass}
		href={target}
		data-bt-slug={slug}
		data-bt-kind={person.kind ?? undefined}
		aria-current={current ? 'true' : undefined}>{person.name}</a
	>
	{#if person.life}
		<span class="life">{person.life}</span>
	{/if}
	{#if showPlace && !compact && person.birthPlace}
		<span class="place">{person.birthPlace}</span>
	{/if}
</div>

<style>
	.bt-lineage-person {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		min-width: 8rem;
		max-width: 12rem;
		padding: var(--space-1) var(--space-3);
		background: var(--parchment);
		border: 1px solid var(--rule-hair);
		border-radius: var(--radius-sm);
		text-align: center;
		line-height: var(--leading-tight);
		box-sizing: border-box;
	}

	.bt-lineage-person--compact {
		flex-direction: row;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		min-width: 0;
		max-width: none;
		padding: 0 var(--space-2);
		white-space: nowrap;
	}

	.bt-lineage-person--half {
		border-style: dashed;
	}

	.bt-lineage-person--current {
		border-color: var(--accent);
		background: var(--parchment-soft);
		box-shadow: var(--shadow-hover);
	}

	/* :where() keeps specificity at zero so world themes can recolour links. */
	:where(.bt-lineage-person) a {
		color: var(--accent);
		text-decoration: none;
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	:where(.bt-lineage-person) a:hover {
		text-decoration: underline;
		color: var(--accent-soft);
	}

	.bt-lineage-person--current a {
		font-weight: 600;
		font-size: var(--text-base);
	}

	.life,
	.place {
		font-size: var(--text-xs);
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}
</style>
