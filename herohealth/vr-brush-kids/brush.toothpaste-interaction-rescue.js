/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.toothpaste-interaction-rescue.js
 * PATCH v20260519-P57-BRUSH-KIDS-TOOTHPASTE-INTERACTION-RESCUE
 *
 * Purpose:
 * - rescue ปุ่มใส่ยาสีฟัน / เริ่มแปรงฟัน
 * - แก้ P55/P56 ชนกันแล้วกดไม่ติด
 * - ต้องอยู่ท้ายสุดจริง ๆ
 * ========================================================= */

(function(){
  'use strict';

  const DOC = document;
  const WIN = window;
  const PATCH_ID = 'v20260519-P57-BRUSH-KIDS-TOOTHPASTE-INTERACTION-RESCUE';

  function $(id){
    return DOC.getElementById(id);
  }

  function state(){
    try{
      if(WIN.HHA_BRUSH_TOOTHPASTE_PREP && typeof WIN.HHA_BRUSH_TOOTHPASTE_PREP.state === 'function'){
        return WIN.HHA_BRUSH_TOOTHPASTE_PREP.state();
      }
    }catch(_){}

    return { pasteAmount:0, pasteReady:false };
  }

  function isPrep(){
    const s = DOC.body && DOC.body.getAttribute('data-brush-flow-stage');
    const modal = $('summaryModal');
    return s === 'prep' && !(modal && !modal.hidden);
  }

  function forcePrepClickable(){
    if(!isPrep()) return;

    [
      'hhaToothpastePrepCard',
      'hhaPasteArea',
      'hhaPasteAddBtn',
      'hhaPasteResetBtn',
      'btnStart'
    ].forEach(id => {
      const el = $(id);
      if(!el) return;

      el.style.pointerEvents = 'auto';
      el.style.visibility = 'visible';
      el.style.opacity = '1';

      if(id !== 'btnStart') el.style.display = '';

      if(el.tagName === 'BUTTON'){
        el.disabled = false;
      }
    });

    DOC.querySelectorAll(
      '#hha-summary-end-flow-actions,#hha-brush-compact-override-actions,#hha-summary-mount-rescue-actions'
    ).forEach(el => {
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });
  }

  function addPaste(ev){
    if(!isPrep()) return;

    try{
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }catch(_){}

    try{
      if(WIN.HHA_BRUSH_TOOTHPASTE_PREP && typeof WIN.HHA_BRUSH_TOOTHPASTE_PREP.add === 'function'){
        WIN.HHA_BRUSH_TOOTHPASTE_PREP.add(22);
      }
    }catch(_){}

    forcePrepClickable();
  }

  function resetPaste(ev){
    if(!isPrep()) return;

    try{
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }catch(_){}

    try{
      if(WIN.HHA_BRUSH_TOOTHPASTE_PREP && typeof WIN.HHA_BRUSH_TOOTHPASTE_PREP.reset === 'function'){
        WIN.HHA_BRUSH_TOOTHPASTE_PREP.reset();
      }
    }catch(_){}

    forcePrepClickable();
  }

  function startIfReady(ev){
    if(!isPrep()) return;

    const st = state();

    if(!st.pasteReady){
      addPaste(ev);
      return;
    }

    DOC.documentElement.setAttribute('data-brush-flow-stage','brush');
    DOC.documentElement.setAttribute('data-brush-start-requested','1');

    if(DOC.body){
      DOC.body.setAttribute('data-brush-flow-stage','brush');
      DOC.body.setAttribute('data-brush-hard-prep','0');
      DOC.body.setAttribute('data-brush-real-started','1');
      DOC.body.setAttribute('data-brush-start-requested','1');
    }

    const scene = $('sceneStage');
    if(scene){
      scene.setAttribute('data-flow-stage','brush');
      scene.setAttribute('data-scene','brush');
    }

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-toothpaste-ready-start',{
        detail:{ patch:PATCH_ID, pasteReady:true }
      }));

      WIN.dispatchEvent(new CustomEvent('hha:brush-start-unlocked',{
        detail:{ patch:PATCH_ID }
      }));
    }catch(_){}

    const btn = $('btnStart');
    if(btn){
      btn.style.display = 'none';
      btn.disabled = true;
    }
  }

  function bind(){
    const add = $('hhaPasteAddBtn');
    const area = $('hhaPasteArea');
    const reset = $('hhaPasteResetBtn');
    const start = $('btnStart');

    if(add && !add.__p57){
      add.__p57 = true;
      add.addEventListener('pointerdown', addPaste, true);
      add.addEventListener('click', addPaste, true);
    }

    if(area && !area.__p57){
      area.__p57 = true;
      area.addEventListener('pointerdown', addPaste, true);
      area.addEventListener('click', addPaste, true);
    }

    if(reset && !reset.__p57){
      reset.__p57 = true;
      reset.addEventListener('pointerdown', resetPaste, true);
      reset.addEventListener('click', resetPaste, true);
    }

    if(start && !start.__p57){
      start.__p57 = true;
      start.addEventListener('pointerdown', startIfReady, true);
      start.addEventListener('click', startIfReady, true);
    }

    forcePrepClickable();
  }

  function expose(){
    WIN.HHA_BRUSH_TOOTHPASTE_RESCUE = {
      patch: PATCH_ID,
      bind,
      add(){
        try{ WIN.HHA_BRUSH_TOOTHPASTE_PREP.add(22); }catch(_){}
        forcePrepClickable();
      },
      reset(){
        try{ WIN.HHA_BRUSH_TOOTHPASTE_PREP.reset(); }catch(_){}
        forcePrepClickable();
      },
      start: startIfReady
    };
  }

  function boot(){
    expose();
    bind();
    setInterval(bind, 250);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }

})();