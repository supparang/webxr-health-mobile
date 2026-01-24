// === /herohealth/vr-groups/ai-hooks.js ===
// PACK 17 — AI Coach + Prediction signals + (optional) Difficulty Director
// ✅ Default: disabled unless enabled=true from groups-vr.html (your aiEnabled())
// ✅ research/practice: ALWAYS OFF (enforced by caller + guards here)
// ✅ Emits:
//    - hha:ai { band, riskMissNext5s, reasons[], tipId }
//    - hha:coach (micro tips, explainable)
//    - hha:ai:diff { spawnMul, wrongAdd, junkAdd, sizeMul, lifeMul }  (optional apply)
//
// Query flags:
//   ?ai=1        -> enable AI (tips + prediction signals)
//   ?aiApply=1   -> allow difficulty director to affect gameplay (play only)

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  const clamp = (v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); };
  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function canApply(){
    const v = String(qs('aiApply','0')||'0').toLowerCase();
    return (v === '1' || v === 'true');
  }

  // ---------- rate-limit helpers ----------
  function makeLimiter(minGapMs){
    let lastAt = -1e9;
    return ()=> {
      const t = nowMs();
      if (t - lastAt < minGapMs) return false;
      lastAt = t;
      return true;
    };
  }
  function makeDedupe(ttlMs){
    const map = new Map();
    return (key)=>{
      const t = nowMs();
      const last = map.get(key) || -1e9;
      if (t - last < ttlMs) return false;
      map.set(key, t);
      // prune occasionally
      if (map.size > 40){
        for (const [k,v] of map){
          if (t - v > ttlMs*2) map.delete(k);
        }
      }
      return true;
    };
  }

  // ---------- prediction model (heuristic now; DL-ready signals) ----------
  // Inputs from frames:
  //  - misses, combo, acc, pressure, stormOn, left
  // Output:
  //  - riskMissNext5s in [0..1]
  function predictRisk(s){
    const miss = s.miss|0;
    const combo = s.combo|0;
    const acc = clamp(s.acc|0, 0, 100);
    const pressure = clamp(s.pressure|0, 0, 3);
    const stormOn = s.stormOn ? 1 : 0;
    const left = s.left|0;

    // base risk from pressure + storm + low acc
    let r = 0.10;
    r += pressure * 0.16;
    r += stormOn ? 0.10 : 0.0;
    r += (acc < 70) ? 0.12 : (acc < 82 ? 0.06 : 0.0);
    r += (combo === 0) ? 0.05 : (combo >= 8 ? -0.05 : 0.0);
    r += (miss >= 10) ? 0.08 : (miss >= 6 ? 0.04 : 0.0);

    // clutch time boosts stress
    if (left <= 10 && left > 0) r += 0.06;

    return clamp(r, 0, 1);
  }

  function bandFromRisk(r){
    if (r >= 0.62) return 'high';
    if (r >= 0.38) return 'mid';
    return 'low';
  }

  // ---------- micro tips (explainable) ----------
  // Tip selection is deterministic-ish via simple scoring, not random.
  function pickTip(s){
    const reasons = [];

    if (s.stormOn){
      reasons.push('พายุ: เป้าถี่ขึ้น');
      return { id:'storm_focus', mood:'fever', text:'พายุมาแล้ว! “เล็ง 1 วิ ก่อนยิง” จะคุ้มกว่า ยิงรัวนะ 🌪️', reasons };
    }
    if (s.pressure >= 3){
      reasons.push('pressure สูง');
      return { id:'pressure3', mood:'sad', text:'ตอนนี้พลาดหนักแล้ว 😤 “หยุด-เล็ง-ยิง” ทีละเป้า จะดึงคะแนนกลับได้', reasons };
    }
    if (s.pressure === 2){
      reasons.push('pressure กลาง');
      return { id:'pressure2', mood:'fever', text:'โหมดกดดัน! ลดการยิงมั่ว: เลือกเป้าที่ “สีหมู่ถูก” ก่อน 🔥', reasons };
    }
    if (s.acc < 72 && s.totalJudged >= 8){
      reasons.push('accuracy ต่ำ');
      return { id:'acc_low', mood:'neutral', text:'ทริคเพิ่มแม่น: “อ่านชื่อหมู่ใน GOAL” แล้วค่อยยิงเป้า 🧠', reasons };
    }
    if (s.combo === 0 && s.totalJudged >= 6){
      reasons.push('คอมโบไม่ขึ้น');
      return { id:'combo0', mood:'neutral', text:'อยากได้คอมโบ: ยิงดีต่อเนื่อง 3–5 ครั้งก่อน แล้วสปีดจะมาเอง ✨', reasons };
    }
    if (s.left <= 10 && s.left > 0){
      reasons.push('ใกล้หมดเวลา');
      return { id:'clutch', mood:'fever', text:'อีกไม่กี่วิ! เลือกเป้าใกล้กลางจอ แล้วเก็บให้ชัวร์ 🔥', reasons };
    }
    if (s.powerThr > 0 && s.power >= s.powerThr - 1){
      reasons.push('ใกล้สลับหมู่');
      return { id:'power_near', mood:'happy', text:'ใกล้สลับหมู่แล้ว! ยิงให้ถูกอีกนิด จะได้ “SWITCH” ⚡', reasons };
    }
    return null;
  }

  // ---------- difficulty director (optional apply) ----------
  // Output multipliers/additions (bounded)
  function recommendDiff(s){
    // aim: keep flow fun: if risk high -> ease a bit; if risk very low -> spice up
    const r = s.risk;
    let spawnMul = 1.0;
    let wrongAdd = 0.0;
    let junkAdd  = 0.0;
    let sizeMul  = 1.0;
    let lifeMul  = 1.0;

    if (r >= 0.70){
      spawnMul = 1.10;   // slower spawns (every * mul)
      wrongAdd = -0.03;
      junkAdd  = -0.02;
      sizeMul  = 1.04;
      lifeMul  = 1.08;
    } else if (r >= 0.55){
      spawnMul = 1.05;
      wrongAdd = -0.02;
      junkAdd  = -0.01;
      sizeMul  = 1.02;
      lifeMul  = 1.05;
    } else if (r <= 0.18 && s.combo >= 6 && s.acc >= 86){
      // player is cruising -> increase challenge a bit
      spawnMul = 0.93;   // faster spawns
      wrongAdd = +0.02;
      junkAdd  = +0.01;
      sizeMul  = 0.98;
      lifeMul  = 0.95;
    }

    return {
      spawnMul: clamp(spawnMul, 0.86, 1.18),
      wrongAdd: clamp(wrongAdd, -0.06, 0.06),
      junkAdd:  clamp(junkAdd,  -0.05, 0.05),
      sizeMul:  clamp(sizeMul,  0.92, 1.08),
      lifeMul:  clamp(lifeMul,  0.88, 1.14),
    };
  }

  // ---------- runtime ----------
  let st = null;

  function attach(cfg){
    cfg = cfg || {};
    const enabled = !!cfg.enabled;
    const runMode = String(cfg.runMode || 'play').toLowerCase();

    // hard guard
    if (!enabled) return;
    if (runMode === 'research' || runMode === 'practice') return;

    const tipLimiter = makeLimiter(2600);
    const tipDedupe  = makeDedupe(8000);
    const aiLimiter  = makeLimiter(900);      // ai signal ~1Hz max

    const applyOK = canApply() && (runMode === 'play');

    // rolling snapshot from events
    st = {
      left: 0, score:0, combo:0, miss:0, acc:0, grade:'C',
      power:0, powerThr:0, goalPct:0, miniPct:0,
      pressure:0, stormOn:0,
      totalJudged: 0
    };

    const onScore = (ev)=>{
      const d = ev.detail||{};
      st.score = Number(d.score||0);
      st.combo = Number(d.combo||0);
      st.miss  = Number(d.misses||0);
    };
    const onTime = (ev)=>{ st.left = Number((ev.detail||{}).left||0); };
    const onRank = (ev)=>{
      const d = ev.detail||{};
      st.grade = String(d.grade||'C');
      st.acc   = Number(d.accuracy||0);
    };
    const onPower = (ev)=>{
      const d = ev.detail||{};
      st.power = Number(d.charge||0);
      st.powerThr = Number(d.threshold||0);
    };
    const onQuest = (ev)=>{
      const d = ev.detail||{};
      st.goalPct = Number(d.goalPct||0);
      st.miniPct = Number(d.miniPct||0);
    };
    const onProgress = (ev)=>{
      const d = ev.detail||{};
      if (d.kind === 'pressure') st.pressure = Number(d.level||0);
      if (d.kind === 'storm_on') st.stormOn = 1;
      if (d.kind === 'storm_off') st.stormOn = 0;
    };
    const onJudge = (ev)=>{
      const d = ev.detail||{};
      // count judged hits roughly
      if (d.kind === 'good' || d.kind === 'bad' || d.kind === 'miss' || d.kind === 'boss') st.totalJudged++;
    };

    // AI loop: driven by hha:tick (1Hz from engine)
    const onTick = (ev)=>{
      if (!aiLimiter()) return;

      // risk + band
      const risk = predictRisk(st);
      const band = bandFromRisk(risk);

      // emit AI signal (gets logged by PACK16)
      const tip = pickTip(Object.assign({ risk }, st));
      const reasons = (tip && tip.reasons) ? tip.reasons : [];

      emit('hha:ai', {
        band,
        riskMissNext5s: Number(risk.toFixed(3)),
        reasons,
        tipId: tip ? tip.id : ''
      });

      // push band into PACK16 snapshot if you want (ML pack listens to hha:ai)
      // micro tips (rate-limited + deduped)
      if (tip && tipLimiter() && tipDedupe(tip.id)){
        emit('hha:coach', { text: tip.text, mood: tip.mood });
      }

      // optional difficulty director (apply only with ?aiApply=1)
      if (applyOK){
        const rec = recommendDiff(Object.assign({ risk }, st));
        emit('hha:ai:diff', rec);
      }
    };

    root.addEventListener('hha:score', onScore, {passive:true});
    root.addEventListener('hha:time', onTime, {passive:true});
    root.addEventListener('hha:rank', onRank, {passive:true});
    root.addEventListener('groups:power', onPower, {passive:true});
    root.addEventListener('quest:update', onQuest, {passive:true});
    root.addEventListener('groups:progress', onProgress, {passive:true});
    root.addEventListener('hha:judge', onJudge, {passive:true});
    root.addEventListener('hha:tick', onTick, {passive:true});

    NS.__AI_ATTACHED__ = true;

    return {
      detach(){
        root.removeEventListener('hha:score', onScore);
        root.removeEventListener('hha:time', onTime);
        root.removeEventListener('hha:rank', onRank);
        root.removeEventListener('groups:power', onPower);
        root.removeEventListener('quest:update', onQuest);
        root.removeEventListener('groups:progress', onProgress);
        root.removeEventListener('hha:judge', onJudge);
        root.removeEventListener('hha:tick', onTick);
        NS.__AI_ATTACHED__ = false;
      }
    };
  }

  NS.AIHooks = { attach };

})(typeof window!=='undefined' ? window : globalThis);