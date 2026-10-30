import type { Campaign, Character, Choice, Combatant, GameState, Vitals } from '../types.ts'
import { rollDice } from './dice.ts'

export const CONDITIONS = [
	'Aveuglé',
	'Charmé',
	'Assourdi',
	'Effrayé',
	'Agrippé',
	'Incapable d’agir',
	'Invisible',
	'Paralysé',
	'Pétrifié',
	'Empoisonné',
	'À terre',
	'Entravé',
	'Étourdi',
	'Inconscient',
]
export const uid = () => crypto.randomUUID()
export function freshVitals(maxHp: number): Vitals {
	return {
		maxHp,
		hp: maxHp,
		tempHp: 0,
		conditions: [],
		exhaustion: 0,
		status: 'active',
		deathSaves: { successes: 0, failures: 0 },
		resources: {},
	}
}
export function createInitialState(campaign: Campaign): GameState {
	const first = campaign.chapters[0]!.scenes[0]!.id
	return {
		version: 1,
		campaignId: campaign.manifest.id,
		activeSceneId: first,
		sceneStatus: {},
		flags: {},
		quests: {},
		inventory: [],
		customPlayers: [],
		itemAssignments: {},
		relationships: {},
		unlockedScenes: [first],
		appliedChoices: [],
		players: Object.fromEntries(
			campaign.players.map((p) => [
				p.id,
				{
					...freshVitals(p.combat.maxHp),
					resources: Object.fromEntries(p.resources.map((r) => [r.id, r.max])),
				},
			]),
		),
		combat: null,
		journal: [],
		notes: '',
		undo: null,
	}
}
const copy = (state: GameState): GameState => structuredClone(state)
export function addJournal(state: GameState, title: string, description = '', type = 'note'): GameState {
	const next = copy(state)
	next.journal.push({
		id: uid(),
		date: new Date().toISOString(),
		type,
		title,
		description,
		sceneId: state.activeSceneId,
	})
	return next
}
export function finishEncounter(state: GameState): GameState {
	if (!state.combat || state.combat.status === 'finished') return state
	return addJournal(
		{ ...state, combat: { ...state.combat, status: 'finished' } },
		`Rencontre terminée : ${state.combat.name}`,
		'',
		'encounter',
	)
}
export function navigateScene(state: GameState, campaign: Campaign, sceneId: string): GameState {
	if (!campaign.chapters.some((c) => c.scenes.some((s) => s.id === sceneId)))
		throw new Error(`Scène inconnue : ${sceneId}`)
	const next = copy(state)
	next.activeSceneId = sceneId
	next.sceneStatus[sceneId] ??= 'visited'
	return next
}
export function canChoose(state: GameState, choice: Choice): boolean {
	return (
		!state.appliedChoices.includes(choice.id) &&
		choice.conditions.every((c) =>
			c.type === 'flag'
				? c.operator === 'equals'
					? state.flags[c.key] === c.value
					: state.flags[c.key] !== c.value
				: c.type === 'scene'
					? state.sceneStatus[c.sceneId] === c.status
					: state.quests[c.key] === c.value,
		)
	)
}
export function applyChoice(state: GameState, campaign: Campaign, choice: Choice): GameState {
	if (state.appliedChoices.includes(choice.id)) return state
	if (!canChoose(state, choice)) throw new Error('Les conditions de ce choix ne sont pas remplies.')
	let next = copy(state)
	const { undo: _undo, ...before } = copy(state)
	for (const e of choice.effects) {
		switch (e.type) {
			case 'set_flag':
				next.flags[e.key] = e.value
				break
			case 'unlock_scene':
				if (!next.unlockedScenes.includes(e.sceneId)) next.unlockedScenes.push(e.sceneId)
				break
			case 'set_quest':
				next.quests[e.key] = e.value
				break
			case 'add_item':
				if (!next.inventory.includes(e.itemId)) next.inventory.push(e.itemId)
				break
			case 'relationship':
				next.relationships[e.npcId] = e.value
				break
			case 'journal':
				next = addJournal(next, e.title, e.description, 'narrative')
				break
			case 'start_encounter':
				next = startEncounter(next, campaign, e.encounterId)
				break
		}
	}
	if (choice.nextSceneId) next = navigateScene(next, campaign, choice.nextSceneId)
	next.appliedChoices.push(choice.id)
	next = addJournal(next, choice.label, 'Choix narratif appliqué.', 'choice')
	const { undo: _previous, ...after } = copy(next)
	next.undo = { choiceId: choice.id, before, after }
	return next
}
export function undoChoice(state: GameState): GameState {
	if (!state.undo) return state
	const { undo, ...current } = state
	if (JSON.stringify(current) !== JSON.stringify(undo.after))
		throw new Error(
			'Annulation indisponible après de nouvelles modifications. Réimportez une sauvegarde pour revenir davantage en arrière.',
		)
	return { ...structuredClone(undo.before), undo: null }
}
export interface ParticipantOverride {
	count?: number
	maxHp?: number
	armorClass?: number
	initiativeBonus?: number
}
export interface StartEncounterOptions {
	selectedPlayerIds?: string[]
	participantOverrides?: Record<number, ParticipantOverride>
	random?: () => number
}
// Fallback for saves without removedStatus; mirrors damage(): creatures die at 0 HP, PJs fall unconscious until 3 failures.
const restoredStatus = (v: Vitals, player: boolean) =>
	v.removedStatus ?? (v.hp > 0 ? 'active' : !player || v.deathSaves.failures >= 3 ? 'dead' : 'unconscious')
export function startEncounter(
	state: GameState,
	campaign: Campaign,
	encounterId?: string,
	options: StartEncounterOptions = {},
): GameState {
	campaign = campaignWithPlayers(campaign, state)
	if (state.combat && state.combat.status !== 'finished')
		throw new Error('Terminez le combat actuel avant de lancer une rencontre.')
	const encounter = campaign.encounters.find((e) => e.id === encounterId)
	if (encounterId && !encounter) throw new Error('Rencontre inconnue.')
	let next = copy(state)
	for (const v of Object.values(next.players))
		if (v.status === 'removed') {
			v.status = restoredStatus(v, true)
			delete v.removedStatus
		}
	next.combat = {
		id: uid(),
		...(encounterId ? { encounterId } : {}),
		name: encounter?.name ?? 'Rencontre personnalisée',
		status: 'active',
		round: 1,
		activeId: null,
		participants: campaign.players
			.filter((p) => !options.selectedPlayerIds || options.selectedPlayerIds.includes(p.id))
			.map((p) => ({
				id: `player:${p.id}`,
				playerId: p.id,
				name: p.name,
				type: 'player',
				initiative: 0,
				initiativeBonus: p.combat.initiativeBonus,
				maxHp: p.combat.maxHp,
				armorClass: p.combat.armorClass,
			})),
	}
	for (const [index, p] of (encounter?.participants ?? []).entries()) {
		const override = options.participantOverrides?.[index]
		const count = override?.count ?? p.count
		if (count === null || !Number.isInteger(count) || count < 1 || count > 100)
			throw new Error('Quantité à préciser : entier de 1 à 100.')
		for (let i = 0; i < count; i++) next = addParticipant(next, campaign, p.monsterId, p.type, override)
	}
	next = rollCreatureInitiatives(next, options.random)
	next.combat!.activeId = sortedParticipants(next)[0]?.id ?? null
	return addJournal(next, `Rencontre : ${next.combat!.name}`, 'Combat lancé.', 'combat')
}
export function addParticipant(
	state: GameState,
	campaign: Campaign,
	monsterId: string,
	type: Combatant['type'] = 'monster',
	override: ParticipantOverride = {},
): GameState {
	if (!state.combat) throw new Error('Aucun combat.')
	const monster = campaign.monsters.find((m) => m.id === monsterId)
	if (!monster) throw new Error('Créature inconnue.')
	const maxHp = override.maxHp ?? monster.maxHp
	const armorClass = override.armorClass ?? monster.armorClass
	const initiativeBonus = override.initiativeBonus ?? monster.initiativeBonus
	if (
		maxHp === null ||
		!Number.isSafeInteger(maxHp) ||
		maxHp < 1 ||
		armorClass === null ||
		!Number.isSafeInteger(armorClass) ||
		armorClass < 0 ||
		armorClass > 100 ||
		initiativeBonus === null ||
		!Number.isSafeInteger(initiativeBonus)
	)
		throw new Error('Profil incomplet : renseignez PV maximum, CA et bonus d’initiative.')
	if (type === 'player') throw new Error('Sélectionnez un personnage joueur existant.')
	const next = copy(state)
	const id = uid()
	next.combat!.participants.push({
		id,
		monsterId,
		name: monster.name,
		type,
		initiative: 0,
		initiativeBonus,
		maxHp,
		armorClass,
		vitals: freshVitals(maxHp),
	})
	next.combat!.activeId ??= id
	return next
}
export function getVitals(state: GameState, participant: Combatant): Vitals {
	return participant.playerId ? state.players[participant.playerId]! : participant.vitals!
}
function resolve(state: GameState, targetId: string): { vitals: Vitals; maxHp: number; player: boolean } {
	const participant = state.combat?.participants.find((p) => p.id === targetId || p.playerId === targetId)
	if (participant)
		return { vitals: getVitals(state, participant), maxHp: participant.maxHp, player: !!participant.playerId }
	const vitals = state.players[targetId]
	if (!vitals) throw new Error('Participant inconnu.')
	return { vitals, maxHp: vitals.maxHp, player: true }
}
const amount = (n: number) => {
	if (!Number.isFinite(n) || n < 0) throw new Error('Saisissez un nombre positif.')
	return Math.floor(n)
}
export function updateVitals(state: GameState, targetId: string, patch: Partial<Vitals>, maxHp?: number): GameState {
	const next = copy(state)
	const target = resolve(next, targetId)
	if (patch.hp !== undefined) {
		patch = { ...patch, hp: Math.min(amount(patch.hp), maxHp ?? target.maxHp) }
	}
	if (patch.tempHp !== undefined) patch = { ...patch, tempHp: amount(patch.tempHp) }
	if (
		patch.exhaustion !== undefined &&
		(!Number.isInteger(patch.exhaustion) || patch.exhaustion < 0 || patch.exhaustion > 6)
	)
		throw new Error('Épuisement : 0 à 6.')
	if (patch.resources && Object.values(patch.resources).some((n) => !Number.isSafeInteger(n) || n < 0))
		throw new Error('Une ressource doit être un entier positif ou nul.')
	if (patch.status === 'removed' && target.vitals.status !== 'removed')
		target.vitals.removedStatus = target.vitals.status
	const combat = next.combat
	const active = combat?.participants.find((p) => p.id === combat.activeId)
	if (patch.status === 'removed' && combat && active && (active.id === targetId || active.playerId === targetId)) {
		const order = sortedParticipants(next)
		const index = order.findIndex((p) => p.id === active.id)
		const following = order[(index + 1) % order.length]
		combat.activeId = following && following.id !== active.id ? following.id : null
		if (combat.status === 'active' && index === order.length - 1 && combat.activeId) combat.round++
	}
	// A manual revival (out of 'dead') or 'stable' ends the death-save sequence; 'removed' keeps saves for restore.
	const clearsSaves =
		patch.status === 'stable' ||
		(target.vitals.status === 'dead' && patch.status !== undefined && !['dead', 'removed'].includes(patch.status))
	Object.assign(target.vitals, patch)
	if (clearsSaves) target.vitals.deathSaves = { successes: 0, failures: 0 }
	if (patch.hp !== undefined) {
		target.vitals.status = patch.hp > 0 ? 'active' : target.player ? 'unconscious' : 'dead'
		if (patch.hp > 0) target.vitals.deathSaves = { successes: 0, failures: 0 }
	}
	return next
}
export function damage(state: GameState, targetId: string, value: number): GameState {
	const n = amount(value)
	const next = copy(state)
	const { vitals: v, player, maxHp } = resolve(next, targetId)
	if (!n || v.status === 'dead') return next
	const remainder = Math.max(0, n - v.tempHp)
	v.tempHp = Math.max(0, v.tempHp - n)
	if (!remainder) return next
	if (player && remainder - v.hp >= maxHp) v.status = 'dead'
	else if (player && v.hp === 0) {
		v.deathSaves.failures = Math.min(3, v.deathSaves.failures + 1)
		v.status = v.deathSaves.failures >= 3 ? 'dead' : 'unconscious'
	} else if (remainder >= v.hp) v.status = player ? 'unconscious' : 'dead'
	v.hp = Math.max(0, v.hp - remainder)
	return next
}
export function heal(state: GameState, targetId: string, value: number, maxHp?: number): GameState {
	const target = resolve(state, targetId)
	if (target.vitals.status === 'dead')
		throw new Error('Un participant mort ne peut pas recevoir de soins ordinaires.')
	const n = amount(value)
	if (!n) return state
	return updateVitals(state, targetId, { hp: Math.min(target.vitals.hp + n, maxHp ?? target.maxHp) }, maxHp)
}
export function sortedParticipants(state: GameState): Combatant[] {
	return [...(state.combat?.participants ?? [])]
		.filter((p) => getVitals(state, p).status !== 'removed')
		.sort((a, b) => b.initiative - a.initiative)
}
export function nextTurn(state: GameState): GameState {
	if (!state.combat || state.combat.status !== 'active') return state
	const order = sortedParticipants(state)
	if (!order.length) return state
	const next = copy(state)
	const index = order.findIndex((p) => p.id === state.combat!.activeId)
	const following = (index + 1) % order.length
	next.combat!.activeId = order[following]!.id
	if (index >= 0 && following === 0) next.combat!.round++
	return next
}
export function setInitiative(state: GameState, id: string, value: number): GameState {
	if (!Number.isFinite(value)) throw new Error('Initiative invalide.')
	const next = copy(state)
	const p = next.combat?.participants.find((p) => p.id === id)
	if (!p) throw new Error('Participant inconnu.')
	p.initiative = Math.trunc(value)
	return next
}
// Swaps a combatant with the tied one just above it; the stable sort keeps list order for ties.
export function promoteTie(state: GameState, id: string): GameState {
	const order = sortedParticipants(state)
	const index = order.findIndex((p) => p.id === id)
	const above = order[index - 1]
	const current = order[index]
	if (!state.combat || !above || !current || above.initiative !== current.initiative) return state
	const participants = [...state.combat.participants]
	const i = participants.indexOf(current)
	const j = participants.indexOf(above)
	;[participants[i], participants[j]] = [above, current]
	return { ...state, combat: { ...state.combat, participants } }
}
export function removeParticipant(state: GameState, id: string): GameState {
	return updateVitals(state, id, { status: 'removed' })
}
export function restoreParticipant(state: GameState, id: string): GameState {
	if (resolve(state, id).vitals.status !== 'removed') return state
	const next = copy(state)
	const { vitals, player } = resolve(next, id)
	vitals.status = restoredStatus(vitals, player)
	delete vitals.removedStatus
	if (next.combat?.status === 'active' && !next.combat.activeId)
		next.combat.activeId = sortedParticipants(next)[0]?.id ?? null
	return next
}
// shortcut: initiative 0 means "not rolled" (a legit rolled 0 is rerolled on a second press); upgrade: track a rolled flag.
const awaitingInitiative = (state: GameState) =>
	(state.combat?.participants ?? []).filter(
		(p) => p.type !== 'player' && p.initiative === 0 && getVitals(state, p).status !== 'removed',
	)
export const creaturesAwaitingInitiative = (state: GameState): number => awaitingInitiative(state).length
export function rollCreatureInitiatives(state: GameState, random = Math.random): GameState {
	if (!awaitingInitiative(state).length) return state
	const next = copy(state)
	for (const p of awaitingInitiative(next))
		p.initiative = rollDice([{ sides: 20, count: 1 }], p.initiativeBonus, random).total
	return next
}
export function setCondition(state: GameState, id: string, name: string, duration?: string): GameState {
	const next = copy(state)
	const v = resolve(next, id).vitals
	const index = v.conditions.findIndex((c) => c.name === name)
	if (index >= 0) v.conditions.splice(index, 1)
	else v.conditions.push({ name, ...(duration ? { duration } : {}) })
	return next
}
export function deathSave(
	state: GameState,
	id: string,
	result: 'success' | 'failure' | 'natural20' | 'natural1',
): GameState {
	const next = copy(state)
	const { vitals: v, player } = resolve(next, id)
	if (!player || v.hp > 0 || v.status !== 'unconscious') return state
	if (result === 'natural20') return updateVitals(next, id, { hp: 1 })
	if (result === 'success') v.deathSaves.successes = Math.min(3, v.deathSaves.successes + 1)
	else v.deathSaves.failures = Math.min(3, v.deathSaves.failures + (result === 'natural1' ? 2 : 1))
	if (v.deathSaves.failures >= 3) v.status = 'dead'
	else if (v.deathSaves.successes >= 3) {
		v.status = 'stable'
		v.deathSaves = { successes: 0, failures: 0 }
	}
	return next
}
export function resetEncounter(state: GameState, campaign: Campaign): GameState {
	if (!state.combat) return state
	campaign = campaignWithPlayers(campaign, state)
	const next = copy(state)
	for (const p of next.combat!.participants) {
		if (p.playerId) {
			next.players[p.playerId] = freshVitals(p.maxHp)
			const character = campaign.players.find((c) => c.id === p.playerId)!
			next.players[p.playerId]!.resources = Object.fromEntries(character.resources.map((r) => [r.id, r.max]))
		} else p.vitals = freshVitals(p.maxHp)
		p.initiative = 0
	}
	next.combat!.round = 1
	next.combat!.status = 'active'
	next.combat!.activeId = next.combat!.participants[0]?.id ?? null
	return next
}

export function campaignWithPlayers(campaign: Campaign, state: GameState): Campaign {
	const existing = new Set(campaign.players.map((p) => p.id))
	return {
		...campaign,
		players: [...campaign.players, ...(state.customPlayers ?? []).filter((p) => !existing.has(p.id))].map((p) => ({
			...p,
			combat: { ...p.combat, ...state.playerStats?.[p.id] },
		})),
	}
}
export function updateCombatStats(
	state: GameState,
	campaign: Campaign,
	targetId: string,
	patch: Partial<Pick<Combatant, 'maxHp' | 'armorClass' | 'initiativeBonus'>>,
): GameState {
	for (const [key, value] of Object.entries(patch))
		if (
			!['maxHp', 'armorClass', 'initiativeBonus'].includes(key) ||
			!Number.isSafeInteger(value) ||
			(key === 'maxHp'
				? value < 1
				: key === 'armorClass'
					? value < 0 || value > 100
					: value < -100 || value > 100)
		)
			throw new Error(
				'Statistiques : PV maximum positifs, CA de 0 à 100 et bonus d’initiative de −100 à 100, entiers requis.',
			)
	const next = copy(state)
	const participant = next.combat?.participants.find((p) => p.id === targetId)
	if (!participant) throw new Error('Participant inconnu.')
	Object.assign(participant, patch)
	const vitals = getVitals(next, participant)
	vitals.maxHp = participant.maxHp
	vitals.hp = Math.min(vitals.hp, participant.maxHp)
	if (participant.playerId) {
		const character = campaignWithPlayers(campaign, state).players.find((p) => p.id === participant.playerId)
		if (!character) throw new Error('Personnage inconnu.')
		next.playerStats = {
			...next.playerStats,
			[character.id]: {
				maxHp: participant.maxHp,
				armorClass: participant.armorClass,
				initiativeBonus: participant.initiativeBonus,
			},
		}
	}
	return next
}
export function updateSceneAddition(
	state: GameState,
	campaign: Campaign,
	sceneId: string,
	section: 'readAloud' | 'summary' | 'dmNotes' | 'dialogues',
	text: string,
): GameState {
	if (
		!campaign.chapters.some((c) => c.scenes.some((s) => s.id === sceneId)) ||
		!['readAloud', 'summary', 'dmNotes', 'dialogues'].includes(section) ||
		typeof text !== 'string'
	)
		throw new Error('Scène ou texte supplémentaire invalide.')
	return {
		...state,
		sceneAdditions: { ...state.sceneAdditions, [sceneId]: { ...state.sceneAdditions?.[sceneId], [section]: text } },
	}
}
export function addCustomPlayer(
	state: GameState,
	campaign: Campaign,
	input: { name: string; maxHp: number; armorClass: number; initiativeBonus: number },
): GameState {
	if (
		!input.name.trim() ||
		!Number.isSafeInteger(input.maxHp) ||
		input.maxHp < 1 ||
		!Number.isSafeInteger(input.armorClass) ||
		input.armorClass < 0 ||
		input.armorClass > 100 ||
		!Number.isSafeInteger(input.initiativeBonus) ||
		input.initiativeBonus < -100 ||
		input.initiativeBonus > 100
	)
		throw new Error('Personnage : nom, PV maximum positifs, CA et initiative entiers requis.')
	const id = `custom:${uid()}`
	if (campaignWithPlayers(campaign, state).players.some((p) => p.id === id))
		throw new Error('Identifiant de personnage dupliqué.')
	const player: Character = {
		id,
		name: input.name.trim(),
		race: null,
		class: null,
		level: null,
		abilities: null,
		combat: {
			maxHp: input.maxHp,
			armorClass: input.armorClass,
			initiativeBonus: input.initiativeBonus,
			speed: null,
		},
		skills: [],
		savingThrows: [],
		attacks: [],
		features: [],
		spells: [],
		inventory: [],
		resources: [],
		source: { type: 'custom', pages: [] },
	}
	return {
		...state,
		customPlayers: [...(state.customPlayers ?? []), player],
		players: { ...state.players, [id]: freshVitals(input.maxHp) },
	}
}
export function assignItem(state: GameState, campaign: Campaign, itemId: string, playerId: string): GameState {
	if (
		!campaign.items.some((i) => i.id === itemId) ||
		!campaignWithPlayers(campaign, state).players.some((p) => p.id === playerId)
	)
		throw new Error('Objet ou personnage inconnu.')
	// shortcut: one assignment per catalogue item; use reward instance IDs when source quantities are supplied.
	const previous = state.itemAssignments?.[itemId]
	if (previous === playerId) return state
	if (previous) throw new Error('Cette récompense est déjà attribuée.')
	return addJournal(
		{
			...state,
			inventory: state.inventory.includes(itemId) ? state.inventory : [...state.inventory, itemId],
			itemAssignments: { ...(state.itemAssignments ?? {}), [itemId]: playerId },
		},
		'Récompense attribuée',
		`${campaign.items.find((i) => i.id === itemId)!.name} → ${campaignWithPlayers(campaign, state).players.find((p) => p.id === playerId)!.name}`,
		'reward',
	)
}
