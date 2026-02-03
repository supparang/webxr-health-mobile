// === /fitness/js/engine.js ===
// Shadow Breaker Engine — PRODUCTION (PATCH FX)
// ✅ Menu -> Play -> Result view switching
// ✅ Spawns targets (normal/decoy/bomb/heal/shield/bossface)
// ✅ Judge hit by RT thresholds + score/combo/fever/shield/hp/boss-hp
// ✅ FX ALWAYS: renderer.playHitFx(...) on every hit + timeout miss
// ✅ CSV: EventLogger + SessionLogger (download buttons)
//
// NOTE:
// - This is "DOM game" (PC/Mobile).
// - Optional AI assist: if window.RB_AI exists and mode=normal&?ai=1 -> adapt pacing lightly.

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { SessionLogger, downloadSessionCsv } from './session-logger.js';
import { FxBurst } from './fx-burst.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const clamp01 = (v) => clamp(v, 0, 1);
const nowMs = () => performance.now();

function qs(id) { return DOC.getElementById(id); }

function readModeFromUI() {
  const btnR = qs('sb-mode-research');
  return (btnR && btnR.classList.contains('is-active')) ? 'research' : 'normal';
}

function setView(viewId) {
  const views = ['sb-view-menu', 'sb-view-play', 'sb-view-result'];
  for (const id of views) {
    const el = qs(id);
    if (!el) continue;
    el.classList.toggle('is-active', id === viewId);
  }
}

function fmt1(v) { return (Math.round((Number(v) || 0) * 10) / 10).toFixed(1); }

function gradeFromAcc(accPct) {
  const a = Number(accPct) || 0;
  if (a >= 95) return 'SSS';
  if (a >= 90) return 'SS';
  if (a >= 82) return 'S';
  if (a >= 72) return 'A';
  if (a >= 60) return 'B';
  return 'C';
}

function safeText(el, s) { if (el) el.textContent = String(s ?? ''); }
function setBarScale(el, pct01) {
  if (!el) return;
  const p = clamp01(pct01);
  el.style.transform = `scaleX(${p})`;
}

function rand(min, max) { return min + Math.random() * (max - min); }
function pickWeighted(items) {
  // items: [{k, w}]
  let sum = 0;
  for (const it of items) sum += (it.w || 0);
  let r = Math.random() * (sum || 1);
  for (const it of items) {
    r -= (it.w || 0);
    if (r <= 0) return it.k;
  }
  return items[items.length - 1]?.k;
}

function getAI() {
  // optional global from ai-predictor.js
  return WIN.RB_AI || null;
}

const BOSSES = [
  { name: 'Bubble Glove', emoji: '🐣', desc: 'โฟกัสฟองใหญ่ ๆ แล้วตีให้ทัน', baseHp: 110 },
  { name: 'Neon Wasp',   emoji: '🪲', desc: 'เป้าจะไวขึ้น—อย่าหลง Decoy', baseHp: 135 },
  { name: 'Void Titan',  emoji: '👾', desc: 'Bomb/Decoy หนักขึ้น—คุมคอมโบให้ดี', baseHp: 165 }
];

const DIFF = {
  easy:   { spawnMin: 520, spawnMax: 820, ttlMin: 920, ttlMax: 1200, size: 132, rtPerfect: 260, rtGood: 520 },
  normal: { spawnMin: 420, spawnMax: 700, ttlMin: 780, ttlMax: 1050, size: 122, rtPerfect: 240, rtGood: 480 },
  hard:   { spawnMin: 340, spawnMax: 580, ttlMin: 650, ttlMax: 920,  size: 112, rtPerfect: 220, rtGood: 430 }
};

function typeWeights(diffKey, phase, youHp01, bossHp01) {
  // Keep it fun + fair
  const base = [
    { k: 'normal',  w: 1.00 },
    { k: 'decoy',   w: 0.20 + 0.06 * phase },
    { k: 'bomb',    w: 0.16 + 0.05 * phase },
    { k: 'heal',    w: 0.12 },
    { k: 'shield',  w: 0.12 }
  ];

  // If player low HP -> more heal/shield
  if (youHp01 < 0.35) {
    base.find(x => x.k === 'heal').w += 0.16;
    base.find(x => x.k === 'shield').w += 0.10;
    base.find(x => x.k === 'bomb').w -= 0.06;
    base.find(x => x.k === 'decoy').w -= 0.04;
  }

  // Late boss -> dramatic bossface chance
  if (bossHp01 < 0.18) {
    base.push({ k: 'bossface', w: 0.28 });
  }

  // Normalize negatives
  for (const it of base) it.w = Math.max(0.01, it.w || 0.01);
  return base;
}

class ShadowBreakerGame {
  constructor() {
    // DOM
    this.wrap = qs('sb-wrap');
    this.layer = qs('sb-target-layer');
    this.msg = qs('sb-msg-main');

    // HUD
    this.tTime = qs('sb-text-time');
    this.tScore = qs('sb-text-score');
    this.tCombo = qs('sb-text-combo');
    this.tPhase = qs('sb-text-phase');
    this.tMiss = qs('sb-text-miss');
    this.tShield = qs('sb-text-shield');

    this.hpYouTop = qs('sb-hp-you-top');
    this.hpBossTop = qs('sb-hp-boss-top');
    this.hpYouBottom = qs('sb-hp-you-bottom');
    this.hpBossBottom = qs('sb-hp-boss-bottom');

    this.feverBar = qs('sb-fever-bar');
    this.feverLabel = qs('sb-label-fever');

    this.bossNameTop = qs('sb-current-boss-name');
    this.metaEmoji = qs('sb-meta-emoji');
    this.metaName = qs('sb-meta-name');
    this.metaDesc = qs('sb-meta-desc');
    this.bossPhaseLabel = qs('sb-boss-phase-label');
    this.bossShieldLabel = qs('sb-boss-shield-label');

    // Result
    this.resTime = qs('sb-res-time');
    this.resScore = qs('sb-res-score');
    this.resMaxCombo = qs('sb-res-max-combo');
    this.resMiss = qs('sb-res-miss');
    this.resPhase = qs('sb-res-phase');
    this.resBossCleared = qs('sb-res-boss-cleared');
    this.resAcc = qs('sb-res-acc');
    this.resGrade = qs('sb-res-grade');

    // Mode inputs
    this.selDiff = qs('sb-diff');
    this.selTime = qs('sb-time');
    this.inPid = qs('sb-part-id');
    this.inGroup = qs('sb-part-group');
    this.inNote = qs('sb-part-note');

    this.chkStop = qs('sb-btn-pause');

    // loggers
    this.eventLogger = new EventLogger();
    this.sessionLogger = new SessionLogger();

    // renderer
    this.renderer = new DomRendererShadow(this.layer, {
      wrapEl: this.wrap,
      feedbackEl: this.msg,
      onTargetHit: (id, pt) => this._onHit(id, pt)
    });

    // runtime
    this.running = false;
    this.paused = false;
    this.ended = false;

    this.mode = 'normal';
    this.diffKey = 'normal';

    this.timeLimitSec = 70;
    this.startMs = 0;
    this.endMs = 0;
    this.lastTickMs = 0;

    // gameplay
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.miss = 0;

    this.hit_good = 0;
    this.hit_bad = 0;
    this.hit_bomb = 0;
    this.hit_heal = 0;
    this.hit_shield = 0;

    this.rtArr = [];
    this.fever = 0;      // 0..1
    this.feverOn = false;
    this.feverUses = 0;

    this.youHp = 100;    // 0..100
    this.shield = 0;     // integer charges
    this.shieldGain = 0;

    // boss
    this.bossIndex = 0;
    this.bossHp = 100;
    this.bossMaxHp = 100;
    this.phase = 1;
    this.bossesCleared = 0;

    // targets state
    this.nextTargetId = 1;
    this.targets = new Map(); // id -> {id,type,spawnMs,expireMs,sizePx,bossEmoji}
    this.nextSpawnMs = 0;

    // AI (optional)
    this.ai = getAI();
    this.aiEnabled = false;
    this.aiSuggested = null;
  }

  startFromMenu(mode, diffKey, timeSec, researchMeta) {
    this.mode = mode || 'normal';
    this.diffKey = diffKey || 'normal';
    this.timeLimitSec = clamp(timeSec, 20, 180);

    this.ai = getAI();
    this.aiEnabled = false;
    if (this.ai && typeof this.ai.isAssistEnabled === 'function') {
      this.aiEnabled = !!this.ai.isAssistEnabled();
    }

    this.researchMeta = researchMeta || { participant_id:'', group:'', note:'' };

    // reset
    this._resetRun();
    setView('sb-view-play');

    // kickoff
    this.running = true;
    this.paused = false;
    this.ended = false;
    this.startMs = nowMs();
    this.endMs = this.startMs + this.timeLimitSec * 1000;
    this.lastTickMs = this.startMs;
    this.nextSpawnMs = this.startMs + 260;

    if (this.chkStop) this.chkStop.checked = false;

    this._syncBossUI();
    this._syncHUD();
    this._loop();
  }

  _resetRun() {
    this.eventLogger.clear();

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.miss = 0;

    this.hit_good = 0;
    this.hit_bad = 0;
    this.hit_bomb = 0;
    this.hit_heal = 0;
    this.hit_shield = 0;

    this.rtArr.length = 0;

    this.fever = 0;
    this.feverOn = false;
    this.feverUses = 0;

    this.youHp = 100;
    this.shield = 0;
    this.shieldGain = 0;

    this.bossIndex = 0;
    this.phase = 1;
    this.bossesCleared = 0;
    this._setBoss(0);

    // clear targets
    for (const id of this.targets.keys()) {
      this.renderer.removeTarget(id, 'reset');
    }
    this.targets.clear();
    this.nextTargetId = 1;
  }

  _setBoss(idx) {
    const b = BOSSES[clamp(idx, 0, BOSSES.length - 1)] || BOSSES[0];
    this.bossIndex = clamp(idx, 0, BOSSES.length - 1);
    this.bossMaxHp = Number(b.baseHp) || 120;
    this.bossHp = this.bossMaxHp;
    this._syncBossUI();
    this._syncBars();
  }

  _syncBossUI() {
    const b = BOSSES[this.bossIndex] || BOSSES[0];
    safeText(this.bossNameTop, `${b.name} ${b.emoji}`);
    safeText(this.metaEmoji, b.emoji);
    safeText(this.metaName, b.name);
    safeText(this.metaDesc, b.desc);
    safeText(this.bossPhaseLabel, this.phase);
    safeText(this.bossShieldLabel, this.shield);
    if (this.wrap) {
      this.wrap.dataset.phase = String(this.phase);
      this.wrap.dataset.boss = String(this.bossIndex);
      this.wrap.dataset.diff = String(this.diffKey);
    }
  }

  _syncHUD() {
    const t = Math.max(0, (this.endMs - nowMs()) / 1000);
    safeText(this.tTime, `${fmt1(this.timeLimitSec - t)} s`);
    safeText(this.tScore, this.score);
    safeText(this.tCombo, this.combo);
    safeText(this.tPhase, this.phase);
    safeText(this.tMiss, this.miss);
    safeText(this.tShield, this.shield);

    safeText(this.feverLabel, this.feverOn ? 'ON' : (this.fever >= 1 ? 'READY' : 'CHARGE'));
    this.feverLabel?.classList.toggle('on', !!this.feverOn);

    setBarScale(this.feverBar, clamp01(this.fever));
    this._syncBars();
  }

  _syncBars() {
    setBarScale(this.hpYouTop, this.youHp / 100);
    setBarScale(this.hpYouBottom, this.youHp / 100);
    setBarScale(this.hpBossTop, this.bossHp / this.bossMaxHp);
    setBarScale(this.hpBossBottom, this.bossHp / this.bossMaxHp);
  }

  _showMsg(text, cls) {
    if (!this.msg) return;
    this.msg.classList.remove('good', 'bad', 'miss', 'perfect');
    if (cls) this.msg.classList.add(cls);
    this.msg.textContent = text || '';
  }

  _loop() {
    if (!this.running) return;
    const t = nowMs();

    // stop/pause
    this.paused = !!(this.chkStop && this.chkStop.checked);

    if (!this.paused) {
      // spawn
      if (t >= this.nextSpawnMs) {
        this._spawnOne(t);
        this._planNextSpawn(t);
      }

      // timeout misses
      this._tickTimeouts(t);

      // fever decay / management
      if (this.feverOn) {
        // fever lasts ~ 3.8s then off
        this._feverMs = (this._feverMs || 0) + (t - this.lastTickMs);
        if (this._feverMs >= 3800) {
          this.feverOn = false;
          this._feverMs = 0;
          this._showMsg('FEVER หมดเวลา', 'miss');
        }
      }
    }

    this._syncHUD();

    // end condition (time)
    if (t >= this.endMs) {
      this._finish('time');
      return;
    }

    this.lastTickMs = t;
    requestAnimationFrame(() => this._loop());
  }

  _planNextSpawn(t) {
    const d = DIFF[this.diffKey] || DIFF.normal;

    let min = d.spawnMin, max = d.spawnMax;

    // Optional AI pacing (normal mode only, ai=1)
    if (this.aiEnabled && this.mode === 'normal') {
      const snap = this._makeSnapshot();
      try {
        const pred = this.ai.predict ? this.ai.predict(snap) : null;
        if (pred) {
          this.aiSuggested = pred;
          // If fatigueRisk high -> slower spawns, else faster
          const fr = clamp01(pred.fatigueRisk);
          const sk = clamp01(pred.skillScore);
          const slow = 1 + fr * 0.35;
          const fast = 1 - sk * 0.18;
          const k = clamp(slow * fast, 0.78, 1.35);
          min *= k;
          max *= k;

          // micro-tip occasionally
          if (pred.tip && Math.random() < 0.18) {
            FxBurst.popText(WIN.innerWidth * 0.52, WIN.innerHeight * 0.18, pred.tip, 'sb-fx-tip');
          }
        }
      } catch (_) {}
    }

    this.nextSpawnMs = t + rand(min, max);
  }

  _spawnOne(t) {
    const d = DIFF[this.diffKey] || DIFF.normal;

    const youHp01 = this.youHp / 100;
    const bossHp01 = this.bossHp / this.bossMaxHp;

    const weights = typeWeights(this.diffKey, this.phase, youHp01, bossHp01);
    const type = pickWeighted(weights);

    // size
    const sizeBase = d.size;
    const sizeJitter = (type === 'bossface') ? 18 : 10;
    const sizePx = clamp(sizeBase + rand(-sizeJitter, sizeJitter), 78, 260);

    // ttl
    let ttl = rand(d.ttlMin, d.ttlMax);

    // bomb/decoy slightly shorter in hard phases
    if (type === 'bomb' || type === 'decoy') ttl *= (this.diffKey === 'hard' ? 0.92 : 0.98);

    const b = BOSSES[this.bossIndex] || BOSSES[0];

    const id = this.nextTargetId++;
    const data = {
      id,
      type,
      sizePx,
      bossEmoji: b.emoji
    };

    const expireMs = t + ttl;

    this.targets.set(id, {
      id, type,
      spawnMs: t,
      expireMs,
      sizePx,
      bossEmoji: b.emoji
    });

    this.renderer.spawnTarget(data);

    // event log spawn (optional)
    this.eventLogger.add({
      ts_ms: Date.now(),
      mode: this.mode,
      diff: this.diffKey,
      boss_index: this.bossIndex,
      boss_phase: this.phase,
      target_id: id,
      target_type: type,
      is_boss_face: (type === 'bossface') ? 1 : 0,
      event_type: 'spawn'
    });
  }

  _tickTimeouts(t) {
    if (!this.targets.size) return;

    for (const [id, s] of this.targets.entries()) {
      if (t < s.expireMs) continue;

      // timeout miss
      this.targets.delete(id);
      this.renderer.removeTarget(id, 'timeout');

      // punish slightly (shield can block)
      let dmg = 2 + this.phase;
      if (this.shield > 0) { this.shield -= 1; dmg = 0; }
      else this.youHp = clamp(this.youHp - dmg, 0, 100);

      this.combo = 0;
      this.miss += 1;

      // ✅ PATCH: FX even on timeout (no pointer -> renderer uses rect center if still exists; here removed already)
      // We still want a visible feedback -> use viewport center-ish pop:
      FxBurst.popText(WIN.innerWidth * 0.5, WIN.innerHeight * 0.32, 'MISS (timeout)', 'sb-fx-miss');

      this._showMsg('MISS! เป้าหายไปแล้ว', 'miss');

      this.eventLogger.add({
        ts_ms: Date.now(),
        mode: this.mode,
        diff: this.diffKey,
        boss_index: this.bossIndex,
        boss_phase: this.phase,
        target_id: id,
        target_type: s.type,
        is_boss_face: (s.type === 'bossface') ? 1 : 0,
        event_type: 'timeout_miss',
        rt_ms: Math.round(s.expireMs - s.spawnMs),
        grade: 'miss',
        score_delta: 0,
        combo_after: this.combo,
        score_after: this.score,
        player_hp: this.youHp,
        boss_hp: this.bossHp
      });

      // If player dead -> finish
      if (this.youHp <= 0) {
        this._finish('hp_zero');
        return;
      }
    }
  }

  _judgeRt(rt) {
    const d = DIFF[this.diffKey] || DIFF.normal;
    if (rt <= d.rtPerfect) return 'perfect';
    if (rt <= d.rtGood) return 'good';
    return 'bad';
  }

  _onHit(id, pt) {
    if (!this.running || this.paused) return;
    const t = nowMs();

    const s = this.targets.get(id);
    if (!s) return;

    this.targets.delete(id);
    this.renderer.removeTarget(id, 'hit');

    const rt = Math.max(0, t - s.spawnMs);
    this.rtArr.push(rt);

    // base judge by rt
    let grade = this._judgeRt(rt);

    // scoring by type
    let scoreDelta = 0;
    let dmgBoss = 0;
    let dmgYou = 0;

    const feverMult = this.feverOn ? 1.35 : 1.0;
    const perfectMult = (grade === 'perfect') ? 1.20 : (grade === 'good' ? 1.0 : 0.75);

    if (s.type === 'normal') {
      scoreDelta = Math.round(18 * perfectMult * feverMult);
      dmgBoss = Math.round(6 * perfectMult * feverMult);
      this.hit_good += 1;
      if (grade === 'bad') this.hit_bad += 1;
    }
    else if (s.type === 'bossface') {
      // big moment
      grade = (grade === 'bad') ? 'good' : grade;
      scoreDelta = Math.round(34 * perfectMult * feverMult);
      dmgBoss = Math.round(14 * perfectMult * feverMult);
      this.hit_good += 1;
      FxBurst.popText(pt?.clientX ?? WIN.innerWidth/2, pt?.clientY ?? WIN.innerHeight/2, 'BOSS FACE!', 'sb-fx-fever');
    }
    else if (s.type === 'decoy') {
      // penalty + combo break
      scoreDelta = -Math.round(16 * (grade === 'bad' ? 1.15 : 1.0));
      dmgBoss = 0;
      dmgYou = (this.shield > 0) ? 0 : (2 + this.phase);
      this.combo = 0;
    }
    else if (s.type === 'bomb') {
      grade = 'bomb';
      scoreDelta = -Math.round(24 + 4 * this.phase);
      dmgBoss = 0;
      dmgYou = (this.shield > 0) ? 0 : (8 + 3 * this.phase);
      this.hit_bomb += 1;
      this.combo = 0;
    }
    else if (s.type === 'heal') {
      grade = 'heal';
      scoreDelta = Math.round(6 * feverMult);
      dmgBoss = Math.round(2 * feverMult);
      this.youHp = clamp(this.youHp + (10 + this.phase * 2), 0, 100);
      this.hit_heal += 1;
    }
    else if (s.type === 'shield') {
      grade = 'shield';
      scoreDelta = Math.round(6 * feverMult);
      dmgBoss = Math.round(2 * feverMult);
      this.shield += 1;
      this.shieldGain += 1;
      this.hit_shield += 1;
    }
    else {
      scoreDelta = Math.round(10 * perfectMult * feverMult);
      dmgBoss = Math.round(4 * perfectMult * feverMult);
    }

    // apply damages
    if (dmgYou > 0) {
      if (this.shield > 0) { this.shield -= 1; dmgYou = 0; }
      else this.youHp = clamp(this.youHp - dmgYou, 0, 100);
    }

    if (dmgBoss > 0) {
      this.bossHp = clamp(this.bossHp - dmgBoss, 0, this.bossMaxHp);
    }

    // combo & fever charge
    const isPenalty = (s.type === 'bomb' || s.type === 'decoy');
    if (!isPenalty) {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      // fever charge faster on perfect
      const add = (grade === 'perfect') ? 0.16 : (grade === 'good') ? 0.10 : 0.06;
      this.fever = clamp01(this.fever + add);
      if (!this.feverOn && this.fever >= 1) {
        // auto ignite if player continues combo
        // ignite only when a non-penalty hit occurs
        if (this.combo >= 6) {
          this.feverOn = true;
          this.fever = 0;
          this.feverUses += 1;
          this._showMsg('🔥 FEVER ON!', 'perfect');
          FxBurst.popText(pt?.clientX ?? WIN.innerWidth/2, pt?.clientY ?? WIN.innerHeight/2, 'FEVER!', 'sb-fx-fever');
        }
      }
    }

    // score apply
    this.score = Math.max(0, this.score + scoreDelta);

    // miss tracking
    if (grade === 'bad' && s.type === 'normal') {
      this.miss += 1;
      this.combo = 0;
    }

    // ✅ PATCH: FX ALWAYS (this is the key)
    // - For timeout miss we already used FxBurst directly.
    // - For every click hit we route through renderer to place FX at target.
    this.renderer.playHitFx(id, {
      clientX: pt?.clientX,
      clientY: pt?.clientY,
      grade,
      scoreDelta
    });

    // feedback text
    if (grade === 'perfect') this._showMsg(`PERFECT! +${Math.max(0,scoreDelta)}`, 'perfect');
    else if (grade === 'good') this._showMsg(`GOOD +${Math.max(0,scoreDelta)}`, 'good');
    else if (grade === 'bad') this._showMsg(`LATE... +${Math.max(0,scoreDelta)}`, 'bad');
    else if (grade === 'bomb') this._showMsg(`BOOM! -${Math.abs(scoreDelta)}`, 'bad');
    else if (grade === 'heal') this._showMsg(`HEAL +HP`, 'good');
    else if (grade === 'shield') this._showMsg(`SHIELD +1`, 'good');

    // log event
    this.eventLogger.add({
      ts_ms: Date.now(),
      mode: this.mode,
      diff: this.diffKey,
      boss_index: this.bossIndex,
      boss_phase: this.phase,
      target_id: id,
      target_type: s.type,
      is_boss_face: (s.type === 'bossface') ? 1 : 0,
      event_type: 'hit',
      rt_ms: Math.round(rt),
      grade,
      score_delta: scoreDelta,
      combo_after: this.combo,
      score_after: this.score,
      player_hp: this.youHp,
      boss_hp: this.bossHp
    });

    // boss down -> next phase/boss
    if (this.bossHp <= 0) {
      this.bossesCleared += 1;

      // clear remaining targets to avoid stale clicks
      for (const tid of this.targets.keys()) {
        this.renderer.removeTarget(tid, 'boss_clear');
      }
      this.targets.clear();

      // phase advance
      this.phase += 1;
      this._showMsg('✅ BOSS DOWN! เฟสถัดไป!', 'perfect');
      FxBurst.popText(WIN.innerWidth * 0.5, WIN.innerHeight * 0.22, 'BOSS DOWN!', 'sb-fx-win');

      // next boss every 2 phases
      const nextBoss = Math.min(BOSSES.length - 1, Math.floor((this.phase - 1) / 2));
      if (nextBoss !== this.bossIndex) this._setBoss(nextBoss);
      else {
        // same boss, refill stronger
        const b = BOSSES[this.bossIndex] || BOSSES[0];
        this.bossMaxHp = Math.round((Number(b.baseHp) || 120) * (1 + 0.08 * (this.phase - 1)));
        this.bossHp = this.bossMaxHp;
      }

      // small reward
      this.youHp = clamp(this.youHp + 10, 0, 100);
      this.shield += 1;
      this.shieldGain += 1;

      this._syncBossUI();
      this._syncBars();
    }

    // player dead -> finish
    if (this.youHp <= 0) {
      this._finish('hp_zero');
      return;
    }
  }

  _makeSnapshot() {
    const totalHits = this.hit_good + this.hit_heal + this.hit_shield; // approximate
    const totalJudged = totalHits + this.miss;
    const accPct = totalJudged ? ((totalJudged - this.miss) / totalJudged) * 100 : 0;

    // mean abs offset for this game is RT; keep proxy as avg rt
    const avgRt = this.rtArr.length ? (this.rtArr.reduce((a,b)=>a+b,0) / this.rtArr.length) : 0;
    const offsetAbsMean = avgRt / 1000;

    return {
      accPct,
      hitMiss: this.miss,
      combo: this.combo,
      offsetAbsMean,
      hp: this.youHp,
      songTime: (nowMs() - this.startMs) / 1000,
      durationSec: this.timeLimitSec
    };
  }

  _finish(reason) {
    if (this.ended) return;
    this.running = false;
    this.ended = true;

    // compute stats
    const dur = clamp((nowMs() - this.startMs) / 1000, 0, this.timeLimitSec);

    const totalJudged = (this.hit_good + this.hit_heal + this.hit_shield + this.hit_bomb + this.hit_bad) + this.miss;
    const accPct = totalJudged ? ((totalJudged - this.miss) / totalJudged) * 100 : 0;

    const avgRt = this.rtArr.length ? (this.rtArr.reduce((a,b)=>a+b,0) / this.rtArr.length) : 0;
    const minRt = this.rtArr.length ? Math.min(...this.rtArr) : 0;
    const maxRt = this.rtArr.length ? Math.max(...this.rtArr) : 0;

    const grade = gradeFromAcc(accPct);

    // fill result UI
    safeText(this.resTime, `${fmt1(dur)} s`);
    safeText(this.resScore, this.score);
    safeText(this.resMaxCombo, this.maxCombo);
    safeText(this.resMiss, this.miss);
    safeText(this.resPhase, this.phase);
    safeText(this.resBossCleared, this.bossesCleared);
    safeText(this.resAcc, `${fmt1(accPct)} %`);
    safeText(this.resGrade, grade);

    // session row
    const row = {
      ts_start_ms: Date.now() - Math.round(dur * 1000),
      ts_end_ms: Date.now(),
      duration_s: fmt1(dur),
      mode: this.mode,
      diff: this.diffKey,
      participant_id: this.researchMeta?.participant_id || '',
      group: this.researchMeta?.group || '',
      note: this.researchMeta?.note || '',
      bosses_cleared: this.bossesCleared,
      final_phase: this.phase,
      score: this.score,
      max_combo: this.maxCombo,
      miss: this.miss,
      hit_good: this.hit_good,
      hit_bad: this.hit_bad,
      hit_bomb: this.hit_bomb,
      hit_heal: this.hit_heal,
      hit_shield: this.hit_shield,
      accuracy_pct: fmt1(accPct),
      grade,
      avg_rt_ms: Math.round(avgRt),
      min_rt_ms: Math.round(minRt),
      max_rt_ms: Math.round(maxRt),
      fever_uses: this.feverUses,
      shield_gain: this.shieldGain,
      hp_end: Math.round(this.youHp),
      boss_hp_end: Math.round(this.bossHp),
      end_reason: reason
    };

    this.sessionLogger.fromStats(row);

    // final FX
    FxBurst.popText(WIN.innerWidth * 0.5, WIN.innerHeight * 0.18, `RESULT ${grade}`, grade === 'SSS' ? 'sb-fx-fever' : 'sb-fx-win');

    // switch view
    setView('sb-view-result');
  }
}

// ---------- UI wiring ----------
const game = new ShadowBreakerGame();

// mode buttons
const btnModeN = qs('sb-mode-normal');
const btnModeR = qs('sb-mode-research');
const modeDesc = qs('sb-mode-desc');
const boxResearch = qs('sb-research-box');

function applyModeUI(mode) {
  const isR = mode === 'research';
  btnModeN?.classList.toggle('is-active', !isR);
  btnModeR?.classList.toggle('is-active', isR);
  if (boxResearch) boxResearch.classList.toggle('is-on', isR);

  if (modeDesc) {
    modeDesc.textContent = isR
      ? 'Research: โหมดเก็บข้อมูล (กรอก Participant ID / Group) — ล็อกการปรับ AI เพื่อความเที่ยงตรง'
      : 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
  }
}

btnModeN?.addEventListener('click', () => applyModeUI('normal'));
btnModeR?.addEventListener('click', () => applyModeUI('research'));

// howto
const btnHowto = qs('sb-btn-howto');
const howto = qs('sb-howto');
btnHowto?.addEventListener('click', () => {
  if (!howto) return;
  howto.classList.toggle('is-on');
});

// start buttons
const btnPlay = qs('sb-btn-play');
const btnResearch = qs('sb-btn-research');

function start(mode) {
  const diffKey = (game.selDiff?.value || 'normal').toLowerCase();
  const timeSec = Number(game.selTime?.value || 70);

  const meta = {
    participant_id: (game.inPid?.value || '').trim(),
    group: (game.inGroup?.value || '').trim(),
    note: (game.inNote?.value || '').trim()
  };

  // if research but empty pid -> gentle warn (still allow)
  if (mode === 'research' && !meta.participant_id) {
    FxBurst.popText(WIN.innerWidth * 0.5, WIN.innerHeight * 0.22, 'แนะนำกรอก Participant ID', 'sb-fx-tip');
  }

  game.renderer.setDifficulty(diffKey);
  game.startFromMenu(mode, diffKey, timeSec, meta);
}

btnPlay?.addEventListener('click', () => start('normal'));
btnResearch?.addEventListener('click', () => {
  applyModeUI('research');
  start('research');
});

// back to menu (from play)
qs('sb-btn-back-menu')?.addEventListener('click', () => {
  // stop game quickly
  game.running = false;
  setView('sb-view-menu');
});

// result buttons
qs('sb-btn-result-retry')?.addEventListener('click', () => {
  // retry with current mode in UI
  const mode = readModeFromUI();
  start(mode);
});
qs('sb-btn-result-menu')?.addEventListener('click', () => {
  setView('sb-view-menu');
});

// downloads
qs('sb-btn-download-events')?.addEventListener('click', () => {
  downloadEventCsv(game.eventLogger, 'shadow-breaker-events.csv');
});
qs('sb-btn-download-session')?.addEventListener('click', () => {
  downloadSessionCsv(game.sessionLogger, 'shadow-breaker-session.csv');
});

// init
applyModeUI('normal');
setView('sb-view-menu');