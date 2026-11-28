/* IndexedDB asset store. Existing project metadata remains backward-compatible in LocalStorage. */
(function (global) {
  'use strict';
  const DB_NAME = 'mangaflow-ai-assets';
  const DB_VERSION = 1;
  const STORE = 'assets';
  let opening;
  function open() {
    if (!('indexedDB' in global)) return Promise.reject(new Error('IndexedDB is not supported in this browser.'));
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { opening = null; reject(req.error || new Error('Could not open asset storage.')); };
      req.onblocked = () => { opening = null; reject(new Error('Asset storage upgrade is blocked by another open tab.')); };
    });
    return opening;
  }
  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try { result = action(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result && result.result);
      tx.onerror = () => reject(tx.error || new Error('Asset storage transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('Asset storage transaction was cancelled.'));
    });
  }
  global.MangaFlowStorage = {
    putAsset: async function (asset) {
      if (!asset || !asset.id || !asset.blob) throw new Error('Asset requires an id and a Blob or File.');
      const record = {
        id: String(asset.id), projectId: String(asset.projectId || 'default'),
        type: String(asset.type || asset.blob.type || 'application/octet-stream'),
        name: String(asset.name || 'asset'), blob: asset.blob,
        createdAt: asset.createdAt || new Date().toISOString(),
        metadata: asset.metadata || {}
      };
      await transaction('readwrite', store => store.put(record));
      return record.id;
    },
    getAsset: id => transaction('readonly', store => store.get(String(id))),
    deleteAsset: id => transaction('readwrite', store => store.delete(String(id))),
    listAssets: projectId => transaction('readonly', store => {
      const index = store.index('projectId');
      return index.getAll(String(projectId || 'default'));
    }),
    clearProjectAssets: projectId => transaction('readwrite', store => {
      const req = store.index('projectId').openCursor(IDBKeyRange.only(String(projectId || 'default')));
      req.onsuccess = () => { const cursor = req.result; if (cursor) { cursor.delete(); cursor.continue(); } };
      return req;
    })
  };
})(window);
