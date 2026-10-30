import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCampaign } from '../src/services/campaignLoader.ts'
import {
	addCustomPlayer,
	addParticipant,
	applyChoice,
	assignItem,
	campaignWithPlayers,
	createInitialState,
	damage,
	resetEncounter,
	setInitiative,
	startEncounter,
} from '../src/services/game.ts'
import { exportGame, importGame, loadGame, saveGame, storageKey } from '../src/services/storageService.ts'
import { normalizeStormwreck } from '../src/services/stormwreckAdapter.ts'
import { stormwreckData } from '../src/services/stormwreckData.ts'

const campaign = () => loadCampaign('/stormwreck-json/manifest.json')

test('Stormwreck import preserves chapter zones, page sources, and absent read-aloud text', async () => {
	const c = await campaign()
	assert.deepEqual(
		c.chapters.map((chapter) => chapter.scenes.length),
		[13, 8, 13, 10],
	)
	assert.equal(new Set(c.chapters.flatMap((chapter) => chapter.scenes.map((scene) => scene.id))).size, 44)
	for (const zone of ['A1', 'A2', 'A3', 'A4', 'A5'])
		assert.ok(
			c.chapters[0]!.scenes.some((scene) => scene.title.includes(zone)),
			`missing zone ${zone}`,
		)
	for (const [chapterIndex, zones] of [
		[1, ['B1', 'B6']],
		[2, ['C1', 'C9']],
		[3, ['D1', 'D5']],
	] as const)
		for (const zone of zones)
			assert.ok(
				c.chapters[chapterIndex]!.scenes.some((scene) => scene.title.includes(zone)),
				`missing zone ${zone}`,
			)
	assert.ok(!c.chapters[3]!.scenes.some((scene) => scene.title.includes('D6')), 'do not invent missing zone D6')
	const sourceScene = c.indexes!.scenes['ch02-approach']!
	assert.deepEqual(sourceScene.source.pages, [16, 17])
	assert.deepEqual(sourceScene.source.files, [{ file: 'Chapitre 2-0.pdf', pages: [16, 17] }])
	assert.equal(c.indexes!.scenes['ch01-arrival']!.readAloud, null)
})

test('dangling campaign references warn without blocking and undocumented choice effects stay inert', () => {
	const fixture = structuredClone(stormwreckData) as typeof stormwreckData
	const firstScene = (fixture.chapters[0] as unknown as { scenes: Record<string, unknown>[] }).scenes[0]!
	firstScene.locationId = 'missing-location'
	firstScene.choices = [
		{
			id: 'manual-only',
			label: 'Décision à arbitrer',
			conditions: [{ type: 'unknown-condition', secret: true }],
			effects: [{ type: 'unknown-effect', key: 'should_not_apply', value: true }],
		},
	]
	const normalized = normalizeStormwreck(fixture)
	assert.ok(normalized.warnings!.some((warning) => warning.includes('missing-location')))
	const choice = normalized.chapters[0]!.scenes[0]!.choices[0]!
	assert.equal(choice.manual, true)
	assert.deepEqual(choice.effects, [])
	const applied = applyChoice(createInitialState(normalized), normalized, choice)
	assert.equal(applied.flags.should_not_apply, undefined)
})

test('unknown monster quantities require explicit instance stats and overrides leave the catalogue untouched', async () => {
	const c = await campaign()
	const initial = createInitialState(c)
	const missingQuantity = structuredClone(c)
	missingQuantity.encounters.find((e) => e.id === 'enc-hot-springs')!.participants[0]!.count = null
	assert.throws(() => startEncounter(initial, missingQuantity, 'enc-hot-springs'), /quantité/i)
	const zombie = c.indexes!.monsters.zombie!
	const before = structuredClone(zombie)
	let state = startEncounter(initial, c)
	state = addParticipant(state, c, zombie.id, 'monster', { maxHp: 7, armorClass: 13, initiativeBonus: 1 })
	state = addParticipant(state, c, zombie.id, 'monster', { maxHp: 9, armorClass: 12, initiativeBonus: 0 })
	const copies = state.combat!.participants.filter((participant) => participant.monsterId === zombie.id)
	assert.equal(new Set(copies.map((participant) => participant.id)).size, 2)
	assert.deepEqual(
		copies.map(({ maxHp, armorClass }) => [maxHp, armorClass]),
		[
			[7, 13],
			[9, 12],
		],
	)
	state = damage(state, copies[0]!.id, 3)
	assert.equal(copies[0]!.vitals!.hp, 7)
	assert.equal(c.indexes!.monsters.zombie!.maxHp, before.maxHp)
	assert.deepEqual(c.indexes!.monsters.zombie, before)
})

test('custom selected player and manual stats for an incomplete monster survive save restoration', async () => {
	const c = await campaign()
	const incompleteMonster = { ...c.indexes!.monsters.zombie!, id: 'incomplete-monster', maxHp: null, armorClass: null }
	c.monsters.push(incompleteMonster)
	c.indexes!.monsters[incompleteMonster.id] = incompleteMonster
	let state = addCustomPlayer(createInitialState(c), c, {
		name: 'PJ de test',
		maxHp: 14,
		armorClass: 16,
		initiativeBonus: 2,
	})
	const customId = state.customPlayers![0]!.id
	const effective = campaignWithPlayers(c, state)
	state = startEncounter(state, effective, undefined, { selectedPlayerIds: [customId] })
	assert.throws(() => addParticipant(state, effective, incompleteMonster.id, 'hostile'), /Profil incomplet/)
	state = addParticipant(state, effective, incompleteMonster.id, 'hostile', {
		maxHp: 42,
		armorClass: 17,
		initiativeBonus: 3,
	})
	const player = state.combat!.participants.find((participant) => participant.playerId === customId)!
	const monster = state.combat!.participants.find((participant) => participant.monsterId)!
	state = damage(state, player.id, 28)
	state = damage(state, monster.id, 5)
	state = setInitiative(state, monster.id, 18)
	const imported = importGame(exportGame(state), c)
	assert.deepEqual(
		imported.combat!.participants.map((participant) => participant.playerId),
		[customId, undefined],
	)
	assert.equal(imported.players[customId]!.hp, 0)
	assert.equal(imported.players[customId]!.status, 'dead')
	assert.deepEqual(
		{
			maxHp: imported.combat!.participants[1]!.maxHp,
			armorClass: imported.combat!.participants[1]!.armorClass,
			initiativeBonus: imported.combat!.participants[1]!.initiativeBonus,
			initiative: imported.combat!.participants[1]!.initiative,
			hp: imported.combat!.participants[1]!.vitals!.hp,
		},
		{ maxHp: 42, armorClass: 17, initiativeBonus: 3, initiative: 18, hp: 37 },
	)
	assert.equal(c.indexes!.monsters[incompleteMonster.id]!.maxHp, null)
})

test('unique item assignment is owner-stable and retained after reload', async () => {
	const c = await campaign()
	const initial = addCustomPlayer(createInitialState(c), c, {
		name: 'PJ porteur',
		maxHp: 10,
		armorClass: 12,
		initiativeBonus: 1,
	})
	const firstPlayer = initial.customPlayers![0]!
	const second = addCustomPlayer(initial, c, {
		name: 'PJ secondaire',
		maxHp: 10,
		armorClass: 12,
		initiativeBonus: 1,
	})
	const secondPlayer = second.customPlayers![1]!
	const itemId = c.items[0]!.id
	const state = assignItem(second, c, itemId, firstPlayer.id)
	assert.throws(() => assignItem(state, c, itemId, secondPlayer.id), /already|attribuée/i)
	assert.deepEqual(importGame(exportGame(state), c).itemAssignments, { [itemId]: firstPlayer.id })
})

test('legacy optional fields default safely and saves remain isolated by campaign slot', async () => {
	const c = await campaign()
	const storage = new Map<string, string>()
	const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		},
	})
	try {
		const legacy = createInitialState(c) as Record<string, unknown>
		delete legacy.customPlayers
		delete legacy.itemAssignments
		storage.set(storageKey(c.manifest.id), JSON.stringify(legacy))
		const restored = loadGame(c).state
		assert.deepEqual(restored.customPlayers, [])
		assert.deepEqual(restored.itemAssignments, {})
		assert.equal(saveGame({ ...restored, notes: 'slot two' }, '2'), null)
		assert.equal(loadGame(c).state.notes, '')
		assert.equal(loadGame(c, '2').state.notes, 'slot two')
	} finally {
		if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
		else Reflect.deleteProperty(globalThis, 'localStorage')
	}
})

test('custom player bounds match the values accepted by save import', async () => {
	const c = await campaign()
	const initial = createInitialState(c)
	assert.throws(
		() => addCustomPlayer(initial, c, { name: 'CA invalide', maxHp: 10, armorClass: 101, initiativeBonus: 0 }),
		/Personnage/i,
	)
	assert.throws(
		() =>
			addCustomPlayer(initial, c, {
				name: 'Initiative invalide',
				maxHp: 10,
				armorClass: 10,
				initiativeBonus: 101,
			}),
		/Personnage/i,
	)
	assert.throws(
		() =>
			addCustomPlayer(initial, c, {
				name: 'Initiative invalide',
				maxHp: 10,
				armorClass: 10,
				initiativeBonus: -101,
			}),
		/Personnage/i,
	)
	const bounded = addCustomPlayer(initial, c, {
		name: 'Limites valides',
		maxHp: 10,
		armorClass: 100,
		initiativeBonus: -100,
	})
	const invalidSave = {
		...bounded,
		customPlayers: bounded.customPlayers!.map((player) => ({
			...player,
			combat: { ...player.combat, armorClass: 101 },
		})),
	}
	assert.throws(() => importGame(exportGame(invalidSave), c), /invalide|incompatible/i)
})

test('resetting a custom character encounter works with the static campaign', async () => {
	const c = await campaign()
	const withCustom = addCustomPlayer(createInitialState(c), c, {
		name: 'PJ personnalisé',
		maxHp: 12,
		armorClass: 14,
		initiativeBonus: 2,
	})
	const playerId = withCustom.customPlayers![0]!.id
	let state = startEncounter(withCustom, campaignWithPlayers(c, withCustom))
	state = damage(state, playerId, 5)
	state = { ...state, combat: { ...state.combat!, status: 'finished' } }
	state = resetEncounter(state, c)
	assert.equal(state.players[playerId]!.hp, 12)
	assert.equal(state.combat!.status, 'active')
	assert.equal(state.combat!.round, 1)
	assert.equal(state.combat!.participants.find((participant) => participant.playerId === playerId)!.maxHp, 12)
	assert.deepEqual(importGame(exportGame(state), c).players[playerId], state.players[playerId])
})
