import { graph } from '#lib/server/graph.js';
import { inlineSvgFigures } from '#lib/server/inlineSvgs.js';
import { makeCollectionResolver, renderBody, renderSummary } from '#lib/server/markdown.js';
import type { Entity, Section } from '#lib/types.js';
import { buildSectionNav, subpageBreadcrumbs } from './subpage';

/**
 * Build the view-model for one of an entity's `sections:` pages. The
 * prose renders exactly like the entity body — wikilinks, kind links,
 * interlinear fences, tables — and its links count toward backlinks
 * (see `Entity.sections`).
 */
export async function loadSectionPage(entity: Entity, section: Section) {
	const resolveLink = (path: string) => graph.resolveLink(path, graph.clusterOf(entity.id));
	const kindLookup = (id: string) => graph.get(id)?.meta.kind;
	const languageCodes = graph.languageCodes();
	const kindIds = graph.kindIds();
	const resolveCollection = makeCollectionResolver({
		getCollection: (p) => graph.collection(p),
		folderLabels: (p) => graph.folderLabels(p),
		resolveLink,
		languageCodes,
		kindIds
	});

	const html = await inlineSvgFigures(
		renderBody(
			section.body,
			resolveLink,
			languageCodes,
			kindIds,
			resolveCollection,
			entity.id,
			kindLookup
		)
	);

	const nav = buildSectionNav(entity);
	const at = nav.findIndex((n) => n.key === 'section' && n.slug === section.slug);
	const neighbour = (i: number) => (i >= 0 && i < nav.length ? nav[i]! : null);

	return {
		entity: {
			id: entity.id,
			href: `/${entity.id}`,
			name: entity.meta.name,
			summaryHtml: entity.meta.summary
				? renderSummary(entity.meta.summary, resolveLink, languageCodes, { kindIds, kindLookup })
				: null
		},
		section: { slug: section.slug, title: section.title },
		breadcrumbs: subpageBreadcrumbs(entity),
		nav,
		prev: neighbour(at - 1),
		next: neighbour(at + 1),
		html
	};
}

export type SectionPageData = Awaited<ReturnType<typeof loadSectionPage>>;
