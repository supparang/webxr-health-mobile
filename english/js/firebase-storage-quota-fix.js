// === /english/js/firebase-storage-quota-fix.js ===
// PATCH v20260424a-FIREBASE-STORAGE-QUOTA-FIX
// Prevent Firebase RTDB crash when localStorage quota is full.

(function () {
  'use strict';

  const VERSION = 'v20260424a-FIREBASE-STORAGE-QUOTA-FIX';

  function isQuotaError(err) {
    return (
      err &&
      (
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        String(err.message || '').toLowerCase().includes('quota')
      )
    );
  }

  function storageKeys() {
    try {
      return Object.keys(localStorage || {});
    } catch (err) {
      return [];
    }
  }

  function removeKey(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  function valueSize(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? v.length : 0;
    } catch (err) {
      return 0;
    }
  }

  function pruneStorage(reason) {
    const keys = storageKeys();

    // 1) Firebase websocket failure marker is safe to remove.
    keys.forEach((key) => {
      if (
        key === 'firebase:previous_websocket_failure' ||
        key.includes('previous_websocket_failure') ||
        key.includes('previous_websocket_failed')
      ) {
        removeKey(key);
      }
    });

    // 2) Remove large temporary/cache/history/log keys first.
    const removablePatterns = [
      /HISTORY/i,
      /CACHE/i,
      /DEBUG/i,
      /TEMP/i,
      /EVENTS/i,
      /QUEUE/i,
      /LOG/i,
      /LAST_ERROR/i,
      /TRACE/i,
      /^firebase:/i
    ];

    const keepPatterns = [
      /PROFILE/i,
      /STUDENT/i,
      /USER_PROFILE/i,
      /SETTINGS/i
    ];

    const candidates = storageKeys()
      .map((key) => ({ key, size: valueSize(key) }))
      .filter((x) => {
        const removable = removablePatterns.some((p) => p.test(x.key));
        const keep = keepPatterns.some((p) => p.test(x.key));
        return removable && !keep;
      })
      .sort((a, b) => b.size - a.size);

    // Remove only a reasonable number, largest first.
    candidates.slice(0, 40).forEach((x) => removeKey(x.key));

    try {
      console.warn('[FirebaseStorageQuotaFix] pruned storage:', reason, {
        version: VERSION,
        removedCandidates: candidates.slice(0, 40).map(x => x.key)
      });
    } catch (err) {}
  }

  function testStorage() {
    try {
      const key = '__quota_test__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      if (isQuotaError(err)) {
        pruneStorage('initial quota test failed');
      }
      return false;
    }
  }

  function patchSetItem() {
    try {
      if (Storage.prototype.__firebaseQuotaFixPatched) return;

      const nativeSetItem = Storage.prototype.setItem;

      Storage.prototype.setItem = function patchedSetItem(key, value) {
        try {
          return nativeSetItem.call(this, key, value);
        } catch (err) {
          if (!isQuotaError(err)) throw err;

          try {
            if (this === window.localStorage) {
              pruneStorage(`quota while setting ${String(key)}`);

              try {
                return nativeSetItem.call(this, key, value);
              } catch (err2) {
                // Firebase marker is non-critical. Swallow only this specific key.
                if (
                  String(key) === 'firebase:previous_websocket_failure' ||
                  String(key).includes('previous_websocket_failure')
                ) {
                  console.warn('[FirebaseStorageQuotaFix] ignored Firebase marker quota error');
                  return undefined;
                }

                throw err2;
              }
            }
          } catch (inner) {
            if (
              String(key) === 'firebase:previous_websocket_failure' ||
              String(key).includes('previous_websocket_failure')
            ) {
              console.warn('[FirebaseStorageQuotaFix] ignored Firebase marker quota error');
              return undefined;
            }

            throw inner;
          }

          throw err;
        }
      };

      Storage.prototype.__firebaseQuotaFixPatched = true;
    } catch (err) {
      console.warn('[FirebaseStorageQuotaFix] patch failed', err);
    }
  }

  pruneStorage('boot');
  patchSetItem();
  testStorage();

  window.FIREBASE_STORAGE_QUOTA_FIX = {
    version: VERSION,
    prune: pruneStorage,
    test: testStorage
  };

  console.log('[FirebaseStorageQuotaFix]', VERSION);
})();
