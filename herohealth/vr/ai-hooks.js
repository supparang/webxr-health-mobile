/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks — GroupsVR
✅ Disabled by default
✅ Enable in PLAY with ?ai=1 (run=play only)
✅ Explainable micro-tips + rate-limit
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function emitCoach(text, mood){
    try{ root.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text, mood } })); }catch(_){}
  }

  const AI = {
    enabled:false,
    runMode:'play',
    seed:'',
    _lastTipAt:0,
    _cooldownMs:5200,
    _lastJudgeAt:0,
    _streakMiss:0,
    _streakJunk:0,
    _streakWrong:0,
    _acc:0,
    _grade:'C',
    _miniUrgent:false,
    _stormUrgent:false,
    _lastMiniSeenAt:0,
  };

  function canTip(){
    const t = nowMs();
    if (!AI.enabled) return false;
    if (AI.runMode === 'research') return false;
    if (t - AI._lastTipAt < AI._cooldownMs) return false;
    AI._lastTipAt = t;
    return true;
  }

  function tip(text, mood){
    if (!canTip()) return;
    emitCoach(text, mood || 'neutral');
  }

  function onJudge(ev){
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    AI._lastJudgeAt = nowMs();

    if (k === 'miss'){
      AI._streakMiss++;
      if (AI._streakMiss >= 2){
        tip('พลาดติดกัน 😤 เพราะยิงไม่โดนเป้า/จังหวะไวเกินไป → “หยุดครึ่งจังหวะ” แล้วค่อยยิงจากกลางจอ', 'sad');
      }
      return;
    }

    // reset miss streak on any hit
    AI._streakMiss = 0;

    if (k === 'bad'){
      // เราไม่รู้ว่า bad มาจาก wrong/junk ใน event นี้ → ใช้ heuristic จากข้อความ/สถานะอื่น
      // ปล่อยให้ handler groups:progress + safe.js breakdown ช่วย
      return;
    }

    if (k === 'good'){
      // เมื่อเล่นดีมาก → tip ย้ำกลยุทธ์
      if (AI._acc >= 85 && (AI._grade==='S' || AI._grade==='SS' || AI._grade==='SSS')){
        tip('โหดมาก 🔥 เพราะความแม่นสูง → รักษาจังหวะเดิม แล้ว “คุมคอมโบ” อย่ายิงถี่ตอนพายุ', 'happy');
      }
    }
  }

  function onRank(ev){
    const d = ev.detail||{};
    AI._acc = Number(d.accuracy||0);
    AI._grade = String(d.grade||'C');

    if (AI._acc <= 55){
      tip('ความแม่นยังต่ำ 📉 เพราะโดน “ผิดหมู่/ขยะ” เยอะ → โฟกัสอ่านชื่อหมู่ใน GOAL ก่อนยิงทุกครั้ง', 'neutral');
    }
  }

  function onProgress(ev){
    const d = ev.detail||{};
    const kind = String(d.kind||'');
    const why  = String(d.why||'');

    if (kind === 'miss'){
      if (why === 'junk'){
        AI._streakJunk++;
        AI._streakWrong = 0;
        if (AI._streakJunk >= 2){
          tip('โดนขยะติดกัน 🗑️ เพราะยิงเร็วเกิน/ไม่แยกสี → เล็งเฉพาะเป้าหมู่ที่ถูก แล้ว “ปล่อยขยะผ่าน”', 'sad');
        }
      } else if (why === 'wrong'){
        AI._streakWrong++;
        AI._streakJunk = 0;
        if (AI._streakWrong >= 2){
          tip('ยิงผิดหมู่ซ้ำ 😵 เพราะสลับหมู่แล้วไม่ทันตั้งตัว → ดู Power เต็มเมื่อไหร่ “หยุดยิง 1 วิ” แล้วอ่านหมู่ใหม่', 'neutral');
        }
      } else if (why === 'expire_good'){
        tip('เป้าหลุดเวลา ⏳ เพราะลังเลนานไป → เลือกยิง “เป้าที่ใกล้กลางจอ” ก่อน จะคุมเวลาง่ายขึ้น', 'neutral');
      }
      return;
    }

    if (kind === 'storm_on'){
      tip('พายุมา 🌪️ เพราะรอบนี้สปีดจะเร็วขึ้น → ลดการยิงรัว แล้วเลือกยิงทีละเป้าให้ชัวร์', 'fever');
    }
    if (kind === 'boss_spawn'){
      tip('บอสมา 👊 เพราะจบรอบพายุ → จัด “ยิงต่อเนื่อง 3–4 นัด” จากกลางจอ จะละลายไว', 'fever');
    }
    if (kind === 'perfect_switch'){
      tip('สลับหมู่แล้ว ✅ เพราะ Power เต็ม → อ่าน GOAL ใหม่ก่อนยิงทันที จะกัน wrong/junk ได้', 'happy');
    }
  }

  function onQuest(ev){
    const d = ev.detail||{};
    const left = Number(d.miniTimeLeftSec||0);
    AI._miniUrgent = (left>0 && left<=3);

    if (AI._miniUrgent){
      tip('MINI ใกล้หมดเวลา ⚡ เพราะเหลือไม่กี่วินาที → ยิงเป้า “ใกล้กลางจอ” ก่อน อย่าลากสายตาไกล', 'fever');
    }
  }

  AI.attach = function(cfg){
    cfg = cfg || {};
    AI.runMode = String(cfg.runMode||'play');
    AI.seed = String(cfg.seed||'');
    AI.enabled = !!cfg.enabled && (AI.runMode !== 'research');

    // detach old (simple: once per page load; guard)
    if (AI._wired) return;
    AI._wired = true;

    root.addEventListener('hha:judge', onJudge, {passive:true});
    root.addEventListener('hha:rank', onRank, {passive:true});
    root.addEventListener('groups:progress', onProgress, {passive:true});
    root.addEventListener('quest:update', onQuest, {passive:true});

    // first tip on enable
    if (AI.enabled){
      AI._lastTipAt = nowMs() - 99999;
      tip('AI Coach เปิดแล้ว 🤖 เพราะคุณใส่ ?ai=1 → ผมจะช่วยเตือนจังหวะ/ความแม่นแบบไม่รบกวน (มีคูลดาวน์)', 'happy');
    }
  };

  NS.AIHooks = AI;

})(typeof window!=='undefined' ? window : globalThis);