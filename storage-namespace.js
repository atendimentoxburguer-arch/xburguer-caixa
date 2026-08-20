/* X-Burguer Caixa — isolamento de localStorage/sessionStorage
   Mantém compatibilidade com as chaves antigas usadas pelo app,
   mas grava fisicamente tudo com prefixo exclusivo do Caixa. */
(function () {
  'use strict';

  const proto = Storage.prototype;
  const originalGet = proto.getItem;
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  const originalKey = proto.key;

  const exact = new Map([
    ['xburguer_supabase_session_v1', 'xburguer_caixa_supabase_session_v1'],
    ['xburguer_draft_v2', 'xburguer_caixa_draft_v2'],
    ['xburguer_last_backup', 'xburguer_caixa_last_backup']
  ]);

  const oldDraftPrefix = 'xburguer_draft_v3:';
  const newDraftPrefix = 'xburguer_caixa_draft_v3:';

  function physicalKey(key) {
    key = String(key);
    if (exact.has(key)) return exact.get(key);
    if (key.startsWith(oldDraftPrefix)) {
      return newDraftPrefix + key.slice(oldDraftPrefix.length);
    }
    return key;
  }

  function logicalKey(key) {
    if (key == null) return key;
    key = String(key);
    for (const [logical, physical] of exact.entries()) {
      if (key === physical) return logical;
    }
    if (key.startsWith(newDraftPrefix)) {
      return oldDraftPrefix + key.slice(newDraftPrefix.length);
    }
    return key;
  }

  function migrateStore(store) {
    try {
      for (const [logical, physical] of exact.entries()) {
        const oldValue = originalGet.call(store, logical);
        const newValue = originalGet.call(store, physical);
        if (oldValue !== null && newValue === null) {
          originalSet.call(store, physical, oldValue);
        }
        if (oldValue !== null) originalRemove.call(store, logical);
      }

      const draftKeys = [];
      for (let i = 0; i < store.length; i++) {
        const key = originalKey.call(store, i);
        if (key && key.startsWith(oldDraftPrefix)) draftKeys.push(key);
      }

      for (const oldKey of draftKeys) {
        const physical = physicalKey(oldKey);
        const oldValue = originalGet.call(store, oldKey);
        const newValue = originalGet.call(store, physical);
        if (oldValue !== null && newValue === null) {
          originalSet.call(store, physical, oldValue);
        }
        originalRemove.call(store, oldKey);
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
})();
