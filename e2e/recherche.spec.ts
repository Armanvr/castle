import { expect, type Page, test } from '@playwright/test'
import { goToView } from './helpers'

const searchDialog = (page: Page) => page.getByRole('dialog', { name: 'Recherche dans la campagne' })
const opener = (page: Page) => page.getByRole('button', { name: 'Rechercher', exact: true })

const resultsOf = (page: Page) => searchDialog(page).getByRole('list', { name: 'Résultats' }).getByRole('button')

test.beforeEach(({ page }) => page.goto('/'))

test('Ctrl+K, requête sans accent, ↓ puis Entrée ouvrent la fiche de l’objet', async ({ page }) => {
	await page.keyboard.press('Control+k')
	await expect(searchDialog(page)).toBeVisible()
	await page.keyboard.type('elixir')
	const first = resultsOf(page).first()
	await expect(first).toContainText('Élixir de santé')

	await page.keyboard.press('ArrowDown')
	await expect(first).toBeFocused()
	await page.keyboard.press('Enter')

	await expect(searchDialog(page)).toBeHidden()
	await expect(page.getByRole('navigation').getByRole('button', { name: /Objets/ })).toHaveAttribute(
		'aria-current',
		'page',
	)
	await expect(page.getByRole('heading', { name: 'Élixir de santé' })).toBeInViewport()
})

test('↓ et ↑ déplacent le focus entre le champ et les résultats', async ({ page }) => {
	await opener(page).click()
	await expect(searchDialog(page).getByRole('textbox', { name: 'Rechercher' })).toBeFocused()
	await page.keyboard.type('kobold')
	const results = resultsOf(page)
	expect(await results.count()).toBeGreaterThan(1)

	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowDown')
	await expect(results.nth(1)).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await expect(results.nth(0)).toBeFocused()
	await page.keyboard.press('ArrowUp')
	await expect(searchDialog(page).getByRole('textbox', { name: 'Rechercher' })).toBeFocused()
})

test('Entrée dans le champ ouvre le premier résultat : un monstre ouvre le bestiaire', async ({ page }) => {
	await opener(page).click()
	await expect(searchDialog(page).getByRole('textbox', { name: 'Rechercher' })).toBeFocused()
	await page.keyboard.type('bricoleur')
	await expect(resultsOf(page).first()).toContainText('Bricoleur kobold')
	await page.keyboard.press('Enter')
	await expect(searchDialog(page)).toBeHidden()
	await expect(page.getByRole('navigation').getByRole('button', { name: 'Bestiaire' })).toHaveAttribute(
		'aria-current',
		'page',
	)
	await expect(page.getByRole('heading', { name: /Bricoleur kobold/ }).first()).toBeInViewport()
})

test('le focus revient à l’ouvreur à la fermeture', async ({ page }) => {
	await goToView(page, 'Journal')
	await opener(page).focus()
	await page.keyboard.press('Control+k')
	await expect(searchDialog(page)).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(searchDialog(page)).toBeHidden()
	await expect(opener(page)).toBeFocused()

	// WebKit does not focus a button on click: open it from the keyboard so the opener holds focus.
	// Retried: the dialog's async `close` event can land after Enter and reset `searching` (unreachable by hand)
	await expect(async () => {
		if (!(await searchDialog(page).isVisible())) {
			await opener(page).focus()
			await page.keyboard.press('Enter')
		}
		await expect(searchDialog(page).getByRole('textbox', { name: 'Rechercher' })).toBeFocused({ timeout: 1000 })
	}).toPass()
	await page.keyboard.type('elixir')
	await expect(resultsOf(page).first()).toContainText('Élixir de santé')
	await page.keyboard.press('Enter')
	await expect(searchDialog(page)).toBeHidden()
	await expect(opener(page)).toBeFocused()
})
