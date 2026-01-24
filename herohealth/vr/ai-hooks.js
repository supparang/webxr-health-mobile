// === /herohealth/vr/ai-hooks.js ===
// AI Hooks (Explainable Prediction) — Play: coach ON, Research: observe only
// Listens: hha:score, hha:judge, hha:time
// Emits:   hha:ai { t, riskMiss, reasons[], suggest? }

export function attachAIHooks(cfg = {}){
  const WIN = window;
  const mode = String(cfg.mode || 'play').toLowerCase(); // play | research
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  const S = {
    t0: performance.now(),
    score: 0,
    miss: 0,
    fever: 0,
    combo: 0,

    judgeN: 0,
    missN: 0,
    goodN: 0,
    junkN: 0,

    lastJudgeTs: 0,
    lastCoachTs: 0,
  };

  const emitAI = (d)=>{ try{ WIN.dispatchEvent(new CustomEvent('hha:ai',{detail:d})); }catch{} };
  const coach  = (msg)=>{ try{ WIN.dispatchEvent(new CustomEvent('hha:coach',{detail:{msg,tag:'AI Coach'}})); }catch{} };

  function computeRisk(){
    const t = (performance.now() - S.t0) / 1000;

    const total = Math.max(1, S.judgeN);
    const missRate = S.missN / total;

    const feverN = clamp(S.fever / 100, 0, 1);

    const quiet = clamp((performance.now() - (S.lastJudgeTs||S.t0)) / 1600, 0, 1);

    // explainable weighted risk
    let risk = 0.50*missRate + 0.38*feverN + 0.12*quiet;
    risk = clamp(risk, 0, 1);

    const reasons = [];
    if(missRate > 0.25) reasons.push('miss_rate_high');
    if(feverN > 0.65) reasons.push('fever_high');
    if(quiet > 0.70)  reasons.push('slow_response');

    return { t, riskMiss:risk, reasons };
  }

  function maybeCoach(ai){
    if(mode === 'research') return;
    const now = performance.now();
    if(now - S.lastCoachTs < 4500) return;
    if(ai.riskMiss < 0.62) return;

    S.lastCoachTs = now;

    const msg =
      ai.reasons.includes('fever_high') ? 'FEVER สูง! ใจเย็น ๆ เลี่ยงขยะก่อนนะ 😄' :
      ai.reasons.includes('miss_rate_high') ? 'พลาดบ่อย ลองเล็งทีละเป้า ไม่ต้องรีบ 👍' :
      'ช้าลงนิดนึง มองกลางจอแล้วยิงทีละเป้า 🎯';

    coach(msg);
  }

  WIN.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    if(typeof d.score === 'number') S.score = d.score;
    if(typeof d.miss  === 'number') S.miss  = d.miss;
    if(typeof d.combo === 'number') S.combo = d.combo;
    if(typeof d.fever === 'number') S.fever = d.fever;
  }, {passive:true});

  WIN.addEventListener('hha:judge', (e)=>{
    S.lastJudgeTs = performance.now();
    S.judgeN++;

    const d = e?.detail || {};
    const type  = String(d.type || '');
    const label = String(d.label || '');

    if(type === 'miss' || label === 'MISS') S.missN++;
    if(type === 'good') S.goodN++;
    if(type === 'bad')  S.junkN++;

    const ai = computeRisk();
    emitAI(ai);
    maybeCoach(ai);
  }, {passive:true});

  // expose for debug
  WIN.__HHA_AI_STATE__ = S;
}