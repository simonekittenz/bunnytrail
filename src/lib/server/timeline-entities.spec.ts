import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEdges, loadAll } from './loader';

const savedKindsDir = process.env.BUNNYTRAIL_KINDS_DIR;
afterEach(() => {
	if (savedKindsDir === undefined) delete process.env.BUNNYTRAIL_KINDS_DIR;
	else process.env.BUNNYTRAIL_KINDS_DIR = savedKindsDir;
});

/** Kinds `event`, `period`, `place`; `happened-on` takes an event onto a place. */
async function seed(opts: {
	dots: Record<string, string>;
	entities?: Record<string, string>;
}): Promise<string> {
	const base = await mkdtemp(join(tmpdir(), 'bt-dotent-'));
	const contentDir = join(base, 'content');
	const kindsDir = join(base, 'kinds');

	const t = join(kindsDir, 'temporal');
	await mkdir(t, { recursive: true });
	await writeFile(
		join(t, '_ontology.yaml'),
		[
			'title: Temporal',
			'relations:',
			'  happened-on:',
			'    outLabel: Happened on',
			'    inLabel: Events',
			'    domain: [event]',
			'    codomain: [place]',
			'  occurred-in:',
			'    outLabel: In',
			'    inLabel: Events',
			'    domain: [event]',
			'    codomain: [period]'
		].join('\n')
	);
	for (const k of ['event', 'period', 'place']) {
		await mkdir(join(t, k), { recursive: true });
		await writeFile(join(t, k, '_kind.yaml'), `singular: ${k}\nplural: ${k}s\n`);
	}

	const line = join(contentDir, 'world', 'ages');
	await mkdir(line, { recursive: true });
	await writeFile(join(line, '_time.md'), '---\ntype: line\nrankDisplay: roman\n---\n');
	for (const [folder, yaml] of Object.entries(opts.dots)) {
		await mkdir(join(line, folder), { recursive: true });
		await writeFile(join(line, folder, '_time.md'), `---\n${yaml}\n---\n\nBody of ${folder}.\n`);
	}
	for (const [id, yaml] of Object.entries(opts.entities ?? {})) {
		const dir = join(contentDir, id);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, 'index.yaml'), yaml);
		await writeFile(join(dir, 'index.md'), '');
	}
	process.env.BUNNYTRAIL_KINDS_DIR = kindsDir;
	return contentDir;
}

describe('timeline dots that are entities', () => {
	it('registers a dot with a kind as an entity, and leaves a plain dot alone', async () => {
		const root = await seed({
			dots: {
				'the-drowning': [
					'type: dot',
					'rank: 2',
					'kind: event',
					'name: The Drowning',
					'summary: It sank.',
					'tags: [deep-time]',
					'era: mythic'
				].join('\n'),
				'plain-age': 'type: dot\nrank: 1\nname: Plain'
			}
		});
		const { entities, timelines, issues } = await loadAll(root);

		const e = entities.get('world/ages/the-drowning')!;
		expect(e).toBeDefined();
		expect(e.type).toBe('world/ages');
		expect(e.slug).toBe('the-drowning');
		expect(e.meta).toMatchObject({
			name: 'The Drowning',
			kind: 'event',
			kinds: ['event'],
			rank: 2,
			era: ['mythic']
		});
		expect(e.body).toContain('Body of the-drowning');
		// Timeline-only keys never leak into the entity.
		expect(Object.keys(e.meta)).not.toContain('type');
		expect(issues.filter((i) => i.kind === 'unknown-entity-field')).toEqual([]);

		expect(entities.has('world/ages/plain-age')).toBe(false);
		// The dot is still a timeline entry too.
		expect(timelines.get('world/ages')!.entries.map((x) => x.path)).toContain(
			'world/ages/the-drowning'
		);
	});

	it('gives the dot relations that become edges and obey the relation schema', async () => {
		const root = await seed({
			dots: {
				'age-of-kush': 'type: dot\nrank: 1\nkind: period\nname: Age of Kush',
				'the-drowning': [
					'type: dot',
					'rank: 2',
					'kind: event',
					'name: The Drowning',
					'relations:',
					'  - kind: temporal/happened-on',
					'    target: world/bayurinda',
					'  - kind: temporal/occurred-in',
					'    target: world/ages/age-of-kush'
				].join('\n')
			},
			entities: { 'world/bayurinda': 'name: Bayurinda\nkind: place' }
		});
		const { entities, timelines, issues, clusters, universalFolders } = await loadAll(root);
		expect(
			issues.filter((i) => i.kind === 'broken-link' || i.detail.includes('does not satisfy'))
		).toEqual([]);

		const edges = buildEdges(entities, timelines, clusters, universalFolders);
		const into = (id: string) => (edges.in.get(id) ?? []).map((e) => `${e.from} ${e.kind}`);
		expect(into('world/bayurinda')).toContain('world/ages/the-drowning temporal/happened-on');
		expect(into('world/ages/age-of-kush')).toContain(
			'world/ages/the-drowning temporal/occurred-in'
		);
	});

	it('checks a dot against the relation schema like any entity', async () => {
		const root = await seed({
			dots: {
				'odd-age': [
					'type: dot',
					'rank: 1',
					'kind: period',
					'relations:',
					'  - kind: temporal/happened-on',
					'    target: world/bayurinda'
				].join('\n')
			},
			entities: { 'world/bayurinda': 'name: Bayurinda\nkind: place' }
		});
		const { issues } = await loadAll(root);
		expect(
			issues.some(
				(i) => i.entity === 'world/ages/odd-age' && i.detail.includes('does not satisfy domain')
			)
		).toBe(true);
	});

	it('resolves wikilinks to the dot by slug, with a single edge when the dot links out', async () => {
		const root = await seed({
			dots: {
				'the-drowning': 'type: dot\nrank: 1\nkind: event\nname: The Drowning',
				'age-of-wunwe': 'type: dot\nrank: 2\nkind: period\nname: Age of Wunwe'
			},
			entities: { 'world/bayurinda': 'name: Bayurinda\nkind: place' }
		});
		// Another entity and the dot itself link by wikilink.
		await writeFile(
			join(root, 'world', 'bayurinda', 'index.md'),
			'Remember [[the-drowning|The Drowning]].\n'
		);
		await writeFile(
			join(root, 'world', 'ages', 'age-of-wunwe', '_time.md'),
			'---\ntype: dot\nrank: 2\nkind: period\nname: Age of Wunwe\n---\n\nAfter [[world/bayurinda|Bayurinda]].\n'
		);
		const { entities, timelines, issues, clusters, universalFolders } = await loadAll(root);
		expect(issues.filter((i) => i.kind === 'broken-link')).toEqual([]);

		const edges = buildEdges(entities, timelines, clusters, universalFolders);
		expect((edges.in.get('world/ages/the-drowning') ?? []).map((e) => e.from)).toEqual([
			'world/bayurinda'
		]);
		const fromDot = (edges.out.get('world/ages/age-of-wunwe') ?? []).filter(
			(e) => e.to === 'world/bayurinda'
		);
		expect(fromDot).toHaveLength(1);
	});

	it('reports a dot whose path is already an entity and keeps the entity', async () => {
		const root = await seed({ dots: {} });
		// An entity folder and a timeline dot at the same path.
		const dir = join(root, 'world', 'ages', 'clash');
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, 'index.yaml'), 'name: The Entity\nkind: place');
		await writeFile(join(dir, 'index.md'), '');
		await writeFile(
			join(dir, '_time.md'),
			'---\ntype: dot\nrank: 1\nkind: event\nname: The Dot\n---\n'
		);

		const { entities, issues } = await loadAll(root);
		expect(entities.get('world/ages/clash')!.meta.name).toBe('The Entity');
		expect(
			issues.some((i) => i.entity === 'world/ages/clash' && i.detail.includes('already an entity'))
		).toBe(true);
	});
});
