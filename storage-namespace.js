/* X-Burguer Caixa — isolamento total de localStorage/sessionStorage.
   Toda chave usada pelo Caixa passa a ser armazenada em namespace próprio. */
(function () {
  'use strict';

  const NS = 'xburguer_caixa::';
  const proto = Storage.prototype;
  const originalGet = proto.getItem;
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  const originalKey = proto.key;

  const legacyExact = new Map([
    ['xburguer_supabase_session_v1', ['xburguer_supabase_session_v1', 'xburguer_caixa_supabase_session_v1']],
    ['xburguer_draft_v2', ['xburguer_draft_v2', 'xburguer_caixa_draft_v2']],
    ['xburguer_last_backup', ['xburguer_last_backup', 'xburguer_caixa_last_backup']]
  ]);

  const legacyDraftPrefixes = ['xburguer_draft_v3:', 'xburguer_caixa_draft_v3:'];

  function physicalKey(key) {
    key = String(key);
    if (key.startsWith(NS)) return key;
    return NS + key;
  }

  function logicalKey(key) {
    if (key == null) return key;
    key = String(key);
    return key.startsWith(NS) ? key.slice(NS.length) : key;
  }

  function copyIfNeeded(store, sourceKey, targetKey) {
    const source = originalGet.call(store, sourceKey);
    if (source === null) return;
    if (originalGet.call(store, targetKey) === null) {
      originalSet.call(store, targetKey, source);
    }
    originalRemove.call(store, sourceKey);
  }

  function migrateStore(store) {
    try {
      for (const [logical, candidates] of legacyExact.entries()) {
        const target = physicalKey(logical);
        for (const candidate of candidates) {
          copyIfNeeded(store, candidate, target);
        }
      }

      const legacyDraftKeys = [];
      for (let i = 0; i < store.length; i++) {
        const key = originalKey.call(store, i);
        if (!key || key.startsWith(NS)) continue;
        if (legacyDraftPrefixes.some(prefix => key.startsWith(prefix))) {
          legacyDraftKeys.push(key);
        }
      }

      for (const oldKey of legacyDraftKeys) {
        let logical = oldKey;
        if (oldKey.startsWith('xburguer_caixa_draft_v3:')) {
          logical = 'xburguer_draft_v3:' + oldKey.slice('xburguer_caixa_draft_v3:'.length);
        }
        copyIfNeeded(store, oldKey, physicalKey(logical));
      }
    } catch (error) {
      console.warn('Caixa: não foi possível migrar o armazenamento local antigo.', error);
    }
  }

  migrateStore(localStorage);
  migrateStore(sessionStorage);

  proto.getItem = function (key) {
    return originalGet.call(this, physicalKey(key));
  };

  proto.setItem = function (key, value) {
    return originalSet.call(this, physicalKey(key), value);
  };

  proto.removeItem = function (key) {
    return originalRemove.call(this, physicalKey(key));
  };

  proto.key = function (index) {
    return logicalKey(originalKey.call(this, index));
  };

  // Nunca permite que um clear() executado pelo Caixa apague o storage do Consumo.
  proto.clear = function () {
    const remover = [];
    for (let i = 0; i < this.length; i++) {
      const key = originalKey.call(this, i);
      if (key && key.startsWith(NS)) remover.push(key);
    }
    remover.forEach(key => originalRemove.call(this, key));
  };
})();
