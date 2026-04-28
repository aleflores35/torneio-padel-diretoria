# Scripts de investigação ad-hoc

Pasta de scripts one-shot usados para diagnosticar bugs específicos. **Não são scripts operacionais** (não rodar sem ler primeiro o que cada um faz). Servem como exemplos / templates pra investigações futuras com problema parecido.

## Inventário

### Caso Francisco × Anderson — round 393 (28/04/2026)

Reclamação no WhatsApp: "vou jogar novamente com o mesmo esquerda da semana passada". Após investigação, descobriu-se que o sorteio não repetiu **parceiro** (o motor cuidava disso via tabela `partnerships`), mas repetiu **adversário diagonal direta** (Anderson Dalmolin, mesmo lado da quadra que o Francisco). Origem: `confirmRound` em `weeklyDrawService.js` fazia pareamento dupla-vs-dupla com `shuffle` puro.

| Script | O que faz |
|---|---|
| `investigate_francisco.js`   | Acha Francisco + Flavio, lista duplas históricas dele, conta partnerships da categoria. Versão 1 — incompleta |
| `investigate_francisco_2.js` | Tenta dump de matches por OR.in() — falhou (Supabase não aceita esse formato) |
| `investigate_francisco_3.js` | Versão final: dump completo de duplas+matches+adversários da round 377 e 393 com identificação visual do encontro do Francisco. **Use este como template** pra investigações de "quem caiu contra quem" em qualquer rodada |
| `inspect_partnerships_schema.js` | Lista 1 row de `partnerships` pra ver schema + checa se `oppositions` existe. Genérico, usar pra checar qualquer schema novo |

Fix shipado no commit `be11acf`: tabela `oppositions` + `pairDoublesGreedy` em `weeklyDrawService.js`.

## Regra pra adicionar novos scripts

1. Coloca aqui (não no root do `backend/`)
2. Adiciona linha nesta tabela com data + caso + referência pro commit do fix
3. Header do script: 1 frase explicando contexto + comando pra rodar
