// === /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR BOOT — PRODUCTION (Auto detect only + Tap-to-start + HUD/FX binds)
// ✅ Auto-detect view: pc / mobile / cvr (NO ?view override)
// ✅ Tap-to-start for mobile/cvr (gesture unlock)
// ✅ Robust waitForEngine
// ✅ HUD/Quest/Power/Coach binds
// ✅ Ultra FX bridge (particles.js + body classes)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (k, def=null)=>{
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  };
  const clamp = (v,a,b)=>{
    v = Number(v); if (!isFinite(v)) v = a;
    return v<a?a:(v>b?b:v);
  };

  // ---------- detect view (NO override) ----------
  function detectView(){
    const ua = (navigator.userAgent||'').toLowerCase();
    const isMobile = /android|iphone|ipad|ipod/.test(ua);
    const W = Math.max(1, WIN.innerWidth||1), H = Math.max(1, WIN.innerHeight||1);
    const landscape = W >= H;

    // mobile + landscape-ish => cvr
    if (isMobile && landscape && W <= 1024) return 'cvr';

    // pc vs mobile
    return (W >= 980 && !isMobile) ? 'pc' : 'mobile';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-'+view);
  }

  // ---------- element helpers ----------
  function byIdAny(ids){
    for (const id of ids){
      const el = DOC.getElementById(id);
      if (el) return el;
    }
    return null;
  }
  function bySelAny(sels){
    for (const s of sels){
      const el = DOC.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  const elTime  = ()=> byIdAny(['vTime','timeLeft','time','hudTime']) || bySelAny(['[data-hud="time"]']);
  const elScore = ()=> byIdAny(['vScore','scoreVal','score','hudScore']) || bySelAny(['[data-hud="score"]']);
  const elCombo = ()=> byIdAny(['vCombo','comboVal','combo','hudCombo']) || bySelAny(['[data-hud="combo"]']);
  const elMiss  = ()=> byIdAny(['vMiss','missVal','miss','hudMiss']) || bySelAny(['[data-hud="miss"]']);
  const elRank  = ()=> byIdAny(['vRank','rankVal','rank','hudRank']) || bySelAny(['[data-hud="rank"]']);
  const elAcc   = ()=> byIdAny(['vAcc','accVal','acc','hudAcc']) || bySelAny(['[data-hud="acc"]']);
  const elMode  = ()=> byIdAny(['vMode','modeVal','mode','hudMode']) || bySelAny(['[data-hud="mode"]']);

  const elGoalTitle = ()=> byIdAny(['goalTitle']);
  const elGoalCount = ()=> byIdAny(['goalCount']);
  const elGoalFill  = ()=> byIdAny(['goalFill']);
  const elGoalSub   = ()=> byIdAny(['goalSub']);

  const elMiniTitle = ()=> byIdAny(['miniTitle']);
  const elMiniTime  = ()=> byIdAny(['miniTime']);
  const elMiniFill  = ()=> byIdAny(['miniFill']);
  const elMiniSub   = ()=> byIdAny(['miniSub']);

  const elCoachText = ()=> byIdAny(['coachText']);
  const elCoachImg  = ()=> byIdAny(['coachImg']);

  const elPFill = ()=> byIdAny(['pFill']);
  const elPCur  = ()=> byIdAny(['pCur']);
  const elPThr  = ()=> byIdAny(['pThr']);

  function getLayerEl(){
    return DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  }

  // ---------- FX bridge ----------
  function ensureFX(){
    return (WIN.Particles && typeof WIN.Particles.popText === 'function') ? WIN.Particles : null;
  }
  function fxPop(x,y,text){
    const P = ensureFX();
    if (!P) return;
    try{ P.popText(x,y,text,''); }catch(_){}
  }
  function fxBurst(x,y,n){
    const P = ensureFX();
    if (!P) return;
    try{ P.burst(x,y,n||12); }catch(_){}
  }

  let __fxLock = 0;
  function flashFx(cls, ms){
    const t = (WIN.performance && performance.now) ? performance.now() : Date.now();
    if (t < __fxLock) return;
    __fxLock = t + 70;
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls); }catch(_){} }, ms||220);
    }catch(_){}
  }

  // ---------- binds ----------
  function bindHud(){
    WIN.addEventListener('hha:score', (ev)=>{
      const d = ev.detail||{};
      const a = elScore(); if (a) a.textContent = String(d.score ?? 0);
      const b = elCombo(); if (b) b.textContent = String(d.combo ?? 0);
      const c = elMiss();  if (c) c.textContent = String(d.misses ?? 0);
    }, {passive:true});

    WIN.addEventListener('hha:time', (ev)=>{
      const d = ev.detail||{};
      const a = elTime(); if (a) a.textContent = String(Math.max(0, Math.round(d.left ?? 0)));
    }, {passive:true});

    WIN.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail||{};
      const a = elRank(); if (a) a.textContent = String(d.grade ?? 'C');
      const b = elAcc();  if (b) b.textContent  = String((d.accuracy ?? 0) + '%');
    }, {passive:true});

    WIN.addEventListener('hha:coach', (ev)=>{
      const d = ev.detail||{};
      const t = elCoachText(); if (t) t.textContent = String(d.text||'');
      const mood = String(d.mood||'neutral');
      const img =
        (mood==='happy') ? '../img/coach-happy.png' :
        (mood==='sad')   ? '../img/coach-sad.png' :
        (mood==='fever') ? '../img/coach-fever.png' :
                          '../img/coach-neutral.png';
      const im = elCoachImg(); if (im) im.src = img;
    }, {passive:true});

    WIN.addEventListener('groups:power', (ev)=>{
      const d = ev.detail||{};
      const cur = Number(d.charge||0);
      const thr = Math.max(1, Number(d.threshold||8));
      const a = elPCur(); if (a) a.textContent = String(cur|0);
      const b = elPThr(); if (b) b.textContent = String(thr|0);
      const f = elPFill(); if (f) f.style.width = Math.round((cur/thr)*100) + '%';
    }, {passive:true});

    WIN.addEventListener('quest:update', (ev)=>{
      const d = ev.detail||{};

      const gTitle = String(d.goalTitle||'—');
      const gNow = Number(d.goalNow||0);
      const gTot = Math.max(1, Number(d.goalTotal||1));
      const gPct = clamp(d.goalPct ?? (gNow/gTot*100), 0, 100);

      const gt = elGoalTitle(); if (gt) gt.textContent = '🎯 GOAL';
      const gc = elGoalCount(); if (gc) gc.textContent = `${gNow}/${gTot}`;
      const gf = elGoalFill();  if (gf) gf.style.width = Math.round(gPct) + '%';
      const gs = elGoalSub();   if (gs) gs.textContent = gTitle;

      const mTitle = String(d.miniTitle||'—');
      const mNow = Number(d.miniNow||0);
      const mTot = Math.max(1, Number(d.miniTotal||1));
      const mPct = clamp(d.miniPct ?? (mNow/mTot*100), 0, 100);
      const mLeft = Number(d.miniTimeLeftSec||0);

      const mt = elMiniTitle(); if (mt) mt.textContent = '⚡ MINI';
      const mf = elMiniFill();  if (mf) mf.style.width = Math.round(mPct) + '%';
      const ms = elMiniSub();   if (ms) ms.textContent = mTitle;
      const mm = elMiniTime();  if (mm) mm.textContent = (mLeft>0) ? `${mLeft}s` : '—';

      DOC.body.classList.toggle('mini-urgent', (mLeft>0 && mLeft<=3));
    }, {passive:true});

    WIN.addEventListener('hha:judge', (ev)=>{
      const d = ev.detail||{};
      const kind = String(d.kind||'');
      const x = Number(d.x||0), y = Number(d.y||0);
      const txt = String(d.text||'');

      if (x>0 && y>0 && txt){
        fxPop(x,y,txt);
        if (kind === 'good')    fxBurst(x,y,12);
        if (kind === 'perfect') fxBurst(x,y,18);
        if (kind === 'boss')    fxBurst(x,y,14);
      }

      if (kind === 'good')    flashFx('fx-good', 200);
      if (kind === 'bad')     flashFx('fx-bad', 240);
      if (kind === 'miss')    flashFx('fx-miss', 220);
      if (kind === 'perfect') flashFx('fx-perfect', 240);
      if (kind === 'boss')    flashFx('fx-hit', 200);
      if (kind === 'storm')   { DOC.body.classList.add('fx-storm'); setTimeout(()=>DOC.body.classList.remove('fx-storm'), 900); }
    }, {passive:true});
  }

  // ---------- wait for engine ----------
  function waitForEngine(cb){
    const t0 = Date.now();
    const it = setInterval(()=>{
      const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
      if (E && typeof E.start === 'function' && typeof E.setLayerEl === 'function'){
        clearInterval(it);
        cb(E);
        return;
      }
      if (Date.now() - t0 > 8000){
        clearInterval(it);
        try{
          WIN.dispatchEvent(new CustomEvent('hha:coach', {
            detail:{ text:'โหลดเอนจินไม่ขึ้น (groups.safe.js) — เช็ค path/ชื่อไฟล์ แล้วรีเฟรช', mood:'sad' }
          }));
        }catch(_){}
      }
    }, 60);
  }

  // ---------- tap overlay ----------
  function ensureTapOverlay(){
    let ov = DOC.getElementById('tapStartOverlay');
    if (ov) return ov;

    ov = DOC.createElement('div');
    ov.id = 'tapStartOverlay';
    ov.style.cssText = `
      position:fixed; inset:0; z-index:120;
      display:flex; align-items:center; justify-content:center;
      padding:18px;
      background: rgba(2,6,23,.72);
      backdrop-filter: blur(10px);
    `;
    const card = DOC.createElement('div');
    card.style.cssText = `
      width:min(520px,100%);
      border-radius:26px;
      background: rgba(2,6,23,.86);
      border: 1px solid rgba(148,163,184,.20);
      box-shadow: 0 24px 70px rgba(0,0,0,.55);
      padding: 16px;
      color:#e5e7eb;
      font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    `;
    card.innerHTML = `
      <div style="font-weight:1000;font-size:20px;">👉 Tap-to-start</div>
      <div style="margin-top:6px;color:#94a3b8;font-weight:800;font-size:13px;line-height:1.35;">
        มือถือ/VR ต้องแตะ 1 ครั้งเพื่อปลดล็อกเสียง/เต็มจอ แล้วเกมจะเริ่มเอง
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button id="btnTapStart" style="
          flex:1; border-radius:18px; padding:12px 12px; cursor:pointer;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.20);
          color:#e5e7eb; font-weight:1000;">✅ เริ่มเกม</button>
        <button id="btnTapSkip" style="
          flex:1; border-radius:18px; padding:12px 12px; cursor:pointer;
          border:1px solid rgba(148,163,184,.20);
          background: rgba(15,23,42,.65);
          color:#e5e7eb; font-weight:1000;">⏭️ ข้าม</button>
      </div>
      <div style="margin-top:10px;color:#94a3b8;font-weight:800;font-size:12px;">
        cVR: ยิงด้วย crosshair (แตะจอ) • ปุ่ม ENTER VR/RECENTER อยู่ vr-ui.js
      </div>
    `;
    ov.appendChild(card);
    DOC.body.appendChild(ov);
    return ov;
  }

  async function unlockGesture(){
    try{
      const A = WIN.GroupsVR && WIN.GroupsVR.Audio;
      A && A.unlock && A.unlock();
    }catch(_){}
    try{
      const view = detectView();
      if (view === 'cvr' && DOC.documentElement.requestFullscreen){
        await DOC.documentElement.requestFullscreen().catch(()=>{});
      }
    }catch(_){}
  }

  function startEngine(){
    const view = detectView();
    setBodyView(view);

    const runRaw = String(qs('run','play')||'play').toLowerCase();
    const run  = (runRaw==='research') ? 'research' : (runRaw==='practice' ? 'practice' : 'play');
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const style= String(qs('style','mix')||'mix').toLowerCase();
    const time = clamp(qs('time',90), 30, 180);
    const seed = String(qs('seed', Date.now()) || Date.now());

    const m = elMode(); if (m) m.textContent = (run==='research') ? 'RESEARCH' : (run==='practice'?'PRACTICE':'PLAY');

    waitForEngine((E)=>{
      E.setLayerEl(getLayerEl());
      E.start(diff, { runMode: run, diff, style, time, seed, view });

      // AIHooks attach point (safe)
      try{
        const AIH = WIN.GroupsVR && WIN.GroupsVR.AIHooks;
        AIH && AIH.attach && AIH.attach({ runMode: run, seed, enabled: (run==='play') && (String(qs('ai','0'))==='1') });
      }catch(_){}
    });
  }

  function boot(){
    bindHud();
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text:'กำลังเตรียมเกม…', mood:'neutral' } }));
    }catch(_){}

    const view = detectView();
    const needTap = (view !== 'pc'); // mobile/cvr always tap once

    if (!needTap){
      startEngine();
      return;
    }

    const ov = ensureTapOverlay();
    const btnStart = DOC.getElementById('btnTapStart');
    const btnSkip  = DOC.getElementById('btnTapSkip');

    const go = async ()=>{
      try{ await unlockGesture(); }catch(_){}
      try{ ov.remove(); }catch(_){}
      startEngine();
    };

    if (btnStart) btnStart.addEventListener('click', go, {passive:true});
    if (btnSkip)  btnSkip.addEventListener('click', go, {passive:true});

    ov.addEventListener('click', (e)=>{
      if (e.target && (e.target.id==='btnTapStart' || e.target.id==='btnTapSkip')) return;
      go();
    }, {passive:true});
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();

})();