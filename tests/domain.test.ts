import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { validateCampaign } from '../src/services/campaignLoader.ts'
import {
	applyChoice,
	canChoose,
	createInitialState,
	creaturesAwaitingInitiative,
	damage,
	deathSave,
	getVitals,
	heal,
	nextTurn,
	promoteTie,
	removeParticipant,
	restoreParticipant,
	rollCreatureInitiatives,
	setCondition,
	setInitiative,
	sortedParticipants,
	startEncounter,
	undoChoice,
	updateVitals,
} from '../src/services/game.ts'
import { exportGame, importGame, loadGame, saveGame, storageKey } from '../src/services/storageService.ts'
import type { Campaign } from '../src/types.ts'

async function fixture(): Promise<Campaign> {
	const root = new URL('./fixtures/demo-campaign/', import.meta.url)
	const read = async (path: string) => JSON.parse(await readFile(new URL(path, root), 'utf8'))
	const manifest = await read('manifest.json')
	return validateCampaign({
		manifest,
		chapters: await Promise.all(manifest.chapters.map(read)),
		players: await read(manifest.players),
		monsters: await read(manifest.monsters),
		encounters: await read(manifest.encounters),
		locations: await read(manifest.locations),
		items: await read(manifest.items),
		npcs: await read(manifest.npcs),
	})
}
test('temporary HP absorb damage; healing capped; player HP shared and death saves apply', async () => {
	const campaign = await fixture()
	let state = startEncounter(createInitialState(campaign), campaign, campaign.encounters[0]!.id)
	const player = state.combat!.participants.find((p) => p.playerId)!
	state.players[player.playerId!]!.tempHp = 5
	state = damage(state, player.id, 8)
	assert.equal(getVitals(state, player).hp, player.maxHp - 3)
	assert.equal(state.players[player.playerId!]!.tempHp, 0)
	state = heal(state, player.id, 999)
	assert.equal(getVitals(state, player).hp, player.maxHp)
	state = damage(state, player.id, player.maxHp)
	assert.equal(getVitals(state, player).status, 'unconscious')
	state = deathSave(state, player.id, 'natural20')
	assert.equal(getVitals(state, player).hp, 1)
})
test('initiative round advances and repeated monster instances unique; save roundtrips', async () => {
	const c = await fixture()
	let s = startEncounter(createInitialState(c), c, c.encounters[0]!.id)
	assert.equal(new Set(s.combat!.participants.map((p) => p.id)).size, s.combat!.participants.length)
	for (let i = 0; i < s.combat!.participants.length; i++) s = nextTurn(s)
	assert.equal(s.combat!.round, 2)
	assert.deepEqual(importGame(exportGame(s), c), s)
	assert.throws(() => importGame('{bad', c))
	assert.throws(() => importGame(JSON.stringify({ ...s, activeSceneId: 'missing' }), c))
})
test('narrative choice idempotent and immediately reversible', async () => {
	const c = await fixture()
	const initial = createInitialState(c)
	const choice = c.chapters[0]!.scenes[0]!.choices[0]!
	const applied = applyChoice(initial, c, choice)
	assert.equal(applied.flags.demo_mission, true)
	assert.deepEqual(applyChoice(applied, c, choice), applied)
	assert.equal(undoChoice(applied).flags.demo_mission, undefined)
})
test('massive damage kills at zero; temporary HP absorbing all damage preserves stable state', async () => {
	const c = await fixture()
	let s = startEncounter(createInitialState(c), c, c.encounters[0]!.id)
	const p = s.combat!.participants[0]!
	s.players[p.playerId!]!.hp = 0
	s.players[p.playerId!]!.status = 'stable'
	s.players[p.playerId!]!.tempHp = 5
	s = damage(s, p.id, 3)
	assert.equal(getVitals(s, p).status, 'stable')
	s = damage(s, p.id, p.maxHp + 2)
	assert.equal(getVitals(s, p).status, 'dead')
})

test('narrative conditions gate choices and all declared effects preserve earlier journal entries', async () => {
	const c = await fixture()
	const state = createInitialState(c)
	const nextScene = c.chapters[1]!.scenes[0]!
	const item = c.items[0]!
	const npc = c.npcs[0]!
	const encounter = c.encounters[0]!
	const choice = {
		id: 'test-all-effects',
		label: 'Do everything',
		conditions: [{ type: 'flag', key: 'ready', operator: 'equals', value: true }],
		effects: [
			{ type: 'set_flag', key: 'done', value: true },
			{ type: 'unlock_scene', sceneId: nextScene.id },
			{ type: 'set_quest', key: 'quest', value: 'complete' },
			{ type: 'add_item', itemId: item.id },
			{ type: 'relationship', npcId: npc.id, value: 2 },
			{ type: 'journal', title: 'Story event', description: 'Recorded' },
			{ type: 'start_encounter', encounterId: encounter.id },
		],
	} as const
	const blocked = {
		...choice,
		id: 'condition-gate',
		conditions: [
			{ type: 'scene', sceneId: nextScene.id, status: 'completed' },
			{ type: 'quest', key: 'quest', value: 'complete' },
		],
	} as typeof choice
	assert.equal(canChoose(state, blocked), false)
	const withHistory = {
		...state,
		flags: { ready: true },
		journal: [
			{ id: 'prior', date: new Date().toISOString(), type: 'note', title: 'Prior', description: 'Keep me' },
		],
	}
	const applied = applyChoice(withHistory, c, choice as never)
	assert.equal(applied.flags.done, true)
	assert.ok(applied.unlockedScenes.includes(nextScene.id))
	assert.equal(applied.quests.quest, 'complete')
	assert.ok(applied.inventory.includes(item.id))
	assert.equal(applied.relationships[npc.id], 2)
	assert.deepEqual(
		applied.journal.map((entry) => entry.title),
		['Prior', 'Story event', `Rencontre : ${encounter.name}`, choice.label],
	)
	assert.deepEqual(applyChoice(applied, c, choice as never), applied)
	const undone = undoChoice(applied)
	assert.deepEqual(undone.journal, withHistory.journal)
	assert.deepEqual(undone.flags, withHistory.flags)
})

test('combat tie order is stable; removing the active participant skips forward without advancing a round', async () => {
	const c = await fixture()
	// Deterministic rolls: tied creatures keep list order, so the active one is never last in the order.
	let state = startEncounter(createInitialState(c), c, c.encounters[0]!.id, { random: () => 0.5 })
	const participants = state.combat!.participants
	for (const participant of participants)
		state = {
			...state,
			combat: {
				...state.combat!,
				participants: state.combat!.participants.map((p) =>
					p.id === participant.id ? { ...p, initiative: 10 } : p,
				),
			},
		}
	const before = state.combat!.activeId!
	state = removeParticipant(state, before)
	assert.equal(getVitals(state, state.combat!.participants.find((p) => p.id === before)!).status, 'removed')
	assert.notEqual(state.combat!.activeId, before)
	assert.equal(state.combat!.round, 1)
	assert.equal(
		nextTurn({
			...state,
			combat: { ...state.combat!, activeId: state.combat!.participants.find((p) => p.id !== before)!.id },
		}).combat!.round,
		1,
	)
})

test('conditions retain their duration and can be removed', async () => {
	const c = await fixture()
	let state = startEncounter(createInitialState(c), c, c.encounters[0]!.id)
	const player = state.combat!.participants.find((p) => p.playerId)!
	state = setCondition(state, player.id, 'Aveuglé', '1 round')
	state = setCondition(state, player.id, 'Aveuglé')
	assert.deepEqual(getVitals(state, player).conditions, [])
})

test('player HP is one shared value addressable through player id or combatant id', async () => {
	const c = await fixture()
	let state = startEncounter(createInitialState(c), c, c.encounters[0]!.id)
	const player = state.combat!.participants.find((p) => p.playerId)!
	state = damage(state, player.id, 2)
	assert.equal(getVitals(state, player).hp, state.players[player.playerId!]!.hp)
	state = heal(state, player.playerId!, 1)
	assert.equal(getVitals(state, player).hp, state.players[player.playerId!]!.hp)
})

test('a player removed from one combat can join a later encounter with HP preserved', async () => {
	const c = await fixture()
	let state = startEncounter(createInitialState(c), c, c.encounters[0]!.id)
	const player = state.combat!.participants.find((p) => p.playerId)!
	state = damage(state, player.id, 2)
	state = setCondition(state, player.id, 'Aveuglé', '1 round')
	state = removeParticipant(state, player.id)
	state = { ...state, combat: { ...state.combat!, status: 'finished' } }
	state = startEncounter(state, c)
	const returning = state.combat!.participants.find((p) => p.playerId === player.playerId)!
	assert.ok(sortedParticipants(state).some((p) => p.id === returning.id))
	assert.equal(getVitals(state, returning).hp, player.maxHp - 2)
	assert.deepEqual(getVitals(state, returning).conditions, [{ name: 'Aveuglé', duration: '1 round' }])
	assert.equal(getVitals(state, returning).status, 'active')
})

test('temporary HP are kept as whole points and resource counts reject invalid values', async () => {
	const c = await fixture()
	const state = createInitialState(c)
	const playerId = c.players[0]!.id
	const fractional = updateVitals(state, playerId, { tempHp: 2.8 })
	assert.equal(fractional.players[playerId]!.tempHp, 2)
	assert.throws(() => updateVitals(state, playerId, { resources: { spellSlot: -1 } }), /ressource|positif|invalide/i)
	assert.throws(() => updateVitals(state, playerId, { resources: { spellSlot: 1.5 } }), /ressource|entier|invalide/i)
})

test('removing the active participant in a suspended encounter moves activeId', async () => {
	const c = await fixture()
	let state = startEncounter(createInitialState(c), c, c.encounters[0]!.id)
	const current = state.combat!.participants.find((p) => p.id === state.combat!.activeId)!
	state = { ...state, combat: { ...state.combat!, status: 'suspended' } }
	state = removeParticipant(state, current.id)
	assert.notEqual(state.combat!.activeId, current.id)
	assert.ok(sortedParticipants(state).some((p) => p.id === state.combat!.activeId))
})

test('corrupt localStorage falls back without overwriting the saved bytes; campaign slots stay isolated', async () => {
	const c = await fixture()
	const records = new Map<string, string>()
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			getItem: (key: string) => records.get(key) ?? null,
			setItem: (key: string, value: string) => {
				records.set(key, value)
			},
		},
	})
	const damaged = '{not json'
	records.set(storageKey(c.manifest.id), damaged)
	const loaded = loadGame(c)
	assert.ok(loaded.error)
	assert.equal(loaded.state.campaignId, c.manifest.id)
	assert.equal(records.get(storageKey(c.manifest.id)), damaged)
	const state = createInitialState(c)
	assert.equal(saveGame(state, '2'), null)
	assert.equal(records.get(storageKey(c.manifest.id, '2')), exportGame(state))
	assert.equal(records.get(storageKey('another-campaign', '2')), undefined)
})

test('save validation rejects unknown versions and bad campaign references', async () => {
	const c = await fixture()
	const state = createInitialState(c)
	assert.throws(() => importGame(JSON.stringify({ ...state, version: 77 }), c), /invalide|incompatible/)
	assert.throws(
		() => importGame(JSON.stringify({ ...state, inventory: ['missing-item'] }), c),
		/invalide|incompatible/,
	)
	assert.throws(
		() =>
			importGame(
				JSON.stringify({
					...state,
					players: {
						...state.players,
						[c.players[0]!.id]: { ...state.players[c.players[0]!.id]!, conditions: [{ name: '' }] },
					},
				}),
				c,
			),
		/invalide|incompatible/,
	)
	assert.deepEqual(importGame(JSON.stringify({ ...state, version: 0 }), c), state)
})

test('campaign validation rejects missing and duplicate identifiers and dangling references', async () => {
	const c = await fixture()
	const missingId = structuredClone(c) as unknown as Record<string, any>
	delete missingId.chapters[0].scenes[0].id
	assert.throws(() => validateCampaign(missingId), /identifiant absent/)
	const duplicateId = structuredClone(c) as unknown as Record<string, any>
	duplicateId.chapters[1].scenes[0].id = duplicateId.chapters[0].scenes[0].id
	assert.throws(() => validateCampaign(duplicateId), /dupliqué/)
	const dangling = structuredClone(c) as unknown as Record<string, any>
	dangling.chapters[0].scenes[0].transitions.push({ sceneId: 'missing-scene', label: 'Go' })
	assert.throws(() => validateCampaign(dangling), /scène inconnu/)
	const badSource = structuredClone(c) as unknown as Record<string, any>
	badSource.chapters[0].scenes[0].source.pages = ['not-a-page']
	assert.throws(() => validateCampaign(badSource), /invalide/)
})

test('removing stable or dead players preserves their status in the next encounter', async () => {
	const c = await fixture()
	let state = startEncounter(createInitialState(c), c, c.encounters[0]!.id)
	const [stable, dead] = state.combat!.participants.filter((p) => p.playerId)
	state = damage(state, stable!.id, stable!.maxHp)
	state = deathSave(state, stable!.id, 'success')
	state = deathSave(state, stable!.id, 'success')
	state = deathSave(state, stable!.id, 'success')
	state = damage(state, dead!.id, dead!.maxHp * 2)
	assert.equal(getVitals(state, stable!).status, 'stable')
	assert.equal(getVitals(state, dead!).status, 'dead')
	state = removeParticipant(state, stable!.id)
	state = removeParticipant(state, dead!.id)
	const restored = importGame(exportGame(state), c)
	assert.equal(
		getVitals(restored, restored.combat!.participants.find((p) => p.playerId === stable!.playerId)!).removedStatus,
		'stable',
	)
	assert.equal(
		getVitals(restored, restored.combat!.participants.find((p) => p.playerId === dead!.playerId)!).removedStatus,
		'dead',
	)
	state = { ...state, combat: { ...state.combat!, status: 'finished' } }
	state = startEncounter(state, c)
	assert.equal(
		getVitals(state, state.combat!.participants.find((p) => p.playerId === stable!.playerId)!).status,
		'stable',
	)
	assert.equal(
		getVitals(state, state.combat!.participants.find((p) => p.playerId === dead!.playerId)!).status,
		'dead',
	)
})
test('promoteTie moves a combatant above its tied neighbour only', async () => {
	const c = await fixture()
	let s = startEncounter(createInitialState(c), c, c.encounters[0]!.id)
	for (const p of s.combat!.participants) s = setInitiative(s, p.id, 10)
	const [first, second] = sortedParticipants(s).map((p) => p.id)
	assert.equal(promoteTie(s, first!), s)
	s = promoteTie(s, second!)
	assert.deepEqual(
		sortedParticipants(s)
			.slice(0, 2)
			.map((p) => p.id),
		[second, first],
	)
	s = setInitiative(s, first!, 9)
	assert.equal(promoteTie(s, first!), s)
})

const half = () => 0.5 // d20 -> 11
const training = async () => {
	const c = await fixture()
	return { c, state: startEncounter(createInitialState(c), c, 'demo-training', { random: half }) }
}

test('restoreParticipant returns the status held before removal', async () => {
	const { state: start } = await training()
	const [active, down, stable] = start.combat!.participants.filter((p) => p.playerId)
	let state = damage(start, down!.id, down!.maxHp)
	state = damage(state, stable!.id, stable!.maxHp)
	for (const result of ['success', 'success', 'success'] as const) state = deathSave(state, stable!.id, result)
	const before = [active, down, stable].map((p) => getVitals(state, p!).status)
	assert.deepEqual(before, ['active', 'unconscious', 'stable'])
	for (const p of [active, down, stable]) state = removeParticipant(state, p!.id)
	for (const p of [active, down, stable]) assert.equal(getVitals(state, p!).status, 'removed')
	for (const p of [active, down, stable]) state = restoreParticipant(state, p!.playerId!)
	assert.deepEqual(
		[active, down, stable].map((p) => getVitals(state, p!).status),
		before,
	)
	for (const p of [active, down, stable]) assert.equal(getVitals(state, p!).removedStatus, undefined)
	const monster = state.combat!.participants.find((p) => !p.playerId)!
	state = restoreParticipant(removeParticipant(state, monster.id), monster.id)
	assert.equal(getVitals(state, monster).status, 'active')
})

test('restoreParticipant is a no-op unless the target is removed', async () => {
	const { state } = await training()
	const player = state.combat!.participants.find((p) => p.playerId)!
	assert.equal(restoreParticipant(state, player.id), state)
	assert.throws(() => restoreParticipant(state, 'missing'), /inconnu/)
})

test('restoreParticipant revives an empty turn order but otherwise keeps round and active turn', async () => {
	const { state: start } = await training()
	const ids = start.combat!.participants.map((p) => p.id)
	let state = start
	for (const id of ids) state = removeParticipant(state, id)
	assert.equal(state.combat!.activeId, null)
	assert.equal(sortedParticipants(state).length, 0)
	state = restoreParticipant(state, ids[1]!)
	assert.equal(state.combat!.activeId, ids[1])
	const { round } = state.combat!
	state = restoreParticipant(state, ids[0]!)
	assert.equal(state.combat!.activeId, ids[1])
	assert.equal(state.combat!.round, round)
})

test('rollCreatureInitiatives rolls only unrolled, non-removed creatures', async () => {
	let { state } = await training()
	const [first, second] = state.combat!.participants.filter((p) => !p.playerId)
	assert.equal(rollCreatureInitiatives(state, half), state)
	state = setInitiative(setInitiative(state, first!.id, 0), second!.id, 7)
	state = removeParticipant(state, first!.id)
	assert.equal(creaturesAwaitingInitiative(state), 0)
	state = restoreParticipant(state, first!.id)
	assert.equal(creaturesAwaitingInitiative(state), 1)
	state = rollCreatureInitiatives(state, () => 0)
	const byId = (id: string) => state.combat!.participants.find((p) => p.id === id)!
	assert.equal(byId(first!.id).initiative, 2)
	assert.equal(byId(second!.id).initiative, 7)
	for (const p of state.combat!.participants.filter((p) => p.playerId)) assert.equal(byId(p.id).initiative, 0)
})

test('rollCreatureInitiatives never changes the active turn, in any round', async () => {
	const { state: start } = await training()
	const creature = start.combat!.participants.find((p) => !p.playerId)!
	const player = start.combat!.participants.find((p) => p.playerId)!
	let state = setInitiative(start, creature.id, 0)
	state = { ...state, combat: { ...state.combat!, activeId: player.id } }
	const rolled = rollCreatureInitiatives(state, half)
	assert.equal(rolled.combat!.participants.find((p) => p.id === creature.id)!.initiative, 12)
	assert.equal(sortedParticipants(rolled)[0]!.id === player.id, false)
	assert.equal(rolled.combat!.activeId, player.id)
	state = { ...state, combat: { ...state.combat!, round: 2 } }
	assert.equal(rollCreatureInitiatives(state, half).combat!.activeId, player.id)
})

test('restoring a PJ removed while dead or dying keeps that status and its death saves', async () => {
	const { state: start } = await training()
	const [dying, dead] = start.combat!.participants.filter((p) => p.playerId)
	let state = damage(start, dying!.id, dying!.maxHp)
	state = deathSave(deathSave(deathSave(state, dying!.id, 'success'), dying!.id, 'failure'), dying!.id, 'failure')
	state = damage(state, dead!.id, dead!.maxHp)
	for (const result of ['failure', 'failure', 'failure'] as const) state = deathSave(state, dead!.id, result)
	assert.equal(getVitals(state, dead!).status, 'dead')
	state = updateVitals(state, dying!.playerId!, { status: 'removed' })
	state = removeParticipant(state, dead!.id)
	state = restoreParticipant(restoreParticipant(state, dying!.id), dead!.playerId!)
	assert.equal(getVitals(state, dying!).status, 'unconscious')
	assert.deepEqual(getVitals(state, dying!).deathSaves, { successes: 1, failures: 2 })
	assert.equal(getVitals(state, dead!).status, 'dead')
	assert.deepEqual(getVitals(state, dead!).deathSaves, { successes: 0, failures: 3 })
})

test('manually reviving a dead PJ to unconscious resets its death saves, so one success does not kill it again', async () => {
	const { state: start } = await training()
	const pj = start.combat!.participants.find((p) => p.playerId)!
	let state = damage(start, pj.id, pj.maxHp)
	for (const result of ['failure', 'failure', 'failure'] as const) state = deathSave(state, pj.id, result)
	assert.equal(getVitals(state, pj).status, 'dead')
	state = updateVitals(state, pj.id, { status: 'unconscious' })
	assert.equal(getVitals(state, pj).status, 'unconscious')
	assert.deepEqual(getVitals(state, pj).deathSaves, { successes: 0, failures: 0 })
	state = deathSave(state, pj.id, 'success')
	assert.equal(getVitals(state, pj).status, 'unconscious')
	assert.deepEqual(getVitals(state, pj).deathSaves, { successes: 1, failures: 0 })
})

test('manually setting a dying PJ to stable resets its death saves', async () => {
	const { state: start } = await training()
	const pj = start.combat!.participants.find((p) => p.playerId)!
	let state = damage(start, pj.id, pj.maxHp)
	state = deathSave(deathSave(state, pj.id, 'success'), pj.id, 'failure')
	state = updateVitals(state, pj.id, { status: 'stable' })
	assert.equal(getVitals(state, pj).status, 'stable')
	assert.deepEqual(getVitals(state, pj).deathSaves, { successes: 0, failures: 0 })
})

test('a creature removed by an older save (no removedStatus) at 0 HP comes back dead, not unconscious', async () => {
	const { state: start } = await training()
	const monster = start.combat!.participants.find((p) => !p.playerId)!
	let state = damage(start, monster.id, monster.maxHp)
	state = removeParticipant(state, monster.id)
	const current = (s: typeof state) => getVitals(s, s.combat!.participants.find((p) => p.id === monster.id)!)
	assert.equal(current(state).removedStatus, 'dead')
	delete current(state).removedStatus
	state = restoreParticipant(state, monster.id)
	assert.equal(current(state).status, 'dead')
})

test('rollCreatureInitiatives applies a negative bonus and may produce a negative initiative', async () => {
	const c = await fixture()
	const state = startEncounter(createInitialState(c), c, 'demo-training', {
		random: () => 0,
		participantOverrides: { 0: { count: 1, initiativeBonus: -3 } },
	})
	const creature = state.combat!.participants.find((p) => !p.playerId)!
	assert.equal(creature.initiative, -2)
	assert.equal(creaturesAwaitingInitiative(state), 0)
	assert.equal(state.combat!.activeId, sortedParticipants(state)[0]!.id)
	assert.notEqual(state.combat!.activeId, creature.id)
})

test('restoring into an emptied suspended combat leaves no active turn until play resumes', async () => {
	const { state: start } = await training()
	const ids = start.combat!.participants.map((p) => p.id)
	let state: typeof start = { ...start, combat: { ...start.combat!, status: 'suspended' } }
	for (const id of ids) state = removeParticipant(state, id)
	state = restoreParticipant(state, ids[0]!)
	assert.equal(state.combat!.activeId, null)
	assert.equal(nextTurn(state), state)
	state = nextTurn({ ...state, combat: { ...state.combat!, status: 'active' } })
	assert.equal(state.combat!.activeId, ids[0])
	assert.equal(state.combat!.round, 1)
})

test('startEncounter rolls creature initiative and leaves players at 0', async () => {
	const { state } = await training()
	const { participants, activeId } = state.combat!
	for (const p of participants) assert.equal(p.initiative, p.playerId ? 0 : 12)
	assert.equal(activeId, sortedParticipants(state)[0]!.id)
	assert.equal(participants.find((p) => p.id === activeId)!.playerId, undefined)
	assert.equal(creaturesAwaitingInitiative(state), 0)
})
