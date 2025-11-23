// === js/engine.js — Shadow Breaker core (Phase1 Research-Ready v6) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

const FPS = 60;

/* === Phase 1: spawn curve (เพิ่มความเร็วตาม Phase) ================== */
function spawnCurve(base, phase) {
  if (phase === 1) return base;
  if (phase === 2) return Math.round(base * 0.82);   // +18% เร็วขึ้น
  else return Math.round(base * 0.67);               // +33% เร็วขึ้น
}

/* === Phase 1: Camera Shake =========================================== */
function cameraShake(intensity = 6, duration = 140) {
  const el = document.body;
  if (!el) return;
  el.style.transform = `translate(${intensity}px, ${intensity}px)`;
  setTimeout(() => { el.style.transform = ''; }, duration);
}

/* === Phase 1: Neon Hit Effect ======================================== */
function neonHitFX(host, x, y, color = '#00f2ff') {
  if (!host) return;
  const fx = document.createElement('div');
  fx.className = 'sb-neon-hit';
  fx.style.left = `${x}px`;
  fx.style.top  = `${y}px`;
  fx.style.borderColor = color;
  host.appendChild(fx);
  setTimeout(() => fx.remove(), 280);
}
/* === spawnTarget() Phase1 อัปเดต ==================================== */
spawnTarget() {
  if (!this.running) return;

  const host = this.renderer?.host;
  if (!host) return;

  const id = this._nextTargetId++;
  const hpRatio = this.bossHp / this.bossHpMax;
  const phase = this.getBossPhaseFromHp();

  // bomb/decoy logic
  let decoy = false, bossFace = false;
  if (hpRatio <= 0.25 && Math.random() < 0.30) bossFace = true;
  else decoy = Math.random() < this.config.decoyRate;

  const emoji = bossFace
    ? (this.currentBoss?.emoji || '😈')
    : (decoy ? '💣' : '🥊');

  const t = {
    id,
    emoji,
    decoy,
    bossFace,
    createdAt: performance.now(),
    lifetime: this.config.targetLifetime,
    hit: false,
    phase_at_spawn: phase,
    size_px: this.config.sizePx,
    x_norm: null,
    y_norm: null,
    _el: null
  };

  this.targets.set(id, t);
  this.totalTargets++;

  this.renderer.spawnTarget(t);

  // auto-miss
  setTimeout(() => {
    const cur = this.targets.get(id);
    if (cur && !cur.hit) this.handleMiss(cur);
  }, this.config.targetLifetime + 60);
}
handleHit(t, grade, ageMs) {
  if (!this.targets.has(t.id) || t.hit) return;
  t.hit = true;
  this.targets.delete(t.id);

  this._computeNormPos(t);
  const zone = getZoneFromPos(t.x_norm, t.y_norm);

  let scoreDelta = 0;
  if (grade === 'perfect') scoreDelta = 120;
  else if (grade === 'good') scoreDelta = 80;
  else scoreDelta = 40;

  if (t.bossFace) scoreDelta *= 1.6;
  if (this.feverOn) scoreDelta *= 1.5;

  this.score += Math.round(scoreDelta);
  this.combo++;
  this.maxCombo = Math.max(this.maxCombo, this.combo);

  if (grade === 'perfect') this.perfect++;
  if (grade === 'good')    this.good++;
  if (grade === 'bad')     this.bad++;

  // damage
  let dmg = (grade === 'perfect') ? 8 : (grade === 'good' ? 5 : 3);
  if (t.bossFace) dmg *= 1.8;
  if (this.feverOn) dmg *= 1.5;

  this.bossHp = clamp(this.bossHp - dmg, 0, this.bossHpMax);
  this.hitCount++;

  // effect
  neonHitFX(this.renderer.host, t.lastPos.x, t.lastPos.y, '#00f2ff');

  if (t.bossFace) cameraShake(6, 120);

  // HUD
  this.setFeedback(grade);
  this.updateBossHUD();
  this.updateHUD();
  this.addFever(grade);

  // logging (Phase1 เพิ่ม zone_lr, zone_ud)
  this.hitLogs.push({
    event_type: 'hit',
    session_id: this.sessionId,
    run_index : this.runIndex,
    participant: this.researchMeta.participant,
    group: this.researchMeta.group,

    target_id: t.id,
    boss_id: this.currentBoss?.id || 0,
    boss_phase: this.getBossPhaseFromHp(),
    decoy: false,
    bossFace: t.bossFace,
    grade,
    age_ms: ageMs,
    x_norm: t.x_norm,
    y_norm: t.y_norm,
    zone_lr: zone.lr,
    zone_ud: zone.ud,

    score_delta: scoreDelta,
    combo_before: this.combo - 1,
    combo_after:  this.combo
  });

  if (this.bossHp <= 0) this.onBossDefeated();
}
beginGameLoop() {
  if (this.running) return;

  this.running = true;
  this.timeLeft = this.gameDuration;
  this._startTime = performance.now();

  if (this._spawnTimer) clearInterval(this._spawnTimer);

  this._spawnTimer = setInterval(() => {
    const phase = this.getBossPhaseFromHp();
    const interval = spawnCurve(this.config.spawnInterval, phase);
    // apply new interval (phase-based)
    clearInterval(this._spawnTimer);
    this._spawnTimer = setInterval(() => this.spawnTarget(), interval);
    this.spawnTarget();
  }, this.config.spawnInterval);

  const loop = () => {
    if (!this.running) return;
    const elapsed = (performance.now() - this._startTime) / 1000;
    this.timeLeft = this.gameDuration - elapsed;
    this.statTime.textContent = this.timeLeft.toFixed(1);
    if (this.timeLeft <= 0) {
      this.stopGame('หมดเวลา');
      return;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
/* === Phase 1: Zone detection for L/R + U/D ============================ */
function getZoneFromPos(xNorm, yNorm) {
  let lr = (xNorm < 0.33 ? 'L' : (xNorm < 0.66 ? 'C' : 'R'));
  let ud = (yNorm < 0.33 ? 'U' : (yNorm < 0.66 ? 'M' : 'D'));
  return { lr, ud };
}