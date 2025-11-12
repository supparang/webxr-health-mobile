// === /HeroHealth/game/main.js (2025-11-12 final link to /vr/hub.js) ===
import { HUD } from '../core/hud.js';
import { Engine } from '../core/engine.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import GameHub from '../vr/hub.js';  // ✅ ใช้ hub จาก /vr/hub.js

let hud = null;
let engine = null;
let hub = null;

// ------------------- Utils -------------------
function on(el, ev, fn, opts){ if(el && el.addEventListener) el.addEventListener(ev, fn, opts||false); }
function qs(s){ return document.querySelector(s); }
function qsa(s){ return document.querySelectorAll(s); }

// ------------------- Audio Unlock -------------------
function unlockAudioOnce(){
  try{
    if(window.__HHA_SFX && window.__HHA_SFX.ctx && window.__HHA_SFX.ctx.state==='suspended'){
      window.__HHA_SFX.ctx.resume();
    }
  }catch(_){}
}

// ------------------- HUD Ready -------------------
function announceHudReady(){
  try{
    window.dispatchEvent(new CustomEvent('hha:hud-ready',{detail:{anchorId:'hudTop',scoreBox:true}}));
  }catch(_){}
}

// ------------------- Boot -------------------
function bootApp(){
  // HUD
  try{
    hud = new HUD();
    const wrap = qs('.game-wrap') || document.body;
    hud.mount(wrap);
  }catch(e){ console.log('[main] HUD error', e); }

  // Fever UI
  try{
    ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);
  }catch(_){}

  // Engine
  try{
    engine = new Engine();
    if(engine.start) engine.start();
    on(window,'hha:pause',()=>engine.pause());
    on(window,'hha:resume',()=>engine.resume());
    on(document,'visibilitychange',()=>{
      if(!engine) return;
      if(document.hidden) engine.pause(); else engine.resume();
    });
  }catch(e){ console.log('[main] Engine error', e); }

  // HUD Sync
  on(window,'hha:time',(e)=>{
    const sec=(e?.detail?.sec)||0;
    if(hud) hud.setTimer(sec);
  });
  on(window,'hha:score',(e)=>{
    const d=e?.detail||{};
    if(hud){ if(d.score!=null) hud.setScore(d.score); if(d.combo!=null) hud.setCombo(d.combo); }
  });
  on(window,'hha:fever',(e)=>{
    const onF=!!(e?.detail?.active);
    try{ setFeverActive(onF); }catch(_){}
  });

  // HUD announce (หลายรอบกันพลาด)
  announceHudReady();
  let tries=0, id=setInterval(()=>{ announceHudReady(); if(++tries>15) clearInterval(id); },150);

  // unlock audio
  on(window,'pointerdown',unlockAudioOnce,{once:true});

  // GameHub
  try{
    hub = new GameHub();
    console.log('[main] Hub ready');
  }catch(e){
    console.warn('[main] Hub load fail', e);
  }

  // ปุ่มเริ่มเกม
  const btnStart=qs('#btnStart')||qs('[data-action="start"]');
  if(btnStart){
    on(btnStart,'click',(ev)=>{
      try{ev.preventDefault();}catch(_){}
      if(hub && hub.startGame) hub.startGame();
    });
  }

  // ปุ่มเลือกโหมด
  const modeBtns=qsa('[data-mode]');
  for(let i=0;i<modeBtns.length;i++){
    const btn=modeBtns[i];
    on(btn,'click',(ev)=>{
      try{ev.preventDefault();}catch(_){}
      const m=btn.getAttribute('data-mode')||'goodjunk';
      if(hub && hub.selectMode) hub.selectMode(m);
    });
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootApp);
else bootApp();

window.__HHA_BOOT_OK='main.js';
