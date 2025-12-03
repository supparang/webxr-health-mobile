// === /herohealth/vr-groups/ui.js ===
// Food Groups VR — HUD UI Module
// แสดง SCORE + GOAL + MINI QUEST + Feedback (2025-12-05)

(function (ns) {
  'use strict';

  let root = null;
  let scoreEl = null;
  let goalLabelEl = null;
  let goalBarEl = null;
  let goalCaptionEl = null;
  let miniLabelEl = null;
  let miniBarEl = null;
  let miniCaptionEl = null;
  let hintEl = null;

  let flashLayer = null;

  function ensureStructure() {
    if (root && root.isConnected) return;

    // ======================
    // ROOT HUD Wrapper
    // ======================
    root = document.createElement('div');
    root.id = 'fg-hud';
    root.style.cssText = `
      position:fixed;
      top:10px;
      left:10px;
      z-index:700;
      width:260px;
      font-family:system-ui,Segoe UI,Roboto,sans-serif;
      color:#e5e7eb;
      pointer-events:none;
    `;

    // SCORE
    const scoreBox = document.createElement('div');
    scoreBox.style.cssText = `
      background:rgba(15,23,42,0.85);
      padding:6px 10px;
      border-radius:12px;
      border:1px solid rgba(148,163,184,0.25);
      margin-bottom:8px;
    `;
    const sLabel = document.createElement('div');
    sLabel.style.cssText = `
      font-size:11px;
      opacity:.7;
      text-transform:uppercase;
      letter-spacing:.06em;
    `;
    sLabel.textContent = 'Score';

    scoreEl = document.createElement('div');
    scoreEl.style.cssText = `
      font-size:22px;
      font-weight:700;
      margin-top:2px;
      color:#22c55e;
    `;
    scoreEl.textContent = '0';

    scoreBox.appendChild(sLabel);
    scoreBox.appendChild(scoreEl);
    root.appendChild(scoreBox);

    // ======================
    // GOAL PANEL
    // ======================
    const goalBox = document.createElement('div');
    goalBox.style.cssText = `
      background:rgba(15,23,42,0.92);
      padding:6px 10px 8px;
      border-radius:12px;
      border:1px solid rgba(148,163,184,0.35);
      margin-bottom:8px;
    `;

    const goalTitle = document.createElement('div');
    goalTitle.textContent = 'Goal';
    goalTitle.style.cssText = `
      font-size:11px;
      text-transform:uppercase;
      opacity:.65;
      margin-bottom:4px;
    `;

    goalLabelEl = document.createElement('div');
    goalLabelEl.style.cssText = `
      font-size:14px;
      font-weight:600;
    `;
    goalLabelEl.textContent = '-';

    // bar
    const goalBar = document.createElement('div');
    goalBar.style.cssText = `
      width:100%;height:6px;background:#0f172a;
      border-radius:999px;overflow:hidden;margin-top:4px;
    `;
    goalBarEl = document.createElement('div');
    goalBarEl.style.cssText = `
      height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac);
      transition:width .18s ease-out;
    `;
    goalBar.appendChild(goalBarEl);

    goalCaptionEl = document.createElement('div');
    goalCaptionEl.style.cssText = `
      margin-top:3px;
      font-size:11px;
      color:#9ca3af;
    `;
    goalCaptionEl.textContent = '0 / 0';

    goalBox.appendChild(goalTitle);
    goalBox.appendChild(goalLabelEl);
    goalBox.appendChild(goalBar);
    goalBox.appendChild(goalCaptionEl);

    root.appendChild(goalBox);

    // ======================
    // MINI QUEST PANEL
    // ======================
    const miniBox = document.createElement('div');
    miniBox.style.cssText = `
      background:rgba(15,23,42,0.92);
      padding:6px 10px 8px;
      border-radius:12px;
      border:1px solid rgba(148,163,184,0.35);
      margin-bottom:10px;
    `;

    const miniTitle = document.createElement('div');
    miniTitle.textContent = 'Mini Quest';
    miniTitle.style.cssText = `
      font-size:11px;
      text-transform:uppercase;
      opacity:.65;
      margin-bottom:4px;
    `;

    miniLabelEl = document.createElement('div');
    miniLabelEl.style.cssText = `
      font-size:13px;
      font-weight:600;
    `;
    miniLabelEl.textContent = '-';

    const miniBar = document.createElement('div');
    miniBar.style.cssText = `
      width:100%;height:6px;background:#0f172a;
      border-radius:999px;overflow:hidden;margin-top:4px;
    `;
    miniBarEl = document.createElement('div');
    miniBarEl.style.cssText = `
      height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#bef264);
      transition:width .18s ease-out;
    `;
    miniBar.appendChild(miniBarEl);

    miniCaptionEl = document.createElement('div');
    miniCaptionEl.style.cssText = `
      margin-top:3px;
      font-size:11px;color:#9ca3af;
    `;

    miniBox.appendChild(miniTitle);
    miniBox.appendChild(miniLabelEl);
    miniBox.appendChild(miniBar);
    miniBox.appendChild(miniCaptionEl);
    root.appendChild(miniBox);

    // Hint
    hintEl = document.createElement('div');
    hintEl.style.cssText = `
      background:rgba(34,197,94,0.15);
      border:1px solid rgba(34,197,94,0.35);
      padding:6px 10px;
      border-radius:10px;
      font-size:12px;
      display:none;
      margin-bottom:8px;
    `;
    hintEl.textContent = '';
    root.appendChild(hintEl);

    // Flash layer (hit / miss)
    flashLayer = document.createElement('div');
    flashLayer.style.cssText = `
      position:fixed;inset:0;z-index:699;
      background:rgba(255,255,255,0);
      pointer-events:none;
      transition:background .12s ease-out;
    `;
    document.body.appendChild(flashLayer);

    document.body.appendChild(root);
  }

  /******************************************************
   * PUBLIC API
   ******************************************************/
  function init() {
    ensureStructure();
  }

  function show() {
    if (!root) ensureStructure();
    root.style.display = 'block';
  }

  function hide() {
    if (!root) return;
    root.style.display = 'none';
  }

  function reset() {
    if (!root) ensureStructure();
    scoreEl.textContent = '0';
    goalLabelEl.textContent = '-';
    goalBarEl.style.width = '0%';
    goalCaptionEl.textContent = '0 / 0';
    miniLabelEl.textContent = '-';
    miniBarEl.style.width = '0%';
    miniCaptionEl.textContent = '0 / 0';
    hintEl.style.display = 'none';
  }

  function setScore(v) {
    if (scoreEl) scoreEl.textContent = v;
  }

  function updateQuest(q) {
    if (!q) return;

    // Goal
    if (q.goal) {
      goalLabelEl.textContent = q.goal.label || '-';
      const pct = q.goal.target > 0 ? (q.goal.progress / q.goal.target) * 100 : 0;
      goalBarEl.style.width = `${pct}%`;
      goalCaptionEl.textContent = `${q.goal.progress} / ${q.goal.target}`;
    } else {
      goalLabelEl.textContent = 'Completed 🎉';
      goalBarEl.style.width = '100%';
    }

    // Mini
    if (q.mini) {
      miniLabelEl.textContent = q.mini.label || '-';
      const pct2 = q.mini.target > 0 ? (q.mini.progress / q.mini.target) * 100 : 0;
      miniBarEl.style.width = `${pct2}%`;
      miniCaptionEl.textContent = `${q.mini.progress} / ${q.mini.target}`;
    } else {
      miniLabelEl.textContent = 'Done';
      miniBarEl.style.width = '100%';
    }

    // Hint
    if (q.hint) {
      hintEl.style.display = 'block';
      hintEl.textContent = q.hint;
    } else {
      hintEl.style.display = 'none';
    }
  }

  function flashHit() {
    if (!flashLayer) return;
    flashLayer.style.background = 'rgba(255,255,255,0.25)';
    setTimeout(() => {
      flashLayer.style.background = 'rgba(255,255,255,0)';
    }, 60);
  }

  function flashMiss() {
    if (!flashLayer) return;
    flashLayer.style.background = 'rgba(255,0,0,0.22)';
    setTimeout(() => {
      flashLayer.style.background = 'rgba(255,255,255,0)';
    }, 120);
  }

  ns.foodGroupsUI = {
    init,
    show,
    hide,
    reset,
    setScore,
    updateQuest,
    flashHit,
    flashMiss
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));