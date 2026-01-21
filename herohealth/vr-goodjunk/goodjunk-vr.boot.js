// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PACK S (FAIR, production wiring)
// ✅ Detect view (pc/mobile/vr/cvr) BUT never override if ?view= provided
// ✅ Pass-through ctx: hub/run/diff/time/seed/studyId/study/phase/conditionGroup/log/style/ts
// ✅ Adds body classes: view-*, run-*, diff-*
// ✅ Hooks hha:shoot => pointer hit (for cVR crosshair/tap-to-shoot via vr-ui.js)
// ✅ Wait DOM + wait layer + boot engine once
// ✅ Safe-area measure already done in goodjunk-vr.html (sets --gj-top-safe/--gj-bottom-safe)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; } catch(_){ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); } catch(_){ return false; } };

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'auto';
}

async function detectView(){
  // NEVER override if user passed ?view=
  if(has('view')) return normalizeView(qs('view','auto'));

  // best-effort: use UA first
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // optional: if WebXR immersive-vr supported on device, prefer vr on mobile
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok){
        guess = isLikelyMobileUA() ? 'vr' : 'pc';
      }
    }
  }catch(_){}

  return normalizeView(guess);
}

function setBodyView(v){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(v==='pc') b.classList.add('view-pc');
  else if(v==='vr') b.classList.add('view-vr');
  else if(v==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile'); // default
}

function setBodyTags(run, diff){
  const b = DOC.body;
  // run
  b.classList.remove('run-play','run-research');
  b.classList.add(run==='research' ? 'run-research' : 'run-play');
  // diff
  b.classList.remove('diff-easy','diff-normal','diff-hard');
  const d = (diff==='easy'||diff==='hard') ? diff : 'normal';
  b.classList.add(`diff-${d}`);
}

function getCtx(){
  // pass-through research ctx
  const ctx = {
    hub: qs('hub', null),
    view: normalizeView(qs('view', 'auto')),
    run: String(qs('run','play')||'play').toLowerCase(),
    diff: String(qs('diff','normal')||'normal').toLowerCase(),
    time: Number(qs('time','80')||'80') || 80,
    seed: qs('seed', null) ?? qs('ts', null) ?? String(Date.now()),

    // research extras
    studyId: qs('studyId', null) ?? qs('study', null),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', null) ?? qs('cond', null),
    log: qs('log', null),
    style: qs('style', null),
    ts: qs('ts', null)
  };
  return ctx;
}

function waitForElm(sel, timeoutMs=2400){
  return new Promise((resolve)=>{
    const t0 = performance.now();
    const tick = ()=>{
      const el = DOC.querySelector(sel);
      if(el) return resolve(el);
      if(performance.now() - t0 >= timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/* ---------- Crosshair shoot -> simulate pointer hit ---------- */
/* vr-ui.js emits: hha:shoot {x,y,lockPx,source} */
function attachShootBridge(){
  if(WIN.__GJ_SHOOT_BRIDGE__) return;
  WIN.__GJ_SHOOT_BRIDGE__ = true;

  WIN.addEventListener('hha:shoot', (ev)=>{
    try{
      const d = ev?.detail || {};
      const x = Number(d.x ?? (WIN.innerWidth/2));
      const y = Number(d.y ?? (WIN.innerHeight/2));
      const lockPx = Number(d.lockPx ?? 28);

      // find topmost element around crosshair
      let target = null;

      // sample a tiny grid to catch fast-moving emoji
      const pts = [
        [x,y],[x-lockPx,y],[x+lockPx,y],[x,y-lockPx],[x,y+lockPx],
        [x-lockPx,y-lockPx],[x+lockPx,y-lockPx],[x-lockPx,y+lockPx],[x+lockPx,y+lockPx],
      ];

      for(const [px,py] of pts){
        const el = DOC.elementFromPoint(px, py);
        if(!el) continue;
        // allow clicking target or inside target
        const t = el.closest?.('.gj-target');
        if(t){ target = t; break; }
      }

      if(target){
        // dispatch pointerdown so safe.js listener works
        const e = new PointerEvent('pointerdown', { bubbles:true, cancelable:true, clientX:x, clientY:y });
        target.dispatchEvent(e);
      }
    }catch(_){}
  }, { passive:true });
}

/* ---------- Main boot ---------- */
async function main(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const ctx = getCtx();

  // if view was auto, detect
  if(ctx.view === 'auto'){
    ctx.view = await detectView();
  }

  setBodyView(ctx.view);
  setBodyTags(ctx.run, ctx.diff);

  // Let UI chip update already happens in HTML; here we just ensure game layer exists
  await waitForElm('#gj-layer', 2800);
  attachShootBridge();

  // Let other modules know game is about to start
  emit('hha:boot', {
    gameId: 'goodjunk',
    view: ctx.view,
    run: ctx.run,
    diff: ctx.diff,
    time: ctx.time,
    seed: ctx.seed,
    studyId: ctx.studyId,
    phase: ctx.phase,
    conditionGroup: ctx.conditionGroup
  });

  // IMPORTANT: Start engine after DOM stable
  try{
    engineBoot({
      view: ctx.view,
      run: ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed,
      hub: ctx.hub,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      log: ctx.log,
      style: ctx.style,
      ts: ctx.ts
    });
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed', err);
    // show something minimal to user
    try{
      alert('เริ่มเกมไม่สำเร็จ (boot error) — เปิด console ดูรายละเอียด');
    }catch(_){}
  }
}

// start once
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', ()=>main(), { once:true });
}else{
  main();
}