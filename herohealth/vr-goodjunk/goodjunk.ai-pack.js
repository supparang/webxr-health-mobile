// === /herohealth/vr-goodjunk/goodjunk.ai-pack.js ===
// GoodJunkVR — AI PACK (FAIR) v1
// ✅ (1) Missions: GOAL chain + MINI quest + quest:update
// ✅ (2) DD Fair: adjust spawn/ttl/ratio every 1s (play only)
// ✅ (3) AI Prediction: miss-burst risk -> coach tip + assist spawn suggestion
// ✅ (4) DeepLearning-ready: telemetry features + dlHook stub (no heavy inference)
//
// Integrate from goodjunk.safe.js:
//   import { createGoodJunkAIPack } from './goodjunk.ai-pack.js';
//   const AI = createGoodJunkAIPack({ mode: runMode, emit, nowMs, seed, rng });
//   AI.bindHUD({ setGoalText, setMiniText, setMissionPeek }); // optional
//   AI.onStart({ timePlanSec, view, diff });
//   AI.onSpawn({ kind, ttlMs, groupId });
//   AI.onHit({ kind, groupId, shieldRemaining, fever, score, combo, miss });
//   AI.onExpireGood({ groupId, shieldRemaining, fever, score, combo, miss });
//   every 1s -> AI.onTick1s({ ...metrics... });
//   end -> const summaryAdd = AI.onEnd({ reason, ...finalMetrics }); merge into hha:end

'use strict';

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const safeJson = (x, def)=>{ try{ return JSON.parse(x); }catch{ return def; } };

function makeRateLimiter(cooldownMs=3500){
  let last = 0;
  return (nowMs)=>{
    if(nowMs - last < cooldownMs) return false;
    last = nowMs;
    return true;
  };
}

function defaultMissions(){
  // GOAL chain (เด็ก ป.5 เข้าใจง่าย + สนุก)
  // G1: เก็บของดี 8 ชิ้น
  // G2: เก็บให้ครบ 3 หมู่ (อาหารหลัก 5 หมู่)
  // G3: FEVER >= 75% แล้ว “เอาตัวรอด” 10 วิ (ไม่เพิ่ม miss)
  return {
    goals: [
      { id:'G1', name:'เก็บอาหารดีให้ได้ 8 ชิ้น', sub:'เลือกของดี (🥦/ผลไม้/โปรตีนฯ) หลีกเลี่ยงของทอด/หวาน', cur:0, target:8, done:false },
      { id:'G2', name:'เก็บครบ 3 หมู่', sub:'ให้ครบ 3 จาก 5 หมู่ (โปรตีน/คาร์บ/ผัก/ผลไม้/ไขมัน)', cur:0, target:3, done:false, groups:new Set() },
      { id:'G3', name:'เข้าสู่ FEVER แล้วเอาตัวรอด 10 วิ', sub:'ทำ FEVER ≥ 75% และอย่า MISS ในช่วงนับถอยหลัง', cur:0, target:10, done:false, active:false, startedAt:0 }
    ],
    mini: {
      id:'M1',
      name:'ครบ 3 หมู่ใน 12 วิ',
      sub:'โบนัส ⭐/🛡 (ช่วยลด MISS)',
      cur:0, target:3, done:false,
      windowSec:12,
      windowStartAt:0,
      groups:new Set()
    }
  };
}

function summarizeSetSize(set){ return set ? set.size : 0; }

export function createGoodJunkAIPack(cfg={}){
  const {
    mode='play', // 'play' | 'research'
    seed=null,
    rng=null,            // seeded rng (function) preferred
    emit=(n,d)=>{},      // wrapper for CustomEvent
    nowMs=()=> (performance?.now?.() ?? Date.now()),
    dlHook=null          // optional: (features)=>({risk:0..1, tip?:string})
  } = cfg;

  const isPlay = String(mode).toLowerCase() === 'play';
  const limiter = makeRateLimiter(3200);

  const M = defaultMissions();

  // --- DD state (fair) ---
  const DD = {
    enabled: isPlay,       // research: OFF
    // tunables (base)
    spawnMsBase: 900,
    ttlGoodBase: 1600,
    ttlPowerBase: 1700,
    // current
    spawnMs: 900,
    ttlGood: 1600,
    ttlPower: 1700,
    // ratios (sum ~1)
    pGood: 0.70,
    pJunk: 0.26,
    pStar: 0.02,
    pShield: 0.02,

    // smoothing + fairness guards
    softenUntil: 0,
    hardenUntil: 0,
    lastAdjustAt: 0
  };

  // --- Predictor state ---
  const P = {
    risk: 0,
    // rolling windows updated by onTick1s
    miss5: 0,
    good5: 0,
    junk5: 0,
    exp5: 0,
    comboNow: 0,
    fever: 0,
    feverSlope: 0
  };

  // --- Telemetry (DL-ready) ---
  const T = {
    tick: 0,
    samples: [],  // push lightweight objects (bounded)
    max: 1800,    // 30 min @ 1Hz (way above our games)
    lastFever: null
  };

  // optional HUD binding (purely convenience)
  const HUD = {
    setGoalText: null,  // (name, sub, cur, target, done)
    setMiniText: null,  // (name, sub, cur, target, done, secLeft)
    setMissionPeek: null // (string)
  };

  function resetMiniWindow(t){
    const t0 = t ?? nowMs();
    M.mini.windowStartAt = t0;
    M.mini.groups.clear();
    M.mini.cur = 0;
    M.mini.done = false;
  }

  function publishQuestUpdate(){
    const g = M.goals[0] || { name:'—', sub:'—', cur:0, target:0, done:false };
    const mi = M.mini;

    // compute mini sec left
    const t = nowMs();
    const elapsed = (t - (mi.windowStartAt||t)) / 1000;
    const secLeft = Math.max(0, Math.ceil(mi.windowSec - elapsed));

    // emit quest:update (Plate-compatible shape)
    emit('quest:update', {
      goal:{
        name:g.name,
        sub:g.sub,
        cur:g.cur,
        target:g.target,
        done: !!g.done
      },
      mini:{
        name:mi.name,
        sub:mi.sub,
        cur:mi.cur,
        target:mi.target,
        done: !!mi.done,
        secLeft
      },
      allDone: allGoalsDone()
    });

    // optional HUD direct binding
    if(HUD.setGoalText){
      HUD.setGoalText(g.name, g.sub, g.cur, g.target, !!g.done);
    }
    if(HUD.setMiniText){
      HUD.setMiniText(mi.name, mi.sub, mi.cur, mi.target, !!mi.done, secLeft);
    }
  }

  function allGoalsDone(){
    return M.goals.every(x=>!!x.done);
  }

  function nextGoal(){
    // shift current goal if done
    while(M.goals.length && M.goals[0].done){
      M.goals.shift();
    }
    publishQuestUpdate();
  }

  function coach(msg, tag='AI'){
    if(!msg) return;
    const t = nowMs();
    if(!limiter(t)) return;
    emit('hha:coach', { msg:String(msg), tag });
  }

  function setAssistSoft(now, sec){
    DD.softenUntil = Math.max(DD.softenUntil, now + sec*1000);
  }

  function setAssistHarden(now, sec){
    DD.hardenUntil = Math.max(DD.hardenUntil, now + sec*1000);
  }

  function ddAdjust(metrics){
    if(!DD.enabled) return;

    const t = nowMs();
    if(t - DD.lastAdjustAt < 900) return;
    DD.lastAdjustAt = t;

    // metrics inputs
    const acc = clamp(metrics?.acc ?? 0.7, 0, 1);          // approx: good/(good+junk+expire)
    const missRate = clamp(metrics?.missRate ?? 0.1, 0, 1);
    const fever = clamp(metrics?.fever ?? 0, 0, 100);
    const combo = clamp(metrics?.combo ?? 0, 0, 999);

    // fairness: if miss burst recently -> soften 4s
    const missBurst = (metrics?.missBurst ?? 0) >= 2;
    if(missBurst) setAssistSoft(t, 4);

    const softened = t < DD.softenUntil;
    const hardened = t < DD.hardenUntil;

    // target difficulty: keep players ~70-85% “ok” feeling
    // If player is very strong -> increase risk gradually
    let wantHarder = (acc > 0.82 && missRate < 0.10 && combo >= 4 && fever < 90);
    let wantEasier = (acc < 0.62 || missRate > 0.22 || softened);

    // override with fairness
    if(softened) wantHarder = false;
    if(hardened) wantEasier = false;

    // step size (small to avoid jerk)
    const stepSpawn = 40;   // ms
    const stepTtl   = 35;   // ms
    const stepRisk  = 0.012;

    if(wantHarder){
      DD.spawnMs = clamp(DD.spawnMs - stepSpawn, 650, 1100);
      DD.ttlGood = clamp(DD.ttlGood - stepTtl,   1100, 2100);
      DD.pJunk   = clamp(DD.pJunk + stepRisk,    0.18, 0.40);
      DD.pGood   = clamp(1 - (DD.pJunk + DD.pStar + DD.pShield), 0.50, 0.78);
      // reward slightly lower if too easy
      setAssistHarden(t, 3);
    }else if(wantEasier){
      DD.spawnMs = clamp(DD.spawnMs + stepSpawn, 650, 1200);
      DD.ttlGood = clamp(DD.ttlGood + stepTtl,  1200, 2400);
      DD.pJunk   = clamp(DD.pJunk - stepRisk,   0.16, 0.36);
      DD.pGood   = clamp(1 - (DD.pJunk + DD.pStar + DD.pShield), 0.55, 0.82);

      // if struggling, slightly boost support powerups
      DD.pShield = clamp(DD.pShield + 0.006, 0.02, 0.06);
      DD.pStar   = clamp(DD.pStar   + 0.004, 0.02, 0.05);

      // re-normalize (keep sum <=1)
      const sum = DD.pGood + DD.pJunk + DD.pStar + DD.pShield;
      if(sum > 1){
        const k = 1 / sum;
        DD.pGood*=k; DD.pJunk*=k; DD.pStar*=k; DD.pShield*=k;
      }
      setAssistSoft(t, 3);
    }else{
      // gentle drift to base (very slow)
      DD.spawnMs += (DD.spawnMsBase - DD.spawnMs) * 0.05;
      DD.ttlGood += (DD.ttlGoodBase - DD.ttlGood) * 0.05;
      // keep ratios stable
    }

    // If fever is too high, don’t harden further (avoid overload)
    if(fever >= 92){
      DD.spawnMs = clamp(DD.spawnMs + 60, 650, 1400);
      DD.ttlGood = clamp(DD.ttlGood + 60, 1100, 2600);
      coach('FEVER สูงมาก! ใจเย็น ๆ เล็งกลางจอแล้วค่อยยิงนะ', 'Coach');
    }
  }

  function predictorTick(features){
    const t = nowMs();

    const fever = clamp(features?.fever ?? 0, 0, 100);
    const miss = clamp(features?.miss ?? 0, 0, 999);
    const combo = clamp(features?.combo ?? 0, 0, 999);

    // fever slope
    let slope = 0;
    if(T.lastFever != null) slope = fever - T.lastFever;
    T.lastFever = fever;

    // risk heuristics (0..1)
    // - miss burst in last 5s (passed via features)
    // - fever too high
    // - combo collapsed
    const missBurst = clamp(features?.missBurst5 ?? 0, 0, 9);
    const expBurst  = clamp(features?.expireBurst5 ?? 0, 0, 9);

    let risk = 0;
    risk += Math.min(0.55, missBurst * 0.22);
    risk += Math.min(0.30, expBurst  * 0.12);
    risk += (fever > 85 ? (fever-85)/100 : 0);
    risk += (combo === 0 ? 0.10 : 0);

    // cap + smooth
    risk = clamp(risk, 0, 1);
    P.risk = P.risk*0.65 + risk*0.35;

    P.comboNow = combo;
    P.fever = fever;
    P.feverSlope = slope;

    // optional DL hook (lightweight inference only)
    if(typeof dlHook === 'function'){
      try{
        const out = dlHook(features) || {};
        const r2 = clamp(out.risk ?? P.risk, 0, 1);
        P.risk = P.risk*0.5 + r2*0.5;
        if(out.tip) coach(out.tip, 'AI');
      }catch(_){}
    }

    // action suggestions (do NOT spawn here; just suggest)
    // If risk high: suggest spawn shield or slightly soften for 3s
    if(P.risk >= 0.72){
      setAssistSoft(t, 3.5);
      coach('ระวัง! กำลังพลาดติด ๆ กัน 🛡️ ลองเล็งกลางจอ/อย่ายิงรัว', 'Coach');
      emit('gj:ai:suggest', { type:'assist', what:'shieldOrStar', risk:P.risk });
    }else if(P.risk <= 0.22 && combo >= 5){
      // a bit more challenge
      setAssistHarden(t, 2.5);
      emit('gj:ai:suggest', { type:'challenge', what:'moreJunk', risk:P.risk });
    }
  }

  // --- Mission progress ---
  function onHitGood(groupId){
    const g = M.goals[0];
    if(!g) return;

    // Mini quest window logic
    const mi = M.mini;
    const now = nowMs();
    if(!mi.windowStartAt) mi.windowStartAt = now;
    const elapsed = (now - mi.windowStartAt)/1000;
    if(elapsed > mi.windowSec){
      resetMiniWindow(now);
    }
    if(groupId && !mi.done){
      mi.groups.add(Number(groupId));
      mi.cur = summarizeSetSize(mi.groups);
      if(mi.cur >= mi.target){
        mi.done = true;
        // reward: suggest a star/shield spawn (engine decides)
        emit('gj:ai:suggest', { type:'reward', what:'powerup', pick:'shield', reason:'miniDone' });
        coach(`สุดยอด! ครบ ${mi.target} หมู่ใน ${mi.windowSec} วิ 🎁 ได้โบนัส!`, 'Coach');
      }
    }

    // GOAL chain updates
    if(g.id === 'G1'){
      g.cur++;
      if(g.cur >= g.target) g.done = true;
    } else if(g.id === 'G2'){
      // require group id 1..5
      if(groupId){
        g.groups.add(Number(groupId));
        g.cur = summarizeSetSize(g.groups);
        if(g.cur >= g.target) g.done = true;
      }
    } else if(g.id === 'G3'){
      // activated when fever >=75 (handled in onTick1s)
      // here just progress if active and no miss occurred
    }

    publishQuestUpdate();
    if(g.done) nextGoal();
  }

  function onMiss(){
    // if G3 active, miss breaks streak
    const g = M.goals[0];
    if(g && g.id === 'G3' && g.active){
      g.cur = 0;
      g.startedAt = nowMs();
      coach('พลาดแล้ว! ลองใหม่อีกครั้งในช่วง FEVER 😄', 'Coach');
      publishQuestUpdate();
    }
  }

  function onTickGoal3(features){
    const g = M.goals[0];
    if(!g || g.id !== 'G3') return;

    const fever = clamp(features?.fever ?? 0, 0, 100);
    const now = nowMs();

    if(!g.active){
      if(fever >= 75){
        g.active = true;
        g.startedAt = now;
        g.cur = 0;
        coach('เข้า FEVER แล้ว! เอาตัวรอด 10 วิแบบไม่ MISS!', 'Coach');
      }
    }else{
      // active: count seconds survived since startedAt, but reset happens in onMiss()
      const sec = Math.floor((now - g.startedAt)/1000);
      g.cur = clamp(sec, 0, g.target);
      if(g.cur >= g.target){
        g.done = true;
        coach('ผ่านแล้ว! เก่งมาก 🎉', 'Coach');
      }
    }

    publishQuestUpdate();
    if(g.done) nextGoal();
  }

  // --- Telemetry ---
  function telemetryPush(features){
    if(!features) return;
    const row = Object.assign({}, features);
    row.t = nowMs();
    row.seed = seed ?? null;
    row.mode = mode;
    T.samples.push(row);
    if(T.samples.length > T.max) T.samples.shift();
  }

  // public API
  const API = {
    bindHUD(bind={}){
      HUD.setGoalText = bind.setGoalText || null;
      HUD.setMiniText = bind.setMiniText || null;
      HUD.setMissionPeek = bind.setMissionPeek || null;
      return API;
    },

    getDD(){
      // engine uses this to spawn / TTL / ratios
      return {
        enabled: DD.enabled,
        spawnMs: Math.round(DD.spawnMs),
        ttlGood: Math.round(DD.ttlGood),
        ttlPower: Math.round(DD.ttlPower),
        ratio: { good:DD.pGood, junk:DD.pJunk, star:DD.pStar, shield:DD.pShield },
        softenUntil: DD.softenUntil,
        hardenUntil: DD.hardenUntil
      };
    },

    resetMissions(){
      const fresh = defaultMissions();
      M.goals = fresh.goals;
      M.mini  = fresh.mini;
      resetMiniWindow(nowMs());
      publishQuestUpdate();
    },

    onStart(ctx={}){
      API.resetMissions();
      emit('gj:ai:start', {
        mode,
        seed: seed ?? null,
        timePlanSec: ctx.timePlanSec ?? null,
        view: ctx.view ?? null,
        diff: ctx.diff ?? null
      });
    },

    onHit(e={}){
      // unify events from engine
      const kind = String(e.kind||'').toLowerCase();
      const gid = Number(e.groupId||0) || null;

      if(kind === 'good'){
        onHitGood(gid);
      }else if(kind === 'junk'){
        onMiss();
      }
      // star/shield don't affect mission directly (can be extended)
    },

    onExpireGood(e={}){
      onMiss();
    },

    onTick1s(features={}){
      // missions
      onTickGoal3(features);

      // predictor
      predictorTick(features);

      // DD adjust
      ddAdjust(features);

      // telemetry
      telemetryPush(features);

      // keep quest visible updated (mini timer)
      publishQuestUpdate();
    },

    onEnd(final={}){
      emit('gj:ai:end', { mode, risk:P.risk, samples: Math.min(T.samples.length, 9999) });

      // return additions to summary (merge in safe)
      return {
        ai: {
          mode,
          risk: Number(P.risk.toFixed(3)),
          dd: API.getDD(),
          miniDone: !!M.mini.done,
          goalsDone: final.goalsDone ?? null,
          telemetryN: T.samples.length
        },
        telemetry: {
          // keep lightweight: last 20 seconds only for summary
          tail: T.samples.slice(Math.max(0, T.samples.length-20))
        }
      };
    },

    exportTelemetry(){
      // you may pipe this to Apps Script later
      return T.samples.slice();
    }
  };

  return API;
}