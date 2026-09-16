-- X-Burguer Caixa — hardening de menor privilégio.
-- A função abaixo é usada somente como trigger interno do Postgres.
-- Usuários da aplicação e anon não precisam nem devem executá-la diretamente.

revoke all on function private.xb_enforce_financial_totals() from public;
revoke all on function private.xb_enforce_financial_totals() from anon;
revoke all on function private.xb_enforce_financial_totals() from authenticated;
