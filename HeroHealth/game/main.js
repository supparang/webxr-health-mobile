// ===== Boot flag (for index bootWarn) =====
window.__HHA_BOOT_OK = true;

// ===== Imports =====
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { SFX } from './core/sfx.js';
import { Leaderboard } from './core/leaderboard.js';
import { MissionSystem } from './core/mission.js';
import { PowerUpSystem } from './core/powerup.js';
import { ScoreSystem } from './core/score.js';
import { FloatingFX } from './core/fx.js';
import { Coach } from './core/coach.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ===== Utils =====
const qs = (s)=>document.querySelector(s);
const now = ()=>performance.now?.() ?? Date.now();
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Systems =====
const MODES = { goodjunk, groups, hydration, plate };
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:6 });
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();
const eng = new Engine(THREE, document.getElementById('c'));
const fx  = new FloatingFX(eng);
const coach = new Coach({ lang:'TH' });

// expose for hydration HUD buttons (N/G)
window.__HHA_SYS = { score, fx, sfx, power, coach };
window.MODES = MODES;

// ===== Game State =====
let state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  ctx: { hits:0, miss:0 },
  fever: false
};

// ===== Difficulty table =====
const DIFFS = {
  Easy:   { time:70, spawn:820, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:560, life:1900 }
};

// ===== HUD =====
function updateHUD(){
  const sEl = qs('#score'), cEl = qs('#combo'), tEl = qs('#time');
  if(sEl) sEl.textContent = score.score|0;
  if(cEl) cEl.textContent = 'x'+(score.combo|0);
  if(tEl) tEl.textContent = state.timeLeft|0;
}

// ===== SAFE SPAWNER (items that appear to click) =====

// DOM pool (.item)
const _pool=[]; const POOL_MAX=64;
function createItem(){
  const b=document.createElement('button');
  b.className='item'; b.type='button';
  b.style.position='fixed';
  b.style.zIndex='999';               // สูงมาก กัน overlay ทับ
  b.style.pointerEvents='auto';
  b.style.minWidth='56px'; b.style.minHeight='56px';
  return b;
}
function getItemEl(){ return _pool.pop() || createItem(); }
function releaseItemEl(el){
  el.onclick=null;
  if(el.parentNode) el.parentNode.removeChild(el);
  if(_pool.length<POOL_MAX) _pool.push(el);
}

// วางให้ไม่ชนหัว/เมนู
function place(el){
  const topSafe  = 14;   // % เว้น header
  const botSafe  = 26;   // % เว้นเมนู
  const y = topSafe + Math.random()*(100 - topSafe - botSafe);
  const x = 6 + Math.random()*88;
  el.style.top  = y + 'vh';
  el.style.left = x + 'vw';
  el.animate(
    [{transform:'translateY(0)'},{transform:'translateY(-8px)'},{transform:'translateY(0)'}],
    {duration:1200,iterations:Infinity}
  );
}

// หยิบ meta แบบกันพัง
function safePickMeta(){
  const mode = MODES[state.modeKey];
  if (!mode || typeof mode.pickMeta!=='function') return {char:'🍎', good:true, life:2200};
  try{
    const m = mode.pickMeta(DIFFS[state.difficulty]||DIFFS.Normal, state);
    if (!m || typeof m!=='object') throw new Error('invalid meta');
    if (!m.char) m.char = '🍏';
    if (typeof m.life!=='number') m.life = 2200;
    return m;
  }catch(err){
    console.warn('[pickMeta error]', err);
    return {char:'🍉', good:true, life:2200};
  }
}

function spawnOnce(){
  if(!state.running) return;

  const meta = safePickMeta();
  const el = getItemEl();
  el.textContent = meta.char;

  place(el);

  el.onclick = () => {
    try{
      MODES[state.modeKey]?.onHit?.(meta, {score, sfx, power, fx}, state, hud);
    }catch(err){
      console.warn('[onHit error]', err);
      score.add?.(5); fx.popText?.('+5',{color:'#7fffd4'});
    }
    updateHUD();
    releaseItemEl(el);
  };

  document.body.appendChild(el);

  const lifeMs = Math.max(600, meta.life|0);
  setTimeout(()=>{ if(el.isConnected) releaseItemEl(el); }, lifeMs);
}

let _spTimer=null;
function spawnLoop(){
  if(!state.running) return;
  const base = DIFFS[state.difficulty] || DIFFS.Normal;
  const accel = Math.max(0.55, 1 - (score.score/500));
  const next  = Math.max(220, (base.spawn||700) * accel * (power.timeScale||1));
  spawnOnce();
  _spTimer = setTimeout(spawnLoop, next);
}

// for quick debugging in console
window.__spawnTest = function(n=6){
  let i=0; const id=setInterval(()=>{ if(i++>=n){clearInterval(id);return;} spawnOnce(); }, 180);
  console.info('[__spawnTest]', n);
};

// ===== Start / Loop / End =====
export function start(opt={}){
  end(true); // reset เดิม
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  state.running=true;
  state.timeLeft=diff.time;
  state.ctx={hits:0, miss:0};
  state.fever=false;

  score.reset(); hud.reset(); mission.reset(); power.reset();

  // Hydration HUD actions (N/G) แสดงเฉพาะโหมด hydration
  const hydUI=document.getElementById('hydrationActions');
  if (hydUI) hydUI.style.display = (state.modeKey==='hydration') ? 'flex' : 'none';

  // init โหมด
  MODES[state.modeKey]?.init?.(state, hud, diff);

  sfx.tick(); coach.say(state.modeKey==='hydration'?'รักษา 💧 45–65%!':'เริ่มเกม!');
  updateHUD();

  // main tick + spawn
  tick();
  spawnLoop(); // ✅ สำคัญมาก ต้องมี
}
window.start = start;

function tick(){
  if(!state.running) return;
  state.timeLeft--;
  updateHUD();

  // call per-mode tick
  MODES[state.modeKey]?.tick?.(state, {score, fx, sfx, power, coach}, hud);

  // หมดเวลา
  if(state.timeLeft<=0){ end(); return; }

  setTimeout(tick, 1000);
}

export function end(silent=false){
  state.running=false;
  clearTimeout(_spTimer);

  // ซ่อน Hydration actions เมื่อจบ
  const hydUI=document.getElementById('hydrationActions');
  if (hydUI) hydUI.style.display='none';

  if(!silent){
    const html = `<h4>${(state.modeKey||'').toUpperCase()}</h4>
    <p>คะแนนรวม: <b>${score.score|0}</b></p>
    <p>คอมโบสูงสุด: x${score.bestCombo||0}</p>`;
    const core=qs('#resCore'); if(core) core.innerHTML = html;
    const res = document.getElementById('result'); if(res) res.style.display='flex';
    sfx.power(); coach.say('เยี่ยมมาก!');
  }
}
window.end = end;

// ===== Button wiring for mode/difficulty from menu =====
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#menuBar button'); if(!btn) return;
  const a = btn.getAttribute('data-action');
  const v = btn.getAttribute('data-value');

  if(a==='mode'){
    state.modeKey = v;
    // อัปเดต label ให้ชัด
    const mapTH = { goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' };
    document.getElementById('modeName')?.textContent = mapTH[v] || v;
  }
  if(a==='diff'){
    state.difficulty = v;
    const mapTH = { Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก' };
    document.getElementById('difficulty')?.textContent = mapTH[v] || v;
  }
  if(a==='start'){ if(window.preStartFlow) window.preStartFlow(); else start({demoPassed:true}); }
  if(a==='pause'){
    state.running = !state.running;
    if(state.running){ tick(); spawnLoop(); }
  }
  if(a==='restart'){ end(true); start({demoPassed:true}); }
  if(a==='help'){ /* help handled in ui.js */ }
});

// ===== Integration + Shortcuts =====
window.preStartFlow = function(){
  // เคาน์ดาวน์สั้น ๆ ก่อนเริ่ม
  const hudC=document.getElementById('coachHUD');
  const t=document.getElementById('coachText');
  let n=3; if(t) t.textContent=`เริ่มใน ${n}...`; hudC?.classList.add('show');
  const id=setInterval(()=>{
    n--; if(t) t.textContent = (n>0)? `${n}...` : 'Go!';
    if(n<=0){ clearInterval(id); hudC?.classList.remove('show'); start({demoPassed:true}); }
  }, 800);
};

// Unlock audio on first gesture
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>sfx.unlock(), {once:true, passive:true});
});

// Ensure canvas never blocks clicks
const cEl=document.getElementById('c');
if(cEl){ cEl.style.pointerEvents='none'; cEl.style.zIndex='1'; }
