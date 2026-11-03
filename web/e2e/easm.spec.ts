import { expect, test } from '@playwright/test'
import { login } from './support'

test('surface overview and primary pages load', async ({ page }) => {
  await login(page)
  await expect(page.getByText('External Attack Surface Overview')).toBeVisible()
  await expect(page.getByText('Organizations at Risk')).toBeVisible()
  await page.getByRole('link', { name: 'Organization Workspace' }).click()
  await expect(page).toHaveURL(/\/organizations$/)
  await expect(page.getByRole('heading', { name: 'Organization Governance' })).toBeVisible()
  await page.getByRole('link', { name: 'Assets', exact: true }).click()
  await expect(page).toHaveURL(/\/assets$/)
  await expect(page.getByRole('heading', { name: 'Attack Surface Assets' })).toBeVisible()
  await page.getByRole('link', { name: 'Risks', exact: true }).click()
  await expect(page).toHaveURL(/\/findings$/)
  await expect(page.getByRole('heading', { name: 'Current Risks' })).toBeVisible()
  await page.getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { name: 'Scan Tasks' })).toBeVisible()
})
