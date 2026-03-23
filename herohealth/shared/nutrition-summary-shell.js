// === /herohealth/shared/nutrition-summary-shell.js ===
// Shared summary modal shell
// PATCH v20260323-NUTRITION-SUMMARY-SCROLLSAFE-A

import { esc } from './nutrition-common.js';

let __styleDone = false;

function ensureStyle() {
  if (__styleDone) return;
  __styleDone = true;

  const style = document.createElement('style');
  style.textContent = `
    .nutri-summary-backdrop{
      position:fixed;
      inset:0;
      z-index:9999;
      display:none;
      overflow-y:auto;
      -webkit-overflow-scrolling:touch;
      background:rgba(2,6,23,.78);
      padding:16px 12px max(16px, env(safe-area-inset-bottom));
    }

    .nutri-summary-backdrop.show{
      display:block;
    }

    .nutri-summary-card{
      width:min(820px, 100%);
      margin:0 auto;
      background:linear-gradient(180deg, rgba(15,23,42,.98), rgba(30,41,59,.96));
      border:1px solid rgba(148,163,184,.18);
      border-radius:28px;
      box-shadow:0 18px 50px rgba(0,0,0,.32);
      color:#e5e7eb;
      padding:20px;
    }

    .nutri-summary-head{
      display:flex;
      gap:12px;
      align-items:flex-start;
      margin-bottom:12px;
    }

    .nutri-summary-badge{
      width:54px;
      height:54px;
      border-radius:18px;
      display:grid;
      place-items:center;
      background:rgba(56,189,248,.14);
      font-size:28px;
      flex:0 0 54px;
    }

    .nutri-summary-title{
      margin:0 0 6px;
      font-size:clamp(24px, 4vw, 34px);
      font-weight:900;
      line-height:1.1;
    }

    .nutri-summary-sub{
      margin:0;
      color:#cbd5e1;
      font-size:15px;
      line-height:1.45;
    }

    .nutri-summary-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));
      gap:12px;
      margin:0 0 16px;
    }

    .nutri-summary-item{
      background:rgba(15,23,42,.72);
      border:1px solid rgba(148,163,184,.14);
      border-radius:20px;
      padding:14px;
    }

    .nutri-summary-item-label{
      color:#93c5fd;
      font-size:13px;
      margin-bottom:6px;
      font-weight:800;
      line-height:1.35;
    }

    .nutri-summary-item-value{
      font-size:22px;
      font-weight:900;
      line-height:1.2;
      word-break:break-word;
    }

    .nutri-summary-note-card{
      background:rgba(34,197,94,.08);
      border:1px solid rgba(34,197,94,.14);
      border-radius:20px;
      padding:14px;
      margin:0 0 18px;
    }

    .nutri-summary-note-title{
      font-size:14px;
      font-weight:900;
      color:#bbf7d0;
      margin-bottom:8px;
    }

    .nutri-summary-notes{
      margin:0;
      padding-left:18px;
      color:#e2e8f0;
      line-height:1.55;
    }

    .nutri-summary-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      position:sticky;
      bottom:0;
      padding-top:12px;
      background:linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,.96) 36%);
    }

    .nutri-summary-actions button{
      border:0;
      border-radius:18px;
      cursor:pointer;
      padding:14px 18px;
      font-size:15px;
      font-weight:900;
      min-height:52px;
    }

    .nutri-summary-replay{
      background:#22c55e;
      color:#052e16;
    }

    .nutri-summary-back{
      background:#38bdf8;
      color:#082f49;
    }

    @media (max-width: 640px){
      .nutri-summary-card{
        border-radius:24px;
        padding:16px;
      }

      .nutri-summary-grid{
        grid-template-columns:1fr;
      }

      .nutri-summary-item-value{
        font-size:20px;
      }

      .nutri-summary-actions{
        flex-direction:column;
      }

      .nutri-summary-actions button{
        width:100%;
      }
    }
  `;
  document.head.appendChild(style);
}

export function mountSummaryShell(root, { onReplay, onBack, backLabel = 'กลับ HUB' } = {}) {
  ensureStyle();

  const backdrop = document.createElement('div');
  backdrop.className = 'nutri-summary-backdrop';
  backdrop.innerHTML = `
    <div class="nutri-summary-card" role="dialog" aria-modal="true">
      <div class="nutri-summary-head">
        <div class="nutri-summary-badge">🏆</div>
        <div>
          <h2 class="nutri-summary-title" id="nutriSummaryTitle">สรุปผล</h2>
          <p class="nutri-summary-sub" id="nutriSummarySub"></p>
        </div>
      </div>

      <div class="nutri-summary-grid" id="nutriSummaryGrid"></div>

      <div class="nutri-summary-note-card">
        <div class="nutri-summary-note-title">สิ่งที่ได้จากรอบนี้</div>
        <ul class="nutri-summary-notes" id="nutriSummaryNotes"></ul>
      </div>

      <div class="nutri-summary-actions">
        <button class="nutri-summary-replay" id="nutriSummaryReplayBtn">เล่นอีกครั้ง</button>
        <button class="nutri-summary-back" id="nutriSummaryBackBtn">${esc(backLabel)}</button>
      </div>
    </div>
  `;
  root.appendChild(backdrop);

  const titleEl = backdrop.querySelector('#nutriSummaryTitle');
  const subEl = backdrop.querySelector('#nutriSummarySub');
  const gridEl = backdrop.querySelector('#nutriSummaryGrid');
  const notesEl = backdrop.querySelector('#nutriSummaryNotes');
  const replayBtn = backdrop.querySelector('#nutriSummaryReplayBtn');
  const backBtn = backdrop.querySelector('#nutriSummaryBackBtn');

  replayBtn.addEventListener('click', () => onReplay?.());
  backBtn.addEventListener('click', () => onBack?.());

  function show(summary) {
    titleEl.textContent = summary.title || 'สรุปผล';
    subEl.textContent = summary.subtitle || '';

    gridEl.innerHTML = (summary.items || [])
      .map(item => `
        <div class="nutri-summary-item">
          <div class="nutri-summary-item-label">${esc(item.label)}</div>
          <div class="nutri-summary-item-value">${esc(item.value)}</div>
        </div>
      `)
      .join('');

    notesEl.innerHTML = (summary.notes || [])
      .map(note => `<li>${esc(note)}</li>`)
      .join('');

    backdrop.classList.add('show');
    backdrop.scrollTop = 0;
  }

  function hide() {
    backdrop.classList.remove('show');
  }

  return { show, hide };
}