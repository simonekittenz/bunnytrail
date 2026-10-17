import { graph } from '#lib/server/graph.js';
import { resolveListenTemplate } from '#lib/server/listen.js';
import { renderSummary } from '#lib/server/markdown.js';
import type { Entity } from '#lib/types.js';
import { buildSectionNav, subpageBreadcrumbs } from './subpage';

/**
 * Build the view-model for a language's dictionary page
 * (`/<language>/dictionary`): the merged word list from its
 * `lexicon.yaml`, its own `vocabulary:` block, and every entity that
 * contributes words in that language. Caller has already checked
 * `graph.hasDictionaryPage(entity.id)`.
 */
export async function loadDictionaryPage(entity: Entity) {
	const resolveLink = (path: string) => graph.resolveLink(path, graph.clusterOf(entity.id));
	const kindLookup = (id: string) => graph.get(id)?.meta.kind;
	const languageCodes = graph.languageCodes();
	const kindIds = graph.kindIds();

	return {
		entity: {
			id: entity.id,
			href: `/${entity.id}`,
			name: entity.meta.name,
			summaryHtml: entity.meta.summary
				? renderSummary(entity.meta.summary, resolveLink, languageCodes, { kindIds, kindLookup })
				: null
		},
		breadcrumbs: subpageBreadcrumbs(entity),
		nav: buildSectionNav(entity),
		entries: graph.languageVocabulary(entity.id),
		listen: resolveListenTemplate(entity.meta.listen)
	};
}

export type DictionaryPageData = Awaited<ReturnType<typeof loadDictionaryPage>>;
