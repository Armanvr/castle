import { expect, type Page, test } from '@playwright/test'
import { dmNotes, goToView } from './helpers'

type Fake = { __writes: string[]; __started: number }

// Replaces the native picker (Chromium only): a fake handle whose writes land in window.__writes.
async function stubPicker(page: Page, mode: 'ok' | 'fail' | 'absent' | 'slow') {
	await page.addInitScript((m) => {
		const w = window as unknown as Fake & Record<string, unknown>
		w.__writes = []
		w.__started = 0
		if (m === 'absent') {
			delete w.showSaveFilePicker
			// biome-ignore lint/suspicious/noExplicitAny: Window.prototype has no typed picker
			delete (Window.prototype as any).showSaveFilePicker
			return
		}
		w.showSaveFilePicker = async () => ({
			name: 'ma-sauvegarde.json',
			createWritable: async () => {
				let buffer = ''
				return {
					write: async (data: string) => {
						w.__started++
						if (m === 'fail') throw new Error('disque plein')
						if (m === 'slow') await new Promise((r) => setTimeout(r, 1500))
						buffer += data
					},
					close: async () => {
						w.__writes.push(buffer)
					},
				}
			},
		})
	}, mode)
}

const writes = (page: Page) => page.evaluate(() => (window as unknown as Fake).__writes)
const linkButton = (page: Page) => page.getByRole('button', { name: 'Lier un fichier de sauvegarde' })
const section = (page: Page) => page.getByRole('heading', { name: 'Fichier de sauvegarde automatique' })

test('sans showSaveFilePicker, la section est absente', async ({ page }) => {
	await stubPicker(page, 'absent')
	await page.goto('/')
	expect(await page.evaluate(() => 'showSaveFilePicker' in window)).toBe(false)
	await goToView(page, 'Paramètres')
	await expect(page.getByRole('heading', { name: 'Points de restauration' })).toBeVisible()
	await expect(section(page)).toHaveCount(0)
	await expect(linkButton(page)).toHaveCount(0)
})

test('lier un fichier : JSON valide écrit après changement, date affichée, puis « Délier »', async ({ page }) => {
	await stubPicker(page, 'ok')
	await page.goto('/')
	await goToView(page, 'Paramètres')
	await linkButton(page).click()
	await expect(page.getByText('Fichier lié :')).toContainText('ma-sauvegarde.json')
	await expect(page.getByText(/Dernière écriture :/)).toContainText('en attente')

	await dmNotes(page).fill('note écrite dans le fichier')
	// debounced (~1.5 s): the burst of changes ends in one or more writes, the last one is current
	await expect
		.poll(async () => (await writes(page)).at(-1) ?? '', { timeout: 10_000 })
		.toContain('note écrite dans le fichier')
	const last = JSON.parse((await writes(page)).at(-1)!)
	expect(last.version).toBe(1)
	expect(last.notes).toBe('note écrite dans le fichier')

	await expect(page.getByText(/Dernière écriture :/)).not.toContainText('en attente')
	await expect(page.getByText(/Dernière écriture :/)).toContainText(/\d{2}\/\d{2}\/\d{4}/)
	// a written file counts as an export
	await expect(page.getByText('Dernier export :')).not.toContainText('jamais')

	await page.getByRole('button', { name: 'Délier' }).click()
	await expect(linkButton(page)).toBeVisible()
	await expect(page.getByText('Fichier lié :')).toHaveCount(0)
	const count = (await writes(page)).length
	await dmNotes(page).fill('après déliement')
	await page.waitForTimeout(2500)
	expect(await writes(page)).toHaveLength(count)
})

test('une écriture qui échoue affiche une alerte et délie le fichier', async ({ page }) => {
	await stubPicker(page, 'fail')
	await page.goto('/')
	await goToView(page, 'Paramètres')
	await linkButton(page).click()
	const alert = page.getByRole('alert').filter({ hasText: 'Écriture dans le fichier de sauvegarde impossible' })
	await expect(alert).toContainText('disque plein', { timeout: 10_000 })
	await expect(alert).toContainText('délié')
	await expect(linkButton(page)).toBeVisible()
	await expect(page.getByText('Fichier lié :')).toHaveCount(0)
})

test('« Délier » pendant une écriture en cours : le fichier reste délié une fois l’écriture terminée', async ({
	page,
}) => {
	await stubPicker(page, 'slow')
	await page.goto('/')
	await goToView(page, 'Paramètres')
	await linkButton(page).click()
	await expect.poll(() => page.evaluate(() => (window as unknown as Fake).__started), { timeout: 10_000 }).toBe(1)
	expect(await writes(page)).toHaveLength(0)

	await page.getByRole('button', { name: 'Délier' }).click()
	await expect(linkButton(page)).toBeVisible()
	// the in-flight write finishes after the unlink
	await expect.poll(async () => (await writes(page)).length, { timeout: 10_000 }).toBe(1)
	await page.waitForTimeout(300)
	await expect(linkButton(page)).toBeVisible()
	await expect(page.getByText('Fichier lié :')).toHaveCount(0)
	await expect(page.getByRole('alert')).toHaveCount(0)
})
