import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { kindsOf } from '#lib/types.js';
import { loadAll } from './loader';

const savedKindsDir = process.env.BUNNYTRAIL_KINDS_DIR;
afterEach(() => {
	if (savedKindsDir === undefined) delete process.env.BUNNYTRAIL_KINDS_DIR;
	else process.env.BUNNYTRAIL_KINDS_DIR = savedKindsDir;
});

/**
 * Kinds: `place` > `city`, `place` > `temple-complex`, plus `person`.
 * Relations: `geo/governed-by` needs a `city` source; `geo/hosts-rite`
 * needs a `temple-complex` source; `geo/visited-by` needs a `city` target.
 */
async function seed(entities: Record<string, string>) {
	const base = await mkdtemp(join(tmpdir(), 'bt-multikind-'));
	const contentDir = join(base, 'content');
	const kindsDir = join(base, 'kinds');

	const geo = join(kindsDir, 'geo');
	await mkdir(geo, { recursive: true });
	await writeFile(
		join(geo, '_ontology.yaml'),
		[
			'title: Geo',
			'relations:',
			'  governed-by:',
			'    outLabel: Governed by',
			'    inLabel: Governs',
			'    domain: [city]',
			'  hosts-rite:',
			'    outLabel: Hosts rite',
			'    inLabel: Hosted at',
			'    domain: [temple-complex]',
			'  visited-by:',
			'    outLabel: Visited by',
			'    inLabel: Visits',
			'    codomain: [city]'
		].join('\n')
	);
	for (const k of ['place', 'place/city', 'place/temple-complex', 'person']) {
		const dir = join(geo, k);
		await mkdir(dir, { recursive: true });
		const id = k.split('/').pop()!;
		await writeFile(join(dir, '_kind.yaml'), `singular: ${id}\nplural: ${id}s\n`);
	}

	for (const [id, yaml] of Object.entries(entities)) {
		const dir = join(contentDir, id);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, 'index.yaml'), yaml);
		await writeFile(join(dir, 'index.md'), '');
	}
	process.env.BUNNYTRAIL_KINDS_DIR = kindsDir;
	return contentDir;
}

describe('kindsOf', () => {
	it('prefers the normalised list, falls back to kind, and is empty for neither', () => {
		expect(kindsOf({ kind: 'city', kinds: ['city', 'temple-complex'] })).toEqual([
			'city',
			'temple-complex'
		]);
		expect(kindsOf({ kind: 'city' })).toEqual(['city']);
		expect(kindsOf({})).toEqual([]);
	});
});

describe('multi-kinded entities', () => {
	it('normalises `kind: [a, b]` to a primary kind plus the full list', async () => {
		const root = await seed({
			'geo/karat': 'name: Karat\nkind: [temple-complex, city, temple-complex]',
			'geo/plain': 'name: Plain\nkind: city'
		});
		const { entities, issues } = await loadAll(root);

		const karat = entities.get('geo/karat')!;
		expect(karat.meta.kind).toBe('temple-complex');
		expect(karat.meta.kinds).toEqual(['temple-complex', 'city']);
		expect(entities.get('geo/plain')!.meta.kinds).toEqual(['city']);
		expect(issues.filter((i) => i.kind === 'unknown-entity-field')).toEqual([]);
	});

	it('accepts relations whose domain is satisfied by any of the source kinds', async () => {
		const root = await seed({
			'geo/rite': 'name: Rite\nkind: person',
			'geo/karat': [
				'name: Karat',
				'kind: [temple-complex, city]',
				'relations:',
				'  - kind: geo/governed-by',
				'    target: geo/rite',
				'  - kind: geo/hosts-rite',
				'    target: geo/rite'
			].join('\n')
		});
		const { issues } = await loadAll(root);
		expect(issues.filter((i) => i.detail.includes('domain'))).toEqual([]);
	});

	it('still flags a relation no kind of the source satisfies', async () => {
		const root = await seed({
			'geo/rite': 'name: Rite\nkind: person',
			'geo/shrine': [
				'name: Shrine',
				'kind: temple-complex',
				'relations:',
				'  - kind: geo/governed-by',
				'    target: geo/rite'
			].join('\n')
		});
		const { issues } = await loadAll(root);
		const flagged = issues.filter((i) => i.detail.includes('does not satisfy domain'));
		expect(flagged).toHaveLength(1);
		expect(flagged[0]).toMatchObject({ entity: 'geo/shrine' });
	});

	it('satisfies a codomain through any of the target kinds', async () => {
		const root = await seed({
			'geo/karat': 'name: Karat\nkind: [temple-complex, city]',
			'geo/fort': 'name: Fort\nkind: temple-complex',
			'geo/pilgrim': [
				'name: Pilgrim',
				'kind: person',
				'relations:',
				'  - kind: geo/visited-by',
				'    target: geo/karat',
				'  - kind: geo/visited-by',
				'    target: geo/fort'
			].join('\n')
		});
		const { issues } = await loadAll(root);
		const flagged = issues.filter((i) => i.detail.includes('does not satisfy codomain'));
		expect(flagged).toHaveLength(1);
		expect(flagged[0]!.detail).toContain('geo/fort');
	});

	it('reports each unregistered kind in the list', async () => {
		const root = await seed({ 'geo/odd': 'name: Odd\nkind: [city, ghost-town]' });
		const { issues } = await loadAll(root);
		const unregistered = issues.filter((i) => i.detail.includes('is not registered'));
		expect(unregistered).toHaveLength(1);
		expect(unregistered[0]!.detail).toContain("'ghost-town'");
	});

	it('reports non-string entries in the list', async () => {
		const root = await seed({ 'geo/odd': 'name: Odd\nkind: [city, 7]' });
		const { entities, issues } = await loadAll(root);
		expect(entities.get('geo/odd')!.meta.kinds).toEqual(['city']);
		expect(issues.some((i) => i.detail.includes('kind list contains non-string'))).toBe(true);
	});
});
