import { graph } from '#lib/server/graph.js';
import { collectLineagePeople } from '#lib/server/lineageView.js';
import {
	LINEAGE_DEFAULT_DOWN,
	LINEAGE_DEFAULT_UP,
	LINEAGE_MAX_DOWN,
	LINEAGE_MAX_UP,
	ancestorDepth,
	ancestorTree,
	countAncestors,
	countDescendants,
	descendantDepth,
	descendantTree
} from '#lib/lineage.js';
import type { Entity } from '#lib/types.js';
import { buildSectionNav, subpageBreadcrumbs } from './subpage';

/**
 * View-model for a person's lineage page (`/<id>/lineage`): one diagram
 * with their ancestors above, they and their siblings in a row (`family`),
 * and their partners and descendants below. The trees are sent to
 * the maximum depth and the page trims them client-side, so the depth
 * control works on prerendered builds too. Caller has already checked
 * `graph.hasLineagePage(entity.id)`.
 */
export async function loadLineagePage(entity: Entity) {
	const index = graph.lineage()!;
	const ancestors = ancestorTree(index, entity.id, LINEAGE_MAX_UP);
	const descendants = descendantTree(index, entity.id, LINEAGE_MAX_DOWN);
	const family = index.siblingRowOf(entity.id);

	return {
		entity: { id: entity.id, href: `/${entity.id}`, name: entity.meta.name },
		breadcrumbs: subpageBreadcrumbs(entity),
		nav: buildSectionNav(entity),
		people: collectLineagePeople(
			ancestors,
			descendants,
			family.map((m) => m.id)
		),
		ancestors,
		descendants,
		family,
		counts: {
			ancestors: countAncestors(ancestors),
			descendants: countDescendants(descendants)
		},
		availableUp: Math.min(LINEAGE_MAX_UP, ancestorDepth(ancestors)),
		availableDown: Math.min(LINEAGE_MAX_DOWN, descendantDepth(descendants)),
		defaults: { up: LINEAGE_DEFAULT_UP, down: LINEAGE_DEFAULT_DOWN }
	};
}

export type LineagePageData = Awaited<ReturnType<typeof loadLineagePage>>;
