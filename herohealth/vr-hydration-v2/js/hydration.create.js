// === /herohealth/vr-hydration-v2/js/hydration.create.js ===
// Hydration V2 Create Daily Plan
// PATCH v20260317b-HYDRATION-V2-CREATE

const DEFAULT_SLOTS = [
  { id: 'wake', title: 'หลังตื่นนอน', sub: 'เริ่มวันใหม่' },
  { id: 'morning', title: 'ช่วงเช้า', sub: 'ระหว่างเรียน/ทำกิจกรรม' },
  { id: 'noon', title: 'กลางวัน', sub: 'ก่อนหรือหลังมื้อกลางวัน' },
  { id: 'afternoon', title: 'ช่วงบ่าย', sub: 'ระหว่างวัน' },
  { id: 'after-play', title: 'หลังเล่น/หลังออกกำลัง', sub: 'เติมน้ำหลังเสียเหงื่อ' },
  { id: 'evening', title: 'ช่วงเย็น', sub: 'ก่อนพักผ่อน' }
];

export function openCreate(root, state = {}, options = {}) {
  const slots = options.slots || DEFAULT_SLOTS;
  const values = Object.fromEntries(slots.map(slot => [slot.id, 0]));

  return new Promise(resolve => {
    function render() {
      root.innerHTML = `
        <div class="overlay-card">
          <div class="overlay-kicker">Create • Daily Hydration Plan</div>
          <h2>ลองจัดแผนดื่มน้ำ 1 วันของตัวเอง</h2>
          <p>แตะปุ่มในแต่ละช่วงเวลาเพื่อวนจำนวนหยดน้ำ 0 → 1 → 2 → 0</p>

          <div class="create-grid">
            ${slots.map(slot => `
              <div class="create-slot" data-slot-id="${escapeHtml(slot.id)}">
                <div class="create-slot-top">
                  <div>
                    <div class="create-slot-title">${escapeHtml(slot.title)}</div>
                    <div class="create-slot-sub">${escapeHtml(slot.sub)}</div>
                  </div>
                  <div class="slot-count" id="count-${escapeHtml(slot.id)}">${values[slot.id]} หยด</div>
                </div>

                <div class="slot-droplets" id="drops-${escapeHtml(slot.id)}">
                  ${renderDrops(values[slot.id])}
                </div>

                <button class="slot-btn" type="button" data-cycle-slot="${escapeHtml(slot.id)}">
                  แตะเพื่อเปลี่ยนจำนวนหยดน้ำ
                </button>
              </div>
            `).join('')}
          </div>

          <div class="create-help">
            เคล็ดลับ: แผนที่ดีควรกระจายทั้งวัน และอย่าลืมช่วงหลังเล่นหรือช่วงที่เหนื่อย/ร้อน
          </div>

          <div class="feedback-box" id="createFeedback" style="display:none;"></div>

          <div class="overlay-actions">
            <button class="btn ghost" id="createSkipBtn" type="button">ข้าม Create</button>
            <button class="btn primary" id="createConfirmBtn" type="button">ยืนยันแผนนี้</button>
          </div>
        </div>
      `;

      root.classList.add('show');

      root.querySelectorAll('[data-cycle-slot]').forEach(btn => {
        btn.addEventListener('click', () => {
          const slotId = btn.dataset.cycleSlot;
          values[slotId] = (values[slotId] + 1) % 3;

          const countEl = root.querySelector(`#count-${cssEscape(slotId)}`);
          const dropsEl = root.querySelector(`#drops-${cssEscape(slotId)}`);

          if (countEl) countEl.textContent = `${values[slotId]} หยด`;
          if (dropsEl) dropsEl.innerHTML = renderDrops(values[slotId]);
        });
      });

      root.querySelector('#createSkipBtn').addEventListener('click', () => {
        root.classList.remove('show');
        root.innerHTML = '';
        resolve({
          plan: values,
          planScore: 0,
          feedbackTitle: 'ยังไม่ได้สร้างแผน',
          feedbackText: 'ระบบข้าม Create รอบนี้ไปก่อน'
        });
      });

      root.querySelector('#createConfirmBtn').addEventListener('click', () => {
        const result = scorePlan(values);

        const feedbackEl = root.querySelector('#createFeedback');
        feedbackEl.style.display = 'block';
        feedbackEl.innerHTML = `
          <strong>${escapeHtml(result.feedbackTitle)}</strong>
          ${escapeHtml(result.feedbackText)}
        `;

        window.setTimeout(() => {
          root.classList.remove('show');
          root.innerHTML = '';
          resolve({
            plan: { ...values },
            planScore: result.planScore,
            feedbackTitle: result.feedbackTitle,
            feedbackText: result.feedbackText
          });
        }, 450);
      });
    }

    render();
  });
}

function scorePlan(values) {
  const total = Object.values(values).reduce((sum, x) => sum + x, 0);
  const occupied = Object.values(values).filter(x => x > 0).length;

  let score = 0;

  if (total >= 5 && total <= 8) score += 6;
  else if (total >= 3) score += 3;

  if (occupied >= 5) score += 6;
  else if (occupied >= 4) score += 4;
  else if (occupied >= 3) score += 2;

  if (values['wake'] > 0) score += 2;
  if (values['noon'] > 0) score += 2;
  if (values['after-play'] > 0) score += 3;

  if (values['evening'] >= 2 && occupied <= 3) score -= 2;
  if (values['wake'] === 0 && values['after-play'] === 0) score -= 1;

  score = Math.max(0, Math.min(18, score));

  let feedbackTitle = 'แผนนี้ใช้ได้';
  let feedbackText = 'ยังพอใช้ได้ แต่ลองกระจายช่วงเวลาการดื่มน้ำให้สม่ำเสมอขึ้นอีกนิด';

  if (score >= 14) {
    feedbackTitle = 'แผนนี้ดีมาก';
    feedbackText = 'ดื่มน้ำกระจายได้ดีและมีช่วงสำคัญครบ เหมาะกับการสร้างนิสัยที่ดี';
  } else if (score >= 9) {
    feedbackTitle = 'แผนนี้ค่อนข้างดี';
    feedbackText = 'กระจายได้พอสมควรแล้ว ลองเติมช่วงที่ยังขาดให้สมดุลขึ้นอีกนิด';
  } else if (score <= 4) {
    feedbackTitle = 'แผนนี้ยังไม่สมดุล';
    feedbackText = 'ลองกระจายการดื่มให้หลายช่วงขึ้น และอย่าลืมช่วงหลังเล่นหรือช่วงเช้า';
  }

  return {
    planScore: score,
    feedbackTitle,
    feedbackText
  };
}

function renderDrops(count) {
  return [0, 1].map(i => `<span class="drop ${i < count ? 'filled' : ''}"></span>`).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cssEscape(value) {
  return String(value).replace(/[^a-zA-Z0-9\-_]/g, '\\$&');
}