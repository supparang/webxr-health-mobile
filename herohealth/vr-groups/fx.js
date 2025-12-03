// === /herohealth/vr-groups/fx.js ===
// Visual FX for Food Groups VR
// - Burst particles around hit target
// - Floating score text at hit position
// - Flash overlay for hit / miss
// - Provide fallback foodGroupsUI.flashJudgment() for GameEngine
// 2025-12-05

(function (ns) {
  'use strict';

  let sceneEl = null;
  let fxRoot = null;
  let flashEl = null;
  let styleInjected = false;

  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;

    const style = document.createElement('style');
    style.id = 'fg-fx-style';
    style.textContent = `
    .fg-fx-score {
      position: fixed;
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: #22c55e;
      text-shadow: 0 0 8px rgba(34,197,94,0.9);
      pointer-events: none;
      opacity: 0;
      transition: transform .45s ease-out, opacity .45s ease-out;
      z-index: 800;
      white-space: nowrap;
    }
    .fg-fx-score.show {
      opacity: 1;
      transform: translate(-50%, -50%) translateY(-26px);
    }
    .fg-fx-score.miss {
      color: #f97316;
      text-shadow: 0 0 10px rgba(248,113,113,0.9);
    }

    .fg-fx-flash {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, rgba(34,197,94,0.35), transparent 65%);
      opacity: 0;
      pointer-events: none;
      transition: opacity .18s ease-out;
      z-index: 790;
    }
    .fg-fx-flash.miss {
      background: radial-gradient(circle at center, rgba(248,113,113,0.35), transparent 65%);
    }
    .fg-fx-flash.show {
      opacity: 1;
    }
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    if (fxRoot && fxRoot.isConnected) return;
    fxRoot = document.createElement('div');
    fxRoot.id = 'fg-fx-root';
    fxRoot.style.position = 'fixed';
    fxRoot.style.inset = '0';
    fxRoot.style.pointerEvents = 'none';
    fxRoot.style.zIndex = '780';

    flashEl = document.createElement('div');
    flashEl.className = 'fg-fx-flash';
    fxRoot.appendChild(flashEl);

    document.body.appendChild(fxRoot);
  }

  function worldToScreen(pos) {
    try {
      if (!sceneEl || !sceneEl.camera || !window.THREE) {
        return {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        };
      }
      const cam = sceneEl.camera;
      const v = new THREE.Vector3(pos.x, pos.y, pos.z);
      v.project(cam);
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      return { x, y };
    } catch (e) {
      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };
    }
  }

  function spawnScoreText(worldPos, text, opts) {
    ensureStyle();
    ensureRoot();
    opts = opts || {};
    const isMiss = !!opts.isMiss;

    const screen = worldPos
      ? worldToScreen(worldPos)
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const el = document.createElement('div');
    el.className = 'fg-fx-score' + (isMiss ? ' miss' : '');
    el.textContent = text;

    el.style.left = screen.x + 'px';
    el.style.top = screen.y + 'px';

    fxRoot.appendChild(el);

    // trigger transition
    requestAnimationFrame(() => {
      el.classList.add('show');
    });

    setTimeout(() => {
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -50%) translateY(-46px)';
      setTimeout(() => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }, 420);
  }

  function flashOverlay(isMiss) {
    ensureStyle();
    ensureRoot();
    if (!flashEl) return;
    flashEl.classList.remove('miss');
    if (isMiss) flashEl.classList.add('miss');

    flashEl.classList.add('show');
    setTimeout(() => {
      if (flashEl) flashEl.classList.remove('show');
    }, 120);
  }

  // --------- A-Frame burst particles ----------
  function spawnBurstParticles(worldPos) {
    if (!sceneEl || !sceneEl.object3D || !window.THREE) return;

    const n = 10;
    const group = document.createElement('a-entity');
    group.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);

    for (let i = 0; i < n; i++) {
      const p = document.createElement('a-sphere');
      const r = 0.045 + Math.random() * 0.02;
      const angle = (Math.PI * 2 * i) / n;
      const dist = 0.2 + Math.random() * 0.25;
      const tx = Math.cos(angle) * dist;
      const ty = 0.1 + Math.random() * 0.18;
      const tz = Math.sin(angle) * dist;

      p.setAttribute('radius', r.toFixed(3));
      p.setAttribute(
        'color',
        i % 2 === 0 ? '#22c55e' : '#4ade80'
      );
      p.setAttribute('material', 'shader: flat; opacity: 0.9; transparent: true');

      p.setAttribute(
        'animation__move',
        `property: position; dir: normal; dur: 280; easing: easeOutQuad; to: ${tx.toFixed(
          3
        )} ${ty.toFixed(3)} ${tz.toFixed(3)}`
      );
      p.setAttribute(
        'animation__fade',
        'property: material.opacity; dir: normal; dur: 260; easing: linear; to: 0'
      );

      group.appendChild(p);
    }

    sceneEl.appendChild(group);
    setTimeout(() => {
      if (group && group.parentNode) group.parentNode.removeChild(group);
    }, 360);
  }

  // --------- Public API ---------
  const fx = {
    init: function (scene) {
      sceneEl = scene;
      ensureStyle();
      ensureRoot();
    },

    burst: function (worldPos) {
      if (!worldPos) {
        flashOverlay(false);
        return;
      }
      spawnBurstParticles(worldPos);
    },

    showHitFx: function (worldPos, opts) {
      opts = opts || {};
      const scoreDelta = opts.scoreDelta != null ? opts.scoreDelta : 0;
      const isMiss = !!opts.isMiss;
      const judgment = opts.judgment || '';

      const txt =
        judgment && !isMiss
          ? `${judgment.toUpperCase()} +${scoreDelta}`
          : isMiss
          ? `MISS ${scoreDelta < 0 ? scoreDelta : ''}`
          : `+${scoreDelta}`;

      if (worldPos) {
        spawnBurstParticles(worldPos);
      }
      spawnScoreText(worldPos, txt, { isMiss });
      flashOverlay(isMiss);
    },

    flashJudgment: function (payload) {
      payload = payload || {};
      const isMiss = !!payload.isMiss;
      const scoreDelta = payload.scoreDelta || 0;
      const judgment = payload.judgment || '';

      // worldPos: optional
      let worldPos = null;
      if (payload.worldPos) {
        worldPos = payload.worldPos;
      }
      fx.showHitFx(worldPos, {
        isMiss,
        scoreDelta,
        judgment
      });
    }
  };

  ns.foodGroupsFx = fx;

  // --------- Wire into UI (fallback for GameEngine) ---------
  if (!ns.foodGroupsUI) {
    ns.foodGroupsUI = {};
  }

  if (!ns.foodGroupsUI.flashJudgment) {
    ns.foodGroupsUI.flashJudgment = function (payload) {
      if (ns.foodGroupsFx && ns.foodGroupsFx.flashJudgment) {
        ns.foodGroupsFx.flashJudgment(payload || {});
      }
    };
  }

})(window.GAME_MODULES || (window.GAME_MODULES = {}));