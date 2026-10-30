<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { dateYear } from '#lib/dates.js';
	import { t } from '#lib/i18n.js';
	import type {
		AncestorNode,
		DescendantNode,
		DescendantUnion,
		SiblingRowMember
	} from '#lib/lineage.js';
	import LineagePersonChip from '#lib/components/LineagePersonChip.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import SectionNav from '#lib/components/SectionNav.svelte';
	import type { LineagePageData } from './lineagePage.load';

	let { data }: { data: LineagePageData } = $props();

	const ui = $derived(t(page.data.world.language));

	// svelte-ignore state_referenced_locally
	let up = $state(Math.min(data.defaults.up, data.availableUp));
	// svelte-ignore state_referenced_locally
	let down = $state(Math.min(data.defaults.down, data.availableDown));

	const upOptions = $derived(Array.from({ length: data.availableUp + 1 }, (_, i) => i));
	const downOptions = $derived(Array.from({ length: data.availableDown + 1 }, (_, i) => i));

	function readParam(name: string, max: number): number | null {
		const raw = page.url.searchParams.get(name);
		if (raw === null) return null;
		const n = Number.parseInt(raw, 10);
		return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : null;
	}

	// Reading the query string during prerender throws, so only do it in the browser.
	onMount(() => {
		up = readParam('up', data.availableUp) ?? up;
		down = readParam('down', data.availableDown) ?? down;
	});

	function setDepth(key: 'up' | 'down', value: number) {
		if (key === 'up') up = value;
		else down = value;
		const url = new URL(page.url.href);
		url.searchParams.set(key, String(value));
		replaceState(url, page.state);
	}

	// A diagram wider than the screen starts scrolled to the focus person;
	// `depth` is only here so a depth change re-centres.
	function centreOnFocus(depth: number) {
		return (node: HTMLElement) => {
			void depth;
			const focus = node.querySelector<HTMLElement>('[aria-current="true"]');
			if (!focus) return;
			const box = focus.getBoundingClientRect();
			const left = box.left - node.getBoundingClientRect().left + node.scrollLeft;
			node.scrollLeft = Math.max(0, left + box.width / 2 - node.clientWidth / 2);
		};
	}

	function unionYears(union: DescendantUnion): string | null {
		if (union.implicit) return null;
		const from = union.from ? dateYear(union.from) : null;
		const to = union.to ? dateYear(union.to) : null;
		if (from === null && to === null) return null;
		return `${from ?? ''}${to !== null ? `–${to}` : ''}`;
	}

	type FamilyItem =
		| { type: 'focus' }
		| { type: 'person'; member: SiblingRowMember }
		| { type: 'group'; members: SiblingRowMember[] };

	// Siblings beyond this many on one side of the focus person collapse into
	// a single stack, so a big family doesn't make the diagram very wide.
	const STACK_MIN = 3;

	const familyItems = $derived.by((): FamilyItem[] => {
		const at = data.family.findIndex((m) => m.id === data.entity.id);
		const side = (members: SiblingRowMember[]): FamilyItem[] =>
			members.length >= STACK_MIN
				? [{ type: 'group', members }]
				: members.map((member) => ({ type: 'person', member }));
		return [
			...side(data.family.slice(0, Math.max(at, 0))),
			{ type: 'focus' },
			...side(data.family.slice(at + 1))
		];
	});

	function hasMoreDown(node: DescendantNode): boolean {
		return node.truncated || node.unions.some((u) => u.children.length > 0);
	}
</script>

<svelte:head>
	<title>{ui.lineage_title} · {data.entity.name} · {page.data.world.shortName}</title>
</svelte:head>

{#snippet ancestorNode(node: AncestorNode, level: number)}
	{@const person = data.people[node.id]}
	{@const showParents = level < up && node.parents.length > 0}
	<li class="node">
		{#if showParents}
			<ul class="parents">
				{#each node.parents as parent, i (i)}
					{@render ancestorNode(parent, level + 1)}
				{/each}
			</ul>
		{:else if level >= up && (node.parents.length > 0 || node.truncated)}
			<span class="more" title={ui.lineage_more_up} aria-label={ui.lineage_more_up} role="img"
				>⋯</span
			>
		{/if}
		{#if level === 0}
			<ul class="children">
				{#each familyItems as item, i (i)}
					{#if item.type === 'focus'}
						{@render descendantNode(data.descendants, 0)}
					{:else if item.type === 'group'}
						<li class="node">
							<ul class="stack">
								{#each item.members as member (member.id)}
									{#if data.people[member.id]}
										<li>
											<LineagePersonChip
												person={data.people[member.id]!}
												half={member.half}
												compact
											/>
										</li>
									{/if}
								{/each}
							</ul>
						</li>
					{:else if data.people[item.member.id]}
						<li class="node">
							<LineagePersonChip
								person={data.people[item.member.id]!}
								showPlace={false}
								half={item.member.half}
							/>
						</li>
					{/if}
				{/each}
			</ul>
		{:else if person}
			<LineagePersonChip {person} />
		{/if}
	</li>
{/snippet}

{#snippet unionBlock(union: DescendantUnion, childLevel: number)}
	{@const partner = union.partner ? data.people[union.partner] : undefined}
	{@const years = unionYears(union)}
	{@const showChildren = childLevel <= down && union.children.length > 0}
	{#if partner || showChildren}
		<li class="union">
			{#if partner}
				<div class="union-head">
					<span class="union-meta">
						<span
							class="union-mark"
							role="img"
							aria-label={ui.lineage_partnership}
							title={ui.lineage_partnership}>⚭</span
						>
						{#if years}<span class="union-years">{years}</span>{/if}
					</span>
					<LineagePersonChip person={partner} showPlace={false} />
				</div>
			{/if}
			{#if showChildren}
				<ul class="children">
					{#each union.children as child, i (i)}
						{@render descendantNode(child, childLevel)}
					{/each}
				</ul>
			{/if}
		</li>
	{/if}
{/snippet}

{#snippet descendantNode(node: DescendantNode, level: number)}
	{@const person = data.people[node.id]}
	<li class="node">
		{#if person}
			<LineagePersonChip {person} current={level === 0} showPlace={level === 0} />
		{/if}
		{#if node.unions.some((u) => u.partner || level < down)}
			<ul class="unions">
				{#each node.unions as union, i (i)}
					{@render unionBlock(union, level + 1)}
				{/each}
			</ul>
		{/if}
		{#if level >= down && hasMoreDown(node)}
			<span
				class="more more--down"
				title={ui.lineage_more_down}
				aria-label={ui.lineage_more_down}
				role="img">⋯</span
			>
		{/if}
	</li>
{/snippet}

<article class="lineage">
	<PageHeader breadcrumbs={data.breadcrumbs} title={data.entity.name} eyebrow={ui.lineage_title} />

	<SectionNav items={data.nav} active="lineage" />

	{#if data.availableUp > 0 || data.availableDown > 0}
		<div class="controls" role="group" aria-label={ui.lineage_depth_aria}>
			{#if data.availableUp > 0}
				<div class="depth">
					<span class="depth-label">{ui.lineage_depth_up}</span>
					<span class="depth-buttons">
						{#each upOptions as n (n)}
							<button type="button" aria-pressed={up === n} onclick={() => setDepth('up', n)}
								>{n}</button
							>
						{/each}
					</span>
				</div>
			{/if}
			{#if data.availableDown > 0}
				<div class="depth">
					<span class="depth-label">{ui.lineage_depth_down}</span>
					<span class="depth-buttons">
						{#each downOptions as n (n)}
							<button type="button" aria-pressed={down === n} onclick={() => setDepth('down', n)}
								>{n}</button
							>
						{/each}
					</span>
				</div>
			{/if}
		</div>
	{/if}

	<p class="legend">
		<span>{ui.lineage_count_ancestors(data.counts.ancestors)}</span>
		<span aria-hidden="true">·</span>
		<span>{ui.lineage_count_descendants(data.counts.descendants)}</span>
	</p>

	<div
		class="scroller"
		role="group"
		aria-label={ui.lineage_aria(data.entity.name)}
		{@attach centreOnFocus(up * 10 + down)}
	>
		<ul class="tree">
			{@render ancestorNode(data.ancestors, 0)}
		</ul>
	</div>
</article>

<style>
	.lineage {
		--gap: 1.25rem;
		--line: 1px solid var(--rule);
		max-width: min(100%, 72rem);
		margin: 0 auto;
	}

	/* Depth controls */
	.controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2) var(--space-6);
		margin-bottom: var(--space-5);
	}

	.depth {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.depth-label {
		font-size: var(--text-sm);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}

	.depth-buttons {
		display: inline-flex;
	}

	.depth-buttons button {
		min-width: 1.9rem;
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		color: var(--ink-soft);
		background: transparent;
		border: 1px solid var(--rule-hair);
		margin-left: -1px;
		cursor: pointer;
	}

	.depth-buttons button:first-child {
		margin-left: 0;
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
	}

	.depth-buttons button:last-child {
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
	}

	.depth-buttons button:hover {
		background: var(--parchment-soft);
	}

	.depth-buttons button[aria-pressed='true'] {
		position: relative;
		color: var(--parchment);
		background: var(--accent);
		border-color: var(--accent);
	}

	.depth-buttons button:focus-visible {
		position: relative;
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-4);
		font-size: var(--text-sm);
		color: var(--ink-faint);
	}

	/* Trees */
	.scroller {
		overflow-x: auto;
		padding-bottom: var(--space-2);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* The width trick centres a tree that fits and lets a wider one scroll
	   from its left edge instead of clipping both sides. */
	.tree {
		display: flex;
		justify-content: center;
		width: max-content;
		min-width: 100%;
	}

	.node {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: none;
	}

	.more {
		color: var(--ink-faint);
		line-height: 1;
		letter-spacing: 0.1em;
		cursor: help;
	}

	.node > .more {
		margin-bottom: var(--space-1);
	}

	.more--down {
		margin-top: var(--space-1);
	}

	/* A collapsed group of siblings: one stack hanging from the bar. */
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.stack > li {
		display: grid;
	}

	/* Ancestors: each row of parents sits above the person it belongs to,
	   bottom-aligned so every parent meets the bar however tall its own
	   branch is.
	   A parent's stub drops to a bar at the foot of its <li>; the bar spans
	   the siblings and a stem leaves its midpoint down to the child. */
	.parents {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		position: relative;
		margin-bottom: var(--gap);
	}

	.parents::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		height: var(--gap);
		border-left: var(--line);
	}

	.parents > .node {
		position: relative;
		padding: 0 var(--space-2) var(--gap);
	}

	.parents > .node::before,
	.parents > .node::after {
		content: '';
		position: absolute;
		bottom: 0;
	}

	.parents > .node::before {
		left: 0;
		right: 0;
		border-top: var(--line);
	}

	.parents > .node::after {
		left: 50%;
		height: var(--gap);
		border-left: var(--line);
	}

	.parents > .node:first-child::before {
		left: 50%;
	}

	.parents > .node:last-child::before {
		right: 50%;
	}

	.parents > .node:only-child::before {
		display: none;
	}

	/* Descendants: the mirror image. A node's unions hang below it on a
	   bar; a union's children hang below the partner on a second bar. */
	.unions,
	.children {
		display: flex;
		justify-content: center;
		align-items: flex-start;
		position: relative;
	}

	.node > .unions {
		margin-top: var(--gap);
	}

	.node > .unions::before,
	.union-head + .children::before {
		content: '';
		position: absolute;
		left: 50%;
		bottom: 100%;
		height: var(--gap);
		border-left: var(--line);
	}

	.union {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: none;
	}

	.union-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
	}

	.union-head + .children {
		margin-top: var(--gap);
	}

	.union-meta {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-1);
		font-size: var(--text-xs);
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}

	.union-mark {
		cursor: help;
	}

	.node > .unions > .union,
	.children > .node {
		position: relative;
		padding: var(--gap) var(--space-2) 0;
	}

	.node > .unions > .union::before,
	.node > .unions > .union::after,
	.children > .node::before,
	.children > .node::after {
		content: '';
		position: absolute;
		top: 0;
	}

	.node > .unions > .union::before,
	.children > .node::before {
		left: 0;
		right: 0;
		border-top: var(--line);
	}

	.node > .unions > .union::after,
	.children > .node::after {
		left: 50%;
		height: var(--gap);
		border-left: var(--line);
	}

	.node > .unions > .union:first-child::before,
	.children > .node:first-child::before {
		left: 50%;
	}

	.node > .unions > .union:last-child::before,
	.children > .node:last-child::before {
		right: 50%;
	}

	/* A lone branch needs no bar: the stem above it already reaches it. */
	.node > .unions > .union:only-child,
	.children > .node:only-child {
		padding-top: 0;
	}

	.node > .unions > .union:only-child::before,
	.node > .unions > .union:only-child::after,
	.children > .node:only-child::before,
	.children > .node:only-child::after {
		display: none;
	}
</style>
