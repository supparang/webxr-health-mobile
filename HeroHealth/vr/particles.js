// === vr/specials.js — star/diamond/shield helper used byทุกโหมด ===
export const SPECIAL = { STAR:'⭐', DIA:'💎', SHIELD:'🛡️' };

// resolve type by emoji
export function kindOf(ch, goodSet, badSet){
  if (ch===SPECIAL.STAR)   return 'star';
  if (ch===SPECIAL.DIA)    return 'diamond';
  if (ch===SPECIAL.SHIELD) return 'shield';
  if (goodSet && goodSet.has(ch)) return 'good';
  if (badSet  && badSet.has(ch))  return 'bad';
  return 'good'; // fallback
}

// apply star/diamond/shield/fever & scoring; return {scoreDelta, comboDelta, shield}
export function applyHit(type, state){
  // state: { score, combo, shield, fever }  (fever is object from vr/fever.js)
  let sd=0, cd=0, sh=state.shield||0;
  const feverOn = state.fever?.isOn?.() ? 1.0 : 0.0;
  const mult = feverOn ? 2 : 1;

  if (type==='good'){
    sd += (20 + state.combo*2) * mult; cd += 1;
    state.fever?.addGood?.();
  }else if(type==='bad'){
    if (sh>0){ sh-=1; } else { sd -= 15; cd = -state.combo; }
  }else if(type==='star'){ sd += 40 * mult; state.fever?.addStar?.(); }
  else if(type==='diamond'){ sd += 80 * mult; state.fever?.addDiamond?.(); }
  else if(type==='shield'){ sh = Math.min(3, sh+1); }
  return { scoreDelta:sd, comboDelta:cd, shield:sh };
}
export default { SPECIAL, kindOf, applyHit };