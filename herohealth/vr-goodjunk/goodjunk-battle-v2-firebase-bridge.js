/* =========================================================
 * GoodJunk Battle v2 Firebase Bridge
 * File: /herohealth/vr-goodjunk/goodjunk-battle-v2-firebase-bridge.js
 * Version: v2.4.34-firebase-bridge-auth-db-ready-final
 *
 * ใช้ร่วมกับ:
 * - goodjunk-battle-v2-lobby.html
 * - goodjunk-battle-v2-run.html
 * - goodjunk-battle-v2-run-pc.html
 * - goodjunk-battle-v2-run-mobile.html
 * - goodjunk-battle-v2-run-cardboard.html
 * - goodjunk-battle-v2-core.js
 *
 * Canonical RTDB path:
 * herohealth/goodjunk/battleV2Rooms/{ROOM_CODE}
 * ======================================================= */

(function GoodJunkBattleV2FirebaseBridge(){
  'use strict';

  const BRIDGE_VERSION = 'v2.4.34-firebase-bridge-auth-db-ready-final';

  if (
    window.GJ_BATTLE_FIREBASE_BRIDGE &&
    window.GJ_BATTLE_FIREBASE_BRIDGE.version === BRIDGE_VERSION
  ){
    return;
  }

  const CANONICAL_ROOM_PATH = 'herohealth/goodjunk/battleV2Rooms';

  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo',
    authDomain: 'herohealth-d7f8c.firebaseapp.com',
    databaseURL: 'https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'herohealth-d7f8c',
    storageBucket: 'herohealth-d7f8c.firebasestorage.app',
    messagingSenderId: '680817376848',
    appId: '1:680817376848:web:eed21b522b0703f6bd9b55'
  };

  const SDKS = [
    {
      key:'app',
      test:function(){
        return !!(
          window.firebase &&
          typeof window.firebase.initializeApp === 'function'
        );
      },
      src:'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js'
    },
    {
      key:'auth',
      test:function(){
        return !!(
          window.firebase &&
          typeof window.firebase.auth === 'function'
        );
      },
      src:'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js'
    },
    {
      key:'database',
      test:function(){
        return !!(
          window.firebase &&
          typeof window.firebase.database === 'function'
        );
      },
      src:'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
    }
  ];

  const state = {
    version:BRIDGE_VERSION,

    app:null,
    auth:null,
    db:null,
    user:null,

    sdkReady:false,
    appReady:false,
    authReady:false,
    dbReady:false,
    ready:false,

    initStarted:false,
    initDone:false,
    initPromise:null,
    authPromise:null,

    roomPath:CANONICAL_ROOM_PATH,
    lastError:null,
    lastReadyAt:0,
    lastAuthAt:0,
    lastDbAt:0,
    source:'bridge'
  };

  window.GJ_BATTLE_ROOM_PATH = CANONICAL_ROOM_PATH;
  window.GJ_BATTLE_BRIDGE_VERSION = BRIDGE_VERSION;

  window.GJ_BATTLE_DB_READY = false;
  window.GJ_BATTLE_AUTH_READY = false;
  window.GJ_BATTLE_AUTH_UID = '';
  window.GJ_BATTLE_DB_SOURCE = 'none';
  window.GJ_BATTLE_AUTH_SOURCE = 'none';

  function now(){
    return Date.now();
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail:Object.assign({
          bridgeVersion:BRIDGE_VERSION,
          roomPath:state.roomPath,
          ready:state.ready,
          authReady:state.authReady,
          dbReady:state.dbReady,
          uid:state.user && state.user.uid || ''
        }, detail || {})
      }));
    }catch(_){}
  }

  function setGlobals(){
    window.GJ_BATTLE_DB_READY = !!state.dbReady;
    window.GJ_BATTLE_AUTH_READY = !!state.authReady;
    window.GJ_BATTLE_AUTH_UID = state.user && state.user.uid || '';

    window.GJ_BATTLE_DB_SOURCE = state.dbReady ? 'firebase-compat-database' : 'none';
    window.GJ_BATTLE_AUTH_SOURCE = state.authReady ? 'firebase-compat-auth-anonymous' : 'none';

    window.GJ_DB = state.db || null;
    window.GJ_AUTH = state.auth || null;
    window.GJ_FIREBASE_APP = state.app || null;
  }

  function saveError(err, label){
    state.lastError = err || new Error(label || 'unknown-error');

    window.GJ_BATTLE_LAST_ERROR =
      label
        ? label + ': ' + String(err && err.message || err || '')
        : String(err && err.message || err || '');

    console.warn('[GJ Battle Firebase Bridge]', label || 'error', err);

    emit('gj:battle-db-error', {
      label:label || 'error',
      error:String(err && err.message || err || '')
    });
  }

  function getConfig(){
    return (
      window.HHA_FIREBASE_CONFIG ||
      window.HEROHEALTH_FIREBASE_CONFIG ||
      window.firebaseConfig ||
      window.FIREBASE_CONFIG ||
      DEFAULT_FIREBASE_CONFIG
    );
  }

  function hasFirebaseApp(){
    try{
      return !!(
        window.firebase &&
        Array.isArray(window.firebase.apps) &&
        window.firebase.apps.length > 0
      );
    }catch(_){
      return false;
    }
  }

  function loadScript(src){
    return new Promise(function(resolve, reject){
      const existing = Array.from(document.scripts || []).find(function(s){
        return String(s.src || '') === src;
      });

      if (existing){
        if (existing.dataset.gjLoaded === '1'){
          resolve(true);
          return;
        }

        existing.addEventListener('load', function(){
          existing.dataset.gjLoaded = '1';
          resolve(true);
        }, { once:true });

        existing.addEventListener('error', function(){
          reject(new Error('โหลด Firebase SDK ไม่สำเร็จ: ' + src));
        }, { once:true });

        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.gjBattleSdk = '1';

      script.onload = function(){
        script.dataset.gjLoaded = '1';
        resolve(true);
      };

      script.onerror = function(){
        reject(new Error('โหลด Firebase SDK ไม่สำเร็จ: ' + src));
      };

      document.head.appendChild(script);
    });
  }

  async function ensureSdk(){
    for (const sdk of SDKS){
      if (!sdk.test()){
        await loadScript(sdk.src);
      }

      if (!sdk.test()){
        throw new Error('Firebase SDK ยังไม่พร้อม: ' + sdk.key);
      }
    }

    state.sdkReady = true;
    return true;
  }

  function initApp(){
    if (!window.firebase || typeof window.firebase.initializeApp !== 'function'){
      throw new Error('firebase-app-compat ยังไม่พร้อม');
    }

    if (hasFirebaseApp()){
      state.app = window.firebase.app();
      state.appReady = true;
      return state.app;
    }

    const cfg = getConfig();

    if (!cfg || !cfg.apiKey || !cfg.databaseURL){
      throw new Error('Firebase config ไม่ครบ ต้องมี apiKey และ databaseURL');
    }

    state.app = window.firebase.initializeApp(cfg);
    state.appReady = true;

    return state.app;
  }

  function initDb(){
    if (!window.firebase || typeof window.firebase.database !== 'function'){
      throw new Error('firebase-database-compat ยังไม่พร้อม');
    }

    state.db = window.firebase.database();
    state.dbReady = !!(
      state.db &&
      typeof state.db.ref === 'function'
    );

    if (!state.dbReady){
      throw new Error('Firebase Database ref() ไม่พร้อม');
    }

    state.lastDbAt = now();
    setGlobals();

    emit('gj:battle-db-ready', {
      source:'firebase-compat-database'
    });

    return state.db;
  }

  function initAuth(){
    if (!window.firebase || typeof window.firebase.auth !== 'function'){
      throw new Error('firebase-auth-compat ยังไม่พร้อม');
    }

    state.auth = window.firebase.auth();

    return state.auth;
  }

  async function ensureAuth(){
    if (state.authReady && state.user){
      return state.user;
    }

    if (state.authPromise){
      return state.authPromise;
    }

    state.authPromise = new Promise(function(resolve, reject){
      try{
        const auth = initAuth();

        const unsub = auth.onAuthStateChanged(async function(user){
          try{
            if (user){
              state.user = user;
              state.authReady = true;
              state.lastAuthAt = now();

              setGlobals();

              emit('gj:battle-auth-ready', {
                uid:user.uid,
                anonymous:!!user.isAnonymous
              });

              if (typeof unsub === 'function') unsub();
              resolve(user);
              return;
            }

            try{
              const result = await auth.signInAnonymously();
              const signedUser = result && result.user;

              if (!signedUser){
                throw new Error('signInAnonymously ไม่มี user');
              }

              state.user = signedUser;
              state.authReady = true;
              state.lastAuthAt = now();

              setGlobals();

              emit('gj:battle-auth-ready', {
                uid:signedUser.uid,
                anonymous:!!signedUser.isAnonymous
              });

              if (typeof unsub === 'function') unsub();
              resolve(signedUser);
            }catch(err){
              saveError(err, 'anonymous-auth-failed');
              if (typeof unsub === 'function') unsub();
              reject(err);
            }
          }catch(err){
            saveError(err, 'auth-state-failed');
            if (typeof unsub === 'function') unsub();
            reject(err);
          }
        });
      }catch(err){
        saveError(err, 'ensure-auth-failed');
        reject(err);
      }
    }).finally(function(){
      state.authPromise = null;
    });

    return state.authPromise;
  }

  async function refresh(){
    try{
      await ensureSdk();

      initApp();
      initDb();

      await ensureAuth();

      state.ready = !!(
        state.sdkReady &&
        state.appReady &&
        state.dbReady &&
        state.authReady &&
        state.db &&
        state.auth &&
        state.user
      );

      state.initDone = state.ready;
      state.lastReadyAt = state.ready ? now() : state.lastReadyAt;

      setGlobals();

      if (state.ready){
        emit('gj:battle-bridge-ready', {
          uid:state.user.uid,
          source:'refresh'
        });

        emit('gj:battle-db-ready', {
          uid:state.user.uid,
          source:'refresh'
        });
      }

      return state.ready;
    }catch(err){
      saveError(err, 'refresh-failed');

      state.ready = false;
      state.initDone = false;

      setGlobals();

      return false;
    }
  }

  async function init(){
    if (state.initPromise){
      return state.initPromise;
    }

    state.initStarted = true;

    state.initPromise = refresh().finally(function(){
      state.initPromise = null;
    });

    return state.initPromise;
  }

  async function waitUntilReady(timeoutMs){
    timeoutMs = Number(timeoutMs || 6500);

    const started = now();

    while (now() - started < timeoutMs){
      const ok = await refresh();

      if (ok){
        return true;
      }

      await sleep(180);
    }

    return false;
  }

  function sleep(ms){
    return new Promise(function(resolve){
      setTimeout(resolve, ms);
    });
  }

  function isReady(){
    return !!(
      state.ready &&
      state.dbReady &&
      state.authReady &&
      state.db &&
      typeof state.db.ref === 'function' &&
      state.user &&
      state.user.uid
    );
  }

  function getDb(){
    if (state.db && typeof state.db.ref === 'function'){
      return state.db;
    }

    try{
      if (
        window.firebase &&
        typeof window.firebase.database === 'function'
      ){
        state.db = window.firebase.database();
        state.dbReady = !!state.db;
        setGlobals();
        return state.db;
      }
    }catch(err){
      saveError(err, 'get-db-failed');
    }

    return null;
  }

  function getAuth(){
    if (state.auth){
      return state.auth;
    }

    try{
      if (
        window.firebase &&
        typeof window.firebase.auth === 'function'
      ){
        state.auth = window.firebase.auth();
        return state.auth;
      }
    }catch(err){
      saveError(err, 'get-auth-failed');
    }

    return null;
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function getRoomPath(roomCode){
    const code = normalizeRoomCode(roomCode);

    if (!code){
      return state.roomPath;
    }

    return state.roomPath + '/' + code;
  }

  function getRoomRef(roomCode){
    const code = normalizeRoomCode(roomCode);

    if (!code){
      throw new Error('getRoomRef ต้องมี roomCode');
    }

    const db = getDb();

    if (!db || typeof db.ref !== 'function'){
      throw new Error('Firebase Database ยังไม่พร้อม');
    }

    return db.ref(getRoomPath(code));
  }

  function getRoomPlayersRef(roomCode){
    return getRoomRef(roomCode).child('players');
  }

  function getPlayerRef(roomCode, playerId){
    const pid = normalizePlayerKey(playerId);

    if (!pid){
      throw new Error('getPlayerRef ต้องมี playerId');
    }

    return getRoomPlayersRef(roomCode).child(pid);
  }

  function normalizePlayerKey(raw){
    return String(raw || 'anon')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[.#$\[\]\/]/g, '_')
      .slice(0, 80) || 'anon';
  }

  function setRoomPath(path){
    const p = String(path || '').trim().replace(/^\/+|\/+$/g, '');

    if (!p){
      return state.roomPath;
    }

    state.roomPath = p;
    window.GJ_BATTLE_ROOM_PATH = p;

    emit('gj:battle-room-path-updated', {
      roomPath:p
    });

    return state.roomPath;
  }

  function getStatus(){
    return {
      version:BRIDGE_VERSION,
      sdkReady:state.sdkReady,
      appReady:state.appReady,
      authReady:state.authReady,
      dbReady:state.dbReady,
      ready:state.ready,
      uid:state.user && state.user.uid || '',
      roomPath:state.roomPath,
      dbSource:window.GJ_BATTLE_DB_SOURCE || 'none',
      authSource:window.GJ_BATTLE_AUTH_SOURCE || 'none',
      lastError:state.lastError
        ? String(state.lastError.message || state.lastError)
        : ''
    };
  }

  async function ping(roomCode){
    const code = normalizeRoomCode(roomCode);

    if (!code){
      return false;
    }

    const ok = await waitUntilReady(6500);

    if (!ok){
      return false;
    }

    try{
      await getRoomRef(code).child('_bridgePing').update({
        version:BRIDGE_VERSION,
        uid:state.user && state.user.uid || '',
        updatedAt:now()
      });

      return true;
    }catch(err){
      saveError(err, 'ping-failed');
      return false;
    }
  }

  function expose(){
    const api = {
      version:BRIDGE_VERSION,
      state,

      init,
      refresh,
      waitUntilReady,
      ensureSdk,
      ensureAuth,

      isReady,
      getStatus,

      getDb,
      getAuth,
      getRoomPath,
      getRoomRef,
      getRoomPlayersRef,
      getPlayerRef,

      normalizeRoomCode,
      normalizePlayerKey,
      setRoomPath,

      ping,

      get lastError(){
        return state.lastError
          ? String(state.lastError.message || state.lastError)
          : '';
      }
    };

    window.GJ_BATTLE_FIREBASE_BRIDGE = api;

    return api;
  }

  expose();

  init().then(function(ok){
    if (ok){
      console.info('[GJ Battle Firebase Bridge]', BRIDGE_VERSION, 'ready', getStatus());
    }else{
      console.warn('[GJ Battle Firebase Bridge]', BRIDGE_VERSION, 'not ready', getStatus());
    }
  });

})();
