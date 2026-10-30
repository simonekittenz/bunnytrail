/**
 * Lineage: who is whose parent, partner and sibling.
 *
 * The engine knows nothing about a world's ontology, so a world binds its
 * own relation ids to lineage roles in `content_meta/world.md`:
 *
 * ```yaml
 * lineage:
 *   parent:                      # required; source → child unless stated
 *     - relation: genealogie/vader-van
 *     - genealogie/moeder-van
 *   partner: genealogie/getrouwd-met   # optional; undirected, may carry from/to
 *   birth: genealogie/geboren-te       # optional; date from the relation, place = target
 *   death: genealogie/overleden-te     # optional
 *   parentOrder:                       # optional; orders a person's parents
 *     property: gender
 *     values: [male, female]
 * ```
 *
 * Everything here is pure and free of server imports so the same code
 * serves the loader, the routes and the browser.
 *
 * Nothing in this module assumes anything about gender or family shape.
 * A person may have any number of parents, partners and children; the
 * graph is a DAG (two parents, remarriage and half-siblings are normal);
 * only genuine cycles in bad data are cut.
 */

import { dateSortKey } from './dates.js';

// ── Config ────────────────────────────────────────────────────────────

export type ParentDirection = 'parent-of' | 'child-of';

export interface LineageParentBinding {
	/** Relation id as declared in the world's ontology. */
	relation: string;
	/** `parent-of`: the source is the parent. `child-of`: the source is the child. */
	direction: ParentDirection;
}

export interface LineageParentOrder {
	/** Entity property (in `meta.properties`) holding the ordering value. */
	property: string;
	/** Property values in slot order; unlisted or missing values sort last. */
	values: string[];
}

export interface LineageConfig {
	parent: LineageParentBinding[];
	partner: string[];
	birth: string[];
	death: string[];
	parentOrder: LineageParentOrder | null;
}

export interface ParsedLineageConfig {
	/** Null when the block is absent or unusable. */
	config: LineageConfig | null;
	/** Human-readable problems, without the file prefix. */
	problems: string[];
}

const KNOWN_KEYS = new Set(['parent', 'partner', 'birth', 'death', 'parentOrder']);

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readRelationList(raw: unknown, key: string, problems: string[]): string[] {
	if (raw === undefined || raw === null) return [];
	const items = Array.isArray(raw) ? raw : [raw];
	const out: string[] = [];
	for (const item of items) {
		if (typeof item === 'string' && item.trim() !== '') out.push(item.trim());
		else problems.push(`lineage.${key} entries must be relation ids (strings)`);
	}
	return [...new Set(out)];
}

/** Parse the `lineage:` value from world.md frontmatter. Pure. */
export function parseLineageConfig(raw: unknown): ParsedLineageConfig {
	if (raw === undefined || raw === null) return { config: null, problems: [] };
	const problems: string[] = [];
	if (!isRecord(raw)) {
		return { config: null, problems: ['lineage must be a mapping'] };
	}
	for (const key of Object.keys(raw)) {
		if (!KNOWN_KEYS.has(key)) problems.push(`lineage.${key} is not a known key`);
	}

	const parent: LineageParentBinding[] = [];
	const rawParent = raw['parent'];
	const parentItems = Array.isArray(rawParent)
		? rawParent
		: rawParent === undefined
			? []
			: [rawParent];
	for (const item of parentItems) {
		if (typeof item === 'string' && item.trim() !== '') {
			parent.push({ relation: item.trim(), direction: 'parent-of' });
		} else if (
			isRecord(item) &&
			typeof item['relation'] === 'string' &&
			item['relation'].trim() !== ''
		) {
			const dir = item['direction'] ?? 'parent-of';
			if (dir !== 'parent-of' && dir !== 'child-of') {
				problems.push(
					`lineage.parent direction must be 'parent-of' or 'child-of', got '${String(dir)}'`
				);
				continue;
			}
			parent.push({ relation: item['relation'].trim(), direction: dir });
		} else {
			problems.push('lineage.parent entries must be a relation id or { relation, direction }');
		}
	}
	if (parent.length === 0) {
		problems.push('lineage.parent is required: bind at least one parent relation');
		return { config: null, problems };
	}

	let parentOrder: LineageParentOrder | null = null;
	const rawOrder = raw['parentOrder'];
	if (rawOrder !== undefined && rawOrder !== null) {
		if (
			isRecord(rawOrder) &&
			typeof rawOrder['property'] === 'string' &&
			rawOrder['property'].trim() !== '' &&
			Array.isArray(rawOrder['values']) &&
			rawOrder['values'].length > 0 &&
			rawOrder['values'].every((v) => typeof v === 'string' || typeof v === 'number')
		) {
			parentOrder = {
				property: rawOrder['property'].trim(),
				values: rawOrder['values'].map((v) => String(v))
			};
		} else {
			problems.push('lineage.parentOrder must be { property: <string>, values: [<value>, …] }');
		}
	}

	return {
		config: {
			parent,
			partner: readRelationList(raw['partner'], 'partner', problems),
			birth: readRelationList(raw['birth'], 'birth', problems),
			death: readRelationList(raw['death'], 'death', problems),
			parentOrder
		},
		problems
	};
}

/** Every relation id the config binds, for validation against the ontology. */
export function lineageRelationIds(config: LineageConfig): string[] {
	return [
		...config.parent.map((p) => p.relation),
		...config.partner,
		...config.birth,
		...config.death
	];
}

// ── Index ─────────────────────────────────────────────────────────────

/** The part of a graph `Edge` that lineage reads. */
export interface LineageEdge {
	from: string;
	to: string;
	kind: string;
	date?: string;
	dateFrom?: string;
	dateTo?: string;
}

/** Per-person facts the host supplies; both are optional. */
export interface LineagePersonInfo {
	/** Worlds often use `rank` as a birth year; used to order when no birth date is known. */
	rank?: number;
	/** Value of the `parentOrder.property` on this person. */
	orderValue?: string;
}

export interface LifeEvent {
	/** ISO date of any precision, or null when unrecorded. */
	date: string | null;
	/** Entity id of the place, or null. */
	place: string | null;
}

export interface Union {
	partner: string;
	/** Start (e.g. marriage), any precision. */
	from: string | null;
	/** End (e.g. divorce), any precision. */
	to: string | null;
}

/** One place in a sibling row. */
export interface SiblingRowMember {
	id: string;
	/** True when neither person's recorded parents contain the other's. */
	half: boolean;
}

export interface LineageIndex {
	/** True when the person appears in any lineage relation. */
	has(id: string): boolean;
	/** Every person that appears in a parent or partner relation. */
	people(): string[];
	/** People with no recorded parent. */
	roots(): string[];
	/** Parents in slot order (see `parentOrder`). */
	parentsOf(id: string): string[];
	/** Children, oldest first. */
	childrenOf(id: string): string[];
	/** Explicitly recorded partners, earliest union first. */
	partnersOf(id: string): Union[];
	/** People sharing at least one parent, oldest first. */
	siblingsOf(id: string): string[];
	/**
	 * The person and their siblings together, oldest first, with half-siblings
	 * flagged. An unrecorded parent is not evidence of a half-sibling, so a
	 * sibling whose parents are a subset of (or contain) the person's is not
	 * flagged.
	 */
	siblingRowOf(id: string): SiblingRowMember[];
	birthOf(id: string): LifeEvent | null;
	deathOf(id: string): LifeEvent | null;
}

function pairKey(a: string, b: string): string {
	return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/** Build the lineage index. Pure; call again after the graph reloads. */
export function buildLineageIndex(
	edges: Iterable<LineageEdge>,
	config: LineageConfig,
	info: (id: string) => LineagePersonInfo | undefined = () => undefined
): LineageIndex {
	const parentBinding = new Map<string, { direction: ParentDirection; order: number }>();
	config.parent.forEach((p, i) =>
		parentBinding.set(p.relation, { direction: p.direction, order: i })
	);
	const partnerKinds = new Set(config.partner);
	const birthKinds = new Set(config.birth);
	const deathKinds = new Set(config.death);

	/** child → (parent → relation order) */
	const parentRel = new Map<string, Map<string, number>>();
	const childrenRaw = new Map<string, Set<string>>();
	const partnerPairs = new Map<
		string,
		{ a: string; b: string; from: string | null; to: string | null }
	>();
	const births = new Map<string, LifeEvent>();
	const deaths = new Map<string, LifeEvent>();
	const seen = new Set<string>();

	for (const e of edges) {
		const pb = parentBinding.get(e.kind);
		if (pb) {
			const parent = pb.direction === 'parent-of' ? e.from : e.to;
			const child = pb.direction === 'parent-of' ? e.to : e.from;
			if (parent === child) continue;
			let rels = parentRel.get(child);
			if (!rels) parentRel.set(child, (rels = new Map()));
			rels.set(parent, Math.min(rels.get(parent) ?? Infinity, pb.order));
			let kids = childrenRaw.get(parent);
			if (!kids) childrenRaw.set(parent, (kids = new Set()));
			kids.add(child);
			seen.add(parent);
			seen.add(child);
		} else if (partnerKinds.has(e.kind)) {
			if (e.from === e.to) continue;
			const key = pairKey(e.from, e.to);
			const prev = partnerPairs.get(key);
			const from = e.dateFrom ?? e.date ?? null;
			const to = e.dateTo ?? null;
			if (prev) {
				prev.from = prev.from ?? from;
				prev.to = prev.to ?? to;
			} else {
				partnerPairs.set(key, { a: e.from, b: e.to, from, to });
			}
			seen.add(e.from);
			seen.add(e.to);
		} else if (birthKinds.has(e.kind)) {
			if (!births.has(e.from)) births.set(e.from, { date: e.date ?? null, place: e.to });
		} else if (deathKinds.has(e.kind)) {
			if (!deaths.has(e.from)) deaths.set(e.from, { date: e.date ?? null, place: e.to });
		}
	}

	const order = config.parentOrder;
	const slot = (id: string): number => {
		if (!order) return 0;
		const v = info(id)?.orderValue;
		const i = v === undefined ? -1 : order.values.indexOf(v);
		return i === -1 ? Infinity : i;
	};

	/** Sortable birth moment: the birth date, else `rank` read as a year. */
	const birthKey = (id: string): number => {
		const d = births.get(id)?.date;
		const k = d ? dateSortKey(d) : null;
		if (k !== null) return k;
		const rank = info(id)?.rank;
		return typeof rank === 'number' ? rank * 10000 : Infinity;
	};
	const byBirth = (a: string, b: string): number => {
		const d = birthKey(a) - birthKey(b);
		if (d !== 0 && !Number.isNaN(d)) return d;
		return a < b ? -1 : a > b ? 1 : 0;
	};

	const parents = new Map<string, string[]>();
	for (const [child, rels] of parentRel) {
		const list = [...rels.keys()];
		list.sort((a, b) => {
			const s = slot(a) - slot(b);
			if (s !== 0 && !Number.isNaN(s)) return s;
			const r = (rels.get(a) ?? 0) - (rels.get(b) ?? 0);
			if (r !== 0) return r;
			return byBirth(a, b);
		});
		parents.set(child, list);
	}

	const children = new Map<string, string[]>();
	for (const [parent, kids] of childrenRaw) children.set(parent, [...kids].sort(byBirth));

	const partners = new Map<string, Union[]>();
	const pushPartner = (id: string, u: Union) => {
		const list = partners.get(id);
		if (list) list.push(u);
		else partners.set(id, [u]);
	};
	for (const p of partnerPairs.values()) {
		pushPartner(p.a, { partner: p.b, from: p.from, to: p.to });
		pushPartner(p.b, { partner: p.a, from: p.from, to: p.to });
	}
	const unionKey = (u: Union): number => (u.from ? (dateSortKey(u.from) ?? Infinity) : Infinity);
	for (const list of partners.values()) {
		list.sort((x, y) => {
			const d = unionKey(x) - unionKey(y);
			if (d !== 0 && !Number.isNaN(d)) return d;
			return x.partner < y.partner ? -1 : x.partner > y.partner ? 1 : 0;
		});
	}

	return {
		has: (id) => seen.has(id),
		people: () => [...seen],
		roots: () => [...seen].filter((id) => !parents.has(id)).sort(byBirth),
		parentsOf: (id) => parents.get(id) ?? [],
		childrenOf: (id) => children.get(id) ?? [],
		partnersOf: (id) => partners.get(id) ?? [],
		siblingsOf: (id) => {
			const sibs = new Set<string>();
			for (const p of parents.get(id) ?? []) {
				for (const c of children.get(p) ?? []) if (c !== id) sibs.add(c);
			}
			return [...sibs].sort(byBirth);
		},
		siblingRowOf: (id) => {
			const mine = new Set(parents.get(id) ?? []);
			const sibs = new Set<string>();
			for (const p of mine) for (const c of children.get(p) ?? []) if (c !== id) sibs.add(c);
			const isSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
				[...a].every((x) => b.has(x));
			return [id, ...sibs].sort(byBirth).map((sib) => {
				if (sib === id) return { id, half: false };
				const theirs = new Set(parents.get(sib) ?? []);
				return { id: sib, half: !isSubset(mine, theirs) && !isSubset(theirs, mine) };
			});
		},
		birthOf: (id) => births.get(id) ?? null,
		deathOf: (id) => deaths.get(id) ?? null
	};
}

// ── Trees ─────────────────────────────────────────────────────────────

export interface AncestorNode {
	id: string;
	/** Parents in slot order. Empty at the depth limit or for a root. */
	parents: AncestorNode[];
	/** True when the depth limit cut off known parents. */
	truncated: boolean;
}

export interface DescendantUnion {
	/** Null for children whose other parent is unrecorded. */
	partner: string | null;
	from: string | null;
	to: string | null;
	/** True when the partner is only known as co-parent, not as a recorded partner. */
	implicit: boolean;
	children: DescendantNode[];
}

export interface DescendantNode {
	id: string;
	unions: DescendantUnion[];
	/** True when the depth limit cut off known children. */
	truncated: boolean;
}

/** Ancestors of `id` up to `depth` generations (0 = just the person). */
export function ancestorTree(index: LineageIndex, id: string, depth: number): AncestorNode {
	const walk = (cur: string, left: number, path: ReadonlySet<string>): AncestorNode => {
		const ps = index.parentsOf(cur).filter((p) => !path.has(p));
		if (left <= 0) return { id: cur, parents: [], truncated: ps.length > 0 };
		const next = new Set(path).add(cur);
		return { id: cur, parents: ps.map((p) => walk(p, left - 1, next)), truncated: false };
	};
	return walk(id, depth, new Set());
}

/** Descendants of `id` up to `depth` generations, grouped by the other parent. */
export function descendantTree(index: LineageIndex, id: string, depth: number): DescendantNode {
	const walk = (cur: string, left: number, path: ReadonlySet<string>): DescendantNode => {
		const kids = index.childrenOf(cur).filter((c) => !path.has(c));
		const explicit = index.partnersOf(cur);
		if (left <= 0) {
			return { id: cur, unions: [], truncated: kids.length > 0 };
		}
		const next = new Set(path).add(cur);

		const unions = new Map<string | null, DescendantUnion>();
		for (const u of explicit) {
			unions.set(u.partner, {
				partner: u.partner,
				from: u.from,
				to: u.to,
				implicit: false,
				children: []
			});
		}
		for (const kid of kids) {
			const other = index.parentsOf(kid).find((p) => p !== cur) ?? null;
			let union = unions.get(other);
			if (!union) {
				union = { partner: other, from: null, to: null, implicit: other !== null, children: [] };
				unions.set(other, union);
			}
			union.children.push(walk(kid, left - 1, next));
		}

		// Recorded partners first (by union date, as indexed), then co-parents,
		// then children with no recorded other parent.
		const rank = (u: DescendantUnion) => (u.partner === null ? 2 : u.implicit ? 1 : 0);
		const ordered = [...unions.values()];
		const position = new Map(ordered.map((u, i) => [u, i]));
		ordered.sort((a, b) => rank(a) - rank(b) || position.get(a)! - position.get(b)!);
		return { id: cur, unions: ordered, truncated: false };
	};
	return walk(id, depth, new Set());
}

/** Count distinct people in an ancestor tree, excluding the root. */
export function countAncestors(tree: AncestorNode): number {
	const ids = new Set<string>();
	const visit = (n: AncestorNode) => {
		for (const p of n.parents) {
			ids.add(p.id);
			visit(p);
		}
	};
	visit(tree);
	ids.delete(tree.id);
	return ids.size;
}

/** Count distinct people in a descendant tree, excluding the root. */
export function countDescendants(tree: DescendantNode): number {
	const ids = new Set<string>();
	const visit = (n: DescendantNode) => {
		for (const u of n.unions) {
			for (const c of u.children) {
				ids.add(c.id);
				visit(c);
			}
		}
	};
	visit(tree);
	ids.delete(tree.id);
	return ids.size;
}

/** Generations above the root in an ancestor tree (0 = no parents). */
export function ancestorDepth(tree: AncestorNode): number {
	return tree.parents.length === 0 ? 0 : 1 + Math.max(...tree.parents.map(ancestorDepth));
}

/** Generations below the root in a descendant tree (0 = no children). */
export function descendantDepth(tree: DescendantNode): number {
	let deepest = 0;
	for (const u of tree.unions) {
		for (const c of u.children) deepest = Math.max(deepest, 1 + descendantDepth(c));
	}
	return deepest;
}
