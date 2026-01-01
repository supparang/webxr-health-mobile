/* === /herohealth/vr-groups/ai-stubs.js ===
GroupsVR AI Stubs (Remember-first)
- AI Difficulty Director (stub)
- AI Coach micro-tips (stub)
- AI Pattern Generator (stub)
Expose: window.GroupsVR.AI
NOTE: ตอนนี้ "ไม่ปรับเกมจริง" จนกว่าจะสั่งใส่เต็ม
*/
(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  // --- Director (stub) ---
  function createDifficultyDirector(){
    let last = 0;
    return {
      update(state){
        // state: {acc, combo, fever, left, runMode, diff, seed}
        // stub: return null always (no changes)
        last = now();
        return null;
      }
    };
  }

  // --- Coach (stub, rate-limited) ---
  function createCoach(){
    let tLast = 0;
    const cdMs = 4200;
    const tips = [
      'โฟกัสของในหมู่ให้ถูกก่อนนะ 🎯',
      'อย่ารีบกดมั่ว—เล็งให้ชัวร์! 👀',
      'ถ้าเริ่มพลาด ให้รีเซ็ตคอมโบใหม่ได้ 💪',
      'ช่วงท้าย 10 วิ “Clutch” ได้แต้มเพิ่มนะ ⚡',
    ];
    return {
      maybeTip(state, emitCoach){
        // stub: เบามากๆ ไม่ spam
        const t = now();
        if (t - tLast < cdMs) return;
        if (!state || state.runMode !== 'play') return; // research เงียบไว้ก่อน
        // tip เฉพาะเมื่อ fever สูงหรือ combo หลุด
        if (state.fever >= 70 || (state.combo===0 && state.hitAll>=8)){
          tLast = t;
          const msg = tips[(Math.random()*tips.length)|0];
          try{ emitCoach(msg, (state.fever>=70)?'fever':'neutral'); }catch{}
        }
      }
    };
  }

  // --- Pattern Generator (stub) ---
  function createPatternGenerator(){
    return {
      chooseStormPattern(style /*mix/feel/hard*/, rng /*fn*/){
        // stub: ใช้ logic เดิมเป็นหลัก
        if (style === 'feel') return 'wave';
        if (style === 'hard') return 'spiral';
        return (rng && rng()<0.5) ? 'burst' : 'wave';
      }
    };
  }

  NS.AI = {
    createDifficultyDirector,
    createCoach,
    createPatternGenerator
  };
})(typeof window!=='undefined'?window:globalThis);