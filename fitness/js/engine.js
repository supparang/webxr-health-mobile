// === /fitness/js/engine.js ===
// Shadow Breaker Engine — PRODUCTION (DOM)
// ✅ Menu / Play / Result views
// ✅ Boss phases + HP + Shield + FEVER
// ✅ FX: hit/miss/bomb/heal/shield/perfect (via DomRendererShadow -> FxBurst)
// ✅ CSV downloads: EventLogger + SessionLogger
// ✅ AI assist (normal only) via ?ai=1 (locked in research)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { SessionLogger, downloadSessionCsv } from './session-logger.js';
import { AI } from './ai-features.js';

const DOC = document;
const WIN = window;

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const now = () => performance.now();

function qs(sel, root = DOC) { return root.querySelector(sel); }
function qsa(sel, root = DOC) { return Array.from(root.querySelectorAll(sel)); }

function readQuery() {
  try { return new URL(location.href).searchParams; } catch { return new URLSearchParams(); }
}
function setQuery(paramsObj = {}) {
  const u = new URL(location.href);
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v == null || v === '') u.searchParams.delete(k);
    else u.searchParams.set(k, String(v));
  });
  history.replaceState(null, '', u.toString());
}

function safeText(el, t) { if (el) el.textContent = String(t); }
function fmt1(v) { return (Number(v) || 0).toFixed(1); }
function pct(v) { return (Number(v) || 0).toFixed(1) + ' %'; }

function makeId() { return Math.floor(Math.random() * 1e9) ^ Date.now(); }

function gradeFromRt(rtMs, diff) {
  // tighter on hard
  const d = String(diff || 'normal');
  const perfect = d === 'hard' ? 240 : d === 'easy' ? 360 : 300;
  const good = d === 'hard' ? 460 : d === 'easy' ? 620 : 540;

  if (rtMs <= perfect) return 'perfect';
  if (rtMs <= good) return 'good';
  return 'bad';
}

function pickBoss(index) {
  const bosses = [
    { name: 'Bubble Glove', emoji: '🐣', desc: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', hp: 120 },
    { name: 'Neon Dummy', emoji: '🤖', desc: 'หลอกจังหวะด้วย decoy—อ่านเป้าให้ไว', hp: 140 },
    { name: 'Storm Mask', emoji: '😈', desc: 'ระวัง bomb/decoy ผสมกันถี่ขึ้น', hp: 160 },
    { name: 'Final Titan', emoji: '👹', desc: 'เฟสสุดท้าย—สปีดสูง + ลงโทษหนัก', hp: 180 }
  ];
  return bosses[clamp(index, 0, bosses.length - 1)];
}

function diffConfig(diff) {
  const d = String(diff || 'normal');
  if (d === 'easy') {
    return {
      spawnMs: 820,
      lifeMs: 1650,
      sizeBase: 140,
      sizeJitter: 48,
      bombRate: 0.07,
      decoyRate: 0.14,
      healRate: 0.08,
      shieldRate: 0.07,
      bossfaceRate: 0.06,
      scoreGood: 8,
      scorePerfect: 14,
      scoreBad: 2,
      scoreBomb: -14,
      healHp: 14,
      bossDmgGood: 10,
      bossDmgPerfect: 16,
      bossDmgBad: 5
    };
  }
  if (d === 'hard') {
    return {
      spawnMs: 560,
      lifeMs: 1120,
      sizeBase: 112,
      sizeJitter: 44,
      bombRate: 0.14,
      decoyRate: 0.18,
      healRate: 0.05,
      shieldRate: 0.05,
      bossfaceRate: 0.08,
      scoreGood: 10,
      scorePerfect: 18,
      scoreBad: 2,
      scoreBomb: -20,
      healHp: 10,
      bossDmgGood: 12,
      bossDmgPerfect: 20,
      bossDmgBad: 6
    };
  }
  // normal
  return {
    spawnMs: 700,
    lifeMs: 1350,
    sizeBase: 126,
    sizeJitter: 50,
    bombRate: 0.10,
    decoyRate: 0.16,
    healRate: 0.06,
    shieldRate: 0.06,
    bossfaceRate: 0.07,
    scoreGood: 9,
    scorePerfect: 16,
    scoreBad: 2,
    scoreBomb: -16,
    healHp: 12,
    bossDmgGood: 11,
    bossDmgPerfect: 18,
    bossDmgBad: 5
  };
}

function typeRoll(cfg) {
  const r = Math.random();
  let acc = 0;

  acc += cfg.bombRate; if (r < acc) return 'bomb';
  acc += cfg.decoyRate; if (r < acc) return 'decoy';
  acc += cfg.healRate; if (r < acc) return 'heal';
  acc += cfg.shieldRate; if (r < acc) return 'shield';
  acc += cfg.bossfaceRate; if (r < acc) return 'bossface';
  return 'normal';
}

function computeSizePx(cfg, type) {
  const base = cfg.sizeBase + (Math.random() * 2 - 1) * cfg.sizeJitter;
  // make special targets slightly different
  if (type === 'bomb') return clamp(base * 0.95, 76, 280);
  if (type === 'decoy') return clamp(base * 0.92, 72, 280);
  if (type === 'heal' || type === 'shield') return clamp(base * 0.90, 70, 260);
  if (type === 'bossface') return clamp(base * 1.25, 120, 320);
  return clamp(base, 78, 300);
}

function showView(id) {
  qsa('.sb-view').forEach(v => v.classList.remove('is-active'));
  const el = qs('#' + id);
  if (el) el.classList.add('is-active');
}

function setModeUI(mode) {
  const bN = qs('#sb-mode-normal');
  const bR = qs('#sb-mode-research');
  const box = qs('#sb-research-box');
  const desc = qs('#sb-mode-desc');

  if (mode === 'research') {
    bN && bN.classList.remove('is-active');
    bR && bR.classList.add('is-active');
    box && box.classList.add('is-on');
    safeText(desc, 'Research: ใช้เก็บข้อมูล (ล็อก AI / ความยากไม่ปรับอัตโนมัติ)');
    setQuery({ mode: 'research' });
  } else {
    bR && bR.classList.remove('is-active');
    bN && bN.classList.add('is-active');
    box && box.classList.remove('is-on');
    safeText(desc, 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม');
    setQuery({ mode: 'normal' });
  }
}

function setHowto(open) {
  const box = qs('#sb-howto');
  if (!box) return;
  box.classList.toggle('is-on', !!open);
}

function setMsg(text, cls = '') {
  const el = qs('#sb-msg-main');
  if (!el) return;
  el.classList.remove('good', 'bad', 'miss', 'perfect');
  if (cls) el.classList.add(cls);
  el.textContent = text || '';
}

function setHpBar(el, pct01) {
  if (!el) return;
  const p = clamp(pct01, 0, 1);
  el.style.transform = `scaleX(${p})`;
}

function setFever(pct01, on) {
  const bar = qs('#sb-fever-bar');
  const label = qs('#sb-label-fever');
  if (bar) bar.style.transform = `scaleX(${clamp(pct01, 0, 1)})`;
  if (label) {
    label.classList.toggle('on', !!on);
    label.textContent = on ? 'ON' : (pct01 >= 1 ? 'READY' : 'CHARGING');
  }
}

function calcGradeFromScore(accPct, score) {
  // simple grade rubric
  const a = Number(accPct) || 0;
  const s = Number(score) || 0;
  const x = a * 0.65 + clamp(s / 1200, 0, 1) * 35; // 0..100-ish
  if (x >= 92) return 'SSS';
  if (x >= 85) return 'SS';
  if (x >= 78) return 'S';
  if (x >= 70) return 'A';
  if (x >= 60) return 'B';
  return 'C';
}

// ---------------- Engine ----------------

class ShadowBreakerEngine {
  constructor() {
    this.wrapEl = qs('#sb-wrap');
    this.layerEl = qs('#sb-target-layer');
    this.mode = AI.getMode(); // 'normal'|'research'
    this.diff = 'normal';
    this.durationSec = 70;

    // session state
    this.running = false;
    this.paused = false;
    this.t0 = 0;
    this.elapsedMs = 0;

    // combat/state
    this.bossIndex = 0;
    this.bossPhase = 1;
    this.boss = pickBoss(0);
    this.youHp = 100;
    this.bossHp = this.boss.hp;
    this.bossHpMax = this.boss.hp;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.miss = 0;
    this.shield = 0;

    this.fever = 0;       // 0..1
    this.feverOn = false;
    this.feverLeftMs = 0;

    this.spawnTimer = 0;
    this.targetSeq = 1;
    this.live = new Map(); // id -> {spawnAt, lifeMs, type, sizePx}
    this.lastTick = 0;

    // loggers
    this.eventLogger = new EventLogger();
    this.sessionLogger = new SessionLogger();

    // renderer
    this.renderer = new DomRendererShadow(this.layerEl, {
      wrapEl: this.wrapEl,
      feedbackEl: qs('#sb-msg-main'),
      onTargetHit: (id, info) => this.onHit(id, info)
    });

    this._raf = this._raf.bind(this);
  }

  initUI() {
    // mode buttons
    const bN = qs('#sb-mode-normal');
    const bR = qs('#sb-mode-research');
    bN && bN.addEventListener('click', () => { this.mode = 'normal'; setModeUI('normal'); });
    bR && bR.addEventListener('click', () => { this.mode = 'research'; setModeUI('research'); });

    // diff/time selects
    const selD = qs('#sb-diff');
    const selT = qs('#sb-time');
    if (selD) selD.addEventListener('change', () => { this.diff = String(selD.value || 'normal'); this.renderer.setDifficulty(this.diff); });
    if (selT) selT.addEventListener('change', () => { this.durationSec = clamp(selT.value, 20, 240); });

    // actions
    const btnPlay = qs('#sb-btn-play');
    const btnResearch = qs('#sb-btn-research');
    const btnHowto = qs('#sb-btn-howto');

    btnPlay && btnPlay.addEventListener('click', () => {
      this.mode = 'normal';
      setModeUI('normal');
      this.startRun();
    });

    btnResearch && btnResearch.addEventListener('click', () => {
      this.mode = 'research';
      setModeUI('research');
      this.startRun();
    });

    btnHowto && btnHowto.addEventListener('click', () => setHowto(!qs('#sb-howto')?.classList.contains('is-on')));

    // play controls
    const backMenu = qs('#sb-btn-back-menu');
    const stopToggle = qs('#sb-btn-pause');

    backMenu && backMenu.addEventListener('click', () => this.backToMenu());
    stopToggle && stopToggle.addEventListener('change', (e) => {
      this.paused = !!e.target.checked;
      setMsg(this.paused ? 'หยุดชั่วคราว (Stop)' : 'ลุยต่อ! แตะ/ชกเป้าให้ทัน', this.paused ? 'miss' : '');
    });

    // result controls
    const retry = qs('#sb-btn-result-retry');
    const menu = qs('#sb-btn-result-menu');
    const dlEv = qs('#sb-btn-download-events');
    const dlSe = qs('#sb-btn-download-session');

    retry && retry.addEventListener('click', () => this.startRun(true));
    menu && menu.addEventListener('click', () => this.backToMenu());
    dlEv && dlEv.addEventListener('click', () => downloadEventCsv(this.eventLogger, this.sessionLogger.makeEventFilename()));
    dlSe && dlSe.addEventListener('click', () => downloadSessionCsv(this.sessionLogger, this.sessionLogger.makeSessionFilename()));

    // initial mode from URL
    setModeUI(this.mode);
  }

  backToMenu() {
    this.stop();
    showView('sb-view-menu');
    setHowto(false);
  }

  resetState(keepSettings = true) {
    this.running = false;
    this.paused = false;
    this.t0 = 0;
    this.elapsedMs = 0;

    this.bossIndex = 0;
    this.bossPhase = 1;
    this.boss = pickBoss(0);
    this.bossHpMax = this.boss.hp;
    this.bossHp = this.bossHpMax;

    this.youHp = 100;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.miss = 0;
    this.shield = 0;

    this.fever = 0;
    this.feverOn = false;
    this.feverLeftMs = 0;

    this.spawnTimer = 0;
    this.targetSeq = 1;

    // clear targets
    this.live.clear();
    this.renderer.destroy();

    // clear logs
    this.eventLogger.clear();
    this.sessionLogger.clear();

    // settings from selects if requested
    if (keepSettings) {
      const selD = qs('#sb-diff');
      const selT = qs('#sb-time');
      this.diff = String(selD?.value || this.diff || 'normal');
      this.durationSec = clamp(selT?.value || this.durationSec || 70, 20, 240);
    }

    this.renderer.setDifficulty(this.diff);

    // apply wrap dataset
    if (this.wrapEl) {
      this.wrapEl.dataset.diff = this.diff;
      this.wrapEl.dataset.phase = String(this.bossPhase);
      this.wrapEl.dataset.boss = String(this.bossIndex);
    }

    this.applyBossUI();
    this.updateHud(0);
    setMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!');
  }

  applyBossUI() {
    safeText(qs('#sb-current-boss-name'), `${this.boss.name} ${this.boss.emoji}`);
    safeText(qs('#sb-meta-emoji'), this.boss.emoji);
    safeText(qs('#sb-meta-name'), this.boss.name);
    safeText(qs('#sb-meta-desc'), this.boss.desc);
    safeText(qs('#sb-boss-phase-label'), String(this.bossPhase));
    safeText(qs('#sb-boss-shield-label'), String(this.shield));
  }

  updateHud(elapsedMs) {
    const t = elapsedMs / 1000;
    safeText(qs('#sb-text-time'), `${fmt1(t)} s`);
    safeText(qs('#sb-text-score'), String(this.score));
    safeText(qs('#sb-text-combo'), String(this.combo));
    safeText(qs('#sb-text-miss'), String(this.miss));
    safeText(qs('#sb-text-phase'), String(this.bossPhase));
    safeText(qs('#sb-text-shield'), String(this.shield));

    setHpBar(qs('#sb-hp-you-top'), this.youHp / 100);
    setHpBar(qs('#sb-hp-you-bottom'), this.youHp / 100);
    setHpBar(qs('#sb-hp-boss-top'), this.bossHp / this.bossHpMax);
    setHpBar(qs('#sb-hp-boss-bottom'), this.bossHp / this.bossHpMax);

    setFever(this.fever, this.feverOn);
    this.applyBossUI();
  }

  startRun(fromRetry = false) {
    // keep research meta
    const pid = (qs('#sb-part-id')?.value || '').trim();
    const grp = (qs('#sb-part-group')?.value || '').trim();
    const note = (qs('#sb-part-note')?.value || '').trim();

    // sync mode to query
    setQuery({ mode: this.mode });

    this.resetState(true);

    // init session meta
    this.sessionLogger.begin({
      session_id: String(makeId()),
      mode: this.mode,
      diff: this.diff,
      duration_sec: this.durationSec,
      participant_id: pid,
      group: grp,
      note
    });

    // view
    showView('sb-view-play');

    // run
    this.running = true;
    this.t0 = now();
    this.lastTick = now();
    this.spawnTimer = 0;

    // show a kickoff tip
    const aiOn = AI.isAssistEnabled();
    if (this.mode === 'research') {
      setMsg('Research mode: AI ถูกล็อก ✅ เริ่มเก็บข้อมูลแล้ว', 'good');
    } else if (aiOn) {
      setMsg('AI Assist ON: ระบบจะให้ micro-tip เป็นระยะ (ไม่ปรับใน research)', 'perfect');
    } else {
      setMsg('ลุย! ถ้าอยากเปิด AI ช่วย → เติม ?ai=1 ใน URL', '');
    }

    WIN.requestAnimationFrame(this._raf);
  }

  stop() {
    this.running = false;
    this.paused = false;
  }

  endRun() {
    this.running = false;

    // compute summary
    const total = this.sessionLogger.totalJudged || 0;
    const hit = this.sessionLogger.totalHit || 0;
    const acc = total > 0 ? (hit / total) * 100 : 0;

    const grade = calcGradeFromScore(acc, this.score);

    // write session end
    this.sessionLogger.end({
      time_sec: this.elapsedMs / 1000,
      score: this.score,
      max_combo: this.maxCombo,
      miss: this.miss,
      bosses_cleared: this.bossIndex,
      phase: this.bossPhase,
      accuracy_pct: acc,
      grade
    });

    // result UI
    safeText(qs('#sb-res-time'), `${fmt1(this.elapsedMs / 1000)} s`);
    safeText(qs('#sb-res-score'), String(this.score));
    safeText(qs('#sb-res-max-combo'), String(this.maxCombo));
    safeText(qs('#sb-res-miss'), String(this.miss));
    safeText(qs('#sb-res-phase'), String(this.bossPhase));
    safeText(qs('#sb-res-boss-cleared'), String(this.bossIndex));
    safeText(qs('#sb-res-acc'), pct(acc));
    safeText(qs('#sb-res-grade'), String(grade));

    showView('sb-view-result');
  }

  // -------- Gameplay logic --------

  tick(dtMs) {
    if (!this.running) return;
    if (this.paused) { this.updateHud(this.elapsedMs); return; }

    this.elapsedMs += dtMs;

    // time up
    if (this.elapsedMs >= this.durationSec * 1000) {
      this.endRun();
      return;
    }

    // fever timing
    if (this.feverOn) {
      this.feverLeftMs -= dtMs;
      if (this.feverLeftMs <= 0) {
        this.feverOn = false;
        this.feverLeftMs = 0;
      }
    }

    // spawn
    const cfg = diffConfig(this.diff);
    const pacingBoost = this.feverOn ? 0.92 : 1;
    this.spawnTimer += dtMs;
    while (this.spawnTimer >= cfg.spawnMs * pacingBoost) {
      this.spawnTimer -= cfg.spawnMs * pacingBoost;
      this.spawnOne(cfg);
    }

    // expire targets
    for (const [id, t] of Array.from(this.live.entries())) {
      const age = now() - t.spawnAt;
      if (age >= t.lifeMs) {
        // timeout miss
        this.onTimeout(id);
      }
    }

    // AI micro-tip (normal only + ai=1)
    if (!AI.isResearch() && AI.isAssistEnabled()) {
      this.maybeAiTip(dtMs);
    }

    this.updateHud(this.elapsedMs);
  }

  spawnOne(cfg) {
    const id = this.targetSeq++;
    const type = typeRoll(cfg);

    const sizePx = computeSizePx(cfg, type);

    const lifeMs = cfg.lifeMs * (type === 'bossface' ? 0.92 : 1);
    const bossEmoji = this.boss.emoji;

    const data = { id, type, sizePx, bossEmoji };
    this.live.set(id, { spawnAt: now(), lifeMs, type, sizePx });

    this.renderer.spawnTarget(data);
  }

  onTimeout(id) {
    const t = this.live.get(id);
    if (!t) return;

    // count miss only for "normal" and "bossface" (for fairness)
    if (t.type === 'normal' || t.type === 'bossface') {
      this.miss++;
      this.combo = 0;
      this.youHp = clamp(this.youHp - 6, 0, 100);
      setMsg('MISS (ช้าไป!)', 'miss');

      this.sessionLogger.onMiss();
      this.eventLogger.add(this.makeEventRow({
        event_type: 'timeout_miss',
        target_id: id,
        target_type: t.type,
        rt_ms: '',
        grade: 'miss',
        score_delta: 0
      }));

      // ✅ FX for miss (center of target if available)
      this.renderer.playHitFx(id, { grade: 'bad', scoreDelta: 0 });
    }

    this.live.delete(id);
    this.renderer.removeTarget(id, 'timeout');

    // lose condition: optional (if want)
    if (this.youHp <= 0) this.endRun();
  }

  onHit(id, info = {}) {
    const t = this.live.get(id);
    if (!t) return;

    const cfg = diffConfig(this.diff);
    const rtMs = Math.max(1, Math.round(now() - t.spawnAt));

    // classify hit result
    let grade = 'good';
    let scoreDelta = 0;
    let bossDmg = 0;

    if (t.type === 'decoy') {
      grade = 'bad';
      scoreDelta = -6;
      this.combo = 0;
      this.miss++;
      // shield can block decoy penalty once
      if (this.shield > 0) {
        this.shield--;
        scoreDelta = 0;
        setMsg('🛡️ Shield กัน Decoy!', 'good');
        grade = 'shield';
      } else {
        this.youHp = clamp(this.youHp - 8, 0, 100);
        setMsg('DECOY! (หลอก)', 'bad');
      }
      this.sessionLogger.onJudged(false);
    }
    else if (t.type === 'bomb') {
      grade = 'bomb';
      scoreDelta = cfg.scoreBomb;
      this.combo = 0;
      this.miss++;
      if (this.shield > 0) {
        this.shield--;
        scoreDelta = Math.round(cfg.scoreBomb * 0.25); // still some penalty
        setMsg('🛡️ Shield กัน Bomb (เบาลง)', 'miss');
      } else {
        this.youHp = clamp(this.youHp - 14, 0, 100);
        setMsg('BOMB! ระเบิด', 'bad');
      }
      this.sessionLogger.onJudged(false);
    }
    else if (t.type === 'heal') {
      grade = 'heal';
      scoreDelta = 4;
      this.youHp = clamp(this.youHp + cfg.healHp, 0, 100);
      this.combo = clamp(this.combo + 1, 0, 9999);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.sessionLogger.onJudged(true);
      setMsg('+HP!', 'good');
    }
    else if (t.type === 'shield') {
      grade = 'shield';
      scoreDelta = 4;
      this.shield = clamp(this.shield + 1, 0, 9);
      this.combo = clamp(this.combo + 1, 0, 9999);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.sessionLogger.onJudged(true);
      setMsg('+SHIELD!', 'good');
    }
    else {
      // normal / bossface: grade by RT
      const g = gradeFromRt(rtMs, this.diff);
      grade = g;

      const feverMul = this.feverOn ? 1.35 : 1;
      if (g === 'perfect') {
        scoreDelta = Math.round(cfg.scorePerfect * feverMul);
        bossDmg = Math.round(cfg.bossDmgPerfect * feverMul);
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.fever = clamp(this.fever + 0.18, 0, 1);
        setMsg('PERFECT!', 'perfect');
      } else if (g === 'good') {
        scoreDelta = Math.round(cfg.scoreGood * feverMul);
        bossDmg = Math.round(cfg.bossDmgGood * feverMul);
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.fever = clamp(this.fever + 0.10, 0, 1);
        setMsg('GOOD', 'good');
      } else {
        scoreDelta = cfg.scoreBad;
        bossDmg = cfg.bossDmgBad;
        this.combo = 0;
        this.miss++;
        this.fever = clamp(this.fever - 0.10, 0, 1);
        setMsg('BAD (ช้า/หลุด)', 'bad');
      }

      // bossface extra reward
      if (t.type === 'bossface') {
        scoreDelta = Math.round(scoreDelta * 1.25);
        bossDmg = Math.round(bossDmg * 1.25);
      }

      this.sessionLogger.onHit(g === 'perfect' || g === 'good', rtMs);
    }

    // apply score/boss hp
    this.score += scoreDelta;
    if (bossDmg > 0) this.bossHp = clamp(this.bossHp - bossDmg, 0, this.bossHpMax);

    // FEVER activation
    if (!this.feverOn && this.fever >= 1) {
      this.feverOn = true;
      this.fever = 0;
      this.feverLeftMs = 2200; // short burst
      setMsg('FEVER ON!', 'perfect');
    }

    // ✅ IMPORTANT FIX: play FX BEFORE remove (so renderer can read element rect if needed)
    this.renderer.playHitFx(id, {
      clientX: info.clientX,
      clientY: info.clientY,
      grade,
      scoreDelta
    });

    // log event
    this.eventLogger.add(this.makeEventRow({
      event_type: 'hit',
      target_id: id,
      target_type: t.type,
      is_boss_face: t.type === 'bossface' ? 1 : 0,
      rt_ms: rtMs,
      grade,
      score_delta: scoreDelta,
      combo_after: this.combo,
      score_after: this.score,
      player_hp: this.youHp,
      boss_hp: this.bossHp
    }));

    // cleanup target
    this.live.delete(id);
    this.renderer.removeTarget(id, 'hit');

    // phase/boss transitions
    this.checkBossProgress();

    // lose
    if (this.youHp <= 0) this.endRun();
  }

  checkBossProgress() {
    // phase thresholds (simple)
    const ratio = this.bossHp / this.bossHpMax;

    let newPhase = 1;
    if (ratio <= 0.66) newPhase = 2;
    if (ratio <= 0.33) newPhase = 3;

    if (newPhase !== this.bossPhase) {
      this.bossPhase = newPhase;
      if (this.wrapEl) this.wrapEl.dataset.phase = String(this.bossPhase);
      setMsg(`เข้าสู่ Phase ${this.bossPhase}!`, 'perfect');
    }

    // boss cleared
    if (this.bossHp <= 0) {
      this.bossIndex++;
      if (this.wrapEl) this.wrapEl.dataset.boss = String(this.bossIndex);

      // reward
      this.shield = clamp(this.shield + 1, 0, 9);
      this.youHp = clamp(this.youHp + 10, 0, 100);
      setMsg(`เคลียร์บอส! ต่อไป…`, 'good');

      // next boss
      this.boss = pickBoss(this.bossIndex);
      this.bossHpMax = this.boss.hp + (this.bossIndex * 10);
      this.bossHp = this.bossHpMax;
      this.bossPhase = 1;

      // small clear of remaining targets
      for (const [id] of Array.from(this.live.entries())) {
        this.live.delete(id);
        this.renderer.removeTarget(id, 'boss_clear');
      }

      this.applyBossUI();
    }
  }

  // AI micro tip controller (simple rate limit)
  maybeAiTip(dtMs) {
    this._aiCooldown = (this._aiCooldown || 0) - dtMs;
    if (this._aiCooldown > 0) return;

    // every ~6-9s
    this._aiCooldown = 6000 + Math.random() * 3000;

    const snap = this.sessionLogger.makeSnapshot({
      hp: this.youHp,
      durationSec: this.durationSec,
      elapsedSec: this.elapsedMs / 1000
    });

    const pred = AI.predict(snap);
    if (!pred || !pred.tip) return;

    // show as subtle center message
    setMsg('AI: ' + pred.tip, 'perfect');

    // also log as event
    this.eventLogger.add(this.makeEventRow({
      event_type: 'ai_tip',
      target_id: '',
      target_type: '',
      rt_ms: '',
      grade: '',
      score_delta: 0,
      ai_skill: pred.skillScore,
      ai_fatigue: pred.fatigueRisk,
      ai_suggested: pred.suggestedDifficulty,
      ai_tip: pred.tip
    }));
  }

  makeEventRow(extra = {}) {
    return Object.assign({
      ts_ms: Date.now(),
      mode: this.mode,
      diff: this.diff,
      boss_index: this.bossIndex,
      boss_phase: this.bossPhase
    }, extra);
  }

  _raf() {
    if (!this.running) return;
    const t = now();
    const dt = Math.min(60, t - this.lastTick);
    this.lastTick = t;

    this.tick(dt);

    if (this.running) WIN.requestAnimationFrame(this._raf);
  }
}

// --------------- boot ---------------
function boot() {
  const eng = new ShadowBreakerEngine();
  eng.initUI();
  showView('sb-view-menu');
  setHowto(false);
  return eng;
}

try {
  boot();
} catch (err) {
  console.error(err);
  alert('Shadow Breaker โหลดไม่สำเร็จ: ' + (err?.message || err));
}