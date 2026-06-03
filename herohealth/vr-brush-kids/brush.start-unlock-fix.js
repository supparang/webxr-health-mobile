/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.start-unlock-fix.js
 * PATCH v20260519-P55b-BRUSH-KIDS-START-UNLOCK-FIX
 *
 * Purpose:
 * - แก้ปัญหากด “เริ่มแปรงฟัน” แล้วค้าง / ไม่ไปต่อ
 * - หลังผู้เล่นกดเริ่ม ต้องปลด hard prep lock
 * - ซ่อนปุ่มเริ่มหลัง core ได้รับ click แล้ว
 * - เปลี่ยนข้อความ Prep เป็น Brush stage ทันที
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260519-P55b-BRUSH-KIDS-START-UNLOCK-FIX';

  let startRequested = false;
  let startAt = 0;
  let clickingCore = false;

  function $(id){
    return DOC.getElementById(id);
  }

  function text(el){
    try{
      return el ? String(el.textContent || '').trim() : '';
    }catch(_){
      return '';
    }
  }

  function nFromText(s, fallback){
    const m = String(s || '').match(/-?\d+(?:\.\d+)?/);
    if(!m) return fallback || 0;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function metrics(){
    const zoneRaw = text($('zoneText')) || '0/6';
    const zm = zoneRaw.match(/(\d+)\s*\/\s*(\d+)/);

    return {
      score: nFromText(text($('scoreText')), 0),
      combo: nFromText(text($('comboText')), 0),
      clean: nFromText(text($('cleanText')), 0),
      plaque: nFromText(text($('threatText')), 100),
      zoneDone: zm ? Number(zm[1]) || 0 : 0,
      zoneTotal: zm ? Number(zm[2]) || 6 : 6
    };
  }

  function isSummaryOpen(){
    const modal = $('summaryModal');
    if(!modal || modal.hidden) return false;

    try{
      const cs = WIN.getComputedStyle(modal);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    }catch(_){
      return true;
    }
  }

  function setText(id, value){
    const el = $(id);
    if(el && value){
      el.textContent = value;
    }
  }

  function setBrushStageAttrs(){
    DOC.documentElement.setAttribute('data-brush-flow-stage', 'brush');
    DOC.documentElement.setAttribute('data-brush-start-requested', '1');

    if(DOC.body){
      DOC.body.setAttribute('data-brush-flow-stage', 'brush');
      DOC.body.setAttribute('data-brush-hard-prep', '0');
      DOC.body.setAttribute('data-brush-real-started', '1');
      DOC.body.setAttribute('data-brush-start-requested', '1');
    }

    const scene = $('sceneStage');
    if(scene){
      scene.setAttribute('data-flow-stage', 'brush');
      scene.setAttribute('data-scene', 'brush');
    }

    const sceneText = $('sceneText');
    if(sceneText){
      sceneText.textContent = 'brush';
    }
  }

  function hideStartButton(){
    const btn = $('btnStart');
    if(!btn) return;

    btn.setAttribute('data-hha-start-hidden-after-click', '1');
    btn.style.display = 'none';
    btn.style.visibility = 'hidden';
    btn.style.pointerEvents = 'none';
    btn.disabled = true;
  }

  function rewritePrepTexts(){
    setText('stageTitle', 'แปรงฟันให้ครบทุกโซน');
    setText('stageLead', 'เลือกโซน แล้วลากแปรงบนฟันเพื่อทำความสะอาดคราบ');

    setText('objectiveText', 'เลือกโซน แล้วลากแปรงให้สะอาด');
    setText('sceneInstructionText', 'เลือกโซน → ลากแปรง → เก็บ Clean → เข้าบอส');
    setText('sceneLegendText', 'ใช้แปรงลากบนช่องปากจำลอง เพื่อทำความสะอาดคราบในแต่ละโซน');

    setText('coachLine', 'เริ่มแล้ว! เลือกโซน แล้วลากแปรงบนฟันให้สะอาด');
    setText('targetBannerText', 'เลือกโซน แล้วลากแปรง');
    setText('targetBannerSub', 'แปรงให้ครบหลายโซนเพื่อเพิ่ม Clean และ Combo');

    const chip = $('hhaFlowStageChip');
    if(chip){
      chip.textContent = 'แปรงฟันให้ครบทุกโซน';
    }
  }

  function enableBrushInput(){
    const input = $('brushInputLayer');
    if(input){
      input.style.pointerEvents = 'auto';
      input.classList.remove('is-idle');
      input.classList.add('is-active');
    }

    const rings = Array.from(DOC.querySelectorAll('[data-ring-zone],[data-zone]'));
    rings.forEach(el => {
      el.style.pointerEvents = 'auto';
    });
  }

  function dispatchStart(){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-start-unlocked', {
        detail:{
          patch: PATCH_ID,
          source: 'P55b',
          metrics: metrics()
        }
      }));
    }catch(_){}

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-flow-stage-change', {
        detail:{
          patch: PATCH_ID,
          stage: 'brush',
          source: 'start-unlock-fix',
          metrics: metrics()
        }
      }));
    }catch(_){}
  }

  function forceFlowControllerBrush(){
    try{
      if(WIN.HHA_BRUSH_GAMEPLAY_FLOW && typeof WIN.HHA_BRUSH_GAMEPLAY_FLOW.setStage === 'function'){
        WIN.HHA_BRUSH_GAMEPLAY_FLOW.setStage('brush', 'start-unlock-fix');
      }
    }catch(_){}
  }

  function markStart(source){
    if(isSummaryOpen()) return;

    startRequested = true;
    startAt = startAt || Date.now();

    setBrushStageAttrs();
    rewritePrepTexts();
    enableBrushInput();

    /*
     * สำคัญ:
     * เดิม 30ms เร็วเกินไป ทำให้ core brush.js อาจยังไม่ได้เริ่มจริง
     * เปลี่ยนเป็น 450ms เพื่อให้ click หลักเข้าถึง core ก่อน
     */
    setTimeout(hideStartButton, 450);
    setTimeout(forceFlowControllerBrush, 40);
    setTimeout(dispatchStart, 60);

    try{
      WIN.HHA_BRUSH_START_UNLOCK_STATE = {
        patch: PATCH_ID,
        startRequested,
        startAt,
        source: source || '',
        metrics: metrics(),
        at: new Date().toISOString()
      };
    }catch(_){}
  }

  function closestButton(el){
    try{
      return el && el.closest ? el.closest('button,a,[role="button"]') : null;
    }catch(_){
      return null;
    }
  }

  function looksLikeStartButton(el){
    if(!el) return false;
    if(el.id === 'btnStart') return true;

    const label = text(el);
    return /เริ่มแปรงฟัน|พร้อมแล้ว|ไปเล่นจริง|เริ่มเล่น/i.test(label);
  }

  function bindStart(){
    const btn = $('btnStart');

    if(btn && !btn.__hhaStartUnlockBound){
      btn.__hhaStartUnlockBound = true;

      btn.addEventListener('pointerdown', function(){
        markStart('btnStart-pointerdown');
      }, true);

      btn.addEventListener('click', function(){
        markStart('btnStart-click');
      }, true);
    }

    if(!DOC.__hhaStartUnlockDocBound){
      DOC.__hhaStartUnlockDocBound = true;

      DOC.addEventListener('click', function(ev){
        const b = closestButton(ev.target);
        if(!looksLikeStartButton(b)) return;

        markStart('document-click');

        const core = $('btnStart');
        if(core && b !== core && !clickingCore){
          clickingCore = true;
          try{ core.click(); }catch(_){}
          setTimeout(() => { clickingCore = false; }, 80);
        }
      }, true);

      DOC.addEventListener('pointerdown', function(ev){
        const b = closestButton(ev.target);
        if(!looksLikeStartButton(b)) return;
        markStart('document-pointerdown');
      }, true);
    }
  }

  function enforceAfterStart(){
    if(!startRequested) return;
    if(isSummaryOpen()) return;

    const age = Date.now() - startAt;

    /*
     * ช่วง 10 วินาทีแรกหลังคลิก ต้องบังคับไม่ให้ P52/P54 ดึงกลับ prep
     */
    if(age < 10000){
      setBrushStageAttrs();
      rewritePrepTexts();
      enableBrushInput();
      forceFlowControllerBrush();
    }

    /*
     * ซ่อนปุ่มเมื่อเริ่มจริงแล้ว แต่ไม่รีบซ่อนตั้งแต่ event แรก
     */
    if(age > 450){
      hideStartButton();
    }

    const m = metrics();

    if(m.score > 0 || m.combo > 0 || m.clean > 0 || m.zoneDone > 0){
      if(DOC.body){
        DOC.body.setAttribute('data-brush-real-started', '1');
        DOC.body.setAttribute('data-brush-hard-prep', '0');
      }
    }
  }

  function ensureStyle(){
    if($('hha-start-unlock-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-start-unlock-style';
    style.textContent = `
      body[data-brush-start-requested="1"] #btnStart[data-hha-start-hidden-after-click="1"],
      html[data-brush-start-requested="1"] #btnStart[data-hha-start-hidden-after-click="1"]{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      body[data-brush-start-requested="1"] #brushInputLayer{
        pointer-events:auto !important;
      }

      body[data-brush-start-requested="1"] [data-ring-zone],
      body[data-brush-start-requested="1"] [data-zone]{
        pointer-events:auto !important;
      }
    `;

    DOC.head.appendChild(style);
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        bindStart();
        enforceAfterStart();
      }, 60);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        characterData:true
      });
    }catch(_){}

    setInterval(() => {
      bindStart();
      enforceAfterStart();
    }, 180);

    setTimeout(run, 60);
    setTimeout(run, 250);
    setTimeout(run, 800);
  }

  function expose(){
    WIN.HHA_BRUSH_START_UNLOCK = {
      patch: PATCH_ID,
      start: () => markStart('api'),
      state: () => ({
        patch: PATCH_ID,
        startRequested,
        startAt,
        metrics: metrics(),
        flowStage: DOC.body ? DOC.body.getAttribute('data-brush-flow-stage') : ''
      })
    };
  }

  function boot(){
    ensureStyle();
    bindStart();
    observe();
    expose();

    try{
      console.log('[BrushStartUnlock]', PATCH_ID, 'booted');
    }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();