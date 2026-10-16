import { graph } from '#lib/server/graph.js';
import { loadKindPage } from './kindPage.load';

export type { KindCard, KindSliceNode, KindRefSection, KindPageData } from './kindPage.load';

export async function load({ params }: { params: { kind: string } }) {
	await graph.ready();
	return loadKindPage(params.kind, null);
}
