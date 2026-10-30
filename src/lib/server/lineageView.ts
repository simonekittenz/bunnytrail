import { dateYear } from '#lib/dates.js';
import type { AncestorNode, DescendantNode } from '#lib/lineage.js';
import { graph } from './graph';

/** What a lineage page needs to draw one person; trees refer to people by id. */
export interface LineagePerson {
	id: string;
	href: string;
	name: string;
	kind: string | null;
	/** "1735–1801", "1735–", "–1801" or null when neither year is known. */
	life: string | null;
	/** Full birth / death dates as authored, for tooltips. */
	birth: string | null;
	death: string | null;
	/** Name of the birthplace entity, when recorded. */
	birthPlace: string | null;
}

export function lifeSpan(birth: string | null, death: string | null): string | null {
	const b = birth ? dateYear(birth) : null;
	const d = death ? dateYear(death) : null;
	if (b === null && d === null) return null;
	return `${b ?? ''}–${d ?? ''}`;
}

export function buildLineagePerson(id: string): LineagePerson {
	const index = graph.lineage();
	const entity = graph.get(id);
	const birthEvent = index?.birthOf(id) ?? null;
	const deathEvent = index?.deathOf(id) ?? null;
	const birth = birthEvent?.date ?? null;
	const death = deathEvent?.date ?? null;
	const place = birthEvent?.place ? graph.get(birthEvent.place) : undefined;
	return {
		id,
		href: `/${id}`,
		name: entity?.meta.name ?? id,
		kind: entity?.meta.kind ?? null,
		life: lifeSpan(birth, death),
		birth,
		death,
		birthPlace: place?.meta.name ?? null
	};
}

/** Every person mentioned in the given trees (and extra ids), keyed by id. */
export function collectLineagePeople(
	ancestors: AncestorNode | null,
	descendants: DescendantNode | null,
	extra: Iterable<string> = []
): Record<string, LineagePerson> {
	const ids = new Set<string>(extra);
	const up = (n: AncestorNode) => {
		ids.add(n.id);
		n.parents.forEach(up);
	};
	const down = (n: DescendantNode) => {
		ids.add(n.id);
		for (const u of n.unions) {
			if (u.partner) ids.add(u.partner);
			u.children.forEach(down);
		}
	};
	if (ancestors) up(ancestors);
	if (descendants) down(descendants);
	const out: Record<string, LineagePerson> = {};
	for (const id of ids) out[id] = buildLineagePerson(id);
	return out;
}
