// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach (template-based, safe, no spam)
// Emits: hha:coach { game, text, sub, mood }
// ✅ Rate-limit + no-repeat key
// ✅ Hydration-ready: Storm + EndWindow + Shield tips + Zone/Pressure tips
// ✅ Supports "boss window" hint (optional flag)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = (opts.emit || function(){});
  const game = String(opts.game || 'hydration');
  const cooldownMs = clamp(opts.cooldownMs ?? 3500, 1200, 12000);

  let lastSayAt = 0;
  let lastKey = '';
  let lastStormState = false;
  let lastEndWindow = false;
  let lastZone = '';
  let lastShield = -1;

  function say(key, text, sub='', mood='neutral'){
    const t = performance.now();
    if (t - lastSayAt < cooldownMs) return;
    if (key && key === lastKey) return;
    lastSayAt = t; lastKey = key;
    emit('hha:coach', { game, text, sub, mood });
  }

  function onStart(){
    say(
      'start',
      'เริ่มเลย! โฟกัส “คุมน้ำให้เข้า GREEN” ก่อนนะ 💧',
      'Tip: อย่ารัว — เล็ง 0.3 วิ แล้วค่อยยิง จะคุมโซนง่ายขึ้น',
      'happy'
    );
  }

  function onUpdate(ctx){
    // ctx (recommended): {
    //   skill, fatigue, frustration,
    //   inStorm, inEndWindow,
    //   waterZone, shield, misses, combo,
    //   bossActive? (optional)
    // }

    const f  = clamp(ctx.fatigue,0,1);
    const fr = clamp(ctx.frustration,0,1);
    const zone = String(ctx.waterZone || '');
    const shield = (ctx.shield|0);
    const combo = (ctx.combo|0);

    // -------- Storm transitions (enter/exit) --------
    if (!!ctx.inStorm && !lastStormState){
      // entered storm
      if (shield <= 0){
        say('storm_enter_no_shield', 'STORM มาแล้ว! แต่ยังไม่มีโล่ 🛡️', 'รอบหน้าเก็บ 🛡️ ก่อนพายุจะปลอดภัยขึ้น', 'sad');
      } else {
        say('storm_enter', 'STORM มาแล้ว! เตรียมทำ Mini 🎯', 'ขั้นตอน: ทำให้น้ำเป็น LOW/HIGH → รอท้ายพายุค่อย BLOCK', 'neutral');
      }
      lastStormState = true;
    }
    if (!ctx.inStorm && lastStormState){
      // exited storm
      say('storm_exit', 'พายุจบแล้ว ✅', 'กลับไปคุม GREEN ต่อเพื่อผ่าน Goal', 'happy');
      lastStormState = false;
      lastEndWindow = false;
    }

    // -------- End window guidance --------
    if (ctx.inStorm && ctx.inEndWindow && !lastEndWindow){
      // just entered end window
      if (shield <= 0){
        say('end_enter_no_shield', 'ท้ายพายุแล้ว! ไม่มีโล่ ระวังโดน BAD 🔥', 'ทริค: เก็บ 🛡️ ไว้ใช้ “ท้ายพายุ” เท่านั้น', 'sad');
      } else {
        say('end_enter', 'ท้ายพายุแล้ว! “เล็งแล้วค่อย BLOCK” 🛡️', 'ถ้าตอนนี้น้ำเป็น LOW/HIGH จะได้ PERFECT', 'happy');
      }
      lastEndWindow = true;
    }
    if (ctx.inStorm && !ctx.inEndWindow && lastEndWindow){
      lastEndWindow = false;
    }

    // -------- Boss window hint (optional) --------
    if (ctx.inStorm && ctx.inEndWindow && ctx.bossActive){
      // don't spam; let cooldown handle
      if (shield > 0) {
        say('boss_hint', 'มี BOSS 🌩️ โผล่ท้ายพายุ!', 'เป้าหมาย: BLOCK ให้ครบ (เช่น 2 ครั้ง) จะได้โบนัส', 'neutral');
      }
    }

    // -------- Zone coaching (only when not in end-window) --------
    // Encourage leaving GREEN during storm (mini requirement)
    if (ctx.inStorm && !ctx.inEndWindow){
      if (zone === 'GREEN'){
        say('storm_need_leave_green', 'ตอน STORM อย่าอยู่ GREEN นะ!', 'ทำให้น้ำเป็น LOW/HIGH สักพักเพื่อผ่าน Mini', 'neutral');
      }
      // if already low/high, praise
      if (zone && zone !== 'GREEN'){
        // avoid repeating too often
        if (zone !== lastZone){
          say('storm_zone_ok', `ดี! ตอนนี้น้ำเป็น ${zone} ✅`, 'รักษาไว้ แล้วรอท้ายพายุค่อย BLOCK', 'happy');
        }
      }
    } else {
      // outside storm: prefer GREEN
      if (zone && zone !== 'GREEN' && lastZone !== zone){
        say('outside_need_green', `ตอนนี้น้ำเป็น ${zone} นะ 💧`, 'นอกพายุพยายามกลับเข้า GREEN เพื่อผ่าน Goal', 'neutral');
      }
      if (zone === 'GREEN' && lastZone !== 'GREEN'){
        say('back_green', 'กลับเข้า GREEN แล้ว ✅', 'สะสมเวลา GREEN ให้ครบ Goal!', 'happy');
      }
    }

    lastZone = zone;

    // -------- Shield awareness --------
    if (shield !== lastShield){
      if (ctx.inStorm && shield <= 0){
        say('shield_empty_storm', 'โล่หมดแล้ว 🛡️', 'ถ้าเจอ BAD ให้หลบ/อย่าเสี่ยงรัว', 'sad');
      }
      if (!ctx.inStorm && shield >= 2 && lastShield < 2){
        say('shield_ready', 'โล่พร้อมแล้ว 🛡️✅', 'เก็บไว้ “ท้ายพายุ” จะผ่าน Mini ง่ายมาก', 'happy');
      }
      lastShield = shield;
    }

    // -------- Frustration / fatigue regulation --------
    if (!ctx.inStorm && fr > 0.62){
      say('frustrated', 'ช้า ๆ แต่ชัวร์นะ 🎯', 'หยุดรัว 1 วิ แล้วคุมจังหวะยิง', 'neutral');
      return;
    }

    if (f > 0.70){
      say('fatigue', 'พักสายตาแป๊บ แล้วค่อยลุยต่อได้ 👀', 'ถ้าเมื่อย: ลดการรัว แล้วเล่นแบบคุมจังหวะ', 'neutral');
      return;
    }

    // -------- Combo hype --------
    if (combo >= 6){
      say('combo', 'คอมโบสวยมาก! ต่ออีกนิด ⚡', 'ทริค: เลือกยิงเป้าที่ชัวร์ก่อน', 'happy');
      return;
    }
  }

  function onEnd(sum){
    const g = String(sum.grade||'C');
    const acc = Number(sum.accuracyGoodPct||0);
    const storms = Number(sum.stormCycles||0);
    const ok = Number(sum.stormSuccess||0);

    if (g === 'SSS' || g === 'SS'){
      say(
        'end_top',
        `สุดยอด! เกรด ${g} 🏆`,
        `Accuracy ${acc.toFixed(1)}% • Mini ${ok}/${storms} • รอบหน้าลอง diff harder ได้`,
        'happy'
      );
    } else if (g === 'S' || g === 'A'){
      let focus = 'คุม GREEN ให้เสถียร';
      if (storms > 0 && ok <= 0) focus = 'Mini: ทำ LOW/HIGH แล้ว BLOCK ช่วงท้ายพายุ';
      else if (acc < 82) focus = 'เพิ่ม Accuracy ด้วยการเล็งก่อนยิง';
      say(
        'end_good',
        `ดีมาก! เกรด ${g} ✅`,
        `จุดโฟกัสรอบหน้า: ${focus}`,
        'happy'
      );
    } else {
      say(
        'end_train',
        `รอบนี้เกรด ${g} ยังไหว! ซ้อมอีกนิด 💪`,
        `โฟกัส: อย่ารัว • คุม GREEN ก่อน • เก็บ 🛡️ ไว้ท้ายพายุ`,
        'neutral'
      );
    }
  }

  return { onStart, onUpdate, onEnd };
}