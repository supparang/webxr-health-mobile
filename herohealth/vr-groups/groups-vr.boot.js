/* === /herohealth/vr-groups/groups-vr.boot.js ===
GroupsVR Boot (PRODUCTION)
✅ Detect view WITHOUT overriding explicit ?view=
✅ Tap-to-start gate for mobile/cVR (required by browsers)
✅ PACK 13: Calibration 2-step for cVR
✅ PACK 14: Practice 15s for cVR (practice=1)
✅ Starts GroupsVR.GameEngine (groups.safe.js)
✅ AIHooks attach only when run=play & ai=1 (never in research/practice)
*/

(function(){
  'use strict';

  const DOC = document;
  const WIN = window;
  if (!DOC || !WIN) return;

  const $ = (id)=>DOC.getElementById(id);

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function isTouch(){
    return ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
  }

  function getExplicitView(){
    const v = String(qs('view','')||'').toLowerCase().trim();
    return v || '';
  }

  function detectViewNoOverride(){
    const explicit = getExplicitView();
    if (explicit) return explicit;

    const touch = isTouch();
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (touch){
      // แนวคิดเดิมของคุณ: มือถือจอใหญ่แนวนอน → cVR
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-'+view);
  }

  function runMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    return (r==='research') ? 'research' : 'play';
  }

  function aiEnabled(){
    const run = runMode();
    const on = String(qs('ai','0')||'0').toLowerCase();
    if (run === 'research') return false;
    return (on==='1' || on==='true');
  }

  function getPracticeSec(view){
    // practice=1 => 15s, เฉพาะ cVR
    const p = String(qs('practice','0')||'0');
    let sec = Number(p)||0;
    if (p === '1') sec = 15;
    sec = clamp(sec, 0, 30);
    if (view !== 'cvr') sec = 0;
    return sec;
  }

  function needsTapGate(view){
    // ปลอดภัยสุด: touch หรือ cVR ให้ tap ก่อนเสมอ
    if (isTouch()) return true;
    if (String(view||'') === 'cvr') return true;
    return false;
  }

  // ---------- Tap Gate (สร้างแบบไม่ต้องพึ่ง HTML ก็ได้) ----------
  function ensureTapGate(){
    let el = DOC.getElementById('hhaTapGate');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'hhaTapGate';
    el.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      display:flex; align-items:center; justify-content:center;
      padding:18px;
      background: rgba(2,6,23,.72);
      backdrop-filter: blur(10px);
    `;
    el.innerHTML = `
      <div style="
        width:min(560px,100%);
        border-radius:26px;
        background: rgba(2,6,23,.86);
        border:1px solid rgba(148,163,184,.20);
        box-shadow:0 26px 90px rgba(0,0,0,.60);
        padding:16px;
        color:#e5e7eb;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">
        <div style="font-weight:1000;font-size:20px;">🟢 Tap-to-start</div>
        <div style="margin-top:6px;font-weight:850;color:#94a3b8;line-height:1.35;font-size:13px;">
          แตะหนึ่งครั้งเพื่อให้ browser อนุญาตเสียง/เต็มจอ/เซ็นเซอร์ แล้วจะเริ่มเกมทันที
        </div>
        <button id="hhaTapGo" type="button" style="
          margin-top:12px;width:100%;
          border-radius:18px;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.20);
          color:#e5e7eb;font-weight:1000;
          padding:12px 14px; cursor:pointer;
        ">▶️ เริ่มเลย</button>
        <div style="margin-top:10px;font-weight:850;color:#94a3b8;line-height:1.35;font-size:13px;">
          Cardboard (cVR): เข้าแล้วกด RECENTER ที่ vr-ui.js และยิงจาก crosshair
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function hideTapGate(){
    const el = DOC.getElementById('hhaTapGate');
    if (el) el.remove();
  }

  // ---------- Hooks: audio/view-helper (ถ้ามี) ----------
  function hookAudio(){
    const A = WIN.GroupsVR && WIN.GroupsVR.Audio;
    if (!A) return;

    try{ A.unlock && A.unlock(); }catch{}

    WIN.addEventListener('hha:judge', (ev)=>{
      const d = ev.detail||{};
      const k = String(d.kind||'').toLowerCase();
      if (k==='good') A.good();
      else if (k==='bad') A.bad();
      else if (k==='boss') A.boss();
      else if (k==='miss') A.bad();
    }, {passive:true});

    WIN.addEventListener('groups:progress', (ev)=>{
      const d = ev.detail||{};
      const kind = String(d.kind||'');
      if (kind==='storm_on') A.storm();
      if (kind==='boss_spawn') A.boss();
      if (kind==='perfect_switch') A.good();
    }, {passive:true});

    let tmr = 0;
    function tickLoop(){
      clearTimeout(tmr);
      const urgent = DOC.body.classList.contains('mini-urgent') || DOC.body.classList.contains('groups-storm-urgent');
      if (urgent) A.tick();
      tmr = setTimeout(tickLoop, urgent ? 420 : 650);
    }
    tickLoop();
  }

  function initViewHelper(view){
    try{
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.init && H.init({ view });
    }catch(_){}
  }

  // ---------- Engine wait ----------
  function waitForEngine(cb){
    const t0 = Date.now();
    const it = setInterval(()=>{
      const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
      if (E && typeof E.start==='function' && typeof E.setLayerEl==='function'){
        clearInterval(it);
        cb(E);
        return;
      }
      if (Date.now() - t0 > 7000){
        clearInterval(it);
        try{
          WIN.dispatchEvent(new CustomEvent('hha:coach', {
            detail:{ text:'โหลดเอนจินไม่ขึ้น (groups.safe.js) — เช็ค path/ชื่อไฟล์ แล้วรีเฟรช', mood:'sad' }
          }));
        }catch(_){}
      }
    }, 60);
  }

  function getLayerEl(){
    return $('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  }

  // ---------- Calibration (PACK 13) ----------
  const cal = { on:false, step:0, shots:0, done:false };

  function ensureCalOverlay(){
    // ถ้า A มี overlay อยู่แล้ว ใช้ของ A
    const existing = $('calOverlay');
    if (existing) return existing;

    // ถ้าไม่มีก็สร้างแบบเรียบ ๆ
    const el = DOC.createElement('div');
    el.id = 'calOverlay';
    el.style.cssText = `
      position:fixed; inset:0; z-index:9000;
      display:flex; align-items:center; justify-content:center;
      padding:18px;
      background: rgba(2,6,23,.72);
      backdrop-filter: blur(10px);
    `;
    el.innerHTML = `
      <div style="
        width:min(560px,100%);
        border-radius:26px;
        background: rgba(2,6,23,.86);
        border:1px solid rgba(148,163,184,.20);
        box-shadow:0 26px 90px rgba(0,0,0,.60);
        padding:16px;
        color:#e5e7eb;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      ">
        <div style="font-weight:1000;font-size:20px;">🧭 Calibration (cVR)</div>
        <div id="calSub" style="margin-top:6px;font-weight:850;color:#94a3b8;line-height:1.35;font-size:13px;">
          Step 1/2: กด RECENTER แล้วถือมือถือให้นิ่งตรงหน้า
        </div>
        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="padding:12px;border-radius:18px;background:rgba(15,23,42,.62);border:1px solid rgba(148,163,184,.16);">
            <div style="font-weight:900;font-size:12px;color:#94a3b8;">Step</div>
            <div id="calStep" style="margin-top:4px;font-weight:1000;font-size:20px;">1/2</div>
          </div>
          <div style="padding:12px;border-radius:18px;background:rgba(15,23,42,.62);border:1px solid rgba(148,163,184,.16);">
            <div style="font-weight:900;font-size:12px;color:#94a3b8;">Shots</div>
            <div id="calShots" style="margin-top:4px;font-weight:1000;font-size:20px;">0/3</div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:10px;">
          <button id="btnCalNext" type="button" style="
            flex:1 1 auto;border-radius:18px;border:1px solid rgba(34,197,94,.35);
            background: rgba(34,197,94,.20);color:#e5e7eb;font-weight:1000;padding:12px 14px;cursor:pointer;
          ">✅ ต่อไป</button>
          <button id="btnCalSkip" type="button" style="
            flex:1 1 auto;border-radius:18px;border:1px solid rgba(148,163,184,.20);
            background: rgba(15,23,42,.65);color:#e5e7eb;font-weight:1000;padding:12px 14px;cursor:pointer;
          ">⏭️ ข้าม</button>
        </div>
        <div style="margin-top:10px;font-weight:850;color:#94a3b8;line-height:1.35;font-size:13px;">
          cVR: แตะจอเพื่อยิงจาก crosshair • ใช้ RECENTER เพื่อปรับศูนย์มุมมอง
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function showCal(on){
    const el = ensureCalOverlay();
    if (!el) return;
    el.style.display = on ? 'flex' : 'none';
    DOC.body.classList.toggle('calibration', !!on);
  }

  function setCalStep(step){
    cal.step = step;
    const stepEl = $('calStep');
    const subEl  = $('calSub');
    const shotsEl= $('calShots');
    const nextBt = $('btnCalNext');

    if (stepEl) stepEl.textContent = `${step}/2`;
    if (shotsEl) shotsEl.textContent = `${cal.shots}/3`;

    if (subEl){
      if (step === 1){
        subEl.innerHTML = `Step 1/2: กด <b>RECENTER</b> แล้วถือมือถือให้นิ่งตรงหน้า`;
      } else {
        subEl.innerHTML = `Step 2/2: ลองยิง <b>3 ครั้ง</b> (แตะจอ) เพื่อทดสอบ crosshair`;
      }
    }

    if (nextBt){
      if (step === 1){
        nextBt.textContent = '✅ ต่อไป';
        nextBt.disabled = false;
      } else {
        nextBt.textContent = (cal.shots>=3) ? '🚀 เริ่มเลย' : 'ยิงให้ครบ 3 ครั้ง';
        nextBt.disabled = (cal.shots < 3);
      }
    }
  }

  function startCalibrationIfNeeded(view){
    if (view !== 'cvr') return false;

    cal.on = true;
    cal.done = false;
    cal.shots = 0;

    showCal(true);
    setCalStep(1);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', {
        detail:{ text:'Calibration: กด RECENTER ก่อน แล้วกด “ต่อไป” ✅', mood:'neutral' }
      }));
    }catch(_){}
    return true;
  }

  function finishCalibration(){
    cal.on = false;
    cal.done = true;
    showCal(false);
  }

  // นับยิงใน calibration step 2
  WIN.addEventListener('hha:shoot', ()=>{
    if (!cal.on) return;
    if (cal.step !== 2) return;
    cal.shots = Math.min(3, (cal.shots|0) + 1);
    setCalStep(2);
  }, {passive:true});

  function bindCalButtons(onDone){
    const nextBt = $('btnCalNext');
    const skipBt = $('btnCalSkip');

    if (nextBt){
      nextBt.onclick = ()=>{
        if (!cal.on) return;
        if (cal.step === 1){
          setCalStep(2);
          return;
        }
        if (cal.step === 2 && cal.shots >= 3){
          finishCalibration();
          onDone && onDone();
        }
      };
    }
    if (skipBt){
      skipBt.onclick = ()=>{
        if (!cal.on) return;
        finishCalibration();
        onDone && onDone();
      };
    }
  }

  // ---------- Start flows ----------
  let practiceActive = false;
  let practiceDone = false;

  function startPractice(E, cfg){
    practiceActive = true;
    practiceDone = false;

    // HUD label (ถ้ามี)
    try{ const el = $('vMode'); if (el) el.textContent='PRACTICE'; }catch(_){}

    initViewHelper('cvr');
    E.setLayerEl(getLayerEl());
    E.start(cfg.diff, { runMode:'practice', diff:cfg.diff, style:cfg.style, time: cfg.practiceSec, seed: cfg.seedP, view:'cvr' });

    try{
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.tryImmersiveForCVR && H.tryImmersiveForCVR();
    }catch(_){}

    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', {
        detail:{ text:`Practice ${cfg.practiceSec}s: ลองยิงให้แม่นก่อนเข้าเกมจริง!`, mood:'happy' }
      }));
    }catch(_){}
  }

  function startReal(E){
    const view = String(qs('view', detectViewNoOverride())||detectViewNoOverride()).toLowerCase();
    const run  = runMode(); // play|research
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const style= String(qs('style','mix')||'mix').toLowerCase();
    const time = clamp(qs('time',90), 30, 180);
    const seed = String(qs('seed', Date.now()) || Date.now());

    // HUD label (ถ้ามี)
    try{ const el = $('vMode'); if (el) el.textContent = (run==='research') ? 'RESEARCH' : 'PLAY'; }catch(_){}

    initViewHelper(view);
    E.setLayerEl(getLayerEl());
    E.start(diff, { runMode: run, diff, style, time, seed, view });

    // AI hooks attach (safe)
    try{
      const AI = WIN.GroupsVR && WIN.GroupsVR.AIHooks;
      if (AI && AI.attach){
        AI.attach({ runMode: run, seed, enabled: aiEnabled() && run!=='research' });
      }
    }catch(_){}
  }

  // practice chain -> when practice ends, auto start real
  WIN.addEventListener('hha:end', ()=>{
    if (!practiceActive || practiceDone) return;
    practiceDone = true;
    practiceActive = false;

    const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
    if (E && typeof E.start==='function'){
      setTimeout(()=> startReal(E), 180);
    }
  }, {passive:true});

  function startAfterCalibration(E, view){
    const run  = runMode();
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const style= String(qs('style','mix')||'mix').toLowerCase();
    const seed = String(qs('seed', Date.now()) || Date.now());

    const practiceSec = getPracticeSec(view);
    if (view === 'cvr' && practiceSec > 0){
      const seedP = String(seed) + '-practice';
      startPractice(E, { diff, style, seedP, practiceSec });
      return;
    }
    startReal(E);
  }

  function startCore(){
    const view = String(qs('view', detectViewNoOverride())||detectViewNoOverride()).toLowerCase();
    setView(view);
    hookAudio();
    initViewHelper(view);

    // cVR -> Calibration gate
    const gated = startCalibrationIfNeeded(view);
    if (gated){
      bindCalButtons(()=>{
        waitForEngine((E)=> startAfterCalibration(E, view));
      });
      return;
    }

    waitForEngine((E)=> startAfterCalibration(E, view));
  }

  // ---------- Entry ----------
  const view0 = String(qs('view', detectViewNoOverride())||detectViewNoOverride()).toLowerCase();
  setView(view0);

  if (needsTapGate(view0)){
    const gate = ensureTapGate();
    const goBtn = DOC.getElementById('hhaTapGo');
    const go = ()=>{
      hideTapGate();
      startCore();
    };
    if (goBtn) goBtn.addEventListener('click', go, {passive:true});
    gate.addEventListener('click', (e)=>{
      // คลิกที่พื้นหลัง = ไปเลย
      const id = (e && e.target && e.target.id) ? e.target.id : '';
      if (id === 'hhaTapGo') return;
      go();
    }, {passive:true});
    return;
  }

  startCore();

})();