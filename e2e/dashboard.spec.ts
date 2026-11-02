import { expect, test } from '@playwright/test'
import { goToView } from './helpers'

test('terminer une scène incrémente le compteur du tableau de bord', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByText(/^0 \/ \d+ scènes terminées$/)).toBeVisible()
	await expect(page.getByText(/À commencer · /)).toBeVisible()

	await goToView(page, 'Campagne')
	await page.locator('.choice-button').first().click()
	await page.getByLabel('Progression').selectOption('completed')

	await goToView(page, 'Tableau de bord')
	await expect(page.getByText(/^1 \/ \d+ scènes terminées$/)).toBeVisible()
	await expect(page.getByText(/En cours · /)).toBeVisible()
})
