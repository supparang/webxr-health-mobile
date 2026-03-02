// === /webxr-health-mobile/herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (SOLO + Deterministic + AI Director + Pattern Boss + Ghost + CSV)
// FULL v20260302b-GOODJUNK-SAFE-ABCDE
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  function $(id){ return DOC.getElementById(id); }
  function setText(id, v){ const el=$(id); if(el) el.textContent = String(v); }
  function setAttr(id, k, v){ const el=$(id); if(el) el.setAttribute(k, String(v)); }

  // ---------- cfg normalize ----------
  const C = {
    view: String(cfg.view || qs('view','mobile')).toLowerCase(),
    run:  String(cfg.run  || qs('run','play')).toLowerCase(),
    diff: String(cfg.diff || qs('diff','normal')).toLowerCase(),
    time: clamp(cfg.time ?? qs('time','80'), 20, 300),
    seed: String(cfg.seed || qs('seed', String(Date.now()))),
    pid:  String(cfg.pid  || qs('pid','anon')).trim() || 'anon',
    hub:  String(cfg.hub  || qs('hub','../hub.html')),
    ai:   cfg.ai || null,
    logger: cfg.logger || null
  };

  // Debug pills values (if present)
  setText('uiView', C.view);
  setText('uiRun', C.run);
  setText('uiDiff', C.diff);

  // ---------- DOM refs ----------
  const layer = $('gj-layer');
  const stage = $('stage');
  if(!layer || !stage){
    console.error('[GoodJunk] missing #gj-layer or #stage');
    return;
  }

  // HUD refs
  const hudScore = $('hud-score');
  const hudTime  = $('hud-time');
  const hudMiss  = $('hud-miss');
  const hudGrade = $('hud-grade');

  const hudGoalCur = $('hud-goal-cur');
  const hudGoalTarget = $('hud-goal-target');
  const goalDesc = $('goalDesc');

  const hudMini = $('hud-mini');
  const miniTimer = $('miniTimer');

  const feverFill = $('feverFill');
  const feverText = $('feverText');
  const shieldPills = $('shieldPills');

  const bossBar = $('bossBar');
  const bossFill = $('bossFill');
  const bossHint = $('bossHint');

  const gjProgressFill = $('gjProgressFill');

  const lowTimeOverlay = $('lowTimeOverlay');
  const lowTimeNum = $('gj-lowtime-num');

  const endOverlay = $('endOverlay');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endGrade = $('endGrade');
  const endScore = $('endScore');
  const endMiss = $('endMiss');
  const endTime = $('endTime');

  const aiRiskEl = $('aiRisk');
  const aiHintEl = $('aiHint');

  // ---------- inject Ghost HUD pill ----------
  const hud = $('hud');
  let ghostScoreEl = null, ghostDeltaEl = null;
  (function injectGhostHud(){
    try{
      if(!hud) return;
      const row = hud.querySelector('.hud-row');
      if(!row) return;
      const ghostPill = DOC.createElement('div');
      ghostPill.className = 'pill pill-ghost';
      ghostPill.innerHTML = `GHOST <b id="hud-ghost">0</b> <span class="mut">Δ <b id="hud-ghost-delta">0</b></span>`;
      row.appendChild(ghostPill);
      ghostScoreEl = $('hud-ghost');
      ghostDeltaEl = $('hud-ghost-delta');
    }catch(_){}
  })();

  // ==========================================================
  // D) Deterministic RNG (seeded) — NO Math.random()
  // ==========================================================
  function xfnv1a(str){
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const RNG = mulberry32(xfnv1a(`${C.seed}::${C.pid}::${C.diff}::${C.time}`));
  const rand = ()=> RNG();
  const randi = (n)=> (rand()*n)|0;

  // ---------- gameplay constants ----------
  const EMOJI_GOOD = ['🥦','🍎','🥛','🥚','🐟','🍚','🥬','🍌','🍊','🥕'];
  const EMOJI_JUNK = ['🍟','🍩','🍔','🧋','🍭','🍕','🥤','🍫'];
  const EMOJI_STAR = ['⭐','🌟'];
  const EMOJI_DIAMOND = ['💎'];
  const EMOJI_SHIELD = ['🛡️'];

  const LANES = 5;

  // ---------- state ----------
  const S = {
    t0: 0,
    t: C.time,
    playing: false,
    ended: false,

    score: 0,
    combo: 0,
    comboMax: 0,

    shots: 0,          // attempts (tap/cvr)
    shotsMiss: 0,      // attempt no target (DL important)
    hitsGood: 0,
    hitsJunk: 0,
    hitsJunkGuard: 0,
    expireGood: 0,

    // miss definition: good expired + junk hit (guarded doesn't count)
    miss: 0,

    fever: 0,
    feverState: 'off',
    shield: 0,

    goalTarget: 20,
    goalCur: 0,

    miniName: 'Daily',
    miniLeft: 0,

    bossOn: false,
    bossHp: 0,

    medianRtGoodMs: 0,
    _rtGoodArr: [],

    // director knobs applied (from AI)
    spawnRateMul: 1,
    junkBiasDelta: 0,

    targets: new Map(),
    nextId: 1,

    // dataset buffers
    sessionId: `gj_${C.pid}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    events: [],

    // Ghost
    ghost: null,
    ghostSeries: [],
    ghostBestScore: 0,
    ghostNow: 0,

    // Pattern state (E)
    stormStep: 0,
    bossStep: 0,
    bossPattern: [],
    stormPattern: []
  };

  // ==========================================================
  // E) Pattern Generator (seeded)
  // - Storm: wave lanes
  // - Boss: scripted "combo lane map" + feints
  // ==========================================================
  function genWavePattern(len){
    const p = [];
    let dir = (rand() < 0.5) ? 1 : -1;
    let lane = randi(LANES);
    for(let i=0;i<len;i++){
      p.push(lane);
      lane += dir;
      if(lane <= 0){ lane = 0; dir = 1; }
      if(lane >= LANES-1){ lane = LANES-1; dir = -1; }
      if(rand() < 0.12) dir *= -1; // surprise flip
    }
    return p;
  }
  function genBossPattern(len){
    // A "melody" like: 0-2-4-3-1-2-0... but seeded
    const base = [0,2,4,3,1,2,0,1,3,4,2,1];
    const shift = randi(LANES);
    const p = [];
    for(let i=0;i<len;i++){
      let v = base[i % base.length];
      v = (v + shift) % LANES;
      // occasional twist
      if(rand() < 0.18) v = randi(LANES);
      p.push(v);
    }
    return p;
  }

  // ---------- Ghost Battle store/load ----------
  function ghostKey(){
    return `HHA_GJ_GHOST::${C.pid}::${C.diff}::${C.time}`;
  }
  function loadGhost(){
    try{
      const raw = localStorage.getItem(ghostKey());
      if(!raw) return null;
      const j = JSON.parse(raw);
      if(!j || typeof j !== 'object') return null;
      if(!Array.isArray(j.series)) return null;
      return j;
    }catch(_){ return null; }
  }
  function saveGhostIfBest(finalScore){
    try{
      const prev = loadGhost();
      const best = prev && Number(prev.bestScore||0) > 0 ? Number(prev.bestScore||0) : 0;
      if(finalScore <= best) return;
      const payload = {
        bestScore: finalScore,
        series: S.ghostSeries.slice(0, 9999),
        ts: nowIso(),
        pid: C.pid,
        diff: C.diff,
        time: C.time,
        seed: C.seed
      };
      localStorage.setItem(ghostKey(), JSON.stringify(payload));
    }catch(_){}
  }
  function ghostScoreAt(sec){
    const g = S.ghost;
    if(!g || !Array.isArray(g.series) || g.series.length === 0) return 0;
    sec = Math.max(0, Math.min(C.time, Number(sec)||0));
    const arr = g.series;
    let prev = arr[0];
    for(let i=1;i<arr.length;i++){
      const cur = arr[i];
      if(Number(cur.t) >= sec){
        const t0 = Number(prev.t)||0, t1 = Number(cur.t)||0;
        const s0 = Number(prev.score)||0, s1 = Number(cur.score)||0;
        if(t1 <= t0) return s1;
        const a = (sec - t0) / (t1 - t0);
        return Math.round(s0 + (s1 - s0) * a);
      }
      prev = cur;
    }
    return Math.round(Number(arr[arr.length-1].score)||0);
  }

  S.ghost = loadGhost();
  S.ghostBestScore = S.ghost ? Number(S.ghost.bestScore||0) : 0;

  // ---------- CSV Export ----------
  function csvEscape(v){
    const s = String(v ?? '');
    if(/[",\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  function toCSV(rows){
    if(!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    const head = cols.map(csvEscape).join(',');
    const body = rows.map(r => cols.map(k => csvEscape(r[k])).join(',')).join('\n');
    return head + '\n' + body;
  }
  function downloadText(name, text){
    const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = name;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 800);
  }

  function makeSummary(reason){
    const acc = (S.shots>0) ? Math.round((S.hitsGood*100)/S.shots) : 0;
    return {
      timestampIso: nowIso(),
      sessionId: S.sessionId,
      pid: C.pid,
      run: C.run,
      diff: C.diff,
      seed: C.seed,
      reason: reason || '',

      scoreFinal: S.score,
      comboMax: S.comboMax,
      missTotal: S.miss,

      shots: S.shots,
      shotsMiss: S.shotsMiss,
      hits: S.hitsGood,
      hitsJunk: S.hitsJunk,
      hitsJunkGuard: S.hitsJunkGuard,
      expireGood: S.expireGood,

      accPct: acc,
      medianRtGoodMs: S.medianRtGoodMs,

      feverEndPct: Math.round(S.fever),
      shieldEnd: S.shield,

      ghostBestScore: S.ghostBestScore,
      ghostNowScore: S.ghost ? S.ghostNow : 0,
      ghostDeltaFinal: S.ghost ? (S.score - (S.ghost ? Number(S.ghost.bestScore||0) : 0)) : S.score,

      timePlannedSec: C.time,
      timePlayedSec: C.time
    };
  }

  function buildSessionRow(summary){
    return {
      timestampIso: nowIso(),
      projectTag: 'herohealth',
      runMode: C.run,
      studyId: String(qs('studyId','')),
      phase: String(qs('phase','')),
      conditionGroup: String(qs('conditionGroup','')),
      sessionId: S.sessionId,
      gameMode: 'goodjunk',
      diff: C.diff,
      durationPlannedSec: C.time,
      durationPlayedSec: (C.time - S.t),
      scoreFinal: summary.scoreFinal,
      comboMax: summary.comboMax,
      misses: summary.missTotal,
      shots: summary.shots,
      shotsMiss: summary.shotsMiss,
      nHitGood: summary.hits,
      nHitJunk: summary.hitsJunk,
      nHitJunkGuard: summary.hitsJunkGuard,
      nExpireGood: summary.expireGood,
      accuracyGoodPct: summary.accPct,
      medianRtGoodMs: summary.medianRtGoodMs,
      device: (C.view||''),
      gameVersion: 'GoodJunkVR_SAFE_v20260302b_ABCDE',
      seed: C.seed,
      pid: C.pid,
      __extraJson: JSON.stringify({
        feverEndPct: summary.feverEndPct,
        shieldEnd: summary.shieldEnd,
        ghostBest: S.ghostBestScore,
        bossPatternLen: S.bossPattern.length,
        stormPatternLen: S.stormPattern.length
      })
    };
  }

  function buildEventRow(e){
    return {
      timestampIso: e.timestampIso || nowIso(),
      projectTag: 'herohealth',
      runMode: C.run,
      studyId: String(qs('studyId','')),
      phase: String(qs('phase','')),
      conditionGroup: String(qs('conditionGroup','')),
      sessionId: S.sessionId,
      eventType: e.eventType || 'event',
      eventName: e.eventName || '',
      gameMode: 'goodjunk',
      diff: C.diff,

      timeFromStartMs: e.timeFromStartMs ?? 0,
      timeLeftSec: e.timeLeftSec ?? '',
      targetCount: e.targetCount ?? '',

      targetId: e.targetId || '',
      emoji: e.emoji || '',
      itemType: e.itemType || '',
      lane: e.lane ?? '',
      rtMs: e.rtMs ?? '',
      aimDistPx: e.aimDistPx ?? '',

      judgment: e.judgment || '',
      totalScore: e.totalScore ?? S.score,
      combo: e.combo ?? S.combo,
      miss: e.miss ?? S.miss,

      feverPct: e.feverPct ?? S.fever,
      shield: e.shield ?? S.shield,
      bossOn: e.bossOn ?? S.bossOn,
      bossHp: e.bossHp ?? S.bossHp,

      spawnRateMul: e.spawnRateMul ?? S.spawnRateMul,
      junkBiasDelta: e.junkBiasDelta ?? S.junkBiasDelta,

      extra: JSON.stringify(e.extra || {})
    };
  }

  function exportCSV(){
    const summary = makeSummary('export');
    const sessionRow = buildSessionRow(summary);
    const eventRows = S.events.map(buildEventRow);
    downloadText(`goodjunk_sessions_${C.pid}_${Date.now()}.csv`, toCSV([sessionRow]));
    downloadText(`goodjunk_events_${C.pid}_${Date.now()}.csv`, toCSV(eventRows));
  }

  // ---------- UI updates ----------
  function gradeFrom(score){
    if(score >= 900) return 'S';
    if(score >= 700) return 'A';
    if(score >= 520) return 'B';
    if(score >= 360) return 'C';
    return 'D';
  }

  function setFever(v){
    S.fever = clamp(v, 0, 100);
    if(feverFill) feverFill.style.width = `${S.fever}%`;
    setText('feverText', `${Math.round(S.fever)}%`);
    S.feverState = (S.fever >= 60) ? 'on' : 'off';
  }

  function setShield(n){
    S.shield = clamp(n, 0, 3);
    let s = '';
    for(let i=0;i<3;i++) s += (i < S.shield) ? '🛡️' : '•';
    if(shieldPills) shieldPills.textContent = s;
  }

  function setBoss(on){
    S.bossOn = !!on;
    if(bossBar){
      bossBar.setAttribute('aria-hidden', on ? 'false' : 'true');
      bossBar.style.display = on ? '' : 'none';
    }
  }
  function setBossHp(pct){
    S.bossHp = clamp(pct, 0, 100);
    if(bossFill) bossFill.style.width = `${S.bossHp}%`;
  }

  function showLowTime(show){
    if(!lowTimeOverlay) return;
    setAttr('lowTimeOverlay', 'aria-hidden', show ? 'false' : 'true');
    lowTimeOverlay.style.display = show ? 'grid' : 'none';
  }

  function updateHUD(){
    if(hudScore) hudScore.textContent = String(S.score);
    if(hudTime)  hudTime.textContent  = String(Math.max(0, Math.ceil(S.t)));
    if(hudMiss)  hudMiss.textContent  = String(S.miss);
    if(hudGrade) hudGrade.textContent = gradeFrom(S.score);

    if(hudGoalCur) hudGoalCur.textContent = String(S.goalCur);
    if(hudGoalTarget) hudGoalTarget.textContent = String(S.goalTarget);

    if(hudMini) hudMini.textContent = String(S.miniName || '—');
    if(miniTimer) miniTimer.textContent = (S.miniLeft>0) ? String(Math.ceil(S.miniLeft)) : '—';

    if(gjProgressFill){
      const p = (S.goalTarget>0) ? (S.goalCur*100/S.goalTarget) : 0;
      gjProgressFill.style.width = `${clamp(p,0,100)}%`;
    }

    // ghost display
    if(ghostScoreEl && S.ghost){
      const played = (C.time - S.t);
      const gScore = ghostScoreAt(played);
      S.ghostNow = gScore;
      ghostScoreEl.textContent = String(gScore);
      const d = S.score - gScore;
      if(ghostDeltaEl) ghostDeltaEl.textContent = String(d);
    }else{
      if(ghostScoreEl) ghostScoreEl.textContent = '0';
      if(ghostDeltaEl) ghostDeltaEl.textContent = String(S.score);
    }
  }

  // ---------- dataset event push ----------
  function pushEvt(name, payload){
    S.events.push(Object.assign({
      timestampIso: nowIso(),
      eventType: 'event',
      eventName: name,
      timeFromStartMs: Math.round(nowMs() - S.t0),
      timeLeftSec: Math.round(S.t*100)/100,
      targetCount: S.targets.size,
      totalScore: S.score,
      combo: S.combo,
      miss: S.miss,
      feverPct: S.fever,
      shield: S.shield,
      bossOn: S.bossOn,
      bossHp: S.bossHp,
      spawnRateMul: S.spawnRateMul,
      junkBiasDelta: S.junkBiasDelta
    }, payload || {}));
  }

  // ---------- AI tick (director knobs + coach HUD) ----------
  function aiTick(){
    if(!C.ai) return;
    if(!aiRiskEl || !aiHintEl) return;

    const snap = {
      shots: S.shots,
      shotsMiss: S.shotsMiss,
      miss: S.miss,
      hitJunk: S.hitsJunk,
      combo: S.combo,
      timeLeftSec: S.t,
      timeAllSec: C.time,
      medianRtGoodMs: S.medianRtGoodMs,
      feverPct: S.fever,
      shield: S.shield,
      bossOn: S.bossOn,
      bossHp: S.bossHp,
      diff: C.diff
    };

    let out;
    try{ out = C.ai.maybeHint(snap); }catch(_){ out = null; }
    if(!out) return;

    const risk = clamp(out.risk ?? 0, 0, 1);
    aiRiskEl.textContent = `${Math.round(risk*100)}%`;
    aiHintEl.textContent = out.hint ? String(out.hint) : '—';

    const dir = out.director || C.ai.director || null;
    if(dir){
      S.spawnRateMul = clamp(dir.spawnRateMul ?? 1, 0.85, 1.20);
      S.junkBiasDelta = clamp(dir.junkBiasDelta ?? 0, -0.10, 0.10);
    }
  }

  // ---------- target spawn / movement ----------
  function pickLane(){
    return randi(LANES);
  }
  function laneX(lane){
    const r = stage.getBoundingClientRect();
    const pad = 18;
    const w = Math.max(120, r.width - pad*2);
    const step = w / LANES;
    const cx = r.left + pad + step*(lane + 0.5);
    return cx;
  }

  function spawnTarget(type, opts = {}){
    const id = String(S.nextId++);
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = `gj-target t-${type}`;
    el.setAttribute('data-id', id);
    el.setAttribute('aria-label', type);

    const lane = (opts.lane != null) ? Number(opts.lane) : pickLane();
    el.setAttribute('data-lane', String(lane));

    let emoji = '•';
    if(type === 'good') emoji = EMOJI_GOOD[randi(EMOJI_GOOD.length)];
    if(type === 'junk') emoji = EMOJI_JUNK[randi(EMOJI_JUNK.length)];
    if(type === 'star') emoji = EMOJI_STAR[randi(EMOJI_STAR.length)];
    if(type === 'diamond') emoji = EMOJI_DIAMOND[0];
    if(type === 'shield') emoji = EMOJI_SHIELD[0];
    el.textContent = emoji;

    layer.appendChild(el);

    const rStage = stage.getBoundingClientRect();
    const x = laneX(lane) - rStage.left;
    const y = 10;
    el.style.left = `${clamp(x, 20, rStage.width-20)}px`;
    el.style.top  = `${y}px`;

    const baseLife = (type === 'good') ? 2200 : (type === 'junk') ? 2400 : 1800;
    const speed = (type === 'diamond') ? 1.18 : (type === 'star') ? 1.12 : 1.0;

    const obj = {
      id, type, emoji, lane,
      el,
      born: nowMs(),
      lifeMs: Math.round(baseLife / Math.max(0.75, S.spawnRateMul)),
      speedMul: speed,
      dead:false
    };

    S.targets.set(id, obj);

    el.addEventListener('click', ()=>{
      if(!S.playing) return;
      hitTarget(id, { via:'tap', aimDistPx:'' });
    });

    return obj;
  }

  function killTarget(id){
    const t = S.targets.get(id);
    if(!t) return;
    t.dead = true;
    S.targets.delete(id);
    try{ t.el.remove(); }catch(_){}
  }

  function updateTargets(){
    const rStage = stage.getBoundingClientRect();
    const yMax = rStage.height - 30;
    const tNow = nowMs();
    for(const [id, t] of S.targets){
      if(!t || t.dead) continue;
      const age = tNow - t.born;
      const p = clamp(age / t.lifeMs, 0, 1);
      const y = 10 + p * yMax * t.speedMul;
      t.el.style.top = `${y}px`;

      if(age >= t.lifeMs){
        if(t.type === 'good'){
          S.expireGood += 1;
          S.miss += 1;
          S.combo = 0;
          setFever(S.fever - 8);
          pushEvt('expire', { targetId:t.id, emoji:t.emoji, itemType:t.type, lane:t.lane, judgment:'good_expire' });
        }
        killTarget(id);
      }
    }
  }

  // ---------- scoring ----------
  function pushRtGood(ms){
    ms = Number(ms)||0;
    if(ms <= 0) return;
    S._rtGoodArr.push(ms);
    if(S._rtGoodArr.length > 40) S._rtGoodArr.shift();
    const arr = S._rtGoodArr.slice().sort((a,b)=>a-b);
    const m = arr.length ? arr[(arr.length/2)|0] : 0;
    S.medianRtGoodMs = Math.round(m||0);
  }

  function scoreDeltaFor(type){
    if(type === 'good') return 10;
    if(type === 'star') return 28;
    if(type === 'diamond') return 55;
    if(type === 'shield') return 14;
    if(type === 'junk') return -18;
    return 0;
  }

  function applyHit(t, meta = {}){
    const rt = meta.rtMs ?? '';
    const aimDistPx = meta.aimDistPx ?? '';
    const base = scoreDeltaFor(t.type);

    if(t.type === 'good'){
      S.hitsGood += 1;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);

      const add = (S.combo>=10) ? 6 : (S.combo>=6) ? 4 : 3;
      setFever(S.fever + add);

      let mult = 1;
      if(S.fever >= 60) mult = 1.25;
      if(S.combo >= 12) mult *= 1.15;
      const delta = Math.round(base * mult + Math.min(12, S.combo));

      S.score += delta;
      S.goalCur += 1;

      pushRtGood(Number(rt)||0);

      pushEvt('hit', { targetId:t.id, emoji:t.emoji, itemType:t.type, lane:t.lane, rtMs:rt, aimDistPx, judgment:'good', extra:{ score_delta:delta } });

      // boss damage when boss phase
      if(S.miniName === 'Boss') bossHit();

    } else if(t.type === 'junk'){
      if(S.shield > 0){
        S.shield -= 1;
        S.hitsJunkGuard += 1;
        setShield(S.shield);
        S.score += Math.round(base * 0.35);
        pushEvt('guard', { targetId:t.id, emoji:t.emoji, itemType:t.type, lane:t.lane, rtMs:rt, aimDistPx, judgment:'junk_guard' });
      } else {
        S.hitsJunk += 1;
        S.combo = 0;
        S.miss += 1;     // junk hit counts as miss
        setFever(S.fever - 14);
        S.score += base;
        pushEvt('hit', { targetId:t.id, emoji:t.emoji, itemType:t.type, lane:t.lane, rtMs:rt, aimDistPx, judgment:'junk' });
      }

    } else if(t.type === 'shield'){
      setShield(Math.min(3, S.shield + 1));
      S.score += base;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      pushEvt('hit', { targetId:t.id, emoji:t.emoji, itemType:t.type, lane:t.lane, rtMs:rt, aimDistPx, judgment:'shield' });

      if(S.miniName === 'Boss') bossHit();

    } else if(t.type === 'star'){
      S.score += base + Math.min(24, S.combo*2);
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      setFever(S.fever + 6);
      pushEvt('hit', { targetId:t.id, emoji:t.emoji, itemType:t.type, lane:t.lane, rtMs:rt, aimDistPx, judgment:'star' });

      if(S.miniName === 'Boss') bossHit();

    } else if(t.type === 'diamond'){
      S.score += base + 40;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      setFever(S.fever + 10);
      pushEvt('hit', { targetId:t.id, emoji:t.emoji, itemType:t.type, lane:t.lane, rtMs:rt, aimDistPx, judgment:'diamond' });

      if(S.miniName === 'Boss') bossHit();
    }

    // emit score pulse for RUN->logger
    WIN.dispatchEvent(new CustomEvent('hha:score', {
      detail: {
        score: S.score,
        combo: S.combo,
        miss: S.miss,
        shots: S.shots,
        shotsMiss: S.shotsMiss,
        hits: S.hitsGood,
        accPct: (S.shots>0) ? Math.round((S.hitsGood*100)/S.shots) : 0,
        medianRtGoodMs: S.medianRtGoodMs
      }
    }));
  }

  function hitTarget(id, meta = {}){
    const t = S.targets.get(id);
    if(!t || t.dead) return false;
    const rt = Math.round(nowMs() - t.born);
    applyHit(t, Object.assign({ rtMs: rt }, meta || {}));
    killTarget(id);
    updateHUD();
    return true;
  }

  // ---------- crosshair shoot (hha:shoot) + detailed aimDistPx ----------
  function pickTargetByCrosshair(lockPx=52){
    const r = stage.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    let best = null;
    let bestD = Infinity;

    for(const [id,t] of S.targets){
      if(!t || t.dead) continue;
      const rr = t.el.getBoundingClientRect();
      const tx = rr.left + rr.width/2;
      const ty = rr.top + rr.height/2;
      const d = Math.hypot(tx - cx, ty - cy);
      if(d < bestD){
        bestD = d;
        best = t;
      }
    }
    if(best && bestD <= lockPx) return { t: best, dist: Math.round(bestD) };
    return null;
  }

  function onShoot(ev){
    if(!S.playing) return;
    const lockPx = clamp(ev?.detail?.lockPx ?? 52, 18, 120);

    S.shots += 1;

    const pick = pickTargetByCrosshair(lockPx);
    if(pick && pick.t){
      pushEvt('shot_attempt', { judgment:'cvr_lock', aimDistPx: pick.dist, extra:{ lockPx } });
      const ok = hitTarget(pick.t.id, { via:'cvr', aimDistPx: pick.dist });
      if(!ok){
        S.shotsMiss += 1;
        pushEvt('shot_miss', { judgment:'no_target', aimDistPx: pick.dist, extra:{ lockPx } });
      }
    } else {
      S.shotsMiss += 1;
      pushEvt('shot_attempt', { judgment:'cvr_no_lock', aimDistPx:'', extra:{ lockPx } });
      pushEvt('shot_miss', { judgment:'no_target', aimDistPx:'', extra:{ lockPx } });
    }

    updateHUD();
  }
  WIN.addEventListener('hha:shoot', onShoot);

  // ---------- stage logic ----------
  function setGoalDaily(){
    S.goalTarget = (C.diff==='hard') ? 28 : (C.diff==='easy') ? 16 : 20;
    setText('hud-goal', 'Daily');
    if(goalDesc) goalDesc.textContent = `Hit GOOD ${S.goalTarget}`;
    S.goalCur = 0;
    S.miniName = 'Daily';
  }

  function startMiniStorm(){
    S.miniName = 'Storm';
    S.miniLeft = 10;
    S.stormStep = 0;
    S.stormPattern = genWavePattern(80);
    setText('hud-mini','Storm');
    pushEvt('phase', { judgment:'storm_start', extra:{ stormPatternLen:S.stormPattern.length } });
  }

  function startBoss(){
    setBoss(true);
    setBossHp(100);
    if(bossHint) bossHint.textContent = 'Finish!';
    S.miniName = 'Boss';
    S.miniLeft = 12;
    S.bossStep = 0;
    S.bossPattern = genBossPattern(120);
    setText('hud-mini','Boss');
    pushEvt('phase', { judgment:'boss_start', extra:{ bossPatternLen:S.bossPattern.length } });
  }

  function bossHit(){
    const dmg = (S.fever >= 60) ? 9 : 6;
    setBossHp(S.bossHp - dmg);
    if(S.bossHp <= 0){
      S.score += 180;
      S.miniLeft = 0;
      setBoss(false);
      S.miniName = '—';
      setText('hud-mini','—');
      pushEvt('phase', { judgment:'boss_clear' });
    }
  }

  // ---------- spawn policy (AI Director + Patterns) ----------
  function spawnTick(){
    if(!S.playing) return;

    aiTick();

    let baseEveryMs = (C.diff==='hard') ? 360 : (C.diff==='easy') ? 520 : 440;
    if(S.miniName === 'Storm') baseEveryMs *= 0.78;
    if(S.miniName === 'Boss')  baseEveryMs *= 0.82;
    baseEveryMs = baseEveryMs / clamp(S.spawnRateMul||1, 0.85, 1.20);

    if((nowMs() - spawnTick._last) < baseEveryMs) return;
    spawnTick._last = nowMs();

    // composition
    let pJunk = (C.diff==='hard') ? 0.34 : (C.diff==='easy') ? 0.22 : 0.28;
    if(S.miniName === 'Storm') pJunk += 0.06;
    pJunk = clamp(pJunk + (S.junkBiasDelta||0), 0.12, 0.48);

    let pShield = 0.08, pStar = 0.06, pDiamond = 0.03;
    if(S.fever >= 60){
      pStar += 0.02; pDiamond += 0.01; pShield += 0.01;
    }
    if(S.miniName === 'Boss') pJunk = clamp(pJunk - 0.05, 0.10, 0.40);

    // Pattern lane override (E)
    let lane = null;
    if(S.miniName === 'Storm' && S.stormPattern.length){
      lane = S.stormPattern[S.stormStep % S.stormPattern.length];
      S.stormStep++;
    }
    if(S.miniName === 'Boss' && S.bossPattern.length){
      lane = S.bossPattern[S.bossStep % S.bossPattern.length];
      S.bossStep++;
    }

    // Boss special: scripted “good streak” with feints
    let type = 'good';
    const r = rand();
    if(S.miniName === 'Boss'){
      // every 5th spawn = feint junk/shield
      const k = S.bossStep % 5;
      if(k === 0 && r < 0.55) type = 'junk';
      else if(k === 0 && r < 0.80) type = 'shield';
      else type = 'good';
      // sprinkle star/diamond
      if(r < 0.04) type = 'diamond';
      else if(r < 0.10) type = 'star';
    } else {
      if(r < pDiamond) type = 'diamond';
      else if(r < pDiamond + pStar) type = 'star';
      else if(r < pDiamond + pStar + pShield) type = 'shield';
      else if(r < pDiamond + pStar + pShield + pJunk) type = 'junk';
      else type = 'good';
    }

    const t = spawnTarget(type, { lane });
    pushEvt('spawn', { targetId:t.id, emoji:t.emoji, itemType:t.type, lane:t.lane, judgment:'spawn' });
  }
  spawnTick._last = 0;

  // ---------- main loop ----------
  function tick(){
    if(!S.playing) return;

    const elapsed = (nowMs() - S.t0)/1000;
    S.t = Math.max(0, C.time - elapsed);

    if(S.t <= 6){
      showLowTime(true);
      if(lowTimeNum) lowTimeNum.textContent = String(Math.ceil(S.t));
    } else showLowTime(false);

    if(S.miniLeft > 0){
      S.miniLeft = Math.max(0, S.miniLeft - (1/60));
      if(S.miniLeft <= 0){
        if(S.miniName === 'Storm') startBoss();
        else if(S.miniName === 'Boss'){
          setBoss(false);
          S.miniName = '—';
          setText('hud-mini','—');
          pushEvt('phase', { judgment:'boss_timeout' });
        } else S.miniName = '—';
      }
    }

    if((S.miniName === 'Daily') && (S.goalCur >= S.goalTarget)){
      startMiniStorm();
    }

    updateTargets();
    spawnTick();
    updateHUD();

    // ghost series (per second)
    const secPlayed = Math.floor(C.time - S.t);
    const last = S.ghostSeries.length ? S.ghostSeries[S.ghostSeries.length-1] : null;
    if(!last || Number(last.t) !== secPlayed){
      S.ghostSeries.push({ t: secPlayed, score: S.score });
      if(S.ghostSeries.length > (C.time + 5)) S.ghostSeries.shift();
    }

    // DL snapshot every ~500ms (sequence-friendly)
    if((nowMs() - tick._snapLast) > 520){
      tick._snapLast = nowMs();
      pushEvt('snapshot', { judgment:'state', extra:{
        shots:S.shots, shotsMiss:S.shotsMiss,
        hitsGood:S.hitsGood, hitsJunk:S.hitsJunk,
        combo:S.combo, fever:S.fever, shield:S.shield,
        bossHp:S.bossHp, mini:S.miniName
      }});
    }

    if(S.t <= 0) endGame('time_up');
    else requestAnimationFrame(tick);
  }
  tick._snapLast = 0;

  function endGame(reason){
    if(S.ended) return;
    S.ended = true;
    S.playing = false;

    for(const [id] of S.targets) killTarget(id);
    showLowTime(false);

    const summary = makeSummary(reason || 'end');
    saveGhostIfBest(summary.scoreFinal);

    if(endOverlay){
      setAttr('endOverlay','aria-hidden','false');
      endOverlay.style.display = 'grid';
    }
    if(endTitle) endTitle.textContent = 'จบเกม!';
    if(endSub){
      const g = summary.ghostBestScore ? ` | Ghost best: ${summary.ghostBestScore}` : '';
      endSub.textContent = `สรุปผล • ${reason || ''}${g}`;
    }
    if(endGrade) endGrade.textContent = gradeFrom(summary.scoreFinal);
    if(endScore) endScore.textContent = String(summary.scoreFinal);
    if(endMiss)  endMiss.textContent  = String(summary.missTotal);
    if(endTime)  endTime.textContent  = String(C.time);

    pushEvt('end', { judgment: reason || 'end', extra: summary });

    // emit ended to RUN logger
    WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary }));

    // inject Export button
    try{
      const panel = endOverlay ? endOverlay.querySelector('.panel') : null;
      if(panel){
        const actions = panel.querySelector('.endActions');
        if(actions && !panel.querySelector('#btnExportCsv')){
          const ex = DOC.createElement('button');
          ex.type = 'button';
          ex.className = 'btn';
          ex.id = 'btnExportCsv';
          ex.textContent = 'Export CSV (DL)';
          ex.addEventListener('click', exportCSV);
          actions.appendChild(ex);
        }
      }
    }catch(_){}
  }

  // ---------- reset/start ----------
  function resetUI(){
    S.score=0; S.combo=0; S.comboMax=0;
    S.shots=0; S.shotsMiss=0;
    S.hitsGood=0; S.hitsJunk=0; S.hitsJunkGuard=0; S.expireGood=0;
    S.miss=0;

    S.spawnRateMul = 1;
    S.junkBiasDelta = 0;

    setFever(0);
    setShield(0);

    setBoss(false);
    setBossHp(0);

    S.goalCur=0;
    S.miniLeft=0;

    setGoalDaily();
    setText('hud-mini','—');
    setText('miniTimer','—');

    if(endOverlay){
      setAttr('endOverlay','aria-hidden','true');
      endOverlay.style.display = 'none';
    }
  }

  function start(){
    resetUI();
    S.targets.clear();
    layer.innerHTML = '';

    S.events = [];
    S.ghostSeries = [];

    S.t0 = nowMs();
    S.t = C.time;
    S.playing = true;
    S.ended = false;

    pushEvt('start', { judgment:'start', extra:{ seed:C.seed, pid:C.pid, diff:C.diff, time:C.time } });

    updateHUD();
    requestAnimationFrame(tick);
  }

  // buttons (safety)
  const btnRetry = $('btnRetry');
  const btnHub = $('btnHub');
  btnRetry?.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  });
  btnHub?.addEventListener('click', ()=>{ location.href = C.hub || '../hub.html'; });

  // start
  start();
}