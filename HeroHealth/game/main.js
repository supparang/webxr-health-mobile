// === Hero Health — game/main.js (2025-10-30 CLICK WATCHDOG) ===
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

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const setText = (sel, txt)=>{ const el=$(sel); if (el) el.textContent = txt; };

const MODES = { goodjunk, groups, hydration, plate };
let current = null;
let currentKey = (document.body.getAttribute('data-mode') || 'goodjunk');

const score   = new ScoreSystem();
const power   = new PowerUpSystem();
const coach   = new Coach();
const hud     = new HUD();
const sfx     = new SFX();
const mission = new MissionSystem();
power.attachToScore(score);

const engine = new Engine({
  hud, coach, sfx, score, power, mission, THREE,
  fx:{ popText:(t,{x=0,y=0,ms=650}={})=>{ const n=document.createElement('div'); n.className='poptext'; n.textContent=t; n.style.left=x+'px'; n.style.top=y+'px'; document.body.appendChild(n); setTimeout(()=>{try{n.remove();}catch{}},ms|0);} }
});

Progress.init?.();
VRInput.init({ engine, sfx, THREE });

/* ================= CLICK WATCHDOG ================ */
const SAFE_IDS = new Set(['menuBar','gameLayer','spawnHost','hudWrap','result','clickGuard']);
function forceClickStack(){
  // ชั้นพื้นฐาน
  const canvas = $('#c');
  const menu   = $('#menuBar');
  const layer  = $('#gameLayer');
  const spawn  = $('#spawnHost');
  const hudW   = $('#hudWrap');
  const result = $('#result');
  if (canvas){ canvas.style.pointerEvents='none'; canvas.style.zIndex='0'; }
  if (menu){   menu.style.zIndex='999'; menu.style.pointerEvents='auto'; menu.style.display = (menu.style.display||'block'); }
  if (layer){  layer.style.zIndex='10'; layer.style.pointerEvents='auto'; }
  if (spawn){  spawn.style.zIndex='11'; spawn.style.pointerEvents='auto'; }
  if (hudW){   hudW.style.zIndex='12';  hudW.style.pointerEvents='none'; }
  if (result){ result.style.zIndex='1000'; }

  // หา overlay ที่ครอบทั้งหน้าจอและมี pointer-events != none → ปิด
  const vw = innerWidth, vh = innerHeight;
  document.querySelectorAll('body *').forEach(el=>{
    const id = el.id || '';
    if (SAFE_IDS.has(id)) return;
    const cs = getComputedStyle(el);
    if ((cs.position==='fixed' || cs.position==='absolute')) {
      const r = el.getBoundingClientRect();
      if (r.width >= vw*0.92 && r.height >= vh*0.92 && parseInt(cs.zIndex||'0',10) >= 900) {
        el.style.pointerEvents = 'none';
      }
    }
  });
}
function injectRescueBar(){
  if ($('#clickGuard')) return;
  const bar = document.createElement('div');
  bar.id = 'clickGuard';
  bar.innerHTML = `
    <button id="btnForceUnblock">🛡 Force Unblock</button>
    <button id="btnStartNow">▶ Start</button>
    <button id="btnHomeNow">🏠 Home</button>
  `;
  document.body.appendChild(bar);
  $('#btnForceUnblock')?.addEventListener('click', ()=>forceClickStack());
  $('#btnStartNow')?.addEventListener('click', ()=> startGame());
  $('#btnHomeNow')?.addEventListener('click', ()=>{ stopGame(); showMenu(); });
}
function startWatchdog(){
  forceClickStack();
  const iv = setInterval(forceClickStack, 600);
  window.addEventListener('resize', forceClickStack, { passive:true });
  // debug: ดู element ที่ศูนย์จอว่ามันคืออะไร
  document.addEventListener('click', (e)=>{
    const t=e.target, r=t?.getBoundingClientRect?.();
    console.debug('[CLICK]', t.tagName, '#'+(t.id||''), '.'+(t.className||''), r?`${r.width}x${r.height}@${r.left},${r.top}`:'');
  }, { capture:true });
}

/* ================= UI STATE ================ */
function setPlayfieldActive(on){
  const menu  = $('#menuBar');
  const layer = $('#gameLayer');
  const spawn = $('#spawnHost');
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (spawn) spawn.style.pointerEvents = on ? 'auto' : 'none';
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
  forceClickStack();
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

/* ================= MODE / DIFF ================ */
function bindModeSelectors(){
  const map = {
    m_goodjunk:  { key:'goodjunk',  label:'Good vs Junk' },
    m_groups:    { key:'groups',    label:'5 Food Groups' },
    m_hydration: { key:'hydration', label:'Hydration' },
    m_plate:     { key:'plate',     label:'Healthy Plate' },
  };
  Object.keys(map).forEach(id=>{
    const btn = $('#'+id);
    if (!btn) return;
    btn.addEventListener('click', ()=>{
      $$('.menu .tile').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentKey = map[id].key;
      document.body.setAttribute('data-mode', currentKey);
      setText('#modeName', map[id].label);
    });
  });

  const diffEl = $('#difficulty');
  function setDiff(key){
    ['d_easy','d_normal','d_hard'].forEach(id=>$('#'+id)?.classList.remove('active'));
    if (key==='Easy')   $('#d_easy')?.classList.add('active');
    if (key==='Normal') $('#d_normal')?.classList.add('active');
    if (key==='Hard')   $('#d_hard')?.classList.add('active');
    document.body.setAttribute('data-diff', key);
    window.__HHA_DIFF = key;
    if (diffEl) diffEl.textContent = key;
  }
  $('#d_easy')?.addEventListener('click', ()=>setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=>setDiff('Normal'));
  $('#d_hard')?.addEventListener('click', ()=>setDiff('Hard'));
  setDiff(document.body.getAttribute('data-diff') || 'Normal');
}

/* ================= LIFECYCLE ================ */
function loadMode(key){
  const m = MODES[key] || MODES.goodjunk;
  if (current?.cleanup) { try { current.cleanup(); } catch{} }
  current = m.create({ engine, hud, coach });
}
function startGame(){
  showPlay();
  loadMode(currentKey);
  score.reset();
  engine.start();
  current?.start?.();
  coach.onStart?.();
}
function stopGame(){
  current?.stop?.();
  engine.stop();
  coach.onEnd?.();
}
function replayGame(){ stopGame(); startGame(); }

/* ================= VR buttons / dwell ================ */
function bindVRButtons(){
  $$('#toggleVR,[data-action="toggle-vr"]').forEach(btn=>btn.addEventListener('click', ()=>VRInput.toggleVR()));
  $$('#dwellMinus,[data-action="dwell-"]').forEach(b=>b.addEventListener('click', ()=>{
    const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    const nxt = Math.max(400, cur - 100); VRInput.setDwellMs(nxt); setText('#dwellVal', `${nxt}ms`);
  }));
  $$('#dwellPlus,[data-action="dwell+"]').forEach(b=>b.addEventListener('click', ()=>{
    const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    const nxt = Math.min(2000, cur + 100); VRInput.setDwellMs(nxt); setText('#dwellVal', `${nxt}ms`);
  }));
}

/* ================= WIRE UI ================ */
(function wireUI(){
  const btnStart = $('#btn_start');
  const btnHome  = document.querySelector('[data-result="home"]');
  const btnReplay= document.querySelector('[data-result="replay"]');

  window.HHA = window.HHA || {};
  window.HHA.setPlayfieldActive = setPlayfieldActive;
  window.HHA.startSelectedMode  = startGame;
  window.HHA.stop               = stopGame;
  window.HHA.replay             = replayGame;

  btnStart?.addEventListener('click', ()=> startGame());
  btnHome?.addEventListener('click', ()=>{ stopGame(); showMenu(); });
  btnReplay?.addEventListener('click', ()=> replayGame());

  showMenu();
  bindModeSelectors();
  bindVRButtons();

  injectRescueBar();
  startWatchdog();

  // แสดง dwell ms ปัจจุบันบนเมนูถ้ามี
  const v = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
  setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);
})();

/* ================= BOOT VISIBILITY HOOKS ================ */
(function boot(){
  try {
    hud.init?.();
    coach.init?.({ hud, sfx });
    engine.init?.();

    const urlMode = new URLSearchParams(location.search).get('mode');
    if (urlMode && MODES[urlMode]) currentKey = urlMode;

    document.body.setAttribute('data-mode', currentKey);
    setText('#modeName',
      {goodjunk:'Good vs Junk',groups:'5 Food Groups',hydration:'Hydration',plate:'Healthy Plate'}[currentKey] || 'Good vs Junk'
    );

    window.addEventListener('blur',  ()=>{ try{ engine.pause();  VRInput.pause(true); }catch{} }, { passive:true });
    window.addEventListener('focus', ()=>{ try{ engine.resume(); VRInput.resume(true);}catch{} }, { passive:true });
    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden){ try{ engine.pause(); VRInput.pause(true);}catch{} }
      else { try{ engine.resume(); VRInput.resume(true);}catch{} }
    }, { passive:true });
  } catch(e){
    console.error('[HHA] Boot error', e);
    const el = document.createElement('pre'); el.style.color='#f55';
    el.textContent = 'Boot error:\n' + (e?.stack||e?.message||String(e));
    document.body.appendChild(el);
  }
})();
