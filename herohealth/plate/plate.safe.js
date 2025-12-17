// === /herohealth/plate/plate.safe.js ===
// Hero Health — Balanced Plate VR (SAFE / Production)
// 2025-12-17c
// - Spawn target under #targetRoot (camera child) to "move with view" but NOT fly around
// - MISS = hit junk only (no miss on expire)
// - Emit events for global HUD binder: hha:score, hha:miss, hha:fever, hha:time, quest:update, hha:coach, hha:judge, hha:end
// - Optional cloud logger via window.initCloudLogger + emits hha:session/hha:event

'use strict';

(function () {
  const ROOT = (typeof window !== 'undefined') ? window : globalThis;
  const doc = ROOT.document;
  if (!doc) return;

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nowMs = () => (ROOT.performance && performance.now) ? performance.now() : Date.now();

  function getParam(name, fallback) {
    try {
      const u = new URL(ROOT.location.href);
      const v = u.searchParams.get(name);
      return (v !== null && v !== '') ? v : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function emit(name, detail) {
    try { ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  // ---------- Config (diff) ----------
  const DIFF = String(getParam('diff', 'normal')).toLowerCase();
  const RUN  = String(getParam('run',  'play')).toLowerCase(); // play | research
  const runMode = (RUN === 'research') ? 'research' : 'play';

  let dur = parseInt(getParam('time', ''), 10);
  if (!Number.isFinite(dur) || dur < 20 || dur > 180) {
    // default per diff
    dur = (DIFF === 'easy') ? 80 : (DIFF === 'hard') ? 55 : 70;
  }

  const DIFF_CFG = {
    easy:   { spawnMs: 780,  ttlMs: 1700, maxActive: 4,  jitter: 0.75, junkRatio: 0.16 },
    normal: { spawnMs: 660,  ttlMs: 1500, maxActive: 5,  jitter: 0.85, junkRatio: 0.20 },
    hard:   { spawnMs: 520,  ttlMs: 1350, maxActive: 6,  jitter: 0.95, junkRatio: 0.26 }
  };
  const CFG = DIFF_CFG[DIFF] || DIFF_CFG.normal;

  // ---------- Scene refs ----------
  const scene = doc.querySelector('a-scene');
  const cam   = doc.querySelector('#cam') || doc.querySelector('a-camera');
  let targetRoot = doc.querySelector('#targetRoot');

  // HUD refs (match plate-vr.html layout)
  const elScore   = doc.getElementById('hudScore');
  const elCombo   = doc.getElementById('hudCombo');
  const elMiss    = doc.getElementById('hudMiss');
  const elFever   = doc.getElementById('hudFever');
  const elFeverPct= doc.getElementById('hudFeverPct');
  const elGroups  = doc.getElementById('hudGroupsHave');
  const elPerfect = doc.getElementById('hudPerfectCount');
  const elGoalLine= doc.getElementById('hudGoalLine');
  const elMiniLine= doc.getElementById('hudMiniLine');

  // Result modal (optional)
  const resultBackdrop = doc.getElementById('resultBackdrop');
  const rMode   = doc.getElementById('rMode');
  const rGrade  = doc.getElementById('rGrade');
  const rScore  = doc.getElementById('rScore');
  const rMaxCombo = doc.getElementById('rMaxCombo');
  const rMiss   = doc.getElementById('rMiss');
  const rPerfect= doc.getElementById('rPerfect');
  const rGoals  = doc.getElementById('rGoals');
  const rMinis  = doc.getElementById('rMinis');
  const rG1 = doc.getElementById('rG1');
  const rG2 = doc.getElementById('rG2');
  const rG3 = doc.getElementById('rG3');
  const rG4 = doc.getElementById('rG4');
  const rG5 = doc.getElementById('rG5');
  const rGTotal = doc.getElementById('rGTotal');

  // ---------- Assets (emoji sets) ----------
  const FOODS = {
    1: ['🥚','🐟','🍗','🥩','🫘','🥜','🧀','🥛'],
    2: ['🍚','🍞','🥖','🍜','🍝','🥔','🌽'],
    3: ['🥦','🥬','🥒','🥕','🍅','🌶️','🫑'],
    4: ['🍎','🍌','🍊','🍇','🍉','🍍','🥭'],
    5: ['🥑','🫒','🥥','🌰','🧈']
  };
  const JUNK = ['🍟','🍔','🍕','🌭','🍩','🍰','🍫','🍬','🥤','🧋'];

  function isJunkEmoji(e) {
    return JUNK.indexOf(e) >= 0;
  }

  function pickFood() {
    const roll = Math.random();
    if (roll < CFG.junkRatio) return { emoji: pick(JUNK), group: 0, kind: 'junk' };

    const g = 1 + ((Math.random() * 5) | 0);
    return { emoji: pick(FOODS[g]), group: g, kind: 'good' };
  }

  // ---------- Gameplay state ----------
  let running = false;
  let gameStarted = false;

  let timeLeft = dur;
  let timerId = null;
  let spawnId = null;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let fever = 0; // 0..100

  // Plate tracking (current plate has which groups)
  let plateHave = { 1:false, 2:false, 3:false, 4:false, 5:false };
  let plateCountHave = 0;
  let perfectPlates = 0;

  // Totals for summary
  const groupCounts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  let groupTotal = 0;

  // Targets
  const active = new Map(); // id -> { el, born, ttl, kind, group, emoji }

  // Quests (2 goals + 3 minis)
  const goalsAll = [
    { id:'perfect2', label:'ทำ PERFECT PLATE ให้ได้อย่างน้อย 2 จาน', target:2, prog:0, done:false },
    { id:'missmax',  label:'พลาด (MISS) ไม่เกิน 3 ครั้ง',           target:3, prog:0, done:false } // prog = misses, done when <=3 at end OR keep "live ok"
  ];
  const minisAll = [
    { id:'rush',   label:'ทำ Perfect ภายใน 15s', target:1, prog:0, done:false },
    { id:'combo8', label:'ทำคอมโบให้ได้ 8',     target:8, prog:0, done:false },
    { id:'clean',  label:'แตะของไม่ดี 0 ครั้ง (ช่วง 20s แรก)', target:0, prog:0, done:false }
  ];
  let rushWindowMs = 15000;
  let rushStartMs = 0;
  let cleanWindowMs = 20000;
  let cleanStartMs = 0;
  let cleanOk = true;

  // ---------- UI helpers ----------
  function setText(el, v) { if (el) el.textContent = String(v); }

  function updateFeverUI() {
    const pct = clamp(Math.round(fever), 0, 100);
    if (elFever) elFever.style.width = pct + '%';
    if (elFeverPct) elFeverPct.textContent = pct + '%';
    emit('hha:fever', { fever: pct });
  }

  function updateHUD() {
    setText(elScore, score);
    setText(elCombo, combo);
    setText(elMiss, misses);
    setText(elGroups, plateCountHave + '/5');
    setText(elPerfect, perfectPlates);

    emit('hha:score', {
      score,
      combo,
      comboMax,
      misses,
      fever: clamp(Math.round(fever),0,100),
      perfectPlates,
      groupsHave: plateCountHave
    });
  }

  function coach(text, mood) {
    emit('hha:coach', { text: text || '', mood: mood || 'neutral' });
  }

  function judge(label, good) {
    emit('hha:judge', { label: label || '', good: !!good });
  }

  function questUpdate(hint) {
    // main goal (perfect2)
    goalsAll[0].prog = perfectPlates;
    goalsAll[0].done = (perfectPlates >= goalsAll[0].target);

    // missmax live: not "done" until end (but show progress)
    goalsAll[1].prog = misses;
    goalsAll[1].done = false;

    // minis:
    // rush: done when first perfect plate achieved within rush window
    // combo8: done when comboMax >= 8
    minisAll[1].prog = comboMax;
    minisAll[1].done = (comboMax >= minisAll[1].target);

    // clean: during first 20s, if miss occurs => fail permanently; we still show as "done:false"
    minisAll[2].prog = misses;
    minisAll[2].done = false;

    // what to show as "current goal/mini" (simple priority)
    const curGoal = goalsAll[0].done ? goalsAll[1] : goalsAll[0];

    // mini priority: first not done
    let curMini = minisAll.find(m => !m.done) || minisAll[minisAll.length - 1];

    // update top lines (DOM text)
    if (elGoalLine) elGoalLine.innerHTML = (curGoal.id === 'perfect2')
      ? `ทำ <b>PERFECT PLATE</b> ให้ได้อย่างน้อย ${goalsAll[0].target} จาน (ตอนนี้ ${perfectPlates}/${goalsAll[0].target})`
      : `พลาด (MISS) <b>ไม่เกิน ${goalsAll[1].target}</b> ครั้ง (ตอนนี้ ${misses}/${goalsAll[1].target})`;

    if (elMiniLine) {
      if (curMini.id === 'rush') {
        const left = Math.max(0, Math.ceil((rushWindowMs - (nowMs() - rushStartMs)) / 1000));
        elMiniLine.textContent = `Mini: Plate Rush ${minisAll.filter(m=>m.done).length}/3 — ทำ Perfect ภายใน ${left}s`;
      } else if (curMini.id === 'combo8') {
        elMiniLine.textContent = `Mini: Combo Master ${minisAll.filter(m=>m.done).length}/3 — ทำคอมโบให้ได้ 8 (ตอนนี้ ${comboMax}/8)`;
      } else if (curMini.id === 'clean') {
        const left = Math.max(0, Math.ceil((cleanWindowMs - (nowMs() - cleanStartMs)) / 1000));
        elMiniLine.textContent = `Mini: Clean Start ${minisAll.filter(m=>m.done).length}/3 — 0 MISS ใน ${left}s แรก`;
      } else {
        elMiniLine.textContent = `Mini: ${curMini.label}`;
      }
    }

    emit('quest:update', {
      goal: { label: goalsAll[0].label, prog: goalsAll[0].prog, target: goalsAll[0].target, done: goalsAll[0].done },
      mini: { label: curMini.label, prog: (curMini.id === 'combo8' ? comboMax : curMini.prog), target: curMini.target, done: curMini.done },
      goalsAll: goalsAll.map(g => ({ label:g.label, prog:g.prog, target:g.target, done:g.done })),
      minisAll: minisAll.map(m => ({ label:m.label, prog:m.prog, target:m.target, done:m.done })),
      hint: hint || ''
    });
  }

  // ---------- Grade (same spirit as GoodJunk) ----------
  function computeGrade(finalScore, finalComboMax, finalMisses, allGoalsDone, allMiniDone) {
    const allQuest = !!allGoalsDone && !!allMiniDone;

    if (allQuest && finalScore >= 1200 && finalComboMax >= 12 && finalMisses <= 1) return 'SSS';
    if (allQuest && finalScore >= 900  && finalComboMax >= 10 && finalMisses <= 3) return 'SS';
    if (finalScore >= 700) return 'S';
    if (finalScore >= 500) return 'A';
    if (finalScore >= 300) return 'B';
    return 'C';
  }

  // ---------- A-Frame target creation ----------
  function ensureTargetRoot() {
    if (targetRoot) return targetRoot;
    if (!cam) return null;

    targetRoot = doc.createElement('a-entity');
    targetRoot.setAttribute('id', 'targetRoot');
    targetRoot.setAttribute('position', '0 0 -2.2');
    cam.appendChild(targetRoot);
    return targetRoot;
  }

  function makeTargetEntity(t) {
    const root = ensureTargetRoot();
    if (!root) return null;

    const id = 'pt_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);

    const el = doc.createElement('a-entity');
    el.classList.add('plateTarget');
    el.setAttribute('id', id);

    // Position relative to camera (stable, no "flying")
    const j = CFG.jitter;
    const x = (Math.random() * 2 - 1) * j;        // -j..j
    const y = (Math.random() * 2 - 1) * (j * 0.55); // smaller vertical range
    const z = 0;

    el.setAttribute('position', `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);

    // Visual: emoji text
    // NOTE: A-Frame will load Roboto msdf automatically in many builds; if missing, it still won't crash.
    el.setAttribute('text', `value:${t.emoji}; align:center; baseline:center; width:6; color:#ffffff;`);
    el.setAttribute('scale', '0.55 0.55 0.55');

    // Add subtle plate-like ring behind
    const ring = doc.createElement('a-entity');
    ring.setAttribute('geometry', 'primitive:ring; radiusInner:0.22; radiusOuter:0.30');
    ring.setAttribute('material', `shader:flat; color:${t.kind === 'junk' ? '#f97316' : '#22c55e'}; opacity:0.65`);
    ring.setAttribute('position', '0 0 -0.01');
    el.appendChild(ring);

    // Tag data
    el.dataset.kind = t.kind;
    el.dataset.group = String(t.group || 0);
    el.dataset.emoji = t.emoji;

    // Click handler (cursor / gaze / mouse)
    el.addEventListener('click', onHitTarget, { passive: true });

    // Also handle cursor "fuse" event in some setups
    el.addEventListener('mouseenter', () => { /* optional */ });

    root.appendChild(el);

    active.set(id, {
      id,
      el,
      born: nowMs(),
      ttl: CFG.ttlMs,
      kind: t.kind,
      group: t.group,
      emoji: t.emoji
    });

    return el;
  }

  function removeTarget(id) {
    const it = active.get(id);
    if (!it) return;
    active.delete(id);
    try {
      if (it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el);
    } catch (_) {}
  }

  // ---------- Hit / Miss logic ----------
  function addScore(points) {
    score += (points | 0);
    if (score < 0) score = 0;
  }

  function bumpFever(delta) {
    fever = clamp(fever + delta, 0, 100);
    updateFeverUI();
  }

  function setCombo(v) {
    combo = Math.max(0, v | 0);
    comboMax = Math.max(comboMax, combo);
  }

  function resetPlate() {
    plateHave = { 1:false, 2:false, 3:false, 4:false, 5:false };
    plateCountHave = 0;
  }

  function onPerfectPlate() {
    perfectPlates += 1;
    addScore(300);
    judge('PERFECT PLATE! 🌟', true);
    coach('สุดยอด! จานครบ 5 หมู่แล้ว 🌟', 'happy');
    bumpFever(14);

    // quest progress
    if (!goalsAll[0].done && perfectPlates >= goalsAll[0].target) {
      coach('เคลียร์ Goal แล้ว! ไปต่ออีกภารกิจนะ ✅', 'happy');
    }

    // mini rush check
    if (!minisAll[0].done) {
      const dt = nowMs() - rushStartMs;
      if (dt <= rushWindowMs) {
        minisAll[0].done = true;
        minisAll[0].prog = 1;
        coach('Mini เคลียร์! Plate Rush สำเร็จ ⚡', 'happy');
      }
    }

    resetPlate();
    questUpdate('ทำ Perfect plate ต่อเนื่องได้คะแนนโบนัส!');
  }

  function onHitTarget(ev) {
    if (!running) return;

    const el = ev && ev.currentTarget ? ev.currentTarget : null;
    if (!el || !el.id) return;

    const id = el.id;
    const it = active.get(id);
    if (!it) return;

    // remove first (avoid double hit)
    removeTarget(id);

    // log event
    emit('hha:event', {
      type: 'hit',
      kind: it.kind,
      group: it.group,
      emoji: it.emoji,
      t: Date.now()
    });

    if (it.kind === 'junk') {
      misses += 1;
      setCombo(0);
      addScore(-20);
      judge('MISS 😵', false);
      coach('โอ๊ะ! อันนี้ของไม่ดีนะ เลือกอาหารให้ครบ 5 หมู่ 💡', 'sad');
      bumpFever(-18);

      // clean mini fails if within first 20s
      if (!minisAll[2].done) {
        const dt = nowMs() - cleanStartMs;
        if (dt <= cleanWindowMs) cleanOk = false;
      }

      emit('hha:miss', { misses });
      updateHUD();
      questUpdate('ระวังของทอด/หวาน/น้ำอัดลม!');
      return;
    }

    // GOOD hit
    setCombo(combo + 1);

    // combo mini
    if (!minisAll[1].done && comboMax >= minisAll[1].target) {
      minisAll[1].done = true;
      coach('Mini เคลียร์! คอมโบถึง 8 แล้ว 🔥', 'fever');
    }

    bumpFever(7);

    const g = it.group | 0;
    if (g >= 1 && g <= 5) {
      groupCounts[g] += 1;
      groupTotal += 1;

      const already = !!plateHave[g];
      if (!already) {
        plateHave[g] = true;
        plateCountHave += 1;
        addScore(110);
        judge('GOOD ✅', true);
      } else {
        addScore(40);
        judge('GOOD +', true);
      }

      // update plate HUD
      setText(elGroups, plateCountHave + '/5');

      // perfect plate complete
      if (plateCountHave >= 5) {
        onPerfectPlate();
      } else {
        coach(`ดีมาก! ตอนนี้ได้ ${plateCountHave}/5 หมู่แล้ว 🎯`, (combo >= 6) ? 'happy' : 'neutral');
        questUpdate('');
      }
    } else {
      addScore(60);
      judge('GOOD ✅', true);
      coach('ดีมาก! ลองเก็บให้ครบ 5 หมู่นะ 🎯', 'neutral');
      questUpdate('');
    }

    updateHUD();
  }

  // ---------- Expire loop (NO miss on expire) ----------
  function tickExpire() {
    if (!running) return;
    const t = nowMs();
    const toRemove = [];
    active.forEach((it, id) => {
      if ((t - it.born) >= it.ttl) toRemove.push(id);
    });
    for (let i = 0; i < toRemove.length; i++) {
      const id = toRemove[i];
      const it = active.get(id);
      if (!it) continue;
      // expire event (no miss)
      emit('hha:event', {
        type: 'expire',
        kind: it.kind,
        group: it.group,
        emoji: it.emoji,
        t: Date.now()
      });
      removeTarget(id);
    }
  }

  // ---------- Spawn loop ----------
  function spawnOne() {
    if (!running) return;
    if (active.size >= CFG.maxActive) return;

    const t = pickFood();
    makeTargetEntity(t);
  }

  function ensureCursorRaycaster() {
    // Make cursor capable of fuse on center for VR
    const cursor = doc.querySelector('#cursor');
    if (!cursor) return;

    try {
      // Make it fuse in VR / center
      cursor.setAttribute('cursor', 'fuse:true; fuseTimeout:450; rayOrigin:entity');
      cursor.setAttribute('raycaster', 'objects:.plateTarget');
      // keep visible ring
      cursor.setAttribute('geometry', 'primitive:ring; radiusInner:0.008; radiusOuter:0.012');
      cursor.setAttribute('material', 'shader:flat; color:#ffffff; opacity:0.95');
      cursor.setAttribute('position', '0 0 -0.9');
    } catch (_) {}
  }

  // ---------- Timer ----------
  function startTimer() {
    timeLeft = dur;
    emit('hha:time', { sec: timeLeft });

    timerId = ROOT.setInterval(() => {
      if (!running) return;
      timeLeft -= 1;
      if (timeLeft < 0) timeLeft = 0;
      emit('hha:time', { sec: timeLeft });

      // mini clean window: if time passed and still ok -> done
      if (!minisAll[2].done) {
        const dt = nowMs() - cleanStartMs;
        if (dt > cleanWindowMs) {
          if (cleanOk) {
            minisAll[2].done = true;
            coach('Mini เคลียร์! ช่วงเริ่มต้นไม่มี MISS เลย ✅', 'happy');
          }
        }
      }

      questUpdate('');

      if (timeLeft <= 0) {
        stop('time-up');
      }
    }, 1000);
  }

  // ---------- End / summary ----------
  function showResultModal(summary) {
    if (!resultBackdrop) return;
    resultBackdrop.style.display = 'flex';

    if (rMode) rMode.textContent = (runMode === 'research') ? 'Research' : 'Play';
    if (rScore) rScore.textContent = String(summary.score);
    if (rMaxCombo) rMaxCombo.textContent = String(summary.comboMax);
    if (rMiss) rMiss.textContent = String(summary.misses);
    if (rPerfect) rPerfect.textContent = String(summary.perfectPlates);

    if (rGoals) rGoals.textContent = summary.goalsCleared + '/' + summary.goalsTotal;
    if (rMinis) rMinis.textContent = summary.minisCleared + '/' + summary.minisTotal;

    if (rG1) rG1.textContent = String(groupCounts[1] || 0);
    if (rG2) rG2.textContent = String(groupCounts[2] || 0);
    if (rG3) rG3.textContent = String(groupCounts[3] || 0);
    if (rG4) rG4.textContent = String(groupCounts[4] || 0);
    if (rG5) rG5.textContent = String(groupCounts[5] || 0);
    if (rGTotal) rGTotal.textContent = String(groupTotal || 0);

    if (rGrade) rGrade.textContent = summary.grade;
  }

  function finalizeQuest() {
    // miss goal: done if misses <= 3
    const missMax = goalsAll[1].target;
    const missOk = (misses <= missMax);
    goalsAll[1].done = missOk;

    const goalsCleared = goalsAll.filter(g => g.done).length;
    const minisCleared = minisAll.filter(m => m.done).length;

    const grade = computeGrade(score, comboMax, misses, goalsCleared === goalsAll.length, minisCleared === minisAll.length);

    return {
      score,
      comboMax,
      misses,
      perfectPlates,
      goalsTotal: goalsAll.length,
      goalsCleared,
      minisTotal: minisAll.length,
      minisCleared,
      grade
    };
  }

  function stop(reason) {
    if (!running) return;
    running = false;

    if (timerId) { clearInterval(timerId); timerId = null; }
    if (spawnId) { clearInterval(spawnId); spawnId = null; }

    // cleanup targets
    const ids = Array.from(active.keys());
    for (let i = 0; i < ids.length; i++) removeTarget(ids[i]);

    const sum = finalizeQuest();

    // End events
    emit('hha:end', {
      reason: reason || 'stop',
      score: sum.score,
      comboMax: sum.comboMax,
      misses: sum.misses,
      perfectPlates: sum.perfectPlates,
      goalsTotal: sum.goalsTotal,
      goalsCleared: sum.goalsCleared,
      miniTotal: sum.minisTotal,
      miniCleared: sum.minisCleared,
      grade: sum.grade,
      groups: { ...groupCounts },
      groupsTotal: groupTotal
    });

    emit('hha:event', { type:'end', reason: reason || 'stop', t: Date.now(), score: sum.score });

    // Coach final
    coach(
      (runMode === 'research')
        ? 'จบรอบวิจัยแล้ว ขอบคุณมาก! ✅'
        : 'จบเกมแล้ว! ดูสรุปผลได้เลย 🎉',
      (sum.grade === 'SSS' || sum.grade === 'SS') ? 'happy' : 'neutral'
    );

    // Update final HUD + modal
    updateHUD();
    questUpdate('');
    showResultModal(sum);
  }

  // ---------- Start ----------
  function start() {
    if (running) return;
    running = true;
    gameStarted = true;

    // reset state
    score = 0; combo = 0; comboMax = 0; misses = 0; fever = 0;
    perfectPlates = 0;
    groupCounts[1]=0; groupCounts[2]=0; groupCounts[3]=0; groupCounts[4]=0; groupCounts[5]=0;
    groupTotal = 0;
    resetPlate();

    // quest timers
    rushStartMs = nowMs();
    cleanStartMs = nowMs();
    cleanOk = true;
    minisAll.forEach(m => { m.done = false; m.prog = 0; });

    // UI init
    updateFeverUI();
    updateHUD();
    questUpdate('เก็บให้ครบ 5 หมู่ในจานเดียวเพื่อ Perfect Plate!');

    // Ensure raycaster/cursor works
    ensureCursorRaycaster();

    // cloud logger init (optional)
    try {
      let studentProfile = null;
      let studentKey = null;
      try {
        const raw = sessionStorage.getItem('HHA_STUDENT_PROFILE');
        if (raw) {
          studentProfile = JSON.parse(raw);
          studentKey = studentProfile.studentKey || null;
        }
      } catch (_) {}

      const endpoint = (sessionStorage.getItem('HHA_LOG_ENDPOINT') || '').trim();

      if (typeof ROOT.initCloudLogger === 'function') {
        ROOT.initCloudLogger({
          endpoint: endpoint || '',
          projectTag: 'HeroHealth-PlateVR',
          mode: 'PlateVR',
          runMode,
          diff: DIFF,
          durationSec: dur,
          studentKey,
          profile: studentProfile,
          debug: false
        });
      }
    } catch (_) {}

    emit('hha:session', {
      projectTag: 'HeroHealth-PlateVR',
      mode: 'PlateVR',
      runMode,
      diff: DIFF,
      durationSec: dur,
      t: Date.now()
    });

    emit('hha:event', { type:'start', diff:DIFF, runMode, dur, t: Date.now() });

    coach(
      (runMode === 'research')
        ? 'โหมดวิจัย: เล่นให้เป็นธรรมชาติ แต่พยายามทำ Perfect Plate ให้ได้ตามเป้านะ 📊'
        : 'เริ่มเลย! เก็บให้ครบ 5 หมู่ในจานเดียว 🥦🍎🥛',
      'neutral'
    );

    // Start timer
    startTimer();

    // Spawn loop
    spawnId = ROOT.setInterval(() => {
      if (!running) return;
      spawnOne();
      tickExpire(); // keep cleanup frequent
    }, CFG.spawnMs);

    // also expire tick (backup)
    ROOT.setInterval(() => {
      if (!running) return;
      tickExpire();
    }, 250);
  }

  // ---------- Boot on DOM ready ----------
  function boot() {
    // Safety checks
    if (!scene || !cam) {
      console.error('[PlateVR] scene/camera not found');
      return;
    }

    // Ensure targetRoot exists
    ensureTargetRoot();

    // If user clicks "Play again" button in modal
    const btnPlayAgain = doc.getElementById('btnPlayAgain');
    if (btnPlayAgain) btnPlayAgain.addEventListener('click', () => ROOT.location.reload());

    // Stop on tab hidden
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden && running) stop('tab-hidden');
    });

    // Auto-start (Plate VR doesn't have separate start screen)
    // If you want a 3-2-1 countdown from the HTML (#start-countdown), it can be handled in HTML layer.
    start();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Expose for debugging
  ROOT.PlateVR = ROOT.PlateVR || {};
  ROOT.PlateVR.stop = stop;
  ROOT.PlateVR.start = start;

})();