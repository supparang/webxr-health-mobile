// === /herohealth/vr-groups/ai-learner.js ===
// Contextual Bandit (Epsilon-Greedy) — lightweight
// ✅ chooseAction(features) -> returns action string
// ✅ learn(reward, ctx) optional
// ✅ Stores Q-table in localStorage
// ✅ Play only is recommended (gate in safe.js already)

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const LS_Q = 'HHA_GROUPS_AI_Q';

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  function safeParse(s,def){ try{return JSON.parse(s);}catch{return def;} }
  function loadQ(){ try{ return safeParse(localStorage.getItem(LS_Q)||'', {});}catch{ return {}; } }
  function saveQ(q){ try{ localStorage.setItem(LS_Q, JSON.stringify(q)); }catch{} }

  // Actions: map later in safe.js -> pattern
  const ACTIONS = ['SCATTER','CENTER','ZIGZAG','LINE'];

  const CFG = {
    eps: 0.18,         // exploration
    alpha: 0.22,       // learning rate
    gamma: 0.0         // bandit (no future)
  };

  let Q = loadQ();

  function bucket(features){
    // tiny discretization (เด็ก ป.5 ใช้จริง: ไม่ต้องซับซ้อน)
    const acc = clamp(features.acc||0, 0, 100);
    const miss= clamp(features.miss||0,0,30);
    const combo=clamp(features.combo||0,0,20);
    const storm=features.storm?1:0;
    const left = clamp(features.left||0,0,180);

    const accB = (acc>=88)?'A3':(acc>=75?'A2':(acc>=60?'A1':'A0'));
    const missB= (miss<=2)?'M0':(miss<=6?'M1':(miss<=12?'M2':'M3'));
    const comboB=(combo>=8)?'C2':(combo>=3?'C1':'C0');
    const leftB = (left<=12)?'T0':(left<=35?'T1':'T2');

    return [accB, missB, comboB, leftB, 'S'+storm].join('_');
  }

  function getRow(state){
    if(!Q[state]) Q[state] = { n:0, v:{} };
    const row = Q[state];
    for(const a of ACTIONS){
      if(typeof row.v[a] !== 'number') row.v[a] = 0;
    }
    return row;
  }

  function argmax(obj){
    let bestK = null, bestV = -1e18;
    for(const k in obj){
      const v = obj[k];
      if(v>bestV){ bestV=v; bestK=k; }
    }
    return bestK;
  }

  // pick action
  function chooseAction(features){
    const s = bucket(features||{});
    const row = getRow(s);

    // epsilon-greedy
    if(Math.random() < CFG.eps){
      const r = (Math.random()*ACTIONS.length)|0;
      return ACTIONS[r];
    }
    return argmax(row.v) || 'SCATTER';
  }

  // optional learning hook (if you want later)
  function learn(reward, ctx){
    reward = Number(reward)||0;
    const s = bucket(ctx||{});
    const a = String((ctx && ctx.action) || '') || 'SCATTER';
    const row = getRow(s);
    row.n = (row.n|0) + 1;
    row.v[a] = row.v[a] + CFG.alpha * (reward - row.v[a]);
    Q[s] = row;
    saveQ(Q);
  }

  NS.AILearner = { chooseAction, learn, reset: ()=>{ Q={}; saveQ(Q);} };

})(typeof window!=='undefined'?window:globalThis);