import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-auto';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }: { filename: string }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter(),
			// Use absolute asset paths so /_app/immutable/... URLs resolve
			// correctly from non-root pages like /login.
			paths: { relative: false },
			prerender: {
				// Some prerenderable endpoints (e.g. /api/entity-assets)
				// enumerate their entries from the world graph and may
				// legitimately be empty for a given world. Don't fail
				// the dogfood build when that happens.
				handleUnseenRoutes: 'warn'
			}
		})
	]
});
