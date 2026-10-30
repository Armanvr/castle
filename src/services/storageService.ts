import type { Campaign, GameState, Vitals } from '../types.ts'
import { campaignWithPlayers, createInitialState } from './game.ts'

export const storageKey = (campaignId: string, slot = '1') => `dnd-dm:campaign:${campaignId}:v1:slot:${slot}`
export function cleanupLegacyDemoStorage(): { preservedSaves: number; error?: string } {
	let preservedSaves = 0
	try {
		const demoManifest = '/campaigns/stormwreck-isle/manifest.json'
		if (localStorage.getItem('dnd-dm:active-manifest') === demoManifest)
			localStorage.removeItem('dnd-dm:active-manifest')
		localStorage.removeItem('dnd-dm:slot:' + demoManifest)
		// Legacy sessions may contain MJ additions; preserve their bytes outside the active campaign.
		for (let index = 0; index < localStorage.length; index++)
			if (/^dnd-dm:campaign:stormwreck-isle:v1:slot:[1-3]$/.test(localStorage.key(index) ?? '')) preservedSaves++
		return { preservedSaves }
	} catch (error) {
		return {
			preservedSaves,
			error: `Anciennes préférences non nettoyées ; données conservées. ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
	typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const stringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
function invalid(): never {
	throw new Error('Sauvegarde invalide ou incompatible avec cette campagne.')
}
function validateVitals(
	value: unknown,
	maxHp: number,
	resources?: { id: string; max: number }[],
): asserts value is Vitals {
	if (
		!object(value) ||
		value.maxHp !== maxHp ||
		!integer(value.hp, 0, maxHp) ||
		!integer(value.tempHp) ||
		!integer(value.exhaustion, 0, 6) ||
		!['active', 'unconscious', 'dead', 'removed', 'stable'].includes(String(value.status)) ||
		(value.removedStatus !== undefined &&
			!['active', 'unconscious', 'dead', 'stable'].includes(String(value.removedStatus))) ||
		!object(value.deathSaves) ||
		!integer(value.deathSaves.successes, 0, 3) ||
		!integer(value.deathSaves.failures, 0, 3) ||
		!Array.isArray(value.conditions) ||
		!object(value.resources)
	)
		invalid()
	for (const cond of value.conditions as unknown[])
		if (
			!object(cond) ||
			typeof cond.name !== 'string' ||
			!cond.name ||
			(cond.duration !== undefined && typeof cond.duration !== 'string')
		)
			invalid()
	if (
		resources &&
		(Object.keys(value.resources).length !== resources.length ||
			resources.some((r) => !integer((value.resources as Record<string, unknown>)[r.id], 0, r.max)))
	)
		invalid()
	for (const n of Object.values(value.resources as object)) if (!integer(n)) invalid()
}
export function validateGame(input: unknown, campaign: Campaign): GameState {
	if (!object(input)) invalid()
	campaign = { ...campaign, players: campaign.players.filter((p) => !p.id.startsWith('custom:')) }
	const sourceCampaign = campaign
	// Version 0 used the same payload before the version field became mandatory.
	const value: Record<string, unknown> = {
		...input,
		...(input.version === 0 ? { version: 1 } : {}),
		customPlayers: input.customPlayers ?? [],
		itemAssignments: input.itemAssignments ?? {},
	}
	const customPlayers = input.customPlayers === undefined ? [] : input.customPlayers
	if (!Array.isArray(customPlayers) || customPlayers.length > 100) invalid()
	const customIds = new Set(campaign.players.map((p) => p.id))
	for (const player of customPlayers) {
		if (
			!object(player) ||
			typeof player.id !== 'string' ||
			!player.id.startsWith('custom:') ||
			customIds.has(player.id) ||
			typeof player.name !== 'string' ||
			!player.name.trim() ||
			![player.race, player.class].every((v) => v === null || typeof v === 'string') ||
			!(player.level === null || integer(player.level, 1, 20)) ||
			!(
				player.abilities === null ||
				(object(player.abilities) &&
					['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].every((k) => {
						const v = (player.abilities as Record<string, unknown>)[k]
						return v === null || integer(v, 1, 30)
					}))
			) ||
			!object(player.combat) ||
			!integer(player.combat.maxHp, 1) ||
			!integer(player.combat.armorClass, 0, 100) ||
			!integer(player.combat.initiativeBonus, -100, 100) ||
			!(
				player.combat.speed === null ||
				(typeof player.combat.speed === 'number' &&
					Number.isFinite(player.combat.speed) &&
					player.combat.speed >= 0)
			) ||
			!object(player.source) ||
			player.source.type !== 'custom' ||
			!Array.isArray(player.source.pages) ||
			!player.source.pages.every((p) => integer(p, 1)) ||
			!Array.isArray(player.resources) ||
			player.resources.length ||
			![
				player.skills,
				player.savingThrows,
				player.attacks,
				player.features,
				player.spells,
				player.inventory,
			].every(stringArray)
		)
			invalid()
		customIds.add(player.id)
	}
	const playerStats = input.playerStats
	if (playerStats !== undefined) {
		if (!object(playerStats)) invalid()
		for (const [id, stats] of Object.entries(playerStats))
			if (
				!customIds.has(id) ||
				!object(stats) ||
				!integer(stats.maxHp, 1) ||
				!integer(stats.armorClass, 0, 100) ||
				!integer(stats.initiativeBonus, -100, 100) ||
				Object.keys(stats).some((key) => !['maxHp', 'armorClass', 'initiativeBonus'].includes(key))
			)
				invalid()
	}
	campaign = campaignWithPlayers(campaign, { customPlayers, playerStats } as GameState)
	if (value.itemAssignments !== undefined) {
		if (!object(value.itemAssignments)) invalid()
		for (const [itemId, playerId] of Object.entries(value.itemAssignments))
			if (
				!campaign.items.some((i) => i.id === itemId) ||
				!campaign.players.some((p) => p.id === playerId) ||
				!Array.isArray(value.inventory) ||
				!value.inventory.includes(itemId)
			)
				invalid()
	}
	const scenes = new Set(campaign.chapters.flatMap((c) => c.scenes.map((s) => s.id)))
	if (value.sceneAdditions !== undefined) {
		if (!object(value.sceneAdditions)) invalid()
		for (const [id, additions] of Object.entries(value.sceneAdditions)) {
			if (!scenes.has(id) || !object(additions)) invalid()
			for (const [section, text] of Object.entries(additions))
				if (!['readAloud', 'summary', 'dmNotes', 'dialogues'].includes(section) || typeof text !== 'string')
					invalid()
		}
	}
	const choices = new Set(campaign.chapters.flatMap((c) => c.scenes.flatMap((s) => s.choices.map((ch) => ch.id))))
	if (
		value.version !== 1 ||
		value.campaignId !== campaign.manifest.id ||
		!scenes.has(String(value.activeSceneId)) ||
		!object(value.sceneStatus) ||
		!object(value.flags) ||
		!object(value.quests) ||
		!object(value.relationships) ||
		!object(value.players) ||
		!stringArray(value.inventory) ||
		!stringArray(value.unlockedScenes) ||
		!stringArray(value.appliedChoices) ||
		typeof value.notes !== 'string' ||
		!Array.isArray(value.journal)
	)
		invalid()
	for (const [key, status] of Object.entries(value.sceneStatus))
		if (!scenes.has(key) || !['visited', 'completed', 'ignored'].includes(String(status))) invalid()
	if (
		!value.unlockedScenes.every((id) => scenes.has(id)) ||
		!value.appliedChoices.every((id) => choices.has(id)) ||
		!value.inventory.every((id) => campaign.items.some((i) => i.id === id))
	)
		invalid()
	for (const v of Object.values(value.flags))
		if (!['string', 'boolean', 'number'].includes(typeof v) || (typeof v === 'number' && !Number.isFinite(v)))
			invalid()
	for (const v of Object.values(value.quests)) if (typeof v !== 'string') invalid()
	for (const [id, v] of Object.entries(value.relationships))
		if (!campaign.npcs.some((n) => n.id === id) || typeof v !== 'number' || !Number.isFinite(v)) invalid()
	if (Object.keys(value.players).length !== campaign.players.length) invalid()
	for (const p of campaign.players) validateVitals(value.players[p.id], p.combat.maxHp, p.resources)
	for (const j of value.journal)
		if (
			!object(j) ||
			typeof j.id !== 'string' ||
			typeof j.date !== 'string' ||
			Number.isNaN(Date.parse(j.date)) ||
			typeof j.type !== 'string' ||
			typeof j.title !== 'string' ||
			typeof j.description !== 'string' ||
			(j.sceneId !== undefined && !scenes.has(String(j.sceneId))) ||
			(j.chapterId !== undefined && !campaign.chapters.some((c) => c.id === j.chapterId)) ||
			(j.participants !== undefined && !stringArray(j.participants))
		)
			invalid()
	if (value.combat !== null) {
		const c = value.combat
		if (
			!object(c) ||
			typeof c.id !== 'string' ||
			typeof c.name !== 'string' ||
			!['active', 'suspended', 'finished'].includes(String(c.status)) ||
			!integer(c.round, 1) ||
			!Array.isArray(c.participants) ||
			c.participants.length > 500 ||
			(c.encounterId !== undefined && !campaign.encounters.some((e) => e.id === c.encounterId))
		)
			invalid()
		const ids = new Set<string>()
		const playerIds = new Set<string>()
		for (const p of c.participants) {
			if (
				!object(p) ||
				typeof p.id !== 'string' ||
				ids.has(p.id) ||
				typeof p.name !== 'string' ||
				(p.manualNotes !== undefined && typeof p.manualNotes !== 'string') ||
				!['player', 'monster', 'ally', 'hostile'].includes(String(p.type)) ||
				!integer(p.maxHp, 1) ||
				!integer(p.armorClass, 0, 100) ||
				typeof p.initiative !== 'number' ||
				!Number.isFinite(p.initiative) ||
				typeof p.initiativeBonus !== 'number' ||
				!Number.isFinite(p.initiativeBonus)
			)
				invalid()
			ids.add(p.id)
			if (p.playerId !== undefined) {
				const player = campaign.players.find((x) => x.id === p.playerId)
				if (
					!player ||
					playerIds.has(player.id) ||
					p.type !== 'player' ||
					p.maxHp !== player.combat.maxHp ||
					p.vitals !== undefined
				)
					invalid()
				playerIds.add(player.id)
			} else {
				const monster = campaign.monsters.find((m) => m.id === p.monsterId)
				if (!monster || p.type === 'player') invalid()
				validateVitals(p.vitals, p.maxHp as number)
			}
		}
		if (c.activeId !== null && (typeof c.activeId !== 'string' || !ids.has(c.activeId))) invalid()
	}
	if (value.undo !== null) {
		if (
			!object(value.undo) ||
			typeof value.undo.choiceId !== 'string' ||
			!choices.has(value.undo.choiceId) ||
			!object(value.undo.before) ||
			!object(value.undo.after) ||
			'undo' in value.undo.before ||
			'undo' in value.undo.after
		)
			invalid()
		const { undo: _beforeUndo, ...before } = validateGame({ ...value.undo.before, undo: null }, sourceCampaign)
		const { undo: _afterUndo, ...after } = validateGame({ ...value.undo.after, undo: null }, sourceCampaign)
		value.undo = { ...value.undo, before, after }
	}
	return value as unknown as GameState
}
export function exportGame(state: GameState): string {
	return JSON.stringify(state, null, 2)
}
export function importGame(json: string, campaign: Campaign): GameState {
	return validateGame(JSON.parse(json) as unknown, campaign)
}
export function loadGame(campaign: Campaign, slot = '1'): { state: GameState; error?: string } {
	try {
		const saved = localStorage.getItem(storageKey(campaign.manifest.id, slot))
		return { state: saved ? importGame(saved, campaign) : createInitialState(campaign) }
	} catch (error) {
		return {
			state: createInitialState(campaign),
			error: `Sauvegarde non chargée ; original conservé. ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}
export function saveGame(state: GameState, slot = '1'): string | null {
	try {
		localStorage.setItem(storageKey(state.campaignId, slot), exportGame(state))
		return null
	} catch (error) {
		return `Sauvegarde impossible : ${error instanceof Error ? error.message : String(error)}`
	}
}
