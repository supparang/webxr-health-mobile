// === /herohealth/vr-goodjunk/goodjunk-race.js ===
// GoodJunk RACE Controller — 2-10 players (Supabase RoomBus)
// - Sync seed + startAt (countdown) for fair play
// - Hold game via ?wait=1 then __GJ_START_NOW__()
// - Live scoreboard overlay
// - Winner: first "win" end; fallback rank by score→good→acc→miss→medianRT
// FULL v20260304-RACE-2TO10-COUNTDOWN-SEED-SCOREBOARD
'use strict';

import { createRoomBus } from '../vr/room-bus.js';

const WIN = window;
const DOC = document;

const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); };
const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

function ensureOverlay(){
  let root = DOC.getElementById('gjRaceOverlay');
  if(root) return root;

  root = DOC.createElement('div');
  root.id = 'gjRaceOverlay';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.pointerEvents = 'none';
  root.style.zIndex = '300';
  root.innerHTML = `
    <div style="
      position:absolute; left:10px; top:10px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.55);
      color:rgba(229,231,235,.96);
      border-radius:16px;
      padding:10px 10px;
      min-width:250px;
      max-width:min(420px, calc(100vw - 20px));
      box-shadow:0 18px 60px rgba(0,0,0,.35);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      font: 900 12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
      pointer-events:auto;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div>
          <div style="font-size:12px; opacity:.85;">🏁 RACE ROOM</div>
          <div id="rrTitle" style="font-size:14px;">—</div>
        </div>
        <div id="rrBadge" style="
          padding:6px 10px; border-radius:999px;
          border:1px solid rgba(34,197,94,.25);
          background:rgba(34,197,94,.12);
          font-weight:1000;">READY</div>
      </div>

      <div style="height:8px"></div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; opacity:.92">
        <div id="rrInfo" style="flex:1">—</div>
      </div>

      <div style="height:8px"></div>

      <div id="rrCountdown" style="
        display:none;
        border-radius:14px;
        border:1px solid rgba(251,191,36,.22);
        background:rgba(251,191,36,.10);
        padding:10px 10px;
        text-align:center;
        font-size:18px;">3</div>

      <div style="height:8px"></div>

      <div style="opacity:.85;">Scoreboard</div>
      <div id="rrBoard" style="
        margin-top:6px;
        border:1px solid rgba(148,163,184,.14);
        border-radius:14px;
        background:rgba(2,6,23,.35);
        max-height:240px;
        overflow:auto;
      "></div>

      <div id="rrHint" style="margin-top:8px; opacity:.8; font-size:11px;">
        กติกา: ใคร CLEAR ก่อนชนะ (ถึง score หรือ good เป้าก็ได้) • ถ้าไม่ clear → จัดอันดับ score→good→acc→miss→medRT
      </div>
    </div>
  `;
  DOC.body.appendChild(root);
  return root;
}

function formatLine(p){
  const name = (p.nick || p.playerId || '—');
  const rank = p.rank != null ? `${p.rank}. ` : '';
  const tag = p.done ? (p.win ? '✅CLEAR' : '⏱END') : (p.joined ? '…' : '—');
  const s = (p.score|0);
  const g = (p.goodCount|0);
  const a = (p.accPct|0);
  const m = (p.miss|0);
  const rt = (p.medianRtGoodMs|0);

  return `
    <div style="
      display:flex; align-items:center; justify-content:space-between;
      gap:10px; padding:8px 10px;
      border-top:1px solid rgba(148,163,184,.10);
    ">
      <div style="min-width:0;">
        <div style="font-weight:1000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${rank}${name} <span style="opacity:.7">${tag}</span>
        </div>
        <div style="opacity:.78; font-size:11px;">
          score ${s} • good ${g} • acc ${a}% • miss ${m} • medRT ${rt}ms
        </div>
      </div>
      <div style="font-weight:1000; opacity:.95; white-space:nowrap;">
        ${p.clearMs != null ? `${Math.round(p.clearMs)}ms` : ''}
      </div>
    </div>`;
}

function rankPlayers(list){
  // winner first: done+win with smallest clearMs
  // others: score desc → good desc → acc desc → miss asc → medRT asc
  const a = list.slice();
  a.sort((x,y)=>{
    const xWin = !!x.win, yWin = !!y.win;
    if(xWin && yWin){
      return (x.clearMs||1e18) - (y.clearMs||1e18);
    }
    if(xWin !== yWin) return xWin ? -1 : 1;

    const xs = x.score|0, ys = y.score|0; if(xs!==ys) return ys - xs;
    const xg = x.goodCount|0, yg = y.goodCount|0; if(xg!==yg) return yg - xg;
    const xa = x.accPct|0, ya = y.accPct|0; if(xa!==ya) return ya - xa;
    const xm = x.miss|0, ym = y.miss|0; if(xm!==ym) return xm - ym;
    const xr = x.medianRtGoodMs|0, yr = y.medianRtGoodMs|0; if(xr!==yr) return xr - yr;
    return String(x.playerId||'').localeCompare(String(y.playerId||''));
  });
  a.forEach((p,i)=> p.rank = i+1);
  return a;
}

export async function bootRace(){
  const mode = String(qs('mode','')).toLowerCase();
  if(mode !== 'race') return;

  const pid = String(qs('pid','anon')).trim() || 'anon';
  const nick = String(qs('nick', pid)).trim() || pid;
  const room = String(qs('room','')).trim();
  const sbUrl = String(qs('sbUrl','')).trim();
  const sbAnon = String(qs('sbAnon','')).trim();

  const overlay = ensureOverlay();
  const $t = (id)=> overlay.querySelector(id);

  $t('#rrTitle').textContent = room ? room : '(no room)';
  $t('#rrInfo').textContent = `you=${nick} • players 2–10 • sync seed+countdown`;

  // Hold game until start (requires safe.js patch wait-start)
  try{ WIN.__GJ_SET_PAUSED__?.(true); }catch(e){}

  const bus = createRoomBus({
    roomId: room,
    playerId: pid,
    nick,
    team: '',
    supabaseUrl: sbUrl,
    supabaseAnon: sbAnon,
    maxPlayers: 10
  });
  await bus.ready;

  const state = {
    seed: String(qs('seed', String(Date.now()))),
    startAtMs: null,      // absolute nowMs() at start
    countdownSec: clamp(qs('cd','3'), 2, 6),
    started: false,
    ended: false,
    roster: new Map(),    // playerId -> row
    lastSelf: null,
    winnerId: null
  };

  function upsert(p){
    const id = String(p.playerId||'');
    if(!id) return;
    const prev = state.roster.get(id) || {};
    state.roster.set(id, Object.assign({}, prev, p, { playerId:id, joined:true }));
  }

  function redraw(){
    const list = Array.from(state.roster.values());
    const ranked = rankPlayers(list);
    const board = $t('#rrBoard');
    if(board){
      const html = ranked.map(formatLine).join('');
      board.innerHTML = html || `<div style="padding:10px 10px; opacity:.8;">รอผู้เล่นเข้าห้อง…</div>`;
    }

    const badge = $t('#rrBadge');
    if(badge){
      if(state.ended) badge.textContent = 'END';
      else if(state.started) badge.textContent = 'GO!';
      else badge.textContent = 'READY';
    }
  }

  function broadcastHostConfig(){
    // host announces seed + startAt
    const payload = {
      t:'cfg',
      seed: state.seed,
      startAtMs: state.startAtMs,
      cd: state.countdownSec
    };
    bus.send(payload);
  }

  // presence tick
  const presLoop = setInterval(()=>{
    try{
      const pres = bus.getPresence() || [];
      pres.forEach(p=>{
        upsert({ playerId: p.playerId, nick: p.nick, joinedAt: p.joinedAt });
      });
      redraw();
    }catch(e){}
  }, 700);

  // Host election + autostart policy:
  // Host (earliest join) starts when players>=2 OR after 25s if alone (for testing)
  let hostStartTimer = null;
  function maybeHostPlanStart(){
    if(state.started || state.ended) return;
    if(!bus.isHost) return;

    const n = (bus.getPresence()||[]).length;
    if(n >= 2){
      const delay = state.countdownSec * 1000;
      state.startAtMs = nowMs() + delay;
      broadcastHostConfig();
      startCountdownUI();
      return;
    }

    if(!hostStartTimer){
      hostStartTimer = setTimeout(()=>{
        if(state.started || state.ended) return;
        if(!bus.isHost) return;
        state.startAtMs = nowMs() + state.countdownSec*1000;
        broadcastHostConfig();
        startCountdownUI();
      }, 25000);
    }
  }

  function applyCfg(cfg){
    if(!cfg) return;
    if(cfg.seed && String(cfg.seed) !== state.seed){
      state.seed = String(cfg.seed);
      // force reload with same seed to ensure determinism
      const u = new URL(location.href);
      u.searchParams.set('seed', state.seed);
      u.searchParams.set('wait','1');
      location.replace(u.toString());
      return;
    }
    if(cfg.startAtMs && !state.startAtMs){
      state.startAtMs = Number(cfg.startAtMs) || null;
      state.countdownSec = clamp(cfg.cd ?? state.countdownSec, 2, 6);
      startCountdownUI();
    }
  }

  // Countdown UI (client side, based on shared startAtMs)
  let countdownRAF = null;
  function startCountdownUI(){
    const box = $t('#rrCountdown');
    if(!box) return;
    box.style.display = 'block';

    function tick(){
      if(!state.startAtMs){ countdownRAF = requestAnimationFrame(tick); return; }
      const left = Math.max(0, state.startAtMs - nowMs());
      const sec = Math.ceil(left/1000);

      if(left <= 0 && !state.started){
        state.started = true;
        box.textContent = 'GO!';
        setTimeout(()=>{ try{ box.style.display='none'; }catch(e){} }, 650);
        try{
          WIN.__GJ_START_NOW__?.();
        }catch(e){
          try{ WIN.__GJ_SET_PAUSED__?.(false); }catch(_){}
        }

        // announce "started"
        try{
          bus.send({ t:'started', at: state.startAtMs, seed: state.seed });
        }catch(e){}
      }else{
        box.textContent = String(sec);
      }

      countdownRAF = requestAnimationFrame(tick);
    }
    if(countdownRAF) cancelAnimationFrame(countdownRAF);
    countdownRAF = requestAnimationFrame(tick);
    redraw();
  }

  // Listen bus messages
  bus.onMsg((msg)=>{
    if(!msg || typeof msg !== 'object') return;

    if(msg.t === 'cfg'){
      applyCfg(msg);
      return;
    }
    if(msg.t === 'started'){
      if(!state.startAtMs && msg.at){
        state.startAtMs = Number(msg.at)||null;
        startCountdownUI();
      }
      return;
    }
    if(msg.t === 'snap'){
      // remote scoreboard snapshot
      upsert(msg.p || {});
      redraw();
      return;
    }
    if(msg.t === 'end'){
      upsert(msg.p || {});
      if(msg.p?.win && !state.winnerId){
        state.winnerId = msg.p.playerId;
      }
      redraw();
      return;
    }
  });

  // Self snapshot loop (send every ~700ms)
  let lastSendMs = 0;
  function sendSnap(detail){
    const t = nowMs();
    if(t - lastSendMs < 650) return;
    lastSendMs = t;

    const p = Object.assign({
      playerId: pid,
      nick,
      score: detail?.score|0,
      goodCount: detail?.goodCount|0,
      accPct: detail?.accPct|0,
      miss: detail?.miss|0,
      medianRtGoodMs: detail?.medianRtGoodMs|0,
      done: false,
      win: false,
      clearMs: null
    });

    state.lastSelf = p;
    upsert(p);
    redraw();

    try{ bus.send({ t:'snap', p }); }catch(e){}
  }

  WIN.addEventListener('hha:score', (ev)=>{
    sendSnap(ev?.detail || null);
    maybeHostPlanStart();
  });

  // When local game ended -> broadcast result
  WIN.addEventListener('hha:game-ended', (ev)=>{
    if(state.ended) return;
    state.ended = true;

    const sum = ev?.detail || WIN.__HHA_LAST_SUMMARY || {};
    const win = (String(sum.reason||'') === 'win');
    const clearMs = (state.startAtMs != null) ? Math.max(0, (nowMs() - state.startAtMs)) : null;

    const p = {
      playerId: pid,
      nick,
      score: sum.scoreFinal|0,
      goodCount: sum.goodCount|0,
      accPct: sum.accPct|0,
      miss: sum.missTotal|0,
      medianRtGoodMs: sum.medianRtGoodMs|0,
      done: true,
      win: !!win,
      clearMs
    };
    upsert(p);
    redraw();

    try{ bus.send({ t:'end', p }); }catch(e){}
    clearInterval(presLoop);
  });

  // Kick initial presence/host plan
  setTimeout(()=>{
    try{
      const pres = bus.getPresence() || [];
      pres.forEach(p=> upsert({ playerId:p.playerId, nick:p.nick, joinedAt:p.joinedAt }));
      redraw();
      maybeHostPlanStart();
      // host shares cfg immediately (so late join can sync)
      if(bus.isHost && !state.startAtMs){
        state.seed = String(qs('seed', state.seed));
        // waiting for >=2; still share seed now
        bus.send({ t:'cfg', seed: state.seed, startAtMs: null, cd: state.countdownSec });
      }
    }catch(e){}
  }, 500);
}

bootRace().catch((e)=> console.warn('[GJ Race] boot failed', e));