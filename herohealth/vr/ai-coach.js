// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Lightweight, Explainable, Rate-limited)
// ✅ Export: createAICoach({ emit, game, cooldownMs })
// ✅ Default: auto-disable in research mode (?run=research / ?runMode=research)
// ✅ Emits: 'hha:coach' { type:'tip'|'praise'|'warn'|'stage'|'end', text, tag, severity }

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
}
function nowMs(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 2800, 800, 12000);

  const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const disableInResearch = (opts.disableInResearch ?? true);
  const enabled = !(disableInResearch && run === 'research');

  const S = {
    enabled,
    lastSayAt: 0,
    lastTag: '',
    lastStateAt: 0,
    // trackers
    emaSkill: 0.45,
    emaFrust: 0.30,
    emaAcc: 0.70,
    missSnap: 0,
    comboSnap: 0,
    lastWaterZone: '',
    waterZoneStreak: 0,
    stormSnap: false,
    endSnap: false,
  };

  function say(type, text, tag='', severity='info'){
    if (!S.enabled) return;
    const t = nowMs();
    if (t - S.lastSayAt < cooldownMs) return;
    if (tag && tag === S.lastTag) return;

    S.lastSayAt = t;
    S.lastTag = tag || '';

    try{
      emit('hha:coach', { type, text, tag, severity, game });
    }catch(_){}
  }

  function explainableTip(tag, text){ say('tip', text, tag, 'info'); }
  function warn(tag, text){ say('warn', text, tag, 'warn'); }
  function praise(tag, text){ say('praise', text, tag, 'good'); }

  function onStart(){
    if (!S.enabled) return;
    praise('start', 'เริ่มเลย! 🎯 ยิง 💧 เพื่อคุมให้อยู่ GREEN แล้วเก็บ 🛡️ ไว้กันพายุ');
  }

  function onUpdate(ctx={}){
    if (!S.enabled) return;

    // pull signals
    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const fr = clamp(ctx.frustration ?? 0.3, 0, 1);
    const inStorm = !!ctx.inStorm;
    const inEndWindow = !!ctx.inEndWindow;
    const waterZone = String(ctx.waterZone || '');
    const shield = (ctx.shield|0);
    const misses = (ctx.misses|0);
    const combo = (ctx.combo|0);

    // smooth
    S.emaSkill = S.emaSkill*0.92 + skill*0.08;
    S.emaFrust = S.emaFrust*0.90 + fr*0.10;

    // water zone streak
    if (waterZone && waterZone === S.lastWaterZone) S.waterZoneStreak++;
    else { S.lastWaterZone = waterZone; S.waterZoneStreak = 0; }

    // storm transitions
    if (inStorm && !S.stormSnap){
      S.stormSnap = true;
      explainableTip('storm_enter', '🌀 พายุมา! ตอนนี้ “ต้องทำ LOW/HIGH + BLOCK ช่วงท้าย” (อย่าโดน BAD)');
    }
    if (!inStorm && S.stormSnap){
      S.stormSnap = false;
      S.endSnap = false;
    }

    // end window transitions
    if (inStorm && inEndWindow && !S.endSnap){
      S.endSnap = true;
      if (shield<=0) warn('need_shield', '⏱️ End Window แล้ว แต่ไม่มี 🛡️ — รีบเก็บ 🛡️ ก่อน แล้วค่อย BLOCK!');
      else explainableTip('endwindow', `⏱️ End Window! ใช้ 🛡️ BLOCK ให้ผ่าน Mini (${shield} อันอยู่)`);
    }

    // too many misses spike
    const dMiss = misses - S.missSnap;
    S.missSnap = misses;
    if (dMiss >= 4){
      warn('miss_spike', '💥 MISS รัว ๆ อยู่! ลดการรัวก่อน เล็งค้าง 0.2 วิแล้วค่อยยิง');
    }

    // combo praise
    if (combo >= 8 && combo > S.comboSnap){
      praise('combo', `🔥 คอมโบ ${combo}! ดีมาก — รักษาจังหวะเดิมไว้`);
    }
    S.comboSnap = combo;

    // water management tips
    if (!inStorm){
      if (waterZone === 'LOW' && S.waterZoneStreak >= 80){
        explainableTip('low_fix', '💧 ตอนนี้ LOW นานไป — ยิง 💧 ต่อเนื่อง 2–3 ครั้งให้กลับเข้า GREEN');
      }
      if (waterZone === 'HIGH' && S.waterZoneStreak >= 80){
        explainableTip('high_fix', '🥤 ตอนนี้ HIGH นานไป — หลีก BAD แล้วค่อยยิง 💧 ทีละเป้าให้กลับ GREEN');
      }
    } else {
      // in storm: need LOW/HIGH + BLOCK
      if (waterZone === 'GREEN'){
        explainableTip('storm_need_zone', '🌀 ตอนพายุ “ต้องออกจาก GREEN” ให้เป็น LOW หรือ HIGH ก่อน แล้วค่อยรอ BLOCK ช่วงท้าย');
      }
      if (inEndWindow && shield>0){
        explainableTip('storm_block', '🛡️ ให้ BLOCK ตอนท้ายพายุ (End Window) เท่านั้น ถึงจะนับผ่าน!');
      }
    }

    // frustration high
    if (S.emaFrust >= 0.75){
      warn('frust', 'ใจเย็น ๆ 😄 โฟกัส “ยิงที่ชัวร์” 3 เป้าติด แล้วค่อยเร่งสปีด');
    }
  }

  function onEnd(summary={}){
    if (!S.enabled) return;
    const g = String(summary.grade || '');
    if (g==='SSS' || g==='SS') praise('end_good', `จบเกมแล้ว! เกรด ${g} สวยมาก 🏆`);
    else explainableTip('end', `จบเกมแล้ว! รอบหน้าโฟกัส “คุม GREEN + ผ่านพายุ 1 ครั้ง” แล้วเกรดจะเด้งทันที`);
    try{ emit('hha:coach', { type:'end', text:'จบแล้ว!', game, summary }); }catch(_){}
  }

  return { onStart, onUpdate, onEnd, say };
}