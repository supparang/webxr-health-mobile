// === /herohealth/hygiene-vr/hygiene.scoreboard.js ===
// Local scoreboard + Pass&Play
// Stores:
//  - HHA_HW_PLAYERS (players list)
//  - HHA_HW_LEADERBOARD (top runs)
//  - HHA_HW_LAST_PLAYER (last selected)
// Exposes: window.HHA_HW_SB = { getPlayer(), setPlayer(), listPlayers(), addRun(summary), top(n), reset() }

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const K_PLAYERS = 'HHA_HW_PLAYERS';
  const K_BOARD   = 'HHA_HW_LEADERBOARD';
  const K_LASTP   = 'HHA_HW_LAST_PLAYER';

  function load(key, fb){
    try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; }
  }
  function save(key, obj){
    try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
  }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, Number(v)||0)); }

  function normName(s){
    s = String(s||'').trim();
    if(!s) return 'Player';
    if(s.length > 18) s = s.slice(0,18);
    return s;
  }

  function listPlayers(){
    const arr = load(K_PLAYERS, []);
    return Array.isArray(arr) ? arr : [];
  }

  function ensurePlayer(name){
    name = normName(name);
    let players = listPlayers();

    // if exact exists, reuse
    let p = players.find(x=>x && x.name===name);
    if(!p){
      p = { id: 'P-' + Date.now() + '-' + Math.floor(Math.random()*1e6), name };
      players.unshift(p);
      players = players.slice(0, 50);
      save(K_PLAYERS, players);
    }
    save(K_LASTP, p);
    return p;
  }

  function getPlayer(){
    const p = load(K_LASTP, null);
    if(p && p.id) return p;
    // default
    return ensurePlayer('Player');
  }

  function setPlayer(name){
    return ensurePlayer(name);
  }

  function scoreFrom(summary){
    // Tuned for Hygiene: reward accuracy + combo + boss/miniboss, penalize misses/haz
    const acc = clamp(summary.stepAcc, 0, 1);
    const comboMax = clamp(summary.comboMax, 0, 999);
    const loops = clamp(summary.loopsDone, 0, 999);
    const boss = clamp(summary.bossClears||0, 0, 99);
    const mini = clamp(summary.miniBossClears||0, 0, 99);
    const haz = clamp(summary.hazHits||0, 0, 999);
    const miss = clamp(summary.misses||0, 0, 999);

    const base = Math.round(acc*1000);
    const comboPts = Math.min(400, Math.round(comboMax*8));
    const loopPts  = Math.min(300, loops*30);
    const bossPts  = boss*220;
    const miniPts  = mini*120;

    const penalty = haz*60 + miss*90;

    return Math.max(0, base + comboPts + loopPts + bossPts + miniPts - penalty);
  }

  function addRun(summary){
    if(!summary || summary.game!=='hygiene') return null;

    const p = getPlayer();

    const run = {
      id: summary.sessionId || ('R-' + Date.now()),
      at: summary.timestampIso || new Date().toISOString(),
      playerId: p.id,
      playerName: p.name,
      runMode: summary.runMode || 'play',
      diff: summary.diff || 'normal',
      view: summary.view || 'pc',
      dateKey: summary.dateKey || '',
      score: scoreFrom(summary),

      // key stats snapshot
      acc: summary.stepAcc,
      comboMax: summary.comboMax,
      loops: summary.loopsDone,
      boss: summary.bossClears||0,
      mini: summary.miniBossClears||0,
      haz: summary.hazHits||0,
      miss: summary.misses||0,
      reason: summary.reason || ''
    };

    let board = load(K_BOARD, []);
    board = Array.isArray(board) ? board : [];
    board.unshift(run);

    // keep last 300 runs
    board = board.slice(0, 300);

    // sort by score desc, then time desc
    board.sort((a,b)=> (b.score-a.score) || String(b.at).localeCompare(String(a.at)));

    save(K_BOARD, board);

    WIN.dispatchEvent(new CustomEvent('hha:leaderboard', { detail:{ run, top: board.slice(0,10) } }));

    return run;
  }

  function top(n=10){
    const board = load(K_BOARD, []);
    const arr = Array.isArray(board) ? board : [];
    return arr.slice(0, clamp(n,1,50));
  }

  function reset(){
    save(K_BOARD, []);
  }

  WIN.HHA_HW_SB = {
    getPlayer,
    setPlayer,
    listPlayers,
    addRun,
    top,
    reset
  };
})();