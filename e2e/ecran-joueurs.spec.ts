import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import { addPlayer, goToView, launchEncounter, liveStatus, nextTurn } from './helpers'

const screenUrl = '/?ecran=joueurs'

// A page opened second takes the front: the DM page must be brought back, or its animation frames stop
// and Playwright's « stable » actionability check never settles.
async function openScreen(context: BrowserContext, dm?: Page) {
	const screen = await context.newPage()
	await screen.goto(screenUrl)
	await dm?.bringToFront()
	return screen
}
const order = (screen: Page) => screen.getByRole('list').getByRole('listitem')
const activeRow = (screen: Page) => screen.locator('li[aria-current="true"]')

test('sans MJ ouvert : « En attente du MJ… »', async ({ context }) => {
	const screen = await openScreen(context)
	await expect(screen.getByText('En attente du MJ…')).toBeVisible()
	await expect(screen.getByRole('button', { name: 'Plein écran' })).toBeVisible()
})

test('MJ ouvert sans combat : « Rien à montrer pour le moment. »', async ({ context, page }) => {
	await page.goto('/')
	const screen = await openScreen(context, page)
	await expect(screen.getByText('Rien à montrer pour le moment.')).toBeVisible()
})

test('le MJ ouvert après l’écran lui envoie la vue', async ({ context, page }) => {
	const screen = await openScreen(context, page)
	await expect(screen.getByText('En attente du MJ…')).toBeVisible()
	await page.goto('/')
	await expect(screen.getByText('Rien à montrer pour le moment.')).toBeVisible()
})

test('combat : ordre et tour actif suivent « Tour suivant », aucune donnée de monstre, PV des PJ visibles', async ({
	context,
	page,
}) => {
	await page.goto('/')
	await addPlayer(page, 'Alda', 20)
	const screen = await openScreen(context, page)
	await launchEncounter(page, 'Hibours')

	await expect(screen.getByRole('heading', { name: 'Hibours', level: 1 })).toBeVisible()
	await expect(screen.getByText(/^ROUND 1$/)).toBeVisible()
	await expect(order(screen)).toHaveCount(2)
	await expect(activeRow(screen)).toHaveCount(1)

	// the active row follows the DM's turn
	const dmActive = page.getByText('Tour de :').locator('strong')
	for (let i = 0; i < 3; i++) {
		const name = ((await dmActive.textContent()) ?? '').trim()
		await expect(activeRow(screen)).toContainText(name)
		await nextTurn(page).click()
		await expect(dmActive).not.toHaveText(name)
	}

	// PJ: current/max HP shown. Monster: name only, no HP, AC or initiative
	await expect(order(screen).filter({ hasText: 'Alda' })).toContainText('20/20 PV')
	const monster = order(screen).filter({ hasText: 'Hibours' })
	// « · 1 » is the creature's ordinal in its name, not a stat
	await expect(monster).toHaveText(/^\s*Hibours · 1\s*$/)
	const text = (await screen.locator('main').textContent()) ?? ''
	expect(text).not.toMatch(/\bCA\b|armure|initiative/i)
	expect(((await monster.textContent()) ?? '').replace('Hibours · 1', '')).not.toMatch(/\d|PV/)

	// PJ damage and a defeated creature are reflected, still without numbers for the creature
	await page.getByRole('spinbutton', { name: /^Quantité pour Alda/ }).fill('5')
	await page.getByRole('button', { name: 'Dégâts à Alda' }).click()
	await expect(order(screen).filter({ hasText: 'Alda' })).toContainText('15/20 PV')
	await page.getByRole('spinbutton', { name: /^Quantité pour Hibours/ }).fill('999')
	await page.getByRole('button', { name: 'Dégâts à Hibours' }).click()
	await expect(monster).toContainText('Vaincu')
	expect(((await monster.textContent()) ?? '').replace('Hibours · 1', '')).not.toMatch(/\d|PV/)
})

test('texte à lire révélé puis effacé de l’écran des joueurs', async ({ context, page }) => {
	await page.goto('/')
	const screen = await openScreen(context, page)

	await goToView(page, 'Campagne')
	await expect(page.getByRole('button', { name: 'Montrer aux joueurs' })).toHaveCount(0)
	await page.getByRole('button', { name: 'Ajouter un texte à lire (MJ)' }).click()
	await page.getByLabel(/^Texte supplémentaire · À lire aux joueurs/).fill('Une brume épaisse monte du port.')
	await page.getByRole('button', { name: 'Montrer aux joueurs' }).click()

	await expect(screen.getByText('Une brume épaisse monte du port.')).toBeVisible()
	await expect(liveStatus(page, 'affiché sur l’écran des joueurs')).toBeAttached()

	await page.getByRole('button', { name: 'Effacer l’écran des joueurs' }).click()
	await expect(screen.getByText('Une brume épaisse monte du port.')).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Effacer l’écran des joueurs' })).toHaveCount(0)
})

test('le texte révélé n’est pas sauvegardé : absent après rechargement du MJ', async ({ context, page }) => {
	await page.goto('/')
	const screen = await openScreen(context, page)
	await goToView(page, 'Campagne')
	await page.getByRole('button', { name: 'Ajouter un texte à lire (MJ)' }).click()
	await page.getByLabel(/^Texte supplémentaire · À lire aux joueurs/).fill('Secret du moment.')
	await page.getByRole('button', { name: 'Montrer aux joueurs' }).click()
	await expect(screen.getByText('Secret du moment.')).toBeVisible()

	await page.reload()
	await expect(page.getByRole('button', { name: 'Effacer l’écran des joueurs' })).toHaveCount(0)
	await screen.reload()
	await expect(screen.getByText('Secret du moment.')).toHaveCount(0)
})

test('le bouton « Écran des joueurs » ouvre une nouvelle page sur ?ecran=joueurs', async ({ context, page }) => {
	await page.goto('/')
	const popup = context.waitForEvent('page')
	await page.getByRole('button', { name: 'Écran des joueurs' }).click()
	const screen = await popup
	await screen.waitForLoadState()
	expect(new URL(screen.url()).searchParams.get('ecran')).toBe('joueurs')
	// the DM answers the new screen's hello
	await expect(screen.getByText('Rien à montrer pour le moment.')).toBeVisible()
})
