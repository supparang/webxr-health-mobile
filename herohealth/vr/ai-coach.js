// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable micro-tips + rate-limit)
// Emits: hha:coach { game, type, level, text, hintKey }

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 2500, 900, 12000);

  const S = {
    started:false,
    lastSayAt:0,
    lastKey:'',
    stage:1,
  };

  function say(text, hintKey='tip', level='info'){
    const now = performance.now();
    if (now - S.lastSayAt < cooldownMs) return;
    if (hintKey && hintKey === S.lastKey) return;

    S.lastSayAt = now;
    S.lastKey = hintKey;

    emit('hha:coach', { game, type:'tip', level, text, hintKey });
    // (ถ้าคุณมี UI โค้ชแสดงผลอยู่แล้ว จะไปจับ event นี้เอง)
  }

  function onStart(){
    if (S.started) return;
    S.started=true;
    S.lastSayAt=0;
    S.lastKey='';
    say('เริ่มเลย! โฟกัสยิง 💧 ให้ Zone อยู่ GREEN ก่อนนะ', 'start_green', 'good');
  }

  function onUpdate(ctx={}){
    // ctx: { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo }
    const skill = clamp(ctx.skill,0,1);
    const fatigue = clamp(ctx.fatigue,0,1);
    const frus = clamp(ctx.frustration,0,1);
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone || '');
    const shield = Number(ctx.shield||0);
    const miss = Number(ctx.misses||0);
    const combo = Number(ctx.combo||0);

    // Tips logic (explainable)
    if (!inStorm){
      if (zone !== 'GREEN'){
        say('ตอนนี้น้ำหลุด GREEN แล้วนะ ยิง 💧 เพื่อดันกลับเข้ากลาง (GREEN)', 'zone_back_green', 'warn');
      } else if (combo >= 8 && skill >= 0.6){
        say('คอมโบกำลังสวย! รักษาจังหวะเดิมต่อ เกรดขึ้นไวมาก', 'combo_keep', 'good');
      } else if (miss >= 12 && frus >= 0.55){
        say('MISS เริ่มเยอะ—ลดการรัว เล็งให้ชัวร์ 0.2 วิแล้วค่อยยิง', 'miss_slowdown', 'warn');
      }
    } else {
      // Storm Mini
      if (zone === 'GREEN'){
        say('STORM มาแล้ว! ต้องทำให้หลุด GREEN (LOW/HIGH) ก่อน ถึงจะผ่าน Mini', 'storm_make_not_green', 'warn');
      }
      if (shield <= 0){
        say('หา 🛡️ ก่อน! STORM ต้องใช้ BLOCK ช่วงท้าย (End Window)', 'storm_need_shield', 'warn');
      }
      if (inEnd && shield > 0){
        say('ตอนนี้เป็น End Window! ใช้ 🛡️ BLOCK ให้ติดเงื่อนไข Mini', 'storm_endwindow_block', 'good');
      }
    }

    if (fatigue > 0.75 && frus > 0.55){
      say('ใกล้จบแล้ว! เน้น “ยิงชัวร์” มากกว่า “ยิงเร็ว” นะ', 'late_game_focus', 'info');
    }
  }

  function onEnd(summary={}){
    const grade = String(summary.grade||'');
    if (grade === 'SSS' || grade === 'SS'){
      say('โหดมาก! เกรดระดับท็อปแล้ว 🔥 ลองเพิ่มความยากได้เลย', 'end_top', 'good');
    } else if ((summary.stormSuccess|0) <= 0){
      say('รอบหน้าโฟกัส Stage2: STORM ต้อง LOW/HIGH + BLOCK ตอนท้าย', 'end_stage2', 'info');
    } else {
      say('ดีขึ้นเรื่อยๆ! รอบหน้าลองลากคอมโบยาวขึ้น + ลด MISS', 'end_next', 'info');
    }
  }

  return { onStart, onUpdate, onEnd, say };
}
