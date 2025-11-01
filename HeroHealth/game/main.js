ฃ// === Hero Health Academy — game/main.js (HUD + Coach + Missions + Timer) ===
import { sfx as SFX } from './core/sfx.js';
import { Engine, FX } from './core/engine.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';

// Modes
import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';
const MODS = { goodjunk, groups, hydration, plate };

// --- Game length per diff (seconds) ---
const DIFF_SECONDS = { Easy: 60, Normal: 75, Hard: 90 };

const engine = new Engine();
engine.sfx = SFX;
SFX.loadIds(['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup']);

const hud   = new HUD();
const coach = new Coach(hud);

const score = new ScoreSystem();
let power = null;
const mission = new MissionSystem();

let state = {
  mode:'goodjunk', diff:'Normal',
  running:false, raf:0, lastT:0, ctrl:null, legacy:null,
  seconds:60, tickId:0, lang:'TH'
};

const $ = (s)=>document.querySelector(s);
const menuBar=$('#menuBar'), spawnHost=$('#spawnHost');
const modeBadge=$('#modeBadge'), diffBadge=$('#diffBadge'), scoreVal=$('#scoreVal');

// ==== Power helper ====
function createPower() {
  try {
    power = new PowerUpSystem();
    power.onChange(updatePowerBar);
    power.attachToScore(score);
  } catch {
    power = { apply(){}, onChange(){}, attachToScore(){}, getCombinedTimers(){ return {x2:0,freeze:0,sweep:0,shield:0,shieldCount:0}; } };
  }
}
function safeDisposePower(){
  try{
    if (power && typeof power.dispose==='function') power.dispose();
    else if (power) { power.timers={x2:0,freeze:0,sweep:0,shield:0}; power.stacks={x2:0,freeze:0,sweep:0,shield:0}; updatePowerBar(); }
  }catch{}
}
function updatePowerBar(){
  try{
    const timers=power.getCombinedTimers();
    const any=Math.max(timers.x2,timers.freeze,timers.sweep,timers.shield)>0?1:0;
    const pct=Math.min(100,(timers.x2*10+timers.freeze*15+timers.sweep*12+timers.shield*8));
    const fill=$('#powerFill'); if(fill) fill.style.width=(any?Math.max(8,pct):0)+'%';
  }catch{}
}

// ==== Missions binding ====
function bindMissionToBus(kind, meta={}){ // translate to mission events
  switch(kind){
    case 'good':    mission.onEvent('good',    {}, state); break;
    case 'perfect': mission.onEvent('perfect', {}, state); break;
    case 'golden':  mission.onEvent('golden',  {}, state); break;
  }
  // combo update from score
  mission.onEvent('combo', { value: score.combo|0 }, state);
}

// ==== Game loop ====
function loop(ts){
  if(!state.running) return;
  const t=ts||performance.now(), dt=state.lastT?Math.min(0.1,(t-state.lastT)/1000):0.016; state.lastT=t;
  try{
    if(state.ctrl?.update) state.ctrl.update(dt, Bus);
    else if(state.legacy?.update) state.legacy.update(dt, Bus);
  }catch(e){ showError(e); }
  hud.setTop({ score:score.get(), combo:score.combo });
  state.raf=requestAnimationFrame(loop);
}

// ==== End/Win conditions ====
function endRun({ win=false, reason='timeup' }={}){
  state.running=false; cancelAnimationFrame(state.raf);
  clearInterval(state.tickId); state.tickId=0;

  // grade & stats
  const g = score.getGrade();
  const title = win ? '🎉 You Win!' : '⌛ Time Up';
  const desc  = win ? 'ภารกิจสำเร็จครบตามกำหนดเวลา' : 'ไม่ครบภารกิจก่อนหมดเวลา';
  const chips = mission.tick(state, {score:score.get()}, ()=>{}, {hud,coach,lang:state.lang}) || [];
  const done = (chips||[]).filter(c=>c.done && !c.fail).length;
  hud.showResult({
    title, desc,
    stats: [
      `คะแนน: ${g.score} (เกรด ${g.grade}, ★ ${g.stars})`,
      `คอมโบสูงสุด: ${score.bestCombo}`,
      `ภารกิจสำเร็จ: ${done}/${chips.length||3}`
    ]
  });
}

// ==== Bus (events from modes) ====
const Bus={
  hit(p={}){
    const k=p.kind||'good'; const meta=p.meta||{};
    if(k==='golden'){score.addKind('perfect',{...meta,golden:true,comboNow:score.combo});power.apply('x2',6);engine.sfx.perfect();FX.popText('+BONUS ✨',p.ui); bindMissionToBus('golden',meta);}
    else if(k==='perfect'){score.addKind('perfect',{...meta,comboNow:score.combo});engine.sfx.perfect(); bindMissionToBus('perfect',meta);}
    else {score.addKind('good',{...meta,comboNow:score.combo});engine.sfx.good(); bindMissionToBus('good',meta);}
    const s = score.get(); hud.setTop({ score:s, combo:score.combo });
  },
  miss(p={}){ score.addKind('bad',p.meta||{}); engine.sfx.bad(); hud.setTop({ score:score.get(), combo:score.combo });
    document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),180);},
  power(kind){ power.apply(kind); engine.sfx.power(); }
};

// ==== Start/Stop ====
function stopGame(){
  state.running=false; cancelAnimationFrame(state.raf);
  clearInterval(state.tickId); state.tickId=0;
  safeDisposePower(); score.reset();
  try{state.ctrl?.stop?.();}catch{} try{state.legacy?.stop?.();}catch{} try{spawnHost.innerHTML='';}catch{}
  hud.hideResult();
}

function startGame(){
  stopGame(); SFX.unlock(); createPower();
  state.seconds = DIFF_SECONDS[state.diff] || 60;
  hud.setTop({ mode:state.mode, diff:`${state.diff} • ${state.seconds}s`, time:state.seconds, score:0, combo:0 });

  // Missions: 3 ชิ้น / 1 ชุด / ใช้เวลาเท่ากับรัน
  const run = mission.start(state.mode, { seconds: state.seconds, count: 3, lang: state.lang });
  mission.attachToState(run, state);

  // bind HUD
  mission.tick(state, {score:0}, ()=>{}, { hud, coach, lang: state.lang });

  // Load mode
  let mod = MODS[state.mode]; state.ctrl=null; state.legacy=null;
  try{
    if(mod?.create){ state.ctrl = mod.create({ engine, hud, coach }); state.ctrl.start?.({ difficulty:state.diff }); }
    else if(mod?.start && mod?.update){ state.legacy = mod; mod.start({ difficulty:state.diff }); }
    else { hud.say('โหลดโหมดไม่ได้'); }
  }catch(e){ showError(e); }

  // Timer tick (1s)
  let remain = state.seconds|0;
  hud.setTop({ time: remain });
  state.tickId = setInterval(()=>{
    if(!state.running) return;
    remain = Math.max(0, remain-1);
    hud.setTop({ time: remain });
    // push mission tick & HUD chips
    const chips = mission.tick(state, { score: score.get() }, (ev)=>{
      // callback when a mission finishes/fails
    }, { hud, coach, lang: state.lang });

    // win if all missions successก่อนหมดเวลา
    const allDone = (chips||[]).every(c => c.done);
    const allSuccess = (chips||[]).length>0 && (chips||[]).every(c => c.done && !c.fail);

    if (allSuccess) { clearInterval(state.tickId); state.tickId=0; endRun({ win:true, reason:'missions' }); return; }
    if (remain<=0)  { clearInterval(state.tickId); state.tickId=0; endRun({ win:false, reason:'timeup'   }); return; }

    engine.sfx.tick();
  }, 1000);

  coach.onStart();
  menuBar.style.display='none'; state.running=true; state.lastT=0; state.raf=requestAnimationFrame(loop);

  // wire result buttons
  hud.onHome = ()=>{ stopGame(); menuBar.style.display='flex'; };
  hud.onRetry = ()=>{ hud.hideResult(); startGame(); };
}

// ==== Menu wiring ====
(function(){
  const mb=menuBar;
  const setActive=(sel,val,attr)=>document.querySelectorAll(sel).forEach(el=>{ if(el.dataset[attr]===val) el.classList.add('active'); else el.classList.remove('active'); });
  const onHit=(ev)=>{
    const t=ev.target.closest('.btn'); if(!t) return;
    SFX.unlock();
    if(t.dataset.mode){ state.mode=t.dataset.mode; setActive('.btn[data-mode]',state.mode,'mode'); if(modeBadge) modeBadge.textContent=state.mode; return; }
    if(t.dataset.diff){ state.diff=t.dataset.diff; setActive('.btn[data-diff]',state.diff,'diff'); if(diffBadge) diffBadge.textContent=state.diff; return; }
    if(t.dataset.action==='start'){ startGame(); return; }
    if(t.dataset.action==='howto'){
      alert('ชนะเกม: ทำ “ภารกิจ” ครบ 3 รายการก่อนเวลาหมด\n• เวลาต่อรอบ: Easy 60s / Normal 75s / Hard 90s\n• เคล็ดลับ: เก็บ PERFECT/Golden, รักษาคอมโบ, ระวังพลาด');
      return;
    }
    if(t.dataset.action==='sound'){ const on=!SFX.isEnabled(); SFX.setEnabled(on); SFX.unlock(); if(on) SFX.good(); hud.say('Sound: '+(on?'ON':'OFF')); return; }
  };
  ['click','pointerup','touchend','keydown'].forEach(e=>mb.addEventListener(e,onHit,{passive:true}));
})();

// ==== Error guard ====
function showError(e){
  const msg=(e&&(e.message||e.toString()))||'Unknown';
  const box=document.createElement('div');
  box.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7f1d1d;color:#fff;padding:6px 10px;font:600 13px ui-rounded';
  box.textContent='⚠️ '+msg; document.body.appendChild(box); console.error(e);
}
window.addEventListener('error',e=>showError(e.error||e));
window.addEventListener('unhandledrejection',e=>showError(e.reason||e));
window.addEventListener('pointerdown',()=>SFX.unlock(),{once:true,passive:true});

// expose
try{ window.HHA = { start: startGame, stop: stopGame }; }catch{}
