// === /herohealth/vr/battle-rtdb.js ===
// HeroHealth Battle RTDB (Duel 2 players) — v3
// ✅ Room lobby UI + autostart + forfeit
// ✅ Rematch (same room, new round) without leaving
// ✅ Spectator view (read-only client)
// ✅ Anti-spam + sanity clamp in pushScore
// ✅ Emits:
//    - hha:battle-players {room, meKey, opponentKey, players}
//    - hha:battle-state   {room, ...state}
//    - hha:battle-ended   {room, a, b, winnerKey, winner, rule, tieReason}
// FULL v20260304-BATTLE-RTDB-DUEL-V3

'use strict';

import { pickWinner, normalizeResult } from './score-rank.js';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function emit(name, detail){ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){} }

// Firebase key tokens not allowed: . # $ [ ]
function safeKey(s, max=24){
  s = String(s||'').trim();
  s = s.replace(/[.#$\[\]]/g, '');
  s = s.replace(/[^a-zA-Z0-9_-]/g, '');
  s = s.slice(0, max);
  return s;
}
function mkRoomCode(){
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'GJ';
  for(let i=0;i<4;i++) s += a[(Math.random()*a.length)|0];
  return s;
}
function mkPlayerKey(){
  return `p_${Math.random().toString(36).slice(2,9)}_${Date.now().toString(36)}`;
}
function getBattleCfg(){
  return WIN.HHA_BATTLE_CFG || WIN.HHA_FIREBASE_CONFIG || null;
}

async function loadFirebase(){
  const v = String(WIN.HHA_FIREBASE_VERSION || '10.12.5');
  const base = `https://www.gstatic.com/firebasejs/${v}`;
  const appMod  = await import(`${base}/firebase-app.js`);
  const dbMod   = await import(`${base}/firebase-database.js`);
  const authMod = await import(`${base}/firebase-auth.js`);
  return { appMod, dbMod, authMod };
}
async function ensureApp(cfg){
  const { appMod } = await loadFirebase();
  const { initializeApp, getApps } = appMod;
  const apps = getApps();
  if(apps && apps.length) return apps[0];
  return initializeApp(cfg);
}
async function ensureAuth(app){
  const { authMod } = await loadFirebase();
  const { getAuth, signInAnonymously } = authMod;
  const auth = getAuth(app);
  try{ if(!auth.currentUser) await signInAnonymously(auth); }catch(e){}
  return auth;
}

function ensureBattleUI(){
  let ov = DOC.getElementById('hhBattleOverlay');
  if(ov) return ov;

  ov = DOC.createElement('div');
  ov.id = 'hhBattleOverlay';
  ov.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    display:none; align-items:center; justify-content:center;
    background: rgba(0,0,0,.55); backdrop-filter: blur(8px);
  `;
  ov.innerHTML = `
    <div style="
      width:min(900px, 94vw);
      border-radius:18px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.88);
      color: rgba(229,231,235,.96);
      box-shadow:0 18px 60px rgba(0,0,0,.45);
      padding:16px;
      font: 900 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;
    ">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <div style="font-size:18px;font-weight:1000">⚔️ GoodJunk Duel</div>
          <div id="hhBattleStatus" style="margin-top:6px;opacity:.92;font-weight:900">—</div>
        </div>
        <div style="text-align:right;opacity:.86;font-weight:900">
          <div>rule: score→acc→miss→medianRT</div>
          <div style="margin-top:4px;font-size:12px">v3: Rematch + Spectator</div>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="hhb btn" id="hhCreateBtn">Create Room</button>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="opacity:.9">Join:</span>
          <input id="hhJoinInput" placeholder="GJXXXX" style="
            width:140px; padding:10px 12px; border-radius:14px;
            border:1px solid rgba(148,163,184,.18);
            background: rgba(2,6,23,.55);
            color: rgba(229,231,235,.96);
            font: 1000 14px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
            letter-spacing:1px;
            text-transform:uppercase;
          "/>
          <button class="hhb btn" id="hhJoinBtn">Join</button>
        </div>

        <div style="margin-left:auto;display:flex;gap:10px;flex-wrap:wrap">
          <button class="hhb btn" id="hhCopyCodeBtn" style="display:none">Copy Code</button>
          <button class="hhb btn" id="hhCopyLinkBtn" style="display:none">Copy Join Link</button>
          <button class="hhb btn" id="hhCopySpectBtn" style="display:none">Copy Spectator Link</button>
          <button class="hhb btn primary" id="hhStartBtn" style="display:none">Start (3s)</button>
          <button class="hhb btn" id="hhBackBtn">Back HUB</button>
        </div>
      </div>

      <div style="margin-top:12px;border:1px solid rgba(148,163,184,.14);border-radius:16px;padding:12px;background:rgba(2,6,23,.55)">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div style="opacity:.92;font-weight:1000">ROOM</div>
          <div id="hhRoomCode" style="
            font: 1000 22px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
            letter-spacing:1px;
            padding:10px 12px;border-radius:14px;
            border:1px solid rgba(148,163,184,.18);
            background: rgba(2,6,23,.45);
            min-width:120px;
          ">—</div>
          <div id="hhPlayers" style="opacity:.9;font-weight:900">players: 0/2</div>
          <div id="hhRound" style="opacity:.85;font-weight:900">round: 1</div>
          <div id="hhSeed" style="opacity:.78;font-weight:900">seed: —</div>
        </div>
        <div id="hhHint" style="margin-top:10px;font-size:12px;opacity:.86;white-space:pre-wrap">
- Create → ได้ code → ส่งให้เพื่อน
- คนที่ 2 Join ใส่ code
- ครบ 2 คน → นับถอยหลัง → เล่นพร้อมกัน
- จบเกม → กด Rematch ในผลลัพธ์ได้ (รอบใหม่ในห้องเดิม)
        </div>
      </div>
    </div>
    <style>
      .hhb.btn{
        pointer-events:auto;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.55);
        color: rgba(229,231,235,.96);
        padding:10px 12px;
        border-radius:14px;
        font-weight:1000;
        cursor:pointer;
      }
      .hhb.btn:hover{ filter:brightness(1.05); }
      .hhb.btn.primary{
        border-color: rgba(99,102,241,.35);
        background: rgba(99,102,241,.22);
      }
    </style>
  `;
  DOC.body.appendChild(ov);
  return ov;
}

export async function initBattle(opts){
  opts = opts || {};
  if(!opts.enabled) return null;

  const cfg = getBattleCfg();
  if(!cfg || !cfg.databaseURL || !cfg.apiKey || !cfg.appId){
    console.warn('[battle] missing config: set window.HHA_BATTLE_CFG = firebaseConfig');
    return null;
  }

  const gameKey = safeKey(opts.gameKey || 'goodjunk', 24) || 'goodjunk';
  const pid = String(opts.pid || qs('pid','anon')).trim() || 'anon';
  const hub = String(opts.hub || qs('hub','../hub.html'));

  const autostartMs = clamp(opts.autostartMs ?? Number(qs('autostart','3000'))||3000, 500, 15000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? Number(qs('forfeit','5000'))||5000, 1000, 30000);

  const spectator = String(opts.spectator ?? qs('spectator','0')) === '1';
  let room = safeKey(opts.room || qs('room',''), 24);
  let role = String(opts.role || qs('brole','')).toLowerCase(); // create|join|''

  const meKey = spectator ? 'spectator' : mkPlayerKey();

  // UI
  const ov = ensureBattleUI();
  const $ = (id)=> DOC.getElementById(id);

  const elStatus = $('hhBattleStatus');
  const elRoom = $('hhRoomCode');
  const elPlayers = $('hhPlayers');
  const elRound = $('hhRound');
  const elSeed = $('hhSeed');

  const btnCreate = $('hhCreateBtn');
  const btnJoin = $('hhJoinBtn');
  const inpJoin = $('hhJoinInput');
  const btnCopyCode = $('hhCopyCodeBtn');
  const btnCopyLink = $('hhCopyLinkBtn');
  const btnCopySpect = $('hhCopySpectBtn');
  const btnStart = $('hhStartBtn');
  const btnBack = $('hhBackBtn');

  const show = (msg)=>{ ov.style.display='flex'; if(elStatus) elStatus.textContent = msg || '—'; };
  const hide = ()=>{ ov.style.display='none'; };
  const setRoomCode = (code)=>{
    if(elRoom) elRoom.textContent = code || '—';
    const has = !!code;
    if(btnCopyCode) btnCopyCode.style.display = has ? 'inline-flex' : 'none';
    if(btnCopyLink) btnCopyLink.style.display = has ? 'inline-flex' : 'none';
    if(btnCopySpect) btnCopySpect.style.display = has ? 'inline-flex' : 'none';
  };

  btnBack?.addEventListener('click', ()=>{ location.href = hub; });

  btnCopyCode?.addEventListener('click', async ()=>{
    try{ await navigator.clipboard.writeText(String(room||'')); show('Copied ✅'); setTimeout(()=>show('—'), 700); }catch(e){}
  });

  function buildJoinLink(code){
    const u = new URL(location.href);
    u.searchParams.set('battle','1');
    u.searchParams.set('brole','join');
    u.searchParams.set('room', String(code||''));
    u.searchParams.delete('spectator');
    return u.toString();
  }
  function buildSpectatorLink(code){
    const u = new URL(location.href);
    u.searchParams.set('battle','1');
    u.searchParams.set('room', String(code||''));
    u.searchParams.set('spectator','1');
    u.searchParams.delete('brole');
    u.searchParams.delete('pid');
    return u.toString();
  }

  btnCopyLink?.addEventListener('click', async ()=>{
    try{
      const link = buildJoinLink(room);
      await navigator.clipboard.writeText(link);
      show('Join link copied ✅');
      setTimeout(()=>show('—'), 800);
    }catch(e){}
  });

  btnCopySpect?.addEventListener('click', async ()=>{
    try{
      const link = buildSpectatorLink(room);
      await navigator.clipboard.writeText(link);
      show('Spectator link copied ✅');
      setTimeout(()=>show('—'), 900);
    }catch(e){}
  });

  // Firebase
  show('Loading Firebase…');
  const { dbMod } = await loadFirebase();
  const { getDatabase, ref, child, get, set, update, onValue, onDisconnect, serverTimestamp, runTransaction, remove } = dbMod;

  const app = await ensureApp(cfg);
  await ensureAuth(app);
  const db = getDatabase(app);

  // server offset
  async function getServerOffsetMs(){
    const snap = await get(ref(db, '.info/serverTimeOffset'));
    return Number(snap.val() || 0);
  }
  const offsetMs = await getServerOffsetMs();
  const serverNow = ()=> Date.now() + offsetMs;

  // Paths
  const root = ref(db, `hha_battle/${gameKey}/rooms`);
  const roomRef = (code)=> child(root, safeKey(code,24));
  const playersRef = (code)=> child(roomRef(code), 'players');
  const stateRef = (code)=> child(roomRef(code), 'state');

  const battle = {
    enabled:true,
    spectator,
    gameKey,
    pid,
    room:'',
    role:'',
    meKey,
    players:{},
    state:{ status:'idle', startAt:null, endAt:null, roomSeed:null, rule:'score→acc→miss→medianRT', round:1 },
    opponentKey:null,
    offsetMs,
    serverNow,
    roomSeed: null,
    startAt: null,
    round: 1,
    pushScore,
    finalizeEnd,
    requestRematch,
    destroy,
    getOpponent
  };

  let unsubRoom = null;
  let pingInt = 0;

  function computeOpponent(){
    const keys = Object.keys(battle.players||{});
    battle.opponentKey = keys.find(k => k !== meKey) || null;
    return battle.opponentKey;
  }
  function getOpponent(){
    const k = computeOpponent();
    return k ? (battle.players?.[k] || null) : null;
  }

  async function ensureRoomState(code){
    await runTransaction(stateRef(code), (cur)=>{
      if(cur) return cur;
      const t0 = serverNow();
      return {
        status: 'waiting',
        createdAt: t0,
        startAt: null,
        endAt: null,
        round: 1,
        roomSeed: `seed_${Math.floor(t0)}`,
        rule: 'score→acc→miss→medianRT',
        autostartMs,
        forfeitMs,
        winner: '',
        reason: '',
        rematch: { want: {} }
      };
    });
  }

  async function joinAsPlayer(code){
    if(spectator) return;

    const myRef = child(playersRef(code), meKey);
    const t = serverNow();
    await set(myRef, {
      pid,
      name: String(opts.name || qs('name', pid) || pid).slice(0,24),
      joinedAt: t,
      lastSeen: t,
      connected: true,
      score: 0,
      miss: 0,
      accPct: 0,
      medianRtGoodMs: 0,
      ended: false,
      endSummary: null
    });

    try{ await onDisconnect(myRef).remove(); }catch(e){}
    try{ await onDisconnect(myRef).update({ connected:false, lastSeen: serverTimestamp() }); }catch(e){}
    try{ await update(myRef, { connected:true, lastSeen: serverTimestamp() }); }catch(e){}
  }

  async function tryAutostart(code){
    await runTransaction(stateRef(code), (cur)=>{
      cur = cur || {};
      if(cur.status !== 'waiting') return cur;

      const p = battle.players || {};
      if(Object.keys(p).length < 2) return cur;

      const st = serverNow() + autostartMs;
      return { ...cur, status:'countdown', startAt: st, winner:'', reason:'' };
    });
  }

  async function ensurePlayingAtStart(code){
    const st = Number(battle.state?.startAt || 0);
    if(!st) return;
    if(battle.state?.status !== 'countdown') return;
    if(serverNow() < st) return;

    await runTransaction(stateRef(code), (cur)=>{
      cur = cur || {};
      if(cur.status === 'countdown') cur.status = 'playing';
      return cur;
    });
  }

  // ---------- anti-spam + sanity ----------
  let lastPushAt = 0;
  async function pushScore(payload){
    if(!battle.room || spectator) return;
    const t = Date.now();
    if(t - lastPushAt < 120) return; // <= ~8Hz
    lastPushAt = t;

    const d = payload || {};
    const score = clamp(d.score, 0, 999999) | 0;
    const miss  = clamp(d.miss, 0, 9999) | 0;
    const accPct = clamp(d.accPct, 0, 100);
    const medRt = clamp(d.medianRtGoodMs, 0, 20000) | 0;

    const code = battle.room;
    const myRef = child(playersRef(code), meKey);
    try{
      await update(myRef, {
        score,
        miss,
        accPct,
        medianRtGoodMs: medRt,
        lastSeen: serverTimestamp(),
        connected: true
      });
    }catch(e){}
  }

  async function finalizeEnd(endSummary){
    if(!battle.room || spectator) return;
    const code = battle.room;
    const myRef = child(playersRef(code), meKey);
    const endedAt = serverNow();
    try{
      await update(myRef, { ended:true, endSummary: { ...(endSummary||{}), ts: endedAt }, lastSeen: serverTimestamp(), connected:true });
    }catch(e){}
  }

  // ---------- Rematch v3 ----------
  // Rule:
  // - only when state.status === 'ended'
  // - both players set rematch.want[playerKey]=1
  // - then state becomes 'waiting' (round+1) and players reset ended+scores
  async function requestRematch(){
    if(!battle.room || spectator) return false;
    const code = battle.room;

    try{
      await runTransaction(stateRef(code), (cur)=>{
        cur = cur || {};
        cur.rematch = cur.rematch || { want:{} };
        cur.rematch.want = cur.rematch.want || {};
        cur.rematch.want[meKey] = 1;
        return cur;
      }, { applyLocally:false });
      return true;
    }catch(e){
      return false;
    }
  }

  async function maybeStartRematchIfBothWant(code){
    if(String(battle.state?.status) !== 'ended') return;

    const p = battle.players || {};
    const keys = Object.keys(p);
    if(keys.length < 2) return;

    const want = battle.state?.rematch?.want || {};
    const allWant = keys.every(k => !!want[k]);
    if(!allWant) return;

    // reset state & players atomically-ish
    const t0 = serverNow();
    const nextRound = clamp(Number(battle.state.round||1) + 1, 1, 999);

    await runTransaction(stateRef(code), (cur)=>{
      cur = cur || {};
      if(cur.status !== 'ended') return cur;

      const newSeed = `seed_${Math.floor(t0)}_r${nextRound}`;
      return {
        ...cur,
        status: 'waiting',
        startAt: null,
        endAt: null,
        winner: '',
        reason: 'rematch',
        round: nextRound,
        roomSeed: newSeed,
        rematch: { want: {} }
      };
    }, { applyLocally:false });

    // reset player nodes (best-effort)
    try{
      for(const k of keys){
        const pr = child(playersRef(code), k);
        await update(pr, {
          score: 0, miss: 0, accPct: 0, medianRtGoodMs: 0,
          ended: false, endSummary: null,
          connected: true, lastSeen: serverTimestamp()
        });
      }
    }catch(e){}
  }

  async function maybeComputeWinner(code){
    if(String(battle.state?.status) !== 'ended') return;

    const p = battle.players || {};
    const keys = Object.keys(p);
    if(keys.length < 2) return;

    const aKey = keys[0], bKey = keys[1];
    const Araw = p[aKey]?.endSummary || p[aKey] || null;
    const Braw = p[bKey]?.endSummary || p[bKey] || null;

    const a = normalizeResult({ ...Araw, pid: p[aKey]?.pid, room: code, gameKey });
    const b = normalizeResult({ ...Braw, pid: p[bKey]?.pid, room: code, gameKey });

    const w = pickWinner(a, b);
    const winnerKey = (w.winner === 'A') ? aKey : (w.winner === 'B') ? bKey : '';

    // write winner once
    try{
      await runTransaction(stateRef(code), (cur)=>{
        cur = cur || {};
        if(cur.winner) return cur;
        cur.winner = winnerKey || '';
        cur.reason = String(cur.reason||'ended');
        return cur;
      }, { applyLocally:false });
    }catch(e){}

    emit('hha:battle-ended', {
      room: code,
      a, b,
      winnerKey,
      winner: winnerKey ? (winnerKey===meKey ? 'ME' : 'OPP') : 'TIE',
      rule: 'score→acc→miss→medianRT',
      tieReason: w.reason
    });
  }

  async function maybeEndRoomByForfeit(code){
    if(String(battle.state?.status) !== 'playing') return;

    const keys = Object.keys(battle.players||{});
    if(keys.length < 2) return;

    const oppKey = battle.opponentKey;
    const opp = oppKey ? battle.players?.[oppKey] : null;
    if(!opp) return;

    const lastSeen = Number(opp.lastSeen||0);
    const stale = (serverNow() - lastSeen) > 3500;
    const disconnected = (!opp.connected) || stale;
    if(!disconnected) return;

    const deadline = serverNow() + forfeitMs;

    await runTransaction(stateRef(code), (cur)=>{
      cur = cur || {};
      if(cur.status !== 'playing') return cur;
      if(cur.forfeit && cur.forfeit.active) return cur;
      cur.forfeit = { active:true, victim: oppKey, deadline };
      return cur;
    }, { applyLocally:false });

    const f = battle.state?.forfeit || {};
    if(f.active && Number(f.deadline||0) && serverNow() >= Number(f.deadline||0)){
      await runTransaction(stateRef(code), (cur)=>{
        cur = cur || {};
        if(cur.status === 'ended') return cur;
        cur.status = 'ended';
        cur.endAt = serverNow();
        cur.winner = meKey;
        cur.reason = 'forfeit';
        return cur;
      }, { applyLocally:false });
    }
  }

  async function maybeEndRoomWhenBothEnded(code){
    const p = battle.players || {};
    const keys = Object.keys(p);
    if(keys.length < 2) return;

    const endedCount = keys.filter(k=> !!p[k]?.ended).length;
    if(endedCount < 2) return;

    await runTransaction(stateRef(code), (cur)=>{
      cur = cur || {};
      if(cur.status === 'ended') return cur;
      cur.status = 'ended';
      cur.endAt = serverNow();
      cur.reason = 'both-ended';
      return cur;
    }, { applyLocally:false });
  }

  async function enterRoom(code, asRole){
    code = safeKey(code, 24);
    if(!code) throw new Error('NO_ROOM');

    room = code;
    battle.room = code;
    battle.role = asRole;

    setRoomCode(code);
    show(spectator ? 'Spectator connected…' : (asRole === 'create' ? 'Room created. Share code.' : 'Joined. Waiting…'));

    await ensureRoomState(code);
    await joinAsPlayer(code);

    if(unsubRoom) try{ unsubRoom(); }catch(e){}
    const rr = roomRef(code);

    unsubRoom = onValue(rr, (snap)=>{
      const val = snap.val() || null;
      if(!val){ show('ROOM_NOT_FOUND'); return; }

      battle.players = val.players || {};
      battle.state   = val.state || { status:'waiting', round:1 };

      battle.roomSeed = String(battle.state.roomSeed || '');
      battle.startAt  = Number(battle.state.startAt || 0);
      battle.round    = Number(battle.state.round || 1);

      computeOpponent();

      const n = Object.keys(battle.players||{}).length;
      if(elPlayers) elPlayers.textContent = `players: ${n}/2`;
      if(elRound) elRound.textContent = `round: ${battle.round|0}`;
      if(elSeed) elSeed.textContent = `seed: ${battle.roomSeed || '—'}`;

      emit('hha:battle-players', { room: code, meKey, opponentKey: battle.opponentKey, players: battle.players });
      emit('hha:battle-state', { room: code, ...battle.state });

      if(btnStart){
        if(!spectator && asRole === 'create' && n >= 2 && battle.state.status === 'waiting'){
          btnStart.style.display = 'inline-flex';
        }else{
          btnStart.style.display = 'none';
        }
      }

      if(battle.state.status === 'waiting'){
        show(spectator ? `Spectator: lobby (${n}/2)` : (n < 2 ? 'Waiting for opponent…' : 'Opponent joined. Starting soon…'));
        if(!spectator && n >= 2) tryAutostart(code).catch(()=>{});
      }else if(battle.state.status === 'countdown'){
        const st = Number(battle.state.startAt||0);
        const rem = st ? Math.max(0, Math.ceil((st - serverNow())/1000)) : 3;
        show(`Starting… ${rem}s`);
        ensurePlayingAtStart(code).catch(()=>{});
      }else if(battle.state.status === 'playing'){
        hide();
      }else if(battle.state.status === 'ended'){
        show(spectator ? 'Ended (spectator)' : 'Ended');
        maybeComputeWinner(code).catch(()=>{});
      }
    });

    // manual start (host)
    btnStart && (btnStart.onclick = async ()=>{
      if(spectator) return;
      try{
        await runTransaction(stateRef(code), (cur)=>{
          cur = cur || {};
          const p = battle.players || {};
          const n = Object.keys(p).length;
          if(cur.status !== 'waiting') return cur;
          if(n < 2) return cur;
          return { ...cur, status:'countdown', startAt: serverNow() + autostartMs, winner:'', reason:'' };
        }, { applyLocally:false });
      }catch(e){}
    });

    // heartbeat / housekeeping
    if(pingInt) clearInterval(pingInt);
    pingInt = setInterval(async ()=>{
      try{
        if(!battle.room) return;

        if(!spectator){
          const myRef = child(playersRef(battle.room), meKey);
          await update(myRef, { lastSeen: serverTimestamp(), connected:true });
        }

        await ensurePlayingAtStart(battle.room);
        if(!spectator){
          await maybeEndRoomByForfeit(battle.room);
          await maybeEndRoomWhenBothEnded(battle.room);
          await maybeStartRematchIfBothWant(battle.room);
        }
        await maybeComputeWinner(battle.room);
      }catch(e){}
    }, 600);
  }

  // UI actions
  btnCreate?.addEventListener('click', async ()=>{
    try{
      if(spectator){ show('Spectator cannot create'); return; }
      const code = mkRoomCode();
      role = 'create';
      await enterRoom(code, 'create');
      const u = new URL(location.href);
      u.searchParams.set('battle','1');
      u.searchParams.set('brole','create');
      u.searchParams.set('room', code);
      u.searchParams.delete('spectator');
      history.replaceState({}, '', u.toString());
    }catch(e){
      console.warn(e);
      show('Create failed');
    }
  });

  btnJoin?.addEventListener('click', async ()=>{
    try{
      if(spectator){ show('Spectator cannot join as player'); return; }
      const code = safeKey(inpJoin?.value || '', 24).toUpperCase();
      if(!code){ show('Please enter code'); return; }
      role = 'join';
      await enterRoom(code, 'join');
      const u = new URL(location.href);
      u.searchParams.set('battle','1');
      u.searchParams.set('brole','join');
      u.searchParams.set('room', code);
      u.searchParams.delete('spectator');
      history.replaceState({}, '', u.toString());
    }catch(e){
      console.warn(e);
      show('Join failed');
    }
  });

  // auto from URL
  const battleOn = (String(qs('battle','0')) === '1') || !!opts.forceUI;
  if(!battleOn) return null;

  show(spectator ? 'Spectator lobby' : 'Battle lobby');
  setRoomCode(room || '');

  if(room){
    role = spectator ? '' : (role || 'join');
    await enterRoom(room, spectator ? '' : (role === 'create' ? 'create' : 'join'));
  }

  WIN.__HHA_BATTLE__ = battle;
  return battle;

  async function destroy(){
    if(pingInt) clearInterval(pingInt);
    pingInt = 0;
    try{ unsubRoom && unsubRoom(); }catch(e){}
    // spectator doesn't have player node
    if(!spectator && battle.room){
      try{
        const myRef = child(playersRef(battle.room), meKey);
        await remove(myRef);
      }catch(e){}
    }
  }
}