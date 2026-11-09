import { expect, test } from '@playwright/test'
import { goToView } from './helpers'

test('le texte révélé sur l’écran des joueurs est lisible à distance', async ({ context, page }) => {
	await page.goto('/')
	await goToView(page, 'Campagne')
	await page.getByRole('button', { name: 'Ajouter un texte à lire (MJ)' }).click()
	await page.getByRole('textbox', { name: /À lire aux joueurs/ }).fill('Trois silhouettes dans la brume.')
	const screen = await context.newPage()
	await screen.goto('/?ecran=joueurs')
	await page.getByRole('button', { name: 'Montrer aux joueurs' }).click()
	const text = screen.getByText('Trois silhouettes dans la brume.')
	await expect(text).toBeVisible()
	const size = await text.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))
	expect(size).toBeGreaterThanOrEqual(20)
})
