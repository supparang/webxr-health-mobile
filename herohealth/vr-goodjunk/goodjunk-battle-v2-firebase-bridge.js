/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle-v2-firebase-bridge.js
 * GoodJunk Battle v2 Firebase Bridge
 * VERSION: v2.4.27-firebase-bridge-hotfix-auth-path
 *
 * HOTFIX v2.4.27
 * - Fix DB path ให้ตรงกับ Firebase Rules:
 *   primary:  herohealth/goodjunk/battleV2Rooms/{roomId}
 *   fallback: hha-battle/goodjunk/battleV2Rooms/{roomId}
 *
 * - Ensure Firebase Anonymous Auth ก่อน read/write
 *   เพราะ rules ใช้ auth != null
 *
 * ต้องโหลดก่อน:
 * - goodjunk-battle-v2-core.js
 * - script หลักใน goodjunk-battle-v2-lobby.html
 *
 * ต้องมี Firebase compat scripts ก่อน bridge ถ้าโปรเจกต์ยังไม่ได้โหลด:
 * - firebase-app-compat.js
 * - firebase-auth-compat.js
 * - firebase-database-compat.js
 * - firebase.initializeApp(...)
 * ========================================================= */

(function GoodJunkBattleFirebaseBridge(){
  'use strict';

  const VERSION = 'v2.4.27-firebase-bridge-hotfix-auth-path';

  /*
   * Path ที่ตรงกับ Firebase Rules ของคุณ
   */
  const PRIMARY_ROOM_PATH = 'herohealth/goodjunk/battleV2Rooms';
  const FALLBACK_ROOM_PATH = 'hha-battle/goodjunk/battleV2Rooms';

  const state = {
    ready: false,
    authReady: false,
    dbReady: false,
    source: 'none',
    authSource: 'none',
    uid: '',
    db: null,
    checkedAt: 0,
    lastError: '',
    roomPath: PRIMARY_ROOM_PATH
  };

  function now(){
    return Date.now();
  }

  function qs(sel, root){
    return (root || document).querySelector(sel);
  }

  function log(){
    try{
      console.info.apply(
        console,
        ['[GJ Battle Firebase Bridge]'].concat(Array.from(arguments))
      );
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(
        console,
        ['[GJ Battle Firebase Bridge]'].concat(Array.from(arguments))
      );
    }catch(e){}
  }

  function hasRefApi(db){
    return !!(db && typeof db.ref === 'function');
  }

  function hasAuthApi(){
    return !!(
      window.firebase &&
      typeof window.firebase.auth === 'function'
    );
  }

  function normalizeRoomCode(roomCode){
    return String(roomCode || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '');
  }

  function detectDb(){
    /*
      1) ถ้ามี GJ_DB อยู่แล้ว ใช้ตัวนี้ก่อน
    */
    if (hasRefApi(window.GJ_DB)){
      return {
        db: window.GJ_DB,
        source: 'window.GJ_DB'
      };
    }

    /*
      2) โปรเจกต์เดิมอาจใช้ window.db
    */
    if (hasRefApi(window.db)){
      return {
        db: window.db,
        source: 'window.db'
      };
    }

    /*
      3) บางไฟล์อาจใช้ window.database หรือ window.firebaseDb
    */
    if (hasRefApi(window.database)){
      return {
        db: window.database,
        source: 'window.database'
      };
    }

    if (hasRefApi(window.firebaseDb)){
      return {
        db: window.firebaseDb,
        source: 'window.firebaseDb'
      };
    }

    /*
      4) Firebase compat SDK
         เช่น firebase-app-compat.js + firebase-database-compat.js
    */
    try{
      if (
        window.firebase &&
        typeof window.firebase.database === 'function'
      ){
        const db = window.firebase.database();

        if (hasRefApi(db)){
          return {
            db: db,
            source: 'firebase.database()'
          };
        }
      }
    }catch(err){
      warn('firebase.database() detect failed', err);
      state.lastError = String(err && err.message || err);
    }

    return {
      db: null,
      source: 'none'
    };
  }

  async function ensureAuth(){
    /*
     * Firebase Rules ของคุณใช้ auth != null
     * ดังนั้น Battle ต้อง login อย่างน้อย anonymous ก่อนใช้ RTDB
     */
    if (!hasAuthApi()){
      state.authReady = false;
      state.authSource = 'no-firebase-auth';
      state.uid = '';
      state.lastError = 'Firebase Auth compat is not loaded. Need firebase-auth-compat.js';
      warn(state.lastError);
      return false;
    }

    try{
      const auth = window.firebase.auth();

      if (auth.currentUser){
        state.authReady = true;
        state.authSource = 'existing-user';
        state.uid = auth.currentUser.uid || '';
        return true;
      }

      const credential = await auth.signInAnonymously();

      const user =
        credential && credential.user
          ? credential.user
          : auth.currentUser;

      state.authReady = !!user;
      state.authSource = state.authReady ? 'anonymous' : 'anonymous-failed';
      state.uid = user && user.uid ? user.uid : '';

      if (state.authReady){
        log('Auth ready uid=', state.uid);
      }else{
        warn('Anonymous auth returned no user.');
      }

      return state.authReady;
    }catch(err){
      state.authReady = false;
      state.authSource = 'anonymous-error';
      state.uid = '';
      state.lastError = String(err && err.message || err);

      warn('anonymous auth failed', err);
      return false;
    }
  }

  function setBridgeState(result){
    const dbReady = hasRefApi(result.db);
    const ready = dbReady && !!state.authReady;

    state.db = dbReady ? result.db : null;
    state.dbReady = dbReady;
    state.ready = ready;
    state.source = result.source || 'none';
    state.checkedAt = now();

    window.GJ_DB = dbReady ? result.db : null;

    /*
      alias ให้โค้ดหลายรุ่นใช้ร่วมกันได้
    */
    if (dbReady){
      window.db = window.db || result.db;
      window.database = window.database || result.db;
      window.firebaseDb = window.firebaseDb || result.db;
    }

    window.GJ_BATTLE_DB_READY = ready;
    window.GJ_BATTLE_DB_SOURCE = state.source;
    window.GJ_BATTLE_AUTH_READY = !!state.authReady;
    window.GJ_BATTLE_AUTH_SOURCE = state.authSource;
    window.GJ_BATTLE_AUTH_UID = state.uid || '';

    window.GJ_BATTLE_ROOM_PATH = state.roomPath;
    window.GJ_BATTLE_ROOM_PATH_PRIMARY = PRIMARY_ROOM_PATH;
    window.GJ_BATTLE_ROOM_PATH_FALLBACK = FALLBACK_ROOM_PATH;

    window.GJ_BATTLE_FIREBASE_BRIDGE = {
      version: VERSION,

      ready: ready,
      authReady: !!state.authReady,
      dbReady: dbReady,

      source: state.source,
      authSource: state.authSource,
      uid: state.uid || '',

      db: dbReady ? result.db : null,
      checkedAt: state.checkedAt,
      lastError: state.lastError || '',

      roomPath: state.roomPath,
      primaryRoomPath: PRIMARY_ROOM_PATH,
      fallbackRoomPath: FALLBACK_ROOM_PATH,

      detect: refresh,
      refresh: refresh,
      ensureAuth: ensureAuth,

      getDb: function(){
        const r = detectDb();

        if (hasRefApi(r.db)){
          setBridgeState(r);
        }

        return window.GJ_DB || null;
      },

      isReady: function(){
        return !!window.GJ_BATTLE_DB_READY;
      },

      isAuthReady: function(){
        return !!window.GJ_BATTLE_AUTH_READY;
      },

      getUid: function(){
        return window.GJ_BATTLE_AUTH_UID || '';
      },

      setRoomPath: function(path){
        const p = String(path || '').trim().replace(/^\/+|\/+$/g, '');

        if (p){
          state.roomPath = p;
          window.GJ_BATTLE_ROOM_PATH = p;
          log('roomPath set to', p);
        }

        return state.roomPath;
      },

      getRoomPath: function(){
        return state.roomPath || PRIMARY_ROOM_PATH;
      },

      getRoomRef: function(roomCode){
        const db = window.GJ_DB || this.getDb();
        const code = normalizeRoomCode(roomCode);

        if (!db || !code || typeof db.ref !== 'function'){
          return null;
        }

        return db.ref((state.roomPath || PRIMARY_ROOM_PATH) + '/' + code);
      },

      getPrimaryRoomRef: function(roomCode){
        const db = window.GJ_DB || this.getDb();
        const code = normalizeRoomCode(roomCode);

        if (!db || !code || typeof db.ref !== 'function'){
          return null;
        }

        return db.ref(PRIMARY_ROOM_PATH + '/' + code);
      },

      getFallbackRoomRef: function(roomCode){
        const db = window.GJ_DB || this.getDb();
        const code = normalizeRoomCode(roomCode);

        if (!db || !code || typeof db.ref !== 'function'){
          return null;
        }

        return db.ref(FALLBACK_ROOM_PATH + '/' + code);
      },

      /*
       * ใช้สำหรับ debug ว่า path อ่านได้ไหม
       */
      testRoomRead: async function(roomCode){
        const ref = this.getRoomRef(roomCode);

        if (!ref || typeof ref.once !== 'function'){
          return {
            ok: false,
            reason: 'no-room-ref',
            path: state.roomPath,
            roomCode: normalizeRoomCode(roomCode)
          };
        }

        try{
          const snap = await ref.once('value');

          return {
            ok: true,
            exists: snap.exists ? snap.exists() : !!snap.val(),
            value: snap.val ? snap.val() : null,
            path: state.roomPath,
            roomCode: normalizeRoomCode(roomCode)
          };
        }catch(err){
          return {
            ok: false,
            reason: String(err && err.message || err),
            path: state.roomPath,
            roomCode: normalizeRoomCode(roomCode)
          };
        }
      }
    };

    document.documentElement.classList.toggle('gj-db-ready', ready);
    document.documentElement.classList.toggle('gj-db-offline', !ready);
    document.documentElement.classList.toggle('gj-auth-ready', !!state.authReady);
    document.documentElement.classList.toggle('gj-auth-offline', !state.authReady);

    window.dispatchEvent(new CustomEvent('gj:battle-db-ready', {
      detail: {
        ready: ready,
        dbReady: dbReady,
        authReady: !!state.authReady,
        source: state.source,
        authSource: state.authSource,
        uid: state.uid || '',
        roomPath: state.roomPath,
        version: VERSION,
        checkedAt: state.checkedAt,
        lastError: state.lastError || ''
      }
    }));

    if (ready){
      log('DB ready from', state.source, 'auth=', state.authSource, 'path=', state.roomPath);
    }else{
      warn(
        'DB not ready.',
        'dbReady=', dbReady,
        'authReady=', state.authReady,
        'source=', state.source,
        'auth=', state.authSource,
        'error=', state.lastError
      );
    }
  }

  function refresh(){
    const result = detectDb();
    setBridgeState(result);
    return result;
  }

  async function refreshAsync(){
    await ensureAuth();
    return refresh();
  }

  function showDbBadge(){
    let badge = qs('#gjBattleDbBadge');

    if (!badge){
      badge = document.createElement('div');
      badge.id = 'gjBattleDbBadge';
      badge.className = 'gj-battle-db-badge';
      document.body.appendChild(badge);
    }

    const ready = !!window.GJ_BATTLE_DB_READY;
    const authReady = !!window.GJ_BATTLE_AUTH_READY;
    const dbReady = !!state.dbReady;
    const source = window.GJ_BATTLE_DB_SOURCE || 'none';
    const authSource = window.GJ_BATTLE_AUTH_SOURCE || 'none';

    if (ready){
      badge.textContent = 'DB ready';
    }else if (!authReady && dbReady){
      badge.textContent = 'Auth needed';
    }else if (authReady && !dbReady){
      badge.textContent = 'DB missing';
    }else{
      badge.textContent = 'DB offline/local';
    }

    badge.title =
      'GoodJunk Battle DB\n' +
      'ready: ' + ready + '\n' +
      'dbReady: ' + dbReady + '\n' +
      'authReady: ' + authReady + '\n' +
      'db source: ' + source + '\n' +
      'auth source: ' + authSource + '\n' +
      'uid: ' + (state.uid || '-') + '\n' +
      'path: ' + (state.roomPath || '-') + '\n' +
      'error: ' + (state.lastError || '-');

    badge.classList.toggle('ready', ready);
    badge.classList.toggle('offline', !ready);
  }

  function injectCSS(){
    if (qs('#gjBattleFirebaseBridgeCSS')) return;

    const css = document.createElement('style');
    css.id = 'gjBattleFirebaseBridgeCSS';
    css.textContent = `
      .gj-battle-db-badge {
        position: fixed !important;
        left: 8px !important;
        top: max(8px, env(safe-area-inset-top)) !important;
        z-index: 100004 !important;

        padding: 5px 9px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(255, 200, 110, .86) !important;
        background: rgba(255, 255, 255, .78) !important;
        color: #7b421e !important;

        font-size: 10px !important;
        font-weight: 1000 !important;
        pointer-events: none !important;
        opacity: .68 !important;
        box-shadow: 0 6px 16px rgba(70, 35, 12, .12) !important;
      }

      .gj-battle-db-badge.ready {
        border-color: rgba(90, 210, 120, .85) !important;
        color: #246a35 !important;
      }

      .gj-battle-db-badge.offline {
        border-color: rgba(255, 120, 90, .9) !important;
        color: #8d2918 !important;
      }

      @media (max-width: 760px) {
        .gj-battle-db-badge {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(css);
  }

  function exposeEarly(){
    /*
     * เผื่อ script อื่นเรียกก่อน boot เสร็จ
     */
    window.GJ_BATTLE_FIREBASE_BRIDGE = {
      version: VERSION,
      ready: false,
      authReady: false,
      dbReady: false,
      source: 'booting',
      authSource: 'booting',
      uid: '',
      roomPath: PRIMARY_ROOM_PATH,
      primaryRoomPath: PRIMARY_ROOM_PATH,
      fallbackRoomPath: FALLBACK_ROOM_PATH,
      ensureAuth: ensureAuth,
      detect: refresh,
      refresh: refresh,
      getDb: function(){
        const r = detectDb();
        if (hasRefApi(r.db)){
          setBridgeState(r);
        }
        return window.GJ_DB || null;
      },
      isReady: function(){
        return !!window.GJ_BATTLE_DB_READY;
      },
      getRoomRef: function(roomCode){
        const db = window.GJ_DB || this.getDb();
        const code = normalizeRoomCode(roomCode);
        if (!db || !code || typeof db.ref !== 'function') return null;
        return db.ref((state.roomPath || PRIMARY_ROOM_PATH) + '/' + code);
      }
    };
  }

  async function boot(){
    injectCSS();
    exposeEarly();

    /*
     * สำคัญ:
     * ต้อง auth ก่อน เพราะ rules ใช้ auth != null
     */
    await refreshAsync();
    showDbBadge();

    /*
      บางหน้าโหลด Firebase ช้ากว่า bridge
      จึงเช็กซ้ำหลายจังหวะ
    */
    setTimeout(async function(){
      await refreshAsync();
      showDbBadge();
    }, 300);

    setTimeout(async function(){
      await refreshAsync();
      showDbBadge();
    }, 1000);

    setTimeout(async function(){
      await refreshAsync();
      showDbBadge();
    }, 2500);

    setInterval(async function(){
      await refreshAsync();
      showDbBadge();
    }, 5000);

    console.info('[GJ Battle Firebase Bridge]', VERSION, 'loaded', {
      primaryRoomPath: PRIMARY_ROOM_PATH,
      fallbackRoomPath: FALLBACK_ROOM_PATH,
      ready: window.GJ_BATTLE_DB_READY,
      authReady: window.GJ_BATTLE_AUTH_READY,
      uid: window.GJ_BATTLE_AUTH_UID || ''
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  }else{
    boot();
  }
})();
