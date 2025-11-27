// === js/engine.js — Shadow Breaker Engine (2025-12-03 Production Ready) ===
'use strict';
import { DomRendererShadow } from './dom-renderer-shadow.js';

export function initShadowBreaker() {
  const wrap = document.querySelector('#sb-wrap');
  const layer = document.querySelector('#target-layer');
  const feedback = document.querySelector('#sb-feedback');
  const flash = document.querySelector('#rb-flash');

  const stat = {
    score: document.getElementById('stat-score'),
    combo: document.getElementById('stat-combo'),
    miss: document.getElementById('stat-miss'),
    shield: document.getElementById('stat-shield'),
    phase: document.getElementById('stat-phase'),
    time: document.getElementById('stat-time'),
    fever: document.getElementById('fever-status'),
  };

  let running = false;
  let timeLeft = 60;
  let diffKey = 'normal';
  let mode = 'normal';
  let player = { hp: 100, shield: 0 };
  let boss = { hp: 100, phase: 1 };
  let score = 0, combo = 0, miss = 0;
  let fever = 0, feverActive = false;
  let renderer = null;
  let spawnTimer = null, timer = null;
  let researchMeta = {};

  // ---------------- INIT ----------------
  function start(selectedMode, diff, durSec, meta = {}) {
    if (running) return;
    mode = selectedMode || 'normal';
    diffKey = diff || 'normal';
    timeLeft = durSec || 60;
    researchMeta = meta;

    // ✅ ป้องกันเล่นโหมดวิจัยโดยไม่กรอก ID
    if (mode === 'research' && !meta.id) {
      alert('กรุณากรอกรหัสผู้เข้าร่วม (เช่น P001) ก่อนเริ่มโหมดวิจัย');
      return;
    }

    running = true;
    score = combo = miss = fever = 0;
    player.hp = 100;
    boss.hp = 100;
    boss.phase = 1;
    player.shield = 0;
    feverActive = false;

    renderer = new DomRendererShadow(layer, {
      flashEl: flash,
      feedbackEl: feedback,
      onTargetHit: onTargetHit,
    });
    renderer.setDifficulty(diffKey);

    updateHUD();
    showFeedback('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!');
    wrap.dataset.phase = 1;

    // ✅ ให้ DOM เต็มก่อนค่อย spawn เป้า
    setTimeout(spawnLoop, 600);
    timer = setInterval(tick, 1000);
  }

  // ---------------- GAME LOOP ----------------
  function tick() {
    if (!running) return;
    timeLeft -= 1;
    if (timeLeft <= 0) endGame('หมดเวลา');
    updateHUD();
  }

  function spawnLoop() {
    if (!running) return;

    // ความเร็ว spawn ตาม diff
    const interval =
      diffKey === 'easy' ? 1000 :
      diffKey === 'hard' ? 600 : 800;

    spawnTarget();
    spawnTimer = setTimeout(spawnLoop, interval);
  }

  // ---------------- TARGET ----------------
  let targetId = 0;
  function spawnTarget() {
    if (!renderer) return;
    const id = ++targetId;
    const sizePx =
      diffKey === 'easy' ? 140 :
      diffKey === 'hard' ? 90 : 110;

    const t = {
      id,
      sizePx,
      bossPhase: boss.phase,
      type: pickType(),
    };

    renderer.spawnTarget(t);
    // ลบเมื่อหมดเวลา
    setTimeout(() => {
      if (renderer.targets.has(id)) {
        renderer.removeTarget(id, 'timeout');
        miss++;
        combo = 0;
        updateHUD();
      }
    }, 1800);
  }

  function pickType() {
    const r = Math.random();
    if (r < 0.1) return 'bomb';
    if (r < 0.2) return 'heal';
    if (r < 0.3) return 'shield';
    return 'normal';
  }

  // ---------------- HIT ----------------
  function onTargetHit(id, { clientX, clientY }) {
    const rec = renderer.targets.get(id);
    if (!rec) return;

    const type = rec.data.type;
    let grade = 'good';
    let delta = 0;

    if (type === 'bomb') {
      // ✅ ใช้ Shield ก่อน HP
      if (player.shield > 0) {
        player.shield--;
        showFeedback('เกราะแตก 1 ชั้น 🛡️');
      } else {
        player.hp = Math.max(0, player.hp - 20);
        showFeedback('พลาด! โดนระเบิด 💥');
      }
      grade = 'bomb';
    }
    else if (type === 'heal') {
      player.hp = Math.min(100, player.hp + 10);
      grade = 'heal';
      delta = 100;
      showFeedback('ฟื้นพลัง ❤️‍🔥');
    }
    else if (type === 'shield') {
      player.shield++;
      grade = 'shield';
      delta = 50;
      showFeedback('ได้เกราะเพิ่ม 🛡️');
    }
    else {
      // normal
      grade = Math.random() < 0.5 ? 'perfect' : 'good';
      delta = grade === 'perfect' ? 300 : 150;
      combo++;
      score += delta;
      boss.hp = Math.max(0, boss.hp - 3);
    }

    renderer.playHitFx(id, { grade, scoreDelta: delta, clientX, clientY });
    renderer.removeTarget(id, 'hit');
    updateHUD();

    // ตรวจ phase
    if (boss.hp <= 0) nextBossPhase();
  }

  // ---------------- BOSS ----------------
  function nextBossPhase() {
    if (boss.phase >= 3) {
      endGame('ชนะบอสแล้ว!');
      return;
    }
    boss.phase++;
    boss.hp = 100;
    wrap.dataset.phase = boss.phase;
    showFeedback(`เข้าสู่ Phase ${boss.phase} 🔥`);
    clearTimeout(spawnTimer);
    setTimeout(spawnLoop, 1000);
  }

  // ---------------- HUD & FEEDBACK ----------------
  function updateHUD() {
    stat.score.textContent = score;
    stat.combo.textContent = combo;
    stat.miss.textContent = miss;
    stat.shield.textContent = player.shield;
    stat.phase.textContent = boss.phase;
    stat.time.textContent = timeLeft.toFixed(1);
  }

  function showFeedback(msg) {
    feedback.textContent = msg;
  }

  // ---------------- END ----------------
  function endGame(reason) {
    running = false;
    clearInterval(timer);
    clearTimeout(spawnTimer);
    showFeedback(`จบเกม: ${reason}`);
    if (renderer) renderer.destroy();
  }

  // ---------------- MENU EVENTS ----------------
  const btnNormal = document.querySelector('[data-action="start-normal"]');
  const btnResearch = document.querySelector('[data-action="start-research"]');
  const btnResearchBegin = document.querySelector('[data-action="research-begin-play"]');
  const btnStop = document.querySelector('[data-action="stop-early"]');

  function getDiffKey() {
    return document.getElementById('difficulty').value;
  }
  function getDurationSec() {
    return Number(document.getElementById('duration').value || 60);
  }

  function collectResearchMeta() {
    return {
      id: document.getElementById('research-id')?.value.trim(),
      group: document.getElementById('research-group')?.value.trim(),
      note: document.getElementById('research-note')?.value.trim(),
    };
  }

  btnNormal?.addEventListener('click', () => {
    const diff = getDiffKey();
    const dur = getDurationSec();
    start('normal', diff, dur);
  });

  btnResearch?.addEventListener('click', () => {
    showView('research-form');
  });

  btnResearchBegin?.addEventListener('click', () => {
    const diff = getDiffKey();
    const dur = getDurationSec();
    const meta = collectResearchMeta();
    start('research', diff, dur, meta);
    showView('play');
  });

  btnStop?.addEventListener('click', () => {
    endGame('หยุดก่อนเวลา');
  });

  function showView(view) {
    document.querySelectorAll('.sb-card').forEach(v => v.classList.add('hidden'));
    document.querySelector(`#view-${view}`)?.classList.remove('hidden');
  }
}
