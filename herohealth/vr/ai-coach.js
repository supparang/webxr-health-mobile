// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable Micro-tips) — HeroHealth Standard
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ Rate-limit + context aware (storm/endwindow/boss)
// ✅ research mode: auto-silent (deterministic)
// ✅ Emits: hha:coach {type:'tip'|'start'|'end', text, reason, level}

'use strict';

const WIN = (typeof window !== 'undefined') ? window : {};
const DOC = (typeof document !== 'undefined') ? document : null;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; }
}
function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

function isResearch(){
  const run = String(qs('run', qs('runMode','play')) || '').toLowerCase();
  return run === 'research' || run === 'study';
}

function pick(arr, k=0.5){
  const i = Math.floor(clamp(k,0,0.9999)*arr.length);
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : (name,detail)=>{
    try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  };
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 3000, 800, 10000);

  const S = {
    started:false,
    lastTipAt:0,
    lastKey:'',
    tipCount:0,
    stage:1,
    // smoothing
    emaSkill:0.45,
    emaFrustration:0.20
  };

  function canSpeak(key){
    const t = nowMs();
    if (key && key === S.lastKey && (t - S.lastTipAt) < cooldownMs*1.6) return false;
    if ((t - S.lastTipAt) < cooldownMs) return false;
    return true;
  }

  function say(text, reason='tip', level='info', key=''){
    if (isResearch()) return;
    if (!canSpeak(key)) return;
    S.lastTipAt = nowMs();
    S.lastKey = key || reason || 'tip';
    S.tipCount++;
    emit('hha:coach', { type:'tip', game, level, text, reason, tipCount:S.tipCount });
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    S.tipCount = 0;
    S.lastTipAt = 0;
    S.lastKey = '';
    if (!isResearch()){
      emit('hha:coach', { type:'start', game, text:'โค้ชมาแล้ว! 🎯 โฟกัส “คุม GREEN → ผ่านพายุ → เคลียร์บอส”' });
    }
  }

  function onUpdate(ctx={}){
    if (isResearch()) return;

    // inputs (0..1 where possible)
    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const fatigue = clamp(ctx.fatigue ?? 0, 0, 1);
    const frustration = clamp(ctx.frustration ?? 0.2, 0, 1);
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone || '');
    const shield = ctx.shield|0;
    const misses = ctx.misses|0;
    const combo = ctx.combo|0;

    // smooth
    S.emaSkill = S.emaSkill*0.88 + skill*0.12;
    S.emaFrustration = S.emaFrustration*0.85 + frustration*0.15;

    // Hard-stop spam
    if (S.tipCount >= 60) return;

    // Priority tips
    if (inStorm && inEnd){
      if (shield <= 0){
        say('⏱️ End Window แล้ว! แต่ไม่มี 🛡️ — รีบเก็บ 🛡️ ก่อนรอบถัดไปนะ', 'endwindow', 'warn', 'end_no_shield');
      } else {
        say('⏱️ End Window! ตอนนี้ใช้ 🛡️ BLOCK ให้ครบ จะนับผ่าน Mini ได้ง่ายสุด', 'endwindow', 'success', 'end_block');
      }
      return;
    }

    if (inStorm){
      if (zone === 'GREEN'){
        say('🌀 อยู่ GREEN ตอนพายุยังไม่ผ่านเงื่อนไข “LOW/HIGH” — ดันให้ออก GREEN ก่อน แล้วค่อย BLOCK ช่วงท้าย', 'storm_zone', 'info', 'storm_need_zone');
        return;
      }
      if (shield <= 0){
        say('🌀 พายุมาแล้ว แต่ 🛡️ หมด — รอบหน้าเก็บ 🛡️ อย่างน้อย 1–2 อันก่อนพายุ', 'storm_shield', 'warn', 'storm_need_shield');
        return;
      }
      if (misses > 0 && (misses % 8 === 0)){
        say('🌀 พายุอย่ารัว! เลือกยิงเป้าที่ชัวร์ ลด MISS แล้ว Mini จะผ่านเอง', 'storm_control', 'info', 'storm_reduce_miss');
        return;
      }
      // small encouragement
      if (combo >= 10){
        say('🔥 คอมโบดีมาก! รักษาจังหวะต่อไป เกรดจะพุ่งเร็ว', 'combo', 'success', 'combo_good');
        return;
      }
      return;
    }

    // Non-storm phase
    if (zone !== 'GREEN'){
      say('🎯 ตอนนี้หลุด GREEN แล้ว — ยิง 💧 กลับเข้า GREEN เพื่อสะสม Stage1', 'zone_recover', 'info', 'recover_green');
      return;
    }

    // Stage1 coaching
    if (fatigue < 0.55 && S.emaSkill < 0.45){
      say('🎯 เล็งนิ่งก่อนยิง 0.2 วิ จะช่วย Accuracy สูงขึ้นแบบรู้สึกได้', 'aim', 'info', 'aim_hold');
      return;
    }

    if (S.emaFrustration > 0.65){
      say('🧠 ถ้าเริ่มพลาดติด ๆ: ช้าลงนิดหนึ่ง แล้วเลือกยิงเฉพาะเป้าที่ใกล้กลางจอ', 'calm', 'warn', 'calm_down');
      return;
    }

    if (shield <= 0 && fatigue < 0.70){
      // gentle reminder to prep
      say('🛡️ ทิป: เก็บ 🛡️ เผื่อพายุไว้ก่อน จะผ่าน Stage2 ง่ายขึ้น', 'prep', 'info', 'prep_shield');
      return;
    }
  }

  function onEnd(summary={}){
    if (isResearch()) return;
    const g = String(summary.grade || '');
    const sOk = (summary.stormSuccess|0);
    const stage = (summary.stageCleared|0);

    let msg = `จบแล้ว! เกรด ${g || '—'} 🎉`;
    if (stage < 1) msg += '\nทริค: โฟกัสคุม GREEN ให้ผ่าน Stage1 ก่อน';
    else if (stage < 2) msg += '\nทริค: Stage2 ต้องทำ LOW/HIGH + BLOCK ช่วง End Window';
    else if (stage < 3) msg += '\nทริค: รอ Boss Window แล้ว BLOCK 🌩️ ให้ครบ';
    else msg += `\nสุดยอด! ผ่านครบ 3 Stage (${sOk} mini สำเร็จ)`;

    emit('hha:coach', { type:'end', game, text: msg, summary });
  }

  return { onStart, onUpdate, onEnd };
}