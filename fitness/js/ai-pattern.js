'use strict';

// Simple deterministic pattern picker (placeholder)
// seedStr can be pid/time etc; in research should be locked upstream
function hashStr(s){
  s = String(s||'');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h>>>0);
}

export const AiPattern = {
  pick(seedStr, phase=1, diff='normal'){
    const h = hashStr(seedStr + '|' + phase + '|' + diff);
    const idx = h % 3;
    if (idx === 0) return 'burst';
    if (idx === 1) return 'zigzag';
    return 'pulse';
  }
};