// === core/quests.js — Mini Quest Engine (10 quests; gold/avoid-junk fixed; diff scaling) ===
export const Quests = (function () {
  // ---- runtime refs ----
  let hud = null, coach = null;

  // ---- run-scoped state ----
  const S = {
    diff: 'Normal',
    lang: 'TH',
    timeSec: 45,

    // event counters
    totalDone: 0,
    junkClicks: 0,
    anyMiss: 0,

    // streak & timers (secs)
    secsNoJunk: 0,
    secsNoMiss: 0,
    perfectStreak: 0,

    // dynamic quests list
    quests: [],

    // fast flags to avoid re-computing “reach once” quests
    reachedCombo10: false,
    feverTriggered: false,
  };

  // ---- difficulty-scaled targets ----
  function targetsFor(diff) {
    // ค่าพื้นฐานต่อโหมดความยาก
    if (diff === 'Easy') {
      return {
        gold: 2, perfect: 6, comboStreak: 10, fever: 1, power: 2,
        avoidJunkSecs: 8, noMissSecs: 8, goodHits: 18, shieldPick: 1, perfectStreak3: 1
      };
    }
    if (diff === 'Hard') {
      return {
        gold: 4, perfect: 12, comboStreak: 10, fever: 1, power: 4,
        avoidJunkSecs: 15, noMissSecs: 15, goodHits: 28, shieldPick: 2, perfectStreak3: 1
      };
    }
    // Normal (default)
    return {
      gold: 3, perfect: 10, comboStreak: 10, fever: 1, power: 3,
      avoidJunkSecs: 12, noMissSecs: 12, goodHits: 22, shieldPick: 2, perfectStreak3: 1
    };
  }

  // ---- HUD helpers ----
  function refresh() {
    if (!hud || typeof hud.setQuestChips !== 'function') return;
    hud.setQuestChips(S.quests);
  }

  function say(t) { try { coach?.say?.(t); } catch {} }

  // ---- quest ops ----
  function makeQuest(key, label, icon, need) {
    return { key, label, icon, progress: 0, need, done: false, fail: false };
  }

  function setLangLabel(key, en, th) {
    return S.lang === 'TH' ? th : en;
  }

  function bump(key, add = 1) {
    const q = S.quests.find(q => q.key === key);
    if (!q || q.done) return;
    q.progress = Math.min(q.need, (q.progress || 0) + add);
    if (q.progress >= q.need) {
      q.done = true;
      S.totalDone++;
      say('✅ ' + q.label);
    }
  }

  function setOnce(key) {
    const q = S.quests.find(q => q.key === key);
    if (!q || q.done) return;
    q.progress = q.need;
    q.done = true;
    S.totalDone++;
    say('✅ ' + q.label);
  }

  function resetTimedCountersOnMiss(reason) {
    // เควสต์ “Avoid Junk” จะรีเซ็ตเฉพาะตอน miss เพราะคลิก junk เท่านั้น
    if (reason === 'junkClick') S.secsNoJunk = 0;

    // “No Miss” จะรีเซ็ตทุกประเภทของ miss (junk / timeout / อื่น ๆ)
    S.secsNoMiss = 0;
    S.perfectStreak = 0;
  }

  // ---- lifecycle ----
  function bindToMain(refs = {}) {
    hud = refs.hud || null;
    coach = refs.coach || null;
    refresh();
    return { refresh };
  }

  function beginRun(modeKey, diff, lang, timeSec = 45) {
    S.diff = (diff || 'Normal');
    S.lang = (String(lang || 'TH').toUpperCase());
    S.timeSec = (timeSec | 0) || 45;

    S.totalDone = 0;
    S.junkClicks = 0;
    S.anyMiss = 0;
    S.secsNoJunk = 0;
    S.secsNoMiss = 0;
    S.perfectStreak = 0;
    S.reachedCombo10 = false;
    S.feverTriggered = false;

    const T = targetsFor(S.diff);

    // === 10 mini quests ===
    S.quests = [
      makeQuest('goldHit',        setLangLabel('goldHit', 'Gold Hits',           'เก็บทอง'),          T.gold),            // 🌟/⭐ (meta.gold === true)
      makeQuest('perfect',        setLangLabel('perfect', 'Perfect Hits',        'Perfect'),           T.perfect),         // result === 'perfect'
      makeQuest('combo10',        setLangLabel('combo10', 'Reach Combo 10',      'คอมโบถึง 10'),       1),                 // one-time
      makeQuest('fever',          setLangLabel('fever',   'Trigger FEVER',       'เปิดโหมดไฟลุก'),     T.fever),           // on:true
      makeQuest('power',          setLangLabel('power',   'Use Any Power',       'ใช้พลังพิเศษ'),      T.power),           // meta.power (star/shield)
      makeQuest('avoidJunk',      setLangLabel('avoidJunk','Avoid Junk (sec)',   'เลี่ยง Junk (วินาที)'), T.avoidJunkSecs), // วินาทีที่ไม่คลิก junk
      makeQuest('noMiss',         setLangLabel('noMiss',  'No Miss (sec)',       'ไม่มีพลาด (วินาที)'),  T.noMissSecs),     // วินาทีที่ไม่มี miss ทุกชนิด
      makeQuest('goodHits',       setLangLabel('goodHits','Good/Perfect Hits',   'ตีโดนของดี'),         T.goodHits),        // good + perfect
      makeQuest('shieldPick',     setLangLabel('shieldPick','Shield Pickups',    'เก็บโล่'),           T.shieldPick),      // power kind === 'shield'
      makeQuest('streakPerfect3', setLangLabel('streakPerfect3','Perfect ×3 streak','Perfect ติดกัน 3'), T.perfectStreak3)   // perfect 3 ครั้งติด
    ];

    refresh();
  }

  // called each second from main
  function tick(info = {}) {
    // เพิ่มวินาทีสำหรับ avoidJunk และ noMiss
    S.secsNoJunk++;
    S.secsNoMiss++;

    bump('avoidJunk', 1);
    bump('noMiss', 1);

    refresh();
  }

  // ---- event intake from main/bus ----
  function event(type, ev = {}) {
    if (type === 'hit') {
      const result = ev.result || 'good';
      const meta = ev.meta || {};

      // gold
      if (meta.gold === true || meta.quest === 'goldHit') bump('goldHit', 1);

      // perfect
      if (result === 'perfect') {
        bump('perfect', 1);
        S.perfectStreak++;
        if (S.perfectStreak >= 3) setOnce('streakPerfect3');
      } else {
        // non-perfect hit resets perfect streak
        S.perfectStreak = 0;
      }

      // good (รวม perfect ด้วย) → นับเป็น goodHits
      if (result === 'good' || result === 'perfect') bump('goodHits', 1);

      // combo >= 10 (เมื่อ “เคยถึง” สักครั้ง ให้สำเร็จ)
      if (!S.reachedCombo10 && (ev.comboNow | 0) >= 10) {
        S.reachedCombo10 = true;
        setOnce('combo10');
      }

      // power use (⭐/🛡️)
      if (meta.power) {
        bump('power', 1);
        if (meta.power === 'shield') bump('shieldPick', 1);
      }
    }
    else if (type === 'miss') {
      S.anyMiss++;
      if (ev?.reason === 'junkClick') S.junkClicks++;

      resetTimedCountersOnMiss(ev?.reason);
    }
    else if (type === 'fever') {
      if (ev?.on && !S.feverTriggered) {
        S.feverTriggered = true;
        bump('fever', 1);
      }
      // ปิด fever ไม่กระทบเควสต์
    }
    else if (type === 'power') {
      // สำหรับกรณี bus.power('shield') ที่ main ยิงตรง
      if (ev?.kind) {
        bump('power', 1);
        if (ev.kind === 'shield') bump('shieldPick', 1);
      }
    }

    refresh();
  }

  function endRun({ score } = {}) {
    const details = S.quests.map(q =>
      `${q.label}: ${q.progress}/${q.need}${q.done ? ' ✓' : ''}`
    );
    const summary = {
      totalDone: S.totalDone | 0,
      details,
      counters: {
        junkClicks: S.junkClicks | 0,
        anyMiss: S.anyMiss | 0
      }
    };

    // reset for safety (not strictly required if a new beginRun happens)
    S.quests = [];
    S.totalDone = 0;
    S.junkClicks = 0;
    S.anyMiss = 0;
    S.secsNoJunk = 0;
    S.secsNoMiss = 0;
    S.perfectStreak = 0;
    S.reachedCombo10 = false;
    S.feverTriggered = false;

    return summary;
  }

  return { bindToMain, beginRun, event, tick, endRun };
})();
