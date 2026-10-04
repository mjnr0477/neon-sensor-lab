(function () {
  'use strict';

  const DB_NAME = 'neon-sensor-lab';
  const DB_VERSION = 1;
  const STORE = 'research-sessions';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, {
            keyPath: 'id'
          });

          store.createIndex('endedAt', 'endedAt');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function save(session) {
    if (!session) return false;

    try {
      const db = await openDatabase();

      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite');

        transaction.objectStore(STORE).put({
          id: session.id || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ...session
        });

        transaction.oncomplete = () => {
          db.close();
          resolve(true);
        };

        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.warn('IndexedDB session save failed:', error);
      return false;
    }
  }

  async function list(limit = 50) {
    try {
      const db = await openDatabase();

      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly')
          .objectStore(STORE)
          .index('endedAt')
          .openCursor(null, 'prev');

        const rows = [];

        request.onsuccess = () => {
          const cursor = request.result;

          if (!cursor || rows.length >= limit) {
            db.close();
            resolve(rows);
            return;
          }

          rows.push(cursor.value);
          cursor.continue();
        };

        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      });
    } catch (error) {
      console.warn('IndexedDB session list failed:', error);
      return [];
    }
  }

  async function clear() {
    try {
      const db = await openDatabase();

      await new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readwrite')
          .objectStore(STORE)
          .clear();

        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });

      db.close();
      return true;
    } catch (error) {
      console.warn('IndexedDB session clear failed:', error);
      return false;
    }
  }

  window.NeonSessionStore = {
    save,
    list,
    clear
  };
})();