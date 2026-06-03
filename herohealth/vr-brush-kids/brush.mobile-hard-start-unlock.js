/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.mobile-hard-start-unlock.js
 * PATCH v20260519-P59-BRUSH-KIDS-MOBILE-HARD-START-UNLOCK
 *
 * Purpose:
 * - แก้มือถือกด "เริ่มแปรงฟัน" แล้วเหมือนค้าง
 * - ดัก event ที่ window capture ก่อน P56/P57
 * - force toothpaste ready ก่อน event ไปถึง btnStart
 * - ปลด sticky action bar ตอน prep เพื่อไม่ให้บังจอ
 * - กัน brushInputLayer จับ scroll ก่อนเริ่มจริง
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const ROOT = DOC.documentElement;
  const PATCH_ID = 'v20260519-P59-BRUSH-KIDS-MOBILE-HARD-START-UNLOCK';

  let bootedAt = Date.now();
  let startTapAt = 0;
  let replayingCoreClick = false;
  let hardStartDone = false;

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

  function isMobileView(){
    const view = String(param('view', '')).toLowerCase();
    if(view === 'mobile') return true;

    try{
      return WIN.matchMedia && WIN.matchMedia('(max-width: 760px)').matches;
    }catch(_){
      return WIN.innerWidth <= 760;
    }
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

  function toothpasteState(){
    try{
      if(
        WIN.HHA_BRUSH_TOOTHPASTE_PREP &&
        typeof WIN.HHA_BRUSH_TOOTHPASTE_PREP.state === 'function'
      ){
        return WIN.HHA_BRUSH_TOOTHPASTE_PREP.state() || {};
      }
    }catch(_){}

    return {};
  }

  function pasteReady(){
    const s = toothpasteState();
    return !!s.pasteReady;
  }

  function forcePasteReady(){
    try{
      if(
        WIN.HHA_BRUSH_TOOTHPASTE_PREP &&
        typeof WIN.HHA_BRUSH_TOOTHPASTE_PREP.add === 'function'
      ){
        let guard = 0;

        while(!pasteReady() && guard < 8){
          WIN.HHA_BRUSH_TOOTHPASTE_PREP.add(22);
          guard += 1;
        }
      }
    }catch(_){}

    try{
      if(DOC.body){
        DOC.body.setAttribute('data-paste-ready', '1');
        DOC.body.setAttribute('data-p59-paste-force-ready', '1');
      }

      const status = $('hhaPasteStatus');
      if(status){
        status.classList.remove('warn','danger');
        status.textContent = 'พร้อมแล้ว • เริ่มแปรงฟันได้เลย';
      }

      const start = $('btnStart');
      if(start){
        start.disabled = false;
        start.style.pointerEvents = 'auto';
        start.style.visibility = 'visible';
        start.style.opacity = '1';
        start.textContent = '🪥 เริ่มแปรงฟัน';
      }
    }catch(_){}

    return pasteReady() || true;
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

  function closestButton(el){
    try{
      return el && el.closest ? el.closest('button,a,[role="button"]') : null;
    }catch(_){
      return null;
    }
  }

  function isStartButton(el){
    if(!el) return false;
    if(el.id === 'btnStart') return true;

    const label = text(el);
    return /เริ่มแปรงฟัน|พร้อมแล้ว|ไปเล่นจริง|เริ่มเล่น|เริ่มช่วยฟัน/i.test(label);
  }

  function setBrushAttrs(source){
    hardStartDone = true;

    ROOT.setAttribute('data-brush-flow-stage', 'brush');
    ROOT.setAttribute('data-brush-start-requested', '1');
    ROOT.setAttribute('data-p59-hard-start', '1');

    if(DOC.body){
      DOC.body.setAttribute('data-brush-flow-stage', 'brush');
      DOC.body.setAttribute('data-brush-hard-prep', '0');
      DOC.body.setAttribute('data-brush-real-started', '1');
      DOC.body.setAttribute('data-brush-start-requested', '1');
      DOC.body.setAttribute('data-p59-hard-start', '1');
    }

    const scene = $('sceneStage');
    if(scene){
      scene.setAttribute('data-flow-stage', 'brush');
      scene.setAttribute('data-scene', 'brush');
      scene.style.touchAction = 'none';
    }

    const input = $('brushInputLayer');
    if(input){
      input.style.pointerEvents = 'auto';
      input.style.touchAction = 'none';
      input.classList.remove('is-idle');
      input.classList.add('is-active');
    }

    const btn = $('btnStart');
    if(btn){
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
      btn.style.visibility = 'visible';
      btn.style.opacity = '1';
    }

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-toothpaste-ready-start', {
        detail:{
          patch: PATCH_ID,
          source: source || 'p59',
          pasteReady: true
        }
      }));

      WIN.dispatchEvent(new CustomEvent('hha:brush-start-unlocked', {
        detail:{
          patch: PATCH_ID,
          source: source || 'p59',
          metrics: metrics()
        }
      }));

      WIN.dispatchEvent(new CustomEvent('hha:brush-flow-stage-change', {
        detail:{
          patch: PATCH_ID,
          stage: 'brush',
          source: source || 'p59',
          metrics: metrics()
        }
      }));
    }catch(_){}

    try{
      if(WIN.HHA_BRUSH_GAMEPLAY_FLOW && typeof WIN.HHA_BRUSH_GAMEPLAY_FLOW.setStage === 'function'){
        WIN.HHA_BRUSH_GAMEPLAY_FLOW.setStage('brush', 'p59-hard-start');
      }
    }catch(_){}
  }

  function replayCoreClick(){
    if(replayingCoreClick) return;

    const btn = $('btnStart');
    if(!btn) return;

    replayingCoreClick = true;

    setTimeout(function(){
      try{
        btn.click();
      }catch(_){}

      setTimeout(function(){
        replayingCoreClick = false;
      }, 120);
    }, 80);
  }

  function hardStart(source){
    startTapAt = Date.now();

    forcePasteReady();
    setBrushAttrs(source || 'hard-start');

    /*
     * ให้ core brush.js ได้ click อีกครั้งหลัง toothpaste ready
     * เพื่อกันกรณี event แรกโดน P56/P57 กินไปแล้ว
     */
    replayCoreClick();

    setTimeout(function(){
      setBrushAttrs('hard-start-180ms');
    }, 180);

    setTimeout(function(){
      setBrushAttrs('hard-start-520ms');

      const start = $('btnStart');
      if(start){
        start.setAttribute('data-p59-hidden-after-start', '1');
        start.style.display = 'none';
        start.style.visibility = 'hidden';
        start.style.pointerEvents = 'none';
      }
    }, 520);
  }

  function onWindowStartCapture(ev){
    if(isSummaryOpen()) return;

    const btn = closestButton(ev.target);
    if(!isStartButton(btn)) return;

    /*
     * ดักก่อน P56/P57 ที่ document capture
     * ห้าม stop event เพื่อให้ core brush.js ยังได้ click ตามปกติ
     */
    forcePasteReady();

    if(ev.type === 'click' || ev.type === 'pointerup'){
      hardStart('window-capture-' + ev.type);
    }
  }

  function ensureStyle(){
    if($('hha-mobile-hard-start-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-mobile-hard-start-style';
    style.textContent = `
      html.hha-p59-scroll,
      body.hha-p59-scroll{
        height:auto !important;
        min-height:100dvh !important;
        overflow-y:auto !important;
        overflow-x:hidden !important;
        position:static !important;
        touch-action:pan-y !important;
      }

      body.hha-p59-prep #brushInputLayer{
        pointer-events:none !important;
        touch-action:pan-y !important;
      }

      body.hha-p59-prep .mouthScene{
        touch-action:pan-y !important;
      }

      body.hha-p59-brush #brushInputLayer{
        pointer-events:auto !important;
        touch-action:none !important;
      }

      body.hha-p59-brush .mouthScene{
        touch-action:none !important;
      }

      body.hha-p59-prep #scanCard,
      body.hha-p59-prep #bossCard,
      body.hha-p59-prep #hhaFlyingTargetHud,
      body.hha-p59-prep #hhaFlyingTargetLayer{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      body.hha-p59-brush #scanCard,
      body.hha-p59-brush #bossCard{
        display:grid !important;
        visibility:visible !important;
      }

      body[data-p59-hard-start="1"] #btnStart[data-p59-hidden-after-start="1"]{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      @media (max-width:760px){
        body.hha-p59-scroll #brushApp,
        body.hha-p59-scroll .page,
        body.hha-p59-scroll #mainPanel,
        body.hha-p59-scroll .panel,
        body.hha-p59-scroll .gameLayout,
        body.hha-p59-scroll .mouthWrap{
          height:auto !important;
          max-height:none !important;
          overflow:visible !important;
        }

        body.hha-p59-prep .actions{
          position:relative !important;
          bottom:auto !important;
          z-index:50 !important;
          margin-top:10px !important;
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:8px !important;
          padding:8px !important;
          border:2px solid #bdf4ff !important;
          border-radius:22px !important;
          background:rgba(255,255,255,.90) !important;
          box-shadow:0 12px 26px rgba(23,56,79,.10) !important;
        }

        body.hha-p59-brush .actions{
          position:fixed !important;
          left:10px !important;
          right:10px !important;
          bottom:calc(8px + env(safe-area-inset-bottom,0px)) !important;
          z-index:180 !important;
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:8px !important;
          padding:8px !important;
          border:2px solid #bdf4ff !important;
          border-radius:22px !important;
          background:rgba(255,255,255,.88) !important;
          box-shadow:0 12px 34px rgba(23,56,79,.14) !important;
          backdrop-filter:blur(10px) !important;
        }

        body.hha-p59-brush{
          padding-bottom:104px !important;
        }

        body.hha-p59-prep .mouthScene{
          height:380px !important;
          min-height:380px !important;
        }

        body.hha-p59-brush .mouthScene{
          height:520px !important;
          min-height:520px !important;
        }

        body.hha-p59-prep .target-banner{
          top:10px !important;
          width:92% !important;
          min-height:56px !important;
          padding:8px 10px !important;
          border-radius:18px !important;
        }

        body.hha-p59-prep .target-banner b{
          font-size:16px !important;
        }

        body.hha-p59-prep .target-banner span{
          font-size:11px !important;
        }

        body.hha-p59-scroll .brand{
          max-width:calc(100vw - 116px) !important;
        }

        body.hha-p59-scroll #sceneBadge{
          display:none !important;
        }

        body.hha-p59-scroll .badge{
          min-height:28px !important;
          padding:5px 9px !important;
          font-size:11px !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function applyClasses(){
    const prep = isPrepLike();
    const started = hasStartOverride() || hardStartDone;
    const summary = isSummaryOpen();

    ROOT.classList.add('hha-p59-scroll');

    if(DOC.body){
      DOC.body.classList.add('hha-p59-scroll');

      DOC.body.classList.toggle('hha-p59-prep', prep && !started && !summary);
      DOC.body.classList.toggle('hha-p59-brush', started && !summary);
      DOC.body.classList.toggle('hha-p59-summary', summary);

      DOC.body.style.overflowY = 'auto';
      DOC.body.style.overflowX = 'hidden';
      DOC.body.style.height = 'auto';
      DOC.body.style.minHeight = '100dvh';
      DOC.body.style.position = 'static';
    }

    ROOT.style.overflowY = 'auto';
    ROOT.style.overflowX = 'hidden';
    ROOT.style.height = 'auto';
    ROOT.style.minHeight = '100dvh';
  }

  function fixTouchLayers(){
    const prep = DOC.body && DOC.body.classList.contains('hha-p59-prep');
    const brush = DOC.body && DOC.body.classList.contains('hha-p59-brush');

    const scene = $('sceneStage');
    const input = $('brushInputLayer');

    if(prep){
      if(input){
        input.style.pointerEvents = 'none';
        input.style.touchAction = 'pan-y';
      }

      if(scene){
        scene.style.touchAction = 'pan-y';
      }
    }

    if(brush){
      if(input){
        input.style.pointerEvents = 'auto';
        input.style.touchAction = 'none';
        input.classList.remove('is-idle');
        input.classList.add('is-active');
      }

      if(scene){
        scene.style.touchAction = 'none';
      }
    }
  }

  function hideFloatingPrepNoise(){
    if(!(DOC.body && DOC.body.classList.contains('hha-p59-prep'))) return;

    [
      '#hhaFlyingTargetHud',
      '#hhaFlyingTargetLayer',
      '.hha-flying-target',
      '.hha-brush-float',
      '.hha-brush-pop',
      '.hha-polish-pop',
      '.hha-polish-target',
      '[data-flying-target]',
      '[data-special-target]'
    ].forEach(function(sel){
      try{
        DOC.querySelectorAll(sel).forEach(function(el){
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.pointerEvents = 'none';
        });
      }catch(_){}
    });
  }

  function ensureStartButtonHealthy(){
    const btn = $('btnStart');
    if(!btn) return;

    if(!(hasStartOverride() || hardStartDone)){
      btn.disabled = false;
      btn.style.display = '';
      btn.style.visibility = 'visible';
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';

      if(/ใส่ยาสีฟันก่อน/i.test(text(btn))){
        btn.textContent = '🪥 เริ่มแปรงฟัน';
      }
    }
  }

  function apply(){
    ensureStyle();
    applyClasses();
    fixTouchLayers();
    hideFloatingPrepNoise();
    ensureStartButtonHealthy();

    try{
      WIN.HHA_BRUSH_MOBILE_HARD_START_STATE = {
        patch: PATCH_ID,
        mobile: isMobileView(),
        prep: isPrepLike(),
        started: hasStartOverride() || hardStartDone,
        summary: isSummaryOpen(),
        stage: flowStage(),
        paste: toothpasteState(),
        startTapAt,
        hardStartDone,
        age: Date.now() - bootedAt,
        metrics: metrics(),
        scrollY: WIN.scrollY,
        scrollHeight: ROOT.scrollHeight,
        innerHeight: WIN.innerHeight,
        at: new Date().toISOString()
      };
    }catch(_){}
  }

  function bind(){
    if(WIN.__hhaP59WindowStartBound) return;
    WIN.__hhaP59WindowStartBound = true;

    /*
     * window capture จะทำงานก่อน document capture ของ P56/P57
     */
    WIN.addEventListener('pointerdown', onWindowStartCapture, true);
    WIN.addEventListener('pointerup', onWindowStartCapture, true);
    WIN.addEventListener('click', onWindowStartCapture, true);
  }

  function observe(){
    let timer = null;

    const run = function(){
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

    setInterval(apply, 350);

    setTimeout(apply, 40);
    setTimeout(apply, 160);
    setTimeout(apply, 500);
    setTimeout(apply, 1000);
  }

  function expose(){
    WIN.HHA_BRUSH_MOBILE_HARD_UNSTUCK = {
      patch: PATCH_ID,
      apply,
      forceReady: forcePasteReady,
      hardStart: function(){
        hardStart('api');
      },
      state: function(){
        return WIN.HHA_BRUSH_MOBILE_HARD_START_STATE || null;
      }
    };
  }

  function boot(){
    expose();
    bind();
    observe();
    apply();

    try{
      console.log('[BrushMobileHardStartUnlock]', PATCH_ID, 'booted');
    }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();