import { expect, type Page, test } from '@playwright/test'
import { goToView, nextTurn, startEncounter } from './helpers'

test.use({ viewport: { width: 390, height: 844 } })

const noHorizontalScroll = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test('« Annuler / Tour suivant » reste épinglée en haut après défilement', async ({ page }) => {
	await startEncounter(page, 'Embuscade de kobolds')
	const undo = page.getByRole('button', { name: 'Annuler', exact: true })
	const next = nextTurn(page)

	await page.getByRole('button', { name: 'Terminer le combat' }).scrollIntoViewIfNeeded()
	await expect(page.getByRole('button', { name: 'Terminer le combat' })).toBeInViewport()
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500)

	for (const button of [undo, next]) {
		await expect(button).toBeInViewport()
		expect((await button.boundingBox())!.y).toBeLessThan(80)
	}
})

test('pas de défilement horizontal au tableau de bord ni en combat', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
	expect(await noHorizontalScroll(page)).toBe(true)

	await startEncounter(page, 'Embuscade de kobolds')
	expect(await noHorizontalScroll(page)).toBe(true)
})

test('la tuile « Combat en cours » du tableau de bord ouvre les rencontres', async ({ page }) => {
	await startEncounter(page, 'Hibours')
	await goToView(page, 'Tableau de bord')
	await page.getByRole('button', { name: 'Combat en cours : ouvrir les rencontres' }).click()
	await expect(page.getByRole('heading', { name: 'À vous de jouer.' })).toBeVisible()
	await expect(nextTurn(page)).toBeVisible()
})
