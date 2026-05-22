/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-battle-v2-firebase-bridge.js
   GoodJunk Battle v2 Firebase Bridge
   Version: v2.4.31-clean-final
   Purpose:
   - One shared Firebase bridge for Battle Lobby + all run files
   - Anonymous Auth
   - RTDB room path: herohealth/goodjunk/battleV2Rooms/<ROOM>
   - Expose stable globals:
     GJ_BATTLE_FIREBASE_BRIDGE
     GJ_BATTLE_DB_READY
     GJ_BATTLE_AUTH_READY
     GJ_BATTLE_AUTH_UID
     GJ_DB
     GJ_BATTLE_ROOM_PATH
========================================================= */

(function GoodJunkBattleV2FirebaseBridge(){
  'use strict';

  const VERSION = 'v2.4.31-clean-final-firebase-bridge';
  const ROOM_PATH = 'herohealth/goodjunk/battleV2Rooms';

  const STATE = {
    version: VERSION,
    roomPath: ROOM_PATH,
    firebaseReady: false,
    authReady: false,
    dbReady: false,
    uid: '',
    db: null,
    auth: null,
    lastError: '',
    lastRefreshAt: 0,
    initStarted: false,
    initDone: false
  };

  window.GJ_BATTLE_ROOM_PATH = ROOM_PATH;
  window.GJ_BATTLE_FIREBASE_BRIDGE_VERSION = VERSION;

  function now(){
    return Date.now();
  }

  function log(){
    try{
      console.info.apply(console, ['[GJ Battle Firebase Bridge]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function warn(){
    try{
      console.warn.apply(console, ['[GJ Battle Firebase Bridge]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function setError(err){
    const msg = err && err.message ? err.message : String(err || '');
    STATE.lastError = msg;
    window.GJ_BATTLE_FIREBASE_LAST_ERROR = msg;
    if (msg) warn(msg);
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function hasFirebase(){
    return !!(window.firebase && typeof window.firebase === 'object');
  }

  function hasFirebaseApp(){
    try{
      return !!(
        window.firebase &&
        firebase.apps &&
        firebase.apps.length
      );
    }catch(_){
      return false;
    }
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

  function initFirebaseApp(){
    if (!hasFirebase()){
      setError('firebase SDK is not loaded. Load firebase-app-compat.js before bridge.');
      return false;
    }

    if (hasFirebaseApp()){
      STATE.firebaseReady = true;
      window.GJ_BATTLE_FIREBASE_APP_READY = true;
      return true;
    }

    if (typeof firebase.initializeApp !== 'function'){
      setError('firebase.initializeApp is not available.');
      return false;
    }

    const cfg = getConfig();

    if (!cfg || !cfg.apiKey || !cfg.databaseURL){
      setError('Firebase config is missing apiKey or databaseURL.');
      return false;
    }

    try{
      firebase.initializeApp(cfg);
      STATE.firebaseReady = true;
      window.GJ_BATTLE_FIREBASE_APP_READY = true;
      log('Firebase app initialized');
      return true;
    }catch(err){
      const already = String(err && err.message || '').includes('already exists');

      if (already && hasFirebaseApp()){
        STATE.firebaseReady = true;
        window.GJ_BATTLE_FIREBASE_APP_READY = true;
        return true;
      }

      setError(err);
      return false;
    }
  }

  async function ensureAuth(){
    if (!initFirebaseApp()) return false;

    if (!firebase.auth || typeof firebase.auth !== 'function'){
      setError('firebase-auth-compat.js is not loaded.');
      STATE.authReady = false;
      window.GJ_BATTLE_AUTH_READY = false;
      return false;
    }

    try{
      STATE.auth = firebase.auth();

      if (STATE.auth.currentUser){
        STATE.uid = STATE.auth.currentUser.uid;
        STATE.authReady = true;

        window.GJ_BATTLE_AUTH_READY = true;
        window.GJ_BATTLE_AUTH_UID = STATE.uid;
        window.GJ_AUTH_UID = STATE.uid;

        return true;
      }

      const cred = await STATE.auth.signInAnonymously();
      const user = cred && cred.user ? cred.user : STATE.auth.currentUser;

      if (!user || !user.uid){
        setError('Anonymous auth returned no uid.');
        STATE.authReady = false;
        window.GJ_BATTLE_AUTH_READY = false;
        return false;
      }

      STATE.uid = user.uid;
      STATE.authReady = true;

      window.GJ_BATTLE_AUTH_READY = true;
      window.GJ_BATTLE_AUTH_UID = STATE.uid;
      window.GJ_AUTH_UID = STATE.uid;

      log('Anonymous auth ready', STATE.uid);
      return true;
    }catch(err){
      STATE.authReady = false;
      window.GJ_BATTLE_AUTH_READY = false;
      setError(err);
      return false;
    }
  }

  function ensureDatabase(){
    if (!initFirebaseApp()) return false;

    if (!firebase.database || typeof firebase.database !== 'function'){
      setError('firebase-database-compat.js is not loaded.');
      STATE.dbReady = false;
      window.GJ_BATTLE_DB_READY = false;
      return false;
    }

    try{
      STATE.db = firebase.database();

      if (!STATE.db || typeof STATE.db.ref !== 'function'){
        setError('firebase.database().ref is not available.');
        STATE.dbReady = false;
        window.GJ_BATTLE_DB_READY = false;
        return false;
      }

      STATE.dbReady = true;

      window.GJ_DB = STATE.db;
      window.GJ_DATABASE = STATE.db;
      window.GJ_BATTLE_DB_READY = true;
      window.GJ_BATTLE_DB_SOURCE = 'firebase.database';
      window.GJ_BATTLE_ROOM_PATH = ROOM_PATH;

      return true;
    }catch(err){
      STATE.dbReady = false;
      window.GJ_BATTLE_DB_READY = false;
      setError(err);
      return false;
    }
  }

  async function refresh(){
    STATE.lastRefreshAt = now();

    const appOk = initFirebaseApp();
    const dbOk = ensureDatabase();
    const authOk = await ensureAuth();

    STATE.initDone = !!(appOk && dbOk && authOk);
    window.GJ_BATTLE_DB_READY = !!(dbOk && authOk);
    window.GJ_BATTLE_AUTH_READY = !!authOk;
    window.GJ_BATTLE_AUTH_UID = STATE.uid || '';

    if (STATE.initDone){
      window.dispatchEvent(new CustomEvent('gj:battle-db-ready', {
        detail: {
          version: VERSION,
          uid: STATE.uid,
          roomPath: ROOM_PATH,
          at: STATE.lastRefreshAt
        }
      }));
    }

    return STATE.initDone;
  }

  async function init(){
    if (STATE.initStarted && STATE.initDone) return true;

    STATE.initStarted = true;

    const ok = await refresh();

    if (ok){
      log('ready', {
        version: VERSION,
        uid: STATE.uid,
        roomPath: ROOM_PATH
      });
    }

    return ok;
  }

  function isReady(){
    return !!(
      STATE.dbReady &&
      STATE.authReady &&
      STATE.db &&
      typeof STATE.db.ref === 'function' &&
      STATE.uid
    );
  }

  function getRoomRef(roomCode){
    const code = normalizeRoomCode(roomCode);

    if (!code){
      setError('getRoomRef requires roomCode.');
      return null;
    }

    if (!ensureDatabase()){
      return null;
    }

    try{
      return STATE.db.ref(ROOM_PATH + '/' + code);
    }catch(err){
      setError(err);
      return null;
    }
  }

  function getPlayerRef(roomCode, pid){
    const roomRef = getRoomRef(roomCode);
    const id = String(pid || '').trim();

    if (!roomRef || !id) return null;

    return roomRef.child('players').child(id);
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
      throw new Error('Room ref is not ready.');
    }

    const data = Object.assign({}, patch || {}, {
      updatedAt: now()
    });

    await ref.update(data);
    return data;
  }

  async function updatePlayer(roomCode, pid, patch){
    const ref = getPlayerRef(roomCode, pid);

    if (!ref || typeof ref.update !== 'function'){
      throw new Error('Player ref is not ready.');
    }

    const data = Object.assign({}, patch || {}, {
      updatedAt: now(),
      lastSeen: now(),
      heartbeatAt: now()
    });

    await ref.update(data);
    return data;
  }

  async function setPlayerLeft(roomCode, pid){
    return updatePlayer(roomCode, pid, {
      status: 'left',
      left: true,
      quit: true,
      disconnected: true
    });
  }

  function onRoom(roomCode, cb){
    const ref = getRoomRef(roomCode);

    if (!ref || typeof ref.on !== 'function'){
      return function noop(){};
    }

    const handler = function(snapshot){
      const room = snapshot && typeof snapshot.val === 'function'
        ? snapshot.val() || {}
        : {};

      cb(room, snapshot);
    };

    ref.on('value', handler);

    return function off(){
      try{
        ref.off('value', handler);
      }catch(_){}
    };
  }

  function makeMatchId(prefix){
    return String(prefix || 'm') + '_' + now() + '_' + Math.random().toString(16).slice(2, 8);
  }

  function getDebugState(){
    return {
      version: VERSION,
      roomPath: ROOM_PATH,
      firebaseReady: STATE.firebaseReady,
      authReady: STATE.authReady,
      dbReady: STATE.dbReady,
      uid: STATE.uid,
      lastError: STATE.lastError,
      lastRefreshAt: STATE.lastRefreshAt,
      hasFirebase: hasFirebase(),
      hasApp: hasFirebaseApp(),
      hasDb: !!(STATE.db && typeof STATE.db.ref === 'function')
    };
  }

  const api = {
    version: VERSION,
    roomPath: ROOM_PATH,
    state: STATE,

    init,
    refresh,
    ensureAuth,
    ensureDatabase,
    isReady,

    normalizeRoomCode,
    getRoomRef,
    getPlayerRef,
    getRoom,
    updateRoom,
    updatePlayer,
    setPlayerLeft,
    onRoom,
    makeMatchId,
    getDebugState,

    get lastError(){
      return STATE.lastError;
    },

    get uid(){
      return STATE.uid;
    },

    get db(){
      return STATE.db;
    }
  };

  window.GJ_BATTLE_FIREBASE_BRIDGE = api;

  window.GJ_BATTLE_DB_READY = false;
  window.GJ_BATTLE_AUTH_READY = false;
  window.GJ_BATTLE_DB_SOURCE = 'initializing';
  window.GJ_BATTLE_AUTH_SOURCE = 'initializing';

  setTimeout(function(){
    init();
  }, 0);

  console.info('[GJ Battle Firebase Bridge]', VERSION, 'loaded');
})();
