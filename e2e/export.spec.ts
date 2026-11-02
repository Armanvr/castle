import { expect, type Page, test } from '@playwright/test'
import { finishCombat, goToView, liveStatus, startEncounter } from './helpers'

const reminder = (page: Page) => page.getByText('Pensez à exporter une sauvegarde')

test('fin de combat : rappel, export téléchargé, « Dernier export » mis à jour', async ({ page }) => {
	await startEncounter(page, 'Hibours')
	await expect(reminder(page)).toBeHidden()
	await finishCombat(page)
	await expect(liveStatus(page, 'Combat terminé.')).toContainText('Pensez à exporter une sauvegarde')

	const download = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Exporter maintenant' }).click()
	expect((await download).suggestedFilename()).toMatch(/-sauvegarde-1\.json$/)
	await expect(reminder(page)).toBeHidden()

	await goToView(page, 'Paramètres')
	await expect(page.getByText('Dernier export :')).not.toContainText('jamais')
})

test('« Plus tard » masque le rappel sans exporter', async ({ page }) => {
	await startEncounter(page, 'Hibours')
	await finishCombat(page)
	await page.getByRole('button', { name: 'Plus tard' }).click()
	await expect(reminder(page)).toBeHidden()
	await goToView(page, 'Paramètres')
	await expect(page.getByText('Dernier export :')).toContainText('jamais')
})

test('importer une sauvegarde au combat terminé ne déclenche pas le rappel', async ({ page }) => {
	await startEncounter(page, 'Hibours')
	await finishCombat(page)
	const download = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Exporter maintenant' }).click()
	const file = await (await download).path()

	// back to a live combat, then replace the slot by the finished one
	await goToView(page, 'Rencontres')
	await page.getByRole('button', { name: 'Préparer la rencontre' }).first().click()
	await page.getByRole('button', { name: 'Démarrer le combat' }).click()
	await expect(page.getByText('COMBAT EN COURS')).toBeVisible()

	await goToView(page, 'Paramètres')
	page.once('dialog', (dialog) => dialog.accept())
	await page.getByLabel('Importer une sauvegarde').setInputFiles(file)
	await expect(page.getByLabel('Importer une sauvegarde')).toBeEnabled()
	await goToView(page, 'Rencontres')
	await expect(page.getByText('Aucun combat en cours')).toBeVisible()
	await expect(reminder(page)).toBeHidden()
})
