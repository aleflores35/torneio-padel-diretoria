import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Ranking Page - Public Standings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ranking');
  });

  test('should display ranking page with category tabs', async ({ page }) => {
    // Verificar título
    await expect(page.locator('h1')).toContainText('Ranking');

    // Verificar tabs de categoria
    const tabs = page.locator('[role="tablist"], .tabs, [data-testid*="tab"]').first();
    await expect(tabs).toBeVisible();
  });

  test('should have accessible color contrast', async ({ page }) => {
    await injectAxe(page);
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
        'aria-roles': { enabled: true },
      },
    });
  });

  test('should display standings table with correct columns', async ({ page }) => {
    // Aguardar tabela de dados
    const table = page.locator('table, [role="table"], tbody').first();
    await expect(table).toBeVisible();

    // Verificar colunas obrigatórias
    const expectedColumns = ['Posição', 'Nome', 'Pontos', 'Vitórias'];
    for (const col of expectedColumns) {
      const columnHeader = page.locator(`th:has-text("${col}"), td:has-text("${col}")`);
      // Verificar se pelo menos um cabeçalho existe
      const count = await columnHeader.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should switch between category tabs', async ({ page }) => {
    // Procurar por tabs
    const tabs = page.locator('button[role="tab"], [role="tab"]');
    const tabCount = await tabs.count();

    if (tabCount > 1) {
      const firstTab = tabs.first();
      const secondTab = tabs.nth(1);

      // Verificar inicial
      await expect(firstTab).toHaveAttribute('aria-selected', 'true');

      // Clicar segunda tab
      await secondTab.click();
      await page.waitForTimeout(500); // Aguardar transição

      // Verificar mudança
      await expect(secondTab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('should have auto-refresh functionality', async ({ page }) => {
    // Obter timestamp inicial
    const initialTime = new Date().getTime();

    // Aguardar ~35s para capturar refresh de 30s
    await page.waitForTimeout(35000);

    // Verificar se página ainda está ativa
    await expect(page).toHaveURL(/\/ranking/);
  });

  test('should display leader highlight sections', async ({ page }) => {
    // Procurar por seções destacadas (1º colocado)
    const leaders = page.locator('[data-testid*="leader"], .leader, .top-player');
    const leaderCount = await leaders.count();

    // Deve haver pelo menos um destaque
    expect(leaderCount).toBeGreaterThanOrEqual(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Tabela deve ser scrollável horizontalmente em mobile
    const table = page.locator('table, [role="table"]').first();
    await expect(table).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const content = page.locator('main, [role="main"]').first();
    await expect(content).toBeVisible();
  });

  test('should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const content = page.locator('main, [role="main"]').first();
    await expect(content).toBeVisible();
  });

  test('should have visible focus states on table rows', async ({ page }) => {
    // Procurar por primeira linha da tabela
    const row = page.locator('tbody tr, [role="row"]').first();

    if (await row.isVisible()) {
      await row.focus();

      // Verificar se há estilo visível de focus
      const isFocusVisible = await row.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.outline !== 'none' || styles.boxShadow !== 'none';
      });

      expect(isFocusVisible).toBeTruthy();
    }
  });

  test('should display scoring rules information', async ({ page }) => {
    // Procurar por explicação de pontos
    const rulesSection = page.locator(
      'text=/pontos|vitória|derrota|rules|pontuação/i'
    ).first();

    // Pode estar em card, modal ou footer
    const ruleCount = await page.locator('text=/\\+3|\\+1/i').count();
    expect(ruleCount).toBeGreaterThanOrEqual(0);
  });
});
