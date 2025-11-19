// === engine.js (2025-11-19 fix: mobile accurate hit) ===
'use strict';

export class GameEngine {
  constructor({ config, hooks, renderer, logger, mode }) {
    this.config = config;
    this.hooks = hooks;
    this.renderer = renderer;
    this.logger = logger;
    this.mode = mode;

    this.targets = [];
    this.running = false;

    this.hitRadius = config.hitRadius || 80; // เส้นรอบวงตีง่ายขึ้น
  }

  start() {
    this.running = true;
    this.startAt = performance.now();
    this.nextSpawn = 0;
    this.loop();
  }

  stop(reason) {
    this.running = false;
    this.hooks.onEnd?.(this.state);
    this.logger.finish?.(this.state);
  }

  registerTouch(x, y) {
    for (const t of this.targets) {
      if (!t.dom) continue;
      const rect = t.dom.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= this.hitRadius) {
        this.hitTarget(t);
        return;
      }
    }
  }

  hitTarget(t) {
    t.hit = true;
    this.state.score += this.config.scoreHit;
    this.state.combo++;
    t.dom?.classList.add('hit');

    this.logger.logHit?.({
      id: t.id,
      event: 'hit',
      score: this.state.score
    });

    // remove
    setTimeout(() => this.renderer.removeTarget(t), 60);
  }

  loop() {
    if (!this.running) return;

    const now = performance.now();
    const dt = now - this.startAt;
    this.state.remainingMs = Math.max(0, this.config.durationMs - dt);

    if (this.state.remainingMs <= 0) {
      this.stop('timeout');
      return;
    }

    if (now >= this.nextSpawn) {
      this.spawn();
      this.nextSpawn = now + this.config.spawnInterval;
    }

    this.hooks.onUpdate?.(this.state);
    requestAnimationFrame(() => this.loop());
  }

  spawn() {
    const t = {
      id: 't' + Math.random(),
      x: Math.random(),
      y: Math.random(),
      emoji: this.config.emojiMain
    };
    this.targets.push(t);
    this.renderer.spawnTarget(t);

    this.logger.logSpawn?.({ id: t.id });
  }
}