// === /herohealth/vr/quest-hud-vr.js ===
// HUD มุมขวาบน + หน้าสรุปกลางจอ (เล่นอีกครั้ง / กลับ HUB)
// ใช้ร่วม GoodJunk VR / Hydration VR / Food Groups VR
// 2025-12-07

'use strict';

(function (global) {
  const doc = global.document;

  let styleInjected = false;

  // HUD (มุมขวาบน)
  let hudRoot = null;
  let hudScoreEl = null;
  let hudComboEl = null;
  let hudMissEl = null;
  let hudGoalLabelEl = null;
  let hudGoalProgEl = null;
  let hudMiniLabelEl = null;
  let hudMiniProgEl = null;

  // End summary (กลางจอ)
  let endRoot = null;
  let endTitleEl = null;
  let endDetailEl = null;
  let endGoalEl = null;
  let endMiniEl = null;
  let endBtnReplay = null;
  let endBtnHub = null;

  // เก็บค่า goal/mini ล่าสุดไว้ให้ summary ใช้
  let lastGoal = null;
  let lastMini = null;
  let lastScore = 0;
  let lastComboMax = 0;
  let lastMiss = 0;
  let lastModeLabel = '';
  let lastDiff = '';
  let lastGreenTick = 0;

  // -----------------------
  // CSS สำหรับ HUD + summary
  // -----------------------
  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;

    const st = doc.createElement('style');
    st.id = 'hha-quest-style';
    st.textContent = `
      /* === HUD มุมขวาบน === */
      .hha-quest-panel{
        position:fixed;
        right:10px;
        top:68px;
        z-index:620;
        max-width:260px;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
      }
      .hha-quest-card{
        background:radial-gradient(circle at top left,rgba(59,130,246,0.18),transparent 55%),
                   rgba(15,23,42,0.96);
        border-radius:14px;
        padding:8px 10px;
        border:1px solid rgba(148,163,184,0.45);
        box-shadow:0 14px 32px rgba(15,23,42,0.9);
        color:#e5e7eb;
      }
      .hha-quest-header{
        display:flex;
        justify-content:space-between;
        align-items:center;
        font-size:11px;
        margin-bottom:4px;
        gap:6px;
      }
      .hha-quest-title{
        font-weight:600;
        letter-spacing:.14em;
        text-transform:uppercase;
        color:#9ca3af;
      }
      .hha-quest-score {
        text-align:right;
        font-size:11px;
        line-height:1.2;
      }
      .hha-quest-score span{
        display:block;
      }
      .hha-quest-score-main{
        font-size:13px;
        font-weight:700;
        color:#facc15;
      }
      .hha-quest-score-sub{
        color:#a5b4fc;
      }

      .hha-quest-block{
        margin-top:4px;
        padding-top:4px;
        border-top:1px dashed rgba(148,163,184,0.45);
      }
      .hha-quest-label{
        font-size:11px;
        font-weight:600;
        color:#bae6fd;
        margin-bottom:2px;
      }
      .hha-quest-text{
        font-size:11px;
        color:#e5e7eb;
      }
      .hha-quest-progress{
        font-size:11px;
        color:#cbd5f5;
        margin-top:2px;
      }

      /* === หน้าสรุปกลางจอ === */
      .hha-end-overlay{
        position:fixed;
        inset:0;
        z-index:910;
        display:flex;
        align-items:center;
        justify-content:center;
        pointer-events:none;
        opacity:0;
        transition:opacity .25s ease-out;
      }
      .hha-end-overlay.on{
        opacity:1;
        pointer-events:auto;
      }
      .hha-end-backdrop{
        position:absolute;
        inset:0;
        background:
          radial-gradient(circle at top, rgba(15,23,42,0.15), transparent 60%),
          rgba(15,23,42,0.92);
        backdrop-filter:blur(10px);
      }
      .hha-end-card{
        position:relative;
        max-width:360px;
        width:90%;
        background:radial-gradient(circle at top left,rgba(56,189,248,0.25),transparent 60%),
                   rgba(15,23,42,1);
        border-radius:20px;
        padding:16px 16px 14px;
        border:1px solid rgba(148,163,184,0.55);
        box-shadow:0 20px 55px rgba(15,23,42,0.95);
        color:#e5e7eb;
      }
      .hha-end-title{
        font-size:18px;
        font-weight:700;
        margin-bottom:4px;
        display:flex;
        align-items:center;
        gap:8px;
      }
      .hha-end-title span.emoji{
        font-size:20px;
      }
      .hha-end-sub{
        font-size:12px;
        color:#cbd5f5;
        margin-bottom:10px;
      }
      .hha-end-row{
        display:flex;
        justify-content:space-between;
        font-size:12px;
        margin-bottom:4px;
      }
      .hha-end-row strong{
        font-weight:600;
      }
      .hha-end-section{
        margin-top:8px;
        padding-top:8px;
        border-top:1px dashed rgba(148,163,184,0.5);
        font-size:12px;
      }
      .hha-end-section h4{
        font-size:12px;
        font-weight:600;
        color:#bae6fd;
        margin-bottom:3px;
      }
      .hha-end-section p{
        margin:0;
      }
      .hha-end-buttons{
        margin-top:12px;
        display:flex;
        gap:8px;
        justify-content:flex-end;
        flex-wrap:wrap;
      }
      .hha-end-btn{
        border-radius:999px;
        border:1px solid rgba(148,163,184,0.75);
        background:rgba(15,23,42,0.95);
        color:#e5e7eb;
        padding:6px 12px;
        font-size:12px;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        gap:6px;
        transition:background .15s ease, transform .12s ease, box-shadow .15s ease;
      }
      .hha-end-btn span.emoji{
        font-size:14px;
      }
      .hha-end-btn-primary{
        border-color:rgba(34,197,94,0.85);
        background:linear-gradient(135deg,#16a34a,#22c55e);
        color:#022c22;
        box-shadow:0 12px 30px rgba(22,163,74,0.65);
      }
      .hha-end-btn-primary:hover{
        transform:translateY(-1px);
        box-shadow:0 14px 36px rgba(22,163,74,0.85);
      }
      .hha-end-btn-secondary:hover{
        background:rgba(30,64,175,0.9);
      }

      @media (max-width: 640px){
        .hha-quest-panel{
          right:8px;
          top:64px;
          max-width:230px;
        }
        .hha-end-card{
          padding:14px 12px 12px;
        }
      }
    `;
    doc.head.appendChild(st);
  }

  // -----------------------
  // สร้าง HUD มุมขวาบน
  // -----------------------
  function ensureHud() {
    if (hudRoot && hudRoot.isConnected) return;

    ensureStyle();

    hudRoot = doc.createElement('div');
    hudRoot.className = 'hha-quest-panel';
    hudRoot.innerHTML = `
      <div class="hha-quest-card">
        <div class="hha-quest-header">
          <div class="hha-quest-title">QUEST</div>
          <div class="hha-quest-score">
            <span class="hha-quest-score-main" id="hha-hud-score">0</span>
            <span class="hha-quest-score-sub">
              combo <span id="hha-hud-combo">0</span> • miss <span id="hha-hud-miss">0</span>
            </span>
          </div>
        </div>

        <div class="hha-quest-block">
          <div class="hha-quest-label">Goal</div>
          <div class="hha-quest-text" id="hha-hud-goal-label">—</div>
          <div class="hha-quest-progress" id="hha-hud-goal-prog">0 / 0</div>
        </div>

        <div class="hha-quest-block">
          <div class="hha-quest-label">Mini quest</div>
          <div class="hha-quest-text" id="hha-hud-mini-label">—</div>
          <div class="hha-quest-progress" id="hha-hud-mini-prog">0 / 0</div>
        </div>
      </div>
    `;
    doc.body.appendChild(hudRoot);

    hudScoreEl     = hudRoot.querySelector('#hha-hud-score');
    hudComboEl     = hudRoot.querySelector('#hha-hud-combo');
    hudMissEl      = hudRoot.querySelector('#hha-hud-miss');
    hudGoalLabelEl = hudRoot.querySelector('#hha-hud-goal-label');
    hudGoalProgEl  = hudRoot.querySelector('#hha-hud-goal-prog');
    hudMiniLabelEl = hudRoot.querySelector('#hha-hud-mini-label');
    hudMiniProgEl  = hudRoot.querySelector('#hha-hud-mini-prog');
  }

  // -----------------------
  // สร้าง End Summary กลางจอ
  // -----------------------
  function ensureEndOverlay() {
    if (endRoot && endRoot.isConnected) return;
    ensureStyle();

    endRoot = doc.createElement('div');
    endRoot.className = 'hha-end-overlay';
    endRoot.innerHTML = `
      <div class="hha-end-backdrop"></div>
      <div class="hha-end-card">
        <div class="hha-end-title">
          <span class="emoji">🎯</span>
          <span id="hha-end-title-text">สรุปผลการเล่น</span>
        </div>
        <div class="hha-end-sub" id="hha-end-sub-text">
          —
        </div>

        <div class="hha-end-row">
          <span><strong>คะแนนรวม</strong></span>
          <span id="hha-end-score">0</span>
        </div>
        <div class="hha-end-row">
          <span>Combo สูงสุด</span>
          <span id="hha-end-combo">0</span>
        </div>
        <div class="hha-end-row">
          <span>จำนวน MISS</span>
          <span id="hha-end-miss">0</span>
        </div>
        <div class="hha-end-row">
          <span>เวลาในโซน GREEN</span>
          <span id="hha-end-green">0 s</span>
        </div>

        <div class="hha-end-section">
          <h4>Goal</h4>
          <p id="hha-end-goal">—</p>
        </div>

        <div class="hha-end-section">
          <h4>Mini quest</h4>
          <p id="hha-end-mini">—</p>
        </div>

        <div class="hha-end-buttons">
          <button class="hha-end-btn hha-end-btn-secondary" id="hha-end-btn-hub">
            <span class="emoji">🏠</span><span>กลับหน้า HUB</span>
          </button>
          <button class="hha-end-btn hha-end-btn-primary" id="hha-end-btn-replay">
            <span class="emoji">🔁</span><span>เล่นอีกครั้ง</span>
          </button>
        </div>
      </div>
    `;
    doc.body.appendChild(endRoot);

    endTitleEl   = endRoot.querySelector('#hha-end-title-text');
    endDetailEl  = endRoot.querySelector('#hha-end-sub-text');
    endGoalEl    = endRoot.querySelector('#hha-end-goal');
    endMiniEl    = endRoot.querySelector('#hha-end-mini');
    endBtnReplay = endRoot.querySelector('#hha-end-btn-replay');
    endBtnHub    = endRoot.querySelector('#hha-end-btn-hub');

    const scoreEl = endRoot.querySelector('#hha-end-score');
    const comboEl = endRoot.querySelector('#hha-end-combo');
    const missEl  = endRoot.querySelector('#hha-end-miss');
    const greenEl = endRoot.querySelector('#hha-end-green');

    // ปุ่ม "เล่นอีกครั้ง" = reload หน้าเดิม
    if (endBtnReplay) {
      endBtnReplay.addEventListener('click', () => {
        global.location.reload();
      });
    }

    // ปุ่ม "กลับหน้า HUB"
    if (endBtnHub) {
      endBtnHub.addEventListener('click', () => {
        // ให้ตั้ง data-hub-url ใน <body> ได้ ถ้าไม่มีก็เดาเป็น hub.html
        const hubAttr =
          doc.body.getAttribute('data-hub-url') ||
          (doc.querySelector('[data-hha-hub]') &&
           doc.querySelector('[data-hha-hub]').getAttribute('data-hha-hub'));
        const url = hubAttr || './hub.html';
        global.location.href = url;
      });
    }

    // เก็บไว้ใส่ค่าจาก event ภายนอก
    endRoot._scoreEl = scoreEl;
    endRoot._comboEl = comboEl;
    endRoot._missEl  = missEl;
    endRoot._greenEl = greenEl;
  }

  // -----------------------
  // อัปเดต HUD จาก hha:score
  // -----------------------
  function onScore(ev) {
    ensureHud();
    const d = ev.detail || {};

    lastScore     = d.score ?? lastScore;
    lastComboMax  = Math.max(lastComboMax, d.comboMax ?? d.combo ?? 0);
    lastMiss      = d.misses ?? d.miss ?? lastMiss;
    lastModeLabel = d.modeLabel || d.mode || lastModeLabel;
    lastDiff      = d.difficulty || lastDiff;

    if (typeof d.greenTick === 'number') {
      lastGreenTick = d.greenTick;
    } else if (typeof d.timeSec === 'number' && d.waterZone === 'GREEN') {
      lastGreenTick = d.timeSec;
    }

    if (hudScoreEl) hudScoreEl.textContent = String(lastScore);
    if (hudComboEl) hudComboEl.textContent = String(d.combo ?? 0);
    if (hudMissEl)  hudMissEl.textContent  = String(lastMiss);
  }

  // -----------------------
  // อัปเดต HUD จาก quest:update
  // -----------------------
  function onQuest(ev) {
    ensureHud();
    const d = ev.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;

    lastGoal = goal;
    lastMini = mini;

    if (goal && hudGoalLabelEl && hudGoalProgEl) {
      hudGoalLabelEl.textContent = goal.label || '—';
      const p = goal.prog ?? 0;
      const t = goal.target ?? 0;
      hudGoalProgEl.textContent = `${p} / ${t}`;
    }

    if (mini && hudMiniLabelEl && hudMiniProgEl) {
      hudMiniLabelEl.textContent = mini.label || '—';
      const p = mini.prog ?? 0;
      const t = mini.target ?? 0;
      hudMiniProgEl.textContent = `${p} / ${t}`;
    }
  }

  // -----------------------
  // แสดงหน้าสรุปเมื่อ hha:end
  // -----------------------
  function onEnd(ev) {
    ensureEndOverlay();
    const d = ev.detail || {};

    // อัปเดตค่าจาก end detail ด้วย (บางโหมดจะส่ง goalsCleared ฯลฯ มา)
    if (typeof d.score === 'number') lastScore = d.score;
    if (typeof d.comboMax === 'number') lastComboMax = d.comboMax;
    if (typeof d.misses === 'number') lastMiss = d.misses;
    if (typeof d.greenTick === 'number') lastGreenTick = d.greenTick;
    if (d.modeLabel || d.mode) lastModeLabel = d.modeLabel || d.mode;
    if (d.difficulty) lastDiff = d.difficulty;

    const goalsCleared = d.goalsCleared ?? d.goalsDone ?? 0;
    const goalsTotal   = d.goalsTotal   ?? 0;
    const questsCleared= d.questsCleared?? 0;
    const questsTotal  = d.questsTotal  ?? 0;

    if (endTitleEl) {
      endTitleEl.textContent = `สรุปผล – ${lastModeLabel || 'Hero Health VR'}`;
    }

    if (endDetailEl) {
      const diffLabel = lastDiff
        ? (lastDiff === 'easy'
          ? 'ง่าย'
          : lastDiff === 'hard'
            ? 'ยาก'
            : 'ปกติ')
        : '—';
      endDetailEl.textContent =
        `โหมด: ${diffLabel} • Goal ${goalsCleared}/${goalsTotal} • Mini ${questsCleared}/${questsTotal}`;
    }

    if (endRoot && endRoot._scoreEl) {
      endRoot._scoreEl.textContent = String(lastScore);
    }
    if (endRoot && endRoot._comboEl) {
      endRoot._comboEl.textContent = String(lastComboMax);
    }
    if (endRoot && endRoot._missEl) {
      endRoot._missEl.textContent = String(lastMiss);
    }
    if (endRoot && endRoot._greenEl) {
      endRoot._greenEl.textContent = `${lastGreenTick | 0} s`;
    }

    // สรุปข้อความ Goal / Mini
    if (endGoalEl) {
      if (lastGoal) {
        const p = lastGoal.prog ?? 0;
        const t = lastGoal.target ?? 0;
        const done = lastGoal.done ? '✅ สำเร็จแล้ว' : '⏳ กำลังทำอยู่';
        endGoalEl.textContent = `${lastGoal.label || '—'} (${p}/${t}) • ${done}`;
      } else {
        endGoalEl.textContent = '—';
      }
    }
    if (endMiniEl) {
      if (lastMini) {
        const p = lastMini.prog ?? 0;
        const t = lastMini.target ?? 0;
        const done = lastMini.done ? '✅ สำเร็จแล้ว' : '⏳ กำลังทำอยู่';
        endMiniEl.textContent = `${lastMini.label || '—'} (${p}/${t}) • ${done}`;
      } else {
        endMiniEl.textContent = '—';
      }
    }

    // แสดง overlay
    if (endRoot) {
      endRoot.classList.add('on');
    }
  }

  // -----------------------
  // ผูก Event global
  // -----------------------
  global.addEventListener('hha:score', onScore);
  global.addEventListener('quest:update', onQuest);
  global.addEventListener('hha:end', onEnd);

})(window);
