// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable micro-tips, rate-limited)
// Usage: const coach = createAICoach({ emit, game:'hydration', cooldownMs:3000 });
// coach.onStart(); coach.onUpdate(state); coach.onEnd(summary);

'use strict';

export function createAICoach({ emit, game='game', cooldownMs=3000 } = {}){
  const S = {
    lastAt: 0,
    lastTag: '',
    started: false,
    phase: 'play',
  };

  function now(){ return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

  function say(text, { tag='tip', level='info', why='' } = {}){
    const t = now();
    if (t - S.lastAt < cooldownMs) return false;
    if (tag && tag === S.lastTag && t - S.lastAt < cooldownMs*1.6) return false;

    S.lastAt = t;
    S.lastTag = tag;

    try{
      emit && emit('hha:coach', { type:'tip', game, level, tag, text, why });
    }catch(_){}
    return true;
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function pickTip(st){
    // st: { skill,fatigue,frustration,inStorm,inEndWindow,waterZone,shield,misses,combo }
    const skill = clamp(st.skill,0,1);
    const fatigue = clamp(st.fatigue,0,1);
    const frus = clamp(st.frustration,0,1);
    const zone = String(st.waterZone||'GREEN');
    const shield = (st.shield|0);
    const misses = (st.misses|0);
    const combo = (st.combo|0);
    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;

    // 1) Critical: End window but no shield
    if (inStorm && inEnd && shield <= 0){
      return {
        text: '🛡️ ตอนนี้เป็น End Window แล้ว! รีบเก็บโล่ก่อน แล้วค่อย BLOCK 🥤/🌩️',
        tag: 'end_no_shield',
        level: 'warn',
        why: 'End Window ต้องมีการ BLOCK เพื่อผ่าน Mini'
      };
    }

    // 2) Storm but still GREEN (mini ต้องออก GREEN)
    if (inStorm && zone === 'GREEN'){
      return {
        text: '💡 STORM Mini ต้องให้น้ำ “ไม่อยู่ GREEN” ก่อนนะ (LOW/HIGH) แล้วค่อยไป BLOCK ช่วงท้าย',
        tag: 'storm_need_zone',
        level: 'info',
        why: 'เงื่อนไข Mini: zoneOK = LOW/HIGH'
      };
    }

    // 3) High frustration
    if (frus >= 0.7 || misses >= 18){
      return {
        text: '🧠 ช้าลงนิด! เล็งให้ชัวร์ก่อนยิง จะลด MISS แล้วเกรดขึ้นเร็วมาก',
        tag: 'too_many_miss',
        level: 'info',
        why: 'MISS เยอะทำให้คอมโบแตก + คะแนนหาย'
      };
    }

    // 4) Encourage combos
    if (combo >= 10 && skill >= 0.55){
      return {
        text: '⚡ คอมโบกำลังมา! รักษาจังหวะเดิม อย่ารัวเกินไป จะได้ S/A ง่ายขึ้น',
        tag: 'combo_push',
        level: 'good',
        why: 'คอมโบยาวช่วยคะแนนและความแม่นยำ'
      };
    }

    // 5) Fatigue
    if (fatigue >= 0.8 && frus < 0.6){
      return {
        text: '⏳ ใกล้จบแล้ว! โฟกัสเป้าที่ชัวร์ + เก็บโล่ไว้ช่วงท้ายพายุ',
        tag: 'late_game',
        level: 'info',
        why: 'ท้ายเกมมี Boss Window ถี่ขึ้น'
      };
    }

    return null;
  }

  return {
    onStart(){
      S.started = true;
      S.lastAt = 0;
      S.lastTag = '';
      say('🎮 เริ่มแล้ว! โหมด Hydration: คุม GREEN ให้นาน → ผ่าน STORM Mini → เคลียร์ BOSS 🌩️', {
        tag:'start',
        level:'info',
        why:'ลำดับภารกิจ 3 Stage'
      });
    },

    onUpdate(st){
      if (!S.started) return;
      const tip = pickTip(st);
      if (tip) say(tip.text, tip);
    },

    onEnd(summary){
      if (!S.started) return;
      const g = String(summary?.grade||'C');
      const acc = Number(summary?.accuracyGoodPct||0);
      const miss = Number(summary?.misses||0);

      let text = `🏁 จบเกมแล้ว! เกรด ${g} • Accuracy ${acc.toFixed(1)}% • Miss ${miss}`;
      if (g === 'SSS' || g === 'SS') text = '🏆 โหดมาก! เกือบเพอร์เฟคแล้ว—ลองดันให้ SSS ต่อ!';
      else if (g === 'C') text = '💪 ไม่เป็นไร! ลองช้าลง + เก็บโล่ก่อนพายุ เดี๋ยวเกรดขึ้นไวมาก';

      say(text, { tag:'end', level:'info', why:'สรุปผลเพื่อชี้เป้าปรับรอบถัดไป' });
      S.started = false;
    }
  };
}