import { describe, it, expect } from 'vitest';
import {
	parseLineageConfig,
	buildLineageIndex,
	ancestorTree,
	descendantTree,
	countAncestors,
	countDescendants,
	lineageRelationIds,
	type LineageConfig,
	type LineageEdge,
	type LineagePersonInfo
} from './lineage.js';

const config: LineageConfig = {
	parent: [
		{ relation: 'fam/father-of', direction: 'parent-of' },
		{ relation: 'fam/mother-of', direction: 'parent-of' }
	],
	partner: ['fam/married-to'],
	birth: ['fam/born-in'],
	death: ['fam/died-in'],
	parentOrder: null
};

const e = (
	from: string,
	kind: string,
	to: string,
	extra: Partial<LineageEdge> = {}
): LineageEdge => ({
	from,
	to,
	kind: `fam/${kind}`,
	...extra
});

/**
 *  adam ─ eve (m. 1900)         adam ─ lilith (m. 1910, no children of their own recorded)
 *   ├ cain (b. 1901)
 *   └ abel (b. 1903)
 *  eve is also parent of seth (b. 1920) with "unknown" father (not recorded)
 *  cain ─ awan: enoch (b. 1925)
 */
const edges: LineageEdge[] = [
	e('adam', 'father-of', 'cain'),
	e('adam', 'father-of', 'abel'),
	e('eve', 'mother-of', 'cain'),
	e('eve', 'mother-of', 'abel'),
	e('eve', 'mother-of', 'seth'),
	e('cain', 'father-of', 'enoch'),
	e('awan', 'mother-of', 'enoch'),
	e('adam', 'married-to', 'eve', { dateFrom: '1900' }),
	e('lilith', 'married-to', 'adam', { dateFrom: '1910-05' }),
	e('cain', 'born-in', 'places/eden', { date: '1901-03-02' }),
	e('abel', 'born-in', 'places/eden', { date: '1903' }),
	e('seth', 'born-in', 'places/nod', { date: '1920-01-01' }),
	e('enoch', 'born-in', 'places/nod', { date: '1925-06-06' }),
	e('abel', 'died-in', 'places/field', { date: '1920' }),
	e('adam', 'knows', 'eve') // unbound relation, ignored
];

const index = buildLineageIndex(edges, config);

describe('parseLineageConfig', () => {
	it('returns null and no problems when the block is absent', () => {
		expect(parseLineageConfig(undefined)).toEqual({ config: null, problems: [] });
	});

	it('accepts strings, lists and { relation, direction } objects', () => {
		const { config: c, problems } = parseLineageConfig({
			parent: ['a/x', { relation: 'a/y', direction: 'child-of' }],
			partner: 'a/p',
			birth: ['a/b'],
			parentOrder: { property: 'gender', values: ['male', 'female'] }
		});
		expect(problems).toEqual([]);
		expect(c).toEqual({
			parent: [
				{ relation: 'a/x', direction: 'parent-of' },
				{ relation: 'a/y', direction: 'child-of' }
			],
			partner: ['a/p'],
			birth: ['a/b'],
			death: [],
			parentOrder: { property: 'gender', values: ['male', 'female'] }
		});
		expect(lineageRelationIds(c!)).toEqual(['a/x', 'a/y', 'a/p', 'a/b']);
	});

	it('requires a parent binding', () => {
		const r = parseLineageConfig({ partner: 'a/p' });
		expect(r.config).toBeNull();
		expect(r.problems.join()).toMatch(/parent is required/);
	});

	it('reports unknown keys, bad directions and bad parentOrder', () => {
		const r = parseLineageConfig({
			parent: [{ relation: 'a/x', direction: 'sideways' }, 'a/ok'],
			wat: 1,
			parentOrder: { property: 'g' }
		});
		expect(r.config?.parent).toEqual([{ relation: 'a/ok', direction: 'parent-of' }]);
		expect(r.problems.join('\n')).toMatch(/not a known key/);
		expect(r.problems.join('\n')).toMatch(/direction/);
		expect(r.problems.join('\n')).toMatch(/parentOrder/);
		expect(r.config?.parentOrder).toBeNull();
	});

	it('rejects a non-mapping block', () => {
		expect(parseLineageConfig(['x']).config).toBeNull();
	});
});

describe('buildLineageIndex', () => {
	it('derives parents, children and siblings from one-sided edges', () => {
		expect(index.parentsOf('cain')).toEqual(['adam', 'eve']);
		expect(index.childrenOf('adam')).toEqual(['cain', 'abel']);
		// Seth is a half-sibling through the shared mother; oldest first.
		expect(index.siblingsOf('cain')).toEqual(['abel', 'seth']);
		expect(index.siblingsOf('abel')).toEqual(['cain', 'seth']);
		expect(index.siblingsOf('seth')).toEqual(['cain', 'abel']);
		expect(index.siblingsOf('enoch')).toEqual([]);
	});

	it('puts the person among their siblings in birth order', () => {
		expect(index.siblingRowOf('abel')).toEqual([
			{ id: 'cain', half: false },
			{ id: 'abel', half: false },
			{ id: 'seth', half: false }
		]);
		expect(index.siblingRowOf('enoch')).toEqual([{ id: 'enoch', half: false }]);
	});

	it('flags half-siblings only when both sides have a parent the other lacks', () => {
		const idx = buildLineageIndex(
			[
				e('adam', 'father-of', 'cain'),
				e('eve', 'mother-of', 'cain'),
				e('adam', 'father-of', 'half'),
				e('lilith', 'mother-of', 'half'),
				e('adam', 'father-of', 'unsure'),
				e('cain', 'born-in', 'p', { date: '1900' }),
				e('half', 'born-in', 'p', { date: '1901' }),
				e('unsure', 'born-in', 'p', { date: '1902' })
			],
			config
		);
		expect(idx.siblingRowOf('cain')).toEqual([
			{ id: 'cain', half: false },
			{ id: 'half', half: true },
			{ id: 'unsure', half: false }
		]);
	});

	it('ignores relations that are not bound', () => {
		expect(index.has('adam')).toBe(true);
		expect(index.has('nobody')).toBe(false);
		expect(index.people().sort()).toEqual(
			['abel', 'adam', 'awan', 'cain', 'enoch', 'eve', 'lilith', 'seth'].sort()
		);
	});

	it('lists roots', () => {
		expect(index.roots().sort()).toEqual(['adam', 'awan', 'eve', 'lilith']);
	});

	it('merges partners from either side and orders unions by start date', () => {
		expect(index.partnersOf('adam')).toEqual([
			{ partner: 'eve', from: '1900', to: null },
			{ partner: 'lilith', from: '1910-05', to: null }
		]);
		expect(index.partnersOf('eve')).toEqual([{ partner: 'adam', from: '1900', to: null }]);
	});

	it('reads birth and death from the bound relations', () => {
		expect(index.birthOf('cain')).toEqual({ date: '1901-03-02', place: 'places/eden' });
		expect(index.birthOf('abel')).toEqual({ date: '1903', place: 'places/eden' });
		expect(index.deathOf('abel')).toEqual({ date: '1920', place: 'places/field' });
		expect(index.birthOf('adam')).toBeNull();
	});

	it('orders by birth date, then rank as a year, then id', () => {
		const info = (id: string): LineagePersonInfo | undefined =>
			id === 'x' ? { rank: 1950 } : id === 'y' ? { rank: 1940 } : undefined;
		const idx = buildLineageIndex(
			[
				e('p', 'father-of', 'x'),
				e('p', 'father-of', 'y'),
				e('p', 'father-of', 'z'),
				e('p', 'father-of', 'w')
			],
			config,
			info
		);
		expect(idx.childrenOf('p')).toEqual(['y', 'x', 'w', 'z']);
	});

	it('treats child-of bindings as reversed edges', () => {
		const idx = buildLineageIndex([{ from: 'kid', to: 'mum', kind: 'fam/child-of' }], {
			...config,
			parent: [{ relation: 'fam/child-of', direction: 'child-of' }]
		});
		expect(idx.parentsOf('kid')).toEqual(['mum']);
		expect(idx.childrenOf('mum')).toEqual(['kid']);
	});

	it('orders parents by relation order when no parentOrder is set', () => {
		const idx = buildLineageIndex([e('mum', 'mother-of', 'k'), e('dad', 'father-of', 'k')], config);
		expect(idx.parentsOf('k')).toEqual(['dad', 'mum']);
	});

	it('orders parents by a property when parentOrder is set', () => {
		const info = (id: string): LineagePersonInfo | undefined =>
			({ a: { orderValue: 'female' }, b: { orderValue: 'male' }, c: {} })[id];
		const idx = buildLineageIndex(
			[e('a', 'father-of', 'k'), e('b', 'mother-of', 'k'), e('c', 'mother-of', 'k')],
			{ ...config, parentOrder: { property: 'gender', values: ['male', 'female'] } },
			info
		);
		// male, then female, then unknown last — relation names are irrelevant.
		expect(idx.parentsOf('k')).toEqual(['b', 'a', 'c']);
	});

	it('ignores self-parenting and keeps working on a cycle', () => {
		const idx = buildLineageIndex(
			[e('a', 'father-of', 'a'), e('a', 'father-of', 'b'), e('b', 'father-of', 'a')],
			config
		);
		expect(idx.parentsOf('a')).toEqual(['b']);
		expect(ancestorTree(idx, 'a', 10).parents[0]!.parents).toEqual([]);
		expect(descendantTree(idx, 'a', 10).unions[0]!.children[0]!.unions).toEqual([]);
	});
});

describe('ancestorTree', () => {
	it('walks parents to the requested depth', () => {
		const t = ancestorTree(index, 'enoch', 3);
		expect(t.parents.map((p) => p.id)).toEqual(['cain', 'awan']);
		expect(t.parents[0]!.parents.map((p) => p.id)).toEqual(['adam', 'eve']);
		expect(countAncestors(t)).toBe(4);
	});

	it('marks a cut-off line as truncated', () => {
		const t = ancestorTree(index, 'enoch', 1);
		expect(t.parents.map((p) => p.id)).toEqual(['cain', 'awan']);
		expect(t.parents[0]!.truncated).toBe(true);
		expect(t.parents[1]!.truncated).toBe(false);
	});

	it('supports a person with only one known parent', () => {
		const t = ancestorTree(index, 'seth', 2);
		expect(t.parents.map((p) => p.id)).toEqual(['eve']);
	});
});

describe('descendantTree', () => {
	it('groups children by the other parent', () => {
		const t = descendantTree(index, 'adam', 3);
		expect(t.unions.map((u) => [u.partner, u.implicit])).toEqual([
			['eve', false],
			['lilith', false]
		]);
		expect(t.unions[0]!.children.map((c) => c.id)).toEqual(['cain', 'abel']);
		expect(t.unions[0]!.from).toBe('1900');
		expect(t.unions[1]!.children).toEqual([]);
		expect(countDescendants(t)).toBe(3);
	});

	it('puts children of an unrecorded other parent under a null partner', () => {
		const t = descendantTree(index, 'eve', 2);
		expect(t.unions.map((u) => u.partner)).toEqual(['adam', null]);
		expect(t.unions[1]!.children.map((c) => c.id)).toEqual(['seth']);
	});

	it('adds co-parents who are not recorded partners as implicit unions', () => {
		const t = descendantTree(index, 'cain', 2);
		expect(t.unions).toHaveLength(1);
		expect(t.unions[0]).toMatchObject({ partner: 'awan', implicit: true, from: null });
		expect(t.unions[0]!.children.map((c) => c.id)).toEqual(['enoch']);
	});

	it('marks a depth cut-off as truncated', () => {
		const t = descendantTree(index, 'adam', 1);
		const cain = t.unions[0]!.children[0]!;
		expect(cain.id).toBe('cain');
		expect(cain.truncated).toBe(true);
		expect(cain.unions).toEqual([]);
	});
});
