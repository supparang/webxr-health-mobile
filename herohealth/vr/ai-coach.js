// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (Explainable Micro-tips + Rate-limit)
// ✅ createAICoach({ emit, game, cooldownMs, elementId })
// ✅ Methods: onStart(), onUpdate(ctx), onEnd(summary)
// ✅ Emits: emit('hha:coach', {type:'tip'|'start'|'end', key, text, reason, priority, game})
// ✅ Default HUD target: #water-tip (if exists) but safe for other games too.

'use strict';

export function createAICoach(options = {}){
  const emit = typeof options.emit === 'function' ? options.emit : (()=>{});
  const game = String(options.game || 'generic');
  const baseCooldownMs = clampInt(options.cooldownMs ?? 2800, 600, 12000);
  const elementId = String(options.elementId || 'water-tip');
  const debug = !!options.debug;

  const S = {
    started:false,
    lastEmitAt:0,
    lastKey:'',
    repeatCount:0,
    lastCtx:null,
    lastPriority:0,
  };

  function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function log(...a){ if (debug) console.log('[AICOACH]', ...a); }

  function $(id){
    try{ return document.getElementById(id); }catch(_){ return null; }
  }

  function setHUD(text){
    const el = $(elementId);
    if (el) el.textContent = String(text || '');
  }

  function say({ key, text, reason, priority=1, force=false }){
    const t = nowMs();
    const cd = cooldownFor(priority);

    // anti-spam
    if (!force){
      if (t - S.lastEmitAt < cd) return false;

      // avoid repeating same key too frequently
      if (key && key === S.lastKey){
        S.repeatCount++;
        if (S.repeatCount >= 2) return false;
      } else {
        S.repeatCount = 0;
      }
    }

    S.lastEmitAt = t;
    S.lastKey = key || '';
    S.lastPriority = priority;

    setHUD(text);

    emit('hha:coach', {
      type:'tip',
      key,
      text,
      reason,
      priority,
      game
    });

    log('tip', {key, priority, reason, text});
    return true;
  }

  function cooldownFor(priority){
    // priority 4 = urgent -> shorter cooldown
    if (priority >= 4) return Math.max(650, Math.floor(baseCooldownMs * 0.28));
    if (priority === 3) return Math.max(900, Math.floor(baseCooldownMs * 0.45));
    if (priority === 2) return Math.max(1200, Math.floor(baseCooldownMs * 0.70));
    return baseCooldownMs;
  }

  function isLowHighZone(z){
    z = String(z||'').toUpperCase();
    return (z === 'LOW' || z === 'HIGH');
  }

  function pickTip(ctx){
    // ctx examples (hydration sends these):
    // { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo, stage?, bossActive?, bossNeed?, bossBlocked? }
    const waterZone = String(ctx.waterZone || '').toUpperCase();
    const shield = toInt(ctx.shield, 0);
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const combo = toInt(ctx.combo, 0);
    const misses = toInt(ctx.misses, 0);

    const stage = toInt(ctx.stage, 0);           // optional
    const bossActive = !!ctx.bossActive;         // optional
    const bossNeed = toInt(ctx.bossNeed, 0);     // optional
    const bossBlocked = toInt(ctx.bossBlocked, 0); // optional

    const frustration = clamp01(toNum(ctx.frustration, 0));
    const fatigue = clamp01(toNum(ctx.fatigue, 0));
    const skill = clamp01(toNum(ctx.skill, 0));

    // ---------------------------
    // PRIORITY 4: End Window / Boss urgent
    // ---------------------------
    if (inEnd){
      if (shield > 0){
        // if boss info present, mention progress
        if (bossActive && bossNeed > 0){
          return {
            key:'end_block_boss',
            priority:4,
            reason:'inEndWindow && shield>0 && bossActive',
            text:`⏱️ END WINDOW! ใช้ 🛡️ BLOCK ตอนนี้เลย — BOSS ${bossBlocked}/${bossNeed}`
          };
        }
        return {
          key:'end_block_now',
          priority:4,
          reason:'inEndWindow && shield>0',
          text:'⏱️ END WINDOW! ใช้ 🛡️ BLOCK ตอนนี้เลย (ห้ามโดน BAD)'
        };
      }
      return {
        key:'end_need_shield',
        priority:4,
        reason:'inEndWindow && shield==0',
        text:'⚠️ END WINDOW แต่ไม่มี 🛡️ — รีบเก็บ Shield ก่อนพายุถัดไป!'
      };
    }

    // Boss active (แต่ยังไม่เข้า end window) — เตือนก่อน
    if (bossActive){
      if (shield > 0){
        return {
          key:'boss_ready',
          priority:3,
          reason:'bossActive && shield>0',
          text:`🌩️ BOSS WINDOW! เตรียม BLOCK — ตอนนี้ ${bossBlocked}/${bossNeed || '?'}`
        };
      }
      return {
        key:'boss_no_shield',
        priority:3,
        reason:'bossActive && shield==0',
        text:'🌩️ BOSS WINDOW แต่ไม่มี 🛡️ — รอบหน้าเก็บ Shield ไว้ 1–2 อันก่อนเข้าพายุ'
      };
    }

    // ---------------------------
    // PRIORITY 3: Storm mini guidance
    // ---------------------------
    if (inStorm){
      if (!isLowHighZone(waterZone)){
        // ยัง GREEN ระหว่างพายุ -> ผ่าน mini ยาก
        if (shield > 0){
          return {
            key:'storm_leave_green_safe',
            priority:3,
            reason:'inStorm && waterZone==GREEN && shield>0',
            text:'🌀 พายุมาแล้ว: ตอนนี้ยัง GREEN — ทำให้น้ำเป็น LOW/HIGH ก่อน แล้วค่อย BLOCK ช่วงท้าย'
          };
        }
        return {
          key:'storm_leave_green',
          priority:3,
          reason:'inStorm && waterZone==GREEN && shield==0',
          text:'🌀 พายุมาแล้ว: ยัง GREEN — พยายามให้หลุด GREEN เป็น LOW/HIGH และอย่าโดน BAD'
        };
      }
      // อยู่ LOW/HIGH แล้ว
      if (shield <= 0){
        return {
          key:'storm_get_shield',
          priority:3,
          reason:'inStorm && low/high && shield==0',
          text:'🛡️ ตอนนี้ LOW/HIGH แล้ว — เก็บ Shield ให้ได้ แล้วรอ END WINDOW เพื่อ BLOCK'
        };
      }
      return {
        key:'storm_hold_ready',
        priority:2,
        reason:'inStorm && low/high && shield>0',
        text:'✅ LOW/HIGH พร้อมแล้ว — เก็บ Shield เพิ่มได้ แล้วรอ END WINDOW เพื่อ BLOCK'
      };
    }

    // ---------------------------
    // PRIORITY 2: General play tips (outside storm)
    // ---------------------------
    // ถ้า MISS เริ่มสูง ให้ลดความรัว
    if (misses >= 18 && frustration > 0.55){
      return {
        key:'reduce_spam',
        priority:2,
        reason:'misses high & frustration',
        text:'💥 MISS เยอะ: ลดการรัว เล็งนิ่ง ๆ ก่อนยิง (ยิงชัวร์ดีกว่ายิงถี่)'
      };
    }

    // combo ดี -> เชียร์ให้ลากคอมโบ
    if (combo >= 10 && skill >= 0.55){
      return {
        key:'keep_combo',
        priority:2,
        reason:'combo>=10',
        text:'⚡ คอมโบกำลังมา! เล็งให้ชัวร์ ลากคอมโบยาว ๆ คะแนนพุ่ง'
      };
    }

    // Shield management
    if (shield <= 0){
      return {
        key:'collect_shield',
        priority:2,
        reason:'shield==0',
        text:'🛡️ ทิป: เก็บ Shield ไว้ก่อนพายุอย่างน้อย 1 อัน จะผ่าน End Window ง่ายมาก'
      };
    }

    // Stage hint (optional, if stage provided)
    if (stage === 1){
      return {
        key:'stage1_green',
        priority:1,
        reason:'stage==1',
        text:'🎯 Stage1: โฟกัสยิง 💧 ให้คุมให้อยู่ GREEN ต่อเนื่อง (สะสมเวลา)'
      };
    }
    if (stage === 2){
      return {
        key:'stage2_mini',
        priority:1,
        reason:'stage==2',
        text:'🎯 Stage2: STORM ต้องทำ LOW/HIGH + BLOCK ช่วงท้าย (End Window) และห้ามโดน BAD'
      };
    }
    if (stage === 3){
      return {
        key:'stage3_boss',
        priority:1,
        reason:'stage==3',
        text:'🎯 Stage3: รอ Boss Window แล้วใช้ 🛡️ BLOCK 🌩️ ให้ครบตามจำนวน'
      };
    }

    // Default
    // ถ้า fatigue สูง: ให้ข้อความสั้นช่วยโฟกัส
    if (fatigue > 0.75){
      return {
        key:'focus_short',
        priority:1,
        reason:'fatigue high',
        text:'👀 โฟกัสสั้น ๆ: ยิงเป้าที่ชัวร์ + เก็บ Shield รอพายุ'
      };
    }

    return {
      key:'default',
      priority:1,
      reason:'default',
      text:'💧 ทิป: คุม GREEN ให้ยาว + เก็บ 🛡️ ไว้ทำพายุ (End Window คือจังหวะทอง)'
    };
  }

  function onStart(){
    if (S.started) return;
    S.started = true;
    S.lastEmitAt = 0;
    S.lastKey = '';
    S.repeatCount = 0;

    emit('hha:coach', { type:'start', game });

    // set initial hint (gentle)
    setHUD('💧 เริ่มเลย: คุม GREEN ให้ได้ก่อน แล้วเก็บ 🛡️ ไว้ทำพายุ');
  }

  function onUpdate(ctx = {}){
    S.lastCtx = ctx;

    // allow forced urgent reminders if state flips to urgent
    const tip = pickTip(ctx);
    const urgent = tip.priority >= 4;

    // force only when switching into urgent state (so it shows immediately)
    const force = urgent && (S.lastPriority < 4);

    say({ ...tip, force });
  }

  function onEnd(summary = {}){
    emit('hha:coach', { type:'end', game, summary });

    const grade = String(summary.grade || '').toUpperCase();
    const acc = toNum(summary.accuracyGoodPct, 0);
    const miss = toInt(summary.misses, 0);
    const stage = toInt(summary.stageCleared, 0);
    const storms = toInt(summary.stormCycles, 0);
    const ok = toInt(summary.stormSuccess, 0);
    const boss = toInt(summary.bossClearCount, 0);

    const lines = [];
    if (stage >= 3 || boss > 0) lines.push('✅ เคลียร์บอสแล้ว! เก่งมาก');
    else if (stage === 2) lines.push('🔥 เหลือบอสอีกนิดเดียว: เก็บ 🛡️ แล้วรอ Boss Window');
    else if (stage === 1) lines.push('🎯 ผ่าน Stage1 ก่อน: คุม GREEN ให้ยาว ๆ');
    else lines.push('🎯 เริ่มใหม่: โฟกัสคุม GREEN ก่อน');

    if (storms > 0){
      if (ok <= 0) lines.push('🌀 STORM ยังไม่ผ่าน: ต้อง LOW/HIGH + BLOCK ช่วงท้าย และห้ามโดน BAD');
      else lines.push(`🌀 STORM ผ่านแล้ว ${ok}/${storms}`);
    }

    if (acc < 60) lines.push('🎯 Accuracy ต่ำ: เล็งนิ่งก่อนยิง (ช้าแต่ชัวร์)');
    else if (acc >= 80) lines.push('⚡ Accuracy ดีมาก: ลากคอมโบจะได้ S/SS');

    if (miss >= 20) lines.push('💥 MISS เยอะ: ลดการรัว เลือกยิงเป้าที่แน่ใจ');

    if (grade) lines.push(`🏁 เกรดรอบนี้: ${grade}`);

    setHUD(lines.join(' • '));
  }

  return { onStart, onUpdate, onEnd };
}

// ---- utils ----
function clamp01(x){ x = Number(x)||0; return x<0?0:(x>1?1:x); }
function clampInt(x,a,b){ x = parseInt(x,10); if(!Number.isFinite(x)) x=a; return x<a?a:(x>b?b:x); }
function toInt(x, d=0){ x = parseInt(x,10); return Number.isFinite(x)?x:d; }
function toNum(x, d=0){ x = Number(x); return Number.isFinite(x)?x:d; }