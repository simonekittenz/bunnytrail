import type { Entity } from '#lib/types.js';

type ProseSource = Pick<Entity, 'body' | 'sections' | 'chapters'>;

/** Whitespace-separated word count. */
export function countWords(s: string): number {
	const t = s.trim();
	return t ? t.split(/\s+/).length : 0;
}

/**
 * Every piece of prose an entity owns: its own body plus its `sections:`
 * pages and `chapters/`. A language whose grammar lives in sections, or a
 * work made of chapters, still has prose when `index.md` itself is empty.
 */
export function entityProse(e: ProseSource): string[] {
	return [e.body, ...e.sections.map((sec) => sec.body), ...e.chapters.map((ch) => ch.body)];
}

/** True when the entity has any prose at all (body, sections or chapters). */
export function hasProse(e: ProseSource): boolean {
	return entityProse(e).some((p) => p.trim().length > 0);
}

/** Words across the entity's body, sections, chapters and summary. */
export function entityWordCount(e: ProseSource & Pick<Entity, 'meta'>): number {
	return entityProse(e).reduce((n, p) => n + countWords(p), 0) + countWords(e.meta.summary ?? '');
}
