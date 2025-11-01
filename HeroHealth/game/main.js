import { PowerUpSystem } from './core/powerup.js';
import { createHUD } from './core/hud.js';
import { FX } from './core/engine.js'; // ถ้ามี

// ...โค้ดส่วนบนคงเดิม...

let R = {
  playing:false, startedAt:0, remain:45, raf:0,
  sys:{ score:null, sfx:null },
  modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null, coach:null,
  power:null
};

// ---------------- PowerUp HUD -----------------
function updatePowerHUD(timers){ R.hud?.updatePowerBar?.(timers); }

// ---------------- Bus -----------------
function busFor(){
  return {
    sfx:R.sys.sfx,
    hit(e){
      if(e?.points) R.sys.score.add(e.points);
      R.hud?.updateScore(R.sys.score.get?.()||0);

      if(e?.kind==='perfect') R.coach?.onPerfect?.();
      else if(e?.kind==='golden') R.coach?.onGood?.();

      if(e?.ui) FX.popText(`+${e.points||0}`, e.ui);

      if(e.kind==='golden') R.power?.apply('x2'); // ตัวอย่าง: golden = double score
    },
    miss(){
      if(R.power?.consumeShield()){
        R.coach?.say?.('Shield saved!');
        updatePowerHUD(R.power.getCombinedTimers());
        return;
      }
      R.hud?.dimPenalty?.(); R.coach?.onBad?.();
    },
    power(kind,sec){
      R.power?.apply(kind,sec);
      updatePowerHUD(R.power.getCombinedTimers());
    }
  };
}

// ---------------- Start -----------------
async function startGame(){
  await loadCore();
  R.power=new PowerUpSystem();
  R.power.onChange(updatePowerHUD);
  R.power.attachToScore(R.sys.score);
  updatePowerHUD(R.power.getCombinedTimers());

  R.hud=createHUD({
    onHome:()=>window.location.reload(),
    onReplay:()=>startGame()
  });

  R.playing=true;
  R.remain=45;
  requestAnimationFrame(gameTick);
}

// ---------------- Loop -----------------
function gameTick(){
  if(!R.playing) return;
  const frozen=R.power?.isFrozen?.();
  if(!frozen){
    // update mode normally
    if(R.modeInst?.update) R.modeInst.update(1/60,busFor());
  }
  requestAnimationFrame(gameTick);
}
