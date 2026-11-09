import { useEffect, useState } from 'preact/hooks'
import {
	PLAYER_SCREEN_CHANNEL,
	type PublicView,
	type ToDmMessage,
	type ToScreenMessage,
} from '../services/playerScreen'

export function PlayerScreen() {
	const [view, setView] = useState<PublicView | null>(null)
	useEffect(() => {
		const ch = new BroadcastChannel(PLAYER_SCREEN_CHANNEL)
		ch.onmessage = (e: MessageEvent<ToScreenMessage>) => {
			if (e.data?.type === 'view') setView(e.data.view)
		}
		const hello: ToDmMessage = { type: 'hello' }
		ch.postMessage(hello)
		return () => ch.close()
	}, [])
	const combat = view?.combat
	useEffect(() => {
		document.title = combat ? `${combat.name} · Écran des joueurs` : 'Écran des joueurs · Le Grimoire'
	}, [combat?.name])
	const active = combat?.order.find((c) => c.active)
	return (
		<main class='player-screen'>
			<button
				type='button'
				class='player-fullscreen'
				onClick={() => document.documentElement.requestFullscreen?.()}
			>
				Plein écran
			</button>
			<p class='sr-only' role='status' aria-live='polite'>
				{combat && active ? `Round ${combat.round}, tour de ${active.name}.` : ''}
			</p>
			{!view || (!combat && !view.reveal) ? (
				<p class='player-waiting'>{view ? 'Rien à montrer pour le moment.' : 'En attente du MJ…'}</p>
			) : null}
			{combat && (
				<section class='player-combat'>
					<span class='eyebrow player-round'>ROUND {combat.round}</span>
					<h1>{combat.name}</h1>
					<ol class='player-order'>
						{combat.order.map((c) => (
							<li
								key={c.id}
								class={c.active ? 'active' : ''}
								aria-current={c.active ? 'true' : undefined}
							>
								{c.active && <span class='player-turn'>En cours</span>}
								<span class='player-name'>{c.name}</span>
								{c.hp && <span class='player-hp'>{c.hp} PV</span>}
								{c.status && <strong class='player-status'>{c.status}</strong>}
							</li>
						))}
					</ol>
				</section>
			)}
			{view?.reveal && (
				<section class='player-reveal panel'>
					<h2>{view.reveal.title}</h2>
					<p class='player-text'>{view.reveal.text}</p>
				</section>
			)}
		</main>
	)
}
