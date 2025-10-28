// === mode: goodjunk ===
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

const GOODS = ['🥗','🍎','🥦','🍇','🍓','🥕','🥒','🍅','🌽','🍠','🍊','🍌'];
const JUNKS = ['🍟','🍔','🌭','🍕','🍩','🍰','🥤','🍗🧂','🍬','🧁'];

const rnd = a=>a[(Math.random()*a.length)|0];

export function init(state,hud,diff){ const tgt=$('#targetWrap'); if(tgt) tgt.style.display='none'; state.ctx={}; }
export function cleanup(){}

export function pickMeta(diff,state){
  const isGood = Math.random() < 0.65;
  const char = isGood ? rnd(GOODS) : rnd(JUNKS);
  const golden = isGood && Math.random()<0.08;
  return {
    id:'gj_'+Date.now().toString(36),
    char, aria: isGood?'good':'junk', label: isGood?'good':'junk',
    isGood, golden, good: isGood, life: diff?.life ?? 3000
  };
}

export function onHit(meta, sys, state){
  const { sfx } = sys;
  if (meta.isGood){
    try{ sfx.play(meta.golden?'sfx-perfect':'sfx-good'); }catch{}
    return meta.golden ? 'perfect' : 'good';
  } else {
    try{ sfx.play('sfx-bad'); }catch{}
    return 'bad';
  }
}

export const fx = {
  onSpawn: add3DTilt,
  onHit(x,y){ shatter3D(x,y); }
};
// === Hero Health Academy — modes/goodjunk.js (weighted spawn + golden cap + fair penalty) ===
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

let _goldenInWindow=0, _spawnsInWindow=0;
function resetWindow(){ _spawnsInWindow=0; _goldenInWindow=0; }

export function init(state,hud,diff){ resetWindow(); }
export function cleanup(){ resetWindow(); }

export function pickMeta(diff,state){
  // ปรับจาก accuracy ล่าสุด
  const total = state.stats.good+state.stats.perfect+state.stats.ok+state.stats.bad;
  const acc = total>0 ? (state.stats.good+state.stats.perfect)/total : 0.7;
  let goodRatio = 0.55 + (0.70-acc)*0.20; // ถ้าความแม่นต่ำ เพิ่มของดีนิดหน่อย
  goodRatio = Math.max(0.45, Math.min(0.70, goodRatio));

  // golden gating (ต่อ 20 ชิ้น)
  _spawnsInWindow++; if (_spawnsInWindow>=20) resetWindow();

  const r = Math.random();
  const goldenPossible = (_goldenInWindow < 3) && (Math.random() < 0.05);
  if (r < goodRatio){
    const golden = goldenPossible; if (golden) _goldenInWindow++;
    return { id:'good', char:'🥗', aria:'Healthy Food', good:true, golden, life: diff.life };
  }
  // junk
  return { id:'junk', char:'🍟', aria:'Junk Food', good:false, life: diff.life };
}

export function onHit(meta, sys, state){
  const { sfx } = sys;
  if (meta.good){
    try{ sfx.play(meta.golden?'sfx-perfect':'sfx-good'); }catch{}
    return meta.golden?'perfect':'good';
  }else{
    // โทษคงที่ ไม่คูณ FEVER (คะแนนจริงไปคำนวณใน main แล้ว)
    try{ sfx.play('sfx-bad'); }catch{}
    return 'bad';
  }
}

export const fx = {
  onSpawn(el){ add3DTilt(el); },
  onHit(x,y){ shatter3D(x,y); }
};
