// === js/jump-duck.js — Jump Duck Rush bootstrap (2025-12-01) ===
'use strict';

import { initJumpDuck } from './jump-duck-engine.js';

(function(){
  const $  = (id)=>document.getElementById(id);
  const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

  let engine = null;
  let lastConfig = null;

  function showView(id){
    const views = ['jd-view-menu','jd-view-play','jd-view-result'];
    views.forEach(vId=>{
      const el = $(vId);
      if (!el) return;
      el.classList.toggle('jd-hidden', vId !== id);
    });
  }

  function getMode(){
    // ตอนนี้มี normal / research ผ่านปุ่ม แยก action
    return lastConfig?.mode || 'normal';
  }

  function collectResearchMeta(){
    return {
      participant_id: ($('jd-participant')?.value || '').trim(),
      group:          ($('jd-group')?.value || '').trim(),
      note:           ($('jd-note')?.value || '').trim()
    };
  }

  function bindMenu(){
    const btnNormal   = document.querySelector('[data-action="start-normal"]');
    const btnResearch = document.querySelector('[data-action="start-research"]');
    const diffSel     = $('jd-diff');
    const durSel      = $('jd-duration');
    const researchBox = $('jd-research-box');

    if (btnNormal){
      btnNormal.addEventListener('click', ()=>{
        const diff = diffSel?.value || 'normal';
        const dur  = parseInt(durSel?.value || '60',10);

        lastConfig = { mode:'normal', diff, durationSec: dur, meta:{} };
        if (researchBox) researchBox.classList.add('jd-hidden');

        startGame('normal', diff, dur, {});
      });
    }

    if (btnResearch){
      btnResearch.addEventListener('click', ()=>{
        const diff = diffSel?.value || 'normal';
        const dur  = parseInt(durSel?.value || '60',10);
        const meta = collectResearchMeta();

        lastConfig = { mode:'research', diff, durationSec: dur, meta };
        if (researchBox) researchBox.classList.remove('jd-hidden');

        startGame('research', diff, dur, meta);
      });
    }
  }

  function startGame(mode, diff, durationSec, meta){
    if (!engine){
      console.error('[JumpDuck] engine not ready');
      return;
    }
    engine.start({
      mode,
      diff,
      durationSec,
      meta
    });

    // HUD ตั้งต้น
    const modeLabel = (mode === 'research' ? 'Research' : 'Normal');
    const diffLabel =
      diff === 'easy'   ? 'Easy' :
      diff === 'hard'   ? 'Hard' :
      'Normal';

    const setText = (id,v)=>{ const el=$(id); if(el) el.textContent=v; };
    setText('jd-hud-mode', modeLabel);
    setText('jd-hud-diff', diffLabel);

    showView('jd-view-play');
  }

  function bindResultButtons(){
    const btnAgain     = $('jd-btn-again');
    const btnBackMenu  = $('jd-btn-back-menu');
    const btnDlEvents  = $('jd-btn-dl-events');
    const btnDlSession = $('jd-btn-dl-sessions');

    if (btnAgain){
      btnAgain.addEventListener('click', ()=>{
        if (!engine || !lastConfig) return;
        engine.start(lastConfig);
        showView('jd-view-play');
      });
    }

    if (btnBackMenu){
      btnBackMenu.addEventListener('click', ()=>{
        showView('jd-view-menu');
      });
    }

    function downloadCsv(name, text){
      if (!text){
        alert('ยังไม่มีข้อมูล CSV ลองเล่นเกมให้จบก่อนค่ะ');
        return;
      }
      const blob = new Blob([text],{type:'text/csv;charset=utf-8;'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    if (btnDlEvents){
      btnDlEvents.addEventListener('click', ()=>{
        if (!engine) return;
        downloadCsv('jump-duck-events.csv', engine.getEventsCsv());
      });
    }

    if (btnDlSession){
      btnDlSession.addEventListener('click', ()=>{
        if (!engine) return;
        downloadCsv('jump-duck-sessions.csv', engine.getSessionCsv());
      });
    }
  }

  function bindControls(){
    const btnJump = $('jd-btn-jump');
    const btnDuck = $('jd-btn-duck');
    const btnStop = $('jd-btn-stop');

    if (btnJump){
      btnJump.addEventListener('click', ()=>{
        engine?.handleAction('jump');
      });
    }
    if (btnDuck){
      btnDuck.addEventListener('click', ()=>{
        engine?.handleAction('duck');
      });
    }
    if (btnStop){
      btnStop.addEventListener('click', ()=>{
        engine?.stop('manual-stop');
      });
    }
  }

  function init(){
    const field = $('jd-field');
    const obsHost = $('jd-obstacles');
    const avatar = $('jd-avatar');

    if (!field || !obsHost || !avatar){
      console.error('[JumpDuck] missing core DOM');
      return;
    }

    engine = initJumpDuck({
      field,
      obstaclesHost: obsHost,
      avatar,
      hud: {
        score: $('jd-hud-score'),
        combo: $('jd-hud-combo'),
        miss:  $('jd-hud-miss'),
        hp:    $('jd-hud-hp'),
        time:  $('jd-hud-time'),
        feverFill:   $('jd-fever-fill'),
        feverStatus: $('jd-fever-status'),
        progFill:    $('jd-progress-fill'),
        progText:    $('jd-progress-text')
      },
      feedbackEl: $('jd-feedback')
    });

    bindMenu();
    bindResultButtons();
    bindControls();
    showView('jd-view-menu');

    // expose สำหรับ debug
    window.JumpDuckEngine = engine;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
