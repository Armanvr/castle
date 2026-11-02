import { useEffect, useRef } from 'preact/hooks'
import * as game from '../services/game'
import type { Campaign, GameState, Update } from '../types'
import { SourceNote } from './Views'

export function EncounterPreparation({
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
