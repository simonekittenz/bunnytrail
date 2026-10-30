import { error } from '@sveltejs/kit';
import { graph } from '#lib/server/graph.js';
import { buildLineagePerson, type LineagePerson } from '#lib/server/lineageView.js';
import { descendantTree } from '#lib/lineage.js';

export interface LineageRoot {
	person: LineagePerson;
	/** Recorded partners who are also roots, shown together as one entry. */
	partners: LineagePerson[];
	descendants: number;
}

export interface LineageRootGroup {
	cluster: string | null;
	label: string | null;
	roots: LineageRoot[];
}

/**
 * View-model for `/lineage`: where to start. Roots are people with
 * recorded children but no recorded parents — the earliest known
 * ancestors — grouped by cluster, with couples that are both roots
 * shown as one entry. `everyone` feeds the filterable index.
 */
export async function load() {
	await graph.ready();
	const index = graph.lineage();
	if (!index) error(404, 'Lineage is not configured for this world');

	const covered = new Set<string>();
	const groups = new Map<string | null, LineageRoot[]>();
	const clusters = new Set(graph.clusters());

	for (const id of index.roots()) {
		if (covered.has(id) || index.childrenOf(id).length === 0) continue;
		covered.add(id);
		const partnerIds = index
			.partnersOf(id)
			.map((u) => u.partner)
			.filter((p) => !covered.has(p) && index.parentsOf(p).length === 0);
		for (const p of partnerIds) covered.add(p);

		const ids = [id, ...partnerIds];
		const descendants = new Set<string>();
		for (const root of ids) {
			const tree = descendantTree(index, root, 99);
			const visit = (n: typeof tree) => {
				for (const u of n.unions) {
					for (const c of u.children) {
						descendants.add(c.id);
						visit(c);
					}
				}
			};
			visit(tree);
		}

		const first = id.split('/')[0]!;
		const cluster = clusters.has(first) ? first : null;
		const list = groups.get(cluster) ?? [];
		list.push({
			person: buildLineagePerson(id),
			partners: partnerIds.map(buildLineagePerson),
			descendants: descendants.size
		});
		groups.set(cluster, list);
	}

	const rootGroups: LineageRootGroup[] = [...groups.entries()].map(([cluster, roots]) => ({
		cluster,
		label: cluster ? graph.folderLabels(cluster).plural : null,
		roots
	}));

	const everyone = index
		.people()
		.map(buildLineagePerson)
		.sort((a, b) => a.name.localeCompare(b.name));

	return { groups: rootGroups, everyone };
}

export type LineageOverviewData = Awaited<ReturnType<typeof load>>;
