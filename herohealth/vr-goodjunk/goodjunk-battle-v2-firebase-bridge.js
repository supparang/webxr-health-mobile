/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-battle-v2-firebase-bridge.js
   GoodJunk Battle v2 Firebase Bridge
   PATCH: v2.4.33-bridge-auth-db-roompath-stable
   ========================================================= */

(function GoodJunkBattleV2FirebaseBridge(){
  'use strict';

  const VERSION = 'v2.4.33-bridge-auth-db-roompath-stable';

  const DEFAULT_ROOM_PATH = 'herohealth/goodjunk/battleV2Rooms';
  const AUTH_WAIT_MS = 6500;

  const state = {
    version: VERSION,
    db: null,
    auth: null,
    authUid: '',
    authReady: false,
    dbReady: false,
    source: 'none',
    authSource: 'none',
    lastError: '',
    roomPath: DEFAULT_ROOM_PATH,
    initStartedAt: Date.now(),
    initFinishedAt: 0
  };

  function log(){
    try{
      console.info.apply(console, ['[GJ Battle Firebase Bridge]'].concat(Array.from(arguments)));
    }catch(_){}
  }

  function warn(){
    try{
      console.warn.apply(console, ['[GJ Battle Firebase Bridge]'].concat(Array.from(arguments)));
    }catch(_){}
  }

  function now(){
    return Date.now();
  }

  function safeString(v, fallback){
    v = String(v == null ? '' : v).trim();
    return v || fallback || '';
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function normalizeRoomPath(path){
    path = String(path || '').trim();
    path = path.replace(/^\/+/, '').replace(/\/+$/, '');
    return path || DEFAULT_ROOM_PATH;
  }

  function setGlobals(){
    window.GJ_BATTLE_FIREBASE_BRIDGE_VERSION = VERSION;

    window.GJ_BATTLE_DB_READY = !!state.dbReady;
    window.GJ_BATTLE_AUTH_READY = !!state.authReady;
    window.GJ_BATTLE_AUTH_UID = state.authUid || '';

    window.GJ_BATTLE_DB_SOURCE = state.source || 'none';
    window.GJ_BATTLE_AUTH_SOURCE = state.authSource || 'none';
    window.GJ_BATTLE_ROOM_PATH = state.roomPath || DEFAULT_ROOM_PATH;

    if (state.db){
      window.GJ_DB = state.db;
      window.GJ_BATTLE_DB = state.db;
    }

    if (state.auth){
      window.GJ_AUTH = state.auth;
      window.GJ_BATTLE_AUTH = state.auth;
    }
  }

  function dispatchReady(){
    try{
      window.dispatchEvent(new CustomEvent('gj:battle-db-ready', {
        detail:{
          version:VERSION,
          dbReady:state.dbReady,
          authReady:state.authReady,
          uid:state.authUid || '',
          source:state.source || 'none',
          authSource:state.authSource || 'none',
          roomPath:state.roomPath || DEFAULT_ROOM_PATH
        }
      }));
    }catch(_){}
  }

  function getFirebase(){
    return window.firebase || null;
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
      return !!(
        firebase &&
        firebase.apps &&
        firebase.apps.length
      );
    }catch(_){
      return false;
    }
  }

  function ensureFirebaseApp(){
    const firebase = getFirebase();

    if (!firebase || typeof firebase.initializeApp !== 'function'){
      state.lastError = 'firebase-app-compat-not-loaded';
      return false;
    }

    try{
      if (hasFirebaseApp(firebase)){
        return true;
      }

      const cfg = getConfig();

      if (!cfg){
        state.lastError = 'no-firebase-config';
        return false;
      }

      firebase.initializeApp(cfg);
      return true;
    }catch(err){
      state.lastError = err && err.message ? err.message : String(err);
      warn('initializeApp failed', err);
      return false;
    }
  }

  function detectDatabase(){
    const firebase = getFirebase();

    if (window.GJ_DB && typeof window.GJ_DB.ref === 'function'){
      state.db = window.GJ_DB;
      state.dbReady = true;
      state.source = 'window.GJ_DB';
      setGlobals();
      return state.db;
    }

    if (window.GJ_BATTLE_DB && typeof window.GJ_BATTLE_DB.ref === 'function'){
      state.db = window.GJ_BATTLE_DB;
      state.dbReady = true;
      state.source = 'window.GJ_BATTLE_DB';
      setGlobals();
      return state.db;
    }

    if (window.db && typeof window.db.ref === 'function'){
      state.db = window.db;
      state.dbReady = true;
      state.source = 'window.db';
      setGlobals();
      return state.db;
    }

    if (window.database && typeof window.database.ref === 'function'){
      state.db = window.database;
      state.dbReady = true;
      state.source = 'window.database';
      setGlobals();
      return state.db;
    }

    if (window.firebaseDb && typeof window.firebaseDb.ref === 'function'){
      state.db = window.firebaseDb;
      state.dbReady = true;
      state.source = 'window.firebaseDb';
      setGlobals();
      return state.db;
    }

    if (
      firebase &&
      typeof firebase.database === 'function'
    ){
      try{
        state.db = firebase.database();
        state.dbReady = !!(state.db && typeof state.db.ref === 'function');
        state.source = state.dbReady ? 'firebase.database()' : 'firebase.database-invalid';
        setGlobals();
        return state.dbReady ? state.db : null;
      }catch(err){
        state.lastError = err && err.message ? err.message : String(err);
        state.dbReady = false;
        state.source = 'firebase.database-error';
        warn('database detect failed', err);
        setGlobals();
        return null;
      }
    }

    state.db = null;
    state.dbReady = false;
    state.source = 'none';
    setGlobals();
    return null;
  }

  function detectAuth(){
    const firebase = getFirebase();

    if (window.GJ_AUTH){
      state.auth = window.GJ_AUTH;
      state.authSource = 'window.GJ_AUTH';
      setGlobals();
      return state.auth;
    }

    if (window.GJ_BATTLE_AUTH){
      state.auth = window.GJ_BATTLE_AUTH;
      state.authSource = 'window.GJ_BATTLE_AUTH';
      setGlobals();
      return state.auth;
    }

    if (
      firebase &&
      typeof firebase.auth === 'function'
    ){
      try{
        state.auth = firebase.auth();
        state.authSource = 'firebase.auth()';
        setGlobals();
        return state.auth;
      }catch(err){
        state.lastError = err && err.message ? err.message : String(err);
        state.authSource = 'firebase.auth-error';
        warn('auth detect failed', err);
        setGlobals();
        return null;
      }
    }

    state.auth = null;
    state.authSource = 'none';
    setGlobals();
    return null;
  }

  async function ensureAuth(){
    ensureFirebaseApp();

    const auth = detectAuth();

    if (!auth){
      state.authReady = false;
      state.authUid = '';
      state.lastError = state.lastError || 'auth-not-loaded';
      setGlobals();
      return false;
    }

    try{
      if (auth.currentUser && auth.currentUser.uid){
        state.authReady = true;
        state.authUid = auth.currentUser.uid;
        setGlobals();
        return true;
      }

      if (typeof auth.signInAnonymously !== 'function'){
        state.authReady = false;
        state.authUid = '';
        state.lastError = 'signInAnonymously-not-available';
        setGlobals();
        return false;
      }

      const result = await auth.signInAnonymously();

      const user =
        result && result.user
          ? result.user
          : auth.currentUser || null;

      state.authReady = !!(user && user.uid);
      state.authUid = user && user.uid ? user.uid : '';
      state.lastError = state.authReady ? '' : 'anonymous-auth-no-user';

      setGlobals();
      return state.authReady;
    }catch(err){
      state.authReady = false;
      state.authUid = '';
      state.lastError = err && err.message ? err.message : String(err);
      warn('anonymous auth failed', err);
      setGlobals();
      return false;
    }
  }

  async function refresh(){
    state.roomPath = normalizeRoomPath(
      window.GJ_BATTLE_ROOM_PATH ||
      window.HHA_GJ_BATTLE_ROOM_PATH ||
      DEFAULT_ROOM_PATH
    );

    const appOk = ensureFirebaseApp();

    if (!appOk){
      state.dbReady = false;
      state.authReady = false;
      setGlobals();
      return false;
    }

    detectDatabase();
    await ensureAuth();
    detectDatabase();

    state.initFinishedAt = now();

    setGlobals();

    if (state.dbReady && state.authReady){
      dispatchReady();
      return true;
    }

    return false;
  }

  async function waitForReady(timeoutMs){
    timeoutMs = Number(timeoutMs || AUTH_WAIT_MS);
    const start = now();

    while (now() - start < timeoutMs){
      const ok = await refresh();
      if (ok) return true;

      await new Promise(resolve => setTimeout(resolve, 180));
    }

    await refresh();
    return isReady();
  }

  function isReady(){
    return !!(
      state.dbReady &&
      state.authReady &&
      state.db &&
      typeof state.db.ref === 'function'
    );
  }

  function getRoomPath(){
    state.roomPath = normalizeRoomPath(
      window.GJ_BATTLE_ROOM_PATH ||
      window.HHA_GJ_BATTLE_ROOM_PATH ||
      state.roomPath ||
      DEFAULT_ROOM_PATH
    );

    setGlobals();
    return state.roomPath;
  }

  function getRoomRef(roomCode){
    const code = normalizeRoomCode(roomCode);

    if (!code){
      state.lastError = 'missing-room-code';
      setGlobals();
      return null;
    }

    const db = detectDatabase();

    if (!db || typeof db.ref !== 'function'){
      state.lastError = 'database-not-ready';
      state.dbReady = false;
      setGlobals();
      return null;
    }

    const path = getRoomPath() + '/' + code;

    try{
      return db.ref(path);
    }catch(err){
      state.lastError = err && err.message ? err.message : String(err);
      warn('getRoomRef failed', err);
      return null;
    }
  }

  async function getRoom(roomCode){
    const ref = getRoomRef(roomCode);

    if (!ref || typeof ref.once !== 'function'){
      return null;
    }

    try{
      const snap = await ref.once('value');
      return snap && typeof snap.val === 'function'
        ? snap.val() || null
        : null;
    }catch(err){
      state.lastError = err && err.message ? err.message : String(err);
      warn('getRoom failed', err);
      return null;
    }
  }

  async function updateRoom(roomCode, patch){
    const ref = getRoomRef(roomCode);

    if (!ref || typeof ref.update !== 'function'){
      return false;
    }

    try{
      await ref.update(Object.assign({}, patch || {}, {
        updatedAt: now()
      }));
      return true;
    }catch(err){
      state.lastError = err && err.message ? err.message : String(err);
      warn('updateRoom failed', err);
      return false;
    }
  }

  async function updatePlayer(roomCode, playerId, patch){
    const ref = getRoomRef(roomCode);

    playerId = safeString(playerId, '');

    if (!ref || !playerId || typeof ref.child !== 'function'){
      return false;
    }

    try{
      await ref.child('players').child(playerId).update(Object.assign({}, patch || {}, {
        pid: playerId,
        updatedAt: now(),
        lastSeen: now(),
        heartbeatAt: now(),
        authUid: state.authUid || window.GJ_BATTLE_AUTH_UID || ''
      }));
      return true;
    }catch(err){
      state.lastError = err && err.message ? err.message : String(err);
      warn('updatePlayer failed', err);
      return false;
    }
  }

  async function markPlayerLeft(roomCode, playerId){
    return updatePlayer(roomCode, playerId, {
      status: 'left',
      left: true,
      quit: true,
      disconnected: true,
      phase: 'left',
      currentPage: 'left',
      rematchReady: false,
      readyRematch: false,
      nextReady: false
    });
  }

  function makePlayerPatch(base, extra){
    base = base || {};

    const playerId =
      safeString(base.pid || base.playerId || window.GJ_PLAYER_ID || window.MY_PLAYER_ID, 'anon');

    const name =
      safeString(base.name || base.playerName || base.displayName || window.GJ_PLAYER_NAME || window.MY_PLAYER_NAME, 'Hero');

    return Object.assign({
      pid: playerId,
      name: name,
      playerName: name,
      displayName: name,
      view: base.view || base.device || 'pc',
      device: base.device || base.view || 'pc',
      status: 'online',
      phase: 'lobby',
      left: false,
      quit: false,
      disconnected: false,
      score: 0,
      points: 0,
      good: 0,
      junk: 0,
      miss: 0,
      hearts: 3,
      hp: 3,
      lives: 3,
      power: 0,
      attackPower: 0,
      finished: false,
      done: false,
      rematchReady: false,
      readyRematch: false,
      nextReady: false,
      joinedAt: now(),
      updatedAt: now(),
      lastSeen: now(),
      heartbeatAt: now(),
      authUid: state.authUid || window.GJ_BATTLE_AUTH_UID || ''
    }, extra || {});
  }

  function getStatus(){
    return {
      version: VERSION,
      dbReady: !!state.dbReady,
      authReady: !!state.authReady,
      uid: state.authUid || '',
      source: state.source || 'none',
      authSource: state.authSource || 'none',
      lastError: state.lastError || '',
      roomPath: getRoomPath(),
      isReady: isReady()
    };
  }

  const api = {
    version: VERSION,
    state,
    refresh,
    waitForReady,
    ensureAuth,
    detectDatabase,
    detectAuth,
    isReady,
    getStatus,
    getRoomPath,
    getRoomRef,
    getRoom,
    updateRoom,
    updatePlayer,
    markPlayerLeft,
    makePlayerPatch,
    normalizeRoomCode
  };

  window.GJ_BATTLE_FIREBASE_BRIDGE = api;

  setGlobals();

  refresh().then(function(ok){
    setGlobals();

    if (ok){
      log('ready', getStatus());
      dispatchReady();
    }else{
      warn('not ready', getStatus());
    }
  });

  window.addEventListener('load', function(){
    setTimeout(function(){
      refresh().then(function(ok){
        if (ok) dispatchReady();
      });
    }, 120);
  });

  console.info('[GJ Battle Firebase Bridge]', VERSION, 'loaded');
})();
