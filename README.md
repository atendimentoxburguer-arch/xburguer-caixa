# X-Burguer — Controle de Caixa

Este repositório contém **somente o sistema X-Burguer Caixa**.

Versão funcional atual: **4.18.2**.

- GitHub Pages: `/xburguer-caixa/`
- PWA ID: `/xburguer-caixa/caixa-oficial`
- Tela principal: `/xburguer-caixa/caixa.html?app=caixa`
- Service Worker oficial: `service-worker.js`
- Compatibilidade legada: `sw.js`
- Escopo do PWA: `/xburguer-caixa/`
- Cache: prefixo `xburguer-caixa-`
- Namespace físico de armazenamento local: `xburguer_caixa::`
- Banco: projeto Supabase exclusivo do X-Burguer Caixa

O **X-Burguer Controle** fica no repositório `xburguer-controle`, usa o caminho `/xburguer-controle/`, outro PWA, outro cache, outro armazenamento local e outro projeto Supabase.

## Regra de organização

Arquivos, alterações, workflows e configurações do X-Burguer Controle não devem ser adicionados neste repositório. Da mesma forma, arquivos do X-Burguer Caixa não devem ser adicionados ao repositório do Controle.

## Principais recursos

- fechamento diário com rascunho local por data;
- sincronização automática com Supabase e tempo real;
- histórico com edição e exclusão controladas;
- relatórios diário e mensal;
- controle de pães por estoque inicial e estoque final;
- pedidos online e vendas por canal;
- despesas do dia;
- resumo financeiro com Dinheiro (Caixa), Dinheiro (Entregas), cartões e Pix/apps;
- conferência automática de pagamentos e contagem física opcional;
- backup JSON/CSV e restauração atômica;
- modo offline seguro;
- PWA instalável e layout responsivo.

## Regra atual do controle de pães

O usuário informa **Estoque inicial** e **Estoque final**. O sistema calcula automaticamente:

`Produção = Estoque inicial - Estoque final`

O **Acumulado do mês** soma as produções calculadas no mês. O campo legado **Saída** não é utilizado.

## Regras financeiras atuais

O **Total de Vendas Geral** do Resumo financeiro é independente do total de **Vendas por canal** e soma os valores do próprio bloco financeiro, incluindo o saldo inicial.

A conferência física da gaveta usa:

`Dinheiro previsto = Dinheiro (Caixa) + Dinheiro (Entregas) - retiradas para despesas`

O saldo inicial não entra na conferência física da gaveta.
