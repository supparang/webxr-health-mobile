// === Hero Health Academy — game/main.js (v3.4 FINAL unified build) ===
// รวมทุกระบบล่าสุด:
// • ScoreSystem v2 (combo/fever aware, power-boost aware)
// • PowerUpSystem (x2/freeze/sweep/shield) + HUD segments
// • Quests 10/mode + MissionSystem (daily/mini)
// • SFX unified core/sfx.js + BGM auto-pause/unlock
// • Shield absorb “bad” once + glow HUD sync
// • Back-compat: window.SFX, window.HHA.addScore()

import { HUD } from './core/hud.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';
import { Progress } from './core/progression.js';
import { Quests } from './core/quests.js';
import { ScoreSystem } from './core/score.js';
import { sfx } from './core/sfx.js';

// ---- Modes ----
import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ---------- Singletons ----------
const hud      = new HUD();
const power    = new PowerUpSystem();
const mission  = new MissionSystem();
const board    = new Leaderboard();
Progress.init();
Quests.bindToMain({ hud });

// ScoreSystem + PowerUpSystem link
const score = new ScoreSystem();
power.attachToScore(score);
score.setHandlers({
  change: (val, { delta, meta })=>{
    hud.setScore(val|0);
    State.combo = score.combo|0;
    State.bestCombo = score.bestCombo|0;
    Progress.emit('score_tick', { score: val|0, delta: delta|0, kind: meta?.kind });
  }
});
score.setComboGetter(()=> score.combo|0);
score.setFeverGetter(()=> State.fever01||0);

// Reflect power timers to HUD
power.onChange((timers)=> hud.setPowerTimers?.(timers));

// ---------- State ----------
const State = {
  mode:'goodjunk', diff:'Normal', lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  seconds:45, paused:false, fever01:0, combo:0, bestCombo:0,
};

// ---------- BGM helpers ----------
function bgmEl(){ return document.getElementById('bgm-main'); }
function bgmPlay(){
  const a=bgmEl(); if(!a)return;
  try{ a.volume=0.45; a.currentTime ||=0; if(sfx.isEnabled()) a.play()?.catch(()=>{}); }catch{}
}
function bgmPause(){ const a=bgmEl(); if(!a)return; try{ a.pause(); }catch{} }

// ---------- Language ----------
function setLangFromUI(){
  const uiLang = window.HHA_UI?.getLang?.();
  if (uiLang){
    State.lang = (String(uiLang).toUpperCase()==='EN'?'EN':'TH');
    localStorage.setItem('hha_lang', State.lang);
    Quests.setLang(State.lang);
  }
}

// ---------- Coach ----------
const CoachBridge = {
  onStart(){ hud.say(State.lang==='TH'?'เริ่มกันเลย!':'Let’s start!',900); },
  onPerfect(){ hud.toast(State.lang==='TH'?'เยี่ยม!':'Great!',700); },
  onQuestProgress(txt,cur,need){ hud.toast(`${txt} ${cur}/${need}`,800); },
  onQuestDone(){ hud.toast(State.lang==='TH'?'ภารกิจสำเร็จ!':'Mission complete!',900); },
};

// ---------- Gameplay Bus ----------
const Bus = {
  hit({ kind='good', meta }={}){
    score.addKind(kind, meta||{});
    if(kind==='perfect'){ sfx.perfect(); } else { sfx.good(); }
    Quests.event('hit',{result:kind,comboNow:score.combo|0,meta});
    if(meta?.golden) Progress.emit('golden');
    if(meta?.groupRoundDone) Quests.event('target_cleared');
  },
  miss({ meta }={}){
    const t=power.getTimers?.()||{};
    if((t.shield|0)>0){
      hud.toast(State.lang==='TH'?'🛡 กันพลาด!':'🛡 Shielded!',900);
      sfx.power(); score.add(2,{kind:'shield',...meta});
      Quests.event('hit',{result:'good',comboNow:score.combo|0,meta:{...meta,shielded:true}});
      return;
    }
    hud.flashDanger(); sfx.bad(); score.addKind('bad',meta||{});
    Quests.event('hit',{result:'bad',comboNow:score.combo|0,meta});
  },
  flag(t,p){ Progress.emit(t,p); Quests.event(t,p); },
  feverStart(){ Progress.emit('fever'); Quests.event('fever',{kind:'start'}); State.fever01=1; },
  targetCleared(){ Quests.event('target_cleared'); },
  groupFull(){ Quests.event('group_full'); },
  plateGroupFull(){ Quests.event('plate_group_full'); },
  hydroTick(z){ Quests.event('hydro_tick',{zone:String(z).toUpperCase()}); },
  hydroCross(f,t){ Quests.event('hydro_cross',{from:String(f).toUpperCase(),to:String(t).toUpperCase()}); },
  hydroClick(p){ Quests.event('hydro_click',p||{}); },
  power(k,s){ power.apply(k,s); },
};
window.onFeverStart=()=>Bus.feverStart();
window.onPlateOverfill=()=>{Progress.emit('plate_overfill');};
window.onHydrationHigh=()=>{Progress.emit('hydration_high');};

// ---------- Engine ----------
const Engine={lastTs:0,runner:null,
  update(dt){ if(State.fever01>0) State.fever01=Math.max(0,State.fever01-dt/8);
    this.runner?.update?.(dt,Bus); }
};
function makeRunner(mk){
  const mod=(mk==='groups'?groups:mk==='hydration'?hydration:mk==='plate'?plate:goodjunk);
  return (typeof mod.create==='function')
    ? mod.create({hud,coach:CoachBridge,bus:Bus,power,state:State})
    : {start(){mod.init?.(State,hud,Bus);},update(dt,b){mod.tick?.(State,dt,hud,b);},cleanup(){mod.cleanup?.(State,hud);}};
}
let _rafId=0;
function loop(ts){
  if(State.paused){_rafId=requestAnimationFrame(loop);return;}
  if(!Engine.lastTs)Engine.lastTs=ts;
  const dt=Math.min(0.1,(ts-Engine.lastTs)/1000); Engine.lastTs=ts; Engine.update(dt);
  _rafId=requestAnimationFrame(loop);
}
function stopLoop(){if(_rafId){cancelAnimationFrame(_rafId);_rafId=0;}Engine.lastTs=0;}

// ---------- Second ticker ----------
let _secT=0;
function startSecondTicker(){
  stopSecondTicker();
  _secT=setInterval(()=>{
    if(State.paused)return;
    State.seconds=Math.max(0,(State.seconds|0)-1); hud.setTime(State.seconds|0);
    mission.tick(State,{score:score.get()|0},res=>{
      if(res?.success){hud.toast(State.lang==='TH'?'เควสต์สำเร็จ!':'Quest done!',900);Progress.addMissionDone(State.mode);}
    },{hud,lang:State.lang});
    Quests.tick({score:score.get()|0});
    if((State.seconds|0)<=0) endGame();
  },1000);
}
function stopSecondTicker(){if(_secT){clearInterval(_secT);_secT=0;}}

// ---------- Game lifecycle ----------
function startGame(){
  const r=document.getElementById('result')||document.getElementById('resultModal');
  if(r)r.style.display='none';
  setLangFromUI();
  State.mode=window.HHA_UI?.getMode?.()||State.mode;
  State.diff=window.HHA_UI?.getDiff?.()||State.diff;
  State.seconds=45; State.fever01=0; score.reset(); hud.setScore(0); hud.setTime(State.seconds|0);
  Progress.genDaily(); Progress.beginRun(State.mode,State.diff,State.lang);
  const run=mission.start(State.mode,{seconds:State.seconds,count:3,lang:State.lang});
  mission.attachToState(run,State);
  Quests.setLang(State.lang);
  Quests.beginRun(State.mode,State.diff,State.lang,State.seconds);
  power.dispose(); hud.setPowerTimers(power.getTimers?.()||{});
  try{Engine.runner?.cleanup?.();}catch{} Engine.runner=makeRunner(State.mode); Engine.runner.start?.();
  State.paused=false; stopLoop(); _rafId=requestAnimationFrame(loop); startSecondTicker();
  bgmPlay(); window.requestIdleCallback?.(()=>sfx.unlock?.()); CoachBridge.onStart();
}

function endGame(){
  stopSecondTicker(); stopLoop(); try{Engine.runner?.cleanup?.();}catch{} bgmPause();
  Quests.endRun({score:score.get()|0,overfill:State.overfillCount|0,highCount:State.hydrationHighCount|0});
  board.submit(State.mode,State.diff,score.get()|0,{meta:{seconds:45,bestCombo:score.bestCombo|0}});
  const acc=Math.max(0,Math.min(100,Math.round((score.bestCombo||0)*3)));
  Progress.endRun({score:score.get()|0,bestCombo:score.bestCombo|0,timePlayed:45,acc});
  const r=document.getElementById('result')||document.getElementById('resultModal');
  if(r){const b=document.getElementById('finalScore'); if(b)b.textContent=String(score.get()|0); r.style.display='flex';}
}

// ---------- Blur/Focus ----------
window.onAppBlur =()=>{State.paused=true; bgmPause();};
window.onAppFocus=()=>{State.paused=false; bgmPlay();};

// ---------- UI Bridges ----------
window.onLangSwitch=(lang)=>{State.lang=(String(lang).toUpperCase()==='EN'?'EN':'TH');localStorage.setItem('hha_lang',State.lang);Quests.setLang(State.lang);};
window.onSoundToggle=function(){
  const now=!sfx.isEnabled(); sfx.setEnabled(now);
  if(now){ sfx.tick(); bgmPlay(); } else { bgmPause(); }
  hud.toast(now?(State.lang==='TH'?'เปิดเสียงแล้ว':'Sound ON'):(State.lang==='TH'?'ปิดเสียงแล้ว':'Sound OFF'),900);
};
window.onGfxToggle=function(){};

// ---------- Public Surface ----------
window.HHA={
  startGame,endGame,
  addScore(n=0,meta){score.add(n|0,meta||{});},
  applyPower(k,s){power.apply(k,s);},
  powers:{
    x2(s=8){power.apply('x2',s);},
    freeze(s=3){power.apply('freeze',s);},
    sweep(s=2){power.apply('sweep',s);},
    shield(s=6){power.apply('shield',s);},
  },
  get score(){return score.get();},
  get combo(){return score.combo|0;},
  get bestCombo(){return score.bestCombo|0;}
};
window.start=()=>startGame();
window.preStartFlow=()=>{};
