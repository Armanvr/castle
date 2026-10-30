import type { Ability, Campaign, Choice, Source } from '../types.ts'
import { bonus, childField, fieldLabel, fieldValue, isTechnicalKey } from './labels.ts'
import { stormwreckData } from './stormwreckData.ts'

type Row = Record<string, unknown>
const row = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {})
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.map(row) : [])
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const number = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
// Sentences from the source end with a period: drop it before the ' ; ' separator, keep the last one.
const joinParts = (parts: string[]): string =>
	parts.map((p, i) => (i < parts.length - 1 ? p.replace(/(?<!\.)\.$/, '') : p)).join(' ; ')
const describe = (v: unknown, key?: string): string =>
	v == null
		? ''
		: Array.isArray(v)
			? joinParts(v.map((x) => describe(x, key)).filter(Boolean))
			: typeof v === 'object'
				? joinParts(
						Object.entries(v)
							.filter(([k, value]) => value != null && !isTechnicalKey(k))
							.map(([k, value]) => `${fieldLabel(k)} : ${describe(value, childField(k, key))}`),
					)
				: fieldValue(key, v)
// Strings from the source keep their own sign.
const signed = (v: unknown): string => (typeof v === 'number' ? bonus(v) : String(v))
const source = (pages: unknown, files: unknown = []): Source => {
	const pageNumbers = Array.isArray(pages) ? pages.filter((x): x is number => typeof x === 'number') : []
	return {
		type: 'official_summary',
		pages: pageNumbers,
		files: rows(files)
			.map((f) => ({
				file: text(f.file),
				pages: (Array.isArray(f.printedPages)
					? f.printedPages
					: typeof f.printedPage === 'number'
						? [f.printedPage]
						: []
				).filter((p): p is number => typeof p === 'number' && (!pageNumbers.length || pageNumbers.includes(p))),
			}))
			.filter((f) => f.pages.length > 0),
	}
}
const blockSource = (value: unknown): Source => {
	const s = row(value)
	return source(typeof s.printedPage === 'number' ? [s.printedPage] : s.printedPages, [s])
}
const index = <T extends { id: string }>(list: T[]): Record<string, T> => Object.fromEntries(list.map((x) => [x.id, x]))

export function normalizeStormwreck(data: unknown = stormwreckData): Campaign {
	const raw = row(data),
		manifest = row(raw.manifest),
		warnings: string[] = []
	const sourceFiles = Object.values(row(manifest.sourceIndex)).flatMap(rows)
	const sceneTitles = new Map(
		rows(raw.chapters)
			.flatMap((ch) => rows(ch.scenes))
			.map((s) => [text(s.id), text(s.title)]),
	)
	const chapters = rows(raw.chapters).map((ch) => ({
		id: text(ch.id),
		title: text(ch.title),
		description: 'Résumé structuré du livret fourni.',
		scenes: rows(ch.scenes).map((s) => ({
			id: text(s.id),
			chapterId: text(ch.id),
			title: text(s.title),
			locationId: text(s.locationId),
			recommendedLevel: number(s.recommendedLevel),
			source: source(
				s.sourcePages,
				rows(ch.sourceFiles).filter(
					(f) =>
						Array.isArray(f.printedPages) &&
						(f.printedPages as unknown[]).some(
							(p) => Array.isArray(s.sourcePages) && s.sourcePages.includes(p),
						),
				),
			),
			readAloud: typeof s.readAloud === 'string' ? s.readAloud : null,
			summary: text(s.summary),
			dmNotes: strings(s.dmNotes),
			characters: strings(s.characters),
			encounterIds: strings(s.encounterIds),
			dialogues: rows(s.dialogues).map((d) => ({
				id: text(d.id),
				speakerId: text(d.speakerId),
				text: text(d.text),
				choices: rows(d.choices).map((c) => ({
					id: text(c.id),
					label: text(c.label),
					nextDialogueId: text(c.nextDialogueId),
				})),
			})),
			checks: rows(s.checks).map((c) => ({
				ability: text(c.ability) || text(c.skill),
				dc: number(c.dc),
				description: text(c.description) || [c.onSuccess, c.onFailure].filter(Boolean).join(' / '),
				onSuccess: typeof c.onSuccess === 'string' ? c.onSuccess : null,
				onFailure: typeof c.onFailure === 'string' ? c.onFailure : null,
				sourceStatus: text(c.sourceStatus),
			})),
			choices: rows(s.choices).map((c) => {
				const conditions = rows(c.conditions),
					effects = rows(c.effects)
				const knownConditions = conditions.filter(
					(v) =>
						v.type === 'flag' &&
						typeof v.key === 'string' &&
						['equals', 'not_equals'].includes(text(v.operator)) &&
						['string', 'number', 'boolean'].includes(typeof v.value),
				)
				const knownEffects = effects.filter(
					(v) =>
						v.type === 'set_flag' &&
						typeof v.key === 'string' &&
						['string', 'number', 'boolean'].includes(typeof v.value),
				)
				const manual =
					knownConditions.length !== conditions.length ||
					knownEffects.length !== effects.length ||
					(!c.nextSceneId && !effects.length)
				return {
					id: text(c.id),
					label: text(c.label),
					conditions: manual ? [] : knownConditions,
					effects: manual ? [] : knownEffects,
					nextSceneId: manual ? undefined : typeof c.nextSceneId === 'string' ? c.nextSceneId : undefined,
					manual,
					origin: text(c.origin),
					...(manual ? { manualDetails: describe(c) } : {}),
				} as Choice
			}),
			transitions: (Array.isArray(s.transitions) ? s.transitions : []).map((t) =>
				typeof t === 'string'
					? { sceneId: t, label: sceneTitles.get(t) || 'Scène suivante' }
					: { sceneId: text(row(t).sceneId), label: text(row(t).label) },
			),
		})),
	}))
	const monsters = rows(raw.monsters).map((m) => {
		const s = row(m.statBlock),
			a = row(s.abilities),
			skills = row(s.skills),
			damage = row(s.damageTraits)
		const abilityKeys: [Ability, string][] = [
			['strength', 'STR'],
			['dexterity', 'DEX'],
			['constitution', 'CON'],
			['intelligence', 'INT'],
			['wisdom', 'WIS'],
			['charisma', 'CHA'],
		]
		const actions = rows(s.actions).map((a) => describe(a))
		return {
			id: text(m.id),
			name: text(s.name) || text(m.id),
			type: text(s.type),
			size: text(s.size) || (text(s.type).match(/de taille (TP|TG|P|M|G)\b/)?.[1] ?? ''),
			armorClass: number(s.armorClass),
			maxHp: number(s.hitPoints),
			initiativeBonus: number(a.DEX) === null ? null : Math.floor((Number(a.DEX) - 10) / 2),
			speed: describe(s.speedMeters),
			abilities: s.abilities
				? (Object.fromEntries(abilityKeys.map(([key, short]) => [key, number(a[short])])) as Record<
						Ability,
						number | null
					>)
				: null,
			savingThrows: Object.entries(skills)
				.filter(([k]) => k.startsWith('save'))
				.map(([k, v]) => `${fieldLabel(k)} ${signed(v)}`),
			skills: Object.entries(skills)
				.filter(([k]) => !k.startsWith('save'))
				.map(([k, v]) => `${fieldLabel(k)} ${signed(v)}`),
			resistances: strings(damage.resistances),
			immunities: [...strings(damage.immunities), ...strings(s.conditionImmunities).map((c) => `État : ${c}`)],
			vulnerabilities: strings(damage.vulnerabilities),
			senses: describe(s.senses),
			languages: text(s.languages),
			challenge: s.challengeRating == null ? '' : String(s.challengeRating),
			actions,
			attacks: rows(s.actions)
				.filter((a) => a.attackBonus != null)
				.map((a) => describe(a)),
			features: strings(s.traits),
			source: blockSource(s.source || m.source),
			requiresVerification: s.requiresVerification === true,
			notes: strings(s.notes),
			details: s,
		}
	})
	const npcs = rows(raw.npcs).map((n) => ({
		id: text(n.id),
		name: text(n.name),
		description: text(n.description),
		source: source(n.sourcePages, manifest.sourceIndex ? row(manifest.sourceIndex)[text(n.sourceChapter)] : []),
		statBlockId: typeof n.statBlockId === 'string' ? n.statBlockId : null,
		statBlockStatus: text(n.statBlockStatus),
		dialogues: Array.isArray(n.dialogues) ? n.dialogues : [],
		details: n,
	}))
	const locations = rows(raw.locations).map((l) => ({
		id: text(l.id),
		name: text(l.name),
		description: strings(l.descriptions).join('\n'),
		source: source(l.sourcePages, sourceFiles),
		details: l,
	}))
	const encounters = rows(raw.encounters).map((e) => ({
		id: text(e.id),
		name: text(e.title),
		description: strings(e.notes).join('\n'),
		notes: strings(e.notes),
		sceneId: text(e.sceneId),
		source: source(e.sourcePages, sourceFiles),
		participants: rows(e.combatants).map((p) => ({
			monsterId: text(p.statBlockId) || text(p.monsterId),
			count: number(p.quantity),
			quantityStatus: text(p.quantityStatus),
			statsStatus: text(p.statsStatus),
		})),
	}))
	const items = rows(row(raw.items).items).map((i) => ({
		id: text(i.id),
		name: text(i.name),
		description: text(i.description),
		category: text(i.type),
		rarity: text(i.rarity),
		mechanics: row(i.mechanics),
		source: blockSource(i.source),
		details: i,
	}))
	const indexes = {
		scenes: index(chapters.flatMap((c) => c.scenes)),
		monsters: index(monsters),
		npcs: index(npcs),
		locations: index(locations),
		encounters: index(encounters),
		items: index(items),
	}
	for (const [kind, entries] of Object.entries({
		scenes: chapters.flatMap((c) => c.scenes),
		monsters,
		npcs,
		locations,
		encounters,
		items,
	})) {
		const ids = new Set<string>()
		for (const entry of entries) {
			if (!entry.id || ids.has(entry.id)) warnings.push(`Identifiant absent ou dupliqué (${kind}) : ${entry.id}`)
			ids.add(entry.id)
		}
	}
	const check = (kind: keyof typeof indexes, id: string, from: string) => {
		if (!indexes[kind][id]) warnings.push(`Référence introuvable : ${from} → ${kind} : ${id}`)
	}
	for (const s of chapters.flatMap((c) => c.scenes)) {
		check('locations', s.locationId, s.id)
		for (const id of s.characters) check('npcs', id, s.id)
		for (const id of s.encounterIds) check('encounters', id, s.id)
		for (const t of s.transitions) check('scenes', t.sceneId, s.id)
		for (const c of s.choices) if (c.nextSceneId) check('scenes', c.nextSceneId, c.id)
	}
	for (const e of encounters) {
		if (e.sceneId) check('scenes', e.sceneId, e.id)
		for (const p of e.participants) check('monsters', p.monsterId, e.id)
	}
	for (const n of npcs) if (n.statBlockId) check('monsters', n.statBlockId, n.id)
	for (const m of monsters)
		if (m.requiresVerification) warnings.push(`Profil incomplet — vérification nécessaire : ${m.name}`)
	return {
		manifest: {
			id: text(manifest.id),
			title: text(manifest.title),
			subtitle: 'Campagne issue des documents fournis · données partielles',
			version: 1,
			rules: '2014',
			demo: false,
			chapters: strings(manifest.chapterFiles),
			players: '',
			monsters: text(manifest.monsterCatalogFile),
			encounters: text(manifest.encounterFile),
			locations: text(manifest.locationFile),
			items: text(manifest.itemFile),
			npcs: text(manifest.characterFile),
		},
		chapters,
		players: [],
		monsters,
		npcs,
		locations,
		encounters,
		items,
		indexes,
		warnings,
		limitations: [...strings(manifest.missing), ...strings(row(raw.report).limitations)],
		pendingRewards: strings(row(raw.items).pending),
		introduction: {
			...row(raw.introduction),
			source: source([], row(raw.introduction).sourceFiles),
		} as unknown as Campaign['introduction'],
	}
}
