import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The offline iPad bundle runs on a JavaScript engine that cannot parse
 * regex Unicode property escapes (`\p{L}`, `\p{M}`, …). The bundler
 * rewrites the few that `marked` ships with, but it refuses to build if
 * any other survive — so engine source must not introduce new ones.
 * Spell the range out instead (tone marks: `[\u0300-\u036f]`).
 */
function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
		else if (/\.(ts|svelte)$/.test(name) && !/\.spec\.ts$/.test(name)) out.push(path);
	}
	return out;
}

describe('iPad-bundle portability', () => {
	it('uses no regex Unicode property escapes in engine source', () => {
		const offenders = sourceFiles(join(process.cwd(), 'src')).filter((f) =>
			/\\p\{|\\P\{/.test(readFileSync(f, 'utf8'))
		);
		expect(offenders).toEqual([]);
	});
});
