import { useEffect, useRef, useState } from 'preact/hooks'
import {
	PLAYER_SCREEN_CHANNEL,
	publicView,
	type Reveal,
	type ToDmMessage,
	type ToScreenMessage,
} from '../services/playerScreen'
import type { GameState } from '../types'

// DM side of the players' screen: owns the unsaved reveal and pushes the public view on every change and on "hello".
export function usePlayerScreen(state: GameState | null, announce: (text: string) => void) {
	const [reveal, setReveal] = useState<Reveal | null>(null)
	const channel = useRef<BroadcastChannel | null>(null)
	const send = useRef<() => void>(() => {})
	send.current = () => {
		if (state) {
			const message: ToScreenMessage = { type: 'view', view: publicView(state, reveal) }
			channel.current?.postMessage(message)
		}
	}
	useEffect(() => {
		const ch = new BroadcastChannel(PLAYER_SCREEN_CHANNEL)
		channel.current = ch
		ch.onmessage = (e: MessageEvent<ToDmMessage>) => {
			if (e.data?.type === 'hello') send.current()
		}
		return () => {
			ch.close()
			channel.current = null
		}
	}, [])
	useEffect(() => send.current(), [state, reveal])
	return {
		revealed: reveal !== null,
		open: () => window.open('?ecran=joueurs', PLAYER_SCREEN_CHANNEL),
		show: (r: Reveal) => {
			setReveal(r)
			announce(`« ${r.title} » affiché sur l’écran des joueurs.`)
		},
		clear: () => {
			setReveal(null)
			announce('Écran des joueurs effacé.')
		},
	}
}
