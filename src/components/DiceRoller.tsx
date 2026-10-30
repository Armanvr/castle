import { useState } from 'preact/hooks'
import { rollFormula, type DiceResult } from '../services/dice'
import { Icon } from './icons'

export function RollResult({ result, label }: { result: DiceResult; label?: string }) {
	return (
		<div class='dice-result' role='status' aria-live='polite'>
			{label && <strong>{label}</strong>}
			<span>
				{result.rolls.map((g) => `${g.values.length}d${g.sides} : ${g.values.join(', ')}`).join(' · ')}
				{result.modifier !== 0 && ` · Modificateur ${result.modifier > 0 ? '+' : ''}${result.modifier}`}
			</span>
			<b>Total : {result.total}</b>
		</div>
	)
}
export function FormulaRoll({ formula, label }: { formula: string; label: string }) {
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
		</div>
	)
}
