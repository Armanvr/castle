import assert from 'node:assert/strict'
import { test } from 'node:test'
import { damageFormulas, rollDice } from '../src/services/dice.ts'

test('mixed dice rolls show individual values and modifier with bounded totals', () => {
	const dice = [
		{ sides: 4, count: 2 },
		{ sides: 20, count: 1 },
	]
	assert.deepEqual(
		rollDice(dice, -2, () => 0),
		{
			rolls: [
				{ sides: 4, values: [1, 1] },
				{ sides: 20, values: [1] },
			],
			modifier: -2,
			total: 1,
		},
	)
	assert.equal(rollDice(dice, 3, () => 0.99999).total, 31)
	for (const sides of [4, 6, 8, 10, 12, 20])
		assert.equal(rollDice([{ sides, count: 1 }], 0, () => 0.99999).total, sides)
	assert.throws(() => rollDice([{ sides: 3, count: 1 }]))
	assert.throws(() => rollDice([{ sides: 6, count: 101 }]))
	assert.throws(() => rollDice([{ sides: 6, count: 1.5 }]))
	assert.throws(() => rollDice([], 0))
})
test('damage formulas preserve separate damage types and never fabricate missing rolls', () => {
	assert.deepEqual(damageFormulas('1d10+3 tranchants et 1d6 dégâts de foudre'), ['1d10+3', '1d6'])
	assert.deepEqual(damageFormulas('4d10 dégâts de foudre'), ['4d10'])
	assert.deepEqual(damageFormulas('Non renseigné'), [])
	assert.deepEqual(damageFormulas('2d100'), [])
})
