/* === /herohealth/vr-groups/groups-quests.js ===
Food Groups — Quest Director (PRODUCTION)
- Emits: quest:update {goalTitle,goalNow,goalNeed, miniTitle,miniNow,miniNeed,miniLeftSec,miniUrgent, goalsCleared,goalsTotal, miniCleared,miniTotal}
- Deterministic mini order by seed (?seed=...)
- Listens: hha:judge, hha:score, hha:time, groups:group_change, groups:storm
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // ---------------- utils ----------------
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function qs(name, def){
    try{
      const u = new URL(root.location.href);
      return u.searchParams.get(name) ?? def;
    }catch{ return def; }
  }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{}
  }
  function hashSeed(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
  }
  function mulberry32(a){
    return function(){
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleDet(arr, rng){
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const QT = (NS.QuestText || {}); // from groups-text.js (optional)

  // ---------------- state ----------------
  const seed = String(qs('seed','') || qs('sessionId','') || Date.now());
  const rng  = mulberry32(hashSeed(seed));

  const S = {
    curGroupId: 1,
    stormOn: false,
    timeLeft: 0,

    // scoreboard snapshots
    lastMisses: 0,
    lastCombo: 0,
    comboMaxSeen: 0,

    // goals
    goals: [],
    goalIdx: 0,
    goalsCleared: 0,

    // minis
    miniOrder: [],
    miniIdx: 0,
    miniCleared: 0,
    mini: null,         // active mini object
    miniTimer: null
  };

  // ---------------- goals (sequential) ----------------
  function buildGoals(){
    return [
      { key:'hit_good', title:'ยิงหมู่ปัจจุบันให้ได้ 12 🎯', need:12, now:0 },
      { key:'swap_group', title:'สลับหมู่ให้ได้ 3 ครั้ง ⚡', need:3, now:0 },
      { key:'boss_down', title:'โค่นบอสให้ได้ 2 ตัว 👹', need:2, now:0 }
    ];
  }

  // ---------------- minis (chain) ----------------
  function miniTemplates(){
    return [
      // 1) combo rush
      ()=>({
        key:'combo6',
        title:'MINI: คอมโบให้ถึง 6 ⚡',
        need:6, now:0,
        durationSec: 12,
        failOnBad: false,
        onScore(d){
          const c = d && Number.isFinite(d.combo) ? (d.combo|0) : 0;
          this.now = Math.max(this.now|0, c);
        }
      }),

      // 2) perfect window (no miss)
      ()=>({
        key:'nomiss8',
        title:'MINI: ห้ามพลาด 8 วิ 😤',
        need:8, now:0,
        durationSec: 8,
        failOnBad: true,
        onTick(){
          // now = seconds survived
          this.now = Math.max(0, this.durationSec - Math.ceil((this.endAt - Date.now())/1000));
        }
      }),

      // 3) storm rush: 5 good during storm
      ()=>({
        key:'storm5',
        title:'MINI: STORM RUSH ยิงถูก 5 ครั้ง 🌪️',
        need:5, now:0,
        durationSec: 10,
        requireStorm: true,
        failOnBad: true,
        onGood(){ this.now++; }
      }),

      // 4) answer question (call) + 3 hits same group
      ()=> {
        const gid = S.curGroupId || 1;
        const call = (QT.getCall ? QT.getCall(gid) : null) || { q:`หมู่ ${gid} มีอะไรบ้าง?`, a:'' };
        return {
          key:'call3',
          title: `MINI: ${call.q} ยิงหมู่ ${gid} 3 ครั้ง ✅`,
          need:3, now:0,
          durationSec: 9,
          lockedGroupId: gid,
          failOnBad: true,
          onGood(){
            if ((S.curGroupId|0) === (this.lockedGroupId|0)) this.now++;
          }
        };
      },

      // 5) accuracy burst: 7 goods (any group) within 10s
      ()=>({
        key:'good7',
        title:'MINI: ยิงถูก 7 ครั้งใน 10 วิ 🔥',
        need:7, now:0,
        durationSec: 10,
        failOnBad: false,
        onGood(){ this.now++; }
      }),

      // 6) “clean run”: 4 goods without any bad in between
      ()=>({
        key:'streak4',
        title:'MINI: ยิงถูกติดกัน 4 ครั้ง (ห้ามผิด/ขยะ) 🌟',
        need:4, now:0,
        durationSec: 14,
        failOnBad: true,
        onGood(){ this.now++; },
        onBad(){ this.now = 0; } // reset streak
      })
    ];
  }

  function makeMiniOrder(){
    const idxs = [0,1,2,3,4,5];
    return shuffleDet(idxs, rng);
  }

  function stopMiniTimer(){
    if (S.miniTimer){ clearInterval(S.miniTimer); S.miniTimer = null; }
  }

  function startNextMini(){
    stopMiniTimer();

    const templates = miniTemplates();
    const total = S.miniOrder.length;

    if (S.miniIdx >= total){
      S.mini = null;
      pushUpdate({ miniTitle:'—', miniNow:0, miniNeed:0, miniLeftSec:null, miniUrgent:false });
      return;
    }

    const tidx = S.miniOrder[S.miniIdx];
    const m = templates[tidx]();

    m.startedAt = Date.now();
    m.endAt = m.startedAt + Math.max(4, m.durationSec|0)*1000;
    m.fails = 0;

    // for nomiss8 - init now
    if (m.onTick) { try{ m.onTick(); }catch{} }

    S.mini = m;

    // ticking
    S.miniTimer = setInterval(()=>{
      if (!S.mini) return;

      // require storm?
      if (S.mini.requireStorm && !S.stormOn){
        // ถ้า mini นี้ต้องเกิดใน storm แต่ storm ยังไม่มา: รอ (ไม่ลดเวลา)
        S.mini.endAt = Date.now() + Math.max(4, S.mini.durationSec|0)*1000;
      }

      const left = Math.max(0, Math.ceil((S.mini.endAt - Date.now())/1000));
      if (S.mini.onTick) { try{ S.mini.onTick(); }catch{} }

      // time up -> fail & restart same mini
      if (Date.now() >= S.mini.endAt){
        failMini('timeout');
        return;
      }

      pushUpdate({ miniLeftSec:left, miniUrgent:(left<=3) });
      checkMiniComplete();
    }, 200);

    pushUpdate({ miniTitle:m.title, miniNow:m.now, miniNeed:m.need, miniLeftSec: Math.max(0, Math.ceil((m.endAt-Date.now())/1000)), miniUrgent:false });
  }

  function failMini(reason){
    if (!S.mini) return;
    const m = S.mini;
    m.fails = (m.fails|0) + 1;
    m.now = 0;
    m.startedAt = Date.now();
    m.endAt = m.startedAt + Math.max(4, m.durationSec|0)*1000;

    emit('hha:judge', { text: reason==='timeout' ? 'MINI FAIL (TIME)' : 'MINI FAIL', kind:'warn' });
    pushUpdate({ miniNow:m.now, miniNeed:m.need });
  }

  function checkMiniComplete(){
    const m = S.mini;
    if (!m) return;
    if ((m.now|0) >= (m.need|0)){
      S.miniCleared++;
      S.miniIdx++;

      emit('hha:celebrate', { kind:'mini', title: m.title });

      // show finished briefly, then next
      pushUpdate({ miniNow:m.need, miniNeed:m.need, miniLeftSec:0, miniUrgent:false });
      stopMiniTimer();
      setTimeout(startNextMini, 850);
    }
  }

  // ---------------- quest:update ----------------
  function currentGoal(){
    return S.goals[Math.max(0, Math.min(S.goals.length-1, S.goalIdx))] || null;
  }

  function pushUpdate(override){
    const g = currentGoal();

    const detail = Object.assign({
      // goal
      goalTitle: g ? g.title : 'ALL GOALS CLEARED! 🏁',
      goalNow:   g ? (g.now|0) : (S.goals.length|0),
      goalNeed:  g ? (g.need|0) : (S.goals.length|0),

      // mini
      miniTitle: S.mini ? S.mini.title : '—',
      miniNow:   S.mini ? (S.mini.now|0) : 0,
      miniNeed:  S.mini ? (S.mini.need|0) : 0,
      miniLeftSec: S.mini ? Math.max(0, Math.ceil((S.mini.endAt - Date.now())/1000)) : null,
      miniUrgent: false,

      // totals for end summary
      goalsCleared: S.goalsCleared|0,
      goalsTotal:   S.goals.length|0,
      miniCleared:  S.miniCleared|0,
      miniTotal:    S.miniOrder.length|0
    }, override || {});

    emit('quest:update', detail);
  }

  function advanceGoalIfDone(){
    const g = currentGoal();
    if (!g) return;
    if ((g.now|0) >= (g.need|0)){
      S.goalsCleared++;
      S.goalIdx++;
      emit('hha:celebrate', { kind:'goal', title: g.title });
      pushUpdate({});
    }
  }

  // ---------------- event handlers ----------------
  function onGood(){
    // goal 1
    const g = currentGoal();
    if (g && g.key === 'hit_good'){
      g.now++;
      pushUpdate({ goalNow:g.now, goalNeed:g.need });
      advanceGoalIfDone();
    }

    // mini
    if (S.mini && S.mini.onGood){
      try{ S.mini.onGood(); }catch{}
      pushUpdate({ miniNow:S.mini.now, miniNeed:S.mini.need });
      checkMiniComplete();
    }
  }

  function onBad(kind, text){
    // mini fail rules
    if (S.mini){
      if (S.mini.failOnBad){
        // streak mini: allow reset via onBad
        if (S.mini.onBad){
          try{ S.mini.onBad(kind, text); }catch{}
          pushUpdate({ miniNow:S.mini.now, miniNeed:S.mini.need });
        } else {
          failMini('bad');
        }
      } else {
        // no fail, but allow custom reset
        if (S.mini.onBad){
          try{ S.mini.onBad(kind, text); }catch{}
          pushUpdate({ miniNow:S.mini.now, miniNeed:S.mini.need });
        }
      }
    }
  }

  function onBossDown(){
    const g = currentGoal();
    if (g && g.key === 'boss_down'){
      g.now++;
      pushUpdate({ goalNow:g.now, goalNeed:g.need });
      advanceGoalIfDone();
    }
  }

  root.addEventListener('groups:group_change', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    S.curGroupId = Number(d.groupId) || 1;
  }, { passive:true });

  root.addEventListener('groups:storm', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    S.stormOn = !!d.on;

    // ถ้า mini ต้อง storm แล้ว storm เพิ่งมา -> รีเฟรชเวลาให้เริ่มจริง
    if (S.mini && S.mini.requireStorm && S.stormOn){
      S.mini.startedAt = Date.now();
      S.mini.endAt = S.mini.startedAt + Math.max(4, S.mini.durationSec|0)*1000;
      pushUpdate({});
    }
  }, { passive:true });

  root.addEventListener('hha:time', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    S.timeLeft = Number.isFinite(d.left) ? (d.left|0) : S.timeLeft;
  }, { passive:true });

  root.addEventListener('hha:score', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    const misses = Number.isFinite(d.misses) ? (d.misses|0) : 0;
    const combo  = Number.isFinite(d.combo) ? (d.combo|0) : 0;

    // goal 2 uses group swaps event, not here
    // mini update (combo-based)
    if (S.mini && S.mini.onScore){
      try{ S.mini.onScore(d); }catch{}
      pushUpdate({ miniNow:S.mini.now, miniNeed:S.mini.need });
      checkMiniComplete();
    }

    // detect miss increased for "nomiss" mini (optional)
    if (misses > (S.lastMisses|0)){
      onBad('miss', 'MISS');
    }
    S.lastMisses = misses;
    S.lastCombo = combo;
    S.comboMaxSeen = Math.max(S.comboMaxSeen|0, combo|0);
  }, { passive:true });

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    const kind = String(d.kind || '').toLowerCase();
    const text = String(d.text || '');

    if (kind === 'good'){
      onGood();
      return;
    }

    // boss down detection
    if (kind === 'boss' && text.includes('BOSS DOWN')){
      onBossDown();
      return;
    }

    // “bad-ish” signals
    if (kind === 'bad') { onBad(kind, text); return; }
    if (kind === 'warn'){
      // WRONG / DECOY / etc.
      if (text.includes('WRONG') || text.includes('DECOY') || text.includes('STUN')) onBad(kind, text);
      return;
    }
  }, { passive:true });

  // group swap progress -> goal 2
  root.addEventListener('groups:progress', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if (String(d.kind||'') !== 'group_swap') return;

    const g = currentGoal();
    if (g && g.key === 'swap_group'){
      g.now++;
      pushUpdate({ goalNow:g.now, goalNeed:g.need });
      advanceGoalIfDone();
    }
  }, { passive:true });

  // ---------------- init ----------------
  S.goals = buildGoals();
  S.goalIdx = 0;
  S.goalsCleared = 0;

  S.miniOrder = makeMiniOrder();
  S.miniIdx = 0;
  S.miniCleared = 0;

  // push blank immediately so HUD never empty
  pushUpdate({
    goalTitle: S.goals[0].title,
    goalNow:0, goalNeed:S.goals[0].need,
    miniTitle:'กำลังเตรียม MINI…', miniNow:0, miniNeed:0
  });

  // start first mini after a beat
  setTimeout(startNextMini, 900);

})();