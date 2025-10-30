// === Hero Health Academy — game/main.js (2025-10-30 CLICK-SAFE patch) ===
// (วางทับไฟล์เดิม หรือเพิ่มส่วน "CLICK-SAFE ENFORCE" ต่อท้าย)

import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine }            from './core/engine.js';
import { HUD }               from './core/hud.js';
import { Coach }             from './core/coach.js';
import { SFX }               from './core/sfx.js';
import { ScoreSystem }       from './core/score.js';
import { PowerUpSystem }     from './core/powerup.js';
import { MissionSystem }     from './core/mission-system.js';
import { Progress }          from './core/progression.js';
import { Quests }            from './core/quests.js';
import { VRInput }           from './core/vrinput.js';

import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

window.__HHA_BOOT_OK = true;

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const byAction = (el)=>el?.closest?.('[data-action]')||null;
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

const score   = new ScoreSystem();
const power   = new PowerUpSystem();
const coach   = new Coach();
const hud     = new HUD();
const sfx     = new SFX();
const mission = new MissionSystem();
power.attachToScore(score);

const engine = new Engine({
  hud, coach, sfx, score, power, mission, THREE,
  fx:{ popText:(text,{x=0,y=0,ms=650}={})=>{ const n=document.createElement('div'); n.className='poptext'; n.textContent=text; n.style.left=x+'px'; n.style.top=y+'px'; document.body.appendChild(n); setTimeout(()=>{ try{ n.remove(); }catch{} }, ms|0); } }
});

const MODES = { goodjunk, groups, hydration, plate };
let current = null;

Progress.init?.();
VRInput.init({ engine, sfx, THREE });
window.HHA_VR = {
  toggle: ()=>VRInput.toggleVR(), pause: ()=>VRInput.pause(), resume: ()=>VRInput.resume(),
  setDwell:(ms)=>VRInput.setDwellMs(ms), setCooldown:(ms)=>VRInput.setCooldown(ms),
  style:(opts)=>VRInput.setReticleStyle(opts), isGaze:()=>VRInput.isGazeMode(), isXR:()=>VRInput.isXRActive()
};

function bindVRButtons(){
  $$('#toggleVR,[data-action="toggle-vr"]').forEach(btn=>btn.addEventListener('click', ()=>VRInput.toggleVR()));
  $$('#dwellMinus,[data-action="dwell-"]').forEach(b=>b.addEventListener('click', ()=>{
    const cur=parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    const nxt=Math.max(400,cur-100); VRInput.setDwellMs(nxt); setText('#dwellVal',`${nxt}ms`); sfx.play?.('ui');
  }));
  $$('#dwellPlus,[data-action="dwell+"]').forEach(b=>b.addEventListener('click', ()=>{
    const cur=parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    const nxt=Math.min(2000,cur+100); VRInput.setDwellMs(nxt); setText('#dwellVal',`${nxt}ms`); sfx.play?.('ui');
  }));
  const cd = $('#gazeCooldown'); if (cd){ const val=$('#gazeCooldownVal'); const apply=()=>{ const ms=Math.max(0,parseInt(cd.value||'350',10)|0); VRInput.setCooldown(ms); if(val) val.textContent=`${ms}ms`; }; cd.addEventListener('input',apply); apply(); }
  $$('#reticleLight,[data-action="reticle-light"]').forEach(b=>b.addEventListener('click',()=>VRInput.setReticleStyle({border:'#fff',progress:'#ffd54a',shadow:'#000a',size:28})));
  $$('#reticleBold,[data-action="reticle-bold"]').forEach(b=>b.addEventListener('click',()=>VRInput.setReticleStyle({border:'#0ff',progress:'#0ff',shadow:'#000',size:34})));
}

function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  if (current?.cleanup) { try { current.cleanup(); } catch{} }
  current = m.create({ engine, hud, coach });
}
function startGame(){ score.reset(); engine.start(); current?.start?.(); coach.onStart?.(); }
function stopGame(){ current?.stop?.(); engine.stop(); coach.onEnd?.(); }

/* ---------- CLICK-SAFE ENFORCE (สำคัญ) ---------- */
function enforceClickLayers(){
  const menu  = $('#menuBar');
  const layer = $('#gameLayer');
  const spawn = $('#spawnHost');
  const result= $('#result');
  const canvas= $('#c');

  if (canvas){ canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '0'; }
  if (layer){  layer.style.zIndex = '10'; }
  if (spawn){  spawn.style.zIndex = '11'; spawn.style.pointerEvents = 'auto'; }

  // โหมดเมนูตั้งต้น
  if (menu){
    menu.style.display = 'block';
    menu.style.zIndex = '999';
    menu.style.pointerEvents = 'auto';
  }
  if (layer){  layer.style.pointerEvents = 'none'; }
  if (result){
    result.style.display = 'none';
    result.style.pointerEvents = 'auto';
    result.style.zIndex = '1000';
  }

  // เฝ้าค่าที่สำคัญ ถ้ามีไฟล์อื่นเปลี่ยน จะรีบตั้งคืน
  const mo = new MutationObserver(()=> {
    if (menu && (menu.style.pointerEvents !== 'auto' || menu.style.zIndex !== '999')){
      menu.style.pointerEvents = 'auto'; menu.style.zIndex = '999';
    }
    if (layer && layer.style.pointerEvents !== 'none'){ layer.style.pointerEvents = 'none'; }
    if (spawn && spawn.style.pointerEvents !== 'auto'){ spawn.style.pointerEvents = 'auto'; }
    if (canvas && canvas.style.pointerEvents !== 'none'){ canvas.style.pointerEvents = 'none'; }
  });
  mo.observe(document.documentElement, { attributes:true, childList:true, subtree:true });
}

function setPlayfieldActive(on){
  const menu  = $('#menuBar');
  const layer = $('#gameLayer');
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
  // กัน spawnHost ทับเมนู
  const spawn = $('#spawnHost');
  if (spawn) spawn.style.pointerEvents = on ? 'auto' : 'none';
}
function showMenu(){
  $('#menuBar')?.style && ($('#menuBar').style.display='block');
  $('#hudWrap')?.style && ($('#hudWrap').style.display='none');
  $('#result')?.style && ($('#result').style.display='none');
  setPlayfieldActive(false);
}
function showPlay(){
  $('#menuBar')?.style && ($('#menuBar').style.display='none');
  $('#hudWrap')?.style && ($('#hudWrap').style.display='block');
  setPlayfieldActive(true);
}

(function wireUI(){
  const btnStart = $('#btn_start');
  const btnHome  = document.querySelector('[data-result="home"]');
  const btnReplay= document.querySelector('[data-result="replay"]');

  window.HHA = window.HHA || {};
  window.HHA.setPlayfieldActive = setPlayfieldActive;

  btnStart?.addEventListener('click', ()=>{
    // กด Start: เปิดสนาม คลิกได้
    showPlay();
    try{ window.HHA.startSelectedMode?.(); }catch{}
  });

  btnHome?.addEventListener('click', ()=>{
    try{ window.HHA.stop?.(); }catch{}
    showMenu();
  });

  btnReplay?.addEventListener('click', ()=>{
    showPlay();
    try{ window.HHA.replay?.(); }catch{}
  });

  // เริ่มที่เมนู และบังคับชั้นคลิก
  showMenu();
  enforceClickLayers();
})();

/* ----- Lifecycle / Boot ----- */
(function boot(){
  try{
    hud.init?.(); coach.init?.({ hud, sfx }); engine.init?.();

    const urlMode = new URLSearchParams(location.search).get('mode') || 'goodjunk';
    loadMode(urlMode);

    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);

    // bind action (รวม reticle/dwell)
    bindVRButtons();

    // auto-play if requested
    if (new URLSearchParams(location.search).get('autoplay')==='1'){ showPlay(); startGame(); }
  }catch(e){
    console.error('[HHA] Boot error', e);
    const el=document.createElement('pre'); el.style.color='#f55';
    el.textContent='Boot error:\n'+(e?.stack||e?.message||String(e));
    document.body.appendChild(el);
  }
})();
