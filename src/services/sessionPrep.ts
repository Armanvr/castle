import type { Campaign, Encounter, GameState, Scene } from '../types.ts'

// Same gaps that make startEncounter refuse: unknown profile, quantity or an essential stat left to the DM.
export function encounterNeedsPrep(campaign: Campaign, encounter: Encounter): boolean {
	return encounter.participants.some((p) => {
		const m = campaign.monsters.find((x) => x.id === p.monsterId)
		return !m || p.count === null || m.maxHp === null || m.armorClass === null || m.initiativeBonus === null
	})
}
export interface SessionPrep {
	scene: Scene | null
	nextScenes: Scene[]
	encounters: { encounter: Encounter; needsPrep: boolean }[]
	warnings: string[]
}
export function sessionPrep(state: GameState, campaign: Campaign): SessionPrep {
	const scenes = campaign.chapters.flatMap((c) => c.scenes)
	const scene = scenes.find((s) => s.id === state.activeSceneId) ?? null
	const reachable = new Set<string>()
	for (const c of scene?.choices ?? []) {
		if (c.nextSceneId) reachable.add(c.nextSceneId)
		for (const e of c.effects) if (e.type === 'unlock_scene') reachable.add(e.sceneId)
	}
	for (const t of scene?.transitions ?? []) reachable.add(t.sceneId)
	reachable.delete(state.activeSceneId)
	const nextScenes = scenes.filter((s) => reachable.has(s.id))
	const relevant = scene ? [scene, ...nextScenes] : nextScenes
	const sceneIds = new Set(relevant.map((s) => s.id))
	const encounterIds = new Set(relevant.flatMap((s) => s.encounterIds))
	const encounters = campaign.encounters
		.filter((e) => encounterIds.has(e.id) || (e.sceneId !== undefined && sceneIds.has(e.sceneId)))
		.map((encounter) => ({ encounter, needsPrep: encounterNeedsPrep(campaign, encounter) }))
	// shortcut: warnings are free text; matched by id or title mention, upgrade: structured warning targets.
	const needles = [
		...relevant.flatMap((s) => [s.id, s.title]),
		...encounters.flatMap(({ encounter: e }) => [e.id, e.name]),
	].filter(Boolean)
	const warnings = (campaign.warnings ?? []).filter((w) => needles.some((n) => w.includes(n)))
	return { scene, nextScenes, encounters, warnings }
}
