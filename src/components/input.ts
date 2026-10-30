export function readIntegerInput(input: HTMLInputElement): number | null {
	const value = input.valueAsNumber
	input.setCustomValidity(Number.isSafeInteger(value) ? '' : 'Saisissez un entier valide.')
	if (!Number.isSafeInteger(value) || !input.checkValidity()) {
		input.reportValidity()
		return null
	}
	return value
}
