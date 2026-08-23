# Arquitetura — X-Burguer Caixa

Versão funcional: **4.18.2**.

## Objetivo

A arquitetura mantém a interface atual e separa regras de negócio, persistência, backup e sincronização para reduzir regressões em futuras alterações.

## Camadas

1. **UI** — `shell*.js`, estilos e funções de apresentação.
2. **Regras de negócio** — `business-rules.js`, módulo puro e sem acesso ao DOM, rede ou banco.
3. **Integração** — `business-rules-integration.js`, aplica as regras canônicas aos registros carregados e salvos.
4. **Persistência** — `app1.js` e RPCs do Supabase.
5. **Proteções** — `system-hardening.js`, `data-consistency.js`, `backup-protection.js` e validações do banco.
6. **Sincronização** — `realtime.js`.

## Regras canônicas

- `Pagamentos = Dinheiro (Caixa) + Dinheiro (Entregas) + Cartão (Salão/Balcão) + Pix/Apps + Cartão (Entregas)`.
- `Dinheiro previsto = Dinheiro (Caixa) + Dinheiro (Entregas) - dinheiro retirado`.
- O saldo inicial **não** entra na conferência física da gaveta.
- `Resumo financeiro = Saldo inicial + Pagamentos`.
- `Vendas por canal` permanece independente do Resumo financeiro.
- `Produção de pão = Estoque inicial - Estoque final`.
- A contagem física de dinheiro é opcional; quando não informada, a diferença de caixa não é inventada.

## Testes

### Unitários

`tests/unit/business-rules.test.js` valida as fórmulas financeiras, pães, compatibilidade com backups antigos, normalização e agregação mensal.

### Navegador

`tests/e2e/caixa-flow.spec.js` executa o fluxo:

`login → preencher fechamento → salvar → recarregar → relatório diário → editar → salvar novamente → exportar backup → validar SHA-256`.

O teste usa `e2e-adapter.js`, que só ativa quando **as duas condições** são verdadeiras:

- hostname `localhost` ou `127.0.0.1`;
- query string `?e2e=1`.

Nesse modo, toda chamada ao domínio Supabase oficial é interceptada e os dados ficam apenas no `localStorage` isolado do navegador de teste. Nenhum teste automatizado escreve no banco de produção.

## Regra para futuras mudanças

Alterações em cálculos financeiros, conferência de caixa ou pães devem ser feitas primeiro em `business-rules.js` e acompanhadas de teste unitário. Alterações em fluxos críticos devem manter o teste E2E verde antes do merge na `main`.
