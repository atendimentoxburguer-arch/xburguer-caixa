# Manual de Administração e Transferência — X-Burguer Caixa

Este documento é a referência de passagem de responsabilidade do **X-Burguer Caixa** para outro administrador, desenvolvedor ou conta do ChatGPT.

> **Objetivo principal:** permitir que outra pessoa assuma o sistema sem depender da conta, conversa ou memória do responsável anterior.

## 1. Identificação do sistema

- Sistema: **X-Burguer Caixa**
- Repositório GitHub: `atendimentoxburguer-arch/xburguer-caixa`
- Branch de produção: `main`
- Versão funcional atual: **4.18.3**
- Página principal: `/xburguer-caixa/caixa.html?app=caixa`
- GitHub Pages: `/xburguer-caixa/`
- Banco principal: **Supabase — projeto XBurguer Caixa**
- Project ref do Supabase: `trnngxezppeembrvxkhh`
- Service Worker oficial: `service-worker.js`
- Cache oficial atual: `xburguer-caixa-native-v6-audit-4.18.3`

O projeto **X-Burguer Controle** é outro sistema. Não misturar arquivos, banco, PWA, cache ou configurações entre os dois projetos.

## 2. Regra financeira oficial — NÃO ALTERAR SEM DECISÃO EXPLÍCITA DO NEGÓCIO

A regra oficial do X-Burguer Caixa é:

### Venda oficial

`Venda = Dinheiro (Caixa) + Dinheiro (Entregas) + Cartão (Loja) + Cartão (Entregas) + Pix/Apps`

Essa soma corresponde ao **Resumo Financeiro / Formas de pagamento**.

### Vendas por Canal

Os canais — Hot, Mr. Burguer, WhatsApp, Mesa, Retirada e Entregas — são **somente demonstrativos operacionais**.

A soma das Vendas por Canal:

- não entra em `Total de Vendas`;
- não entra no Resultado;
- não é somada novamente no Dashboard;
- não substitui o Resumo Financeiro;
- não deve ser usada como faturamento oficial;
- deve continuar salva para mostrar quanto foi vendido por canal e quantos pedidos vieram de cada canal.

### Resultado

`Resultado = Venda oficial - Despesas`

### Ticket médio

O Dashboard utiliza a venda oficial dividida pela quantidade de pedidos registrada nos canais:

`Ticket médio = Venda oficial / total de pedidos`

### Conferência Resumo × Canais

A diferença entre o Resumo Financeiro e as Vendas por Canal é apenas **informativa/demonstrativa**. Ela não deve ser somada à receita e não deve transformar os canais em venda oficial.

## 3. Saldo inicial e dinheiro físico

O **Saldo Inicial** não é venda e não entra no faturamento.

Ele representa dinheiro físico que já estava no caixa no início do fechamento.

`Dinheiro previsto = Saldo Inicial + Dinheiro (Caixa) + Dinheiro (Entregas) - dinheiro retirado para despesas`

Quando houver contagem física:

`Diferença física = Dinheiro contado - Dinheiro previsto`

A partir de **24/08/2026**, a abertura segue a cadeia de fechamentos salvos dentro do mês:

- no dia 01, a abertura é manual;
- nos demais dias, havendo fechamento anterior no mesmo mês, a abertura é calculada automaticamente;
- dias sem fechamento podem ser pulados;
- o sistema usa o último fechamento anterior realmente salvo no mês;
- se o primeiro fechamento do mês ocorrer depois do dia 01 e não houver anterior, a abertura fica manual;
- alterações em fechamento anterior podem alterar a abertura do próximo fechamento salvo.

`Próxima abertura = máximo entre R$ 0,00 e o dinheiro previsto do fechamento anterior`

## 4. Despesas futuras e Dashboard mensal

O Dashboard mensal representa **o mês completo cadastrado**.

Despesas e lançamentos futuros pertencentes ao mesmo mês podem aparecer no Dashboard antes da data chegar, pois podem representar compromissos já planejados.

Não filtrar automaticamente datas futuras do mês apenas por serem futuras. Se algum dia for necessário mostrar somente o realizado até hoje, criar um indicador separado, como **Realizado até hoje**, sem alterar o total mensal planejado.

## 5. Controle de pães

O usuário informa:

- Estoque inicial;
- Estoque final.

O sistema calcula:

`Produção = Estoque inicial - Estoque final`

O acumulado mensal soma a produção calculada.

O campo legado de saída não participa da regra atual.

## 6. Estrutura principal do banco

Tabelas centrais:

- `cash_closings` — fechamento principal;
- `channel_sales` — canais demonstrativos e quantidade de pedidos;
- `expenses` — despesas vinculadas ao fechamento;
- `online_orders` — pedidos/plataformas online;
- `bread_controls` — controle de pães;
- `profiles` — perfis e permissões;
- `audit_logs` — auditoria;
- `backup_exports` — registro de backups externos;
- `cash_backup_snapshots` — snapshots internos de recuperação;
- `deleted_closing_recovery` — recuperação de fechamento excluído.

O banco usa RLS e validações. As tabelas filhas possuem relacionamentos com exclusão em cascata quando aplicável.

### Campos financeiros importantes de `cash_closings`

- `opening_balance`
- `cash_sales`
- `delivery_cash_sales`
- `store_card_sales`
- `delivery_card_sales`
- `pix_app_sales`
- `cash_withdrawn_for_expenses`
- `counted_cash`
- `expected_cash`
- `cash_difference`
- `total_sales`
- `total_expenses`
- `result`

A regra de banco deve manter:

`total_sales = cash_sales + delivery_cash_sales + store_card_sales + delivery_card_sales + pix_app_sales`

`result = total_sales - total_expenses`

As linhas de `channel_sales` são independentes desses totais financeiros.

## 7. Arquivos de código que merecem atenção

- `business-rules.js` — fonte canônica das regras de negócio;
- `business-rules-integration.js` — integração das regras canônicas com o app;
- `app1.js` — Supabase, sessão, persistência e utilitários principais;
- `app2.js`, `app3.js`, `app4.js`, `app5.js` — partes do fluxo, Dashboard, relatórios e funcionalidades legadas;
- `financial-integrity.js` — integridade financeira e compatibilidade;
- `financial-summary-separation.js` — garante separação entre financeiro e canais;
- `dashboard-financial.js` — regra financeira exibida no Dashboard;
- `bread-start-final.js` — regra inicial/final dos pães;
- `backup-protection.js` — proteção de backup e SHA-256;
- `realtime.js` — sincronização em tempo real;
- `system-hardening.js` e `data-consistency.js` — proteções adicionais;
- `service-worker.js` — PWA, cache e funcionamento offline.

Antes de alterar uma fórmula financeira, ler `business-rules.js` e os testes relacionados.

## 8. Backups e recuperação

O sistema possui três camadas principais:

1. **Supabase** — banco de produção;
2. **Snapshot interno** — recuperação rápida no próprio banco, mantido por janela definida pelo sistema;
3. **Backup externo JSON** — cópia que deve ficar fora do Supabase e, idealmente, fora do mesmo aparelho.

O formato atual de backup externo é `xburguer-caixa-backup-v2` e utiliza SHA-256 para detectar alteração/corrupção.

O sistema considera o backup externo em dia quando a última exportação verificada ocorreu há no máximo **7 dias**.

### Regra de manutenção

- snapshot interno não substitui backup externo;
- manter cópia JSON periódica fora do projeto Supabase;
- não editar manualmente um JSON de backup protegido;
- se a assinatura SHA-256 não conferir, a restauração deve ser bloqueada;
- antes de qualquer migração estrutural importante, gerar backup externo recente.

## 9. GitHub Actions e validação

Mudanças na `main` devem manter verdes os workflows de validação existentes, incluindo, quando presentes:

- Testes Funcionais X-Burguer Caixa;
- Validar X-Burguer Caixa;
- Validar Segurança X-Burguer Caixa;
- Validar Backup X-Burguer Caixa;
- Validar Isolamento E2E;
- CodeQL X-Burguer Caixa;
- GitHub Pages build/deployment.

Nunca considerar uma alteração crítica concluída se os testes financeiros ou E2E estiverem falhando.

Os testes E2E usam ambiente isolado e não devem gravar dados de teste no Supabase de produção.

## 10. Rotina de saúde recomendada

Quando alguém pedir **“verifique a saúde do X-Burguer Caixa”**, conferir pelo menos:

1. Supabase responde normalmente;
2. integridade de `cash_closings`;
3. `total_sales` igual ao Resumo Financeiro;
4. `result = total_sales - total_expenses`;
5. ausência de duplicidades do mesmo fechamento;
6. ausência de registros órfãos nas tabelas filhas;
7. cadeia automática de saldo inicial;
8. snapshots recentes;
9. backup externo dentro da janela de 7 dias;
10. workflows/checks recentes do GitHub;
11. GitHub Pages publicado com sucesso;
12. logs relevantes de falha de salvamento, backup, autenticação ou sincronização.

### Política de alerta

Se a solicitação for para notificar **somente quando houver problema**, não enviar alerta quando tudo estiver saudável.

Alertar quando houver, por exemplo:

- erro matemático;
- dado inconsistente;
- backup atrasado;
- snapshot ausente/antigo;
- workflow quebrado;
- deploy falhando;
- erro relevante de Supabase;
- falha de segurança;
- registro órfão ou duplicado;
- risco claro de perda de dados.

## 11. Segurança

Nunca colocar no repositório:

- senha de usuário;
- token pessoal do GitHub;
- chave `service_role`;
- chave `sb_secret_...`;
- credenciais privadas;
- backup real contendo dados da operação;
- cookies ou tokens de sessão.

A chave publicável do Supabase usada no frontend não deve ser confundida com uma chave secreta.

Na transferência para outro responsável, prefira sempre **transferir acesso/propriedade** em vez de compartilhar a senha da conta antiga.

## 12. Procedimento de transferência para outro responsável

### GitHub

1. Nova pessoa cria a conta GitHub própria.
2. Adicionar a nova conta com acesso administrativo ou transferir o repositório para uma organização/conta da empresa.
3. Confirmar acesso à branch `main`.
4. Confirmar acesso aos GitHub Actions.
5. Confirmar GitHub Pages.
6. Confirmar configurações necessárias ao deploy.
7. Só remover o administrador antigo depois da validação completa.

### Supabase

1. Nova pessoa cria a conta Supabase própria.
2. Adicionar a nova conta à organização/projeto com permissão adequada ou transferir o projeto para uma organização da empresa.
3. Confirmar acesso ao projeto `trnngxezppeembrvxkhh`.
4. Confirmar tabelas, Authentication, SQL, logs e configurações necessárias.
5. Confirmar que o frontend continua conectado ao mesmo projeto.
6. Confirmar um fechamento de teste controlado ou uma leitura segura antes de remover o acesso antigo.

### ChatGPT

A nova conta do ChatGPT não herda automaticamente a memória desta conversa.

Para trabalhar de forma equivalente:

1. conectar/autorizar o GitHub da nova pessoa no ChatGPT;
2. conectar/autorizar o Supabase quando a integração estiver disponível para a conta;
3. pedir ao ChatGPT para ler este arquivo, o `README.md`, `ARCHITECTURE.md`, `business-rules.js` e os testes antes de alterar regras;
4. nunca fornecer senhas ou chaves secretas no chat;
5. conferir os workflows depois de qualquer alteração crítica.

## 13. Prompt recomendado para o novo ChatGPT

Copiar e usar como mensagem inicial quando o novo responsável começar a administrar o sistema:

> Você vai administrar o sistema X-Burguer Caixa. Antes de alterar qualquer coisa, leia `MANUAL_ADMINISTRACAO_TRANSFERENCIA.md`, `README.md`, `ARCHITECTURE.md`, `business-rules.js` e os testes do repositório. A regra mais importante é: Venda oficial vem exclusivamente do Resumo Financeiro/Formas de pagamento. Vendas por Canal são apenas demonstrativas e nunca devem ser somadas novamente à receita. Resultado = Venda oficial - Despesas. Preserve os dados históricos, não exponha segredos, confira Supabase e GitHub antes de mudanças críticas e execute/valide os workflows após alterações. Se houver conflito entre documentação antiga e `business-rules.js`, investigue e corrija a documentação antes de mudar a regra de negócio.

## 14. Checklist antes de remover o administrador antigo

- [ ] novo responsável entra no GitHub;
- [ ] consegue visualizar e editar o repositório;
- [ ] consegue acompanhar GitHub Actions;
- [ ] GitHub Pages continua online;
- [ ] novo responsável entra no Supabase;
- [ ] consegue consultar o banco;
- [ ] consegue consultar logs;
- [ ] consegue conferir backups/snapshots;
- [ ] consegue usar o ChatGPT com o GitHub autorizado;
- [ ] leu este manual;
- [ ] confirmou a regra financeira oficial;
- [ ] foi gerado um backup externo recente antes da transferência final;
- [ ] acessos antigos só são removidos depois de todos os itens acima.

## 15. Princípio de manutenção

**Não corrigir dados válidos só para fazer Vendas por Canal coincidirem com o Resumo Financeiro.**

Eles representam visões diferentes:

- Resumo Financeiro = valor oficial das vendas/recebimentos usado nos totais financeiros;
- Canais = distribuição demonstrativa da operação.

A diferença entre eles pode ser exibida para conferência, mas nunca deve provocar dupla contabilização da receita.
