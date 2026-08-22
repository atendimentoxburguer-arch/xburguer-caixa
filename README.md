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
- controle de pães com estoque final automático;
- pedidos online e vendas por canal;
- despesas do dia;
- conferência automática de pagamentos e contagem física opcional;
- backup JSON/CSV e restauração atômica;
- modo offline seguro;
- PWA instalável e layout responsivo.

## Regra atual do controle de pães

O campo **Saída** não é utilizado. O cálculo oficial é:

`Estoque final = Estoque inicial - Produção`

O acumulado mensal soma as produções registradas no mês.
