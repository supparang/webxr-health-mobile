// === /herohealth/vr-goodjunk/goodjunk-battle-room-bootstrap.js ===
// FULL PATCH v20260501-GJ-BATTLE-BOOTSTRAP-ROUNDID-COUNTDOWN-SERVER-TIME
// ✅ Firebase Realtime Database adapter for GoodJunk Battle rooms
// ✅ loadRoom / saveRoom / patchRoom / subscribeRoom
// ✅ getServerNowMs via /.info/serverTimeOffset
// ✅ Anonymous auth when available
// ✅ Full room set on saveRoom
// ✅ Safe merge on patchRoom
// ✅ Exposes:
//    window.HHA_BATTLE_ROOM_ADAPTER
//    window.GJRoomAPI
//    window.HHRoomAPI

(function(){
  'use strict';

  const ADAPTER_VERSION = 'v20260501-GJ-BATTLE-BOOTSTRAP-ROUNDID-COUNTDOWN-SERVER-TIME';

  const DEFAULT_ROOT =
    window.HHA_BATTLE_ROOM_ROOT ||
    window.GJ_BATTLE_ROOM_ROOT ||
    'herohealth/goodjunk/battleRooms';

  const LOCAL_PREFIX = 'GJ_ROOM_LOCAL_BOOTSTRAP:';

  function clean(v, d = ''){
    const s = String(v ?? '').trim();
    return s || d;
  }

  function nowMs(){
    return Date.now();
  }

  function safeJsonParse(text, fallback = null){
    try{
      return JSON.parse(text);
    }catch(_){
      return fallback;
    }
  }

  function clone(obj){
    try{
      return JSON.parse(JSON.stringify(obj || {}));
    }catch(_){
      return obj || {};
    }
  }

  function sanitizeFirebaseKey(key){
    return clean(key, 'room')
      .replace(/[.#$/[\]]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80);
  }

  function roomPath(roomId){
    const safeRoom = sanitizeFirebaseKey(roomId);
    return `${DEFAULT_ROOT}/${safeRoom}`;
  }

  function hasFirebase(){
    return !!(
      window.firebase &&
      typeof window.firebase.initializeApp === 'function' &&
      typeof window.firebase.database === 'function'
    );
  }

  function getDb(){
    if(!hasFirebase()) return null;

    try{
      return firebase.database();
    }catch(err){
      console.warn('[GJ Battle Bootstrap] database unavailable', err);
      return null;
    }
  }

  async function ensureAuth(){
    try{
      if(!window.firebase || typeof firebase.auth !== 'function') return;

      const auth = firebase.auth();
      if(!auth) return;

      if(auth.currentUser) return;

      if(typeof auth.signInAnonymously === 'function'){
        await auth.signInAnonymously();
      }
    }catch(err){
      // Some RTDB rules may allow public write/read, so auth failure should not block.
      console.warn('[GJ Battle Bootstrap] anonymous auth skipped/failed', err);
    }
  }

  async function ensureReady(){
    if(!hasFirebase()) return false;

    await ensureAuth();

    const db = getDb();
    return !!db;
  }

  function normalizeRoom(roomId, payload){
    const room = payload && typeof payload === 'object' ? clone(payload) : {};

    const now = nowMs();

    return {
      roomId: clean(room.roomId || roomId, roomId),
      mode: clean(room.mode, 'battle'),
      status: clean(room.status, 'waiting'),

      currentRoundId: clean(room.currentRoundId, ''),
      roundSeq: Number(room.roundSeq || 0) || 0,

      hostPid: clean(room.hostPid, ''),
      createdAt: Number(room.createdAt || 0) || now,
      updatedAt: Number(room.updatedAt || 0) || now,
      startedAt: Number(room.startedAt || 0) || 0,
      battleStartAt: Number(room.battleStartAt || 0) || 0,
      endedAt: Number(room.endedAt || 0) || 0,

      players:
        room.players && typeof room.players === 'object'
          ? room.players
          : {},

      attacks:
        Array.isArray(room.attacks)
          ? room.attacks
          : [],

      effects:
        Array.isArray(room.effects)
          ? room.effects
          : [],

      lastAttackAt: Number(room.lastAttackAt || 0) || 0,
      matchEnd:
        room.matchEnd && typeof room.matchEnd === 'object'
          ? room.matchEnd
          : null
    };
  }

  function localKey(roomId){
    return `${LOCAL_PREFIX}${sanitizeFirebaseKey(roomId)}`;
  }

  function localLoadRoom(roomId){
    try{
      const raw = localStorage.getItem(localKey(roomId));
      const parsed = safeJsonParse(raw, null);
      return parsed ? normalizeRoom(roomId, parsed) : null;
    }catch(_){
      return null;
    }
  }

  function localSaveRoom(roomId, payload){
    const room = normalizeRoom(roomId, payload);
    room.updatedAt = nowMs();

    try{
      localStorage.setItem(localKey(roomId), JSON.stringify(room));
    }catch(_){}

    return room;
  }

  function mergeRoom(prev, patch){
    const base = prev && typeof prev === 'object' ? clone(prev) : {};
    const p = patch && typeof patch === 'object' ? clone(patch) : {};

    const merged = {
      ...base,
      ...p
    };

    if(p.players && typeof p.players === 'object'){
      merged.players = {
        ...(base.players && typeof base.players === 'object' ? base.players : {}),
        ...p.players
      };
    }else if(base.players && typeof base.players === 'object'){
      merged.players = base.players;
    }else{
      merged.players = {};
    }

    if(Array.isArray(p.attacks)){
      merged.attacks = p.attacks;
    }else if(Array.isArray(base.attacks)){
      merged.attacks = base.attacks;
    }else{
      merged.attacks = [];
    }

    if(Array.isArray(p.effects)){
      merged.effects = p.effects;
    }else if(Array.isArray(base.effects)){
      merged.effects = base.effects;
    }else{
      merged.effects = [];
    }

    if('matchEnd' in p){
      merged.matchEnd = p.matchEnd;
    }else if('matchEnd' in base){
      merged.matchEnd = base.matchEnd;
    }else{
      merged.matchEnd = null;
    }

    merged.updatedAt = Number(p.updatedAt || 0) || nowMs();

    return merged;
  }

  function makeLocalFallbackAdapter(){
    function loadRoom(roomId){
      return Promise.resolve(localLoadRoom(roomId));
    }

    function saveRoom(roomId, payload){
      return Promise.resolve(localSaveRoom(roomId, payload));
    }

    async function patchRoom(roomId, patch){
      const prev = localLoadRoom(roomId) || {};
      const merged = mergeRoom(prev, patch);
      return localSaveRoom(roomId, merged);
    }

    function subscribeRoom(roomId, callback){
      if(typeof callback !== 'function') return function(){};

      const emit = () => {
        try{
          callback(localLoadRoom(roomId));
        }catch(_){}
      };

      const onStorage = (ev) => {
        if(!ev || ev.key === localKey(roomId)) emit();
      };

      window.addEventListener('storage', onStorage);

      const timer = setInterval(emit, 700);
      emit();

      return function unsubscribe(){
        try{ window.removeEventListener('storage', onStorage); }catch(_){}
        try{ clearInterval(timer); }catch(_){}
      };
    }

    async function getServerNowMs(){
      return Date.now();
    }

    return {
      type: 'local-fallback-room-adapter',
      version: ADAPTER_VERSION,
      root: 'localStorage',
      loadRoom,
      saveRoom,
      patchRoom,
      subscribeRoom,
      getServerNowMs
    };
  }

  function makeFirebaseAdapter(){
    async function loadRoom(roomId){
      const ok = await ensureReady();

      if(!ok){
        return localLoadRoom(roomId);
      }

      try{
        const snap = await firebase.database()
          .ref(roomPath(roomId))
          .once('value');

        const val = snap.val();

        if(!val) return null;

        return normalizeRoom(roomId, val);
      }catch(err){
        console.warn('[GJ Battle Bootstrap] loadRoom failed, using local fallback', err);
        return localLoadRoom(roomId);
      }
    }

    async function saveRoom(roomId, payload){
      const room = normalizeRoom(roomId, payload);
      room.updatedAt = Number(room.updatedAt || 0) || nowMs();

      const ok = await ensureReady();

      if(!ok){
        return localSaveRoom(roomId, room);
      }

      try{
        await firebase.database()
          .ref(roomPath(roomId))
          .set(room);

        return room;
      }catch(err){
        console.warn('[GJ Battle Bootstrap] saveRoom failed, using local fallback', err);
        return localSaveRoom(roomId, room);
      }
    }

    async function patchRoom(roomId, patch){
      const ok = await ensureReady();

      if(!ok){
        const prev = localLoadRoom(roomId) || {};
        const merged = normalizeRoom(roomId, mergeRoom(prev, patch));
        return localSaveRoom(roomId, merged);
      }

      try{
        const ref = firebase.database().ref(roomPath(roomId));
        const snap = await ref.once('value');
        const prev = snap.val() || {};

        const merged = normalizeRoom(roomId, mergeRoom(prev, patch));

        // Important:
        // ใช้ set ทั้ง room เพื่อให้ arrays/status/matchEnd/currentRoundId ตรงกันทุกเครื่อง
        // และลดปัญหา update แบบ shallow ที่ทำให้ field เก่าค้าง
        await ref.set(merged);

        return merged;
      }catch(err){
        console.warn('[GJ Battle Bootstrap] patchRoom failed, using local fallback', err);

        const prev = localLoadRoom(roomId) || {};
        const merged = normalizeRoom(roomId, mergeRoom(prev, patch));
        return localSaveRoom(roomId, merged);
      }
    }

    function subscribeRoom(roomId, callback){
      if(typeof callback !== 'function') return function(){};

      let firebaseRef = null;
      let firebaseHandler = null;
      let stopped = false;
      let localTimer = null;

      function emitLocal(){
        if(stopped) return;
        try{
          callback(localLoadRoom(roomId));
        }catch(_){}
      }

      function startLocalFallback(){
        if(localTimer) return;
        localTimer = setInterval(emitLocal, 750);
        emitLocal();
      }

      ensureReady().then((ok) => {
        if(stopped) return;

        if(!ok){
          startLocalFallback();
          return;
        }

        try{
          firebaseRef = firebase.database().ref(roomPath(roomId));
          firebaseHandler = firebaseRef.on('value', (snap) => {
            if(stopped) return;

            const val = snap.val();
            const room = val ? normalizeRoom(roomId, val) : null;

            try{
              callback(room);
            }catch(_){}
          }, (err) => {
            console.warn('[GJ Battle Bootstrap] subscribeRoom error, using local fallback', err);
            startLocalFallback();
          });
        }catch(err){
          console.warn('[GJ Battle Bootstrap] subscribeRoom failed, using local fallback', err);
          startLocalFallback();
        }
      });

      return function unsubscribe(){
        stopped = true;

        try{
          if(firebaseRef && firebaseHandler){
            firebaseRef.off('value', firebaseHandler);
          }
        }catch(_){}

        try{
          if(localTimer) clearInterval(localTimer);
        }catch(_){}
      };
    }

    async function getServerNowMs(){
      const ok = await ensureReady();

      if(!ok) return Date.now();

      try{
        const snap = await firebase.database()
          .ref('/.info/serverTimeOffset')
          .once('value');

        const offset = Number(snap.val() || 0);
        return Date.now() + offset;
      }catch(err){
        console.warn('[GJ Battle Bootstrap] getServerNowMs failed', err);
        return Date.now();
      }
    }

    return {
      type: 'firebase-room-adapter',
      version: ADAPTER_VERSION,
      root: DEFAULT_ROOT,
      loadRoom,
      saveRoom,
      patchRoom,
      subscribeRoom,
      getServerNowMs
    };
  }

  const adapter = hasFirebase()
    ? makeFirebaseAdapter()
    : makeLocalFallbackAdapter();

  window.HHA_BATTLE_ROOM_ADAPTER = adapter;
  window.GJRoomAPI = adapter;
  window.HHRoomAPI = adapter;

  window.GJ_BATTLE_BOOTSTRAP_VERSION = ADAPTER_VERSION;

  console.info('[GJ Battle Bootstrap] ready:', adapter.type, ADAPTER_VERSION);
})();
