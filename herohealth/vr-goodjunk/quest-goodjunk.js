// === /herohealth/vr-goodjunk/quest-goodjunk.js ===
import { makeQuestDirector } from '../modes/quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

export function createVRGoodjunkQuest(diff = 'normal', opts = {}) {
  return makeQuestDirector({
    diff,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 3,
    maxMini:  3,
    onUpdate: (ui) => {
      // ส่งเข้า HUD
      try { window.dispatchEvent(new CustomEvent('quest:update', { detail: ui })); } catch (_) {}
      // ถ้าคุณอยากรองรับชื่ออีกแบบด้วย:
      try { window.dispatchEvent(new CustomEvent('hha:quest', { detail: ui })); } catch (_) {}

      // forward ให้คนเรียกต่อได้ด้วย
      if (typeof opts.onUpdate === 'function') {
        try { opts.onUpdate(ui); } catch (_) {}
      }
    }
  });
}

export default { createVRGoodjunkQuest };