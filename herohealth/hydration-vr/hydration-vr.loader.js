// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) แต่ "ห้าม override" ถ้ามี ?view มาแล้ว
// ✅ Cardboard: ?cardboard=1 => adds body.cardboard + set window.HHA_VIEW.layers = [L,R]
// ✅ cVR strict: view=cvr => body.view-cvr (ยิงจาก crosshair ผ่าน vr-ui.js -> hha:shoot)
// ✅ Mobile/PC classes: body.view-mobile / body.view-pc
// ✅ Start overlay: tap/click => dispatch hha:start (ครั้งเดียว)
// ✅ Best-effort fullscreen + orientation hint สำหรับ mobile/cardboard
// ✅ Pass-through: ไม่ยุ่ง query string อื่น ๆ

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ---------- detect view (used ONLY if no ?view) ----------
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // มือถือแนวนอน + จอกว้างพอ => cVR (ยิงกลางจอ)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v==='pc' || v==='desktop') return 'pc';
    if (v==='mobile' || v==='phone') return 'mobile';
    if (v==='cvr' || v==='vr' || v==='cardboard') return 'cvr';
    return '';
  }

  const viewParam = normalizeView(qs('view',''));
  const view = viewParam || detectView(); // ✅ no override if provided
  const cardboard = String(qs('cardboard','0')).toLowerCase();
  const isCardboard = (cardboard==='1' || cardboard==='true' || cardboard==='yes');

  // ---------- apply body classes ----------
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');

  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  if (isCardboard) b.classList.add('cardboard');

  // ---------- layer wiring (Cardboard split) ----------
  // hydration.safe.js จะอ่าน window.HHA_VIEW.layers เพื่อ spawn ให้ 2 ฝั่ง
  function setupLayers(){
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');
    const cbWrap = DOC.getElementById('cbWrap');

    if (isCardboard && L && R){
      if (cbWrap) cbWrap.hidden = false;
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
      return;
    }
    if (cbWrap) cbWrap.hidden = true;
    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    WIN.HHA_VIEW.layers = ['hydration-layer'];
  }

  // ---------- fullscreen / orientation helpers ----------
  async function tryFullscreen(){
    // ไม่บังคับ — แค่ best-effort เมื่อเป็น mobile/cvr/cardboard
    if (!(view==='mobile' || view==='cvr')) return;
    const el = DOC.documentElement;
    try{
      if (DOC.fullscreenElement) return;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) await req.call(el);
    }catch(_){}
  }

  async function tryLandscapeLock(){
    // Cardboard แนะนำแนวนอน
    if (!isCardboard) return;
    try{
      const scr = screen;
      const o = scr && scr.orientation;
      if (o && typeof o.lock === 'function'){
        await o.lock('landscape');
      }
    }catch(_){}
  }

  function setOverlayText(){
    const ovSub = DOC.getElementById('ovSub');
    if (!ovSub) return;

    const kids = String(qs('kids','0')).toLowerCase();
    const KIDS = (kids==='1' || kids==='true' || kids==='yes');

    const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const t = clamp(parseInt(qs('time', 70),10) || 70, 10, 600);

    const viewLabel =
      isCardboard ? 'Cardboard' :
      (view==='cvr' ? 'cVR' : (view==='pc' ? 'PC' : 'Mobile'));

    ovSub.textContent =
      `โหมด: ${viewLabel} • run=${run} • diff=${diff} • ${t}s`
      + (KIDS ? ' • kids=ON' : '');
  }

  // ---------- start overlay ----------
  let started = false;

  function fireStart(){
    if (started) return;
    started = true;

    const ov = DOC.getElementById('startOverlay');
    try{
      ov?.classList.add('hide');
      ov?.setAttribute('hidden','');
    }catch(_){}

    // ส่ง event มาตรฐานให้ hydration.safe.js เริ่มเกม
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');

    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach((el)=>{
      el.addEventListener('click', ()=>{ location.href = hub; });
    });

    btn?.addEventListener('click', async ()=>{
      // หลัง user gesture ค่อยลอง fullscreen/lock
      await tryFullscreen();
      await tryLandscapeLock();
      fireStart();
    });

    // แตะที่ฉาก overlay ก็เริ่มได้
    ov?.addEventListener('pointerdown', async (ev)=>{
      // กันการลาก/ซูม
      try{ ev.preventDefault(); }catch(_){}
      await tryFullscreen();
      await tryLandscapeLock();
      fireStart();
    }, { passive:false });
  }

  // ---------- init ----------
  setupLayers();
  setOverlayText();
  bindOverlay();

  // กรณีบางที overlay ถูกซ่อนโดยบั๊ก/สไตล์: auto-start แบบ safe (แต่ยังรอ 1 วินาที)
  setTimeout(()=>{
    const ov = DOC.getElementById('startOverlay');
    const hidden = !ov || ov.hasAttribute('hidden') || getComputedStyle(ov).display==='none';
    if (hidden && !started){
      fireStart();
    }
  }, 1000);

})();