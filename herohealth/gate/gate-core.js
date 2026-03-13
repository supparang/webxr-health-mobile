// === /herohealth/gate/gate-core.js ===
// FULL PATCH v20260313b-GATE-CORE-ONCE-PER-DAY

import { getGateGame, normalizeGameId, normalizeCat } from './gate-games.js';

const qs = (k, d='') => {
  try { return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
};

const qbool = (k, d=false) => {
  const v = String(qs(k, d ? '1' : '0')).toLowerCase();
  return ['1','true','yes','on'].includes(v);
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

function renderGate(app, ctx){
  const {
    gatePhase, pid, view, run, diff, time, seed, hub, next,
    zone, cat, gameId, meta, targetUrl, skipped
  } = ctx;

  const title = gatePhase === 'cooldown'
    ? 'HeroHealth Cooldown Gate'
    : 'HeroHealth Warmup Gate';

  const subtitle = skipped
    ? `วันนี้ทำ ${gatePhase} ของ ${meta.label} ไปแล้ว — ข้ามให้อัตโนมัติ`
    : gatePhase === 'cooldown'
      ? 'พักสั้น ๆ ก่อนกลับ HUB'
      : 'เตรียมตัวก่อนเข้าเกมหลัก';

  const phaseTitle = gatePhase === 'cooldown'
    ? (meta.cooldownTitle || `${meta.label} Cooldown`)
    : (meta.warmupTitle || `${meta.label} Warmup`);

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

            <div style="margin-top:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;color:#94a3b8;font-size:12px;font-weight:1000;">
                <span id="progressLabel">${skipped ? 'Skipping…' : (gatePhase === 'cooldown' ? 'Cooling down…' : 'Warming up…')}</span>
                <span id="progressPct">0%</span>
              </div>
              <div style="height:12px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(255,255,255,.06);">
                <div id="progressFill" style="height:100%;width:0%;background:linear-gradient(90deg, rgba(59,130,246,.95), rgba(34,211,238,.95));transition:width .18s linear;"></div>
              </div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
              <button id="btnContinue" type="button" style="cursor:pointer;min-height:48px;border-radius:16px;border:1px solid rgba(148,163,184,.20);background:rgba(59,130,246,.16);color:#e5e7eb;padding:12px 14px;font:inherit;font-weight:1100;">▶ ไปต่อ</button>
              <button id="btnReplayGate" type="button" style="cursor:pointer;min-height:48px;border-radius:16px;border:1px solid rgba(148,163,184,.20);background:rgba(245,158,11,.14);color:#e5e7eb;padding:12px 14px;font:inherit;font-weight:1100;">🔄 เล่น Gate ใหม่</button>
              <button id="btnBackHub" type="button" style="cursor:pointer;min-height:48px;border-radius:16px;border:1px solid rgba(148,163,184,.20);background:rgba(34,197,94,.14);color:#e5e7eb;padding:12px 14px;font:inherit;font-weight:1100;">🏠 กลับ HUB</button>
            </div>
          </div>

          <div style="min-height:220px;border-radius:22px;border:1px solid rgba(148,163,184,.16);background:radial-gradient(700px 260px at 50% 0%, rgba(59,130,246,.16), transparent 60%), radial-gradient(500px 220px at 50% 100%, rgba(34,211,238,.12), transparent 65%), rgba(15,23,42,.54);display:grid;place-items:center;text-align:center;padding:18px;">
            <div>
              <div style="font-size:72px;line-height:1;">${icon}</div>
              <div style="margin-top:12px;font-size:20px;font-weight:1100;">${phaseTitle}</div>
              <div style="margin-top:8px;color:#94a3b8;font-size:13px;font-weight:900;line-height:1.5;">
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
    progressFill: app.querySelector('#progressFill'),
    progressPct: app.querySelector('#progressPct'),
    btnContinue: app.querySelector('#btnContinue'),
    btnReplayGate: app.querySelector('#btnReplayGate'),
    btnBackHub: app.querySelector('#btnBackHub')
  };
}

export function bootGate(app){
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

  const alreadyDone = isGateDone(gatePhase, cat, gameId, pid);

  const targetUrl = buildTargetUrl({
    gatePhase, pid, view, run, diff, time, seed, hub, next, zone, cat, gameId
  });

  const ui = renderGate(app, {
    gatePhase, pid, view, run, diff, time, seed, hub, next, zone, cat, gameId, meta, targetUrl, skipped: alreadyDone
  });

  let pct = 0;
  let done = false;

  const setProgress = (v)=>{
    pct = Math.max(0, Math.min(100, v));
    if (ui.progressFill) ui.progressFill.style.width = `${pct}%`;
    if (ui.progressPct) ui.progressPct.textContent = `${Math.round(pct)}%`;
  };

  const goNext = ()=>{
    if (done) return;
    done = true;

    setGateDone(gatePhase, cat, gameId, pid);

    if (gatePhase === 'cooldown'){
      try{
        const day = hhDayKey();
        localStorage.setItem(`HHA_COOLDOWN_DONE:${cat}:${gameId}:${pid}:${day}`, '1');
        localStorage.setItem(`HHA_COOLDOWN_DONE:${cat}:${pid}:${day}`, '1');
      }catch(e){}
    }

    location.href = targetUrl;
  };

  if (ui.btnContinue) ui.btnContinue.onclick = goNext;
  if (ui.btnReplayGate) ui.btnReplayGate.onclick = ()=> location.reload();
  if (ui.btnBackHub) ui.btnBackHub.onclick = ()=> { location.href = hub || './hub.html'; };

  const tick = ()=>{
    if (done) return;
    setProgress(pct + (alreadyDone ? 25 : 10));
    if (pct >= 100){
      goNext();
      return;
    }
    setTimeout(tick, alreadyDone ? 90 : 160);
  };

  setProgress(6);
  setTimeout(tick, 120);
}
