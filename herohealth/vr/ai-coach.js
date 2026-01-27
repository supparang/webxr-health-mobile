// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (HHA Standard)
// ✅ createAICoach({ emit, game, cooldownMs }) -> { onStart, onUpdate, onEnd, say }
// ✅ Explainable micro-tips, rate-limited
// ✅ Works offline, no dependencies
// ✅ Deterministic-friendly: no randomness used by default

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

function pickTip(state){
  // state: { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo }
  const skill = clamp(state.skill, 0, 1);
  const fat   = clamp(state.fatigue, 0, 1);
  const fru   = clamp(state.frustration, 0, 1);
  const inStorm = !!state.inStorm;
  const inEnd = !!state.inEndWindow;
  const zone = String(state.waterZone || '').toUpperCase();
  const sh = Number(state.shield||0)|0;
  const miss = Number(state.misses||0)|0;
  const combo = Number(state.combo||0)|0;

  // Priority tips
  if (inStorm && inEnd){
    if (sh <= 0) return { tag:'storm-end-noshield', level:'urgent',
      text:'⏱️ End Window มาแล้ว! ตอนนี้ต้อง BLOCK แต่โล่หมด—รีบเก็บ 🛡️ ก่อนรอบถัดไปนะ' };
    return { tag:'storm-end-block', level:'urgent',
      text:'⏱️ End Window! รอจังหวะแล้วใช้ 🛡️ BLOCK ให้ได้ (ห้ามโดน 🥤)' };
  }

  if (inStorm){
    if (zone === 'GREEN') return { tag:'storm-zone', level:'hint',
      text:'🌀 ช่วงพายุ: ต้องทำ LOW/HIGH ให้สำเร็จ—ตอนนี้ยัง GREEN อยู่ ลองยิง 💧/หลบ 🥤 เพื่อให้หลุดโซน' };
    if (sh <= 0) return { tag:'storm-shield', level:'hint',
      text:'🛡️ ช่วงพายุมี “ภารกิจ BLOCK” เก็บโล่ไว้ก่อนนะ (มีผลมากตอนท้าย)' };
  }

  if (zone !== 'GREEN'){
    if (zone === 'LOW') return { tag:'zone-low', level:'hint',
      text:'💧 น้ำ LOW แล้ว—เน้นยิง 💧 ต่อเนื่องให้กลับ GREEN (อย่ารัวมั่ว)' };
    return { tag:'zone-high', level:'hint',
      text:'🥤 น้ำ HIGH แล้ว—ระวังโดน BAD ซ้ำ! เลือกยิง 💧 ที่ชัวร์เพื่อกลับ GREEN' };
  }

  if (miss >= 18 && fru >= 0.55) return { tag:'many-miss', level:'coach',
    text:'🎯 MISS เยอะแล้วนะ ลอง “ชะลอ 0.2 วิ” ก่อนยิง จะโดนง่ายขึ้นมาก' };

  if (combo >= 10 && skill >= 0.60) return { tag:'combo-praise', level:'praise',
    text:'🔥 คอมโบสวยมาก! รักษาจังหวะเดิม แล้วเตรียมโล่สำหรับพายุรอบถัดไป' };

  if (skill < 0.35) return { tag:'aim-basic', level:'hint',
    text:'🎯 ทริคเล็ง: เล็งกลางเป้าให้ค้างนิดนึงแล้วค่อยกด จะนิ่งขึ้นเยอะ' };

  if (fat > 0.70 && fru > 0.40) return { tag:'calm', level:'coach',
    text:'🧠 ใกล้จบแล้ว! โฟกัส “ยิงชัวร์” ดีกว่า “ยิงเยอะ” เกรดจะดีขึ้น' };

  // default
  return { tag:'default', level:'info',
    text:'💡 เป้าหมายหลักคือคุม GREEN ให้นาน แล้วใช้ 🛡️ BLOCK ตอน End Window ของพายุ' };
}

export function createAICoach(opts){
  const emit = (opts && typeof opts.emit === 'function') ? opts.emit : (()=>{});
  const game = String((opts && opts.game) || 'game');
  const cooldownMs = clamp((opts && opts.cooldownMs) || 2800, 800, 12000);

  const st = {
    started:false,
    ended:false,
    lastSayAt: 0,
    lastTag: '',
    lastMsg: '',
    lastState: null,
  };

  function say(message, meta){
    if (st.ended) return;
    const msg = String(message || '').trim();
    if (!msg) return;

    const t = nowMs();
    if (t - st.lastSayAt < cooldownMs) return;

    // avoid repeating same message
    if (msg === st.lastMsg) return;

    st.lastSayAt = t;
    st.lastMsg = msg;

    emit('hha:coach', {
      game,
      text: msg,
      ...(meta || {})
    });
  }

  function onStart(){
    st.started = true;
    st.ended = false;
    st.lastSayAt = 0;
    st.lastTag = '';
    st.lastMsg = '';
    st.lastState = null;

    say('👋 พร้อมแล้ว! โฟกัสคุม GREEN ก่อน แล้วเก็บ 🛡️ ไว้ทำพายุ', { type:'start' });
  }

  function onUpdate(state){
    if (!st.started || st.ended) return;
    st.lastState = state || {};

    const tip = pickTip(st.lastState);

    // Prevent same tag spam
    if (tip.tag && tip.tag === st.lastTag){
      // allow if urgent and situation changed (end window)
      if (!(tip.level === 'urgent' && st.lastState.inEndWindow)) return;
    }
    st.lastTag = tip.tag || '';

    const type =
      tip.level === 'urgent' ? 'urgent' :
      tip.level === 'praise' ? 'praise' :
      tip.level === 'coach'  ? 'coach'  :
      tip.level === 'hint'   ? 'hint'   : 'info';

    say(tip.text, { type });
  }

  function onEnd(summary){
    if (st.ended) return;
    st.ended = true;

    try{
      const grade = String((summary && summary.grade) || 'C');
      const acc = Number((summary && summary.accuracyGoodPct) || 0);
      const miss = Number((summary && summary.misses) || 0);

      let msg = `🏁 จบเกมแล้ว! เกรด ${grade}`;
      if (acc >= 80) msg += ` • Accuracy ${acc.toFixed(0)}% ดีมาก`;
      else msg += ` • Accuracy ${acc.toFixed(0)}%`;

      if (miss >= 15) msg += ` • ลองลดการรัวเพื่อให้ MISS น้อยลง`;
      else msg += ` • MISS คุมได้ดี`;

      emit('hha:coach', { game, type:'end', text: msg });
    }catch(_){}
  }

  return { onStart, onUpdate, onEnd, say };
}