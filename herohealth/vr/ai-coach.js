// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable Micro-tips, Rate-limited, Deterministic)
// Export: createAICoach({ emit, game, cooldownMs })
// ✅ Emits: hha:coach {game, type, key, text, level, ts, meta}
// ✅ Rate-limit: cooldown + perKey cooldown + perMinute cap
// ✅ Deterministic: no randomness; pick best matching rule by priority
// ✅ Optional UI bridge: updates #water-tip or #coach-tip if exists (best-effort)
// ✅ Disable: ?nocoach=1 or window.HHA_COACH = 0

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }
function isoNow(){ try{ return new Date().toISOString(); }catch(_){ return ''; } }

function coachEnabled(){
  try{
    if (WIN.HHA_COACH === 0) return false;
    const n = String(qs('nocoach','')).toLowerCase();
    if (n==='1'||n==='true'||n==='yes') return false;
    return true;
  }catch(_){ return true; }
}

function setTipText(text){
  // hydration has #water-tip; other games may have #coach-tip
  try{
    const a = DOC?.getElementById('water-tip');
    const b = DOC?.getElementById('coach-tip');
    if (a) a.textContent = String(text);
    if (b) b.textContent = String(text);
  }catch(_){}
}

export function createAICoach(opts={}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : (()=>{});
  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 2800, 800, 15000);

  // caps
  const perMinuteCap = clamp(opts.perMinuteCap ?? 10, 3, 30);
  const perKeyCooldownMs = clamp(opts.perKeyCooldownMs ?? 12000, 2000, 60000);

  const S = {
    enabled: coachEnabled(),
    lastSayAt: -1e9,
    lastKeyAt: new Map(),
    // sliding window for per-minute limit
    sayTimes: [],
    started:false,

    // for trend detection
    lastMisses:0,
    lastCombo:0,
    lastAcc:0,
    lastT:0,

    // milestones
    praisedCombo:false,
    praisedStorm:false,
    praisedBoss:false
  };

  function canSay(key){
    if (!S.enabled) return false;
    const t = nowMs();

    // global cooldown
    if (t - S.lastSayAt < cooldownMs) return false;

    // per-minute cap
    S.sayTimes = S.sayTimes.filter(x => (t - x) <= 60000);
    if (S.sayTimes.length >= perMinuteCap) return false;

    // per-key cooldown
    const lk = S.lastKeyAt.get(key) ?? -1e9;
    if (t - lk < perKeyCooldownMs) return false;

    return true;
  }

  function say(type, key, text, level='tip', meta=null){
    if (!canSay(key)) return false;

    const t = nowMs();
    S.lastSayAt = t;
    S.lastKeyAt.set(key, t);
    S.sayTimes.push(t);

    // emit
    try{
      emit('hha:coach', {
        game, type, key,
        text: String(text),
        level: String(level),
        ts: isoNow(),
        meta: meta || {}
      });
    }catch(_){}

    // optional UI bridge
    setTipText(text);

    return true;
  }

  // ---- Rules: deterministic priority list (higher first) ----
  function pickAndSay(ctx){
    // ctx fields expected from hydration.safe.js onUpdate:
    // skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo

    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone || '');
    const shield = ctx.shield|0;
    const misses = ctx.misses|0;
    const combo = ctx.combo|0;

    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const fat = clamp(ctx.fatigue ?? 0, 0, 1);
    const fr = clamp(ctx.frustration ?? 0, 0, 1);

    // 0) Super urgent: end window without shield
    if (inStorm && inEnd && shield <= 0){
      return say('tip', 'end_no_shield',
        '⚠️ End Window มาแล้ว แต่ไม่มี 🛡️ — รีบเก็บ 🛡️ ไว้ก่อนพายุรอบหน้า แล้วค่อย BLOCK ช่วงท้าย!', 'warn',
        { inStorm, inEnd, shield, zone });
    }

    // 1) Storm: ยัง GREEN อยู่ -> mini จะไม่ผ่าน
    if (inStorm && zone === 'GREEN'){
      return say('tip', 'storm_need_lowhigh',
        '🌀 Storm Mini: ต้องทำให้น้ำ “LOW/HIGH” (ห้าม GREEN) ก่อน แล้วค่อย BLOCK ช่วงท้าย (End Window).', 'tip',
        { inStorm, zone });
    }

    // 2) Storm: End window แล้ว ให้ block
    if (inStorm && inEnd && shield > 0){
      return say('tip', 'end_block_now',
        '⏱️ ตอนนี้คือ End Window! ใช้ 🛡️ BLOCK เป้า 🥤/🌩️ ให้ผ่าน Mini (อย่าโดน BAD แบบไม่มีโล่).', 'tip',
        { inEnd, shield });
    }

    // 3) High frustration -> ลดรัว
    if (fr >= 0.72 && misses >= 8){
      return say('tip', 'slow_down',
        '💡 ลอง “ช้าลงแต่ชัวร์” — เล็งค้างนิดนึงก่อนยิง จะลด MISS แล้วคอมโบจะกลับมาเอง.', 'tip',
        { fr, misses });
    }

    // 4) Low skill -> aim hint
    if (skill <= 0.38){
      return say('tip', 'aim_hold',
        '🎯 เคล็ดลับ: เล็งให้อยู่กลางเป้าก่อนค่อยยิง (ไม่ต้องรัว) — Accuracy จะดีขึ้นเร็วมาก.', 'tip',
        { skill });
    }

    // 5) Combo praise milestone (once)
    if (!S.praisedCombo && combo >= 12){
      S.praisedCombo = true;
      return say('praise', 'combo_hot',
        '🔥 คอมโบกำลังมา! รักษาจังหวะนี้ไว้ ยิง 💧 ต่อเนื่องแล้วคะแนนจะพุ่งแรง!', 'good',
        { combo });
    }

    // 6) Fatigue high -> short rest cue
    if (fat >= 0.78){
      return say('tip', 'fatigue_breath',
        '😮‍💨 ใกล้จบแล้ว! หายใจลึก ๆ 1 ครั้ง แล้วโฟกัสยิงเฉพาะเป้าที่ชัวร์.', 'tip',
        { fat });
    }

    // 7) Default gentle guidance (rare)
    if (misses <= 2 && combo <= 2 && skill >= 0.55){
      return say('tip', 'steady',
        '✅ ฟอร์มดี! รักษาความนิ่ง แล้วเก็บ 🛡️ เตรียม Storm รอบถัดไป.', 'tip',
        { skill });
    }

    return false;
  }

  function onStart(meta=null){
    if (!S.enabled) return;
    if (S.started) return;
    S.started = true;
    S.lastMisses = 0;
    S.lastCombo = 0;
    S.lastAcc = 0;
    S.lastT = nowMs();

    say('start', 'start',
      '👋 พร้อมลุย Hydration! เป้าหมาย: คุม GREEN ให้ครบ → ผ่าน Storm Mini → เคลียร์ BOSS ด้วย 🛡️.',
      'tip', meta || {});
  }

  function onUpdate(ctx={}){
    if (!S.enabled) return;

    // trend-based nudges (deterministic)
    const t = nowMs();
    const dt = (t - S.lastT) / 1000;
    if (dt >= 0.9){
      const misses = ctx.misses|0;
      const combo = ctx.combo|0;

      // miss spike
      if ((misses - S.lastMisses) >= 4){
        say('tip', 'miss_spike',
          '💥 MISS เพิ่มเร็ว! ลดการยิงรัว แล้วเลือกยิงเป้าที่ “ใหญ่และใกล้” ก่อน.', 'warn',
          { misses, combo });
      }

      // combo drop
      if (S.lastCombo >= 8 && combo === 0){
        say('tip', 'combo_reset',
          '🔄 คอมโบหลุดไม่เป็นไร เริ่มใหม่ด้วยยิง 💧 ช้า ๆ 2–3 อัน จะกลับมาไว.', 'tip',
          { lastCombo: S.lastCombo });
      }

      S.lastMisses = misses;
      S.lastCombo = combo;
      S.lastT = t;
    }

    // then try rule-pick (priority list)
    pickAndSay(ctx);
  }

  function onEnd(summary={}){
    if (!S.enabled) return;

    const grade = String(summary.grade || 'C');
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const stage = Number(summary.stageCleared || 0);

    let msg = `🏁 จบเกมแล้ว! Grade ${grade} | Acc ${acc.toFixed(1)}% | Miss ${miss}`;
    if (stage < 1) msg += '\n🎯 Next: ผ่าน Stage1 (คุม GREEN ให้ครบ) ก่อน';
    else if (stage < 2) msg += '\n🌀 Next: ผ่าน Storm Mini 1 พายุ (LOW/HIGH + BLOCK ช่วงท้าย)';
    else if (stage < 3) msg += '\n🌩️ Next: เคลียร์ BOSS (เก็บ 🛡️ แล้ว BLOCK 🌩️ ให้ครบ)';
    else msg += '\n🔥 สุดยอด! ต่อไปลองลากคอมโบ + ผ่านทุกพายุให้ได้หมด';

    say('end', 'end', msg, 'tip', summary);
  }

  // public API
  return {
    say,
    onStart,
    onUpdate,
    onEnd,
    setEnabled(v){
      S.enabled = !!v;
      if (!S.enabled) setTipText(''); // clear
    }
  };
}