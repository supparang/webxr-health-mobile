// === /herohealth/vr-groups/ui.js ===
// HUD สำหรับเกม Food Groups VR
// ใช้ชื่อ namespace: GAME_MODULES.foodGroupsUI

(function (ns) {
  'use strict';

  let root      = null;
  let scoreEl   = null;
  let timeEl    = null;
  let diffEl    = null;
  let judgeEl   = null;
  let legendEl  = null;
  let lastFlash = null;

  // ถ้าในอนาคตมี Fever UI แบบ global (จาก ui-fever.js)
  // เช่น window.HHA_FeverUI.ensureFeverBar ก็จะเรียกได้; ถ้าไม่มีจะข้ามไป
  let feverUI = null;
  function tryInitFever() {
    if (feverUI) return;
    if (window.HHA_FeverUI && typeof window.HHA_FeverUI.ensureFeverBar === 'function') {
      feverUI = window.HHA_FeverUI;
      feverUI.ensureFeverBar();
    }
  }

  function ensureRoot() {
    if (root && root.isConnected) return root;

    const styleId = 'fg-hud-style';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
      .fg-hud-root{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:640;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        padding:8px 8px 12px;
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
      }
      .fg-hud-top{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:flex-start;
      }
      .fg-card{
        background:linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82));
        border-radius:16px;
        padding:8px 10px;
        border:1px solid rgba(148,163,184,0.35);
        box-shadow:0 18px 40px rgba(15,23,42,0.9);
        pointer-events:auto;
      }
      .fg-card-main{
        min-width:180px;
        max-width:260px;
      }
      .fg-title{
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.12em;
        color:#9ca3af;
      }
      .fg-mode{
        font-size:14px;
        font-weight:700;
        margin-top:1px;
      }
      .fg-pill{
        display:inline-flex;
        align-items:center;
        gap:4px;
        padding:2px 8px;
        border-radius:999px;
        border:1px solid rgba(45,212,191,0.7);
        background:rgba(15,118,110,0.25);
        color:#a5f3fc;
        font-size:11px;
        font-weight:500;
        margin-top:4px;
      }
      .fg-metrics{
        display:flex;
        gap:10px;
        margin-top:6px;
      }
      .fg-metric-label{
        font-size:10px;
        text-transform:uppercase;
        letter-spacing:.06em;
        color:#9ca3af;
      }
      .fg-metric-value{
        font-size:16px;
        font-weight:700;
        margin-top:1px;
      }
      .fg-metric-value.score{ color:#22c55e; }
      .fg-metric-value.time{ color:#38bdf8; }

      .fg-judge{
        position:fixed;
        left:50%;
        top:18%;
        transform:translateX(-50%);
        padding:6px 14px;
        border-radius:999px;
        font-size:15px;
        font-weight:700;
        background:rgba(15,23,42,0.92);
        border:1px solid rgba(250,204,21,0.9);
        color:#facc15;
        box-shadow:0 16px 32px rgba(15,23,42,0.9);
        opacity:0;
        pointer-events:none;
        transition:opacity .18s ease-out, transform .18s ease-out;
        z-index:641;
      }
      .fg-judge.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }
      .fg-judge.miss{
        border-color:rgba(248,113,113,0.85);
        color:#fecaca;
      }

      .fg-legend{
        display:flex;
        flex-wrap:wrap;
        gap:4px;
        margin-top:4px;
        max-width:280px;
      }
      .fg-legend-pill{
        display:inline-flex;
        align-items:center;
        gap:4px;
        padding:2px 6px;
        border-radius:999px;
        background:rgba(15,23,42,0.9);
        border:1px solid rgba(148,163,184,0.4);
        font-size:11px;
        color:#e5e7eb;
      }
      .fg-legend-pill span:nth-child(1){
        font-size:13px;
      }

      .fg-hud-bottom{
        display:flex;
        justify-content:center;
        pointer-events:none;
      }
      .fg-hud-bottom-hint{
        pointer-events:auto;
        font-size:11px;
        padding:4px 10px;
        border-radius:999px;
        background:rgba(15,23,42,0.9);
        border:1px solid rgba(148,163,184,0.4);
        color:#9ca3af;
      }

      @media (max-width:640px){
        .fg-card{
          padding:6px 8px;
        }
        .fg-mode{ font-size:13px; }
        .fg-metric-value{ font-size:14px; }
      }
      `;
      document.head.appendChild(st);
    }

    root = document.createElement('div');
    root.className = 'fg-hud-root';
    root.style.display = 'flex';

    const top = document.createElement('div');
    top.className = 'fg-hud-top';

    // ---- card ซ้าย: ชื่อโหมด + คะแนน + เวลา ----
    const cardMain = document.createElement('div');
    cardMain.className = 'fg-card fg-card-main';

    const t = document.createElement('div');
    t.className = 'fg-title';
    t.textContent = 'Hero Health • Food Groups VR';

    const m = document.createElement('div');
    m.className = 'fg-mode';
    m.textContent = 'Food Groups';

    const pill = document.createElement('div');
    pill.className = 'fg-pill';

    diffEl = document.createElement('span');
    diffEl.textContent = 'NORMAL';

    const dot = document.createElement('span');
    dot.textContent = '•';

    timeEl = document.createElement('span');
    timeEl.textContent = '60s';

    pill.appendChild(diffEl);
    pill.appendChild(dot);
    pill.appendChild(timeEl);

    const metrics = document.createElement('div');
    metrics.className = 'fg-metrics';

    const mScore = document.createElement('div');
    const mScoreLabel = document.createElement('div');
    mScoreLabel.className = 'fg-metric-label';
    mScoreLabel.textContent = 'คะแนน';
    scoreEl = document.createElement('div');
    scoreEl.className = 'fg-metric-value score';
    scoreEl.textContent = '0';
    mScore.appendChild(mScoreLabel);
    mScore.appendChild(scoreEl);

    const mTime = document.createElement('div');
    const mTimeLabel = document.createElement('div');
    mTimeLabel.className = 'fg-metric-label';
    mTimeLabel.textContent = 'เวลา';
    const mTimeVal = document.createElement('div');
    mTimeVal.className = 'fg-metric-value time';
    // ใช้ timeEl เดิม
    const timeSpan = document.createElement('span');
    timeSpan.id = 'fg-time-inline';
    timeSpan.textContent = '60s';
    mTimeVal.appendChild(timeSpan);
    mTime.appendChild(mTimeLabel);
    mTime.appendChild(mTimeVal);

    metrics.appendChild(mScore);
    metrics.appendChild(mTime);

    cardMain.appendChild(t);
    cardMain.appendChild(m);
    cardMain.appendChild(pill);
    cardMain.appendChild(metrics);

    // ---- card ขวา: Legend อาหาร ----
    const cardLegend = document.createElement('div');
    cardLegend.className = 'fg-card';
    legendEl = document.createElement('div');
    legendEl.className = 'fg-legend';
    const legendTitle = document.createElement('div');
    legendTitle.className = 'fg-metric-label';
    legendTitle.textContent = 'หมู่อาหาร / ควรเลือก & ควรลด';
    cardLegend.appendChild(legendTitle);
    cardLegend.appendChild(legendEl);

    top.appendChild(cardMain);
    top.appendChild(cardLegend);

    // ---- bottom hint ----
    const bottom = document.createElement('div');
    bottom.className = 'fg-hud-bottom';
    const hint = document.createElement('div');
    hint.className = 'fg-hud-bottom-hint';
    hint.textContent = 'แตะเป้าอาหารให้ตรงหมู่ที่ดีต่อสุขภาพ ✨';
    bottom.appendChild(hint);

    root.appendChild(top);
    root.appendChild(bottom);

    document.body.appendChild(root);

    // bubble judgment
    judgeEl = document.createElement('div');
    judgeEl.className = 'fg-judge';
    judgeEl.textContent = '';
    document.body.appendChild(judgeEl);

    return root;
  }

  function show() {
    ensureRoot();
    root.style.display = 'flex';
  }

  function hide() {
    if (root) root.style.display = 'none';
    if (judgeEl) judgeEl.classList.remove('show', 'miss');
  }

  function reset() {
    ensureRoot();
    if (scoreEl) scoreEl.textContent = '0';
    if (timeEl)  timeEl.textContent = '60s';
    const inlineTime = document.getElementById('fg-time-inline');
    if (inlineTime) inlineTime.textContent = '60s';
    if (judgeEl) {
      judgeEl.textContent = '';
      judgeEl.classList.remove('show', 'miss');
    }
  }

  function setScore(v) {
    ensureRoot();
    if (scoreEl) scoreEl.textContent = String(v | 0);
  }

  function setTime(sec) {
    ensureRoot();
    const label = (sec | 0) + 's';
    timeEl && (timeEl.textContent = label);
    const inlineTime = document.getElementById('fg-time-inline');
    if (inlineTime) inlineTime.textContent = label;
  }

  function setDiff(diff) {
    ensureRoot();
    if (!diffEl) return;
    diffEl.textContent = String(diff || 'NORMAL').toUpperCase();
  }

  function flashJudgment(opts) {
    ensureRoot();
    if (!judgeEl) return;

    opts = opts || {};
    const isMiss  = !!opts.isMiss;
    const delta   = opts.scoreDelta != null ? opts.scoreDelta : 0;
    const judgment = opts.judgment || (isMiss ? 'MISS' : '');

    let text = opts.text || '';
    if (!text) {
      if (isMiss)       text = 'MISS';
      else if (judgment === 'perfect') text = 'PERFECT +' + delta;
      else if (judgment === 'good')    text = 'GOOD +' + delta;
      else text = (delta >= 0 ? '+' : '') + delta;
    }

    judgeEl.textContent = text;
    judgeEl.classList.remove('miss');

    if (isMiss || delta < 0) {
      judgeEl.classList.add('miss');
    }

    judgeEl.classList.add('show');

    if (lastFlash) clearTimeout(lastFlash);
    lastFlash = setTimeout(function () {
      if (judgeEl) judgeEl.classList.remove('show');
    }, 600);
  }

  function setLegend(list) {
    ensureRoot();
    if (!legendEl) return;
    legendEl.innerHTML = '';

    if (!Array.isArray(list) || !list.length) return;

    list.slice(0, 12).forEach(function (g) {
      const pill = document.createElement('div');
      pill.className = 'fg-legend-pill';
      const em = document.createElement('span');
      em.textContent = g.emoji || '❓';
      const lb = document.createElement('span');
      lb.textContent = g.label || '';
      if (!g.isGood) {
        pill.style.borderColor = 'rgba(248,113,113,0.85)';
      }
      pill.appendChild(em);
      pill.appendChild(lb);
      legendEl.appendChild(pill);
    });
  }

  ns.foodGroupsUI = {
    attachScene: function () { /* เผื่อใช้ต่อในอนาคต */ },
    init: ensureRoot,
    show,
    hide,
    reset,
    setScore,
    setTime,
    setDiff,
    flashJudgment,
    setLegend
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
