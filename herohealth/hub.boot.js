// === /herohealth/hub.boot.js ===
// Hub controller: pass-through params, patch links, reset today, probe banner (403-safe)
// PATCH v20260225: Bloom per-zone per-day (pid+zone+day) + Bloom -> Warmup -> Game wrapper
// PATCH v20260226: Canonical HUB URL (GitHub Pages safe)
// PATCH v20260303: HUB-PASS 1–5 + Mobile Direct (long-press) + Mode Chips + Mode Banner + Toggle
'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';
import { resolveHub, hhaHub } from './js/hha-path.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

const P = {
  run:  String(qs('run','play')).toLowerCase() || 'play',
  diff: String(qs('diff','normal')).toLowerCase() || 'normal',
  time: clamp(qs('time','80'), 20, 300),
  seed: String(qs('seed','')) || nowSeed(),

  // ✅ IMPORTANT: do NOT default to './hub.html' (relative) because it breaks after passing to other folders
  hub:  String(qs('hub','')) || '',

  pid: String(qs('pid','')).trim(),
  studyId: String(qs('studyId','')).trim(),
  phase: String(qs('phase','')).trim(),
  conditionGroup: String(qs('conditionGroup','')).trim(),
  view: String(qs('view','')).trim(),
  log: String(qs('log','')).trim(),

  warmup: String(qs('warmup','1')),
  cooldown: String(qs('cooldown','1')),
  dur: clamp(qs('dur','20'), 5, 60),
  cdur: clamp(qs('cdur','15'), 5, 60),
  pick: String(qs('pick','')).toLowerCase().trim(), // rand|day|''

  planSeq: String(qs('planSeq','')).trim(),
  planDay: String(qs('planDay','')).trim(),
  planSlot: String(qs('planSlot','')).trim(),
  planMode: String(qs('planMode','')).trim(),
  planSlots: String(qs('planSlots','')).trim(),
  planIndex: String(qs('planIndex','')).trim(),
  autoNext: String(qs('autoNext','')).trim(),
  plannedGame: String(qs('plannedGame','')).trim(),
  finalGame: String(qs('finalGame','')).trim(),
  zone: String(qs('zone','')).trim(),

  // ✅ BLOOM level: a|b|c (default c)
  bloom: String(qs('bloom','c')).toLowerCase().trim(),
};

// === PATCH v20260226: Canonical HUB URL (GitHub Pages safe) ===
try{
  P.hub = resolveHub(P.hub) || hhaHub();
}catch(e){
  P.hub = hhaHub();
}

function absUrlMaybe(url){
  if(!url) return '';
  try{ return new URL(url, location.href).toString(); }catch{ return String(url||''); }
}

/* ===================== Bloom per-zone daily ===================== */
function localDayKey(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function bloomDailyKey(zone, pid){
  const z = String(zone||'').toLowerCase().trim() || 'nutrition';
  const p = String(pid||'').trim() || 'anon';
  return `HHA_BLOOM_DONE:${z}:${p}:${localDayKey()}`;
}
function isBloomDone(zone, pid){
  try{ return localStorage.getItem(bloomDailyKey(zone,pid)) === '1'; }catch(_){ return false; }
}
/* ================================================================= */

/* =========================================================
 * Mode / bypass switches
 * ======================================================= */
function shouldSkipBloomWarmup(){
  const direct = String(qs('direct','')).trim().toLowerCase();
  if (direct === '1' || direct === 'true') return true;

  const fast = String(qs('fast','')).trim().toLowerCase();
  const skip = String(qs('skipBW','')).trim().toLowerCase();
  return (fast === '1' || fast === 'true' || skip === '1' || skip === 'true');
}
function isDirectClick(ev){
  return !!(ev && (ev.shiftKey || ev.altKey));
}
function shouldBypassForGame(gameKey, ev){
  if (shouldSkipBloomWarmup()) return true;                 // global direct
  if (isDirectClick(ev)) return true;                       // desktop direct
  const k = String(gameKey||'').toLowerCase();
  if (k === 'balance' && String(P.run||'play') === 'research') return true; // balance research direct
  return false;
}

/* =========================================================
 * Common params
 * - includes optional tutorial/practice passthrough (if provided)
 * ======================================================= */
function addCommonParams(u){
  const set = (k,v)=>{ if(v!==undefined && v!==null && v!=='') u.searchParams.set(k, String(v)); };

  set('hub', P.hub);
  set('api', API_ENDPOINT);

  set('run', P.run);
  set('diff', P.diff);
  set('time', P.time);
  set('seed', P.seed);

  set('pid', P.pid);
  set('studyId', P.studyId);
  set('phase', P.phase);
  set('conditionGroup', P.conditionGroup);
  set('view', P.view);
  set('log', P.log);

  set('warmup', P.warmup);
  set('cooldown', P.cooldown);
  set('dur', P.dur);
  set('cdur', P.cdur);
  if(P.pick) set('pick', P.pick);

  [
    'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
    'plannedGame','finalGame','zone'
  ].forEach(k=> set(k, P[k]) );

  if(P.bloom) set('bloom', P.bloom);

  // optional global UX flags (pass-through only if present in hub url)
  set('tutorial', qs('tutorial',''));
  set('practiceOn', qs('practiceOn',''));
  set('practice', qs('practice',''));

  return u;
}

/* =========================================================
 * Game-specific params (defaults)
 * ======================================================= */
function addGameSpecificParams(u, gameKey){
  const k = String(gameKey||'').toLowerCase();

  // Balance Hold DOM defaults
  if(k === 'balance'){
    const tutorial   = String(qs('tutorial', '1'));
    const practiceOn = String(qs('practiceOn', '1'));
    const practice   = String(qs('practice', '15'));

    if(!u.searchParams.get('tutorial'))   u.searchParams.set('tutorial', tutorial);
    if(!u.searchParams.get('practiceOn')) u.searchParams.set('practiceOn', practiceOn);
    if(!u.searchParams.get('practice'))   u.searchParams.set('practice', practice);
  }

  return u;
}

/* =========================================================
 * Game path map
 * ======================================================= */
function gameRunPathByKey(gameKey){
  const k = String(gameKey||'').toLowerCase();

  if(k==='goodjunk') return './vr-goodjunk/goodjunk-vr.html';
  if(k==='groups')   return './vr-groups/groups-vr.html';
  if(k==='hydration')return './hydration/hydration-vr.html';
  if(k==='plate')    return './plate/plate-vr.html';

  if(k==='handwash') return './hygiene-vr/handwash-vr.html';
  if(k==='brush')    return './hygiene-vr/brush-vr.html';
  if(k==='maskcough')return './mask-cough/mask-cough.html';
  if(k==='germdetective') return './germ-detective/germ-detective.html';
  if(k==='bath')     return './vr-bath/bath-vr.html';
  if(k==='clean')    return './home-clean/clean-objects.html';

  if(k==='shadow')   return '../fitness/shadow-breaker.html';
  if(k==='rhythm')   return '../fitness/rhythm-boxer.html';
  if(k==='jumpduck') return '../fitness/jump-duck.html';
  if(k==='balance')  return '../fitness/balance-hold.html';
  if(k==='planner')  return '../fitness/fitness-planner/index.html';

  return './vr-goodjunk/goodjunk-vr.html';
}
function inferZoneByGameKey(gameKey){
  const k = String(gameKey||'').toLowerCase();
  if(['goodjunk','groups','hydration','plate'].includes(k)) return 'nutrition';
  if(['handwash','brush','maskcough','germdetective','bath','clean'].includes(k)) return 'hygiene';
  return 'exercise';
}

function buildGameRunUrlFromGameKey(gameKey){
  const base = absUrlMaybe(gameRunPathByKey(gameKey));
  const u = new URL(base, location.href);

  addCommonParams(u);
  addGameSpecificParams(u, gameKey);

  if(!u.searchParams.get('zone')){
    u.searchParams.set('zone', inferZoneByGameKey(gameKey));
  }

  return u.toString();
}

/* =========================================================
 * Gate URLs
 * ======================================================= */
function warmupGateUrlFor(gameUrl, gameKey, phase){
  const gate = absUrlMaybe('./warmup-gate.html');
  const u = new URL(gate, location.href);

  addCommonParams(u);

  const z = inferZoneByGameKey(gameKey);
  u.searchParams.set('gatePhase', String(phase||'warmup'));
  u.searchParams.set('next', absUrlMaybe(gameUrl));
  u.searchParams.set('cat', String(P.zone || z || 'nutrition'));
  u.searchParams.set('theme', String(gameKey||'').toLowerCase());

  return u.toString();
}
function bloomGateUrlFor(nextUrl, gameKey, bloomLevel){
  const gate = absUrlMaybe('./bloom-gate.html');
  const u = new URL(gate, location.href);

  addCommonParams(u);

  const z = inferZoneByGameKey(gameKey);

  u.searchParams.set('bloom', String(bloomLevel||P.bloom||'c'));
  u.searchParams.set('next', absUrlMaybe(nextUrl));
  u.searchParams.set('cat', String(P.zone || z || 'nutrition'));
  u.searchParams.set('theme', String(gameKey||'').toLowerCase());
  u.searchParams.set('zone', String(P.zone || z || 'nutrition'));
  u.searchParams.set('day', localDayKey());

  if(!u.searchParams.get('dur')) u.searchParams.set('dur', '18');
  return u.toString();
}
function wrapBloomWarmup(gameUrl, gameKey){
  const warmUrl = warmupGateUrlFor(gameUrl, gameKey, 'warmup');

  const b = String(P.bloom || 'c').toLowerCase();
  const useBloom = (b === 'a' || b === 'b' || b === 'c');
  if(!useBloom) return warmUrl;

  const z = inferZoneByGameKey(gameKey);
  const pid = P.pid || 'anon';
  if(isBloomDone(z, pid)){
    return warmUrl;
  }
  return bloomGateUrlFor(warmUrl, gameKey, b);
}

/* =========================================================
 * Return summary panel
 * ======================================================= */
function showReturnSummaryPanel(){
  const panel = document.getElementById('lastSummary');
  const t = document.getElementById('lsTitle');
  const b = document.getElementById('lsBody');
  const clearBtn = document.getElementById('btnClearSummary');
  if(!panel || !t || !b) return;

  const lastGame  = String(qs('lastGame','')).trim();
  const lastScore = String(qs('lastScore','')).trim();
  const lastRank  = String(qs('lastRank','')).trim();
  const lastStab  = String(qs('lastStab','')).trim();

  if(lastGame){
    panel.style.display = '';
    t.textContent = 'สรุปล่าสุด (Return)';
    b.textContent = `✅ ล่าสุด: ${lastGame} | Score ${lastScore||0} | Rank ${lastRank||'-'} | Stability ${lastStab||0}%`;
  }else{
    let info = null;
    try{ info = JSON.parse(localStorage.getItem('HHA_LAST_SUMMARY') || 'null'); }catch(e){ info=null; }
    if(info && info.gameId){
      const stabPct = Math.round((info.stabilityRatio||0)*100);
      panel.style.display = '';
      t.textContent = 'สรุปล่าสุด';
      b.textContent = `เกม: ${info.gameId} | Score ${info.score||0} | Rank ${info.rank||'-'} | Stability ${stabPct}%`;
    }else{
      panel.style.display = 'none';
    }
  }

  if(clearBtn){
    clearBtn.addEventListener('click', (ev)=>{
      ev.preventDefault();
      try{
        localStorage.removeItem('HHA_LAST_SUMMARY');
        localStorage.removeItem('HHA_LAST_SUMMARY_balance-hold');
      }catch(e){}
      panel.style.display = 'none';
      try{ toast && toast('Cleared last summary'); }catch(_){}
    }, {passive:false});
  }
}

/* =========================================================
 * Mode Chip + Toggle in chipRow
 * ======================================================= */
function showHubModeChip(){
  const chipRow = document.getElementById('chipRow');
  const pickTip = document.getElementById('hubPickTip');

  const mode = shouldSkipBloomWarmup() ? 'DIRECT' : 'GATED';

  if (pickTip){
    pickTip.textContent = `Mode: ${mode}`;
    pickTip.style.borderColor = mode === 'DIRECT' ? 'rgba(245,158,11,.35)' : 'rgba(34,197,94,.35)';
    pickTip.style.background  = mode === 'DIRECT' ? 'rgba(245,158,11,.14)' : 'rgba(34,197,94,.14)';
  }

  if (chipRow && !document.getElementById('hubModeChip')){
    const el = document.createElement('span');
    el.id = 'hubModeChip';
    el.className = 'chip';
    chipRow.appendChild(el);
  }
  const el = document.getElementById('hubModeChip');
  if (el){
    el.innerHTML = `mode: <b>${mode}</b>`;
    el.style.borderColor = mode === 'DIRECT' ? 'rgba(245,158,11,.35)' : 'rgba(34,197,94,.35)';
    el.style.background  = mode === 'DIRECT' ? 'rgba(245,158,11,.14)' : 'rgba(34,197,94,.14)';
  }
}

function addDirectToggleButton(){
  const chipRow = document.getElementById('chipRow');
  if (!chipRow) return;
  if (document.getElementById('btnToggleDirect')) return;

  const a = document.createElement('a');
  a.id = 'btnToggleDirect';
  a.href = '#';
  a.className = 'btn ghost';
  a.textContent = shouldSkipBloomWarmup() ? '🟢 DIRECT' : '⚪ GATED';

  a.addEventListener('click', (ev)=>{
    ev.preventDefault();
    try{
      const u = new URL(location.href);
      const on = shouldSkipBloomWarmup();
      if (on) u.searchParams.delete('direct');
      else u.searchParams.set('direct','1');
      u.searchParams.delete('fast');
      u.searchParams.delete('skipBW');
      location.href = u.toString();
    }catch(e){}
  }, {passive:false});

  chipRow.appendChild(a);
}

/* =========================================================
 * Mode Banner (DIRECT/GATED)
 * ======================================================= */
function ensureModeBanner(){
  const wrap = document.querySelector('.wrap');
  const header = document.querySelector('header');
  if (!wrap || !header) return;

  let el = document.getElementById('hubModeBanner');
  if (!el){
    el = document.createElement('div');
    el.id = 'hubModeBanner';
    el.style.marginTop = '12px';
    el.style.borderRadius = '18px';
    el.style.border = '1px solid rgba(148,163,184,.18)';
    el.style.padding = '12px';
    el.style.display = 'flex';
    el.style.gap = '10px';
    el.style.alignItems = 'flex-start';
    el.style.background = 'rgba(2,6,23,.35)';

    el.innerHTML = `
      <div id="hubModeDot" style="width:10px;height:10px;border-radius:999px;margin-top:5px;background:#22c55e;"></div>
      <div style="flex:1;min-width:0;">
        <div id="hubModeTitle" style="margin:0;font-size:13px;font-weight:1000;">Mode</div>
        <div id="hubModeMsg" style="margin-top:4px;font-size:12px;color:rgba(229,231,235,.78);font-weight:750;line-height:1.35;">-</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="#" id="hubModeToggle" class="btn warn">Toggle</a>
        <a href="#" id="hubModeHide" class="btn ghost">Hide</a>
      </div>
    `;

    header.insertAdjacentElement('afterend', el);

    const sId = 'hubModeBannerCss';
    if (!document.getElementById(sId)){
      const st = document.createElement('style');
      st.id = sId;
      st.textContent = `
        #hubModeBanner .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);font-weight:1000;font-size:13px}
        #hubModeBanner .btn.warn{border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.14)}
        #hubModeBanner .btn.ghost{background:rgba(2,6,23,.18)}
      `;
      document.head.appendChild(st);
    }
  }

  const hideBtn = document.getElementById('hubModeHide');
  hideBtn && hideBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    try{ localStorage.setItem('HHA_HUB_HIDE_MODE_BANNER','1'); }catch(e){}
    el.style.display = 'none';
  }, {passive:false});

  const toggleBtn = document.getElementById('hubModeToggle');
  toggleBtn && toggleBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    try{
      const u = new URL(location.href);
      const on = shouldSkipBloomWarmup();
      if (on) u.searchParams.delete('direct');
      else u.searchParams.set('direct','1');
      u.searchParams.delete('fast');
      u.searchParams.delete('skipBW');
      location.href = u.toString();
    }catch(e){}
  }, {passive:false});
}

function updateModeBanner(){
  const el = document.getElementById('hubModeBanner');
  if (!el) return;

  try{
    if (localStorage.getItem('HHA_HUB_HIDE_MODE_BANNER') === '1'){
      el.style.display = 'none';
      return;
    }
  }catch(e){}

  const isDirect = shouldSkipBloomWarmup();
  const dot = document.getElementById('hubModeDot');
  const title = document.getElementById('hubModeTitle');
  const msg = document.getElementById('hubModeMsg');
  const toggle = document.getElementById('hubModeToggle');

  el.style.display = 'flex';

  if (isDirect){
    if (dot) dot.style.background = '#f59e0b';
    if (title) title.textContent = 'DIRECT MODE (ข้าม Bloom/Warmup)';
    if (msg) msg.textContent =
      'โหมด Direct: กดเกมแล้ว “เข้าเกมตรง” ทันที (เหมาะสำหรับทดสอบ/ดีบั๊ก) • ปิดได้ด้วย Toggle';
    if (toggle) toggle.textContent = '🟢 DIRECT';
    el.style.borderColor = 'rgba(245,158,11,.28)';
    el.style.background = 'rgba(245,158,11,.10)';
  }else{
    if (dot) dot.style.background = '#22c55e';
    if (title) title.textContent = 'GATED MODE (Bloom → Warmup → Game)';
    if (msg) msg.textContent =
      'โหมดปกติ: เข้าเกมผ่าน Bloom/Warmup ตามมาตรฐานการวิจัย • เปิด Direct ได้ด้วย Toggle';
    if (toggle) toggle.textContent = '⚪ GATED';
    el.style.borderColor = 'rgba(34,197,94,.22)';
    el.style.background = 'rgba(34,197,94,.08)';
  }
}

/* =========================================================
 * Mobile helpers: isTouch + reduced motion
 * ======================================================= */
function isTouchDevice(){
  return (matchMedia && matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window);
}
function prefersReducedMotion(){
  try{ return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch(e){ return false; }
}

/* =========================================================
 * Long-press Direct (mobile) with progress + haptic
 * - normal tap: gated
 * - long-press: direct
 * ======================================================= */
function bindLongPressDirect(btn, getGameKey, buildUrlFn){
  if (!btn) return;

  const HOLD_MS = (function(){
    const w = Math.min(window.innerWidth||9999, window.innerHeight||9999);
    const coarse = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window);
    if (!coarse) return 650;
    if (w <= 380) return 820;
    if (w <= 480) return 760;
    if (w <= 720) return 700;
    return 650;
  })();

  const MOVE_PX = 14;
  let timer = null;
  let fired = false;
  let downXY = null;
  let ring = null;
  let startAt = 0;

  const clearTimer = ()=>{
    if (timer){ clearTimeout(timer); timer=null; }
  };
  const removeRing = ()=>{
    if (ring){
      try{ ring.remove(); }catch(e){}
      ring = null;
    }
  };
  const cancel = ()=>{
    clearTimer();
    removeRing();
    downXY = null;
  };

  // inject CSS once
  if (!document.getElementById('hhaLongPressCss')){
    const st = document.createElement('style');
    st.id = 'hhaLongPressCss';
    st.textContent = `
      .hha-longpress-ring{
        position: fixed;
        z-index: 9999;
        width: 42px;
        height: 18px;
        pointer-events:none;
      }
      .hha-longpress-track{
        position:absolute; inset:0;
        border-radius: 999px;
        border:1px solid rgba(255,255,255,.18);
        background: rgba(2,6,23,.55);
        overflow:hidden;
        backdrop-filter: blur(6px);
      }
      .hha-longpress-fill{
        position:absolute; inset:0;
        transform-origin:left center;
        transform: scaleX(0);
        border-radius:999px;
        background: linear-gradient(90deg, rgba(34,197,94,.55), rgba(34,211,238,.55));
      }
    `;
    document.head.appendChild(st);
  }

  const makeRing = ()=>{
    removeRing();
    ring = document.createElement('div');
    ring.className = 'hha-longpress-ring';
    ring.innerHTML = `<div class="hha-longpress-track"></div><div class="hha-longpress-fill"></div>`;
    document.body.appendChild(ring);
  };
  const positionRing = ()=>{
    if (!ring) return;
    const r = btn.getBoundingClientRect();
    const x = r.right - 10;
    const y = r.top + 10;
    ring.style.left = `${x}px`;
    ring.style.top  = `${y}px`;
  };
  const tickRing = ()=>{
    if (!ring) return;
    const now = performance.now();
    const t = Math.max(0, Math.min(1, (now - startAt) / HOLD_MS));
    const fill = ring.querySelector('.hha-longpress-fill');
    if (fill) fill.style.transform = `scaleX(${t})`;
    if (!fired && timer) requestAnimationFrame(tickRing);
  };

  btn.addEventListener('pointerdown', (ev)=>{
    if (!isTouchDevice()) return;

    fired = false;
    startAt = performance.now();
    downXY = { x: ev.clientX || 0, y: ev.clientY || 0 };

    makeRing();
    positionRing();
    if (!prefersReducedMotion()){
      requestAnimationFrame(tickRing);
      try{ navigator.vibrate && navigator.vibrate(10); }catch(e){}
    }

    clearTimer();
    timer = setTimeout(()=>{
      fired = true;
      cancel();

      try{
        if (!prefersReducedMotion()) navigator.vibrate && navigator.vibrate([18, 8, 18]);
      }catch(e){}

      const gameKey = getGameKey();
      const url = buildUrlFn(true, ev);

      try{ toast && toast(`Direct: ${gameKey}`); }catch(_){}
      location.href = url;
    }, HOLD_MS);
  }, {passive:true});

  btn.addEventListener('pointermove', (ev)=>{
    if (!timer || !downXY) return;

    const dx = Math.abs((ev.clientX||0) - downXY.x);
    const dy = Math.abs((ev.clientY||0) - downXY.y);

    if (dx > MOVE_PX || dy > MOVE_PX){
      cancel();
      return;
    }
    positionRing();
  }, {passive:true});

  btn.addEventListener('pointerup', ()=>{
    if (!fired) cancel();
  }, {passive:true});

  btn.addEventListener('pointercancel', cancel, {passive:true});

  // prevent click after successful long-press
  btn.addEventListener('click', (ev)=>{
    if (fired){
      ev.preventDefault();
      ev.stopPropagation();
      fired = false;
    }
  }, {passive:false});
}

/* =========================================================
 * Mobile labels: show "กดค้าง = Direct" for Fitness buttons
 * ======================================================= */
function addMobileDirectLabels(){
  if (!isTouchDevice()) return;

  const ALLOW = new Set(['planner','shadow','rhythm','jumpduck','balance']);
  const btns = document.querySelectorAll('[data-game]');

  btns.forEach(btn=>{
    const key = String(btn.getAttribute('data-game')||'').toLowerCase();
    if (!ALLOW.has(key)) return;
    if (btn.dataset.hhaHoldHint === '1') return;
    btn.dataset.hhaHoldHint = '1';

    btn.style.position = btn.style.position || 'relative';

    const badge = document.createElement('span');
    badge.textContent = 'กดค้าง = Direct';
    badge.style.position = 'absolute';
    badge.style.top = '-8px';
    badge.style.right = '-6px';
    badge.style.padding = '3px 7px';
    badge.style.borderRadius = '999px';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = '1000';
    badge.style.letterSpacing = '.1px';
    badge.style.color = 'rgba(229,231,235,.95)';
    badge.style.background = 'rgba(2,6,23,.65)';
    badge.style.border = '1px solid rgba(148,163,184,.22)';
    badge.style.pointerEvents = 'none';
    badge.style.backdropFilter = 'blur(6px)';
    badge.style.whiteSpace = 'nowrap';

    const r = btn.getBoundingClientRect();
    if (r.width < 150){
      badge.style.position = 'static';
      badge.style.display = 'inline-block';
      badge.style.marginLeft = '8px';
      badge.style.marginTop = '6px';
      badge.textContent = '⏳ กดค้าง = Direct';
      const wrap = document.createElement('div');
      wrap.style.marginTop = '6px';
      wrap.appendChild(badge);
      btn.appendChild(wrap);
      return;
    }

    btn.appendChild(badge);
  });
}

/* =========================================================
 * setupHubButtons: tap=gated, long-press/shift/alt/direct=1=direct
 * ======================================================= */
function setupHubButtons(){
  const btns = document.querySelectorAll('[data-game]');
  btns.forEach(btn=>{
    const getGameKey = ()=> String(btn.getAttribute('data-game')||'goodjunk').toLowerCase();

    const buildNavUrl = (forceDirect=false, ev=null)=>{
      const gameKey = getGameKey();
      const gameUrl = buildGameRunUrlFromGameKey(gameKey);
      const direct = forceDirect || shouldBypassForGame(gameKey, ev);
      return direct ? gameUrl : wrapBloomWarmup(gameUrl, gameKey);
    };

    // mobile long-press direct
    bindLongPressDirect(btn, getGameKey, (forceDirect, ev)=> buildNavUrl(forceDirect, ev));

    // normal click uses gating unless direct conditions
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      const gameKey = getGameKey();
      const finalUrl = buildNavUrl(false, e);

      try{
        if (isDirectClick(e)) toast && toast(`Direct: ${gameKey}`);
      }catch(_){}

      location.href = finalUrl;
    }, {passive:false});
  });
}

async function boot(){
  try{
    setBanner('API', 'checking…');
    const ok = await probeAPI(API_ENDPOINT);
    setBanner('API', ok ? 'OK' : 'offline');
    attachRetry(API_ENDPOINT);
  }catch(e){
    setBanner('API', 'offline');
  }

  showReturnSummaryPanel();

  // mode UI
  ensureModeBanner();
  updateModeBanner();
  showHubModeChip();
  addDirectToggleButton();

  // mobile UX
  addMobileDirectLabels();

  setupHubButtons();

  // hint toast
  try{
    const mode = shouldSkipBloomWarmup() ? 'DIRECT' : 'GATED';
    const hint = isTouchDevice() ? 'Long-press = Direct' : 'Shift/Alt+Click = Direct';
    toast && toast(`HUB ready • mode=${mode} • ${hint} • (direct=1)`);
  }catch(_){}
}

boot();