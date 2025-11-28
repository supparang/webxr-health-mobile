// === js/engine.js — Shadow Breaker core (2025-12-04, FEVER tuned + Fire overlay) ===
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';

export function initShadowBreaker() {
  const wrap = document.getElementById('sb-wrap');
  if (!wrap) return;

  // ----- DOM refs -----
  const viewMenu = document.getElementById('view-menu');
  const viewPlay = document.getElementById('view-play');
  const viewResult = document.getElementById('view-result');
  const viewResearchForm = document.getElementById('view-research-form');
  const bossIntro = document.getElementById('bossIntro');

  const difficultySel = document.getElementById('difficulty');
  const durationSel = document.getElementById('duration');

  const targetLayer = document.getElementById('target-layer');
  const feedbackEl = document.getElementById('sb-feedback');
  const feverFill = document.getElementById('fever-fill');
  const feverStatus = document.getElementById('fever-status');
  const playerHpFill = document.querySelector('[data-sb-player-hp]');
  const bossHpFill = document.querySelector('[data-sb-boss-hp]');

  // HUD ด้านบน (YOU | Boss)
  const hudPlayerHpTop = document.getElementById('sb-hp-player');
  const hudBossHpTop   = document.getElementById('sb-hp-boss');
  const hudBossNameTop = document.getElementById('sb-boss-name');
  const hudBossPortraitTop = document.getElementById('sb-boss-portrait');

  const statTime = document.getElementById('stat-time');
  const statScore = document.getElementById('stat-score');
  const statCombo = document.getElementById('stat-combo');
  const statPhase = document.getElementById('stat-phase');
  const statMiss = document.getElementById('stat-miss');
  const statShield = document.getElementById('stat-shield');

  // result
  const resMode = document.getElementById('res-mode');
  const resDiff = document.getElementById('res-diff');
  const resEndReason = document.getElementById('res-endreason');
  const resScore = document.getElementById('res-score');
  const resGrade = document.getElementById('res-grade');
  const resAccuracy = document.getElementById('res-accuracy');
  const resMaxCombo = document.getElementById('res-maxcombo');
  const resTotalHits = document.getElementById('res-totalhits');
  const resMiss = document.getElementById('res-miss');
  const resFeverTime = document.getElementById('res-fever-time');
  const resLowHpTime = document.getElementById('res-lowhp-time');
  const resBosses = document.getElementById('res-bosses');
  const resMenuLatency = document.getElementById('res-menu-latency');
  const resParticipant = document.getElementById('res-participant');
  const resRtNormal = document.getElementById('res-rt-normal');
  const resRtDecoy = document.getElementById('res-rt-decoy');
  const resEndHint = document.getElementById('res-end-hint');

  // buttons
  const btnStartNormal = document.querySelector('[data-action="start-normal"]');
  const btnStartResearch = document.querySelector('[data-action="start-research"]');
  const btnStopEarly = document.querySelector('[data-action="stop-early"]');
  const btnBackFromPlay = viewPlay?.querySelector('[data-action="back-to-menu"]');
  const btnPlayAgain = document.querySelector('[data-action="play-again"]');
  const btnBackFromResult = viewResult?.querySelector('[data-action="back-to-menu"]');
  const btnDownloadSession = document.querySelector('[data-action="download-csv-session"]');
  const btnDownloadEvents = document.querySelector('[data-action="download-csv-events"]');
  const btnResearchBegin = document.querySelector('[data-action="research-begin-play"]');
  const btnBackFromResearch = viewResearchForm?.querySelector('[data-action="back-to-menu"]');

  // research form inputs
  const researchIdInput = document.getElementById('research-id');
  const researchGroupInput = document.getElementById('research-group');
  const researchNoteInput = document.getElementById('research-note');

  if (!viewMenu || !viewPlay || !viewResult || !viewResearchForm || !targetLayer) {
    console.warn('[ShadowBreaker] Missing DOM elements, abort init.');
    return;
  }

  // ----- config -----
  const BOSSES = [
    { id: 0, name: 'Bubble Glove', emoji: '🐣', hint: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน' },
    { id: 1, name: 'Spark Guard', emoji: '⚡️', hint: 'เล็งเป้าเร็ว ๆ ระวังลูกระเบิด' },
    { id: 2, name: 'Shadow Mitt', emoji: '🕶️', hint: 'เป้าบางอันจะลวง ให้ดูจังหวะดี ๆ' },
    { id: 3, name: 'Galaxy Punch', emoji: '🌌', hint: 'ด่านสุดท้าย เป้าจะเล็กและเร็วมาก' }
  ];

  const DIFF_CONFIG = {
    easy: {
      label: 'Easy — ผ่อนคลาย',
      spawnIntervalMin: 900,
      spawnIntervalMax: 1300,
      targetLifetime: 1400,
      baseSize: 130,
      bossDamageNormal: 0.04,
      bossDamageBossFace: 0.4
    },
    normal: {
      label: 'Normal — สมดุล',
      spawnIntervalMin: 750,
      spawnIntervalMax: 1150,
      targetLifetime: 1200,
      baseSize: 115,
      bossDamageNormal: 0.035,
      bossDamageBossFace: 0.35
    },
    hard: {
      label: 'Hard — ท้าทาย',
      spawnIntervalMin: 600,
      spawnIntervalMax: 950,
      targetLifetime: 1050,
      baseSize: 100,
      bossDamageNormal: 0.03,
      bossDamageBossFace: 0.3
    }
  };

  // FEVER config — ปรับให้ขึ้นง่าย + ใช้จอไฟลุก
  const FEVER_CONFIG = {
    perHit: 0.18,        // hit ทีเกจขึ้นเยอะพอรู้สึก
    decayPerSec: 0.10,   // ลดช้าลง
    durationMs: 8000     // อยู่ในโหมดไฟ ~8 วินาที
  };

  const LOWHP_THRESHOLD = 0.3;
  const BOSSFACE_THRESHOLD = 0.28;

  // ----- runtime state -----
  let renderer = null;
  let state = null;
  let spawnTimer = null;
  let gameLoopId = null;
  let menuOpenedAt = performance.now();
  let sessionSummary = null;
  let eventRows = [];

  // ----- helpers -----

  function showView(name) {
    viewMenu.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');
    viewResearchForm.classList.add('hidden');

    switch (name) {
      case 'menu': viewMenu.classList.remove('hidden'); break;
      case 'play': viewPlay.classList.remove('hidden'); break;
      case 'result': viewResult.classList.remove('hidden'); break;
      case 'research': viewResearchForm.classList.remove('hidden'); break;
    }
  }

  function resetHud() {
    statTime.textContent = '0.0';
    statScore.textContent = '0';
    statCombo.textContent = '0';
    statPhase.textContent = '1';
    statMiss.textContent = '0';
    statShield.textContent = '0';
    feverStatus.textContent = 'READY';
    feverStatus.classList.remove('on');
    wrap.classList.remove('sb-fever-on');
    if (feverFill) feverFill.style.transform = 'scaleX(0)';

    // HP bar ล่าง
    if (playerHpFill) playerHpFill.style.transform = 'scaleX(1)';
    if (bossHpFill) bossHpFill.style.transform = 'scaleX(1)';

    // HP bar บน
    if (hudPlayerHpTop) hudPlayerHpTop.style.transform = 'scaleX(1)';
    if (hudBossHpTop)   hudBossHpTop.style.transform   = 'scaleX(1)';

    if (feedbackEl) {
      feedbackEl.textContent = 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!';
      feedbackEl.className = 'sb-feedback';
    }
  }

  const randRange = (min, max) => min + Math.random() * (max - min);

  function pickWeighted(weights) {
    const total = weights.reduce((acc, w) => acc + w.w, 0);
    let r = Math.random() * total;
    for (const item of weights) {
      if (r < item.w) return item.v;
      r -= item.w;
    }
    return weights[weights.length - 1].v;
  }

  const currentBoss = () =>
    BOSSES[state.bossIndex] || BOSSES[BOSSES.length - 1];

  function updateBossUi() {
    const boss = currentBoss();
    wrap.dataset.boss = String(boss.id);
    wrap.dataset.phase = String(state.bossPhase);

    // การ์ดด้านข้าง
    const nameEl = document.getElementById('boss-portrait-name');
    const emojiEl = document.getElementById('boss-portrait-emoji');
    const hintEl = document.getElementById('boss-portrait-hint');

    if (nameEl) nameEl.textContent = boss.name;
    if (emojiEl) emojiEl.textContent = boss.emoji;
    if (hintEl) hintEl.textContent = boss.hint;

    // HUD บน
    if (hudBossNameTop) hudBossNameTop.textContent = boss.name;
    if (hudBossPortraitTop) hudBossPortraitTop.textContent = boss.emoji;

    statPhase.textContent = String(state.bossPhase);
  }

  function setFeedback(msg, tone) {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.className = 'sb-feedback';
    if (tone) feedbackEl.classList.add(tone);
  }

  function updateHpBars() {
    const vPlayer = Math.max(0, Math.min(1, state.playerHp));
    const vBoss   = Math.max(0, Math.min(1, state.bossHp));

    if (playerHpFill)   playerHpFill.style.transform   = `scaleX(${vPlayer})`;
    if (bossHpFill)     bossHpFill.style.transform     = `scaleX(${vBoss})`;
    if (hudPlayerHpTop) hudPlayerHpTop.style.transform = `scaleX(${vPlayer})`;
    if (hudBossHpTop)   hudBossHpTop.style.transform   = `scaleX(${vBoss})`;
  }

  function updateFeverUi(now) {
    if (!feverFill || !state) return;
    const v = Math.max(0, Math.min(1, state.fever));
    feverFill.style.transform = `scaleX(${v})`;

    if (state.feverOn && now >= state.feverUntil) {
      state.feverOn = false;
      feverStatus.textContent = 'READY';
      feverStatus.classList.remove('on');
      wrap.classList.remove('sb-fever-on');
    }

    // เผื่อกรณีมี FEVER แบบต่อเนื่อง
    if (state.feverOn) {
      wrap.classList.add('sb-fever-on');
    }
  }

  function applyHitToBoss(amount) {
    state.bossHp = Math.max(0, state.bossHp - amount);
    const prevPhase = state.bossPhase;
    if (state.bossHp > 0.66) state.bossPhase = 1;
    else if (state.bossHp > 0.33) state.bossPhase = 2;
    else state.bossPhase = 3;

    if (state.bossPhase !== prevPhase) updateBossUi();
    updateHpBars();

    if (state.bossHp <= 0) {
      state.clearedBosses++;
      state.bossIndex++;
      if (state.bossIndex >= BOSSES.length) {
        endGame('all-boss-cleared');
      } else {
        state.bossHp = 1;
        state.bossPhase = 1;
        state.bossFaceSpawned = false;
        updateBossUi();
      }
    }
  }

  function ensureRenderer() {
    if (renderer) return renderer;
    renderer = new DomRendererShadow(targetLayer, {
      wrapEl: wrap,
      feedbackEl,
      onTargetHit: handleTargetHit
    });
    renderer.setDifficulty(state?.diffKey || 'normal');
    return renderer;
  }

  function clearRenderer() {
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
  }

  function scheduleNextSpawn() {
    if (!state || !state.running) return;
    const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
    const delay = randRange(cfg.spawnIntervalMin, cfg.spawnIntervalMax);
    spawnTimer = setTimeout(() => {
      if (!state || !state.running) return;
      spawnOneTarget();
      scheduleNextSpawn();
    }, delay);
  }

  // เรียกหน้า boss-face ตอน HP ต่ำ
  function spawnBossFaceTarget() {
    const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
    const bossMeta = currentBoss();
    const now = performance.now();
    const id = state.nextTargetId++;

    const data = {
      id,
      type: 'bossface',
      bossIndex: state.bossIndex,
      bossPhase: state.bossPhase,
      spawnTime: now,
      isBossFace: true,
      bossEmoji: bossMeta.emoji,
      sizePx: cfg.baseSize * 1.8,
      timeoutAt: now + cfg.targetLifetime * 1.4
    };

    state.targets.set(id, data);
    ensureRenderer().spawnTarget(data);

    data.timeoutHandle = setTimeout(() => {
      if (!state.running) return;
      if (!state.targets.has(id)) return;
      state.targets.delete(id);
      if (renderer) renderer.removeTarget(id, 'timeout');
      state.miss++;
      statMiss.textContent = String(state.miss);
      state.combo = 0;
      statCombo.textContent = '0';
      setFeedback('พลาดหน้า boss! รอบหน้าลองโฟกัสให้ทัน 💥', 'miss');
      logEvent('timeout', data, { grade: 'miss' });
    }, cfg.targetLifetime * 1.4);
  }

  function spawnOneTarget() {
    const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;

    // ถ้า boss ใกล้ตาย และยังไม่เคย spawn boss-face ให้ spawn ก่อน
    if (!state.bossFaceSpawned && state.bossHp > 0 && state.bossHp <= BOSSFACE_THRESHOLD) {
      state.bossFaceSpawned = true;
      spawnBossFaceTarget();
      return;
    }

    const kind = pickWeighted([
      { v: 'normal', w: 70 },
      { v: 'decoy',  w: 10 },
      { v: 'bomb',   w: 8 },
      { v: 'heal',   w: 6 },
      { v: 'shield', w: 6 }
    ]);

    spawnTargetOfType(kind, { size: cfg.baseSize });
  }

  function spawnTargetOfType(kind, extra) {
    const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
    const now = performance.now();
    aconst id = state.nextTargetId++;
    const ttl = cfg.targetLifetime;

    const size = (extra && extra.size) || cfg.baseSize;

    const data = {
      id,
      type: kind,
      bossIndex: state.bossIndex,
      bossPhase: state.bossPhase,
      spawnTime: now,
      isBossFace: (extra && extra.isBossFace) || false,
      bossEmoji: extra && extra.bossEmoji,
      sizePx: size,
      timeoutAt: now + ttl,
      isDecoy: kind === 'decoy',
      isBomb: kind === 'bomb',
      isHeal: kind === 'heal',
      isShield: kind === 'shield'
    };

    state.targets.set(id, data);

    ensureRenderer().spawnTarget(data);

    // timeout → miss
    data.timeoutHandle = setTimeout(() => {
      if (!state || !state.running) return;
      if (!state.targets.has(id)) return;
      state.targets.delete(id);
      if (renderer) renderer.removeTarget(id, 'timeout');
      state.miss++;
      statMiss.textContent = String(state.miss);
      state.combo = 0;
      statCombo.textContent = '0';
      setFeedback('พลาดจังหวะ! ลองมองเป้าให้ชัดแล้วลองใหม่ 👀', 'miss');
      logEvent('timeout', data, { grade: 'miss' });
    }, ttl);
  }

  function handleTargetHit(id, hitInfo) {
    if (!state || !state.running) return;
    const data = state.targets.get(id);
    if (!data) return;

    state.targets.delete(id);
    if (data.timeoutHandle) clearTimeout(data.timeoutHandle);

    const now = performance.now();
    const rt = now - data.spawnTime;

    let grade = 'good';
    let scoreDelta = 100;
    let hpDeltaPlayer = 0;
    let bossDmg = 0;
    let shieldDelta = 0;

    if (data.type === 'bomb' || data.type === 'decoy') {
      grade = 'bomb';
      scoreDelta = -80;
      if (state.shield > 0) {
        shieldDelta = -1;
        setFeedback('เกราะช่วยไว้! แต่ระวังเป้าลวงให้ดี 👀', 'bad');
      } else {
        hpDeltaPlayer = -0.17;
        setFeedback('โดนระเบิด! HP ลดลง รีบตั้งหลักใหม่ 💥', 'bad');
      }
      state.combo = 0;
    } else if (data.type === 'heal') {
      grade = 'heal';
      scoreDelta = 60;
      hpDeltaPlayer = +0.15;
      setFeedback('เยี่ยม! ได้ HP เพิ่มขึ้น 🩹', 'good');
      state.combo++;
    } else if (data.type === 'shield') {
      grade = 'shield';
      scoreDelta = 60;
      shieldDelta = +1;
      setFeedback('ได้เกราะเพิ่ม ต้านระเบิดได้ชั่วคราว 🛡️', 'good');
      state.combo++;
    } else if (data.isBossFace) {
      grade = 'perfect';
      scoreDelta = 250;
      bossDmg = DIFF_CONFIG[state.diffKey].bossDamageBossFace;
      setFeedback('หมัดเด็ดใส่หน้าบอส! 💥', 'perfect');
      state.combo++;
    } else {
      // normal target
      if (rt < 220) {
        grade = 'perfect';
        scoreDelta = 160;
      } else if (rt < 480) {
        grade = 'good';
        scoreDelta = 120;
      } else {
        grade = 'bad';
        scoreDelta = 60;
      }
      bossDmg = DIFF_CONFIG[state.diffKey].bossDamageNormal;
      state.combo++;
      setFeedback(
        grade === 'perfect'
          ? 'สุดยอด! PERFECT 🎯'
          : grade === 'good'
          ? 'เยี่ยม! จังหวะกำลังดี 👍'
          : 'ช้าไปนิด ลองเร่งอีกนิดนะ 🔄',
        grade
      );
    }

    // FEVER gauge (เฉพาะ normal)
    if (data.type === 'normal') {
      state.fever += FEVER_CONFIG.perHit;
      if (!state.feverOn && state.fever >= 1) {
        state.feverOn = true;
        state.feverUntil = now + FEVER_CONFIG.durationMs;
        state.fever = 1;
        feverStatus.textContent = 'ON';
        feverStatus.classList.add('on');
        wrap.classList.add('sb-fever-on'); // เข้าโหมดไฟลุก
      }
    }

    // apply fever bonus
    if (state.feverOn) {
      scoreDelta = Math.round(scoreDelta * 1.5);
      bossDmg *= 1.25;
    }

    // apply changes
    state.score = Math.max(0, state.score + scoreDelta);
    if (hpDeltaPlayer !== 0) {
      state.playerHp = Math.max(0, Math.min(1, state.playerHp + hpDeltaPlayer));
    }
    if (shieldDelta !== 0) {
      state.shield = Math.max(0, state.shield + shieldDelta);
    }
    if (bossDmg > 0) {
      applyHitToBoss(bossDmg);
    }
    state.totalHits++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    statScore.textContent = String(state.score);
    statCombo.textContent = String(state.combo);
    statShield.textContent = String(state.shield);

    updateHpBars();
    updateFeverUi(now);

    if (renderer) {
      renderer.playHitFx(id, {
        grade,
        scoreDelta,
        clientX: hitInfo && hitInfo.clientX,
        clientY: hitInfo && hitInfo.clientY
      });
      renderer.removeTarget(id, 'hit');
    }

    logEvent('hit', data, { grade, rtMs: rt, scoreDelta });

    if (state.playerHp <= 0) {
      endGame('player-dead');
    }
  }

  function logEvent(type, targetData, extra) {
    const now = performance.now();
    const row = {
      ts_ms: Math.round(now - state.startedAt),
      mode: state.mode,
      diff: state.diffKey,
      boss_index: state.bossIndex,
      boss_phase: state.bossPhase,
      target_id: targetData ? targetData.id : '',
      target_type: targetData ? targetData.type : '',
      is_boss_face: targetData ? !!targetData.isBossFace : '',
      event_type: type,
      rt_ms: extra && extra.rtMs != null ? Math.round(extra.rtMs) : '',
      grade: (extra && extra.grade) || '',
      score_delta: (extra && extra.scoreDelta) || '',
      combo_after: state.combo,
      score_after: state.score,
      player_hp: state.playerHp.toFixed(3),
      boss_hp: state.bossHp.toFixed(3)
    };
    eventRows.push(row);

    if (type === 'hit') {
      if (targetData.type === 'decoy') {
        state.rtDecoySum += extra.rtMs;
        state.rtDecoyCount++;
      } else if (!targetData.isBossFace && targetData.type === 'normal') {
        state.rtNormalSum += extra.rtMs;
        state.rtNormalCount++;
      }
    }
  }

  function gameLoop(now) {
    if (!state || !state.running) return;

    const elapsed = now - state.lastTickAt;
    state.lastTickAt = now;
    state.timeLeftMs -= elapsed;

    if (state.fever > 0 && !state.feverOn) {
      state.fever = Math.max(0, state.fever - FEVER_CONFIG.decayPerSec * (elapsed / 1000));
    }
    if (state.feverOn) state.feverActiveMs += elapsed;
    if (state.playerHp <= LOWHP_THRESHOLD) state.lowHpMs += elapsed;

    if (state.timeLeftMs <= 0) {
      statTime.textContent = '0.0';
      endGame('time-up');
      return;
    }

    statTime.textContent = (state.timeLeftMs / 1000).toFixed(1);
    updateFeverUi(now);

    // safety: ตรวจ timeout เพิ่ม
    const nowTargets = Array.from(state.targets.values());
    for (const t of nowTargets) {
      if (now >= t.timeoutAt) {
        if (t.timeoutHandle) clearTimeout(t.timeoutHandle);
        state.targets.delete(t.id);
        if (renderer) renderer.removeTarget(t.id, 'timeout');
        state.miss++;
        statMiss.textContent = String(state.miss);
        state.combo = 0;
        statCombo.textContent = '0';
        logEvent('timeout', t, { grade: 'miss' });
      }
    }

    gameLoopId = requestAnimationFrame(gameLoop);
  }

  function endGame(reason) {
    if (!state || !state.running) return;
    state.running = false;

    if (spawnTimer) {
      clearTimeout(spawnTimer);
      spawnTimer = null;
    }
    if (gameLoopId) {
      cancelAnimationFrame(gameLoopId);
      gameLoopId = null;
    }

    if (renderer) {
      for (const id of state.targets.keys()) {
        renderer.removeTarget(id, 'end');
      }
    }
    state.targets.clear();

    wrap.classList.remove('sb-fever-on');

    const totalTrials = state.totalHits + state.miss;
    const acc = totalTrials > 0 ? (state.totalHits / totalTrials) * 100 : 0;

    sessionSummary = {
      mode: state.mode,
      diff: state.diffKey,
      diff_label: DIFF_CONFIG[state.diffKey].label,
      reason,
      duration_sec: state.durationSec,
      time_left_sec: +(state.timeLeftMs / 1000).toFixed(2),
      score: state.score,
      accuracy_pct: +acc.toFixed(2),
      max_combo: state.maxCombo,
      total_hits: state.totalHits,
      miss: state.miss,
      fever_time_sec: +(state.feverActiveMs / 1000).toFixed(2),
      lowhp_time_sec: +(state.lowHpMs / 1000).toFixed(2),
      bosses_cleared: state.clearedBosses,
      participant_id: (state.researchMeta && state.researchMeta.id) || '',
      participant_group: (state.researchMeta && state.researchMeta.group) || '',
      participant_note: (state.researchMeta && state.researchMeta.note) || '',
      menu_latency_ms: Math.round(state.startedAt - menuOpenedAt),
      rt_normal_ms: state.rtNormalCount ? +(state.rtNormalSum / state.rtNormalCount).toFixed(1) : '',
      rt_decoy_ms: state.rtDecoyCount ? +(state.rtDecoySum / state.rtDecoyCount).toFixed(1) : ''
    };

    // result view
    resMode.textContent = state.mode === 'research' ? 'โหมดวิจัย' : 'โหมดเล่นจริง';
    resDiff.textContent = DIFF_CONFIG[state.diffKey].label;
    resEndReason.textContent =
      reason === 'time-up' ? 'หมดเวลา' :
      reason === 'player-dead' ? 'HP ผู้เล่นหมด' :
      reason === 'all-boss-cleared' ? 'เคลียร์บอสครบทุกตัว' :
      reason === 'stop-early' ? 'หยุดเล่นก่อนเวลา' : reason;

    resScore.textContent = String(state.score);
    resAccuracy.textContent = acc.toFixed(1) + ' %';
    resMaxCombo.textContent = String(state.maxCombo);
    resTotalHits.textContent = String(state.totalHits);
    resMiss.textContent = String(state.miss);
    resFeverTime.textContent = (state.feverActiveMs / 1000).toFixed(1) + ' s';
    resLowHpTime.textContent = (state.lowHpMs / 1000).toFixed(1) + ' s';
    resBosses.textContent = String(state.clearedBosses);
    resMenuLatency.textContent = Math.round(state.startedAt - menuOpenedAt) + ' ms';
    resParticipant.textContent = sessionSummary.participant_id || '-';
    resRtNormal.textContent = sessionSummary.rt_normal_ms || '-';
    resRtDecoy.textContent = sessionSummary.rt_decoy_ms || '-';

    if (acc >= 90) resGrade.textContent = 'S';
    else if (acc >= 80) resGrade.textContent = 'A';
    else if (acc >= 70) resGrade.textContent = 'B';
    else if (acc >= 60) resGrade.textContent = 'C';
    else resGrade.textContent = 'D';

    resEndHint.textContent =
      reason === 'time-up'
        ? 'ลองลดระดับความยาก หรือเพิ่มเวลาออร์มก่อนเล่นรอบถัดไป 🧘‍♂️'
        : reason === 'player-dead'
        ? 'ระวังเป้าระเบิด/เป้าลวงให้มากขึ้น และพยายามเก็บ Heal / Shield ให้ทัน 💊'
        : '';

    showView('result');
  }

  function downloadCsv(filenameBase, rows) {
    if (!rows || !rows.length) {
      alert('ยังไม่มีข้อมูลสำหรับดาวน์โหลด');
      return;
    }
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const r of rows) {
      const line = headers.map(h => {
        const val = r[h];
        if (val == null) return '';
        const s = String(val).replace(/"/g, '""');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s}"`;
        }
        return s;
      }).join(',');
      lines.push(line);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = filenameBase + '_' + stamp + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const buildSessionRows = () => (sessionSummary ? [sessionSummary] : []);

  // ----- wire buttons (กัน null + กันกดซ้ำตอนกำลังเล่น) -----

  if (btnStartNormal) {
    btnStartNormal.addEventListener('click', () => {
      if (state && state.running) return;
      startGame('normal', null);
    });
  }

  if (btnStartResearch) {
    btnStartResearch.addEventListener('click', () => {
      if (state && state.running) return;
      showView('research');
    });
  }

  if (btnResearchBegin) {
    btnResearchBegin.addEventListener('click', () => {
      if (state && state.running) return;

      const id = researchIdInput.value.trim();
      const group = researchGroupInput.value.trim();
      const note = researchNoteInput.value.trim();

      if (!id) {
        alert('กรุณาระบุ "รหัสผู้เข้าร่วม / รหัสนักเรียน" ก่อนเริ่มโหมดวิจัย');
        researchIdInput.focus();
        return;
      }

      startGame('research', { id, group, note });
    });
  }

  if (btnBackFromResearch) {
    btnBackFromResearch.addEventListener('click', () => {
      if (state && state.running) return;
      showView('menu');
    });
  }

  if (btnStopEarly) {
    btnStopEarly.addEventListener('click', () => {
      if (!state || !state.running) return;
      endGame('stop-early');
    });
  }

  if (btnBackFromPlay) {
    btnBackFromPlay.addEventListener('click', () => {
      if (state && state.running) {
        endGame('stop-early');
      } else {
        showView('menu');
      }
    });
  }

  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      showView('menu');
    });
  }

  if (btnBackFromResult) {
    btnBackFromResult.addEventListener('click', () => {
      showView('menu');
    });
  }

  if (btnDownloadSession) {
    btnDownloadSession.addEventListener('click', () => {
      downloadCsv('shadow-breaker_session', buildSessionRows());
    });
  }

  if (btnDownloadEvents) {
    btnDownloadEvents.addEventListener('click', () => {
      downloadCsv('shadow-breaker_events', eventRows);
    });
  }

  function startGame(mode, researchMeta) {
    const diffKey = difficultySel.value || 'normal';
    const durationSec = parseInt(durationSel.value || '60', 10);
    DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal; // validate

    clearRenderer();
    resetHud();

    state = {
      mode,
      diffKey,
      durationSec,
      running: true,
      timeLeftMs: durationSec * 1000,
      score: 0,
      combo: 0,
      maxCombo: 0,
      miss: 0,
      shield: 0,
      fever: 0,
      feverOn: false,
      feverUntil: 0,
      feverActiveMs: 0,
      lowHpMs: 0,
      playerHp: 1,
      bossHp: 1,
      bossIndex: 0,
      bossPhase: 1,
      bossFaceSpawned: false,
      clearedBosses: 0,
      totalHits: 0,
      targets: new Map(),
      nextTargetId: 1,
      startedAt: performance.now(),
      lastTickAt: performance.now(),
      researchMeta: researchMeta || null,
      rtNormalSum: 0,
      rtNormalCount: 0,
      rtDecoySum: 0,
      rtDecoyCount: 0
    };

    eventRows = [];

    wrap.dataset.diff = diffKey;
    wrap.dataset.phase = '1';
    wrap.dataset.boss = '0';

    renderer = new DomRendererShadow(targetLayer, {
      wrapEl: wrap,
      feedbackEl,
      onTargetHit: handleTargetHit
    });
    renderer.setDifficulty(diffKey);

    updateBossUi();
    updateHpBars();
    updateFeverUi(state.startedAt);

    showView('play');

    // boss intro overlay
    if (bossIntro) {
      const boss = currentBoss();
      const introEmoji = document.getElementById('boss-intro-emoji');
      const introName = document.getElementById('boss-intro-name');
      const introTitle = document.getElementById('boss-intro-title');
      const introDesc = document.getElementById('boss-intro-desc');

      if (introEmoji) introEmoji.textContent = boss.emoji;
      if (introName) introName.textContent = boss.name;
      if (introTitle) introTitle.textContent = 'เริ่มต่อสู้กับบอสตัวแรก!';
      if (introDesc) introDesc.textContent = boss.hint;

      bossIntro.classList.remove('hidden');

      const startFromIntro = () => {
        bossIntro.classList.add('hidden');
        bossIntro.removeEventListener('click', startFromIntro);
        state.lastTickAt = performance.now();
        gameLoopId = requestAnimationFrame(gameLoop);
        scheduleNextSpawn();
      };
      bossIntro.addEventListener('click', startFromIntro);
    } else {
      state.lastTickAt = performance.now();
      gameLoopId = requestAnimationFrame(gameLoop);
      scheduleNextSpawn();
    }
  }

  // initial
  resetHud();
  showView('menu');
  menuOpenedAt = performance.now();

  console.log('[ShadowBreaker] init complete');
}
