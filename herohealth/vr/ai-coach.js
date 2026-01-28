// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION
// ✅ createAICoach({ emit, game, cooldownMs }) -> { onStart, onUpdate, onEnd }
// ✅ Explainable micro-tips (rate-limited)
// ✅ Works with hydration.safe.js immediately

'use strict';

export function createAICoach(opts = {}){
  const emit = typeof opts.emit === 'function' ? opts.emit : (_name,_detail)=>{};
  const game = String(opts.game || 'hha');
  const cooldownMs = Math.max(800, Number(opts.cooldownMs || 2800));

  const S = {
    started:false,
    ended:false,
    lastTipAt:0,
    lastKey:'',
    lastCtx:null,
    tipCount:0,
    // short “memory” to avoid repeating
    seen: Object.create(null),
  };

  function nowMs(){
    try{ return performance.now(); }catch(_){ return Date.now(); }
  }

  function canSpeak(key){
    const t = nowMs();
    if ((t - S.lastTipAt) < cooldownMs) return false;
    if (key && key === S.lastKey) return false;
    // extra anti-spam: if we already said same key too often
    if (key && S.seen[key] && S.seen[key] >= 3) return false;
    return true;
  }

  function say(key, message, why, meta={}){
    if (!canSpeak(key)) return false;

    const detail = Object.assign({
      type: 'tip',
      game,
      key,
      message,
      why: why || '',
      ts: Date.now(),
      priority: meta.priority ?? 0.5,
      tag: meta.tag || 'coach'
    }, meta || {});

    S.lastTipAt = nowMs();
    S.lastKey = key || '';
    S.tipCount++;
    if (key){
      S.seen[key] = (S.seen[key] || 0) + 1;
    }

    emit('hha:coach', detail);
    return true;
  }

  function pct(n){
    n = Number(n)||0;
    return Math.max(0, Math.min(100, n));
  }

  function pickTip(ctx){
    // ctx schema is “best-effort” (hydration.safe.js sends these keys)
    const inStorm = !!ctx.inStorm;
    const inEndWindow = !!ctx.inEndWindow;
    const waterZone = String(ctx.waterZone || '');
    const shield = Number(ctx.shield || 0);
    const misses = Number(ctx.misses || 0);
    const combo = Number(ctx.combo || 0);
    const skill = Math.max(0, Math.min(1, Number(ctx.skill ?? 0.5)));
    const fatigue = Math.max(0, Math.min(1, Number(ctx.fatigue ?? 0)));
    const frustration = Math.max(0, Math.min(1, Number(ctx.frustration ?? 0.2)));

    // 1) Storm End Window / Boss: top priority
    if (inStorm && inEndWindow){
      if (shield <= 0){
        return {
          key:'storm_end_need_shield',
          msg:'⏱️ เข้า End Window แล้ว! แต่ไม่มี 🛡️ — รีบเก็บ 🛡️ ก่อนพายุรอบหน้าไว้ BLOCK ตอนท้าย',
          why:'ช่วงท้ายพายุคือจังหวะสำคัญของ Mini/Boss และต้องใช้ Shield เพื่อ BLOCK'
        };
      }
      return {
        key:'storm_end_block_now',
        msg:'⏱️ End Window! ใช้ 🛡️ BLOCK 🌩️/🥤 ให้ครบ “ห้ามโดน BAD”',
        why:'Mini/Boss จะนับผ่านก็ต่อเมื่อ BLOCK ช่วงท้ายและไม่โดนโจมตี'
      };
    }

    // 2) In Storm (but not end window): stay in required side
    if (inStorm){
      if (waterZone === 'GREEN'){
        return {
          key:'storm_leave_green',
          msg:'🌀 STORM: อย่าอยู่ GREEN — ดันน้ำไปฝั่ง LOW หรือ HIGH ตามโจทย์ก่อน แล้วค่อยคุมให้นิ่ง',
          why:'Mini ต้องอยู่ฝั่งที่กำหนด + สะสม pressure เพื่อผ่านพายุ'
        };
      }
      if (shield <= 0){
        return {
          key:'storm_get_shield',
          msg:'🛡️ แนะนำ: เก็บ Shield สัก 1–2 อัน “ก่อน” เข้า End Window',
          why:'ปลายพายุจะต้อง BLOCK ถ้าไม่มี Shield จะผ่าน Mini/Boss ยากมาก'
        };
      }
      return {
        key:'storm_keep_side',
        msg:'🌀 STORM: คุมน้ำให้นิ่งในฝั่งที่กำหนด + เก็บ 🛡️ รอปลายพายุ',
        why:'ความนิ่งช่วยให้ pressure ผ่านไว และพร้อม BLOCK ตอนท้าย'
      };
    }

    // 3) Water control (outside storm)
    if (waterZone !== 'GREEN'){
      return {
        key:'water_back_green',
        msg:'💧 โซนน้ำหลุดแล้ว — ยิง 💧 เพื่อดึงกลับเข้า GREEN (อย่ารัว ให้เล็งชัวร์)',
        why:'Stage 1 ต้องสะสมเวลาใน GREEN และคุมให้เสถียร'
      };
    }

    // 4) Miss / accuracy management
    if (misses >= 10 && frustration > 0.55){
      return {
        key:'reduce_spam',
        msg:'🎯 MISS เริ่มเยอะ — ลดการรัว แล้วเลือกยิงเป้าที่ “ชัวร์” ก่อน คอมโบจะกลับมาเอง',
        why:'ยิงพลาดบ่อยทำให้คะแนนและคุมน้ำยากขึ้น'
      };
    }

    // 5) Combo encouragement
    if (combo >= 12 && skill > 0.65){
      return {
        key:'combo_push',
        msg:'⚡ คอมโบกำลังดี! ลากต่ออีกนิด คะแนนจะพุ่งเร็วมาก',
        why:'คอมโบสูงช่วยดันเกรดและความท้าทายแบบสนุก'
      };
    }

    // 6) Fatigue pacing
    if (fatigue > 0.75 && misses > 0){
      return {
        key:'late_game_pace',
        msg:'⏳ ช่วงท้ายแล้ว — เล่นนิ่ง ๆ เน้นชัวร์ + เก็บ 🛡️ เผื่อพายุ',
        why:'ท้ายเกมมักพลาดง่าย ถ้าเล่นนิ่งจะเก็บแต้มได้ต่อเนื่อง'
      };
    }

    return null;
  }

  function onStart(){
    S.started = true;
    S.ended = false;
    S.lastTipAt = 0;
    S.lastKey = '';
    S.tipCount = 0;
    S.seen = Object.create(null);

    say('start', '👋 พร้อมแล้ว! คุมโซนน้ำให้อยู่ GREEN แล้วเตรียม 🛡️ ไว้ทำ STORM', 'เริ่มเกม: เป้าหมายหลักคือ GREEN + Shield');
  }

  function onUpdate(ctx = {}){
    if (!S.started || S.ended) return;
    S.lastCtx = ctx;

    const tip = pickTip(ctx);
    if (!tip) return;

    // mild priority bias
    const priority = (ctx.inStorm && ctx.inEndWindow) ? 0.95 : (ctx.inStorm ? 0.8 : 0.55);
    say(tip.key, tip.msg, tip.why, { priority });
  }

  function onEnd(summary = {}){
    if (S.ended) return;
    S.ended = true;

    // small, non-spammy wrap-up
    const grade = String(summary.grade || '');
    const acc = pct(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const mini = Number(summary.stormSuccess || 0);
    const boss = Number(summary.bossClearCount || 0);

    let msg = `🏁 จบเกม! เกรด ${grade} • Accuracy ${acc.toFixed(0)}% • MISS ${miss}`;
    if (mini > 0) msg += ` • Mini ผ่าน ${mini}`;
    if (boss > 0) msg += ` • Boss Clear ✅`;

    emit('hha:coach', {
      type:'end',
      game,
      message: msg,
      ts: Date.now()
    });
  }

  return { onStart, onUpdate, onEnd };
}