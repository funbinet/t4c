import { expect, test } from '@playwright/test'
import { login } from './support'

test('surface overview and primary pages load', async ({ page }) => {
  await login(page)
  // The header title is the only page title on every screen.
  await expect(page.getByRole('banner').getByText('Overview', { exact: true })).toBeVisible()
  await expect(page.getByText('Organizations at Risk')).toBeVisible()
  await page.getByRole('link', { name: 'Organizations' }).click()
  await expect(page).toHaveURL(/\/organizations$/)
  await expect(page.getByRole('banner').getByText('Organizations', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Assets' }).click()
  await expect(page).toHaveURL(/\/assets$/)
  await expect(page.getByRole('banner').getByText('Assets', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Risks' }).click()
  await expect(page).toHaveURL(/\/findings$/)
  await expect(page.getByRole('banner').getByText('Risks', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Tasks' }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('banner').getByText('Tasks', { exact: true })).toBeVisible()
})
