// French labels for raw data keys shown in the UI. Terminology: D&D 5e (2014), app abbreviations FOR/DEX/CON/INT/SAG/CHA, CA, PV, FP, DD.
const labels: Record<string, string> = {
	// identity & source
	name: 'Nom',
	title: 'Titre',
	type: 'Type',
	description: 'Description',
	label: 'Libellé',
	nextSceneId: 'Scène suivante',
	notes: 'Notes',
	source: 'Source',
	sourceFiles: 'Fichiers source',
	sourcePages: 'Pages source',
	sourceChapter: 'Chapitre source',
	file: 'Fichier',
	printedPage: 'Page imprimée',
	printedPages: 'Pages imprimées',
	section: 'Section',
	basis: 'Base de lecture',
	completeness: 'Complétude',
	requiresVerification: 'Vérification nécessaire',
	status: 'Statut',
	pending: 'En attente',
	statBlock: 'Profil',
	statBlockStatus: 'État du profil',
	// stat block
	alignment: 'Alignement',
	armorClass: 'CA',
	hitPoints: 'PV',
	hitDice: 'Dés de vie',
	speedMeters: 'Vitesse (m)',
	walk: 'Au sol',
	fly: 'Vol',
	swim: 'Nage',
	abilities: 'Caractéristiques',
	STR: 'FOR',
	DEX: 'DEX',
	CON: 'CON',
	INT: 'INT',
	WIS: 'SAG',
	CHA: 'CHA',
	challengeRating: 'FP',
	proficiencyBonus: 'Bonus de maîtrise',
	skills: 'Compétences',
	saveDEX: 'Sauvegarde DEX',
	saveCON: 'Sauvegarde CON',
	saveWIS: 'Sauvegarde SAG',
	saveCHA: 'Sauvegarde CHA',
	senses: 'Sens',
	darkvisionMeters: 'Vision dans le noir (m)',
	blindsightMeters: 'Vision aveugle (m)',
	passivePerception: 'Perception passive',
	languages: 'Langues',
	traits: 'Capacités',
	damageTraits: 'Particularités de dégâts',
	resistances: 'Résistances',
	immunities: 'Immunités',
	vulnerabilities: 'Vulnérabilités',
	conditionImmunities: 'Immunités aux états',
	actions: 'Actions',
	attackBonus: "Bonus d'attaque",
	damage: 'Dégâts',
	reachMeters: 'Allonge (m)',
	rangeMeters: 'Portée (m)',
	recharge: 'Recharge',
	saveDC: 'DD de sauvegarde',
	// introduction & NPCs
	premise: 'Prémisse',
	world: 'Monde',
	dmGuidance: 'Conseils au MJ',
	campaignLocations: 'Lieux de la campagne',
	dialogues: 'Dialogues',
	// item mechanics (the last four are literal readings of the key, to be confirmed by the MJ)
	mechanics: 'Mécanique',
	rarity: 'Rareté',
	damageBonus: 'Bonus de dégâts',
	healingDice: 'Dés de soin',
	durationHours: 'Durée (heures)',
	removes: 'Retire',
	damageResistanceType: 'Type de résistance aux dégâts',
	d10DamageTable: 'Table de dégâts (d10)',
	castingAbilityRule: "Règle de caractéristique d'incantation",
	saveDCBySpellLevel: 'DD de sauvegarde par niveau de sort',
	attackBonusBySpellLevel: "Bonus d'attaque par niveau de sort",
	spellConsumedOnCast: "Sort consommé à l'incantation",
	movementSilence: 'Déplacement silencieux',
	stealthAdvantageSound: 'Avantage en Discrétion (bruit)',
	0: 'Niveau 0',
	1: 'Niveau 1',
	2: 'Niveau 2',
}

export const fieldLabel = (key: string): string =>
	Object.hasOwn(labels, key)
		? labels[key]
		: key
				.replace(/([a-z])([A-Z])/g, '$1 $2')
				.replaceAll('_', ' ')
				.trim()

// useGrouping off: counts and page numbers stay as plain digits
const numberFormat = new Intl.NumberFormat('fr-FR', { useGrouping: false, maximumFractionDigits: 20 })
export const frNumber = (n: number): string => numberFormat.format(n)
// French plural: 0 and 1 are singular ("0 réussite", "1 échec").
export const frPlural = (n: number, one: string, many: string): string =>
	`${frNumber(n)} ${Math.abs(n) < 2 ? one : many}`
export const frScalar = (v: unknown): string =>
	typeof v === 'boolean' ? (v ? 'Oui' : 'Non') : typeof v === 'number' ? frNumber(v) : String(v)

// Status codes stored in the source JSON and shown as values; literal French readings of the code.
const values: Record<string, string> = {
	available: 'Disponible',
	dm_confirmed: 'Confirmé par le MJ',
	verified_visible: 'Vérifié sur la page visible',
	partial_scan: 'Scan partiel',
	partial_requires_verification: 'Partiel, vérification nécessaire',
	not_applicable_or_pending: 'Sans objet ou en attente',
	annex_pending: 'Annexe en attente',
	visual_scan_partial_right_page: 'Lecture visuelle du scan, page de droite partielle',
	filled_from_annex: 'Complété depuis l’annexe',
	partial_from_annex: 'Partiel, complété depuis l’annexe',
	template_not_active: 'Modèle non actif',
	source_or_visual_estimate: 'Source ou estimation visuelle',
	from_source: 'Issu de la source',
	non_transcrit: 'Non transcrit',
	annexes_integrated_partial_right_page_review: 'Annexes intégrées, relecture de la page de droite partielle',
	editorial_navigation: 'Navigation éditoriale',
	source_based_action: 'Action décrite dans la source',
}
export const valueLabel = (v: string): string => (Object.hasOwn(values, v) ? values[v] : v)

// Pure technical identifiers: never shown as data. Provenance keys (source, file, pages…) stay visible.
export const isTechnicalKey = (key: string): boolean => key === 'id' || key === 'statBlockId'

// ASCII sign, same "Sagesse +3" shape as player sheets.
export const bonus = (n: number): string => `${n >= 0 ? '+' : '-'}${frNumber(Math.abs(n))}`
const bonusKeys = new Set(['attackBonus', 'damageBonus', 'proficiencyBonus', 'attackBonusBySpellLevel'])
// Field a nested value belongs to: spell-level entries ("0", "1"…) inherit their parent's key.
export const childField = (key: string, parent?: string): string | undefined => (/^\d+$/.test(key) ? parent : key)
// Value of a data field: signed when the key is a bonus, otherwise French scalar / status code reading.
export const fieldValue = (key: string | undefined, v: unknown): string =>
	typeof v === 'number' && key !== undefined && bonusKeys.has(key) ? bonus(v) : valueLabel(frScalar(v))

const journalTypes: Record<string, string> = {
	note: 'Note',
	combat: 'Combat',
	narrative: 'Récit',
	choice: 'Choix',
	encounter: 'Rencontre',
	reward: 'Récompense',
}
export const journalTypeLabel = (type: string): string =>
	Object.hasOwn(journalTypes, type) ? journalTypes[type] : type
