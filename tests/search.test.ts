import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCampaign } from '../src/services/campaignLoader.ts'
import * as game from '../src/services/game.ts'
import { searchCampaign } from '../src/services/search.ts'

const load = () => loadCampaign('/stormwreck-json/manifest.json')

test('search ignores case and accents and ranks title matches before body matches', async () => {
	const campaign = await load()
	const scene = campaign.chapters[0].scenes[0]
	const word = scene.title.split(' ').find((w) => w.length > 4)!
	const results = searchCampaign(campaign, word.toUpperCase().normalize('NFD').replace(/\p{M}/gu, ''))
	assert.ok(results.some((r) => r.kind === 'scene' && r.id === scene.id))
	const firstBody = results.findIndex((r) => r.rank === 1)
	if (firstBody >= 0) assert.ok(results.slice(firstBody).every((r) => r.rank === 1))
})

test('search covers every kind and labels scenes with their chapter', async () => {
	const campaign = await load()
	const kinds = (name: string) => searchCampaign(campaign, name).map((r) => r.kind)
	assert.ok(kinds(campaign.monsters[0].name).includes('monster'))
	assert.ok(kinds(campaign.npcs[0].name).includes('npc'))
	assert.ok(kinds(campaign.items[0].name).includes('item'))
	const scene = campaign.chapters[0].scenes[0]
	const hit = searchCampaign(campaign, scene.title).find((r) => r.id === scene.id)!
	assert.equal(hit.detail, campaign.chapters[0].title)
})

test('search finds custom players, caps results, and returns nothing for blank or unknown queries', async () => {
	const campaign = await load()
	const state = game.addCustomPlayer(game.createInitialState(campaign), campaign, {
		name: 'Zélie Ünique',
		maxHp: 9,
		armorClass: 11,
		initiativeBonus: 0,
	})
	assert.deepEqual(
		searchCampaign(game.campaignWithPlayers(campaign, state), 'zelie unique').map((r) => r.kind),
		['player'],
	)
	assert.equal(searchCampaign(campaign, '   ').length, 0)
	assert.equal(searchCampaign(campaign, 'zzzqqqxxx').length, 0)
	assert.ok(searchCampaign(campaign, 'e').length <= 20)
})

test('search survives empty names, descriptions and missing summaries', async () => {
	const blank = structuredClone(await load())
	blank.npcs = [{ id: 'n0', name: '', description: '' }]
	blank.items = [{ id: 'i0', name: 'Épée', description: '' }]
	blank.monsters = []
	blank.players = []
	for (const ch of blank.chapters) for (const sc of ch.scenes) delete (sc as { summary?: string }).summary
	assert.deepEqual(
		searchCampaign(blank, 'epee').map((r) => r.id),
		['i0'],
	)
	assert.doesNotThrow(() => searchCampaign(blank, 'zzz'))
})
