import { expect, type Page, test } from '@playwright/test'
import { activeName, blurActive, sheet, sheetHp, startEncounter } from './helpers'

const currentHp = (page: Page) => sheetHp(page).evaluate((m: HTMLMeterElement) => m.value)

test.beforeEach(({ page }) => startEncounter(page, 'Embuscade de kobolds'))

test('lancer une rencontre affiche le combat en cours avec un participant actif', async ({ page }) => {
	await expect(page.getByText('COMBAT EN COURS')).toBeVisible()
	await expect(page.getByRole('heading', { name: /Embuscade de kobolds/ })).toContainText('Round 1')
	await expect(page.getByRole('list', { name: 'Ordre d’initiative' }).getByRole('listitem')).toHaveCount(5)
	await expect(activeName(page)).not.toBeEmpty()
})

test('N avance le tour', async ({ page }) => {
	const before = (await activeName(page).textContent())!
	await page.keyboard.press('n')
	await expect(activeName(page)).not.toHaveText(before)
})

test('D, un nombre puis Entrée appliquent les dégâts, Ctrl+Z les annule', async ({ page }) => {
	const full = await currentHp(page)
	await page.keyboard.press('d')
	await expect(sheet(page).getByRole('spinbutton', { name: 'Quantité de dégâts ou soins' })).toBeFocused()
	await page.keyboard.type('3')
	await page.keyboard.press('Enter')
	await expect(sheetHp(page)).toHaveJSProperty('value', full - 3)
	await expect(page.getByRole('button', { name: /^Annuler · / })).toBeEnabled()

	await blurActive(page)
	await page.keyboard.press('Control+z')
	await expect(sheetHp(page)).toHaveJSProperty('value', full)
	await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled()
})

test('les raccourcis ne font rien dans la zone de notes', async ({ page }) => {
	const full = await currentHp(page)
	await page.keyboard.press('d')
	await page.keyboard.type('3')
	await page.keyboard.press('Enter')
	await expect(sheetHp(page)).toHaveJSProperty('value', full - 3)

	const before = (await activeName(page).textContent())!
	await sheet(page).getByText('Ajuster les statistiques').click()
	const notes = sheet(page).getByRole('textbox', { name: /Notes MJ/ })
	await notes.click()
	await page.keyboard.type('nd')
	await expect(notes).toHaveValue('nd')
	await expect(activeName(page)).toHaveText(before)
	await expect(notes).toBeFocused()

	await page.keyboard.press('Control+z')
	await expect(sheetHp(page)).toHaveJSProperty('value', full - 3)
})
