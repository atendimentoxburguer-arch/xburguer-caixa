# X-Burguer — Controle de Caixa

Este repositório contém **somente o sistema X-Burguer Caixa**.

Versão funcional atual: **4.18.3**.

- GitHub Pages: `/xburguer-caixa/`
- PWA ID: `/xburguer-caixa/caixa-oficial`
- Tela principal: `/xburguer-caixa/caixa.html?app=caixa`
- Service Worker oficial: `service-worker.js`
- Compatibilidade legada: `sw.js`
- Escopo do PWA: `/xburguer-caixa/`
- Cache oficial atual: `xburguer-caixa-native-v6-audit-4.18.3`
- Namespace físico de armazenamento local: `xburguer_caixa::`
- Banco: projeto Supabase exclusivo do X-Burguer Caixa (`trnngxezppeembrvxkhh`)

## Administração e transferência

Para passar o sistema para outro responsável, outra conta ou outro ChatGPT, use como referência principal:

**[`MANUAL_ADMINISTRACAO_TRANSFERENCIA.md`](MANUAL_ADMINISTRACAO_TRANSFERENCIA.md)**

O manual documenta acessos, regras financeiras, banco, backups, testes, GitHub Pages, rotina de saúde e checklist de transferência.

## Regra de organização

O **X-Burguer Controle** é outro sistema e não deve ser misturado com este repositório. Arquivos, banco, PWA, cache e configurações dos dois projetos devem permanecer separados.

## Principais recursos

- fechamento diário com rascunho local por data;
- sincronização automática com Supabase e tempo real;
- histórico com edição e exclusão controladas;
- relatórios diário e mensal;
- controle de pães por estoque inicial e estoque final;
- pedidos online e vendas por canal demonstrativas;
- despesas do dia;
- resumo financeiro com Dinheiro (Caixa), Dinheiro (Entregas), cartões e Pix/apps;
- conferência automática e contagem física opcional;
- backup JSON protegido por SHA-256 e restauração atômica;
- registro das exportações de backup no Supabase;
- snapshot diário de recuperação mantido por 30 dias;
- modo offline seguro;
- PWA instalável e layout responsivo.

## Regra financeira oficial

O **Resumo Financeiro / Formas de pagamento é a única fonte da Venda oficial**.

`Venda = Dinheiro (Caixa) + Dinheiro (Entregas) + Cartão (Loja) + Cartão (Entregas) + Pix/Apps`

As **Vendas por Canal** — Hot, Mr. Burguer, WhatsApp, Mesa, Retirada e Entregas — são exclusivamente demonstrativas. Elas continuam salvas para análise operacional e quantidade de pedidos, mas **não são somadas novamente como receita**.

`Resultado = Venda oficial - Despesas`

O Dashboard, relatórios e totais financeiros devem respeitar essa regra.

A diferença entre Resumo Financeiro e Vendas por Canal é apenas informativa e não deve impedir salvamento nem gerar dupla contabilização.

## Saldo inicial e conferência física

O Saldo Inicial **não é venda**. Ele representa apenas o dinheiro físico que já estava na gaveta no início do fechamento.

`Dinheiro previsto = Saldo Inicial + Dinheiro (Caixa) + Dinheiro (Entregas) - retiradas para despesas`

Quando a contagem física for informada:

`Diferença física = Dinheiro contado - Dinheiro previsto`

A partir de **24/08/2026**, o Saldo Inicial segue uma cadeia de fechamentos dentro de cada mês:

- no dia 01, o Saldo Inicial é manual;
- nos demais dias, existindo fechamento anterior no mesmo mês, o valor é automático;
- dias sem fechamento podem ser pulados;
- o cálculo usa o último fechamento anterior realmente salvo;
- se ainda não houver fechamento anterior no mês, o primeiro registro pode iniciar com abertura manual;
- alterações em um fechamento anterior podem propagar o novo saldo para o próximo fechamento salvo.

`Saldo Inicial do próximo fechamento = máximo entre R$ 0,00 e o Dinheiro previsto do fechamento anterior`

## Dashboard mensal e lançamentos futuros

O Dashboard mensal representa **o mês completo cadastrado**. Lançamentos e despesas futuras pertencentes ao mesmo mês podem fazer parte do total mensal quando já estiverem cadastrados como compromissos planejados.

Se for necessário um indicador somente do realizado até a data atual, ele deve ser criado separadamente, sem alterar o total mensal.

## Controle de pães

O usuário informa **Estoque inicial** e **Estoque final**.

`Produção = Estoque inicial - Estoque final`

O **Acumulado do mês** soma as produções calculadas. O campo legado **Saída** não é utilizado na regra atual.

## Proteção de dados e backup

O sistema usa três camadas complementares:

1. **Supabase** como banco principal, com RLS, validações e auditoria;
2. **Snapshot diário de recuperação mantido por 30 dias** no próprio banco;
3. **Backup externo JSON** para ser guardado fora do aparelho e fora do Supabase.

O formato atual é `xburguer-caixa-backup-v2` e inclui assinatura **SHA-256** dos registros. A restauração é bloqueada se a assinatura não conferir.

O backup externo é considerado **em dia** quando a última exportação verificada ocorreu há no máximo 7 dias.

O snapshot interno não substitui o backup externo. Para proteção contra perda do projeto inteiro do Supabase, manter cópia JSON em outro armazenamento, como OneDrive, Google Drive ou equivalente.

## Segurança da aplicação

- tabelas públicas usam RLS;
- a role `anon` não recebe acesso direto aos dados do sistema;
- operações críticas passam por validações/RPCs;
- fechamentos excluídos possuem recuperação protegida;
- a tela principal usa Content Security Policy;
- dependências críticas são fixadas/auditadas;
- o CI valida regras financeiras, PWA, isolamento, backup e segurança.

A chave `sb_publishable_...` usada no frontend é **publicável**. Chaves `service_role`, `sb_secret_...`, senhas, tokens privados, sessões e backups reais nunca devem ser adicionados ao repositório.

## Regra para futuras alterações

Alterações em cálculos financeiros devem partir de `business-rules.js` e ser acompanhadas por testes. Antes de mudar qualquer regra de negócio, leia também `MANUAL_ADMINISTRACAO_TRANSFERENCIA.md`, `ARCHITECTURE.md` e os testes existentes.
