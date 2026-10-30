import { useEffect, useRef, useState } from 'preact/hooks'
import type { Update } from './components/CombatView'
import { CombatView } from './components/CombatView'
import { Icon } from './components/icons'
import { BestiaryView, CampaignInfo, CharactersView, ItemsView, SceneView } from './components/Views'
import { BUNDLED_CAMPAIGN_URL, loadCampaign } from './services/campaignLoader'
import * as game from './services/game'
import { journalTypeLabel } from './services/labels'
import {
	cleanupLegacyDemoStorage,
	exportGame,
	importGame,
	loadGame,
	saveGame,
	storageKey,
} from './services/storageService'
import type { Campaign, GameState } from './types'

const NAV = [
	['dashboard', 'Tableau de bord'],
	['campaign', 'Campagne'],
	['chapters', 'Chapitres'],
	['players', 'Personnages'],
	['encounters', 'Rencontres'],
	['bestiary', 'Bestiaire'],
	['journal', 'Journal'],
	['items', 'Objets & récompenses'],
	['settings', 'Paramètres'],
]
const DEFAULT_MANIFEST = BUNDLED_CAMPAIGN_URL
export function App() {
	const [staticCampaign, setCampaign] = useState<Campaign | null>(null)
	const [state, setState] = useState<GameState | null>(null)
	const [view, setView] = useState('dashboard')
	const [context, setContext] = useState(true)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(true)
	const [blocked, setBlocked] = useState(false)
	const [slot, setSlot] = useState('1')
	const [legacyNotice, setLegacyNotice] = useState('')
	const [preparedEncounter, setPreparedEncounter] = useState<string | undefined>()
	const [note, setNote] = useState('')
	const [noteTitle, setNoteTitle] = useState('')
	const [saved, setSaved] = useState(false)
	const opening = useRef(false)
	const importPending = useRef(false)
	const [importing, setImporting] = useState(false)
	const [failedSlot, setFailedSlot] = useState<string | null>(null)
	const submittedNote = useRef<{ id: string; note: string; title: string } | null>(null)
	useEffect(() => {
		const submitted = submittedNote.current
		if (submitted && state?.journal.some((entry) => entry.id === submitted.id)) {
			setNote((current) => (current === submitted.note ? '' : current))
			setNoteTitle((current) => (current === submitted.title ? '' : current))
			submittedNote.current = null
		}
	}, [state?.journal])
	const openCampaign = async (nextSlot = slot) => {
		if (opening.current || importPending.current) return
		if (state && !blocked) {
			const problem = saveGame(state, slot)
			if (problem) {
				setError(`${problem} Exportez cette partie avant de changer d’emplacement.`)
				return
			}
		}
		opening.current = true
		setFailedSlot(null)
		setLoading(true)
		try {
			const loaded = await loadCampaign(DEFAULT_MANIFEST)
			const result = loadGame(loaded, nextSlot)
			setCampaign(loaded)
			setState(result.state)
			setError(result.error || '')
			setBlocked(Boolean(result.error))
			setSlot(nextSlot)
			try {
				localStorage.setItem('dnd-dm:slot:' + DEFAULT_MANIFEST, nextSlot)
			} catch {
				/* La sauvegarde principale affichera une erreur si le stockage est indisponible. */
			}
		} catch (e) {
			setFailedSlot(nextSlot)
			setError(
				`Emplacement ${nextSlot} non chargé. ${e instanceof Error ? e.message : 'Réessayez le chargement.'}`,
			)
		} finally {
			opening.current = false
			setLoading(false)
		}
	}
	useEffect(() => {
		const legacy = cleanupLegacyDemoStorage()
		if (legacy.error) setLegacyNotice(legacy.error)
		else if (legacy.preservedSaves)
			setLegacyNotice(
				`${legacy.preservedSaves} ancienne(s) sauvegarde(s) conservée(s), hors de la campagne active.`,
			)
		let initialSlot = '1'
		try {
			initialSlot = localStorage.getItem('dnd-dm:slot:' + DEFAULT_MANIFEST) || '1'
		} catch {}
		void openCampaign(initialSlot)
	}, [])
	useEffect(() => {
		if (!state || blocked || loading || importing) return
		const problem = saveGame(state, slot)
		setSaved(!problem)
		if (problem) setError(problem)
	}, [state, slot, blocked, loading, importing])
	const update: Update = (change) => {
		if (opening.current || importPending.current) return
		if (blocked) {
			setError(
				'Sauvegarde non chargée : ouvrez Paramètres pour exporter l’original, importer une sauvegarde valide ou réinitialiser cet emplacement.',
			)
			return
		}
		setState((current) => {
			if (!current) return current
			try {
				return change(current)
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Action impossible.')
				return current
			}
		})
	}
	const campaign = staticCampaign && state ? game.campaignWithPlayers(staticCampaign, state) : staticCampaign
	if (loading && !campaign)
		return (
			<main class='loading-screen'>
				<Icon name='dice' size={54} />
				<h1>Le Grimoire</h1>
				<p>Ouverture de votre campagne…</p>
			</main>
		)
	if (!campaign || !state)
		return (
			<main class='loading-screen'>
				<h1>Le Grimoire</h1>
				<p role='alert'>{error}</p>
				<button type='button' onClick={() => void openCampaign()}>
					Réessayer le chargement
				</button>
			</main>
		)
	const scenes = campaign.chapters.flatMap((c) => c.scenes)
	const scene = scenes.find((s) => s.id === state.activeSceneId)
	const chapter = campaign.chapters.find((c) => c.id === scene?.chapterId)
	const completed = Object.values(state.sceneStatus).filter((s) => s === 'completed').length
	const navigate = (id: string) => {
		update((s) => game.navigateScene(s, campaign, id))
		setView('campaign')
	}
	const download = () => {
		let data = exportGame(state)
		if (blocked) {
			try {
				data = localStorage.getItem(storageKey(campaign.manifest.id, slot)) || data
			} catch {
				setError('Sauvegarde originale illisible. Réessayez l’export depuis Paramètres.')
				return
			}
		}
		const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
		const a = document.createElement('a')
		a.href = url
		a.download = `${state.campaignId}-sauvegarde-${slot}.json`
		a.click()
		URL.revokeObjectURL(url)
	}
	return (
		<div class={`app-shell ${context ? '' : 'context-hidden'}`}>
			<a class='skip-link' href='#main-content'>
				Aller au contenu
			</a>
			<aside class='sidebar'>
				<button
					type='button'
					class='brand'
					aria-label='Le Grimoire · Tableau de bord'
					onClick={(e) => {
						e.preventDefault()
						setView('dashboard')
					}}
				>
					<span class='brand-mark'>
						<Icon name='dice' size={33} />
					</span>
					<span>
						Le Grimoire<small>L'atelier du maître du donjon</small>
					</span>
				</button>
				<div class='workspace-label'>VOTRE ESPACE DE JEU</div>
				<nav aria-label='Navigation principale'>
					{NAV.map(([id, label]) => (
						<button
							type='button'
							class={view === id ? 'nav-item selected' : 'nav-item'}
							aria-label={label}
							disabled={loading || importing}
							aria-current={view === id ? 'page' : undefined}
							onClick={() => setView(id)}
						>
							<Icon name={id} />
							<span>{label}</span>
							{id === 'encounters' && state.combat?.status === 'active' && <i class='status-dot' />}
							{id === 'journal' && <span class='nav-count'>{state.journal.length}</span>}
						</button>
					))}
				</nav>
				<div class='sidebar-bottom'>
					<div class='local-label'>
						<i class='status-dot' /> Données sur cet appareil
					</div>
					<p>Exportez une sauvegarde pour la conserver ailleurs.</p>
					<button
						type='button'
						class='dm-profile'
						aria-label='Paramètres du MJ'
						disabled={loading || importing}
						onClick={() => setView('settings')}
					>
						<span class='dm-avatar'>MJ</span>
						<span>
							Maître du donjon<small>Espace personnel</small>
						</span>
						<Icon name='settings' size={17} />
					</button>
				</div>
			</aside>
			<div class='workspace'>
				<header class='topbar'>
					<div class='breadcrumb'>
						Votre espace <Icon name='chevron' size={13} />
						<strong>{NAV.find(([id]) => id === view)?.[1]}</strong>
					</div>
					<div class='header-actions'>
						<span class='save-status' role='status'>
							<i class={saved ? 'status-dot' : 'status-dot pending'} />
							{loading
								? 'Ouverture de l’emplacement…'
								: importing
									? 'Lecture de la sauvegarde…'
									: blocked
										? 'Sauvegarde non chargée'
										: saved
											? 'Enregistré sur cet appareil'
											: 'Sauvegarde non confirmée'}
						</span>
						<button
							type='button'
							class='icon-button'
							aria-label={context ? 'Masquer le panneau de contexte' : 'Afficher le panneau de contexte'}
							aria-expanded={context}
							onClick={() => setContext(!context)}
						>
							<Icon name='players' />
						</button>
						<span class='top-avatar'>MJ</span>
					</div>
				</header>
				<main
					id='main-content'
					class='main-content'
					tabIndex={-1}
					aria-busy={loading || importing}
					inert={loading || importing}
				>
					{error && (
						<div class='alert' role='alert'>
							<span>{error}</span>
							{failedSlot && (
								<button type='button' onClick={() => void openCampaign(failedSlot)}>
									Réessayer l’emplacement {failedSlot}
								</button>
							)}
							<button type='button' onClick={() => setError('')} aria-label='Fermer le message'>
								<Icon name='close' size={16} />
							</button>
						</div>
					)}
					{view === 'dashboard' && (
						<>
							<div class='welcome-heading'>
								<div>
									<h1>Tableau de bord</h1>
								</div>
							</div>
							<section class='campaign-hero'>
								<div class='hero-content'>
									<h2>{campaign.manifest.title}</h2>
									<p>{campaign.manifest.subtitle}</p>
									<div class='hero-meta'>
										<span>
											<Icon name='chapters' size={16} /> {campaign.chapters.length} chapitres
										</span>
										<span>
											<Icon name='players' size={16} /> {campaign.players.length} aventuriers
										</span>
										<span>Règles 2014</span>
									</div>
									<button type='button' class='primary' onClick={() => setView('campaign')}>
										Reprendre l'aventure <Icon name='arrow' size={18} />
									</button>
								</div>
								<div class='hero-bottom'>
									<span>
										<i class='status-dot' />{' '}
										{completed || Object.keys(state.sceneStatus).length
											? 'En cours'
											: 'À commencer'}{' '}
										· {chapter?.title || 'Votre aventure'}
									</span>
									<span>
										{completed} / {scenes.length} scènes terminées
									</span>
								</div>
							</section>
							<div class='dashboard-stats'>
								<div>
									<span class='stat-icon'>
										<Icon name='chapters' />
									</span>
									<span>
										<b>
											{Object.keys(state.sceneStatus).length}
											<small> / {scenes.length}</small>
										</b>
										<span class='stat-caption'>Scènes explorées</span>
									</span>
								</div>
								<div>
									<span class='stat-icon'>
										<Icon name='players' />
									</span>
									<span>
										<b>{campaign.players.length}</b>
										<span class='stat-caption'>Aventuriers dans le groupe</span>
									</span>
								</div>
								<div>
									<span class='stat-icon'>
										<Icon name='encounters' />
									</span>
									<span>
										<b>{state.combat?.status === 'active' ? '1' : '0'}</b>
										<span class='stat-caption'>Combat en cours</span>
									</span>
								</div>
								<div>
									<span class='stat-icon'>
										<Icon name='journal' />
									</span>
									<span>
										<b>{state.journal.length}</b>
										<span class='stat-caption'>Souvenirs dans le journal</span>
									</span>
								</div>
							</div>
							<div class='dashboard-columns'>
								<section>
									<div class='block-heading'>
										<h2>Votre prochaine page</h2>
										<button type='button' class='text-button' onClick={() => setView('chapters')}>
											Tous les chapitres <Icon name='arrow' size={15} />
										</button>
									</div>
									<article class='current-scene panel'>
										<div class='scene-illustration' aria-hidden='true'>
											<span>{chapter ? campaign.chapters.indexOf(chapter) + 1 : '—'}</span>
											<Icon name='campaign' size={45} />
										</div>
										<div>
											<span class='eyebrow'>{chapter?.title || 'SCÈNE ACTIVE'}</span>
											<h3>{scene?.title}</h3>
											<p>{scene?.summary || scene?.readAloud}</p>
											<button
												type='button'
												class='text-button'
												onClick={() => setView('campaign')}
											>
												Ouvrir la scène <Icon name='arrow' size={16} />
											</button>
										</div>
									</article>
									<div class='block-heading'>
										<h2>À portée de main</h2>
									</div>
									<div class='quick-actions'>
										{[
											['encounters', 'Rencontres'],
											['journal', 'Note de session'],
											['players', 'Fiches du groupe'],
										].map(([id, title]) => (
											<button type='button' class='quick-action' onClick={() => setView(id)}>
												<Icon name={id} size={23} />
												<b>{title}</b>
												<Icon name='arrow' size={16} />
											</button>
										))}
									</div>
								</section>
								<section>
									<div class='block-heading'>
										<h2>Au fil de l'aventure</h2>
										<button type='button' class='text-button' onClick={() => setView('journal')}>
											Le journal <Icon name='arrow' size={15} />
										</button>
									</div>
									<div class='journal-preview panel'>
										{state.journal.length ? (
											state.journal
												.slice(-4)
												.reverse()
												.map((entry) => (
													<div class='timeline-entry'>
														<span class='timeline-dot' />
														<time>
															{new Date(entry.date).toLocaleDateString('fr-FR', {
																day: 'numeric',
																month: 'short',
															})}
														</time>
														<h4>{entry.title}</h4>
														<p>{entry.description}</p>
													</div>
												))
										) : (
											<div class='empty-journal'>
												<Icon name='journal' size={32} />
												<h3>Aucune entrée au journal</h3>
												<button
													type='button'
													class='text-button'
													onClick={() => setView('journal')}
												>
													Écrire la première note <Icon name='plus' size={16} />
												</button>
											</div>
										)}
									</div>
								</section>
							</div>
							<CampaignInfo campaign={campaign} />
						</>
					)}
					{(view === 'campaign' || view === 'chapters') && (
						<>
							<div class='chapter-navigation'>
								<label>
									Chapitre
									<select
										value={chapter?.id}
										onChange={(e) => {
											const c = campaign.chapters.find((c) => c.id === e.currentTarget.value)
											if (c?.scenes[0]) navigate(c.scenes[0].id)
										}}
									>
										{campaign.chapters.map((c) => (
											<option value={c.id}>{c.title}</option>
										))}
									</select>
								</label>
								<label>
									Scène
									<select value={scene?.id} onChange={(e) => navigate(e.currentTarget.value)}>
										{scenes.map((s) => (
											<option value={s.id}>{s.title}</option>
										))}
									</select>
								</label>
							</div>
							{view === 'chapters' ? (
								<>
									<div class='section-heading'>
										<div>
											<span class='eyebrow'>VOTRE CAMPAGNE</span>
											<h2>Chaque chemin est une histoire.</h2>
											<p>Accédez librement à toute scène. Votre progression est conservée.</p>
										</div>
									</div>
									<div class='chapter-list'>
										{campaign.chapters.map((c, i) => (
											<section class='panel chapter-card'>
												<span class='chapter-number'>0{i + 1}</span>
												<div>
													<span class='eyebrow'>CHAPITRE {i + 1}</span>
													<h3>{c.title}</h3>
													<p>{c.description}</p>
													{c.scenes.map((s) => (
														<button
															type='button'
															class='choice-button'
															onClick={() => navigate(s.id)}
														>
															<span>
																{s.title}
																<small>
																	{{
																		visited: 'Visitée',
																		completed: 'Terminée',
																		ignored: 'Ignorée',
																	}[state.sceneStatus[s.id]] || 'À explorer'}
																</small>
															</span>
															<Icon name='arrow' size={16} />
														</button>
													))}
												</div>
											</section>
										))}
									</div>
								</>
							) : scene ? (
								<SceneView
									key={scene.id}
									campaign={campaign}
									state={state}
									scene={scene}
									update={update}
									goCombat={(id) => {
										setPreparedEncounter(id)
										setView('encounters')
									}}
								/>
							) : (
								<div class='alert'>
									La scène active est introuvable. Sélectionnez une scène dans la liste.
								</div>
							)}
						</>
					)}
					{view === 'items' && <ItemsView campaign={campaign} state={state} update={update} />}

					{view === 'players' && <CharactersView campaign={campaign} state={state} update={update} />}
					{view === 'encounters' && (
						<CombatView
							key={campaign.manifest.id}
							campaign={campaign}
							state={state}
							update={update}
							requestedEncounter={preparedEncounter}
							clearRequested={() => setPreparedEncounter(undefined)}
						/>
					)}
					{view === 'bestiary' && <BestiaryView campaign={campaign} />}
					{view === 'journal' && (
						<>
							<div class='section-heading'>
								<div>
									<span class='eyebrow'>MÉMOIRE DE LA CAMPAGNE</span>
									<h2>Les histoires méritent de rester.</h2>
									<p>Décisions, découvertes et petits détails qui font une grande aventure.</p>
								</div>
							</div>
							<form
								class='panel journal-form'
								onSubmit={(e) => {
									e.preventDefault()
									if (note.trim()) {
										update((s) => {
											const next = game.addJournal(
												s,
												noteTitle.trim() || 'Note de session',
												note.trim(),
											)
											submittedNote.current = {
												id: next.journal.at(-1)!.id,
												note,
												title: noteTitle,
											}
											return next
										})
									}
								}}
							>
								<label>
									Titre de la note
									<input
										value={noteTitle}
										onInput={(e) => setNoteTitle(e.currentTarget.value)}
										placeholder='Une rencontre inattendue…'
									/>
								</label>
								<label>
									Votre note
									<textarea
										required
										value={note}
										onInput={(e) => setNote(e.currentTarget.value)}
										placeholder='Ce que vous souhaitez garder en mémoire…'
									/>
								</label>
								<button class='primary' type='submit'>
									<Icon name='plus' size={17} /> Ajouter au journal
								</button>
							</form>
							<div class='journal-full'>
								{!state.journal.length && (
									<p class='panel'>Aucune entrée dans le journal. Ajoutez une note de session.</p>
								)}
								{state.journal
									.slice()
									.reverse()
									.map((entry) => (
										<article class='panel'>
											<span class='eyebrow'>
												{new Date(entry.date).toLocaleString('fr-FR')} ·{' '}
												{journalTypeLabel(entry.type)}
											</span>
											<h3>{entry.title}</h3>
											<p>{entry.description}</p>
											{entry.sceneId && (
												<button
													type='button'
													class='text-button'
													onClick={() => navigate(entry.sceneId!)}
												>
													Revoir la scène <Icon name='arrow' size={15} />
												</button>
											)}
										</article>
									))}
							</div>
						</>
					)}
					{view === 'settings' && (
						<>
							<div class='section-heading'>
								<div>
									<span class='eyebrow'>VOTRE ESPACE, VOS DONNÉES</span>
									<h2>Préparez votre table.</h2>
									<p>Sauvegardes locales, données portables et campagnes extensibles.</p>
								</div>
							</div>
							<section class='panel settings-section'>
								<h3>Campagne locale</h3>
								<p>{campaign.manifest.title}</p>
								<small>Les données de campagne proviennent des JSON sources fournis.</small>
								{legacyNotice && <p role='status'>{legacyNotice}</p>}
							</section>
							<section class='panel settings-section'>
								<h3>Sauvegarde de campagne</h3>
								<p>
									Les sauvegardes restent sur cet appareil. Exportez-les pour les conserver ailleurs.
								</p>
								<label>
									Emplacement
									<select
										value={slot}
										disabled={loading || importing}
										onChange={(e) => void openCampaign(e.currentTarget.value)}
									>
										{['1', '2', '3'].map((s) => (
											<option value={s}>Emplacement {s}</option>
										))}
									</select>
								</label>
								<div class='button-row'>
									<button type='button' onClick={download}>
										{blocked
											? 'Exporter la sauvegarde endommagée originale'
											: 'Exporter la sauvegarde JSON'}
									</button>
									<label class='button file-button'>
										Importer une sauvegarde
										<input
											type='file'
											accept='.json,application/json'
											disabled={loading || importing}
											onChange={async (e) => {
												const input = e.currentTarget
												const file = input.files?.[0]
												if (!file || opening.current || importPending.current) return
												importPending.current = true
												setImporting(true)
												try {
													const imported = importGame(await file.text(), staticCampaign!)
													if (
														confirm(
															`Remplacer l’emplacement ${slot} par le fichier importé ? Le contenu actuel de cet emplacement sera remplacé.`,
														)
													) {
														setBlocked(false)
														setError('')
														setState(imported)
													}
												} catch (e) {
													setError(e instanceof Error ? e.message : 'Fichier non valide.')
												} finally {
													importPending.current = false
													setImporting(false)
													input.value = ''
												}
											}}
										/>
									</label>
								</div>
								{blocked && (
									<div class='alert'>
										Sauvegarde protégée : l'enregistrement automatique est désactivé. Importez une
										sauvegarde valide ou réinitialisez cet emplacement après avoir exporté les
										données originales.
									</div>
								)}
							</section>
							<section class='panel settings-section'>
								<h3>Règles & contenu</h3>
								<p>
									D&D 5e, version 2014. Épuisement de 0 à 6. Les conditions et leur durée restent sous
									votre contrôle.
								</p>
								<p>
									Les références aux sources et les informations restant à vérifier sont indiquées
									dans la campagne. Les fiches des joueurs sont à ajouter par le MJ.
								</p>
							</section>
							<section class='panel settings-section danger-zone'>
								<h3>Réinitialiser cet emplacement</h3>
								<p>
									Efface la progression, les PJ ajoutés, les modifications de statistiques, les textes
									et notes du MJ, l’inventaire, le journal et le combat de cet emplacement uniquement.
								</p>
								<button
									type='button'
									class='danger'
									onClick={() => {
										if (
											confirm(
												`Effacer l’emplacement ${slot} et ses ajouts ? Exportez sa sauvegarde avant de continuer. Les autres emplacements sont conservés.`,
											)
										) {
											setBlocked(false)
											setError('')
											setState(game.createInitialState(staticCampaign!))
										}
									}}
								>
									Réinitialiser la sauvegarde
								</button>
							</section>
						</>
					)}
				</main>
				<footer class='app-footer'>
					<span>LE GRIMOIRE</span>
					<span>Données locales · Règles 2014</span>
				</footer>
			</div>
			{context && (
				<aside class='context-panel' inert={loading || importing}>
					<div class='context-heading'>
						<span class='eyebrow'>AUTOUR DE LA TABLE</span>
						<button
							type='button'
							class='icon-button'
							aria-label='Masquer le panneau de contexte'
							onClick={() => setContext(false)}
						>
							<Icon name='close' size={17} />
						</button>
					</div>
					<div class='party-heading'>
						<h2>Votre groupe</h2>
						<span class='tag'>{campaign.players.length} PJ</span>
					</div>
					{!campaign.players.length && <p class='context-description'>Aucun personnage joueur enregistré.</p>}
					<div class='party-list'>
						{campaign.players.map((p, i) => (
							<button type='button' class='party-member' onClick={() => setView('players')}>
								<span class={`portrait tone-${i % 4}`}>{p.name.slice(0, 2)}</span>
								<span class='party-member-info'>
									<strong>{p.name}</strong>
									<small>
										{[p.class, p.level != null && `Niv. ${p.level}`].filter(Boolean).join(' · ') ||
											'Personnage joueur'}
									</small>
									<meter
										min='0'
										max={p.combat.maxHp}
										value={state.players[p.id].hp}
										aria-label={`PV de ${p.name}`}
									/>
								</span>
								<span class='party-hp'>
									{state.players[p.id].hp}
									<small>/{p.combat.maxHp}</small>
								</span>
							</button>
						))}
					</div>
					<button type='button' class='context-link' onClick={() => setView('players')}>
						Voir les fiches du groupe <Icon name='arrow' size={15} />
					</button>
					{state.inventory.length > 0 ? (
						<section class='context-section'>
							<span class='eyebrow'>RÉCOMPENSES DU GROUPE</span>
							{state.inventory.map((id) => {
								const item = campaign.items.find((item) => item.id === id)
								return (
									<div class='reward-item' key={id}>
										<strong>{item?.name || id}</strong>
										<p>{item?.description}</p>
									</div>
								)
							})}
						</section>
					) : (
						<p class='context-empty'>Aucune récompense dans l’inventaire du groupe.</p>
					)}
					<section class='context-section'>
						<span class='eyebrow'>VOUS ÊTES ICI</span>
						<div class='location-card'>
							<Icon name='campaign' size={25} />
							<small>{chapter?.title}</small>
							<h3>{scene?.title}</h3>
							<button type='button' class='text-button' onClick={() => setView('campaign')}>
								Revenir à la scène <Icon name='arrow' size={14} />
							</button>
						</div>
					</section>
					<section class='context-section'>
						<span class='eyebrow'>OBJECTIFS EN COURS</span>
						{Object.keys(state.quests).length ? (
							Object.entries(state.quests).map(([key, value]) => (
								<p class='quest-line'>
									<span class='quest-box' />
									<span>
										{key.replaceAll('_', ' ')}
										<small>{value}</small>
									</span>
								</p>
							))
						) : (
							<p class='muted context-empty'>Aucun objectif enregistré.</p>
						)}
					</section>
					<section class='context-section'>
						<div class='block-heading'>
							<span class='eyebrow'>PENSE-BÊTE DU MJ</span>
							<Icon name='journal' size={16} />
						</div>
						<label class='sr-only' for='dm-notes'>
							Notes privées du MJ
						</label>
						<textarea
							id='dm-notes'
							class='sticky-note'
							value={state.notes}
							onInput={(e) => {
								const notes = e.currentTarget.value
								update((s) => ({ ...s, notes }))
							}}
							placeholder='Aucune note personnelle. Ajoutez un pense-bête…'
						/>
						<small class='note-caption'>Note privée. Vérifiez l’état de sauvegarde en haut de page.</small>
					</section>
				</aside>
			)}
		</div>
	)
}
