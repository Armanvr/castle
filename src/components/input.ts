export function readIntegerInput(input: HTMLInputElement): number | null {
	const value = input.valueAsNumber
	input.setCustomValidity(Number.isSafeInteger(value) ? '' : 'Saisissez un entier valide.')
	if (!Number.isSafeInteger(value) || !input.checkValidity()) {
		input.reportValidity()
		return null
	}
	return value
}
// Single-key shortcuts must not fire while the DM types in a field.
export const isTyping = (target: EventTarget | null) =>
	!!(target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]:not([contenteditable=false])')
