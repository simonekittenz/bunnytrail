<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import SectionNav from '#lib/components/SectionNav.svelte';
	import VocabularyTable from '#lib/components/VocabularyTable.svelte';
	import type { DictionaryPageData } from './dictionaryPage.load';

	let { data }: { data: DictionaryPageData } = $props();

	const ui = $derived(t(page.data.world.language));
</script>

<svelte:head>
	<title>{ui.section_dictionary} · {data.entity.name} · {page.data.world.shortName}</title>
</svelte:head>

<article class="dictionary">
	<PageHeader
		breadcrumbs={data.breadcrumbs}
		title={ui.section_dictionary}
		subtitleHtml={data.entity.summaryHtml}
	/>

	<SectionNav items={data.nav} active="dictionary" />

	<VocabularyTable
		entries={data.entries}
		listenTemplate={data.listen}
		languageName={data.entity.name}
	/>
</article>

<style>
	.dictionary {
		max-width: min(100%, 56rem);
		margin: 0 auto;
	}
</style>
