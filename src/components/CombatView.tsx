import { useEffect, useRef, useState } from 'preact/hooks'
import { damageFormulas } from '../services/dice'
import * as game from '../services/game'
import { frPlural } from '../services/labels'
import type { Campaign, Combatant, GameState, Monster, Vitals } from '../types'
import { FormulaRoll } from './DiceRoller'
import { Icon } from './icons'
import { isTyping, readIntegerInput } from './input'
import { MonsterProfile, SourceNote } from './Views'

const participantLabel = game.participantLabel
const typeLabels = {
	player: 'Personnage joueur',
	monster: 'Monstre',
	ally: 'PNJ allié',
	hostile: 'PNJ hostile',
}
const statusLabels: Record<string, string> = { unconscious: 'Inconscient', stable: 'Stable', dead: 'Mort' }
export type Update = (change: (state: GameState) => GameState) => void
// Like Update, but records the target's HP fields beforehand so the combat view can undo it.
export type Track = (targetId: string, label: string, change: (state: GameState) => GameState, damage?: number) => void
type UndoEntry = { label: string; targetId: string; before: game.VitalsSnapshot }
const UNDO_LIMIT = 20
// Same bounds as the stats editor and the unknown-stats inputs of "Ajouter une créature".
const statFields = [
	['armorClass', 'CA', 0, 100],
	['maxHp', 'PV maximum', 1, Number.MAX_SAFE_INTEGER],
	['initiativeBonus', 'Bonus d’initiative', -100, 100],
] as const
const validStat = (text: string, min: number, max: number) =>
	text.trim() !== '' && Number.isSafeInteger(Number(text)) && Number(text) >= min && Number(text) <= max
const statRange = (min: number, max: number) =>
	max === Number.MAX_SAFE_INTEGER ? `entier supérieur ou égal à ${min}` : `entier de ${min} à ${max}`
// Remaining rounds are shown instead of the legacy free-text duration; 0 means expired.
const conditionSuffix = (c: Vitals['conditions'][number]) =>
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
function Participant({
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
	const removalNotice = `${participantLabel(p, state)} retiré du combat. Réintégrer depuis « Retirés ».`
	const monster = campaign.monsters.find((m) => m.id === p.monsterId)
	return (
		<article class={`combatant panel ${state.combat?.activeId === p.id ? 'is-active' : ''}`}>
			<div class='combatant-top'>
				<span class='portrait small'>{p.name.slice(0, 2)}</span>
				<div>
					<h3>{participantLabel(p, state)}</h3>
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
				name={participantLabel(p, state)}
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
									track(id, `Sauvegarde contre la mort de ${participantLabel(p, state)}`, (s) =>
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
function InitiativeRow({
	p,
	state,
	update,
	active,
	focused,
	tied,
	onFocus,
	track,
}: {
	p: Combatant
	state: GameState
	update: Update
	active: boolean
	focused: boolean
	tied: boolean
	onFocus: () => void
	track: Track
}) {
	const [amount, setAmount] = useState('1')
	const validAmount = Number.isSafeInteger(Number(amount)) && Number(amount) > 0
	const v = game.getVitals(state, p)
	const id = p.playerId || p.id
	const label = participantLabel(p, state)
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
						aria-label={`Faire passer ${p.name} avant le participant précédent à initiative égale`}
						onClick={() => update((s) => game.promoteTie(s, p.id))}
					>
						↑
					</button>
				)}
			</div>
		</li>
	)
}
export function CombatView({
	campaign,
	state,
	update,
	requestedEncounter,
	clearRequested,
}: {
	campaign: Campaign
	state: GameState
	update: Update
	requestedEncounter?: string
	clearRequested: () => void
}) {
	const combat = state.combat
	const [preparing, setPreparing] = useState<string | null>(requestedEncounter || null)
	useEffect(() => {
		if (requestedEncounter) {
			setPreparing(requestedEncounter)
			clearRequested()
		}
	}, [requestedEncounter])
	const [participantType, setParticipantType] = useState<'monster' | 'ally' | 'hostile'>('monster')
	const [monsterId, setMonsterId] = useState(campaign.monsters[0]?.id || '')
	// DM-supplied values for the selected monster's unknown (null) stats, as typed.
	const [typedStats, setTypedStats] = useState<Record<string, string>>({})
	const addedMonster = campaign.monsters.find((m) => m.id === monsterId)
	const missingStats = statFields.filter(([key]) => addedMonster?.[key] === null)
	const statsComplete =
		!!addedMonster && missingStats.every(([key, , min, max]) => validStat(typedStats[key] ?? '', min, max))
	// null = the focus panel follows the active combatant
	const [focusId, setFocusId] = useState<string | null>(null)
	useEffect(() => setFocusId(null), [combat?.activeId])
	// Message of the polite live region; replaced by the next remove/restore, never cleared by a timer.
	const [notice, setNotice] = useState('')
	// In-memory only (never saved): last HP-affecting actions made from this view, newest last.
	const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
	useEffect(() => setUndoStack([]), [combat?.id, combat?.status === 'finished'])
	const track: Track = (targetId, label, change, damage) =>
		update((s) => {
			const next = change(s)
			if (damage) {
				const p = s.combat?.participants.find((x) => x.id === targetId || x.playerId === targetId)
				const concentration = p && game.concentrationNotice(s, next, targetId, damage, participantLabel(p, s))
				if (concentration) setNotice(concentration)
			}
			const before = game.vitalsSnapshot(s, targetId)
			// shortcut: side effect inside the updater (Preact runs it once, eagerly), it is the only place that sees the state the change applies to; upgrade: have update() return the previous state.
			if (JSON.stringify(before) !== JSON.stringify(game.vitalsSnapshot(next, targetId)))
				setUndoStack((stack) => [...stack, { label, targetId, before }].slice(-UNDO_LIMIT))
			return next
		})
	const lastUndo = undoStack.at(-1)
	const undo = () => {
		if (!lastUndo) return
		setUndoStack(undoStack.slice(0, -1))
		update((s) => game.restoreVitals(s, lastUndo.targetId, lastUndo.before))
		setNotice(`Annulé : ${lastUndo.label}`)
	}
	const advance = () =>
		update((s) => {
			const next = game.nextTurn(s)
			const expired = game
				.expiredConditions(s, next)
				.map(({ participantId, condition }) => {
					const p = next.combat!.participants.find((x) => x.id === participantId)!
					return `Condition expirée : ${condition} (${participantLabel(p, next)})`
				})
				.join(' · ')
			if (expired) setNotice(expired)
			return next
		})
	// Re-registered every render so the handlers always see the current state; one document listener.
	useEffect(() => {
		if (!combat || combat.status === 'finished') return
		const onKey = (e: KeyboardEvent) => {
			if (isTyping(e.target)) return
			const key = e.key.toLowerCase()
			if (key === 'z' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
				e.preventDefault()
				undo()
			} else if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
				if (key === 'n' && combat.status === 'active') advance()
				else if (key === 'd') {
					// the sheet of the displayed combatant; VitalControls is shared with the character sheet, so no ref
					const input = document.querySelector<HTMLInputElement>('#combat-focus .damage-controls input')
					if (!input) return
					input.focus()
					input.select()
				} else return
				e.preventDefault()
			}
		}
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	})
	// Where focus goes once the removed/restored combatant has re-rendered: a row id, or the Retirés summary.
	const pendingFocus = useRef<{ row: string } | 'summary' | 'next' | null>(null)
	const removedSummary = useRef<HTMLElement>(null)
	const nextTurnButton = useRef<HTMLButtonElement>(null)
	const toolbar = useRef<HTMLDivElement>(null)
	// No deps on purpose: keep the target until the render that contains it has happened.
	useEffect(() => {
		const target = pendingFocus.current
		if (!target) return
		const el =
			target === 'summary'
				? removedSummary.current
				: target === 'next'
					? nextTurnButton.current
					: document.querySelector<HTMLElement>(`.row-name[data-participant="${CSS.escape(target.row)}"]`)
		if (!el) return
		// shortcut: a suspended combat leaves "Tour suivant" disabled, focus then falls to the page, upgrade: focus "Reprendre"
		el.focus()
		pendingFocus.current = null
	})
	const onRemoved = (message: string) => {
		setNotice(message)
		// The sheet only shows the selected combatant: drop the selection so a later restore doesn't reselect it.
		setFocusId(null)
		pendingFocus.current = 'summary'
	}
	const awaiting = game.creaturesAwaitingInitiative(state)
	const initiativeHint = 'Toutes les créatures ont une initiative. Les PJ saisissent la leur.'
	const removed = (combat?.participants ?? []).filter((p) => game.getVitals(state, p).status === 'removed')
	const order = game.sortedParticipants(state)
	const activeP = order.find((p) => p.id === combat?.activeId)
	const focused = order.find((p) => p.id === focusId) ?? activeP ?? order[0]
	const focus = (id: string) => {
		setFocusId(id)
		// shortcut: stacked layout puts the sheet below the list; scroll it in when it is below the half fold
		const panel = document.getElementById('combat-focus')
		if (panel && toolbar.current && panel.getBoundingClientRect().top > window.innerHeight / 2) {
			// the sticky toolbar wraps to a variable height: .combat-focus reads it for scroll-margin-top
			panel.style.setProperty('--combat-toolbar-h', `${toolbar.current.offsetHeight}px`)
			panel.scrollIntoView({ block: 'start' })
		}
	}
	return (
		<>
			<div class='section-heading'>
				<div>
					<span class='eyebrow'>INITIATIVE & RENCONTRES</span>
					<h2>À vous de jouer.</h2>
					<p>Gardez le rythme. Les règles restent entre vos mains.</p>
				</div>
				<button
					type='button'
					class='primary'
					onClick={() => {
						setPreparing('')
					}}
				>
					<Icon name='plus' /> Préparer une rencontre personnalisée
				</button>
			</div>
			{preparing !== null && (
				<EncounterPreparation
					key={preparing}
					campaign={campaign}
					state={state}
					encounterId={preparing || undefined}
					update={update}
					close={() => setPreparing(null)}
				/>
			)}
			{!combat || combat.status === 'finished' ? (
				preparing === null && (
					<>
						<div class='empty-state panel'>
							<Icon name='encounters' size={40} />
							<h3>Le calme avant la bataille</h3>
							<p>
								Aucun combat en cours. Sélectionnez une rencontre du scénario ou créez une rencontre
								personnalisée.
							</p>
						</div>
						<div class='cards-grid'>
							{campaign.encounters.map((e) => (
								<article class='panel encounter-preview'>
									<span class='eyebrow'>RENCONTRE DU SCÉNARIO</span>
									<h3>{e.name}</h3>
									<p>{e.description}</p>
									<button type='button' onClick={() => setPreparing(e.id)}>
										Préparer la rencontre <Icon name='arrow' size={16} />
									</button>
								</article>
							))}
						</div>
					</>
				)
			) : (
				<>
					<div class='sr-only' role='status'>
						{notice}
					</div>
					<div class='combat-toolbar panel' ref={toolbar}>
						<div>
							<span class='eyebrow'>
								{combat.status === 'active' ? 'COMBAT EN COURS' : 'COMBAT SUSPENDU'}
							</span>
							<h3>
								{combat.name} <span class='tag'>Round {combat.round}</span>
								{!combat.encounterId && <span class='tag'>Rencontre personnalisée</span>}
							</h3>
							{activeP && (
								<p>
									Tour de : <strong>{participantLabel(activeP, state)}</strong>
								</p>
							)}
							<p class='shortcut-hint'>
								Raccourcis : N tour suivant · D dégâts · Entrée appliquer · Ctrl+Z annuler
							</p>
						</div>
						<div class='button-row'>
							<button
								type='button'
								disabled={awaiting === 0}
								title={awaiting === 0 ? initiativeHint : undefined}
								aria-describedby={awaiting === 0 ? 'initiative-hint' : undefined}
								onClick={() => {
									// the button disables itself once every creature has rolled: keep focus in the toolbar
									pendingFocus.current = 'next'
									update((s) => game.rollCreatureInitiatives(s))
								}}
							>
								<Icon name='dice' /> Initiatives des créatures
							</button>
							{awaiting === 0 && (
								<span id='initiative-hint' class='sr-only'>
									{initiativeHint}
								</span>
							)}
							{combat.round === 1 && combat.status === 'active' && (
								<button
									type='button'
									onClick={() =>
										update((s) => ({
											...s,
											combat: s.combat && {
												...s.combat,
												activeId: game.sortedParticipants(s)[0]?.id ?? null,
											},
										}))
									}
								>
									Passer au premier participant
								</button>
							)}
							<button
								type='button'
								onClick={() =>
									update((s) => ({
										...s,
										combat: s.combat && {
											...s.combat,
											status: s.combat.status === 'suspended' ? 'active' : 'suspended',
										},
									}))
								}
							>
								{combat.status === 'suspended' ? 'Reprendre' : 'Suspendre'}
							</button>
							<button
								type='button'
								class='undo-button'
								disabled={!lastUndo}
								aria-keyshortcuts='Control+Z Meta+Z'
								onClick={undo}
							>
								{lastUndo ? `Annuler · ${lastUndo.label}` : 'Annuler'}
							</button>
							<button
								type='button'
								class='primary'
								ref={nextTurnButton}
								disabled={combat.status !== 'active'}
								aria-keyshortcuts='N'
								onClick={advance}
							>
								Tour suivant <Icon name='arrow' size={16} />
							</button>
						</div>
					</div>
					<div class='combat-wrap'>
						<div class='combat-layout'>
							<div>
								<ol class='initiative-list' aria-label='Ordre d’initiative'>
									{order.map((p, i) => (
										<InitiativeRow
											key={p.id}
											p={p}
											state={state}
											update={update}
											active={combat.activeId === p.id}
											focused={focused?.id === p.id}
											tied={order[i - 1]?.initiative === p.initiative}
											onFocus={() => focus(p.id)}
											track={track}
										/>
									))}
								</ol>
								{removed.length > 0 && (
									<details class='removed-participants'>
										<summary ref={removedSummary}>Retirés ({removed.length})</summary>
										<ul>
											{removed.map((p) => {
												const label = participantLabel(p, state)
												return (
													<li key={p.id}>
														<span>
															{label} <small class='muted'>· {typeLabels[p.type]}</small>
														</span>
														<button
															type='button'
															aria-label={`Réintégrer ${label} dans le combat`}
															onClick={() => {
																update((s) =>
																	game.restoreParticipant(s, p.playerId || p.id),
																)
																setNotice(`${label} réintégré.`)
																pendingFocus.current = { row: p.id }
															}}
														>
															Réintégrer
														</button>
													</li>
												)
											})}
										</ul>
									</details>
								)}
								<div class='add-participant'>
									<select
										aria-label='Type du participant à ajouter'
										value={participantType}
										onChange={(e) =>
											setParticipantType(e.currentTarget.value as 'monster' | 'ally' | 'hostile')
										}
									>
										<option value='monster'>Monstre</option>
										<option value='ally'>PNJ allié</option>
										<option value='hostile'>PNJ hostile</option>
									</select>
									<select
										aria-label='Créature à ajouter'
										value={monsterId}
										onChange={(e) => {
											setMonsterId(e.currentTarget.value)
											setTypedStats({})
										}}
									>
										{campaign.monsters.map((m) => (
											<option value={m.id}>{m.name}</option>
										))}
									</select>
									<button
										type='button'
										disabled={!statsComplete}
										onClick={() => {
											if (!addedMonster || !statsComplete) return
											const known = (key: (typeof statFields)[number][0]) =>
												addedMonster[key] ?? Number(typedStats[key])
											update((s) =>
												game.addParticipant(s, campaign, monsterId, participantType, {
													maxHp: known('maxHp'),
													armorClass: known('armorClass'),
													initiativeBonus: known('initiativeBonus'),
												}),
											)
											setTypedStats({})
										}}
									>
										<Icon name='plus' size={16} /> Ajouter une créature
									</button>
									{missingStats.length > 0 && (
										<fieldset class='missing-stats'>
											<legend>Valeurs MJ requises pour {addedMonster?.name}</legend>
											<div class='inline-fields'>
												{missingStats.map(([key, label, min, max]) => {
													const valid = validStat(typedStats[key] ?? '', min, max)
													return (
														<label key={key}>
															{label}
															<input
																type='number'
																required
																min={min}
																max={max}
																step='1'
																aria-invalid={!valid}
																aria-describedby={`missing-${key}`}
																value={typedStats[key] ?? ''}
																onInput={(e) =>
																	setTypedStats({
																		...typedStats,
																		[key]: e.currentTarget.value,
																	})
																}
															/>
															<small
																id={`missing-${key}`}
																role={valid ? undefined : 'status'}
															>
																{valid
																	? ''
																	: `${label} : ${statRange(min, max)} requis.`}
															</small>
														</label>
													)
												})}
											</div>
										</fieldset>
									)}
									<span class='muted'>
										À initiative égale, ↑ fait passer un participant avant le précédent.
									</span>
								</div>
							</div>
							{focused && (
								<section id='combat-focus' class='combat-focus' aria-labelledby='combat-focus-title'>
									<div class='combat-focus-head'>
										<h3 id='combat-focus-title'>Fiche de combat</h3>
										<span>{focused.id === combat.activeId ? 'Tour en cours' : 'Hors tour'}</span>
									</div>
									<Participant
										key={focused.id}
										p={focused}
										state={state}
										update={update}
										campaign={campaign}
										onRemoved={onRemoved}
										track={track}
										announce={setNotice}
									/>
								</section>
							)}
						</div>
					</div>
					<div class='button-row encounter-end'>
						<button
							type='button'
							onClick={() => {
								if (
									confirm(
										'Recommencer au round 1 et remettre tous les participants en activité, PV et ressources au maximum ? PV temporaires, conditions, épuisement, sauvegardes contre la mort et initiatives sont réinitialisés. CA, PV maximum et bonus d’initiative sont conservés.',
									)
								)
									update((s) => game.resetEncounter(s, campaign))
							}}
						>
							Réinitialiser la rencontre
						</button>
						<button
							type='button'
							class='danger'
							onClick={() => {
								if (confirm('Terminer ce combat et inscrire sa fin au journal ?'))
									update(game.finishEncounter)
							}}
						>
							Terminer le combat
						</button>
					</div>
				</>
			)}
			<p class='footnote'>Règles 2014 · Les effets et durées des conditions restent à arbitrer.</p>
		</>
	)
}

function EncounterPreparation({
	campaign,
	state,
	encounterId,
	update,
	close,
}: {
	campaign: Campaign
	state: GameState
	encounterId?: string
	update: Update
	close: () => void
}) {
	const encounter = campaign.encounters.find((e) => e.id === encounterId)
	const submittedCombat = useRef<string | null>(null)
	useEffect(() => {
		if (submittedCombat.current && state.combat?.id === submittedCombat.current) {
			submittedCombat.current = null
			close()
		}
	}, [state.combat?.id])
	return (
		<section class='panel encounter-preparation'>
			<h3>Préparer le combat : {encounter?.name || 'Rencontre personnalisée'}</h3>
			<p>
				Vérifiez les quantités dans le livret. Les valeurs inconnues exigent une saisie MJ. Les ajustements
				concernent uniquement cette rencontre.
			</p>
			{encounter?.notes?.map((note) => (
				<p class='footnote' key={note}>
					{note}
				</p>
			))}
			<SourceNote source={encounter?.source} />
			<form
				onSubmit={(e) => {
					e.preventDefault()
					const data = new FormData(e.currentTarget)
					const participantOverrides: Record<
						number,
						{ count: number; maxHp: number; armorClass: number; initiativeBonus: number }
					> = {}
					for (const [i] of (encounter?.participants || []).entries())
						participantOverrides[i] = {
							count: Number(data.get(`${i}-count`)),
							maxHp: Number(data.get(`${i}-maxHp`)),
							armorClass: Number(data.get(`${i}-armorClass`)),
							initiativeBonus: Number(data.get(`${i}-initiativeBonus`)),
						}
					if (
						state.combat &&
						state.combat.status !== 'finished' &&
						!confirm(
							'Remplacer le combat actuel ? Les créatures et PNJ de ce combat et leur état seront perdus. Les PV et ressources des PJ seront conservés.',
						)
					)
						return
					update((s) => {
						const next = game.startEncounter({ ...s, combat: null }, campaign, encounterId, {
							selectedPlayerIds: data.getAll('players').map(String),
							participantOverrides,
						})
						submittedCombat.current = next.combat!.id
						return next
					})
				}}
			>
				<fieldset>
					<legend>PJ participants</legend>
					{campaign.players.length ? (
						campaign.players.map((p) => (
							<label class='party-choice' key={p.id}>
								<input type='checkbox' name='players' value={p.id} defaultChecked />
								{p.name}
							</label>
						))
					) : (
						<p>Aucun PJ. Ajoutez les fiches dans Personnages pour inclure votre groupe.</p>
					)}
				</fieldset>
				{encounter?.participants.map((p, i) => {
					const m = campaign.monsters.find((m) => m.id === p.monsterId)
					return (
						<fieldset key={i}>
							<legend>{m?.name || p.monsterId}</legend>
							{!m && (
								<p class='alert'>
									Profil introuvable : cette rencontre nécessite une correction des références.
								</p>
							)}
							{m?.requiresVerification && <p class='alert'>Profil incomplet — vérification nécessaire</p>}
							<div class='inline-fields'>
								{[
									['count', 'Quantité', p.count, 1],
									['maxHp', 'PV maximum', m?.maxHp, 1],
									['armorClass', 'CA', m?.armorClass, 0],
									['initiativeBonus', 'Bonus d’initiative', m?.initiativeBonus, undefined],
								].map(([key, label, value, min]) => (
									<label key={String(key)}>
										{label}
										<input
											type='number'
											name={`${i}-${key}`}
											defaultValue={(value as number | undefined) ?? ''}
											min={min as number | undefined}
											max={
												key === 'count' || key === 'armorClass' || key === 'initiativeBonus'
													? 100
													: Number.MAX_SAFE_INTEGER
											}
											required
											step='1'
											placeholder='À saisir par le MJ'
										/>
									</label>
								))}
							</div>
						</fieldset>
					)
				})}
				<div class='button-row'>
					<button
						class='primary'
						type='submit'
						disabled={encounter?.participants.some(
							(p) => !campaign.monsters.some((m) => m.id === p.monsterId),
						)}
					>
						Démarrer le combat
					</button>
					<button type='button' onClick={close}>
						Annuler la préparation
					</button>
				</div>
			</form>
		</section>
	)
}

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
function MonsterActions({
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
		.map((p) => ({ id: p.playerId || p.id, label: participantLabel(p, state) }))
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
