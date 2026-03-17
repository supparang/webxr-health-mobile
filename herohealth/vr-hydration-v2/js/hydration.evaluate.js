// === /herohealth/vr-hydration-v2/js/hydration.evaluate.js ===
// Hydration V2 Evaluate Overlay
// PATCH v20260317a-HYDRATION-V2-EVALUATE

const DEFAULT_PLANS = [
  {
    id: 'A',
    title: 'แผน A',
    lines: [
      'ดื่มน้ำเยอะมากครั้งเดียวตอนเย็น',
      'ระหว่างวันแทบไม่ดื่ม'
    ],
    correct: false,
    feedbackTitle: 'ยังไม่สมดุลนะ',
    feedbackText:
      'การดื่มรวดเดียวตอนเย็นทำให้ร่างกายไม่ได้รับน้ำสม่ำเสมอตลอดวัน ลองเลือกแผนที่กระจายการดื่มให้มากขึ้น'
  },
  {
    id: 'B',
    title: 'แผน B',
    lines: [
      'ดื่มน้ำทีละน้อยกระจายทั้งวัน',
      'มีช่วงเช้า กลางวัน บ่าย และหลังเล่น'
    ],
    correct: true,
    feedbackTitle: 'ใช่เลย แผนนี้ดีที่สุด',
    feedbackText:
      'การดื่มน้ำกระจายทั้งวันช่วยให้ร่างกายสดชื่นกว่า และเหมาะกับการสร้างนิสัยการดื่มน้ำที่ดี'
  },
  {
    id: 'C',
    title: 'แผน C',
    lines: [
      'ดื่มเฉพาะตอนรู้สึกกระหายมาก',
      'ไม่มีช่วงเวลาที่แน่นอน'
    ],
    correct: false,
    feedbackTitle: 'ยังดีไม่พอ',
    feedbackText:
      'ถ้ารอจนกระหายมากค่อยดื่ม อาจทำให้ร่างกายได้รับน้ำไม่สม่ำเสมอ ลองเลือกแผนที่มีเวลาชัดเจนกว่า'
  }
];

export function openEvaluate(root, state = {}, options = {}) {
  const plans = options.plans || DEFAULT_PLANS;
  const title = options.title || 'เลือกแผนดื่มน้ำที่ดีที่สุด';
  const subtitle = options.subtitle ||
    'เลือก 1 แผนที่เหมาะกับการดื่มน้ำใน 1 วันมากที่สุด';

  return new Promise(resolve => {
    let selectedPlan = null;

    root.innerHTML = `
      <div class="overlay-card">
        <div class="overlay-kicker">Evaluate • Abstract-aligned</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(subtitle)}</p>

        <div class="plan-grid">
          ${plans.map(plan => `
            <button class="plan-card" type="button" data-plan-id="${escapeHtml(plan.id)}">
              <div class="plan-title">${escapeHtml(plan.title)}</div>
              ${plan.lines.map(line => `<div class="plan-line">• ${escapeHtml(line)}</div>`).join('')}
            </button>
          `).join('')}
        </div>

        <div class="feedback-box" id="evalFeedback" style="display:none;"></div>

        <div class="overlay-actions">
          <button class="btn ghost" type="button" id="evalCancelBtn">ปิด Evaluate</button>
          <button class="btn primary" type="button" id="evalContinueBtn" disabled>ยืนยันคำตอบ</button>
        </div>
      </div>
    `;

    root.classList.add('show');

    const cards = [...root.querySelectorAll('.plan-card')];
    const feedbackBox = root.querySelector('#evalFeedback');
    const continueBtn = root.querySelector('#evalContinueBtn');
    const cancelBtn = root.querySelector('#evalCancelBtn');

    function renderFeedback(plan){
      feedbackBox.style.display = 'block';
      feedbackBox.innerHTML = `
        <strong>${escapeHtml(plan.feedbackTitle)}</strong>
        ${escapeHtml(plan.feedbackText)}
      `;
    }

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(item => item.classList.remove('selected'));

        card.classList.add('selected');
        selectedPlan = plans.find(plan => plan.id === card.dataset.planId) || null;

        if (selectedPlan) {
          renderFeedback(selectedPlan);
          continueBtn.disabled = false;
        }
      });
    });

    cancelBtn.addEventListener('click', () => {
      root.classList.remove('show');
      root.innerHTML = '';
      resolve({
        choice: null,
        correct: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ยังไม่ได้เลือกแผน',
        feedbackText: 'ระบบข้าม Evaluate รอบนี้ไปก่อน'
      });
    });

    continueBtn.addEventListener('click', () => {
      if (!selectedPlan) return;

      const result = {
        choice: selectedPlan.id,
        correct: !!selectedPlan.correct,
        knowledgeDelta: selectedPlan.correct ? 12 : 0,
        planningDelta: selectedPlan.correct ? 8 : 2,
        feedbackTitle: selectedPlan.feedbackTitle,
        feedbackText: selectedPlan.feedbackText
      };

      root.classList.remove('show');
      root.innerHTML = '';
      resolve(result);
    });
  });
}

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}