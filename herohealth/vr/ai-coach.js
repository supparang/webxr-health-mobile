// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (Explainable + Rate-limited)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(ctx), onEnd(summary)
// ✅ Emits: hha:coach { level, title, msg, why[], tags[], game, ts }
// ✅ Rate-limit + anti-spam + dedupe by key
// ✅ Safe defaults for kids (short, friendly, actionable)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}
function nowMs(){ return Date.now(); }
function safeStr(x){ return String(x ?? ''); }

function pick(arr, idx){
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[(idx % arr.length + arr.length) % arr.length];
}

function makeKey(parts){
  return parts.filter(Boolean).join('|');
}

function defaultEmitFallback(name, detail){
  try{
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  }catch(_){}
}

export function createAICoach(opts = {}){
  const emit = typeof opts.emit === 'function' ? opts.emit : defaultEmitFallback;
  const game = safeStr(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 2800, 900, 12000);

  // internal state
  const S = {
    started:false,
    ended:false,
    t0:0,
    lastSayAt:0,
    lastKey:'',
    lastCtx:null,

    // light memory (for trend-based tips)
    emaSkill:0.45,
    emaFrus:0.25,
    emaFat:0.10,
    missSpikeAt:0,
    comboPeak:0,
    lastStormState:false,
    lastEndWindowState:false,
    lastZone:'',
    lastShield:0,
    lastAccBucket:-1,
  };

  // ---- tip catalog (Hydration-focused but reusable) ----
  const TIPS = {
    hydrate:{
      intro:[
        { level:'info', title:'โค้ชพร้อมแล้ว 💧', msg:'เริ่มด้วย “คุม GREEN” ก่อน แล้วค่อยลุย STORM/BOSS!', why:['Stage 1 ต้องสะสมเวลา GREEN'], tags:['intro'] },
      ],
      stage1_lowSkill:[
        { level:'tip', title:'คุม GREEN ให้นิ่ง', msg:'เล็งนิดนึงแล้วค่อยยิง 💧 อย่ารัว', why:['Accuracy ต่ำ → รัวแล้วพลาดง่าย'], tags:['aim','stage1'] },
        { level:'tip', title:'ยิงเฉพาะที่ชัวร์', msg:'เลือกเป้าที่ใกล้กลางจอ/นิ่งก่อน คอมโบจะยาว', why:['คอมโบยาว = คะแนน + เกรดดี'], tags:['combo','stage1'] },
      ],
      stage1_goodSkill:[
        { level:'praise', title:'กำลังมาดี!', msg:'คุม GREEN ได้ดีมาก ลากคอมโบต่ออีกนิด', why:['GREEN hold เพิ่มเร็ว'], tags:['praise','stage1'] },
      ],
      storm_enter:[
        { level:'warn', title:'STORM มาแล้ว 🌀', msg:'ทำให้น้ำ “ไม่ GREEN” (LOW/HIGH) แล้วเก็บ 🛡️ รอท้ายพายุ', why:['Mini ต้อง zone≠GREEN และต้อง BLOCK ตอน End Window'], tags:['storm','mini'] },
      ],
      storm_endwindow:[
        { level:'warn', title:'End Window! ⏳', msg:'ตอนนี้แหละ! ใช้ 🛡️ BLOCK ให้ได้ในช่วงท้ายพายุ', why:['ผ่าน Mini เมื่อ BLOCK ใน End Window'], tags:['storm','endwindow'] },
      ],
      boss_window:[
        { level:'danger', title:'BOSS WINDOW 🌩️', msg:'🌩️ จะโผล่ถี่ขึ้น—เก็บ 🛡️ ไว้แล้ว BLOCK ให้ครบ!', why:['Stage 3 ต้องบล็อกครบตามจำนวน'], tags:['boss'] },
      ],
      shield_empty:[
        { level:'tip', title:'🛡️ หมดแล้ว', msg:'โฟกัสเก็บ 🛡️ ก่อน แล้วค่อยลุยเป้าอื่น', why:['ไม่มีโล่ = โดน BAD แล้ว MISS พุ่ง'], tags:['shield'] },
      ],
      frus_high:[
        { level:'tip', title:'พักจังหวะนิดนึง', msg:'ช้าลง 0.5 วิ เล็งให้ชัวร์ แล้วค่อยยิง', why:['พลาดติดกัน → frustration สูง'], tags:['calm','aim'] },
      ],
      combo_peak:[
        { level:'praise', title:'คอมโบโหดมาก! 🔥', msg:'สุดยอด! รักษาจังหวะนี้ไว้ เกรดจะพุ่ง', why:['combo สูง → performance ดี'], tags:['praise','combo'] },
      ],
      end_summary:[
        { level:'info', title:'สรุปการเล่น', msg:'ดู Tips แล้วลองใหม่—โฟกัส “ผ่าน Stage ถัดไป” ทีละขั้น', why:['เรียนรู้จากผลแล้วพัฒนา'], tags:['summary'] },
      ]
    }
  };

  // pick catalog by game (for future)
  function catalog(){
    if (game === 'hydration') return TIPS.hydrate;
    // fallback minimal
    return {
      intro:[{ level:'info', title:'โค้ชพร้อม!', msg:'เล่นให้สนุก แล้วพยายามทำภารกิจให้ครบ', why:['มีภารกิจ/มิชชั่น'], tags:['intro'] }]
    };
  }

  function canSay(){
    const t = nowMs();
    if (!S.started || S.ended) return false;
    if ((t - S.lastSayAt) < cooldownMs) return false;
    return true;
  }

  function say(tip, key){
    if (!tip) return false;
    const t = nowMs();
    const k = safeStr(key || '');
    if (!canSay()) return false;

    // dedupe same key too frequently
    if (k && k === S.lastKey && (t - S.lastSayAt) < Math.max(1800, cooldownMs*1.15)) return false;

    S.lastSayAt = t;
    S.lastKey = k || '';

    emit('hha:coach', {
      ts: t,
      game,
      level: tip.level || 'tip',
      title: tip.title || '',
      msg: tip.msg || '',
      why: Array.isArray(tip.why) ? tip.why : [],
      tags: Array.isArray(tip.tags) ? tip.tags : [],
      key: k || ''
    });
    return true;
  }

  function bucketAcc(acc){
    // 0..100 -> buckets
    if (acc >= 90) return 4;
    if (acc >= 80) return 3;
    if (acc >= 65) return 2;
    if (acc >= 50) return 1;
    return 0;
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    S.ended = false;
    S.t0 = nowMs();
    S.lastSayAt = 0;
    S.lastKey = '';
    S.comboPeak = 0;
    S.missSpikeAt = 0;
    S.lastStormState = false;
    S.lastEndWindowState = false;
    S.lastZone = '';
    S.lastShield = 0;
    S.lastAccBucket = -1;

    const C = catalog();
    // intro is allowed immediately (ignore cooldown)
    const tip = pick(C.intro, 0);
    if (tip){
      emit('hha:coach', { ts: nowMs(), game, level: tip.level, title: tip.title, msg: tip.msg, why: tip.why||[], tags: tip.tags||[], key:'intro' });
      S.lastSayAt = nowMs(); // start cooldown after intro
      S.lastKey = 'intro';
    }
  }

  function onUpdate(ctx = {}){
    if (!S.started || S.ended) return;
    S.lastCtx = ctx;

    // normalize ctx
    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const fatigue = clamp(ctx.fatigue ?? 0, 0, 1);
    const frus = clamp(ctx.frustration ?? 0, 0, 1);
    const inStorm = !!ctx.inStorm;
    const inEndWindow = !!ctx.inEndWindow;
    const zone = safeStr(ctx.waterZone ?? '');
    const shield = clamp(ctx.shield ?? 0, 0, 99);
    const misses = clamp(ctx.misses ?? 0, 0, 9999);
    const combo = clamp(ctx.combo ?? 0, 0, 9999);

    // EMA for stability (avoid flicker tips)
    S.emaSkill = S.emaSkill*0.88 + skill*0.12;
    S.emaFat   = S.emaFat*0.90 + fatigue*0.10;
    S.emaFrus  = S.emaFrus*0.86 + frus*0.14;

    // detect spikes
    if (misses >= 8 && !S.missSpikeAt) S.missSpikeAt = nowMs();
    if (combo > S.comboPeak) S.comboPeak = combo;

    const C = catalog();

    // 1) Boss / EndWindow / Storm entry are highest priority
    if (inStorm && !S.lastStormState){
      if (say(pick(C.storm_enter, (nowMs()/1000)|0), 'storm_enter')) {
        S.lastStormState = true;
        S.lastEndWindowState = inEndWindow;
        S.lastZone = zone;
        S.lastShield = shield;
        return;
      }
    }

    // end window prompt (only once per end window rising edge)
    if (inEndWindow && !S.lastEndWindowState){
      if (say(pick(C.storm_endwindow, (nowMs()/1000)|0), 'storm_endwindow')) {
        S.lastEndWindowState = true;
        S.lastZone = zone;
        S.lastShield = shield;
        return;
      }
    }

    // boss window hint if provided by engine (hydration passes inBoss via inStorm+inEndWindow triggers anyway)
    if (inStorm && inEndWindow && shield > 0 && S.emaSkill < 0.72){
      // keep it rare: only if cooldown allows (handled by say)
      say(pick(C.boss_window, (nowMs()/1000)|0), 'boss_window');
      // do not return; allow other hints later
    }

    // 2) Shield empty (during storm is painful)
    if (inStorm && shield <= 0 && S.lastShield > 0){
      if (say(pick(C.shield_empty, (nowMs()/1000)|0), 'shield_empty')) {
        S.lastShield = shield;
        return;
      }
    }

    // 3) Frustration calming
    if (S.emaFrus >= 0.72){
      say(pick(C.frus_high, (nowMs()/1000)|0), 'frus_high');
    }

    // 4) Skill-based aim tips (mostly stage1 vibes)
    const accBucket = bucketAcc((S.emaSkill*100));
    if (accBucket !== S.lastAccBucket){
      S.lastAccBucket = accBucket;
      if (accBucket <= 1){
        say(pick(C.stage1_lowSkill, (nowMs()/1000)|0), 'stage1_lowSkill');
      } else if (accBucket >= 3){
        say(pick(C.stage1_goodSkill, (nowMs()/1000)|0), 'stage1_goodSkill');
      }
    }

    // 5) Celebrate combo peak (rare)
    if (S.comboPeak >= 18 && (nowMs() - S.t0) > 8000){
      // only say once when crossing
      if (S.comboPeak === combo && combo % 6 === 0){
        say(pick(C.combo_peak, (nowMs()/1000)|0), 'combo_peak');
      }
    }

    // update edges memory
    if (!inStorm){
      S.lastStormState = false;
      S.lastEndWindowState = false;
    } else {
      S.lastStormState = true;
      S.lastEndWindowState = inEndWindow;
    }
    S.lastZone = zone;
    S.lastShield = shield;
  }

  function onEnd(summary){
    if (S.ended) return;
    S.ended = true;

    const C = catalog();
    // End tip: emit once (no cooldown)
    const tip = pick(C.end_summary, 0);
    if (tip){
      emit('hha:coach', {
        ts: nowMs(),
        game,
        level: tip.level || 'info',
        title: tip.title || '',
        msg: tip.msg || '',
        why: Array.isArray(tip.why) ? tip.why : [],
        tags: Array.isArray(tip.tags) ? tip.tags : [],
        key: 'end_summary',
        summary: summary || null
      });
    }
  }

  return { onStart, onUpdate, onEnd };
}