// === core/quests.js — Mini Quest Engine (Pick-3 + Sequential Focus) ===
export const Quests = (function () {
  let hud = null, coach = null;

  const S = {
    diff: 'Normal',
    lang: 'TH',
    timeSec: 45,

    // run counters
    totalDone: 0,
    junkClicks: 0,
    anyMiss: 0,

    // timers / streaks (secs)
    secsNoJunk: 0,
    secsNoMiss: 0,
    perfectStreak: 0,

    // all 10 templates
    allDefs: [],
    // active subset (length = pickN)
    active: [],
    // UI
    focusIndex: 0,
    sequential: true,

    // one-time flags
    reachedCombo10: false,
    feverTriggered: false,
  };

  // ---------- difficulty targets ----------
  function targetsFor(diff) {
    if (diff === 'Easy') {
      return { gold:2, perfect:6, combo10:1, fever:1, power:2,
               avoidJunkSecs:8, noMissSecs:8, goodHits:18, shieldPick:1, perfectStreak3:1 };
    }
    if (diff === 'Hard') {
      return { gold:4, perfect:12, combo10:1, fever:1, power:4,
               avoidJunkSecs:15, noMissSecs:15, goodHits:28, shieldPick:2, perfectStreak3:1 };
    }
    // Normal
    return { gold:3, perfect:10, combo10:1, fever:1, power:3,
             avoidJunkSecs:12, noMissSecs:12, goodHits:22, shieldPick:2, perfectStreak3:1 };
  }

  // ---------- helpers ----------
  function say(t){ try{ coach?.say?.(t); }catch{} }

  function makeQuest(key, label, icon, need) {
    return { key, label, icon, progress: 0, need, done: false, fail: false, focus:false };
  }

  function lbl(en, th) { return (S.lang === 'TH' ? th : en); }

  function refresh() {
    if (!hud?.setQuestChips) return;
    hud.setQuestChips(S.active);
  }

  function focusQuest(i){
    S.focusIndex = Math.max(0, Math.min(i, S.active.length-1));
    for (let k=0;k<S.active.length;k++) S.active[k].focus = (k === S.focusIndex);
    const q = S.active[S.focusIndex];
    if (q) say(lbl(`Quest: ${q.label}`, `ภารกิจ: ${q.label}`));
    refresh();
  }

  function nextQuest(){
    // ไปข้อถัดไปอัตโนมัติ (ถ้าทำครบแล้ว ให้ค้างไว้)
    const idx = S.active.findIndex(q=>!q.done);
    if (idx === -1) return; // all done
    focusQuest(idx);
  }

  function doneQuest(q){
    if (q.done) return;
    q.progress = q.need;
    q.done = true;
    S.totalDone++;
    say('✅ '+q.label);
    if (S.sequential) nextQuest();
  }

  function bumpQuest(q, add=1){
    if (!q || q.done) return;
    q.progress = Math.min(q.need, (q.progress||0)+add);
    if (q.progress >= q.need) doneQuest(q);
  }

  function findActive(key){
    return S.active.find(q => q.key === key);
  }

  function shouldApply(key){
    if (!S.sequential) return !!findActive(key);
    const focus = S.active[S.focusIndex];
    return !!focus && focus.key === key;
  }

  function resetTimedOnMiss(reason){
    // avoidJunk: reset เฉพาะตอนมี miss เพราะ "junkClick"
    if (reason === 'junkClick') S.secsNoJunk = 0;

    // noMiss: reset ทุก miss
    S.secsNoMiss = 0;
    // perfect streak ก็ reset เมื่อ miss ใด ๆ
    S.perfectStreak = 0;
  }

  // ---------- API ----------
  function bindToMain(refs = {}) {
    hud = refs.hud || null;
    coach = refs.coach || null;
    refresh();
    return { refresh };
  }

  /**
   * beginRun(modeKey, diff, lang, timeSec, opts)
   * opts:
   *   pick: number (default 3)
   *   sequential: boolean (default true)
   */
  function beginRun(modeKey, diff, lang, timeSec = 45, opts = {}) {
    S.diff = (diff || 'Normal');
    S.lang = String(lang||'TH').toUpperCase();
    S.timeSec = (timeSec|0) || 45;
    S.sequential = (opts.sequential !== false); // default true
    const pickN = Math.max(1, Math.min(10, opts.pick || 3));
    const T = targetsFor(S.diff);

    // reset counters
    S.totalDone = 0;
    S.junkClicks = 0;
    S.anyMiss = 0;
    S.secsNoJunk = 0;
    S.secsNoMiss = 0;
    S.perfectStreak = 0;
    S.reachedCombo10 = false;
    S.feverTriggered = false;

    // define 10 quests
    S.allDefs = [
      makeQuest('goldHit',        lbl('Gold Hits','เก็บทอง'),             '🌟', T.gold),
      makeQuest('perfect',        lbl('Perfect Hits','Perfect'),           '💯', T.perfect),
      makeQuest('combo10',        lbl('Reach Combo 10','คอมโบถึง 10'),    '🔗', T.combo10),
      makeQuest('fever',          lbl('Trigger FEVER','เปิดโหมดไฟลุก'),   '🔥', T.fever),
      makeQuest('power',          lbl('Use Any Power','ใช้พลังพิเศษ'),     '⚡', T.power),
      makeQuest('avoidJunk',      lbl('Avoid Junk (sec)','เลี่ยง Junk (วินาที)'), '🚫', T.avoidJunkSecs),
      makeQuest('noMiss',         lbl('No Miss (sec)','ไม่มีพลาด (วินาที)'),'🛡️', T.noMissSecs),
      makeQuest('goodHits',       lbl('Good/Perfect Hits','ตีโดนของดี'),    '🥗', T.goodHits),
      makeQuest('shieldPick',     lbl('Shield Pickups','เก็บโล่'),          '🛡️', T.shieldPick),
      makeQuest('streakPerfect3', lbl('Perfect ×3 streak','Perfect ติดกัน 3'),'✨', T.perfectStreak3),
    ];

    // pick random N
    const shuffled = [...S.allDefs].sort(()=>Math.random()-0.5);
    S.active = shuffled.slice(0, pickN);
    for (const q of S.active) q.focus = false;

    // initialize focus
    if (S.sequential) {
      // focus ที่เควสต์แรก (หรือหาอันแรกที่ยังไม่ done)
      focusQuest(0);
    } else {
      refresh();
    }
  }

  // tick( ) — เรียกจาก main รายวินาที
  function tick() {
    // เพิ่มตัวนับวินาที
    S.secsNoJunk++;
    S.secsNoMiss++;

    // gate ไปยังเควสต์ตาม focus/sequential
    if (shouldApply('avoidJunk')) bumpQuest(findActive('avoidJunk'), 1);
    if (shouldApply('noMiss'))    bumpQuest(findActive('noMiss'), 1);

    refresh();
  }

  // event intake
  function event(type, ev = {}) {
    if (type === 'hit') {
      const result = ev.result || 'good';
      const meta   = ev.meta || {};
      const comboNow = ev.comboNow|0;

      // gold
      if ((meta.gold === true || meta.quest === 'goldHit') && shouldApply('goldHit')) {
        bumpQuest(findActive('goldHit'), 1);
      }

      // perfect
      if (result === 'perfect') {
        if (shouldApply('perfect')) bumpQuest(findActive('perfect'), 1);
        S.perfectStreak++;
        if (S.perfectStreak >= 3 && shouldApply('streakPerfect3')) {
          bumpQuest(findActive('streakPerfect3'), 1); // one-time (need=1)
        }
      } else {
        S.perfectStreak = 0; // non-perfect hit resets streak
      }

      // goodHits (good or perfect)
      if ((result === 'good' || result === 'perfect') && shouldApply('goodHits')) {
        bumpQuest(findActive('goodHits'), 1);
      }

      // combo10 (reach once)
      if (!S.reachedCombo10 && comboNow >= 10) {
        S.reachedCombo10 = true;
        if (shouldApply('combo10')) bumpQuest(findActive('combo10'), 1);
      }

      // power (star/shield) → power
      if (meta.power && shouldApply('power')) bumpQuest(findActive('power'), 1);
      if (meta.power === 'shield' && shouldApply('shieldPick')) bumpQuest(findActive('shieldPick'), 1);
    }
    else if (type === 'miss') {
      S.anyMiss++;
      if (ev?.reason === 'junkClick') S.junkClicks++;
      resetTimedOnMiss(ev?.reason);
    }
    else if (type === 'fever') {
      if (ev?.on && !S.feverTriggered) {
        S.feverTriggered = true;
        if (shouldApply('fever')) bumpQuest(findActive('fever'), 1);
      }
    }
    else if (type === 'power') {
      // event from bus.power(kind)
      if (ev?.kind) {
        if (shouldApply('power')) bumpQuest(findActive('power'), 1);
        if (ev.kind === 'shield' && shouldApply('shieldPick')) bumpQuest(findActive('shieldPick'), 1);
      }
    }

    refresh();
  }

  function endRun({ score } = {}) {
    const details = S.active.map(q =>
      `${q.label}: ${q.progress}/${q.need}${q.done ? ' ✓' : ''}`
    );
    const summary = {
      totalDone: S.active.filter(q=>q.done).length,
      details,
      counters: { junkClicks: S.junkClicks|0, anyMiss: S.anyMiss|0 }
    };

    // soft reset for safety
    S.active = [];
    S.allDefs = [];
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
