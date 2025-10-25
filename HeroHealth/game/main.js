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

// ===== DOM pool for .item (สิ่งที่วิ่งออกมาให้คลิก) =====
const _pool=[]; const POOL_MAX=48;
function createItem(){
  const b=document.createElement('button');
  b.className='item'; b.type='button';
  b.style.position='fixed'; b.style.zIndex='100';    // อยู่บน canvas
  b.style.minWidth='48px'; b.style.minHeight='48px';
  b.style.pointerEvents='auto';
  return b;
}
function getItemEl(){ return _pool.pop() || createItem(); }
function releaseItemEl(el){
  el.onclick=null;
  if(el.parentNode) el.parentNode.removeChild(el);
  if(_pool.length<POOL_MAX) _pool.push(el);
}

// ===== Spawner =====
function spawnOnce(diff){
  const mode = MODES[state.modeKey];
  if(!mode || !mode.pickMeta){ 
    // fallback test meta
    const el = getItemEl();
    el.textContent = '🍎';
    place(el, diff);
    el.onclick = ()=>{ score.add?.(5); fx.popText?.('+5',{color:'#7fffd4'}); updateHUD(); releaseItemEl(el); };
    document.body.appendChild(el);
    setTimeout(()=> el.isConnected && releaseItemEl(el), diff.life||2500);
    return;
  }

  const meta = mode.pickMeta(diff, state);      // ต้องคืน {char, good|ok, ...}
  const el = getItemEl();
  el.textContent = meta.char || '?';

  place(el, diff);

  el.onclick = () => {
    // ป้องกันสแปมคลิกเร็วเกิน
    const t=now(); spawnOnce.__lc = spawnOnce.__lc||0;
    if(t - spawnOnce.__lc < 120) return;
    spawnOnce.__lc = t;

    mode.onHit?.(meta, {score, sfx, power, fx}, state, hud);
    state.ctx.hits = (state.ctx.hits||0) + 1;

    if(meta.good || meta.ok){ coach.onGood?.(); sfx.good(); }
    else { coach.onBad?.(state.modeKey); sfx.bad(); }

    updateHUD();
    releaseItemEl(el);
  };

  document.body.appendChild(el);
  setTimeout(()=>{ if(el.isConnected) releaseItemEl(el); }, (diff.life||2500));
}

// วางตำแหน่งแบบเว้นขอบบน(หัว)และล่าง(เมนู)
function place(el, diff){
  const topSafePct = 14;     // เว้นจาก header
  const bottomSafePct = 24;  // เว้นจากเมนู
  const topMin = topSafePct, topMax = 100 - bottomSafePct;

  el.style.left = (8 + Math.random()*84) + 'vw';
  el.style.top  = (topMin + Math.random()*(topMax - topMin)) + 'vh';

  // ความเร็วเคลื่อนที่เล็กๆ (optional เคลื่อนนิดหน่อย)
  el.animate(
    [{ transform:'translateY(0)' }, { transform:'translateY(-6px)' }, { transform:'translateY(0)' }],
    { duration: 1200, iterations: Infinity }
  );
}

const timers = { spawn:0, tick:0 };

function spawnLoop(){
  if(!state.running) return;

  const base = DIFFS[state.difficulty] || DIFFS.Normal;
  const hits = state.ctx.hits||0, miss=state.ctx.miss||0;
  const acc  = hits>0 ? (hits/Math.max(1,hits+miss)) : 1;
  const tune = acc>0.80 ? 0.90 : (acc<0.50 ? 1.10 : 1.00);

  const dyn = {
    ...base,
    spawn: clamp(Math.round(base.spawn*tune), 240, 2000),
    life:  clamp(Math.round(base.life /tune),  800, 8000)
  };

  spawnOnce(dyn);

  // ยิ่งคะแนนสูง ยิ่งถี่ขึ้นเล็กน้อย
  const accel = Math.max(0.5, 1 - (score.score/400));
  const next  = Math.max(200, dyn.spawn * accel * (power.timeScale || 1));
  timers.spawn = setTimeout(spawnLoop, next);
}

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
  tick(); spawnLoop();
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

  timers.tick = setTimeout(tick, 1000);
}

export function end(silent=false){
  state.running=false;
  clearTimeout(timers.spawn); clearTimeout(timers.tick);

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

  if(a==='mode'){ state.modeKey = v; }
  if(a==='diff'){ state.difficulty = v; }
  if(a==='start'){ if(window.preStartFlow) window.preStartFlow(); else start({demoPassed:true}); }
  if(a==='pause'){ state.running = !state.running; if(state.running){ tick(); spawnLoop(); } }
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
