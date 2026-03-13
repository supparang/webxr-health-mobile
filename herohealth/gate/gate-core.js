// === /herohealth/gate/gate-core.js ===
// FULL PATCH v20260313c-GATE-CORE-MOUNT-GAME-ONCE-PER-DAY

import {
  getGateGame,
  getPhaseFile,
  getGameStyleFile,
  normalizeGameId,
  normalizeCat
} from './gate-games.js';

const qs = (k, d='') => {
  try { return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
};

const ensureSeed = (v='') => String(v || ((Date.now() ^ (Math.random()*1e9))|0));

function hhDayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function gateDoneKey(kind, cat, game, pid){
  return `HHA_${String(kind).toUpperCase()}_DONE:${cat}:${game}:${pid}:${hhDayKey()}`;
}

function isGateDone(kind, cat, game, pid){
  try{
    return localStorage.getItem(gateDoneKey(kind, cat, game, pid)) === '1';
  }catch(e){
    return false;
  }
}

function setGateDone(kind, cat, game, pid){
  try{
    localStorage.setItem(gateDoneKey(kind, cat, game, pid), '1');
  }catch(e){}
}

function passthroughKeys(){
  return [
    'studyId','phase','conditionGroup','api','debug','ai','log',
    'schoolCode','classRoom','zone','cat'
  ];
}

function childSkipText(gatePhase='warmup', label='เกม'){
  if (String(gatePhase) === 'cooldown') {
    return `วันนี้ทำช่วงผ่อนคลายของ ${label} แล้ว 🌙`;
  }
  return `วันนี้วอร์มอัปของ ${label} แล้ว 🏃`;
}

function childGoText(gatePhase='warmup'){
  return String(gatePhase) === 'cooldown'
    ? 'เดี๋ยวพากลับหน้าหลักนะ 🏠'
    : 'เดี๋ยวพาเข้าเกมหลักนะ 🎮';
}

function iconForGame(theme='', gatePhase='warmup'){
  const t = String(theme || '').toLowerCase();
  if (t === 'hydration') return gatePhase === 'cooldown' ? '💧🌙' : '💧⚡';
  if (t === 'groups') return '🥚🍚';
  if (t === 'plate') return '🍽️';
  if (t === 'goodjunk') return '🥦🍔';
  if (t === 'bath') return '🛁';
  if (t === 'brush') return '🪥';
  if (t === 'handwash') return '🧼';
  if (t === 'maskcough') return '😷';
  if (t === 'germdetective') return '🦠';
  if (t === 'cleanobjects') return '🧴';
  if (t === 'jumpduck') return '⬆️⬇️';
  if (t === 'shadowbreaker') return '🥊';
  if (t === 'rhythmboxer') return '🎵';
  if (t === 'balancehold') return '⚖️';
  if (t === 'fitnessplanner') return '📅';
  return gatePhase === 'cooldown' ? '🌙' : '⚡';
}

function buildTargetUrl({ gatePhase, pid, view, run, diff, time, seed, hub, next, zone, cat, gameId }){
  const fallback = gatePhase === 'cooldown'
    ? (hub || './hub.html')
    : (next || hub || './hub.html');

  let u;
  try{
    u = new URL(fallback, location.href);
  }catch(e){
    u = new URL('./hub.html', location.href);
  }

  const set = (k,v)=>{
    if (v == null || String(v).trim() === '') return;
    u.searchParams.set(k, String(v));
  };

  set('pid', pid);
  set('view', view);
  set('run', run);
  set('diff', diff);
  set('time', time);
  set('seed', seed);
  set('hub', hub);
  set('zone', zone);
  set('cat', cat);

  passthroughKeys().forEach(k=>{
    const v = qs(k, '');
    if (v && !u.searchParams.get(k)) u.searchParams.set(k, v);
  });

  if (gatePhase === 'warmup'){
    set('gate', '1');
    set('gateMode', 'warmup');
    set('gateResult', '1');
    set('wType', `${gameId}_quick_prep`);
  } else {
    set('gate', '1');
    set('gateMode', 'cooldown');
    set('gateResult', '1');
    set('cdType', `${gameId}_calm_down`);
  }

  return u.toString();
}

function ensureStyle(styleHref){
  if (!styleHref) return;
  const abs = new URL(styleHref, location.href).toString();
  const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(el => el.href === abs);
  if (exists) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = abs;
  document.head.appendChild(link);
}

function renderFallbackGate(app, ctx){
  const {
    gatePhase, pid, view, run, diff, time, seed, hub, next,
    zone, cat, gameId, meta, targetUrl, skipped
  } = ctx;

  const title = gatePhase === 'cooldown'
    ? 'HeroHealth Cooldown Gate'
    : 'HeroHealth Warmup Gate';

  const subtitle = skipped
    ? `${childSkipText(gatePhase, meta.label)} — ข้ามให้เลยอัตโนมัติ`
    : gatePhase === 'cooldown'
      ? 'พักและหายใจช้า ๆ ก่อนกลับหน้าหลัก'
      : 'ขยับตัวนิดหน่อยก่อนเข้าเกมหลัก';

  const phaseTitle = gatePhase === 'cooldown'
    ? (meta.cooldownTitle || `${meta.label} ผ่อนคลายหลังเล่น`)
    : (meta.warmupTitle || `${meta.label} วอร์มอัป`);

  const icon = iconForGame(meta.theme, gatePhase);

  app.innerHTML = `
    <div class="gate-shell" style="min-height:100vh;display:grid;place-items:center;padding:16px;">
      <div style="width:min(860px,100%);border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.72);backdrop-filter:blur(12px);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.35);overflow:hidden;">
        <div style="padding:18px;display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:stretch;">
          <div>
            <h1 style="margin:0 0 8px 0;font-size:clamp(28px,5vw,40px);line-height:1;font-weight:1100;">${title}</h1>
            <div style="color:#94a3b8;font-size:14px;line-height:1.55;font-weight:900;">${subtitle}</div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
              <span style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.34);color:#94a3b8;font-size:12px;font-weight:1000;">🎮 ${gameId}</span>
              <span style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.34);color:#94a3b8;font-size:12px;font-weight:1000;">📍 ${gatePhase}</span>
              <span style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.34);color:#94a3b8;font-size:12px;font-weight:1000;">👤 ${pid}</span>
              <span style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.34);color:#94a3b8;font-size:12px;font-weight:1000;">🖥 ${view}</span>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
              <button id="btnContinue" type="button" style="cursor:pointer;min-height:48px;border-radius:16px;border:1px solid rgba(148,163,184,.20);background:rgba(59,130,246,.16);color:#e5e7eb;padding:12px 14px;font:inherit;font-weight:1100;">▶ ไปต่อเลย</button>
              <button id="btnBackHub" type="button" style="cursor:pointer;min-height:48px;border-radius:16px;border:1px solid rgba(148,163,184,.20);background:rgba(34,197,94,.14);color:#e5e7eb;padding:12px 14px;font:inherit;font-weight:1100;">🏠 กลับหน้าหลัก</button>
            </div>
          </div>

          <div style="min-height:220px;border-radius:22px;border:1px solid rgba(148,163,184,.16);background:radial-gradient(700px 260px at 50% 0%, rgba(59,130,246,.16), transparent 60%), radial-gradient(500px 220px at 50% 100%, rgba(34,211,238,.12), transparent 65%), rgba(15,23,42,.54);display:grid;place-items:center;text-align:center;padding:18px;">
            <div>
              <div style="font-size:72px;line-height:1;">${icon}</div>
              <div style="margin-top:12px;font-size:20px;font-weight:1100;">${phaseTitle}</div>
              <div style="margin-top:8px;color:#94a3b8;font-size:13px;font-weight:900;line-height:1.5;">
                ${skipped ? childGoText(gatePhase) : (gatePhase === 'cooldown' ? 'พักแป๊บเดียว แล้วกลับหน้าหลัก' : 'วอร์มอัปนิดเดียว แล้วเข้าเกมต่อ')}
              </div>
              <div style="margin-top:8px;color:#cbd5e1;font-size:11px;font-weight:900;line-height:1.5;opacity:.8;">
                target → ${targetUrl}
              </div>
            </div>
          </div>
        </div>

        <div style="padding:0 18px 18px 18px;">
          <pre style="margin:0;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e5e7eb;white-space:pre-wrap;word-break:break-word;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.28);border-radius:14px;padding:10px 12px;">${JSON.stringify({
            gatePhase, pid, view, run, diff, time, seed, hub, next, zone, cat, gameId, targetUrl, skipped
          }, null, 2)}</pre>
        </div>
      </div>
    </div>
  `;

  return {
    btnContinue: app.querySelector('#btnContinue'),
    btnBackHub: app.querySelector('#btnBackHub')
  };
}

async function loadGameModule(modulePath){
  const abs = new URL(modulePath, location.href).toString();
  return import(abs);
}

function markDoneAndGo({ gatePhase, cat, gameId, pid, targetUrl }){
  setGateDone(gatePhase, cat, gameId, pid);

  if (gatePhase === 'cooldown'){
    try{
      const day = hhDayKey();
      localStorage.setItem(`HHA_COOLDOWN_DONE:${cat}:${gameId}:${pid}:${day}`, '1');
      localStorage.setItem(`HHA_COOLDOWN_DONE:${cat}:${pid}:${day}`, '1');
    }catch(e){}
  }

  location.href = targetUrl;
}

function findBootFn(mod){
  if (!mod) return null;
  if (typeof mod.boot === 'function') return mod.boot;
  if (mod.default && typeof mod.default.boot === 'function') return mod.default.boot;
  if (typeof window.HHA_GATE_BOOT === 'function') return window.HHA_GATE_BOOT;
  if (window.HHA_GATE_GAME) {
    const keys = Object.keys(window.HHA_GATE_GAME);
    for (const k of keys){
      if (window.HHA_GATE_GAME[k] && typeof window.HHA_GATE_GAME[k].boot === 'function'){
        return window.HHA_GATE_GAME[k].boot;
      }
    }
  }
  return null;
}

export async function bootGate(app){
  if (!app) return;

  const gatePhase = String(qs('gatePhase', 'warmup')).toLowerCase();
  const pid = String(qs('pid', 'anon')).trim() || 'anon';
  const view = String(qs('view', 'mobile')).toLowerCase();
  const run = String(qs('run', 'play')).toLowerCase();
  const diff = String(qs('diff', 'normal')).toLowerCase();
  const time = String(qs('time', '80'));
  const seed = ensureSeed(qs('seed', ''));
  const hub = String(qs('hub', './hub.html'));
  const next = String(qs('next', hub || './hub.html'));
  const zone = String(qs('zone', 'nutrition'));
  const cat = normalizeCat(qs('cat', zone || 'nutrition'));
  const rawGame = String(qs('game', 'hydration'));
  const rawTheme = String(qs('theme', rawGame));
  const gameId = normalizeGameId(rawGame || rawTheme || 'hydration');
  const meta = getGateGame(rawGame, rawTheme, cat);

  const targetUrl = buildTargetUrl({
    gatePhase, pid, view, run, diff, time, seed, hub, next, zone, cat, gameId
  });

  // ข้ามทันทีถ้าวันนี้ทำ phase นี้แล้ว
  if (isGateDone(gatePhase, cat, gameId, pid)) {
    location.replace(targetUrl);
    return;
  }

  const styleFile = getGameStyleFile(gameId);
  const phaseFile = getPhaseFile(gameId, gatePhase);

  if (styleFile) ensureStyle(styleFile);

  try{
    if (!phaseFile) throw new Error(`Missing phase file for ${gameId}/${gatePhase}`);

    const mod = await loadGameModule(phaseFile);
    const bootFn = findBootFn(mod);

    if (typeof bootFn !== 'function') {
      throw new Error(`No boot() found in ${phaseFile}`);
    }

    const ctx = {
      gatePhase,
      pid,
      view,
      run,
      diff,
      time,
      seed,
      hub,
      next,
      zone,
      cat,
      gameId,
      meta,
      targetUrl,
      onDone: () => {
        markDoneAndGo({ gatePhase, cat, gameId, pid, targetUrl });
      }
    };

    const mounted = bootFn(app, ctx);

    // ถ้าเกม mount ไม่สำเร็จและไม่ใส่อะไรลง app เลย ค่อย fallback
    setTimeout(() => {
      const hasChild = !!app.firstElementChild;
      if (!hasChild) {
        const ui = renderFallbackGate(app, {
          gatePhase, pid, view, run, diff, time, seed, hub, next, zone, cat, gameId, meta, targetUrl, skipped:false
        });
        ui.btnContinue?.addEventListener('click', () => {
          if (mounted && typeof mounted.destroy === 'function') {
            try{ mounted.destroy(); }catch(e){}
          }
          markDoneAndGo({ gatePhase, cat, gameId, pid, targetUrl });
        });
        ui.btnBackHub?.addEventListener('click', () => {
          location.href = hub || './hub.html';
        });
      }
    }, 80);

  } catch (err) {
    console.error('[gate-core] mount game failed:', err);

    const ui = renderFallbackGate(app, {
      gatePhase, pid, view, run, diff, time, seed, hub, next, zone, cat, gameId, meta, targetUrl, skipped:false
    });

    ui.btnContinue?.addEventListener('click', () => {
      markDoneAndGo({ gatePhase, cat, gameId, pid, targetUrl });
    });

    ui.btnBackHub?.addEventListener('click', () => {
      location.href = hub || './hub.html';
    });
  }
}