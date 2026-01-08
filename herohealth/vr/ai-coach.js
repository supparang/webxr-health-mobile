// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (shared)
// ✅ Explainable micro-tips (reason + what to do)
// ✅ Rate-limit / cooldown (กันสแปม)
// ✅ Context-aware (storm/end-window/boss/shield/waterZone/accuracy/miss/combo)
// ✅ Hooks: onStart(), onUpdate(state), onEnd(summary)
// ✅ Emits: hha:coach { level, title, msg, reason, when, game }
//
// Usage:
//   import { createAICoach } from '../vr/ai-coach.js';
//   const coach = createAICoach({ emit, game:'hydration', cooldownMs:3000 });
//   coach.onStart(); coach.onUpdate({...}); coach.onEnd(summary);

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(opts = {}){
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } };

  const game = String(opts.game || 'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 2800, 600, 12000);
  const softCooldownMs = clamp(opts.softCooldownMs ?? (cooldownMs*1.2), 600, 20000);

  // “ห้ามยิงถี่” ต่อสถานการณ์เดียวกัน
  const perKeyCooldownMs = clamp(opts.perKeyCooldownMs ?? 12000, 2000, 60000);

  const S = {
    startedAt: 0,
    lastAt: 0,
    lastSoftAt: 0,
    lastKeyAt: Object.create(null),
    lastMsg: '',
    lastKey: '',
    tick: 0,
    lastState: null
  };

  function now(){ return Date.now(); }

  function canSpeak(kindKey, hard=false){
    const t = now();
    const cd = hard ? cooldownMs : softCooldownMs;
    if ((t - S.lastAt) < cd) return false;

    // per-key cooldown
    if (kindKey){
      const last = S.lastKeyAt[kindKey] || 0;
      if ((t - last) < perKeyCooldownMs) return false;
    }
    return true;
  }

  function markSpoke(kindKey){
    const t = now();
    S.lastAt = t;
    if (kindKey) S.lastKeyAt[kindKey] = t;
    S.lastKey = kindKey || '';
  }

  function say({ key, level='tip', title='', msg='', reason='', when='' }){
    if (!msg) return false;
    const k = String(key || title || level || 'coach');
    if (!canSpeak(k, true)) return false;

    // กันข้อความซ้ำติดกัน
    const sig = `${level}|${title}|${msg}`;
    if (sig === S.lastMsg && (now() - S.lastSoftAt) < (softCooldownMs*1.4)) return false;

    S.lastMsg = sig;
    S.lastSoftAt = now();
    markSpoke(k);

    emit('hha:coach', {
      game,
      level,
      title,
      msg,
      reason,
      when,
      ts: new Date().toISOString()
    });
    return true;
  }

  // ---------- Heuristic tips ----------
  function buildTips(st){
    // st = {
    //  skill,fatigue,frustration,inStorm,inEndWindow,waterZone,shield,misses,combo
    // }
    const tips = [];

    const skill = clamp(st.skill ?? 0.5, 0, 1);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);
    const frus = clamp(st.frustration ?? 0, 0, 1);

    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const zone = String(st.waterZone || '');
    const shield = st.shield|0;
    const misses = st.misses|0;
    const combo = st.combo|0;

    // 1) End-window & Shield: สำคัญสุดสำหรับ hydration stage2/3
    if (inStorm && inEnd){
      if (shield <= 0){
        tips.push({
          key:'end_no_shield',
          level:'warn',
          title:'End Window! 🌀',
          msg:'ตอนนี้คือ “ช่วงท้ายพายุ” — แต่ไม่มี 🛡️ แล้ว! ให้รีบเก็บ 🛡️ ที่โผล่มา แล้วค่อย BLOCK 🌩️/🥤 ในช่วงนี้',
          reason:'Mini ผ่านต้อง “BLOCK ใน End Window” และห้ามโดน BAD ตอนพายุ',
          when:'storm_end'
        });
      } else {
        tips.push({
          key:'end_block_now',
          level:'hot',
          title:'End Window! 🛡️',
          msg:`มี 🛡️ อยู่ ${shield} — โฟกัส BLOCK เป้า BAD ในช่วงท้ายพายุให้ผ่าน Mini / เคลียร์ Boss`,
          reason:'End Window คือหน้าต่างผ่าน Mini/Boss ที่ง่ายที่สุด (คุ้มสุด)',
          when:'storm_end'
        });
      }
    }

    // 2) Storm but not End yet
    if (inStorm && !inEnd){
      if (zone === 'GREEN'){
        tips.push({
          key:'storm_make_zone',
          level:'tip',
          title:'Storm Mini 🌀',
          msg:'ระหว่างพายุ “อย่าให้ค่าน้ำเป็น GREEN” — ปล่อยให้เป็น LOW/HIGH แล้วค่อยไป BLOCK ช่วงท้ายพายุ',
          reason:'Mini ต้องมีเงื่อนไข zone≠GREEN + pressure + end window + block',
          when:'storm_mid'
        });
      } else if (shield <= 0){
        tips.push({
          key:'storm_collect_shield',
          level:'tip',
          title:'เก็บโล่ก่อน 🛡️',
          msg:'ตอนนี้น้ำไม่ GREEN แล้ว ✅ ต่อไปคือ “เก็บ 🛡️” เก็บไว้ใช้ BLOCK ตอนท้ายพายุ',
          reason:'ถ้าไม่มีโล่ พอเจอ BAD ตอนท้ายพายุจะผ่าน Mini ยาก',
          when:'storm_mid'
        });
      }
    }

    // 3) Accuracy / control
    if (!inStorm){
      if (skill < 0.42){
        tips.push({
          key:'low_skill',
          level:'tip',
          title:'เล็งให้ชัวร์ 🎯',
          msg:'ลอง “เล็งค้างนิดเดียวแล้วค่อยยิง” ลดการรัว จะช่วย Accuracy ขึ้นและ MISS ลดลง',
          reason:'Accuracy สูง → เกรดขึ้นไว และช่วยให้ adaptive ยุติธรรมขึ้น',
          when:'calm'
        });
      } else if (combo >= 10 && misses <= 3){
        tips.push({
          key:'combo_push',
          level:'hot',
          title:'คอมโบกำลังมา! ⚡',
          msg:'รักษาจังหวะเดิม แล้วลากคอมโบต่อ — เกรดจะพุ่ง (S/SS/SSS)',
          reason:'คอมโบยาวทำให้คะแนนและเกรดดีขึ้นแบบทวีคูณ',
          when:'calm'
        });
      }
    }

    // 4) Frustration management
    if (frus >= 0.72 || misses >= 18){
      tips.push({
        key:'too_many_miss',
        level:'warn',
        title:'พักจังหวะนิดนึง 🧠',
        msg:'MISS เริ่มเยอะ — ลดความเร็วลง 10–20% แล้วเลือกยิงเฉพาะเป้าที่แน่ใจ ก่อนค่อยเร่งกลับ',
        reason:'คุม error rate จะผ่าน Stage2/3 ง่ายขึ้นมาก',
        when:'any'
      });
    }

    // 5) Fatigue gentle
    if (fatigue >= 0.78 && skill < 0.55){
      tips.push({
        key:'fatigue_tip',
        level:'tip',
        title:'ช่วงท้ายแล้ว 💪',
        msg:'โฟกัส “ยิงน้อยแต่ชัวร์” จะดีกว่ารัว — ลดพลาดช่วยคะแนนรวมชัดมาก',
        reason:'ท้ายเกมคนมักพลาดจากความล้า ทำให้เกรดตกเร็ว',
        when:'late'
      });
    }

    return tips;
  }

  function pickOneTip(st){
    const tips = buildTips(st);
    if (!tips.length) return null;

    // priority: warn/hot > tip
    const score = (t)=>{
      let s = 0;
      if (t.level === 'warn') s += 3;
      else if (t.level === 'hot') s += 2;
      else s += 1;

      // contextual boost
      if (t.when === 'storm_end') s += 2;
      if (t.when === 'storm_mid') s += 1;
      return s;
    };

    tips.sort((a,b)=>score(b)-score(a));
    return tips[0] || null;
  }

  // ---------- Public hooks ----------
  function onStart(){
    S.startedAt = now();
    S.tick = 0;
    S.lastState = null;

    // opening hint (เบา ๆ)
    say({
      key:'start_hint',
      level:'tip',
      title:'พร้อมลุย! 💧',
      msg:'Stage1: คุมให้น้ำอยู่ GREEN ให้นาน • Stage2: ช่วงพายุทำให้เป็น LOW/HIGH แล้ว BLOCK ตอนท้าย • Stage3: Boss Window ต้อง BLOCK 🌩️ ให้ครบ',
      reason:'อธิบายเส้นชัย 3 Stage แบบสั้น ๆ',
      when:'start'
    });
  }

  function onUpdate(state){
    S.tick++;
    S.lastState = state;

    const st = state || {};
    const tip = pickOneTip(st);
    if (!tip) return;

    // ให้พูดเฉพาะ “จังหวะมีเหตุผล” (ลดสแปม)
    // - storm_end: อนุญาตพูดไวขึ้นหน่อย
    const hard = (tip.when === 'storm_end');
    if (!canSpeak(tip.key, hard)) return;

    say(tip);
  }

  function onEnd(summary){
    // end wrap-up (พูด 1 ครั้ง)
    const s = summary || {};
    const acc = Number(s.accuracyGoodPct||0);
    const miss = Number(s.misses||0);
    const grade = String(s.grade||'C');
    const stormOk = Number(s.stormSuccess||0);
    const cycles = Number(s.stormCycles||0);
    const boss = Number(s.bossClearCount||0);

    let msg = `จบเกมแล้ว! เกรด ${grade} • Accuracy ${acc.toFixed(1)}% • MISS ${miss}`;
    msg += ` • Storm ${stormOk}/${Math.max(0,cycles)} • BossClear ${boss}`;

    // 1 actionable next step
    let next = 'เพิ่ม Accuracy และลด MISS';
    if ((s.goalsCleared|0) <= 0) next = 'โฟกัส Stage1: คุม GREEN ให้ผ่านก่อน';
    else if (cycles > 0 && stormOk <= 0) next = 'โฟกัส Stage2: ทำ LOW/HIGH + BLOCK ตอนท้ายพายุ';
    else if (boss <= 0) next = 'โฟกัส Stage3: รอ Boss Window แล้ว BLOCK 🌩️ ให้ครบ';
    else if (acc < 70) next = 'ดัน Accuracy > 70%';
    else if (miss > 12) next = 'ลด MISS < 10';
    else next = 'ลากคอมโบ + ผ่านทุกพายุให้ได้มากกว่าเดิม';

    say({
      key:'end_wrap',
      level:'tip',
      title:'สรุปจาก AI 👀',
      msg: `${msg}\nNext: ${next}`,
      reason:'ชี้ “สิ่งเดียวที่คุ้มสุด” สำหรับรอบถัดไป',
      when:'end'
    });
  }

  // optional debug
  function debug(){
    return {
      game,
      cooldownMs,
      perKeyCooldownMs,
      lastAt: S.lastAt,
      lastKey: S.lastKey,
      lastMsg: S.lastMsg
    };
  }

  return { onStart, onUpdate, onEnd, debug };
}