// === /herohealth/vr-hydration-v2/js/hydration.evaluate.js ===
// Hydration V2 Evaluate Overlay
// FULL PATCH v20260327-HYDRATION-V2-EVALUATE-ABC
//
// เป้าหมาย:
// - ลดการจำคำตอบจากข้อเดิม
// - ใช้ parallel form A/B/C
// - ใช้ภาษาสั้น อ่านง่าย เหมาะกับเด็ก ป.5
// - คืนค่าให้ hydration.safe.js ใช้ได้ทันที
//
// คืนค่า:
// {
//   choice,
//   correct,
//   knowledgeDelta,
//   planningDelta,
//   feedbackTitle,
//   feedbackText,
//   confidenceId,
//   confidenceLabel,
//   elapsedMs,
//   itemId,
//   formUsed
// }

const HYDRATION_V2_EVALUATE_BANK = [
  // =========================
  // FORM A
  // =========================
  {
    id: 'A-schoolday-plan',
    form: 'A',
    family: 'schoolday',
    title: 'เลือกแผนดื่มน้ำสำหรับวันเรียนปกติ',
    subtitle: 'ลองเลือกแผนที่ช่วยให้พร้อมเรียนทั้งวัน',
    situation: 'วันนี้เรียนปกติ ไม่มีพละ และอากาศไม่ร้อนมาก',
    options: [
      {
        id: 'steady-water',
        emoji: '💧',
        label: 'จิบน้ำเป็นช่วง ๆ ระหว่างวัน',
        sub: 'เป็นนิสัยที่เหมาะกับวันเรียนปกติ',
        isCorrect: true,
        knowledgeDelta: 10,
        planningDelta: 10,
        feedbackTitle: 'ดีมาก เลือกแผนได้เหมาะ',
        feedbackText: 'การดื่มน้ำเป็นช่วง ๆ ระหว่างวันช่วยให้ร่างกายพร้อมและไม่ต้องรอจนกระหายน้ำมาก'
      },
      {
        id: 'wait-evening',
        emoji: '🌙',
        label: 'รอกลับบ้านตอนเย็นค่อยดื่มทีเดียว',
        sub: 'รอนานเกินไป',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ยังไม่เหมาะที่สุด',
        feedbackText: 'ไม่ควรรอจนถึงตอนเย็น เพราะร่างกายควรได้รับน้ำระหว่างวัน'
      },
      {
        id: 'sweet-main',
        emoji: '🧋',
        label: 'ดื่มน้ำหวานแทนน้ำเปล่า',
        sub: 'ไม่ใช่แผนหลักที่เหมาะ',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ลองคิดใหม่อีกนิด',
        feedbackText: 'น้ำเปล่าควรเป็นเครื่องดื่มหลักมากกว่าน้ำหวาน'
      }
    ]
  },
  {
    id: 'A-outdoor-plan',
    form: 'A',
    family: 'outdoor',
    title: 'เลือกแผนสำหรับกิจกรรมกลางแจ้ง',
    subtitle: 'ถ้าต้องออกไปทำกิจกรรมข้างนอกนานขึ้น ควรเลือกแผนแบบไหน',
    situation: 'บ่ายนี้มีกิจกรรมกลางแจ้งและต้องเดินเยอะ',
    options: [
      {
        id: 'bring-and-sip',
        emoji: '🎒',
        label: 'พกน้ำไปและจิบตามช่วงที่เหมาะ',
        sub: 'วางแผนล่วงหน้าได้ดี',
        isCorrect: true,
        knowledgeDelta: 10,
        planningDelta: 10,
        feedbackTitle: 'ยอดเยี่ยม วางแผนได้ดี',
        feedbackText: 'วันที่มีกิจกรรมกลางแจ้งควรเตรียมน้ำไว้และดื่มเป็นช่วง ๆ'
      },
      {
        id: 'buy-if-needed',
        emoji: '🛒',
        label: 'ค่อยดูอีกที ถ้าร้อนมากค่อยหาน้ำดื่ม',
        sub: 'ยังไม่พร้อมพอ',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 4,
        feedbackTitle: 'ใกล้เคียงแล้ว',
        feedbackText: 'คิดล่วงหน้าให้พร้อมก่อนจะดีกว่า เพราะบางช่วงอาจหาน้ำได้ไม่สะดวก'
      },
      {
        id: 'no-plan',
        emoji: '🫥',
        label: 'ไม่ต้องเตรียมอะไรเป็นพิเศษ',
        sub: 'ไม่เหมาะกับกิจกรรมกลางแจ้ง',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ยังไม่เหมาะ',
        feedbackText: 'กิจกรรมกลางแจ้งควรมีแผนดื่มน้ำที่ชัดเจนขึ้น'
      }
    ]
  },

  // =========================
  // FORM B
  // =========================
  {
    id: 'B-hot-day-plan',
    form: 'B',
    family: 'hot',
    title: 'เลือกแผนดื่มน้ำในวันที่อากาศร้อน',
    subtitle: 'วันที่ร้อนกว่าปกติ ควรเลือกแผนไหนดีที่สุด',
    situation: 'วันนี้อากาศร้อนมาก แม้อยู่ในห้องเรียนก็ยังรู้สึกร้อน',
    options: [
      {
        id: 'more-regular-water',
        emoji: '🫗',
        label: 'ดื่มน้ำสม่ำเสมอมากขึ้นระหว่างวัน',
        sub: 'เหมาะกับวันที่อากาศร้อน',
        isCorrect: true,
        knowledgeDelta: 10,
        planningDelta: 10,
        feedbackTitle: 'ดีมาก เลือกแผนถูกแล้ว',
        feedbackText: 'วันที่อากาศร้อนควรใส่ใจเรื่องน้ำมากขึ้น และดื่มให้สม่ำเสมอ'
      },
      {
        id: 'icecream-plan',
        emoji: '🍦',
        label: 'กินของเย็นแทนน้ำเปล่า',
        sub: 'ไม่ควรใช้แทนน้ำหลัก',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ยังไม่ใช่แผนที่ดีที่สุด',
        feedbackText: 'ของเย็นไม่ควรแทนน้ำเปล่าซึ่งควรเป็นเครื่องดื่มหลัก'
      },
      {
        id: 'ignore-until-thirst',
        emoji: '⌛',
        label: 'รอให้กระหายมากก่อนค่อยดื่ม',
        sub: 'ไม่ควรรอจนเกินไป',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ลองคิดอีกนิด',
        feedbackText: 'ควรดื่มน้ำก่อนจะกระหายมาก โดยเฉพาะในวันที่ร้อน'
      }
    ]
  },
  {
    id: 'B-aircon-plan',
    form: 'B',
    family: 'aircon',
    title: 'เลือกแผนดื่มน้ำในห้องแอร์',
    subtitle: 'บางคนคิดว่าอยู่ห้องแอร์แล้วไม่ต้องดื่มน้ำมาก',
    situation: 'วันนี้เรียนในห้องแอร์ทั้งวัน',
    options: [
      {
        id: 'still-sip',
        emoji: '💧',
        label: 'ยังจิบน้ำตามปกติระหว่างวัน',
        sub: 'เหมาะที่สุด',
        isCorrect: true,
        knowledgeDelta: 10,
        planningDelta: 10,
        feedbackTitle: 'ตอบได้ดีมาก',
        feedbackText: 'ถึงอยู่ห้องแอร์ ร่างกายก็ยังต้องการน้ำตามปกติ'
      },
      {
        id: 'drink-late',
        emoji: '🌙',
        label: 'ค่อยดื่มเยอะ ๆ ตอนเย็นทีเดียว',
        sub: 'ไม่เหมาะเท่าการดื่มระหว่างวัน',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 3,
        feedbackTitle: 'ยังไม่เหมาะที่สุด',
        feedbackText: 'การดื่มกระจายระหว่างวันดีกว่ารอไปดื่มทีเดียวตอนเย็น'
      },
      {
        id: 'soda-replace',
        emoji: '🥤',
        label: 'เปลี่ยนเป็นน้ำอัดลมแทนน้ำเปล่า',
        sub: 'ไม่ใช่แผนหลักที่เหมาะ',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ลองใหม่อีกนิด',
        feedbackText: 'น้ำเปล่าควรเป็นตัวเลือกหลักมากกว่าน้ำอัดลม'
      }
    ]
  },

  // =========================
  // FORM C
  // =========================
  {
    id: 'C-exam-plan',
    form: 'C',
    family: 'exam',
    title: 'เลือกแผนดื่มน้ำในวันสอบ',
    subtitle: 'ควรเลือกแผนที่ช่วยให้พร้อมและมีสมาธิ',
    situation: 'วันนี้มีสอบและต้องใช้สมาธิหลายคาบ',
    options: [
      {
        id: 'nearby-water',
        emoji: '🧴',
        label: 'วางน้ำไว้ใกล้ตัวและจิบเป็นช่วง',
        sub: 'ช่วยไม่ให้ลืมดื่มน้ำ',
        isCorrect: true,
        knowledgeDelta: 10,
        planningDelta: 10,
        feedbackTitle: 'ยอดเยี่ยม เลือกแผนได้เหมาะ',
        feedbackText: 'วันที่ต้องใช้สมาธิควรวางน้ำไว้ใกล้ตัวและดื่มเป็นช่วง ๆ'
      },
      {
        id: 'finish-first',
        emoji: '🚫',
        label: 'รอให้สอบเสร็จก่อนแล้วค่อยดื่ม',
        sub: 'รอนานเกินไป',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ยังไม่เหมาะ',
        feedbackText: 'ไม่ควรรอจนจบวันหรือจบสอบก่อนแล้วค่อยดื่มน้ำ'
      },
      {
        id: 'sweet-replace',
        emoji: '☕',
        label: 'ดื่มเครื่องดื่มหวานแทนน้ำ',
        sub: 'ไม่ใช่ตัวเลือกหลักสำหรับเด็ก',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ลองคิดใหม่',
        feedbackText: 'น้ำเปล่าควรเป็นตัวเลือกหลักมากกว่าเครื่องดื่มหวาน'
      }
    ]
  },
  {
    id: 'C-home-plan',
    form: 'C',
    family: 'home',
    title: 'เลือกแผนดื่มน้ำในวันหยุดอยู่บ้าน',
    subtitle: 'แม้อยู่บ้าน ก็ควรมีนิสัยดื่มน้ำที่ดี',
    situation: 'วันนี้เป็นวันหยุดและไม่ได้ออกไปไหน',
    options: [
      {
        id: 'normal-water-routine',
        emoji: '📅',
        label: 'ยังดื่มน้ำตามช่วงของวันเหมือนเดิม',
        sub: 'เป็นนิสัยที่ดีต่อเนื่อง',
        isCorrect: true,
        knowledgeDelta: 10,
        planningDelta: 10,
        feedbackTitle: 'ดีมาก นี่คือแผนที่เหมาะ',
        feedbackText: 'นิสัยการดื่มน้ำที่ดีควรทำต่อเนื่อง ไม่ใช่เฉพาะวันเรียน'
      },
      {
        id: 'no-need-at-home',
        emoji: '🛋️',
        label: 'อยู่บ้านจึงไม่ต้องสนใจเรื่องน้ำ',
        sub: 'ไม่เหมาะ',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ยังไม่ถูกที่สุด',
        feedbackText: 'ถึงจะอยู่บ้าน ร่างกายก็ยังต้องการน้ำทุกวัน'
      },
      {
        id: 'treat-drinks-only',
        emoji: '🧋',
        label: 'วันหยุดดื่มแต่น้ำหวานแทนน้ำเปล่า',
        sub: 'ไม่ควรแทนทั้งหมด',
        isCorrect: false,
        knowledgeDelta: 0,
        planningDelta: 0,
        feedbackTitle: 'ยังไม่เหมาะ',
        feedbackText: 'วันหยุดก็ยังควรใช้น้ำเปล่าเป็นหลัก'
      }
    ]
  }
];

const HYDRATION_V2_EVALUATE_CONFIDENCE = [
  { id: 'low', emoji: '🤔', label: 'ยังไม่ค่อยมั่นใจ' },
  { id: 'mid', emoji: '🙂', label: 'มั่นใจปานกลาง' },
  { id: 'high', emoji: '🌟', label: 'มั่นใจมาก' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cloneEvaluateItem(item) {
  return {
    ...item,
    options: Array.isArray(item?.options) ? item.options.map(x => ({ ...x })) : []
  };
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

function shuffleEvaluateItem(item, randomFn = Math.random) {
  const cloned = cloneEvaluateItem(item);
  cloned.options = shuffleArray(cloned.options, randomFn);
  return cloned;
}

function resolveHydrationEvaluateForm(stateLike = {}) {
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

function pickEvaluateItem(stateLike = {}, randomFn = Math.random) {
  const form = resolveHydrationEvaluateForm(stateLike);
  let pool = HYDRATION_V2_EVALUATE_BANK.filter(x => x.form === form);

  if (!pool.length) pool = HYDRATION_V2_EVALUATE_BANK.slice();

  pool = shuffleArray(pool, randomFn);
  return pool.length ? shuffleEvaluateItem(pool[0], randomFn) : null;
}

function ensureEvaluateStyles() {
  if (document.getElementById('hydration-evaluate-style')) return;

  const style = document.createElement('style');
  style.id = 'hydration-evaluate-style';
  style.textContent = `
    .hydr-eval-card{
      width:min(920px, 100%);
      max-height:min(92vh, 920px);
      overflow:auto;
    }
    .hydr-eval-panel{
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
      border-radius:18px;
      padding:14px;
      margin:12px 0;
    }
    .hydr-eval-title{
      margin:0 0 8px;
      font-size:clamp(22px, 4vw, 34px);
      line-height:1.15;
      font-weight:900;
    }
    .hydr-eval-text{
      margin:0 0 8px;
      line-height:1.7;
    }
    .hydr-eval-sub{
      margin:0;
      color:#cbd5e1;
      font-size:14px;
      line-height:1.6;
    }
    .hydr-eval-group-title{
      margin:0 0 10px;
      font-size:16px;
      font-weight:800;
      color:#e2e8f0;
    }
    .hydr-eval-grid{
      display:grid;
      gap:10px;
    }
    .hydr-eval-option{
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
    .hydr-eval-option:hover{
      transform:translateY(-1px);
      border-color:rgba(96,165,250,.48);
    }
    .hydr-eval-option.is-selected{
      border-color:#38bdf8;
      box-shadow:0 0 0 2px rgba(56,189,248,.14) inset;
      background:rgba(30,64,175,.18);
    }
    .hydr-eval-option-row{
      display:flex;
      gap:10px;
      align-items:flex-start;
    }
    .hydr-eval-emoji{
      font-size:22px;
      line-height:1;
      width:28px;
      flex:0 0 28px;
      text-align:center;
    }
    .hydr-eval-label{
      font-weight:800;
      margin-bottom:3px;
    }
    .hydr-eval-subline{
      font-size:13px;
      color:#cbd5e1;
      line-height:1.5;
    }
    .hydr-eval-confidence{
      display:grid;
      grid-template-columns:repeat(3, minmax(0,1fr));
      gap:10px;
    }
    @media (max-width:700px){
      .hydr-eval-confidence{
        grid-template-columns:1fr;
      }
    }
    .hydr-eval-result-grid{
      display:grid;
      grid-template-columns:repeat(3, minmax(0,1fr));
      gap:10px;
      margin-top:12px;
    }
    @media (max-width:700px){
      .hydr-eval-result-grid{
        grid-template-columns:1fr;
      }
    }
    .hydr-eval-result-box{
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
      border-radius:16px;
      padding:14px;
    }
    .hydr-eval-result-label{
      font-size:13px;
      color:#cbd5e1;
      margin-bottom:4px;
    }
    .hydr-eval-result-value{
      font-size:28px;
      font-weight:900;
      line-height:1.1;
    }
    .hydr-eval-note{
      color:#cbd5e1;
      font-size:14px;
      line-height:1.6;
      margin-top:10px;
    }
  `;
  document.head.appendChild(style);
}

export async function openEvaluate(overlayEl, state = {}, options = {}) {
  ensureEvaluateStyles();

  const randomFn = typeof options.randomFn === 'function' ? options.randomFn : Math.random;
  const item = pickEvaluateItem(state, randomFn);

  if (!item) {
    return {
      choice: '',
      correct: false,
      knowledgeDelta: 0,
      planningDelta: 0,
      feedbackTitle: 'ยังไม่มีข้อประเมิน',
      feedbackText: '',
      confidenceId: '',
      confidenceLabel: '',
      elapsedMs: 0,
      itemId: '',
      formUsed: resolveHydrationEvaluateForm(state)
    };
  }

  const title = options.title || item.title;
  const subtitle = options.subtitle || item.subtitle || '';
  const formUsed = resolveHydrationEvaluateForm(state);

  return new Promise((resolve) => {
    const startedAt = performance.now();
    let selectedOptionId = '';
    let selectedConfidenceId = '';

    function finish(result) {
      overlayEl.classList.remove('show');
      resolve(result);
    }

    function drawResult(chosen, confidence) {
      const correct = !!chosen?.isCorrect;
      const knowledgeDelta = Number(chosen?.knowledgeDelta || 0);
      const planningDelta = Number(chosen?.planningDelta || 0);
      const elapsedMs = Math.round(performance.now() - startedAt);

      const result = {
        choice: chosen?.id || '',
        correct,
        knowledgeDelta,
        planningDelta,
        feedbackTitle: chosen?.feedbackTitle || (correct ? 'ตอบได้ดีมาก' : 'ลองใหม่อีกนิด'),
        feedbackText: chosen?.feedbackText || '',
        confidenceId: confidence?.id || '',
        confidenceLabel: confidence?.label || '',
        elapsedMs,
        itemId: item.id,
        formUsed
      };

      overlayEl.innerHTML = `
        <div class="overlay-card hydr-eval-card">
          <div class="overlay-kicker">Evaluate Complete</div>
          <h2 class="hydr-eval-title">${escapeHtml(result.feedbackTitle)}</h2>
          <p class="hydr-eval-text">${escapeHtml(result.feedbackText)}</p>

          <div class="hydr-eval-result-grid">
            <div class="hydr-eval-result-box">
              <div class="hydr-eval-result-label">คำตอบ</div>
              <div class="hydr-eval-result-value">${correct ? 'ถูก' : 'ลองอีก'}</div>
            </div>
            <div class="hydr-eval-result-box">
              <div class="hydr-eval-result-label">Knowledge</div>
              <div class="hydr-eval-result-value">${knowledgeDelta}</div>
            </div>
            <div class="hydr-eval-result-box">
              <div class="hydr-eval-result-label">Planning</div>
              <div class="hydr-eval-result-value">${planningDelta}</div>
            </div>
          </div>

          <p class="hydr-eval-note">
            ต่อไปจะเป็นการสร้างแผนดื่มน้ำของตัวเอง
          </p>

          <div class="overlay-actions">
            <button class="btn primary" type="button" id="hydrEvalDoneBtn">ไปต่อ</button>
          </div>
        </div>
      `;

      overlayEl.classList.add('show');
      overlayEl.querySelector('#hydrEvalDoneBtn')?.addEventListener('click', () => finish(result));
    }

    function draw() {
      overlayEl.innerHTML = `
        <div class="overlay-card hydr-eval-card">
          <div class="overlay-kicker">Evaluate</div>
          <h2 class="hydr-eval-title">${escapeHtml(title)}</h2>
          <p class="hydr-eval-sub">${escapeHtml(subtitle)}</p>

          <div class="hydr-eval-panel">
            <div class="hydr-eval-group-title">สถานการณ์</div>
            <p class="hydr-eval-text">${escapeHtml(item.situation || '')}</p>
          </div>

          <div class="hydr-eval-panel">
            <div class="hydr-eval-group-title">หนูจะเลือกแผนไหนดีที่สุด?</div>
            <div class="hydr-eval-grid">
              ${(item.options || []).map(opt => `
                <button
                  class="hydr-eval-option ${selectedOptionId === opt.id ? 'is-selected' : ''}"
                  type="button"
                  data-option="${escapeHtml(opt.id)}"
                >
                  <div class="hydr-eval-option-row">
                    <div class="hydr-eval-emoji">${escapeHtml(opt.emoji || '')}</div>
                    <div>
                      <div class="hydr-eval-label">${escapeHtml(opt.label)}</div>
                      <div class="hydr-eval-subline">${escapeHtml(opt.sub || '')}</div>
                    </div>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="hydr-eval-panel">
            <div class="hydr-eval-group-title">หนูมั่นใจแค่ไหน?</div>
            <div class="hydr-eval-confidence">
              ${HYDRATION_V2_EVALUATE_CONFIDENCE.map(cf => `
                <button
                  class="hydr-eval-option ${selectedConfidenceId === cf.id ? 'is-selected' : ''}"
                  type="button"
                  data-confidence="${escapeHtml(cf.id)}"
                >
                  <div class="hydr-eval-option-row">
                    <div class="hydr-eval-emoji">${escapeHtml(cf.emoji || '')}</div>
                    <div>
                      <div class="hydr-eval-label">${escapeHtml(cf.label)}</div>
                    </div>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="overlay-actions">
            <button class="btn primary" type="button" id="hydrEvalSubmitBtn">ดูผลคำตอบ</button>
          </div>
        </div>
      `;

      overlayEl.classList.add('show');

      overlayEl.querySelectorAll('[data-option]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedOptionId = btn.getAttribute('data-option') || '';
          draw();
        });
      });

      overlayEl.querySelectorAll('[data-confidence]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedConfidenceId = btn.getAttribute('data-confidence') || '';
          draw();
        });
      });

      overlayEl.querySelector('#hydrEvalSubmitBtn')?.addEventListener('click', () => {
        if (!selectedOptionId || !selectedConfidenceId) {
          window.alert('เลือกแผนและระดับความมั่นใจก่อนนะ');
          return;
        }

        const chosen = (item.options || []).find(x => x.id === selectedOptionId);
        const confidence = HYDRATION_V2_EVALUATE_CONFIDENCE.find(x => x.id === selectedConfidenceId);
        drawResult(chosen, confidence);
      });
    }

    draw();
  });
}