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
- backup JSON protegido por SHA-256 e restauração atômica;
- registro das exportações de backup no Supabase;
- snapshot diário de recuperação mantido por 30 dias;
- modo offline seguro;
- PWA instalável e layout responsivo.

## Proteção de dados e backup

O sistema usa três camadas complementares de proteção:

1. **Supabase** como banco principal, com RLS, validações e auditoria de alterações.
2. **Snapshot diário de recuperação** no próprio banco, atualizado depois de gravações críticas e mantido por 30 dias.
3. **Backup externo JSON** para ser guardado fora do aparelho e fora do Supabase.

O backup externo atual usa o formato `xburguer-caixa-backup-v2`, informa a quantidade de fechamentos e inclui uma assinatura **SHA-256** dos registros. Antes de restaurar um backup protegido, o aplicativo recalcula a assinatura e bloqueia a restauração se o arquivo estiver corrompido ou alterado.

O snapshot interno também possui contagem de registros e assinatura SHA-256 do payload. A lixeira de emergência verifica a assinatura antes de aceitar uma restauração de fechamento excluído.

O aplicativo considera o backup externo **em dia** quando a última exportação verificada ocorreu há no máximo 7 dias. Backups antigos continuam compatíveis, mas são identificados como arquivos sem assinatura SHA-256.

O snapshot interno é uma segunda rede de segurança e não substitui a cópia externa. Para proteção contra perda do projeto inteiro do Supabase, é necessário manter regularmente o arquivo JSON em outro local, como OneDrive, Google Drive ou outro armazenamento externo.

## Segurança da aplicação

- todas as tabelas públicas usam RLS;
- a role `anon` não possui privilégios diretos nas tabelas do sistema;
- usuários autenticados não recebem privilégios SQL de `TRUNCATE`, `TRIGGER` ou `REFERENCES`;
- a exclusão de fechamentos passa pelo RPC `delete_cash_closing`, com validação de usuário ativo e administrador;
- fechamentos excluídos são preservados em recuperação com SHA-256;
- a tela principal usa Content Security Policy para limitar scripts, conexões, frames, objetos e outros recursos;
- a biblioteca Supabase JS usada pelo Realtime fica fixada em uma versão auditada, evitando atualização silenciosa por alias móvel;
- o bootstrap da página inicial não utiliza JavaScript inline;
- o CI possui uma validação específica para impedir regressões nas proteções acima e procurar padrões de credenciais privadas no código de runtime.

A chave `sb_publishable_...` presente no frontend é uma **chave publicável do Supabase**. Chaves `service_role`, `sb_secret_...`, senhas, tokens privados e backups reais não devem ser adicionados ao repositório.

## Regra atual do controle de pães

O usuário informa **Estoque inicial** e **Estoque final**. O sistema calcula automaticamente:

`Produção = Estoque inicial - Estoque final`

O **Acumulado do mês** soma as produções calculadas no mês. O campo legado **Saída** não é utilizado.

## Regras financeiras atuais

O **Total de Vendas Geral** do Resumo financeiro é independente do total de **Vendas por canal** e soma os valores do próprio bloco financeiro, incluindo o saldo inicial.

A partir de **24/08/2026**, o **Saldo Inicial** segue uma cadeia diária dentro de cada mês:

- no **dia 01**, o Saldo Inicial é informado manualmente, iniciando o novo mês;
- nos demais dias, o campo é calculado automaticamente e fica bloqueado para edição;
- o cálculo usa exatamente o fechamento do dia anterior;
- se o fechamento do dia anterior ainda não existir, o próximo dia não pode ser salvo até que a sequência seja completada;
- o histórico anterior à implantação da regra não é recalculado automaticamente.

`Saldo Inicial do dia = máximo de R$ 0,00 entre (Saldo Inicial anterior + Dinheiro do Caixa anterior + Dinheiro das Entregas anterior - dinheiro retirado para despesas no dia anterior)`

A conferência física da gaveta continua usando uma regra separada:

`Dinheiro previsto = Dinheiro (Caixa) + Dinheiro (Entregas) - retiradas para despesas`

O saldo inicial não entra na conferência física da gaveta.
