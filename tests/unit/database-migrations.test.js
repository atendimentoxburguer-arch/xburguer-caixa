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

test('histórico de migrações usa versões UTC completas e preserva a linha de produção', () => {
  const dir = path.join(__dirname, '..', '..', 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
  for (const name of files) {
    assert.match(name, /^\d{14}_[a-z0-9_]+\.sql$/, `migração com nome fora do padrão: ${name}`);
  }

  const requiredVersions = [
    '20260819234250','20260819234310','20260819234546','20260819234724',
    '20260819234801','20260819235622','20260820000926','20260820014533',
    '20260821202601','20260821202621','20260821204823','20260822015447',
    '20260822222221','20260822231922','20260822235516','20260823001334',
    '20260823001755','20260823004523','20260823005731','20260823013723',
    '20260823224531','20260823225632','20260823230732','20260823230807',
    '20260823231300','20260823231702','20260823231920','20260823232150',
    '20260824005437','20260824010054','20260825231109','20260826001341',
    '20260826235550','20260828202603','20260913223101','20260913223443',
    '20260913223722','20260913223743','20260914000908','20260914012852',
    '20260916020339','20260916021431'
  ];
  const present = new Set(files.map(name => name.slice(0, 14)));
  for (const version of requiredVersions) {
    assert.ok(present.has(version), `migração de produção ausente no repositório: ${version}`);
  }
});
