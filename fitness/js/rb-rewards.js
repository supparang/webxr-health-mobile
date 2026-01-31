// === /fitness/js/rb-rewards.js ===
// Local rewards: badges, streak, leaderboard, last summary (play-only)

(function(){
  'use strict';

  const KEY_LAST = 'RB_LAST_SUMMARY';
  const KEY_BADGES = 'RB_BADGES_UNLOCKED';
  const KEY_STREAK = 'RB_STREAK';
  const KEY_LB = 'RB_LEADERBOARD_V1';

  function nowIso(){ return new Date().toISOString(); }
  function todayKey(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  function readJSON(key, fallback){
    try{
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : fallback;
    }catch(_){ return fallback; }
  }
  function writeJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){}
  }

  function uniqPush(arr, v){
    if(!arr.includes(v)) arr.push(v);
  }

  // ====== streak ======
  function updateStreak(){
    const st = readJSON(KEY_STREAK, { lastDay:'', streak:0, best:0 });
    const t = todayKey();
    if(!st.lastDay){
      st.lastDay = t;
      st.streak = 1;
      st.best = Math.max(st.best||0, st.streak);
      writeJSON(KEY_STREAK, st);
      return st;
    }
    if(st.lastDay === t){
      // already counted today
      return st;
    }
    // check if yesterday
    const last = new Date(st.lastDay + 'T00:00:00');
    const cur  = new Date(t + 'T00:00:00');
    const diffDays = Math.round((cur-last) / (24*3600*1000));
    if(diffDays === 1){
      st.streak = (st.streak||0) + 1;
    }else{
      st.streak = 1;
    }
    st.lastDay = t;
    st.best = Math.max(st.best||0, st.streak);
    writeJSON(KEY_STREAK, st);
    return st;
  }

  // ====== badges rules ======
  const BADGE_META = {
    first_clear: { icon:'🎖️', name:'First Clear' },
    acc90:       { icon:'🧠', name:'Accuracy 90+' },
    perfect15:   { icon:'⚡', name:'Perfect 15+' },
    boss_slayer: { icon:'👑', name:'Boss Slayer' },
    shield_master:{icon:'🛡️', name:'Shield Master' },
    fever_lover: { icon:'🔥', name:'Fever Lover' }
  };

  function evalBadges(summary){
    const earned = [];
    const acc = +summary.accuracyPct || 0;
    const p = +summary.hitPerfect || 0;

    const bossWin = +summary.bossWins || 0;
    const shieldBlocks = +summary.shieldBlocked || 0;
    const feverPct = +summary.feverTimePct || 0;

    // First Clear: always if a play session ends normally
    earned.push('first_clear');

    if(acc >= 90) earned.push('acc90');
    if(p >= 15) earned.push('perfect15');
    if(bossWin >= 2) earned.push('boss_slayer');
    if(shieldBlocks >= 2) earned.push('shield_master');
    if(feverPct >= 20) earned.push('fever_lover');

    return earned;
  }

  function unlockBadges(earned){
    const unlocked = readJSON(KEY_BADGES, []);
    const newly = [];
    for(const b of earned){
      if(!unlocked.includes(b)){
        unlocked.push(b);
        newly.push(b);
      }
    }
    writeJSON(KEY_BADGES, unlocked);
    return { unlocked, newly };
  }

  // ====== leaderboard ======
  function addLeaderboard(summary){
    const lb = readJSON(KEY_LB, []);
    const entry = {
      name: summary.participant || 'Player',
      score: +summary.finalScore || 0,
      rank: summary.rank || '-',
      track: summary.trackName || '',
      mode: summary.modeLabel || '',
      acc: +summary.accuracyPct || 0,
      at: nowIso()
    };
    lb.push(entry);
    // sort desc by score
    lb.sort((a,b)=> (b.score||0) - (a.score||0));
    // keep top 10
    const out = lb.slice(0,10);
    writeJSON(KEY_LB, out);
    return out;
  }

  function saveLast(summary){
    writeJSON(KEY_LAST, summary);
  }

  function getLast(){ return readJSON(KEY_LAST, null); }
  function getBadges(){ return readJSON(KEY_BADGES, []); }
  function getStreak(){ return readJSON(KEY_STREAK, { lastDay:'', streak:0, best:0 }); }
  function getLB(){ return readJSON(KEY_LB, []); }

  // ===== public API =====
  window.RBRewards = {
    BADGE_META,
    saveAndReward(summary){
      // only play/normal
      if(!summary || summary.modeLabel === 'Research') return null;

      // update streak
      const st = updateStreak();

      // badges
      const earned = evalBadges(summary);
      const badgeState = unlockBadges(earned);

      // leaderboard
      const lb = addLeaderboard(summary);

      // save last
      saveLast(Object.assign({}, summary, {
        earnedBadges: earned,
        newlyBadges: badgeState.newly,
        streak: st.streak,
        streakBest: st.best
      }));

      return {
        streak: st,
        earnedBadges: earned,
        newlyBadges: badgeState.newly,
        badgesUnlocked: badgeState.unlocked,
        leaderboard: lb
      };
    },
    getLast,
    getBadges,
    getStreak,
    getLB
  };
})();