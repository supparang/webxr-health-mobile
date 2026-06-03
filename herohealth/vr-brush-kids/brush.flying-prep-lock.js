/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.flying-prep-lock.js
 * PATCH v20260519-P54b-BRUSH-KIDS-FLYING-PREP-LOCK
 *
 * Purpose:
 * - กันของว่อน/เป้าพิเศษโผล่ในหน้า Prep / Howto / Menu
 * - ลบเป้าจาก P53 และ polish ที่โผล่ผิดจังหวะ
 * - อนุญาตให้เป้าพิเศษโผล่เฉพาะหลังเริ่มแปรงจริง
 * - แก้ run=menu ดึงกลับ Prep หลังเริ่มเกมแล้ว
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260519-P54b-BRUSH-KIDS-FLYING-PREP-LOCK';

  function $(id){
    return DOC.getElementById(id);
  }

  function text(root){
    try{
      const r = root || DOC.body || DOC.documentElement;
      return r.innerText || r.textContent || '';
    }catch(_){
      return '';
    }
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

  function nFromText(s, fallback){
    const m = String(s || '').match(/-?\d+(?:\.\d+)?/);
    if(!m) return fallback || 0;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function isVisible(el){
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

  function summaryOpen(){
    const modal = $('summaryModal');
    return isVisible(modal);
  }

  function hasStartOverride(){
    try{
      if(DOC.documentElement.getAttribute('data-brush-start-requested') === '1') return true;
      if(DOC.documentElement.getAttribute('data-brush-flow-stage') === 'brush') return true;

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

  function hardPrep(){
    if(summaryOpen()) return false;

    /*
     * สำคัญ:
     * ถ้าเริ่มเกมแล้ว ห้ามใช้ run=menu / คำว่า Prep ดึงกลับ Prep อีก
     */
    if(hasStartOverride()) return false;

    const run = String(param('run', '')).toLowerCase();
    const phase = String(param('phase', '')).toLowerCase();
    const stageParam = String(param('stage', '')).toLowerCase();

    if(phase === 'warmup' || phase === 'cooldown') return true;
    if(run === 'menu' || run === 'prep' || run === 'howto' || run === 'practice') return true;
    if(stageParam === 'prep' || stageParam === 'howto' || stageParam === 'practice') return true;

    const body = text();

    const prepWords =
      /เตรียมแปรงสีฟัน|ใส่ยาสีฟัน|พร้อมแปรงฟัน|พร้อมแล้ว|วิธีเล่น|แนวคิด simulation|แตะหรือใส่ยาสีฟัน|เริ่มแปรงฟัน/i.test(body);

    const btnStart = $('btnStart');
    const startVisible = isVisible(btnStart);

    const m = metrics();

    const zeroStart =
      m.score <= 0 &&
      m.combo <= 0 &&
      m.clean <= 0 &&
      m.zoneDone <= 0 &&
      m.plaque >= 80;

    if(prepWords && startVisible) return true;
    if(startVisible && zeroStart) return true;

    return false;
  }

  function realBrushStarted(){
    if(summaryOpen()) return false;

    if(hasStartOverride()) return true;

    if(hardPrep()) return false;

    const m = metrics();

    if(m.score > 0) return true;
    if(m.combo > 0) return true;
    if(m.clean > 0) return true;
    if(m.zoneDone > 0) return true;

    const body = text();
    if(/Boss Battle|Boss Hits|Cavity Storm|แปรงครบ|Clean Teeth\s*:/i.test(body)){
      return true;
    }

    return false;
  }

  function killFlyingTargets(){
    const selectors = [
      '#hhaFlyingTargetLayer',
      '#hhaFlyingTargetHud',
      '.hha-flying-target',

      '.hha-brush-target',
      '.hha-brush-pop',
      '.hha-brush-sparkle',
      '.hha-brush-float',
      '.hha-polish-target',
      '.hha-polish-pop',
      '[data-flying-target]',
      '[data-brush-polish-target]',
      '[data-special-target]'
    ];

    selectors.forEach(sel => {
      try{
        DOC.querySelectorAll(sel).forEach(el => {
          try{
            el.remove();
          }catch(_){
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
          }
        });
      }catch(_){}
    });

    try{
      if(WIN.HHA_BRUSH_FLYING_TARGETS && typeof WIN.HHA_BRUSH_FLYING_TARGETS.clear === 'function'){
        WIN.HHA_BRUSH_FLYING_TARGETS.clear('prep-lock');
      }
    }catch(_){}

    try{
      if(WIN.HHA_BRUSH_POLISH && typeof WIN.HHA_BRUSH_POLISH.stop === 'function'){
        WIN.HHA_BRUSH_POLISH.stop();
      }
    }catch(_){}
  }

  function ensureStyle(){
    if($('hha-flying-prep-lock-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-flying-prep-lock-style';
    style.textContent = `
      body[data-brush-hard-prep="1"] #hhaFlyingTargetLayer,
      body[data-brush-hard-prep="1"] #hhaFlyingTargetHud,
      body[data-brush-hard-prep="1"] .hha-flying-target,
      body[data-brush-hard-prep="1"] .hha-brush-target,
      body[data-brush-hard-prep="1"] .hha-brush-pop,
      body[data-brush-hard-prep="1"] .hha-brush-sparkle,
      body[data-brush-hard-prep="1"] .hha-brush-float,
      body[data-brush-hard-prep="1"] .hha-polish-target,
      body[data-brush-hard-prep="1"] .hha-polish-pop,
      body[data-brush-hard-prep="1"] [data-flying-target],
      body[data-brush-hard-prep="1"] [data-brush-polish-target],
      body[data-brush-hard-prep="1"] [data-special-target]{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }
    `;

    DOC.head.appendChild(style);
  }

  function setFlowStageBackToPrep(){
    if(!hardPrep()) return;

    try{
      DOC.documentElement.setAttribute('data-brush-flow-stage', 'prep');

      if(DOC.body){
        DOC.body.setAttribute('data-brush-flow-stage', 'prep');
      }

      const sceneStage = $('sceneStage');
      if(sceneStage){
        sceneStage.setAttribute('data-flow-stage', 'prep');
      }

      if(WIN.HHA_BRUSH_GAMEPLAY_FLOW && typeof WIN.HHA_BRUSH_GAMEPLAY_FLOW.setStage === 'function'){
        WIN.HHA_BRUSH_GAMEPLAY_FLOW.setStage('prep', 'flying-prep-lock');
      }
    }catch(_){}
  }

  function apply(){
    ensureStyle();

    const prep = hardPrep();
    const started = realBrushStarted();

    if(DOC.body){
      DOC.body.setAttribute('data-brush-hard-prep', prep ? '1' : '0');
      DOC.body.setAttribute('data-brush-real-started', started ? '1' : '0');
    }

    if(prep){
      setFlowStageBackToPrep();
      killFlyingTargets();
    }

    try{
      WIN.HHA_BRUSH_FLYING_PREP_LOCK_STATE = {
        patch: PATCH_ID,
        hardPrep: prep,
        realBrushStarted: started,
        startOverride: hasStartOverride(),
        metrics: metrics(),
        flowStage: DOC.body ? DOC.body.getAttribute('data-brush-flow-stage') : '',
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
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        characterData:true
      });
    }catch(_){}

    setInterval(apply, 350);

    setTimeout(apply, 40);
    setTimeout(apply, 180);
    setTimeout(apply, 600);
    setTimeout(apply, 1200);
    setTimeout(apply, 2400);
  }

  function expose(){
    WIN.HHA_BRUSH_FLYING_PREP_LOCK = {
      patch: PATCH_ID,
      apply,
      hardPrep,
      realBrushStarted,
      hasStartOverride,
      killFlyingTargets,
      state(){
        return WIN.HHA_BRUSH_FLYING_PREP_LOCK_STATE || null;
      }
    };
  }

  function boot(){
    expose();
    observe();

    try{
      console.log('[BrushFlyingPrepLock]', PATCH_ID, 'booted');
    }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();