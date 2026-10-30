import type { TargetedKeyboardEvent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { frPlural } from '../services/labels'
import { type SearchKind, type SearchResult, searchCampaign } from '../services/search'
import type { Campaign } from '../types'

const KIND_LABEL: Record<SearchKind, string> = {
	scene: 'Scène',
	npc: 'PNJ',
	monster: 'Monstre',
	item: 'Objet',
	player: 'PJ',
}
export function SearchDialog({
	campaign,
	open,
	onClose,
	onPick,
}: {
	campaign: Campaign
	open: boolean
	onClose: () => void
	onPick: (result: SearchResult) => void
}) {
	const dialog = useRef<HTMLDialogElement>(null)
	const [query, setQuery] = useState('')
	const results = searchCampaign(campaign, query)
	useEffect(() => {
		const el = dialog.current
		if (!el) return
		if (open && !el.open) {
			setQuery('')
			el.showModal()
		} else if (!open && el.open) el.close()
	}, [open])
	const pick = (r?: SearchResult) => {
		if (!r) return
		onClose()
		onPick(r)
	}
	// ↑/↓ move real focus between the input and the result buttons; Enter on a button activates it natively
	const move = (e: TargetedKeyboardEvent<HTMLDialogElement>) => {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
		e.preventDefault()
		const items = [...e.currentTarget.querySelectorAll<HTMLElement>('input, li button')]
		const at = items.indexOf(document.activeElement as HTMLElement)
		items[Math.min(Math.max(at + (e.key === 'ArrowDown' ? 1 : -1), 0), items.length - 1)]?.focus()
	}
	return (
		<dialog
			ref={dialog}
			class='search-dialog'
			aria-label='Recherche dans la campagne'
			onClose={onClose}
			onKeyDown={move}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault()
					pick(results[0])
				}}
			>
				<label>
					Rechercher
					<input
						type='text'
						autocomplete='off'
						placeholder='Scène, PNJ, monstre, objet…'
						value={query}
						onInput={(e) => setQuery(e.currentTarget.value)}
					/>
				</label>
			</form>
			<ul aria-label='Résultats'>
				{results.map((r) => (
					<li key={r.kind + r.id}>
						<button type='button' onClick={() => pick(r)}>
							<span class='tag'>{KIND_LABEL[r.kind]}</span>
							<strong>{r.title}</strong>
							{r.detail && <small>{r.detail}</small>}
						</button>
					</li>
				))}
			</ul>
			<p class='search-status' role='status'>
				{query.trim()
					? results.length
						? frPlural(results.length, 'résultat', 'résultats')
						: 'Aucun résultat'
					: 'Tapez pour chercher. ↓ pour parcourir les résultats, Entrée pour ouvrir, Échap pour fermer.'}
			</p>
		</dialog>
	)
}
