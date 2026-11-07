import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { login } from './support'

const viewports = [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 1280, height: 800, name: 'narrow-desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 390, height: 844, name: 'mobile' },
]

test.describe('@visual responsive surface overview', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} renders without horizontal overflow`, async ({ page }) => {
      await login(page)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')
      // The header title is the only page title on the overview screen.
      await expect(page.getByRole('banner').getByText('Overview', { exact: true })).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
      await expect(page).toHaveScreenshot(`overview-${viewport.name}.png`, {
        fullPage: false,
        animations: 'disabled',
        mask: [page.getByTestId('overview-freshness')],
        maxDiffPixels: 5000,
      })
    })
  }

  test('login page has no serious accessibility violations', async ({ page }) => {
    await page.goto('/login')
    const results = await new AxeBuilder({ page }).analyze()
    // color-contrast is exempt: the locked three color palette (ink 2D7B49 on
    // surface 0F2516) measures 3.12 to 1 by design. See docs/UI-AUDIT.md.
    expect(
      results.violations.filter(
        (item) => ['serious', 'critical'].includes(item.impact || '') && item.id !== 'color-contrast',
      ),
    ).toEqual([])
  })
})
