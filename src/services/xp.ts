// Barème officiel D&D 5e (2014) : points d’expérience par indice de dangerosité (FP).
export const XP_BY_CR: Record<string, number> = {
	'0': 10,
	'1/8': 25,
	'1/4': 50,
	'1/2': 100,
	'1': 200,
	'2': 450,
	'3': 700,
	'4': 1100,
	'5': 1800,
	'6': 2300,
	'7': 2900,
	'8': 3900,
	'9': 5000,
	'10': 5900,
	'11': 7200,
	'12': 8400,
	'13': 10000,
	'14': 11500,
	'15': 13000,
	'16': 15000,
	'17': 18000,
	'18': 20000,
	'19': 22000,
	'20': 25000,
	'21': 33000,
	'22': 41000,
	'23': 50000,
	'24': 62000,
	'25': 75000,
	'26': 90000,
	'27': 105000,
	'28': 120000,
	'29': 135000,
	'30': 155000,
}
// Some imports store fractions as decimals.
const DECIMAL_CR: Record<string, string> = { '0.125': '1/8', '0.25': '1/4', '0.5': '1/2' }
// Single XP ceiling: manual field `max`, save validation and the end-of-combat sum.
export const MAX_XP = 10_000_000
export function xpForChallenge(challenge: string): number | null {
	const key = challenge.trim()
	const cr = DECIMAL_CR[key] ?? key
	return Object.hasOwn(XP_BY_CR, cr) ? XP_BY_CR[cr]! : null
}
