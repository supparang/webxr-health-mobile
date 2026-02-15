// === /herohealth/plate/plate-ai-predict.js ===
// PlateVR AI Prediction (Heuristic, Explainable) — v1.0 (ML-4)
// Play: ON (default) | Study/Research: OFF
// Listens: hha:start, hha:features_1s, hha:end
// Emits:   hha:ai_pred, hha:coach (rate-limited), hha:ai (optional)
//
// Query params:
//   ?aip=0   -> force off
//   ?aip=1   -> force on
//   ?aipc=6500 -> coach cooldown ms
//   ?aipwin=8  -> window seconds for trend calc (default 8)

'use strict';

(function(){
  const W = window;
  const URLX = new URL(location.href);

  const clamp=(v,a,b)=>{v=Number(v)||0;return v<a?a:(v>b?b:v);};
  const now=()=> (performance && performance.now) ? performance.now() : Date.now();
  function emit(name, detail){ try{ W.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }

  // ---- config ----
  const aipForce = URLX.searchParams.get('aip'); // '0' | '1' | null
  const coachCooldownMs = clamp(URLX.searchParams.get('aipc') || 6500, 1200, 20000);
  const winSec = clamp(URLX.searchParams.get('aipwin') || 8, 4, 20);

  // ---- session ----
  const S = {
    on:false,
    runMode:'play',
    diff:'normal',
    seed:0,
    session_id:'',
    lastCoachMs:0,
    buf:[], // last N seconds samples
    ended:false,
  };

  function resetOnStart(d){
    S.runMode = String(d?.runMode || 'play').toLowerCase();
    S.diff = String(d?.diff || 'normal').toLowerCase();
    S.seed = Number(d?.seed)||0;
    S.session_id = String(d?.session_id || d?.sessionId || '');
    S.buf = [];
    S.lastCoachMs = 0;
    S.ended = false;

    // policy: play ON, study/research OFF
    let on = (S.runMode === 'play');
    if(aipForce === '0') on = false;
    if(aipForce === '1') on = true;
    S.on = on;

    emit('hha:ai', { game:'plate', type:'ai_pred_config', on:S.on, winSec, coachCooldownMs });
  }

  function toSample(d){
    d = d || {};
    const t_sec = Number(d.t_sec ?? d.tSec ?? 0) || 0;
    const score = Number(d.scoreNow ?? d.score ?? 0) || 0;
    const combo = Number(d.comboNow ?? d.combo ?? 0) || 0;
    const miss  = Number(d.missNow ?? d.miss ?? 0) || 0;
    const accPct= Number(d.accNowPct ?? d.accPct ?? d.accuracyPct ?? d.accuracyGoodPct ?? 0) || 0;

    // optional
    const fever  = Number(d.fever ?? 0) || 0;
    const shield = Number(d.shield ?? 0) || 0;
    const stormActive = (d.stormActive!=null) ? (d.stormActive?1:0) : (d.storm?.active?1:0);
    const bossActive  = (d.bossActive!=null) ? (d.bossActive?1:0) : (d.boss?.active?1:0);

    const g1 = Number(d.g1 ?? 0) || 0;
    const g2 = Number(d.g2 ?? 0) || 0;
    const g3 = Number(d.g3 ?? 0) || 0;
    const g4 = Number(d.g4 ?? 0) || 0;
    const g5 = Number(d.g5 ?? 0) || 0;

    const tot = g1+g2+g3+g4+g5;
    const minG = Math.min(g1,g2,g3,g4,g5);
    const maxG = Math.max(g1,g2,g3,g4,g5);
    const imbalance01 = tot>0 ? (maxG-minG)/tot : 0;

    return { t_sec, score, combo, miss, accPct, fever, shield, stormActive, bossActive, imbalance01 };
  }

  function slope(arr){
    const n=arr.length; if(n<2) return 0;
    let sx=0, sy=0, sxx=0, sxy=0;
    for(let i=0;i<n;i++){ const x=i, y=Number(arr[i])||0; sx+=x; sy+=y; sxx+=x*x; sxy+=x*y; }
    const den = (n*sxx - sx*sx); if(!den) return 0;
    return (n*sxy - sx*sy)/den;
  }
  function mean(arr){ if(!arr.length) return 0; return arr.reduce((s,x)=>s+x,0)/arr.length; }

  function computePred(){
    // use last winSec seconds
    if(S.buf.length < Math.max(4, winSec-1)) return null;

    const last = S.buf[S.buf.length-1];
    const tEnd = last.t_sec;
    const tStart = Math.max(0, tEnd - winSec);
    const win = S.buf.filter(s=>s.t_sec > tStart - 1e-6 && s.t_sec <= tEnd + 1e-6);
    if(win.length < 4) return null;

    const missSeries = win.map(s=>s.miss);
    const accSeries  = win.map(s=>s.accPct);
    const comboSeries= win.map(s=>s.combo);
    const feverSeries= win.map(s=>s.fever);
    const imbSeries  = win.map(s=>s.imbalance01);

    const missSlope = slope(missSeries);   // >0 means miss increasing
    const accSlope  = slope(accSeries);    // <0 means accuracy dropping
    const comboMean = mean(comboSeries);
    const feverMean = mean(feverSeries);
    const imbMean   = mean(imbSeries);

    // ===== Heuristic risk model =====
    // baseline risk grows when:
    // - missSlope positive
    // - acc low or dropping
    // - fever high (if you emit it; else 0)
    // - imbalance high (player struggling to fill missing groups)
    // - combo low (unstable)
    const accNow = last.accPct;
    const accBad = clamp((80 - accNow)/25, 0, 1);   // 0 good, 1 bad
    const accDrop = clamp((-accSlope)/2.5, 0, 1);   // dropping fast => risk
    const missRise = clamp(missSlope/0.9, 0, 1);    // ~ +1 miss per sec = high
    const feverRisk = clamp(feverMean/100, 0, 1);
    const imbRisk = clamp(imbMean*1.6, 0, 1);
    const comboRisk = clamp((8 - comboMean)/10, 0, 1);

    // bonus risk during storm/boss if present
    const stormRisk = last.stormActive ? 0.18 : 0;
    const bossRisk  = last.bossActive  ? 0.16 : 0;

    let p = 0.10
      + 0.22*accBad
      + 0.18*accDrop
      + 0.22*missRise
      + 0.10*feverRisk
      + 0.10*imbRisk
      + 0.10*comboRisk
      + stormRisk
      + bossRisk;

    p = clamp(p, 0.02, 0.95);

    // predict acc end (very rough): current acc + trend * remaining factor
    const accEndPred = clamp(accNow + accSlope*6, 0, 100);

    // explainable top reasons
    const reasons = [];
    if(accBad > 0.35) reasons.push({k:'low_acc', w:accBad});
    if(accDrop > 0.25) reasons.push({k:'acc_dropping', w:accDrop});
    if(missRise > 0.20) reasons.push({k:'miss_rising', w:missRise});
    if(comboRisk > 0.35) reasons.push({k:'combo_unstable', w:comboRisk});
    if(imbRisk > 0.35) reasons.push({k:'imbalanced_plate', w:imbRisk});
    if(feverRisk > 0.60) reasons.push({k:'fever_high', w:feverRisk});
    if(last.stormActive) reasons.push({k:'storm', w:0.18});
    if(last.bossActive) reasons.push({k:'boss', w:0.16});
    reasons.sort((a,b)=>b.w-a.w);

    return {
      event_type:'ai_pred',
      game:'plate',
      session_id: S.session_id,
      runMode:S.runMode,
      diff:S.diff,
      seed:S.seed,
      winSec,
      t_sec: Math.round(last.t_sec*10)/10,

      p_miss_next5s: Math.round(p*1000)/1000,
      acc_now: Math.round(accNow*10)/10,
      acc_end_pred: Math.round(accEndPred*10)/10,

      missSlope: Math.round(missSlope*1000)/1000,
      accSlope:  Math.round(accSlope*1000)/1000,

      reasons: reasons.slice(0,3)
    };
  }

  function maybeCoach(pred){
    const t = now();
    if(t - S.lastCoachMs < coachCooldownMs) return;

    const p = pred.p_miss_next5s;
    if(p < 0.45) return; // coach only when risk notable

    // choose top reason -> explainable micro tip
    const top = (pred.reasons && pred.reasons[0]) ? pred.reasons[0].k : 'general';
    let msg = 'โฟกัสให้ชัวร์ขึ้นนิดนึงนะ 💪';
    let mood = 'neutral';

    if(top === 'low_acc'){ msg = 'ความแม่นเริ่มตก! ชะลอจังหวะนิดนึง แล้วแตะให้ตรงก่อน 🔎'; mood='neutral'; }
    else if(top === 'acc_dropping'){ msg = 'ช่วงนี้พลาดง่ายขึ้น—เล็งให้ชัด 1 จังหวะก่อนแตะ 🎯'; mood='neutral'; }
    else if(top === 'miss_rising'){ msg = 'เริ่มมี miss ต่อเนื่อง! เลือกเป้าใกล้ ๆ ก่อน อย่ารีบกวาดทั้งจอ ⚡'; mood='fever'; }
    else if(top === 'combo_unstable'){ msg = 'คอมโบหลุดบ่อย—กลับไปโหมด “ชัวร์ก่อนเร็ว” แล้วคอมโบจะกลับมา 🔥'; mood='neutral'; }
    else if(top === 'imbalanced_plate'){ msg = 'จานยัง “ขาดบางหมู่” อยู่! โฟกัสหมู่ที่ยังไม่ครบก่อน 🍽️'; mood='happy'; }
    else if(top === 'fever_high'){ msg = 'FEVER สูง! ลดความรีบลงนิดเดียว แล้วความแม่นจะดีขึ้นทันที 🔥'; mood='fever'; }
    else if(top === 'storm'){ msg = 'STORM มาแล้ว! เก็บ GOOD ชิ้นใหญ่ ๆ ให้ครบก่อนเวลา 🌪️'; mood='fever'; }
    else if(top === 'boss'){ msg = 'บอสมา! เลือก GOOD ก่อน หลีกเลี่ยงขยะทุกกรณี 👹'; mood='fever'; }

    S.lastCoachMs = t;

    // use hha:coach (your UI shows it)
    emit('hha:coach', { game:'plate', msg, mood, tag:'AI Coach' });

    // also emit hha:ai for research trace (optional)
    emit('hha:ai', { game:'plate', type:'coach_tip', key:top, msg, mood, p_miss_next5s:p });
  }

  // ---- listeners ----
  W.addEventListener('hha:start', (e)=> resetOnStart(e?.detail||{}), {passive:true});

  W.addEventListener('hha:features_1s', (e)=>{
    if(S.ended) return;
    if(!S.on) return;

    const s = toSample(e?.detail || {});
    if(!isFinite(s.t_sec)) return;

    S.buf.push(s);
    // keep only last (winSec*2 + 10) seconds
    const keep = Math.max(40, Math.ceil((winSec*2 + 10) * 2));
    if(S.buf.length > keep) S.buf.splice(0, S.buf.length - keep);

    const pred = computePred();
    if(!pred) return;

    emit('hha:ai_pred', pred);
    maybeCoach(pred);
  }, {passive:true});

  W.addEventListener('hha:end', ()=>{
    S.ended = true;
  }, {passive:true});

})();
