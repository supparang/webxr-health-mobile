// === /herohealth/vr-goodjunk/GameEngine.js ===
// PATCH(PROD): Session/Event logging schema + warmup+auto hard/hard_alt + lock
// - dispatch:
//   - hha:log_session (detail = session row ตาม schema sessions)
//   - hha:log_event   (detail = event row ตาม schema events)
// - goalProgress/miniProgress ผูกลงทุก event

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  // -------------------------------------------------------
  // helpers
  // -------------------------------------------------------
  function isoNow() { return new Date().toISOString(); }
  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function clamp01(x){ x=Number(x)||0; return x<0?0:(x>1?1:x); }
  function median(arr){
    if (!Array.isArray(arr) || !arr.length) return null;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length%2) ? a[m] : Math.round((a[m-1]+a[m])/2);
  }
  function avg(arr){
    if (!Array.isArray(arr) || !arr.length) return null;
    let s=0; for (const x of arr) s += (Number(x)||0);
    return Math.round(s / arr.length);
  }
  function dispatch(name, detail){
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  }

  // -------------------------------------------------------
  // QUEST SETS (ตามที่คุณล็อก)
  // -------------------------------------------------------
  const QUEST_SET = {
    hard:     { goals:['G02','G05'], minis:['M01','M16'] },
    hard_alt: { goals:['G10','G11'], minis:['M11','M15'] }
  };

  // warmup criteria (คุณปรับ threshold ได้)
  function pickSetFromWarmup(w){
    // w = { medianRtGoodMs, junkErrorPct, accuracyGoodPct, fastHitRatePct }
    const rt = Number(w.medianRtGoodMs || 99999);
    const junkErr = Number(w.junkErrorPct || 999);
    const acc = Number(w.accuracyGoodPct || 0);
    const fast = Number(w.fastHitRatePct || 0);

    // เกณฑ์ "เก่ง" → hard, ไม่งั้น hard_alt
    if (acc >= 70 && junkErr <= 25 && rt <= 750) return 'hard';
    if (acc >= 65 && junkErr <= 30 && rt <= 680 && fast >= 20) return 'hard';
    return 'hard_alt';
  }

  // -------------------------------------------------------
  // SESSION META: เติมให้ครบตาม schema จาก hub/opts
  // -------------------------------------------------------
  const META = {
    // จะ set ตอน start()
    timestampIso: '',
    projectTag: 'HeroHealth-GoodJunkVR',
    runMode: 'play',
    studyId: '',
    phase: '',
    conditionGroup: '',        // <- เราจะใส่ hard/hard_alt ที่ lock แล้ว
    sessionOrder: '',
    blockLabel: '',
    siteCode: '',
    schoolYear: '',
    semester: '',
    sessionId: '',
    gameMode: 'goodjunk',
    diff: 'normal',
    durationPlannedSec: 60,
    device: '',
    gameVersion: '',
    reason: '',
    startTimeIso: '',
    endTimeIso: '',

    // profile keys (ถ้ามาจาก hub)
    studentKey: '',
    schoolCode: '',
    schoolName: '',
    classRoom: '',
    studentNo: '',
    nickName: '',
    gender: '',
    age: '',
    gradeLevel: '',
    heightCm: '',
    weightKg: '',
    bmi: '',
    bmiGroup: '',
    vrExperience: '',
    gameFrequency: '',
    handedness: '',
    visionIssue: '',
    healthDetail: '',
    consentParent: '',
    consentTeacher: '',
    profileSource: '',
    surveyKey: '',
    excludeFlag: '',
    noteResearcher: ''
  };

  function readMetaFromOpts(opts={}){
    // ดึงค่าจาก hub ส่งมาให้ครบ (ถ้ามี)
    const m = opts.meta || opts || {};
    // NOTE: ถ้าบางตัวไม่มี ก็ปล่อยเป็น '' ได้
    META.projectTag = m.projectTag || META.projectTag;
    META.runMode = (m.runMode === 'research') ? 'research' : 'play';
    META.studyId = m.studyId || '';
    META.phase = m.phase || '';
    META.sessionOrder = m.sessionOrder || '';
    META.blockLabel = m.blockLabel || '';
    META.siteCode = m.siteCode || '';
    META.schoolYear = m.schoolYear || '';
    META.semester = m.semester || '';
    META.sessionId = m.sessionId || (m.sessionIdFromHub || '');
    META.gameMode = m.gameMode || 'goodjunk';
    META.diff = m.diff || META.diff;
    META.durationPlannedSec = Number(m.durationPlannedSec ?? m.durationSec ?? 60) || 60;
    META.device = m.device || '';
    META.gameVersion = m.gameVersion || '';
    META.reason = m.reason || '';

    META.studentKey = m.studentKey || '';
    META.schoolCode = m.schoolCode || '';
    META.schoolName = m.schoolName || '';
    META.classRoom = m.classRoom || '';
    META.studentNo = m.studentNo || '';
    META.nickName = m.nickName || '';
    META.gender = m.gender || '';
    META.age = m.age || '';
    META.gradeLevel = m.gradeLevel || m.grade || '';
    META.heightCm = m.heightCm || '';
    META.weightKg = m.weightKg || '';
    META.bmi = m.bmi || '';
    META.bmiGroup = m.bmiGroup || '';
    META.vrExperience = m.vrExperience || '';
    META.gameFrequency = m.gameFrequency || '';
    META.handedness = m.handedness || '';
    META.visionIssue = m.visionIssue || '';
    META.healthDetail = m.healthDetail || '';
    META.consentParent = m.consentParent || '';
    META.consentTeacher = m.consentTeacher || '';
    META.profileSource = m.profileSource || '';
    META.surveyKey = m.surveyKey || '';
    META.excludeFlag = m.excludeFlag || '';
    META.noteResearcher = m.noteResearcher || '';
  }

  // -------------------------------------------------------
  // METRICS: ตาม schema sessions + events
  // -------------------------------------------------------
  const MET = {
    // session time
    startMs: 0,
    startTimeIso: '',
    endTimeIso: '',
    durationPlayedSec: 0,

    // score gameplay
    scoreFinal: 0,
    comboMax: 0,
    misses: 0,

    // quest summary
    goalsCleared: 0,
    goalsTotal: 0,
    miniCleared: 0,
    miniTotal: 0,

    // spawn counts
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,     // map: gold
    nTargetDiamondSpawned: 0,  // map: fake (หรือคุณอยาก map boss ก็ได้)
    nTargetShieldSpawned: 0,   // power shield

    // hit counts
    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,          // shield block junk/fake
    nExpireGood: 0,            // good/gold expire

    // rt samples
    rtGoodList: [],
    fastHitCount: 0,

    // derived
    accuracyGoodPct: 0,
    junkErrorPct: 0,
    avgRtGoodMs: null,
    medianRtGoodMs: null,
    fastHitRatePct: 0,

    // fever
    feverState: '',
    feverValue: null,

    // quest progress attach (ลงใน events)
    goalProgress: null,
    miniProgress: null,

    reset(){
      this.startMs = 0;
      this.startTimeIso = '';
      this.endTimeIso = '';
      this.durationPlayedSec = 0;
      this.scoreFinal = 0;
      this.comboMax = 0;
      this.misses = 0;

      this.goalsCleared = 0;
      this.goalsTotal = 0;
      this.miniCleared = 0;
      this.miniTotal = 0;

      this.nTargetGoodSpawned = 0;
      this.nTargetJunkSpawned = 0;
      this.nTargetStarSpawned = 0;
      this.nTargetDiamondSpawned = 0;
      this.nTargetShieldSpawned = 0;

      this.nHitGood = 0;
      this.nHitJunk = 0;
      this.nHitJunkGuard = 0;
      this.nExpireGood = 0;

      this.rtGoodList = [];
      this.fastHitCount = 0;

      this.accuracyGoodPct = 0;
      this.junkErrorPct = 0;
      this.avgRtGoodMs = null;
      this.medianRtGoodMs = null;
      this.fastHitRatePct = 0;

      this.feverState = '';
      this.feverValue = null;

      this.goalProgress = null;
      this.miniProgress = null;
    },

    computeDerived(){
      // accuracyGoodPct = hitGood / goodSpawned
      const gSpawn = Math.max(0, this.nTargetGoodSpawned|0);
      const gHit = Math.max(0, this.nHitGood|0);
      this.accuracyGoodPct = gSpawn ? Math.round(100 * (gHit / gSpawn)) : 0;

      // junkErrorPct = hitJunk / (hitGood+hitJunk+hitGuard?)  (ปรับได้)
      const denom = Math.max(1, (this.nHitGood|0) + (this.nHitJunk|0) + (this.nHitJunkGuard|0));
      this.junkErrorPct = Math.round(100 * ((this.nHitJunk|0) / denom));

      this.avgRtGoodMs = avg(this.rtGoodList);
      this.medianRtGoodMs = median(this.rtGoodList);

      // fastHitRatePct: สัดส่วน goodHit ที่ rt <= 450ms (ปรับได้)
      const fastDen = Math.max(1, this.rtGoodList.length);
      this.fastHitRatePct = Math.round(100 * (this.fastHitCount / fastDen));
    }
  };

  // -------------------------------------------------------
  // QUEST RUNTIME: (ใช้ชุดจาก hard/hard_alt)
  // NOTE: คุณมี GOAL_POOL/MINI_POOL อยู่แล้วในไฟล์เดิม
  // ที่นี่ผมทำ "ตัวเลือกชุด" ให้ lock จริง
  // -------------------------------------------------------
  let lockedQuestSetKey = ''; // 'hard'|'hard_alt'
  let warmupDone = false;

  // คุณมี QUEST.activeGoals/activeMinis/doneGoals/doneMinis ในไฟล์เดิม
  // ให้เพิ่ม function นี้ แล้วตอน buildActiveQuests ให้ใช้มัน
  function pickFixedSetByLock(){
    if (lockedQuestSetKey === 'hard') return QUEST_SET.hard;
    if (lockedQuestSetKey === 'hard_alt') return QUEST_SET.hard_alt;
    // fallback
    return QUEST_SET.hard;
  }

  // -------------------------------------------------------
  // EVENT LOGGER: emit rows ตรง schema events
  // -------------------------------------------------------
  function emitEventRow(row){
    dispatch('hha:log_event', row);
  }

  function baseEventRow(){
    return {
      timestampIso: isoNow(),
      projectTag: META.projectTag,
      runMode: META.runMode,
      studyId: META.studyId,
      phase: META.phase,
      conditionGroup: META.conditionGroup, // hard/hard_alt ที่ lock แล้ว
      sessionId: META.sessionId,

      eventType: '',

      gameMode: META.gameMode,
      diff: META.diff,
      timeFromStartMs: null,

      targetId: '',
      emoji: '',
      itemType: '',
      lane: '',
      rtMs: null,
      judgment: '',
      totalScore: null,
      combo: null,
      isGood: '',

      feverState: MET.feverState || '',
      feverValue: MET.feverValue,

      goalProgress: MET.goalProgress,
      miniProgress: MET.miniProgress,

      extra: '',

      studentKey: META.studentKey,
      schoolCode: META.schoolCode,
      classRoom: META.classRoom,
      studentNo: META.studentNo,
      nickName: META.nickName
    };
  }

  function logSpawn(t){
    const r = baseEventRow();
    r.eventType = 'spawn';
    r.timeFromStartMs = (t && t.born) ? Math.max(0, Math.round(t.born - MET.startMs)) : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = t && t.lane!=null ? String(t.lane) : '';
    r.extra = JSON.stringify({ lockedQuestSetKey });
    emitEventRow(r);
  }

  function logExpire(t){
    const r = baseEventRow();
    r.eventType = 'expire';
    r.timeFromStartMs = (typeof performance !== 'undefined' && performance.now)
      ? Math.max(0, Math.round(performance.now() - MET.startMs))
      : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = t && t.lane!=null ? String(t.lane) : '';
    r.judgment = (t && (t.type==='good' || t.type==='gold')) ? 'MISS_EXPIRE' : 'EXPIRE';
    r.totalScore = MET.scoreFinal;
    r.combo = null;
    emitEventRow(r);
  }

  function logHit(t, judgment, rtMs, totalScore, combo, isGood){
    const r = baseEventRow();
    r.eventType = 'hit';
    r.timeFromStartMs = (typeof performance !== 'undefined' && performance.now)
      ? Math.max(0, Math.round(performance.now() - MET.startMs))
      : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = t ? String(t.type === 'power' ? (t.power||'power') : (t.type||'')) : '';
    r.lane = t && t.lane!=null ? String(t.lane) : '';
    r.rtMs = (typeof rtMs === 'number') ? Math.max(0, Math.round(rtMs)) : null;
    r.judgment = judgment || '';
    r.totalScore = (typeof totalScore === 'number') ? totalScore : null;
    r.combo = (typeof combo === 'number') ? combo : null;
    r.isGood = isGood ? '1' : '0';
    emitEventRow(r);
  }

  function logBlock(t, why){
    const r = baseEventRow();
    r.eventType = 'block';
    r.timeFromStartMs = (typeof performance !== 'undefined' && performance.now)
      ? Math.max(0, Math.round(performance.now() - MET.startMs))
      : null;
    r.targetId = t ? String(t.id||'') : '';
    r.emoji = t ? String(t.emoji||'') : '';
    r.itemType = String(why || (t && t.type) || 'junk');
    r.lane = t && t.lane!=null ? String(t.lane) : '';
    r.judgment = 'BLOCK';
    emitEventRow(r);
  }

  // -------------------------------------------------------
  // SESSION LOGGER: emit row ตรง schema sessions
  // -------------------------------------------------------
  function emitSessionRow(reason){
    MET.computeDerived();

    const row = {
      timestampIso: isoNow(),
      projectTag: META.projectTag,
      runMode: META.runMode,
      studyId: META.studyId,
      phase: META.phase,
      conditionGroup: META.conditionGroup,
      sessionOrder: META.sessionOrder,
      blockLabel: META.blockLabel,
      siteCode: META.siteCode,
      schoolYear: META.schoolYear,
      semester: META.semester,
      sessionId: META.sessionId,

      gameMode: META.gameMode,
      diff: META.diff,
      durationPlannedSec: META.durationPlannedSec,
      durationPlayedSec: MET.durationPlayedSec,

      scoreFinal: MET.scoreFinal,
      comboMax: MET.comboMax,
      misses: MET.misses,

      goalsCleared: MET.goalsCleared,
      goalsTotal: MET.goalsTotal,
      miniCleared: MET.miniCleared,
      miniTotal: MET.miniTotal,

      nTargetGoodSpawned: MET.nTargetGoodSpawned,
      nTargetJunkSpawned: MET.nTargetJunkSpawned,
      nTargetStarSpawned: MET.nTargetStarSpawned,
      nTargetDiamondSpawned: MET.nTargetDiamondSpawned,
      nTargetShieldSpawned: MET.nTargetShieldSpawned,

      nHitGood: MET.nHitGood,
      nHitJunk: MET.nHitJunk,
      nHitJunkGuard: MET.nHitJunkGuard,
      nExpireGood: MET.nExpireGood,

      accuracyGoodPct: MET.accuracyGoodPct,
      junkErrorPct: MET.junkErrorPct,
      avgRtGoodMs: MET.avgRtGoodMs,
      medianRtGoodMs: MET.medianRtGoodMs,
      fastHitRatePct: MET.fastHitRatePct,

      device: META.device,
      gameVersion: META.gameVersion,
      reason: reason || META.reason || '',

      startTimeIso: META.startTimeIso,
      endTimeIso: META.endTimeIso,

      studentKey: META.studentKey,
      schoolCode: META.schoolCode,
      schoolName: META.schoolName,
      classRoom: META.classRoom,
      studentNo: META.studentNo,
      nickName: META.nickName,
      gender: META.gender,
      age: META.age,
      gradeLevel: META.gradeLevel,
      heightCm: META.heightCm,
      weightKg: META.weightKg,
      bmi: META.bmi,
      bmiGroup: META.bmiGroup,
      vrExperience: META.vrExperience,
      gameFrequency: META.gameFrequency,
      handedness: META.handedness,
      visionIssue: META.visionIssue,
      healthDetail: META.healthDetail,
      consentParent: META.consentParent,
      consentTeacher: META.consentTeacher,
      profileSource: META.profileSource,
      surveyKey: META.surveyKey,
      excludeFlag: META.excludeFlag,
      noteResearcher: META.noteResearcher
    };

    dispatch('hha:log_session', row);
  }

  // -------------------------------------------------------
  // IMPORTANT: คุณต้อง “ผูก” กับ logic เดิมของคุณดังนี้:
  // - ทุกครั้งที่ spawn -> เรียก logSpawn(t) + เพิ่ม counters
  // - hit -> เรียก logHit(...) + เพิ่ม counters
  // - expire good -> เพิ่ม nExpireGood
  // - block -> logBlock + เพิ่ม nHitJunkGuard
  // - quest:update -> set MET.goalProgress / MET.miniProgress
  // -------------------------------------------------------

  // 1) ฟัง quest:update (จาก HUD/quest system) เพื่อแปะ progress ลง events
  ROOT.addEventListener('quest:update', (e)=>{
    const d = (e && e.detail) ? e.detail : null;
    // เก็บแบบย่อให้ลงชีตได้ (เป็น JSON สั้น ๆ)
    if (d && d.goal){
      MET.goalProgress = JSON.stringify({
        title: d.goal.title || '',
        cur: d.goal.cur ?? d.goal.cur ?? d.goal?.cur,
        max: d.goal.max ?? d.goal.total ?? d.goal?.total,
        pct: d.goal.pct ?? d.goal.prog ?? null,
        state: d.goal.state || ''
      });
    }
    if (d && d.mini){
      MET.miniProgress = JSON.stringify({
        title: d.mini.title || '',
        cur: d.mini.cur ?? d.mini.cur ?? d.mini?.cur,
        max: d.mini.max ?? d.mini.total ?? d.mini?.total,
        pct: d.mini.pct ?? d.mini.prog ?? null,
        state: d.mini.state || ''
      });
    }
  });

  // -------------------------------------------------------
  // ★★★ ตรงนี้คือจุด “ที่คุณต้องต่อเข้ากับโค้ดเดิมของคุณ”
  // ให้คุณทำตาม pattern นี้ใน createTarget / expireTarget / hitTarget / block
  // -------------------------------------------------------

  // ตัวอย่าง: ถ้าคุณมี createTarget(spec) เดิมอยู่
  // หลังสร้าง t แล้ว ให้ใส่:
  //
  //   // counters spawn
  //   if (t.type==='good') MET.nTargetGoodSpawned++;
  //   if (t.type==='junk') MET.nTargetJunkSpawned++;
  //   if (t.type==='gold') MET.nTargetStarSpawned++;         // star = gold
  //   if (t.type==='fake') MET.nTargetDiamondSpawned++;      // diamond = fake
  //   if (t.type==='power' && t.power==='shield') MET.nTargetShieldSpawned++;
  //   logSpawn(t);

  // ตัวอย่าง: expireTarget(t)
  //   if ((t.type==='good' || t.type==='gold') && t.seen) MET.nExpireGood++;
  //   logExpire(t);

  // ตัวอย่าง: hitTarget good/gold
  //   MET.nHitGood++;
  //   if (rtMs!=null){ MET.rtGoodList.push(rtMs); if (rtMs<=450) MET.fastHitCount++; }
  //   logHit(t, judgment, rtMs, score, combo, true);

  // ตัวอย่าง: hitTarget junk/fake
  //   MET.nHitJunk++;
  //   logHit(t,'HIT_JUNK',rtMs,score,combo,false);

  // ตัวอย่าง: shield block
  //   MET.nHitJunkGuard++;
  //   logBlock(t,'junk');

  // -------------------------------------------------------
  // WARMUP + LOCK (จริง)
  // -------------------------------------------------------
  let warmupTimer = null;

  function beginWarmupThenLock(opts, onLocked){
    const warmupSec = clamp(opts.warmupSec ?? 15, 5, 30);

    // ระหว่าง warmup: ยังไม่ lock quest set
    warmupDone = false;
    lockedQuestSetKey = '';

    // reset metrics เฉพาะที่ใช้ตัดสิน warmup
    MET.rtGoodList = [];
    MET.fastHitCount = 0;
    MET.nTargetGoodSpawned = 0;
    MET.nHitGood = 0;
    MET.nHitJunk = 0;
    MET.nHitJunkGuard = 0;

    // แสดง HUD แจ้ง
    dispatch('hha:judge', { label: `WARMUP ${warmupSec}s` });

    // จับเวลา
    if (warmupTimer) clearTimeout(warmupTimer);
    warmupTimer = setTimeout(()=>{
      // สรุป warmup
      const w = {
        accuracyGoodPct: (MET.nTargetGoodSpawned ? Math.round(100*(MET.nHitGood/MET.nTargetGoodSpawned)) : 0),
        junkErrorPct: (Math.max(1, MET.nHitGood + MET.nHitJunk + MET.nHitJunkGuard)
          ? Math.round(100*(MET.nHitJunk/Math.max(1, MET.nHitGood + MET.nHitJunk + MET.nHitJunkGuard)))
          : 0),
        medianRtGoodMs: median(MET.rtGoodList) || null,
        fastHitRatePct: (MET.rtGoodList.length ? Math.round(100*(MET.fastHitCount/MET.rtGoodList.length)) : 0)
      };

      lockedQuestSetKey = pickSetFromWarmup(w);
      warmupDone = true;

      // lock to META.conditionGroup
      META.conditionGroup = lockedQuestSetKey;

      dispatch('hha:judge', { label: `LOCK: ${lockedQuestSetKey.toUpperCase()}` });
      onLocked && onLocked(w, lockedQuestSetKey);
    }, warmupSec * 1000);
  }

  // -------------------------------------------------------
  // PUBLIC API (start/stop): คุณเอา logic เดิมมาใส่ต่อได้
  // ผมทำ "โครง" ให้พร้อม emit sessions/events แล้ว
  // -------------------------------------------------------
  let running = false;
  let score = 0, combo = 0, comboMax = 0, misses = 0;

  function start(diff, opts={}){
    if (running) return;
    running = true;

    readMetaFromOpts(opts);

    META.diff = String(diff || META.diff || 'normal').toLowerCase();
    META.runMode = (opts.runMode === 'research') ? 'research' : 'play';

    // session time
    META.startTimeIso = isoNow();
    META.timestampIso = META.startTimeIso;
    MET.reset();
    MET.startMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    MET.startTimeIso = META.startTimeIso;

    // reset gameplay state (ของเดิมคุณ)
    score = 0; combo = 0; comboMax = 0; misses = 0;

    // ---------------------------------------------------
    // 1) Warmup + auto pick set + lock
    //    - research: ไม่ทำ warmup (fix ตาม opts.conditionGroup หรือ opts.forceSet)
    // ---------------------------------------------------
    const forceSet = String(opts.forceSet || '').toLowerCase(); // 'hard'|'hard_alt'
    if (META.runMode === 'research'){
      lockedQuestSetKey = (forceSet === 'hard_alt') ? 'hard_alt' : 'hard';
      META.conditionGroup = lockedQuestSetKey;
      warmupDone = true;

      // TODO: call your initQuestRun() with fixed set
      // buildActiveQuestsFromLock();
      // emitQuestUpdate();

      dispatch('hha:judge', { label: `RESEARCH FIX: ${lockedQuestSetKey.toUpperCase()}` });

    } else {
      // play mode: warmup + lock
      beginWarmupThenLock(opts, (warmupSummary, setKey)=>{
        // TODO: เมื่อ lock แล้ว -> initQuestRun ด้วยชุดนี้จริง
        // buildActiveQuestsFromLock();
        // emitQuestUpdate();
      });
    }

    // start loops of your engine here...
    dispatch('hha:mode', { diff: META.diff, runMode: META.runMode, conditionGroup: META.conditionGroup });

    console.log('[GoodJunkVR] start', { diff: META.diff, runMode: META.runMode, sessionId: META.sessionId });
  }

  function stop(reason='stop'){
    if (!running) return;
    running = false;

    if (warmupTimer) clearTimeout(warmupTimer);
    warmupTimer = null;

    META.endTimeIso = isoNow();
    MET.endTimeIso = META.endTimeIso;

    // durationPlayedSec
    const startT = new Date(META.startTimeIso).getTime();
    const endT = new Date(META.endTimeIso).getTime();
    MET.durationPlayedSec = (isFinite(startT) && isFinite(endT) && endT>startT) ? Math.round((endT-startT)/1000) : 0;

    // finalize gameplay state
    MET.scoreFinal = score|0;
    MET.comboMax = comboMax|0;
    MET.misses = misses|0;

    // quest summary: ให้คุณ set จากระบบ quest ของคุณ (ตัวอย่าง)
    // MET.goalsCleared = qs.goalsCleared; MET.goalsTotal = qs.goalsTotal;
    // MET.miniCleared  = qs.miniCleared;  MET.miniTotal  = qs.miniTotal;

    // emit session row
    emitSessionRow(reason);

    // end event for downstream
    dispatch('hha:end', {
      scoreFinal: MET.scoreFinal,
      comboMax: MET.comboMax,
      misses: MET.misses,
      reason,
      startTimeIso: META.startTimeIso,
      endTimeIso: META.endTimeIso,
      conditionGroup: META.conditionGroup
    });

    console.log('[GoodJunkVR] stop', { reason, sessionId: META.sessionId });
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});
export const GameEngine = window.GoodJunkVR.GameEngine;
