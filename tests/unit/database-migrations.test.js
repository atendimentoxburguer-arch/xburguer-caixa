const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function migration(name){
  return fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', name), 'utf8');
}

test('função interna de totais não fica executável pelo cliente', () => {
  const sql = migration('20260916020339_revoke_trigger_function_execute.sql');
  assert.match(sql, /revoke all on function private\.xb_enforce_financial_totals\(\) from public/i);
  assert.match(sql, /from anon/i);
  assert.match(sql, /from authenticated/i);
});

test('restauração de fechamento preserva caixa e turno originais', () => {
  const sql = migration('20260916021431_preserve_register_shift_on_deleted_restore.sql');
  assert.match(sql, /'register_name'\s*,\s*coalesce\(nullif\(v_closing->>'register_name'/i);
  assert.match(sql, /'shift_name'\s*,\s*coalesce\(nullif\(v_closing->>'shift_name'/i);
  assert.match(sql, /public\.save_cash_closing\(v_record\)/i);
});
