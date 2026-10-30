import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCampaign } from '../src/services/campaignLoader.ts'
import * as game from '../src/services/game.ts'

const { createInitialState, startEncounter, addCustomPlayer, campaignWithPlayers, assignItem, applyChoice, damage } =
	game

import { exportGame, importGame } from '../src/services/storageService.ts'
import { stormwreckData } from '../src/services/stormwreckData.ts'

test('blue wyrmling corrections initialize a usable encounter without mutating the catalogue', async () => {
	const campaign = await loadCampaign('/stormwreck-json/manifest.json')
	const dragon = campaign.indexes.monsters['dragon-bleu-jeune']
	const sourceDragon = stormwreckData.monsters.find((m) => m.id === dragon.id).statBlock
	const before = structuredClone(dragon)
	assert.equal(dragon.maxHp, 52)
	assert.equal(dragon.armorClass, 17)
	assert.equal(dragon.details.hitDice, sourceDragon.hitDice)
	const breath = dragon.details.actions.find((action) => action.name === 'Souffle de foudre')
	assert.equal(breath.damage, '4d10 dégâts de foudre')
	assert.equal(breath.saveDC, 12)
	assert.equal(breath.attackBonus, null)
	assert.equal(dragon.attacks.length, 1)
	assert.equal(dragon.requiresVerification, sourceDragon.requiresVerification)
	for (const id of ['enc-vrilleclair', 'enc-vrilleclair-ritual']) {
		const participant = stormwreckData.encounters
			.find((encounter) => encounter.id === id)
			.combatants.find((combatant) => combatant.monsterId === dragon.id)
		assert.equal(participant.defaultMaxHp, 52)
		assert.equal(participant.defaultArmorClass, 17)
	}
	let state = startEncounter(createInitialState(campaign), campaign, 'enc-vrilleclair')
	const participant = state.combat.participants.find((participant) => participant.monsterId === dragon.id)
	assert.equal(participant.maxHp, 52)
	assert.equal(participant.armorClass, 17)
	assert.equal(participant.vitals.hp, 52)
	state = damage(state, participant.id, 5)
	assert.equal(state.combat.participants.find((p) => p.id === participant.id).vitals.hp, 47)
	assert.deepEqual(campaign.indexes.monsters[dragon.id], before)
	assert.deepEqual(importGame(exportGame(state), campaign), state)
})

test('bundled real campaign preserves source unknowns and supports prepared persistent sessions', async () => {
	const campaign = await loadCampaign('/stormwreck-json/manifest.json')
	assert.equal(campaign.manifest.id, 'dragons-ile-aux-tempetes')
	assert.deepEqual(
		campaign.chapters.map((c) => c.scenes.length),
		[13, 8, 13, 10],
	)
	assert.equal(campaign.monsters.length, 18)
	assert.deepEqual(campaign.indexes.scenes['ch01-drowned'].source.files[0].pages, [7])
	assert.ok(campaign.encounters[0].source.files.length)
	assert.equal(campaign.chapters[0].scenes[0].readAloud, null)
	assert.equal(campaign.monsters.find((m) => m.id === 'guivre-follette').maxHp, 22)
	let state = addCustomPlayer(createInitialState(campaign), campaign, {
		name: 'PJ manuel',
		maxHp: 12,
		armorClass: 15,
		initiativeBonus: 2,
	})
	const effective = campaignWithPlayers(campaign, state)
	state = startEncounter(state, effective, 'enc-drowned-sailors')
	assert.equal(new Set(state.combat.participants.map((p) => p.id)).size, 4)
	const monster = state.combat.participants.find((p) => p.monsterId)
	state = damage(state, monster.id, 3)
	assert.equal(campaign.monsters.find((m) => m.id === 'zombie').maxHp, 22)
	assert.deepEqual(importGame(exportGame(state), campaign), state)
	state = assignItem(state, effective, 'arme-plus-1', effective.players[0].id)
	assert.equal(assignItem(state, effective, 'arme-plus-1', effective.players[0].id), state)
	assert.deepEqual(importGame(exportGame(state), campaign), state)
	state = { ...state, combat: null }
	const choice = campaign.chapters[0].scenes[0].choices[0]
	state = applyChoice(state, effective, choice)
	assert.equal(state.activeSceneId, choice.nextSceneId)
	assert.equal(applyChoice(state, effective, choice), state)
	assert.deepEqual(importGame(exportGame(state), effective), state)
})

test('DM-confirmed missing group quantities initialize independent persistent participants', async () => {
	const campaign = await loadCampaign('/stormwreck-json/manifest.json')
	const confirmed = [
		['enc-hot-springs', 'guivre-follette'],
		['enc-violet-fungi', 'thallophyte-violette'],
		['enc-observatory-rotunda', 'kobold'],
		['enc-observatory-rotunda', 'strige'],
		['enc-vrilleclair-ritual', 'kobold'],
	]
	for (const [encounterId, monsterId] of confirmed) {
		const source = stormwreckData.encounters
			.find((e) => e.id === encounterId)
			.combatants.find((p) => p.monsterId === monsterId)
		assert.equal(source.quantity, 3, `${encounterId}: ${monsterId}`)
		assert.equal(source.quantityStatus, 'dm_confirmed')
	}
	assert.deepEqual(
		campaign.encounters.find((e) => e.id === 'enc-wreck-lower').participants.map((p) => [p.monsterId, p.count]),
		[
			['goule', 1],
			['zombie', 1],
		],
	)
	assert.equal(campaign.indexes.monsters['mort-vivant'], undefined)
	assert.deepEqual(
		campaign.encounters.find((e) => e.id === 'enc-hostile-kobolds').participants.map((p) => p.count),
		[4, 1],
	)
	assert.deepEqual(
		campaign.encounters.find((e) => e.id === 'enc-crystal-cave').participants.map((p) => p.count),
		[2, 1],
	)
	for (const [encounterId, monsterId] of confirmed.slice(0, 2)) {
		const monster = campaign.indexes.monsters[monsterId]
		const before = structuredClone(monster)
		let state = startEncounter(createInitialState(campaign), campaign, encounterId)
		const participants = state.combat.participants
		assert.equal(participants.length, 3)
		assert.equal(new Set(participants.map((p) => p.id)).size, 3)
		for (const p of participants) {
			assert.equal(p.monsterId, monsterId)
			assert.equal(p.maxHp, monster.maxHp)
			assert.equal(p.armorClass, monster.armorClass)
			assert.equal(p.vitals.hp, monster.maxHp)
		}
		state = damage(state, participants[0].id, 3)
		assert.equal(state.combat.participants[1].vitals.hp, monster.maxHp)
		assert.deepEqual(campaign.indexes.monsters[monsterId], before)
		assert.deepEqual(importGame(exportGame(state), campaign), state)
	}
})
