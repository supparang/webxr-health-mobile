// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (UPDATED)
// ✅ Export: createAICoach({ emit, game, cooldownMs, enabled })
// ✅ Explainable micro-tips + rate-limit
// ✅ Auto-disable in research unless forced (?ai=1)
// ✅ No dependencies, safe in missing DOM env

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 3000, 600, 20000);

  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const aiParam = String(qs('ai', '')); // '0' disable, '1' force enable
  const enabledDefault = (run !== 'research');
  const enabled =
    (aiParam === '0') ? false :
    (aiParam === '1') ? true :
    (opts.enabled === false ? false : enabledDefault);

  const S = {
    enabled,
    started:false,
    lastSayAt:0,
    lastType:'',
    lastTipKey:'',
    streakSame:0
  };

  function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

  function say(type, text, meta={}){
    if (!S.enabled) return;
    const t = now();
    if (t - S.lastSayAt < cooldownMs) return;

    // กัน spam ประโยคเดิม
    const key = type + '|' + String(text||'');
    if (key === S.lastTipKey){
      S.streakSame++;
      if (S.streakSame >= 2) return;
    } else {
      S.streakSame = 0;
    }

    S.lastSayAt = t;
    S.lastType = type;
    S.lastTipKey = key;

    emit('hha:coach', Object.assign({
      game,
      type,
      text: String(text||'')
    }, meta || {}));
  }

  function explainableTip(ctx){
    // ctx: { skill,fatigue,frustration,inStorm,inEndWindow,waterZone,shield,misses,combo }
    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const fatigue = clamp(ctx.fatigue ?? 0, 0, 1);
    const frustration = clamp(ctx.frustration ?? 0, 0, 1);

    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone||'GREEN').toUpperCase();
    const shield = ctx.shield|0;
    const misses = ctx.misses|0;
    const combo = ctx.combo|0;

    // Priority: EndWindow / Storm / Zone / Miss / Combo
    if (inStorm && inEnd){
      if (shield <= 0) return { type:'urgent', text:'⚠️ End Window มาแล้ว! เก็บ 🛡️ ก่อน แล้วค่อย BLOCK ช่วงท้าย (ไม่งั้นหลุด Mini ง่าย)', why:'endwindow_no_shield' };
      return { type:'urgent', text:`⏳ End Window! ตอนนี้ “BLOCK” ให้ได้ — ใช้ 🛡️ กัน 🌩️ / 🥤 ช่วงท้าย`, why:'endwindow_block' };
    }

    if (inStorm){
      if (zone === 'GREEN') return { type:'storm', text:'🌀 ช่วงพายุอย่าอยู่ GREEN! ดันไป LOW/HIGH แล้วคุมไว้ เพื่อผ่าน Mini', why:'storm_need_non_green' };
      if (shield <= 0) return { type:'storm', text:'🛡️ ช่วงพายุ: เก็บโล่ไว้ 1–2 อัน แล้วค่อย BLOCK ตอนท้าย', why:'storm_collect_shield' };
      return { type:'storm', text:'🌀 ดีมาก! คุม LOW/HIGH ต่อ แล้วรอ End Window เพื่อ BLOCK ให้ผ่าน Mini', why:'storm_ok_wait_end' };
    }

    if (zone !== 'GREEN'){
      if (skill < 0.55) return { type:'zone', text:'💧 ตอนนี้ไม่ GREEN — เล็งช้าลงนิด แล้วค่อยยิง 💧 เพื่อดันกลับเข้า GREEN', why:'zone_recover_slow' };
      return { type:'zone', text:'💧 รีบกลับ GREEN: ยิง 💧 ต่อเนื่อง 2–3 ครั้ง จะกลับเข้าช่วงปลอดภัย', why:'zone_recover_fast' };
    }

    if (misses >= 15 && frustration > 0.6){
      return { type:'calm', text:'🧠 ใจเย็น ๆ ลดการรัว เลือกยิงเป้าที่ชัวร์ก่อน MISS จะลดเอง', why:'high_miss' };
    }

    if (combo >= 12) return { type:'praise', text:'🔥 คอมโบสวยมาก! รักษาจังหวะเดิม เกรดจะไต่เร็ว', why:'combo_high' };

    if (fatigue > 0.75) return { type:'rest', text:'😮‍💨 ใกล้จบแล้ว! โฟกัสเป้าที่ใหญ่/ใกล้กลางจอ จะคุมคะแนนง่ายขึ้น', why:'fatigue' };

    // default nudge
    return { type:'hint', text:'🎯 ทิป: เล็งให้ “นิ่ง” ครึ่งจังหวะก่อนยิง จะได้ Accuracy สูงขึ้น', why:'default' };
  }

  return {
    isEnabled(){ return !!S.enabled; },
    onStart(){
      S.started = true;
      if (!S.enabled) return;
      say('hello', '👋 พร้อมลุย! เป้าหมายคือคุม Water ให้อยู่ GREEN แล้วค่อยผ่านพายุ + เคลียร์บอส');
    },
    onUpdate(ctx){
      if (!S.enabled || !S.started) return;
      const tip = explainableTip(ctx||{});
      // กันพูดถี่เกิน และกันพูดเรื่องเดิมซ้ำ
      say(tip.type, tip.text, { why: tip.why });
    },
    onEnd(summary){
      if (!S.enabled) return;
      const g = String(summary?.grade || 'C');
      const acc = Number(summary?.accuracyGoodPct || 0);
      const miss = Number(summary?.misses || 0);
      if (g === 'SSS' || g === 'SS') say('end', `🏁 จบเกม! เก่งมาก เกรด ${g} (Acc ${acc.toFixed(0)}%, Miss ${miss})`);
      else if (g === 'S' || g === 'A') say('end', `🏁 จบเกม! เกรด ${g} ดีมาก! รอบหน้าลองลด MISS จะขึ้น SS ได้เลย`);
      else say('end', `🏁 จบเกม! เกรด ${g} ไม่เป็นไร รอบหน้าลอง “เล็งนิ่งขึ้น” กับ “เก็บโล่ก่อนพายุ”`);
    }
  };
}