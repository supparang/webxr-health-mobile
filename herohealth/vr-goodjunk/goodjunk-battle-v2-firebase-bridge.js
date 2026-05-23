(function GoodJunkBattleV250FirebaseBridge(){
  'use strict';

  const BRIDGE_VERSION = 'v2.5.0-clean-firebase-bridge';
  const ROOM_PATH = 'herohealth/goodjunk/battleV2Rooms';

  const DEFAULT_FIREBASE_CONFIG =
    window.HHA_FIREBASE_CONFIG ||
    window.HEROHEALTH_FIREBASE_CONFIG ||
    window.firebaseConfig ||
    window.FIREBASE_CONFIG ||
    {
      apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
      authDomain: "herohealth-d7f8c.firebaseapp.com",
      databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "herohealth-d7f8c",
      storageBucket: "herohealth-d7f8c.firebasestorage.app",
      messagingSenderId: "680817376848",
      appId: "1:680817376848:web:eed21b522b0703f6bd9b55"
    };

  const state = {
    version: BRIDGE_VERSION,
    roomPath: ROOM_PATH,
    app: null,
    auth: null,
    db: null,
    uid: '',
    initStarted: false,
    initDone: false,
    initPromise: null,
    ready: false,
    authReady: false,
    dbReady: false,
    lastError: '',
    lastInitAt: 0,
    source: 'not-started'
  };

  function now(){
    return Date.now();
  }

  function normalizeRoomCode(raw){
    const out = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);

    if (!out || /^-+$/.test(out) || /^_+$/.test(out)){
      return '';
    }

    return out;
  }

  function setGlobals(){
    window.GJ_BATTLE_V25_BRIDGE = bridge;

    /*
     * Backward compatibility กับไฟล์/patch เดิมที่อาจยังอ่านชื่อเหล่านี้
     */
    window.GJ_BATTLE_FIREBASE_BRIDGE = bridge;

    window.GJ_DB = state.db;
    window.GJ_BATTLE_DB = state.db;
    window.GJ_BATTLE_AUTH = state.auth;
    window.GJ_BATTLE_AUTH_UID = state.uid;

    window.GJ_BATTLE_DB_READY = !!state.dbReady;
    window.GJ_BATTLE_AUTH_READY = !!state.authReady;
    window.GJ_BATTLE_FIREBASE_INIT_OK = !!state.ready;

    window.GJ_BATTLE_ROOM_PATH = ROOM_PATH;
  }

  function emitReady(){
    try{
      window.dispatchEvent(new CustomEvent('gj:battle-db-ready', {
        detail: {
          version: BRIDGE_VERSION,
          roomPath: ROOM_PATH,
          uid: state.uid || '',
          ready: state.ready,
          at: now()
        }
      }));
    }catch(_){}
  }

  function emitError(err){
    try{
      window.dispatchEvent(new CustomEvent('gj:battle-db-error', {
        detail: {
          version: BRIDGE_VERSION,
          roomPath: ROOM_PATH,
          message: err && err.message ? err.message : String(err || 'Firebase error'),
          at: now()
        }
      }));
    }catch(_){}
  }

  async function initFirebase(){
    if (state.initPromise){
      return state.initPromise;
    }

    state.initStarted = true;
    state.lastInitAt = now();
    state.source = 'initializing';

    state.initPromise = (async function(){
      try{
        if (!window.firebase || typeof firebase.initializeApp !== 'function'){
          throw new Error('Firebase SDK not loaded');
        }

        if (!firebase.apps || !firebase.apps.length){
          state.app = firebase.initializeApp(DEFAULT_FIREBASE_CONFIG);
          state.source = 'initialized-new-app';
        }else{
          state.app = firebase.app();
          state.source = 'reuse-existing-app';
        }

        if (typeof firebase.auth !== 'function'){
          throw new Error('Firebase Auth SDK not loaded');
        }

        if (typeof firebase.database !== 'function'){
          throw new Error('Firebase Database SDK not loaded');
        }

        state.auth = firebase.auth();
        state.db = firebase.database();

        if (!state.auth.currentUser){
          await state.auth.signInAnonymously();
        }

        state.uid = state.auth.currentUser ? state.auth.currentUser.uid : '';

        state.authReady = !!state.auth;
        state.dbReady = !!state.db;
        state.ready = !!(state.authReady && state.dbReady);
        state.initDone = true;
        state.lastError = '';

        setGlobals();

        if (state.ready){
          emitReady();
        }

        return state.ready;
      }catch(err){
        console.warn('[GoodJunk Battle Firebase Bridge] init failed', err);

        state.ready = false;
        state.authReady = false;
        state.dbReady = false;
        state.initDone = false;
        state.lastError = err && err.message ? err.message : String(err || 'Firebase init failed');
        state.source = 'error';

        setGlobals();
        emitError(err);

        return false;
      }finally{
        /*
         * ให้ retry ได้ถ้ารอบแรกพังเพราะ SDK ยังโหลดไม่ทัน
         */
        if (!state.ready){
          state.initPromise = null;
        }
      }
    })();

    return state.initPromise;
  }

  async function refresh(){
    state.initPromise = null;
    return initFirebase();
  }

  async function waitForReady(timeoutMs){
    timeoutMs = Number(timeoutMs || 6500);

    const start = now();

    while (now() - start < timeoutMs){
      if (bridge.isReady()){
        return true;
      }

      await initFirebase();

      if (bridge.isReady()){
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 220));
    }

    return bridge.isReady();
  }

  function getRoomRef(roomCode){
    const code = normalizeRoomCode(roomCode);

    if (!code){
      return null;
    }

    if (!state.db || typeof state.db.ref !== 'function'){
      return null;
    }

    return state.db.ref(ROOM_PATH + '/' + code);
  }

  function getPlayerRef(roomCode, pid){
    const code = normalizeRoomCode(roomCode);
    pid = String(pid || '').trim();

    if (!code || !pid){
      return null;
    }

    const roomRef = getRoomRef(code);

    if (!roomRef || typeof roomRef.child !== 'function'){
      return null;
    }

    return roomRef.child('players').child(pid);
  }

  async function getRoom(roomCode){
    const ref = getRoomRef(roomCode);

    if (!ref || typeof ref.once !== 'function'){
      return null;
    }

    const snap = await ref.once('value');
    return snap && typeof snap.val === 'function' ? snap.val() || null : null;
  }

  async function updateRoom(roomCode, patch){
    const ref = getRoomRef(roomCode);

    if (!ref || typeof ref.update !== 'function'){
      return false;
    }

    await ref.update(Object.assign({}, patch || {}, {
      updatedAt: now()
    }));

    return true;
  }

  async function updatePlayer(roomCode, pid, patch){
    const ref = getPlayerRef(roomCode, pid);

    if (!ref || typeof ref.update !== 'function'){
      return false;
    }

    await ref.update(Object.assign({}, patch || {}, {
      updatedAt: now(),
      lastSeen: now()
    }));

    return true;
  }

  async function markPlayerLeft(roomCode, pid){
    return updatePlayer(roomCode, pid, {
      left: true,
      quit: true,
      disconnected: true,
      status: 'left',
      phase: 'left',
      rematchReady: false,
      readyRematch: false,
      nextReady: false
    });
  }

  function attachRoomListener(roomCode, onValue, onError){
    const ref = getRoomRef(roomCode);

    if (!ref || typeof ref.on !== 'function'){
      return null;
    }

    const handler = function(snapshot){
      const room = snapshot && typeof snapshot.val === 'function'
        ? snapshot.val() || {}
        : {};

      if (typeof onValue === 'function'){
        onValue(room);
      }
    };

    const errorHandler = function(err){
      console.warn('[GoodJunk Battle Firebase Bridge] room listener error', err);

      if (typeof onError === 'function'){
        onError(err);
      }
    };

    ref.on('value', handler, errorHandler);

    return {
      ref,
      off: function(){
        try{
          ref.off('value', handler);
        }catch(_){}
      }
    };
  }

  function getStatus(){
    return {
      version: BRIDGE_VERSION,
      roomPath: ROOM_PATH,
      ready: state.ready,
      authReady: state.authReady,
      dbReady: state.dbReady,
      uid: state.uid || '',
      source: state.source,
      lastError: state.lastError || '',
      lastInitAt: state.lastInitAt,
      appsCount: window.firebase && firebase.apps ? firebase.apps.length : 0
    };
  }

  const bridge = {
    version: BRIDGE_VERSION,
    roomPath: ROOM_PATH,

    get app(){
      return state.app;
    },

    get auth(){
      return state.auth;
    },

    get db(){
      return state.db;
    },

    get uid(){
      return state.uid;
    },

    state,

    init: initFirebase,
    refresh,
    waitForReady,
    isReady: function(){
      return !!(state.ready && state.db && typeof state.db.ref === 'function');
    },

    getStatus,
    normalizeRoomCode,

    getRoomRef,
    getPlayerRef,
    getRoom,
    updateRoom,
    updatePlayer,
    markPlayerLeft,
    attachRoomListener
  };

  window.GJ_BATTLE_V25_BRIDGE = bridge;
  window.GJ_BATTLE_FIREBASE_BRIDGE = bridge;

  /*
   * Auto init แบบนุ่ม ๆ:
   * ถ้า SDK พร้อม จะ ready เอง
   * ถ้า SDK ยังไม่พร้อม core/lobby เรียก waitForReady() แล้ว retry ได้
   */
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      initFirebase();
    }, { once:true });
  }else{
    initFirebase();
  }

  console.info('[GoodJunk Battle Firebase Bridge]', BRIDGE_VERSION, 'loaded');
})();