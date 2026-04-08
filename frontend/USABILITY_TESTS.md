# Usability Tests - Ranking Padel SRB 2026

## Overview

Suite completa de testes automatizados para validar usabilidade, acessibilidade (WCAG 2.1 AA) e responsiveness do Ranking Padel SRB.

**Stack:** Playwright + Axe-core  
**Status:** ✅ Completo e pronto para uso

---

## 📋 O que é Testado

### 1. **E2E Tests (End-to-End)**
Simulam fluxos reais de usuário:

| Arquivo | Escopo | Coverage |
|---------|--------|----------|
| `landing.spec.ts` | Inscrição de atleta | Hero, formulário, responsiveness |
| `ranking.spec.ts` | Visualização ranking público | Tabs, auto-refresh, tabela |
| `rodadas.spec.ts` | Gerenciamento de rodadas (admin) | Geração, agendamento, status |

### 2. **Accessibility Tests (WCAG 2.1 AA)**
Validação automática com axe-core:

- ✅ Contraste de cores (4.5:1 mínimo)
- ✅ Navegação por teclado (Tab, Enter, Esc)
- ✅ ARIA labels em inputs
- ✅ Hierarquia de headings (H1 → H6)
- ✅ Alt text em imagens
- ✅ Focus visibility
- ✅ Touch target size (44x44px mobile)

### 3. **Responsive Design Tests**
Validação em múltiplos viewports:

- Mobile: 375px (iPhone)
- Tablet: 768px (iPad)
- Desktop: 1440px (Standard)

---

## 🚀 Como Usar

### 1. **Rodar todos os testes**
```bash
cd frontend
npm run test:e2e
```

### 2. **Rodar teste específico**
```bash
npm run test:landing        # Apenas landing page
npm run test:ranking        # Apenas ranking page
npm run test:rodadas        # Apenas rodadas (admin)
npm run test:accessibility  # Apenas acessibilidade
```

### 3. **UI Interativo (Debug)**
```bash
npm run test:e2e:ui    # Abre interface gráfica
npm run test:e2e:debug # Debug mode com step-by-step
```

### 4. **Ver relatório HTML**
```bash
npm run test:report    # Abre relatório em navegador
```

---

## 📊 Output

Após rodar testes, você terá:

```
frontend/
├── playwright-report/          # Relatório HTML detalhado
│   ├── index.html              # Clique para abrir em navegador
│   ├── data/
│   └── ...
├── test-results.json           # JSON estruturado (CI/CD)
└── junit.xml                   # XML para integração (Jenkins, etc)
```

---

## 🔄 CI/CD - GitHub Actions

### Automaticamente roda quando:
- ✅ Push para `main` ou `develop`
- ✅ Pull request para `main` ou `develop`
- ✅ Mudanças em `frontend/`

### Workflow:
```yaml
.github/workflows/usability-tests.yml
```

**O que faz:**
1. Instala dependências
2. Baixa browsers Playwright
3. Inicia servidor dev
4. Roda todos os testes
5. Faz upload dos relatórios
6. Comenta no PR com resultado

**Resultado no PR:**
```
## 🧪 Usability Test Results
- **Total Tests**: 42
- **Passed**: 40
- **Failed**: 2
- **Skipped**: 0
```

---

## 🐛 Interpretando Resultados

### ✅ Test Passed
Significa que o critério foi validado com sucesso.

### ❌ Test Failed
Significa que há problema de usabilidade. Exemplos:

**Accessibility Issue:**
```
color-contrast: 3.2:1 is less than 4.5:1
⚠️ Action: Aumentar contraste do texto
```

**Keyboard Navigation:**
```
Button não é focusável via Tab
⚠️ Action: Adicionar tabindex="0" ou usar <button> nativo
```

**Responsiveness:**
```
Mobile viewport: Elemento overflow horizontal
⚠️ Action: Ajustar width com media query Tailwind
```

---

## 📝 Adicionando Novos Testes

### Template para novo arquivo de teste:
```typescript
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Sua Página', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sua-rota');
  });

  test('should render without errors', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await injectAxe(page);
    await checkA11y(page);
  });

  test('should be responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});
```

### Registrar novo teste:
1. Criar arquivo em `tests/e2e/seu-teste.spec.ts`
2. Adicionar script no `package.json`:
   ```json
   "test:seu-teste": "playwright test seu-teste.spec.ts"
   ```
3. Incluir no workflow `.github/workflows/usability-tests.yml`

---

## 🎯 Critérios de Sucesso

| Critério | Target | Status |
|----------|--------|--------|
| **E2E Coverage** | Landing + Ranking + Rodadas | ✅ 100% |
| **Accessibility** | WCAG 2.1 AA | ✅ Validado |
| **Responsiveness** | 375px–1440px | ✅ 3 breakpoints |
| **CI/CD** | Auto-run on PR | ✅ GitHub Actions |
| **Report** | HTML + JSON + XML | ✅ Multi-format |

---

## 🔧 Troubleshooting

### "Port 5173 já está em uso"
```bash
# Encontrar processo usando port 5173
lsof -i :5173

# Matar processo (macOS/Linux)
kill -9 <PID>

# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### "Playwright browsers não instalados"
```bash
cd frontend
npx playwright install
```

### "Teste falha no CI/CD mas passa localmente"
- Verificar `VITE_API_URL` em CI
- Garantir que servidor dev está rodando
- Aumentar timeout em `playwright.config.ts`

### "Relatório não abre"
```bash
# Limpar e recriar
rm -rf frontend/playwright-report
npm run test:e2e
npm run test:report
```

---

## 📚 Recursos

- [Playwright Docs](https://playwright.dev)
- [Axe Accessibility](https://www.axe-core.org)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

## 📞 Suporte

**Issues com testes?** Crie um issue em GitHub com:
1. Erro completo (screenshot/log)
2. Qual teste falhou (`npm run test:X`)
3. Seu environment (node version, OS)
4. Steps para reproduzir

---

**Last Updated:** 2026-04-08  
**Maintainer:** Antigravity AI
