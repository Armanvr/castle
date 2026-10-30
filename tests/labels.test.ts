import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	bonus,
	childField,
	fieldLabel,
	fieldValue,
	frNumber,
	frPlural,
	frScalar,
	isTechnicalKey,
	journalTypeLabel,
	valueLabel,
} from '../src/services/labels.ts'
import { normalizeStormwreck } from '../src/services/stormwreckAdapter.ts'

test('fieldLabel maps known keys to French and humanises unknown ones', () => {
	assert.equal(fieldLabel('reachMeters'), 'Allonge (m)')
	assert.equal(fieldLabel('saveWIS'), 'Sauvegarde SAG')
	assert.equal(fieldLabel('WIS'), 'SAG')
	assert.equal(fieldLabel('d10DamageTable'), 'Table de dégâts (d10)')
	assert.equal(fieldLabel('0'), 'Niveau 0')
	assert.equal(fieldLabel('someNew_key'), 'some New key')
	assert.equal(fieldLabel('flySpeedMeters'), 'fly Speed Meters')
	assert.equal(fieldLabel('_private_key'), 'private key')
	assert.equal(fieldLabel(''), '')
	assert.equal(fieldLabel('Perception'), 'Perception')
	assert.equal(fieldLabel('Athlétisme'), 'Athlétisme')
	assert.equal(fieldLabel('Arcanes (Int)'), 'Arcanes (Int)')
	assert.equal(fieldLabel('constructor'), 'constructor')
})

test('frNumber uses a decimal comma and never groups digits', () => {
	assert.equal(frNumber(1.5), '1,5')
	assert.equal(frNumber(0.25), '0,25')
	assert.equal(frNumber(18), '18')
	assert.equal(frNumber(0), '0')
	assert.equal(frNumber(1234567), '1234567')
	assert.match(frNumber(-1.5), /^[-−]1,5$/)
	assert.match(frNumber(-3), /^[-−]3$/)
})

test('frScalar renders booleans as Oui/Non, numbers in French, the rest as text', () => {
	assert.equal(frScalar(true), 'Oui')
	assert.equal(frScalar(false), 'Non')
	assert.equal(frScalar(1.5), '1,5')
	assert.equal(frScalar('partial_scan'), 'partial_scan')
})

test('valueLabel translates only exact status codes and leaves free text alone', () => {
	assert.equal(valueLabel('partial_scan'), 'Scan partiel')
	assert.equal(valueLabel('Loyal Mauvais'), 'Loyal Mauvais')
	assert.equal(valueLabel('note_du_mj'), 'note_du_mj')
	assert.equal(valueLabel('partial_scan '), 'partial_scan ')
	assert.equal(valueLabel('Voir partial_scan'), 'Voir partial_scan')
	assert.equal(valueLabel('PARTIAL_SCAN'), 'PARTIAL_SCAN')
	assert.equal(valueLabel(''), '')
	assert.equal(valueLabel('constructor'), 'constructor')
})

test('journalTypeLabel translates known types and keeps unknown or prototype names', () => {
	assert.equal(journalTypeLabel('narrative'), 'Récit')
	assert.equal(journalTypeLabel('inconnu'), 'inconnu')
	assert.equal(journalTypeLabel('toString'), 'toString')
	assert.equal(journalTypeLabel('constructor'), 'constructor')
})

test('adapter describe() renders nested objects, arrays and booleans in French', () => {
	const campaign = normalizeStormwreck({
		monsters: [
			{
				id: 'm',
				statBlock: {
					name: 'M',
					speedMeters: { walk: 9, fly: 0, hover: true, swim: null },
					senses: { darkvisionMeters: 18, passivePerception: 10, notes: ['a', { blindsightMeters: 1.5 }] },
					actions: [{ name: 'Griffe', attackBonus: 4, reachMeters: 1.5, recharge: false }],
					skills: { saveDEX: 3, Perception: -1, Discrétion: '+4' },
				},
			},
		],
	})
	const m = campaign.monsters[0]
	assert.equal(m.speed, 'Au sol : 9 ; Vol : 0 ; hover : Oui')
	assert.equal(
		m.senses,
		'Vision dans le noir (m) : 18 ; Perception passive : 10 ; Notes : a ; Vision aveugle (m) : 1,5',
	)
	assert.equal(m.attacks[0], "Nom : Griffe ; Bonus d'attaque : +4 ; Allonge (m) : 1,5 ; Recharge : Non")
	assert.deepEqual(m.savingThrows, ['Sauvegarde DEX +3'])
	assert.deepEqual(m.skills, ['Perception -1', 'Discrétion +4'])
})

test('monster text built from source data has French labels, decimals, signed bonuses and no ids', () => {
	const campaign = normalizeStormwreck()
	const dragon = campaign.indexes.monsters['dragon-bleu-jeune']
	assert.equal(dragon.speed, 'Au sol : 9 ; Vol : 18')
	assert.equal(
		dragon.attacks[0],
		"Nom : Morsure ; Bonus d'attaque : +5 ; Dégâts : 1d10+3 tranchants et 1d6 dégâts de foudre ; Allonge (m) : 1,5",
	)
	const text = JSON.stringify(
		campaign.monsters.map((m) => [m.speed, m.senses, m.attacks, m.actions, m.savingThrows, m.skills]),
	)
	assert.doesNotMatch(text, /[a-z][A-Z]|walk|fly|swim|Meters|Identifiant|Bonus d'attaque : \d/)
	assert.match(text, /Bonus d'attaque : \+\d/)
})

test('bonus signs numbers with an ASCII sign and French decimals', () => {
	assert.equal(bonus(3), '+3')
	assert.equal(bonus(0), '+0')
	assert.equal(bonus(-1), '-1')
	assert.equal(bonus(1.5), '+1,5')
})

test('fieldValue signs only bonus keys and reads status codes', () => {
	assert.equal(fieldValue('attackBonus', 1), '+1')
	assert.equal(fieldValue('damageBonus', 2), '+2')
	assert.equal(fieldValue('proficiencyBonus', 4), '+4')
	assert.equal(fieldValue('saveDC', 12), '12')
	assert.equal(fieldValue(undefined, 5), '5')
	assert.equal(fieldValue('attackBonus', 'à vérifier'), 'à vérifier')
	assert.equal(fieldValue('completeness', 'filled_from_annex'), 'Complété depuis l’annexe')
	assert.equal(fieldValue('x', true), 'Oui')
	assert.equal(fieldValue(childField('0', 'attackBonusBySpellLevel'), 5), '+5')
	assert.equal(fieldValue(childField('0', 'saveDCBySpellLevel'), 13), '13')
})

test('every snake_case status code of the source data has a French reading', () => {
	for (const code of [
		'filled_from_annex',
		'partial_from_annex',
		'template_not_active',
		'source_or_visual_estimate',
		'from_source',
		'non_transcrit',
		'annexes_integrated_partial_right_page_review',
		'editorial_navigation',
		'source_based_action',
	])
		assert.notEqual(valueLabel(code), code)
})

test('isTechnicalKey hides identifiers only, never provenance', () => {
	assert.equal(isTechnicalKey('id'), true)
	assert.equal(isTechnicalKey('statBlockId'), true)
	for (const k of ['source', 'file', 'printedPage', 'sourcePages', 'sourceChapter'])
		assert.equal(isTechnicalKey(k), false)
})

test('describe() hides ids, signs bonuses and joins sentences without ". ;"', () => {
	const campaign = normalizeStormwreck({
		monsters: [
			{
				id: 'm',
				statBlock: {
					name: 'M',
					actions: [
						{
							id: 'a1',
							name: 'Souffle',
							attackBonus: -1,
							saveDC: 12,
							statBlockId: 'zz',
							description: 'Cible touchée. Elle tombe.',
							effect: ['Prend des dégâts.', 'Fin...', 'Dernier.'],
						},
					],
				},
			},
		],
	})
	assert.equal(
		campaign.monsters[0].actions[0],
		"Nom : Souffle ; Bonus d'attaque : -1 ; DD de sauvegarde : 12 ; Description : Cible touchée. Elle tombe ; effect : Prend des dégâts ; Fin... ; Dernier.",
	)
})

test('string transitions are labelled with the target scene title, never the raw id', () => {
	const campaign = normalizeStormwreck({
		chapters: [
			{
				id: 'c',
				scenes: [
					{ id: 'a', title: 'A', transitions: ['b', 'inconnue', { sceneId: 'b', label: 'Aller' }] },
					{ id: 'b', title: 'La grotte' },
				],
			},
		],
	})
	assert.deepEqual(campaign.indexes.scenes.a.transitions, [
		{ sceneId: 'b', label: 'La grotte' },
		{ sceneId: 'inconnue', label: 'Scène suivante' },
		{ sceneId: 'b', label: 'Aller' },
	])
	const real = normalizeStormwreck()
	for (const s of Object.values(real.indexes.scenes))
		for (const t of s.transitions) assert.doesNotMatch(t.label, /^ch\d/)
})

test('frPlural keeps 0 and 1 singular', () => {
	assert.equal(frPlural(0, 'réussite', 'réussites'), '0 réussite')
	assert.equal(frPlural(1, 'échec', 'échecs'), '1 échec')
	assert.equal(frPlural(2, 'réussite', 'réussites'), '2 réussites')
})
