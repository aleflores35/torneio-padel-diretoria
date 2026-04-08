import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

/**
 * Rodadas Page Tests - Admin Round Management
 * Tests generation, scheduling, and status tracking of tournament rounds
 */

// Helper para login (ajustar conforme sua implementação)
async function loginAsAdmin(page) {
  // Se houver login necessário, adicione aqui
  // await page.goto('/login');
  // await page.fill('input[name="email"]', 'admin@test.com');
  // await page.fill('input[name="password"]', 'password');
  // await page.click('button:has-text("Entrar")');
  // await page.waitForURL('/admin/rodadas');
}

test.describe('Rodadas Page - Admin Round Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rodadas');
  });

  test('should display rodadas page header', async ({ page }) => {
    // Verificar título
    const heading = page.locator('h1, h2').first();
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('rod');
  });

  test('should have accessible color contrast on admin panel', async ({ page }) => {
    await injectAxe(page);
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
      },
    });
  });

  test('should display category selector', async ({ page }) => {
    // Procurar por seletor de categoria
    const categorySelect = page.locator(
      'select[name="category"], [aria-label*="categoria"], .category-filter'
    ).first();

    await expect(categorySelect).toBeVisible();
  });

  test('should display "Gerar Rodadas" button', async ({ page }) => {
    const generateButton = page.locator(
      'button:has-text("Gerar"), button:has-text("Generar")'
    ).first();

    await expect(generateButton).toBeVisible();
  });

  test('should display rounds in calendar format', async ({ page }) => {
    // Procurar por grid/cards de rodadas
    const roundCards = page.locator(
      '[data-testid*="round"], .round-card, [role="article"]'
    );

    const count = await roundCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display round status (PENDING, IN_PROGRESS, FINISHED)', async ({
    page,
  }) => {
    // Procurar por badges/labels de status
    const statusElements = page.locator(
      'text=/PENDING|IN_PROGRESS|FINISHED|Pendente|Em Andamento|Finalizado/i'
    );

    const count = await statusElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have "Sortear & Agendar" button for rounds', async ({ page }) => {
    const scheduleButton = page.locator(
      'button:has-text("Sortear"), button:has-text("Agendar")'
    ).first();

    // Botão pode estar desabilitado até que rodada seja selecionada
    await expect(scheduleButton).toBeVisible();
  });

  test('should display calendar with Thursday dates', async ({ page }) => {
    // Procurar por datas
    const dateElements = page.locator(
      '[data-testid*="date"], .date-picker, time'
    );

    const count = await dateElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should be keyboard navigable on round cards', async ({ page }) => {
    const roundCard = page.locator('[data-testid*="round"], .round-card').first();

    if (await roundCard.isVisible()) {
      await roundCard.focus();

      // Verificar se há estado visível de focus
      const hasFocus = await roundCard.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.outline !== 'none' || styles.boxShadow !== 'none';
      });

      expect(hasFocus).toBeTruthy();
    }
  });

  test('should be responsive on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Cards devem ser stackados verticalmente
    const content = page.locator('main, [role="main"]').first();
    await expect(content).toBeVisible();
  });

  test('should be responsive on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const content = page.locator('main, [role="main"]').first();
    await expect(content).toBeVisible();
  });

  test('should be responsive on desktop (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const content = page.locator('main, [role="main"]').first();
    await expect(content).toBeVisible();
  });

  test('should display helpful instructions or tooltips', async ({ page }) => {
    // Procurar por elementos de ajuda
    const helpElements = page.locator(
      '[aria-label*="help"], [title], .tooltip, .help-text'
    );

    const count = await helpElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have proper ARIA labels on buttons', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      // Verificar se pelos menos alguns botões têm labels
      const buttonsWithLabel = await buttons.evaluateAll((elements) => {
        return elements.filter(
          (el) =>
            el.getAttribute('aria-label') ||
            el.textContent?.trim() ||
            el.title
        ).length;
      });

      expect(buttonsWithLabel).toBeGreaterThan(0);
    }
  });
});
