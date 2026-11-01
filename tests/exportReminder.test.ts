import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCampaign } from '../src/services/campaignLoader.ts'
import * as game from '../src/services/game.ts'
import { exportReminderDue, lastExportAt, markExported, storageKey } from '../src/services/storageService.ts'

const DAY = 86_400_000
const now = Date.UTC(2026, 10, 1)

function fakeStorage(records = new Map<string, string>()) {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			getItem: (key: string) => records.get(key) ?? null,
			setItem: (key: string, value: string) => void records.set(key, value),
			removeItem: (key: string) => records.delete(key),
			clear: () => assert.fail('Export marker must not clear storage'),
		},
	})
	return records
}

test('reminder is due only for a game with progress and a missing or stale export', async () => {
	const empty = game.createInitialState(await loadCampaign())
	const played = game.addJournal(empty, 'Note', 'Texte')
	assert.equal(exportReminderDue(empty, null, now), false)
	assert.equal(exportReminderDue(empty, now - 30 * DAY, now), false)
	assert.equal(exportReminderDue(played, null, now), true)
	assert.equal(exportReminderDue(played, now - 3 * DAY, now), false)
	assert.equal(exportReminderDue(played, now - 8 * DAY, now), true)
	const explored = { ...empty, sceneStatus: { [empty.activeSceneId]: 'visited' as const } }
	assert.equal(exportReminderDue(explored, null, now), true)
})

test('last export is stored per campaign and slot, outside the save payload', () => {
	const records = fakeStorage()
	assert.equal(lastExportAt('camp', '1'), null)
	markExported('camp', '1', 1234)
	assert.equal(lastExportAt('camp', '1'), 1234)
	assert.equal(lastExportAt('camp', '2'), null)
	assert.equal(lastExportAt('other', '1'), null)
	assert.equal(records.has(storageKey('camp', '1')), false)
	records.set(`${storageKey('camp', '2')}:last-export`, 'garbage')
	assert.equal(lastExportAt('camp', '2'), null)
})

test('export marker helpers never throw when storage is unavailable', () => {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		get: () => {
			throw new Error('Storage denied')
		},
	})
	assert.equal(lastExportAt('camp', '1'), null)
	assert.doesNotThrow(() => markExported('camp', '1', now))
})
