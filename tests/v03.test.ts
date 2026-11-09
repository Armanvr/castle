import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, test } from 'node:test'
import { validateCampaign } from '../src/services/campaignLoader.ts'
import * as game from '../src/services/game.ts'
import { PLAYER_SCREEN_CHANNEL, publicView } from '../src/services/playerScreen.ts'
import { encounterNeedsPrep, sessionPrep } from '../src/services/sessionPrep.ts'
import {
	addSnapshot,
	createFileAutosave,
	exportGame,
	importGame,
	listSnapshots,
	saveGame,
	storageKey,
	validateGame,
} from '../src/services/storageService.ts'
import { MAX_XP, XP_BY_CR, xpForChallenge } from '../src/services/xp.ts'
import type { Campaign, Combatant, GameState } from '../src/types.ts'

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
// The demo monsters have no CR: give each one so XP is computable.
async function xpCampaign(challenges: Record<string, string>): Promise<Campaign> {
	const campaign = await fixture()
	for (const m of campaign.monsters) m.challenge = challenges[m.id] ?? ''
	return campaign
}
function fakeStorage(limit = Number.POSITIVE_INFINITY, total = Number.POSITIVE_INFINITY) {
	const records = new Map<string, string>()
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			getItem: (key: string) => records.get(key) ?? null,
			setItem: (key: string, value: string) => {
				const others = [...records].reduce((n, [k, v]) => (k === key ? n : n + v.length), 0)
				if (value.length > limit || others + value.length > total) throw new Error('QuotaExceededError')
				records.set(key, value)
			},
			removeItem: (key: string) => records.delete(key),
		},
	})
	return records
}
const SLOT = '1'

describe('snapshots', () => {
	test('newest first, capped at 10, undo history stripped', async () => {
		fakeStorage()
		const state = game.createInitialState(await fixture())
		for (let i = 1; i <= 12; i++) assert.equal(addSnapshot(state, SLOT, `P${i}`, i), null)
		const list = listSnapshots(state.campaignId, SLOT)
		assert.equal(list.length, 10)
		assert.deepEqual(
			list.map((s) => s.label),
			['P12', 'P11', 'P10', 'P9', 'P8', 'P7', 'P6', 'P5', 'P4', 'P3'],
		)
		assert.equal(list[0]!.at, 12)
		assert.equal(JSON.parse(list[0]!.state).undo, null)
	})
	test('absent or corrupted key gives an empty list, bad entries are dropped', async () => {
		const records = fakeStorage()
		const key = `${storageKey('c', SLOT)}:snapshots`
		assert.deepEqual(listSnapshots('c', SLOT), [])
		records.set(key, '{pas du json')
		assert.deepEqual(listSnapshots('c', SLOT), [])
		records.set(key, '{"a":1}')
		assert.deepEqual(listSnapshots('c', SLOT), [])
		records.set(key, JSON.stringify([{ at: 1, label: 'ok', state: '{}' }, { at: 'x' }, null]))
		assert.deepEqual(listSnapshots('c', SLOT), [{ at: 1, label: 'ok', state: '{}' }])
	})
	test('addSnapshot over a corrupted key starts a clean list', async () => {
		const records = fakeStorage()
		const state = game.createInitialState(await fixture())
		records.set(`${storageKey(state.campaignId, SLOT)}:snapshots`, 'zzz')
		assert.equal(addSnapshot(state, SLOT, 'Neuf', 5), null)
		assert.deepEqual(
			listSnapshots(state.campaignId, SLOT).map((s) => s.label),
			['Neuf'],
		)
	})
	test('a full quota drops the oldest points until the write fits', async () => {
		const state = game.createInitialState(await fixture())
		const one = exportGame({ ...state, undo: null }).length
		fakeStorage(one * 2.5)
		for (let i = 1; i <= 4; i++) assert.equal(addSnapshot(state, SLOT, `P${i}`, i), null)
		assert.deepEqual(
			listSnapshots(state.campaignId, SLOT).map((s) => s.label),
			['P4', 'P3'],
		)
	})
	test('a snapshot that can never fit returns an error and keeps the stored list', async () => {
		const state = game.createInitialState(await fixture())
		const records = fakeStorage()
		assert.equal(addSnapshot(state, SLOT, 'Avant', 1), null)
		const key = `${storageKey(state.campaignId, SLOT)}:snapshots`
		const before = records.get(key)
		fakeStorage(10)
		assert.match(addSnapshot(state, SLOT, 'Trop gros', 2) ?? '', /Point de restauration impossible/)
		assert.equal(records.get(key), before)
	})
	test('saveGame sacrifices the oldest points when they fill the quota; other keys stay intact', async () => {
		const state = game.createInitialState(await fixture())
		const one = exportGame(state).length
		const records = fakeStorage()
		for (let i = 1; i <= 3; i++) assert.equal(addSnapshot(state, SLOT, `P${i}`, i), null)
		records.set('autre', 'intact')
		// Shared quota: points + other key fill it, the main save only fits once points are gone.
		const used = [...records.values()].reduce((n, v) => n + v.length, 0)
		fakeStorage(Number.POSITIVE_INFINITY, used + one / 2)
		for (const [k, v] of records) localStorage.setItem(k, v)
		assert.equal(saveGame(state, SLOT), null)
		assert.equal(localStorage.getItem(storageKey(state.campaignId, SLOT)), exportGame(state))
		assert.equal(localStorage.getItem('autre'), 'intact')
		assert.ok(listSnapshots(state.campaignId, SLOT).length < 3)
	})
	test('saveGame without restore points returns the error', async () => {
		const state = game.createInitialState(await fixture())
		fakeStorage(10)
		assert.match(saveGame(state, SLOT) ?? '', /Sauvegarde impossible/)
	})
	test('a snapshot round-trips through importGame; same-millisecond points get distinct times', async () => {
		fakeStorage()
		const campaign = await fixture()
		const state = game.addJournal(game.createInitialState(campaign), 'Note', 'x')
		addSnapshot(state, SLOT, 'Point', 1)
		addSnapshot(state, SLOT, 'Point', 1)
		const [snapshot, older] = listSnapshots(state.campaignId, SLOT)
		assert.deepEqual(importGame(snapshot!.state, campaign), { ...state, undo: null })
		assert.deepEqual([snapshot!.at, older!.at], [2, 1])
	})
})

describe('createFileAutosave', () => {
	test('debounces: only the last save is written', async (t) => {
		t.mock.timers.enable({ apis: ['setTimeout'] })
		const written: string[] = []
		const autosave = createFileAutosave(async (json) => void written.push(json), 1500)
		autosave.save('a')
		t.mock.timers.tick(1000)
		autosave.save('b')
		t.mock.timers.tick(1000)
		assert.deepEqual(written, [])
		t.mock.timers.tick(500)
		await Promise.resolve()
		assert.deepEqual(written, ['b'])
	})
	test('one write at a time, a save during a write is written right after', async (t) => {
		t.mock.timers.enable({ apis: ['setTimeout'] })
		const releases: (() => void)[] = []
		const started: string[] = []
		let active = 0
		let maxActive = 0
		const successes: number[] = []
		const autosave = createFileAutosave(
			async (json) => {
				started.push(json)
				active++
				maxActive = Math.max(maxActive, active)
				await new Promise<void>((resolve) => releases.push(resolve))
				active--
			},
			100,
			{ onSuccess: (at) => successes.push(at) },
		)
		autosave.save('un')
		t.mock.timers.tick(100)
		assert.deepEqual(started, ['un'])
		autosave.save('deux')
		t.mock.timers.tick(100)
		assert.deepEqual(started, ['un'])
		releases[0]!()
		await new Promise((resolve) => setImmediate(resolve))
		assert.deepEqual(started, ['un', 'deux'])
		releases[1]!()
		await new Promise((resolve) => setImmediate(resolve))
		assert.equal(maxActive, 1)
		assert.equal(successes.length, 2)
	})
	test('a failed write calls onError, drops pending data and later saves still work', async (t) => {
		t.mock.timers.enable({ apis: ['setTimeout'] })
		const errors: unknown[] = []
		const written: string[] = []
		let fail = true
		const autosave = createFileAutosave(
			async (json) => {
				if (fail) throw new Error('disque plein')
				written.push(json)
			},
			100,
			{ onError: (e) => errors.push(e) },
		)
		autosave.save('x')
		t.mock.timers.tick(100)
		await new Promise((resolve) => setImmediate(resolve))
		assert.equal(errors.length, 1)
		assert.match(String(errors[0]), /disque plein/)
		assert.deepEqual(written, [])
		fail = false
		autosave.save('y')
		t.mock.timers.tick(100)
		await new Promise((resolve) => setImmediate(resolve))
		assert.deepEqual(written, ['y'])
	})
	test('cancel discards the pending write', async (t) => {
		t.mock.timers.enable({ apis: ['setTimeout'] })
		const written: string[] = []
		const autosave = createFileAutosave(async (json) => void written.push(json), 100)
		autosave.save('x')
		autosave.cancel()
		t.mock.timers.tick(500)
		await Promise.resolve()
		assert.deepEqual(written, [])
	})
})

describe('shortRest', () => {
	test('heals each living PJ up to maxHp and journals "+n PV"', async () => {
		const campaign = await fixture()
		const state = createDamaged(campaign, { 'demo-iris': 5, 'demo-mael': 2 })
		const rested = game.shortRest(state, campaign, { 'demo-iris': 3, 'demo-mael': 99 })
		assert.equal(rested.players['demo-iris']!.hp, 8)
		assert.equal(rested.players['demo-mael']!.hp, rested.players['demo-mael']!.maxHp)
		const entry = rested.journal.at(-1)!
		assert.equal(entry.type, 'rest')
		assert.equal(entry.title, 'Repos court')
		assert.equal(
			entry.description,
			`Iris Valombre +3 PV, Maël Aubeclaire +${rested.players['demo-mael']!.maxHp - 2} PV, Nox Brindepied +0 PV`,
		)
		assert.deepEqual(entry.participants, ['Iris Valombre', 'Maël Aubeclaire', 'Nox Brindepied'])
		assert.equal(state.players['demo-iris']!.hp, 5)
	})
	test('refused during an unfinished combat, allowed once finished', async () => {
		const campaign = await fixture()
		let state = game.startEncounter(game.createInitialState(campaign), campaign, 'demo-training')
		assert.throws(() => game.shortRest(state, campaign, {}), /Repos court impossible pendant un combat/)
		state = game.finishEncounter(state)
		assert.doesNotThrow(() => game.shortRest(state, campaign, {}))
	})
	test('a dead PJ is ignored', async () => {
		const campaign = await fixture()
		const state = createDamaged(campaign, { 'demo-iris': 5, 'demo-mael': 5 })
		state.players['demo-mael']!.status = 'dead'
		const rested = game.shortRest(state, campaign, { 'demo-iris': 1, 'demo-mael': 4 })
		assert.equal(rested.players['demo-mael']!.hp, 5)
		assert.equal(rested.players['demo-mael']!.status, 'dead')
		assert.doesNotMatch(rested.journal.at(-1)!.description, /Maël/)
	})
	test('a PJ at 0 HP healed above 0 gets up with fresh death saves; healed 0 stays down', async () => {
		const campaign = await fixture()
		const state = createDamaged(campaign, { 'demo-iris': 0, 'demo-mael': 0 })
		for (const id of ['demo-iris', 'demo-mael']) {
			state.players[id]!.status = 'unconscious'
			state.players[id]!.deathSaves = { successes: 1, failures: 2 }
		}
		const rested = game.shortRest(state, campaign, { 'demo-iris': 4, 'demo-mael': 0 })
		assert.equal(rested.players['demo-iris']!.status, 'active')
		assert.deepEqual(rested.players['demo-iris']!.deathSaves, { successes: 0, failures: 0 })
		assert.equal(rested.players['demo-mael']!.status, 'unconscious')
		assert.deepEqual(rested.players['demo-mael']!.deathSaves, { successes: 1, failures: 2 })
	})
	test('invalid amounts are rejected', async () => {
		const campaign = await fixture()
		const state = game.createInitialState(campaign)
		for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
			assert.throws(() => game.shortRest(state, campaign, { 'demo-iris': bad }), /entiers positifs/)
	})
})
function createDamaged(campaign: Campaign, hp: Record<string, number>): GameState {
	const state = game.createInitialState(campaign)
	for (const [id, value] of Object.entries(hp)) state.players[id]!.hp = value
	return state
}

describe('xp table', () => {
	test('official 2014 values', () => {
		assert.equal(Object.keys(XP_BY_CR).length, 34)
		const expected: [string, number][] = [
			['0', 10],
			['1/8', 25],
			['1/4', 50],
			['1/2', 100],
			['1', 200],
			['5', 1800],
			['13', 10000],
			['20', 25000],
			['30', 155000],
		]
		for (const [cr, xp] of expected) assert.equal(xpForChallenge(cr), xp)
		for (let cr = 1; cr <= 30; cr++) assert.ok(XP_BY_CR[String(cr)]! > XP_BY_CR[String(cr - 1)]!)
	})
	test('unknown, empty and decimal challenges', () => {
		assert.equal(xpForChallenge(''), null)
		assert.equal(xpForChallenge('Non évalué (démo)'), null)
		assert.equal(xpForChallenge('31'), null)
		assert.equal(xpForChallenge('constructor'), null)
		assert.equal(xpForChallenge(' 1/4 '), 50)
		assert.equal(xpForChallenge('0.25'), 50)
		assert.equal(xpForChallenge('0.125'), 25)
	})
})

const PAIR = ['demo-iris', 'demo-mael']
// Two of the three demo PJ keep the XP arithmetic readable.
const duo = (campaign: Campaign, encounterId: string) =>
	game.startEncounter(game.createInitialState(campaign), campaign, encounterId, { selectedPlayerIds: PAIR })
describe('finishEncounter XP', () => {
	// demo-training: 2 sentinels, demo-fog: 3 mists; 2 PJ.
	const defeat = (state: GameState, filter: (p: Combatant) => boolean) => {
		for (const p of state.combat!.participants) if (filter(p)) p.vitals!.status = 'dead'
	}
	test('shares the XP of defeated creatures among living PJ, rounded down, and accumulates', async () => {
		const campaign = await xpCampaign({ 'demo-sentinel': '1/4' })
		let state = duo(campaign, 'demo-training')
		defeat(state, (p) => p.monsterId)
		state.players['demo-iris']!.hp = 5
		state.xp = { 'demo-iris': 7 }
		state = game.finishEncounter(state, campaign)
		assert.deepEqual(state.xp, { 'demo-iris': 57, 'demo-mael': 50 })
		assert.match(state.journal.at(-1)!.description, /XP : 100 \(50 chacun\)\./)
		assert.doesNotMatch(state.journal.at(-1)!.description, /non calculée/)
	})
	test('rounds the share down', async () => {
		const campaign = await xpCampaign({ 'demo-mist': '1/8' })
		let state = duo(campaign, 'demo-fog')
		defeat(state, (p) => p.monsterId)
		state = game.finishEncounter(state, campaign)
		assert.match(state.journal.at(-1)!.description, /XP : 75 \(37 chacun\)/)
		assert.deepEqual(state.xp, { 'demo-iris': 37, 'demo-mael': 37 })
	})
	test('caps accumulated XP at MAX_XP so the save still validates', async () => {
		const campaign = await xpCampaign({ 'demo-sentinel': '1/4' })
		let state = duo(campaign, 'demo-training')
		defeat(state, (p) => p.monsterId)
		state.xp = { 'demo-iris': MAX_XP, 'demo-mael': MAX_XP - 10 }
		state = game.finishEncounter(state, campaign)
		assert.deepEqual(state.xp, { 'demo-iris': MAX_XP, 'demo-mael': MAX_XP })
		assert.doesNotThrow(() => validateGame(JSON.parse(exportGame(state)), campaign))
	})
	test('dead PJ get nothing and the share is split between the others only', async () => {
		const campaign = await xpCampaign({ 'demo-sentinel': '1/4' })
		let state = duo(campaign, 'demo-training')
		defeat(state, (p) => p.monsterId)
		state.players['demo-mael']!.status = 'dead'
		state = game.finishEncounter(state, campaign)
		assert.deepEqual(state.xp, { 'demo-iris': 100 })
		assert.match(state.journal.at(-1)!.description, /XP : 100 \(100 chacun\)/)
	})
	test('removed and surviving creatures and allies are excluded', async () => {
		const campaign = await xpCampaign({ 'demo-sentinel': '1/4', 'demo-mist': '1' })
		let state = duo(campaign, 'demo-training')
		state = game.addParticipant(state, campaign, 'demo-mist', 'ally')
		const [first, second] = state.combat!.participants.filter((p) => p.monsterId === 'demo-sentinel')
		first!.vitals!.status = 'removed'
		second!.vitals!.status = 'unconscious'
		const ally = state.combat!.participants.find((p) => p.type === 'ally')!
		ally.vitals!.status = 'dead'
		state = game.finishEncounter(state, campaign)
		assert.deepEqual(state.xp, { 'demo-iris': 25, 'demo-mael': 25 })
	})
	test('unknown CR is listed and never counted', async () => {
		const campaign = await xpCampaign({ 'demo-sentinel': '1/4' })
		let state = duo(campaign, 'demo-fog')
		defeat(state, (p) => p.monsterId)
		state = game.addParticipant(state, campaign, 'demo-sentinel')
		state.combat!.participants.at(-1)!.vitals!.status = 'dead'
		state = game.finishEncounter(state, campaign)
		const description = state.journal.at(-1)!.description
		assert.match(description, /XP : 50 \(25 chacun\)\./)
		assert.match(
			description,
			/XP non calculée : Éclat de brume · 1, Éclat de brume · 2, Éclat de brume · 3 \(FP inconnu\)\./,
		)
	})
	test('only unknown CR: no XP line, no xp key', async () => {
		const campaign = await xpCampaign({})
		let state = duo(campaign, 'demo-training')
		defeat(state, (p) => p.monsterId)
		state = game.finishEncounter(state, campaign)
		assert.equal(state.xp, undefined)
		assert.doesNotMatch(state.journal.at(-1)!.description, /XP :/)
		assert.match(state.journal.at(-1)!.description, /XP non calculée/)
	})
	test('without a campaign the behaviour is unchanged (no XP) and a finished combat is a no-op', async () => {
		const campaign = await xpCampaign({ 'demo-sentinel': '1' })
		let state = duo(campaign, 'demo-training')
		defeat(state, (p) => p.monsterId)
		state = game.finishEncounter(state)
		assert.equal(state.xp, undefined)
		assert.doesNotMatch(state.journal.at(-1)!.description, /XP/)
		assert.equal(game.finishEncounter(state, campaign), state)
	})
	test('xp survives an export roundtrip', async () => {
		const campaign = await xpCampaign({ 'demo-sentinel': '1/4' })
		let state = duo(campaign, 'demo-training')
		defeat(state, (p) => p.monsterId)
		state = game.finishEncounter(state, campaign)
		assert.deepEqual(importGame(exportGame(state), campaign), state)
	})
})

describe('validateGame xp', () => {
	test('old saves without xp load unchanged; valid xp loads', async () => {
		const campaign = await fixture()
		const state = game.createInitialState(campaign)
		assert.equal('xp' in validateGame(JSON.parse(exportGame(state)), campaign), false)
		const withXp = { ...state, xp: { 'demo-iris': 0, 'demo-mael': 300 } }
		assert.deepEqual(validateGame(JSON.parse(exportGame(withXp)), campaign).xp, withXp.xp)
	})
	test('invalid xp is refused', async () => {
		const campaign = await fixture()
		const state = game.createInitialState(campaign)
		for (const xp of [
			[],
			'x',
			null,
			{ 'demo-iris': -1 },
			{ 'demo-iris': 1.5 },
			{ 'demo-iris': '3' },
			{ inconnu: 5 },
			{ 'demo-iris': MAX_XP + 1 },
		])
			assert.throws(() => validateGame({ ...state, xp }, campaign), /invalide/, JSON.stringify(xp))
	})
	test('custom PJ can hold xp', async () => {
		const campaign = await fixture()
		let state = game.addCustomPlayer(game.createInitialState(campaign), campaign, {
			name: 'Zed',
			maxHp: 10,
			armorClass: 10,
			initiativeBonus: 0,
		})
		const id = state.customPlayers![0]!.id
		state = { ...state, xp: { [id]: 40 } }
		assert.deepEqual(importGame(exportGame(state), campaign).xp, { [id]: 40 })
	})
})

describe('sessionPrep', () => {
	test('active scene, reachable scenes, their encounters', async () => {
		const campaign = await fixture()
		const state = game.createInitialState(campaign)
		const prep = sessionPrep(state, campaign)
		assert.equal(prep.scene!.id, state.activeSceneId)
		assert.ok(prep.nextScenes.length > 0)
		assert.ok(prep.nextScenes.every((s) => s.id !== state.activeSceneId))
		const reachable = new Set([prep.scene!, ...prep.nextScenes].flatMap((s) => s.encounterIds))
		assert.deepEqual(prep.encounters.map((e) => e.encounter.id).sort(), [...reachable].sort())
		assert.ok(reachable.has('demo-training'))
	})
	test('needsPrep flags a missing quantity, stat or profile', async () => {
		const campaign = await fixture()
		const ok = campaign.encounters[0]!
		assert.equal(encounterNeedsPrep(campaign, ok), false)
		const noCount = { ...ok, participants: [{ ...ok.participants[0]!, count: null }] }
		assert.equal(encounterNeedsPrep(campaign, noCount), true)
		const noProfile = { ...ok, participants: [{ ...ok.participants[0]!, monsterId: 'inconnu' }] }
		assert.equal(encounterNeedsPrep(campaign, noProfile), true)
		const noStat = structuredClone(campaign)
		noStat.monsters.find((m) => m.id === 'demo-sentinel')!.armorClass = null
		assert.equal(encounterNeedsPrep(noStat, ok), true)
		const state = game.createInitialState(noStat)
		const flagged = sessionPrep(state, noStat).encounters.find((e) => e.encounter.id === 'demo-training')!
		assert.equal(flagged.needsPrep, true)
	})
	test('warnings are limited to the scenes and encounters in view', async () => {
		const campaign = await fixture()
		const state = game.createInitialState(campaign)
		campaign.warnings = [
			'demo-training : quantité à vérifier',
			'chapter-99 : sans rapport',
			`Scène ${campaign.chapters[0]!.scenes[0]!.title} : texte incomplet`,
		]
		const prep = sessionPrep(state, campaign)
		assert.equal(prep.warnings.length, 2)
		assert.ok(!prep.warnings.some((w) => w.includes('sans rapport')))
		campaign.warnings = undefined
		assert.deepEqual(sessionPrep(state, campaign).warnings, [])
	})
	test('an unknown active scene gives a null scene, not a crash', async () => {
		const campaign = await fixture()
		const prep = sessionPrep({ ...game.createInitialState(campaign), activeSceneId: 'nulle-part' }, campaign)
		assert.equal(prep.scene, null)
		assert.deepEqual(prep.encounters, [])
	})
})

describe('publicView', () => {
	test('no combat or a finished one: only the reveal goes out', async () => {
		const campaign = await fixture()
		const state = game.createInitialState(campaign)
		assert.deepEqual(publicView(state, null), { combat: null, reveal: null })
		const reveal = { title: 'Titre', text: 'Texte' }
		assert.deepEqual(publicView(state, reveal), { combat: null, reveal })
		const finished = game.finishEncounter(game.startEncounter(state, campaign, 'demo-training'))
		assert.equal(publicView(finished, null).combat, null)
		assert.equal(PLAYER_SCREEN_CHANNEL, 'grimoire-joueurs')
	})
	test('order follows initiative, removed excluded, PJ show HP, creatures never do', async () => {
		const campaign = await fixture()
		let state = duo(campaign, 'demo-training')
		const [iris, mael, s1, s2] = state.combat!.participants
		state = game.setInitiative(state, iris!.id, 10)
		state = game.setInitiative(state, mael!.id, 5)
		state = game.setInitiative(state, s1!.id, 30)
		state = game.setInitiative(state, s2!.id, 20)
		state = game.updateVitals(state, s2!.id, { status: 'removed' })
		state = game.damage(state, iris!.id, 4)
		state.combat!.activeId = iris!.id
		const view = publicView(state, null).combat!
		assert.equal(view.name, state.combat!.name)
		assert.equal(view.round, 1)
		assert.deepEqual(
			view.order.map((o) => o.id),
			game.sortedParticipants(state).map((p) => p.id),
		)
		assert.deepEqual(
			view.order.map((o) => o.id),
			[s1!.id, iris!.id, mael!.id],
		)
		const pj = view.order.find((o) => o.id === iris!.id)!
		assert.equal(pj.hp, `${state.players['demo-iris']!.hp}/${state.players['demo-iris']!.maxHp}`)
		assert.equal(pj.active, true)
		assert.equal(view.order[0]!.active, false)
		assert.equal(view.order[0]!.kind, 'creature')
		assert.equal(view.order[0]!.name, 'Sentinelle de cuivre · 1')
	})
	test('PJ and creature statuses', async () => {
		const campaign = await fixture()
		let state = duo(campaign, 'demo-training')
		const [iris, mael, s1] = state.combat!.participants
		state = game.damage(state, iris!.id, 999)
		state = game.updateVitals(state, mael!.id, { status: 'stable' })
		state = game.damage(state, s1!.id, 999)
		const by = (id: string) => publicView(state, null).combat!.order.find((o) => o.id === id)!
		assert.equal(by(iris!.id).status, state.players['demo-iris']!.status === 'dead' ? 'Mort' : 'À terre')
		assert.equal(by(mael!.id).status, 'Stable')
		assert.equal(by(s1!.id).status, 'Vaincu')
		assert.equal('status' in by(state.combat!.participants[3]!.id), false)
	})
	test('nothing from the monster stat block leaks, even with unusual values', async () => {
		const campaign = await fixture()
		let state = game.startEncounter(game.createInitialState(campaign), campaign, 'demo-training', {
			selectedPlayerIds: PAIR,
			participantOverrides: { 0: { maxHp: 8317, armorClass: 77, initiativeBonus: 41 } },
		})
		state = game.setInitiative(state, state.combat!.participants.at(-1)!.id, 53)
		state = game.damage(state, state.combat!.participants.at(-1)!.id, 3)
		const view = publicView(state, null)
		const json = JSON.stringify(view.combat!.order.map(({ id: _id, ...row }) => row))
		for (const secret of [
			'8317',
			'8314',
			'77',
			'41',
			'53',
			'armorClass',
			'initiative',
			'maxHp',
			'monsterId',
			'demo-sentinel',
		])
			assert.ok(!json.includes(secret), `leak: ${secret}`)
		for (const row of view.combat!.order)
			if (row.kind === 'creature') assert.deepEqual(Object.keys(row).sort(), ['active', 'id', 'kind', 'name'])
		assert.doesNotThrow(() => JSON.stringify(view))
	})
	test('the view does not alias the state or the reveal', async () => {
		const campaign = await fixture()
		const state = duo(campaign, 'demo-training')
		const reveal = { title: 'T', text: 'x' }
		const view = publicView(state, reveal)
		reveal.text = 'changé'
		assert.equal(view.reveal!.text, 'x')
	})
})
