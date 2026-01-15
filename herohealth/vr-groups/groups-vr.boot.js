// === C: /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR Boot — PRODUCTION
// ✅ Auto-detect view: pc / mobile / cvr (cardboard) / vr (immersive)
// ✅ Tap-to-start gate (gesture unlock) — required on mobile
// ✅ Start once (hard guard)
// ✅ Bind HUD/Quest/Coach/Power/End events
// ✅ Safe: if engine loads slow -> wait up to 8s

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if (!DOC || WIN.__HHA_GROUPS_BOOT__) return;
  WIN.__HHA_GROUPS_BOOT__ = true;

  // ---------- helpers ----------
  const $ = (id)=>DOC.getElementById(id);

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-'+view);
  }

  function detectView(){
    // explicit param wins (but if you want “no override”, comment this block)
    const p = String(qs('view','')||'').toLowerCase().trim();
    if (p === 'pc' || p === 'mobile' || p === 'vr' || p === 'cvr') return p;

    // crude heuristics
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (Math.min(WIN.innerWidth, WIN.innerHeight) < 820);

    // if in webxr immersive -> vr (but we can’t know before enter)
    // for cardboard mode, you typically pass view=cvr from launcher
    // so default: mobile
    return isMobile ? 'mobile' : 'pc';
  }

  function runMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    return (r === 'research') ? 'research' : 'play';
  }

  function getCfg(){
    const view = detectView();
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const style= String(qs('style','feel')||'feel').toLowerCase();
    const seed = String(qs('seed', Date.now()) || Date.now());
    const time = clamp(qs('time', 90), 30, 180);
    const ai   = String(qs('ai','0')||'0');
    return { view, diff, style, seed, time, ai };
  }

  function hasFX(){
    return !!(WIN.Particles && (WIN.Particles.popText || WIN.Particles.burst || WIN.Particles.celebrate));
  }
  function fxPop(x,y,text){
    try{ if (hasFX() && WIN.Particles.popText) WIN.Particles.popText(x,y,text,''); }catch(_){}
  }
  function fxBurst(x,y,n){
    try{ if (hasFX() && WIN.Particles.burst) WIN.Particles.burst(x,y,n||14); }catch(_){}
  }
  function fxCelebrate(){
    try{ if (hasFX() && WIN.Particles.celebrate) WIN.Particles.celebrate(); }catch(_){}
  }

  // ---------- UI: Tap-to-start overlay ----------
  function ensureTapOverlay(){
    let el = DOC.querySelector('.tapStartOverlay');
    if (el) return el;

    el = DOC.createElement('div');
    el.className = 'tapStartOverlay';
    el.style.cssText = `
      position:fixed; inset:0; z-index:95;
      display:flex; align-items:center; justify-content:center;
      padding:18px;
      background: rgba(2,6,23,.78);
      backdrop-filter: blur(10px);
    `;
    el.innerHTML = `
      <div style="
        width:min(560px,100%);
        border-radius:26px;
        padding:16px;
        border:1px solid rgba(148,163,184,.20);
        background: rgba(2,6,23,.88);
        box-shadow: 0 24px 70px rgba(0,0,0,.55);
        color:#e5e7eb;
        font-family: system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">
        <div style="font-weight:1000;font-size:20px;">🎮 Food Groups VR</div>
        <div style="margin-top:6px;font-weight:800;color:#94a3b8;font-size:13px;line-height:1.35;">
          แตะเพื่อเริ่มเกม (Tap-to-start) เพื่อปลดล็อกเสียง/เต็มจอ/การยิงในมือถือ
        </div>
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="btnTapStart" style="
            flex:1 1 auto;
            padding:12px 14px;border-radius:18px;
            border:1px solid rgba(34,197,94,.35);
            background: rgba(34,197,94,.20);
            color:#e5e7eb;font-weight:1000;
          ">✅ TAP TO START</button>
          <button id="btnTapSkip" style="
            flex:1 1 auto;
            padding:12px 14px;border-radius:18px;
            border:1px solid rgba(148,163,184,.20);
            background: rgba(15,23,42,.55);
            color:#e5e7eb;font-weight:1000;
          ">⏭️ เริ่มแบบเงียบ</button>
        </div>
        <div style="margin-top:10px;font-weight:800;color:#94a3b8;font-size:12px;">
          Cardboard/cVR: ใช้ crosshair แล้วยิงด้วย “แตะจอ”
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  // ---------- bind events to HUD ----------
  function bindHud(){
    WIN.addEventListener('hha:time', (ev)=>{
      const d = ev.detail||{};
      const v = $('timeLeft'); if (v) v.textContent = String(Math.max(0, Math.round(d.left ?? 0)));
    }, {passive:true});

    WIN.addEventListener('hha:score', (ev)=>{
      const d = ev.detail||{};
      const s = $('scoreVal'); if (s) s.textContent = String(d.score ?? 0);
      const c = $('comboVal'); if (c) c.textContent = String(d.combo ?? 0);
      const m = $('missVal');  if (m) m.textContent = String(d.misses ?? 0);
    }, {passive:true});

    WIN.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail||{};
      const r = $('rankVal'); if (r) r.textContent = String(d.grade ?? 'C');
      const a = $('accVal');  if (a) a.textContent = String((d.accuracy ?? 0) + '%');
    }, {passive:true});

    WIN.addEventListener('hha:coach', (ev)=>{
      const d = ev.detail||{};
      const t = $('coachText'); if (t) t.textContent = String(d.text||'');
      const mood = String(d.mood||'neutral');
      const img =
        (mood==='happy') ? '../img/coach-happy.png' :
        (mood==='sad')   ? '../img/coach-sad.png' :
        (mood==='fever') ? '../img/coach-fever.png' :
                           '../img/coach-neutral.png';
      const ci = $('coachImg'); if (ci) ci.src = img;
    }, {passive:true});

    WIN.addEventListener('quest:update', (ev)=>{
      const d = ev.detail||{};
      const gn = $('goalNow');   if (gn) gn.textContent = String(d.goalNow ?? 0);
      const gt = $('goalTotal'); if (gt) gt.textContent = String(d.goalTotal ?? 1);
      const gf = $('goalFill');  if (gf) gf.style.width = Math.round(d.goalPct ?? 0) + '%';
      const gti= $('goalTitle'); if (gti) gti.textContent = String(d.goalTitle ?? '—');
      const gs = $('goalSub');   if (gs) gs.textContent  = String(d.groupName ? `หมู่เป้าหมาย: ${d.groupName}` : '');

      const mn = $('miniNow');   if (mn) mn.textContent = String(d.miniNow ?? 0);
      const mt = $('miniTotal'); if (mt) mt.textContent = String(d.miniTotal ?? 1);
      const mf = $('miniFill');  if (mf) mf.style.width = Math.round(d.miniPct ?? 0) + '%';
      const mti= $('miniTitle'); if (mti) mti.textContent = String(d.miniTitle ?? '—');

      const ms = $('miniSub');
      if (ms){
        const left = Number(d.miniTimeLeftSec||0);
        ms.textContent = left>0 ? `เหลือ ${left}s` : '';
      }

      DOC.body.classList.toggle('mini-urgent', (Number(d.miniTimeLeftSec||0) > 0 && Number(d.miniTimeLeftSec||0) <= 3));
    }, {passive:true});

    WIN.addEventListener('groups:power', (ev)=>{
      const d = ev.detail||{};
      const cur = Number(d.charge||0);
      const thr = Math.max(1, Number(d.threshold||8));
      const pf = $('powerFill'); if (pf) pf.style.width = Math.round(cur/thr*100) + '%';
      const pt = $('powerText'); if (pt) pt.textContent = `พลัง ${cur|0}/${thr|0}`;
    }, {passive:true});

    WIN.addEventListener('hha:judge', (ev)=>{
      const d = ev.detail||{};
      // optional pop FX from judge positions
      const x = Number(d.x||0), y = Number(d.y||0);
      const txt = String(d.text||'');
      if (x>0 && y>0 && txt){
        fxPop(x,y,txt);
        if (String(d.kind||'') === 'good') fxBurst(x,y,12);
        if (String(d.kind||'') === 'perfect') fxBurst(x,y,18);
      }
    }, {passive:true});

    WIN.addEventListener('hha:end', (ev)=>{
      const d = ev.detail||{};
      const eo = $('endOverlay'); if (!eo) return;
      eo.classList.remove('hidden');

      const es = $('endScore'); if (es) es.textContent = String(d.scoreFinal ?? 0);
      const eg = $('endGrade'); if (eg) eg.textContent = String(d.grade ?? 'C');
      const ea = $('endAcc');   if (ea) ea.textContent = String((d.accuracyGoodPct ?? 0) + '%');
      const em = $('endMiss');  if (em) em.textContent = String(d.misses ?? 0);

      fxCelebrate();
    }, {passive:true});

    const replay = $('btnReplay');
    replay && replay.addEventListener('click', ()=>location.reload());
  }

  // ---------- engine wait ----------
  function waitEngine(ms, cb){
    const t0 = Date.now();
    const it = setInterval(()=>{
      const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
      if (E && typeof E.start === 'function' && typeof E.setLayerEl === 'function'){
        clearInterval(it);
        cb(E);
        return;
      }
      if (Date.now() - t0 > (ms||8000)){
        clearInterval(it);
        try{
          WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{
            text:'โหลดเอนจินไม่ขึ้น (groups.safe.js) — เช็ค path/ชื่อไฟล์ แล้วรีเฟรช',
            mood:'sad'
          }}));
        }catch(_){}
      }
    }, 60);
  }

  // ---------- unlock gesture ----------
  function unlockGesture(){
    // unlock audio if any module uses it
    try{
      const A = WIN.GroupsVR && WIN.GroupsVR.Audio;
      if (A && A.unlock) A.unlock();
    }catch(_){}
  }

  // ---------- start once ----------
  let started = false;
  function startGame(E){
    if (started) return;
    started = true;

    const cfg = getCfg();
    setBodyView(cfg.view);

    // layer
    const layer = $('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
    E.setLayerEl(layer);

    // start
    E.start(cfg.diff, { runMode: runMode(), diff: cfg.diff, style: cfg.style, time: cfg.time, seed: cfg.seed, view: cfg.view });

    // if view=cvr, encourage immersive if helper exists (optional)
    try{
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.tryImmersiveForCVR && H.tryImmersiveForCVR();
    }catch(_){}
  }

  function boot(){
    bindHud();

    const cfg = getCfg();
    setBodyView(cfg.view);

    // show tap overlay always on mobile/cvr; on pc you can auto-start after short delay
    const isPc = (cfg.view === 'pc');
    const overlay = ensureTapOverlay();
    const btnStart = DOC.getElementById('btnTapStart');
    const btnSkip  = DOC.getElementById('btnTapSkip');

    function hideOverlay(){
      try{ overlay.remove(); }catch(_){}
    }

    // PC: auto-start (still keep overlay for 1.2s, user can tap sooner)
    if (isPc){
      setTimeout(()=>{
        if (started) return;
        waitEngine(8000, (E)=>{
          hideOverlay();
          startGame(E);
        });
      }, 700);
    }

    function doStart(withUnlock){
      if (withUnlock) unlockGesture();
      waitEngine(8000, (E)=>{
        hideOverlay();
        startGame(E);
      });
    }

    btnStart && btnStart.addEventListener('click', ()=>doStart(true));
    btnSkip  && btnSkip.addEventListener('click', ()=>doStart(false));

    // also allow tapping anywhere on overlay card area
    overlay.addEventListener('click', (e)=>{
      // prevent accidental start if clicking inside buttons already
      if (e.target && (e.target.id === 'btnTapStart' || e.target.id === 'btnTapSkip')) return;
      // single tap starts
      doStart(true);
    }, { passive:false });
  }

  if (DOC.readyState === 'complete' || DOC.readyState === 'interactive') boot();
  else DOC.addEventListener('DOMContentLoaded', boot, { once:true });

})();