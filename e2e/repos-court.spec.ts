import { expect, type Page, test } from '@playwright/test'
import { addPlayer, goToView, launchEncounter, liveStatus } from './helpers'

const restButton = (page: Page) => page.getByRole('button', { name: /^Repos court/ })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Repos court du groupe' })
const partyHp = (page: Page, name: string) => page.getByRole('meter', { name: `PV de ${name}` })

// Damage from the PJ sheet (« Personnages »), then back where the rest button lives.
async function hurt(page: Page, amount: number) {
	await goToView(page, 'Personnages')
	await page.getByRole('spinbutton', { name: 'Quantité de dégâts ou soins' }).fill(String(amount))
	await page.getByRole('button', { name: '− Dégâts' }).click()
}

test.beforeEach(async ({ page }) => {
	await page.goto('/')
	await addPlayer(page, 'Alda', 20)
})

test('repos court : PV saisis ajoutés, plafonnés au maximum, entrée de journal', async ({ page }) => {
	await hurt(page, 12)
	await expect(partyHp(page, 'Alda')).toHaveJSProperty('value', 8)

	await restButton(page).click()
	await expect(dialog(page)).toBeVisible()
	await expect(dialog(page).getByText('8 / 20 PV')).toBeVisible()
	await dialog(page).getByLabel('Alda · PV récupérés').fill('5')
	await dialog(page).getByRole('button', { name: 'Valider le repos court' }).click()
	await expect(dialog(page)).toBeHidden()
	await expect(partyHp(page, 'Alda')).toHaveJSProperty('value', 13)
	await expect(liveStatus(page, 'Repos court : Alda +5 PV')).toBeAttached()

	// more than the missing HP: capped at the maximum
	await restButton(page).click()
	await dialog(page).getByLabel('Alda · PV récupérés').fill('100')
	await dialog(page).getByRole('button', { name: 'Valider le repos court' }).click()
	await expect(partyHp(page, 'Alda')).toHaveJSProperty('value', 20)

	await goToView(page, 'Journal')
	const entries = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Repos court' }) })
	await expect(entries).toHaveCount(2)
	await expect(entries.first()).toContainText('Alda +')
	await expect(entries.first()).toContainText('PV')
})

test('repos court avec 0 PV saisis : rien ne change', async ({ page }) => {
	await hurt(page, 7)
	await restButton(page).click()
	await dialog(page).getByRole('button', { name: 'Valider le repos court' }).click()
	await expect(partyHp(page, 'Alda')).toHaveJSProperty('value', 13)
})

test('repos court : un point de restauration est créé', async ({ page }) => {
	await restButton(page).click()
	await dialog(page).getByRole('button', { name: 'Valider le repos court' }).click()
	await goToView(page, 'Paramètres')
	await expect(
		page
			.getByRole('list', { name: 'Points de restauration' })
			.getByRole('listitem')
			.filter({ hasText: 'Repos court' }),
	).toHaveCount(1)
})

test('repos court : une saisie invalide bloque la validation', async ({ page }) => {
	await hurt(page, 12)
	await restButton(page).click()
	const input = dialog(page).getByLabel('Alda · PV récupérés')
	const submit = dialog(page).getByRole('button', { name: 'Valider le repos court' })
	for (const bad of ['-3', '1.5', '']) {
		await input.fill(bad)
		await submit.click()
		await expect(dialog(page)).toBeVisible()
		expect(await input.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false)
	}
	await expect(partyHp(page, 'Alda')).toHaveJSProperty('value', 8)
})

test('repos court : Échap ferme le dialogue et rend le focus au bouton', async ({ page }) => {
	await restButton(page).focus()
	await page.keyboard.press('Enter')
	await expect(dialog(page)).toBeVisible()
	await dialog(page).getByLabel('Alda · PV récupérés').fill('9')
	await page.keyboard.press('Escape')
	await expect(dialog(page)).toBeHidden()
	await expect(restButton(page)).toBeFocused()

	// the abandoned typing is not kept: the field starts at 0 again
	await page.keyboard.press('Enter')
	await expect(dialog(page).getByLabel('Alda · PV récupérés')).toHaveValue('0')
})

test('« Annuler » ferme sans rien appliquer', async ({ page }) => {
	await hurt(page, 12)
	await restButton(page).click()
	await dialog(page).getByLabel('Alda · PV récupérés').fill('5')
	await dialog(page).getByRole('button', { name: 'Annuler' }).click()
	await expect(dialog(page)).toBeHidden()
	await expect(partyHp(page, 'Alda')).toHaveJSProperty('value', 8)
})

test('repos court désactivé pendant un combat, de nouveau actif après', async ({ page }) => {
	await launchEncounter(page, 'Hibours')
	await expect(restButton(page)).toBeDisabled()
	await expect(restButton(page)).toHaveAttribute('title', 'Impossible pendant un combat')

	page.once('dialog', (d) => d.accept())
	await page.getByRole('button', { name: 'Terminer le combat' }).click()
	await expect(restButton(page)).toBeEnabled()
})
