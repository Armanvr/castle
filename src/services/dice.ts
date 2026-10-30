export const DIE_SIDES = [4, 6, 8, 10, 12, 20] as const
export interface DiceGroup {
	sides: number
	count: number
}
export interface DiceResult {
	rolls: { sides: number; values: number[] }[]
	modifier: number
	total: number
}
export function rollDice(groups: DiceGroup[], modifier = 0, random = Math.random): DiceResult {
	const count = groups.reduce((sum, group) => sum + group.count, 0)
	if (
		!Number.isSafeInteger(modifier) ||
		Math.abs(modifier) > 10000 ||
		count < 1 ||
		count > 100 ||
		groups.some(
			(g) => !(DIE_SIDES as readonly number[]).includes(g.sides) || !Number.isInteger(g.count) || g.count < 0,
		)
	)
		throw new Error('Choisissez de 1 à 100 dés et un modificateur entier de −10 000 à 10 000.')
	const rolls = groups
		.filter((g) => g.count > 0)
		.map((g) => ({
			sides: g.sides,
			values: Array.from({ length: g.count }, () => Math.floor(random() * g.sides) + 1),
		}))
	return { rolls, modifier, total: rolls.reduce((sum, g) => sum + g.values.reduce((a, b) => a + b, 0), modifier) }
}
export function damageFormulas(text: string): string[] {
	return (
		text
			.match(/\b\d+d(?:20|12|10|8|6|4)\b(?:\s*[+−-]\s*\d+)?/gi)
			?.map((formula) => formula.replace(/\s/g, '').replace('−', '-')) ?? []
	)
}
export function rollFormula(formula: string): DiceResult {
	const match = /^(\d+)d(4|6|8|10|12|20)([+-]\d+)?$/i.exec(formula)
	if (!match) throw new Error('Formule de dés non reconnue.')
	return rollDice([{ count: Number(match[1]), sides: Number(match[2]) }], Number(match[3] ?? 0))
}
