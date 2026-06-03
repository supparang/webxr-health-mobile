/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.mobile-scroll-unlock.js
 * PATCH v20260519-P58-BRUSH-KIDS-MOBILE-SCROLL-UNSTUCK
 *
 * Purpose:
 * - แก้มือถือเลื่อนลงไม่ได้ / หน้าเหมือนค้าง
 * - ตอน Prep/Menu ให้ page scroll ได้จริง
 * - กัน brushInputLayer จับนิ้วก่อนเริ่มเกม
 * - ซ่อน Scan Mission / Boss Break ตอนยังไม่ได้เล่นจริง
 * - ปรับ mobile layout ไม่ให้ topbar/card ทับกัน
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const ROOT = DOC.documentElement;
  const PATCH_ID = 'v20260519-P58-BRUSH-KIDS-MOBILE-SCROLL-UNSTUCK';

  function $(id){
    return DOC.getElementById(id);
  }

  function qs(){
    try{
      return new URLSearchParams(WIN.location.search || '');
    }catch(_){
      return new URLSearchParams();
    }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function text(el){
    try{
      return el ? String(el.innerText || el.textContent || '').trim() : '';
    }catch(_){
      return '';
    }
  }

  function numFromText(v, fallback){
    const m = String(v || '').match(/-?\d+(?:\.\d+)?/);
    if(!m) return fallback || 0;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function visible(el){
    if(!el) return false;
    if(el.hidden) return false;

    try{
      const cs = WIN.getComputedStyle(el);
      if(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0'){
        return false;
      }
    }catch(_){}

    return true;
  }

  function isMobileView(){
    const view = String(param('view', '')).toLowerCase();

    if(view === 'mobile') return true;

    try{
      return WIN.matchMedia && WIN.matchMedia('(max-width: 760px)').matches;
    }catch(_){
      return WIN.innerWidth <= 760;
    }
  }

  function isSummaryOpen(){
    const modal = $('summaryModal');
    return visible(modal);
  }

  function metrics(){
    const zoneRaw = text($('zoneText')) || '0/6';
    const zm = zoneRaw.match(/(\d+)\s*\/\s*(\d+)/);

    return {
      score: numFromText(text($('scoreText')), 0),
      combo: numFromText(text($('comboText')), 0),
      clean: numFromText(text($('cleanText')), 0),
      plaque: numFromText(text($('threatText')), 100),
      zoneDone: zm ? Number(zm[1]) || 0 : 0,
      zoneTotal: zm ? Number(zm[2]) || 6 : 6
    };
  }

  function flowStage(){
    return String(
      (DOC.body && DOC.body.getAttribute('data-brush-flow-stage')) ||
      ROOT.getAttribute('data-brush-flow-stage') ||
      ''
    ).toLowerCase();
  }

  function hasStartOverride(){
    try{
      if(ROOT.getAttribute('data-brush-start-requested') === '1') return true;
      if(ROOT.getAttribute('data-brush-flow-stage') === 'brush') return true;

      if(DOC.body){
        if(DOC.body.getAttribute('data-brush-start-requested') === '1') return true;
        if(DOC.body.getAttribute('data-brush-real-started') === '1') return true;
        if(DOC.body.getAttribute('data-brush-flow-stage') === 'brush') return true;
      }

      if(WIN.HHA_BRUSH_START_UNLOCK_STATE && WIN.HHA_BRUSH_START_UNLOCK_STATE.startRequested){
        return true;
      }

      if(
        WIN.HHA_BRUSH_START_UNLOCK &&
        typeof WIN.HHA_BRUSH_START_UNLOCK.state === 'function'
      ){
        const s = WIN.HHA_BRUSH_START_UNLOCK.state();
        if(s && s.startRequested) return true;
      }

      if(
        WIN.HHA_BRUSH_TOOTHPASTE_PREP &&
        typeof WIN.HHA_BRUSH_TOOTHPASTE_PREP.state === 'function'
      ){
        const p = WIN.HHA_BRUSH_TOOTHPASTE_PREP.state();
        if(p && p.started) return true;
      }
    }catch(_){}

    return false;
  }

  function isPrepLike(){
    if(isSummaryOpen()) return false;
    if(hasStartOverride()) return false;

    const run = String(param('run','')).toLowerCase();
    const stage = flowStage();

    if(stage === 'prep') return true;
    if(run === 'menu' || run === 'prep' || run === 'howto' || run === 'practice') return true;

    const m = metrics();
    if(m.score <= 0 && m.combo <= 0 && m.clean <= 0 && m.zoneDone <= 0){
      return true;
    }

    return false;
  }

  function ensureStyle(){
    if($('hha-mobile-scroll-unlock-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-mobile-scroll-unlock-style';
    style.textContent = `
      html.hha-p58-scroll-unlock,
      body.hha-p58-scroll-unlock{
        height:auto !important;
        min-height:100dvh !important;
        overflow-x:hidden !important;
        overflow-y:auto !important;
        position:static !important;
        touch-action:pan-y !important;
        overscroll-behavior-y:auto !important;
      }

      body.hha-p58-scroll-unlock #brushApp,
      body.hha-p58-scroll-unlock .page,
      body.hha-p58-scroll-unlock #mainPanel,
      body.hha-p58-scroll-unlock .panel,
      body.hha-p58-scroll-unlock .gameLayout,
      body.hha-p58-scroll-unlock .mouthWrap{
        height:auto !important;
        max-height:none !important;
        overflow:visible !important;
      }

      body.hha-p58-prep #brushInputLayer{
        pointer-events:none !important;
        touch-action:pan-y !important;
      }

      body.hha-p58-prep .mouthScene{
        touch-action:pan-y !important;
      }

      body.hha-p58-brush #brushInputLayer{
        pointer-events:auto !important;
        touch-action:none !important;
      }

      body.hha-p58-summary #brushInputLayer{
        pointer-events:none !important;
        touch-action:pan-y !important;
      }

      body.hha-p58-prep #scanCard,
      body.hha-p58-prep #bossCard{
        display:none !important;
      }

      @media (max-width:760px){
        body.hha-p58-scroll-unlock .topbar{
          position:relative !important;
          top:auto !important;
          z-index:40 !important;
          align-items:flex-start !important;
        }

        body.hha-p58-scroll-unlock .brand{
          max-width:calc(100vw - 118px) !important;
          min-height:52px !important;
          padding:7px 9px !important;
        }

        body.hha-p58-scroll-unlock .brandIcon{
          width:38px !important;
          height:38px !important;
          font-size:21px !important;
        }

        body.hha-p58-scroll-unlock .brand strong{
          font-size:14px !important;
          white-space:nowrap !important;
          overflow:hidden !important;
          text-overflow:ellipsis !important;
          max-width:190px !important;
        }

        body.hha-p58-scroll-unlock .brand small{
          font-size:10px !important;
          line-height:1.15 !important;
        }

        body.hha-p58-scroll-unlock .topActions{
          gap:6px !important;
        }

        body.hha-p58-scroll-unlock .iconBtn{
          width:48px !important;
          height:48px !important;
          border-radius:17px !important;
        }

        body.hha-p58-scroll-unlock #sceneBadge{
          display:none !important;
        }

        body.hha-p58-scroll-unlock .badgeRow{
          gap:6px !important;
          align-items:center !important;
        }

        body.hha-p58-scroll-unlock .badge{
          min-height:28px !important;
          padding:5px 9px !important;
          font-size:11px !important;
        }

        body.hha-p58-scroll-unlock .heroCard{
          padding:10px !important;
          gap:9px !important;
        }

        body.hha-p58-scroll-unlock h1{
          font-size:clamp(28px,9vw,42px) !important;
          line-height:1.04 !important;
        }

        body.hha-p58-scroll-unlock .lead{
          font-size:13px !important;
          line-height:1.35 !important;
        }

        body.hha-p58-scroll-unlock .stats{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          gap:7px !important;
        }

        body.hha-p58-scroll-unlock .stat{
          min-height:58px !important;
          padding:8px 10px !important;
        }

        body.hha-p58-scroll-unlock .stat .v{
          font-size:22px !important;
        }

        body.hha-p58-scroll-unlock .gameLayout{
          grid-template-columns:1fr !important;
          gap:10px !important;
        }

        body.hha-p58-scroll-unlock .leftStack{
          gap:9px !important;
        }

        body.hha-p58-scroll-unlock .taskPanel,
        body.hha-p58-scroll-unlock .coach-card,
        body.hha-p58-scroll-unlock .miniCard{
          padding:10px !important;
          border-radius:22px !important;
          gap:7px !important;
        }

        body.hha-p58-scroll-unlock .taskTitle{
          font-size:19px !important;
        }

        body.hha-p58-scroll-unlock .taskText,
        body.hha-p58-scroll-unlock .coach-line{
          font-size:13px !important;
          line-height:1.35 !important;
        }

        body.hha-p58-prep .mouthScene{
          height:380px !important;
          min-height:380px !important;
        }

        body.hha-p58-brush .mouthScene,
        body.hha-p58-summary .mouthScene{
          height:520px !important;
          min-height:520px !important;
        }

        body.hha-p58-scroll-unlock .target-banner{
          top:10px !important;
          width:92% !important;
          min-height:56px !important;
          padding:8px 10px !important;
          border-radius:18px !important;
        }

        body.hha-p58-scroll-unlock .target-banner b{
          font-size:16px !important;
        }

        body.hha-p58-scroll-unlock .target-banner span{
          font-size:11px !important;
        }

        body.hha-p58-scroll-unlock .actions{
          position:sticky !important;
          bottom:calc(8px + env(safe-area-inset-bottom,0px)) !important;
          z-index:180 !important;
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:8px !important;
          padding:8px !important;
          border:2px solid #bdf4ff !important;
          border-radius:22px !important;
          background:rgba(255,255,255,.92) !important;
          box-shadow:0 12px 34px rgba(23,56,79,.14) !important;
          backdrop-filter:blur(10px) !important;
        }

        body.hha-p58-scroll-unlock .actions .btn{
          min-height:52px !important;
        }

        #hhaP58ScrollHint{
          position:fixed;
          right:12px;
          bottom:calc(78px + env(safe-area-inset-bottom,0px));
          z-index:240;
          min-height:44px;
          border:0;
          border-radius:999px;
          padding:10px 14px;
          background:linear-gradient(180deg,#ecfeff,#ffffff);
          border:2px solid #bdf4ff;
          color:#0f766e;
          font-weight:1000;
          box-shadow:0 12px 28px rgba(23,56,79,.14);
        }

        body.hha-p58-brush #hhaP58ScrollHint,
        body.hha-p58-summary #hhaP58ScrollHint{
          display:none !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function unlockPageScroll(){
    ROOT.classList.add('hha-p58-scroll-unlock');

    if(DOC.body){
      DOC.body.classList.add('hha-p58-scroll-unlock');

      DOC.body.style.overflowY = 'auto';
      DOC.body.style.overflowX = 'hidden';
      DOC.body.style.height = 'auto';
      DOC.body.style.minHeight = '100dvh';
      DOC.body.style.position = 'static';
      DOC.body.style.touchAction = 'pan-y';
    }

    ROOT.style.overflowY = 'auto';
    ROOT.style.overflowX = 'hidden';
    ROOT.style.height = 'auto';
    ROOT.style.minHeight = '100dvh';
    ROOT.style.touchAction = 'pan-y';
  }

  function setStageClasses(){
    const prep = isPrepLike();
    const summary = isSummaryOpen();
    const started = hasStartOverride() && !summary;

    if(DOC.body){
      DOC.body.classList.toggle('hha-p58-prep', prep);
      DOC.body.classList.toggle('hha-p58-brush', started);
      DOC.body.classList.toggle('hha-p58-summary', summary);
    }

    ROOT.classList.toggle('hha-p58-prep', prep);
    ROOT.classList.toggle('hha-p58-brush', started);
    ROOT.classList.toggle('hha-p58-summary', summary);
  }

  function unlockPrepTouch(){
    const prep = isPrepLike();

    const input = $('brushInputLayer');
    const scene = $('sceneStage');

    if(prep){
      if(input){
        input.style.pointerEvents = 'none';
        input.style.touchAction = 'pan-y';
      }

      if(scene){
        scene.style.touchAction = 'pan-y';
      }
    }else if(hasStartOverride()){
      if(input){
        input.style.pointerEvents = 'auto';
        input.style.touchAction = 'none';
      }

      if(scene){
        scene.style.touchAction = 'none';
      }
    }
  }

  function hideEmptyPrepCards(){
    if(!isPrepLike()) return;

    const scan = $('scanCard');
    const boss = $('bossCard');

    if(scan){
      scan.style.display = 'none';
    }

    if(boss){
      boss.style.display = 'none';
    }
  }

  function ensureScrollHint(){
    if(!isMobileView()) return;

    let btn = $('hhaP58ScrollHint');

    if(!btn){
      btn = DOC.createElement('button');
      btn.id = 'hhaP58ScrollHint';
      btn.type = 'button';
      btn.textContent = '↧ เลื่อนลง';
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        try{
          WIN.scrollBy({
            top: Math.round(WIN.innerHeight * 0.62),
            left: 0,
            behavior: 'smooth'
          });
        }catch(_){
          WIN.scrollBy(0, Math.round(WIN.innerHeight * 0.62));
        }
      }, true);

      DOC.body.appendChild(btn);
    }

    const canScroll = DOC.documentElement.scrollHeight > WIN.innerHeight + 80;
    const prep = isPrepLike();

    btn.hidden = !(canScroll && prep);
  }

  function apply(){
    ensureStyle();
    unlockPageScroll();
    setStageClasses();
    unlockPrepTouch();
    hideEmptyPrepCards();
    ensureScrollHint();

    try{
      WIN.HHA_BRUSH_MOBILE_SCROLL_UNLOCK_STATE = {
        patch: PATCH_ID,
        mobile: isMobileView(),
        prep: isPrepLike(),
        started: hasStartOverride(),
        summary: isSummaryOpen(),
        stage: flowStage(),
        scrollY: WIN.scrollY,
        scrollHeight: DOC.documentElement.scrollHeight,
        innerHeight: WIN.innerHeight,
        metrics: metrics(),
        at: new Date().toISOString()
      };
    }catch(_){}
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 60);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || ROOT, {
        childList:true,
        subtree:true,
        attributes:true,
        characterData:true
      });
    }catch(_){}

    WIN.addEventListener('resize', run, { passive:true });
    WIN.addEventListener('orientationchange', run, { passive:true });
    WIN.addEventListener('hha:brush-start-unlocked', run, true);
    WIN.addEventListener('hha:brush-toothpaste-ready-start', run, true);
    WIN.addEventListener('hha:brush-flow-stage-change', run, true);

    setInterval(apply, 500);

    setTimeout(apply, 40);
    setTimeout(apply, 160);
    setTimeout(apply, 500);
    setTimeout(apply, 1000);
    setTimeout(apply, 1800);
  }

  function expose(){
    WIN.HHA_BRUSH_MOBILE_SCROLL_UNLOCK = {
      patch: PATCH_ID,
      apply,
      state(){
        return WIN.HHA_BRUSH_MOBILE_SCROLL_UNLOCK_STATE || null;
      },
      scrollDown(){
        WIN.scrollBy(0, Math.round(WIN.innerHeight * 0.62));
      }
    };
  }

  function boot(){
    expose();
    observe();

    try{
      console.log('[BrushMobileScrollUnlock]', PATCH_ID, 'booted');
    }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();