import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { type DiceResult, rollFormula } from '../services/dice'
import { Icon } from './icons'

export function RollResult({ result, label }: { result: DiceResult; label?: string }) {
	return (
		<div class='dice-result' role='status' aria-live='polite'>
			{/* trailing space (invisible at line end) so the live region's text does not read "dégâts 11d6" */}
			{label && <strong>{label} </strong>}
			<span>
				{result.rolls.map((g) => `${g.values.length}d${g.sides} : ${g.values.join(', ')}`).join(' · ')}
				{result.modifier !== 0 && ` · Modificateur ${result.modifier > 0 ? '+' : ''}${result.modifier}`}
			</span>
			<b>Total : {result.total}</b>
		</div>
	)
}
// children: controls shown under the result that need its total (damage rolls: target picker and apply button).
export function FormulaRoll({
	formula,
	label,
	children,
}: {
	formula: string
	label: string
	children?: (total: number) => ComponentChildren
}) {
	const [result, setResult] = useState<DiceResult | null>(null)
	const [error, setError] = useState('')
	return (
		<div class='formula-roll'>
			<button
				type='button'
				onClick={() => {
					try {
						setResult(rollFormula(formula))
						setError('')
					} catch (err) {
						setError(err instanceof Error ? err.message : 'Lancer impossible.')
					}
				}}
			>
				<Icon name='dice' size={16} />
				{label} · {formula}
			</button>
			{error && <p role='alert'>{error}</p>}
			{result && <RollResult result={result} label={label} />}
			{result && children?.(result.total)}
		</div>
	)
}
