// === /fitness/js/engine.js ===
// Shadow Breaker Engine — "No-crash" module (binds UI + playable core)
// ✅ Works with your shadow-breaker.html IDs exactly
// ✅ No static imports (avoids export mismatch breaking the whole page)
// ✅ Menu -> Play -> Result view switching
// ✅ Spawns clickable targets inside #sb-target-layer
// ✅ Basic boss phases + HP + Shield + FEVER + Score/Combo/Miss
// ✅ CSV download for Events / Session (built-in)

'use strict';

(function () {
  // This file is loaded as <script type="module">, but we keep everything self-contained.
  const WIN = window;
  const DOC = document;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const clamp01 = (v) => clamp(v, 0, 1);

  function qs(name, d = null) {
    try { return new URL(location.href).searchParams.get(name) ?? d; } catch { return d; }
  }
  function nowMs() { return (WIN.performance && performance.now) ? performance.now() : Date.now(); }

  // ----- RNG (deterministic optional) -----
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ----- DOM helpers -----
  const el = (id) => DOC.getElementById(id);
  function safeText(node, text) { if (node) node.textContent = String(text); }
  function safeShow(node, on) { if (node) node.style.display = on ? '' : 'none'; }

  // ----- Views -----
  function showView(viewId) {
    const ids = ['sb-view-menu', 'sb-view-play', 'sb-view-result'];
    for (const id of ids) {
      const v = el(id);
      if (!v) continue;
      v.classList.toggle('is-active', id === viewId);
    }
  }

  // ----- Built-in CSV helpers -----
  function toCsv(rows) {
    if (!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const out = [];
    out.push(cols.join(','));
    for (const r of rows) out.push(cols.map(c => esc(r[c])).join(','));
    return out.join('\n');
  }
  function downloadText(text, filename) {
    try {
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('downloadText failed', e);
      alert('ดาวน์โหลดไม่สำเร็จ');
    }
  }

  // ----- Game config -----
  const BOSSES = [
    { name: 'Bubble Glove', emoji: '🐣', desc: 'โฟกัสฟองใหญ่ แล้วตีให้ทัน' },
    { name: 'Neon Mantis', emoji: '🦗', desc: 'เร็วขึ้น—อย่าหลงเป้าล่อ' },
    { name: 'Iron Kraken', emoji: '🐙', desc: 'ยาวขึ้น—ต้องคุมจังหวะและ HP' },
  ];

  const TARGET_TYPES = {
    normal: { label: 'NORMAL', score: 10, bossDmg: 4, youDmg: 0, fever: 0.07, shield: 0, lifeMs: 900 },
    decoy:  { label: 'DECOY',  score: -5, bossDmg: 0, youDmg: 6, fever: 0.00, shield: 0, lifeMs: 800 },
    bomb:   { label: 'BOMB',   score: -12,bossDmg: 0, youDmg: 10,fever: 0.00, shield: 0, lifeMs: 700 },
    heal:   { label: 'HEAL',   score: 2,  bossDmg: 0, youDmg: -10,fever: 0.03, shield: 0, lifeMs: 950 },
    shield: { label: 'SHIELD', score: 3,  bossDmg: 0, youDmg: 0, fever: 0.03, shield: 1, lifeMs: 950 },
  };

  function pickTargetType(r, diff) {
    // simple weighted pick; harder => more decoy/bomb
    const u = r();
    if (diff === 'easy') {
      if (u < 0.70) return 'normal';
      if (u < 0.80) return 'heal';
      if (u < 0.90) return 'shield';
      return 'decoy';
    }
    if (diff === 'hard') {
      if (u < 0.55) return 'normal';
      if (u < 0.65) return 'decoy';
      if (u < 0.75) return 'bomb';
      if (u < 0.87) return 'shield';
      return 'heal';
    }
    // normal
    if (u < 0.62) return 'normal';
    if (u < 0.72) return 'decoy';
    if (u < 0.80) return 'bomb';
    if (u < 0.90) return 'shield';
    return 'heal';
  }

  // ----- State -----
  const S = {
    running: false,
    paused: false,
    mode: 'normal', // normal | research
    diff: 'normal',
    durationSec: 70,
    seed: 0,
    rng: Math.random,

    // metrics
    t0: 0,
    tEnd: 0,
    timeLeftMs: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    hits: 0,
    judged: 0,

    youHp: 100,
    bossHp: 100,
    shield: 0,

    phase: 1,
    bossIndex: 0,
    bossesCleared: 0,

    fever: 0,         // 0..1
    feverActive: false,
    feverUntil: 0,

    // logs
    events: [],
    session: {},

    // pacing
    spawnBaseMs: 520,
    spawnMs: 520,
  };

  // ----- Elements (menu) -----
  const UI = {};
  function mapUI() {
    UI.wrap = el('sb-wrap');
    UI.layer = el('sb-target-layer');

    UI.modeNormal = el('sb-mode-normal');
    UI.modeResearch = el('sb-mode-research');
    UI.modeDesc = el('sb-mode-desc');
    UI.researchBox = el('sb-research-box');

    UI.selDiff = el('sb-diff');
    UI.selTime = el('sb-time');

    UI.partId = el('sb-part-id');
    UI.partGroup = el('sb-part-group');
    UI.partNote = el('sb-part-note');

    UI.btnPlay = el('sb-btn-play');
    UI.btnResearch = el('sb-btn-research');
    UI.btnHowto = el('sb-btn-howto');
    UI.boxHowto = el('sb-howto');

    // play HUD
    UI.textTime = el('sb-text-time');
    UI.textScore = el('sb-text-score');
    UI.textCombo = el('sb-text-combo');
    UI.textPhase = el('sb-text-phase');
    UI.textMiss = el('sb-text-miss');
    UI.textShield = el('sb-text-shield');
    UI.bossName = el('sb-current-boss-name');

    UI.hpYouTop = el('sb-hp-you-top');
    UI.hpBossTop = el('sb-hp-boss-top');
    UI.hpYouBottom = el('sb-hp-you-bottom');
    UI.hpBossBottom = el('sb-hp-boss-bottom');

    UI.feverBar = el('sb-fever-bar');
    UI.feverLabel = el('sb-label-fever');

    UI.msgMain = el('sb-msg-main');

    UI.metaEmoji = el('sb-meta-emoji');
    UI.metaName = el('sb-meta-name');
    UI.metaDesc = el('sb-meta-desc');
    UI.bossPhaseLabel = el('sb-boss-phase-label');
    UI.bossShieldLabel = el('sb-boss-shield-label');

    UI.btnBackMenu = el('sb-btn-back-menu');
    UI.chkPause = el('sb-btn-pause');

    // result
    UI.resTime = el('sb-res-time');
    UI.resScore = el('sb-res-score');
    UI.resMaxCombo = el('sb-res-max-combo');
    UI.resMiss = el('sb-res-miss');
    UI.resPhase = el('sb-res-phase');
    UI.resBossCleared = el('sb-res-boss-cleared');
    UI.resAcc = el('sb-res-acc');
    UI.resGrade = el('sb-res-grade');

    UI.btnRetry = el('sb-btn-result-retry');
    UI.btnMenu = el('sb-btn-result-menu');
    UI.btnDL_Events = el('sb-btn-download-events');
    UI.btnDL_Session = el('sb-btn-download-session');
  }

  function setBar(fillEl, pct) {
    if (!fillEl) return;
    fillEl.style.width = `${clamp(pct, 0, 100)}%`;
  }

  function setMode(mode) {
    S.mode = (mode === 'research') ? 'research' : 'normal';

    if (UI.modeNormal) UI.modeNormal.classList.toggle('is-active', S.mode === 'normal');
    if (UI.modeResearch) UI.modeResearch.classList.toggle('is-active', S.mode === 'research');

    safeShow(UI.researchBox, S.mode === 'research');

    // Start buttons: normal uses "Start Game"; research uses "Start Research"
    safeShow(UI.btnPlay, S.mode === 'normal');
    safeShow(UI.btnResearch, S.mode === 'research');

    if (UI.modeDesc) {
      UI.modeDesc.textContent =
        (S.mode === 'research')
          ? 'Research: เก็บข้อมูลเป็นระบบ (Session/Event CSV) — แนะนำกรอก Participant ID'
          : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
    }
  }

  // ----- AI bridge (optional) -----
  function maybeAI_predict(snapshot) {
    try {
      const api = WIN.RB_AI;
      if (!api || typeof api.predict !== 'function') return null;
      if (typeof api.isLocked === 'function' && api.isLocked()) return null; // research lock
      if (typeof api.isAssistEnabled === 'function' && !api.isAssistEnabled()) return null;
      return api.predict(snapshot || {});
    } catch {
      return null;
    }
  }

  // ----- Update HUD -----
  function updateBossMeta() {
    const b = BOSSES[S.bossIndex % BOSSES.length];
    safeText(UI.bossName, `${b.name} ${b.emoji}`);
    safeText(UI.metaEmoji, b.emoji);
    safeText(UI.metaName, b.name);
    safeText(UI.metaDesc, b.desc);
    safeText(UI.textPhase, S.phase);
    safeText(UI.bossPhaseLabel, S.phase);
    safeText(UI.bossShieldLabel, S.shield);
  }

  function updateHUD() {
    const t = Math.max(0, S.timeLeftMs);
    safeText(UI.textTime, `${(t / 1000).toFixed(1)} s`);
    safeText(UI.textScore, S.score);
    safeText(UI.textCombo, S.combo);
    safeText(UI.textMiss, S.miss);
    safeText(UI.textShield, S.shield);

    setBar(UI.hpYouTop, S.youHp);
    setBar(UI.hpYouBottom, S.youHp);
    setBar(UI.hpBossTop, S.bossHp);
    setBar(UI.hpBossBottom, S.bossHp);

    const feverPct = clamp01(S.fever) * 100;
    setBar(UI.feverBar, feverPct);
    if (UI.feverLabel) {
      UI.feverLabel.textContent = S.feverActive ? 'FEVER!' : (S.fever >= 1 ? 'READY' : 'BUILD');
    }
  }

  // ----- Spawning targets -----
  function clearLayer() {
    if (!UI.layer) return;
    UI.layer.innerHTML = '';
  }

  function createTarget(type, lifeMs) {
    const t = DOC.createElement('button');
    t.type = 'button';
    t.className = `sb-target sb-target--${type}`;
    t.dataset.type = type;
    t.style.position = 'absolute';
    t.style.border = '0';
    t.style.cursor = 'pointer';

    // emoji label (simple)
    let emoji = '🥊';
    if (type === 'decoy') emoji = '💨';
    if (type === 'bomb') emoji = '💣';
    if (type === 'heal') emoji = '❤️';
    if (type === 'shield') emoji = '🛡️';
    t.textContent = emoji;

    // size
    const base = (S.diff === 'easy') ? 78 : (S.diff === 'hard') ? 62 : 70;
    const size = base + Math.round((S.rng() - 0.5) * 18);
    t.style.width = `${size}px`;
    t.style.height = `${size}px`;
    t.style.borderRadius = '999px';
    t.style.display = 'grid';
    t.style.placeItems = 'center';
    t.style.fontSize = `${Math.round(size * 0.46)}px`;
    t.style.userSelect = 'none';

    // color-ish via inline so it works even if CSS not perfect
    const bg =
      (type === 'normal') ? 'rgba(56,189,248,0.22)' :
      (type === 'decoy') ? 'rgba(148,163,184,0.16)' :
      (type === 'bomb') ? 'rgba(244,63,94,0.18)' :
      (type === 'heal') ? 'rgba(34,197,94,0.18)' :
      'rgba(250,204,21,0.16)';
    t.style.background = bg;
    t.style.boxShadow = '0 10px 26px rgba(0,0,0,0.45)';
    t.style.backdropFilter = 'blur(6px)';
    t.style.border = '1px solid rgba(148,163,184,0.35)';

    // position within layer bounds
    const layerRect = UI.layer.getBoundingClientRect();
    const pad = 12;
    const maxX = Math.max(pad, layerRect.width - size - pad);
    const maxY = Math.max(pad, layerRect.height - size - pad);
    const x = pad + Math.round(S.rng() * maxX);
    const y = pad + Math.round(S.rng() * maxY);
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;

    // timing
    const born = nowMs();
    const dieAt = born + lifeMs;
    t.dataset.born = String(born);
    t.dataset.dieAt = String(dieAt);

    return t;
  }

  function logEvent(evt) {
    S.events.push(evt);
  }

  function gradeFromScoreAcc(score, acc, miss) {
    // Simple, fun grading
    const a = clamp01(acc);
    if (a > 0.92 && miss <= 6 && score >= 900) return 'SSS';
    if (a > 0.88 && score >= 700) return 'SS';
    if (a > 0.82 && score >= 520) return 'S';
    if (a > 0.72) return 'A';
    if (a > 0.62) return 'B';
    return 'C';
  }

  function applyHit(type, rtMs) {
    const cfg = TARGET_TYPES[type] || TARGET_TYPES.normal;

    S.judged += 1;
    S.hits += 1;

    // combo
    S.combo += 1;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;

    // fever
    S.fever = clamp01(S.fever + cfg.fever);
    if (!S.feverActive && S.fever >= 1) {
      // ready => auto trigger short FEVER burst
      S.feverActive = true;
      S.feverUntil = nowMs() + 6500;
      S.fever = 1;
      safeText(UI.msgMain, '🔥 FEVER! ดาเมจ/คะแนนเพิ่มช่วงสั้น ๆ');
    }

    // shield pickup
    if (cfg.shield > 0) S.shield += cfg.shield;

    // damage modifiers
    const feverMul = S.feverActive ? 1.6 : 1.0;

    // you HP change
    let youDelta = cfg.youDmg;
    // if decoy/bomb and you have shield -> block
    if (youDelta > 0 && S.shield > 0) {
      S.shield -= 1;
      youDelta = 0;
      safeText(UI.msgMain, '🛡️ Shield บล็อกความเสียหาย!');
    }
    S.youHp = clamp(S.youHp - youDelta, 0, 100);

    // boss HP change
    const bossDmg = cfg.bossDmg * feverMul;
    S.bossHp = clamp(S.bossHp - bossDmg, 0, 100);

    // score
    const sDelta = Math.round(cfg.score * feverMul);
    S.score += sDelta;

    // log
    logEvent({
      ts_ms: Math.round(Date.now()),
      mode: S.mode,
      diff: S.diff,
      phase: S.phase,
      boss_index: S.bossIndex,
      event_type: 'hit',
      target_type: type,
      rt_ms: Math.round(rtMs),
      score_delta: sDelta,
      score_after: S.score,
      combo_after: S.combo,
      miss_after: S.miss,
      you_hp: S.youHp,
      boss_hp: Math.round(S.bossHp),
      shield_after: S.shield,
      fever: Number(S.fever.toFixed(3)),
      fever_active: S.feverActive ? 1 : 0,
    });

    // boss phase clear
    if (S.bossHp <= 0) {
      S.bossesCleared += 1;
      S.phase += 1;
      S.bossIndex = (S.bossIndex + 1) % BOSSES.length;
      // harder each phase
      S.bossHp = clamp(78 + S.phase * 8, 0, 100);
      safeText(UI.msgMain, '💥 ชนะบอส! เข้าสู่เฟสถัดไป!');
      updateBossMeta();
    }

    // end if player dead
    if (S.youHp <= 0) {
      safeText(UI.msgMain, '💀 HP หมด! จบเกม');
      endGame();
    }
  }

  function applyMiss(type) {
    S.judged += 1;
    S.miss += 1;

    // combo break
    S.combo = 0;

    // small penalty
    const penalty = (type === 'normal') ? 8 : 4;
    S.score = Math.max(0, S.score - penalty);

    // slight fever decay on miss
    S.fever = clamp01(S.fever - 0.10);

    logEvent({
      ts_ms: Math.round(Date.now()),
      mode: S.mode,
      diff: S.diff,
      phase: S.phase,
      boss_index: S.bossIndex,
      event_type: 'miss',
      target_type: type,
      rt_ms: '',
      score_delta: -penalty,
      score_after: S.score,
      combo_after: S.combo,
      miss_after: S.miss,
      you_hp: S.youHp,
      boss_hp: Math.round(S.bossHp),
      shield_after: S.shield,
      fever: Number(S.fever.toFixed(3)),
      fever_active: S.feverActive ? 1 : 0,
    });

    // tiny chip to keep pressure
    safeText(UI.msgMain, '⏱️ พลาด! รีบคุมจังหวะ + อย่าหลงเป้าล่อ');
  }

  function spawnOnce() {
    if (!S.running || S.paused) return;

    const type = pickTargetType(S.rng, S.diff);
    const cfg = TARGET_TYPES[type] || TARGET_TYPES.normal;
    const lifeMs = cfg.lifeMs + Math.round((S.rng() - 0.5) * 180);

    const t = createTarget(type, lifeMs);
    if (!t) return;

    const born = Number(t.dataset.born) || nowMs();
    const dieAt = Number(t.dataset.dieAt) || (born + lifeMs);

    // hit handler
    const onHit = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      if (!S.running) return;
      const rt = Math.max(0, nowMs() - born);

      // remove immediately
      try { t.remove(); } catch {}

      applyHit(type, rt);

      // AI micro tip (optional)
      const acc = S.judged ? (S.hits / S.judged) : 0;
      const snapshot = {
        accPct: acc * 100,
        hitMiss: S.miss,
        combo: S.combo,
        hp: S.youHp,
        durationSec: S.durationSec,
      };
      const ai = maybeAI_predict(snapshot);
      if (ai && ai.tip) safeText(UI.msgMain, `🤖 ${ai.tip}`);

      updateHUD();
    };

    // click/touch friendly
    t.addEventListener('pointerdown', onHit, { passive: false });

    UI.layer.appendChild(t);

    // miss timeout
    WIN.setTimeout(() => {
      if (!S.running) return;
      if (!t.isConnected) return;

      // time passed => miss
      try { t.remove(); } catch {}
      applyMiss(type);
      updateHUD();
    }, Math.max(60, dieAt - nowMs()));
  }

  function recomputePacing() {
    // Fair adaptive pacing (play only)
    // research mode = lock pacing stable
    if (S.mode === 'research') {
      S.spawnMs = S.spawnBaseMs;
      return;
    }

    // estimate skill from acc & miss
    const acc = S.judged ? (S.hits / S.judged) : 0.7;
    const missRate = S.judged ? (S.miss / S.judged) : 0.25;

    // base per difficulty
    const base =
      (S.diff === 'easy') ? 620 :
      (S.diff === 'hard') ? 430 :
      520;

    // adapt: better acc => faster; high miss => slower
    let ms = base;
    ms *= (1.15 - acc * 0.30);
    ms *= (0.85 + missRate * 0.55);

    // fever => slightly faster (more exciting)
    if (S.feverActive) ms *= 0.92;

    S.spawnMs = clamp(ms, 260, 900);
  }

  function spawnLoop() {
    if (!S.running) return;
    if (!S.paused) {
      spawnOnce();
      recomputePacing();
    }
    WIN.setTimeout(spawnLoop, Math.round(S.spawnMs));
  }

  // ----- Game loop timer -----
  let rafId = 0;
  function tick() {
    if (!S.running) return;

    const t = nowMs();

    // fever timeout
    if (S.feverActive && t >= S.feverUntil) {
      S.feverActive = false;
      S.fever = 0.55; // keep some charge
      safeText(UI.msgMain, '😤 FEVER จบ! กลับเข้าสู่โหมดปกติ');
    }

    // time
    S.timeLeftMs = Math.max(0, S.tEnd - t);
    if (S.timeLeftMs <= 0) {
      endGame();
      return;
    }

    updateHUD();
    rafId = WIN.requestAnimationFrame(tick);
  }

  function startGame(runMode) {
    // Validate core DOM
    if (!UI.wrap || !UI.layer) {
      console.error('[ShadowBreaker] Missing core DOM: #sb-wrap or #sb-target-layer');
      alert('โครงสร้างหน้าเกมไม่ครบ (sb-wrap / sb-target-layer)');
      return;
    }

    S.mode = (runMode === 'research') ? 'research' : 'normal';
    S.diff = (UI.selDiff && UI.selDiff.value) ? UI.selDiff.value : 'normal';
    S.durationSec = Number(UI.selTime && UI.selTime.value) || 70;

    // seed: research => deterministic if provided, else from participant
    const qSeed = qs('seed', '');
    let seed = 0;
    if (S.mode === 'research') {
      if (qSeed) seed = Number(qSeed) || 0;
      if (!seed) {
        const pid = (UI.partId && UI.partId.value || '').trim();
        // hash pid into seed
        let h = 2166136261;
        for (let i = 0; i < pid.length; i++) h = Math.imul(h ^ pid.charCodeAt(i), 16777619);
        seed = (h >>> 0) || 123456789;
      }
    } else {
      seed = qSeed ? (Number(qSeed) || 0) : (Date.now() >>> 0);
    }
    S.seed = seed >>> 0;
    S.rng = mulberry32(S.seed);

    // reset state
    S.running = true;
    S.paused = false;

    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.miss = 0;
    S.hits = 0;
    S.judged = 0;

    S.youHp = 100;
    S.bossIndex = 0;
    S.phase = 1;
    S.bossHp = 92;
    S.bossesCleared = 0;
    S.shield = 0;

    S.fever = 0;
    S.feverActive = false;
    S.feverUntil = 0;

    S.events.length = 0;

    // session meta
    const startedAt = new Date();
    S.session = {
      ts_ms: Date.now(),
      mode: S.mode,
      diff: S.diff,
      duration_sec: S.durationSec,
      seed: S.seed,
      participant_id: (UI.partId && UI.partId.value || '').trim(),
      group: (UI.partGroup && UI.partGroup.value || '').trim(),
      note: (UI.partNote && UI.partNote.value || '').trim(),
      started_iso: startedAt.toISOString(),
    };

    // UI: play view
    clearLayer();
    showView('sb-view-play');
    setMode(S.mode);
    updateBossMeta();
    safeText(UI.msgMain, 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!');

    // start timers
    const t0 = nowMs();
    S.t0 = t0;
    S.tEnd = t0 + (S.durationSec * 1000);
    S.timeLeftMs = S.tEnd - t0;

    // pause toggle
    if (UI.chkPause) UI.chkPause.checked = false;

    // base pacing
    S.spawnBaseMs = (S.diff === 'easy') ? 620 : (S.diff === 'hard') ? 430 : 520;
    S.spawnMs = S.spawnBaseMs;

    // Kick loops
    try { WIN.cancelAnimationFrame(rafId); } catch {}
    rafId = WIN.requestAnimationFrame(tick);
    spawnLoop();
  }

  function endGame() {
    if (!S.running) return;

    S.running = false;
    S.paused = false;

    // cleanup layer
    clearLayer();

    // compute results
    const durPlayed = Math.max(0, (Math.min(nowMs(), S.tEnd) - S.t0) / 1000);
    const acc = S.judged ? (S.hits / S.judged) : 0;
    const grade = gradeFromScoreAcc(S.score, acc, S.miss);

    // finalize session row
    const sessRow = Object.assign({}, S.session, {
      played_sec: Number(durPlayed.toFixed(2)),
      score: S.score,
      max_combo: S.maxCombo,
      miss: S.miss,
      judged: S.judged,
      hits: S.hits,
      accuracy: Number((acc * 100).toFixed(2)),
      grade,
      phase: S.phase,
      bosses_cleared: S.bossesCleared,
      ended_iso: new Date().toISOString(),
    });
    S.sessionFinal = sessRow;

    // set result UI
    safeText(UI.resTime, `${durPlayed.toFixed(1)} s`);
    safeText(UI.resScore, S.score);
    safeText(UI.resMaxCombo, S.maxCombo);
    safeText(UI.resMiss, S.miss);
    safeText(UI.resPhase, S.phase);
    safeText(UI.resBossCleared, S.bossesCleared);
    safeText(UI.resAcc, `${(acc * 100).toFixed(1)} %`);
    safeText(UI.resGrade, grade);

    showView('sb-view-result');
  }

  // ----- Bind UI -----
  function bindUI() {
    // Modes
    if (UI.modeNormal) UI.modeNormal.addEventListener('click', () => setMode('normal'));
    if (UI.modeResearch) UI.modeResearch.addEventListener('click', () => setMode('research'));

    // How-to toggle
    if (UI.btnHowto && UI.boxHowto) {
      UI.btnHowto.addEventListener('click', () => {
        const on = UI.boxHowto.style.display !== 'block';
        UI.boxHowto.style.display = on ? 'block' : 'none';
      });
      UI.boxHowto.style.display = 'none';
    }

    // Start buttons
    if (UI.btnPlay) {
      UI.btnPlay.addEventListener('click', () => {
        console.log('[ShadowBreaker] Start Game clicked');
        setMode('normal');
        startGame('normal');
      });
    }

    if (UI.btnResearch) {
      UI.btnResearch.addEventListener('click', () => {
        console.log('[ShadowBreaker] Start Research clicked');
        setMode('research');
        startGame('research');
      });
    }

    // Back to menu (from play)
    if (UI.btnBackMenu) {
      UI.btnBackMenu.addEventListener('click', () => {
        S.running = false;
        clearLayer();
        showView('sb-view-menu');
      });
    }

    // Pause checkbox
    if (UI.chkPause) {
      UI.chkPause.addEventListener('change', () => {
        S.paused = !!UI.chkPause.checked;
        safeText(UI.msgMain, S.paused ? '⏸️ หยุดชั่วคราว (Stop)' : '▶ กลับมาเล่นต่อ!');
      });
    }

    // Result actions
    if (UI.btnRetry) UI.btnRetry.addEventListener('click', () => startGame(S.mode));
    if (UI.btnMenu) UI.btnMenu.addEventListener('click', () => showView('sb-view-menu'));

    if (UI.btnDL_Events) {
      UI.btnDL_Events.addEventListener('click', () => {
        const csv = toCsv(S.events);
        if (!csv) { alert('ยังไม่มี Events ในรอบนี้'); return; }
        downloadText(csv, `shadow-breaker-events_${Date.now()}.csv`);
      });
    }

    if (UI.btnDL_Session) {
      UI.btnDL_Session.addEventListener('click', () => {
        const row = S.sessionFinal ? [S.sessionFinal] : [];
        const csv = toCsv(row);
        if (!csv) { alert('ยังไม่มี Session ในรอบนี้'); return; }
        downloadText(csv, `shadow-breaker-session_${Date.now()}.csv`);
      });
    }

    // Defaults
    const qMode = (qs('mode', '') || '').toLowerCase();
    setMode(qMode === 'research' ? 'research' : 'normal');

    // Optional: auto-start if ?autostart=1
    const auto = (qs('autostart', '') || '').toLowerCase();
    if (auto === '1' || auto === 'true' || auto === 'yes') {
      startGame(S.mode);
    }
  }

  // ----- Boot -----
  function boot() {
    mapUI();

    // core check
    if (!el('sb-view-menu') || !el('sb-view-play') || !el('sb-view-result')) {
      console.error('[ShadowBreaker] Missing view sections. Check IDs in HTML.');
    }
    if (!UI.wrap) console.error('[ShadowBreaker] Missing #sb-wrap');
    if (!UI.layer) console.error('[ShadowBreaker] Missing #sb-target-layer');

    bindUI();
    showView('sb-view-menu'); // start at menu
  }

  // Safe boot
  DOC.addEventListener('DOMContentLoaded', () => {
    try { boot(); }
    catch (e) {
      console.error('[ShadowBreaker] boot failed', e);
      alert('เกิดข้อผิดพลาดตอนเริ่มเกม (ดู Console)');
    }
  });

})();