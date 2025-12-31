/* === /herohealth/vr-groups/ai.js ===
GroupsVR AI Hooks (STUB) — remember for later
- Difficulty Director (play adaptive, research deterministic)
- Coach micro-tips (explainable + rate-limit)
- Pattern Generator (seeded)
Expose: window.GroupsVR.AI
*/
(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});

  function makeRateLimit(ms){
    let t=0;
    return ()=> {
      const now = Date.now();
      if (now - t < ms) return false;
      t = now; return true;
    };
  }

  const canTip = makeRateLimit(2200);

  const AI = {
    // 1) Difficulty Director: returns suggested tuning (optional)
    directorTick(state){
      // TODO: ใส่โมเดลปรับ spawn/ttl/junk/decoy อย่างยุติธรรม
      // return { spawnMs, ttlMs, junkBias, decoyBias, bossEvery }
      return null;
    },

    // 2) Coach: return {text,mood,why} or null
    coachTip(eventName, state){
      if (!canTip()) return null;
      // TODO: explainable micro-tips
      // ตัวอย่าง:
      if (eventName==='miss' && state && state.fever>=60){
        return { text:'หายใจลึก ๆ แล้วเล็งกลางจอ ช้าอีกนิดแต่แม่นขึ้นนะ', mood:'neutral', why:'fever สูง + เพิ่งพลาด' };
      }
      return null;
    },

    // 3) Pattern Generator: choose storm/boss patterns (seeded externally)
    stormPattern(state){
      // TODO: ใช้ seed+state เพื่อเลือกแบบ deterministic
      return null;
    }
  };

  NS.AI = AI;
})(typeof window!=='undefined'?window:globalThis);