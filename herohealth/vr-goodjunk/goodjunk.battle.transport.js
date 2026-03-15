// === /herohealth/vr-goodjunk/goodjunk.battle.transport.js ===
// GoodJunk Battle Transport
// FULL PATCH v20260315b-GJ-BATTLE-TRANSPORT-FIREBASE-MOCK

'use strict';

function noop(){}

function makeEmitter(){
  const map = new Map();

  function on(type, fn){
    if(!map.has(type)) map.set(type, new Set());
    map.get(type).add(fn);
    return ()=> off(type, fn);
  }

  function off(type, fn){
    const set = map.get(type);
    if(!set) return;
    set.delete(fn);
    if(!set.size) map.delete(type);
  }

  function emit(type, detail){
    const set = map.get(type);
    if(!set) return;
    for(const fn of set){
      try{ fn(detail); }catch(err){ console.error('[battle.transport] listener error', err); }
    }
  }

  return { on, off, emit };
}

export function createMockTransport(cfg = {}){
  const room = String(cfg.room || 'NO_ROOM');
  const pid = String(cfg.pid || 'anon');
  const nick = String(cfg.nick || pid);

  const PRESENCE_KEY = `HHA_GJ_BATTLE_ROOM:${room}`;
  const SCORE_KEY    = `HHA_GJ_BATTLE_SCORE:${room}`;
  const FINAL_KEY    = `HHA_GJ_BATTLE_RESULT:${room}`;
  const SERIES_KEY   = `HHA_GJ_BATTLE_SERIES:${room}`;
  const REMATCH_KEY  = `HHA_GJ_BATTLE_REMATCH:${room}`;
  const BOARD_KEY    = `HHA_GJ_BATTLE_BOARD:${room}`;

  const PRESENCE_TTL_MS = 4000;
  const emitter = makeEmitter();

  let presenceTimer = null;
  let disposed = false;

  const parse = (raw, fallback)=>{
    try{
      const j = JSON.parse(raw);
      return j ?? fallback;
    }catch{
      return fallback;
    }
  };

  function readArray(key){
    return parse(localStorage.getItem(key) || '[]', []);
  }

  function writeArray(key, rows){
    localStorage.setItem(key, JSON.stringify(rows));
  }

  function readObject(key){
    return parse(localStorage.getItem(key) || '{}', {});
  }

  function writeObject(key, obj){
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function cleanupPresence(rows){
    const now = Date.now();
    return (Array.isArray(rows) ? rows : []).filter(r=>{
      return r && r.pid && (now - Number(r.at || 0) <= PRESENCE_TTL_MS);
    });
  }

  function publishPresence(extra = {}){
    const rows = cleanupPresence(readArray(PRESENCE_KEY)).filter(x => String(x.pid) !== pid);
    rows.push({
      pid,
      nick,
      joined: true,
      at: Date.now(),
      room,
      ...extra
    });
    writeArray(PRESENCE_KEY, rows);
    emitter.emit('presence', { room, players: rows });
  }

  function removePresence(){
    const rows = cleanupPresence(readArray(PRESENCE_KEY)).filter(x => String(x.pid) !== pid);
    writeArray(PRESENCE_KEY, rows);
    emitter.emit('presence', { room, players: rows });
  }

  function publishScore(snapshot){
    const rows = readArray(SCORE_KEY).filter(x => String(x.pid) !== pid);
    rows.push({ ...snapshot, pid, nick, room, at: Date.now() });
    writeArray(SCORE_KEY, rows);
    emitter.emit('score', { room, players: rows });
  }

  function publishFinal(result){
    const rows = readArray(FINAL_KEY).filter(x => String(x.pid) !== pid);
    rows.push({ ...result, pid, nick, room, at: Date.now(), final: true });
    writeArray(FINAL_KEY, rows);
    emitter.emit('final', { room, players: rows });
  }

  function publishSeries(series){
    writeObject(SERIES_KEY, series);
    emitter.emit('series', { room, series });
  }

  function publishRematch(rematch){
    writeObject(REMATCH_KEY, rematch);
    emitter.emit('rematch', { room, rematch });
  }

  function clearRematch(){
    localStorage.removeItem(REMATCH_KEY);
    emitter.emit('rematch', { room, rematch: {} });
  }

  function publishBoard(boardRow){
    const rows = readArray(BOARD_KEY).filter(x => String(x.pid) !== pid);
    rows.push({ ...boardRow, pid, nick, room, at: Date.now() });
    writeArray(BOARD_KEY, rows);
    emitter.emit('board', { room, players: rows });
  }

  function readPresence(){ return cleanupPresence(readArray(PRESENCE_KEY)); }
  function readScores(){ return readArray(SCORE_KEY); }
  function readFinals(){ return readArray(FINAL_KEY); }
  function readSeries(){ return readObject(SERIES_KEY); }
  function readRematch(){ return readObject(REMATCH_KEY); }
  function readBoard(){ return readArray(BOARD_KEY); }

  function start(){
    if(disposed) return;
    publishPresence();

    clearInterval(presenceTimer);
    presenceTimer = setInterval(()=> publishPresence(), 1000);

    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', removePresence);
    window.addEventListener('beforeunload', removePresence);
  }

  function stop(){
    clearInterval(presenceTimer);
    presenceTimer = null;
    removePresence();
    window.removeEventListener('storage', onStorage);
    disposed = true;
  }

  function onStorage(ev){
    if(disposed) return;
    if(ev.key === PRESENCE_KEY) emitter.emit('presence', { room, players: readPresence() });
    if(ev.key === SCORE_KEY) emitter.emit('score', { room, players: readScores() });
    if(ev.key === FINAL_KEY) emitter.emit('final', { room, players: readFinals() });
    if(ev.key === SERIES_KEY) emitter.emit('series', { room, series: readSeries() });
    if(ev.key === REMATCH_KEY) emitter.emit('rematch', { room, rematch: readRematch() });
    if(ev.key === BOARD_KEY) emitter.emit('board', { room, players: readBoard() });
  }

  return {
    kind: 'mock',
    room,
    pid,
    nick,
    start,
    stop,
    on: emitter.on,
    off: emitter.off,

    publishPresence,
    removePresence,
    publishScore,
    publishFinal,
    publishSeries,
    publishRematch,
    clearRematch,
    publishBoard,

    readPresence,
    readScores,
    readFinals,
    readSeries,
    readRematch,
    readBoard
  };
}

export function createFirebaseTransport(cfg = {}){
  const room = String(cfg.room || 'NO_ROOM');
  const pid = String(cfg.pid || 'anon');
  const nick = String(cfg.nick || pid);

  const emitter = makeEmitter();

  let db = null;
  let firebase = null;
  let joinedRef = null;
  let unsubFns = [];
  let presenceTimer = null;
  let disposed = false;

  function getDbOrThrow(){
    db = window.HHA_FIREBASE_DB;
    firebase = window.HHA_FIREBASE;
    if(!db || !firebase) throw new Error('Firebase DB not ready');
    return { db, firebase };
  }

  function rootPath(){
    return `herohealth/goodjunk/battle/${room}`;
  }

  function ref(path){
    const { db } = getDbOrThrow();
    return db.ref(path);
  }

  function normalizeMapToArray(val){
    if(!val || typeof val !== 'object') return [];
    return Object.values(val).filter(Boolean);
  }

  function onValueArray(path, eventName, mapper){
    const r = ref(path);
    const cb = (snap)=>{
      const raw = snap.val();
      const arr = normalizeMapToArray(raw);
      emitter.emit(eventName, mapper ? mapper(arr) : { room, players: arr });
    };
    r.on('value', cb);
    unsubFns.push(()=> r.off('value', cb));
  }

  function onValueObject(path, eventName, mapper){
    const r = ref(path);
    const cb = (snap)=>{
      const raw = snap.val() || {};
      emitter.emit(eventName, mapper ? mapper(raw) : { room, value: raw });
    };
    r.on('value', cb);
    unsubFns.push(()=> r.off('value', cb));
  }

  function publishPresence(extra = {}){
    const now = Date.now();
    const base = {
      pid,
      nick,
      room,
      joined: true,
      at: now
    };
    const pRef = ref(`${rootPath()}/presence/${pid}`);
    pRef.set({ ...base, ...extra });
  }

  function removePresence(){
    try{
      ref(`${rootPath()}/presence/${pid}`).remove();
    }catch(_){}
  }

  function publishScore(snapshot){
    ref(`${rootPath()}/scores/${pid}`).set({
      ...snapshot,
      pid,
      nick,
      room,
      at: Date.now()
    });
  }

  function publishFinal(result){
    ref(`${rootPath()}/finals/${pid}`).set({
      ...result,
      pid,
      nick,
      room,
      at: Date.now(),
      final: true
    });
  }

  function publishSeries(series){
    ref(`${rootPath()}/series`).set(series || {});
  }

  function publishRematch(rematch){
    ref(`${rootPath()}/rematch`).set(rematch || {});
  }

  function clearRematch(){
    ref(`${rootPath()}/rematch`).remove();
  }

  function publishBoard(boardRow){
    ref(`${rootPath()}/board/${pid}`).set({
      ...boardRow,
      pid,
      nick,
      room,
      at: Date.now()
    });
  }

  function readPresence(){ return []; }
  function readScores(){ return []; }
  function readFinals(){ return []; }
  function readSeries(){ return {}; }
  function readRematch(){ return {}; }
  function readBoard(){ return []; }

  function start(){
    if(disposed) return;

    getDbOrThrow();

    joinedRef = ref(`${rootPath()}/presence/${pid}`);
    joinedRef.onDisconnect().remove();
    publishPresence();

    clearInterval(presenceTimer);
    presenceTimer = setInterval(()=> publishPresence(), 1000);

    onValueArray(`${rootPath()}/presence`, 'presence', (players)=>({ room, players }));
    onValueArray(`${rootPath()}/scores`, 'score', (players)=>({ room, players }));
    onValueArray(`${rootPath()}/finals`, 'final', (players)=>({ room, players }));
    onValueObject(`${rootPath()}/series`, 'series', (series)=>({ room, series }));
    onValueObject(`${rootPath()}/rematch`, 'rematch', (rematch)=>({ room, rematch }));
    onValueArray(`${rootPath()}/board`, 'board', (players)=>({ room, players }));
  }

  function stop(){
    clearInterval(presenceTimer);
    presenceTimer = null;

    try{ removePresence(); }catch(_){}

    unsubFns.forEach(fn=>{
      try{ fn(); }catch(_){}
    });
    unsubFns = [];

    disposed = true;
  }

  return {
    kind: 'firebase',
    room,
    pid,
    nick,
    start,
    stop,
    on: emitter.on,
    off: emitter.off,

    publishPresence,
    removePresence,
    publishScore,
    publishFinal,
    publishSeries,
    publishRematch,
    clearRematch,
    publishBoard,

    readPresence,
    readScores,
    readFinals,
    readSeries,
    readRematch,
    readBoard
  };
}

export function createBattleTransport(cfg = {}){
  const mode = String(cfg.net || cfg.transport || 'mock').toLowerCase();
  if(mode === 'firebase') return createFirebaseTransport(cfg);
  return createMockTransport(cfg);
}