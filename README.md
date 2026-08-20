# X-Burguer — Controle de Caixa

Este repositório contém **somente o sistema de Controle de Caixa**.

Versão atual de organização/PWA: **4.14.3**.

- GitHub Pages: `/xburguer-caixa/`
- PWA ID: `/xburguer-caixa/caixa-app`
- Service Worker: `sw.js`
- Escopo do PWA: `/xburguer-caixa/`
- Cache: prefixo `xburguer-caixa-`
- Armazenamento local físico: prefixo `xburguer_caixa_`
- Banco: projeto Supabase exclusivo do Controle de Caixa

O **Controle de Consumo** fica no repositório `xburguer-controle`, usa o caminho `/xburguer-controle/`, outro PWA, outro cache, outro armazenamento local e outro projeto Supabase.

## Regra de organização

Arquivos, alterações, workflows e configurações do Controle de Consumo não devem ser adicionados neste repositório. Da mesma forma, arquivos do Controle de Caixa não devem ser adicionados ao repositório do Consumo.

Principais recursos do Caixa: fechamento diário, histórico, relatórios diário e mensal, controle de pães, despesas, backup JSON/CSV, rascunho local por data, PWA instalável e layout responsivo.
