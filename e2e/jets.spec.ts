import { expect, test } from '@playwright/test'
import { sheet, startEncounter } from './helpers'

test('jet de dégâts d’un monstre : cible, application, PV, annulation', async ({ page }) => {
	await startEncounter(page, 'Marins noyés')
	const actions = sheet(page).getByRole('region', { name: /^Attaques et jets de / })
	await actions
		.getByRole('button', { name: /dégâts 1 · / })
		.first()
		.click()
	const total = Number(
		(
			await actions
				.getByText(/Total : \d+/)
				.first()
				.innerText()
		).match(/\d+/)![0],
	)

	// the attacker is never offered as a target: the first real option is another zombie
	const target = actions.getByRole('combobox', { name: 'Cible' }).first()
	const label = (await target.locator('option').nth(1).innerText()).trim()
	await expect(actions.getByRole('button', { name: /^Appliquer / }).first()).toBeDisabled()
	await target.selectOption({ label })

	const hp = page.getByRole('meter', { name: `Points de vie de ${label}` })
	const before = Number(await hp.evaluate((m: HTMLMeterElement) => m.value))
	await actions
		.getByRole('button', { name: /^Appliquer \d+ dégâts?$/ })
		.first()
		.click()
	await expect(hp).toHaveJSProperty('value', before - total)

	await page.getByRole('button', { name: /^Annuler · / }).click()
	await expect(hp).toHaveJSProperty('value', before)
})
