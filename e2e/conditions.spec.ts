import { expect, type Page, test } from '@playwright/test'
import { blurActive, liveStatus, nextTurn, sheet, startEncounter } from './helpers'

// A single creature: every "Tour suivant" lands on it again, so its conditions tick on each press.
test.beforeEach(({ page }) => startEncounter(page, 'Hibours'))

const conditions = (page: Page) => sheet(page).getByRole('combobox', { name: /^Conditions : / })

test('une condition de 2 rounds expire deux tours plus tard, avec annonce', async ({ page }) => {
	await conditions(page).selectOption('Étourdi')
	await sheet(page)
		.getByLabel(/Durée en rounds/)
		.fill('2')
	await sheet(page).getByRole('button', { name: 'Ajouter', exact: true }).click()
	await expect(sheet(page).getByRole('button', { name: 'Retirer la condition Étourdi (2 rounds)' })).toBeVisible()

	await nextTurn(page).click()
	await expect(sheet(page).getByRole('button', { name: 'Retirer la condition Étourdi (1 round)' })).toBeVisible()

	await nextTurn(page).click()
	await expect(sheet(page).getByRole('button', { name: 'Retirer la condition Étourdi (expirée)' })).toContainText(
		'expirée',
	)
	await expect(liveStatus(page, 'Condition expirée : Étourdi')).toBeAttached()
})

test('Concentration + dégâts annonce le DD de sauvegarde', async ({ page }) => {
	await conditions(page).selectOption('Concentration')
	await sheet(page).getByRole('button', { name: 'Ajouter', exact: true }).click()
	await expect(sheet(page).getByRole('button', { name: /^Retirer la condition Concentration/ })).toBeVisible()

	await blurActive(page)
	await page.keyboard.press('d')
	await page.keyboard.type('25')
	await page.keyboard.press('Enter')
	await expect(
		liveStatus(page, /Concentration de Hibours · 1 : jet de sauvegarde de Constitution DD 12/),
	).toBeAttached()
})
