// === Hero Health Academy — game/main.js (2025-10-30 hotfix pointer & VRInput v2.1) ===
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';

import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Progress } from './core/progression.js';
import { Quests } from './core/quests.js';
import { VRInput } from './core/vrinput.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

const $ = (s)=>document.querySelector(s);
const $$=(s)=>Array.from(document.querySelectorAll(s));

const score=new ScoreSystem(), power=new PowerUpSystem(),
coach=new Coach(), hud=new HUD(), sfx=new SFX(), mission=new MissionSystem();
power.attachToScore(score);
const engine=new Engine({hud,coach,sfx,score,power,mission,THREE});
const MODES={goodjunk,groups,hydration,plate}; let current=null;

// === VR / Gaze ===
VRInput.init({engine,sfx,THREE});
window.HHA_VR={toggle:()=>VRInput.toggleVR(),pause:()=>VRInput.pause(),resume:()=>VRInput.resume()};

// === Layer toggle ===
function setPlayfieldActive(on){
  const menu=$('#menuBar'); const layer=$('#gameLayer');
  if(layer) layer.style.pointerEvents=on?'auto':'none';
  if(menu)  menu.style.pointerEvents=on?'none':'auto';
}
function showMenu(){
  $('#menuBar').style.display='block';
  $('#hudWrap').style.display='none';
  $('#result').style.display='none';
  setPlayfieldActive(false);
}
function showPlay(){
  $('#menuBar').style.display='none';
  $('#hudWrap').style.display='block';
  setPlayfieldActive(true);
}

// === Game control ===
function loadMode(k){ const m=MODES[k]||MODES.goodjunk; if(current?.cleanup)try{current.cleanup();}catch{} current=m.create({engine,hud,coach}); }
function startGame(){ showPlay(); score.reset(); engine.start(); current?.start?.(); coach.onStart?.(); }
function stopGame(){ current?.stop?.(); engine.stop(); coach.onEnd?.(); showMenu(); }

// === Menu bindings ===
function bindMenu(){
  const map={goodjunk:'Good vs Junk',groups:'5 Food Groups',hydration:'Hydration',plate:'Healthy Plate'};
  const tiles=[['m_goodjunk','goodjunk'],['m_groups','groups'],['m_hydration','hydration'],['m_plate','plate']];
  tiles.forEach(([id,key])=>{
    const el=$('#'+id); if(!el)return;
    el.onclick=()=>{tiles.forEach(([i])=>$('#'+i)?.classList.remove('active')); el.classList.add('active');
      document.body.dataset.mode=key; $('#modeName').textContent=map[key];};
  });
  const diffBtns=[['d_easy','Easy'],['d_normal','Normal'],['d_hard','Hard']];
  diffBtns.forEach(([id,lbl])=>{
    const el=$('#'+id); if(!el)return;
    el.onclick=()=>{diffBtns.forEach(([i])=>$('#'+i)?.classList.remove('active')); el.classList.add('active');
      document.body.dataset.diff=lbl; $('#difficulty').textContent=lbl;};
  });
  $('#btn_start')?.addEventListener('click',()=>{
    const key=document.body.dataset.mode||'goodjunk';
    loadMode(key); startGame();
  });
  $('[data-result="home"]')?.addEventListener('click',()=>stopGame());
  $('[data-result="replay"]')?.addEventListener('click',()=>{showPlay(); current?.stop?.(); startGame();});
}

// === Visibility pause ===
window.addEventListener('blur',()=>{try{engine.pause();VRInput.pause(true);}catch{}},{passive:true});
window.addEventListener('focus',()=>{try{engine.resume();VRInput.resume(true);}catch{}},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){engine.pause();VRInput.pause(true);}else{engine.resume();VRInput.resume(true);}}, {passive:true});

// === Boot ===
(function boot(){
  hud.init?.(); coach.init?.({hud,sfx}); engine.init?.();
  document.body.dataset.mode='goodjunk'; document.body.dataset.diff='Normal';
  loadMode('goodjunk');
  bindMenu();
  showMenu();
})();
// ... (ส่วน import และบูตเดิมทั้งหมดคงไว้เหมือนที่คุณมีล่าสุด)

function setPlayfieldActive(on){
  const menu  = document.getElementById('menuBar');
  const layer = document.getElementById('gameLayer');
  const host  = document.getElementById('spawnHost');

  // เปิด/ปิดการรับคลิกของสนามและโฮสต์สแปว์น
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (host)  host.style.pointerEvents  = on ? 'auto' : 'none';

  // เมนู: กลับกัน เปิดเมื่อไม่ได้เล่น
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
}

function showMenu(){
  const m = document.getElementById('menuBar');
  const h = document.getElementById('hudWrap');
  const r = document.getElementById('result');
  if (m) m.style.display = 'block';
  if (h) h.style.display = 'none';
  if (r) r.style.display = 'none';
  setPlayfieldActive(false);
}

function showPlay(){
  const m = document.getElementById('menuBar');
  const h = document.getElementById('hudWrap');
  if (m) m.style.display = 'none';
  if (h) h.style.display = 'block';
  setPlayfieldActive(true);

  // กันเคสสไตล์ภายนอก/แคช: re-assert อีกรอบหลัง DOM วาด
  setTimeout(()=>setPlayfieldActive(true), 0);
}

// ... (โค้ดอื่นคงเดิมเช่น loadMode/startGame/stopGame/bindMenu/visibility handlers/boot)
