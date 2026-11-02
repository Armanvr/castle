import { expect, type Page } from '@playwright/test'

export const goToView = (page: Page, name: string) =>
	page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name }).click()

// Fresh context = empty localStorage: opens the app, prepares the scenario encounter and starts it.
export async function startEncounter(page: Page, title = 'Hibours') {
	await page.goto('/')
	await goToView(page, 'Rencontres')
	await page
		.getByRole('article')
		.filter({ has: page.getByRole('heading', { name: title, exact: true }) })
		.getByRole('button', { name: 'Préparer la rencontre' })
		.click()
	await page.getByRole('button', { name: 'Démarrer le combat' }).click()
	await expect(nextTurn(page)).toBeEnabled()
}

export const activeName = (page: Page) => page.getByText('Tour de :').locator('strong')

export const sheet = (page: Page) => page.getByRole('region', { name: 'Fiche de combat' })

export const sheetHp = (page: Page) => sheet(page).getByRole('meter', { name: 'Points de vie' })

export const nextTurn = (page: Page) => page.getByRole('button', { name: 'Tour suivant' })

export const liveStatus = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text })

export async function finishCombat(page: Page) {
	page.once('dialog', (dialog) => dialog.accept())
	await page.getByRole('button', { name: 'Terminer le combat' }).click()
}

// Keyboard shortcuts ignore typing targets: leave the field the way a click elsewhere would.
export const blurActive = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
