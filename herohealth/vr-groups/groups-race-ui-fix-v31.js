// === /herohealth/vr-groups/groups-race-ui-fix-v31.js ===
// HeroHealth • Groups Race v3.1 UI Fix
// Fixes:
// - Summary top clipped by browser bar
// - LOCAL Test leaderboard empty after game ends
// - startAt=0 causes instant/awkward start
// - Summary layout too tall/too high
// PATCH v20260517-GROUPS-RACE-V31-SUMMARY-LOCAL-FIX

(function () {
  'use strict';

  const VERSION = 'v20260517-groups-race-v31-summary-local-fix';

  if (window.__HHA_GROUPS_RACE_UI_FIX_V31__) return;
  window.__HHA_GROUPS_RACE_UI_FIX_V31__ = true;

  const DOC = document;
  const WIN = window;

  function $(sel) {
    return DOC.querySelector(sel);
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function isLocalTest() {
    const room = String(qs('roomId') || qs('room') || '').toUpperCase();
    return room === 'LOCAL';
  }

  function injectStyle() {
    if (DOC.getElementById('groups-race-v31-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-race-v31-style';
    style.textContent = `
      .race-page{
        overflow-x:hidden !important;
        min-height:100vh !important;
        padding-top:calc(18px + env(safe-area-inset-top,0px)) !important;
      }

      .race-main-card{
        min-height:calc(100vh - 140px) !important;
        overflow:visible !important;
      }

      .race-summary{
        min-height:auto !important;
        padding:clamp(34px,6vh,68px) 0 34px !important;
        align-content:start !important;
      }

      .race-summary .summary-icon{
        margin-top:12px !important;
        margin-bottom:16px !important;
      }

      .race-summary h2{
        font-size:clamp(42px,7vw,78px) !important;
        line-height:1.04 !important;
        margin-top:10px !important;
        word-break:keep-all !important;
      }

      .race-summary p{
        margin-top:14px !important;
      }

      .summary-grid{
        margin-top:26px !important;
        margin-bottom:28px !important;
      }

      .race-side-card{
        min-height:calc(100vh - 140px) !important;
      }

      .board-row.local-test{
        background:rgba(240,193,109,.14) !important;
        border-color:rgba(240,193,109,.26) !important;
      }

      .race-v31-note{
        margin-top:12px;
        border-radius:18px;
        padding:10px 12px;
        background:rgba(240,193,109,.12);
        border:1px solid rgba(240,193,109,.22);
        color:#ffe29b;
        font-size:13px;
        font-weight:900;
        line-height:1.35;
      }

      @media (max-width:980px){
        .race-main-card,
        .race-side-card{
          min-height:auto !important;
        }

        .race-summary{
          padding-top:38px !important;
        }
      }

      @media (max-width:680px){
        .race-page{
          padding-top:calc(12px + env(safe-area-inset-top,0px)) !important;
        }

        .race-summary{
          padding-top:34px !important;
        }

        .race-summary h2{
          font-size:clamp(38px,11vw,60px) !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function isSummaryVisible() {
    const summary = $('#raceSummary');
    return Boolean(summary && !summary.hidden);
  }

  function readSummaryNumbers() {
    const score = ($('#sumScore')?.textContent || '0').trim();
    const acc = ($('#sumAccuracy')?.textContent || '0%').trim();
    const combo = ($('#sumCombo')?.textContent || '0').trim();
    const correct = ($('#sumCorrect')?.textContent || '0').trim();

    return { score, acc, combo, correct };
  }

  function ensureLocalLeaderboard() {
    if (!isLocalTest()) return;

    const board = $('#leaderboard');
    if (!board) return;

    const name = qs('name', 'Hero') || 'Hero';
    const nums = readSummaryNumbers();

    const currentText = board.textContent || '';
    const hasRealRow = currentText.includes(name) || currentText.includes('(คุณ)');

    if (hasRealRow && !currentText.includes('ยังไม่มีคะแนนในห้อง')) {
      return;
    }

    board.innerHTML = `
      <div class="board-row me local-test">
        <div class="board-left">
          <span class="place">👑</span>
          <div>
            <b>${escapeHtml(name)} (คุณ)</b>
            <small>${isSummaryVisible() ? 'จบแล้ว' : 'กำลังแข่ง'} • Acc ${escapeHtml(nums.acc)}</small>
          </div>
        </div>
        <div class="board-score">
          <b>${escapeHtml(nums.score)}</b>
          <small>Combo ${escapeHtml(nums.combo)}</small>
        </div>
      </div>
      <div class="race-v31-note">
        LOCAL Test Mode: ใช้ทดสอบคนเดียว ถ้าต้องการ Race multiplayer จริง ให้เข้าผ่าน Lobby และใช้ Room Code เดียวกันหลายเครื่อง
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

  function fixSummarySub() {
    const sub = $('#summarySub');
    if (!sub) return;

    if (isLocalTest()) {
      sub.textContent = sub.textContent.replace('อันดับของคุณ: -', 'อันดับของคุณ: 1');
      sub.textContent = sub.textContent.replace('อันดับของคุณ: 1', 'อันดับของคุณ: 1');
    }
  }

  function fixStartAtZeroNotice() {
    if (!isLocalTest()) return;

    const startAt = Number(qs('startAt', ''));
    if (startAt !== 0) return;

    const waitText = $('#raceWaitingText');
    if (waitText && !isSummaryVisible()) {
      waitText.textContent = 'LOCAL Test: กำลังเตรียมรอบทดสอบ';
    }
  }

  function markSyncStatus() {
    const sync = $('#syncStatus');
    if (!sync) return;

    if (isLocalTest()) {
      sync.textContent = 'Local Test';
      sync.classList.remove('online', 'offline', 'connecting');
      sync.classList.add('local');
    }
  }

  function apply() {
    injectStyle();
    markSyncStatus();
    fixStartAtZeroNotice();

    if (isSummaryVisible()) {
      fixSummarySub();
      ensureLocalLeaderboard();
    }
  }

  function expose() {
    WIN.HHA_GROUPS_RACE_UI_FIX_V31 = {
      version: VERSION,
      apply,
      isLocalTest,
      getState() {
        return {
          version: VERSION,
          localTest: isLocalTest(),
          summaryVisible: isSummaryVisible()
        };
      }
    };
  }

  function init() {
    injectStyle();
    expose();

    setInterval(apply, 400);
    apply();

    console.info('[Groups Race v3.1] UI summary/local fix installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
