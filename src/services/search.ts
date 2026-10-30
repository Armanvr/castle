import type { Campaign } from '../types'

export type SearchKind = 'scene' | 'npc' | 'monster' | 'item' | 'player'
export interface SearchResult {
	kind: SearchKind
	id: string
	title: string
	/** chapter title for scenes */
	detail?: string
	/** 0 = title match, 1 = body match only */
	rank: 0 | 1
}
type Entry = Omit<SearchResult, 'rank'> & { body: string }
const MAX_RESULTS = 20
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// shortcut: plain substring match on every word, no fuzzy/typo tolerance; upgrade if the DM needs it.
// Custom players are found when `campaign` comes from game.campaignWithPlayers, as in the app.
export function searchCampaign(campaign: Campaign, query: string): SearchResult[] {
	const words = fold(query).split(/\s+/).filter(Boolean)
	if (!words.length) return []
	const entries: Entry[] = [
		...campaign.chapters.flatMap((c) =>
			c.scenes.map(
				(s): Entry => ({ kind: 'scene', id: s.id, title: s.title, body: s.summary ?? '', detail: c.title }),
			),
		),
		...campaign.npcs.map((n): Entry => ({ kind: 'npc', id: n.id, title: n.name, body: n.description })),
		...campaign.monsters.map((m): Entry => ({ kind: 'monster', id: m.id, title: m.name, body: m.type })),
		...campaign.items.map((i): Entry => ({ kind: 'item', id: i.id, title: i.name, body: i.description })),
		...campaign.players.map(
			(p): Entry => ({
				kind: 'player',
				id: p.id,
				title: p.name,
				body: [p.race, p.class].filter(Boolean).join(' '),
			}),
		),
	]
	const hits: SearchResult[] = []
	for (const { body, ...entry } of entries) {
		const title = fold(entry.title)
		if (words.every((w) => title.includes(w))) hits.push({ ...entry, rank: 0 })
		else if (words.every((w) => `${title} ${fold(body)}`.includes(w))) hits.push({ ...entry, rank: 1 })
	}
	// Array.prototype.sort is stable: campaign order is kept inside each rank
	return hits.sort((a, b) => a.rank - b.rank).slice(0, MAX_RESULTS)
}
