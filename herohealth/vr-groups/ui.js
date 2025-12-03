// === /herohealth/vr-groups/ui.js ===
// UI สำหรับ Food Groups VR • แสดง emoji + HUD + hit FX
// Production Ready 2025-12-05

(function (ns) {
  'use strict';

  //--------------------------------------------------------------------
  // Emoji Renderer
  //--------------------------------------------------------------------

  // ฟังก์ชันจาก emoji-image.js
  const emojiToImage = ns.foodGroupsEmoji?.emojiToImage;

  if (!emojiToImage) {
    console.warn('[GroupsVR/UI] emojiToImage not found.');
  }

  //--------------------------------------------------------------------
  // Root
  //--------------------------------------------------------------------
  let root = null;

  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'fg-ui-root';
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '600';
    document.body.appendChild(root);
    return root;
  }

  //--------------------------------------------------------------------
  // สร้าง DOM เป้าอาหาร (emoji sprite)
  //--------------------------------------------------------------------
  function createTargetDom(emoji, sizePx = 80) {
    const el = document.createElement('div');
    el.className = 'fg-target';
    el.style.position = 'absolute';
    el.style.width = sizePx + 'px';
    el.style.height = sizePx + 'px';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.pointerEvents = 'none';

    // โหลด emoji → image
    if (emojiToImage) {
      emojiToImage(emoji).then(url => {
        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
      });
    } else {
      el.textContent = emoji;
      el.style.fontSize = (sizePx * 0.8) + 'px';
    }

    return el;
  }

  //--------------------------------------------------------------------
  // ฝั่ง HUD SCORE
  //--------------------------------------------------------------------
  const HUD = {
    scoreEl: null,
    setScore(v) {
      if (!this.scoreEl) {
        this.scoreEl = document.getElementById('hud-score');
      }
      if (this.scoreEl) this.scoreEl.textContent = v;
    }
  };

  //--------------------------------------------------------------------
  // Hit FX (เรียกใช้ fx.js)
  //--------------------------------------------------------------------
  function spawnHitFx(x, y) {
    if (ns.foodGroupsFx && ns.foodGroupsFx.spawnHitFx) {
      ns.foodGroupsFx.spawnHitFx(x, y);
    }
  }
  function spawnMissFx(x, y) {
    if (ns.foodGroupsFx && ns.foodGroupsFx.spawnMissFx) {
      ns.foodGroupsFx.spawnMissFx(x, y);
    }
  }

  //--------------------------------------------------------------------
  // UI Controller
  //--------------------------------------------------------------------
  const UI = {
    targets: [],

    clear() {
      this.targets.forEach(t => t.remove());
      this.targets = [];
    },

    spawnTarget(foodObj) {
      ensureRoot();

      const { emoji, x, y, size } = foodObj;

      const sizePx = size || 90;

      const dom = createTargetDom(emoji, sizePx);

      dom.style.left = (x * window.innerWidth) + 'px';
      dom.style.top = (y * window.innerHeight) + 'px';

      root.appendChild(dom);

      this.targets.push({
        id: foodObj.id,
        group: foodObj.group,
        emoji: emoji,
        dom,
        x, y,
        sizePx
      });
    },

    removeTarget(id, hit = false) {
      const idx = this.targets.findIndex(t => t.id === id);
      if (idx === -1) return;

      const t = this.targets[idx];

      // FX
      if (hit) {
        spawnHitFx(t.x * window.innerWidth, t.y * window.innerHeight);
      } else {
        spawnMissFx(t.x * window.innerWidth, t.y * window.innerHeight);
      }

      t.dom.remove();
      this.targets.splice(idx, 1);
    },

    updateScore(score) {
      HUD.setScore(score);
    }
  };

  ns.foodGroupsUI = UI;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));