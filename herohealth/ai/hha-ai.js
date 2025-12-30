/* === /herohealth/ai/hha-ai.js ===
HHA AI Pack (All-in-One) — works for ALL HeroHealth games
✅ Player Modeling (skill score + stability) from session metrics
✅ Personalization (next diff recommendation + per-game tuning suggestions)
✅ AI Coach (smart messages) — offline templates, throttled, kid-friendly
✅ Anomaly / Cheating / AFK detection (rule-based)
✅ Learning Insight + Focus Plan (e.g., Groups confusion, Junk weakness)
✅ Emits: hha:ai:recommend, hha:ai:coach, hha:ai:flag
✅ Stores: LS: HHA_AI_PROFILE, HHA_AI_LAST
How to use:
  - Include this script in each game HTML (before engine start)
  - Call HHAAI.startSession({game:'GroupsVR', runMode, diff, seed, timeSec})
  - Optional: engine can ask HHAAI.getTuning('GroupsVR') at start (play only)
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  const LS_PROFILE = 'HHA_AI_PROFILE';
  const LS_LAST    = 'HHA_AI_LAST';
  const VER = '1.0.0';

  const emit = (name, detail) => {
    try { root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {}
  };

  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function nowMs() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function isoNow() { try { return new Date().toISOString(); } catch { return String(Date.now()); } }

  function median(arr){
    if (!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length % 2) ? a[m] : (a[m-1]+a[m])*0.5;
  }

  function loadJson(key, fallback){
    try{
      const s = localStorage.getItem(key);
      if (!s) return fallback;
      return JSON.parse(s);
    } catch { return fallback; }
  }
  function saveJson(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  // ---------------------------
  // Profile (persisted)
  // ---------------------------
  function defaultProfile(){
    return {
      ver: VER,
      updatedAt: isoNow(),
      sessions: 0,

      // global ability estimate [0..1]
      skill: 0.50,
      skillStable: 0.40, // how confident we are
      lastGrade: 'C',

      // smoothed metrics
      accAvg: 0,
      rtAvg: 0,
      junkRateAvg: 0,
      missAvg: 0,

      // per game aggregates
      perGame: {
        GroupsVR: { sessions:0, accAvg:0, rtAvg:0, lastDiff:'normal' },
        GoodJunkVR:{ sessions:0, accAvg:0, rtAvg:0, lastDiff:'normal' },
        HydrationVR:{ sessions:0, accAvg:0, rtAvg:0, lastDiff:'normal' },
        PlateVR:    { sessions:0, accAvg:0, rtAvg:0, lastDiff:'normal' },
      },

      // groups learning insight: confusion counts
      groups: {
        conf: {}, // key "from->to": count
        lastGroupFocus: 1
      },

      // flags summary
      flags: {
        suspiciousSessions: 0,
        afkSessions: 0
      }
    };
  }

  function ensureProfile(){
    const p = loadJson(LS_PROFILE, null);
    if (!p || typeof p !== 'object') return defaultProfile();
    if (!p.ver) p.ver = VER;
    if (!p.perGame) p.perGame = defaultProfile().perGame;
    if (!p.groups) p.groups = defaultProfile().groups;
    if (!p.flags) p.flags = defaultProfile().flags;
    return p;
  }

  function smooth(prev, next, a){
    if (!isFinite(next)) return prev;
    if (!isFinite(prev)) return next;
    a = clamp(a, 0.02, 0.60);
    return prev*(1-a) + next*a;
  }

  // ---------------------------
  // Session runtime buffer
  // ---------------------------
  const S = {
    active: false,
    startedAtMs: 0,
    game: 'Unknown',
    runMode: 'play',
    diff: 'normal',
    seed: '',
    timeSec: 90,

    // live snapshots
    lastCoachAtMs: 0,
    coachCooldownMs: 2400,

    // capture some runtime from events (optional)
    hitAll: 0,
    hitGood: 0,
    misses: 0,
    comboMax: 0,
    feverPct: 0,
    shield: 0,
    rt: [],

    // groups-only insight (if engine emits)
    groupsConf: {}, // "from->to": count

    // anomaly signals
    zeroRtCount: 0,
    weirdShootCount: 0,
    lastActionAtMs: 0
  };

  function resetSession(){
    S.active = false;
    S.startedAtMs = 0;
    S.lastCoachAtMs = 0;
    S.hitAll=0; S.hitGood=0; S.misses=0; S.comboMax=0; S.feverPct=0; S.shield=0;
    S.rt = [];
    S.groupsConf = {};
    S.zeroRtCount = 0;
    S.weirdShootCount = 0;
    S.lastActionAtMs = 0;
  }

  // ---------------------------
  // Offline AI Coach (templates)
  // ---------------------------
  function gradeFromAcc(acc){
    acc = Number(acc)||0;
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  function pick(arr){
    return arr[(Math.random()*arr.length)|0];
  }

  function coachSay(text, mood){
    emit('hha:coach', { text: String(text||''), mood: mood || 'neutral', from:'HHAAI' });
    emit('hha:ai:coach', { text: String(text||''), mood: mood || 'neutral' });
  }

  function maybeCoach(kind, payload){
    if (!S.active) return;
    const t = nowMs();
    if (t - S.lastCoachAtMs < S.coachCooldownMs) return;

    let msg = '';
    let mood = 'neutral';

    // lightweight, kid-friendly
    if (kind === 'start'){
      msg = pick([
        'เริ่มเลย! ลองโฟกัสกลางจอแล้วค่อยยิงนะ 🎯',
        'พร้อมลุย! อย่าลืมดูหมู่ที่กำลังเล่นอยู่ 👀',
        'มาดูกันว่ารอบนี้จะได้ SSS ไหม! 🔥'
      ]);
      mood = 'happy';
    }

    if (kind === 'miss_spike'){
      msg = pick([
        'ช้าๆ แต่ชัวร์! เล็งก่อนยิงนะ 😉',
        'อย่ารีบ! เลือกเป้าก่อน แล้วค่อยแตะ 🎯',
        'โฟกัสกลางจอไว้ แล้วค่อยยิงทีละเป้า!'
      ]);
      mood = 'sad';
    }

    if (kind === 'junk_hurt'){
      msg = pick([
        'ระวังขยะนะ! เห็น 🍟🍔🍕 ให้หลบ! 🚫',
        'เจอขยะให้ “ไม่แตะ” นะ! 😆',
        'คุมมือไว้! ของหวาน/น้ำหวาน = กับดัก 🍬🧋'
      ]);
      mood = 'fever';
    }

    if (kind === 'hot_streak'){
      msg = pick([
        'โหดมาก! คอมโบกำลังมา! 🔥',
        'ดีมาก! รักษาจังหวะนี้ไว้!',
        'คมสุดๆ! ต่อยอดไปถึง SSS!'
      ]);
      mood = 'happy';
    }

    if (kind === 'clutch'){
      msg = pick([
        '10 วิสุดท้าย! อย่าพลาดนะ! ⏳',
        'ท้ายเกมแล้ว! ยิงเน้นๆ ได้เลย!',
        'โค้งสุดท้าย! ขอคอมโบอีกหน่อย!'
      ]);
      mood = 'neutral';
    }

    if (msg){
      S.lastCoachAtMs = t;
      coachSay(msg, mood);
    }
  }

  // ---------------------------
  // Anomaly / AFK detection (rule-based)
  // ---------------------------
  function detectFlags(endPayload){
    const flags = [];
    const playedSec = Number(endPayload?.durationPlayedSec || 0);
    const acc = Number(endPayload?.accuracyGoodPct || endPayload?.accuracy || 0);
    const avgRt = Number(endPayload?.avgRtGoodMs || 0);
    const medRt = Number(endPayload?.medianRtGoodMs || 0);
    const hitAll = Number(endPayload?.nHitGood || 0) + Number(endPayload?.nHitJunk || 0) + Number(endPayload?.nHitWrong || 0) + Number(endPayload?.nHitDecoy || 0) + Number(endPayload?.nHitBoss || 0);

    // AFK-ish: played too short or no actions
    if (playedSec > 0 && playedSec < 0.35 * Number(S.timeSec||90)) flags.push('AFK/เล่นสั้นผิดปกติ');
    if (hitAll <= 2 && playedSec > 10) flags.push('แทบไม่ยิงเลย');

    // suspicious RT patterns
    if (avgRt > 0 && avgRt < 90) flags.push('RT ต่ำผิดธรรมชาติ (ตรวจ input)');
    if (medRt > 0 && medRt < 80) flags.push('Median RT ต่ำผิดธรรมชาติ');

    // perfect accuracy but very low actions
    if (acc >= 98 && hitAll < 8) flags.push('แม่นเกิน+จำนวนยิงน้อย (อาจยิงเฉพาะจังหวะ)');

    // local runtime clues
    if (S.weirdShootCount >= 6) flags.push('ยิงว่างบ่อยมาก (tap spam?)');

    return flags;
  }

  // ---------------------------
  // Player modeling (simple but research-friendly)
  // skill update uses performance vs expectation
  // ---------------------------
  function perfScore(endPayload){
    const acc = clamp(Number(endPayload?.accuracyGoodPct || endPayload?.accuracy || 0)/100, 0, 1);
    const miss = clamp(Number(endPayload?.misses || 0), 0, 999);
    const comboMax = clamp(Number(endPayload?.comboMax || 0), 0, 9999);
    const avgRt = clamp(Number(endPayload?.avgRtGoodMs || 0), 0, 3000);

    // normalize RT (lower is better)
    const rtN = (avgRt > 0) ? clamp(1 - ((avgRt - 220) / 680), 0, 1) : 0.35;

    // normalize miss
    const missN = clamp(1 - (miss / 18), 0, 1);

    // combo bonus
    const comboN = clamp(comboMax / 35, 0, 1);

    // blended performance [0..1]
    return clamp(0.52*acc + 0.22*rtN + 0.18*missN + 0.08*comboN, 0, 1);
  }

  function expectedPerf(skill, diff){
    skill = clamp(skill, 0, 1);
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy')   return clamp(0.58 + 0.30*skill, 0, 1);
    if (diff === 'hard')   return clamp(0.38 + 0.36*skill, 0, 1);
    return                clamp(0.48 + 0.34*skill, 0, 1);
  }

  function updateSkill(profile, endPayload){
    const ps = perfScore(endPayload);
    const exp = expectedPerf(profile.skill, S.diff);

    // delta in [-1..1]
    const delta = clamp(ps - exp, -0.30, 0.30);

    // learning rate: more sessions -> stable, but keep moving
    const lr = clamp(0.10 - profile.sessions*0.0015, 0.035, 0.10);

    profile.skill = clamp(profile.skill + delta*lr*1.8, 0, 1);

    // stability rises with sessions
    profile.skillStable = clamp(smooth(profile.skillStable, 0.55 + profile.sessions*0.01, 0.08), 0.35, 0.92);

    return { ps, exp, delta };
  }

  // ---------------------------
  // Recommendation (diff + focus + tuning)
  // ---------------------------
  function recommendNext(profile, endPayload){
    const acc = Number(endPayload?.accuracyGoodPct || 0);
    const miss = Number(endPayload?.misses || 0);
    const avgRt = Number(endPayload?.avgRtGoodMs || 0);
    const junkErr = Number(endPayload?.junkErrorPct || 0);

    const grade = gradeFromAcc(acc);
    const curDiff = String(S.diff||'normal');
    let nextDiff = curDiff;

    // diff promotion/demotion — gentle
    if (curDiff === 'easy'){
      if (acc >= 86 && miss <= 6) nextDiff = 'normal';
    } else if (curDiff === 'normal'){
      if (acc >= 90 && miss <= 7 && avgRt > 0 && avgRt <= 430) nextDiff = 'hard';
      if (acc < 62 && miss >= 12) nextDiff = 'easy';
    } else if (curDiff === 'hard'){
      if (acc < 66 && miss >= 14) nextDiff = 'normal';
    }

    // focus plan
    const focus = [];
    if (junkErr >= 18) focus.push('โฟกัส: “หลบขยะ” (junk) ก่อน');
    if (avgRt > 520) focus.push('โฟกัส: “เร็วขึ้น” (RT)');
    if (miss >= 12) focus.push('โฟกัส: “อย่าพลาด” (TTL/เล็งชัด)');
    if (!focus.length) focus.push('โฟกัส: “รักษาคอมโบ”');

    // per-game tuning suggestions (play mode only)
    const tuning = getTuningSuggestion(profile, endPayload);

    return { grade, nextDiff, focus, tuning };
  }

  function getTuningSuggestion(profile, endPayload){
    // IMPORTANT: suggestions only. Engine decides whether to apply.
    // We keep research mode deterministic by NOT applying auto tuning unless you want.
    const acc = clamp(Number(endPayload?.accuracyGoodPct || 0)/100, 0, 1);
    const miss = clamp(Number(endPayload?.misses || 0), 0, 999);
    const avgRt = clamp(Number(endPayload?.avgRtGoodMs || 0), 0, 2500);
    const junkErr = clamp(Number(endPayload?.junkErrorPct || 0)/100, 0, 1);

    // compute difficulty pressure [0..1]
    let pressure = 0.45 + (profile.skill - 0.5)*0.40 + (acc-0.75)*0.35 - (miss/18)*0.20;
    pressure = clamp(pressure, 0.15, 0.95);

    // tuning multipliers
    const spawnMult = clamp(1.08 - pressure*0.28, 0.78, 1.12);
    const ttlMult   = clamp(1.10 - pressure*0.30, 0.78, 1.18);
    const junkMult  = clamp(0.95 + pressure*0.35 + junkErr*0.20, 0.85, 1.35);

    // RT slow => ease spawn slightly
    const rtEase = (avgRt > 620) ? 1.06 : (avgRt > 520 ? 1.03 : 1.00);

    return {
      spawnMult: +(spawnMult*rtEase).toFixed(3),
      ttlMult:   +ttlMult.toFixed(3),
      junkMult:  +junkMult.toFixed(3),
      note: 'ใช้ใน play ได้ (research แนะนำให้ “แสดงคำแนะนำ” เฉยๆ เพื่อคุมความเที่ยง)'
    };
  }

  // ---------------------------
  // Groups insight (confusion)
  // expects engine emits: groups:progress {kind:'hit_wrong', fromGroup, toGroup}
  // ---------------------------
  function mergeGroupsConf(profile){
    const conf = profile.groups.conf || (profile.groups.conf = {});
    const sConf = S.groupsConf || {};
    Object.keys(sConf).forEach(k=>{
      conf[k] = (conf[k]||0) + (sConf[k]||0);
    });
  }

  function topGroupConf(profile){
    const conf = profile.groups.conf || {};
    let bestK = '';
    let bestV = 0;
    for (const k in conf){
      const v = conf[k]|0;
      if (v > bestV){ bestV = v; bestK = k; }
    }
    return { key: bestK, count: bestV };
  }

  // ---------------------------
  // Public API
  // ---------------------------
  function startSession(opts){
    opts = opts || {};
    resetSession();

    S.active = true;
    S.startedAtMs = nowMs();
    S.game = String(opts.game || 'Unknown');
    S.runMode = (String(opts.runMode||'play').toLowerCase() === 'research') ? 'research' : 'play';
    S.diff = String(opts.diff || 'normal').toLowerCase();
    S.seed = String(opts.seed || '');
    S.timeSec = clamp(opts.timeSec ?? opts.time ?? 90, 30, 180);

    S.lastActionAtMs = nowMs();

    maybeCoach('start');
  }

  function stopSession(){ S.active = false; }

  function getProfile(){ return ensureProfile(); }

  function getLastRecommendation(){
    return loadJson(LS_LAST, null);
  }

  // optional: engines can call before applying base params
  function getTuning(game){
    const last = getLastRecommendation();
    if (!last || !last.tuning) return null;
    // only apply in play mode
    if (S.runMode !== 'play') return null;
    if (game && last.game && String(last.game) !== String(game)) return last.tuning; // allow cross-game
    return last.tuning;
  }

  // ---------------------------
  // Auto bind to existing events (works with your current schema)
  // ---------------------------
  let _bound = false;
  function bindAuto(){
    if (_bound) return;
    _bound = true;

    // score snapshots
    root.addEventListener('hha:score', (ev)=>{
      if (!S.active) return;
      const d = ev.detail || {};
      S.misses = Number(d.misses||0);
      S.comboMax = Math.max(S.comboMax, Number(d.comboMax||0));
      S.lastActionAtMs = nowMs();

      // coaching triggers
      if (S.misses >= 6 && (S.misses % 3 === 0)) maybeCoach('miss_spike');
    }, { passive:true });

    // fever snapshots
    root.addEventListener('hha:fever', (ev)=>{
      if (!S.active) return;
      const d = ev.detail || {};
      S.feverPct = Number(d.feverPct||0);
      S.shield = Number(d.shield||0);
    }, { passive:true });

    // “shoot miss spam” signal (optional)
    root.addEventListener('hha:judge', (ev)=>{
      if (!S.active) return;
      const d = ev.detail || {};
      if (String(d.kind||'').toUpperCase() === 'MISS'){
        S.weirdShootCount++;
        if (S.weirdShootCount >= 6) emit('hha:ai:flag', { kind:'spam_miss', n:S.weirdShootCount });
      }
      if (String(d.text||'').toUpperCase().includes('JUNK')) maybeCoach('junk_hurt');
    }, { passive:true });

    // groups insight (needs small engine emit patch to be richest)
    root.addEventListener('groups:progress', (ev)=>{
      if (!S.active) return;
      const d = ev.detail || {};
      const kind = String(d.kind||'').toLowerCase();
      if (kind === 'hit_wrong' && d.fromGroup && d.toGroup){
        const k = `${d.fromGroup}->${d.toGroup}`;
        S.groupsConf[k] = (S.groupsConf[k]||0) + 1;
      }
      if (kind === 'hit_bad') maybeCoach('junk_hurt');
      if (kind === 'combo' && Number(d.combo||0) >= 12) maybeCoach('hot_streak');
      S.lastActionAtMs = nowMs();
    }, { passive:true });

    // end session — main update
    root.addEventListener('hha:end', (ev)=>{
      const endPayload = ev.detail || {};
      const profile = ensureProfile();

      // detect flags
      const flags = detectFlags(endPayload);
      if (flags.length){
        profile.flags.suspiciousSessions = (profile.flags.suspiciousSessions|0) + 1;
      }
      // AFK heuristic
      const playedSec = Number(endPayload?.durationPlayedSec || 0);
      if (playedSec > 0 && playedSec < 0.35 * Number(S.timeSec||90)){
        profile.flags.afkSessions = (profile.flags.afkSessions|0) + 1;
      }

      // update skill/model (ALLOW in both modes; but DOES NOT affect determinism of run)
      const u = updateSkill(profile, endPayload);

      // smooth global metrics
      const acc = Number(endPayload?.accuracyGoodPct || 0);
      const rt  = Number(endPayload?.avgRtGoodMs || 0);
      const junkErr = Number(endPayload?.junkErrorPct || 0);
      const miss = Number(endPayload?.misses || 0);

      profile.accAvg = smooth(profile.accAvg, acc, 0.12);
      profile.rtAvg  = smooth(profile.rtAvg, rt,  0.10);
      profile.junkRateAvg = smooth(profile.junkRateAvg, junkErr, 0.10);
      profile.missAvg = smooth(profile.missAvg, miss, 0.10);

      // per game
      const g = String(S.game||'Unknown');
      if (!profile.perGame[g]) profile.perGame[g] = { sessions:0, accAvg:0, rtAvg:0, lastDiff:S.diff };
      profile.perGame[g].sessions = (profile.perGame[g].sessions|0) + 1;
      profile.perGame[g].accAvg = smooth(profile.perGame[g].accAvg, acc, 0.14);
      profile.perGame[g].rtAvg  = smooth(profile.perGame[g].rtAvg,  rt,  0.12);
      profile.perGame[g].lastDiff = String(S.diff);

      // groups confusion merge
      if (g === 'GroupsVR') mergeGroupsConf(profile);

      profile.sessions = (profile.sessions|0) + 1;
      profile.lastGrade = gradeFromAcc(acc);
      profile.updatedAt = isoNow();

      // recommendation
      const rec = recommendNext(profile, endPayload);

      // extra insight
      let insight = [];
      if (g === 'GroupsVR'){
        const top = topGroupConf(profile);
        if (top.key && top.count >= 3){
          insight.push(`สับสนบ่อย: ${top.key} (รวม ${top.count} ครั้ง)`);
        }
      }
      if (Number(endPayload?.junkErrorPct||0) >= 18) insight.push('พลาดขยะเยอะ: ฝึก “ไม่แตะ junk”');
      if (Number(endPayload?.avgRtGoodMs||0) >= 520) insight.push('RT ช้า: ฝึก “มองกลางจอแล้วค่อยยิง”');

      const out = {
        ver: VER,
        ts: isoNow(),
        game: g,
        runMode: S.runMode,
        diff: S.diff,
        seed: S.seed,

        perf: {
          perfScore: +perfScore(endPayload).toFixed(3),
          expected:  +expectedPerf(profile.skill, S.diff).toFixed(3),
          delta:     +u.delta.toFixed(3),
          skill:     +profile.skill.toFixed(3),
          stable:    +profile.skillStable.toFixed(3)
        },

        end: endPayload,
        flags,
        grade: rec.grade,
        nextDiff: rec.nextDiff,
        focus: rec.focus,
        tuning: rec.tuning,
        insight
      };

      saveJson(LS_PROFILE, profile);
      saveJson(LS_LAST, out);

      emit('hha:ai:recommend', out);
      if (flags.length) emit('hha:ai:flag', { kind:'session_flags', flags });

      stopSession();
    }, { passive:true });

    // lightweight clutch coach (based on time event)
    root.addEventListener('hha:time', (ev)=>{
      if (!S.active) return;
      const d = ev.detail || {};
      const left = Number(d.left ?? 999);
      if (left <= 10 && left >= 9) maybeCoach('clutch');
    }, { passive:true });
  }

  bindAuto();

  // expose
  root.HHAAI = {
    startSession,
    stopSession,
    getProfile,
    getLastRecommendation,
    getTuning
  };

})(typeof window !== 'undefined' ? window : globalThis);