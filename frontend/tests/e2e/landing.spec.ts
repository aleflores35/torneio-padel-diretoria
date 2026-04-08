import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Landing Page - Inscrição Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display landing page hero section', async ({ page }) => {
    // Verificar Hero
    await expect(page.locator('h1')).toBeVisible();
    const heroText = await page.textContent('h1');
    expect(heroText).toContain('Ranking');

    // Verificar CTA
    const ctaButton = page.locator('button:has-text("INSCREVA")');
    await expect(ctaButton).toBeVisible();
  });

  test('should have accessible color contrast', async ({ page }) => {
    await injectAxe(page);
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });
  });

  test('should navigate through form sections', async ({ page }) => {
    // Scroll para formulário de inscrição
    const form = page.locator('form, [role="form"]').first();
    await form.scrollIntoViewIfNeeded();

    // Verificar campos obrigatórios
    const nameInput = page.locator('input[name="nome"], input[placeholder*="Nome"]').first();
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Tab até primeiro input
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verificar se elemento focado é dentro do form
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'SELECT']).toContain(focusedElement);
  });

  test('should be responsive on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Verificar se hero se adapta
    const hero = page.locator('section').first();
    await expect(hero).toBeVisible();

    // Verificar se texto é legível
    const headings = page.locator('h1, h2, h3');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should be responsive on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });

  test('should be responsive on desktop (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });

  test('should have visible focus states', async ({ page }) => {
    const button = page.locator('button').first();
    await button.focus();

    // Verificar se há outline ou box-shadow visível
    const outline = await button.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outline + ' ' + styles.boxShadow;
    });

    // Verificar se não é 'none'
    expect(outline).not.toContain('none none');
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const headingLevels = await Promise.all(
      headings.map((h) => h.evaluate((el) => parseInt(el.tagName[1])))
    );

    // Verificar se não pula níveis (ex: h1 → h3)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = Math.abs(headingLevels[i] - headingLevels[i - 1]);
      expect(diff).toBeLessThanOrEqual(1);
    }
  });
});
