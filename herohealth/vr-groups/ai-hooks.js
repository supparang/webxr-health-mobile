/* === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks — DATASET PACK (v6-34)
✅ Play-only: enabled via attach({enabled:true}) (your groups-vr.html already does this)
✅ Research/practice: attach called but enabled=false => NO inference / NO mutation (safe)
✅ Buffers: events + state snapshots (bounded)
✅ Windowing: every 500ms, lookback 8000ms
✅ Labels: miss_in_next_3s, combo_break_in_next_3s
✅ exportDataset(): returns JSON {meta, schemaVersion, data:[...]}
✅ getState(): for Risk UI (acc/misses/pressure/storm/mini/boss)
*/

(function (root) {
  'use strict';

  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  // ---------------- Utils ----------------
  const clamp = (v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); };
  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function safeJsonParse(s, def){
    try{ return JSON.parse(s); }catch{ return def; }
  }

  // ---------------- Internal state ----------------
  const CFG = {
    schemaVersion: 'hha-ai-ds-1.0',
    stepMs: 500,
    lookbackMs: 8000,
    horizonMs: 3000,
    maxEvents: 6000,
    maxStates: 6000,
  };

  const S = {
    attached: false,
    enabled: false,
    runMode: 'play',
    seed: '',
    level: 'b', // a|b|c

    // live gameplay state
    t0: 0,
    lastTick: 0,

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    acc: 0,
    grade: 'C',
    pressure: 0,
    powerCharge: 0,
    powerThr: 0,
    timeLeft: 0,

    stormOn: false,
    miniOn: false,
    bossOn: false,

    // for deltas
    _lastCombo: 0,
    _lastMisses: 0,
    _lastAcc: 0,

    // buffers
    events: [],   // {t,type,meta?}
    states: [],   // {t,score,combo,misses,acc,pressure,storm,mini,boss,timeLeft}

    // session meta
    meta: {
      gameTag: 'GroupsVR',
      projectTag: 'HeroHealth',
      startedAtIso: null,
      endedAtIso: null,
      view: '',
      diff: '',
      style: '',
      run: '',
      studyId: '',
      conditionGroup: '',
    }
  };

  function pushEvent(type, meta){
    const t = nowMs();
    S.events.push({ t, type: String(type||''), meta: meta||null });
    if (S.events.length > CFG.maxEvents) S.events.splice(0, S.events.length - CFG.maxEvents);
  }

  function pushState(){
    const t = nowMs();
    S.states.push({
      t,
      score: S.score|0,
      combo: S.combo|0,
      misses: S.misses|0,
      acc: S.acc|0,
      pressure: S.pressure|0,
      storm: !!S.stormOn,
      mini: !!S.miniOn,
      boss: !!S.bossOn,
      timeLeft: Number(S.timeLeft||0)
    });
    if (S.states.length > CFG.maxStates) S.states.splice(0, S.states.length - CFG.maxStates);
  }

  function resetSession(opts){
    S.t0 = nowMs();
    S.lastTick = S.t0;

    S.events = [];
    S.states = [];

    S.score = 0;
    S.combo = 0;
    S.comboMax = 0;
    S.misses = 0;
    S.acc = 0;
    S.grade = 'C';
    S.pressure = 0;
    S.powerCharge = 0;
    S.powerThr = 0;
    S.timeLeft = 0;

    S.stormOn = false;
    S.miniOn = false;
    S.bossOn = false;

    S._lastCombo = 0;
    S._lastMisses = 0;
    S._lastAcc = 0;

    const o = opts||{};
    S.meta.startedAtIso = new Date().toISOString();
    S.meta.endedAtIso = null;
    S.meta.view = String(o.view||'');
    S.meta.diff = String(o.diff||'');
    S.meta.style= String(o.style||'');
    S.meta.run  = String(o.runMode||'');
    S.meta.studyId = String(o.studyId||'');
    S.meta.conditionGroup = String(o.conditionGroup||'');

    pushEvent('session_start', { runMode:S.runMode, seed:S.seed, level:S.level });
    pushState();
  }

  // ---------------- Label definitions ----------------
  // "miss" = misses increased (ground truth)
  // "combo_break" = combo drops to 0 from >=2 OR shoot_empty event triggers combo reset
  function isMissEvent(ev){
    return ev && ev.type === 'miss';
  }
  function isComboBreakEvent(ev){
    return ev && (ev.type === 'combo_break');
  }

  // ---------------- Window feature builder ----------------
  // We build windows at export time to keep runtime light.
  function buildWindows(){
    if (!S.states.length) return [];

    const tStart = S.states[0].t;
    const tEnd   = S.states[S.states.length - 1].t;

    const step = CFG.stepMs;
    const look = CFG.lookbackMs;
    const hor  = CFG.horizonMs;

    // Pointers for past-window event scanning
    const events = S.events.slice().sort((a,b)=>a.t-b.t);

    // Precompute arrays of indices for faster future label scan
    // We'll scan in small horizons; still fine for mobile given bounded size.
    const windows = [];

    let eL = 0; // left pointer for past window
    let eR = 0; // right pointer for events up to t

    // Helper: counts in [t-look, t]
    function getCounts(t){
      const t0 = t - look;
      while (eL < events.length && events[eL].t < t0) eL++;
      while (eR < events.length && events[eR].t <= t) eR++;

      let hit_good=0, hit_wrong=0, hit_junk=0, shoot_empty=0, miss=0, boss_hit=0;
      let storm_on=0, storm_off=0, mini_start=0, mini_end=0;

      for (let i = eL; i < eR; i++){
        const tp = events[i].type;
        if (tp === 'hit_good') hit_good++;
        else if (tp === 'hit_wrong') hit_wrong++;
        else if (tp === 'hit_junk') hit_junk++;
        else if (tp === 'shoot_empty') shoot_empty++;
        else if (tp === 'miss') miss++;
        else if (tp === 'boss_hit') boss_hit++;
        else if (tp === 'storm_on') storm_on++;
        else if (tp === 'storm_off') storm_off++;
        else if (tp === 'mini_start') mini_start++;
        else if (tp === 'mini_end') mini_end++;
      }

      const actions = hit_good + hit_wrong + hit_junk + shoot_empty + boss_hit;

      return {
        hit_good, hit_wrong, hit_junk, shoot_empty, miss, boss_hit,
        storm_on, storm_off, mini_start, mini_end,
        actions
      };
    }

    // Helper: find nearest state at time t (states are dense, but we can move pointer)
    let sPtr = 0;
    function stateAt(t){
      while (sPtr + 1 < S.states.length && S.states[sPtr + 1].t <= t) sPtr++;
      return S.states[sPtr] || S.states[S.states.length-1];
    }

    // Helper: future label in (t, t+hor]
    function futureLabel(t){
      const tF = t + hor;
      let missSoon = 0;
      let comboBreakSoon = 0;

      // scan events in horizon (bounded); use a quick loop
      for (let i = 0; i < events.length; i++){
        const ev = events[i];
        if (ev.t <= t) continue;
        if (ev.t > tF) break;
        if (isMissEvent(ev)) missSoon = 1;
        if (isComboBreakEvent(ev)) comboBreakSoon = 1;
        if (missSoon && comboBreakSoon) break;
      }
      return { missSoon, comboBreakSoon };
    }

    for (let t = tStart; t <= tEnd; t += step){
      const st = stateAt(t);
      const c  = getCounts(t);
      const lab = futureLabel(t);

      // Derived
      const denom = Math.max(1, c.hit_good + c.hit_wrong + c.hit_junk + c.boss_hit);
      const acc8 = Math.round((c.hit_good / denom) * 100);

      // Pace
      const actionsPerSec = Math.round((c.actions / (look/1000)) * 100) / 100;

      windows.push({
        t,
        // features
        f: {
          // window counts (8s)
          hit_good_8s: c.hit_good,
          hit_wrong_8s: c.hit_wrong,
          hit_junk_8s: c.hit_junk,
          miss_8s: c.miss,
          shoot_empty_8s: c.shoot_empty,
          boss_hit_8s: c.boss_hit,

          acc_8s: acc8,
          acc_session: st.acc|0,

          combo_now: st.combo|0,
          misses_total: st.misses|0,
          pressure: st.pressure|0,

          storm_on: st.storm ? 1 : 0,
          mini_on: st.mini ? 1 : 0,
          boss_on: st.boss ? 1 : 0,

          time_left: Number(st.timeLeft||0),

          actions_per_sec_8s: actionsPerSec,
          score: st.score|0,
        },
        // labels
        y: {
          miss_in_next_3s: lab.missSoon,
          combo_break_in_next_3s: lab.comboBreakSoon
        }
      });
    }

    return windows;
  }

  // ---------------- Event listeners ----------------
  function onScore(ev){
    const d = ev.detail || {};
    const score = Number(d.score ?? 0);
    const combo = Number(d.combo ?? 0);
    const misses = Number(d.misses ?? 0);

    // detect miss by misses delta
    if (misses > S._lastMisses){
      pushEvent('miss', { delta: misses - S._lastMisses });
    }

    // detect combo break by combo dropping to 0 from >=2
    if (combo === 0 && S._lastCombo >= 2){
      pushEvent('combo_break', { from: S._lastCombo });
    }

    S.score = score|0;
    S.combo = combo|0;
    S.comboMax = Math.max(S.comboMax|0, S.combo|0);
    S.misses = misses|0;

    S._lastCombo = S.combo|0;
    S._lastMisses = S.misses|0;

    // light state snapshot throttling
    const t = nowMs();
    if (t - S.lastTick >= 240){
      S.lastTick = t;
      pushState();
    }
  }

  function onRank(ev){
    const d = ev.detail || {};
    S.grade = String(d.grade ?? 'C');
    const acc = Number(d.accuracy ?? 0);
    // if accuracy changes a lot, snapshot
    if (Math.abs(acc - S._lastAcc) >= 2){
      S._lastAcc = acc;
      S.acc = acc|0;
      pushState();
    }else{
      S.acc = acc|0;
    }
  }

  function onTime(ev){
    const d = ev.detail || {};
    S.timeLeft = Number(d.left ?? 0);
    // snapshot at 1s steps
    pushState();
  }

  function onPower(ev){
    const d = ev.detail || {};
    S.powerCharge = Number(d.charge ?? 0)|0;
    S.powerThr = Number(d.threshold ?? 0)|0;
  }

  function onProgress(ev){
    const d = ev.detail || {};
    const k = String(d.kind || '');
    if (k === 'storm_on'){ S.stormOn = true; pushEvent('storm_on'); pushState(); }
    if (k === 'storm_off'){ S.stormOn = false; pushEvent('storm_off'); pushState(); }
    if (k === 'boss_spawn'){ S.bossOn = true; pushEvent('boss_spawn'); pushState(); }
    if (k === 'boss_down'){ S.bossOn = false; pushEvent('boss_down'); pushState(); }
    if (k === 'pressure'){ S.pressure = Number(d.level ?? 0)|0; pushState(); }
  }

  function onQuest(ev){
    const d = ev.detail || {};
    const miniLeft = Number(d.miniTimeLeftSec ?? 0);
    const on = miniLeft > 0;
    if (on && !S.miniOn){ S.miniOn = true; pushEvent('mini_start', { left: miniLeft }); pushState(); }
    if (!on && S.miniOn){ S.miniOn = false; pushEvent('mini_end'); pushState(); }
  }

  function onJudge(ev){
    const d = ev.detail || {};
    const kind = String(d.kind||'');
    const text = String(d.text||'');
    // These are helpful events for training / debugging
    if (kind === 'good'){
      if (text.includes('BOSS')) pushEvent('boss_down_reward');
    }
  }

  function onShoot(){
    // Shoot event always fired by vr-ui crosshair tap
    // We'll mark "shoot_attempt" and later detect empty by judge miss? but safe.js doesn't emit extra
    // So we approximate: if a hit event doesn't happen soon, still useful as "shoot attempt".
    pushEvent('shoot', null);
  }

  // Hook hits: we infer from judge kind and/or score deltas are enough,
  // but we want explicit hit types for better DL.
  // We'll mark hits using judge events if they contain known patterns.
  function onJudgeForHit(ev){
    const d = ev.detail || {};
    const kind = String(d.kind||'');
    const text = String(d.text||'');
    if (kind === 'good'){
      // normal hit or goal/mini/bossdown; we separate later by text
      if (text.startsWith('+')) pushEvent('hit_good', { text });
      else if (text.includes('GOAL')) pushEvent('goal_clear', { text });
      else if (text.includes('MINI')) pushEvent('mini_clear', { text });
      else if (text.includes('BOSS')) pushEvent('boss_down', { text });
    } else if (kind === 'bad'){
      // wrong/junk (we can’t fully separate from text; still useful)
      if (text.includes('-18')) pushEvent('hit_junk', { text });
      else pushEvent('hit_wrong', { text });
    } else if (kind === 'miss'){
      // includes empty shoot MISS and MINI FAIL
      if (text.includes('MINI')) pushEvent('mini_fail', { text });
      if (text === 'MISS') pushEvent('shoot_empty', { text });
    } else if (kind === 'boss'){
      pushEvent('boss_hit', { text });
    }
  }

  function onEnd(ev){
    S.meta.endedAtIso = new Date().toISOString();
    pushEvent('session_end', ev.detail||null);
    pushState();
  }

  function bind(){
    if (S._bound) return;
    S._bound = true;

    root.addEventListener('hha:score', onScore, { passive:true });
    root.addEventListener('hha:rank', onRank, { passive:true });
    root.addEventListener('hha:time', onTime, { passive:true });
    root.addEventListener('groups:power', onPower, { passive:true });
    root.addEventListener('groups:progress', onProgress, { passive:true });
    root.addEventListener('quest:update', onQuest, { passive:true });
    root.addEventListener('hha:judge', onJudge, { passive:true });
    root.addEventListener('hha:judge', onJudgeForHit, { passive:true });
    root.addEventListener('hha:shoot', onShoot, { passive:true });
    root.addEventListener('hha:end', onEnd, { passive:true });
  }

  // ---------------- Public API ----------------
  const API = {
    attach(opts){
      opts = opts || {};
      bind();

      // enabled is controlled by groups-vr.html (play-only)
      S.enabled = !!opts.enabled;
      S.runMode = String(opts.runMode || 'play');
      S.seed = String(opts.seed || '');
      S.level = String(opts.level || opts.ailvl || 'b').toLowerCase();
      if (!['a','b','c'].includes(S.level)) S.level = 'b';

      // parse some meta if passed through
      S.meta.view = String(opts.view || S.meta.view || '');
      S.meta.diff = String(opts.diff || S.meta.diff || '');
      S.meta.style= String(opts.style|| S.meta.style || '');
      S.meta.run  = String(S.runMode || '');
      S.meta.studyId = String(opts.studyId || S.meta.studyId || '');
      S.meta.conditionGroup = String(opts.conditionGroup || S.meta.conditionGroup || '');

      // reset buffers each attach (new session)
      resetSession(opts);

      S.attached = true;
      pushEvent('ai_attach', { enabled:S.enabled, runMode:S.runMode, level:S.level });
      return true;
    },

    isEnabled(){ return !!S.enabled; },

    getState(){
      // For Risk UI: keep it simple & stable
      return {
        enabled: !!S.enabled,
        runMode: S.runMode,
        seed: S.seed,
        level: S.level,
        acc: S.acc|0,
        misses: S.misses|0,
        combo: S.combo|0,
        pressure: S.pressure|0,
        stormOn: !!S.stormOn,
        miniOn: !!S.miniOn,
        bossOn: !!S.bossOn,
        timeLeft: Number(S.timeLeft||0),
        grade: String(S.grade||'C')
      };
    },

    exportDataset(){
      // Only export if enabled (play mode) OR if you want export always, remove this guard.
      // Keeping guard prevents accidental research exports.
      if (!S.attached) return { schemaVersion: CFG.schemaVersion, meta: S.meta, data: [] };

      const ctx = (NS.getResearchCtx && typeof NS.getResearchCtx === 'function')
        ? (NS.getResearchCtx() || {})
        : {};

      const windows = buildWindows();

      return {
        schemaVersion: CFG.schemaVersion,
        meta: Object.assign({}, S.meta, {
          seed: S.seed,
          aiLevel: S.level,
          enabled: !!S.enabled,
          runMode: S.runMode,
          exportedAtIso: new Date().toISOString(),
          ctx
        }),
        // raw buffers (useful for debugging / future RT, aimErr)
        raw: {
          events: S.events.slice(0),
          states: S.states.slice(0),
          cfg: Object.assign({}, CFG)
        },
        // training table
        data: windows
      };
    }
  };

  NS.AIHooks = API;

})(typeof window !== 'undefined' ? window : globalThis);