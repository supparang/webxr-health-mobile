// === /herohealth/vr/quest-hud-vr.js ===
// HUD + Quest panel สำหรับโหมด VR (ใช้กับ Hydration เป็นหลัก)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- สร้าง DOM พื้นฐาน ----------
function createEl(tag, cls, parent) {
  const el = ROOT.document.createElement(tag);
  if (cls) el.className = cls;
  if (parent) parent.appendChild(el);
  return el;
}

// การ์ดหลักด้านขวาบน (ใต้ water bar)
const questPanel = createEl('div', 'hha-quest-panel hha-quest-panel--hydration');
const card       = createEl('div', 'hha-quest-card', questPanel);

// header
const headerRow  = createEl('div', 'hha-quest-header', card);
const titleEl    = createEl('div', 'hha-quest-title', headerRow);
titleEl.textContent = 'HYDRATION';

const modeEl     = createEl('div', 'hha-quest-mode', headerRow);
modeEl.textContent = 'NORMAL · GREEN';

// score row
const statRow    = createEl('div', 'hha-quest-stat-row', card);
const leftStat   = createEl('div', 'hha-quest-stat-left', statRow);
const rightStat  = createEl('div', 'hha-quest-stat-right', statRow);

const scoreLine  = createEl('div', 'hha-quest-score', leftStat);
const timeLine   = createEl('div', 'hha-quest-time', leftStat);
const comboLine  = createEl('div', 'hha-quest-combo', rightStat);
const missLine   = createEl('div', 'hha-quest-miss', rightStat);

// goals
const goalsWrap  = createEl('div', 'hha-quest-block', card);
const goalsTitle = createEl('div', 'hha-quest-block-title', goalsWrap);
goalsTitle.textContent = 'Goal';
const goalsList  = createEl('ul', 'hha-quest-list', goalsWrap);

// minis
const minisWrap  = createEl('div', 'hha-quest-block', card);
const minisTitle = createEl('div', 'hha-quest-block-title', minisWrap);
minisTitle.textContent = 'Mini quest';
const minisList  = createEl('ul', 'hha-quest-list', minisWrap);

// โซนน้ำ (แสดงสั้น ๆ แค่บรรทัดเดียวด้านล่าง)
const zoneLine   = createEl('div', 'hha-quest-zone', card);
zoneLine.textContent = 'โซนน้ำ: -';

// ติด panel เข้ากับ body
ROOT.document.body.appendChild(questPanel);

// ---------- ฟังก์ชันช่วยแสดงรายการ Goal / Mini ----------
function renderQuestList(listEl, items, maxItems) {
  listEl.innerHTML = '';

  if (!items || !items.length) {
    const li = createEl('li', 'hha-quest-item hha-quest-empty', listEl);
    li.textContent = 'ยังไม่มีภารกิจในรอบนี้';
    return;
  }

  const n = Math.min(items.length, maxItems);
  for (let i = 0; i < n; i++) {
    const q = items[i];
    const li = createEl('li', 'hha-quest-item', listEl);

    const dot = createEl('span', 'hha-quest-dot', li);
    dot.textContent = q.done ? '✔' : '•';

    const textWrap = createEl('span', 'hha-quest-text', li);
    textWrap.textContent = q.label || q.id || '(ไม่ระบุ)';

    if (typeof q.prog === 'number' && typeof q.target === 'number' && q.target > 0) {
      const prog = createEl('span', 'hha-quest-prog', li);
      prog.textContent = `${q.prog} / ${q.target}`;
    }

    if (q.done) {
      li.classList.add('is-done');
    } else if (q.isMiss) {
      li.classList.add('is-miss-quest');
    }
  }
}

// ---------- Summary overlay ตอนจบเกม ----------
let summaryWrap = null;

function showSummary(detail) {
  if (summaryWrap) summaryWrap.remove();

  summaryWrap = createEl('div', 'hha-summary-overlay');
  const box = createEl('div', 'hha-summary-box', summaryWrap);

  const title = createEl('div', 'hha-summary-title', box);
  title.textContent = `Hydration (${detail.difficulty?.toUpperCase?.() || 'NORMAL'})`;

  const scoreRow = createEl('div', 'hha-summary-row', box);
  scoreRow.innerHTML = `
    <span>คะแนนรวม</span>
    <span>${detail.score ?? 0}</span>
  `;

  const comboRow = createEl('div', 'hha-summary-row', box);
  comboRow.innerHTML = `
    <span>คอมโบสูงสุด</span>
    <span>${detail.comboMax ?? 0}</span>
  `;

  const missRow = createEl('div', 'hha-summary-row', box);
  missRow.innerHTML = `
    <span>พลาด</span>
    <span>${detail.misses ?? 0}</span>
  `;

  const questRow1 = createEl('div', 'hha-summary-row', box);
  questRow1.innerHTML = `
    <span>Goals</span>
    <span>${detail.goalsCleared ?? 0} / ${detail.goalsTotal ?? 0}</span>
  `;

  const questRow2 = createEl('div', 'hha-summary-row', box);
  questRow2.innerHTML = `
    <span>Mini quests</span>
    <span>${detail.questsCleared ?? 0} / ${detail.questsTotal ?? 0}</span>
  `;

  const zoneRow = createEl('div', 'hha-summary-row', box);
  zoneRow.innerHTML = `
    <span>โซนน้ำตอนจบ</span>
    <span>${detail.waterZoneEnd || '-'} (${detail.waterEnd ?? 0}%)</span>
  `;

  const btnRow = createEl('div', 'hha-summary-btn-row', box);
  const againBtn = createEl('button', 'hha-btn hha-btn-primary', btnRow);
  againBtn.textContent = 'เล่นอีกครั้ง';
  const hubBtn = createEl('button', 'hha-btn', btnRow);
  hubBtn.textContent = 'กลับ Hub';

  againBtn.addEventListener('click', () => {
    // reload หน้านี้ พร้อมพารามิเตอร์เดิม
    ROOT.location.reload();
  });

  hubBtn.addEventListener('click', () => {
    // กลับหน้า hub (แก้ path ตามโปรเจ็กต์จริง)
    ROOT.location.href = '../hub.html';
  });

  ROOT.document.body.appendChild(summaryWrap);
}

// ---------- Listener จากเกม ----------
function onScore(ev) {
  const d = ev.detail || {};
  // ใช้กับ Hydration เท่านั้น
  if (d.modeKey && d.modeKey !== 'hydration-vr') return;

  // header
  const diffLabel = (d.difficulty || 'normal').toUpperCase();
  const zoneLabel = d.waterZone || 'UNKNOWN';
  modeEl.textContent = `${diffLabel} · ${zoneLabel}`;

  // score/time/combo/miss
  scoreLine.textContent = `Score ${d.score ?? 0}`;
  const t = d.timeSec ?? 0;
  const mm = Math.floor(t / 60);
  const ss = t % 60;
  const tLabel = mm > 0 ? `${mm}m ${ss}s` : `${ss}s`;
  timeLine.textContent  = `Time ${tLabel}`;

  comboLine.textContent = `Combo x${d.combo ?? 0}`;
  missLine.textContent  = `Miss ${d.misses ?? d.miss ?? 0}`;

  // zone
  zoneLine.textContent = `โซนน้ำ: ${zoneLabel.toUpperCase()} (${d.waterPct ?? 0}%)`;

  // goals / minis (รับมาจาก hydration.safe.js)
  renderQuestList(goalsList, d.goals || [], 2);
  renderQuestList(minisList, d.minis || [], 3);
}

function onEnd(ev) {
  const d = ev.detail || {};
  if ((d.modeLabel || '').toLowerCase() !== 'hydration') return;
  showSummary(d);
}

ROOT.addEventListener('hha:score', onScore);
ROOT.addEventListener('hha:end', onEnd);