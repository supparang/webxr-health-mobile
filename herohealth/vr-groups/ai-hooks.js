// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — Multi-Task DL (3 targets) + fallback
// Targets (1-3):
// 1) MISS_SPIKE   : โอกาส "miss จะพุ่ง" ใน ~5 วิ
// 2) MINI_FAIL    : โอกาส "mini จะ fail" ใน ~10 วิ
// 3) SCORE_DROP   : โอกาส "คะแนนจะตกหนัก" ใน ~5 วิ
//
// ✅ enabled only when ?ai=1 and runMode=play
// ✅ research/practice: ALWAYS OFF
// ✅ Listens: groups:telemetry (1Hz) from groups.safe.js
// ✅ Emits: ai:risk {missSpike, miniFail, scoreDrop, mode}, ai:tip
// ✅ DL optional: ?dl=1  -> load TFJS model at ./models/groups-multitask/model.json
//    - if missing or tfjs not found -> fallback heuristic

(function(){
  'use strict';
  const WIN = window;
  if(!WIN) return;

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  function emit(name, detail){ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } }

  function aiWanted(){
    const run = String(qs('run','play')||'play').toLowerCase();
    const on  = String(qs('ai','0')||'0').toLowerCase();
    if (run === 'research') return false;
    return (on==='1' || on==='true');
  }
  function dlWanted(){
    const v = String(qs('dl','0')||'0').toLowerCase();
    return (v==='1' || v==='true');
  }

  // ---------------- Dataset (for training) ----------------
  const DATASET = [];
  const MAX_ROWS = 8000;
  function pushRow(row){
    DATASET.push(row);
    if (DATASET.length > MAX_ROWS) DATASET.splice(0, DATASET.length - MAX_ROWS);
  }

  // ---------------- Features for DL ----------------
  // Must match dl-train.py
  const SEQ = 12;
  const FEAT_KEYS = [
    'acc','missN','comboN','pressure',
    'storm','mini','targetsN','powerN',
    'goalProg','leftN',
    'dScoreN','dMissN','dAccN','dTargetsN',
    'miniProg','miniLeftN'
  ];
  const SEQBUF = [];

  function buildFeat(t){
    const acc = clamp(t.accGoodPct,0,100)/100;
    const missN = clamp(t.misses,0,99)/25;
    const comboN= clamp(t.combo,0,99)/25;
    const pressure = clamp(t.pressure,0,3)/3;

    const storm = t.stormOn?1:0;
    const mini  = t.miniOn?1:0;

    const targetsN = clamp(t.targetsOnScreen,0,30)/30;
    const powerN   = clamp(t.powerCharge,0,99)/12;

    const goalProg = (t.goalNeed>0) ? clamp((t.goalNow/t.goalNeed),0,1) : 0;
    const leftN = clamp(t.leftSec,0,180)/180;

    const dScoreN = clamp(t.dScore,-200,200)/200;
    const dMissN  = clamp(t.dMisses,0,6)/6;
    const dAccN   = clamp(t.dAcc,-30,30)/30;
    const dTargetsN = clamp(t.dTargets,-15,15)/15;

    const miniProg = (t.miniOn && t.miniNeed>0) ? clamp(t.miniNow/t.miniNeed,0,1) : 0;
    const miniLeftN = (t.miniOn) ? clamp(t.miniLeftSec,0,15)/15 : 0;

    return [
      acc, missN, comboN, pressure,
      storm, mini, targetsN, powerN,
      goalProg, leftN,
      dScoreN, dMissN, dAccN, dTargetsN,
      miniProg, miniLeftN
    ];
  }

  function seqPush(vec){
    SEQBUF.push(vec);
    if (SEQBUF.length > SEQ) SEQBUF.shift();
  }

  // ---------------- Heuristic fallback (3 heads) ----------------
  // ให้ผล 0..1 แยก 3 หัว + smoothing เล็กน้อย
  const EMA = { m:0.25, mini:0.25, s:0.25 };
  function ema(x, key, a){
    EMA[key] = a*x + (1-a)*EMA[key];
    return EMA[key];
  }

  function heuristic3(t){
    const acc = clamp(t.accGoodPct,0,100)/100;
    const miss = clamp(t.misses,0,99);
    const combo = clamp(t.combo,0,99);
    const pressure = clamp(t.pressure,0,3)/3;
    const storm = t.stormOn?1:0;
    const mini = t.miniOn?1:0;

    // 1) miss spike
    let r1 = 0;
    r1 += (1-acc)*0.55;
    r1 += Math.min(1, miss/12)*0.25;
    r1 += pressure*0.20;
    r1 += storm*0.12;
    r1 -= Math.min(1, combo/10)*0.22;
    r1 = clamp(r1,0,1);
    r1 = ema(r1,'m',0.28);

    // 2) mini fail (ถ้ามี mini อยู่)
    let r2 = 0.18;
    if (mini){
      const prog = (t.miniNeed>0) ? clamp(t.miniNow/t.miniNeed,0,1) : 0;
      const left = clamp(t.miniLeftSec,0,15);
      r2 = 0;
      r2 += (1-prog)*0.55;
      r2 += (left<=3?0.22:0.0);
      r2 += pressure*0.18;
      r2 += (t.miniForbidJunk?0.12:0.0);
      r2 += (t.miniOk===false?0.22:0.0);
      r2 -= Math.min(1, combo/10)*0.08;
      r2 = clamp(r2,0,1);
    }
    r2 = ema(r2,'mini',0.22);

    // 3) score drop
    let r3 = 0;
    const dScore = Number(t.dScore||0);
    r3 += (dScore<=-12?0.25:0.0);
    r3 += (dScore<=-24?0.35:0.0);
    r3 += (1-acc)*0.40;
    r3 += pressure*0.18;
    r3 += storm*0.10;
    r3 -= Math.min(1, combo/10)*0.18;
    r3 = clamp(r3,0,1);
    r3 = ema(r3,'s',0.25);

    return { missSpike:r1, miniFail:r2, scoreDrop:r3, mode:'heuristic' };
  }

  // ---------------- DL (TFJS optional) ----------------
  const DL = { enabled:false, loaded:false, model:null, fail:false, lastErr:'' };

  async function ensureTFJS(){
    // ต้องมี tfjs อยู่แล้ว (คุณจะเลือก local หรือ CDN ก็ได้)
    return !!(WIN.tf && WIN.tf.loadLayersModel);
  }

  async function tryLoadModel(){
    if (DL.loaded || DL.fail) return;
    DL.loaded = true;

    const ok = await ensureTFJS();
    if (!ok){
      DL.fail = true; DL.lastErr = 'tfjs_not_found';
      return;
    }
    try{
      const url = new URL('./models/groups-multitask/model.json', location.href).toString();
      DL.model = await WIN.tf.loadLayersModel(url);
      DL.fail = false;
    }catch(e){
      DL.fail = true;
      DL.lastErr = String(e && e.message ? e.message : e);
      DL.model = null;
    }
  }

  async function dlPredict3(){
    if (!DL.model || !WIN.tf) return null;
    if (SEQBUF.length < SEQ) return null;

    const F = FEAT_KEYS.length;
    const flat = [];
    for (let i=0;i<SEQ;i++){
      const v = SEQBUF[i] || new Array(F).fill(0);
      for (let j=0;j<F;j++) flat.push(Number(v[j])||0);
    }
    const tf = WIN.tf;
    const x = tf.tensor(flat, [1, SEQ, F]);

    try{
      const y = DL.model.predict(x);

      // รองรับทั้ง: y เป็น Tensor shape [1,3] หรือเป็น array [y1,y2,y3]
      let out = null;
      if (Array.isArray(y)){
        const a = await y[0].data();
        const b = await y[1].data();
        const c = await y[2].data();
        out = [a[0], b[0], c[0]];
      }else{
        const d = await y.data();
        out = [d[0], d[1], d[2]];
      }

      return {
        missSpike: clamp(out[0],0,1),
        miniFail:  clamp(out[1],0,1),
        scoreDrop: clamp(out[2],0,1),
        mode:'dl'
      };
    }finally{
      try{ x.dispose(); }catch(_){}
    }
  }

  // ---------------- Tips policy ----------------
  let lastTipAt = 0;
  function maybeTip(t, r){
    const now = Date.now();
    if (now - lastTipAt < 2200) return;
    if (String(t.runMode||'play') !== 'play') return;

    const m = r.missSpike||0;
    const mi= r.miniFail||0;
    const s = r.scoreDrop||0;

    let text = '';
    let mood = 'neutral';

    // priority: mini fail > miss spike > score drop
    if (t.miniOn && mi >= 0.70){
      mood = 'fever';
      text = 'MINI เสี่ยงพลาด! เล็งให้ถูกหมู่ก่อน แล้วค่อยยิงนะ ⚡';
    }else if (m >= 0.78){
      mood = 'sad';
      text = 'ช้าลงนิด! ดูหมู่ให้ชัวร์ แล้วค่อยยิง 👀';
    }else if (s >= 0.72){
      mood = 'sad';
      text = 'ระวังคะแนนตก! อย่าโดนขยะ/อย่ายิงผิดหมู่ 😤';
    }else if (m <= 0.30 && (t.combo||0) >= 6){
      mood = 'happy';
      text = 'ฟอร์มดีมาก! เก็บคอมโบต่อเลย ✨';
    }else{
      return;
    }

    lastTipAt = now;
    emit('ai:tip', { text, mood, mode:r.mode, missSpike:m, miniFail:mi, scoreDrop:s });
  }

  // ---------------- Attach + Telemetry handler ----------------
  let ATTACHED = false;
  let ENABLED = false;

  async function onTele(ev){
    if (!ENABLED) return;
    const t = ev.detail || {};

    // build features + seq
    const vec = buildFeat(t);
    seqPush(vec);

    // baseline
    const h = heuristic3(t);
    let chosen = h;

    if (DL.enabled && !DL.fail){
      tryLoadModel().then(async ()=>{
        const pr = await dlPredict3();
        chosen = pr || h;

        finalize(t, h, chosen);
      });
      return;
    }

    finalize(t, h, chosen);
  }

  function finalize(t, h, chosen){
    // emit risk
    emit('ai:risk', {
      missSpike: chosen.missSpike,
      miniFail: chosen.miniFail,
      scoreDrop: chosen.scoreDrop,
      mode: chosen.mode
    });

    // store row
    pushRow({
      ts: Date.now(),
      runMode: t.runMode,
      diff: t.diff,
      seed: t.seed,

      leftSec: t.leftSec,
      score: t.score,
      combo: t.combo,
      misses: t.misses,
      accGoodPct: t.accGoodPct,
      pressure: t.pressure,
      stormOn: t.stormOn,
      miniOn: t.miniOn,
      miniNeed: t.miniNeed,
      miniNow: t.miniNow,
      miniLeftSec: t.miniLeftSec,
      miniOk: t.miniOk,
      miniForbidJunk: t.miniForbidJunk,
      miniTotal: t.miniTotal,
      miniCleared: t.miniCleared,

      targetsOnScreen: t.targetsOnScreen,
      powerCharge: t.powerCharge,
      powerThreshold: t.powerThreshold,
      goalNow: t.goalNow,
      goalNeed: t.goalNeed,

      dScore: t.dScore,
      dMisses: t.dMisses,
      dAcc: t.dAcc,
      dTargets: t.dTargets,

      // heuristic + chosen
      h_missSpike: h.missSpike,
      h_miniFail: h.miniFail,
      h_scoreDrop: h.scoreDrop,

      p_missSpike: chosen.missSpike,
      p_miniFail: chosen.miniFail,
      p_scoreDrop: chosen.scoreDrop,
      p_mode: chosen.mode
    });

    maybeTip(t, chosen);
  }

  NS.AIHooks = {
    attach(ctx){
      const rm = String((ctx && ctx.runMode) || 'play').toLowerCase();
      if (rm === 'research' || rm === 'practice'){
        ENABLED = false;
        emit('ai:mode', { enabled:false, reason:'research_or_practice' });
        return;
      }

      ENABLED = !!(ctx && ctx.enabled) && aiWanted();
      DL.enabled = ENABLED && dlWanted();

      if (!ATTACHED){
        ATTACHED = true;
        WIN.addEventListener('groups:telemetry', onTele, { passive:true });
      }

      emit('ai:mode', { enabled: ENABLED, dl: DL.enabled?1:0, reason: ENABLED?'play':'disabled' });
    },

    getDataset(){ return DATASET.slice(); },
    clearDataset(){
      DATASET.length = 0;
      SEQBUF.length = 0;
      EMA.m = EMA.mini = EMA.s = 0.25;
      lastTipAt = 0;
    },

    // helper: CSV export (ถ้าอยาก copy ไปเทรน)
    toCSV(){
      const rows = DATASET.slice();
      if (!rows.length) return '';
      const keys = Object.keys(rows[0]);
      const esc = (v)=>('"'+String(v??'').replace(/"/g,'""')+'"');
      const head = keys.join(',');
      const body = rows.map(r=>keys.map(k=>esc(r[k])).join(',')).join('\n');
      return head + '\n' + body;
    }
  };
})();