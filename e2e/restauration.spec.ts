import { expect, type Page, test } from '@playwright/test'
import { dmNotes, finishCombat, goToView, liveStatus, snapshotList, startEncounter } from './helpers'

const entry = (page: Page, label: string | RegExp) =>
	snapshotList(page).getByRole('listitem').filter({ hasText: label })

const createPoint = async (page: Page) => {
	await goToView(page, 'Paramètres')
	await page.getByRole('button', { name: 'Créer un point de restauration' }).click()
}

test('aucun point au départ, création manuelle puis restauration confirmée avec point « Avant restauration »', async ({
	page,
}) => {
	await page.goto('/')
	await dmNotes(page).fill('version A')
	await goToView(page, 'Paramètres')
	await expect(page.getByText('Aucun point de restauration pour cet emplacement.')).toBeVisible()

	await page.getByRole('button', { name: 'Créer un point de restauration' }).click()
	await expect(entry(page, 'Point manuel')).toHaveCount(1)
	await expect(liveStatus(page, 'Point de restauration créé.')).toBeVisible()

	await dmNotes(page).fill('version B')
	const messages: string[] = []
	page.once('dialog', (dialog) => {
		messages.push(dialog.message())
		void dialog.accept()
	})
	await entry(page, 'Point manuel')
		.getByRole('button', { name: /^Restaurer le point Point manuel/ })
		.click()

	await expect(dmNotes(page)).toHaveValue('version A')
	expect(messages[0]).toContain('Point manuel')
	await expect(entry(page, 'Avant restauration')).toHaveCount(1)
	await expect(liveStatus(page, 'Point de restauration appliqué.')).toBeVisible()

	// the safety point holds the state that was replaced: it brings « version B » back
	page.once('dialog', (dialog) => dialog.accept())
	await entry(page, 'Avant restauration')
		.getByRole('button', { name: /^Restaurer le point Avant restauration/ })
		.click()
	await expect(dmNotes(page)).toHaveValue('version B')
})

test('refuser la confirmation ne change rien', async ({ page }) => {
	await page.goto('/')
	await dmNotes(page).fill('version A')
	await createPoint(page)
	await dmNotes(page).fill('version B')

	page.once('dialog', (dialog) => dialog.dismiss())
	await page.getByRole('button', { name: /^Restaurer le point Point manuel/ }).click()
	await expect(dmNotes(page)).toHaveValue('version B')
	await expect(entry(page, 'Avant restauration')).toHaveCount(0)
})

test('les points survivent au rechargement', async ({ page }) => {
	await page.goto('/')
	await createPoint(page)
	await page.reload()
	await goToView(page, 'Paramètres')
	await expect(entry(page, 'Point manuel')).toHaveCount(1)
})

test('un import crée un point « Avant import » qui rend l’état précédent', async ({ page }) => {
	await page.goto('/')
	await dmNotes(page).fill('avant export')
	await goToView(page, 'Paramètres')
	const download = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Exporter la sauvegarde JSON' }).click()
	const file = await (await download).path()

	await dmNotes(page).fill('après export')
	page.once('dialog', (dialog) => dialog.accept())
	await page.getByLabel('Importer une sauvegarde').setInputFiles(file)
	await expect(dmNotes(page)).toHaveValue('avant export')
	await expect(entry(page, 'Avant import')).toHaveCount(1)

	page.once('dialog', (dialog) => dialog.accept())
	await page.getByRole('button', { name: /^Restaurer le point Avant import/ }).click()
	await expect(dmNotes(page)).toHaveValue('après export')
})

test('un import refusé à la confirmation ne crée pas de point', async ({ page }) => {
	await page.goto('/')
	await goToView(page, 'Paramètres')
	const download = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Exporter la sauvegarde JSON' }).click()
	const file = await (await download).path()

	page.once('dialog', (dialog) => dialog.dismiss())
	await page.getByLabel('Importer une sauvegarde').setInputFiles(file)
	await expect(page.getByLabel('Importer une sauvegarde')).toBeEnabled()
	await expect(entry(page, 'Avant import')).toHaveCount(0)
})

test('le repos long crée un point « Repos long »', async ({ page }) => {
	await page.goto('/')
	page.once('dialog', (dialog) => dialog.accept())
	await page.getByRole('button', { name: /^Repos long/ }).click()
	await goToView(page, 'Paramètres')
	await expect(entry(page, 'Repos long')).toHaveCount(1)
})

test('la fin d’un combat crée un point « Fin de combat : <nom> »', async ({ page }) => {
	await startEncounter(page, 'Hibours')
	await finishCombat(page)
	await goToView(page, 'Paramètres')
	await expect(entry(page, /^Fin de combat : /)).toHaveCount(1)
})

test('au plus 10 points sont conservés, les plus anciens sont écartés', async ({ page }) => {
	await page.goto('/')
	await createPoint(page)
	for (let i = 0; i < 10; i++) {
		await page.getByRole('button', { name: 'Créer un point de restauration' }).click()
		await expect(snapshotList(page).getByRole('listitem')).toHaveCount(Math.min(i + 2, 10))
	}
})

test('point manuel avec quota plein : message d’erreur seul, pas de confirmation de création', async ({ page }) => {
	await page.addInitScript(() => {
		const original = Storage.prototype.setItem
		Storage.prototype.setItem = function (key: string, value: string) {
			if (key.endsWith(':snapshots')) throw new DOMException('quota dépassé', 'QuotaExceededError')
			return original.call(this, key, value)
		}
	})
	await page.goto('/')
	await createPoint(page)
	await expect(page.getByRole('alert').filter({ hasText: 'Point de restauration impossible' })).toBeVisible()
	await expect(liveStatus(page, 'Point de restauration créé.')).toHaveCount(0)
	await expect(entry(page, 'Point manuel')).toHaveCount(0)
})

test('la liste des points est relue à chaque ouverture de Paramètres', async ({ page }) => {
	await page.goto('/')
	await goToView(page, 'Paramètres')
	await expect(snapshotList(page)).toHaveCount(0)
	for (const expected of [1, 2]) {
		await goToView(page, 'Tableau de bord')
		page.once('dialog', (dialog) => dialog.accept())
		await page.getByRole('button', { name: /^Repos long/ }).click()
		await goToView(page, 'Paramètres')
		await expect(entry(page, 'Repos long')).toHaveCount(expected)
	}
})
