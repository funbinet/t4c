import { expect, test } from '@playwright/test'
import { login, trackBrowserErrors } from './support'

const routes = [
  { path: '/', title: 'Overview' },
  { path: '/organizations', title: 'Organizations' },
  { path: '/assets', title: 'Assets' },
  { path: '/findings', title: 'Risks' },
  { path: '/tasks', title: 'Tasks' },
  { path: '/automation/monitors', title: 'Monitors' },
  { path: '/automation/schedules', title: 'Schedules' },
  { path: '/automation/policies', title: 'Scan Policies' },
  { path: '/automation/groups', title: 'Asset Groups' },
  { path: '/intelligence/github', title: 'GitHub Intelligence' },
  { path: '/intelligence/fingerprints', title: 'Fingerprints' },
  { path: '/intelligence/poc', title: 'PoC Plugins' },
  { path: '/admin/users', title: 'User Management' },
  { path: '/admin/api-keys', title: 'API Key' },
  { path: '/admin/audit', title: 'Audit Log' },
  { path: '/admin/system', title: 'System' },
] as const

test.describe('console routes', () => {
  for (const route of routes) {
    test(`${route.path} renders ${route.title} without browser or API errors`, async ({ page }) => {
      await login(page)
      if (route.path !== '/') await page.goto(route.path)
      const errors = trackBrowserErrors(page)
      // The header title is the only page title.
      await expect(page.getByRole('banner').getByText(route.title, { exact: true })).toBeVisible()
      await page.waitForLoadState('networkidle')
      expect(errors).toEqual([])
    })
  }

  test('opens global search with the keyboard', async ({ page }) => {
    await login(page)
    await page.keyboard.press('Control+K')
    await expect(page.getByPlaceholder('Search organizations, domains, assets, risks, or tasks…')).toBeVisible()
  })

  test('returns a 404 page for removed routes', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()
  })
})
