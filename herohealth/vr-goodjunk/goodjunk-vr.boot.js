// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Start-gated boot (no target flash) + unify PC/Mobile/VR/cVR + UI glue (peek/lowtime/end/backhub)
'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='pc') return 'pc';
  if(v==='vr') return 'vr';
  if(v==='cvr') return 'cvr';
  return 'mobile';
}
function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add('view-'+view);
}
function $(sel){ return DOC.querySelector(sel); }
function byId(id){ return DOC.getElementById(id); }

let started = false;

function ensureVrUi(){
  if(ROOT.__HHA_VRUI_LOADED) return;
  ROOT.__HHA_VRUI_LOADED = true;
  const s = DOC.createElement('script');
  s.src = './vr/vr-ui.js';
  s.defer = true;
  DOC.head.appendChild(s);
}

function hide(el, yes=true){
  if(!el) return;
  el.setAttribute('aria-hidden', yes ? 'true' : 'false');
  el.style.pointerEvents = yes ? 'none' : 'auto';
}
function show(el){ hide(el,false); }

function setStartMeta(){
  const m = byId('start-meta');
  if(!m) return;
  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = qs('time','80');
  const seed = qs('seed','auto');
  m.textContent = `diff=${diff} • run=${run} • time=${time}s • seed=${seed}`;
}

function syncHudDup(){
  const score = byId('hud-score')?.textContent ?? '0';
  const time  = byId('hud-time')?.textContent ?? '0';
  byId('hud-score-dup') && (byId('hud-score-dup').textContent = score);
  byId('hud-time-dup')  && (byId('hud-time-dup').textContent  = time);
}

// Missions peek uses the same ids as HUD
function updatePeek(){
  const goal = byId('hud-goal')?.textContent ?? '—';
  const cur  = byId('hud-goal-cur')?.textContent ?? '0';
  const tar  = byId('hud-goal-target')?.textContent ?? '0';
  const mini = byId('hud-mini')?.textContent ?? '—';
  byId('peek-goal') && (byId('peek-goal').textContent = goal);
  byId('peek-goal-cur') && (byId('peek-goal-cur').textContent = cur);
  byId('peek-goal-target') && (byId('peek-goal-target').textContent = tar);
  byId('peek-mini') && (byId('peek-mini').textContent = mini);
}

function wirePeek(){
  const peek = byId('peek');
  const btn1 = byId('btn-missions');
  const btn2 = byId('btn-peek');
  const toggle = ()=>{
    if(!peek) return;
    const open = peek.getAttribute('aria-hidden') === 'true';
    updatePeek();
    open ? show(peek) : hide(peek,true);
  };
  btn1 && btn1.addEventListener('click', toggle);
  btn2 && btn2.addEventListener('click', toggle);
  peek && peek.addEventListener('click', ()=> hide(peek,true));
}

function wireHudHide(){
  const hideBtn = byId('btn-hud-hide');
  const showBtn = byId('btn-hud-show');
  hideBtn && hideBtn.addEventListener('click', ()=>{
    DOC.body.classList.add('hud-hidden');
    hideBtn.style.display = 'none';
    showBtn.style.display = 'inline-flex';
  });
  showBtn && showBtn.addEventListener('click', ()=>{
    DOC.body.classList.remove('hud-hidden');
    showBtn.style.display = 'none';
    hideBtn.style.display = 'inline-flex';
  });
}

function wireShoot(){
  const layer = byId('gj-layer');
  const btn = byId('btn-shoot');

  // Tap button -> shoot at center crosshair (best-effort): click element under center
  function shoot(){
    // VR UI module can dispatch hha:shoot too; we support both
    ROOT.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ source:'btn' } }));

    if(!layer) return;
    const x = Math.floor(innerWidth/2);
    const y = Math.floor(innerHeight/2);
    const el = DOC.elementFromPoint(x,y);

    // If it hits a target, forward click to it
    if(el && el.classList && el.classList.contains('gj-target')){
      el.click();
      return;
    }
    // Otherwise: pick nearest target around center (small radius)
    const targets = layer.querySelectorAll('.gj-target');
    if(!targets.length) return;
    let best = null, bestD = 1e9;
    for(const t of targets){
      const r = t.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const d = (cx-x)*(cx-x) + (cy-y)*(cy-y);
      if(d < bestD){ bestD = d; best = t; }
    }
    if(best && bestD < (160*160)) best.click();
  }

  btn && btn.addEventListener('click', shoot);
  ROOT.addEventListener('hha:shoot', (ev)=>{
    // allow vr-ui.js to call; if source already btn, ignore duplication
    if(ev?.detail?.source === 'btn') return;
    shoot();
  }, { passive:true });

  // Space / Enter
  ROOT.addEventListener('keydown', (e)=>{
    if(e.code === 'Space' || e.code === 'Enter'){
      e.preventDefault();
      shoot();
    }
  }, { passive:false });
}

function wireLowTime(){
  const overlay = $('.gj-lowtime-overlay');
  const num = byId('lowtime-num');

  let lastInt = null;

  ROOT.addEventListener('hha:time', (ev)=>{
    const t = Number(ev?.detail?.timeLeftSec ?? 0);

    // toggle warning classes
    DOC.body.classList.toggle('gj-lowtime', t <= 12 && t > 5);
    DOC.body.classList.toggle('gj-lowtime5', t <= 5 && t > 0);

    const ti = Math.ceil(t);
    if(ti !== lastInt){
      lastInt = ti;

      // tick pulse
      if(t <= 12 && t > 0){
        DOC.body.classList.add('gj-tick');
        setTimeout(()=>DOC.body.classList.remove('gj-tick'), 260);
      }

      // show big countdown for last 5 seconds
      if(t <= 5 && t > 0){
        if(num) num.textContent = String(ti);
        overlay && show(overlay);
        setTimeout(()=> overlay && hide(overlay,true), 240);
      }else{
        overlay && hide(overlay,true);
      }
    }
  }, { passive:true });
}

function wireEndSummary(){
  const end = byId('end');
  const line1 = byId('end-line1');
  const line2 = byId('end-line2');
  const meta = byId('end-meta');

  const btnReplay = byId('btn-replay');
  const btnHub = byId('btn-backhub');

  function goHub(){
    const hub = qs('hub', null);
    if(hub) location.href = hub;
    else location.href = './hub.html';
  }
  function replay(){
    // restart by reloading with same params but force run/play preserved
    location.reload();
  }

  btnReplay && btnReplay.addEventListener('click', replay);
  btnHub && btnHub.addEventListener('click', goHub);

  ROOT.addEventListener('hha:end', (ev)=>{
    const s = ev?.detail || {};
    if(line1) line1.textContent = `Grade: ${s.grade || '—'} • Score: ${s.scoreFinal ?? 0} • Miss: ${s.misses ?? 0}`;
    if(line2) line2.textContent = `AccGood: ${(s.accuracyGoodPct ?? 0).toFixed?.(1) ?? s.accuracyGoodPct}% • AvgRT: ${Math.round(s.avgRtGoodMs ?? 0)}ms • ComboMax: ${s.comboMax ?? 0}`;
    if(meta) meta.textContent = `reason=${s.reason || 'time'} • sessionId=${s.sessionId || '-'} • seed=${s.seed || '-'} • ver=${s.gameVersion || '-'}`;

    show(end);
  }, { passive:true });

  // click outside to close? (optional)
  end && end.addEventListener('click', (e)=>{
    // do not close when clicking buttons
    const t = e.target;
    if(t && (t.id === 'btn-replay' || t.id === 'btn-backhub')) return;
  });
}

function wireCoach(){
  const coachLine = byId('coach-line');
  const coachSub  = byId('coach-sub');
  ROOT.addEventListener('hha:coach', (ev)=>{
    const d = ev?.detail || {};
    if(d.text && coachLine) coachLine.textContent = d.text;
    if(d.why && coachSub) coachSub.textContent = d.why;
  }, { passive:true });
}

// START engine only after hha:start (from overlay)
function startEngine(opts={}){
  if(started) return;
  started = true;

  const view = normalizeView(opts.view || qs('view','mobile'));
  setBodyView(view);

  // Preload VR UI when user chooses VR/cVR
  if(view === 'vr' || view === 'cvr') ensureVrUi();

  // close start overlay
  hide(byId('start'), true);

  engineBoot({
    view,
    diff: (qs('diff','normal')||'normal'),
    run:  (qs('run','play')||'play'),
    time: Number(qs('time','80')||80),
    seed: qs('seed', null),
    hub:  qs('hub', null),

    // research meta (optional)
    studyId: qs('study', qs('studyId', null)),
    phase: qs('phase', null),
    conditionGroup: qs('cond', qs('conditionGroup', null)),
  });

  // Sync dup HUD (score/time) periodically
  setInterval(syncHudDup, 120);
}

function startWith(view){
  ROOT.dispatchEvent(new CustomEvent('hha:start', { detail:{ view } }));
}

ROOT.addEventListener('hha:start', (ev)=>{
  const view = ev?.detail?.view || qs('view','mobile');
  startEngine({ view });
}, { passive:true });

// Preload VR UI when user wants cVR
ROOT.addEventListener('hha:enter-cvr', ()=>{
  ensureVrUi();
}, { passive:true });

function wireStartOverlay(){
  const start = byId('start');
  const bAuto = byId('btn-start-auto');
  const bM = byId('btn-start-mobile');
  const bP = byId('btn-start-pc');
  const bV = byId('btn-start-vr');
  const bC = byId('btn-start-cvr');

  setStartMeta();
  show(start);

  const autoPick = ()=>{
    // if query says view, respect; else decide by screen width
    const vq = qs('view', null);
    if(vq) return normalizeView(vq);
    return (innerWidth >= 820) ? 'pc' : 'mobile';
  };

  bAuto && bAuto.addEventListener('click', ()=> startWith(autoPick()));
  bM && bM.addEventListener('click', ()=> startWith('mobile'));
  bP && bP.addEventListener('click', ()=> startWith('pc'));
  bV && bV.addEventListener('click', ()=> startWith('vr'));
  bC && bC.addEventListener('click', ()=>{
    ensureVrUi();
    startWith('cvr');
  });
}

function wireIdsForSafeJs(){
  // goodjunk.safe.js uses hud-score/hud-time/hud-grade as source of truth
  // We already included hidden spans; sync dup ones
  syncHudDup();
}

DOC.addEventListener('DOMContentLoaded', ()=>{
  wireIdsForSafeJs();
  wireStartOverlay();
  wirePeek();
  wireHudHide();
  wireShoot();
  wireLowTime();
  wireEndSummary();
  wireCoach();

  // missions peek quick close via Escape
  ROOT.addEventListener('keydown', (e)=>{
    if(e.code === 'Escape'){
      hide(byId('peek'), true);
    }
  }, { passive:true });
});