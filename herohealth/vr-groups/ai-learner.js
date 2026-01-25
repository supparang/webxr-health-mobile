/* === /herohealth/vr-groups/ai-learner.js ===
Local Learner (bandit)
✅ chooseAction(ctx) -> string action
✅ updateReward(action, reward) -> maintain Q
✅ Persists in localStorage: HHA_GROUPS_BANDIT_V1
Notes:
- ใช้ได้เฉพาะ play + ?ai=1 (ตัว gating อยู่ที่ groups-vr.html)
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const LS = 'HHA_GROUPS_BANDIT_V1';

  const ACTIONS = ['SCATTER','CENTER','FOCUS']; 
  // SCATTER = กระจายปกติ, CENTER = เน้นกลาง, FOCUS = เน้นหมู่เดิม/ยิงชัวร์ (เชิง UX)

  function safeParse(s, d){ try{ return JSON.parse(String(s||'')); }catch{ return d; } }
  function save(st){ try{ localStorage.setItem(LS, JSON.stringify(st)); }catch(_){ } }
  function load(){
    const st = safeParse(localStorage.getItem(LS), null);
    if (st && st.q && st.n) return st;
    return { q:{SCATTER:0, CENTER:0, FOCUS:0}, n:{SCATTER:0, CENTER:0, FOCUS:0}, t: Date.now() };
  }

  let ST = load();

  function ucbScore(a){
    const q = Number(ST.q[a]||0);
    const n = Math.max(1, Number(ST.n[a]||0));
    const total = ACTIONS.reduce((s,x)=>s+Math.max(0, Number(ST.n[x]||0)), 0) + 1;
    // exploration
    const c = 0.9;
    return q + c * Math.sqrt(Math.log(total) / n);
  }

  function chooseAction(ctx){
    ctx = ctx || {};
    // ถ้าเสี่ยงสูง ให้ prefer FOCUS
    const acc = Number(ctx.acc||0);
    const miss= Number(ctx.miss||0);
    const combo=Number(ctx.combo||0);
    const storm=!!ctx.storm;
    const miniUrg=!!ctx.miniUrg;

    if (miniUrg || storm || miss>=10 || acc<55) return 'FOCUS';
    if (combo>=8 && acc>=80) return 'CENTER';

    // UCB
    let bestA = 'SCATTER';
    let best = -1e9;
    for (const a of ACTIONS){
      const s = ucbScore(a);
      if (s>best){ best=s; bestA=a; }
    }
    return bestA;
  }

  function updateReward(action, reward){
    action = String(action||'SCATTER');
    if (!ACTIONS.includes(action)) action='SCATTER';
    reward = Number(reward)||0;

    const n = (Number(ST.n[action]||0) + 1);
    const q = Number(ST.q[action]||0);
    // incremental mean
    const q2 = q + (reward - q)/n;
    ST.n[action]=n;
    ST.q[action]=Math.round(q2*1000)/1000;
    ST.t = Date.now();
    save(ST);
  }

  // auto reward on end: reward = accuracy - missPenalty + scoreBoost
  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail||{};
    // action used last stored in window var if present
    const a = String(root.__HHA_GROUPS_LAST_ACTION__ || 'SCATTER');
    const acc = Number(d.accuracyGoodPct||0);
    const miss= Number(d.misses||0);
    const score=Number(d.scoreFinal||0);

    const reward = (acc/100) - Math.min(0.6, miss*0.03) + Math.min(0.25, Math.log10(Math.max(10,score))*0.06);
    updateReward(a, reward);
  }, {passive:true});

  NS.AILearner = {
    actions: ACTIONS.slice(),
    chooseAction,
    updateReward,
    getState: ()=>ST,
    reset: ()=>{ ST = { q:{SCATTER:0, CENTER:0, FOCUS:0}, n:{SCATTER:0, CENTER:0, FOCUS:0}, t: Date.now() }; save(ST); }
  };
})(typeof window!=='undefined'?window:globalThis);