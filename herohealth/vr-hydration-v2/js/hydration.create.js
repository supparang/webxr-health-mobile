// === /herohealth/vr-hydration-v2/js/hydration.create.js ===
// Hydration V2 Create Overlay
// FULL PATCH v20260327-HYDRATION-V2-CREATE-ABC
//
// เป้าหมาย:
// - วัด transfer / planning ให้ดีขึ้น
// - ลดการจำแพตเทิร์นเดิม
// - ใช้ parallel form A/B/C
// - child-friendly
// - คืนค่าให้ hydration.safe.js ใช้ได้ทันที
//
// คืนค่า:
// {
//   plan,
//   planScore,        // raw 0-20
//   feedbackTitle,
//   feedbackText,
//   taskId,
//   formUsed,
//   elapsedMs
// }

const HYDRATION_V2_CREATE_SLOTS = [
  { id: 'before_school', emoji: '🌅', label: 'ก่อนเข้าเรียน', sub: 'เริ่มวันให้พร้อม' },
  { id: 'morning_break', emoji: '🛎️', label: 'พักเช้า', sub: 'เติมน้ำช่วงเช้า' },
  { id: 'before_activity', emoji: '🏃', label: 'ก่อนกิจกรรม', sub: 'เตรียมตัวก่อนใช้แรง' },
  { id: 'lunch', emoji: '🍱', label: 'พักเที่ยง', sub: 'เติมน้ำช่วงกลางวัน' },
  { id: 'after_activity', emoji: '💦', label: 'หลังกิจกรรม', sub: 'หลังเล่นหรือออกแรง' },
  { id: 'afternoon', emoji: '🌤️', label: 'ช่วงบ่าย', sub: 'ไม่ปล่อยให้หิวน้ำเกินไป' },
  { id: 'after_school', emoji: '🎒', label: 'หลังเลิกเรียน', sub: 'ก่อนกลับบ้านหรือพัก' },
  { id: 'evening', emoji: '🌙', label: 'ตอนเย็น', sub: 'ดูแลต่อเนื่องทั้งวัน' }
];

const HYDRATION_V2_CREATE_BANK = [
  // =========================
  // FORM A
  // =========================
  {
    id: 'A-schoolday-routine',
    form: 'A',
    family: 'schoolday',
    title: 'ช่วยวางแผนดื่มน้ำสำหรับวันเรียนปกติ',
    subtitle: 'เลือกช่วงเวลาที่หนูคิดว่าควรดื่มน้ำในวันนี้',
    situation: 'วันนี้เรียนปกติ ไม่มีพละ และอากาศไม่ร้อนมาก',
    minPick: 3,
    maxPick: 5,
    preferred: ['before_school', 'lunch', 'afternoon'],
    bonus: ['morning_break', 'after_school']
  },
  {
    id: 'A-outdoor-routine',
    form: 'A',
    family: 'outdoor',
    title: 'ช่วยวางแผนสำหรับวันที่มีกิจกรรมกลางแจ้ง',
    subtitle: 'วันนี้ต้องเดินและทำกิจกรรมข้างนอกนานขึ้น',
    situation: 'ช่วงบ่ายมีกิจกรรมกลางแจ้งและใช้แรงมากกว่าวันปกติ',
    minPick: 4,
    maxPick: 6,
    preferred: ['before_school', 'before_activity', 'after_activity', 'afternoon'],
    bonus: ['lunch', 'after_school']
  },

  // =========================
  // FORM B
  // =========================
  {
    id: 'B-hotday-routine',
    form: 'B',
    family: 'hot',
    title: 'ช่วยวางแผนดื่มน้ำในวันที่อากาศร้อน',
    subtitle: 'วันนี้ร้อนกว่าปกติ ควรเลือกช่วงเวลาให้เหมาะ',
    situation: 'วันนี้อากาศร้อนและตอนเช้ามีช่วงอยู่กลางแดดด้วย',
    minPick: 4,
    maxPick: 6,
    preferred: ['before_school', 'morning_break', 'lunch', 'afternoon'],
    bonus: ['after_school']
  },
  {
    id: 'B-aircon-routine',
    form: 'B',
    family: 'aircon',
    title: 'ช่วยวางแผนดื่มน้ำในวันที่เรียนห้องแอร์',
    subtitle: 'แม้อยู่ห้องแอร์ ก็ยังควรมีแผนดื่มน้ำที่ดี',
    situation: 'วันนี้เรียนในห้องแอร์ทั้งวันและไม่ค่อยรู้สึกร้อน',
    minPick: 3,
    maxPick: 5,
    preferred: ['before_school', 'lunch', 'afternoon'],
    bonus: ['morning_break']
  },

  // =========================
  // FORM C
  // =========================
  {
    id: 'C-exam-routine',
    form: 'C',
    family: 'exam',
    title: 'ช่วยวางแผนดื่มน้ำในวันสอบ',
    subtitle: 'เลือกช่วงเวลาที่ช่วยให้พร้อมและมีสมาธิ',
    situation: 'วันนี้มีสอบหลายคาบและต้องใช้สมาธิตลอดวัน',
    minPick: 3,
    maxPick: 5,
    preferred: ['before_school', 'morning_break', 'lunch'],
    bonus: ['afternoon']
  },
  {
    id: 'C-home-routine',
    form: 'C',
    family: 'home',
    title: 'ช่วยวางแผนดื่มน้ำในวันหยุดอยู่บ้าน',
    subtitle: 'ถึงอยู่บ้าน ก็ยังควรดื่มน้ำให้เหมาะทั้งวัน',
    situation: 'วันนี้เป็นวันหยุด อยู่บ้าน และไม่ได้ออกกำลังกายหนัก',
    minPick: 3,
    maxPick: 5,
    preferred: ['morning_break', 'lunch', 'afternoon'],
    bonus: ['evening']
  }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function shuffleArray(arr = [], randomFn = Math.random) {
  const out = Array.isArray(arr) ? arr.slice() : [];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function cloneCreateTask(task) {
  return {
    ...task,
    preferred: Array.isArray(task?.preferred) ? task.preferred.slice() : [],
    bonus: Array.isArray(task?.bonus) ? task.bonus.slice() : []
  };
}

function resolveHydrationCreateForm(stateLike = {}) {
  const explicit = String(
    stateLike.form ||
    stateLike.postForm ||
    stateLike.researchForm ||
    ''
  ).toUpperCase();

  if (explicit === 'A' || explicit === 'B' || explicit === 'C') return explicit;

  const phase = String(
    stateLike.testPhase ||
    stateLike.researchPhase ||
    stateLike.phaseTag ||
    ''
  ).toLowerCase();

  if (phase === 'pre' || phase === 'pretest') return 'A';
  if (phase === 'delayed' || phase === 'followup' || phase === 'retention') return 'C';

  return 'B';
}

function pickCreateTask(stateLike = {}, randomFn = Math.random) {
  const form = resolveHydrationCreateForm(stateLike);
  let pool = HYDRATION_V2_CREATE_BANK.filter(x => x.form === form);
  if (!pool.length) pool = HYDRATION_V2_CREATE_BANK.slice();
  pool = shuffleArray(pool, randomFn);
  return pool.length ? cloneCreateTask(pool[0]) : null;
}

function ensureCreateStyles() {
  if (document.getElementById('hydration-create-style')) return;

  const style = document.createElement('style');
  style.id = 'hydration-create-style';
  style.textContent = `
    .hydr-create-card{
      width:min(940px, 100%);
      max-height:min(92vh, 920px);
      overflow:auto;
    }
    .hydr-create-panel{
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
      border-radius:18px;
      padding:14px;
      margin:12px 0;
    }
    .hydr-create-title{
      margin:0 0 8px;
      font-size:clamp(22px, 4vw, 34px);
      line-height:1.15;
      font-weight:900;
    }
    .hydr-create-text{
      margin:0 0 8px;
      line-height:1.7;
    }
    .hydr-create-sub{
      margin:0;
      color:#cbd5e1;
      font-size:14px;
      line-height:1.6;
    }
    .hydr-create-grid{
      display:grid;
      grid-template-columns:repeat(2, minmax(0,1fr));
      gap:10px;
    }
    @media (max-width:760px){
      .hydr-create-grid{
        grid-template-columns:1fr;
      }
    }
    .hydr-create-slot{
      width:100%;
      text-align:left;
      border:1px solid rgba(148,163,184,.22);
      background:rgba(15,23,42,.88);
      color:#e5e7eb;
      border-radius:16px;
      padding:12px 14px;
      cursor:pointer;
      transition:.16s ease;
      font:inherit;
    }
    .hydr-create-slot:hover{
      transform:translateY(-1px);
      border-color:rgba(96,165,250,.48);
    }
    .hydr-create-slot.is-selected{
      border-color:#22c55e;
      box-shadow:0 0 0 2px rgba(34,197,94,.14) inset;
      background:rgba(22,163,74,.16);
    }
    .hydr-create-slot-row{
      display:flex;
      gap:10px;
      align-items:flex-start;
    }
    .hydr-create-emoji{
      font-size:22px;
      line-height:1;
      width:28px;
      flex:0 0 28px;
      text-align:center;
    }
    .hydr-create-label{
      font-weight:800;
      margin-bottom:3px;
    }
    .hydr-create-subline{
      font-size:13px;
      color:#cbd5e1;
      line-height:1.5;
    }
    .hydr-create-hint{
      color:#cbd5e1;
      font-size:14px;
      line-height:1.6;
      margin-top:10px;
    }
    .hydr-create-pill{
      display:inline-flex;
      align-items:center;
      gap:8px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      padding:8px 12px;
      font-size:14px;
      margin:0 8px 8px 0;
    }
    .hydr-create-result-grid{
      display:grid;
      grid-template-columns:repeat(3, minmax(0,1fr));
      gap:10px;
      margin-top:12px;
    }
    @media (max-width:700px){
      .hydr-create-result-grid{
        grid-template-columns:1fr;
      }
    }
    .hydr-create-result-box{
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
      border-radius:16px;
      padding:14px;
    }
    .hydr-create-result-label{
      font-size:13px;
      color:#cbd5e1;
      margin-bottom:4px;
    }
    .hydr-create-result-value{
      font-size:28px;
      font-weight:900;
      line-height:1.1;
    }
    .hydr-create-note{
      color:#cbd5e1;
      font-size:14px;
      line-height:1.7;
      margin-top:10px;
    }
  `;
  document.head.appendChild(style);
}

function slotLabelById(id) {
  return HYDRATION_V2_CREATE_SLOTS.find(x => x.id === id)?.label || id;
}

function scoreCreatePlan(task, selectedSlots = []) {
  const uniqueSlots = Array.from(new Set(Array.isArray(selectedSlots) ? selectedSlots : []));
  const pickedCount = uniqueSlots.length;

  let raw = 0;

  // 1) จำนวนช่วงเวลาที่เลือก (0-8)
  if (pickedCount >= task.minPick && pickedCount <= task.maxPick) {
    raw += 8;
  } else if (pickedCount === task.minPick - 1 || pickedCount === task.maxPick + 1) {
    raw += 4;
  } else if (pickedCount > 0) {
    raw += 2;
  }

  // 2) ความตรงกับ preferred slots (0-8)
  const preferred = Array.isArray(task.preferred) ? task.preferred : [];
  const preferredHit = preferred.filter(x => uniqueSlots.includes(x)).length;
  if (preferred.length > 0) {
    raw += Math.round((preferredHit / preferred.length) * 8);
  }

  // 3) bonus context slots (0-4)
  const bonus = Array.isArray(task.bonus) ? task.bonus : [];
  const bonusHit = bonus.filter(x => uniqueSlots.includes(x)).length;
  if (bonus.length > 0) {
    raw += Math.min(4, bonusHit * 2);
  } else {
    raw += 4;
  }

  raw = Math.max(0, Math.min(20, raw));

  return {
    rawScore: raw,
    pickedCount,
    preferredHit,
    preferredTotal: preferred.length,
    bonusHit,
    bonusTotal: bonus.length
  };
}

function buildCreateFeedback(task, scoring, selectedSlots = []) {
  const uniqueSlots = Array.from(new Set(Array.isArray(selectedSlots) ? selectedSlots : []));
  const missedPreferred = (task.preferred || []).filter(x => !uniqueSlots.includes(x));

  let feedbackTitle = 'ลองอีกนิดนะ';
  let feedbackText = 'ลองกระจายช่วงเวลาดื่มน้ำให้เหมาะกับทั้งวันมากขึ้น';

  if (scoring.rawScore >= 17) {
    feedbackTitle = 'เยี่ยมมาก วางแผนได้ดี';
    feedbackText = 'หนูเลือกหลายช่วงเวลาที่เหมาะกับสถานการณ์ และวางแผนได้ค่อนข้างครบทั้งวัน';
  } else if (scoring.rawScore >= 12) {
    feedbackTitle = 'ดีมาก ใกล้ครบแล้ว';
    feedbackText = 'แผนของหนูค่อนข้างดีแล้ว ลองเพิ่มช่วงเวลาสำคัญอีกนิดจะยิ่งดีขึ้น';
  } else if (scoring.rawScore >= 8) {
    feedbackTitle = 'ทำได้ดีนะ';
    feedbackText = 'หนูเริ่มคิดเป็นช่วง ๆ แล้ว แต่ยังปรับให้เหมาะกับสถานการณ์ได้อีก';
  }

  if (missedPreferred.length) {
    const topMiss = missedPreferred.slice(0, 2).map(slotLabelById).join(' และ ');
    feedbackText += ` ลองคิดเพิ่มเรื่องช่วง "${topMiss}" ด้วย`;
  }

  return { feedbackTitle, feedbackText };
}

export async function openCreate(overlayEl, state = {}, options = {}) {
  ensureCreateStyles();

  const randomFn = typeof options.randomFn === 'function' ? options.randomFn : Math.random;
  const task = pickCreateTask(state, randomFn);

  if (!task) {
    return {
      plan: {},
      planScore: 0,
      feedbackTitle: 'ยังไม่มีโจทย์วางแผน',
      feedbackText: '',
      taskId: '',
      formUsed: resolveHydrationCreateForm(state),
      elapsedMs: 0
    };
  }

  const formUsed = resolveHydrationCreateForm(state);

  return new Promise((resolve) => {
    const startedAt = performance.now();
    let selectedSlots = [];

    function finish(result) {
      overlayEl.classList.remove('show');
      resolve(result);
    }

    function drawResult(result) {
      overlayEl.innerHTML = `
        <div class="overlay-card hydr-create-card">
          <div class="overlay-kicker">Create Complete</div>
          <h2 class="hydr-create-title">${escapeHtml(result.feedbackTitle)}</h2>
          <p class="hydr-create-text">${escapeHtml(result.feedbackText)}</p>

          <div class="hydr-create-result-grid">
            <div class="hydr-create-result-box">
              <div class="hydr-create-result-label">ช่วงที่เลือก</div>
              <div class="hydr-create-result-value">${result.plan.selectedSlots.length}</div>
            </div>
            <div class="hydr-create-result-box">
              <div class="hydr-create-result-label">ตรงช่วงสำคัญ</div>
              <div class="hydr-create-result-value">${result.plan.preferredHit}/${result.plan.preferredTotal}</div>
            </div>
            <div class="hydr-create-result-box">
              <div class="hydr-create-result-label">Raw Plan Score</div>
              <div class="hydr-create-result-value">${result.planScore}</div>
            </div>
          </div>

          <p class="hydr-create-note">
            หนูได้ลองนำสิ่งที่เรียนรู้มาวางแผนดื่มน้ำของตัวเองแล้ว
          </p>

          <div class="overlay-actions">
            <button class="btn primary" type="button" id="hydrCreateDoneBtn">ไปต่อ</button>
          </div>
        </div>
      `;

      overlayEl.classList.add('show');
      overlayEl.querySelector('#hydrCreateDoneBtn')?.addEventListener('click', () => finish(result));
    }

    function draw() {
      const pickedCount = selectedSlots.length;

      overlayEl.innerHTML = `
        <div class="overlay-card hydr-create-card">
          <div class="overlay-kicker">Create</div>
          <h2 class="hydr-create-title">${escapeHtml(task.title)}</h2>
          <p class="hydr-create-sub">${escapeHtml(task.subtitle || '')}</p>

          <div class="hydr-create-panel">
            <div class="hydr-create-label">สถานการณ์</div>
            <p class="hydr-create-text">${escapeHtml(task.situation || '')}</p>
          </div>

          <div class="hydr-create-panel">
            <div class="hydr-create-label">โจทย์ของหนู</div>
            <p class="hydr-create-text">เลือกช่วงเวลาที่หนูคิดว่าควรดื่มน้ำในวันนี้</p>

            <div>
              <span class="hydr-create-pill">เลือกแล้ว ${pickedCount} ช่วง</span>
              <span class="hydr-create-pill">แนะนำประมาณ ${task.minPick}–${task.maxPick} ช่วง</span>
            </div>

            <div class="hydr-create-grid">
              ${HYDRATION_V2_CREATE_SLOTS.map(slot => `
                <button
                  class="hydr-create-slot ${selectedSlots.includes(slot.id) ? 'is-selected' : ''}"
                  type="button"
                  data-slot="${escapeHtml(slot.id)}"
                >
                  <div class="hydr-create-slot-row">
                    <div class="hydr-create-emoji">${escapeHtml(slot.emoji || '')}</div>
                    <div>
                      <div class="hydr-create-label">${escapeHtml(slot.label)}</div>
                      <div class="hydr-create-subline">${escapeHtml(slot.sub || '')}</div>
                    </div>
                  </div>
                </button>
              `).join('')}
            </div>

            <div class="hydr-create-hint">
              ไม่มีคำตอบเดียวเป๊ะ ๆ แต่ควรเลือกช่วงเวลาให้เหมาะกับทั้งวันและสถานการณ์นี้
            </div>
          </div>

          <div class="overlay-actions">
            <button class="btn primary" type="button" id="hydrCreateSubmitBtn">ดูผลแผนของหนู</button>
          </div>
        </div>
      `;

      overlayEl.classList.add('show');

      overlayEl.querySelectorAll('[data-slot]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-slot') || '';
          if (!id) return;

          if (selectedSlots.includes(id)) {
            selectedSlots = selectedSlots.filter(x => x !== id);
          } else {
            selectedSlots = [...selectedSlots, id];
          }
          draw();
        });
      });

      overlayEl.querySelector('#hydrCreateSubmitBtn')?.addEventListener('click', () => {
        if (!selectedSlots.length) {
          window.alert('เลือกช่วงเวลาก่อนนะ');
          return;
        }

        const scoring = scoreCreatePlan(task, selectedSlots);
        const feedback = buildCreateFeedback(task, scoring, selectedSlots);
        const elapsedMs = Math.round(performance.now() - startedAt);

        const result = {
          plan: {
            taskId: task.id,
            formUsed,
            selectedSlots: selectedSlots.slice(),
            selectedLabels: selectedSlots.map(slotLabelById),
            minPick: task.minPick,
            maxPick: task.maxPick,
            preferred: (task.preferred || []).slice(),
            bonus: (task.bonus || []).slice(),
            preferredHit: scoring.preferredHit,
            preferredTotal: scoring.preferredTotal,
            bonusHit: scoring.bonusHit,
            bonusTotal: scoring.bonusTotal,
            pickedCount: scoring.pickedCount
          },
          planScore: scoring.rawScore,
          feedbackTitle: feedback.feedbackTitle,
          feedbackText: feedback.feedbackText,
          taskId: task.id,
          formUsed,
          elapsedMs
        };

        drawResult(result);
      });
    }

    draw();
  });
}