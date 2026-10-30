import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { test } from 'node:test'
import { BUNDLED_CAMPAIGN_URL, loadCampaign } from '../src/services/campaignLoader.ts'
import * as game from '../src/services/game.ts'
import { createInitialState } from '../src/services/game.ts'
import * as storage from '../src/services/storageService.ts'

const legacyManifest = '/campaigns/stormwreck-isle/manifest.json'

test('production loader defaults to real campaign and rejects demo or arbitrary manifests without fetching', async () => {
	const originalFetch = globalThis.fetch
	let fetches = 0
	globalThis.fetch = async () => {
		fetches++
		throw new Error('Unexpected fetch')
	}
	try {
		const campaign = await loadCampaign()
		assert.equal(campaign.manifest.id, 'dragons-ile-aux-tempetes')
		assert.equal(campaign.manifest.demo, false)
		assert.equal(campaign.chapters.length, 4)
		assert.deepEqual(await loadCampaign(BUNDLED_CAMPAIGN_URL), campaign)
		for (const path of [legacyManifest, '/other/manifest.json', 'https://example.test/manifest.json'])
			await assert.rejects(loadCampaign(path), /campagne.*disponible|non prise en charge/i)
		assert.equal(fetches, 0)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('real campaign starts with no played progress, players, combat, notes or journal', async () => {
	const campaign = await loadCampaign(BUNDLED_CAMPAIGN_URL)
	const state = createInitialState(campaign)
	assert.equal(state.activeSceneId, campaign.chapters[0]!.scenes[0]!.id)
	assert.deepEqual(state.sceneStatus, {})
	for (const field of ['players', 'flags', 'quests', 'relationships', 'itemAssignments'] as const)
		assert.deepEqual(state[field], {})
	for (const field of ['journal', 'inventory', 'appliedChoices', 'customPlayers'] as const)
		assert.deepEqual(state[field], [])
	assert.equal(state.combat, null)
	assert.equal(state.notes, '')
	assert.deepEqual(storage.importGame(storage.exportGame(state), campaign), state)
})

test('legacy cleanup removes only exact demo preferences; all save payloads remain byte-for-byte', () => {
	const realKey = storage.storageKey('dragons-ile-aux-tempetes')
	const legacyKey = storage.storageKey('stormwreck-isle')
	const records = new Map([
		['dnd-dm:active-manifest', legacyManifest],
		['dnd-dm:slot:' + legacyManifest, '2'],
		[realKey, '{"real":"saved session"}'],
		[legacyKey, '{"notes":"MJ notes", "customPlayers":[{"name":"Created by MJ"}]}'],
		[storage.storageKey('stormwreck-isle', '2'), '{corrupt original'],
		['dnd-dm:slot:' + BUNDLED_CAMPAIGN_URL, '3'],
		['unrelated-app', 'keep'],
	])
	const preserved = new Map(records)
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			get length() {
				return records.size
			},
			key: (index: number) => [...records.keys()][index] ?? null,
			getItem: (key: string) => records.get(key) ?? null,
			removeItem: (key: string) => records.delete(key),
			setItem: () => assert.fail('Cleanup must not overwrite any value'),
			clear: () => assert.fail('Cleanup must not clear storage'),
		},
	})
	assert.equal(typeof storage.cleanupLegacyDemoStorage, 'function')
	const result = storage.cleanupLegacyDemoStorage()
	assert.deepEqual(result, { preservedSaves: 2 })
	preserved.delete('dnd-dm:active-manifest')
	preserved.delete('dnd-dm:slot:' + legacyManifest)
	assert.deepEqual(records, preserved)
	records.set('dnd-dm:active-manifest', BUNDLED_CAMPAIGN_URL)
	storage.cleanupLegacyDemoStorage()
	assert.equal(records.get('dnd-dm:active-manifest'), BUNDLED_CAMPAIGN_URL)
})

test('cleanup reports unavailable storage instead of blocking the application', () => {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		get: () => {
			throw new Error('Storage denied')
		},
	})
	assert.equal(typeof storage.cleanupLegacyDemoStorage, 'function')
	assert.match(storage.cleanupLegacyDemoStorage().error!, /Storage denied/)
})

test('demo JSON is available only as a test fixture, outside public assets', async () => {
	await access(new URL('./fixtures/demo-campaign/manifest.json', import.meta.url))
	await assert.rejects(access(new URL('../public/campaigns/stormwreck-isle/manifest.json', import.meta.url)))
})

test('finishing an actual encounter records its name once and leaves an empty campaign unchanged', async () => {
	const campaign = await loadCampaign()
	const initial = createInitialState(campaign)
	assert.equal(typeof game.finishEncounter, 'function')
	assert.equal(game.finishEncounter(initial), initial)
	const fighting = game.startEncounter(initial, campaign, 'enc-drowned-sailors')
	const finished = game.finishEncounter(fighting)
	assert.equal(finished.combat?.status, 'finished')
	assert.equal(finished.journal.length, fighting.journal.length + 1)
	assert.equal(finished.journal.at(-1)?.title, `Rencontre terminée : ${fighting.combat?.name}`)
	assert.equal(finished.journal.at(-1)?.type, 'encounter')
	assert.equal(game.finishEncounter(finished), finished)
	assert.deepEqual(storage.importGame(storage.exportGame(finished), campaign), finished)
})
