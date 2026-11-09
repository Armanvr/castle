import { sessionPrep } from '../services/sessionPrep'
import type { Campaign, Chapter, GameState, Scene } from '../types'
import { Icon } from './icons'
import { CampaignInfo } from './Views'

export function Dashboard({
	campaign,
	state,
	scenes,
	scene,
	chapter,
	combatOpen,
	setView,
	openScene,
	openEncounter,
}: {
	campaign: Campaign
	state: GameState
	scenes: Scene[]
	scene: Scene | undefined
	chapter: Chapter | undefined
	combatOpen: boolean
	setView: (view: string) => void
	openScene: (id: string) => void
	openEncounter: (id: string) => void
}) {
	const prep = sessionPrep(state, campaign)
	const completed = Object.values(state.sceneStatus).filter((s) => s === 'completed').length
	const status = state.combat?.status
	const combatLabel = status === 'suspended' ? 'Combat suspendu' : 'Combat en cours'
	const combatTile = (
		<>
			<span class='stat-icon'>
				<Icon name='encounters' />
			</span>
			<span>
				<b>{combatOpen ? '1' : '0'}</b>
				<span class='stat-caption'>{combatLabel}</span>
			</span>
		</>
	)
	return (
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
					<button
						type='button'
						class='primary'
						onClick={() => setView(combatOpen ? 'encounters' : 'campaign')}
					>
						{combatOpen ? 'Reprendre le combat' : "Reprendre l'aventure"} <Icon name='arrow' size={18} />
					</button>
				</div>
				<div class='hero-bottom'>
					<span>
						<i class='status-dot' />{' '}
						{completed || Object.keys(state.sceneStatus).length ? 'En cours' : 'À commencer'} ·{' '}
						{chapter?.title || 'Votre aventure'}
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
				{combatOpen ? (
					<button
						type='button'
						aria-label={`${combatLabel} : ouvrir les rencontres`}
						onClick={() => setView('encounters')}
					>
						{combatTile}
					</button>
				) : (
					<div>{combatTile}</div>
				)}
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
							<button type='button' class='text-button' onClick={() => setView('campaign')}>
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
								<button type='button' class='text-button' onClick={() => setView('journal')}>
									Écrire la première note <Icon name='plus' size={16} />
								</button>
							</div>
						)}
					</div>
				</section>
			</div>
			<section class='panel session-prep' aria-labelledby='session-prep-title'>
				<h2 id='session-prep-title'>Préparer la session</h2>
				{prep.scene ? (
					<>
						<h3>Scène active</h3>
						<button type='button' class='text-button' onClick={() => setView('campaign')}>
							{prep.scene.title} <Icon name='arrow' size={15} />
						</button>
						<h3>Scènes suivantes</h3>
						{prep.nextScenes.length ? (
							<ul>
								{prep.nextScenes.map((s) => (
									<li key={s.id}>
										<button type='button' class='text-button' onClick={() => openScene(s.id)}>
											{s.title} <Icon name='arrow' size={15} />
										</button>
									</li>
								))}
							</ul>
						) : (
							<p>Aucune scène suivante liée à la scène active.</p>
						)}
						<h3>Rencontres</h3>
						{prep.encounters.length ? (
							<ul>
								{prep.encounters.map(({ encounter, needsPrep }) => (
									<li key={encounter.id}>
										<button
											type='button'
											class='text-button'
											onClick={() => openEncounter(encounter.id)}
										>
											{encounter.name} <Icon name='arrow' size={15} />
										</button>
										{needsPrep && <span class='tag'>À préparer</span>}
									</li>
								))}
							</ul>
						) : (
							<p>Aucune rencontre dans la scène active ni dans les suivantes.</p>
						)}
						{prep.warnings.length > 0 && (
							<>
								<h3>Avertissements</h3>
								<ul>
									{prep.warnings.map((w) => (
										<li key={w}>{w}</li>
									))}
								</ul>
							</>
						)}
					</>
				) : (
					<p>Aucune scène active : choisissez une scène dans les chapitres pour préparer la suite.</p>
				)}
			</section>
			<CampaignInfo campaign={campaign} />
		</>
	)
}
