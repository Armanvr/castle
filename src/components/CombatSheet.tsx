import { useEffect, useRef, useState } from 'preact/hooks'
import * as game from '../services/game'
import { frPlural } from '../services/labels'
import type { Campaign, Combatant, GameState, Track, Update, Vitals } from '../types'
import { readIntegerInput } from './input'
import { MonsterActions } from './MonsterActions'
import { MonsterProfile } from './Views'

export const typeLabels = {
	player: 'Personnage joueur',
	monster: 'Monstre',
	ally: 'PNJ allié',
	hostile: 'PNJ hostile',
}
// Same bounds as the stats editor and the unknown-stats inputs of "Ajouter une créature".
export const statFields = [
	['armorClass', 'CA', 0, 100],
	['maxHp', 'PV maximum', 1, Number.MAX_SAFE_INTEGER],
	['initiativeBonus', 'Bonus d’initiative', -100, 100],
] as const
// Remaining rounds are shown instead of the legacy free-text duration; 0 means expired.
export const conditionSuffix = (c: Vitals['conditions'][number]) =>
	c.rounds === undefined ? (c.duration ?? '') : c.rounds > 0 ? frPlural(c.rounds, 'round', 'rounds') : 'expirée'
export function VitalControls({
	vitals,
	maxHp,
	targetId,
	update,
	track,
	name = 'ce participant',
}: {
	vitals: Vitals
	maxHp: number
	targetId: string
	update: Update
	track?: Track
	name?: string
}) {
	const [amount, setAmount] = useState('1')
	const validAmount = Number.isSafeInteger(Number(amount)) && Number(amount) > 0
	const run: Track = (id, label, change, damage) => (track ? track(id, label, change, damage) : update(change))
	return (
		<div class='vital-controls'>
			<div class='hp-number'>
				<strong>{vitals.hp}</strong>
				<span> / {maxHp} PV</span>
				{vitals.tempHp > 0 && <em>+{vitals.tempHp} temporaires</em>}
			</div>
			<meter min='0' max={maxHp} value={vitals.hp} aria-label='Points de vie' />
			<form
				class='damage-controls'
				onSubmit={(e) => {
					e.preventDefault()
					if (validAmount)
						run(
							targetId,
							`${frPlural(Number(amount), 'dégât', 'dégâts')} à ${name}`,
							(s) => game.damage(s, targetId, Number(amount)),
							Number(amount),
						)
				}}
			>
				<input
					aria-label='Quantité de dégâts ou soins'
					type='number'
					min='1'
					step='1'
					required
					aria-invalid={!validAmount}
					value={amount}
					onInput={(e) => setAmount(e.currentTarget.value)}
				/>
				<button type='submit' disabled={!validAmount}>
					− Dégâts
				</button>
				<button
					type='button'
					class='heal'
					disabled={!validAmount}
					onClick={() =>
						run(targetId, `${frPlural(Number(amount), 'soin', 'soins')} à ${name}`, (s) =>
							game.heal(s, targetId, Number(amount)),
						)
					}
				>
					+ Soins
				</button>
			</form>
			{!validAmount && <small role='status'>Dégâts ou soins : saisissez un entier positif.</small>}
			<div class='inline-fields'>
				<label>
					PV actuels
					<input
						type='number'
						min='0'
						max={maxHp}
						value={vitals.hp}
						onChange={(e) => {
							const value = readIntegerInput(e.currentTarget)
							if (value !== null)
								run(targetId, `PV actuels de ${name} : ${vitals.hp} → ${value}`, (s) =>
									game.updateVitals(s, targetId, { hp: value }),
								)
						}}
					/>
				</label>
				<label>
					PV temporaires
					<input
						type='number'
						min='0'
						value={vitals.tempHp}
						onChange={(e) => {
							const value = readIntegerInput(e.currentTarget)
							if (value !== null)
								run(targetId, `PV temporaires de ${name} : ${vitals.tempHp} → ${value}`, (s) =>
									game.updateVitals(s, targetId, { tempHp: value }),
								)
						}}
					/>
				</label>
			</div>
		</div>
	)
}
export function CombatSheet({
	p,
	state,
	update,
	campaign,
	onRemoved,
	track,
	announce,
}: {
	p: Combatant
	state: GameState
	update: Update
	campaign: Campaign
	onRemoved: (message: string) => void
	track: Track
	announce: (message: string) => void
}) {
	const v = game.getVitals(state, p)
	const id = p.playerId || p.id
	// Condition picked in the select but not yet added: waiting for its optional duration in rounds.
	const [pendingCondition, setPendingCondition] = useState<string | null>(null)
	const [rounds, setRounds] = useState('')
	const validRounds = rounds.trim() === '' || (Number.isSafeInteger(Number(rounds)) && Number(rounds) >= 1)
	const conditionSelect = useRef<HTMLSelectElement>(null)
	const roundsInput = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (pendingCondition) roundsInput.current?.focus()
	}, [pendingCondition])
	const closeConditionRow = () => {
		setPendingCondition(null)
		setRounds('')
		conditionSelect.current?.focus()
	}
	const removalNotice = `${game.participantLabel(p, state)} retiré du combat. Réintégrer depuis « Retirés ».`
	const monster = campaign.monsters.find((m) => m.id === p.monsterId)
	return (
		<article class={`combatant panel ${state.combat?.activeId === p.id ? 'is-active' : ''}`}>
			<div class='combatant-top'>
				<span class='portrait small'>{p.name.slice(0, 2)}</span>
				<div>
					<h3>{game.participantLabel(p, state)}</h3>
					<small>
						{typeLabels[p.type]} · CA {p.armorClass}
					</small>
				</div>
				<label class='initiative-label'>
					Initiative
					<input
						type='number'
						value={p.initiative}
						onChange={(e) => {
							const value = readIntegerInput(e.currentTarget)
							if (value !== null) update((s) => game.setInitiative(s, p.id, value))
						}}
					/>
				</label>
			</div>
			<VitalControls
				vitals={v}
				maxHp={p.maxHp}
				targetId={id}
				update={update}
				track={track}
				name={game.participantLabel(p, state)}
			/>
			{p.type === 'player' && v.hp === 0 && (
				<fieldset class='death-saves' aria-labelledby={`death-saves-${p.id}`}>
					<b id={`death-saves-${p.id}`}>Sauvegardes contre la mort</b>
					<span role='status'>
						{frPlural(v.deathSaves.successes, 'réussite', 'réussites')} ·{' '}
						{frPlural(v.deathSaves.failures, 'échec', 'échecs')}
					</span>
					<div class='button-row'>
						{(['success', 'failure', 'natural20', 'natural1'] as const).map((result, i) => (
							<button
								type='button'
								onClick={() =>
									track(id, `Sauvegarde contre la mort de ${game.participantLabel(p, state)}`, (s) =>
										game.deathSave(s, id, result),
									)
								}
							>
								{['Réussite', 'Échec', '20 naturel', '1 naturel'][i]}
							</button>
						))}
					</div>
				</fieldset>
			)}
			{monster && (
				<MonsterActions monster={monster} attacker={p} state={state} track={track} announce={announce} />
			)}
			<div class='inline-fields'>
				<label>
					État
					<select
						value={v.status}
						onChange={(e) => {
							const status = e.currentTarget.value as Vitals['status']
							update((s) => game.updateVitals(s, id, { status }))
							if (status === 'removed') onRemoved(removalNotice)
						}}
					>
						{[
							['active', 'Actif'],
							['unconscious', 'Inconscient'],
							['stable', 'Stable'],
							['dead', 'Mort'],
							['removed', 'Retiré'],
						].map(([value, label]) => (
							<option value={value}>{label}</option>
						))}
					</select>
				</label>
				<label>
					Conditions
					<select
						ref={conditionSelect}
						aria-label={`Conditions : ajouter ou retirer une condition à ${p.name}`}
						value=''
						onChange={(e) => {
							const name = e.currentTarget.value
							if (!name) return
							// a condition already present is removed by setCondition: no duration to ask
							if (v.conditions.some((c) => c.name === name))
								update((s) => game.setCondition(s, p.id, name))
							else {
								setPendingCondition(name)
								setRounds('')
							}
						}}
					>
						<option value=''>+ Ajouter une condition</option>
						{game.CONDITIONS.map((c) => (
							<option value={c}>{v.conditions.some((x) => x.name === c) ? `${c} — retirer` : c}</option>
						))}
					</select>
				</label>
			</div>
			{pendingCondition && (
				<form
					class='condition-duration'
					onSubmit={(e) => {
						e.preventDefault()
						if (!validRounds) return
						update((s) =>
							game.setCondition(s, p.id, pendingCondition, rounds.trim() ? Number(rounds) : undefined),
						)
						closeConditionRow()
					}}
					onKeyDown={(e) => {
						if (e.key !== 'Escape') return
						e.preventDefault() // table mode must not also exit
						closeConditionRow()
					}}
				>
					<label>
						Durée en rounds (facultatif) · {pendingCondition}
						<input
							ref={roundsInput}
							type='number'
							min='1'
							step='1'
							aria-invalid={!validRounds}
							value={rounds}
							onInput={(e) => setRounds(e.currentTarget.value)}
						/>
					</label>
					<button type='submit' disabled={!validRounds}>
						Ajouter
					</button>
					<button type='button' onClick={closeConditionRow}>
						Annuler
					</button>
					{!validRounds && <small role='status'>Durée : saisissez un entier positif ou laissez vide.</small>}
				</form>
			)}
			<div class='condition-list'>
				{v.conditions.map((c) => (
					<button
						type='button'
						class={`tag${c.rounds === 0 ? ' is-expired' : ''}`}
						title='Retirer cette condition'
						aria-label={`Retirer la condition ${c.name}${conditionSuffix(c) && ` (${conditionSuffix(c)})`}`}
						onClick={() => update((s) => game.setCondition(s, p.id, c.name))}
					>
						{c.name}
						{conditionSuffix(c) && ` · ${conditionSuffix(c)}`} ×
					</button>
				))}
			</div>
			{/* Uncontrolled on purpose: tying `open` to the notes would close it while typing. */}
			<details>
				<summary>Ajuster les statistiques{p.manualNotes?.trim() && ' · notes'}</summary>
				<fieldset class='combat-stats-editor'>
					<legend>
						Statistiques{' '}
						{p.type === 'player' ? 'du PJ · appliquées à sa fiche' : 'de cette créature uniquement'}
					</legend>
					<div class='inline-fields'>
						{statFields.map(([key, label, min, max]) => (
							<label key={key}>
								{label}
								<input
									type='number'
									required
									min={min}
									max={max}
									step='1'
									value={p[key]}
									onChange={(e) => {
										const value = readIntegerInput(e.currentTarget)
										if (value === null) return
										update((s) => game.updateCombatStats(s, campaign, p.id, { [key]: value }))
									}}
								/>
							</label>
						))}
					</div>
				</fieldset>
				<div class='inline-fields'>
					<label>
						Épuisement (2014)
						<input
							type='number'
							min='0'
							max='6'
							value={v.exhaustion}
							onChange={(e) => {
								const value = readIntegerInput(e.currentTarget)
								if (value !== null) update((s) => game.updateVitals(s, id, { exhaustion: value }))
							}}
						/>
					</label>
				</div>
				<label>
					Notes MJ pour ce participant
					<textarea
						value={p.manualNotes || ''}
						placeholder='Statistiques vérifiées, actions, précisions…'
						onInput={(e) => {
							const manualNotes = e.currentTarget.value
							update((s) => ({
								...s,
								combat: s.combat && {
									...s.combat,
									participants: s.combat.participants.map((x) =>
										x.id === p.id ? { ...x, manualNotes } : x,
									),
								},
							}))
						}}
					/>
				</label>
			</details>
			{monster && (
				<details>
					<summary>Attaques, capacités & profil</summary>
					<MonsterProfile monster={monster} />
				</details>
			)}
			<button
				type='button'
				class='text-button muted'
				onClick={() => {
					update((s) => game.removeParticipant(s, id))
					onRemoved(removalNotice)
				}}
			>
				Retirer du combat
			</button>
		</article>
	)
}
