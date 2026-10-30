import { normalizeStormwreck } from './stormwreckAdapter.ts'
export const BUNDLED_CAMPAIGN_URL = '/stormwreck-json/manifest.json'

import type { Campaign, Choice, Scene } from '../types.ts'

const record = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const list = (v: unknown): v is unknown[] => Array.isArray(v)
const fail = (message: string): never => {
	throw new Error(`Campagne invalide : ${message}`)
}
function unique(rows: unknown[], name: string): Set<string> {
	const ids = new Set<string>()
	for (const row of rows) {
		if (!record(row)) fail(`${name} : entrée invalide`)
		const id = (row as Record<string, unknown>).id
		if (!text(id) || ids.has(id)) fail(`${name} : identifiant absent ou dupliqué`)
		ids.add(id as string)
	}
	return ids
}
function strings(v: unknown): boolean {
	return list(v) && v.every((x) => typeof x === 'string')
}
function validSource(v: unknown): boolean {
	return (
		record(v) &&
		['fictional_demo', 'official_summary', 'custom'].includes(String(v.type)) &&
		list(v.pages) &&
		v.pages.every((page) => typeof page === 'number' && Number.isInteger(page) && page > 0)
	)
}
export function validateCampaign(input: unknown): Campaign {
	if (!record(input) || !record(input.manifest)) fail('manifeste absent')
	const raw = input as Record<string, unknown>
	const manifest = raw.manifest as Record<string, unknown>
	if (
		!text(manifest.id) ||
		!text(manifest.title) ||
		!text(manifest.subtitle) ||
		manifest.version !== 1 ||
		manifest.rules !== '2014' ||
		typeof manifest.demo !== 'boolean' ||
		!strings(manifest.chapters)
	)
		fail('manifeste non pris en charge')
	for (const key of ['players', 'monsters', 'encounters', 'locations', 'items', 'npcs'])
		if (!text(manifest[key])) fail(`fichier ${key}`)
	const ids: Record<string, Set<string>> = {}
	for (const key of ['chapters', 'players', 'monsters', 'encounters', 'locations', 'items', 'npcs']) {
		if (!list(raw[key])) fail(`liste ${key}`)
		ids[key] = unique(raw[key] as unknown[], key)
	}
	const c = input as Campaign
	const scenes: Scene[] = []
	for (const chapter of c.chapters) {
		if (!text(chapter.title) || !text(chapter.description) || !list(chapter.scenes) || !chapter.scenes.length)
			fail('chapitre sans scènes')
		scenes.push(...chapter.scenes)
	}
	const sceneIds = unique(scenes, 'scènes')
	const choiceIds = new Set<string>()
	const ref = (set: Set<string> | undefined, id: string, label: string) => {
		if (!set?.has(id)) fail(`${label} inconnu : ${id}`)
	}
	for (const s of scenes) {
		if (
			!text(s.title) ||
			!text(s.readAloud) ||
			!strings(s.dmNotes) ||
			!strings(s.characters) ||
			!strings(s.encounterIds) ||
			!list(s.dialogues) ||
			!list(s.checks) ||
			!list(s.choices) ||
			!list(s.transitions) ||
			!Number.isInteger(s.recommendedLevel) ||
			!validSource(s.source)
		)
			fail(`structure scène ${s.id}`)
		ref(ids.chapters, s.chapterId, 'chapitre')
		if (!c.chapters.find((ch) => ch.id === s.chapterId)?.scenes.includes(s)) fail('appartenance de scène')
		ref(ids.locations, s.locationId, 'lieu')
		for (const id of s.characters) ref(ids.npcs, id, 'PNJ')
		for (const id of s.encounterIds) ref(ids.encounters, id, 'rencontre')
		for (const t of s.transitions) {
			if (!text(t.label)) fail('transition')
			ref(sceneIds, t.sceneId, 'scène')
		}
		const dialogueIds = unique(s.dialogues, 'dialogues')
		for (const d of s.dialogues) {
			ref(ids.npcs, d.speakerId, 'interlocuteur')
			if (!text(d.text) || !list(d.choices)) fail('dialogue')
			for (const choice of d.choices) ref(dialogueIds, choice.nextDialogueId, 'dialogue')
		}
		for (const ch of s.choices) {
			if (!text(ch.id) || choiceIds.has(ch.id) || !text(ch.label) || !list(ch.conditions) || !list(ch.effects))
				fail('choix')
			choiceIds.add(ch.id)
			for (const cond of ch.conditions) {
				if (cond.type === 'flag') {
					if (
						!text(cond.key) ||
						!['equals', 'not_equals'].includes(cond.operator) ||
						!['boolean', 'string', 'number'].includes(typeof cond.value)
					)
						fail('condition flag')
				} else if (cond.type === 'scene') {
					ref(sceneIds, cond.sceneId, 'scène')
					if (!['visited', 'completed', 'ignored'].includes(cond.status)) fail('statut scène')
				} else if (cond.type === 'quest') {
					if (!text(cond.key) || !text(cond.value)) fail('condition quête')
				} else fail('condition inconnue')
			}
			validateEffects(ch, ids, sceneIds, ref)
		}
		for (const check of s.checks) {
			if (!text(check.ability) || !Number.isFinite(check.dc) || !text(check.description))
				fail('test de compétence')
			for (const id of [check.successChoiceId, check.failureChoiceId])
				if (id && !s.choices.some((ch) => ch.id === id)) fail(`choix de test ${id}`)
		}
	}
	for (const p of [...c.players, ...c.monsters]) {
		const combat = 'combat' in p ? p.combat : p
		if (
			!text(p.name) ||
			!Number.isInteger(combat.maxHp) ||
			(combat.maxHp ?? 0) < 1 ||
			!Number.isFinite(combat.armorClass) ||
			!Number.isFinite(combat.initiativeBonus) ||
			!record(p.abilities) ||
			!['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].every((a) =>
				Number.isFinite((p.abilities as unknown as Record<string, number>)[a]),
			)
		)
			fail(`statistiques ${p.id}`)
		for (const field of ['skills', 'savingThrows', 'attacks', 'features'])
			if (!strings(p[field as keyof typeof p])) fail(`fiche ${p.id} : ${field}`)
		if (!validSource(p.source)) fail(`source ${p.id}`)
	}
	for (const p of c.players) {
		if (
			!text(p.class) ||
			!text(p.race) ||
			!Number.isInteger(p.level) ||
			(p.level ?? 0) < 1 ||
			!strings(p.spells) ||
			!strings(p.inventory) ||
			!list(p.resources)
		)
			fail(`personnage ${p.id}`)
		unique(p.resources, 'ressources')
		for (const r of p.resources) if (!text(r.name) || !Number.isInteger(r.max) || r.max < 0) fail('ressource')
	}
	for (const m of c.monsters) {
		for (const key of ['type', 'size', 'speed', 'senses', 'languages', 'challenge'])
			if (!text(m[key as keyof typeof m])) fail(`fiche monstre ${m.id} : ${key}`)
		for (const key of ['resistances', 'immunities', 'vulnerabilities', 'actions'])
			if (!strings(m[key as keyof typeof m])) fail(`fiche monstre ${m.id} : ${key}`)
	}
	for (const e of c.encounters) {
		if (!text(e.name) || !text(e.description) || !list(e.participants)) fail('rencontre')
		for (const p of e.participants) {
			ref(ids.monsters, p.monsterId, 'monstre')
			if (
				!Number.isInteger(p.count) ||
				(p.count ?? 0) < 1 ||
				(p.count ?? 0) > 100 ||
				(p.type && !['monster', 'ally', 'hostile'].includes(p.type))
			)
				fail('participant de rencontre')
		}
	}
	for (const entries of [c.locations, c.items, c.npcs])
		for (const e of entries) if (!text(e.name) || typeof e.description !== 'string') fail('entrée de référence')
	return c
}
function validateEffects(
	ch: Choice,
	ids: Record<string, Set<string>>,
	scenes: Set<string>,
	ref: (set: Set<string> | undefined, id: string, label: string) => void,
) {
	for (const e of ch.effects) {
		switch (e.type) {
			case 'set_flag':
				if (!text(e.key) || !['string', 'number', 'boolean'].includes(typeof e.value)) fail('effet flag')
				break
			case 'unlock_scene':
				ref(scenes, e.sceneId, 'scène')
				break
			case 'set_quest':
				if (!text(e.key) || !text(e.value)) fail('effet quête')
				break
			case 'add_item':
				ref(ids.items, e.itemId, 'objet')
				break
			case 'relationship':
				ref(ids.npcs, e.npcId, 'PNJ')
				if (!Number.isFinite(e.value)) fail('relation')
				break
			case 'journal':
				if (!text(e.title) || typeof e.description !== 'string') fail('journal')
				break
			case 'start_encounter':
				ref(ids.encounters, e.encounterId, 'rencontre')
				break
			default:
				fail('effet inconnu')
		}
	}
}
export async function loadCampaign(manifestUrl = BUNDLED_CAMPAIGN_URL): Promise<Campaign> {
	if (manifestUrl !== BUNDLED_CAMPAIGN_URL)
		throw new Error('Seule la campagne Les Dragons de l’Île aux Tempêtes est disponible.')
	return normalizeStormwreck()
}
