// === /herohealth/vr-groups/ui.js ===
// Food Groups VR — UI Layer (HUD logic only, NO CSS here)
// 2025-12-05 Production Ready

(function (ns) {
  'use strict';

  let scoreEl = null;
  let legendEl = null;
  let judgmentWrap = null;

  // สร้าง style เฉพาะของ judgment popup
  function ensureStyle() {
    if (document.getElementById('fg-ui-style')) return;

    const st = document.createElement('style');
    st.id = 'fg-ui-style';
    st.textContent = `
      .fg-judge{
        position:fixed;
        left:50%; top:50%;
        transform:translate(-50%,-50%);
        font-size:28px;
        font-weight:700;
        opacity:0;
        pointer-events:none;
        transition:opacity .18s ease-out, transform .18s ease-out;
        z-index:960;
        text-shadow:0 4px 12px rgba(0,0,0,0.6);
      }
      .fg-judge.show{
        opacity:1;
        transform:translate(-50%,-60%);
      }
      .fg-legend{
        position:fixed;
        right:10px; bottom:10px;
        background:rgba(15,23,42,0.75);
        border:1px solid rgba(255,255,255,0.15);
        border-radius:12px;
        padding:8px 10px;
        font-size:13px;
        color:#e5e7eb;
        z-index:940;
        display:none;
      }
      .fg-legend.show{ display:block; }
      .fg-legend-row{
        display:flex;
        justify-content:space-between;
        min-width:140px;
        gap:8px;
        padding:2px 0;
      }
    `;
    document.head.appendChild(st);
  }

  // สร้าง element หลัก
  function init() {
    ensureStyle();

    scoreEl = document.getElementById('hud-score');
    if (!scoreEl) {
      console.warn('[GroupsUI] #hud-score not found.');
    }

    // Legend
    legendEl = document.createElement('div');
    legendEl.className = 'fg-legend';
    document.body.appendChild(legendEl);

    // judgment popup
    judgmentWrap = document.createElement('div');
    judgmentWrap.className = 'fg-judge';
    judgmentWrap.textContent = '';
    document.body.appendChild(judgmentWrap);
  }

  function show() {
    if (legendEl) legendEl.classList.add('show');
  }

  function hide() {
    if (legendEl) legendEl.classList.remove('show');
  }

  // ตั้งคะแนน (เปลี่ยนสีตามบวก/ลบ)
  function setScore(v) {
    if (!scoreEl) return;
    scoreEl.textContent = v;
  }

  // Legend แสดง emoji + label ของแต่ละกลุ่มอาหาร
  function setLegend(list) {
    if (!legendEl) return;
    legendEl.innerHTML = '';

    if (!Array.isArray(list)) return;

    list.forEach(g => {
      const row = document.createElement('div');
      row.className = 'fg-legend-row';
      row.innerHTML = `
        <span>${g.emoji || ''}</span>
        <span>${g.label || ''}</span>
      `;
      legendEl.appendChild(row);
    });
  }

  /**
   * Flash judgment เช่น Perfect, Good, Miss
   * detail = {
   *   scoreDelta, isMiss, isQuestTarget, judgment
   * }
   */
  function flashJudgment(detail) {
    if (!judgmentWrap) return;

    let text = '';
    let color = '#ffffff';

    if (detail.isMiss) {
      text = detail.text || 'MISS';
      color = '#f87171';
    } else {
      switch (detail.judgment) {
        case 'perfect': color = '#fde047'; text = 'PERFECT'; break;
        case 'good':    color = '#4ade80'; text = 'GOOD'; break;
        case 'late':    color = '#fbbf24'; text = 'LATE'; break;
        case 'slow':    color = '#f87171'; text = 'SLOW'; break;
        default:        color = '#ffffff'; text = detail.scoreDelta >= 0 ? `+${detail.scoreDelta}` : `${detail.scoreDelta}`;
      }
    }

    judgmentWrap.style.color = color;
    judgmentWrap.textContent = text;

    judgmentWrap.classList.add('show');
    setTimeout(() => judgmentWrap.classList.remove('show'), 380);
  }

  // export
  ns.foodGroupsUI = {
    init,
    show,
    hide,
    setScore,
    setLegend,
    flashJudgment
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));