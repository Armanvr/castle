import { useEffect, useRef } from 'preact/hooks'
import type { Campaign, GameState } from '../types'

// Hit dice stay with the DM: they type the HP regained per living PJ. The domain clamps to max HP.
export function ShortRestDialog({
	campaign,
	state,
	open,
	onClose,
	onConfirm,
}: {
	campaign: Campaign
	state: GameState
	open: boolean
	onClose: () => void
	onConfirm: (healing: Record<string, number>) => void
}) {
	const dialog = useRef<HTMLDialogElement>(null)
	const living = campaign.players.filter((p) => state.players[p.id]?.status !== 'dead')
	useEffect(() => {
		const el = dialog.current
		if (!el) return
		if (open && !el.open) {
			el.querySelector('form')?.reset()
			el.showModal()
		} else if (!open && el.open) el.close()
	}, [open])
	return (
		<dialog ref={dialog} class='rest-dialog' aria-labelledby='short-rest-title' onClose={onClose}>
			<form
				onSubmit={(e) => {
					e.preventDefault()
					const data = new FormData(e.currentTarget)
					onConfirm(Object.fromEntries(living.map((p) => [p.id, Number(data.get(p.id))])))
					onClose()
				}}
			>
				<h3 id='short-rest-title'>Repos court du groupe</h3>
				<p>
					Saisissez les PV récupérés par chaque PJ (dés de vie compris). Le maximum de PV n’est pas dépassé.
				</p>
				{living.length ? (
					living.map((p) => (
						<label key={p.id}>
							{p.name} · PV récupérés
							<input type='number' name={p.id} defaultValue={0} min={0} step={1} required />
							<small>
								{state.players[p.id].hp} / {p.combat.maxHp} PV
							</small>
						</label>
					))
				) : (
					<p>Aucun PJ vivant.</p>
				)}
				<div class='button-row'>
					<button class='primary' type='submit'>
						Valider le repos court
					</button>
					<button type='button' onClick={onClose}>
						Annuler
					</button>
				</div>
			</form>
		</dialog>
	)
}
