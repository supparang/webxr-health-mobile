// === /herohealth/vr-groups/groups-race-summary-lock-v32.js ===
// HeroHealth • Groups Race v3.2 Summary Mode Lock + Banner Auto Hide
// Fixes:
// - LOCAL warning banner overlaps title/summary.
// - Waiting screen title appears visually behind summary.
// - Summary does not start at a clean top position.
// - Leaderboard panel looks empty/too tall after summary.
// PATCH v20260517-GROUPS-RACE-V32-SUMMARY-MODE-LOCK

(function () {
  'use strict';

  const VERSION = 'v20260517-groups-race-v32-summary-mode-lock';

  if (window.__HHA_GROUPS_RACE_SUMMARY_LOCK_V32__) return;
  window.__HHA_GROUPS_RACE_SUMMARY_LOCK_V32__ = true;

  const DOC = document;
  const WIN = window;

  function $(sel) {
    return DOC.querySelector(sel);
  }

  function qsa(sel) {
    return Array.from(DOC.querySelectorAll(sel));
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function isLocalTest() {
    return String(qs('roomId') || qs('room') || '').toUpperCase() === 'LOCAL';
  }

  function isSummaryVisible() {
    const s = $('#raceSummary');
    return Boolean(s && !s.hidden);
  }

  function isGameVisible() {
    const g = $('#raceGame');
    return Boolean(g && !g.hidden);
  }

  function injectStyle() {
    if ($('#groups-race-v32-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-race-v32-style';
    style.textContent = `
      body.race-summary-mode .race-page{
        padding-top:calc(8px + env(safe-area-inset-top,0px)) !important;
      }

      body.race-summary-mode #raceBootWarning,
      body.race-playing-mode #raceBootWarning{
        display:none !important;
        opacity:0 !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      body.race-summary-mode .race-waiting,
      body.race-summary-mode #raceWaiting,
      body.race-summary-mode .race-game,
      body.race-summary-mode #raceGame{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.race-summary-mode .race-layout{
        align-items:start !important;
      }

      body.race-summary-mode .race-main-card{
        min-height:auto !important;
        padding-top:20px !important;
        padding-bottom:22px !important;
      }

      body.race-summary-mode .race-summary{
        display:block !important;
        min-height:auto !important;
        padding:18px 0 24px !important;
        text-align:center !important;
      }

      body.race-summary-mode .race-summary .summary-icon{
        width:88px !important;
        height:88px !important;
        border-radius:26px !important;
        font-size:46px !important;
        margin:4px auto 12px !important;
      }

      body.race-summary-mode .race-summary h2{
        font-size:clamp(42px,6vw,76px) !important;
        line-height:1.02 !important;
        margin:8px 0 0 !important;
      }

      body.race-summary-mode .race-summary p{
        margin:12px 0 0 !important;
        font-size:clamp(14px,2.2vw,18px) !important;
      }

      body.race-summary-mode .summary-grid{
        width:min(760px,100%) !important;
        margin:24px auto 24px !important;
        gap:10px !important;
      }

      body.race-summary-mode .summary-grid div{
        min-height:108px !important;
        display:grid !important;
        place-items:center !important;
        align-content:center !important;
      }

      body.race-summary-mode .summary-grid b{
        font-size:clamp(34px,5vw,58px) !important;
      }

      body.race-summary-mode .summary-actions{
        margin-top:8px !important;
      }

      body.race-summary-mode .race-side-card{
        min-height:auto !important;
        position:sticky !important;
        top:calc(10px + env(safe-area-inset-top,0px)) !important;
      }

      body.race-summary-mode .race-help{
        display:none !important;
      }

      body.race-summary-mode .leaderboard{
        min-height:120px !important;
      }

      body.race-summary-mode .board-row{
        padding:14px !important;
        border-radius:20px !important;
      }

      body.race-summary-mode .board-score b{
        font-size:26px !important;
      }

      body.race-summary-mode .side-title h2::after{
        content:" • Final";
        color:#f0c16d;
      }

      .race-v32-summary-note{
        margin:14px auto 0;
        width:min(680px,100%);
        border-radius:22px;
        padding:12px 14px;
        background:rgba(118,199,255,.10);
        border:1px solid rgba(118,199,255,.18);
        color:#c8d7ff;
        font-size:13px;
        font-weight:900;
        line-height:1.4;
      }

      @media (max-width:980px){
        body.race-summary-mode .race-side-card{
          position:static !important;
        }

        body.race-summary-mode .race-summary{
          padding-top:18px !important;
        }
      }

      @media (max-width:680px){
        body.race-summary-mode .summary-grid{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        }

        body.race-summary-mode .race-summary h2{
          font-size:clamp(38px,11vw,60px) !important;
        }

        body.race-summary-mode .race-summary .summary-icon{
          width:78px !important;
          height:78px !important;
          font-size:40px !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function hideBootWarningWhenNeeded() {
    const warn = $('#raceBootWarning');
    if (!warn) return;

    if (isSummaryVisible() || isGameVisible()) {
      warn.hidden = true;
      warn.style.display = 'none';
      return;
    }

    if (isLocalTest()) {
      /*
        Keep LOCAL warning only briefly on waiting screen,
        then hide so it won't cover title.
      */
      const bootAt = Number((WIN.HHA_GROUPS_RACE_BOOT || {}).bootAt || 0);
      if (bootAt && Date.now() - bootAt > 2600) {
        warn.hidden = true;
        warn.style.display = 'none';
      }
    }
  }

  function ensureSummaryNote() {
    if (!isSummaryVisible()) return;

    const summary = $('#raceSummary');
    if (!summary || $('#raceV32SummaryNote')) return;

    const note = DOC.createElement('div');
    note.id = 'raceV32SummaryNote';
    note.className = 'race-v32-summary-note';

    note.textContent = isLocalTest()
      ? 'LOCAL Test: เป็นรอบทดสอบคนเดียว ถ้าต้องการแข่งพร้อมกันจริง ให้สร้างห้องจาก Race Lobby และใช้ Room Code เดียวกันหลายเครื่อง'
      : 'Race Result: ตารางคะแนนนี้มาจาก Live Leaderboard ของผู้เล่นในห้องเดียวกัน';

    const grid = $('.summary-grid');
    if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(note, grid.nextSibling);
    } else {
      summary.appendChild(note);
    }
  }

  function forceLeaderboardRow() {
    if (!isSummaryVisible()) return;

    const board = $('#leaderboard');
    if (!board) return;

    const txt = board.textContent || '';
    const name = qs('name', 'Hero');

    if (txt.includes(name) && !txt.includes('ยังไม่มีคะแนน')) return;

    const score = ($('#sumScore')?.textContent || '0').trim();
    const acc = ($('#sumAccuracy')?.textContent || '0%').trim();
    const combo = ($('#sumCombo')?.textContent || '0').trim();

    board.innerHTML = `
      <div class="board-row me local-test">
        <div class="board-left">
          <span class="place">👑</span>
          <div>
            <b>${escapeHtml(name)} (คุณ)</b>
            <small>จบแล้ว • Acc ${escapeHtml(acc)}</small>
          </div>
        </div>
        <div class="board-score">
          <b>${escapeHtml(score)}</b>
          <small>Combo ${escapeHtml(combo)}</small>
        </div>
      </div>
      <div class="race-v31-note">
        ${isLocalTest()
          ? 'LOCAL Test Mode: ใช้ทดสอบคนเดียว ถ้าต้องการ Race multiplayer จริง ให้เข้าผ่าน Lobby และใช้ Room Code เดียวกันหลายเครื่อง'
          : 'กำลังรอข้อมูล leaderboard จากห้อง Race'}
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function updateBodyMode() {
    DOC.body.classList.toggle('race-summary-mode', isSummaryVisible());
    DOC.body.classList.toggle('race-playing-mode', isGameVisible());
  }

  function scrollSummaryIntoViewOnce() {
    if (!isSummaryVisible()) return;

    if (DOC.body.dataset.raceV32Scrolled === '1') return;
    DOC.body.dataset.raceV32Scrolled = '1';

    setTimeout(() => {
      try {
        const card = $('.race-main-card');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          WIN.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (e) {
        try { WIN.scrollTo(0, 0); } catch (_) {}
      }
    }, 120);
  }

  function patchSummarySub() {
    if (!isSummaryVisible()) return;

    const sub = $('#summarySub');
    if (!sub) return;

    if (isLocalTest()) {
      sub.textContent = sub.textContent.replace('อันดับของคุณ: -', 'อันดับของคุณ: 1');
    }
  }

  function apply() {
    injectStyle();
    updateBodyMode();
    hideBootWarningWhenNeeded();

    if (isSummaryVisible()) {
      patchSummarySub();
      ensureSummaryNote();
      forceLeaderboardRow();
      scrollSummaryIntoViewOnce();
    } else {
      DOC.body.dataset.raceV32Scrolled = '0';
    }
  }

  function expose() {
    WIN.HHA_GROUPS_RACE_SUMMARY_LOCK_V32 = {
      version: VERSION,
      apply,
      getState() {
        return {
          version: VERSION,
          localTest: isLocalTest(),
          summaryVisible: isSummaryVisible(),
          gameVisible: isGameVisible()
        };
      }
    };
  }

  function init() {
    injectStyle();
    expose();

    setInterval(apply, 300);
    apply();

    console.info('[Groups Race v3.2] summary mode lock installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
