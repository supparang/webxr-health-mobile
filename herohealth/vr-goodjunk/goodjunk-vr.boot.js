// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW, NO OVERRIDE)
// ✅ Auto-detect view: pc / mobile / vr / cvr
// ✅ "ห้าม override": ถ้า url มี view=... จะใช้เฉพาะตอนเป็น auto เท่านั้น
// ✅ Sets body class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Config vr-ui: lockPx + cooldownMs (global)
// ✅ Calls safe engine: goodjunk.safe.js -> boot(payload)
// ✅ Pass-through: run/diff/time/seed/hub/study params

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (k, def=null)=>{
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  };

  const clamp = (v,min,max)=>{
    v = Number(v);
    if(!Number.isFinite(v)) v = min;
    return v < min ? min : (v > max ? max : v);
  };

  // ---------------------------------------------------------
  // Auto view detect (NO OVERRIDE)
  // ---------------------------------------------------------
  function detectViewAuto(){
    // 1) If WebXR immersive-vr supported -> prefer vr (headset)
    // 2) If "cardboard-ish" (mobile + narrow + orientation landscape likely) -> cvr
    // 3) Else pc/mobile
    const ua = (navigator.userAgent || '').toLowerCase();
    const isMobileUA = /android|iphone|ipad|ipod|mobile/.test(ua);

    const W = DOC.documentElement.clientWidth || innerWidth;
    const H = DOC.documentElement.clientHeight || innerHeight;
    const isLandscape = W >= H;

    // heuristic: mobile + landscape => likely cardboard/cvr
    const likelyCVR = isMobileUA && isLandscape;

    // fallback base
    let base = isMobileUA ? 'mobile' : 'pc';
    if(likelyCVR) base = 'cvr';

    return base;
  }

  async function detectWebXRVR(){
    try{
      const xr = navigator.xr;
      if(!xr || !xr.isSessionSupported) return false;
      const ok = await xr.isSessionSupported('immersive-vr');
      return !!ok;
    }catch(_){
      return false;
    }
  }

  // "ห้าม override": ถ้าผู้ใช้ใส่ view=pc/vr/cvr/mobile เราจะ "ไม่ใช้" เว้นแต่ view=auto
  // (เพื่อกันการ override ที่ทำให้ระบบเพี้ยน)
  function resolveView(){
    const v = String(qs('view', 'auto') || 'auto').toLowerCase().trim();
    if(v && v !== 'auto'){
      // Do NOT allow override — stick to auto
      return 'auto';
    }
    return 'auto';
  }

  function setBodyView(view){
    const b = DOC.body;
    if(!b) return;

    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

    if(view === 'pc') b.classList.add('view-pc');
    else if(view === 'vr') b.classList.add('view-vr');
    else if(view === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-mobile');
  }

  // ---------------------------------------------------------
  // Safe-area CSS vars (sat/sab etc.)
  // ---------------------------------------------------------
  function applySafeAreaVars(){
    try{
      const root = DOC.documentElement;
      // --sat already from env(), but ensure numeric fallback exists
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
      const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
      const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
      root.style.setProperty('--sat', sat + 'px');
      root.style.setProperty('--sab', sab + 'px');
      root.style.setProperty('--sal', sal + 'px');
      root.style.setProperty('--sar', sar + 'px');
    }catch(_){}
  }

  // ---------------------------------------------------------
  // VR UI config (crosshair shooting)
  // ---------------------------------------------------------
  function configureVrUi(){
    // You asked: Phase2-6s and HP 10/12/14 are in safe.js already.
    // Here we only set crosshair feel.
    WIN.HHA_VRUI_CONFIG = Object.assign({
      lockPx: 28,
      cooldownMs: 90
    }, WIN.HHA_VRUI_CONFIG || {});
  }

  // ---------------------------------------------------------
  // Payload builder
  // ---------------------------------------------------------
  function buildPayload(viewResolved){
    const run  = String(qs('run','play')||'play').toLowerCase();
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const time = clamp(qs('time','80'), 20, 300);
    const seed = qs('seed', null) ?? qs('ts', null) ?? null;
    const hub  = qs('hub', null);

    // study passthrough
    const studyId = qs('studyId', qs('study', null));
    const phase = qs('phase', null);
    const conditionGroup = qs('conditionGroup', qs('cond', null));

    return {
      view: viewResolved,
      run,
      diff,
      time,
      seed,
      hub,
      studyId,
      phase,
      conditionGroup
    };
  }

  // ---------------------------------------------------------
  // Bossbar UI hooks (optional HTML element)
  // ---------------------------------------------------------
  function ensureBossbar(){
    // If page already has it, keep it.
    if(DOC.getElementById('gjBossbar')) return;

    const el = DOC.createElement('div');
    el.className = 'gj-bossbar';
    el.id = 'gjBossbar';
    el.setAttribute('aria-hidden','true');
    el.innerHTML = `
      <div class="wrap">
        <div class="tag" id="gjBossTag">BOSS</div>
        <div class="bar"><div class="fill" id="gjBossFill" style="width:100%"></div></div>
        <div class="hp" id="gjBossHp">HP 0/0</div>
      </div>
    `;
    DOC.body.appendChild(el);

    // listen boss events from safe.js
    const tag  = DOC.getElementById('gjBossTag');
    const fill = DOC.getElementById('gjBossFill');
    const hpEl = DOC.getElementById('gjBossHp');

    function onBoss(ev){
      try{
        const d = ev?.detail || {};
        const on = !!d.on;
        const bar = DOC.getElementById('gjBossbar');
        if(!bar) return;

        if(!on){
          bar.setAttribute('aria-hidden','true');
          DOC.documentElement.style.setProperty('--gj-boss-hp', '1');
          return;
        }

        bar.setAttribute('aria-hidden','false');

        const hp = Number(d.hp ?? 0);
        const hpMax = Math.max(1, Number(d.hpMax ?? 1));
        const phase = Number(d.phase ?? 1);

        const ratio = Math.max(0, Math.min(1, hp / hpMax));
        DOC.documentElement.style.setProperty('--gj-boss-hp', String(ratio));

        if(fill) fill.style.width = (ratio * 100).toFixed(1) + '%';
        if(hpEl) hpEl.textContent = `HP ${hp}/${hpMax}`;

        if(tag){
          tag.textContent = phase === 2 ? 'BOSS · PHASE 2' : (d.rage ? 'BOSS · RAGE' : 'BOSS');
          tag.classList.toggle('phase2', phase === 2 || !!d.rage);
        }
      }catch(_){}
    }

    WIN.addEventListener('hha:boss', onBoss, { passive:true });
    DOC.addEventListener('hha:boss', onBoss, { passive:true });
  }

  // ---------------------------------------------------------
  // Start
  // ---------------------------------------------------------
  async function start(){
    applySafeAreaVars();
    configureVrUi();
    ensureBossbar();

    const resolvedParam = resolveView(); // always 'auto' by design
    let view = detectViewAuto();

    // if headset VR supported -> mark as vr (auto)
    const xrOk = await detectWebXRVR();
    if(xrOk) view = 'vr';

    setBodyView(view);

    // update chip meta if exists
    try{
      const meta = DOC.getElementById('gjChipMeta');
      if(meta){
        meta.textContent = `view=${view} · run=${qs('run','play')} · diff=${qs('diff','normal')} · time=${qs('time','80')}`;
      }
    }catch(_){}

    const payload = buildPayload(view);

    // boot engine
    try{
      engineBoot(payload);
    }catch(err){
      console.error('[GoodJunkVR] boot failed', err);
      alert('Boot error: ' + (err?.message || err));
    }
  }

  // DOM ready
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', start, { once:true });
  }else{
    start();
  }

})();