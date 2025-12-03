'use strict';

import { emojiImage } from './emoji-image.js';
import { FOOD_GROUPS, DIFF_TABLE } from './difficulty.js';
import { playHitFx, playMissFx } from './fx.js';
import { GroupsQuestManager } from './quest-manager.js';

AFRAME.registerComponent('food-groups-game', {
  schema: {},

  init() {
    this.running = false;
    this.targets = [];
    this.spawnClock = 0;

    this.diff = 'normal';

    // Quest system
    this.quest = new GroupsQuestManager();

    // Listen for fg-start from HTML
    this.el.sceneEl.addEventListener('fg-start', e => {
      this.startGame(e.detail.diff || 'normal');
    });
  },

  startGame(diff) {
    this.diff = diff;
    const cfg = DIFF_TABLE[diff] || DIFF_TABLE.normal;
    this.cfg = cfg;

    this.running = true;
    this.spawnClock = 0;

    this.quest.start(diff);

    console.log('[GroupsVR] Game Start', diff);
  },

  tick(time, dt) {
    if (!this.running) return;

    // spawn
    this.spawnClock += dt;
    if (this.spawnClock >= this.cfg.SPAWN_INTERVAL) {
      this.spawnClock = 0;
      this.spawnTarget();
    }

    // update + clean
    this.updateTargets(dt);
  },

  spawnTarget() {
    const item = FOOD_GROUPS[Math.floor(Math.random() * FOOD_GROUPS.length)];

    const y = 1.3;
    const x = (Math.random() * 1.6) - 0.8;
    const z = -2.2;

    const el = document.createElement('a-entity');
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('position', { x, y, z });
    el.setAttribute('scale', '0.8 0.8 0.8');

    const url = emojiImage(item.emoji);
    el.setAttribute('material', { src: url, transparent: true });
    el.setAttribute('geometry', { primitive: 'plane', height: 0.6, width: 0.6 });

    el.addEventListener('click', () => this.onHit(el, item));

    this.el.sceneEl.appendChild(el);

    this.targets.push({
      el,
      ttl: this.cfg.ITEM_LIFETIME
    });
  },

  updateTargets(dt) {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.ttl -= dt;

      if (t.ttl <= 0) {
        playMissFx(t.el.object3D.position);
        t.el.remove();
        this.targets.splice(i, 1);
      }
    }
  },

  onHit(el, item) {
    playHitFx(el.object3D.position);

    const ok = this.quest.check(item.group, item.name);

    window.dispatchEvent(new CustomEvent('fg-score', {
      detail: { score: this.quest.score }
    }));

    if (ok) {
      window.dispatchEvent(new CustomEvent('hha:coach', {
        detail: { text: `🎯 ${item.name}` }
      }));
    }

    el.remove();
  }
});