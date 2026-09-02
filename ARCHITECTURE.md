# Arquitetura — X-Burguer Caixa

Versão funcional: **4.18.3**.

## Objetivo

A arquitetura mantém a interface atual e separa regras de negócio, persistência, backup e sincronização para reduzir regressões em futuras alterações.

Para transferência de responsabilidade e operação por outro administrador ou ChatGPT, consulte também `MANUAL_ADMINISTRACAO_TRANSFERENCIA.md`.

## Camadas

1. **UI** — `shell*.js`, estilos e funções de apresentação.
2. **Regras de negócio** — `business-rules.js`, módulo puro e sem acesso ao DOM, rede ou banco.
3. **Integração** — `business-rules-integration.js` e módulos financeiros finais aplicam as regras canônicas aos registros carregados, exibidos e salvos.
4. **Persistência** — `app1.js` e RPCs do Supabase.
5. **Proteções** — `system-hardening.js`, `data-consistency.js`, `backup-protection.js` e validações do banco.
6. **Sincronização** — `realtime.js`.
7. **PWA/offline** — `service-worker.js`, manifesto e registro do PWA.

## Regras canônicas

### Venda oficial

`Venda = Dinheiro (Caixa) + Dinheiro (Entregas) + Cartão (Loja) + Cartão (Entregas) + Pix/Apps`

Essa soma é o **Resumo Financeiro / Formas de pagamento**.

### Vendas por canal

`Vendas por Canal` é um demonstrativo operacional independente. A soma dos canais não entra novamente em Venda, Resultado ou faturamento.

A quantidade de pedidos dos canais pode ser usada em métricas operacionais, como o Ticket médio.

### Resultado

`Resultado = Venda oficial - Despesas`

### Dinheiro físico

O saldo inicial não é venda, mas participa da conferência física da gaveta:

`Dinheiro previsto = Saldo Inicial + Dinheiro (Caixa) + Dinheiro (Entregas) - dinheiro retirado para despesas`

Quando a contagem física for informada:

`Diferença física = Dinheiro contado - Dinheiro previsto`

A contagem física é opcional. Quando não informada, o sistema não deve inventar diferença de caixa.

### Saldo inicial seguinte

`Próxima abertura = máximo entre R$ 0,00 e o Dinheiro previsto do fechamento anterior salvo no mesmo mês`

A cadeia automática de abertura está vigente desde 24/08/2026, respeitando dias sem fechamento.

### Pães

`Produção = Estoque inicial - Estoque final`

O campo legado de saída não participa da regra atual.

### Dashboard mensal

O Dashboard mensal representa o **mês completo cadastrado**. Lançamentos futuros do mesmo mês podem participar dos totais quando forem compromissos já registrados.

## Fonte de verdade

Para cálculos financeiros, `business-rules.js` é a fonte canônica do frontend.

O banco também deve manter as regras financeiras essenciais, especialmente:

`total_sales = cash_sales + delivery_cash_sales + store_card_sales + delivery_card_sales + pix_app_sales`

`result = total_sales - total_expenses`

As linhas de `channel_sales` permanecem independentes desses totais.

## Testes

### Unitários

`tests/unit/business-rules.test.js` valida fórmulas financeiras, pães, normalização, compatibilidade necessária e agregação.

### Navegador

Os testes E2E verificam fluxos de login, preenchimento, salvamento, Dashboard, relatórios, edição, backup e separação entre Resumo Financeiro e Vendas por Canal.

O teste de separação financeira deve garantir que, se o Resumo Financeiro for diferente da soma dos canais, **somente o Resumo Financeiro seja tratado como Venda oficial**.

O modo E2E usa ambiente isolado e não deve gravar dados de teste no Supabase de produção.

## Regra para futuras mudanças

Alterações em cálculos financeiros, conferência de caixa ou pães devem ser feitas primeiro em `business-rules.js` e acompanhadas de teste unitário. Alterações em fluxos críticos devem manter os testes E2E e workflows de validação verdes antes de serem consideradas concluídas.

Nunca alterar dados históricos apenas para forçar Vendas por Canal a coincidir com o Resumo Financeiro.
