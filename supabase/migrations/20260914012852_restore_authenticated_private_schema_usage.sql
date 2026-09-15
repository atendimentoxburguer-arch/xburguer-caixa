-- Corrige o fluxo de salvamento dos fechamentos.
-- As políticas RLS e a RPC de fechamento chamam funções auxiliares no schema private.
-- O papel authenticated precisa de USAGE no schema para resolver essas funções,
-- enquanto as permissões EXECUTE continuam controladas função por função.

grant usage on schema private to authenticated;
revoke usage on schema private from anon;
