// === /herohealth/vr-goodjunk/goodjunk-race.js ===
// GoodJunk Race Controller — UI countdown only (safe)
// FULL v20260304-RACE-COUNTDOWN
'use strict';

export function bootRace(opts = {}){
  const overlay = document.getElementById(opts.overlayId || 'raceOverlay');
  const numEl   = document.getElementById(opts.numId || 'raceNum');
  const subEl   = document.getElementById(opts.subId || 'raceSub');

  if(!overlay || !numEl) return;

  const wait = !!opts.wait;
  const autostartMs = Number(opts.autostartMs || 3000);

  if(!wait) return; // if not waiting, do nothing

  // pause core if exists
  try{ window.__GJ_SET_PAUSED__?.(true); }catch(_){}

  overlay.setAttribute('aria-hidden','false');
  if(subEl) subEl.textContent = 'เริ่มพร้อมกันใน…';

  const steps = [3,2,1,'GO!'];
  const stepDur = Math.max(600, Math.floor(autostartMs / 3));

  let i = 0;
  function next(){
    const v = steps[i++];
    numEl.textContent = String(v);
    if(i <= steps.length){
      setTimeout(next, stepDur);
    }
    if(v === 'GO!'){
      setTimeout(()=>{
        overlay.setAttribute('aria-hidden','true');
        try{ window.__GJ_SET_PAUSED__?.(false); }catch(_){}
      }, 420);
    }
  }
  next();
}