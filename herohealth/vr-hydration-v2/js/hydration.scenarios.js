// === /herohealth/vr-hydration-v2/js/hydration.scenarios.js ===
// Hydration V2 Scenario Questions
// PATCH v20260317b-HYDRATION-V2-SCENARIOS

const DEFAULT_QUESTIONS = [
  {
    id: 'hot-weather',
    title: 'อากาศร้อนมากหลังเลิกเรียน',
    body: 'วันนี้อากาศร้อนและเหงื่อออกเยอะ ควรทำอย่างไรเป็นอย่างแรก',
    options: [
      'เลือกดื่มน้ำเปล่าทีละน้อยให้สดชื่น',
      'รอจนกระหายมากก่อนแล้วค่อยดื่มทีเดียว',
      'เลือกน้ำหวานแทนน้ำเปล่าทุกครั้ง'
    ],
    correctIndex: 0,
    feedbackCorrect: 'ดีมาก อากาศร้อนควรเริ่มดื่มน้ำเปล่าเพื่อชดเชยน้ำที่เสียไป',
    feedbackWrong: 'ลองใหม่อีกนิด อากาศร้อนควรเริ่มจากน้ำเปล่าและไม่ควรรอจนกระหายมาก'
  },
  {
    id: 'after-play',
    title: 'หลังเล่นกีฬาเสร็จ',
    body: 'หลังวิ่งและเล่นจนเหนื่อย ตัวเลือกไหนเหมาะที่สุด',
    options: [
      'ไม่ต้องดื่มอะไรเลย',
      'ดื่มน้ำเปล่าเพื่อเติมน้ำให้ร่างกาย',
      'ดื่มแต่น้ำหวานเพราะอร่อยกว่า'
    ],
    correctIndex: 1,
    feedbackCorrect: 'ถูกต้อง หลังเล่นกีฬาควรดื่มน้ำเพื่อเติมน้ำให้ร่างกาย',
    feedbackWrong: 'ยังไม่ใช่ หลังเล่นกีฬาควรเริ่มจากน้ำเปล่าเพื่อให้ร่างกายสดชื่นขึ้น'
  },
  {
    id: 'morning',
    title: 'ตอนตื่นนอน',
    body: 'เมื่อตื่นนอนตอนเช้า พฤติกรรมไหนช่วยสร้างนิสัยที่ดี',
    options: [
      'ดื่มน้ำเปล่าช่วงเช้าเล็กน้อย',
      'ข้ามการดื่มน้ำทั้งเช้า',
      'ดื่มเฉพาะตอนกลางคืนพอ'
    ],
    correctIndex: 0,
    feedbackCorrect: 'ใช่เลย การเริ่มดื่มน้ำช่วงเช้าช่วยให้เกิดนิสัยการดื่มที่สม่ำเสมอ',
    feedbackWrong: 'ยังไม่ดีพอ การเริ่มดื่มน้ำช่วงเช้าจะช่วยให้กระจายการดื่มทั้งวันได้ดีกว่า'
  },
  {
    id: 'all-day',
    title: 'การดื่มน้ำทั้งวัน',
    body: 'แผนไหนเหมาะกว่าในการดื่มน้ำใน 1 วัน',
    options: [
      'ดื่มน้ำกระจายทั้งวัน',
      'ดื่มเยอะครั้งเดียวตอนเย็น',
      'ดื่มเฉพาะตอนจำได้'
    ],
    correctIndex: 0,
    feedbackCorrect: 'เยี่ยมมาก การดื่มน้ำกระจายทั้งวันเหมาะกับการสร้างนิสัยที่ดี',
    feedbackWrong: 'ลองคิดใหม่ การดื่มน้ำทั้งวันควรกระจาย ไม่ควรอัดทีเดียวตอนเย็น'
  }
];

export function openScenarios(root, state = {}, options = {}) {
  const count = Math.max(1, Math.min(3, Number(options.count || 2)));
  const randomFn = typeof options.randomFn === 'function' ? options.randomFn : Math.random;
  const questions = (options.questions && options.questions.length ? options.questions : shuffle(DEFAULT_QUESTIONS, randomFn)).slice(0, count);

  return new Promise(resolve => {
    let index = 0;
    let selectedIndex = null;
    let correctCount = 0;
    let wrongCount = 0;
    let knowledgeDelta = 0;
    const answers = [];

    function renderQuestion() {
      const q = questions[index];
      selectedIndex = null;

      root.innerHTML = `
        <div class="overlay-card">
          <div class="overlay-kicker">Scenarios • Hydration Learning</div>
          <h2>ลองตัดสินใจจากสถานการณ์จริง</h2>
          <p>ตอบคำถามสั้น ๆ เพื่อวัดความเข้าใจเรื่องการดื่มน้ำหลังจากเล่นรอบหลัก</p>

          <div class="scenario-top">
            <div class="scenario-progress">ข้อ ${index + 1} / ${questions.length}</div>
            <div class="scenario-progress">ตอบถูก ${correctCount} ข้อ</div>
          </div>

          <div class="scenario-question">
            <h3>${escapeHtml(q.title)}</h3>
            <p>${escapeHtml(q.body)}</p>

            <div class="scenario-options">
              ${q.options.map((opt, optIndex) => `
                <button class="scenario-option" type="button" data-opt-index="${optIndex}">
                  ${escapeHtml(opt)}
                </button>
              `).join('')}
            </div>

            <div class="feedback-box" id="scenarioFeedback" style="display:none;"></div>
          </div>

          <div class="overlay-actions">
            <button class="btn ghost" id="scenarioSkipBtn" type="button">ข้าม</button>
            <button class="btn primary" id="scenarioNextBtn" type="button" disabled>
              ${index === questions.length - 1 ? 'จบ Scenarios' : 'ข้อต่อไป'}
            </button>
          </div>
        </div>
      `;

      root.classList.add('show');

      const optionButtons = [...root.querySelectorAll('.scenario-option')];
      const feedbackBox = root.querySelector('#scenarioFeedback');
      const nextBtn = root.querySelector('#scenarioNextBtn');
      const skipBtn = root.querySelector('#scenarioSkipBtn');

      optionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          optionButtons.forEach(x => x.classList.remove('selected'));
          btn.classList.add('selected');
          selectedIndex = Number(btn.dataset.optIndex);

          const isCorrect = selectedIndex === q.correctIndex;
          feedbackBox.style.display = 'block';
          feedbackBox.innerHTML = `
            <strong>${isCorrect ? 'ตอบได้ดีมาก' : 'คำตอบนี้ยังไม่ดีที่สุด'}</strong>
            ${escapeHtml(isCorrect ? q.feedbackCorrect : q.feedbackWrong)}
          `;
          nextBtn.disabled = false;
        });
      });

      skipBtn.addEventListener('click', () => {
        answers.push({
          questionId: q.id,
          selectedIndex: null,
          correct: false
        });
        wrongCount += 1;
        goNext();
      });

      nextBtn.addEventListener('click', () => {
        if (selectedIndex == null) return;

        const isCorrect = selectedIndex === q.correctIndex;
        answers.push({
          questionId: q.id,
          selectedIndex,
          correct: isCorrect
        });

        if (isCorrect) {
          correctCount += 1;
          knowledgeDelta += 8;
        } else {
          wrongCount += 1;
          knowledgeDelta += 2;
        }

        goNext();
      });
    }

    function goNext() {
      index += 1;
      if (index < questions.length) {
        renderQuestion();
        return;
      }

      root.classList.remove('show');
      root.innerHTML = '';

      resolve({
        asked: questions.length,
        correctCount,
        wrongCount,
        knowledgeDelta,
        answers,
        summary:
          correctCount === questions.length
            ? 'ตอบสถานการณ์ได้ครบทุกข้อ'
            : `ตอบถูก ${correctCount} จาก ${questions.length} ข้อ`
      });
    }

    renderQuestion();
  });
}

function shuffle(arr, randomFn) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}