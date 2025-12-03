// === /herohealth/vr-groups/GameEngine.js ===
// Production Ready – Food Groups VR Engine (2025-12-06)

'use strict';

(function (ns) {

  const emoji = ns.foodGroupsEmoji;                     // emoji-image.js
  const diffAPI = ns.foodGroupsDifficulty;              // difficulty.js
  const Quest = ns.GroupsQuestManager;                  // quest-manager.js
  const fx = ns.foodGroupsFx || {};                     // fx.js (optional)

  class FoodGroupsEngine {
    constructor(sceneEl) {
      this.scene = sceneEl;
      this.running = false;

      this.targets = [];
      this.spawnClock = 0;

      this.quest = new Quest();
      this.cfg = diffAPI.get('normal');
    }

    start(diff = 'normal') {
      this.cfg = diffAPI.get(diff);
      this.quest.start(diff);

      this.running = true;
      this.spawnClock = 0;

      console.log('[GroupsVR] START', diff);
    }

    tick(dt) {
      if (!this.running) return;

      // spawn
      this.spawnClock += dt;
      if (this.spawnClock >= this.cfg.spawnInterval) {
        this.spawnClock = 0;
        this.spawnTarget();
      }

      // update movement / TTL
      this.updateTargets(dt);
    }

    spawnTarget() {
      const item = emoji.pickRandom();   // ใช้ random ที่เราสร้าง

      const el = document.createElement('a-entity');
      el.setAttribute('data-hha-tgt', '1');

      const x = (Math.random() * 1.6) - 0.8;
      el.object3D.position.set(x, 1.4, -2.3);
      el.object3D.scale.set(this.cfg.scale, this.cfg.scale, this.cfg.scale);

      // ตั้ง material ให้ emoji
      el.setAttribute('geometry', {
        primitive: 'plane',
        width: 0.6,
        height: 0.6
      });

      el.setAttribute('material', {
        src: item.url,
        transparent: true,
        side: 'double'
      });

      el.addEventListener('click', () => this.onHit(el, item));

      this.scene.appendChild(el);

      this.targets.push({
        el,
        vy: this.cfg.fallSpeed,
        ttl: this.cfg.fallSpeed > 0 ? 99999 : this.cfg.itemLifetime,
        item
      });
    }

    updateTargets(dt) {
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];

        // ตกลงด้านล่าง
        t.el.object3D.position.y -= t.vy * (dt / 16);

        // ถ้าตกพ้นพื้น
        if (t.el.object3D.position.y < 0.3) {
          if (fx.playMissFx) fx.playMissFx(t.el.object3D.position);
          t.el.remove();
          this.targets.splice(i, 1);
          continue;
        }
      }
    }

    onHit(el, item) {
      if (fx.playHitFx) fx.playHitFx(el.object3D.position);

      const ok = this.quest.check(item.group, item.emoji);

      window.dispatchEvent(new CustomEvent('fg-score', {
        detail: { score: this.quest.score }
      }));

      if (ok) {
        window.dispatchEvent(new CustomEvent('hha:coach', {
          detail: { text: `🎯 เก่งมาก! ${item.emoji}` }
        }));
      }

      el.remove();
    }
  }

  ns.FoodGroupsEngine = FoodGroupsEngine;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));