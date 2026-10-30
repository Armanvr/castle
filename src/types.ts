export type Flag = string | number | boolean
export type Ability = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
export interface Source {
	type: 'fictional_demo' | 'official_summary' | 'custom'
	pages: number[]
	files?: { file: string; pages: number[] }[]
}
export interface Character {
	id: string
	name: string
	race: string | null
	class: string | null
	level: number | null
	abilities: Record<Ability, number | null> | null
	combat: { maxHp: number; armorClass: number; speed: number | null; initiativeBonus: number }
	skills: string[]
	savingThrows: string[]
	attacks: string[]
	features: string[]
	spells: string[]
	inventory: string[]
	resources: { id: string; name: string; max: number }[]
	source: Source
}
export interface Monster {
	id: string
	name: string
	type: string
	size: string
	armorClass: number | null
	maxHp: number | null
	initiativeBonus: number | null
	speed: string
	abilities: Record<Ability, number | null> | null
	savingThrows: string[]
	skills: string[]
	resistances: string[]
	immunities: string[]
	vulnerabilities: string[]
	senses: string
	languages: string
	challenge: string
	actions: string[]
	attacks: string[]
	features: string[]
	requiresVerification?: boolean
	notes?: string[]
	details?: Record<string, unknown>
	source: Source
}
export type Condition =
	| { type: 'flag'; key: string; operator: 'equals' | 'not_equals'; value: Flag }
	| { type: 'scene'; sceneId: string; status: 'visited' | 'completed' | 'ignored' }
	| { type: 'quest'; key: string; value: string }
export type Effect =
	| { type: 'set_flag'; key: string; value: Flag }
	| { type: 'unlock_scene'; sceneId: string }
	| { type: 'set_quest'; key: string; value: string }
	| { type: 'add_item'; itemId: string }
	| { type: 'relationship'; npcId: string; value: number }
	| { type: 'journal'; title: string; description: string }
	| { type: 'start_encounter'; encounterId: string }
export interface Choice {
	id: string
	label: string
	conditions: Condition[]
	effects: Effect[]
	important?: boolean
	nextSceneId?: string
	manual?: boolean
	origin?: string
	manualDetails?: string
}
export interface Scene {
	id: string
	chapterId: string
	title: string
	locationId: string
	recommendedLevel: number | null
	source: Source
	readAloud: string | null
	summary?: string
	dmNotes: string[]
	characters: string[]
	dialogues: {
		id: string
		speakerId: string
		text: string
		choices: { id: string; label: string; nextDialogueId: string }[]
	}[]
	checks: {
		ability: string
		dc: number | null
		description: string
		onSuccess?: string | null
		onFailure?: string | null
		sourceStatus?: string
		successChoiceId?: string
		failureChoiceId?: string
	}[]
	choices: Choice[]
	encounterIds: string[]
	transitions: { sceneId: string; label: string }[]
}
export interface Chapter {
	id: string
	title: string
	description: string
	scenes: Scene[]
}
export interface Encounter {
	sceneId?: string
	notes?: string[]
	source?: Source
	id: string
	name: string
	description: string
	participants: {
		monsterId: string
		count: number | null
		quantityStatus?: string
		statsStatus?: string
		type?: 'monster' | 'ally' | 'hostile'
	}[]
}
export interface Manifest {
	id: string
	title: string
	subtitle: string
	version: number
	rules: '2014'
	demo: boolean
	chapters: string[]
	players: string
	monsters: string
	encounters: string
	locations: string
	items: string
	npcs: string
}
export interface ReferenceEntry {
	id: string
	name: string
	description: string
	source?: Source
	details?: Record<string, unknown>
}
export interface Npc extends ReferenceEntry {
	statBlockId?: string | null
	statBlockStatus?: string
	dialogues?: unknown[]
}
export interface Item extends ReferenceEntry {
	category?: string
	rarity?: string
	mechanics?: Record<string, unknown>
}
export interface Campaign {
	manifest: Manifest
	chapters: Chapter[]
	players: Character[]
	monsters: Monster[]
	encounters: Encounter[]
	locations: ReferenceEntry[]
	items: Item[]
	npcs: Npc[]
	warnings?: string[]
	limitations?: string[]
	pendingRewards?: string[]
	introduction?: {
		source?: Source
		title: string
		premise: string
		world: string
		dmGuidance: string[]
		notes: string[]
	}
	indexes?: {
		scenes: Record<string, Scene>
		monsters: Record<string, Monster>
		encounters: Record<string, Encounter>
		npcs: Record<string, Npc>
		items: Record<string, Item>
		locations: Record<string, ReferenceEntry>
	}
}
export type ParticipantStatus = 'active' | 'unconscious' | 'dead' | 'removed' | 'stable'
export interface Vitals {
	maxHp: number
	hp: number
	tempHp: number
	// duration: legacy free text; rounds: remaining turns (0 = expired, the DM removes it)
	conditions: { name: string; duration?: string; rounds?: number }[]
	exhaustion: number
	status: ParticipantStatus
	removedStatus?: Exclude<ParticipantStatus, 'removed'>
	deathSaves: { successes: number; failures: number }
	resources: Record<string, number>
}
export interface Combatant {
	id: string
	name: string
	type: 'player' | 'monster' | 'ally' | 'hostile'
	playerId?: string
	monsterId?: string
	manualNotes?: string
	initiative: number
	initiativeBonus: number
	maxHp: number
	armorClass: number
	vitals?: Vitals
}
export interface Combat {
	id: string
	encounterId?: string
	name: string
	status: 'active' | 'suspended' | 'finished'
	round: number
	activeId: string | null
	participants: Combatant[]
}
export interface JournalEntry {
	id: string
	date: string
	type: string
	title: string
	description: string
	chapterId?: string
	sceneId?: string
	participants?: string[]
}
export interface GameState {
	version: 1
	campaignId: string
	activeSceneId: string
	sceneStatus: Record<string, 'visited' | 'completed' | 'ignored'>
	flags: Record<string, Flag>
	quests: Record<string, string>
	inventory: string[]
	relationships: Record<string, number>
	unlockedScenes: string[]
	appliedChoices: string[]
	players: Record<string, Vitals>
	combat: Combat | null
	journal: JournalEntry[]
	notes: string
	customPlayers?: Character[]
	playerStats?: Record<string, Pick<Character['combat'], 'maxHp' | 'armorClass' | 'initiativeBonus'>>
	sceneAdditions?: Record<string, Partial<Record<'readAloud' | 'summary' | 'dmNotes' | 'dialogues', string>>>
	itemAssignments?: Record<string, string>
	undo: { choiceId: string; before: Omit<GameState, 'undo'>; after: Omit<GameState, 'undo'> } | null
}
