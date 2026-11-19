import { graph } from '#lib/server/graph.js';
import { world } from '#lib/server/world.js';
import { renderBody, renderSummary } from '#lib/server/markdown.js';
import { inlineSvgFigures } from '#lib/server/inlineSvgs.js';
import { formatCalendarDateById } from '#lib/calendar.js';
import {
	compareTimelineEntries,
	formatRank,
	undatedEntryTitle,
	type TimelineDotNav,
	type TimelineEntry
} from '#lib/types.js';

export interface TimelineDotPageData extends TimelineDotNav {
	kind: 'timeline-dot';
	/** Rendered HTML summary (may be null). */
	summaryHtml: string | null;
	/** Rendered HTML body of this entry (may be empty string). */
	bodyHtml: string;
	/** Breadcrumb chain. */
	breadcrumbs: { label: string; href: string }[];
	/** True for an undated entry: `label` is its name rather than a date. */
	undated: boolean;
	/** Rank glyph of an undated entry per the line's `rankDisplay`, else null. */
	ordinal: string | null;
	/** Free-form status such as `prophesied`, shown as a chip; else null. */
	status: string | null;
}

/**
 * Collect all `TimelineEntry` objects from a timeline and every nested
 * timeline whose path starts with `<threadPath>/`, sorted ascending by year.
 */
function threadEntries(threadPath: string): TimelineEntry[] {
	const childPrefix = `${threadPath}/`;
	const all: TimelineEntry[] = [];
	for (const [p, tl] of graph.timelines()) {
		if (p !== threadPath && !p.startsWith(childPrefix)) continue;
		all.push(...tl.entries);
	}
	all.sort((a, b) => compareTimelineEntries(a, b) || a.path.localeCompare(b.path));
	return all;
}

/** Resolve a human-readable display title for any timeline path. */
function resolveTimelineTitle(path: string): string {
	const tl = graph.timeline(path);
	if (!tl) return path.slice(path.lastIndexOf('/') + 1).replace(/-/g, ' ');
	const leaf = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;
	const entity = graph.get(path);
	return tl.meta.name ?? entity?.meta.name ?? leaf.replace(/-/g, ' ');
}

/** The rank glyph of an undated entry per its line's `rankDisplay`, else null. */
function ordinalOf(entry: TimelineEntry, timelinePath: string): string | null {
	if (!entry.undated || entry.rank === undefined) return null;
	return formatRank(entry.rank, graph.timeline(timelinePath)?.meta.rankDisplay) || null;
}

/**
 * Build the timeline strip for one dot. `entityTitled` is true when the page
 * also shows the dot's own title as a heading (it is an entity): an undated
 * dot's strip then shows its rank glyph instead of repeating the name.
 */
export async function buildDotNav(
	timelinePath: string,
	entry: TimelineEntry,
	thread: string | null,
	entityTitled = false
): Promise<TimelineDotNav> {
	await world.ready();
	const customCalendars = world.config().customCalendars;
	const timeline = graph.timeline(timelinePath)!;

	/** Format an entry's sort key as a display label. */
	function entryLabel(e: TimelineEntry, variant: 'heading' | 'display' = 'display'): string {
		if (e.undated) return undatedEntryTitle(e);
		if (e.calendarDate && customCalendars?.calendars) {
			return formatCalendarDateById(e.calendarDate, customCalendars.calendars, variant);
		}
		return String(e.year);
	}

	const validThread = thread && graph.isTimeline(thread) ? thread : null;
	const sorted: TimelineEntry[] = validThread ? threadEntries(validThread) : timeline.entries;

	const idx = sorted.findIndex((e) => e.path === entry.path);
	const prev = idx > 0 ? sorted[idx - 1] : null;
	const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

	const leaf = timelinePath.includes('/')
		? timelinePath.slice(timelinePath.lastIndexOf('/') + 1)
		: timelinePath;
	const containingEntity = graph.get(timelinePath);
	const timelineTitle =
		timeline.meta.name ?? containingEntity?.meta.name ?? leaf.replace(/-/g, ' ');

	const threadTitle = validThread ? resolveTimelineTitle(validThread) : null;
	const subThread =
		validThread && timelinePath !== validThread
			? { title: timelineTitle, href: `/${timelinePath}` }
			: null;

	function neighbourTimeline(e: TimelineEntry): string {
		return e.path.slice(0, e.path.lastIndexOf('/'));
	}

	function crossThread(neighbour: TimelineEntry | null): { title: string; href: string } | null {
		if (!neighbour || !validThread) return null;
		const ntl = neighbourTimeline(neighbour);
		if (ntl === timelinePath) return null;
		return { title: resolveTimelineTitle(ntl), href: `/${ntl}` };
	}

	function neighbourHref(e: TimelineEntry, threadCtx: string | null): string {
		const qs = threadCtx ? `?thread=${encodeURIComponent(threadCtx)}` : '';
		return `/${e.path}${qs}`;
	}

	let parentThreadBack: { label: string; href: string } | null = null;
	let parentThreadForward: { label: string; href: string } | null = null;
	if (validThread && validThread === timelinePath) {
		const parentPath = timelinePath.includes('/')
			? timelinePath.slice(0, timelinePath.lastIndexOf('/'))
			: null;
		if (parentPath && graph.isTimeline(parentPath)) {
			const parentTitle = resolveTimelineTitle(parentPath);
			const qs = `?thread=${encodeURIComponent(parentPath)}`;
			const parentEntries = threadEntries(parentPath);
			if (prev === null) {
				const predecessor = [...parentEntries]
					.reverse()
					.find((e) => compareTimelineEntries(e, entry) < 0);
				if (predecessor) {
					parentThreadBack = { label: parentTitle, href: `/${predecessor.path}${qs}` };
				}
			}
			if (next === null) {
				const successor = parentEntries.find((e) => compareTimelineEntries(e, entry) > 0);
				if (successor) {
					parentThreadForward = { label: parentTitle, href: `/${successor.path}${qs}` };
				}
			}
		}
	}

	const headingLabel =
		entityTitled && entry.undated
			? (ordinalOf(entry, timelinePath) ?? entryLabel(entry, 'heading'))
			: entryLabel(entry, 'heading');
	const displayLabel = entityTitled && entry.undated ? headingLabel : entryLabel(entry, 'display');

	return {
		timelinePath,
		timelineTitle,
		label: headingLabel,
		displayLabel: displayLabel !== headingLabel ? displayLabel : null,
		prev: prev
			? { label: entryLabel(prev, 'heading'), href: neighbourHref(prev, validThread), crossThread: crossThread(prev) }
			: null,
		next: next
			? { label: entryLabel(next, 'heading'), href: neighbourHref(next, validThread), crossThread: crossThread(next) }
			: null,
		timelineHref: `/${timelinePath}`,
		thread: validThread,
		threadTitle,
		subThread,
		parentThreadBack,
		parentThreadForward
	};
}

export async function loadTimelineDotPage(
	timelinePath: string,
	slug: string,
	thread: string | null = null
): Promise<TimelineDotPageData | null> {
	await graph.ready();
	const timeline = graph.timeline(timelinePath);
	if (!timeline) return null;

	const entryPath = `${timelinePath}/${slug}`;
	const entry = timeline.entries.find((e) => e.path === entryPath);
	if (!entry) return null;

	const resolveLink = (path: string) => graph.resolveLink(path, graph.clusterOf(timelinePath));
	const languageCodes = graph.languageCodes();
	const kindIds = graph.kindIds();

	const bodyHtml = entry.body.trim()
		? await inlineSvgFigures(
				renderBody(entry.body, resolveLink, languageCodes, kindIds, undefined, entry.path)
			)
		: '';

	const summaryHtml = entry.summary?.trim()
		? renderSummary(entry.summary, resolveLink, languageCodes, { kindIds })
		: null;

	const nav = await buildDotNav(timelinePath, entry, thread);

	const containingEntity = graph.get(timelinePath);
	const breadcrumbs: { label: string; href: string }[] = [];
	if (containingEntity) {
		breadcrumbs.push({ label: containingEntity.meta.name, href: `/${timelinePath}` });
	}
	breadcrumbs.push({ label: nav.timelineTitle, href: `/${timelinePath}` });

	return {
		kind: 'timeline-dot',
		...nav,
		summaryHtml,
		bodyHtml,
		breadcrumbs,
		undated: !!entry.undated,
		ordinal: ordinalOf(entry, timelinePath),
		status: entry.status ?? null
	};
}
