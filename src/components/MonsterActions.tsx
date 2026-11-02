import { useState } from 'preact/hooks'
import { damageFormulas } from '../services/dice'
import * as game from '../services/game'
import { frPlural } from '../services/labels'
import type { Combatant, GameState, Monster, Track } from '../types'
import { FormulaRoll } from './DiceRoller'

function DamageRoll({
	formula,
	label,
	targets,
	onApply,
}: {
	formula: string
	label: string
	targets: { id: string; label: string }[]
	onApply: (targetId: string, total: number) => void
}) {
	const [target, setTarget] = useState('')
	// a target that was removed or died meanwhile is no longer offered: treat it as unselected
	const chosen = targets.some((t) => t.id === target) ? target : ''
	return (
		<FormulaRoll formula={formula} label={label}>
			{(total) => (
				<div class='apply-damage'>
					<label>
						Cible
						<select value={chosen} onChange={(e) => setTarget(e.currentTarget.value)}>
							<option value=''>Choisir une cible</option>
							{targets.map((t) => (
								<option value={t.id}>{t.label}</option>
							))}
						</select>
					</label>
					<button type='button' disabled={!chosen || total < 1} onClick={() => onApply(chosen, total)}>
						Appliquer {frPlural(total, 'dégât', 'dégâts')}
					</button>
				</div>
			)}
		</FormulaRoll>
	)
}
export function MonsterActions({
	monster,
	attacker,
	state,
	track,
	announce,
}: {
	monster: Monster
	attacker: Combatant
	state: GameState
	track: Track
	announce: (message: string) => void
}) {
	// Single target, never the attacker; removed and dead participants are not offered.
	const targets = (state.combat?.participants ?? [])
		.filter((p) => p.id !== attacker.id && !['removed', 'dead'].includes(game.getVitals(state, p).status))
		.map((p) => ({ id: p.playerId || p.id, label: game.participantLabel(p, state) }))
	const applyDamage = (targetId: string, total: number) => {
		const label = targets.find((t) => t.id === targetId)!.label
		// announce first: a concentration notice from track() must not be overwritten by it
		announce(`${frPlural(total, 'dégât appliqué', 'dégâts appliqués')} à ${label}.`)
		track(
			targetId,
			`${frPlural(total, 'dégât', 'dégâts')} à ${label}`,
			(s) => game.damage(s, targetId, total),
			total,
		)
	}
	const actions = Array.isArray(monster.details?.actions)
		? monster.details.actions.filter(
				(a): a is Record<string, unknown> => !!a && typeof a === 'object' && !Array.isArray(a),
			)
		: []
	return (
		<section class='monster-actions' aria-label={`Attaques et jets de ${monster.name}`}>
			<h4>Attaques & jets</h4>
			{actions.length
				? actions.map((action, index) => {
						const name = typeof action.name === 'string' ? action.name : `Action ${index + 1}`
						const damage = typeof action.damage === 'string' ? action.damage : ''
						const bonus =
							typeof action.attackBonus === 'number' &&
							Number.isSafeInteger(action.attackBonus) &&
							Math.abs(action.attackBonus) <= 100
								? action.attackBonus
								: null
						return (
							<div class='monster-action' key={index}>
								<h4>{name}</h4>
								<div class='tags'>
									{bonus !== null && (
										<strong>
											Pour toucher : {bonus >= 0 ? '+' : ''}
											{bonus}
										</strong>
									)}
									{typeof action.saveDC === 'number' && (
										<strong>Sauvegarde : DD {action.saveDC}</strong>
									)}
									{action.recharge != null && <span>Recharge : {String(action.recharge)}</span>}
								</div>
								{damage && (
									<p>
										<b>Dégâts :</b> {damage}
									</p>
								)}
								{typeof action.description === 'string' && <p>{action.description}</p>}
								<div class='attack-rolls'>
									{bonus !== null && (
										<FormulaRoll
											formula={`1d20${bonus >= 0 ? '+' : ''}${bonus}`}
											label={`${name} · toucher`}
										/>
									)}
									{damageFormulas(damage).map((formula, i) => (
										<DamageRoll
											key={i}
											formula={formula}
											label={`${name} · dégâts ${i + 1}`}
											targets={targets}
											onApply={applyDamage}
										/>
									))}
								</div>
							</div>
						)
					})
				: [...new Set([...monster.attacks, ...monster.actions])].map((action, index) => (
						<div class='monster-action' key={index}>
							<p>{action}</p>
							{damageFormulas(action).map((formula, i) => (
								<DamageRoll
									key={i}
									formula={formula}
									label={`Jet ${i + 1}`}
									targets={targets}
									onApply={applyDamage}
								/>
							))}
						</div>
					))}
			{!actions.length && !monster.attacks.length && !monster.actions.length && (
				<p>Attaques non renseignées : consultez la source.</p>
			)}
		</section>
	)
}
