// === Hero Health Academy — game/modes/hydration.js (debounce zone + smart-sip + fever flames @HIGH) ===
import { Quests } from '/webxr-health-mobile/HeroHealth/game/core/quests.js';
const ZONES = { LOW:'LOW', OK:'OK', HIGH:'HIGH' };
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const zoneOf=(v,min,max)=> v<min?ZONES.LOW:(v>max?ZONES.HIGH:ZONES.OK);

let _zone = 'OK', _zoneAt = 0;

function ensureHUD(){
  let wrap=document.getElementById('hydroWrap');
  if(!wrap){ wrap=document.createElement('div'); wrap.id='hydroWrap'; document.body.appendChild(wrap); }
  if(!wrap.querySelector('.hydroBar')){
    wrap.innerHTML = `
      <div class="hydroBar" aria-label="hydration-bar">
        <div class="seg low"><span>น้อยไป</span></div>
        <div class="seg ok"><span>พอดี</span></div>
        <div class="seg high"><span>มากไป</span></div>
        <div class="needle" role="presentation"></div>
        <div class="flame" role="presentation" hidden><i></i><i></i><i></i></div>
      </div>`;
  }
}

export function init(state, hud, diff){
  state.hydTotalTime = (diff.time|0); state.hyd=50; state.hydMin=35; state.hydMax=65;
  state.hydDecay=0.25; state._hydPrevZone=zoneOf(state.hyd, state.hydMin, state.hydMax);
  state.highCount=0;
  ensureHUD(); hud.showHydration?.(); render(state);
  _zone = zoneOf(state.hyd, state.hydMin, state.hydMax); _zoneAt=performance.now();
}
export function cleanup(state,hud){ hud.hideHydration?.(); }

export function pickMeta(diff, state){
  const r=Math.random();
  if (r<0.55) return { id:'water', char:'💧', aria:'Water', good:true, life: diff.life };
  if (r<0.85) return { id:'sweet', char:'🧃', aria:'Sweet', good:false, life: diff.life };
  if (r<0.95) return { id:'ice',   char:'🧊', aria:'Ice', good:true, booster:true, life: diff.life };
  return              { id:'gold',  char:'⭐', aria:'Golden', golden:true, good:true, life: diff.life };
}

function smartHint(msg){
  let el=document.getElementById('hydroHint'); if(!el){ el=document.createElement('div'); el.id='hydroHint';
    el.style.cssText='position:fixed;left:50%;top:22%;transform:translateX(-50%);font:800 12px ui-rounded;background:rgba(0,0,0,.55);padding:6px 10px;border-radius:10px;z-index:9999';
    document.body.appendChild(el);
  }
  el.textContent=msg; el.style.opacity='1'; setTimeout(()=>{ el.style.opacity='0'; }, 1500);
}

export function onHit(meta, sys, state, hud){
  const before=state.hyd, zBefore=zoneOf(before, state.hydMin, state.hydMax);
  if (meta.id==='water'){
    const delta = zBefore===ZONES.HIGH ? +2 : +6; state.hyd = clamp(state.hyd+delta,0,100);
  }else if (meta.id==='sweet'){
    const delta = zBefore===ZONES.HIGH ? -8 : zBefore===ZONES.OK ? -3 : +4; state.hyd = clamp(state.hyd+delta,0,100);
  }else if (meta.id==='ice'){
    state.hydDecayBoostUntil = performance.now()+5000; state.hydDecay=0.1;
  }else if (meta.id==='gold'){
    if (state.hyd < state.hydMin) state.hyd = clamp(state.hyd+10,0,100);
    else if (state.hyd > state.hydMax) state.hyd = clamp(state.hyd-10,0,100);
    else state.hyd = clamp(state.hyd+6,0,100);
  }

  Quests.event('hydro_click', { zoneBefore:zBefore, kind: meta.id==='sweet'?'sweet':'water' });

  const zAfter=zoneOf(state.hyd, state.hydMin, state.hydMax);
  if (zAfter===ZONES.OK){ sys.score.add?.(8); }
  // smart hint
  if (zBefore===ZONES.LOW && meta.id==='water') smartHint('✓ ดื่มน้ำถูกต้อง');
  if (zBefore===ZONES.HIGH && meta.id==='sweet') smartHint('✓ ลดความเข้มด้วยหวานเล็กน้อย');

  render(state);
  if (zAfter===ZONES.OK) return (meta.golden?'perfect':'good');
  if (zBefore!==zAfter && zAfter!==ZONES.OK) return 'bad';
  return 'ok';
}

export function tick(state, sys, hud){
  const now=performance.now();
  if (state.hydDecayBoostUntil && now>state.hydDecayBoostUntil){ state.hydDecayBoostUntil=0; state.hydDecay=0.25; }
  state.hyd = clamp(state.hyd - state.hydDecay, 0, 100);
  const z = zoneOf(state.hyd, state.hydMin, state.hydMax);

  // debounce zone crossing
  if (z!==_zone && (now - _zoneAt) > 350){
    Quests.event('hydro_cross',{from:_zone,to:z}); _zone=z; _zoneAt=now;
  }
  // track HIGH time
  if (z===ZONES.HIGH){ state.highCount = (state.highCount|0)+1; }

  Quests.event('hydro_tick',{ level: state.hyd, zone: (z===ZONES.OK?'OK':z) });
  if (z!==ZONES.OK && hud?.dimPenalty){ hud.dimPenalty(); }
  render(state);
}

// visual
function render(state){
  const wrap=document.getElementById('hydroWrap'); if(!wrap) return;
  const bar=wrap.querySelector('.hydroBar'); const needle=wrap.querySelector('.needle'); const flame=wrap.querySelector('.flame');
  const pct = clamp(state.hyd|0,0,100); needle.style.left=`calc(${pct}% - 6px)`;
  const z = zoneOf(state.hyd, state.hydMin, state.hydMax); bar.dataset.zone=z;

  // FEVER flames เฉพาะเมื่อ FEVER ทำงานและโซน HIGH
  const fever = !!state?.fever?.active;
  flame.hidden = !(fever && z===ZONES.HIGH);
}
