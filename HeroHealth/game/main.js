// === Hero Health — game/main.js (2025-10-30 NUCLEAR CLICK FIX) ===
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

/* --------- CLICK UNBLOCK: ปิด overlay ที่กินคลิกทั้งหมดอัตโนมัติ --------- */
const SAFE_OK = new Set(['menuBar','gameLayer','spawnHost','hudWrap','result','clickGuard','app','c']);
function killBlockers(){
  const vw = innerWidth, vh = innerHeight;
  // เปิด pointer ให้เมนู/สนามแน่ๆ
  $('#menuBar')?.style && ($('#menuBar').style.pointerEvents='auto');
  $('#gameLayer')?.style && ($('#gameLayer').style.pointerEvents='auto');
  $('#spawnHost')?.style && ($('#spawnHost').style.pointerEvents='auto');
  // ปิด canvas คลิก
  $('#c')?.style && ($('#c').style.pointerEvents='none');

  document.querySelectorAll('body *').forEach(el=>{
    const id = el.id || '';
    if (SAFE_OK.has(id)) return;
    const cs = getComputedStyle(el);
    // ถ้าซ่อนอยู่ก็ไม่ยุ่ง
    if (cs.display==='none' || cs.visibility==='hidden' || el.hasAttribute('hidden')) return;

    // ตัวเต็มจอที่ z-index สูงและจับคลิก → ปิด
    if ((cs.position==='fixed' || cs.position==='absolute')) {
      const r = el.getBoundingClientRect();
      const large = r.width >= vw*0.9 && r.height >= vh*0.9;
      const highZ = (parseInt(cs.zIndex||'0',10) >= 999);
      const peOn  = cs.pointerEvents !== 'none';
      if (large && highZ && peOn) {
        el.style.pointerEvents = 'none';
      }
    }
  });
}
function ensureRescueBar(){
  if ($('#clickGuard')) return;
  const bar = document.createElement('div');
  bar.id='clickGuard';
  bar.innerHTML = `
    <button id="btnForceUnblock">🛡 Force Unblock</button>
    <button id="btnStartNow">▶ Start</button>
    <button id="btnHomeNow">🏠 Home</button>
  `;
  document.body.appendChild(bar);
  $('#btnForceUnblock')?.addEventListener('click', killBlockers);
  $('#btnStartNow')?.addEventListener('click', ()=> startGame());
  $('#btnHomeNow')?.addEventListener('click', ()=>{ stopGame(); showMenu(); });
}
// ทำซ้ำทุก 500ms กัน element ใหม่ ๆ โผล่มาบัง
setInterval(killBlockers, 500);
window.addEventListener('resize', killBlockers, { passive:true });

/* --------- โหมด/ดิฟ --------- */
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
    const apply = ()=>{ $$('.menu .tile').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); currentKey = map[id].key; document.body.setAttribute('data-mode', currentKey); setText('#modeName', map[id].label); };
    // ผูกทุกประเภทอีเวนต์
    ['click','pointerdown','touchend'].forEach(ev=>btn.addEventListener(ev,(e)=>{e.preventDefault?.(); apply();},{passive:false}));
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
  const bindDiff = (id, key)=>{ const b=$('#'+id); if(!b) return; ['click','pointerdown','touchend'].forEach(ev=>b.addEventListener(ev,(e)=>{e.preventDefault?.(); setDiff(key);},{passive:false})); };
  bindDiff('d_easy','Easy'); bindDiff('d_normal','Normal'); bindDiff('d_hard','Hard');
  setDiff(document.body.getAttribute('data-diff') || 'Normal');
}

/* --------- สถานะหน้าจอ --------- */
function setPlayfieldActive(on){
  const menu  = $('#menuBar');
  const layer = $('#gameLayer');
  const spawn = $('#spawnHost');
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (spawn) spawn.style.pointerEvents = on ? 'auto' : 'none';
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
  killBlockers();
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

/* --------- โหลดโหมด / เริ่ม/หยุด --------- */
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

/* --------- ปุ่ม VR / dwell (คงเดิม) --------- */
function bindVRButtons(){
  const bind = (sel, fn)=> $$(sel).forEach(b=>['click','pointerdown','touchend'].forEach(ev=>b.addEventListener(ev,(e)=>{e.preventDefault?.(); fn();},{passive:false})));
  bind('#toggleVR,[data-action="toggle-vr"]', ()=>VRInput.toggleVR());
  bind('#dwellMinus,[data-action="dwell-"]', ()=>{
    const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    const nxt = Math.max(400, cur - 100); VRInput.setDwellMs(nxt); setText('#dwellVal', `${nxt}ms`);
  });
  bind('#dwellPlus,[data-action="dwell+"]', ()=>{
    const cur = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
    const nxt = Math.min(2000, cur + 100); VRInput.setDwellMs(nxt); setText('#dwellVal', `${nxt}ms`);
  });
}

/* --------- Wire UI (ผูกทุกเหตุการณ์ + คีย์ลัด) --------- */
(function wireUI(){
  const btnStart = $('#btn_start');
  const btnHome  = document.querySelector('[data-result="home"]');
  const btnReplay= document.querySelector('[data-result="replay"]');

  window.HHA = window.HHA || {};
  window.HHA.setPlayfieldActive = setPlayfieldActive;
  window.HHA.startSelectedMode  = startGame;
  window.HHA.stop               = stopGame;
  window.HHA.replay             = replayGame;

  const bindAll = (el, fn)=>{ if(!el) return; ['click','pointerdown','touchend'].forEach(ev=>el.addEventListener(ev,(e)=>{e.preventDefault?.(); fn();},{passive:false})); };

  bindAll(btnStart, ()=> startGame());
  bindAll(btnHome,  ()=>{ stopGame(); showMenu(); });
  bindAll(btnReplay,()=> replayGame());

  // คีย์ลัด: Enter = Start / Space = Replay / Esc = Home
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){ e.preventDefault(); startGame(); }
    else if (e.key === ' ') { e.preventDefault(); replayGame(); }
    else if (e.key === 'Escape'){ e.preventDefault(); stopGame(); showMenu(); }
  });

  showMenu();
  bindModeSelectors();
  bindVRButtons();
  ensureRescueBar();

  // แสดง dwell ms บนเมนู
  const v = parseInt(localStorage.getItem('hha_dwell_ms')||'850',10);
  setText('#dwellVal', `${Number.isFinite(v)?v:850}ms`);
})();

/* --------- Hooks วิสิเบิล/โฟกัส --------- */
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

    // เรียกครั้งแรกทันที
    killBlockers();
  } catch(e){
    console.error('[HHA] Boot error', e);
    const el = document.createElement('pre'); el.style.cssText='color:#f55;white-space:pre-wrap;padding:8px;';
    el.textContent = 'Boot error:\n' + (e?.stack||e?.message||String(e));
    document.body.appendChild(el);
  }
})();
