// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable Micro-tips) — PRODUCTION
// Exports: createAICoach
// ✅ Rate-limit + cooldown + dedupe
// ✅ Explainable: แปะเหตุผล/ตัวชี้วัดที่ทำให้แนะนำ
// ✅ Non-annoying: silence windows, priority, burst guard
// ✅ Emits via provided emit(name, detail)
//    - emit('hha:coach', { text, tone, reason, tags, t, game, priority })
// ✅ Works in Play + Research (deterministic-ish: no randomness required)

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
}
function clamp(v,a,b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}
function norm01(v){
  return clamp(v, 0, 1);
}

function makeKey(s){
  return String(s || '').trim().toLowerCase().slice(0, 140);
}

export function createAICoach(options){
  const opt = Object.assign({
    emit: null,
    game: 'generic',
    cooldownMs: 3000,          // min gap between tips
    hardCooldownMs: 1200,      // absolute gap even for urgent tips
    dedupeMs: 18000,           // don’t repeat same tip too soon
    burstMax: 3,               // max tips in rolling window
    burstWindowMs: 25000,
    silenceAfterStartMs: 900,  // initial quiet time after start
    silenceAfterEndMs: 999999, // not used but kept
    minChangeForNewTip: 0.08,  // avoid spamming with tiny metric changes
    debug: false
  }, options || {});

  const emit = (typeof opt.emit === 'function') ? opt.emit : (()=>{});

  const S = {
    started:false,
    ended:false,
    tStart:0,

    lastTipAt:-1e9,
    lastHardTipAt:-1e9,
    lastMetrics:null,

    // dedupe: map tipKey -> last shown ms
    lastShown:new Map(),

    // burst: list of tip timestamps
    burst:[],

    // session state snapshots
    lastStage:null,
    lastStorm:null,
    lastEndWindow:null,
    lastBoss:null,

    // lightweight counters to avoid repeating "obvious" tips
    hinted: new Set()
  };

  function log(...args){
    if (opt.debug) try{ console.log('[AICOACH]', ...args); }catch(_){}
  }

  function canSpeak(priority){
    const t = nowMs();
    if (!S.started || S.ended) return false;

    // initial silence window
    if ((t - S.tStart) < opt.silenceAfterStartMs && priority < 2) return false;

    // burst limit
    S.burst = S.burst.filter(x => (t - x) <= opt.burstWindowMs);
    if (S.burst.length >= opt.burstMax && priority < 3) return false;

    // cooldown
    if ((t - S.lastTipAt) < opt.cooldownMs && priority < 3) return false;

    // hard cooldown (always)
    if ((t - S.lastHardTipAt) < opt.hardCooldownMs) return false;

    return true;
  }

  function pushBurst(){
    const t = nowMs();
    S.burst.push(t);
    S.lastTipAt = t;
    S.lastHardTipAt = t;
  }

  function dedupeOk(text){
    const t = nowMs();
    const k = makeKey(text);
    const last = S.lastShown.get(k) || -1e9;
    if ((t - last) < opt.dedupeMs) return false;
    S.lastShown.set(k, t);
    return true;
  }

  function say({ text, tone='neutral', reason='', tags=[], priority=1 }){
    if (!text) return false;
    if (!dedupeOk(text)) return false;
    if (!canSpeak(priority)) return false;

    pushBurst();
    const payload = {
      text: String(text),
      tone,
      reason: String(reason || ''),
      tags: Array.isArray(tags) ? tags : [],
      t: Date.now(),
      game: opt.game,
      priority: priority|0
    };
    emit('hha:coach', payload);
    log('TIP', payload);
    return true;
  }

  function changedEnough(m){
    if (!S.lastMetrics) return true;
    const a = S.lastMetrics;
    const dk =
      Math.abs((m.skill||0) - (a.skill||0)) +
      Math.abs((m.frustration||0) - (a.frustration||0)) +
      Math.abs((m.fatigue||0) - (a.fatigue||0));
    return dk >= opt.minChangeForNewTip;
  }

  // ---------- Tip templates ----------
  function tipAim(m){
    const miss = m.misses|0;
    const combo = m.combo|0;
    if (miss >= 10 && combo <= 2){
      return {
        text: '🎯 ลอง “เล็งค้างนิดนึง” แล้วค่อยยิงนะ จะลดพลาดได้เยอะเลย',
        tone: 'help',
        reason: `miss=${miss}, combo=${combo}`,
        tags: ['aim','accuracy'],
        priority: 1
      };
    }
    return null;
  }

  function tipCombo(m){
    const skill = norm01(m.skill||0);
    const combo = m.combo|0;
    if (skill >= 0.65 && combo >= 8){
      return {
        text: '⚡ ดีมาก! รักษาคอมโบต่อเนื่อง คะแนนจะพุ่งเร็วมาก',
        tone: 'praise',
        reason: `skill=${skill.toFixed(2)}, combo=${combo}`,
        tags: ['combo','motivation'],
        priority: 1
      };
    }
    if (skill >= 0.55 && combo <= 1 && (m.misses|0) <= 6){
      return {
        text: '🔥 เริ่มนิ่งแล้ว! ลองลากคอมโบยาว ๆ เพื่ออัปเกรดเกรดเลย',
        tone: 'encourage',
        reason: `skill=${skill.toFixed(2)}, combo=${combo}`,
        tags: ['combo'],
        priority: 1
      };
    }
    return null;
  }

  function tipShield(m){
    const sh = m.shield|0;
    const inStorm = !!m.inStorm;
    const inEnd = !!m.inEndWindow;

    if (inStorm && inEnd && sh <= 0){
      return {
        text: '🛡️ ตอนนี้เป็น End Window! ถ้าไม่มีโล่ ให้หลบเป้าร้าย อย่าฝืนยิงมั่ว',
        tone: 'urgent',
        reason: `storm=endwindow, shield=${sh}`,
        tags: ['storm','shield','endwindow'],
        priority: 3
      };
    }

    if (!inStorm && sh <= 0 && !S.hinted.has('shield-save')){
      S.hinted.add('shield-save');
      return {
        text: '🛡️ เห็นโล่แล้วเก็บไว้ก่อนนะ เอาไว้ BLOCK ช่วงพายุจะผ่าน Mini ง่ายขึ้น',
        tone: 'help',
        reason: `pre-storm, shield=${sh}`,
        tags: ['shield'],
        priority: 1
      };
    }

    if (inStorm && !inEnd && sh >= 2 && !S.hinted.has('shield-hold')){
      S.hinted.add('shield-hold');
      return {
        text: '🛡️ มีโล่พอแล้ว! เก็บไว้ใช้ช่วงท้ายพายุ (End Window) จะคุ้มสุด',
        tone: 'help',
        reason: `storm=active, shield=${sh}`,
        tags: ['shield','timing'],
        priority: 2
      };
    }

    return null;
  }

  function tipWaterZone(m){
    const z = String(m.waterZone || '').toUpperCase();
    const inStorm = !!m.inStorm;

    if (!inStorm && (z === 'LOW' || z === 'HIGH')){
      return {
        text: `💧 ตอนนี้น้ำเป็น ${z} — ยิง 💧 เพื่อดันกลับเข้า GREEN ให้เร็วขึ้นนะ`,
        tone: 'help',
        reason: `zone=${z}, inStorm=${inStorm}`,
        tags: ['water','zone'],
        priority: 1
      };
    }

    if (inStorm && z === 'GREEN'){
      return {
        text: '🌀 ตอนพายุ “ต้องไม่ GREEN” นะ! ปรับให้เป็น LOW/HIGH แล้วค่อยรอ BLOCK ช่วงท้าย',
        tone: 'urgent',
        reason: `storm=active, zone=${z}`,
        tags: ['storm','zone'],
        priority: 3
      };
    }

    return null;
  }

  function tipFrustration(m){
    const f = norm01(m.frustration||0);
    if (f >= 0.72){
      return {
        text: '🧊 ใจเย็น ๆ นะ ยิงช้าแต่ชัวร์ก่อน 3–5 เป้า แล้วค่อยเร่งความเร็ว',
        tone: 'calm',
        reason: `frustration=${f.toFixed(2)}`,
        tags: ['mindset','accuracy'],
        priority: 2
      };
    }
    return null;
  }

  function tipBoss(m){
    const inStorm = !!m.inStorm;
    const inBoss = !!m.inBoss; // optional flag from game
    const sh = m.shield|0;

    if (inStorm && inBoss){
      if (sh > 0){
        return {
          text: '🌩️ Boss Window มาแล้ว! ใช้ 🛡️ BLOCK 🌩️ ให้ครบตามจำนวน!',
          tone: 'urgent',
          reason: `bossWindow=1, shield=${sh}`,
          tags: ['boss','shield'],
          priority: 3
        };
      }
      return {
        text: '🌩️ Boss Window! แต่ไม่มีโล่… เลือกยิงเป้าดี ๆ อย่าชน 🌩️ ตรง ๆ',
        tone: 'urgent',
        reason: `bossWindow=1, shield=${sh}`,
        tags: ['boss'],
        priority: 3
      };
    }
    return null;
  }

  // Optional: allow game to push events in (stage change etc.)
  function onEvent(detail){
    try{
      const d = detail || {};
      if (d.type === 'stage'){
        const st = d.stage|0;
        if (S.lastStage !== st){
          S.lastStage = st;
          if (st === 1) say({ text:'✅ เป้าหมายตอนนี้: คุม GREEN ให้ครบก่อนนะ', tone:'help', reason:'stage=1', tags:['stage'], priority:2 });
          if (st === 2) say({ text:'🌀 เข้าด่านพายุแล้ว! จำสูตร: LOW/HIGH + End Window + BLOCK', tone:'help', reason:'stage=2', tags:['stage','storm'], priority:2 });
          if (st === 3) say({ text:'🌩️ ด่านบอส! เก็บโล่ไว้ใช้ BLOCK ช่วง Boss Window', tone:'help', reason:'stage=3', tags:['stage','boss'], priority:2 });
        }
      }
    }catch(_){}
  }

  function decide(m){
    const urgent = (!!m.inStorm && !!m.inEndWindow) || (!!m.inBoss);
    if (!urgent && !changedEnough(m)) return;

    let t = null;

    // urgent first
    t = tipBoss(m);
    if (t && say(t)) return;

    t = tipShield(m);
    if (t && say(t)) return;

    t = tipWaterZone(m);
    if (t && say(t)) return;

    // then calm
    t = tipFrustration(m);
    if (t && say(t)) return;

    // then skill coaching
    t = tipAim(m);
    if (t && say(t)) return;

    t = tipCombo(m);
    if (t && say(t)) return;
  }

  return {
    onStart(){
      S.started = true;
      S.ended = false;
      S.tStart = nowMs();
      S.lastTipAt = -1e9;
      S.lastHardTipAt = -1e9;
      S.lastMetrics = null;
      S.lastShown.clear();
      S.burst = [];
      S.hinted.clear();
      S.lastStage = null;

      setTimeout(()=>{
        say({
          text: '👋 พร้อมแล้ว! โฟกัส “คุม GREEN” ก่อน แล้วเดี๋ยวพายุจะมาให้ทำ Mini',
          tone:'neutral',
          reason:'start',
          tags:['intro'],
          priority: 2
        });
      }, Math.min(950, opt.silenceAfterStartMs + 50));
    },

    onUpdate(metrics){
      if (!S.started || S.ended) return;
      const m = Object.assign({}, metrics || {});
      m.skill = norm01(m.skill||0);
      m.fatigue = norm01(m.fatigue||0);
      m.frustration = norm01(m.frustration||0);
      m.inBoss = !!m.inBoss;
      decide(m);
      S.lastMetrics = m;
    },

    onEnd(summary){
      if (!S.started || S.ended) return;
      S.ended = true;

      const grade = String(summary?.grade || '');
      const acc = Number(summary?.accuracyGoodPct || 0);
      const miss = Number(summary?.misses || 0);
      const stage = Number(summary?.stageCleared || 0);

      let line = '🏁 จบเกมแล้ว!';
      if (grade) line += ` เกรด ${grade}`;
      if (acc) line += ` • Accuracy ${acc.toFixed(0)}%`;
      if (Number.isFinite(miss)) line += ` • Miss ${miss|0}`;
      if (stage) line += ` • ผ่านถึง Stage ${stage}`;

      // end message bypass cooldown
      emit('hha:coach', {
        text: line,
        tone: (grade==='SSS'||grade==='SS'||grade==='S') ? 'praise' : 'neutral',
        reason: 'end',
        tags: ['end'],
        t: Date.now(),
        game: opt.game,
        priority: 3
      });
    },

    onEvent
  };
}