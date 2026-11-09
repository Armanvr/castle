import { expect, test } from '@playwright/test'

test('préparation de session : section, lien vers une scène suivante, lien vers une rencontre', async ({ page }) => {
	await page.goto('/')
	const prep = page.getByRole('region', { name: 'Préparer la session' })
	await expect(prep).toBeVisible()
	await expect(prep.getByRole('heading', { name: 'Scène active' })).toBeVisible()
	await expect(prep.getByRole('heading', { name: 'Rencontres' })).toBeVisible()

	const encounterLink = prep
		.getByRole('listitem')
		.filter({ has: page.getByRole('button') })
		.last()
		.getByRole('button')
	const encounterName = ((await encounterLink.textContent()) ?? '').trim()
	await encounterLink.click()
	// lands on « Rencontres » with the preparation form of that encounter
	await expect(page.getByRole('button', { name: 'Démarrer le combat' })).toBeVisible()
	await expect(page.getByText(encounterName).first()).toBeVisible()
})

test('préparation de session : un lien de scène suivante ouvre cette scène', async ({ page }) => {
	await page.goto('/')
	const prep = page.getByRole('region', { name: 'Préparer la session' })
	const next = prep.getByRole('heading', { name: 'Scènes suivantes' })
	await expect(next).toBeVisible()
	const links = prep.locator('h3:has-text("Scènes suivantes") + ul button')
	test.skip((await links.count()) === 0, 'la scène active n’a pas de scène suivante liée')
	const title = ((await links.first().textContent()) ?? '').trim()
	await links.first().click()
	await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
})
