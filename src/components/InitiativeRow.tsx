import { useState } from 'preact/hooks'
import * as game from '../services/game'
import { frPlural } from '../services/labels'
import type { Campaign, Combatant, GameState, Track, Update } from '../types'
import { conditionSuffix, typeLabels } from './CombatSheet'

export const statusLabels: Record<string, string> = { unconscious: 'Inconscient', stable: 'Stable', dead: 'Mort' }
export function InitiativeRow({
	p,
	state,
	update,
	active,
	focused,
	tied,
	onFocus,
	track,
	campaign,
	announce,
}: {
	p: Combatant
	state: GameState
	update: Update
	active: boolean
	focused: boolean
	tied: boolean
	onFocus: () => void
	track: Track
	campaign: Campaign
	announce: (message: string) => void
}) {
	const [amount, setAmount] = useState('1')
	const validAmount = Number.isSafeInteger(Number(amount)) && Number(amount) > 0
	const v = game.getVitals(state, p)
	const id = p.playerId || p.id
	const label = game.participantLabel(p, state)
	return (
		<li
			class={`initiative-row${active ? ' is-active' : ''}${focused ? ' is-focused' : ''}${v.status === 'dead' ? ' is-down' : ''}`}
			aria-current={active ? 'true' : undefined}
		>
			<span class='row-init'>{p.initiative}</span>
			<div class='row-main'>
				<div class='row-line'>
					<button
						type='button'
						class='row-name'
						data-participant={p.id}
						aria-pressed={focused}
						aria-controls='combat-focus'
						onClick={onFocus}
					>
						{label}
					</button>
					<span class='row-hp'>
						<strong>{v.hp}</strong> / {p.maxHp}
						<span class='sr-only'> PV</span>
						{v.tempHp > 0 && <em>+{v.tempHp}</em>}
					</span>
				</div>
				<div class='row-meta'>
					<small>
						{typeLabels[p.type]} · CA {p.armorClass}
					</small>
					{statusLabels[v.status] && (
						<span class={`tag${v.status === 'unconscious' || v.status === 'dead' ? ' is-danger' : ''}`}>
							{statusLabels[v.status]}
						</span>
					)}
					{v.conditions.map((c) => (
						<span class={`tag${c.rounds === 0 ? ' is-expired' : ''}`} key={c.name}>
							{c.name}
							{conditionSuffix(c) && ` · ${conditionSuffix(c)}`}
						</span>
					))}
				</div>
				<meter min='0' max={p.maxHp} value={v.hp} aria-label={`Points de vie de ${label}`} />
			</div>
			<div class='row-vitals'>
				<input
					aria-label={`Quantité pour ${label} · entier positif`}
					type='number'
					min='1'
					step='1'
					required
					aria-invalid={!validAmount}
					value={amount}
					onInput={(e) => setAmount(e.currentTarget.value)}
				/>
				<button
					type='button'
					aria-label={`Dégâts à ${label}`}
					disabled={!validAmount}
					onClick={() =>
						track(
							id,
							`${frPlural(Number(amount), 'dégât', 'dégâts')} à ${label}`,
							(s) => game.damage(s, id, Number(amount)),
							Number(amount),
						)
					}
				>
					−
				</button>
				<button
					type='button'
					class='heal'
					aria-label={`Soins à ${label}`}
					disabled={!validAmount}
					onClick={() =>
						track(id, `${frPlural(Number(amount), 'soin', 'soins')} à ${label}`, (s) =>
							game.heal(s, id, Number(amount)),
						)
					}
				>
					+
				</button>
				{tied && (
					<button
						type='button'
						aria-label={`Faire passer ${label} avant le participant précédent à initiative égale`}
						onClick={() => update((s) => game.promoteTie(s, p.id))}
					>
						↑
					</button>
				)}
				{p.monsterId && (
					<button
						type='button'
						aria-label={`Ajouter un autre exemplaire de ${label}`}
						onClick={() =>
							update((s) => {
								const next = game.addParticipant(s, campaign, p.monsterId!, p.type, {
									maxHp: p.maxHp,
									armorClass: p.armorClass,
									initiativeBonus: p.initiativeBonus,
								})
								// same side effect in the updater as track(): only announced once the copy exists
								announce(`${game.participantLabel(next.combat!.participants.at(-1)!, next)} ajouté`)
								return next
							})
						}
					>
						+ 1
					</button>
				)}
			</div>
		</li>
	)
}
