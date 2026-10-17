import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EntityMeta, HealthIssue } from '#lib/types.js';
import { loadAll } from './loader';
import { loadLexicon, loadSections } from './walker';

async function tmp(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'bt-sections-'));
}

const meta = (sections: unknown): EntityMeta => ({ name: 'Tongue', sections }) as EntityMeta;

describe('loadSections', () => {
	it('reads <slug>.md files in the declared order, titled by their first heading', async () => {
		const dir = await tmp();
		await writeFile(join(dir, 'grammar.md'), '# Grammar & Syntax\n\nSOV order.\n');
		await writeFile(join(dir, 'phonology.md'), 'No heading here.\n');
		const issues: HealthIssue[] = [];

		const out = await loadSections(dir, 'tongue', meta(['phonology', 'grammar']), issues);

		expect(issues).toEqual([]);
		expect(out.map((s) => s.slug)).toEqual(['phonology', 'grammar']);
		expect(out[0]!.title).toBe('Phonology'); // humanised slug fallback
		expect(out[1]!.title).toBe('Grammar & Syntax');
		expect(out[1]!.body).toBe('SOV order.\n'); // heading stripped
	});

	it('returns nothing when the entity declares no sections', async () => {
		const out = await loadSections(await tmp(), 'tongue', { name: 'x' } as EntityMeta, []);
		expect(out).toEqual([]);
	});

	it('reports a missing file and keeps the rest', async () => {
		const dir = await tmp();
		await writeFile(join(dir, 'a.md'), '# A\n');
		const issues: HealthIssue[] = [];
		const out = await loadSections(dir, 'tongue', meta(['a', 'ghost']), issues);
		expect(out.map((s) => s.slug)).toEqual(['a']);
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ kind: 'missing-md', entity: 'tongue' });
	});

	it('reads optional frontmatter: title overrides the heading, toc is a per-page setting', async () => {
		const dir = await tmp();
		await writeFile(
			join(dir, 'grammar.md'),
			'---\ntitle: Grammar & Syntax\ntoc: never\n---\n# Ignored heading\n\nProse.\n'
		);
		await writeFile(join(dir, 'plain.md'), '# Plain\n\nNo frontmatter.\n');
		const issues: HealthIssue[] = [];
		const out = await loadSections(dir, 'tongue', meta(['grammar', 'plain']), issues);

		expect(issues).toEqual([]);
		expect(out[0]).toMatchObject({ title: 'Grammar & Syntax', toc: 'never' });
		expect(out[0]!.body).toBe('Prose.\n'); // frontmatter and heading both gone
		expect(out[1]).toMatchObject({ title: 'Plain', toc: null });
	});

	it('accepts true/false for toc and flags nonsense', async () => {
		const dir = await tmp();
		await writeFile(join(dir, 'a.md'), '---\ntoc: true\n---\n# A\n');
		await writeFile(join(dir, 'b.md'), '---\ntoc: false\n---\n# B\n');
		await writeFile(join(dir, 'c.md'), '---\ntoc: sometimes\n---\n# C\n');
		const issues: HealthIssue[] = [];
		const out = await loadSections(dir, 'tongue', meta(['a', 'b', 'c']), issues);
		expect(out.map((s) => s.toc)).toEqual(['always', 'never', null]);
		expect(issues).toHaveLength(1);
		expect(issues[0]!.detail).toMatch(/`toc` must be/);
	});

	it('reports broken section frontmatter but still loads the page', async () => {
		const dir = await tmp();
		await writeFile(join(dir, 'a.md'), '---\ntitle: [unclosed\n---\n# A\n\nBody.\n');
		const issues: HealthIssue[] = [];
		const out = await loadSections(dir, 'tongue', meta(['a']), issues);
		expect(out).toHaveLength(1);
		expect(out[0]!.title).toBe('A');
		expect(issues[0]!.kind).toBe('invalid-yaml');
	});

	it('rejects reserved, malformed and duplicate slugs', async () => {
		const dir = await tmp();
		for (const f of ['craft', 'dictionary', 'ok']) await writeFile(join(dir, `${f}.md`), '# X\n');
		const issues: HealthIssue[] = [];
		const out = await loadSections(
			dir,
			'tongue',
			meta(['craft', 'dictionary', 'Bad Slug', 'ok', 'ok']),
			issues
		);
		expect(out.map((s) => s.slug)).toEqual(['ok']);
		expect(issues.map((i) => i.detail).join('\n')).toMatch(/reserved/);
		expect(issues.map((i) => i.detail).join('\n')).toMatch(/lowercase/);
		expect(issues.map((i) => i.detail).join('\n')).toMatch(/duplicate/);
	});

	it('refuses a section that would shadow a child folder', async () => {
		const dir = await tmp();
		await mkdir(join(dir, 'phonology'));
		await writeFile(join(dir, 'phonology.md'), '# P\n');
		const issues: HealthIssue[] = [];
		const out = await loadSections(dir, 'tongue', meta(['phonology']), issues);
		expect(out).toEqual([]);
		expect(issues[0]!.detail).toMatch(/collides/);
	});

	it('flags a sections field that is not a list of strings', async () => {
		const issues: HealthIssue[] = [];
		expect(await loadSections(await tmp(), 'tongue', meta('phonology'), issues)).toEqual([]);
		expect(await loadSections(await tmp(), 'tongue', meta([1, 2]), issues)).toEqual([]);
		expect(issues).toHaveLength(2);
	});
});

describe('loadLexicon', () => {
	it('normalises rows: trims, coerces, and splits forms', async () => {
		const dir = await tmp();
		await writeFile(
			join(dir, 'lexicon.yaml'),
			[
				'- {word: manyan, pos: verb, meaning: to love, class: 1, ipa: /manjan/, forms: [manyuh, manyay]}',
				'- word: plang',
				'  meaning: city; hilltop',
				'  gloss: city',
				'- word: sa',
				'  forms: sab',
				'  class: 2'
			].join('\n')
		);
		const issues: HealthIssue[] = [];
		const rows = await loadLexicon(dir, 'tongue', issues);

		expect(issues).toEqual([]);
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({
			word: 'manyan',
			pos: 'verb',
			meaning: 'to love',
			cls: '1',
			ipa: 'manjan', // surrounding slashes removed
			forms: ['manyuh', 'manyay']
		});
		expect(rows[1]).toMatchObject({ word: 'plang', gloss: 'city', forms: [], ipa: null });
		expect(rows[2]!.forms).toEqual(['sab']); // a bare string becomes a one-item list
		expect(rows[2]!.cls).toBe('2'); // numbers are coerced
	});

	it('also reads lexicon.yml', async () => {
		const dir = await tmp();
		await writeFile(join(dir, 'lexicon.yml'), '- {word: a}\n');
		expect(await loadLexicon(dir, 'tongue', [])).toHaveLength(1);
	});

	it('returns nothing when there is no lexicon file', async () => {
		expect(await loadLexicon(await tmp(), 'tongue', [])).toEqual([]);
	});

	it('skips bad rows with an issue that names the row', async () => {
		const dir = await tmp();
		await writeFile(join(dir, 'lexicon.yaml'), '- {word: ok}\n- just a string\n- {meaning: no word}\n');
		const issues: HealthIssue[] = [];
		const rows = await loadLexicon(dir, 'tongue', issues);
		expect(rows.map((r) => r.word)).toEqual(['ok']);
		expect(issues.map((i) => i.detail).join('\n')).toMatch(/entry 2 is not a mapping/);
		expect(issues.map((i) => i.detail).join('\n')).toMatch(/entry 3 has no `word`/);
	});

	it('reports YAML that is not a list, and unparseable YAML', async () => {
		const dir = await tmp();
		await writeFile(join(dir, 'lexicon.yaml'), 'word: a\n');
		const issues: HealthIssue[] = [];
		expect(await loadLexicon(dir, 'tongue', issues)).toEqual([]);
		expect(issues[0]!.detail).toMatch(/expected a list/);

		const dir2 = await tmp();
		await writeFile(join(dir2, 'lexicon.yaml'), '- {word: [unclosed\n');
		const issues2: HealthIssue[] = [];
		expect(await loadLexicon(dir2, 'tongue', issues2)).toEqual([]);
		expect(issues2[0]!.kind).toBe('invalid-yaml');
	});
});

describe('sections and lexicon through loadAll', () => {
	it('attaches both to the entity and merges section links into its wikilinks', async () => {
		const root = await tmp();
		const lang = join(root, 'languages', 'tongue');
		await mkdir(lang, { recursive: true });
		await mkdir(join(root, 'places', 'town'), { recursive: true });
		await writeFile(
			join(lang, 'index.md'),
			'---\nname: Tongue\nkind: language\ncode: tg\nsections: [grammar]\ntoc: auto\ncollation: [a, ch, k]\n---\nMain prose.\n'
		);
		await writeFile(join(lang, 'grammar.md'), '# Grammar\n\nSpoken in [[places/town]].\n');
		await writeFile(join(lang, 'lexicon.yaml'), '- {word: ka, meaning: water}\n');
		await writeFile(join(root, 'places', 'town', 'index.md'), '---\nname: Town\nkind: place\n---\nHi.\n');

		const { entities, issues } = await loadAll(root);
		const e = entities.get('languages/tongue')!;

		// `sections` and `collation` are part of the entity contract, not stray fields.
		expect(issues.filter((i) => i.kind === 'unknown-entity-field')).toEqual([]);

		expect(e.sections.map((s) => s.slug)).toEqual(['grammar']);
		expect(e.lexicon.map((r) => r.word)).toEqual(['ka']);
		expect(e.wikilinks).toContain('places/town'); // from the section body, not index.md
		// Section files are not mistaken for child entities.
		expect([...entities.keys()].sort()).toEqual(['languages/tongue', 'places/town']);
	});

	it('works for any kind of entity, not just languages', async () => {
		const root = await tmp();
		const dir = join(root, 'places', 'city');
		await mkdir(dir, { recursive: true });
		await writeFile(
			join(dir, 'index.md'),
			'---\nname: City\nkind: place\nsections: [history]\ntoc: always\n---\nHi.\n'
		);
		await writeFile(join(dir, 'history.md'), '# History\n\n## Founding\n\ntext\n');

		const { entities, issues } = await loadAll(root);
		const e = entities.get('places/city')!;

		expect(e.meta.kind).toBe('place');
		expect(e.sections.map((s) => s.slug)).toEqual(['history']);
		expect(issues.filter((i) => i.kind === 'unknown-entity-field')).toEqual([]);
	});
});
