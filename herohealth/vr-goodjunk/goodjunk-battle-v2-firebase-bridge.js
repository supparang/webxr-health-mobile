/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle-v2-firebase-bridge.js
 * GoodJunk Battle v2 Firebase Bridge
 * VERSION: v2.4.26-firebase-bridge-final
 *
 * ใช้ก่อน:
 * - goodjunk-battle-v2-core.js
 * - script หลักใน goodjunk-battle-v2-lobby.html
 *
 * หน้าที่:
 * - ตรวจว่า Firebase Realtime Database พร้อมใช้หรือยัง
 * - map window.db / window.database / window.firebaseDb → window.GJ_DB
 * - รองรับ Firebase compat: firebase.database()
 * - ถ้าไม่มี DB จะไม่ทำให้เกมพัง แต่บอกชัดว่า offline/local
 * - สร้าง helper getRoomRef(roomCode)
 * ========================================================= */

(function GoodJunkBattleFirebaseBridge(){
  'use strict';

  const VERSION = 'v2.4.26-firebase-bridge-final';

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
    }

    return {
      db: null,
      source: 'none'
    };
  }

  function setBridgeState(result){
    const ready = hasRefApi(result.db);

    window.GJ_DB = ready ? result.db : null;

    /*
      alias ให้โค้ดหลายรุ่นใช้ร่วมกันได้
    */
    if (ready){
      window.db = window.db || result.db;
      window.database = window.database || result.db;
      window.firebaseDb = window.firebaseDb || result.db;
    }

    window.GJ_BATTLE_DB_READY = ready;
    window.GJ_BATTLE_DB_SOURCE = result.source || 'none';

    window.GJ_BATTLE_FIREBASE_BRIDGE = {
      version: VERSION,

      ready: ready,
      source: result.source || 'none',
      db: ready ? result.db : null,
      checkedAt: now(),

      detect: refresh,

      getDb: function(){
        const r = detectDb();

        if (hasRefApi(r.db)){
          setBridgeState(r);
        }

        return window.GJ_DB || null;
      },

      getRoomRef: function(roomCode){
        const db = window.GJ_DB || this.getDb();

        if (!db || !roomCode || typeof db.ref !== 'function'){
          return null;
        }

        return db.ref('goodjunk_battle_rooms/' + String(roomCode).trim().toUpperCase());
      },

      isReady: function(){
        return !!window.GJ_BATTLE_DB_READY;
      }
    };

    document.documentElement.classList.toggle('gj-db-ready', ready);
    document.documentElement.classList.toggle('gj-db-offline', !ready);

    window.dispatchEvent(new CustomEvent('gj:battle-db-ready', {
      detail: {
        ready: ready,
        source: result.source || 'none',
        version: VERSION,
        checkedAt: now()
      }
    }));

    if (ready){
      log('DB ready from', result.source);
    }else{
      warn('DB not ready. Battle will show UI, but room sync may not work.');
    }
  }

  function refresh(){
    const result = detectDb();
    setBridgeState(result);
    return result;
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
    const source = window.GJ_BATTLE_DB_SOURCE || 'none';

    badge.textContent = ready
      ? 'DB ready'
      : 'DB offline/local';

    badge.title = 'GoodJunk Battle DB: ' + source;

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
        opacity: .62 !important;
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

  function boot(){
    injectCSS();

    refresh();

    /*
      บางหน้าโหลด Firebase ช้ากว่า bridge
      จึงเช็กซ้ำหลายจังหวะ
    */
    setTimeout(function(){
      refresh();
      showDbBadge();
    }, 300);

    setTimeout(function(){
      refresh();
      showDbBadge();
    }, 1000);

    setTimeout(function(){
      refresh();
      showDbBadge();
    }, 2500);

    setInterval(function(){
      refresh();
      showDbBadge();
    }, 5000);

    console.info('[GJ Battle Firebase Bridge]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  }else{
    boot();
  }
})();