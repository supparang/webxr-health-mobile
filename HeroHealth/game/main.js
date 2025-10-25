// ===== Boot flag =====
window.__HHA_BOOT_OK = true;

import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';

const qs = (s) => document.querySelector(s);
const eng = new Engine(THREE, document.getElementById('c'));

// ===== Game mock (minimal) =====
const state = { running:false, timeLeft:60 };
function updateHUD(){
  qs('#time').textContent = state.timeLeft|0;
}
function start(){ console.log('▶ start'); state.running=true; tick(); }
function pause(){ state.running=!state.running; console.log('pause',state.running); }
function restart(){ state.running=false; state.timeLeft=60; updateHUD(); }
function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();
  if(state.timeLeft<=0){ end(); return; }
  setTimeout(tick,1000);
}
function end(){
  console.log('🏁 end');
  document.getElementById('result').style.display='flex';
}

// ===== Fix pointer-events overlay =====
function fixPointerLayers(){
  const canvas = document.getElementById('c');
  if(canvas){ canvas.style.pointerEvents='none'; canvas.style.zIndex='1'; }
  document.querySelectorAll('.menu,.hud,.modal,.coach')
    .forEach(el=>{ el.style.pointerEvents='auto'; el.style.zIndex='100'; });
}

// ===== Force-bind buttons =====
function bindButtons(){
  document.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const a = btn.dataset.action || btn.dataset.result;
      if(a==='start') start();
      else if(a==='pause') pause();
      else if(a==='restart') restart();
      else if(a==='help'){
        document.getElementById('help').style.display='flex';
      } else if(a==='helpClose' || a==='ok'){
        document.getElementById('help').style.display='none';
      } else if(a==='replay'){
        document.getElementById('result').style.display='none'; restart();
      } else if(a==='home'){
        document.getElementById('result').style.display='none';
      }
    });
  });
  console.log('✅ Buttons bound');
}

// ===== Boot =====
window.addEventListener('DOMContentLoaded',()=>{
  fixPointerLayers();
  bindButtons();
  // re-apply after 1 s เผื่อ CSS/Canvas รีเฟรชช้า
  setTimeout(fixPointerLayers,1000);
  setTimeout(bindButtons,1200);
  console.log('✅ main.js ready');
});
