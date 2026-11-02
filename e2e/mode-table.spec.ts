import { expect, type Page, test } from '@playwright/test'
import { finishCombat, sheet, startEncounter } from './helpers'

test.beforeEach(async ({ page }) => {
	await startEncounter(page, 'Hibours')
	await page.getByRole('button', { name: 'Mode table' }).click()
})

const inTable = (page: Page) => page.getByRole('button', { name: 'Quitter le mode table' })

test('Échap quitte le mode table', async ({ page }) => {
	await expect(inTable(page)).toBeVisible()
	await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeHidden()
	await page.keyboard.press('Escape')
	await expect(page.getByRole('button', { name: 'Mode table' })).toBeVisible()
	await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
})

test('Échap ne quitte pas le mode table depuis un champ', async ({ page }) => {
	await page.keyboard.press('d')
	await expect(sheet(page).getByRole('spinbutton', { name: 'Quantité de dégâts ou soins' })).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(inTable(page)).toBeVisible()
})

test('Échap ferme la ligne de durée sans quitter le mode table', async ({ page }) => {
	await sheet(page)
		.getByRole('combobox', { name: /^Conditions : / })
		.selectOption('Étourdi')
	const rounds = sheet(page).getByLabel(/Durée en rounds/)
	await expect(rounds).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(rounds).toBeHidden()
	await expect(inTable(page)).toBeVisible()
})

test('Échap ferme la recherche sans quitter le mode table', async ({ page }) => {
	await page.keyboard.press('Control+k')
	const search = page.getByRole('dialog', { name: 'Recherche dans la campagne' })
	await expect(search).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(search).toBeHidden()
	await expect(inTable(page)).toBeVisible()

	await page.keyboard.press('Control+k')
	await page.getByRole('textbox', { name: 'Rechercher' }).press('Tab')
	await page.keyboard.press('Escape')
	await expect(search).toBeHidden()
	await expect(inTable(page)).toBeVisible()
})

test('terminer le combat sort du mode table', async ({ page }) => {
	await finishCombat(page)
	await expect(page.getByRole('button', { name: /mode table/i })).toHaveCount(0)
	await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
})
