// === /herohealth/vr/ai-hooks.js ===
// AI Hooks (Explainable Prediction) — OFF by default in research
// Emits: hha:ai { riskMiss, reasons[], suggest?, t }
// Usage: import { attachAIHooks } from '../vr/ai-hooks.js'; attachAIHooks({ mode:'play'|'research' })

export function attachAIHooks(cfg={}){
  const WIN = window;
  const mode = String(cfg.mode || 'play').toLowerCase(); // research: do not adapt, only observe
  const state = {
    t0: performance.now(),
    score:0,
    miss:0,
    fever:0,
    combo:0,
    lastJudgeTs:0,
    judgeCount:0,
    missCount:0,
    goodCount:0,
    junkCount:0,
    expireGood:0,
    lastCoachTs:0
  };

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));

  function emitAI(payload){
    try{ WIN.dispatchEvent(new CustomEvent('hha:ai', { detail: payload })); }catch{}
  }

  function computeRisk(){
    // ✅ Explainable risk (0..1)
    // factors: miss rate, recent mistake streak, fever, low time
    const t = (performance.now() - state.t0)/1000;

    const totalJudges = Math.max(1, state.judgeCount);
    const missRate = state.missCount / totalJudges;

    const feverN = clamp(state.fever/100, 0, 1);
    const recent = clamp((performance.now()-state.lastJudgeTs)/1500, 0, 1); // 0=recent action, 1=quiet
    const quietPenalty = recent * 0.10; // if player stops acting, risk rises slightly

    // weight
    let risk = 0.45*missRate + 0.40*feverN + quietPenalty;

    // mild stabilization
    risk = clamp(risk, 0, 1);

    const reasons = [];
    if(missRate > 0.25) reasons.push('miss_rate_high');
    if(feverN > 0.65) reasons.push('fever_high');
    if(recent > 0.7) reasons.push('slow_response');

    return { t, riskMiss:risk, reasons };
  }

  function maybeCoach(ai){
    if(mode==='research') return;
    const now = performance.now();
    if(now - state.lastCoachTs < 4500) return; // rate limit
    if(ai.riskMiss < 0.62) return;

    state.lastCoachTs = now;
    const msg =
      ai.reasons.includes('fever_high') ? 'ใจเย็น ๆ เลี่ยงขยะก่อนนะ! 😄' :
      ai.reasons.includes('miss_rate_high') ? 'โฟกัสของดีทีละอัน ไม่ต้องรีบ! 👍' :
      'มองกลางจอแล้วยิงทีละเป้า! 🎯';

    try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ msg, tag:'AI Coach' } })); }catch{}
  }

  // listen to game signals (you already emit these)
  WIN.addEventListener('hha:score', (e)=>{ state.score = Number(e?.detail?.score||0); }, {passive:true});
  WIN.addEventListener('hha:time',  (e)=>{ /* optional */ }, {passive:true});
  WIN.addEventListener('quest:update', ()=>{}, {passive:true});

  WIN.addEventListener('hha:judge', (e)=>{
    state.lastJudgeTs = performance.now();
    state.judgeCount++;

    const type = String(e?.detail?.type||'');
    const label = String(e?.detail?.label||'');
    if(type==='miss' || label==='MISS'){
      state.missCount++;
    }
    if(type==='good') state.goodCount++;
    if(type==='bad') state.junkCount++;

    const ai = computeRisk();
    emitAI(ai);
    maybeCoach(ai);
  }, {passive:true});

  // expose to debug
  WIN.__HHA_AI_STATE__ = state;
}