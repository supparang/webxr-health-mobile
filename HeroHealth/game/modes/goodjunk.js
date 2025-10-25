// game/modes/goodjunk.js
// -----------------------------------------------------------
// Good vs Junk – Enhanced (Stage 1)
// - Adaptive spawn weights
// - Combo tiers + Quick Double bonus
// - Micro missions (rotate)
// - Power-ups drops (shield / slow / healFever)
// - Scene-based weighting
// - Coach cues + FX
// -----------------------------------------------------------

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>performance.now?.() ?? Date.now();

// ---- Data: items ----
const GOOD = [
  { char:'🥦', name:'Broccoli',   score:7 },
  { char:'🍎', name:'Apple',      score:6 },
  { char:'🥗', name:'Salad',      score:7 },
  { char:'🍚', name:'Brown Rice', score:6 },
  { char:'🥕', name:'Carrot',     score:6 },
  { char:'🍓', name:'Berry',      score:6 },
];

const JUNK = [
  { char:'🍔', name:'Burger',     score:-6 },
  { char:'🍟', name:'Fries',      score:-6 },
  { char:'🥤', name:'Soda',       score:-6 },
  { char:'🍩', name:'Donut',      score:-7 },
  { char:'🍕', name:'Pizza',      score:-6 },
  { char:'🍰', name:'Cake',       score:-7 },
];

// Power-up “tokens”
const POWERS = [
  { key:'shield',    char:'🛡️', hint:'Shield'      },
  { key:'slow',      char:'🌀',  hint:'Slow-Time'   },
  { key:'healFever', char:'✨',  hint:'Heal Fever'  },
];

// ---- Scene weight multipliers ----
function sceneWeight(sceneKey){
  switch(sceneKey){
    case 'forest': return { good: 1.10, junk: 0.90 };
    case 'city':   return { good: 0.90, junk: 1.10 };
    case 'snow':   return { good: 1.05, junk: 0.95 };
    case 'desert': return { good: 0.95, junk: 1.05 };
    case 'ship':   return { good: 1.00, junk: 1.00 };
    default:       return { good: 1.00, junk: 1.00 };
  }
}

// ---- Mode state ----
const MODE = {
  adapt: 0,               // -12..+12
  lastGoodTs: 0,
  stats: { hits:0, good:0, junk:0, power:0 },
  micro: null,
  microLeft: 0,
  microOK: true,
  setMissionLine(txt){
    const el=document.getElementById('missionLine');
    if(!el) return; el.style.display='block'; el.textContent=txt;
  },
};

function newMicro(){
  const pool = [
    { id:'good_n',   label:'เก็บของดี 8 ชิ้นใน 15s',  need:8, dur:15, type:'good' },
    { id:'avoid_j',  label:'หลบของขยะ 12s',           need:12,dur:12, type:'avoid' },
    { id:'combo_t',  label:'รักษาคอมโบ ≥ x4 นาน 10s', need:10,dur:10, type:'combo' },
  ];
  const m = pool[(Math.random()*pool.length)|0];
  MODE.micro = m;
  MODE.microLeft = m.dur;
  MODE.microOK = true;
  MODE.setMissionLine(`🎯 ${m.label}`);
}

function addScore(scoreSys, v){ scoreSys?.add?.(v); }
function fxGood(systems, txt='+GOOD'){ systems?.fx?.spawn3D?.(null,txt,'good'); systems?.sfx?.play?.('sfx-good'); }
function fxBad (systems, txt='-JUNK'){ systems?.fx?.spawn3D?.(null,txt,'bad');  systems?.sfx?.play?.('sfx-bad'); }
function coachSay(systems, th,en,lang){ systems?.coach?.say?.(lang==='TH'?th:en); }
function pickWeighted(arr){ return arr[(Math.random()*arr.length)|0]; }

// ---- Adaptive spawn picker ----
function pickKind(state){
  // base weights
  let wGood = 60, wJunk = 36, wPow = 4;

  // adaptive
  if (MODE.adapt > 6){ wJunk += 10; wGood -= 8; }
  if (MODE.adapt < -6){ wGood += 10; wJunk -= 8; }

  // difficulty
  if (state.difficulty === 'Easy'){ wGood += 10; wJunk -= 8; }
  if (state.difficulty === 'Hard'){ wGood -= 8;  wJunk += 10; }

  // scene
  const sw = sceneWeight(state.sceneKey || state.scene || 'forest');
  wGood *= sw.good; wJunk *= sw.junk;

  // roll
  const total = Math.max(1, wGood + wJunk + wPow);
  let r = Math.random()*total;
  if (r < wGood) return 'good';
  r -= wGood;
  if (r < wJunk) return 'junk';
  return 'power';
}

export function init(state, hud, diff){
  MODE.adapt = 0;
  MODE.lastGoodTs = 0;
  MODE.stats = { hits:0, good:0, junk:0, power:0 };
  newMicro();
}

export function pickMeta(diff, state){
  const kind = pickKind(state);
  if (kind==='good'){
    const it = pickWeighted(GOOD);
    return { char: it.char, name: it.name, good:true,  ok:false, type:'good', base: it.score };
  }
  if (kind==='junk'){
    const it = pickWeighted(JUNK);
    return { char: it.char, name: it.name, good:false, ok:false, type:'junk', base: it.score };
  }
  const p = pickWeighted(POWERS);
  return { char:p.char, name:p.hint, good:false, ok:true, type:'power', power:p.key, base:0 };
}

export function onHit(meta, systems, state, hud){
  MODE.stats.hits++;

  if (meta.type==='power'){
    MODE.stats.power++;
    if (meta.power==='shield'){ systems?.power?.apply?.('shield'); fxGood(systems,'🛡️ Shield'); }
    if (meta.power==='slow'){   systems?.power?.apply?.('slow', {secs:3}); fxGood(systems,'🌀 Slow-Time'); }
    if (meta.power==='healFever'){ systems?.power?.apply?.('heal'); fxGood(systems,'✨ Fever +'); }
    return;
  }

  let base = meta.base || 0;

  if (meta.type==='good'){
    MODE.stats.good++;

    const t = now();
    const quick = (t - MODE.lastGoodTs) <= 600; // Quick Double
    MODE.lastGoodTs = t;

    let bonus = 0;
    if (quick) bonus += 2;

    const combo = systems?.score?.combo||0;
    if (combo >= 12) bonus += 3;
    else if (combo >= 8) bonus += 2;
    else if (combo >= 4) bonus += 1;

    addScore(systems?.score, base + bonus);
    fxGood(systems, quick ? 'Perfect!' : '+GOOD');

    if (combo===4 || combo===8 || combo===12){
      coachSay(systems, 'คอมโบยอดเยี่ยม!','Great combo!', state.lang);
    }

    MODE.adapt = clamp(MODE.adapt + 0.6, -12, 12);
    return;
  }

  // junk
  MODE.stats.junk++;
  addScore(systems?.score, base); // base เป็นลบ
  fxBad(systems);
  if ((MODE.stats.junk % 3)===0){
    coachSay(systems, 'ระวังของขยะ!','Watch out for junk!', state.lang);
  }
  MODE.adapt = clamp(MODE.adapt - 1.0, -12, 12);
}

export function tick(state, systems, hud){
  if (MODE.micro){
    MODE.microLeft = Math.max(0, MODE.microLeft-1);

    if (MODE.micro.id==='good_n'){
      const need = MODE.micro.need|0;
      if (MODE.stats.good >= need && MODE.microOK){
        systems?.score?.add?.(25);
        systems?.fx?.spawn3D?.(null,'🎉 Mission: Success','good');
        systems?.sfx?.play?.('sfx-perfect');
        MODE.micro = null;
      }
    }
    else if (MODE.micro.id==='avoid_j'){
      if (MODE.stats.junk > 0) MODE.microOK = false;
      if (MODE.microLeft===0){
        if (MODE.microOK){
          systems?.score?.add?.(20);
          systems?.fx?.spawn3D?.(null,'🎉 Mission: Success','good');
          systems?.sfx?.play?.('sfx-perfect');
          MODE.adapt = clamp(MODE.adapt + 1.5, -12, 12);
        }else{
          MODE.adapt = clamp(MODE.adapt - 1.0, -12, 12);
        }
        MODE.micro = null;
      }
    }
    else if (MODE.micro.id==='combo_t'){
      const ok = (systems?.score?.combo||0) >= 4;
      if (!ok) MODE.microOK = false;
      if (MODE.microLeft===0){
        if (MODE.microOK){
          systems?.score?.add?.(20);
          systems?.fx?.spawn3D?.(null,'🎉 Mission: Success','good');
          systems?.sfx?.play?.('sfx-perfect');
          MODE.adapt = clamp(MODE.adapt + 1.0, -12, 12);
        }else{
          MODE.adapt = clamp(MODE.adapt - 0.5, -12, 12);
        }
        MODE.micro = null;
      }
    }

    if (!MODE.micro){
      setTimeout(()=>{ newMicro(); }, 300);
    }else{
      MODE.setMissionLine(`🎯 ${MODE.micro.label} • ${MODE.microLeft|0}s`);
    }
  }
}

export default { init, pickMeta, onHit, tick };
