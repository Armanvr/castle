import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import * as game from '../services/game'
import { childField, fieldLabel, fieldValue, isTechnicalKey, valueLabel } from '../services/labels'
import type { Campaign, Choice, GameState, Monster, Scene, Source } from '../types'
import type { Update } from './CombatView'
import { Icon } from './icons'
import { readIntegerInput } from './input'

type Section = 'readAloud' | 'summary' | 'dmNotes' | 'dialogues'
export function SceneView({
	campaign,
	state,
	scene,
	update,
	goCombat,
}: {
	campaign: Campaign
	state: GameState
	scene: Scene
	update: Update
	goCombat: (id?: string) => void
}) {
	const selectChoice = (choice: Choice) => {
		if (choice.important && !confirm('Appliquer ce choix et ses conséquences ?')) return
		update((s) => game.applyChoice(s, campaign, choice))
		if (choice.effects.some((effect) => effect.type === 'start_encounter')) goCombat()
	}
	const [dialogue, setDialogue] = useState<string | null>(null)
	const current = scene.dialogues.find((d) => d.id === dialogue) || scene.dialogues[0]
	const [revealed, setRevealed] = useState<Partial<Record<Section, boolean>>>({})
	const added = state.sceneAdditions?.[scene.id]
	// a section with neither source content nor DM addition collapses to one button; revealed stays true while typing
	const shown = (section: Section, source: unknown) => source || revealed[section] || added?.[section]
	const collapsed = (section: Section, addLabel: string, note?: string) => (
		<div class='scene-collapsed'>
			{note && <p>{note}</p>}
			<button type='button' class='text-button' onClick={() => setRevealed((r) => ({ ...r, [section]: true }))}>
				<Icon name='plus' size={15} /> {addLabel}
			</button>
		</div>
	)
	const noReadAloud = 'Aucun texte à lire fourni : consultez le livret.'
	const noDialogue = 'Aucun dialogue pour cette scène.'
	return (
		<>
			<div class='section-heading'>
				<div>
					<span class='eyebrow'>SCÈNE · NIVEAU {scene.recommendedLevel ?? 'non renseigné'}</span>
					<h2>{scene.title}</h2>
					<p>
						{campaign.locations.find((l) => l.id === scene.locationId)?.name} ·{' '}
						{scene.source.type === 'official_summary'
							? 'Résumé de source officielle'
							: 'Contenu personnalisé'}
					</p>
				</div>
				<label class='status-select'>
					Progression
					<select
						value={state.sceneStatus[scene.id] || ''}
						onChange={(e) => {
							const status = e.currentTarget.value as 'visited' | 'completed' | 'ignored'
							update((s) => ({ ...s, sceneStatus: { ...s.sceneStatus, [scene.id]: status } }))
						}}
					>
						<option value='' disabled>
							À explorer
						</option>
						<option value='visited'>Visitée</option>
						<option value='completed'>Terminée</option>
						<option value='ignored'>Ignorée</option>
					</select>
				</label>
			</div>
			{shown('summary', scene.summary) ? (
				<section class='panel scene-reading'>
					<span class='eyebrow'>RÉSUMÉ STRUCTURÉ · MJ</span>
					{scene.summary && <p>{scene.summary}</p>}
					<SceneAddition
						scene={scene}
						state={state}
						campaign={campaign}
						update={update}
						section='summary'
						label='Résumé structuré · MJ'
						autoFocus={revealed.summary}
					/>
				</section>
			) : (
				collapsed('summary', 'Ajouter un résumé (MJ)')
			)}
			{shown('dialogues', current) ? (
				<section class='panel scene-reading'>
					<span class='eyebrow'>DIALOGUES</span>
					{current ? (
						<>
							<h3>{campaign.npcs.find((n) => n.id === current.speakerId)?.name || current.speakerId}</h3>
							<p class='dialogue'>« {current.text} »</p>
							{current.choices.map((c) => (
								<button
									type='button'
									class='choice-button'
									onClick={() => setDialogue(c.nextDialogueId)}
								>
									{c.label}
									<Icon name='chevron' size={16} />
								</button>
							))}
						</>
					) : (
						<p>{noDialogue}</p>
					)}
					<SceneAddition
						scene={scene}
						state={state}
						campaign={campaign}
						update={update}
						section='dialogues'
						label='Dialogues'
						autoFocus={revealed.dialogues}
					/>
				</section>
			) : (
				collapsed('dialogues', 'Ajouter un dialogue (MJ)', noDialogue)
			)}
			{shown('readAloud', scene.readAloud) ? (
				<div class='read-aloud panel scene-reading'>
					<span class='eyebrow'>
						<Icon name='chapters' size={16} /> À LIRE AUX JOUEURS
					</span>
					{scene.readAloud ? <blockquote>{scene.readAloud}</blockquote> : <p>{noReadAloud}</p>}
					<SceneAddition
						scene={scene}
						state={state}
						campaign={campaign}
						update={update}
						section='readAloud'
						label='À lire aux joueurs'
						autoFocus={revealed.readAloud}
					/>
				</div>
			) : (
				collapsed('readAloud', 'Ajouter un texte à lire (MJ)', noReadAloud)
			)}
			{campaign.locations
				.filter((l) => l.id === scene.locationId)
				.map((l) => (
					<details class='panel'>
						<summary>Lieu : {l.name}</summary>
						<p>{l.description}</p>
					</details>
				))}
			{scene.characters.length > 0 && (
				<section class='scene-references'>
					<h3>Personnages de la scène</h3>
					{scene.characters.map((id) => (
						<NpcCard key={id} campaign={campaign} id={id} />
					))}
				</section>
			)}
			{scene.checks.length > 0 && (
				<section class='panel'>
					<span class='eyebrow'>TESTS DE COMPÉTENCE</span>
					{scene.checks.map((c) => (
						<div class='check-row'>
							<b>
								{c.ability} · DD {c.dc ?? 'non renseigné'}
							</b>
							<p>{c.description}</p>
							{c.onSuccess && <p>Réussite : {c.onSuccess}</p>}
							{c.onFailure && <p>Échec : {c.onFailure}</p>}
							{[
								['Réussite', c.successChoiceId],
								['Échec', c.failureChoiceId],
							].map(([label, id]) => {
								const choice = scene.choices.find((x) => x.id === id)
								return (
									choice && (
										<button
											type='button'
											disabled={
												!game.canChoose(state, choice) ||
												state.appliedChoices.includes(choice.id)
											}
											onClick={() => selectChoice(choice)}
										>
											{label}
										</button>
									)
								)
							})}
						</div>
					))}
				</section>
			)}
			<div class='button-row'>
				{scene.encounterIds.map((id) => (
					<button
						type='button'
						class='primary'
						onClick={() => {
							goCombat(id)
						}}
					>
						<Icon name='encounters' />
						Préparer : {campaign.encounters.find((e) => e.id === id)?.name || 'rencontre du scénario'}
					</button>
				))}
			</div>
			<SourceNote source={scene.source} />
			<section class='panel'>
				<h3>Choix & conséquences</h3>
				{scene.choices.length === 0 && (
					<p>Explorez librement et notez les décisions du groupe dans le journal.</p>
				)}
				{scene.choices.map((c) => (
					<button
						type='button'
						class='choice-button'
						disabled={!game.canChoose(state, c) || state.appliedChoices.includes(c.id)}
						onClick={() => selectChoice(c)}
					>
						<span>
							{c.label}
							{c.origin && <small>{valueLabel(c.origin)}</small>}
							{c.manualDetails && <small>{c.manualDetails}</small>}
							<small>
								{state.appliedChoices.includes(c.id)
									? 'Choix enregistré'
									: !game.canChoose(state, c)
										? 'Conditions non remplies'
										: c.manual
											? 'Option manuelle du MJ · aucun effet non documenté'
											: 'Appliquer les conséquences'}
							</small>
						</span>
						<Icon name={state.appliedChoices.includes(c.id) ? 'check' : 'arrow'} size={18} />
					</button>
				))}
				{state.undo && (
					<button
						type='button'
						class='text-button'
						onClick={() => {
							if (
								confirm(
									'Annuler le dernier choix et revenir à l’état de partie juste avant ce choix ? Possible uniquement sans modification depuis ce choix.',
								)
							)
								update(game.undoChoice)
						}}
					>
						↶ Annuler le dernier choix
					</button>
				)}
				{scene.transitions.length > 0 && (
					<nav class='button-row scene-navigation' aria-label='Suite de la scène'>
						{scene.transitions.map((t) => (
							<button
								type='button'
								onClick={() => update((s) => game.navigateScene(s, campaign, t.sceneId))}
							>
								{t.label}
								<Icon name='arrow' size={16} />
							</button>
						))}
					</nav>
				)}
			</section>
		</>
	)
}
export function CharactersView({ campaign, state, update }: { campaign: Campaign; state: GameState; update: Update }) {
	return (
		<>
			<div class='section-heading'>
				<div>
					<span class='eyebrow'>LE GROUPE</span>
					<h2>Les héros de cette histoire.</h2>
					<p>Caractéristiques et ressources · PV partagés avec le combat.</p>
				</div>
			</div>
			<CustomPlayerForm campaign={campaign} update={update} />
			{!campaign.players.length && (
				<p class='panel'>
					Aucun personnage joueur enregistré. Ajoutez les fiches de vos joueurs pour commencer.
				</p>
			)}
			<div class='cards-grid'>
				{campaign.players.map((p) => (
					<article id={`player-${p.id}`} class='panel character-sheet'>
						<div class='character-heading'>
							<span class='portrait'>{p.name.slice(0, 2)}</span>
							<div>
								<h3>{p.name}</h3>
								{p.source?.type === 'custom' && <span class='tag'>Ajout du MJ</span>}
								<p>
									{p.race || 'Origine non renseignée'} · {p.class || 'Classe non renseignée'} · Niveau{' '}
									{p.level ?? '—'}
								</p>
							</div>
						</div>
						<VitalControls
							vitals={state.players[p.id]}
							maxHp={p.combat.maxHp}
							targetId={p.id}
							update={update}
						/>
						<div class='ability-grid'>
							{(
								['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const
							).map((key, i) => {
								const score = p.abilities?.[key]
								return (
									<div>
										<span>{['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'][i]}</span>
										<b>{p.abilities?.[key] ?? '—'}</b>
										<small>
											{score == null
												? 'Non renseigné'
												: `${Math.floor((score - 10) / 2) >= 0 ? '+' : ''}${Math.floor((score - 10) / 2)}`}
										</small>
										<span class='sr-only'>{key}</span>
									</div>
								)
							})}
						</div>
						<div class='tags'>
							<span class='tag'>CA {p.combat.armorClass}</span>
							<span class='tag'>
								Vitesse {p.combat.speed === null ? 'Non renseignée' : `${p.combat.speed} m`}
							</span>
							<span class='tag'>
								Initiative {p.combat.initiativeBonus >= 0 ? '+' : ''}
								{p.combat.initiativeBonus}
							</span>
						</div>
						{[
							['Compétences', p.skills],
							['Sauvegardes', p.savingThrows],
							['Attaques', p.attacks],
							['Capacités', p.features],
							['Sorts', p.spells],
							[
								'Inventaire',
								[
									...p.inventory,
									...Object.entries(state.itemAssignments || {})
										.filter(([, owner]) => owner === p.id)
										.map(([id]) => campaign.items.find((item) => item.id === id)?.name || id),
								],
							],
						].map(([label, values]) => (
							<details>
								<summary>{label}</summary>
								<p>{(values as string[]).join(' · ') || 'Aucun élément renseigné'}</p>
							</details>
						))}
						{p.resources.map((r) => (
							<label class='resource-label'>
								{r.name}
								<input
									type='number'
									min='0'
									max={r.max}
									value={state.players[p.id].resources[r.id] ?? r.max}
									onChange={(e) => {
										const value = readIntegerInput(e.currentTarget)
										if (value !== null)
											update((s) =>
												game.updateVitals(s, p.id, {
													resources: { ...s.players[p.id].resources, [r.id]: value },
												}),
											)
									}}
								/>
								<span>/ {r.max}</span>
							</label>
						))}
					</article>
				))}
			</div>
			<h2>Personnages & PNJ · informations MJ</h2>
			<div class='cards-grid'>
				{campaign.npcs.map((npc) => (
					<NpcCard key={npc.id} campaign={campaign} id={npc.id} />
				))}
			</div>
		</>
	)
}

import { VitalControls } from './CombatView'
export function BestiaryView({ campaign }: { campaign: Campaign }) {
	return (
		<>
			<div class='section-heading'>
				<div>
					<span class='eyebrow'>BESTIAIRE</span>
					<h2>Connaissez vos créatures.</h2>
					<p>Seules les statistiques fournies sont affichées. Les champs inconnus restent à vérifier.</p>
				</div>
			</div>
			<div class='cards-grid'>
				{campaign.monsters.map((monster) => (
					<article id={`monster-${monster.id}`} key={monster.id} class='panel monster-sheet'>
						<MonsterProfile monster={monster} />
					</article>
				))}
			</div>
		</>
	)
}
const pagesLabel = (pages: number[]) => `${pages.length > 1 ? 'pages' : 'page'} ${pages.join(', ')}`
export function SourceNote({ source }: { source?: Source }) {
	if (!source || source.type === 'fictional_demo') return null
	return (
		<p class='footnote'>
			Source :{' '}
			{source.files?.length
				? source.files.map((s) => `${s.file}${s.pages.length ? ` — ${pagesLabel(s.pages)}` : ''}`).join(' · ')
				: `${source.type === 'official_summary' ? 'Résumé du livret' : 'Ajout du MJ'}${source.pages.length ? ` · ${pagesLabel(source.pages)}` : ''}`}
		</p>
	)
}
export function StructuredDetails({ value, field }: { value: unknown; field?: string }) {
	if (value === null || value === undefined) return <span>Non renseigné</span>
	if (Array.isArray(value))
		return value.length ? (
			<ul>
				{value.map((v, i) => (
					<li key={i}>
						<StructuredDetails value={v} field={field} />
					</li>
				))}
			</ul>
		) : (
			<span>Non renseigné</span>
		)
	if (typeof value === 'object') {
		// undefined = key deliberately left out by the caller (JSON never holds undefined)
		const entries = Object.entries(value).filter(([key, v]) => v !== undefined && !isTechnicalKey(key))
		return entries.length ? (
			<dl class='structured-details'>
				{entries.map(([key, v]) => (
					<div key={key}>
						<dt>{fieldLabel(key)}</dt>
						<dd>
							<StructuredDetails value={v} field={childField(key, field)} />
						</dd>
					</div>
				))}
			</dl>
		) : (
			<span>Non renseigné</span>
		)
	}
	return <span>{fieldValue(field, value)}</span>
}
export function MonsterProfile({ monster: m }: { monster: Monster }) {
	return (
		<>
			<span class='eyebrow'>
				{m.type || 'Type non renseigné'}
				{/* the adapter derives size from the type text ("de taille M"): do not repeat it */}
				{m.size && m.type.split(/[^\p{L}\p{N}]+/u).includes(m.size)
					? ''
					: ` · ${m.size || 'Taille non renseignée'}`}
			</span>
			<h3>{m.name}</h3>
			{(m.requiresVerification || m.maxHp === null || m.armorClass === null) && (
				<p class='alert'>Profil incomplet — vérification nécessaire</p>
			)}
			<div class='monster-stats'>
				<span>
					CA <b>{m.armorClass ?? '—'}</b>
				</span>
				<span>
					PV <b>{m.maxHp ?? '—'}</b>
				</span>
				<span>
					FP <b>{m.challenge || '—'}</b>
				</span>
			</div>
			<p>
				Vitesse{m.source.type === 'official_summary' ? ' (m)' : ''} : {m.speed || 'Non renseignée'}
			</p>
			<div class='ability-grid'>
				{(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).map(
					(key, i) => (
						<div key={key}>
							<span>{['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'][i]}</span>
							<b>{m.abilities?.[key] ?? '—'}</b>
						</div>
					),
				)}
			</div>
			{[
				['Sauvegardes', m.savingThrows],
				['Compétences', m.skills],
				['Résistances', m.resistances],
				['Immunités', m.immunities],
				['Vulnérabilités', m.vulnerabilities],
				['Sens', [m.senses]],
				['Langues', [m.languages]],
				['Capacités', m.features],
				['Attaques', m.attacks],
				['Actions', m.actions],
				['À vérifier', m.notes || []],
			].map(([label, values]) => (
				<div class='stat-line'>
					<b>{label}</b>
					<span>{(values as string[]).filter(Boolean).join(' · ') || 'Non renseigné'}</span>
				</div>
			))}
			{m.details && (
				<details>
					<summary>Détails du profil source</summary>
					<StructuredDetails value={m.details} />
				</details>
			)}
			<SourceNote source={m.source} />
		</>
	)
}
function NpcCard({ campaign, id }: { campaign: Campaign; id: string }) {
	const npc = campaign.npcs.find((n) => n.id === id)
	if (!npc) return <p>PNJ introuvable : {id}</p>
	return (
		<details id={`npc-${npc.id}`} class='panel npc-card'>
			<summary>{npc.name}</summary>
			<span class='eyebrow'>INFORMATIONS RÉSERVÉES AU MJ</span>
			<p>{npc.description}</p>
			{npc.details && (
				<details>
					<summary>Détails du PNJ</summary>
					<StructuredDetails
						value={{
							...npc.details,
							// dialogues are shown below; the chapter id reads as its title
							dialogues: undefined,
							sourceChapter:
								campaign.chapters.find((c) => c.id === npc.details?.sourceChapter)?.title ??
								npc.details.sourceChapter,
						}}
					/>
				</details>
			)}
			{npc.dialogues?.length ? <StructuredDetails value={npc.dialogues} /> : <p>Aucun dialogue fourni.</p>}
			{npc.statBlockId && (
				<details>
					<summary>
						Statistiques :{' '}
						{campaign.monsters.find((m) => m.id === npc.statBlockId)?.name || npc.statBlockId}
					</summary>
					{campaign.monsters.find((m) => m.id === npc.statBlockId) ? (
						<MonsterProfile monster={campaign.monsters.find((m) => m.id === npc.statBlockId)!} />
					) : (
						<p>Profil introuvable : {npc.statBlockId}</p>
					)}
				</details>
			)}
			<SourceNote source={npc.source} />
		</details>
	)
}
function CustomPlayerForm({ campaign, update }: { campaign: Campaign; update: Update }) {
	const form = useRef<HTMLFormElement>(null)
	const submittedPlayer = useRef<string | null>(null)
	useLayoutEffect(() => {
		if (submittedPlayer.current && campaign.players.some((p) => p.id === submittedPlayer.current)) {
			form.current?.reset()
			submittedPlayer.current = null
		}
	}, [campaign.players])
	return (
		<details class='panel'>
			<summary>Ajouter un PJ · saisie manuelle</summary>
			<p>Valeurs de votre fiche uniquement. Les autres caractéristiques resteront non renseignées.</p>
			<form
				ref={form}
				class='inline-fields'
				onSubmit={(e) => {
					e.preventDefault()
					const f = e.currentTarget
					const d = new FormData(f)
					update((s) => {
						const next = game.addCustomPlayer(s, campaign, {
							name: String(d.get('name')).trim(),
							maxHp: Number(d.get('maxHp')),
							armorClass: Number(d.get('armorClass')),
							initiativeBonus: Number(d.get('initiativeBonus')),
						})
						submittedPlayer.current = next.customPlayers!.at(-1)!.id
						return next
					})
				}}
			>
				<label>
					Nom
					<input name='name' required />
				</label>
				<label>
					PV maximum
					<input name='maxHp' type='number' required min='1' step='1' />
				</label>
				<label>
					CA
					<input name='armorClass' type='number' required min='0' max='100' step='1' />
				</label>
				<label>
					Bonus d'initiative
					<input name='initiativeBonus' type='number' required min='-100' max='100' step='1' />
				</label>
				<button type='submit'>Ajouter le PJ</button>
			</form>
		</details>
	)
}
export function CampaignInfo({ campaign }: { campaign: Campaign }) {
	return (
		<details class='panel campaign-info'>
			<summary>
				Introduction & vérifications de la campagne{' '}
				{campaign.warnings?.length ? `(${campaign.warnings.length} avertissements)` : ''}
			</summary>
			{campaign.introduction && (
				<>
					<h3>{campaign.introduction.title}</h3>
					<SourceNote source={campaign.introduction.source} />
					<p>{campaign.introduction.world}</p>
					<p>{campaign.introduction.premise}</p>
					<StructuredDetails value={campaign.introduction.dmGuidance} />
					<StructuredDetails value={campaign.introduction.notes} />
				</>
			)}
			{campaign.limitations?.map((text) => (
				<p key={text}>{text}</p>
			))}
			{campaign.warnings?.length ? (
				<section>
					<h3>Avertissements des données</h3>
					<ul>
						{campaign.warnings.map((text, i) => (
							<li key={i}>{text}</li>
						))}
					</ul>
				</section>
			) : null}
		</details>
	)
}
export function ItemsView({ campaign, state, update }: { campaign: Campaign; state: GameState; update: Update }) {
	return (
		<>
			<div class='section-heading'>
				<div>
					<span class='eyebrow'>OBJETS & RÉCOMPENSES</span>
					<h2>Les trouvailles du groupe.</h2>
					<p>
						Attribution manuelle et unique par objet du catalogue. Aucune récompense de scène n'est
						supposée.
					</p>
				</div>
			</div>
			{!Object.keys(state.itemAssignments || {}).length && (
				<p class='panel'>Aucune récompense attribuée aux personnages joueurs.</p>
			)}
			{!!campaign.pendingRewards?.length && (
				<section class='panel'>
					<h3>Récompenses à vérifier dans les sources</h3>
					<ul>
						{campaign.pendingRewards.map((text) => (
							<li key={text}>{text}</li>
						))}
					</ul>
				</section>
			)}
			<div class='cards-grid'>
				{campaign.items.map((item) => (
					<article id={`item-${item.id}`} class='panel' key={item.id}>
						<span class='eyebrow'>
							{item.category} · {item.rarity}
						</span>
						<h3>{item.name}</h3>
						<p>{item.description}</p>
						{item.mechanics && <StructuredDetails value={item.mechanics} />}
						<SourceNote source={item.source} />
						{state.itemAssignments?.[item.id] ? (
							<p class='tag'>
								Attribué à{' '}
								{campaign.players.find((p) => p.id === state.itemAssignments?.[item.id])?.name ||
									state.itemAssignments?.[item.id]}
							</p>
						) : (
							<form
								class='button-row'
								onSubmit={(e) => {
									e.preventDefault()
									const playerId = String(new FormData(e.currentTarget).get('player'))
									if (confirm(`Attribuer ${item.name} à ce PJ ?`))
										update((s) => game.assignItem(s, campaign, item.id, playerId))
								}}
							>
								<label>
									Destinataire
									<select name='player' required disabled={!campaign.players.length}>
										<option value=''>Choisir un PJ</option>
										{campaign.players.map((p) => (
											<option key={p.id} value={p.id}>
												{p.name}
											</option>
										))}
									</select>
								</label>
								<button type='submit' disabled={!campaign.players.length}>
									Attribuer cet objet
								</button>
							</form>
						)}
					</article>
				))}
			</div>
		</>
	)
}

function SceneAddition({
	scene,
	state,
	campaign,
	update,
	section,
	label,
	autoFocus,
}: {
	scene: Scene
	state: GameState
	campaign: Campaign
	update: Update
	section: Section
	label: string
	autoFocus?: boolean
}) {
	const area = useRef<HTMLTextAreaElement>(null)
	useEffect(() => {
		if (autoFocus) area.current?.focus()
	}, [])
	const text = state.sceneAdditions?.[scene.id]?.[section] ?? ''
	return (
		<div class='scene-addition'>
			{text && (
				<div class='mj-addition'>
					<strong>Ajout du MJ</strong>
					<p>{text}</p>
				</div>
			)}
			<details open={autoFocus}>
				<summary>{text ? 'Modifier mon ajout' : 'Ajouter un texte du MJ'}</summary>
				<label>
					Texte supplémentaire · {label}
					<textarea
						ref={area}
						value={text}
						placeholder='Votre texte pour cette scène…'
						onInput={(e) => {
							const value = e.currentTarget.value
							update((s) => game.updateSceneAddition(s, campaign, scene.id, section, value))
						}}
					/>
				</label>
				<small>Ajout propre à cette scène. Videz le champ pour le retirer.</small>
			</details>
		</div>
	)
}
