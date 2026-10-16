// Fails if the packaged dist/ still contains unresolved `#lib` / `$lib`
// imports. Consumers can't resolve those, so a leak builds fine in the
// engine dogfood and breaks every world that installs bunnytrail.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LEAK = /(?:from|import)\s*\(?\s*['"](?:#lib|\$lib)[/'"]/;
const bad = [];

function walk(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path);
		else if (/\.(js|ts|svelte)$/.test(name) && LEAK.test(readFileSync(path, 'utf8'))) bad.push(path);
	}
}

walk('dist');

if (bad.length) {
	console.error(`dist/ has unresolved #lib/$lib imports in ${bad.length} file(s):`);
	for (const f of bad.slice(0, 10)) console.error(`  ${f}`);
	process.exit(1);
}
console.log('dist/ alias check passed');
