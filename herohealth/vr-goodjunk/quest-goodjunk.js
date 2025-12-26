// === /herohealth/vr-goodjunk/quest-goodjunk.js ===
// Adapter สำหรับต่อ VR GoodJunk เข้ากับ quest-director + รายการเควสต์ (label/targetByDiff/eval/pass)

import { makeQuestDirector } from '../modes/quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

function pickTargetByDiff(targetByDiff, diff='normal'){
  if (!targetByDiff || typeof targetByDiff !== 'object') return 1;
  const d = String(diff).toLowerCase();
  return (
    Number(targetByDiff[d]) ||
    Number(targetByDiff.normal) ||
    Number(targetByDiff.easy) ||
    Number(Object.values(targetByDiff).find(v => Number(v) > 0)) ||
    1
  );
}

function toRuntimeGoal(def, diff){
  return {
    id: def.id,
    title: def.label ?? def.title ?? def.name ?? 'Goal',
    kind: def.id ?? def.kind ?? 'goal',
    target: pickTargetByDiff(def.targetByDiff, diff),
    eval: def.eval,   // function(s)=>number
    pass: def.pass    // function(value,target)=>boolean
  };
}

function toRuntimeMini(def, diff){
  return {
    id: def.id,
    title: def.label ?? def.title ?? def.name ?? 'Mini',
    kind: def.id ?? def.kind ?? 'mini',
    target: pickTargetByDiff(def.targetByDiff, diff),
    eval: def.eval,
    pass: def.pass
    // ถ้าในอนาคตอยากมี timeLimitSec ก็เพิ่มที่ defs แล้วส่งผ่านได้เลย
  };
}

export function createVRGoodjunkQuest(diff = 'normal', onUpdate = null) {
  const goals = (GOODJUNK_GOALS || []).map(g => toRuntimeGoal(g, diff));
  const minis = (GOODJUNK_MINIS || []).map(m => toRuntimeMini(m, diff));

  return makeQuestDirector({
    diff,
    goalDefs: goals,
    miniDefs: minis,
    maxGoals: 3,
    maxMini:  3,
    onUpdate: (typeof onUpdate === 'function') ? onUpdate : null,
  });
}

export default { createVRGoodjunkQuest };