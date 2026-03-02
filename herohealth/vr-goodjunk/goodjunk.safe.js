// === /webxr-health-mobile/herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (SOLO+AI Director+Ghost Battle+CSV Export)
// FULL v20260302-GOODJUNK-SAFE-ABC
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
  function addClass(el, c){ if(el) el.classList.add(c); }
  function rmClass(el, c){ if(el) el.classList.remove(c); }

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
  let ghostPill = null, ghostScoreEl = null, ghostDeltaEl = null;
  (function injectGhostHud(){
    try{
      if(!hud) return;
      const row = hud.querySelector('.hud-row');
      if(!row) return;
      ghostPill = DOC.createElement('div');
      ghostPill.className = 'pill pill-ghost';
      ghostPill.innerHTML = `GHOST <b id="hud-ghost">0</b> <span class="mut">Δ <b id="hud-ghost-delta">0</b></span>`;
      row.appendChild(ghostPill);
      ghostScoreEl = $('hud-ghost');
      ghostDeltaEl = $('hud-ghost-delta');
    }catch(_){}
  })();

  // ---------- gameplay constants ----------
  const EMOJI_GOOD = ['🥦','🍎','🥛','🥚','🐟','🍚','🥬','🍌','🍊','🥕'];
  const EMOJI_JUNK = ['🍟','🍩','🍔','🧋','🍭','🍕','🥤','🍫'];
  const EMOJI_STAR = ['⭐','🌟'];
  const EMOJI_DIAMOND = ['💎'];
  const EMOJI_SHIELD = ['🛡️'];

  // stage lanes (simple 5-lane)
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

    shots: 0,
    hitsGood: 0,
    hitsJunk: 0,
    hitsJunkGuard: 0,
    expireGood: 0,

    // miss definition: good expired + junk hit (guarded doesn't count)
    miss: 0,

    fever: 0,          // 0..100
    feverState: 'off', // off/on
    shield: 0,         // 0..3

    // goals/stages
    goalTarget: 20,
    goalCur: 0,

    miniName: '—',
    miniLeft: 0,

    // boss
    bossOn: false,
    bossHp: 0,   // 0..100

    // AI snapshot
    medianRtGoodMs: 0,
    _rtGoodArr: [],

    // director knobs applied
    spawnRateMul: 1,
    junkBiasDelta: 0,

    // runtime lists
    targets: new Map(), // id -> obj
    nextId: 1,

    // local event buffer for CSV
    sessionId: `gj_${C.pid}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    events: [],
    // ghost
    ghost: null,
    ghostSeries: [],
    ghostBestScore: 0,
    ghostNow: 0
  };

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
        series: S.ghostSeries.slice(0, 9999), // cap
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
    // series entries: {t,score}
    const arr = g.series;
    // clamp
    sec = Math.max(0, Math.min(C.time, Number(sec)||0));
    // linear search is ok (<=300). Could binary search, but keep simple.
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
      nHitGood: summary.hits,
      nHitJunk: summary.hitsJunk,
      nHitJunkGuard: summary.hitsJunkGuard,
      nExpireGood: summary.expireGood,
      accuracyGoodPct: summary.accPct,
      medianRtGoodMs: summary.medianRtGoodMs,
      device: (C.view||''),
      gameVersion: 'GoodJunkVR_SAFE_v20260302_ABC',
      seed: C.seed,
      pid: C.pid,
      __extraJson: JSON.stringify({
        feverEndPct: summary.feverEndPct,
        shieldEnd: summary.shieldEnd,
        ghostBest: S.ghostBestScore
      })
    };
  }

  function buildEventRow(e){
    // Keep minimal but useful for ML
    return {
      timestampIso: e.timestampIso || nowIso(),
      projectTag: 'herohealth',
      runMode: C.run,
      studyId: String(qs('studyId','')),
      phase: String(qs('phase','')),
      conditionGroup: String(qs('conditionGroup','')),
      sessionId: S.sessionId,
      eventType: e.eventType || 'event',
      gameMode: 'goodjunk',
      diff: C.diff,
      timeFromStartMs: e.timeFromStartMs ?? 0,
      targetId: e.targetId || '',
      emoji: e.emoji || '',
      itemType: e.itemType || '',
      lane: e.lane ?? '',
      rtMs: e.rtMs ?? '',
      judgment: e.judgment || '',
      totalScore: e.totalScore ?? S.score,
      combo: e.combo ?? S.combo,
      isGood: e.isGood ?? '',
      feverState: S.feverState,
      feverValue: S.fever,
      goalProgress: `${S.goalCur}/${S.goalTarget}`,
      miniProgress: S.miniName ? `${S.miniName}:${S.miniLeft}` : '',
      extra: JSON.stringify(e.extra || {}),
      studentKey: String(qs('studentKey','')),
      schoolCode: String(qs('schoolCode','')),
      classRoom: String(qs('classRoom','')),
      studentNo: String(qs('studentNo','')),
      nickName: String(qs('nickName','')),
    };
  }

  function exportCSV(){
    const summary = makeSummary('export');
    const sessionRow = buildSessionRow(summary);
    const eventRows = S.events.map(buildEventRow);
    const sessionsCsv = toCSV([sessionRow]);
    const eventsCsv = toCSV(eventRows);

    downloadText(`goodjunk_sessions_${C.pid}_${Date.now()}.csv`, sessionsCsv);
    downloadText(`goodjunk_events_${C.pid}_${Date.now()}.csv`, eventsCsv);
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
    // pills
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

  function showLowTime(show){
    if(!lowTimeOverlay) return;
    setAttr('lowTimeOverlay', 'aria-hidden', show ? 'false' : 'true');
    lowTimeOverlay.style.display = show ? 'grid' : 'none';
  }

  // ---------- AI update ----------
  function aiTick(){
    if(!C.ai) return;
    if(!aiRiskEl || !aiHintEl) return;

    // build snapshot
    const snap = {
      shots: S.shots,
      miss: S.miss,
      hitJunk: S.hitsJunk,
      combo: S.combo,
      timeLeftSec: S.t,
      timeAllSec: C.time,
      medianRtGoodMs: S.medianRtGoodMs,
      feverPct: S.fever,
      shield: S.shield,
      diff: C.diff
    };

    let out;
    try{ out = C.ai.maybeHint(snap); }catch(_){ out = null; }
    if(!out) return;

    const risk = clamp(out.risk ?? 0, 0, 1);
    aiRiskEl.textContent = `${Math.round(risk*100)}%`;
    aiHintEl.textContent = out.hint ? String(out.hint) : '—';

    // Director knobs (A)
    const dir = out.director || C.ai.director || null;
    if(dir){
      S.spawnRateMul = clamp(dir.spawnRateMul ?? 1, 0.85, 1.20);
      S.junkBiasDelta = clamp(dir.junkBiasDelta ?? 0, -0.10, 0.10);
    }
  }

  // ---------- target spawn / removal ----------
  function rectOf(el){
    const r = el.getBoundingClientRect();
    return { x:r.left, y:r.top, w:r.width, h:r.height, cx:r.left+r.width/2, cy:r.top+r.height/2 };
  }

  function pickLane(){
    return Math.floor(Math.random()*LANES);
  }

  function laneX(lane){
    // lane centers across stage width
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
    if(type === 'good') emoji = EMOJI_GOOD[(Math.random()*EMOJI_GOOD.length)|0];
    if(type === 'junk') emoji = EMOJI_JUNK[(Math.random()*EMOJI_JUNK.length)|0];
    if(type === 'star') emoji = EMOJI_STAR[(Math.random()*EMOJI_STAR.length)|0];
    if(type === 'diamond') emoji = EMOJI_DIAMOND[0];
    if(type === 'shield') emoji = EMOJI_SHIELD[0];
    el.textContent = emoji;

    layer.appendChild(el);

    // position using CSS translate (avoid layout thrash)
    const rStage = stage.getBoundingClientRect();
    const x = laneX(lane) - rStage.left; // local to stage
    const y = 10; // start top
    el.style.left = `${clamp(x, 20, rStage.width-20)}px`;
    el.style.top  = `${y}px`;

    const life = (type === 'good') ? 2200 : (type === 'junk') ? 2400 : 1800;
    const speed = (type === 'diamond') ? 1.18 : (type === 'star') ? 1.12 : 1.0;

    const obj = {
      id, type, emoji, lane,
      el,
      born: nowMs(),
      lifeMs: Math.round(life / Math.max(0.75, S.spawnRateMul) ), // director affects
      speedMul: speed,
      dead:false
    };

    S.targets.set(id, obj);

    // click/tap on target
    el.addEventListener('click', ()=>{
      if(!S.playing) return;
      hitTarget(id, { via:'tap' });
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
    // move down
    const rStage = stage.getBoundingClientRect();
    const yMax = rStage.height - 30;

    const tNow = nowMs();
    for(const [id, t] of S.targets){
      if(!t || t.dead) continue;
      const age = tNow - t.born;
      const p = clamp(age / t.lifeMs, 0, 1);
      const y = 10 + p * yMax * t.speedMul;
      t.el.style.top = `${y}px`;

      // expire
      if(age >= t.lifeMs){
        // Miss rule: good expired counts as miss; junk expired doesn't
        if(t.type === 'good'){
          S.expireGood += 1;
          S.miss += 1;
          S.combo = 0;
          // fever drop
          setFever(S.fever - 8);
          logEvt('expire', t, { judgment:'good_expire', isGood:1 });
        }
        killTarget(id);
      }
    }
  }

  // ---------- scoring ----------
  function logEvt(kind, t, extra = {}){
    const e = {
      timestampIso: nowIso(),
      timeFromStartMs: Math.round(nowMs() - S.t0),
      eventType: 'event',
      eventName: kind,
      targetId: t ? t.id : '',
      emoji: t ? t.emoji : '',
      itemType: t ? t.type : '',
      lane: t ? t.lane : '',
      judgment: extra.judgment || kind,
      rtMs: extra.rtMs ?? '',
      isGood: extra.isGood ?? '',
      totalScore: S.score,
      combo: S.combo,
      extra: extra.extra || {
        fever: S.fever,
        shield: S.shield,
        bossOn: S.bossOn,
        spawnRateMul: S.spawnRateMul,
        junkBiasDelta: S.junkBiasDelta
      }
    };
    S.events.push(e);
  }

  function pushRtGood(ms){
    ms = Number(ms)||0;
    if(ms <= 0) return;
    S._rtGoodArr.push(ms);
    if(S._rtGoodArr.length > 40) S._rtGoodArr.shift();
    // median
    const arr = S._rtGoodArr.slice().sort((a,b)=>a-b);
    const m = arr.length ? arr[(arr.length/2)|0] : 0;
    S.medianRtGoodMs = Math.round(m||0);
  }

  function scoreDeltaFor(type){
    // base points
    if(type === 'good') return 10;
    if(type === 'star') return 28;
    if(type === 'diamond') return 55;
    if(type === 'shield') return 14;
    if(type === 'junk') return -18;
    return 0;
  }

  function applyHit(t, meta = {}){
    S.shots += 1;

    const rt = meta.rtMs ?? '';
    const base = scoreDeltaFor(t.type);

    if(t.type === 'good'){
      S.hitsGood += 1;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);

      // fever ramps with combo
      const add = (S.combo>=10) ? 6 : (S.combo>=6) ? 4 : 3;
      setFever(S.fever + add);

      // scoring with fever + combo multiplier
      let mult = 1;
      if(S.fever >= 60) mult = 1.25;
      if(S.combo >= 12) mult *= 1.15;
      const delta = Math.round(base * mult + Math.min(12, S.combo));

      S.score += delta;
      S.goalCur += 1;

      pushRtGood(Number(rt)||0);

      logEvt('hit', t, { judgment:'good', isGood:1, score_delta:delta, rtMs:rt });

    } else if(t.type === 'junk'){
      // shield guard path
      if(S.shield > 0){
        S.shield -= 1;
        S.hitsJunkGuard += 1;
        setShield(S.shield);

        // small penalty but NO MISS (per your standard)
        S.score += Math.round(base * 0.35);
        logEvt('guard', t, { judgment:'junk_guard', isGood:0, rtMs:rt });
      } else {
        S.hitsJunk += 1;
        S.combo = 0;

        // miss includes junk hit
        S.miss += 1;

        // fever drop hard
        setFever(S.fever - 14);

        S.score += base; // negative
        logEvt('hit', t, { judgment:'junk', isGood:0, rtMs:rt });
      }

    } else if(t.type === 'shield'){
      setShield(Math.min(3, S.shield + 1));
      S.score += base;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      logEvt('hit', t, { judgment:'shield', isGood:1, rtMs:rt });

    } else if(t.type === 'star'){
      S.score += base + Math.min(24, S.combo*2);
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      setFever(S.fever + 6);
      logEvt('hit', t, { judgment:'star', isGood:1, rtMs:rt });

    } else if(t.type === 'diamond'){
      S.score += base + 40;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      setFever(S.fever + 10);
      logEvt('hit', t, { judgment:'diamond', isGood:1, rtMs:rt });
    }

    // emit score pulse for your RUN->logger
    WIN.dispatchEvent(new CustomEvent('hha:score', {
      detail: {
        score: S.score,
        combo: S.combo,
        miss: S.miss,
        shots: S.shots,
        hits: S.hitsGood,
        accPct: (S.shots>0) ? Math.round((S.hitsGood*100)/S.shots) : 0,
        medianRtGoodMs: S.medianRtGoodMs
      }
    }));
  }

  function hitTarget(id, meta = {}){
    const t = S.targets.get(id);
    if(!t || t.dead) return;
    // rt since spawn
    const rt = Math.round(nowMs() - t.born);
    applyHit(t, Object.assign({ rtMs: rt }, meta || {}));
    killTarget(id);
    updateHUD();
  }

  // ---------- crosshair shoot support (hha:shoot) ----------
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
      const dx = tx - cx, dy = ty - cy;
      const d = Math.hypot(dx,dy);
      if(d < bestD){
        bestD = d;
        best = t;
      }
    }

    if(best && bestD <= lockPx) return best;
    return null;
  }

  function onShoot(ev){
    if(!S.playing) return;
    const lockPx = clamp(ev?.detail?.lockPx ?? 52, 18, 120);
    const t = pickTargetByCrosshair(lockPx);
    if(t) hitTarget(t.id, { via:'cvr' });
    else {
      // a "shot miss" doesn't count as MISS by your definition; but it affects accuracy.
      S.shots += 1;
    }
    updateHUD();
  }

  WIN.addEventListener('hha:shoot', onShoot);

  // ---------- stage logic (3-stage: Daily -> Storm Mini -> Boss) ----------
  function setGoalDaily(){
    S.goalTarget = (C.diff==='hard') ? 28 : (C.diff==='easy') ? 16 : 20;
    setText('hud-goal', 'Daily');
    if(goalDesc) goalDesc.textContent = `Hit GOOD ${S.goalTarget}`;
    S.goalCur = 0;
  }

  function startMiniStorm(){
    S.miniName = 'Storm';
    S.miniLeft = 10;
    setText('hud-mini','Storm');
    if(bossHint) bossHint.textContent = '—';

    // during storm: more targets + more junk (but director can temper)
  }

  function startBoss(){
    setBoss(true);
    setBossHp(100);
    if(bossHint) bossHint.textContent = 'Finish!';
    S.bossOn = true;
    S.miniName = 'Boss';
    S.miniLeft = 12;
    setText('hud-mini','Boss');
  }

  function bossHit(){
    const dmg = (S.fever >= 60) ? 9 : 6;
    setBossHp(S.bossHp - dmg);
    if(S.bossHp <= 0){
      // boss cleared -> big bonus
      S.score += 180;
      S.miniLeft = 0;
      setBoss(false);
      S.bossOn = false;
      S.miniName = '—';
      setText('hud-mini','—');
    }
  }

  // ---------- spawn policy with AI Director (A) ----------
  function spawnTick(){
    if(!S.playing) return;

    // AI tick
    aiTick();

    // base spawn rate by diff
    let baseEveryMs = (C.diff==='hard') ? 360 : (C.diff==='easy') ? 520 : 440;

    // storm/boss intensify
    if(S.miniName === 'Storm') baseEveryMs *= 0.78;
    if(S.miniName === 'Boss')  baseEveryMs *= 0.82;

    // director affects spawn pacing
    baseEveryMs = baseEveryMs / clamp(S.spawnRateMul||1, 0.85, 1.20);

    // random-like but deterministic-ish pacing (we keep simple)
    if((nowMs() - spawnTick._last) < baseEveryMs) return;
    spawnTick._last = nowMs();

    // spawn composition
    let pJunk = (C.diff==='hard') ? 0.34 : (C.diff==='easy') ? 0.22 : 0.28;

    // storm makes junk higher
    if(S.miniName === 'Storm') pJunk += 0.06;
    // director bias delta
    pJunk = clamp(pJunk + (S.junkBiasDelta||0), 0.12, 0.48);

    let pShield = 0.08;
    let pStar = 0.06;
    let pDiamond = 0.03;

    // fever on -> more bonus items
    if(S.fever >= 60){
      pStar += 0.02;
      pDiamond += 0.01;
      pShield += 0.01;
    }

    // boss phase -> reduce junk a little to keep fair (boss focus)
    if(S.miniName === 'Boss') pJunk = clamp(pJunk - 0.05, 0.10, 0.40);

    const r = Math.random();
    let type = 'good';

    if(r < pDiamond) type = 'diamond';
    else if(r < pDiamond + pStar) type = 'star';
    else if(r < pDiamond + pStar + pShield) type = 'shield';
    else if(r < pDiamond + pStar + pShield + pJunk) type = 'junk';
    else type = 'good';

    const t = spawnTarget(type);

    // boss reacts to good hits: make a “bossHit” on diamond/star/good during boss
    if(S.miniName === 'Boss'){
      t._boss = true;
    }
  }
  spawnTick._last = 0;

  // ---------- main timer tick ----------
  function tick(){
    if(!S.playing) return;

    // time countdown
    const elapsed = (nowMs() - S.t0)/1000;
    S.t = Math.max(0, C.time - elapsed);

    // low time overlay
    if(S.t <= 6){
      showLowTime(true);
      if(lowTimeNum) lowTimeNum.textContent = String(Math.ceil(S.t));
    } else {
      showLowTime(false);
    }

    // mini timers
    if(S.miniLeft > 0){
      S.miniLeft = Math.max(0, S.miniLeft - (1/60));
      if(S.miniLeft <= 0){
        if(S.miniName === 'Storm'){
          // after storm -> boss
          startBoss();
        } else if(S.miniName === 'Boss'){
          // boss time ended -> stop boss
          setBoss(false);
          S.bossOn = false;
          S.miniName = '—';
          setText('hud-mini','—');
        } else {
          S.miniName = '—';
        }
      }
    }

    // goal progression -> trigger storm
    if(S.miniName === '—' || S.miniName === 'Daily'){
      if(S.goalCur >= S.goalTarget){
        startMiniStorm();
      }
    }

    updateTargets();
    spawnTick();
    updateHUD();

    // ghost series recording (B)
    const secPlayed = Math.floor(C.time - S.t);
    if(secPlayed >= 0){
      const last = S.ghostSeries.length ? S.ghostSeries[S.ghostSeries.length-1] : null;
      if(!last || Number(last.t) !== secPlayed){
        S.ghostSeries.push({ t: secPlayed, score: S.score });
        if(S.ghostSeries.length > (C.time + 5)) S.ghostSeries.shift();
      }
    }

    // end
    if(S.t <= 0){
      endGame('time_up');
    } else {
      requestAnimationFrame(tick);
    }
  }

  // ---------- summary/end ----------
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

  function endGame(reason){
    if(S.ended) return;
    S.ended = true;
    S.playing = false;

    // kill all targets
    for(const [id] of S.targets) killTarget(id);

    // hide lowtime
    showLowTime(false);

    const summary = makeSummary(reason || 'end');

    // Save ghost if best (B)
    saveGhostIfBest(summary.scoreFinal);

    // end overlay UI
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

    // Emit ended event for your RUN logger hook
    WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary }));

    // Inject buttons: Cooldown (optional), Export CSV (C)
    try{
      const panel = endOverlay ? endOverlay.querySelector('.panel') : null;
      if(panel){
        // Export button
        let ex = panel.querySelector('#btnExportCsv');
        if(!ex){
          ex = DOC.createElement('button');
          ex.type = 'button';
          ex.className = 'btn';
          ex.id = 'btnExportCsv';
          ex.textContent = 'Export CSV (ML)';
          ex.addEventListener('click', exportCSV);
          const actions = panel.querySelector('.endActions');
          actions?.appendChild(ex);
        }

        // Ghost note
        let gn = panel.querySelector('#ghostNote');
        if(!gn){
          gn = DOC.createElement('div');
          gn.id = 'ghostNote';
          gn.className = 'endSub';
          gn.style.marginTop = '10px';
          gn.textContent = S.ghost
            ? `Ghost Battle: คุณ ${summary.scoreFinal} vs Best ${summary.ghostBestScore} (Δ ${summary.scoreFinal - summary.ghostBestScore})`
            : `Ghost Battle: ยังไม่มี Best run — เล่นรอบนี้จะสร้าง Ghost อัตโนมัติ`;
          panel.appendChild(gn);
        }
      }
    }catch(_){}
  }

  // ---------- wire boss hit to good hits during boss ----------
  WIN.addEventListener('click', (ev)=>{
    // no-op: boss hit handled in applyHit when boss targets marked
  });

  // Patch: when boss active, any good/star/diamond hit triggers boss hp down
  const _applyHit = applyHit;
  applyHit = function(t, meta){
    _applyHit(t, meta);
    if(S.miniName === 'Boss' && (t.type==='good' || t.type==='star' || t.type==='diamond')){
      bossHit();
    }
  };

  // ---------- start game ----------
  function resetUI(){
    S.score=0; S.combo=0; S.comboMax=0;
    S.shots=0; S.hitsGood=0; S.hitsJunk=0; S.hitsJunkGuard=0; S.expireGood=0;
    S.miss=0;
    setFever(0);
    setShield(0);

    S.goalCur=0;
    S.miniName='Daily';
    S.miniLeft=0;
    setGoalDaily();

    setBoss(false);
    setBossHp(0);

    if(endOverlay){
      setAttr('endOverlay','aria-hidden','true');
      endOverlay.style.display = 'none';
    }
  }

  function start(){
    resetUI();
    S.targets.clear();
    layer.innerHTML = '';

    // start clock
    S.t0 = nowMs();
    S.t = C.time;
    S.playing = true;
    S.ended = false;

    // mark mini as Daily for HUD
    setText('hud-mini','—');
    setText('miniTimer','—');

    // log session start in local buffer
    S.events = [];
    S.ghostSeries = [];

    // first HUD paint
    updateHUD();

    // start loop
    requestAnimationFrame(tick);
  }

  // ---------- button wiring (RUN already does retry/hub, but keep safe) ----------
  const btnRetry = $('btnRetry');
  const btnHub = $('btnHub');

  btnRetry?.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  });

  btnHub?.addEventListener('click', ()=>{
    location.href = C.hub || '../hub.html';
  });

  // ---------- final safety: prevent page leave losing data (logger already flush-hardened) ----------
  WIN.addEventListener('pagehide', ()=>{
    // nothing heavy here; logger handles it
  });

  // go!
  start();
}