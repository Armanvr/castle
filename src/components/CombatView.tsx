import { useEffect, useRef, useState } from 'preact/hooks'
import * as game from '../services/game'
import type { Campaign, GameState, Track, Update } from '../types'
import { CombatSheet, statFields, typeLabels } from './CombatSheet'
import { EncounterPreparation } from './EncounterPreparation'
import { InitiativeRow, statusLabels } from './InitiativeRow'
import { Icon } from './icons'
import { isTyping } from './input'

type UndoEntry = { label: string; targetId: string; before: game.VitalsSnapshot }
const UNDO_LIMIT = 20
const validStat = (text: string, min: number, max: number) =>
	text.trim() !== '' && Number.isSafeInteger(Number(text)) && Number(text) >= min && Number(text) <= max
const statRange = (min: number, max: number) =>
	max === Number.MAX_SAFE_INTEGER ? `entier supérieur ou égal à ${min}` : `entier de ${min} à ${max}`
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
				const concentration =
					p && game.concentrationNotice(s, next, targetId, damage, game.participantLabel(p, s))
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
					return `Condition expirée : ${condition} (${game.participantLabel(p, next)})`
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
	const quick = useRef<HTMLDivElement>(null)
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
			// the pinned part wraps to a variable height: .combat-focus reads it for scroll-margin-top.
			// On phones the toolbar is display: contents (height 0) and only the quick actions are pinned.
			const pinned = toolbar.current.offsetHeight || (quick.current?.offsetHeight ?? 0)
			panel.style.setProperty('--combat-toolbar-h', `${pinned}px`)
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
						<div class='combat-info'>
							<span class='eyebrow'>
								{combat.status === 'active' ? 'COMBAT EN COURS' : 'COMBAT SUSPENDU'}
							</span>
							<h3>
								{combat.name} <span class='tag'>Round {combat.round}</span>
								{!combat.encounterId && <span class='tag'>Rencontre personnalisée</span>}
							</h3>
							{activeP && (
								<p>
									Tour de : <strong>{game.participantLabel(activeP, state)}</strong>
								</p>
							)}
							<p class='shortcut-hint'>
								Raccourcis : N tour suivant · D dégâts · Entrée appliquer · Ctrl+Z annuler
							</p>
							<ul class='party-status' aria-label='État du groupe'>
								{order.map((p) => {
									const v = game.getVitals(state, p)
									if (p.type !== 'player' || v.status === 'removed') return null
									const down = v.hp === 0 || v.status === 'stable' || v.status === 'dead'
									return (
										<li key={p.id}>
											<button
												type='button'
												class={`tag${down ? ' is-danger' : ''}`}
												aria-controls='combat-focus'
												onClick={() => focus(p.id)}
											>
												{p.name} {v.hp}/{p.maxHp}
												{down && ` · ${statusLabels[v.status] ?? '0 PV'}`}
											</button>
										</li>
									)
								})}
							</ul>
						</div>
						<div class='button-row'>
							<div class='combat-tools'>
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
							</div>
							<div class='combat-quick' ref={quick}>
								<button
									type='button'
									class='undo-button'
									disabled={!lastUndo}
									title={lastUndo ? `Annuler · ${lastUndo.label}` : undefined}
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
											campaign={campaign}
											announce={setNotice}
										/>
									))}
								</ol>
								{removed.length > 0 && (
									<details class='removed-participants'>
										<summary ref={removedSummary}>Retirés ({removed.length})</summary>
										<ul>
											{removed.map((p) => {
												const label = game.participantLabel(p, state)
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
									<CombatSheet
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
