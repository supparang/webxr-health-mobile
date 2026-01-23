// === /herohealth/vr/hha-daily-quest.js ===
// Daily Quest + Streak (7-day chain) — HHA Standard
// Stores:
//  - HHA_DAILY_QUEST: today quest state
//  - HHA_HYGIENE_REWARDS: coins/stars (reuse)
//  - HHA_HYGIENE_UNLOCKS: optional unlocks for streak rewards (reuse)
//
// Rules:
//  - runMode=study/research => NO reward/claim (can track but do not pay)
//  - quests are visual-friendly and research-safe

(function(){
  'use strict';

  const WIN = window;

  const LS_DAILY  = 'HHA_DAILY_QUEST';
  const LS_REWARD = 'HHA_HYGIENE_REWARDS';
  const LS_UNLOCK = 'HHA_HYGIENE_UNLOCKS';

  const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));

  function loadJson(key, fb){
    try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : fb; }catch{ return fb; }
  }
  function saveJson(key, obj){
    try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
  }

  function dayKey(d=new Date()){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const da=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  function makeRNG(seed){
    let x = (Number(seed)||Date.now()) >>> 0;
    return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
  }

  function getRewards(){
    const fb = { coins:0, stars:0, lastEarnIso:'', byDay:{} };
    const r = loadJson(LS_REWARD, fb);
    if(!r || typeof r!=='object') return fb;
    if(!r.byDay || typeof r.byDay!=='object') r.byDay = {};
    r.coins = clamp(r.coins||0, 0, 1e12);
    r.stars = clamp(r.stars||0, 0, 1e12);
    return r;
  }
  function saveRewards(r){ saveJson(LS_REWARD, r); }

  function getUnlocks(){
    const fb = { owned:{}, equipped:{ frame:'frame-default', aura:'aura-off', badge:'badge-none', title:'title-none' }, daily:{ lastClaimKey:'', streak:0 } };
    const u = loadJson(LS_UNLOCK, fb);
    if(!u || typeof u!=='object') return fb;
    if(!u.owned || typeof u.owned!=='object') u.owned = {};
    if(!u.equipped || typeof u.equipped!=='object') u.equipped = fb.equipped;
    if(!u.daily || typeof u.daily!=='object') u.daily = fb.daily;
    u.daily.streak = clamp(u.daily.streak||0, 0, 9999);
    return u;
  }
  function saveUnlocks(u){ saveJson(LS_UNLOCK, u); }

  // ---------------- Quest templates ----------------
  // Keep it simple for Grade 5: 2 quests/day
  const TEMPLATES = [
    {
      id:'acc',
      title:'🎯 แม่นให้ครบ',
      desc:(t)=>`ทำความถูกต้อง (stepAcc) ≥ ${(t*100)|0}%`,
      target:(diff)=> diff==='easy'?0.70:(diff==='hard'?0.80:0.75),
      check:(sum, t)=> Number(sum.stepAcc||0) >= t,
      progress:(sum, t)=> clamp(Number(sum.stepAcc||0)/t, 0, 1),
      reward:(diff)=> ({ coin: diff==='hard'?38:30, star: 2 })
    },
    {
      id:'safe',
      title:'🦠 หลีกเชื้อ',
      desc:(t)=>`โดนเชื้อ (hazHits) ≤ ${t} ครั้ง`,
      target:(diff)=> diff==='easy'?3:(diff==='hard'?1:2),
      check:(sum, t)=> Number(sum.hazHits||0) <= t,
      progress:(sum, t)=> {
        const hz = Number(sum.hazHits||0);
        // 1.0 when hz<=t, drop as hz grows
        return clamp((t+1)/(hz+1), 0, 1);
      },
      reward:(diff)=> ({ coin: diff==='hard'?42:34, star: 2 })
    },
    {
      id:'combo',
      title:'🔥 คอมโบต่อเนื่อง',
      desc:(t)=>`ทำคอมโบสูงสุด ≥ ${t}`,
      target:(diff)=> diff==='easy'?10:(diff==='hard'?18:14),
      check:(sum, t)=> Number(sum.comboMax||0) >= t,
      progress:(sum, t)=> clamp(Number(sum.comboMax||0)/t, 0, 1),
      reward:(diff)=> ({ coin: diff==='hard'?44:36, star: 2 })
    },
    {
      id:'loops',
      title:'🏁 ครบ 7 ขั้นตอน',
      desc:(t)=>`ทำครบวน 7 ขั้นตอน ≥ ${t} รอบ`,
      target:(diff)=> diff==='easy'?1:(diff==='hard'?2:2),
      check:(sum, t)=> Number(sum.loopsDone||0) >= t,
      progress:(sum, t)=> clamp(Number(sum.loopsDone||0)/t, 0, 1),
      reward:(diff)=> ({ coin: diff==='hard'?48:38, star: 3 })
    },
    {
      id:'speed',
      title:'⏱️ เร็วแต่ถูก',
      desc:(t)=>`Median hit time ≤ ${t} ms`,
      target:(diff)=> diff==='easy'?2200:(diff==='hard'?1700:1900),
      check:(sum, t)=> Number(sum.medianStepMs||999999) <= t,
      progress:(sum, t)=> {
        const v = Number(sum.medianStepMs||999999);
        if(!isFinite(v)) return 0;
        // 1.0 when <=t, decreases when slower
        return clamp(t / Math.max(1, v), 0, 1);
      },
      reward:(diff)=> ({ coin: diff==='hard'?40:32, star: 2 })
    }
  ];

  function generateToday(diff='normal'){
    const key = dayKey();
    const seed = Number(String(key).replace(/-/g,'')) + 13579;
    const rng = makeRNG(seed);

    // pick 2 different templates deterministically
    const pool = TEMPLATES.slice();
    const pick = [];
    while(pick.length < 2 && pool.length){
      const i = Math.floor(rng()*pool.length);
      pick.push(pool.splice(i,1)[0]);
    }

    const quests = pick.map(q=>{
      const t = q.target(diff);
      const rew = q.reward(diff);
      return {
        qid: q.id,
        title: q.title,
        desc: q.desc(t),
        target: t,
        progress: 0,
        done: false,
        rewardCoin: rew.coin,
        rewardStar: rew.star,
        lastUpdateIso: '',
        // UX
        icon: q.title.split(' ')[0] || '✅'
      };
    });

    return {
      dateKey: key,
      seed,
      diff,
      quests,
      allDone: false,
      claimed: false,
      // streak system (stored also in unlocks.daily)
      lastCompleteKey: '',
      updatedIso: ''
    };
  }

  function getToday(diffHint='normal'){
    const key = dayKey();
    const d = loadJson(LS_DAILY, null);

    if(!d || d.dateKey !== key){
      const fresh = generateToday(diffHint);
      saveJson(LS_DAILY, fresh);
      return fresh;
    }
    // ensure shape
    if(!Array.isArray(d.quests)) d.quests = [];
    return d;
  }

  function computeAllDone(state){
    return state.quests.length>0 && state.quests.every(q=>!!q.done);
  }

  function updateFromSummary(summary){
    const runMode = String(summary.runMode||summary.run||'play').toLowerCase();
    const diff = String(summary.diff||'normal').toLowerCase();

    const st = getToday(diff);
    // If diff changed today, keep state but update diff for reward flavor (optional)
    st.diff = st.diff || diff;

    // apply progress
    for(const q of st.quests){
      const tpl = TEMPLATES.find(t=>t.id===q.qid);
      if(!tpl) continue;
      const t = q.target;
      q.progress = tpl.progress(summary, t);
      q.done = tpl.check(summary, t);
      q.lastUpdateIso = new Date().toISOString();
    }

    st.allDone = computeAllDone(st);
    st.updatedIso = new Date().toISOString();

    // IMPORTANT: in study/research, DO NOT auto-claim/pay
    saveJson(LS_DAILY, st);

    return { state: st, canClaim: (st.allDone && !st.claimed && (runMode==='play')) };
  }

  function claimToday(opts={}){
    const diffHint = (opts.diffHint||'normal');
    const runMode = String(opts.runMode||'play').toLowerCase();
    if(runMode !== 'play') return { ok:false, reason:'no-reward-in-study' };

    const st = getToday(diffHint);
    if(!st.allDone || st.claimed) return { ok:false, reason:'not-ready' };

    // pay rewards
    const rew = getRewards();
    let addC=0, addS=0;
    st.quests.forEach(q=>{
      if(q.done){
        addC += Number(q.rewardCoin||0);
        addS += Number(q.rewardStar||0);
      }
    });

    rew.coins += addC;
    rew.stars += addS;
    rew.lastEarnIso = new Date().toISOString();
    rew.byDay[st.dateKey] = Object.assign({}, rew.byDay[st.dateKey]||{}, { coin:(rew.byDay[st.dateKey]?.coin||0)+addC, star:(rew.byDay[st.dateKey]?.star||0)+addS });
    saveRewards(rew);

    // streak
    const u = getUnlocks();
    const last = String(u.daily.lastClaimKey||'');
    const today = st.dateKey;

    // detect consecutive day
    const y = new Date(); y.setDate(y.getDate()-1);
    const yKey = dayKey(y);

    if(last === yKey) u.daily.streak = clamp((u.daily.streak||0)+1, 0, 9999);
    else if(last === today) { /* already */ }
    else u.daily.streak = 1;

    u.daily.lastClaimKey = today;

    // 7-day streak rewards (cosmetic/title unlock) — VISUAL ONLY
    // You can map these to your store items (from PACK V)
    if(u.daily.streak === 3){
      u.owned['aura-spark'] = true;
    }
    if(u.daily.streak === 7){
      u.owned['aura-hero'] = true;
      u.owned['title-combo'] = true;
    }

    saveUnlocks(u);

    st.claimed = true;
    st.lastCompleteKey = today;
    saveJson(LS_DAILY, st);

    // emit events for UI popups if you want
    try{ WIN.dispatchEvent(new CustomEvent('hha:daily_claim', { detail:{ dateKey: today, addC, addS, streak:u.daily.streak } })); }catch{}

    return { ok:true, addC, addS, streak:u.daily.streak, dateKey: today };
  }

  function resetAll(){
    try{ localStorage.removeItem(LS_DAILY); }catch{}
  }

  WIN.HHA_DailyQuest = {
    getToday,
    updateFromSummary,
    claimToday,
    resetAll
  };
})();