// === Hero Health Academy — game/main.js (robust factory-or-class import; 2025-10-31) ===
// รองรับโมดูล core ที่อาจ export เป็น "object/factory" ไม่ใช่ "class"
// แก้เคส: “HUD is not a constructor”

import * as THREEpkg from 'https://unpkg.com/three@0.159.0/build/three.module.js';

// -- Safe import helpers ------------------------------------------------------
function pick(mod, name){
  return (mod && (mod[name] ?? mod.default ?? mod)) ?? null;
}
function make(mod, name, ...args){
  const impl = pick(mod, name);
  if (!impl) throw new Error(`[HHA] Missing module: ${name}`);
  // ถ้าเป็นคลาส/ฟังก์ชันที่หน้าตาเป็น constructor ให้ new ได้
  if (typeof impl === 'function'){
    try { return new impl(...args); } catch { /* ถ้า new ไม่ได้ลองเรียกเป็นฟังก์ชัน */ }
    try { return impl(...args); } catch {}
  }
  // ถ้าเป็น object มีเมธอด init ให้ใช้ได้เลย
  return impl;
}

// -- Core modules (อาจเป็น class หรือ object) ---------------------------------
import * as EngineMod   from './core/engine.js';
import * as HUDMod      from './core/hud.js';
import * as CoachMod    from './core/coach.js';
import * as SFXMod      from './core/sfx.js';
import * as ScoreMod    from './core/score.js';
import * as PowerUpMod  from './core/powerup.js';
import * as MissionMod  from './core/mission-system.js';
import * as ProgressMod from './core/progression.js';
import * as VRInputMod  from './core/vrinput.js';

// Modes (DOM-spawn factory)
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

window.__HHA_BOOT_OK = true;

// -- Instances (ปลอดภัยต่อทุกแบบ export) -------------------------------------
const hud     = make(HUDMod,      'HUD');
const coach   = make(CoachMod,    'Coach');
const sfx     = make(SFXMod,      'SFX');
const score   = make(ScoreMod,    'ScoreSystem');
const power   = make(PowerUpMod,  'PowerUpSystem');
const mission = make(MissionMod,  'MissionSystem');
const Progress= pick(ProgressMod, 'Progress') || ProgressMod; // ส่วนใหญ่เป็น namespace-object
const VRInput = pick(VRInputMod,  'VRInput');

const EngineKlass = pick(EngineMod, 'Engine');
if (!EngineKlass) throw new Error('[HHA] Engine missing');
const engine = new EngineKlass({
  hud, coach, sfx, score, power, mission, THREE: THREEpkg,
  fx: {
    popText: (text, { x=0, y=0, ms=650 }={})=>{
      const n = document.createElement('div');
      n.className = 'poptext';
      n.textContent = text; n.style.left = x+'px'; n.style.top = y+'px';
      document.body.appendChild(n);
      setTimeout(()=>{ try{ n.remove(); }catch{} }, ms|0);
    }
  }
});

// บางระบบต้องแนบกัน
power?.attachToScore?.(score);

// -- Registry -----------------------------------------------------------------
const MODES = { goodjunk, groups, hydration, plate };
let current = null;

// -- Tiny DOM helpers ---------------------------------------------------------
const $ = (s)=>document.querySelector(s);
function setPlayfieldActive(on){
  const layer = $('#gameLayer') || $('.game-wrap');
  const menu  = $('#menuBar');
  if (layer) layer.style.pointerEvents = on ? 'auto' : 'none';
  if (menu)  menu.style.pointerEvents  = on ? 'none' : 'auto';
}
function selectedMode(){
  const ids = ['m_goodjunk','m_groups','m_hydration','m_plate'];
  const map = { m_goodjunk:'goodjunk', m_groups:'groups', m_hydration:'hydration', m_plate:'plate' };
  const active = ids.map(id=>document.getElementById(id)).find(el=>el && el.classList.contains('active'));
  return active ? (map[active.id]||'goodjunk') : (document.body.getAttribute('data-mode')||'goodjunk');
}
function selectedDiff(){
  const btn = ['d_easy','d_normal','d_hard'].map(id=>document.getElementById(id)).find(b=>b?.classList.contains('active'));
  if (btn?.id==='d_easy')   return 'Easy';
  if (btn?.id==='d_hard')   return 'Hard';
  if (btn?.id==='d_normal') return 'Normal';
  return document.body.getAttribute('data-diff') || 'Normal';
}

// -- Mode lifecycle -----------------------------------------------------------
function loadMode(key){
  const mod = MODES[key] || MODES.goodjunk;
  if (current?.cleanup){ try{ current.cleanup(); }catch{} }
  current = mod.create({ engine, hud, coach });
}
function start(){
  score?.reset?.();
  Progress?.beginRun?.(selectedMode(), selectedDiff(), (document.documentElement.getAttribute('lang')||'th').toUpperCase(), 45);
  engine?.start?.();
  current?.start?.();
  coach?.onStart?.();
  setPlayfieldActive(true);
}
function stop(){
  current?.stop?.();
  engine?.stop?.();
  coach?.onEnd?.();
  Progress?.endRun?.({ score: score?.get?.()|0, bestCombo: score?.bestCombo|0 });
  setPlayfieldActive(false);
}
function replay(){ current?.stop?.(); start(); }

// -- Visibility pause/resume --------------------------------------------------
window.addEventListener('blur',  ()=>{ try{ engine?.pause?.(); VRInput?.pause?.(true);}catch{} }, {passive:true});
window.addEventListener('focus', ()=>{ try{ engine?.resume?.();VRInput?.resume?.(true);}catch{} }, {passive:true});
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){ try{ engine?.pause?.(); VRInput?.pause?.(true);}catch{} }
  else { try{ engine?.resume?.(); VRInput?.resume?.(true);}catch{} }
}, {passive:true});

// -- Wire UI (minimal,ตามโครง index ล่าสุดของคุณ) -----------------------------
function bindMenu(){
  // โหมด
  [['m_goodjunk','ดี vs ขยะ','goodjunk'],
   ['m_groups','จาน 5 หมู่','groups'],
   ['m_hydration','สมดุลน้ำ','hydration'],
   ['m_plate','จัดจานสุขภาพ','plate']].forEach(([id,label,key])=>{
    const el = document.getElementById(id); if(!el) return;
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
    const el = document.getElementById(id); if(!el) return;
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
    loadMode(selectedMode());
    start();
  });
  document.getElementById('btn_restart')?.addEventListener('click', replay);
  document.getElementById('btn_pause')?.addEventListener('click', ()=>{
    if (engine?.isPaused) { engine.isPaused()? engine.resume(): engine.pause(); }
    else { engine?.pause?.(); }
  });

  // ปุ่มใน result
  document.addEventListener('click', (ev)=>{
    const a = ev.target.closest?.('[data-result]');
    if (!a) return;
    const act = a.getAttribute('data-result');
    if (act==='home')   stop();
    if (act==='replay') replay();
  });
}

// -- Boot ---------------------------------------------------------------------
(function boot(){
  try{
    hud?.init?.();
    coach?.init?.({ hud, sfx });
    engine?.init?.();

    Progress?.init?.();
    VRInput?.init?.({ engine, sfx, THREE: THREEpkg });

    loadMode(selectedMode());

    window.HHA = window.HHA || {};
    window.HHA.setPlayfieldActive = setPlayfieldActive;
    window.HHA.startSelectedMode  = ()=>{ loadMode(selectedMode()); start(); };
    window.HHA.stop   = stop;
    window.HHA.replay = replay;

    bindMenu();
  }catch(e){
    console.error('[main] init error', e);
    const pre=document.createElement('pre');
    pre.style.cssText='color:#f55;white-space:pre-wrap;padding:12px';
    pre.textContent='Runtime error:\n'+(e?.stack||e?.message||String(e));
    document.body.appendChild(pre);
  }
})();
