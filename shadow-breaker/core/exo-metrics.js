// EXO Metrics — session logging + totals + level/xp + rank
window.EXO_METRICS = (function(){
  const KEY = 'EXO_METRICS_V1';
  const get = () => EXO.store.get(KEY, {profile:{level:1,xp:0}, totals:{sessions:0,time:0,score:0}, sessions:[]});
  const set = (data) => EXO.store.set(KEY, data);

  // EXP & Rank
  const XP_PER_LEVEL = 500; // linear curve
  const ranks = [
    {name:'Bronze',  min:0},
    {name:'Silver',  min:5000},
    {name:'Gold',    min:15000},
    {name:'Platinum',min:30000},
    {name:'Diamond', min:60000}
  ];
  function calcRank(totalScore){
    let cur=ranks[0].name;
    for(const r of ranks){ if(totalScore>=r.min) cur=r.name; }
    return cur;
  }

  function gainXPFromSession(stat){
    // Score/Accuracy based XP (bounded)
    const acc = Math.max(0, Math.min(100, stat.accuracy||0));
    const base = Math.min(500, Math.round((stat.score||0)/20));
    const bonus = Math.round(acc*1.2); // up to +120
    const timeB = Math.round((stat.duration||0)/2); // +0.5 xp/sec
    return Math.max(30, base + bonus + timeB);
  }

  function recordSession(stat){
    // stat = {module, score, accuracy, hits, misses, duration, diff}
    const db = get();
    db.totals.sessions += 1;
    db.totals.time     += stat.duration||0;
    db.totals.score    += stat.score||0;
    db.sessions.push({t:Date.now(), ...stat});

    // XP & Level
    const addXP = gainXPFromSession(stat);
    db.profile.xp += addXP;
    while(db.profile.xp >= db.profile.level*XP_PER_LEVEL){
      db.profile.xp -= db.profile.level*XP_PER_LEVEL;
      db.profile.level += 1;
    }
    db.profile.rank = calcRank(db.totals.score);
    set(db);
    return {addedXP:addXP, level:db.profile.level, xp:db.profile.xp, rank:db.profile.rank};
  }

  function dashboard(){
    const db = get();
    const avgScore = db.totals.sessions? Math.round(db.totals.score/db.totals.sessions) : 0;
    return {
      profile: db.profile,
      totals: { ...db.totals, avgScore },
      recent: db.sessions.slice(-5).reverse()
    };
  }

  return { recordSession, dashboard };
})();
