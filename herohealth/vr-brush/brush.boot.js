// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — PRODUCTION (HHA Standard)
// ✅ ctx passthrough + auto seed
// ✅ view classes: pc/mobile/cvr/vr
// ✅ practice 15s (optional) before real game
// ✅ calibration helper for cVR/Cardboard (recenter tips)
// ✅ AI hooks placeholder (disabled by default in research)

(function(){
  'use strict';

  const WIN = window, DOC = document;

  function getQS(){
    try{ return new URL(location.href).searchParams; }
    catch{ return new URLSearchParams(); }
  }
  const QS = getQS();
  const q = (k, def='') => (QS.get(k) ?? def);
  const qNum = (k, def=0) => {
    const v = Number(q(k, def));
    return Number.isFinite(v) ? v : def;
  };

  // -------- view detection / classes --------
  function detectView(){
    const v = (q('view','')||'').toLowerCase();
    if(v) return v;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (Math.min(screen.width, screen.height) <= 480);
    return isMobile ? 'mobile' : 'pc';
  }
  function applyViewClass(view){
    DOC.body.setAttribute('data-view', view);
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    DOC.body.classList.add(view==='cvr' ? 'view-cvr' : view==='vr' ? 'view-vr' : view==='mobile' ? 'view-mobile' : 'view-pc');
  }

  // -------- ctx passthrough --------
  function hubUrl(){
    const hub = q('hub','');
    return hub ? hub : '';
  }

  function ensureSeed(){
    const s = (q('seed','')||'').trim();
    if(s) return s;
    const auto = String(Date.now());
    // update URL w/out reload? easiest: keep in ctx only
    return auto;
  }

  const MODE = (q('run','play')||'play').toLowerCase(); // play | research
  const DIFF = (q('diff','normal')||'normal').toLowerCase();
  const TIME = Math.max(30, Math.min(180, qNum('time', 90)));
  const VIEW = (detectView()||'pc').toLowerCase();

  const CTX = {
    game: 'brush',
    hub: hubUrl(),
    view: VIEW,
    mode: MODE,
    diff: DIFF,
    time: TIME,
    seed: ensureSeed(),

    pid: (q('pid','')||'').trim(),
    studyId: (q('studyId','')||'').trim(),
    phase: (q('phase','')||'').trim(),
    conditionGroup: (q('conditionGroup','')||'').trim(),
    log: (q('log','')||'').trim() // "1" -> on
  };

  applyViewClass(VIEW);

  // -------- AI hooks (PACK 15) --------
  // If you later add window.HHA.createAIHooks(seed, gameKey) return:
  // { getDifficulty(), getTip(state), onEvent(type,payload) }
  function makeAI(){
    const fallback = {
      getDifficulty(){ return null; },
      getTip(){ return null; },
      onEvent(){ }
    };
    try{
      if(typeof WIN.HHA?.createAIHooks === 'function'){
        const hooks = WIN.HHA.createAIHooks(CTX.seed, 'brush');
        return Object.assign({}, fallback, hooks||{});
      }
    }catch(_){}
    return fallback;
  }
  const AI = makeAI();

  // -------- Practice mode (PACK 14) --------
  // default: on in play, off in research unless ?practice=1
  const PRACTICE_ON = (String(q('practice',''))==='1') ? true : (MODE==='play');
  const PRACTICE_SEC = Math.max(10, Math.min(20, qNum('practiceSec', 15)));

  function showPracticeOverlay(on, left=0){
    let el = DOC.getElementById('practiceOverlay');
    if(!el){
      el = DOC.createElement('div');
      el.id = 'practiceOverlay';
      el.style.position='fixed';
      el.style.inset='0';
      el.style.zIndex='61';
      el.style.display='grid';
      el.style.placeItems='center';
      el.style.background='rgba(2,6,23,.62)';
      el.style.backdropFilter='blur(10px)';
      el.style.opacity='0';
      el.style.pointerEvents='none';
      el.style.transition='opacity .18s ease';
      el.innerHTML = `
        <div style="width:min(640px,92vw);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:18px 16px;background:rgba(2,6,23,.78);box-shadow:0 18px 60px rgba(0,0,0,.45);">
          <div style="font-weight:900;font-size:18px;">🧪 Practice Mode</div>
          <div id="prSub" style="margin-top:6px;color:rgba(148,163,184,1);font-size:13px;line-height:1.5;">
            ซ้อมก่อนเริ่มจริง
          </div>
          <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btnSkipPractice" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.40);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Skip</button>
            <button id="btnStartPractice" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(34,197,94,.22);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Start</button>
          </div>
        </div>
      `;
      DOC.body.appendChild(el);

      el.querySelector('#btnSkipPractice')?.addEventListener('click', ()=>{
        el.style.opacity='0'; el.style.pointerEvents='none';
        startRealGame();
      });

      el.querySelector('#btnStartPractice')?.addEventListener('click', ()=>{
        el.style.opacity='0'; el.style.pointerEvents='none';
        startPractice();
      });
    }
    const sub = el.querySelector('#prSub');
    if(sub) sub.textContent = `ซ้อม ${left||PRACTICE_SEC} วินาที: ตีให้ตรงจังหวะ (Perfect/Good)`;
    el.style.opacity = on ? '1' : '0';
    el.style.pointerEvents = on ? 'auto' : 'none';
  }

  // -------- calibration helper (PACK 13) --------
  function showCalibTip(){
    // show only for cvr/vr and only once per session
    if(!(VIEW==='cvr' || VIEW==='vr')) return;
    const k='HHA_BRUSH_CALIB_SHOWN';
    try{ if(sessionStorage.getItem(k)==='1') return; sessionStorage.setItem(k,'1'); }catch(_){}
    const el = DOC.createElement('div');
    el.style.position='fixed';
    el.style.left='50%';
    el.style.top='16px';
    el.style.transform='translateX(-50%)';
    el.style.zIndex='62';
    el.style.maxWidth='92vw';
    el.style.padding='10px 12px';
    el.style.borderRadius='14px';
    el.style.border='1px solid rgba(148,163,184,.22)';
    el.style.background='rgba(2,6,23,.72)';
    el.style.color='rgba(229,231,235,.95)';
    el.style.backdropFilter='blur(8px)';
    el.style.fontWeight='800';
    el.style.fontSize='13px';
    el.textContent = '🧭 ถ้ากากบาทไม่ตรงกลาง ให้กด RECENTER ก่อนเริ่ม';
    DOC.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 2600);
  }

  // -------- tap-to-start gating --------
  function needTapStart(){
    if(VIEW==='pc') return false;
    // mobile/cvr/vr: require interaction for audio/input reliability
    return true;
  }
  function showTapStart(on){
    const tap = DOC.getElementById('tapStart');
    if(!tap) return;
    tap.style.display = on ? 'grid' : 'none';
    tap.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  // -------- start sequences --------
  let PRACTICE_DONE = false;

  function startPractice(){
    PRACTICE_DONE = true;

    // practice ctx: shorter time, no badges persistence impact (engine already writes summary; ok)
    const pctx = Object.assign({}, CTX, {
      mode: 'practice',
      time: PRACTICE_SEC,
      // keep seed but mark phase
      phase: (CTX.phase ? (CTX.phase + '_practice') : 'practice')
    });

    // Coach hint (optional)
    try{
      const tip = AI.getTip?.({ kind:'practice', view:VIEW, diff:DIFF });
      if(tip && tip.title) WIN.dispatchEvent(new CustomEvent('hha:coach', {detail: tip}));
    }catch(_){}

    // boot engine
    WIN.BrushVR?.boot?.(pctx);

    // force end to real game after PRACTICE_SEC + buffer
    setTimeout(()=> {
      // reload to clean practice state then real
      startRealGame(true);
    }, Math.round((PRACTICE_SEC + 0.8)*1000));
  }

  function startRealGame(fromPracticeReload=false){
    if(fromPracticeReload){
      // reload clean with practice=0 marker
      try{
        const u = new URL(location.href);
        u.searchParams.set('practice', '0');
        location.replace(u.toString());
        return;
      }catch(_){}
    }
    WIN.BrushVR?.boot?.(CTX);
  }

  // -------- init --------
  function init(){
    showCalibTip();

    const tapBtn = DOC.getElementById('tapBtn');
    const tapGate = needTapStart();

    if(tapGate){
      showTapStart(true);
      tapBtn?.addEventListener('click', (ev)=>{
        ev.preventDefault();
        showTapStart(false);

        // practice prompt?
        if(PRACTICE_ON && !PRACTICE_DONE){
          showPracticeOverlay(true, PRACTICE_SEC);
        }else{
          startRealGame();
        }
      }, {passive:false});
    }else{
      showTapStart(false);

      // practice prompt?
      if(PRACTICE_ON){
        showPracticeOverlay(true, PRACTICE_SEC);
      }else{
        startRealGame();
      }
    }

    // if user exits VR, keep view updated (vr-ui emits these)
    WIN.addEventListener('hha:enter-vr', ()=>{
      // don't override explicit URL view; only set body class
      applyViewClass('vr');
    });
    WIN.addEventListener('hha:exit-vr', ()=>{
      applyViewClass(detectView());
    });
  }

  init();
})();