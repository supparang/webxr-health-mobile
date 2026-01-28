// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION
// ✅ createAICoach({ emit, game, cooldownMs, locale })
// ✅ Explainable micro-tips (rate-limited)
// ✅ Safe no-op if emit missing

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

export function createAICoach(cfg={}){
  const emit = (typeof cfg.emit === 'function') ? cfg.emit : null;
  const game = String(cfg.game || 'game');
  const cooldownMs = clamp(cfg.cooldownMs ?? 3000, 800, 20000);
  const locale = String(cfg.locale || 'th').toLowerCase();

  let lastTipAt = 0;
  let lastKey = '';
  let startedAt = 0;

  const say = (key, msg, why, extra={})=>{
    if (!emit) return;
    const t = nowMs();
    if (t - lastTipAt < cooldownMs) return;
    if (key && key === lastKey && (t - lastTipAt) < cooldownMs*1.8) return;
    lastTipAt = t;
    lastKey = key || '';
    emit('hha:coach', {
      game,
      type:'tip',
      key,
      message: msg,
      explain: why || '',
      timestampMs: t|0,
      ...extra
    });
  };

  const T = {
    th: {
      stormPrep: 'เก็บ 🛡️ ไว้ก่อนพายุ—ช่วงท้ายต้อง BLOCK ให้ทัน!',
      stormWhy: 'Mini จะผ่านเมื่อทำ LOW/HIGH ตามที่สั่ง + สะสม pressure + BLOCK ใน End Window และห้ามโดน BAD',
      endWindow: 'เข้า End Window แล้ว! เล็ง “🌩️/🥤” แล้ว BLOCK ด้วย 🛡️',
      endWhy: 'End Window คือช่วงท้ายพายุ ถ้าบล็อกสำเร็จจะนับผ่าน Mini / Boss เร็วมาก',
      low: 'พายุสั่งไป “LOW” → ทำให้น้ำต่ำลง (ต่ำกว่า GREEN)',
      high: 'พายุสั่งไป “HIGH” → ทำให้น้ำสูงขึ้น (สูงกว่า GREEN)',
      waterTooHard: 'คุมน้ำยากไป? ลอง “เล็งชัวร์ก่อนยิง” และอย่ารัวยิง BAD',
      waterWhy: 'ยิง 💧 จะดึงกลับเข้า GREEN แบบนุ่ม ๆ ส่วนโดน BAD จะดันน้ำแรง',
      accuracy: 'Accuracy ตก—หยุดรัว 1 วิ แล้วค่อยยิงเป้าที่อยู่ใกล้กลางจอ',
      accWhy: 'ยิงมั่วจะ MISS เพิ่ม ทำให้คุม GREEN และคอมโบยากขึ้น',
      combo: 'ดีมาก! ลากคอมโบต่อ—คะแนนจะโตไวขึ้น',
      comboWhy: 'คอมโบช่วยเพิ่มแต้มต่อ hit และสะท้อนความนิ่งในการเล็ง',
      shield0: 'ไม่มี 🛡️ แล้ว—ให้รีบเก็บ 🛡️ ก่อนพายุ/ก่อน Boss window',
      shieldWhy: 'ถ้าไม่มีโล่ ชน BAD จะนับ MISS + น้ำหลุดโซน',
      boss: 'Boss เริ่มโหดขึ้นแล้ว—เก็บโล่ไว้ 1–2 อัน แล้วรอจังหวะ BLOCK 🌩️',
      bossWhy: 'Boss ต้อง BLOCK ให้ครบตามจำนวนที่กำหนด ยิ่งท้ายเกมยิ่งต้องนิ่ง'
    }
  }[locale.startsWith('th') ? 'th' : 'th'];

  function onStart(){
    startedAt = nowMs();
    lastTipAt = 0;
    lastKey = '';
  }

  function onUpdate(s={}){
    const inStorm = !!s.inStorm;
    const inEnd = !!s.inEndWindow;
    const shield = (s.shield|0);
    const misses = (s.misses|0);
    const combo = (s.combo|0);
    const acc = clamp((s.skill ?? 0.5), 0, 1);

    // 1) End window is urgent
    if (inEnd){
      if (shield > 0) say('end', T.endWindow, T.endWhy, { urgent:true });
      else say('shield0', T.shield0, T.shieldWhy, { urgent:true });
      return;
    }

    // 2) Storm general prep
    if (inStorm){
      if (shield <= 0) say('shield0', T.shield0, T.shieldWhy);
      else say('storm', T.stormPrep, T.stormWhy);
      return;
    }

    // 3) Accuracy / frustration hints
    if (misses >= 10 && acc < 0.55){
      say('acc', T.accuracy, T.accWhy);
      return;
    }

    // 4) Combo praise (sparingly)
    if (combo >= 12 && (nowMs() - startedAt) > 6000){
      say('combo', T.combo, T.comboWhy);
      return;
    }

    // 5) Shield reminder sometimes
    if (shield <= 0 && (nowMs() - startedAt) > 5000){
      say('shield0', T.shield0, T.shieldWhy);
      return;
    }
  }

  function onEnd(summary={}){
    // optional: end recap tip (rate-limited by caller usage)
    const grade = String(summary.grade || '');
    if (grade === 'C'){
      say('endC', T.waterTooHard, T.waterWhy, { final:true });
    }
  }

  return { onStart, onUpdate, onEnd };
}