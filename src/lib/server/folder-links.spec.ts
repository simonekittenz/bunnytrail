import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAll } from './loader';
import { collectFolderPaths, resolveWikilink } from './wikilinks';

const savedKindsDir = process.env.BUNNYTRAIL_KINDS_DIR;
afterEach(() => {
	if (savedKindsDir === undefined) delete process.env.BUNNYTRAIL_KINDS_DIR;
	else process.env.BUNNYTRAIL_KINDS_DIR = savedKindsDir;
});

describe('collectFolderPaths', () => {
	it('includes every ancestor of an entity, collections, and timelines', () => {
		const folders = collectFolderPaths(['a/b/c/thing'], ['a/shelf'], ['a/history/line']);
		expect([...folders.keys()].sort()).toEqual([
			'a',
			'a/b',
			'a/b/c',
			'a/history',
			'a/history/line',
			'a/shelf'
		]);
		// The entity itself is not a folder.
		expect(folders.has('a/b/c/thing')).toBe(false);
	});
});

describe('resolving wikilinks against folders', () => {
	const folders = collectFolderPaths(
		['aurethia/people/groups/elves/elfric', 'foundation/mundus/geometry/harmonia'],
		['foundation/mundus']
	);
	const clusters = new Set(['aurethia']);
	const universal = new Set(['foundation']);

	it('resolves a full path', () => {
		expect(resolveWikilink('foundation/mundus', folders, 'aurethia', clusters, universal)).toEqual({
			id: 'foundation/mundus'
		});
	});

	it('resolves cluster-locally, and falls back to a universal folder by bare slug', () => {
		expect(resolveWikilink('people/groups', folders, 'aurethia', clusters, universal)).toEqual({
			id: 'aurethia/people/groups'
		});
		expect(resolveWikilink('mundus', folders, 'aurethia', clusters, universal)).toEqual({
			id: 'foundation/mundus'
		});
	});
});

describe('wikilinks to folders in a loaded world', () => {
	async function seed(): Promise<string> {
		const base = await mkdtemp(join(tmpdir(), 'bt-folderlinks-'));
		const contentDir = join(base, 'content');
		const kindsDir = join(base, 'kinds');
		await mkdir(join(kindsDir, 'thing'), { recursive: true });
		await writeFile(join(kindsDir, 'thing', '_kind.yaml'), 'singular: thing\nplural: things\n');

		const entity = async (id: string, body: string) => {
			const dir = join(contentDir, id);
			await mkdir(dir, { recursive: true });
			await writeFile(join(dir, 'index.yaml'), `name: ${id.split('/').pop()}\nkind: thing\n`);
			await writeFile(join(dir, 'index.md'), body);
		};
		await entity(
			'world/notes/reader',
			[
				'Shelf with a collection: [[world/library|Library]].',
				'Implicit shelf: [[world/notes|Notes]].',
				'Cluster-local: [[library|Library again]].',
				'Timeline: [[world/history/ages|Ages]].',
				'Entity: [[world/library/book|Book]].',
				'Nowhere: [[world/no-such-shelf|Nowhere]].'
			].join('\n\n')
		);
		await entity('world/library/book', 'A book.');
		await writeFile(
			join(contentDir, 'world', 'library', '_collection.md'),
			'---\ntitle: Library\n---\n'
		);
		await mkdir(join(contentDir, 'world', 'history', 'ages'), { recursive: true });
		await writeFile(
			join(contentDir, 'world', 'history', 'ages', '_time.md'),
			'---\ntype: line\n---\n'
		);
		process.env.BUNNYTRAIL_KINDS_DIR = kindsDir;
		return contentDir;
	}

	it('accepts links to collections, implicit shelves and timelines; still flags a missing one', async () => {
		const { issues } = await loadAll(await seed());
		const broken = issues.filter((i) => i.kind === 'broken-link').map((i) => i.detail);
		expect(broken).toHaveLength(1);
		expect(broken[0]).toContain('no-such-shelf');
	});

	it('records the folders an entity links to, for the "mentioned by" list', async () => {
		const { entities } = await loadAll(await seed());
		expect(entities.get('world/notes/reader')!.folderLinks!.sort()).toEqual([
			'world/history/ages',
			'world/library',
			'world/notes'
		]);
		// An entity with no folder links gets an empty list.
		expect(entities.get('world/library/book')!.folderLinks).toEqual([]);
	});

	it('keeps only real entity ids in entity.wikilinks (a folder is not an edge)', async () => {
		const { entities } = await loadAll(await seed());
		expect(entities.get('world/notes/reader')!.wikilinks).toEqual(['world/library/book']);
	});
});
