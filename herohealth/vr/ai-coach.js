// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (lightweight, explainable, rate-limited)
// ✅ Export: createAICoach({ emit, game, cooldownMs, enabled })
// ✅ Emits: 'hha:coach' with {type:'tip'|'praise'|'warn'|'end', text, tag, game}
// ✅ Auto-disable on run=research unless explicitly enabled

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function qs(name, def=''){
  try{ return new URL(location.href).searchParams.get(name) ?? def; }
  catch{ return def; }
}

function nowMs(){ return (typeof performance!=='undefined' && performance.now)? performance.now() : Date.now(); }

export function createAICoach(opts){
  const emit = (opts && typeof opts.emit==='function') ? opts.emit : ()=>{};
  const game = String((opts && opts.game) || 'game');
  const cooldownMs = Math.max(900, Number((opts && opts.cooldownMs) || 2600));

  // auto disable in research
  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const autoEnabled = (run !== 'research');
  const enabled = (opts && typeof opts.enabled === 'boolean') ? opts.enabled : autoEnabled;

  const S = {
    enabled,
    started:false,
    lastSayAt:0,
    lastTag:'',
    // rolling state
    emaSkill:0.45,
    emaFrust:0.22,
    emaFat:0.10,
    lastCombo:0,
    lastMiss:0,
    lastZone:'GREEN',
    lastStorm:false,
    lastEnd:false
  };

  function canSay(tag){
    const t = nowMs();
    if (!S.enabled) return false;
    if (t - S.lastSayAt < cooldownMs) return false;
    if (tag && tag === S.lastTag && (t - S.lastSayAt) < cooldownMs*1.4) return false;
    return true;
  }

  function say(type, text, tag){
    if (!canSay(tag)) return;
    S.lastSayAt = nowMs();
    S.lastTag = tag || '';
    emit('hha:coach', { type, text, tag: tag||'', game });
  }

  // explainable micro tips (hydration-focused)
  function hydrationTips(ctx){
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone||'GREEN');
    const shield = Number(ctx.shield||0);
    const misses = Number(ctx.misses||0);
    const combo = Number(ctx.combo||0);

    if (inStorm && inEnd && shield<=0){
      return { type:'warn', tag:'storm_no_shield', text:'End Window มาแล้ว! รีบเก็บ 🛡️ ก่อน แล้วค่อย BLOCK ช่วงท้ายพายุ' };
    }
    if (inStorm && zone==='GREEN'){
      return { type:'tip', tag:'storm_need_lowhigh', text:'ตอนพายุ: ต้องทำ LOW/HIGH ให้ได้ก่อน แล้วค่อย BLOCK ช่วงท้าย (End Window)' };
    }
    if (zone!=='GREEN' && !inStorm){
      return { type:'tip', tag:'back_to_green', text:'ตอนปกติ: ยิง 💧 เพื่อดันกลับเข้า GREEN ให้เร็ว แล้วคอมโบจะลื่นขึ้น' };
    }
    if (misses>=12 && combo<=2){
      return { type:'tip', tag:'slow_down', text:'MISS เยอะ: ลดการรัว เล็งค้างนิดนึงแล้วยิงทีละเป้า จะคุม GREEN ง่ายขึ้น' };
    }
    if (combo>=10 && !inStorm){
      return { type:'praise', tag:'combo', text:'คอมโบสวยมาก! รักษาจังหวะเดิมไว้ แล้วคะแนนจะพุ่งเอง' };
    }
    if (inStorm && shield>0 && inEnd){
      return { type:'tip', tag:'block_now', text:'มี 🛡️ แล้ว! รอ End Window แล้ว BLOCK ให้ติด จะผ่าน Mini ง่ายขึ้น' };
    }
    return null;
  }

  function genericTips(ctx){
    const misses = Number(ctx.misses||0);
    const combo = Number(ctx.combo||0);
    if (misses>=18 && combo<=1) return { type:'tip', tag:'steady', text:'ช้าลงนิดนึง แล้วเลือกยิงเป้าที่ชัวร์ก่อน' };
    if (combo>=12) return { type:'praise', tag:'combo', text:'คอมโบยาวมาก! เก่ง!' };
    return null;
  }

  return {
    onStart(){
      if (!S.enabled) return;
      S.started = true;
      say('tip', 'พร้อมแล้ว! โฟกัส “คุม GREEN” ก่อน แล้วค่อยลุยพายุ + บอส', 'start');
    },

    onUpdate(ctx){
      if (!S.enabled || !S.started) return;
      ctx = ctx || {};

      // EMA for stability
      const skill = clamp(ctx.skill ?? 0.45, 0, 1);
      const fr = clamp(ctx.frustration ?? 0.2, 0, 1);
      const fat = clamp(ctx.fatigue ?? 0.1, 0, 1);

      S.emaSkill = S.emaSkill*0.86 + skill*0.14;
      S.emaFrust = S.emaFrust*0.86 + fr*0.14;
      S.emaFat   = S.emaFat*0.90 + fat*0.10;

      const combo = Number(ctx.combo||0);
      const misses = Number(ctx.misses||0);
      const zone = String(ctx.waterZone||S.lastZone);
      const inStorm = !!ctx.inStorm;
      const inEnd = !!ctx.inEndWindow;

      // event-ish triggers
      if (combo >= 10 && S.lastCombo < 10){
        say('praise', 'คอมโบแตะ 10 แล้ว! รักษาจังหวะเดิมไว้', 'combo10');
      }
      if (misses >= 10 && S.lastMiss < 10){
        say('tip', 'เริ่ม MISS เยอะแล้วนะ ลดการรัว แล้วเล็งค้างก่อนยิง', 'miss10');
      }
      if (inStorm && !S.lastStorm){
        say('warn', 'พายุมาแล้ว! ทำ LOW/HIGH ก่อน แล้วรอ End Window ค่อย BLOCK', 'storm_enter');
      }
      if (inEnd && !S.lastEnd){
        say('warn', 'End Window! ตอนนี้ต้อง BLOCK ให้ติด!', 'end_window');
      }
      if (zone !== 'GREEN' && S.lastZone === 'GREEN' && !inStorm){
        say('tip', 'หลุด GREEN แล้วนะ รีบยิง 💧 กลับเข้า GREEN', 'lost_green');
      }

      // context tips (rate-limited)
      const tip = (game==='hydration') ? hydrationTips(ctx) : genericTips(ctx);
      if (tip){
        say(tip.type, tip.text, tip.tag);
      }

      S.lastCombo = combo;
      S.lastMiss = misses;
      S.lastZone = zone;
      S.lastStorm = inStorm;
      S.lastEnd = inEnd;
    },

    onEnd(summary){
      if (!S.enabled) return;
      const g = String((summary && summary.grade) || '');
      const stormOk = Number((summary && summary.stormSuccess) || 0);
      const boss = Number((summary && summary.bossClearCount) || 0);

      if (boss>0) say('end', 'สุดยอด! เคลียร์บอสได้แล้ว 🔥', 'end_boss');
      else if (stormOk>0) say('end', 'ผ่านพายุแล้ว! รอบหน้าลองลุยบอสช่วงท้ายพายุนะ', 'end_storm');
      else if (g==='A' || g==='S' || g==='SS') say('end', 'ดีมาก! อีกนิดเดียวจะผ่านพายุแล้ว', 'end_good');
      else say('end', 'รอบหน้าลองโฟกัสคุม GREEN ก่อน แล้วค่อยทำ Mini ช่วงพายุ', 'end_try');
    }
  };
}