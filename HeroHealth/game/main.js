// === /HeroHealth/game/main.js (2025-11-12)
// Boot แอป Hero Health VR: HUD + Engine + Fever UI + GameHub (dynamic import, safe)

// ----- Imports (core) -----
import { HUD } from '../core/hud.js';
import { Engine } from '../core/engine.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

// ----- Globals -----
var hud = null;
var engine = null;
var hub = null;
var hubModuleTried = false;

// ----- Utils -----
function on(el, ev, fn, opts){
  if (!el || !el.addEventListener) return;
  el.addEventListener(ev, fn, opts||false);
}
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return document.querySelectorAll(sel); }
function log(){ try{ console.log.apply(console, ['[HHA]'].concat([].slice.call(arguments))); }catch(_){}

// ปลดล็อกเสียงครั้งแรกที่แตะจอ (บางเบราว์เซอร์บังคับ)
function unlockAudioOnce(){
  try {
    if (window.__HHA_SFX && window.__HHA_SFX.ctx && window.__HHA_SFX.ctx.state === 'suspended') {
      window.__HHA_SFX.ctx.resume();
    }
  } catch(_){}
}

// ยิงสัญญาณ HUD ready ให้ fever bar ย้ายไปเกาะ score-box
function announceHudReady(){
  try {
    var ev = new CustomEvent('hha:hud-ready', { detail: { anchorId:'hudTop', scoreBox:true } });
    window.dispatchEvent(ev);
  } catch(_){}
}

// ----- GameHub dynamic import (ลองหลายพาธ + fallback) -----
async function loadGameHub(){
  if (hubModuleTried) return hub; // กันโหลดซ้ำ
  hubModuleTried = true;

  var candidates = [
    './hub.js',
    './gamehub.js',
    './game-hub.js'
  ];

  for (var i=0;i<candidates.length;i++){
    var rel = candidates[i];
    try {
      var url;
      try { url = new URL(rel, import.meta.url).toString(); } catch(_e){ url = rel; }
      // eslint-disable-next-line no-eval
      var mod = await import(url);
      if (mod && (mod.GameHub || mod.default)){
        var GH = mod.GameHub || mod.default;
        if (typeof GH === 'function') { return new GH(); }
      }
    } catch(e){
      log('Hub import fail @', rel, e && e.message ? e.message : e);
    }
  }

  // Fallback: global (ถ้าคุณ include hub ผ่าน <script> แยก)
  try {
    if (window.GameHub && typeof window.GameHub === 'function'){
      return new window.GameHub();
    }
  } catch(_){}

  log('No GameHub module found. You can rename your hub file to one of', candidates.join(', '));
  return null;
}

// ----- Boot sequence -----
function bootApp(){
  // 1) HUD
  try {
    hud = new HUD();
    var wrap = qs('.game-wrap') || document.body;
    hud.mount(wrap);
  } catch(e){ log('HUD mount error', e && e.message ? e.message : e); }

  // 2) Fever UI (ค่าเริ่มต้น)
  try {
    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);
  } catch(e){}

  // 3) Engine (loop กลาง) + hook pause/resume
  try {
    engine = new Engine();
    if (engine && engine.start) engine.start();

    // hook กับระบบ pause/resume กลาง
    on(window, 'hha:pause', function(){ try{ engine.pause(); }catch(_){} });
    on(window, 'hha:resume', function(){ try{ engine.resume(); }catch(_){}});

    // pause อัตโนมัติเมื่อ tab ซ่อน
    on(document, 'visibilitychange', function(){
      try {
        if (!engine) return;
        if (document.hidden) engine.pause(); else engine.resume();
      } catch(_){}
    });
  } catch(e){ log('Engine error', e && e.message ? e.message : e); }

  // 4) Event wiring สำหรับ HUD/คะแนน/เวลา
  on(window, 'hha:time', function(e){
    try {
      var d = e && e.detail ? e.detail : {};
      var sec = d.sec!=null ? d.sec : 0;
      if (hud) hud.setTimer(sec);
    } catch(_){}
  });

  on(window, 'hha:score', function(e){
    try {
      var d = e && e.detail ? e.detail : {};
      if (hud) {
        if (d.score!=null) hud.setScore(d.score);
        if (d.combo!=null) hud.setCombo(d.combo);
      }
    } catch(_){}
  });

  // ถ้าระบบของโหมดมีการประกาศ fever on/off
  on(window, 'hha:fever', function(e){
    var onF = !!(e && e.detail && e.detail.active);
    try { setFeverActive(onF); } catch(_){}
  });

  // 5) ประกาศ HUD พร้อมใช้งาน (ทันที + ยิงซ้ำป้องกันกรณี HUD โผล่ช้า)
  announceHudReady();
  (function burst(){
    var tries = 0, id = setInterval(function(){
      announceHudReady();
      tries++;
      if (tries>=15) clearInterval(id);
    }, 150);
  })();

  // 6) ปลดล็อกเสียงเมื่อผู้ใช้แตะครั้งแรก
  on(window, 'pointerdown', unlockAudioOnce, { once:true });

  // 7) โหลด GameHub และต่อปุ่ม UI (ถ้ามี)
  loadGameHub().then(function(inst){
    hub = inst;
    if (!hub) return;

    // ถ้ามีเมนูเริ่มเกม
    var btnStart = qs('#btnStart') || qs('[data-action="start"]');
    if (btnStart){
      on(btnStart, 'click', function(ev){
        try{ ev.preventDefault(); }catch(_){}
        try { hub.startGame(); } catch(_){}
      });
    }

    // เปลี่ยนโหมดผ่าน data-action (เช่น ปุ่มในเมนูเลือกโหมด)
    var modeBtns = qsa('[data-mode]');
    for (var i=0;i<modeBtns.length;i++){
      (function(btn){
        on(btn, 'click', function(ev){
          try{ ev.preventDefault(); }catch(_){}
          var m = btn.getAttribute('data-mode') || 'goodjunk';
          try { hub.selectMode(m); } catch(_){}
        });
      })(modeBtns[i]);
    }

    log('GameHub ready');
  });
}

// ----- Kickoff -----
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

// Diagnostic flag (optional)
window.__HHA_BOOT_OK = 'main.js';
