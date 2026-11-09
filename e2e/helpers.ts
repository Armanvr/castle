import { expect, type Page } from '@playwright/test'

export const goToView = (page: Page, name: string) =>
	page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name }).click()

// Fresh context = empty localStorage: opens the app, prepares the scenario encounter and starts it.
export async function startEncounter(page: Page, title = 'Hibours') {
	await page.goto('/')
	await launchEncounter(page, title)
}

// Same, from the current page (the campaign state is kept: PJ already added join the combat).
export async function launchEncounter(page: Page, title = 'Hibours') {
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

// Adds a PJ from « Personnages » (the campaign ships none), then stays on that view.
export async function addPlayer(page: Page, name: string, maxHp: number) {
	await goToView(page, 'Personnages')
	await page.getByText('Ajouter un PJ · saisie manuelle').click()
	await page.getByLabel('Nom', { exact: true }).fill(name)
	await page.getByLabel('PV maximum').fill(String(maxHp))
	await page.getByLabel('CA', { exact: true }).fill('15')
	await page.getByLabel("Bonus d'initiative").fill('2')
	await page.getByRole('button', { name: 'Ajouter le PJ' }).click()
	await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

export const snapshotList = (page: Page) => page.getByRole('list', { name: 'Points de restauration' })

export const dmNotes = (page: Page) => page.getByRole('textbox', { name: 'Notes privées du MJ' })
