import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { loadCampaign } from '../src/services/campaignLoader.ts'
import * as game from '../src/services/game.ts'
import { exportGame, importGame } from '../src/services/storageService.ts'

test('combat stat edits persist for players and stay isolated for monsters', async () => {
	assert.equal(typeof game.updateCombatStats, 'function')
	const campaign = await loadCampaign('/stormwreck-json/manifest.json')
	let state = game.addCustomPlayer(game.createInitialState(campaign), campaign, {
		name: 'Test',
		maxHp: 20,
		armorClass: 12,
		initiativeBonus: 2,
	})
	state = game.startEncounter(state, campaign, 'enc-wreck-lower')
	const pc = state.combat!.participants.find((p) => p.playerId)!
	const monster = state.combat!.participants.find((p) => p.monsterId)!
	const original = structuredClone(campaign.monsters)
	state = game.updateCombatStats(state, campaign, pc.id, { maxHp: 10, armorClass: 17, initiativeBonus: 5 })
	assert.equal(state.players[pc.playerId!].hp, 10)
	assert.equal(game.campaignWithPlayers(campaign, state).players[0].combat.armorClass, 17)
	state = game.updateCombatStats(state, campaign, monster.id, { maxHp: 8, armorClass: 20, initiativeBonus: -2 })
	assert.equal(state.combat!.participants.find((p) => p.id === monster.id)!.vitals!.hp, 8)
	assert.deepEqual(importGame(exportGame(state), campaign), state)
	assert.deepEqual(campaign.monsters, original)
	assert.throws(() => game.updateCombatStats(state, campaign, pc.id, { maxHp: 0 }))
	state = game.startEncounter(game.finishEncounter(state), campaign)
	assert.equal(state.combat!.participants[0].maxHp, 10)
	assert.equal(state.combat!.participants[0].initiativeBonus, 5)
})

test('scene additions roundtrip independently of campaign text and reject malformed saves', async () => {
	assert.equal(typeof game.updateSceneAddition, 'function')
	const campaign = await loadCampaign('/stormwreck-json/manifest.json')
	const before = structuredClone(campaign.chapters)
	let state = game.createInitialState(campaign)
	for (const section of ['readAloud', 'summary', 'dmNotes', 'dialogues'] as const)
		state = game.updateSceneAddition(state, campaign, state.activeSceneId, section, 'Texte MJ\nSuite')
	assert.deepEqual(importGame(exportGame(state), campaign), state)
	assert.deepEqual(campaign.chapters, before)
	assert.throws(() =>
		importGame(JSON.stringify({ ...state, sceneAdditions: { missing: { summary: 'bad' } } }), campaign),
	)
	assert.throws(() =>
		importGame(JSON.stringify({ ...state, sceneAdditions: { [state.activeSceneId]: { summary: 3 } } }), campaign),
	)
})

test('stat edits after a narrative choice preserve valid undo snapshots on reload', async () => {
	const campaign = await loadCampaign('/stormwreck-json/manifest.json')
	const added = game.addCustomPlayer(game.createInitialState(campaign), campaign, {
		name: 'Test',
		maxHp: 20,
		armorClass: 12,
		initiativeBonus: 2,
	})
	campaign.players = [{ ...added.customPlayers![0], id: 'source-pc' }]
	let state = game.createInitialState(campaign)
	const choice = campaign.chapters
		.flatMap((c) => c.scenes.flatMap((s) => s.choices))
		.find((ch) => game.canChoose(state, ch) && !ch.effects.some((e) => e.type === 'start_encounter'))!
	state = game.applyChoice(state, campaign, choice)
	state = game.startEncounter(state, campaign)
	state = game.updateCombatStats(state, campaign, state.combat!.participants[0].id, { maxHp: 10 })
	assert.deepEqual(importGame(exportGame(state), campaign), state)
})

test('save import uses source campaign so pre-edit source-player saves remain valid', async () => {
	const campaign = await loadCampaign('/stormwreck-json/manifest.json')
	const added = game.addCustomPlayer(game.createInitialState(campaign), campaign, {
		name: 'Test',
		maxHp: 20,
		armorClass: 12,
		initiativeBonus: 2,
	})
	campaign.players = [{ ...added.customPlayers![0], id: 'source-pc' }]
	const original = game.startEncounter(game.createInitialState(campaign), campaign)
	const oldSave = exportGame(original)
	const edited = game.updateCombatStats(original, campaign, original.combat!.participants[0].id, { maxHp: 10 })
	assert.equal(game.campaignWithPlayers(campaign, edited).players[0].combat.maxHp, 10)
	assert.throws(() => importGame(oldSave, game.campaignWithPlayers(campaign, edited)))
	assert.deepEqual(importGame(oldSave, campaign), original)
	const app = await readFile(new URL('../src/app.tsx', import.meta.url), 'utf8')
	assert.match(app, /importGame\(await file\.text\(\), staticCampaign!\)/)
})
