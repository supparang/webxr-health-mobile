// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (HHA Standard friendly)
// ✅ Explainable micro-tips (rate-limited)
// ✅ Stage-aware: GREEN -> STORM Mini -> BOSS
// ✅ Event-driven: emits hha:coach {text, tone, tag}
// ✅ Research-friendly: can mute in research mode (optional)
// ✅ Lightweight: no DOM dependency

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = String(opts.game || 'game').toLowerCase();

  // cooldown default: 3s (คุณตั้งไว้ 3000 ใน hydration.safe.js)
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 600, 15000);
  const runMode = String(opts.runMode || '').toLowerCase();
  const muteResearch = !!opts.muteResearch; // ถ้าอยากบังคับเงียบใน research

  const S = {
    started:false,
    ended:false,
    t0:0,
    lastSpeakAt:0,
    lastKeyAt: Object.create(null),

    // state memory
    lastStage: 1,
    lastZone: '',
    lastInStorm:false,
    lastInEnd:false,
    lastBoss:false,

    // streak guards
    missSpike:0,
    lastMissCount:0,

    // gentle pacing
    hypeLevel:0, // 0..1
  };

  function now(){ return (typeof performance!=='undefined' ? performance.now() : Date.now()); }

  function canSpeak(key, extraGapMs=0){
    const t = now();
    if (!S.started || S.ended) return false;

    // mute in research if requested
    if (muteResearch && runMode === 'research') return false;

    // global cooldown
    if (t - S.lastSpeakAt < cooldownMs + extraGapMs) return false;

    // per-key cooldown
    const last = S.lastKeyAt[key] || 0;
    const perKey = 7000; // กันคำซ้ำบ่อย
    if (t - last < perKey) return false;

    return true;
  }

  function say(text, tone='info', tag='tip', key='generic', extraGapMs=0){
    if (!canSpeak(key, extraGapMs)) return false;
    const t = now();
    S.lastSpeakAt = t;
    S.lastKeyAt[key] = t;

    emit('hha:coach', { game, text, tone, tag, t: Date.now() });
    return true;
  }

  // Helper: pick one message from list (deterministic-ish: based on time bucket)
  function pick(list){
    if (!Array.isArray(list) || !list.length) return '';
    const idx = Math.floor((Date.now()/6000) % list.length);
    return list[idx];
  }

  // Public API ------------------------------------------------
  function onStart(meta={}){
    if (S.started) return;
    S.started = true;
    S.ended = false;
    S.t0 = now();
    S.lastSpeakAt = 0;
    S.lastKeyAt = Object.create(null);
    S.lastStage = 1;
    S.lastZone = '';
    S.lastInStorm = false;
    S.lastInEnd = false;
    S.lastBoss = false;
    S.missSpike = 0;
    S.lastMissCount = 0;
    S.hypeLevel = 0;

    // เปิดเกม: 1 ประโยคพอ (ไม่เยอะ)
    say(
      pick([
        'เริ่มเลย! เป้าหมายคือ “คุมสมดุลให้อยู่ GREEN” ก่อนนะ 💚',
        'ลุย! ยิง 💧 ให้คุมให้อยู่ GREEN แล้วค่อยไปลุยพายุ 🌀',
        'พร้อม! โฟกัส GREEN ก่อน แล้วเก็บ 🛡️ ไว้กันช่วงท้ายพายุ 😈'
      ]),
      'info','start','start', 0
    );
  }

  function onEnd(summary={}){
    if (S.ended) return;
    S.ended = true;

    // สรุปแบบ 1 บรรทัด
    const g = String(summary.grade || '').toUpperCase();
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const stage = Number(summary.stageCleared || 0);

    let text = 'จบเกม! ';
    if (stage >= 3) text += 'โหดมาก—ผ่านถึงบอสแล้ว 🌩️ ';
    else if (stage === 2) text += 'ดี! ผ่านพายุได้แล้ว 🌀 ';
    else if (stage === 1) text += 'โอเค! ต่อไปดันให้ผ่านพายุ 🌀 ';
    else text += 'ไม่เป็นไร รอบหน้าทำได้แน่ 💪 ';

    text += `เกรด ${g || 'C'} • แม่น ${acc.toFixed(0)}% • พลาด ${miss|0}`;

    emit('hha:coach', { game, text, tone:'end', tag:'end', t: Date.now() });
  }

  // Main loop input (จาก hydration.safe.js ส่งเข้ามาแล้ว)
  // {
  //   skill 0..1, fatigue 0..1, frustration 0..1,
  //   inStorm bool, inEndWindow bool, waterZone string,
  //   shield int, misses int, combo int, stage int(optional)
  // }
  function onUpdate(st={}){
    if (!S.started || S.ended) return;

    const skill = clamp(st.skill ?? 0.5, 0, 1);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);
    const frustration = clamp(st.frustration ?? 0, 0, 1);

    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const boss = !!st.inBoss || (!!st.inStorm && !!st.bossActive); // เผื่อเกมอื่นส่งมา
    const zone = String(st.waterZone || '').toUpperCase();
    const shield = (st.shield|0);
    const misses = (st.misses|0);
    const combo = (st.combo|0);
    const stage = (st.stage|0) || 0;

    // hype level: ทำให้คำพูด “มันส์ขึ้น” ตอนท้าย ๆ
    S.hypeLevel = clamp(0.55*skill + 0.45*fatigue, 0, 1);

    // ------------- Stage callouts -------------
    // ถ้า hydration ส่ง stage มา: ใช้ได้เลย
    if (stage && stage !== S.lastStage){
      S.lastStage = stage;
      if (stage === 1){
        say('Stage 1: อยู่ GREEN ให้ได้นาน ๆ นะ 💚', 'info','stage','stage1', 800);
      } else if (stage === 2){
        say('Stage 2 มาแล้ว! รอพายุ แล้วทำ Mini ให้ผ่าน 🌀', 'hype','stage','stage2', 800);
      } else if (stage === 3){
        say('Stage 3: บอสกำลังมา! เก็บ 🛡️ ไว้ BLOCK 🌩️', 'hype','stage','stage3', 900);
      }
    }

    // ------------- Zone guidance -------------
    if (zone && zone !== S.lastZone){
      S.lastZone = zone;
      if (!inStorm){
        // ตอนปกติ: อยากให้กลับ GREEN
        if (zone !== 'GREEN'){
          say(
            pick([
              'ตอนนี้ไม่ GREEN แล้วนะ—ค่อย ๆ ยิง 💧 ให้กลับเข้า GREEN 💚',
              'หลุด GREEN นิดนึง! ยิง 💧 เบา ๆ ให้กลับสมดุล 💚'
            ]),
            'info','zone','zoneBack', 900
          );
        }
      } else {
        // ตอนพายุ: ต้อง “ไม่ GREEN” เพื่อผ่าน mini (ตามกติกาคุณ)
        if (zone === 'GREEN'){
          say(
            pick([
              'อยู่พายุแล้ว! ตอนนี้ต้องทำให้ไม่ GREEN (LOW/HIGH) ก่อนนะ 🌀',
              'พายุมา! ต้องให้เป็น LOW/HIGH แล้วค่อยรอช่วงท้ายเพื่อ BLOCK 🛡️'
            ]),
            'warn','storm','stormNeedZone', 700
          );
        } else {
          // โซนโอเค
          say(
            pick([
              'ดี! ตอนนี้ LOW/HIGH แล้ว—รอ End Window แล้วค่อย BLOCK 🛡️',
              'โซนผ่านแล้ว! เตรียม BLOCK ตอนท้ายพายุ 🛡️'
            ]),
            'info','storm','stormZoneOK', 900
          );
        }
      }
    }

    // ------------- Storm transitions -------------
    if (inStorm && !S.lastInStorm){
      S.lastInStorm = true;
      say(
        pick([
          'พายุมาแล้ว! โฟกัส: LOW/HIGH แล้วรอช่วงท้าย 🌀',
          'เข้าสู่ STORM! เก็บ 🛡️ ถ้ามี แล้วเตรียม BLOCK ตอนท้าย 🛡️'
        ]),
        'hype','storm','stormEnter', 500
      );
    }
    if (!inStorm && S.lastInStorm){
      S.lastInStorm = false;
      // ออกพายุ: ไม่ต้องพูดถี่—คอมเมนต์สั้น ๆ
      say(
        pick([
          'พายุจบ! กลับไปคุม GREEN ต่อ 💚',
          'ผ่านพายุไปแล้ว! โฟกัส GREEN แล้วเตรียมพายุรอบหน้า 💚'
        ]),
        'info','storm','stormExit', 1200
      );
    }

    // ------------- End window (สุดมันส์) -------------
    if (inEnd && !S.lastInEnd){
      S.lastInEnd = true;

      if (shield <= 0){
        say(
          pick([
            'End Window มาแล้ว! แต่ไม่มี 🛡️ — ระวัง 🥤 มาก ๆ นะ!',
            'ช่วงท้ายพายุ! ไม่มีโล่แล้วนะ—เล่นชัวร์ ๆ อย่าโดน 🥤!'
          ]),
          'warn','end','endNoShield', 600
        );
      } else {
        say(
          pick([
            'End Window! ตอนนี้ BLOCK 🛡️ ให้ได้!',
            'จังหวะทอง! BLOCK 🛡️ ตอนนี้เลย!'
          ]),
          'hype','end','endBlockNow', 450
        );
      }
    }
    if (!inEnd && S.lastInEnd){
      S.lastInEnd = false;
    }

    // ------------- Boss cues (ถ้าเกมส่งสัญญาณ) -------------
    // Hydration ของคุณใช้ bossActive แต่ไม่ได้ส่งเข้ามาใน onUpdate (ตอนนี้)
    // เราเลยใช้ heuristic: inStorm + hypeLevel สูง + ใกล้ท้าย (ผ่าน inEnd) => boss vibe
    if (inStorm && inEnd && S.hypeLevel > 0.6){
      // ไม่ยิงถี่ ให้เป็น occasional
      if (shield > 0){
        say(
          pick([
            'บอสกำลังเดือด! เก็บ 🛡️ แล้ว BLOCK 🌩️ ให้ครบ!',
            'ช่วงบอสมาแล้ว! BLOCK 🌩️ ด้วย 🛡️ ให้ครบตามจำนวน!'
          ]),
          'hype','boss','bossHint', 1800
        );
      }
    }

    // ------------- Miss spike coaching -------------
    // ถ้าพลาดขึ้นเร็ว ๆ ให้โค้ชเตือน “อย่ารัว”
    const dMiss = misses - (S.lastMissCount|0);
    S.lastMissCount = misses;

    if (dMiss >= 3){
      S.missSpike++;
    } else {
      S.missSpike = Math.max(0, S.missSpike - 1);
    }

    if (S.missSpike >= 2){
      S.missSpike = 0;
      say(
        pick([
          'พลาดติด ๆ กันแล้ว—ช้าลงนิด เล็งค้างแล้วค่อยยิง 🎯',
          'อย่ารัวนะ! เลือกยิงเป้าที่ชัวร์ ๆ จะคุม GREEN ง่ายขึ้น 💚'
        ]),
        'warn','skill','slowDown', 900
      );
    }

    // ------------- Combo praise (สนุกเร้าใจ) -------------
    if (combo === 12){
      say('คอมโบ 12 แล้ว! โคตรมันส์—ลากต่อ! 🔥', 'hype','combo','combo12', 900);
    } else if (combo === 20){
      say('คอมโบ 20! ระดับเทพแล้วนะ 😈🔥', 'hype','combo','combo20', 1200);
    }

    // ------------- Low shield reminder (strategic fun) -------------
    if (inStorm && shield <= 0){
      say(
        pick([
          'ไม่มี 🛡️ แล้ว—ถ้าเห็นโล่ โฟกัสเก็บก่อนเลย!',
          'โล่หมด! เจอ 🛡️ ปุ๊บ เก็บทันที จะผ่านช่วงท้ายง่ายขึ้น!'
        ]),
        'warn','shield','shieldLow', 1300
      );
    }
  }

  // Manual trigger for external messages (optional)
  function push(text, tone='info', tag='sys'){
    emit('hha:coach', { game, text:String(text||''), tone, tag, t: Date.now() });
  }

  return { onStart, onUpdate, onEnd, push };
}