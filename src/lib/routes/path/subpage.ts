import { graph } from '#lib/server/graph.js';
import type { Entity, SectionNavItem } from '#lib/types.js';

/**
 * Shared helpers for an entity's reader-facing sub-pages — the
 * `sections:` pages and the dictionary — so the entity page and each
 * sub-page agree on the breadcrumb trail and the tab-style nav.
 */

export interface Crumb {
	label: string;
	href: string;
}

/**
 * Browseable folder crumbs from the content root down to the folder
 * containing `type` (an entity's parent path), e.g.
 * `People › Languages`. Parent folders are narrative collections, so
 * plural labels are used.
 */
export function folderBreadcrumbs(type: string): Crumb[] {
	const crumbs: Crumb[] = [];
	if (!type) return crumbs;
	const segs = type.split('/');
	for (let i = 1; i <= segs.length; i++) {
		const prefix = segs.slice(0, i).join('/');
		if (graph.isFolder(prefix)) {
			crumbs.push({ label: graph.folderLabels(prefix).plural, href: `/${prefix}` });
		}
	}
	return crumbs;
}

/** Crumbs for a sub-page: the folder trail plus the owning entity. */
export function subpageBreadcrumbs(entity: Entity): Crumb[] {
	return [
		...folderBreadcrumbs(entity.type),
		{ label: entity.meta.name, href: `/${entity.id}` }
	];
}

/**
 * The tab-style navigation shared by an entity and its sub-pages:
 * Overview, then each declared section in order, then the dictionary
 * when the language has one, then the lineage hourglass for people in the
 * world's lineage. Empty when the entity has no sub-pages, in
 * which case nothing is rendered.
 */
export function buildSectionNav(entity: Entity): SectionNavItem[] {
	const hasDictionary = graph.hasDictionaryPage(entity.id);
	const hasLineage = graph.hasLineagePage(entity.id);
	if (entity.sections.length === 0 && !hasDictionary && !hasLineage) return [];
	const items: SectionNavItem[] = [
		{ key: 'overview', slug: 'overview', title: null, href: `/${entity.id}` }
	];
	for (const s of entity.sections) {
		items.push({ key: 'section', slug: s.slug, title: s.title, href: `/${entity.id}/${s.slug}` });
	}
	if (hasDictionary) {
		items.push({
			key: 'dictionary',
			slug: 'dictionary',
			title: null,
			href: `/${entity.id}/dictionary`
		});
	}
	if (hasLineage) {
		items.push({ key: 'lineage', slug: 'lineage', title: null, href: `/${entity.id}/lineage` });
	}
	return items;
}
