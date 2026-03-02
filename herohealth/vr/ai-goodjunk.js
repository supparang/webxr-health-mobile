// === /webxr-health-mobile/herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI Runtime — PRODUCTION (prediction + explainable hints + rate-limit)
// v20260301-AI-PREDICT-EXPLAIN
'use strict';

import { GOODJUNK_MODEL_V1 } from './goodjunk-model.js';

function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); }
function sigmoid(z){ return 1/(1+Math.exp(-z)); }
function nowMs(){ return Date.now(); }

function dot(w, x){
  let s = 0;
  const n = Math.min(w.length, x.length);
  for(let i=0;i<n;i++) s += (Number(w[i])||0) * (Number(x[i])||0);
  return s;
}

function softPct(p){ return `${Math.round(clamp(p,0,1)*100)}%`; }

function explainTop(model, x){
  // returns top 2 feature contributions (abs)
  const items = [];
  for(let i=0;i<model.features.length;i++){
    const w = Number(model.weights[i])||0;
    const v = Number(x[i])||0;
    const c = w*v;
    if(model.features[i] === 'bias') continue;
    items.push({ k:model.features[i], c });
  }
  items.sort((a,b)=>Math.abs(b.c)-Math.abs(a.c));
  return items.slice(0,2);
}

function hintFromSignals(risk, top){
  // map feature names to kid-friendly tips
  const map = {
    miss_rate: 'ช้าลงนิด แล้วเล็ง “GOOD” ให้ตรงกลาง 🎯',
    junk_rate: 'หลบ “JUNK” ให้ไว — ดูสี/สัญลักษณ์ก่อนยิง 👀',
    combo_norm: 'รักษาคอมโบ! ยิงต่อเนื่องจะได้คะแนนพุ่ง 🚀',
    rt_good_norm: 'รีแอคเร็วขึ้นอีกนิด — ตาไว มือไว ⚡',
    fever_norm: 'ตอน FEVER มาแล้ว! ลุยเก็บ GOOD รัว ๆ 🔥',
    time_left_norm: 'เหลือเวลาเยอะ — ตั้งจังหวะให้แม่นก่อนค่อยเร่ง ⏱️'
  };
  const t = (top && top[0] && map[top[0].k]) ? map[top[0].k] : '';
  if(risk >= 0.78) return t || 'โหมดวิกฤต! โฟกัส GOOD 3 ครั้งติดให้ได้ 💥';
  if(risk >= 0.60) return t || 'ระวังพลาดติด ๆ กัน — เล็งก่อนยิงนะ ✅';
  if(risk >= 0.33) return t || 'ทำได้ดี! รักษาความนิ่ง แล้วค่อยเร่งสปีด ✨';
  return 'ฟอร์มดีมาก! ลองทำคอมโบยาว ๆ ดู 😄';
}

export function createGoodJunkAI(opts={}){
  const model = GOODJUNK_MODEL_V1;
  const state = {
    seed: String(opts.seed||''),
    pid: String(opts.pid||'anon'),
    diff: String(opts.diff||'normal'),
    view: String(opts.view||'mobile'),
    lastHintAt: 0,
    lastRisk: 0,
    lastTop: [],
  };

  function extractFeatures(t){
    // t: telemetry snapshot from game
    const diff = String(t.diff||state.diff||'normal').toLowerCase();
    const view = String(t.view||state.view||'mobile').toLowerCase();
    const timeLeft = clamp(t.timeLeftSec ?? 0, 0, 999);
    const timeAll  = clamp(t.timeAllSec ?? 80, 20, 300);

    const shots = clamp(t.shots ?? 0, 0, 99999);
    const miss  = clamp(t.miss ?? 0, 0, 99999);
    const hitJ  = clamp(t.hitJunk ?? 0, 0, 99999);
    const hitG  = clamp(t.hitGood ?? 0, 0, 99999);
    const combo = clamp(t.combo ?? 0, 0, 999);

    const missRate = shots > 0 ? miss/shots : 0;
    const junkRate = shots > 0 ? hitJ/shots : 0;

    const rtGood = clamp(t.medianRtGoodMs ?? t.avgRtGoodMs ?? 600, 120, 2000);
    const rtNorm = clamp((rtGood-250)/(1200-250), 0, 1);

    const fever = clamp(t.feverPct ?? 0, 0, 100)/100;

    // Normalize
    const timeLeftNorm = clamp(timeLeft/timeAll, 0, 1);
    const comboNorm = clamp(combo/25, 0, 1);

    return [
      1, // bias
      diff==='easy'?1:0,
      diff==='normal'?1:0,
      diff==='hard'?1:0,
      view.includes('mob')?1:0,
      view.includes('pc')?1:0,
      timeLeftNorm,
      clamp(missRate,0,1),
      clamp(junkRate,0,1),
      comboNorm,
      rtNorm,
      fever
    ];
  }

  function predict(t){
    const x = extractFeatures(t||{});
    const z = dot(model.weights, x);
    let p = sigmoid(z);
    if(model.clamp) p = clamp(p, model.clamp.min, model.clamp.max);

    const top = explainTop(model, x);
    const hint = hintFromSignals(p, top);

    state.lastRisk = p;
    state.lastTop = top;

    return { risk:p, hint, top };
  }

  function maybeHint(t){
    const { risk, hint, top } = predict(t);
    const now = nowMs();
    // rate limit: at most once per 4s (kid-friendly)
    if(now - state.lastHintAt < 4000) return { risk, hint:'', top };
    state.lastHintAt = now;
    return { risk, hint, top };
  }

  function emitAIEvent(payload){
    try{
      window.dispatchEvent(new CustomEvent('hha:ai', { detail: payload }));
    }catch(e){}
  }

  return {
    name: 'GoodJunkAI',
    version: model.version,
    predict,
    maybeHint,
    emitAIEvent
  };
}