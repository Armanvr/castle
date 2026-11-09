import { expect, type Page, test } from '@playwright/test'
import { addPlayer, finishCombat, goToView, launchEncounter } from './helpers'

const xpInput = (page: Page) => page.getByRole('spinbutton', { name: 'XP de Alda, ajustement manuel' })

// Hibours (FP 3, 700 XP) alone against one PJ.
async function startHibours(page: Page) {
	await page.goto('/')
	await addPlayer(page, 'Alda', 20)
	await launchEncounter(page, 'Hibours')
}

test('créature vaincue : XP dans le récapitulatif du journal et sur la fiche du PJ', async ({ page }) => {
	await startHibours(page)
	await page.getByRole('spinbutton', { name: /^Quantité pour Hibours/ }).fill('999')
	await page.getByRole('button', { name: 'Dégâts à Hibours' }).click()
	await expect(page.getByRole('meter', { name: 'Points de vie de Hibours' })).toHaveJSProperty('value', 0)
	await finishCombat(page)

	await goToView(page, 'Journal')
	await expect(page.getByRole('article').filter({ hasText: /XP : 700 \(700 chacun\)/ })).toHaveCount(1)

	await goToView(page, 'Personnages')
	await expect(xpInput(page)).toHaveValue('700')
	await expect(page.getByText('XP : 700', { exact: true })).toBeVisible()
})

test('aucune créature vaincue : pas d’XP', async ({ page }) => {
	await startHibours(page)
	await finishCombat(page)
	await goToView(page, 'Journal')
	await expect(page.getByRole('article').filter({ hasText: /XP : \d+/ })).toHaveCount(0)
	await goToView(page, 'Personnages')
	await expect(xpInput(page)).toHaveValue('0')
})

test('ajustement manuel de l’XP conservé après rechargement', async ({ page }) => {
	await page.goto('/')
	await addPlayer(page, 'Alda', 20)
	await expect(xpInput(page)).toHaveValue('0')
	await xpInput(page).fill('1200')
	await xpInput(page).blur()
	await expect(page.getByText('XP : 1200', { exact: true })).toBeVisible()

	await page.reload()
	await goToView(page, 'Personnages')
	await expect(xpInput(page)).toHaveValue('1200')
})

test('champ vidé puis blur : la valeur enregistrée réapparaît', async ({ page }) => {
	await page.goto('/')
	await addPlayer(page, 'Alda', 20)
	await xpInput(page).fill('1200')
	await xpInput(page).blur()
	await xpInput(page).fill('')
	await xpInput(page).blur()
	await expect(xpInput(page)).toHaveValue('1200')
	await expect(page.getByText('XP : 1200', { exact: true })).toBeVisible()
})

test('valeur au-delà de 10 000 000 refusée, 10 000 000 accepté', async ({ page }) => {
	await page.goto('/')
	await addPlayer(page, 'Alda', 20)
	await xpInput(page).fill('1200')
	await xpInput(page).blur()
	await xpInput(page).fill('10000001')
	await xpInput(page).blur()
	await expect(xpInput(page)).toHaveValue('1200')
	await expect(page.getByText('XP : 1200', { exact: true })).toBeVisible()

	await xpInput(page).fill('10000000')
	await xpInput(page).blur()
	await expect(page.getByText('XP : 10000000', { exact: true })).toBeVisible()
	await page.reload()
	await goToView(page, 'Personnages')
	await expect(xpInput(page)).toHaveValue('10000000')
})
