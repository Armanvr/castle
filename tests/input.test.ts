import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readIntegerInput } from '../src/components/input.ts'

test('numeric edits reject empty, fractional, unsafe and out-of-range values without committing zero', () => {
	let message = ''
	let reported = 0
	const input = {
		valueAsNumber: Number.NaN,
		checkValidity: () => true,
		setCustomValidity: (value: string) => {
			message = value
		},
		reportValidity: () => {
			reported++
			return false
		},
	} as unknown as HTMLInputElement
	assert.equal(readIntegerInput(input), null)
	assert.match(message, /entier/)
	for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1]) {
		input.valueAsNumber = value
		assert.equal(readIntegerInput(input), null)
	}
	input.valueAsNumber = 0
	assert.equal(readIntegerInput(input), 0)
	assert.equal(message, '')
	input.valueAsNumber = -2
	assert.equal(readIntegerInput(input), -2)
	input.checkValidity = () => false
	assert.equal(readIntegerInput(input), null)
	assert.equal(reported, 4)
})
