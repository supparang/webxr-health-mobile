// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (ESM)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart() / onUpdate(ctx) / onEnd(summary)
// ✅ Explainable micro-tips + rate-limit
// ✅ ไม่ฝืนเกม (ถ้า emit ไม่มี ก็เงียบ)
// ✅ โหมดวิจัย: ไม่สุ่มหนัก (ใช้กฎ deterministic จาก ctx)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function safeEmit(emitFn, name, detail){
  try{
    if (typeof emitFn === 'function') emitFn(name, detail);
    else if (ROOT && ROOT.dispatchEvent) ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  }catch(_){}
}

function pickOneDeterministic(list, key){
  if (!list || !list.length) return null;
  const s = String(key ?? '');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
  const idx = (h>>>0) % list.length;
  return list[idx];
}

export function createAICoach(opts={}){
  const emitFn = opts.emit;
  const game = String(opts.game || 'game');
  const cooldownMs = Math.max(800, Number(opts.cooldownMs || 2800));

  const S = {
    started:false,
    lastMsgAt:0,
    lastKey:'',
    nTips:0
  };

  function say(key, title, msg, level='tip'){
    const now = performance.now();
    if (now - S.lastMsgAt < cooldownMs) return;
    if (key && key === S.lastKey) return;

    S.lastMsgAt = now;
    S.lastKey = key || '';
    S.nTips++;

    safeEmit(emitFn, 'hha:coach', {
      game,
      level,               // 'tip' | 'warn' | 'hype'
      title: title || 'Coach',
      message: msg || '',
      key: S.lastKey,
      n: S.nTips,
      t: Date.now()
    });
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    say('start', 'Coach', 'พร้อมลุย! โฟกัสคุม GREEN ก่อน แล้วค่อยลุย STORM + BOSS 🔥', 'hype');
  }

  function onUpdate(ctx={}){
    // ctx ที่ Hydration.safe.js ส่งมา:
    // { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo }
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone || '');
    const shield = Number(ctx.shield||0)|0;
    const misses = Number(ctx.misses||0)|0;
    const combo = Number(ctx.combo||0)|0;
    const skill = clamp(ctx.skill, 0, 1);
    const fatigue = clamp(ctx.fatigue, 0, 1);
    const frustration = clamp(ctx.frustration, 0, 1);

    // 1) ช่วงพายุ End Window = โอกาสทอง
    if (inStorm && inEnd){
      if (shield <= 0){
        say('end_no_shield', 'Storm!', 'End Window มาแล้ว! แต่ไม่มี 🛡️ — รอบหน้าตุน 🛡️ ไว้ก่อนพายุ', 'warn');
      } else if (zone === 'GREEN'){
        say('end_green', 'Storm!', 'ตอนพายุอย่าอยู่ GREEN — ยิง 💧/🥤 ให้หลุดเป็น LOW/HIGH แล้วค่อย BLOCK ช่วงท้าย', 'tip');
      } else {
        say('end_block', 'Storm!', `ตอนนี้แหละ! BLOCK 🥤/🌩️ ด้วย 🛡️ ให้เข้าเป้า (Shield=${shield})`, 'hype');
      }
      return;
    }

    // 2) พายุแต่ยังไม่ท้าย — เตือนเงื่อนไข mini
    if (inStorm && !inEnd){
      if (zone === 'GREEN'){
        say('storm_need_zone', 'Storm!', 'Mini ต้อง “ไม่ GREEN” ก่อนนะ → ทำให้น้ำเป็น LOW/HIGH แล้วค่อยรอ End Window', 'tip');
      } else if (shield <= 0){
        say('storm_need_shield', 'Storm!', 'พายุมาแล้ว! รีบเก็บ 🛡️ ก่อน แล้วเตรียม BLOCK ตอนท้าย', 'warn');
      } else if (combo >= 10 && skill >= 0.55){
        say('storm_combo', 'Storm!', 'คอมโบกำลังดี! อย่ารัวเกิน—เลือกยิงที่ชัวร์ แล้วเก็บ 🛡️ รอท้ายพายุ', 'tip');
      }
      return;
    }

    // 3) นอกพายุ — คุม GREEN + ตุนโล่
    if (!inStorm){
      if (zone !== 'GREEN'){
        say('back_to_green', 'Water', 'กลับเข้า GREEN ก่อนนะ! ยิง 💧 ช่วยดึงสมดุลให้กลับมาช่วงกลาง', 'tip');
      } else if (shield <= 0 && fatigue < 0.85){
        say('farm_shield', 'Prep', 'อยู่ GREEN แล้ว—ตุน 🛡️ ไว้ 1–2 อันก่อนพายุ จะผ่าน Mini ง่ายขึ้น', 'tip');
      }
    }

    // 4) ถ้า MISS เยอะ → ช่วยปรับพฤติกรรม
    if (misses >= 12 && frustration >= 0.55){
      const msg = (combo > 6)
        ? 'MISS เริ่มสูง—ชะลอจังหวะนิดนึง รักษาคอมโบ แล้วค่อยยิงทีละเป้า'
        : 'MISS เยอะ—เล็งค้างนิดนึงก่อนยิง ลดการแตะรัว ๆ';
      say('miss_control', 'Focus', msg, 'warn');
      return;
    }

    // 5) ยกย่องเวลาทำดี (แต่ไม่สแปม)
    if (combo >= 16 && skill >= 0.65){
      say('combo_hype', 'Nice!', 'คอมโบโหดมาก! ถ้ารักษาแบบนี้ เกรด S/SS มาแน่ ⚡', 'hype');
      return;
    }

    // 6) ช่วงท้ายเกมให้กำลังใจ
    if (fatigue >= 0.88 && misses < 10){
      say('end_push', 'Final', 'ท้ายเกมแล้ว! รักษาความนิ่งอีกนิด เก็บแต้มปิดสวย ๆ 💪', 'hype');
      return;
    }
  }

  function onEnd(summary={}){
    // สรุปสั้น ๆ แบบ deterministic (ไม่สุ่มพร่ำเพรื่อ)
    const grade = String(summary.grade || 'C');
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const storms = Number(summary.stormSuccess || 0);

    const lines = [];
    lines.push(`เกรด ${grade} | Acc ${acc.toFixed(1)}% | Miss ${miss}`);
    if (storms <= 0) lines.push('โฟกัสผ่าน Storm Mini 1 ครั้งก่อน แล้วเกรดจะพุ่งทันที');
    else lines.push('ทำ Storm Mini ได้แล้ว—ต่อไปโฟกัส Boss Window ให้เคลียร์');

    const msg = lines.join('\n');
    // key ทำให้คงที่ (วิจัย friendly)
    const key = `end_${grade}_${(storms|0)}_${(miss|0)}`;
    say(key, 'Summary', msg, 'tip');
  }

  return { onStart, onUpdate, onEnd };
}