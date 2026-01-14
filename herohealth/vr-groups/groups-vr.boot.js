// === /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR Boot — PRODUCTION
// ✅ auto-detect view (but NEVER override explicit ?view=...)
// ✅ sets body class view-*
// ✅ Tap-to-start gate for touch/cVR (audio/gyro/fullscreen friendly)
// ✅ starts engine (GroupsVR.GameEngine) when ready
// ✅ passes run/diff/style/time/seed/practice/ai
// ✅ works with A: groups-vr.html (run page)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const $ = (id)=>DOC.getElementById(id);

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function isTouch(){
    return ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-'+view);
  }

  function detectViewNoOverride(){
    const explicit = String(qs('view','')||'').toLowerCase().trim();
    if (explicit) return explicit;

    const touch = isTouch();
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (touch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function aiEnabled(){
    const run = String(qs('run','play')||'play').toLowerCase();
    const on  = String(qs('ai','0')||'0').toLowerCase();
    if (run === 'research') return false;
    return (on === '1' || on === 'true');
  }

  function getPracticeSec(view){
    const p = String(qs('practice','0')||'0').toLowerCase();
    let sec = Number(p)||0;
    if (p === '1' || p === 'true') sec = 15;
    sec = clamp(sec, 0, 30);
    if (view !== 'cvr') sec = 0;
    return sec;
  }

  // ---------- Tap gate ----------
  function needsTapGate(view){
    // บนมือถือส่วนใหญ่ต้อง tap ก่อน (policy/browser)
    if (isTouch()) return true;
    // กันเคส cVR บางเครื่อง
    if (String(view||'') === 'cvr') return true;
    return false;
  }

  function ensureTapGate(){
    let el = DOC.getElementById('tapGate');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'tapGate';
    el.className = 'tapGate hidden';
    el.innerHTML = `
      <div class="tapPanel">
        <div class="tapTitle">🟢 Tap-to-start</div>
        <div class="tapSub">แตะหนึ่งครั้งเพื่อเปิดเสียง/เต็มจอ/เซ็นเซอร์ แล้วจะเริ่มเกมทันที</div>
        <button id="tapGo" class="tapBtn" type="button">▶️ เริ่มเลย</button>
        <div class="tapHint">Tip: cVR จะมี Calibration (RECENTER + ยิง 3 ครั้ง) ในหน้า Run</div>
      </div>
    `;
    DOC.body.appendChild(el);

    const btn = DOC.getElementById('tapGo');
    btn && btn.addEventListener('click', ()=>{
      hideTapGate();
      startFlow(); // เริ่มจริงหลัง tap
    }, {passive:true});

    // tap ที่พื้นก็เริ่มได้
    el.addEventListener('click', (e)=>{
      const id = (e && e.target && e.target.id) ? e.target.id : '';
      if (id === 'tapGo') return;
      hideTapGate();
      startFlow();
    }, {passive:true});

    return el;
  }

  function showTapGate(){
    const el = ensureTapGate();
    el.classList.remove('hidden');
    DOC.body.classList.add('tap-gate');
  }

  function hideTapGate(){
    const el = DOC.getElementById('tapGate');
    if (el) el.classList.add('hidden');
    DOC.body.classList.remove('tap-gate');
  }

  // ---------- Engine start ----------
  function getLayerEl(){
    return $('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  }

  function initViewHelper(view){
    try{
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.init && H.init({ view });
    }catch(_){}
  }

  function waitForEngine(cb){
    const t0 = Date.now();
    const it = setInterval(()=>{
      const E = WIN.GroupsVR && WIN.GroupsVR.GameEngine;
      if (E && typeof E.start === 'function' && typeof E.setLayerEl === 'function'){
        clearInterval(it);
        cb(E);
        return;
      }
      if (Date.now() - t0 > 9000){
        clearInterval(it);
        try{
          WIN.dispatchEvent(new CustomEvent('hha:coach', {
            detail:{ text:'โหลดเอนจินไม่ขึ้น (groups.safe.js). เช็ค path/ชื่อไฟล์ แล้วรีเฟรช', mood:'sad' }
          }));
        }catch(_){}
      }
    }, 70);
  }

  function startFlow(){
    const view = String(detectViewNoOverride()||'mobile').toLowerCase();
    const run  = (String(qs('run','play')||'play').toLowerCase()==='research') ? 'research' : 'play';
    const diff = String(qs('diff','easy')||'easy').toLowerCase();
    const style= String(qs('style','feel')||'feel').toLowerCase();
    const time = clamp(qs('time',90), 30, 180);
    const seed = String(qs('seed', Date.now()) || Date.now());
    const practiceSec = getPracticeSec(view);

    setBodyView(view);
    initViewHelper(view);

    waitForEngine((E)=>{
      E.setLayerEl(getLayerEl());

      // practice เฉพาะ cVR + practice>0 (เราจะให้ runMode เป็น play แต่ time สั้น)
      if (view === 'cvr' && practiceSec > 0){
        const seedP = String(seed) + '-practice';
        E.start(diff, { runMode:'practice', diff, style, time: practiceSec, seed: seedP, view });
        return;
      }

      // real run
      E.start(diff, {
        runMode: run,
        diff, style,
        time, seed,
        view
      });

      // AI hooks attach (safe)
      try{
        const AI = WIN.GroupsVR && WIN.GroupsVR.AIHooks;
        if (AI && AI.attach){
          AI.attach({ runMode: run, seed, enabled: aiEnabled() && run!=='research' });
        }
      }catch(_){}
    });
  }

  // ---------- Boot ----------
  (function boot(){
    const view = String(detectViewNoOverride()||'mobile').toLowerCase();
    setBodyView(view);

    // ถ้าต้อง tap -> โชว์ gate แล้วรอ
    if (needsTapGate(view)){
      showTapGate();
      return;
    }
    // desktop -> เริ่มเลย
    startFlow();
  })();

})();