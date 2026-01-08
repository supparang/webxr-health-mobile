// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable + Rate-limit + Stage-aware + Research-safe)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(ctx), onEnd(summary)
// ✅ Emits: hha:coach {type, level, msg, reason, tags, ts}
// ✅ Research mode: deterministic + minimal nudges (no randomness)
//
// ctx suggested fields (from your games):
// - skill (0..1), fatigue (0..1), frustration (0..1)
// - inStorm (bool), inEndWindow (bool), waterZone (string), shield (int)
// - misses (int), combo (int), stage (1..3) optional
//
// summary suggested fields:
// - grade, accuracyGoodPct, misses, stageCleared, stormCycles, stormSuccess, bossClearCount, greenHoldSec
//
'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }
function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
}

function makeRing(n){
  const arr = new Array(n).fill(0);
  let i=0;
  return {
    push(x){ arr[i]=x; i=(i+1)%n; },
    avg(){
      let s=0,c=0;
      for (const v of arr){ if (v!==0){ s+=v; c++; } }
      return c? (s/c) : 0;
    }
  };
}

function normZone(z){
  z = String(z||'').toUpperCase();
  if (z.includes('GREEN')) return 'GREEN';
  if (z.includes('LOW')) return 'LOW';
  if (z.includes('HIGH')) return 'HIGH';
  return z || '—';
}

function inferStage(ctx){
  // Prefer explicit ctx.stage if provided
  const s = Number(ctx && ctx.stage) || 0;
  if (s>=1 && s<=3) return s;

  // Heuristic for hydration:
  // - if inStorm or inEndWindow => stage 2/3 likely (depending on boss cues)
  // - else stage 1
  if (ctx && (ctx.inStorm || ctx.inEndWindow)) return 2;
  return 1;
}

export function createAICoach(opts = {}){
  const emit = (typeof opts.emit === 'function')
    ? opts.emit
    : (name, detail)=>{ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const game = String(opts.game || 'game');
  const baseCooldown = clamp(opts.cooldownMs ?? 3000, 800, 15000);

  // research mode detection
  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const isResearch = (run === 'research' || run === 'study');
  const COOLDOWN = isResearch ? Math.max(6000, baseCooldown*1.6) : baseCooldown;

  // anti-spam: do not repeat same reason too frequently
  const lastByReason = new Map();

  // signal smoothing
  const histSkill = makeRing(12);
  const histFrus  = makeRing(12);
  const histAcc   = makeRing(12);

  // state
  const ST = {
    started:false,
    lastTipAt: 0,
    lastHardAt: 0,
    lastCtxAt: 0,

    lastMisses: 0,
    lastCombo: 0,

    seenStorm: false,
    seenEndWindow: false,
    seenBoss: false,

    stage: 1,
    stormTipsGiven: 0,
    stageTipsGiven: {1:0,2:0,3:0},

    // gate per run
    maxTipsPerRun: isResearch ? 8 : 16,
    tipsCount: 0
  };

  function canSpeak(reason, minGapMs){
    const t = nowMs();
    if (ST.tipsCount >= ST.maxTipsPerRun) return false;

    // global cooldown
    if (t - ST.lastTipAt < COOLDOWN) return false;

    // per-reason cooldown
    const prev = lastByReason.get(reason) || 0;
    const rgap = Math.max(minGapMs || 0, isResearch ? 9000 : 4500);
    if (t - prev < rgap) return false;

    return true;
  }

  function say(payload){
    const t = nowMs();
    ST.lastTipAt = t;
    ST.tipsCount++;
    lastByReason.set(payload.reason || payload.type || 'tip', t);

    emit('hha:coach', Object.assign({
      game,
      ts: Date.now()
    }, payload));
  }

  function micro(msg, reason, tags=[], extra={}){
    if (!canSpeak(reason, 0)) return;
    say(Object.assign({
      type:'tip',
      level:'micro',
      msg: String(msg),
      reason: String(reason),
      tags: Array.isArray(tags) ? tags : [String(tags)]
    }, extra));
  }

  function hard(msg, reason, tags=[], extra={}){
    const t = nowMs();
    // hard messages slightly less frequent
    if (t - ST.lastHardAt < (isResearch ? 12000 : 6500)) return;
    if (!canSpeak(reason, isResearch ? 9000 : 5000)) return;
    ST.lastHardAt = t;

    say(Object.assign({
      type:'tip',
      level:'hard',
      msg: String(msg),
      reason: String(reason),
      tags: Array.isArray(tags) ? tags : [String(tags)]
    }, extra));
  }

  // ------------------- Explainable rules -------------------
  function ruleStage1(ctx){
    // Goal: keep GREEN
    const z = normZone(ctx.waterZone);
    const skill = clamp(ctx.skill,0,1);
    const frus  = clamp(ctx.frustration,0,1);

    if (z !== 'GREEN'){
      micro('โฟกัสยิง 💧 เพื่อดัน “น้ำกลับเข้า GREEN” แล้วค่อยลากคอมโบยาว ๆ', 's1-back-to-green',
        ['stage1','green','balance'], { explain:`waterZone=${z}` });
      return;
    }

    if (skill < 0.45 && frus > 0.55){
      micro('ค่อย ๆ เล็งก่อนยิงนะ ไม่ต้องรัว—ยิงทีละชัวร์ Accuracy จะพุ่ง', 's1-slow-aim',
        ['stage1','accuracy','calm'], { explain:`skill=${skill.toFixed(2)} frus=${frus.toFixed(2)}` });
      return;
    }

    if (ST.stageTipsGiven[1] < (isResearch ? 2 : 3)){
      ST.stageTipsGiven[1]++;
      micro('Stage1: อยู่ GREEN ให้นานที่สุด ✅ (ยิง 💧 ให้สม่ำเสมอ) + เก็บ 🛡️ เผื่อพายุ', 's1-remind',
        ['stage1','goal','shield']);
    }
  }

  function ruleStorm(ctx){
    // Goal: pass mini — zone != GREEN, pressure ok, endWindow, blockedInEnd, no bad-hit
    const z = normZone(ctx.waterZone);
    const sh = Math.max(0, ctx.shield|0);
    const inEnd = !!ctx.inEndWindow;

    if (!ST.seenStorm){
      ST.seenStorm = true;
      hard('STORM มาแล้ว! เป้าหมายคือทำให้น้ำ “ไม่ GREEN (LOW/HIGH)” และเก็บ 🛡️ ไว้ BLOCK ช่วงท้าย', 'storm-start',
        ['storm','mini','rules'], { explain:`zone=${z} shield=${sh}` });
      return;
    }

    // If still GREEN during storm, push to break out
    if (z === 'GREEN'){
      micro('ตอนพายุ “ห้ามอยู่ GREEN” — ถ้าเห็น 🥤/BAD ให้ระวัง แต่ต้องทำให้น้ำหลุดไป LOW/HIGH ก่อน', 'storm-break-green',
        ['storm','zone'], { explain:`zone=${z}` });
      return;
    }

    // If end window and no shield, urgent
    if (inEnd && sh <= 0){
      hard('END WINDOW แล้ว แต่ไม่มี 🛡️! รอบหน้าเก็บ 🛡️ ก่อนพายุ จะผ่าน Mini ง่ายขึ้น', 'storm-no-shield-end',
        ['storm','endwindow','shield'], { explain:`shield=${sh}` });
      return;
    }

    // End window: remind block
    if (inEnd && sh > 0 && !ST.seenEndWindow){
      ST.seenEndWindow = true;
      hard('ตอนนี้คือ END WINDOW! ใช้ 🛡️ BLOCK ให้ได้อย่างน้อย 1 ครั้ง ✅', 'storm-endwindow-block',
        ['storm','endwindow','block'], { explain:`shield=${sh}` });
      return;
    }

    // General storm tip rate-limited
    if (ST.stormTipsGiven < (isResearch ? 2 : 4)){
      ST.stormTipsGiven++;
      micro('ทริคพายุ: ทำ LOW/HIGH ก่อน แล้วค่อย “กันตอนท้าย” (อย่าโดน BAD ตอนพายุ)', 'storm-general',
        ['storm','mini','timing'], { explain:`zone=${z} shield=${sh}` });
    }
  }

  function ruleBoss(ctx){
    // Boss window: block lightning
    const sh = Math.max(0, ctx.shield|0);

    if (!ST.seenBoss){
      ST.seenBoss = true;
      hard('BOSS WINDOW! 🌩️ โผล่ถี่—ใช้ 🛡️ BLOCK ให้ครบตามจำนวน เพื่อเคลียร์ Stage3', 'boss-start',
        ['boss','block','stage3'], { explain:`shield=${sh}` });
      return;
    }

    if (sh <= 0){
      micro('จะเคลียร์บอสต้องมี 🛡️ — รอบถัดไปเก็บ 🛡️ 1–2 อันก่อนเข้าช่วงท้ายพายุ', 'boss-need-shield',
        ['boss','shield'], { explain:`shield=${sh}` });
      return;
    }

    micro('โฟกัส “กัน 🌩️” ก่อนยิงอย่างอื่นนะ เคลียร์บอสแล้วคะแนนกระโดดแรงมาก', 'boss-focus',
      ['boss','priority'], { explain:`shield=${sh}` });
  }

  function ruleFrustration(ctx){
    // If misses increasing fast, calm tip
    const misses = Math.max(0, ctx.misses|0);
    const combo  = Math.max(0, ctx.combo|0);

    const dm = misses - ST.lastMisses;
    const dc = combo - ST.lastCombo;

    ST.lastMisses = misses;
    ST.lastCombo  = combo;

    if (dm >= 3){
      hard('MISS ขึ้นเร็วมาก—หยุดรัว 2 วิ เลือกยิงเป้าที่ชัวร์ แล้วค่อยกลับมาลากคอมโบ', 'miss-spike',
        ['control','miss'], { explain:`dm=${dm} misses=${misses}` });
      return;
    }

    if (dc <= -8 && misses >= 6){
      micro('คอมโบร่วงแรง: ลอง “ยิงช้าแต่ชัวร์” ก่อน 5 ครั้งติด แล้วค่อยเร่งสปีด', 'combo-drop',
        ['combo','accuracy'], { explain:`dc=${dc} combo=${combo}` });
    }
  }

  // ------------------- Public API -------------------
  function onStart(){
    if (ST.started) return;
    ST.started = true;

    say({
      type:'hello',
      level: isResearch ? 'micro' : 'hard',
      msg: isResearch
        ? 'เริ่มโหมดวิจัย: ระบบจะให้คำแนะนำน้อยลงและคงที่ เพื่อไม่รบกวนข้อมูล'
        : 'พร้อมลุย! เป้าหมายคือคุม GREEN → ผ่าน STORM MINI → เคลียร์ BOSS 🌩️',
      reason:'start',
      tags:['start','flow', isResearch?'research':'play']
    });
  }

  function onUpdate(ctx = {}){
    if (!ST.started) return;

    const t = nowMs();
    if (t - ST.lastCtxAt < 200) return; // avoid ultra spam
    ST.lastCtxAt = t;

    const skill = clamp(ctx.skill,0,1);
    const frus  = clamp(ctx.frustration,0,1);
    const acc   = clamp(ctx.accuracy ?? ctx.acc ?? ctx.accuracyGoodPct ?? 0, 0, 100);

    histSkill.push(skill);
    histFrus.push(frus);
    histAcc.push(acc>0 ? acc : 0);

    const stage = inferStage(ctx);
    ST.stage = stage;

    // Universal frustration control first (if severe)
    ruleFrustration(ctx);

    // Stage-aware tips (hydration friendly)
    const inStorm = !!ctx.inStorm;
    const inEnd   = !!ctx.inEndWindow;

    // If boss is active in your game, you can pass ctx.inBoss=true; but hydration passes boss via visuals.
    const inBoss = !!ctx.inBoss || (!!ctx.bossActive);

    if (stage === 1 && !inStorm){
      // not storm yet
      ruleStage1(ctx);
      return;
    }

    // storm path
    if (inStorm || inEnd){
      ruleStorm(ctx);
      // boss overlay tips (only if ctx indicates boss)
      if (inBoss) ruleBoss(ctx);
      return;
    }

    // Stage3 without explicit boss: remind prep
    if (stage === 3 && ST.stageTipsGiven[3] < (isResearch ? 1 : 2)){
      ST.stageTipsGiven[3]++;
      micro('Stage3: รอ “ช่วงท้ายพายุ” แล้วค่อยกัน 🌩️ — เก็บ 🛡️ ไว้ก่อนเข้า window', 's3-prep',
        ['stage3','boss','prep']);
    }
  }

  function onEnd(summary = {}){
    // End recap (short)
    const grade = String(summary.grade||'').toUpperCase() || '—';
    const acc = Number(summary.accuracyGoodPct||0);
    const miss = Number(summary.misses||0);
    const stageCleared = Number(summary.stageCleared||summary.stageCleared||0);
    const stormCycles = Number(summary.stormCycles||0);
    const stormSuccess = Number(summary.stormSuccess||0);
    const boss = Number(summary.bossClearCount||0);

    const msg =
      `จบเกม: เกรด ${grade} | Acc ${acc.toFixed(1)}% | Miss ${miss}` +
      ` | Stage ${stageCleared}/3` +
      (stormCycles>0 ? ` | Storm ${stormSuccess}/${stormCycles}` : '') +
      (boss>0 ? ` | Boss ✅` : '');

    say({
      type:'end',
      level:'micro',
      msg,
      reason:'end',
      tags:['end','summary']
    });

    // One actionable next step (deterministic)
    let next = 'เพิ่ม Accuracy และลด Miss';
    if (stageCleared < 1) next = 'โฟกัส Stage1: คุม GREEN ให้ผ่านก่อน';
    else if (stormCycles>0 && stormSuccess<=0) next = 'Stage2: ผ่าน Storm Mini (ทำ LOW/HIGH + BLOCK ช่วงท้าย)';
    else if (boss<=0) next = 'Stage3: เก็บ 🛡️ แล้วกัน 🌩️ ใน Boss Window ให้ครบ';
    else if (acc < 70) next = 'ดัน Accuracy ให้เกิน 70% (ยิงช้าแต่ชัวร์)';
    else if (miss > 15) next = 'ลด Miss ให้ต่ำกว่า 10';
    else next = 'ลากคอมโบยาว ๆ + ผ่านทุกพายุให้มากขึ้น';

    say({
      type:'next',
      level:'micro',
      msg:`เป้าหมายรอบหน้า: ${next}`,
      reason:'next',
      tags:['next','goal']
    });
  }

  return { onStart, onUpdate, onEnd };
}