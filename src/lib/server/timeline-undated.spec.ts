import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	compareTimelineEntries,
	formatRank,
	undatedEntryTitle,
	type HealthIssue
} from '#lib/types.js';
import { walkTimelines } from './walker';

async function seed(line: string, dots: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'bt-undated-'));
	const dir = join(root, 'history', 'ages');
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, '_time.md'), line);
	for (const [folder, yaml] of Object.entries(dots)) {
		await mkdir(join(dir, folder), { recursive: true });
		await writeFile(join(dir, folder, '_time.md'), `---\n${yaml}\n---\n\nBody.\n`);
	}
	return root;
}

describe('undated timeline entries', () => {
	it('orders ranked entries without a date by rank, whatever their folder names', async () => {
		const root = await seed('---\ntype: line\nrankDisplay: roman\n---\n', {
			'c-last': 'type: dot\nname: Third\nrank: 3',
			'a-first': 'type: dot\nname: First\nrank: 1',
			'b-middle': 'type: dot\nname: Second\nrank: 2\nstatus: prophesied'
		});
		const issues: HealthIssue[] = [];
		const tl = (await walkTimelines(root, issues)).get('history/ages')!;

		expect(issues).toEqual([]);
		expect(tl.entries.map((e) => e.name)).toEqual(['First', 'Second', 'Third']);
		expect(tl.entries.every((e) => e.undated)).toBe(true);
		expect(tl.entries[1]).toMatchObject({ rank: 2, status: 'prophesied' });
		expect(tl.meta.rankDisplay).toBe('roman');
	});

	it('puts undated entries after dated ones', async () => {
		const root = await seed('---\ntype: line\n---\n', {
			later: 'type: dot\nname: Unplaced\nrank: 1',
			'1954': 'type: dot\nsummary: dated',
			'1700': 'type: dot\nyear: 1700'
		});
		const tl = (await walkTimelines(root, [])).get('history/ages')!;
		expect(tl.entries.map((e) => [e.path.split('/').pop(), !!e.undated])).toEqual([
			['1700', false],
			['1954', false],
			['later', true]
		]);
	});

	it('keeps an undated entry with no rank, ordered after the ranked ones, and reports it', async () => {
		const root = await seed('---\ntype: line\n---\n', {
			shapeless: 'type: dot\nname: No position',
			second: 'type: dot\nname: Ranked\nrank: 2',
			'1900': 'type: dot'
		});
		const issues: HealthIssue[] = [];
		const tl = (await walkTimelines(root, issues)).get('history/ages')!;
		expect(tl.entries.map((e) => e.path.split('/').pop())).toEqual(['1900', 'second', 'shapeless']);
		expect(tl.entries[2]).toMatchObject({ undated: true, name: 'No position' });
		expect(tl.entries[2]!.rank).toBeUndefined();
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ entity: 'history/ages/shapeless' });
		expect(issues[0]!.detail).toContain('no year, date or rank');
	});

	it('keeps the authored rank on a dated entry without making it undated', async () => {
		const root = await seed('---\ntype: line\n---\n', { '1800': 'type: dot\nrank: 9' });
		const [e] = (await walkTimelines(root, [])).get('history/ages')!.entries;
		expect(e).toMatchObject({ year: 1800, rank: 9 });
		expect(e!.undated).toBeUndefined();
	});
});

describe('timeline entry helpers', () => {
	it('compareTimelineEntries: dated by year, then undated by rank', () => {
		const list = [
			{ year: 2, undated: true },
			{ year: 1900 },
			{ year: 1, undated: true },
			{ year: -500 }
		];
		expect([...list].sort(compareTimelineEntries).map((e) => e.year)).toEqual([-500, 1900, 1, 2]);
	});

	it('formatRank follows rankDisplay', () => {
		expect(formatRank(4)).toBe('4');
		expect(formatRank(4, 'roman')).toBe('IV');
		expect(formatRank(4, 'none')).toBe('');
	});

	it('undatedEntryTitle prefers the name and falls back to a humanised slug', () => {
		expect(undatedEntryTitle({ path: 'h/a/1-age-of-strife', name: 'Age of Strife' })).toBe(
			'Age of Strife'
		);
		expect(undatedEntryTitle({ path: 'h/a/3-age-of-strife' })).toBe('Age Of Strife');
	});
});
