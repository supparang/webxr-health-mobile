// === Hero Health Academy — game/main.js (compat imports + runtime core; 2025-10-31) ===
// แก้โหลดสคริปต์ไม่สำเร็จ: โมดูล core บางไฟล์ export เป็น default ไม่ใช่ชื่อคลาส
// ไฟล์นี้ทำ namespace import แล้ว map เป็นคลาสที่ต้องใช้แบบปลอดภัย

import * as THREEpkg from 'https://unpkg.com/three@0.159.0/build/three.module.js';

// ---- Compat imports (รองรับทั้ง default และ named) ----
function pick(mod, name){
  return (mod && (mod[name] || mod.default || mod)) ?? null;
}
import * as EngineMod        from './core/engine.js';
import * as HUDMod           from './core/hud.js';
import * as CoachMod         from './core/coach.js';
import * as SFXMod           from './core/sfx.js';
import * as ScoreMod         from './core/score.js';
import * as PowerUpMod       from './core/powerup.js';
import * as MissionMod       from './core/mission-system.js';
import * as ProgressMod      from './core/progression.js';
import * as VRInputMod       from './core/vrinput.js';

// Modes (DOM-spawn factory)
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

// ---- Bind real classes/functions from modules (fallback safe) ----
const Engine        = pick(EngineMod,  'Engine');
const HUD           = pick(HUDMod,     'HUD');
const Coach         = pick(CoachMod,   'Coach');
const SFX           = pick(SFXMod,     'SFX');
const ScoreSystem   = pick(ScoreMod,   'ScoreSystem');
const PowerUpSystem = pick(PowerUpMod, 'PowerUpSystem');
const MissionSystem = pick(MissionMod, 'MissionSystem');
const Progress      = ProgressMod;                 // อาจเป็น object ที่มีฟังก์ชัน
const VRInput       = pick(VRInputMod, 'VRInput'); // module pattern ที่ export เป็น object

// ป้องกันกรณีโมดูลสำคัญหาย
if (!Engine || !HUD || !Coach || !SFX || !ScoreSystem || !PowerUpSystem || !MissionSystem || !VRInput){
  throw new Error('[HHA] Core modules missing — ตรวจดูว่า core/*.js มีอยู่และโหลดได้');
}

window.__HHA_BOOT_OK = true;

// ===== Runtime Core =====
const MODES = { goodjunk, groups, hydration, plate };

// ----- Singletons -----
const hud     = new HUD();
const coach   = new Coach();
const sfx     = new SFX();
const score   = new ScoreSystem();
const power   = new PowerUpSystem();
const mission = new MissionSystem();

power.attachToScore?.(score);

const engine = new Engine({
  hud, coach, sfx, score, power, mission, THREE: THREEpkg,
  fx: {
    popText: (text, { x=0, y=0, ms=650 }={})=>{
      const n = document.createElement('div');
      n.className = 'poptext';
      n.textContent = text; n.style.left=x+'px'; n.style.top=y+'px';
      document.body.appendChild(n);
      setTimeout(()=>{ try{ n.remove(); }catch{} }, ms|0);
    }
  }
});

let current = null;

// ----- Helpers -----
const $  = (s)=>document.querySelector(s);
function setPlayfieldActive(on){
  const layer = $('.game-wrap') || $('#gameLayer');
  const menu  = $('#menuBar');
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
}
function getSelectedMode(){
  // จากปุ่มเมนู (ถ้ามี active) → fallback body[data-mode]
  const ids = ['m_goodjunk','m_groups','m_hydration','m_plate'];
  const map = { m_goodjunk:'goodjunk', m_groups:'groups', m_hydration:'hydration', m_plate:'plate' };
  const active = ids.map(id=>document.getElementById(id)).find(el=>el && el.classList.contains('active'));
  if (active) return map[active.id] || 'goodjunk';
  return document.body.getAttribute('data-mode') || 'goodjunk';
}
function getDifficulty(){
  const btns = ['d_easy','d_normal','d_hard'].map(id=>document.getElementById(id));
  const active = btns.find(b=>b && b.classList.contains('active'));
  if (active?.id==='d_easy')   return 'Easy';
  if (active?.id==='d_hard')   return 'Hard';
  if (active?.id==='d_normal') return 'Normal';
  return document.body.getAttribute('data-diff') || 'Normal';
}

function loadMode(key){
  const mod = MODES[key] || MODES.goodjunk;
  if (current?.cleanup){ try{ current.cleanup(); }catch{} }
  current = mod.create({ engine, hud, coach });
}

function start(){
  try{ score.reset?.(); }catch{}
  try{ Progress.beginRun?.(getSelectedMode(), getDifficulty(), (document.documentElement.lang||'th').toUpperCase(), (parseInt($('#time')?.textContent||'45',10)|0)||45); }catch{}
  engine.start?.();
  current?.start?.();
  coach.onStart?.();
  setPlayfieldActive(true);
}

function stop(){
  current?.stop?.();
  engine.stop?.();
  coach.onEnd?.();
  try{ Progress.endRun?.({ score: score.get?.(), bestCombo: score.bestCombo|0, acc: 0 }); }catch{}
  setPlayfieldActive(false);
}

function replay(){
  current?.stop?.();
  start();
}

// ----- Visibility → pause/resume -----
window.addEventListener('blur',  ()=>{ try{ engine.pause?.(); VRInput.pause?.(true);}catch{} }, {passive:true});
window.addEventListener('focus', ()=>{ try{ engine.resume?.();VRInput.resume?.(true);}catch{} }, {passive:true});
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){ try{ engine.pause?.(); VRInput.pause?.(true);}catch{} }
  else { try{ engine.resume?.(); VRInput.resume?.(true);}catch{} }
}, {passive:true});

// ----- Wire minimal UI (ให้ทำงานกับโครงที่คุณวาง) -----
function bindMenuMinimal(){
  // โหมด
  [['m_goodjunk','ดี vs ขยะ','goodjunk'],
   ['m_groups','จาน 5 หมู่','groups'],
   ['m_hydration','สมดุลน้ำ','hydration'],
   ['m_plate','จัดจานสุขภาพ','plate']].forEach(([id,label,key])=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('click', ()=>{
      ['m_goodjunk','m_groups','m_hydration','m_plate'].forEach(x=>{
        const n=document.getElementById(x); if(n) n.classList.toggle('active', x===id);
      });
      const mName = document.getElementById('modeName'); if(mName) mName.textContent = label;
      document.body.setAttribute('data-mode', key);
    }, {passive:true});
  });

  // ความยาก
  [['d_easy','ง่าย','Easy'], ['d_normal','ปกติ','Normal'], ['d_hard','ยาก','Hard']].forEach(([id,txt,val])=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('click', ()=>{
      ['d_easy','d_normal','d_hard'].forEach(x=>{
        const n=document.getElementById(x); if(n) n.classList.toggle('active', x===id);
      });
      const dv = document.getElementById('difficulty'); if(dv) dv.textContent = txt;
      document.body.setAttribute('data-diff', val);
    }, {passive:true});
  });

  // ปุ่มหลัก
  document.getElementById('btn_start')?.addEventListener('click', ()=>{
    loadMode(getSelectedMode());
    start();
  });
  document.getElementById('btn_restart')?.addEventListener('click', replay);
  document.getElementById('btn_pause')?.addEventListener('click', ()=>{
    // toggle pause
    if (engine?.isPaused){ engine.isPaused()? engine.resume(): engine.pause(); }
    else { engine.pause?.(); }
  });

  // ปุ่มใน Result
  document.addEventListener('click', (ev)=>{
    const a = ev.target.closest?.('[data-result]');
    if (!a) return;
    const act = a.getAttribute('data-result');
    if (act==='home'){ stop(); /* โชว์เมนูทิ้งไว้ (menu อยู่ใน DOM ตลอด) */ }
    if (act==='replay'){ replay(); }
  });
}

// ----- Init once -----
(function init(){
  try{
    hud.init?.();
    coach.init?.({ hud, sfx });
    engine.init?.();

    Progress.init?.();
    VRInput.init?.({ engine, sfx, THREE: THREEpkg });

    // โหลดโหมดแรกตาม body หรือค่า default
    loadMode(getSelectedMode());

    // เปิดให้ bootloader เช็คสถานะได้
    window.HHA = window.HHA || {};
    window.HHA.setPlayfieldActive = setPlayfieldActive;
    window.HHA.startSelectedMode  = ()=>{ loadMode(getSelectedMode()); start(); };
    window.HHA.stop   = stop;
    window.HHA.replay = replay;

    bindMenuMinimal();
  }catch(e){
    console.error('[main] init error', e);
    const pre=document.createElement('pre');
    pre.style.cssText='color:#f55;white-space:pre-wrap;padding:12px';
    pre.textContent='Runtime error:\n'+(e?.stack||e?.message||String(e));
    document.body.appendChild(pre);
  }
})();
