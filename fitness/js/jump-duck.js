// === /fitness/js/jump-duck.js ===
// Jump-Duck — FULL (Boss Pack 6 + AI Director + AI Coach + Seeded Pattern + VR shoot + CSV + (optional) ?log= Apps Script)
// v20260228-jd-FULL-1to4
// ✅ PC: ArrowUp/W = JUMP, ArrowDown/S = DUCK
// ✅ Mobile: tap top/bottom, + actionbar buttons (data-action jump/duck)
// ✅ cVR/VR: listens to window event 'hha:shoot' (from HeroHealth vr-ui.js) -> jump/duck
// ✅ Boss in Training/Test/Research (tutorial disables boss)
// ✅ Mixed boss patterns (6) + deterministic in research via seed/pid/phase/conditionGroup
// ✅ AI prediction always; adaptive only in Training/Test; Research locked (prediction-only)
// ✅ Local CSV export sessions/events (schema-aligned) + optional POST to ?log= (Apps Script)
// ✅ Optional students-profile upsert to ?log= (best effort, cache per studentKey)

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  /* =========================
   * DOM helpers
   * ========================= */
  const $ = (s, el=DOC)=> el.querySelector(s);
  const $$ = (s, el=DOC)=> Array.from(el.querySelectorAll(s));
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, Number(v)||0));
  const clamp01 = (v)=> clamp(v,0,1);

  function qs(k, def=''){
    try{
      const v = new URL(location.href).searchParams.get(k);
      return (v==null || String(v).trim()==='') ? def : String(v);
    }catch(_){
      return def;
    }
  }

  function dlText(filename, text, mime='text/plain;charset=utf-8'){
    const blob = new Blob([text], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }

  /* =========================
   * Fatal overlay
   * ========================= */
  function fatal(msg){
    const box = DOC.getElementById('jd-fatal');
    if (!box) { alert(msg); return; }
    box.textContent = msg;
    box.classList.remove('jd-hidden');
  }
  WIN.addEventListener('error', (e)=>{
    fatal('JS ERROR:\n' + (e?.message || e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
  });

  /* =========================
   * HHA context (+ optional logger)
   * ========================= */
  const HHA = {
    projectTag: qs('projectTag','HeroHealth'),
    runMode: qs('runMode', qs('run','play')), // play/research
    studyId: qs('studyId',''),
    phase: qs('phase',''),
    conditionGroup: qs('conditionGroup',''),
    sessionOrder: qs('sessionOrder',''),
    blockLabel: qs('blockLabel',''),
    siteCode: qs('siteCode',''),
    schoolYear: qs('schoolYear',''),
    semester: qs('semester',''),
    pid: qs('pid','anon'),
    view: qs('view',''),
    hub: qs('hub',''),
    logUrl: qs('log',''), // Apps Script Web App URL (optional)
    gameVersion: 'v20260228-jd-FULL-1to4',
    eventBuf: [],
    _flushBusy: false
  };

  function hhaBaseRow(state){
    return {
      timestampIso: nowIso(),
      projectTag: HHA.projectTag,
      runMode: HHA.runMode,
      studyId: HHA.studyId,
      phase: HHA.phase,
      conditionGroup: HHA.conditionGroup,
      sessionId: state.sessionId || '',
      eventType: '',
      gameMode: state.mode || '',
      diff: state.diff || '',
      timeFromStartMs: Math.round(state.elapsedMs || 0),
      targetId: '',
      emoji: '',
      itemType: '',
      lane: '',
      rtMs: '',
      judgment: '',
      totalScore: Math.round(state.score || 0),
      combo: state.combo || 0,
      isGood: '',
      feverState: state.feverOn ? 'on' : 'off',
      feverValue: Math.round(state.fever || 0),
      goalProgress: `${state.clearedObs||0}/${state.totalObs||0}`,
      miniProgress: state.bossActive ? `boss:p${state.bossPhase}` : '',
      extra: '',
      studentKey: state.participant || HHA.pid || 'anon',
      schoolCode: qs('schoolCode',''),
      classRoom: qs('classRoom',''),
      studentNo: qs('studentNo',''),
      nickName: qs('nickName','')
    };
  }

  async function hhaPostJson(payload){
    if (!HHA.logUrl) return { ok:false, skipped:true, reason:'no_log_url' };
    try{
      const res = await fetch(HHA.logUrl, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        keepalive: true
      });
      let j=null; try{ j=await res.json(); }catch(_){}
      return { ok: !!res.ok, status: res.status, body:j };
    }catch(err){
      return { ok:false, error: String(err && (err.message||err) || err) };
    }
  }

  function hhaPushEvent(state, eventType, extra){
    const row = Object.assign(hhaBaseRow(state), { eventType:String(eventType||'') }, extra||{});
    // buffer for online post
    HHA.eventBuf.push(row);
    if (HHA.eventBuf.length > 800) HHA.eventBuf.shift();

    // local CSV
    state.localEventsRows.push(row);
    if (state.localEventsRows.length > 5000){
      state.localEventsRows.splice(0, state.localEventsRows.length - 5000);
    }
  }

  async function hhaFlushEvents(state, reason){
    if (HHA._flushBusy) return;
    if (!HHA.logUrl) return;
    if (!HHA.eventBuf.length) return;
    HHA._flushBusy = true;
    try{
      const chunk = HHA.eventBuf.splice(0, HHA.eventBuf.length);
      for (const row of chunk){
        await hhaPostJson(Object.assign({_table:'events', type:'event'}, row));
      }
      // add local marker too
      hhaPushEvent(state, 'flush_events_done', { extra: String(reason||'') });
    } finally {
      HHA._flushBusy = false;
    }
  }

  function median(arr){
    if (!arr || !arr.length) return '';
    const a = arr.map(Number).filter(Number.isFinite).slice().sort((x,y)=>x-y);
    if (!a.length) return '';
    const m = Math.floor(a.length/2);
    return (a.length % 2) ? a[m] : ((a[m-1]+a[m])/2);
  }

  async function hhaPostSessionSummary(state, endReason){
    const totalHits = state.jumpHit + state.duckHit;
    const totalMiss = state.jumpMiss + state.duckMiss;
    const totalJudged = totalHits + totalMiss;
    const accPct = totalJudged ? (totalHits/totalJudged)*100 : 0;

    const rtVals = state.rtHits.map(Number).filter(Number.isFinite);
    const rtMean = rtVals.length ? (rtVals.reduce((a,b)=>a+b,0)/rtVals.length) : '';
    const rtMedian = rtVals.length ? median(rtVals) : '';
    const fastHitRate = rtVals.length ? (rtVals.filter(v=>v<=180).length/rtVals.length)*100 : '';

    const sesRow = {
      _table:'sessions',
      type:'session',

      timestampIso: nowIso(),
      projectTag: HHA.projectTag,
      runMode: HHA.runMode,
      studyId: HHA.studyId,
      phase: HHA.phase,
      conditionGroup: HHA.conditionGroup,
      sessionOrder: HHA.sessionOrder,
      blockLabel: HHA.blockLabel,
      siteCode: HHA.siteCode,
      schoolYear: HHA.schoolYear,
      semester: HHA.semester,

      sessionId: state.sessionId,
      gameMode: state.mode,
      diff: state.diff,
      durationPlannedSec: state.durationSec,
      durationPlayedSec: +(Math.max(0, state.elapsedMs)/1000).toFixed(2),

      scoreFinal: Math.round(state.score),
      comboMax: state.comboMax,
      misses: state.misses,

      goalsCleared: state.clearedObs,
      goalsTotal: state.totalObs,
      miniCleared: state.bossCleared ? 1 : 0,
      miniTotal: state.bossEnabled ? 1 : 0,

      nTargetGoodSpawned: state.totalObs,
      nTargetJunkSpawned: '',
      nTargetStarSpawned: '',
      nTargetDiamondSpawned: '',
      nTargetShieldSpawned: '',

      nHitGood: totalHits,
      nHitJunk: '',
      nHitJunkGuard: '',
      nExpireGood: totalMiss,

      accuracyGoodPct: +accPct.toFixed(2),
      junkErrorPct: '',
      avgRtGoodMs: rtMean===''? '' : +rtMean.toFixed(2),
      medianRtGoodMs: rtMedian===''? '' : +Number(rtMedian).toFixed(2),
      fastHitRatePct: fastHitRate===''? '' : +fastHitRate.toFixed(2),

      device: HHA.view || (('ontouchstart' in WIN || navigator.maxTouchPoints>0) ? 'mobile' : 'pc'),
      gameVersion: HHA.gameVersion,
      reason: String(endReason||''),
      startTimeIso: state.startIso,
      endTimeIso: nowIso(),

      studentKey: state.participant || HHA.pid || 'anon',
      schoolCode: qs('schoolCode',''),
      schoolName: qs('schoolName',''),
      classRoom: qs('classRoom',''),
      studentNo: qs('studentNo',''),
      nickName: qs('nickName',''),
      gender: qs('gender',''),
      age: qs('age',''),
      gradeLevel: qs('gradeLevel',''),
      heightCm: qs('heightCm',''),
      weightKg: qs('weightKg',''),
      bmi: qs('bmi',''),
      bmiGroup: qs('bmiGroup',''),
      vrExperience: qs('vrExperience',''),
      gameFrequency: qs('gameFrequency',''),
      handedness: qs('handedness',''),
      visionIssue: qs('visionIssue',''),
      healthDetail: qs('healthDetail',''),
      consentParent: qs('consentParent',''),
      consentTeacher: qs('consentTeacher',''),
      profileSource: qs('profileSource',''),
      surveyKey: qs('surveyKey',''),
      excludeFlag: qs('excludeFlag',''),
      noteResearcher: state.note || qs('noteResearcher',''),

      rtBreakdownJson: JSON.stringify({ rtHits: state.rtHits }),
      __extraJson: JSON.stringify({
        bossStyle: state.bossStyle,
        bossTimeline: state.bossTimeline,
        ai: state.ai
      })
    };

    // local CSV store (keep without _table/type)
    state.localSessionsRows.push(Object.assign({}, sesRow));
    if (state.localSessionsRows.length > 300) state.localSessionsRows.shift();

    if (!HHA.logUrl) return { ok:false, skipped:true, reason:'no_log_url' };
    return hhaPostJson(sesRow);
  }

  /* students-profile upsert (optional) */
  function profileCacheKey(state){
    const sk = state.participant || HHA.pid || 'anon';
    return `HHA_PROFILE_SENT_JD:${sk}`;
  }

  function buildStudentProfileRow(state){
    const studentKey = state.participant || HHA.pid || 'anon';
    return {
      _table: 'students-profile',
      type: 'profile',
      timestampIso: nowIso(),
      projectTag: HHA.projectTag,
      runMode: HHA.runMode,

      studentKey,
      schoolCode: qs('schoolCode',''),
      schoolName: qs('schoolName',''),
      classRoom: qs('classRoom',''),
      studentNo: qs('studentNo',''),
      nickName: qs('nickName',''),

      gender: qs('gender',''),
      age: qs('age',''),
      gradeLevel: qs('gradeLevel',''),
      heightCm: qs('heightCm',''),
      weightKg: qs('weightKg',''),
      bmi: qs('bmi',''),
      bmiGroup: qs('bmiGroup',''),
      vrExperience: qs('vrExperience',''),
      gameFrequency: qs('gameFrequency',''),
      handedness: qs('handedness',''),
      visionIssue: qs('visionIssue',''),
      healthDetail: qs('healthDetail',''),
      consentParent: qs('consentParent',''),
      consentTeacher: qs('consentTeacher',''),

      createdAtIso: qs('createdAtIso','') || nowIso(),
      updatedAtIso: nowIso(),
      source: qs('profileSource','query')
    };
  }

  async function upsertProfileIfAny(state, force=false){
    if (!HHA.logUrl) return { ok:false, skipped:true, reason:'no_log_url' };
    const row = buildStudentProfileRow(state);

    const hasIdentity = String(row.studentKey||'').trim() || String(row.nickName||'').trim() || String(row.studentNo||'').trim();
    const hasFields = String(row.gender||'').trim() || String(row.age||'').trim() || String(row.gradeLevel||'').trim() ||
                      String(row.heightCm||'').trim() || String(row.weightKg||'').trim() || String(row.vrExperience||'').trim();

    if (!hasIdentity && !hasFields) return { ok:false, skipped:true, reason:'no_profile_data' };

    try{
      if (!force && localStorage.getItem(profileCacheKey(state)) === '1') {
        return { ok:true, skipped:true, reason:'already_sent' };
      }
    }catch(_){}

    const res = await hhaPostJson(row);
    if (res && res.ok){
      try{ localStorage.setItem(profileCacheKey(state), '1'); }catch(_){}
      hhaPushEvent(state, 'profile_upsert_ok', { itemType:'profile', extra: JSON.stringify({ studentKey: row.studentKey }) });
    } else {
      hhaPushEvent(state, 'profile_upsert_fail', { itemType:'profile', extra: JSON.stringify(res) });
    }
    return res;
  }

  /* =========================
   * CSV schema (local export)
   * ========================= */
  const JD_CSV_SCHEMA = {
    sessions: [
      'timestampIso','projectTag','runMode','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester',
      'sessionId','gameMode','diff','durationPlannedSec','durationPlayedSec','scoreFinal','comboMax','misses',
      'goalsCleared','goalsTotal','miniCleared','miniTotal',
      'nTargetGoodSpawned','nTargetJunkSpawned','nTargetStarSpawned','nTargetDiamondSpawned','nTargetShieldSpawned',
      'nHitGood','nHitJunk','nHitJunkGuard','nExpireGood',
      'accuracyGoodPct','junkErrorPct','avgRtGoodMs','medianRtGoodMs','fastHitRatePct',
      'device','gameVersion','reason','startTimeIso','endTimeIso',
      'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName','gender','age','gradeLevel',
      'heightCm','weightKg','bmi','bmiGroup','vrExperience','gameFrequency','handedness','visionIssue','healthDetail',
      'consentParent','consentTeacher','profileSource','surveyKey','excludeFlag','noteResearcher','rtBreakdownJson','__extraJson'
    ],
    events: [
      'timestampIso','projectTag','runMode','studyId','phase','conditionGroup','sessionId','eventType','gameMode','diff',
      'timeFromStartMs','targetId','emoji','itemType','lane','rtMs','judgment','totalScore','combo','isGood',
      'feverState','feverValue','goalProgress','miniProgress','extra',
      'studentKey','schoolCode','classRoom','studentNo','nickName'
    ]
  };

  function csvEscape(v){
    if (v == null) return '';
    let s = String(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  function rowsToCsv(rows, cols){
    const head = cols.join(',');
    const body = (rows||[]).map(r => cols.map(c=>csvEscape(r[c])).join(',')).join('\n');
    return body ? (head + '\n' + body) : head;
  }
  function downloadCsv(state, kind){
    const k = (kind === 'sessions') ? 'sessions' : 'events';
    const cols = JD_CSV_SCHEMA[k];
    const rows = (k === 'sessions') ? (state.localSessionsRows||[]) : (state.localEventsRows||[]);
    const csv = rowsToCsv(rows, cols);
    const ts = nowIso().replace(/[:.]/g,'-');
    dlText(`jump-duck-${k}-${ts}.csv`, csv, 'text/csv;charset=utf-8');
    return { kind:k, rows: rows.length, cols: cols.length };
  }

  /* =========================
   * RNG (deterministic)
   * ========================= */
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function createRng(seedText){
    const seedFn = xmur3(String(seedText||'jd'));
    const rand = sfc32(seedFn(), seedFn(), seedFn(), seedFn());
    return {
      next: rand,
      int(min, max){
        min=Math.floor(min); max=Math.floor(max);
        return Math.floor(rand()*(max-min+1))+min;
      },
      pick(arr){
        if(!arr||!arr.length) return undefined;
        return arr[Math.floor(rand()*arr.length)];
      }
    };
  }

  /* =========================
   * Config
   * ========================= */
  const CFG = {
    // px-based gameplay for better precision than %
    hitLineRatio: 0.24,      // hit line x as ratio of play area width
    windowPx: 54,            // action window around hit line
    obstacleW: 92,
    obstacleH: 92,
    startPadPx: 60,

    // avatar (cosmetic)
    gravityPx: 2800,
    jumpVelPx: 860,
    duckHoldMs: 260,

    // fever
    feverOnAt: 100,
    feverOffAt: 55,
    feverHitGain: 12,
    feverMissLoss: 18,
    feverDecayPerSec: 4.0,

    // scoring
    scoreHit: 100,
    scoreGreat: 120,
    scorePerfect: 150,
    scoreBossCounter: 220,

    // stability
    stabHitHeal: 0.6,
    stabMissDmg: 8,
    stabBossMissDmg: 11,

    // difficulty
    diff: {
      easy:   { speed: 260, spawnEveryMs: 1050, feintBase: 0.04 },
      normal: { speed: 340, spawnEveryMs: 820,  feintBase: 0.08 },
      hard:   { speed: 430, spawnEveryMs: 650,  feintBase: 0.12 }
    },

    // boss
    boss: {
      enabledByMode: { training:true, test:true, research:true },
      spawnAtPctByMode: { training:0.62, test:0.58, research:0.58 },
      durationSecByDiff: { easy:10, normal:14, hard:18 },
      counterWindowMs: { easy:260, normal:210, hard:170 }
    }
  };

  /* =========================
   * Boss Pattern Pack 6
   * ========================= */
  const JD_BOSS_PACK = {
    p1_ladder:     { id:'p1_ladder',     label:'Ladder',       phase:1, tempoMul:1.00, seq:['J','R','D','R','J','R','D','R','J','D'] },
    p1_mirror:     { id:'p1_mirror',     label:'Mirror',       phase:1, tempoMul:1.05, seq:['J','D','J','D','D','J','D','J','R','J'] },
    p2_doubleSwap: { id:'p2_doubleSwap', label:'Double Swap',  phase:2, tempoMul:1.12, seq:['J','J','D','D','J','D','J','D','R','J','D'] },
    p2_feintBurst: { id:'p2_feintBurst', label:'Feint Burst',  phase:2, tempoMul:1.18, seq:['J','X','D','J','X','D','J','D','X','J'] },
    p3_shieldStorm:{ id:'p3_shieldStorm',label:'Shield Storm', phase:3, tempoMul:1.25, seq:['D','J','D','J','J','D','X','D','J','D','J','R'] },
    p3_mixedFinale:{ id:'p3_mixedFinale',label:'Mixed Finale', phase:3, tempoMul:1.35, seq:['J','D','X','J','J','D','D','J','X','D','J','D','J'] },
  };
  function bossPoolForPhase(phase){
    const p = Number(phase)||1;
    return Object.values(JD_BOSS_PACK).filter(x=>x.phase===p);
  }
  function pickBossPattern(state){
    const mode = (qs('boss','mixed') || 'mixed').toLowerCase();
    const pool = bossPoolForPhase(state.bossPhase);

    if(!pool.length) return null;

    const fixed = pool.find(p => p.id === mode);
    if(fixed) return fixed;

    // mixed/random
    let idx = Math.floor(state.rng.next() * pool.length);
    if(state.lastBossPatternId && pool.length>1){
      let guard=0;
      while(pool[idx] && pool[idx].id===state.lastBossPatternId && guard<8){
        idx = (idx+1)%pool.length; guard++;
      }
    }
    const picked = pool[idx];
    state.lastBossPatternId = picked.id;
    return picked;
  }

  /* =========================
   * AI Director + Coach
   * ========================= */
  const JD_AI = {
    enabled: true,
    adaptInTraining: true,
    adaptInTest: true,
    adaptInResearch: false,
    tickMs: 2500,
    lastAt: 0,
    level: 0, // -2..+2
    fatigueRisk: 0,
    skillScore: 0.5,
    suggested: 'normal',
    reason: '',
    locked: false,
    tipCooldownUntil: 0
  };

  function isTraining(state){ return state.mode==='training'; }
  function isTest(state){ return state.mode==='test'; }
  function isResearch(state){ return state.mode==='research'; }

  function aiCanAdapt(state){
    if(!JD_AI.enabled) return false;
    if(isResearch(state)) return !!JD_AI.adaptInResearch;
    if(isTest(state)) return !!JD_AI.adaptInTest;
    if(isTraining(state)) return !!JD_AI.adaptInTraining;
    return false;
  }

  function aiPredictFromSnapshot(snap){
    const acc = Number(snap.acc||0);           // 0..100
    const missRate = Number(snap.missRate||0); // 0..100
    const stability = Number(snap.stability||100); // 0..100
    const rtMean = Number(snap.rtMean||0);     // ms
    const comboTrend = Number(snap.comboTrend||0); // -1..+1

    const fatigueRisk = clamp01(
      (1 - stability/100) * 0.45 +
      (missRate/100) * 0.35 +
      Math.min(rtMean/650,1) * 0.20
    );

    const skillScore = clamp01(
      (acc/100) * 0.55 +
      ((comboTrend + 1)/2) * 0.20 +
      (1 - missRate/100) * 0.25
    );

    let suggested='normal';
    if(skillScore>=0.78 && fatigueRisk<=0.35) suggested='hard';
    else if(skillScore<=0.42 || fatigueRisk>=0.65) suggested='easy';

    let reason='steady';
    if(fatigueRisk>=0.65) reason='fatigue↑ stability↓/miss↑';
    else if(skillScore>=0.78) reason='skill↑ acc/combo ดี';
    else if(missRate>=20) reason='miss rate สูง';

    return {fatigueRisk, skillScore, suggested, reason};
  }

  function aiUpdateHud(state){
    const eFat = DOC.getElementById('hud-ai-fatigue');
    const eSkill = DOC.getElementById('hud-ai-skill');
    const eSugg = DOC.getElementById('hud-ai-suggest');
    const eTip = DOC.getElementById('hud-ai-tip');

    if(eFat) eFat.textContent = `${Math.round(JD_AI.fatigueRisk*100)}%`;
    if(eSkill) eSkill.textContent = `${Math.round(JD_AI.skillScore*100)}%`;
    if(eSugg) eSugg.textContent = JD_AI.locked ? `${JD_AI.suggested} (lock)` : JD_AI.suggested;
    if(eTip && !eTip.dataset.locked) eTip.textContent = '';
  }

  function aiDirectorTick(state, nowPerf){
    if(!JD_AI.enabled || !state.running) return;
    if(nowPerf - JD_AI.lastAt < JD_AI.tickMs) return;
    JD_AI.lastAt = nowPerf;

    const hits = state.jumpHit + state.duckHit;
    const miss = state.jumpMiss + state.duckMiss;
    const judged = Math.max(1, hits + miss);
    const acc = (hits / judged) * 100;
    const missRate = (miss / judged) * 100;
    const stability = state.stability;

    const rtArr = state.rtHits;
    const rtMean = rtArr.length ? (rtArr.reduce((a,b)=>a+b,0)/rtArr.length) : 0;

    const comboTrend = (state.combo >= state._comboPrevAi) ? 0.5 : -0.4;
    state._comboPrevAi = state.combo;

    const pred = aiPredictFromSnapshot({acc, missRate, stability, rtMean, comboTrend});
    JD_AI.fatigueRisk = pred.fatigueRisk;
    JD_AI.skillScore = pred.skillScore;
    JD_AI.suggested = pred.suggested;
    JD_AI.reason = pred.reason;
    JD_AI.locked = !aiCanAdapt(state);

    aiUpdateHud(state);

    // prediction-only in research
    if(!aiCanAdapt(state)) return;

    let target=0;
    if(pred.suggested==='hard') target=2;
    else if(pred.suggested==='easy') target=-2;

    if(isTest(state)) target = clamp(target,-1,1);

    if(target > JD_AI.level) JD_AI.level += 1;
    else if(target < JD_AI.level) JD_AI.level -= 1;

    // apply to state (spawn/tempo/feint intensity)
    state.aiLevel = JD_AI.level;
    state.aiTempoMul =
      JD_AI.level<=-2 ? 0.88 :
      JD_AI.level===-1? 0.94 :
      JD_AI.level=== 1? 1.07 :
      JD_AI.level>= 2? 1.14 : 1.00;

    state.aiFeintRate =
      JD_AI.level<=-1 ? 0.04 :
      JD_AI.level=== 0 ? 0.08 :
      JD_AI.level=== 1 ? 0.12 : 0.16;
  }

  function aiCoachTip(state){
    const now = performance.now();
    if(now < JD_AI.tipCooldownUntil) return '';
    JD_AI.tipCooldownUntil = now + 3200;

    const fr = JD_AI.fatigueRisk;
    const st = state.stability;
    const combo = state.combo;
    const miss = state.misses;

    let tip='';
    if(fr >= 0.72) tip='🫁 ชะลอหายใจ 1 รอบ แล้วกลับเข้าจังหวะ';
    else if(st < 55) tip='🧍 โฟกัสแกนกลางให้นิ่ง แล้วค่อยกด';
    else if(miss >= 5 && state.recentMissType==='jump') tip='🦘 พลาด Jump บ่อย: รอเข้เส้นก่อนค่อยกด';
    else if(miss >= 5 && state.recentMissType==='duck') tip='🛡️ พลาด Duck บ่อย: ก้มให้เร็วขึ้นครึ่งจังหวะ';
    else if(combo >= 8 && JD_AI.skillScore >= 0.7) tip='🔥 ดีมาก! รักษาจังหวะเดิม อย่ารีบเกิน';
    else if(JD_AI.suggested==='hard') tip='⚡ ระวังสลับสูง–ต่ำติดกัน';
    else if(JD_AI.suggested==='easy') tip='🎯 เน้นถูกก่อนเร็ว แล้วค่อยเร่ง';
    else tip='🎵 มองเส้นตัดแล้วค่อยสั่ง จะแม่นขึ้น';

    return tip;
  }

  function aiCoachTick(state){
    if(!JD_AI.enabled || !state.running) return;
    const tip = aiCoachTip(state);
    if(!tip) return;

    const eTip = DOC.getElementById('hud-ai-tip');
    if(eTip){
      eTip.textContent = tip;
      eTip.dataset.locked = '1';
      setTimeout(()=>{ if(eTip && eTip.textContent===tip){ eTip.textContent=''; eTip.dataset.locked=''; } }, 1800);
    }

    // also show in judge if not showing
    const j = DOC.getElementById('jd-judge');
    if(j && !j.classList.contains('show')){
      j.textContent = tip;
      j.classList.add('show');
      setTimeout(()=>{ if(j && j.textContent===tip){ j.classList.remove('show'); j.textContent='READY'; } }, 1100);
    }
  }

  /* =========================
   * Pattern generator hook (seeded)
   * ========================= */
  const JD_PATTERN_HOOKS = {
    enabled: true,
    deterministicResearch: true,

    nextObstacle(state){
      const diffCfg = CFG.diff[state.diff] || CFG.diff.normal;
      const baseFeint = diffCfg.feintBase;

      // baseline pHigh
      let pHigh = 0.50;

      // AI intensity in training/test (if adaptive)
      const aiLevel = (aiCanAdapt(state) ? (state.aiLevel||0) : 0);
      const pFeint = clamp01(baseFeint + aiLevel*0.02);

      pHigh = clamp(pHigh + aiLevel*0.03, 0.25, 0.75);

      // deterministic in research (use separate rng key per spawn idx)
      let r1 = state.rng.next();
      let r2 = state.rng.next();

      if(isResearch(state) && this.deterministicResearch){
        const idx = state.totalObs + 1;
        const r = createRng(`${state.seedResolved}|obs|${idx}|${state.bossPhase}`).next();
        r1 = r;
        r2 = createRng(`${state.seedResolved}|obs2|${idx}|${state.bossPhase}`).next();
      }

      const kind = (r1 < pFeint) ? 'feint' : 'normal';
      const lane = (r2 < pHigh) ? 'high' : 'low';
      return { kind, lane };
    }
  };

  /* =========================
   * UI / Views
   * ========================= */
  const viewMenu = $('#view-menu');
  const viewPlay = $('#view-play');
  const viewResult = $('#view-result');

  const elMode = $('#jd-mode');
  const elDiff = $('#jd-diff');
  const elDuration = $('#jd-duration');

  const elResearchBlock = $('#jd-research-block');
  const elPid = $('#jd-participant-id');
  const elGroup = $('#jd-group');
  const elNote = $('#jd-note');

  const elBackHubMenu = $('#jd-back-hub-menu');
  const elBackHubPlay = $('#jd-back-hub-play');
  const elBackHubResult = $('#jd-back-hub-result');

  const elPlayArea = $('#jd-play-area');
  const elAvatar = $('#jd-avatar');
  const elObsHost = $('#jd-obstacles');
  const elJudge = $('#jd-judge');
  const elTele = $('#jd-tele');

  const hud = {
    phase: $('#hud-phase'),
    boss: $('#hud-boss'),

    progFill: $('#hud-prog-fill'),
    progText: $('#hud-prog-text'),
    feverFill: $('#hud-fever-fill'),
    feverStatus: $('#hud-fever-status'),

    bossWrap: $('#boss-bar-wrap'),
    bossFill: $('#hud-boss-fill'),
    bossStatus: $('#hud-boss-status'),

    mode: $('#hud-mode'),
    diff: $('#hud-diff'),
    duration: $('#hud-duration'),
    stability: $('#hud-stability'),
    time: $('#hud-time'),
    obstacles: $('#hud-obstacles'),
    score: $('#hud-score'),
    combo: $('#hud-combo')
  };

  const res = {
    mode: $('#res-mode'),
    diff: $('#res-diff'),
    duration: $('#res-duration'),
    totalObs: $('#res-total-obs'),
    hits: $('#res-hits'),
    miss: $('#res-miss'),
    jumpHit: $('#res-jump-hit'),
    duckHit: $('#res-duck-hit'),
    jumpMiss: $('#res-jump-miss'),
    duckMiss: $('#res-duck-miss'),
    acc: $('#res-acc'),
    rtMean: $('#res-rt-mean'),
    stabilityMin: $('#res-stability-min'),
    score: $('#res-score'),
    rank: $('#res-rank')
  };

  // SFX
  const sfx = {
    hit: $('#jd-sfx-hit'),
    miss: $('#jd-sfx-miss'),
    combo: $('#jd-sfx-combo'),
    beep: $('#jd-sfx-beep'),
    boss: $('#jd-sfx-boss'),
    fever: $('#jd-sfx-fever')
  };

  function playSfx(el, vol){
    if(!el) return;
    try{
      if(Number.isFinite(vol)) el.volume = vol;
      el.currentTime = 0;
      el.play().catch(()=>{});
    }catch(_){}
  }

  function switchView(name){
    viewMenu?.classList.add('jd-hidden');
    viewPlay?.classList.add('jd-hidden');
    viewResult?.classList.add('jd-hidden');
    if(name==='menu') viewMenu?.classList.remove('jd-hidden');
    if(name==='play') viewPlay?.classList.remove('jd-hidden');
    if(name==='result') viewResult?.classList.remove('jd-hidden');
  }

  let judgeTimer=null;
  function showJudge(text, kind){
    if(!elJudge) return;
    elJudge.textContent = text || '';
    elJudge.className = 'jd-judge show';
    if(kind) elJudge.classList.add(kind);
    if(judgeTimer) clearTimeout(judgeTimer);
    judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 520);
  }

  let teleTimer=null;
  function telegraph(text='TEMPO SHIFT', ms=260){
    if(!elTele) return;
    const inner = elTele.querySelector('.jd-tele-inner');
    if(inner) inner.textContent = `⚡ ${text}`;
    elTele.classList.remove('jd-hidden');
    elTele.classList.add('on');
    if(teleTimer) clearTimeout(teleTimer);
    teleTimer = setTimeout(()=>{
      elTele.classList.remove('on');
      setTimeout(()=> elTele.classList.add('jd-hidden'), 120);
    }, ms);
  }

  function updateResearchVisibility(){
    const m = String(elMode?.value || 'training').toLowerCase();
    if(!elResearchBlock) return;
    elResearchBlock.classList.toggle('jd-hidden', m !== 'research');
  }

  function setHubLinks(){
    const hub = HHA.hub || '';
    if(!hub) return;
    if(elBackHubMenu) elBackHubMenu.href = hub;
    if(elBackHubPlay) elBackHubPlay.href = hub;
    if(elBackHubResult) elBackHubResult.href = hub;
  }

  function applyViewClass(){
    const qv = String(qs('view','')).toLowerCase();
    const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints>0);
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    if(qv==='vr') DOC.body.classList.add('view-vr');
    else if(qv==='cvr') DOC.body.classList.add('view-cvr');
    else DOC.body.classList.add(touch ? 'view-mobile' : 'view-pc');
  }

  /* =========================
   * Game state
   * ========================= */
  const state = {
    running:false,
    ended:false,
    tutorial:false,

    mode:'training',
    diff:'normal',
    durationSec:60,

    // time
    startPerf:0,
    startIso:'',
    elapsedMs:0,
    lastPerf:0,

    // rng
    seedResolved:'',
    rng: createRng('jd-init'),
    lastBossPatternId:'',

    // action
    lastAction:null, // {type, tPerf}
    duckUntilPerf:0,

    // obstacles
    obstacles:[], // {id, kind: low/high, isFeint, x, y, duePerf, el}
    nextObsId:1,
    nextSpawnPerf:0,

    // metrics
    score:0,
    combo:0,
    comboMax:0,
    misses:0,
    stability:100,
    stabilityMin:100,

    totalObs:0,
    clearedObs:0,
    jumpHit:0,
    duckHit:0,
    jumpMiss:0,
    duckMiss:0,
    rtHits:[], // ms abs

    recentMissType:'',

    // fever
    fever:0, // 0..100
    feverOn:false,

    // boss
    bossEnabled:false,
    bossActive:false,
    bossCleared:false,
    bossPhase:0,      // 0..3
    bossStyle:'mixed',
    bossHp:100,
    bossHpMax:100,
    bossEndPerf:0,
    bossNextPatternPerf:0,
    bossCounterExpected:'',
    bossCounterUntilPerf:0,
    bossTimeline:[],

    // AI
    ai:{
      fatigueRisk:0,
      skillScore:0.5,
      suggested:'normal',
      reason:'',
      locked:true,
      level:0
    },
    aiLevel:0,
    aiTempoMul:1.0,
    aiFeintRate:0.08,

    // participant
    participant:'',
    group:'',
    note:'',

    // local logs
    localEventsRows:[],
    localSessionsRows:[],
    _comboPrevAi:0
  };

  function resetForRun(){
    state.running=false;
    state.ended=false;
    state.elapsedMs=0;
    state.lastPerf=0;

    state.lastAction=null;
    state.duckUntilPerf=0;

    state.obstacles.length=0;
    state.nextObsId=1;
    state.nextSpawnPerf=0;

    state.score=0;
    state.combo=0;
    state.comboMax=0;
    state.misses=0;
    state.stability=100;
    state.stabilityMin=100;

    state.totalObs=0;
    state.clearedObs=0;
    state.jumpHit=0;
    state.duckHit=0;
    state.jumpMiss=0;
    state.duckMiss=0;
    state.rtHits.length=0;

    state.recentMissType='';

    state.fever=0;
    state.feverOn=false;

    state.bossActive=false;
    state.bossCleared=false;
    state.bossPhase=0;
    state.bossHp=100;
    state.bossHpMax=100;
    state.bossEndPerf=0;
    state.bossNextPatternPerf=0;
    state.bossCounterExpected='';
    state.bossCounterUntilPerf=0;
    state.bossTimeline.length=0;

    state.aiLevel=0;
    state.aiTempoMul=1.0;
    state.aiFeintRate=(CFG.diff[state.diff]||CFG.diff.normal).feintBase;

    state.localEventsRows = [];
    state.localSessionsRows = [];
    state._comboPrevAi = 0;

    if(elObsHost) elObsHost.innerHTML='';
    if(hud.bossWrap) hud.bossWrap.classList.add('jd-hidden');
  }

  function hitLineX(){
    const r = elPlayArea?.getBoundingClientRect();
    const w = r ? r.width : 800;
    return w * CFG.hitLineRatio;
  }

  function fmtMs(ms){
    if(!Number.isFinite(ms)) return '-';
    return Math.round(ms) + ' ms';
  }

  function updateHud(){
    const tLeft = Math.max(0, state.durationSec - (state.elapsedMs/1000));
    if(hud.mode) hud.mode.textContent = state.tutorial ? 'Tutorial' : (state.mode[0].toUpperCase()+state.mode.slice(1));
    if(hud.diff) hud.diff.textContent = state.diff;
    if(hud.duration) hud.duration.textContent = state.durationSec + 's';
    if(hud.stability) hud.stability.textContent = Math.round(state.stability) + '%';
    if(hud.time) hud.time.textContent = tLeft.toFixed(1);
    if(hud.obstacles) hud.obstacles.textContent = `${state.clearedObs} / ${state.totalObs}`;
    if(hud.score) hud.score.textContent = String(Math.round(state.score));
    if(hud.combo) hud.combo.textContent = String(state.combo);

    const prog = clamp01((state.elapsedMs/1000)/Math.max(1,state.durationSec));
    if(hud.progFill) hud.progFill.style.transform = `scaleX(${prog.toFixed(3)})`;
    if(hud.progText) hud.progText.textContent = Math.round(prog*100)+'%';

    const fv = clamp01((state.fever||0)/100);
    if(hud.feverFill) hud.feverFill.style.transform = `scaleX(${fv.toFixed(3)})`;
    if(hud.feverStatus){
      if(state.feverOn){ hud.feverStatus.textContent='FEVER!'; hud.feverStatus.classList.add('on'); }
      else if(state.fever>=80){ hud.feverStatus.textContent='BUILD'; hud.feverStatus.classList.remove('on'); }
      else { hud.feverStatus.textContent='Ready'; hud.feverStatus.classList.remove('on'); }
    }

    if(hud.phase) hud.phase.textContent = String(Math.max(1, state.bossActive ? state.bossPhase : 1));
    if(hud.boss) hud.boss.textContent = state.bossActive ? (state.bossStyle || 'BOSS') : '—';

    if(hud.bossFill){
      const r = clamp01(state.bossHp/Math.max(1,state.bossHpMax));
      hud.bossFill.style.transform = `scaleX(${r.toFixed(3)})`;
    }
    if(hud.bossStatus){
      if(state.bossActive){
        hud.bossStatus.textContent = `HP ${Math.round(state.bossHp)}/${Math.round(state.bossHpMax)}`;
        hud.bossStatus.classList.add('on');
      }else{
        hud.bossStatus.textContent = '—';
        hud.bossStatus.classList.remove('on');
      }
    }
  }

  function updateResult(reason){
    const hits = state.jumpHit + state.duckHit;
    const miss = state.jumpMiss + state.duckMiss;
    const judged = hits + miss;
    const acc = judged ? (hits/judged)*100 : 0;
    const rtMean = state.rtHits.length ? (state.rtHits.reduce((a,b)=>a+b,0)/state.rtHits.length) : null;

    if(res.mode) res.mode.textContent = state.mode[0].toUpperCase()+state.mode.slice(1);
    if(res.diff) res.diff.textContent = state.diff;
    if(res.duration) res.duration.textContent = state.durationSec + 's';

    if(res.totalObs) res.totalObs.textContent = String(state.totalObs);
    if(res.hits) res.hits.textContent = String(hits);
    if(res.miss) res.miss.textContent = String(miss);
    if(res.jumpHit) res.jumpHit.textContent = String(state.jumpHit);
    if(res.duckHit) res.duckHit.textContent = String(state.duckHit);
    if(res.jumpMiss) res.jumpMiss.textContent = String(state.jumpMiss);
    if(res.duckMiss) res.duckMiss.textContent = String(state.duckMiss);

    if(res.acc) res.acc.textContent = acc.toFixed(1)+' %';
    if(res.rtMean) res.rtMean.textContent = rtMean==null ? '-' : fmtMs(rtMean);
    if(res.stabilityMin) res.stabilityMin.textContent = state.stabilityMin.toFixed(1)+' %';
    if(res.score) res.score.textContent = String(Math.round(state.score));

    let rank='C';
    if(acc>=95 && state.stabilityMin>=70) rank='S';
    else if(acc>=88) rank='A';
    else if(acc>=75) rank='B';
    if(res.rank) res.rank.textContent = rank;

    // store last summary
    try{
      localStorage.setItem('JD_LAST_SUMMARY', JSON.stringify({
        sessionId: state.sessionId,
        mode: state.mode,
        diff: state.diff,
        durationSec: state.durationSec,
        score: Math.round(state.score),
        comboMax: state.comboMax,
        misses: state.misses,
        accPct: +acc.toFixed(2),
        rtMeanMs: rtMean==null ? null : +rtMean.toFixed(2),
        stabilityMin: +state.stabilityMin.toFixed(2),
        reason,
        boss: { enabled: state.bossEnabled, cleared: state.bossCleared, style: state.bossStyle },
        ai: state.ai
      }));
    }catch(_){}
  }

  /* =========================
   * Fever
   * ========================= */
  function feverGain(){
    state.fever = clamp(state.fever + CFG.feverHitGain, 0, 100);
    if(!state.feverOn && state.fever >= CFG.feverOnAt){
      state.feverOn = true;
      state.fever = 100;
      playSfx(sfx.fever, 0.65);
      telegraph('FEVER!', 420);
      hhaPushEvent(state, 'fever_start', { itemType:'fever', isGood:1 });
    }
  }
  function feverLoss(){
    state.fever = clamp(state.fever - CFG.feverMissLoss, 0, 100);
    if(state.feverOn && state.fever <= CFG.feverOffAt){
      state.feverOn = false;
      hhaPushEvent(state, 'fever_end', { itemType:'fever', isGood:1 });
    }
  }
  function feverDecay(dtSec){
    if(state.feverOn) return;
    state.fever = clamp(state.fever - CFG.feverDecayPerSec*dtSec, 0, 100);
  }

  /* =========================
   * Obstacle system
   * ========================= */
  function spawnObstacle(spec){
    if(!elObsHost) return null;

    const r = elPlayArea.getBoundingClientRect();
    const startX = r.width + CFG.startPadPx;

    const id = state.nextObsId++;
    const lane = (spec && spec.lane) ? spec.lane : 'low';
    const isHigh = (lane === 'high');
    const isFeint = (spec && spec.kind === 'feint');

    const el = DOC.createElement('div');
    el.className = 'jd-obstacle ' + (isHigh ? 'jd-obstacle--high' : 'jd-obstacle--low');
    if(isFeint) el.classList.add('jd-feint');

    const inner = DOC.createElement('div');
    inner.className = 'jd-obstacle-inner';

    const ico = DOC.createElement('div');
    ico.className = 'jd-obs-icon';
    ico.textContent = isHigh ? '⬇' : '⬆';

    const tag = DOC.createElement('div');
    tag.className = 'jd-obs-tag';
    tag.textContent = isHigh ? 'DUCK' : 'JUMP';

    inner.appendChild(ico);
    inner.appendChild(tag);
    el.appendChild(inner);
    elObsHost.appendChild(el);

    // speed with AI tempo
    const diffCfg = CFG.diff[state.diff] || CFG.diff.normal;
    const speed = diffCfg.speed * (state.aiTempoMul || 1) * (state.bossActive ? 1.08 : 1);

    const hx = hitLineX();
    const dist = Math.max(1, startX - hx);
    const dueMs = state.elapsedMs + (dist / Math.max(50, speed)) * 1000;

    const ob = {
      id,
      lane,
      isHigh,
      isFeint,
      x: startX,
      y: isHigh ? 96 : 208,
      speed,
      dueMs,
      spawnedAtMs: state.elapsedMs,
      el
    };

    // feint reveal: flip at 120px before hit line
    if(isFeint){
      ob.feintFlipX = hx + 120;
      ob.feintDone = false;
    }

    state.obstacles.push(ob);
    state.totalObs++;

    playSfx(sfx.beep, 0.35);

    hhaPushEvent(state, 'spawn_obstacle', {
      targetId: String(id),
      emoji: isHigh ? '⬇' : '⬆',
      itemType: 'obstacle',
      lane: lane,
      isGood: 1,
      extra: JSON.stringify({ isFeint })
    });

    return ob;
  }

  function flipFeint(ob){
    if(!ob || ob.feintDone) return;
    ob.feintDone = true;
    ob.isHigh = !ob.isHigh;
    ob.lane = ob.isHigh ? 'high' : 'low';
    ob.y = ob.isHigh ? 96 : 208;

    if(ob.el){
      ob.el.classList.toggle('jd-obstacle--high', ob.isHigh);
      ob.el.classList.toggle('jd-obstacle--low', !ob.isHigh);
      ob.el.classList.add('jd-reveal');

      const ico = ob.el.querySelector('.jd-obs-icon');
      const tag = ob.el.querySelector('.jd-obs-tag');
      if(ico) ico.textContent = ob.isHigh ? '⬇' : '⬆';
      if(tag) tag.textContent = ob.isHigh ? 'DUCK' : 'JUMP';
    }
    telegraph('FEINT!', 240);

    hhaPushEvent(state, 'feint_flip', {
      targetId: String(ob.id),
      itemType: 'obstacle',
      lane: ob.lane,
      isGood: 1
    });
  }

  function updateObstacles(dtSec){
    const hx = hitLineX();

    for(let i=state.obstacles.length-1; i>=0; i--){
      const ob = state.obstacles[i];

      // dynamic speed
      const diffCfg = CFG.diff[state.diff] || CFG.diff.normal;
      ob.speed = diffCfg.speed * (state.aiTempoMul||1) * (state.bossActive ? 1.08 : 1);

      ob.x -= ob.speed * dtSec;

      if(ob.isFeint && !ob.feintDone && ob.x <= ob.feintFlipX){
        flipFeint(ob);
      }

      if(ob.el){
        ob.el.style.left = `${ob.x}px`;
        ob.el.style.top  = `${ob.y}px`;
      }

      // timeout miss (passed window)
      if(ob.x < (hx - CFG.windowPx) && !ob.judged){
        ob.judged = true;

        state.misses++;
        state.combo = 0;
        state.stability = Math.max(0, state.stability - (state.bossActive ? CFG.stabBossMissDmg : CFG.stabMissDmg));
        state.stabilityMin = Math.min(state.stabilityMin, state.stability);

        if(ob.isHigh){ state.duckMiss++; state.recentMissType='duck'; }
        else { state.jumpMiss++; state.recentMissType='jump'; }

        feverLoss();
        playSfx(sfx.miss, 0.55);
        showJudge('MISS', 'miss');

        hhaPushEvent(state, 'miss_timeout', {
          targetId: String(ob.id),
          itemType: 'obstacle',
          lane: ob.lane,
          judgment: 'miss',
          isGood: 0,
          extra: JSON.stringify({ isFeint: ob.isFeint })
        });

        if(ob.el){ ob.el.remove(); ob.el=null; }
        state.obstacles.splice(i,1);
        continue;
      }

      // cleanup
      if(ob.x < -160){
        if(ob.el){ ob.el.remove(); ob.el=null; }
        state.obstacles.splice(i,1);
      }
    }
  }

  function judgeAction(action){
    const hx = hitLineX();

    let best=null, bestDx=9999;
    for(const ob of state.obstacles){
      if(ob.judged) continue;
      const dx = Math.abs(ob.x - hx);
      if(dx <= CFG.windowPx && dx < bestDx){
        bestDx = dx;
        best = ob;
      }
    }

    if(!best){
      // blank tap: soft feedback
      hhaPushEvent(state, 'blank_tap', { itemType:'input', lane:'', judgment:'miss', isGood:0, extra: action });
      return false;
    }

    best.judged = true;

    const need = best.isHigh ? 'duck' : 'jump';
    const rt = Math.abs((state.elapsedMs - best.dueMs) || 0); // ms abs
    const perfect = rt <= 70;
    const great = rt <= 130;

    if(action === need){
      state.clearedObs++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

      if(need==='jump') state.jumpHit++; else state.duckHit++;
      state.rtHits.push(rt);

      // score
      let gain = CFG.scoreHit;
      if(perfect) gain = CFG.scorePerfect;
      else if(great) gain = CFG.scoreGreat;

      gain = Math.round(gain * (state.feverOn ? 1.5 : 1.0));
      state.score += gain;

      // stability + fever
      state.stability = Math.min(100, state.stability + CFG.stabHitHeal);
      feverGain();

      playSfx(sfx.hit, 0.6);
      if(state.combo>0 && state.combo%10===0) playSfx(sfx.combo, 0.55);

      showJudge(perfect ? 'PERFECT!' : (great ? 'GREAT!' : 'OK!'), perfect ? 'combo' : 'ok');

      // boss chip
      if(state.bossActive){
        const dmg = perfect ? 5 : (great ? 4 : 3);
        bossDamage(dmg, 'obstacle_hit');
      }

      hhaPushEvent(state, 'hit', {
        targetId: String(best.id),
        emoji: best.isHigh ? '⬇' : '⬆',
        itemType: 'obstacle',
        lane: best.lane,
        rtMs: Math.round(rt),
        judgment: perfect ? 'perfect' : (great ? 'great' : 'good'),
        isGood: 1,
        extra: JSON.stringify({ need, action, isFeint: best.isFeint, gain })
      });

      if(best.el){ best.el.remove(); best.el=null; }
      state.obstacles = state.obstacles.filter(o => o !== best);
      return true;
    }else{
      // wrong action miss
      state.misses++;
      state.combo = 0;
      state.stability = Math.max(0, state.stability - (state.bossActive ? CFG.stabBossMissDmg : CFG.stabMissDmg));
      state.stabilityMin = Math.min(state.stabilityMin, state.stability);

      if(need==='jump'){ state.jumpMiss++; state.recentMissType='jump'; }
      else { state.duckMiss++; state.recentMissType='duck'; }

      feverLoss();
      playSfx(sfx.miss, 0.55);
      showJudge('MISS', 'miss');

      hhaPushEvent(state, 'miss_wrong', {
        targetId: String(best.id),
        emoji: best.isHigh ? '⬇' : '⬆',
        itemType: 'obstacle',
        lane: best.lane,
        rtMs: Math.round(rt),
        judgment: 'miss',
        isGood: 0,
        extra: JSON.stringify({ need, action, isFeint: best.isFeint })
      });

      if(best.el){ best.el.remove(); best.el=null; }
      state.obstacles = state.obstacles.filter(o => o !== best);
      return false;
    }
  }

  /* =========================
   * Boss system
   * ========================= */
  function bossTimeline(type, extra){
    const item = Object.assign({
      tMs: Math.round(state.elapsedMs),
      type,
      phase: state.bossPhase,
      hp: Math.round(state.bossHp)
    }, extra||{});
    state.bossTimeline.push(item);

    hhaPushEvent(state, 'boss_timeline', {
      itemType: 'boss',
      judgment: '',
      isGood: '',
      extra: JSON.stringify(item)
    });
  }

  function bossDamage(amount, reason){
    if(!state.bossActive) return;
    state.bossHp = Math.max(0, state.bossHp - (Number(amount)||0));
    if(state.bossHp <= 0){
      state.bossHp = 0;
      state.bossCleared = true;
      bossTimeline('boss_clear', { reason });
      showJudge('BOSS DOWN! 🏆', 'combo');
      telegraph('BOSS CLEAR', 520);
      // keep playing until timer end (more fun) OR end immediately:
      // endGame('boss-clear');
      // For now: end immediately to highlight win
      endGame('boss-clear');
    }
  }

  function bossEnter(){
    state.bossActive = true;
    state.bossCleared = false;
    state.bossHpMax = 100;
    state.bossHp = 100;

    // phase starts at 1 and changes by HP
    state.bossPhase = 1;

    if(hud.bossWrap) hud.bossWrap.classList.remove('jd-hidden');

    playSfx(sfx.boss, 0.65);
    telegraph('BOSS START', 520);
    showJudge('🔥 BOSS!', 'combo');

    bossTimeline('boss_start', { style: state.bossStyle });
    state.bossNextPatternPerf = performance.now() + 950;
  }

  function bossUpdatePhases(){
    if(!state.bossActive) return;
    const hpPct = state.bossHp / Math.max(1, state.bossHpMax);
    const phase = (hpPct > 0.66) ? 1 : (hpPct > 0.33) ? 2 : 3;
    if(phase !== state.bossPhase){
      state.bossPhase = phase;
      telegraph('PHASE ' + phase, 360);
      bossTimeline('boss_phase', { phase });
    }
  }

  function bossCounterOpen(){
    const expected = (state.rng.next() < 0.5) ? 'jump' : 'duck';
    state.bossCounterExpected = expected;
    state.bossCounterUntilPerf = performance.now() + (CFG.boss.counterWindowMs[state.diff] || 210);

    telegraph('COUNTER ' + expected.toUpperCase(), 360);
    showJudge('COUNTER!', 'combo');
    bossTimeline('counter_open', { expected, windowMs: CFG.boss.counterWindowMs[state.diff]||210 });

    hhaPushEvent(state, 'boss_counter_open', { itemType:'boss-counter', extra: JSON.stringify({ expected }) });
  }

  function bossCounterResolve(action){
    if(!state.bossActive) return false;
    if(!state.bossCounterExpected) return false;

    const now = performance.now();
    const within = now <= state.bossCounterUntilPerf;
    const expected = state.bossCounterExpected;

    if(within && action === expected){
      // success
      state.bossCounterExpected = '';
      state.bossCounterUntilPerf = 0;

      const gain = Math.round(CFG.scoreBossCounter * (state.feverOn ? 1.3 : 1.0));
      state.score += gain;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

      feverGain();
      bossDamage(18, 'counter_success');

      playSfx(sfx.combo, 0.6);
      showJudge('COUNTER!!', 'combo');

      bossTimeline('counter_success', { action, gain });
      hhaPushEvent(state, 'boss_counter_success', { itemType:'boss-counter', judgment:'success', isGood:1, extra: JSON.stringify({ action, expected }) });
      return true;
    }

    if(within && action !== expected){
      // wrong action
      state.bossCounterExpected = '';
      state.bossCounterUntilPerf = 0;

      state.misses++;
      state.combo = 0;
      state.stability = Math.max(0, state.stability - 10);
      state.stabilityMin = Math.min(state.stabilityMin, state.stability);
      feverLoss();

      playSfx(sfx.miss, 0.55);
      showJudge('COUNTER MISS!', 'miss');

      bossTimeline('counter_fail_wrong', { action, expected });
      hhaPushEvent(state, 'boss_counter_fail', { itemType:'boss-counter', judgment:'fail', isGood:0, extra: JSON.stringify({ action, expected }) });
      return false;
    }

    if(!within){
      // timeout
      state.bossCounterExpected = '';
      state.bossCounterUntilPerf = 0;

      state.misses++;
      state.combo = 0;
      state.stability = Math.max(0, state.stability - 10);
      state.stabilityMin = Math.min(state.stabilityMin, state.stability);
      feverLoss();

      playSfx(sfx.miss, 0.55);
      showJudge('COUNTER TIMEOUT!', 'miss');

      bossTimeline('counter_fail_timeout', { expected });
      hhaPushEvent(state, 'boss_counter_timeout', { itemType:'boss-counter', judgment:'timeout', isGood:0, extra: JSON.stringify({ expected }) });
      return false;
    }
    return false;
  }

  function bossRunPattern(pattern){
    if(!pattern || !Array.isArray(pattern.seq)) return;

    // Pattern tempo "feel" (affects AI tempo for short burst)
    state.aiTempoMul = clamp(state.aiTempoMul * (pattern.tempoMul || 1), 0.78, 1.35);
    setTimeout(()=>{ if(state.running) state.aiTempoMul = 1.0 + (state.aiLevel||0)*0.05; }, 1200);

    bossTimeline('pattern', { id: pattern.id, label: pattern.label });

    const diff = state.diff;
    const baseGapMs = (diff==='easy') ? 760 : (diff==='hard' ? 560 : 650);
    const gapMs = Math.max(260, Math.round(baseGapMs / (pattern.tempoMul || 1)));
    const startDelay = 260;

    telegraph(pattern.label.toUpperCase(), 320);

    for(let i=0;i<pattern.seq.length;i++){
      const tk = pattern.seq[i];
      setTimeout(()=>{
        if(!state.running || !state.bossActive) return;

        if(tk==='R'){
          // rest
          return;
        }
        if(tk==='X'){
          // feint token -> spawn feint obstacle
          spawnObstacle({ kind:'feint', lane: state.rng.next()<0.5?'high':'low' });
          return;
        }

        // J/D spawn boss obstacle (same obstacle system)
        spawnObstacle({ kind:'boss', lane: (tk==='J')?'low':'high' });
      }, startDelay + i*gapMs);
    }
  }

  function bossTick(nowPerf){
    if(!state.bossEnabled) return;

    // enter boss at scheduled time (by elapsedMs)
    if(!state.bossActive && !state.tutorial){
      const pct = CFG.boss.spawnAtPctByMode[state.mode] ?? 0.60;
      if(state.elapsedMs >= state.durationSec*1000*pct){
        bossEnter();
      }
    }
    if(!state.bossActive) return;

    // phase update by HP
    bossUpdatePhases();

    // counter timeout
    if(state.bossCounterExpected && nowPerf > state.bossCounterUntilPerf){
      bossCounterResolve(''); // triggers timeout handling
    }

    // schedule pattern
    if(nowPerf >= state.bossNextPatternPerf){
      const picked = pickBossPattern(state);
      if(picked) bossRunPattern(picked);

      // sometimes open counter in phase2/3
      if(state.bossPhase >= 2 && state.rng.next() < 0.28){
        bossCounterOpen();
      }

      // next schedule depends on phase
      const nextGap = state.bossPhase===1 ? 2400 : (state.bossPhase===2 ? 2100 : 1800);
      state.bossNextPatternPerf = nowPerf + nextGap + (state.rng.next()*260 - 120);
    }
  }

  /* =========================
   * Spawning main loop
   * ========================= */
  function spawnFromGenerator(){
    if(!JD_PATTERN_HOOKS.enabled) return;
    const spec = JD_PATTERN_HOOKS.nextObstacle(state);
    if(!spec) return;
    spawnObstacle(spec);
  }

  /* =========================
   * Input mapping
   * ========================= */
  function performAction(type){
    if(!state.running || state.ended) return;

    const nowPerf = performance.now();

    // counter has priority during boss
    if(state.bossActive && state.bossCounterExpected){
      const consumed = bossCounterResolve(type);
      if(consumed) return;
    }

    // record
    state.lastAction = { type, tPerf: nowPerf };

    // judge obstacle
    judgeAction(type);

    // log input
    hhaPushEvent(state, 'input', { itemType:'input', lane:'', isGood:'', extra: type });
  }

  function onKeyDown(ev){
    if(!state.running) return;
    const code = ev.code || '';
    if(code==='ArrowUp' || code==='KeyW'){ ev.preventDefault(); performAction('jump'); }
    else if(code==='ArrowDown' || code==='KeyS'){ ev.preventDefault(); performAction('duck'); }
    else if(code==='Escape'){ ev.preventDefault(); endGame('escape'); }
  }

  function onPointerDown(ev){
    if(!state.running) return;
    if(!elPlayArea) return;
    const rect = elPlayArea.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    const action = (y < rect.height/2) ? 'jump' : 'duck';
    performAction(action);
  }

  // Universal VR UI shoot event
  function onHhaShoot(ev){
    if(!state.running) return;
    const d = ev && ev.detail ? ev.detail : {};
    let action = '';
    if(d.action==='jump' || d.action==='duck') action = d.action;
    else {
      const y01 = Number(d.aimYNormalized);
      if(Number.isFinite(y01)) action = (y01 < 0.5) ? 'jump' : 'duck';
      else action = 'jump';
    }
    performAction(action);
    hhaPushEvent(state, 'vr_shoot_action', { itemType:'input', extra: JSON.stringify(d) });
  }

  /* =========================
   * Game loop
   * ========================= */
  function tick(){
    if(!state.running || state.ended) return;

    const nowPerf = performance.now();
    const dt = Math.max(0, Math.min(50, nowPerf - state.lastPerf));
    state.lastPerf = nowPerf;

    state.elapsedMs = nowPerf - state.startPerf;

    // time end
    if(state.elapsedMs >= state.durationSec*1000){
      endGame('time-up');
      return;
    }

    // dt sec
    const dtSec = dt/1000;

    // fever decay
    feverDecay(dtSec);

    // AI update
    aiDirectorTick(state, nowPerf);
    aiCoachTick(state);

    state.ai.level = JD_AI.level;
    state.ai.fatigueRisk = JD_AI.fatigueRisk;
    state.ai.skillScore = JD_AI.skillScore;
    state.ai.suggested = JD_AI.suggested;
    state.ai.reason = JD_AI.reason;
    state.ai.locked = JD_AI.locked;

    // boss tick (also uses RNG)
    bossTick(nowPerf);

    // spawn schedule (base + AI tempo)
    const diffCfg = CFG.diff[state.diff] || CFG.diff.normal;

    // spawn interval: smaller => more frequent
    let intervalMs = diffCfg.spawnEveryMs;

    // fever makes slightly more intense
    if(state.feverOn) intervalMs *= 0.92;

    // boss makes more intense
    if(state.bossActive) intervalMs *= 0.92;

    // AI tempo affects spawns (adaptive only changes aiTempoMul)
    intervalMs /= clamp(state.aiTempoMul, 0.82, 1.18);

    if(nowPerf >= state.nextSpawnPerf){
      spawnFromGenerator();

      // spacing: schedule next with jitter (seeded)
      const jitter = (state.rng.next()*160 - 80);
      state.nextSpawnPerf = nowPerf + Math.max(320, intervalMs + jitter);
    }

    // update/move obstacles
    updateObstacles(dtSec);

    // update HUD
    updateHud();

    // fail state stability
    if(state.stability <= 0){
      endGame('stability-zero');
      return;
    }

    requestAnimationFrame(tick);
  }

  /* =========================
   * Start / End
   * ========================= */
  function startGame(opts){
    opts = opts || {};
    resetForRun();

    state.tutorial = !!opts.tutorial;

    state.mode = String(elMode?.value || qs('mode','training')).toLowerCase();
    if(!['training','test','research'].includes(state.mode)) state.mode='training';

    state.diff = String(elDiff?.value || qs('diff','normal')).toLowerCase();
    if(!['easy','normal','hard'].includes(state.diff)) state.diff='normal';

    const dur = parseInt(String(elDuration?.value || qs('duration', qs('time','60'))), 10);
    state.durationSec = state.tutorial ? 15 : clamp(dur || 60, 15, 180);

    state.participant = String(elPid?.value || qs('studentKey', qs('pid','')) || '').trim() || '';
    state.group = String(elGroup?.value || qs('group','') || '').trim();
    state.note = String(elNote?.value || qs('note','') || '').trim();

    // seed resolved
    const seedQ = qs('seed', String(Date.now()));
    const pid = (state.participant || HHA.pid || 'anon');
    const phase = HHA.phase || '';
    const cond = HHA.conditionGroup || qs('cond','');
    const mode = state.mode;
    state.seedResolved = `JD|${seedQ}|${pid}|${phase}|${cond}|${mode}|${state.diff}`;
    state.rng = createRng(state.seedResolved);

    state.sessionId = `JD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
    state.startPerf = performance.now();
    state.lastPerf = state.startPerf;
    state.startIso = nowIso();
    state.running = true;
    state.ended = false;

    // boss enabled by mode (tutorial disables)
    state.bossEnabled = !state.tutorial && !!CFG.boss.enabledByMode[state.mode];
    state.bossStyle = (qs('boss','mixed') || 'mixed').toLowerCase();

    // AI defaults
    state.aiLevel = 0;
    state.aiTempoMul = 1.0;
    state.aiFeintRate = (CFG.diff[state.diff]||CFG.diff.normal).feintBase;

    // pre-spawn gap
    state.nextSpawnPerf = state.startPerf + 650;

    updateHud();
    switchView('play');
    showJudge(state.tutorial ? 'TUTORIAL' : 'READY ✨', 'ok');

    hhaPushEvent(state, 'start', {
      itemType:'session',
      extra: JSON.stringify({
        tutorial: state.tutorial,
        seedResolved: state.seedResolved,
        bossEnabled: state.bossEnabled
      })
    });

    // best-effort profile upsert if ?log=
    (async ()=>{
      try{ await upsertProfileIfAny(state, false); }catch(_){}
    })();

    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(state.ended) return;
    state.running = false;
    state.ended = true;

    hhaPushEvent(state, 'end', { itemType:'session', extra: String(reason||'') });

    updateResult(reason);
    switchView('result');

    // post logs (best effort)
    (async ()=>{
      try{
        await hhaFlushEvents(state, 'endGame');
        await hhaPostSessionSummary(state, reason);
      }catch(_){}
    })();
  }

  /* =========================
   * Wiring UI actions
   * ========================= */
  function bindUI(){
    // mode change -> show research fields
    elMode?.addEventListener('change', updateResearchVisibility);
    updateResearchVisibility();

    // pointer play area
    elPlayArea?.addEventListener('pointerdown', onPointerDown, {passive:true});
    DOC.addEventListener('keydown', onKeyDown, {passive:false});

    // action buttons & menu buttons
    DOC.addEventListener('click', (ev)=>{
      const btn = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
      if(!btn) return;
      const act = btn.getAttribute('data-action');

      if(act==='start') startGame({tutorial:false});
      else if(act==='tutorial') startGame({tutorial:true});
      else if(act==='stop-early') endGame('stop-early');
      else if(act==='play-again') startGame({tutorial:false});
      else if(act==='back-menu'){ endGame('back-menu'); switchView('menu'); }
      else if(act==='jump') performAction('jump');
      else if(act==='duck') performAction('duck');
      else if(act==='download-events-csv') downloadCsv(state, 'events');
      else if(act==='download-sessions-csv') downloadCsv(state, 'sessions');
      else if(act==='download-boss-timeline') dlText(`jumpduck-boss-timeline-${Date.now()}.json`, JSON.stringify(state.bossTimeline||[], null, 2), 'application/json');
    });

    // VR shoot hook
    WIN.addEventListener('hha:shoot', onHhaShoot, {passive:true});

    // flush on pagehide best effort
    WIN.addEventListener('pagehide', ()=>{
      try{
        hhaPushEvent(state, 'pagehide', { itemType:'session', extra:'pagehide' });
        hhaFlushEvents(state, 'pagehide');
      }catch(_){}
    });
  }

  function init(){
    applyViewClass();
    setHubLinks();

    // prefill menu from query
    const qm = (qs('mode', qs('runMode','')) || '').toLowerCase();
    if(qm && elMode && ['training','test','research'].includes(qm)) elMode.value = qm;

    const qd = (qs('diff','') || '').toLowerCase();
    if(qd && elDiff && ['easy','normal','hard'].includes(qd)) elDiff.value = qd;

    const qt = (qs('duration', qs('time','')) || '').trim();
    if(qt && elDuration && ['45','60','90'].includes(qt)) elDuration.value = qt;

    // prefill research fields from query
    if(elPid && qs('studentKey','')) elPid.value = qs('studentKey','');
    else if(elPid && qs('pid','')) elPid.value = qs('pid','');
    if(elGroup && qs('group','')) elGroup.value = qs('group','');
    if(elNote && qs('note','')) elNote.value = qs('note','');

    updateResearchVisibility();
    switchView('menu');
    bindUI();

    // Export debug helpers
    WIN.JD_DEBUG = WIN.JD_DEBUG || {};
    WIN.JD_DEBUG.downloadEventsCsv = ()=> downloadCsv(state, 'events');
    WIN.JD_DEBUG.downloadSessionsCsv = ()=> downloadCsv(state, 'sessions');
    WIN.JD_DEBUG.getBossTimeline = ()=> (state.bossTimeline||[]);
    WIN.JD_DEBUG.resetProfileSentFlag = ()=>{
      try{ localStorage.removeItem(profileCacheKey(state)); return true; }catch(_){ return false; }
    };
  }

  init();
})();