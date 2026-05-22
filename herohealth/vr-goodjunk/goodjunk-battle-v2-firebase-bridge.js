(function GoodJunkBattleV2FirebaseBridge(){
  'use strict';

  const BRIDGE_VERSION = 'v2.4.33-firebase-bridge-stable-auth-db-roomref';

  const ROOT_PATH = 'herohealth/goodjunk/battleV2Rooms';

  window.GJ_BATTLE_FIREBASE_BRIDGE_VERSION = BRIDGE_VERSION;
  window.GJ_BATTLE_ROOM_PATH = ROOT_PATH;

  window.GJ_BATTLE_AUTH_READY = false;
  window.GJ_BATTLE_DB_READY = false;
  window.GJ_BATTLE_AUTH_UID = '';
  window.GJ_BATTLE_AUTH_SOURCE = 'init';
  window.GJ_BATTLE_DB_SOURCE = 'init';
  window.GJ_BATTLE_LAST_FIREBASE_ERROR = '';

  const state = {
    version: BRIDGE_VERSION,
    rootPath: ROOT_PATH,
    app: null,
    auth: null,
    db: null,
    uid: '',
    ready: false,
    authReady: false,
    dbReady: false,
    lastError: '',
    initStarted: false,
    initDone: false,
    initPromise: null
  };

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: Object.assign({
          version: BRIDGE_VERSION,
          at: Date.now()
        }, detail || {})
      }));
    }catch(_){}
  }

  function setError(err, source){
    const msg = err && err.message ? err.message : String(err || 'unknown-error');

    state.lastError = msg;
    window.GJ_BATTLE_LAST_FIREBASE_ERROR = msg;
    window.GJ_BATTLE_AUTH_SOURCE = source || window.GJ_BATTLE_AUTH_SOURCE || 'error';

    console.warn('[GJ Battle Firebase Bridge]', source || 'error', err);

    emit('gj:battle-db-error', {
      source: source || 'bridge',
      error: msg
    });
  }

  function getFirebase(){
    if (!window.firebase){
      setError('Firebase compat SDK not loaded', 'firebase-missing');
      return null;
    }

    return window.firebase;
  }

  function getConfig(){
    return (
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
      }
    );
  }

  function hasFirebaseApp(firebase){
    try{
      return !!(firebase && firebase.apps && firebase.apps.length);
    }catch(_){
      return false;
    }
  }

  function ensureApp(){
    const firebase = getFirebase();
    if (!firebase) return null;

    try{
      if (hasFirebaseApp(firebase)){
        state.app = firebase.app();
        window.GJ_BATTLE_AUTH_SOURCE = 'existing-app';
        return state.app;
      }

      if (typeof firebase.initializeApp !== 'function'){
        setError('firebase.initializeApp is not available', 'initializeApp-missing');
        return null;
      }

      const cfg = getConfig();

      if (!cfg || !cfg.apiKey || !cfg.databaseURL){
        setError('Firebase config is incomplete', 'config-missing');
        return null;
      }

      state.app = firebase.initializeApp(cfg);
      window.GJ_BATTLE_AUTH_SOURCE = 'bridge-initializeApp';

      console.info('[GJ Battle Firebase Bridge] Firebase app initialized', BRIDGE_VERSION);
      return state.app;
    }catch(err){
      /*
       * ถ้า app ถูก init จากไฟล์อื่นไปแล้วระหว่างทาง ให้ใช้ app เดิมแทน
       */
      try{
        if (hasFirebaseApp(firebase)){
          state.app = firebase.app();
          window.GJ_BATTLE_AUTH_SOURCE = 'existing-app-after-catch';
          return state.app;
        }
      }catch(_){}

      setError(err, 'ensure-app-failed');
      return null;
    }
  }

  async function ensureAuth(){
    const firebase = getFirebase();
    if (!firebase) return false;

    ensureApp();

    try{
      if (typeof firebase.auth !== 'function'){
        setError('firebase.auth is not available. Load firebase-auth-compat.js first.', 'auth-missing');
        return false;
      }

      state.auth = firebase.auth();

      const currentUser = state.auth.currentUser;

      if (currentUser && currentUser.uid){
        state.uid = currentUser.uid;
        state.authReady = true;
        window.GJ_BATTLE_AUTH_READY = true;
        window.GJ_BATTLE_AUTH_UID = currentUser.uid;
        window.GJ_BATTLE_AUTH_SOURCE = 'current-user';

        emit('gj:battle-auth-ready', {
          uid: currentUser.uid,
          source: 'current-user'
        });

        return true;
      }

      if (typeof state.auth.signInAnonymously !== 'function'){
        setError('signInAnonymously is not available', 'anonymous-auth-missing');
        return false;
      }

      const cred = await state.auth.signInAnonymously();
      const user = cred && cred.user ? cred.user : state.auth.currentUser;

      if (!user || !user.uid){
        setError('Anonymous auth returned no user', 'anonymous-auth-empty');
        return false;
      }

      state.uid = user.uid;
      state.authReady = true;
      window.GJ_BATTLE_AUTH_READY = true;
      window.GJ_BATTLE_AUTH_UID = user.uid;
      window.GJ_BATTLE_AUTH_SOURCE = 'anonymous-auth';

      emit('gj:battle-auth-ready', {
        uid: user.uid,
        source: 'anonymous-auth'
      });

      return true;
    }catch(err){
      setError(err, 'ensure-auth-failed');
      window.GJ_BATTLE_AUTH_READY = false;
      return false;
    }
  }

  function ensureDb(){
    const firebase = getFirebase();
    if (!firebase) return false;

    ensureApp();

    try{
      if (typeof firebase.database !== 'function'){
        setError('firebase.database is not available. Load firebase-database-compat.js first.', 'database-missing');
        return false;
      }

      state.db = firebase.database();

      if (!state.db || typeof state.db.ref !== 'function'){
        setError('firebase.database() has no ref()', 'database-ref-missing');
        return false;
      }

      state.dbReady = true;
      window.GJ_DB = state.db;
      window.GJ_BATTLE_DB = state.db;
      window.GJ_BATTLE_DB_READY = true;
      window.GJ_BATTLE_DB_SOURCE = 'firebase.database';

      emit('gj:battle-db-ready', {
        source: 'firebase.database',
        rootPath: ROOT_PATH
      });

      return true;
    }catch(err){
      setError(err, 'ensure-db-failed');
      window.GJ_BATTLE_DB_READY = false;
      return false;
    }
  }

  async function refresh(){
    const appOk = !!ensureApp();
    const authOk = await ensureAuth();
    const dbOk = ensureDb();

    state.ready = !!(appOk && authOk && dbOk);
    state.initDone = true;

    if (state.ready){
      window.GJ_BATTLE_AUTH_READY = true;
      window.GJ_BATTLE_DB_READY = true;

      emit('gj:battle-firebase-ready', {
        uid: state.uid,
        rootPath: ROOT_PATH
      });

      console.info('[GJ Battle Firebase Bridge] ready', {
        version: BRIDGE_VERSION,
        uid: state.uid,
        rootPath: ROOT_PATH
      });
    }

    return state.ready;
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function getRoomRef(roomCode){
    const code = normalizeRoomCode(roomCode);

    if (!code){
      setError('Missing room code', 'get-room-ref-missing-code');
      return null;
    }

    const db = state.db || window.GJ_DB || null;

    if (!db || typeof db.ref !== 'function'){
      ensureDb();
    }

    const finalDb = state.db || window.GJ_DB || null;

    if (!finalDb || typeof finalDb.ref !== 'function'){
      setError('Database is not ready', 'get-room-ref-db-not-ready');
      return null;
    }

    return finalDb.ref(ROOT_PATH + '/' + code);
  }

  function getRootRef(){
    const db = state.db || window.GJ_DB || null;

    if (!db || typeof db.ref !== 'function'){
      ensureDb();
    }

    const finalDb = state.db || window.GJ_DB || null;

    if (!finalDb || typeof finalDb.ref !== 'function'){
      setError('Database is not ready', 'get-root-ref-db-not-ready');
      return null;
    }

    return finalDb.ref(ROOT_PATH);
  }

  async function getRoomSnapshot(roomCode){
    const ref = getRoomRef(roomCode);

    if (!ref || typeof ref.once !== 'function'){
      return null;
    }

    try{
      const snap = await ref.once('value');
      return snap && typeof snap.val === 'function' ? snap.val() : null;
    }catch(err){
      setError(err, 'get-room-snapshot-failed');
      return null;
    }
  }

  async function updateRoom(roomCode, patch){
    const ref = getRoomRef(roomCode);

    if (!ref || typeof ref.update !== 'function'){
      return false;
    }

    try{
      await ref.update(Object.assign({
        updatedAt: Date.now(),
        bridgeVersion: BRIDGE_VERSION
      }, patch || {}));

      return true;
    }catch(err){
      setError(err, 'update-room-failed');
      return false;
    }
  }

  async function updatePlayer(roomCode, playerId, patch){
    const code = normalizeRoomCode(roomCode);
    const pid = String(playerId || '').trim();

    if (!code || !pid){
      setError('Missing room code or player id', 'update-player-missing-args');
      return false;
    }

    const ref = getRoomRef(code);

    if (!ref || typeof ref.child !== 'function'){
      return false;
    }

    try{
      await ref.child('players').child(pid).update(Object.assign({
        updatedAt: Date.now(),
        heartbeatAt: Date.now(),
        bridgeVersion: BRIDGE_VERSION,
        authUid: state.uid || window.GJ_BATTLE_AUTH_UID || ''
      }, patch || {}));

      return true;
    }catch(err){
      setError(err, 'update-player-failed');
      return false;
    }
  }

  async function markPlayerOnline(roomCode, playerId, patch){
    return updatePlayer(roomCode, playerId, Object.assign({
      status: 'online',
      left: false,
      quit: false,
      disconnected: false,
      lastSeen: Date.now(),
      heartbeatAt: Date.now()
    }, patch || {}));
  }

  async function markPlayerLeft(roomCode, playerId, patch){
    return updatePlayer(roomCode, playerId, Object.assign({
      status: 'left',
      left: true,
      quit: true,
      disconnected: true,
      lastSeen: Date.now(),
      heartbeatAt: Date.now()
    }, patch || {}));
  }

  function isReady(){
    return !!(
      state.ready &&
      state.authReady &&
      state.dbReady &&
      window.GJ_BATTLE_AUTH_READY &&
      window.GJ_BATTLE_DB_READY &&
      (state.db || window.GJ_DB)
    );
  }

  function init(){
    if (state.initPromise) return state.initPromise;

    state.initStarted = true;

    state.initPromise = refresh().catch(function(err){
      setError(err, 'init-failed');
      return false;
    });

    return state.initPromise;
  }

  window.GJ_BATTLE_FIREBASE_BRIDGE = {
    version: BRIDGE_VERSION,
    rootPath: ROOT_PATH,
    state,
    init,
    refresh,
    ensureApp,
    ensureAuth,
    ensureDb,
    isReady,
    normalizeRoomCode,
    getRootRef,
    getRoomRef,
    getRoomSnapshot,
    updateRoom,
    updatePlayer,
    markPlayerOnline,
    markPlayerLeft,
    get lastError(){
      return state.lastError || window.GJ_BATTLE_LAST_FIREBASE_ERROR || '';
    },
    get db(){
      return state.db || window.GJ_DB || null;
    },
    get uid(){
      return state.uid || window.GJ_BATTLE_AUTH_UID || '';
    }
  };

  /*
   * Auto init แต่ไม่ block หน้าเกม
   */
  init();

  window.addEventListener('load', function(){
    setTimeout(function(){
      if (!isReady()){
        refresh();
      }
    }, 300);
  });

  console.info('[GJ Battle Firebase Bridge]', BRIDGE_VERSION, 'loaded');
})();
