# Regressão automatizada — X-Burguer Caixa

A suíte automatizada protege os fluxos que não podem quebrar durante a evolução do sistema.

## Regras unitárias

Os testes de `tests/unit/` validam as regras puras de negócio, sem DOM, rede ou Supabase:

- total dos pagamentos;
- resumo financeiro incluindo saldo inicial;
- conferência física da gaveta sem saldo inicial;
- produção de pães por estoque inicial menos estoque final;
- compatibilidade com backups antigos;
- normalização de registros;
- agregação mensal separando resumo financeiro de vendas por canal.

## Fluxos reais no navegador

Os testes de `tests/e2e/` usam Chromium e o adaptador local isolado do Supabase de produção. Eles cobrem:

1. login, fechamento completo, salvamento, reload, relatório diário, edição e exportação SHA-256;
2. bloqueio de estoque final maior que estoque inicial;
3. preservação e recuperação do rascunho após falha de salvamento;
4. exclusão de fechamento seguida de restauração por backup íntegro;
5. bloqueio de backup protegido adulterado antes da restauração.

O modo E2E só ativa em `localhost` ou `127.0.0.1` com `?e2e=1`. Qualquer acesso ao host oficial do Supabase é interceptado nesse modo, portanto a suíte não grava dados de teste no banco de produção.

## Regra de manutenção

Uma alteração em fechamento, pagamentos, pães, persistência, exclusão, backup ou restauração deve manter toda esta suíte verde antes do merge para `main`.
