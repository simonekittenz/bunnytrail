{
	"name": "__NAME__",
	"private": true,
	"version": "0.0.1",
	"type": "module",
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"sync": "bunnytrail sync",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
	},
	"dependencies": {
		"bunnytrail": "github:simonekittenz/bunnytrail#main"
	},
	"devDependencies": {
		"@sveltejs/adapter-vercel": "^7.0.1",
		"@sveltejs/kit": "^3.1.0",
		"@sveltejs/vite-plugin-svelte": "^7.0.0",
		"@types/node": "^22.10.0",
		"svelte": "^5.57.1",
		"svelte-check": "^4.7.5",
		"typescript": "^6.0.2",
		"vite": "^8.0.12"
	}
}
