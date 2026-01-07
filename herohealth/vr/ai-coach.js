// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable Micro-tips) — PRODUCTION
// ✅ emit('hha:coach', { level, title, message, reason, tags, at, game })
// ✅ Rate-limit + anti-spam + anti-repeat
// ✅ Deterministic in research (no randomness) by default
// ✅ Works across games: hydration / groups / plate / goodjunk
//
// Usage:
//   import { createAICoach } from '../vr/ai-coach.js';
//   const coach = createAICoach({ emit, game:'hydration', cooldownMs:3000 });
//   coach.onStart();
//   coach.onUpdate(ctx); // ctx from engine
//   coach.onEnd(summary);

'use strict';

export function createAICoach(opts = {}) {
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} };

  const game = String(opts.game || 'game');
  const cooldownMs = Math.max(1200, Number(opts.cooldownMs || 2800));
  const maxPerMinute = Math.max(6, Number(opts.maxPerMinute || 10));
  const quietAfterEndWindowMs = Math.max(0, Number(opts.quietAfterEndWindowMs || 650));

  // If run=research then deterministic + less chatter
  const runMode = (()=>{
    try{
      const u = new URL(location.href);
      return String(u.searchParams.get('run') || u.searchParams.get('runMode') || 'play').toLowerCase();
    }catch(_){ return 'play'; }
  })();
  const isResearch = (runMode === 'research');

  const CFG = {
    game,
    cooldownMs: isResearch ? Math.max(cooldownMs, 4200) : cooldownMs,
    maxPerMinute: isResearch ? Math.min(maxPerMinute, 6) : maxPerMinute,
    quietAfterEndWindowMs,
    deterministic: isResearch ? true : !!opts.deterministic
  };

  // -------- internal state --------
  const S = {
    started:false,
    ended:false,

    lastSpeakAt: 0,
    lastEndWindowAt: 0,

    // anti-repeat: keep a small LRU of message keys
    recentKeys: [],
    recentMax: 10,

    // per-minute limiter
    minuteWindowStart: 0,
    minuteCount: 0,

    // last ctx snapshot for trend detection
    last: {
      accuracy: null,
      misses: null,
      combo: null,
      waterZone: null,
      shield: null,
      inStorm: false,
      inEndWindow: false
    },

    // deterministic variation index (no RNG)
    step: 0
  };

  function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function speak(payload){
    if (S.ended) return false;

    const t = nowMs();

    // quiet zone right after end window to avoid flooding
    if (t - S.lastEndWindowAt < CFG.quietAfterEndWindowMs) return false;

    // cooldown
    if (t - S.lastSpeakAt < CFG.cooldownMs) return false;

    // per-minute cap
    if (!S.minuteWindowStart || t - S.minuteWindowStart > 60000){
      S.minuteWindowStart = t;
      S.minuteCount = 0;
    }
    if (S.minuteCount >= CFG.maxPerMinute) return false;

    const key = String(payload && payload.key || '');
    if (key && S.recentKeys.includes(key)) return false;

    // push LRU
    if (key){
      S.recentKeys.push(key);
      while (S.recentKeys.length > S.recentMax) S.recentKeys.shift();
    }

    S.lastSpeakAt = t;
    S.minuteCount++;

    const detail = {
      game: CFG.game,
      level: payload.level || 'tip',           // tip | warn | hype | info
      title: payload.title || 'Coach',
      message: payload.message || '',
      reason: payload.reason || '',
      tags: payload.tags || [],
      at: new Date().toISOString()
    };

    emit('hha:coach', detail);
    return true;
  }

  // helper: deterministic chooser (no randomness)
  function pick(list, seedKey){
    if (!Array.isArray(list) || !list.length) return null;
    if (!CFG.deterministic){
      const i = Math.floor(Math.random() * list.length);
      return list[i];
    }
    // deterministic: rotate with step + hash(seedKey)
    const h = hash(seedKey || '');
    const i = (S.step + h) % list.length;
    return list[i];
  }

  function hash(str){
    str = String(str || '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // -------- tip bank (hydration-focused but reusable) --------
  function tipAccuracyLow(ctx){
    const variants = [
      { title:'เล็งก่อนยิง 🎯', message:'Accuracy ต่ำ → “หยุด 0.2 วิแล้วค่อยยิง” จะชัวร์ขึ้น', tags:['accuracy','focus'] },
      { title:'ลดรัว เพิ่มชัวร์ ✅', message:'ลองยิงเฉพาะเป้าที่อยู่ใกล้ ๆ กลางจอ แล้วค่อยขยายระยะ', tags:['accuracy','control'] },
      { title:'เล่นแบบนิ่ง ๆ ก่อน', message:'ตั้งเป้าคอมโบสั้น ๆ 5–8 แล้วค่อยเร่ง', tags:['combo','accuracy'] },
    ];
    const v = pick(variants, 'accLow:'+CFG.game);
    return {
      key:'acc-low',
      level:'warn',
      reason:`accuracy=${(ctx.accuracy*100).toFixed(0)}%`,
      ...v
    };
  }

  function tipMissHigh(ctx){
    const variants = [
      { title:'MISS เยอะ 💥', message:'หยุดยิงมั่ว ๆ แล้วเลือกเป้าที่ “แน่ใจ” ก่อน', tags:['miss','control'] },
      { title:'คุมความเสี่ยง', message:'MISS สูง → โฟกัสยิง 💧 เท่านั้น ลดการโดน 🥤', tags:['miss','discipline'] },
      { title:'พักจังหวะ 1 วิ', message:'พลาดติด ๆ กัน → ชะลอ 1 จังหวะ แล้วเริ่มคอมโบใหม่', tags:['miss','reset'] },
    ];
    const v = pick(variants, 'missHigh:'+CFG.game);
    return {
      key:'miss-high',
      level:'warn',
      reason:`misses=${ctx.misses|0}`,
      ...v
    };
  }

  function tipStormPrepare(ctx){
    const variants = [
      { title:'พายุใกล้มา 🌀', message:'เก็บ 🛡️ อย่างน้อย 1–2 อัน แล้วรอ End Window ค่อย BLOCK', tags:['storm','shield'] },
      { title:'จำสูตร Storm', message:'Storm Mini = LOW/HIGH + “BLOCK ช่วงท้าย” + ห้ามโดน 🥤', tags:['storm','rules'] },
    ];
    const v = pick(variants, 'stormPrepare:'+CFG.game);
    return {
      key:'storm-prepare',
      level:'info',
      reason:`inStorm=${!!ctx.inStorm}`,
      ...v
    };
  }

  function tipEndWindow(ctx){
    const variants = [
      { title:'End Window! ⏱️', message:'ตอนนี้คือช่วง “BLOCK ให้ได้” ใช้ 🛡️ ป้องกัน 🥤 / 🌩️', tags:['endWindow','block'] },
      { title:'โหมดกดดันมาแล้ว!', message:'ท้ายพายุ → ช่วงนี้แหละที่คะแนนเด้ง ถ้า BLOCK สำเร็จ', tags:['endWindow','reward'] },
    ];
    const v = pick(variants, 'endWindow:'+CFG.game);
    return {
      key:'end-window',
      level:'hype',
      reason:'endWindow=true',
      ...v
    };
  }

  function tipShieldZeroInStorm(ctx){
    const variants = [
      { title:'ไม่มีโล่! 🛡️=0', message:'ตอนพายุถ้าไม่มีโล่ → หลีกเลี่ยง 🥤 แล้วรีบเก็บ 🛡️', tags:['storm','shield','danger'] },
      { title:'เสี่ยงโดนหนัก', message:'Storm + โล่หมด → เน้นยิง 💧 ให้คุมเกม อย่าไปเสี่ยง 🥤', tags:['storm','risk'] },
    ];
    const v = pick(variants, 'shield0:'+CFG.game);
    return {
      key:'shield-zero-storm',
      level:'warn',
      reason:'shield=0 inStorm',
      ...v
    };
  }

  function tipWaterZone(ctx){
    const z = String(ctx.waterZone || '').toUpperCase();
    if (z === 'GREEN'){
      const v = pick([
        { title:'GREEN ดีมาก 💚', message:'คุม GREEN ต่อไปให้ครบเวลา → Stage1 ผ่านแน่', tags:['stage1','green'] },
        { title:'รักษาสมดุลไว้', message:'GREEN = เสถียรสุด ลากคอมโบยาว ๆ ได้เลย', tags:['green','combo'] },
      ], 'zoneGreen:'+CFG.game);
      return { key:'zone-green', level:'tip', reason:'waterZone=GREEN', ...v };
    }
    // LOW/HIGH
    const v = pick([
      { title:`${z} อยู่แล้ว!`, message:'ถ้าเป็นช่วงพายุ ให้ “กดดันต่อเนื่อง” แล้วรอ End Window ค่อย BLOCK', tags:['storm','zone'] },
      { title:`โซน ${z} ✅`, message:'ดี! ตอนพายุต้องการ LOW/HIGH อยู่แล้ว (เพื่อผ่าน Mini)', tags:['storm','mini'] },
    ], 'zoneNonGreen:'+CFG.game);
    return { key:'zone-nongreen', level:'info', reason:`waterZone=${z}`, ...v };
  }

  function tipComboHype(ctx){
    const variants = [
      { title:'คอมโบมาแล้ว! 🔥', message:'รักษาจังหวะเดิมไว้ อย่ารีบจนพลาด', tags:['combo','hype'] },
      { title:'กำลังไหล!', message:'คอมโบสูง → คะแนนพุ่ง ลากให้ยาวอีกนิด', tags:['combo','score'] },
    ];
    const v = pick(variants, 'combo:'+CFG.game);
    return {
      key:'combo-hype',
      level:'hype',
      reason:`combo=${ctx.combo|0}`,
      ...v
    };
  }

  // -------- decision engine --------
  function maybeCoach(ctxRaw = {}){
    if (!S.started || S.ended) return;

    // normalize ctx
    const ctx = {
      skill: clamp(ctxRaw.skill, 0, 1),
      fatigue: clamp(ctxRaw.fatigue, 0, 1),
      frustration: clamp(ctxRaw.frustration, 0, 1),
      accuracy: clamp((ctxRaw.accuracyGoodPct ?? (ctxRaw.skill ?? 0)) , 0, 1), // allow either
      misses: clamp(ctxRaw.misses ?? 0, 0, 9999),
      combo: clamp(ctxRaw.combo ?? 0, 0, 9999),
      inStorm: !!ctxRaw.inStorm,
      inEndWindow: !!ctxRaw.inEndWindow,
      waterZone: String(ctxRaw.waterZone || ''),
      shield: clamp(ctxRaw.shield ?? 0, 0, 99)
    };

    // track endWindow time to enforce quiet zone
    if (ctx.inEndWindow) S.lastEndWindowAt = nowMs();

    // trend deltas
    const last = S.last;
    const accNow = (ctx.accuracy <= 1.0) ? ctx.accuracy : (ctx.accuracy/100);
    const lastAcc = (last.accuracy == null) ? null : last.accuracy;
    const accDrop = (lastAcc == null) ? 0 : (lastAcc - accNow);

    const missNow = ctx.misses|0;
    const lastMiss = (last.misses == null) ? missNow : (last.misses|0);
    const missJump = missNow - lastMiss;

    const comboNow = ctx.combo|0;
    const lastCombo = (last.combo == null) ? comboNow : (last.combo|0);

    // update snapshot (end of function)
    const finalize = ()=>{
      S.last.accuracy = accNow;
      S.last.misses = missNow;
      S.last.combo = comboNow;
      S.last.waterZone = ctx.waterZone;
      S.last.shield = ctx.shield|0;
      S.last.inStorm = ctx.inStorm;
      S.last.inEndWindow = ctx.inEndWindow;
      S.step++;
    };

    // Priority 1: End Window callout (high drama, but not too frequent)
    if (ctx.inEndWindow && !last.inEndWindow){
      const payload = tipEndWindow(ctx);
      speak(payload);
      finalize();
      return;
    }

    // Priority 2: Storm safety if no shield
    if (ctx.inStorm && ctx.shield <= 0){
      // only if just entered storm OR miss jumped
      if (!last.inStorm || missJump >= 1){
        speak(tipShieldZeroInStorm(ctx));
        finalize();
        return;
      }
    }

    // Priority 3: Accuracy low / drop
    if (accNow < 0.60 || accDrop >= 0.12){
      // avoid nagging if currently in end window
      if (!ctx.inEndWindow){
        speak(tipAccuracyLow({ accuracy: accNow }));
        finalize();
        return;
      }
    }

    // Priority 4: Miss high / jumping
    if (missNow >= 10 && (missJump >= 2 || ctx.frustration > 0.65)){
      if (!ctx.inEndWindow){
        speak(tipMissHigh({ misses: missNow }));
        finalize();
        return;
      }
    }

    // Priority 5: Storm prep (when storm starts)
    if (ctx.inStorm && !last.inStorm){
      speak(tipStormPrepare(ctx));
      finalize();
      return;
    }

    // Priority 6: Water zone coaching (light)
    if (ctx.inStorm){
      // in storm: emphasize NON-GREEN
      const z = String(ctx.waterZone||'').toUpperCase();
      if (z && z !== 'GREEN' && last.waterZone !== ctx.waterZone){
        speak(tipWaterZone(ctx));
        finalize();
        return;
      }
    } else {
      // not in storm: praise GREEN sometimes
      const z = String(ctx.waterZone||'').toUpperCase();
      if (z === 'GREEN' && last.waterZone !== 'GREEN'){
        speak(tipWaterZone(ctx));
        finalize();
        return;
      }
    }

    // Priority 7: Combo hype (only when meaningful)
    if (comboNow >= 12 && comboNow > lastCombo && (comboNow % 8 === 0)){
      speak(tipComboHype(ctx));
      finalize();
      return;
    }

    finalize();
  }

  // -------- public API --------
  return {
    onStart(){
      if (S.started) return;
      S.started = true;
      S.ended = false;
      S.lastSpeakAt = 0;
      S.minuteWindowStart = 0;
      S.minuteCount = 0;
      S.recentKeys = [];
      S.step = 0;

      // gentle start tip (research: optional)
      if (!isResearch){
        speak({
          key:'start',
          level:'info',
          title:'Coach พร้อมแล้ว',
          message:'เป้าหมาย: คุม GREEN ก่อน แล้วค่อยผ่าน Storm Mini และ Boss Window!',
          reason:'start'
        });
      }
    },

    onUpdate(ctx){
      try{ maybeCoach(ctx || {}); }catch(_){}
    },

    onEnd(summary){
      S.ended = true;
      // final praise (non-research to avoid bias)
      if (!isResearch){
        const g = String(summary?.grade || '');
        speak({
          key:'end',
          level:'tip',
          title:'จบเกม!',
          message: g ? `เกรด: ${g} — ลอง Retry เพื่อดันให้สูงขึ้นอีก!` : 'ลอง Retry เพื่อพัฒนาผลลัพธ์อีกนิด!',
          reason:'end'
        });
      }
    }
  };
}