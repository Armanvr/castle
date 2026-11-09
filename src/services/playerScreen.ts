import type { GameState } from '../types.ts'
import { getVitals, participantLabel, sortedParticipants } from './game.ts'

export const PLAYER_SCREEN_CHANNEL = 'grimoire-joueurs'
export interface Reveal {
	title: string
	text: string
}
export interface PublicCombatant {
	id: string
	name: string
	kind: 'player' | 'creature'
	active: boolean
	hp?: string
	status?: 'À terre' | 'Stable' | 'Mort' | 'Vaincu'
}
export interface PublicView {
	combat: null | { name: string; round: number; order: PublicCombatant[] }
	reveal: Reveal | null
}
export type ToDmMessage = { type: 'hello' }
export type ToScreenMessage = { type: 'view'; view: PublicView }

// Whitelist by construction: creature rows only carry name, turn and a defeated flag, never HP, AC or initiative.
export function publicView(state: GameState, reveal: Reveal | null): PublicView {
	const combat = state.combat
	if (!combat || combat.status === 'finished') return { combat: null, reveal: reveal && { ...reveal } }
	return {
		combat: {
			name: combat.name,
			round: combat.round,
			order: sortedParticipants(state).map((p): PublicCombatant => {
				const v = getVitals(state, p)
				const base = { id: p.id, active: p.id === combat.activeId }
				if (p.type === 'player')
					return {
						...base,
						name: p.name,
						kind: 'player',
						hp: `${v.hp}/${v.maxHp}`,
						...(v.status === 'unconscious' && { status: 'À terre' as const }),
						...(v.status === 'stable' && { status: 'Stable' as const }),
						...(v.status === 'dead' && { status: 'Mort' as const }),
					}
				const down = v.status === 'dead' || v.status === 'unconscious'
				return {
					...base,
					name: participantLabel(p, state),
					kind: 'creature',
					...(down && { status: 'Vaincu' as const }),
				}
			}),
		},
		reveal: reveal && { ...reveal },
	}
}
