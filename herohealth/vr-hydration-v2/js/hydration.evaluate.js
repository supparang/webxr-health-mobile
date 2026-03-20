// === /herohealth/vr-hydration-v2/js/hydration.evaluate.js ===
// Hydration V2 Evaluate Bank + Anti-repeat
// PATCH v20260320a-HYDRATION-V2-EVALUATE-BANK-ANTI-REPEAT

const EVAL_RECENT_LIMIT = 10;

const EVAL_FAMILY_META = {
  spread_day: { label: 'ดื่มน้ำกระจายทั้งวัน', emoji: '💧' },
  after_activity: { label: 'ดื่มน้ำหลังทำกิจกรรม', emoji: '🏃' },
  sweet_drink: { label: 'เลือกน้ำแทนของหวาน', emoji: '🥤' },
  school_routine: { label: 'การดื่มน้ำในวันเรียน', emoji: '🏫' },
  hot_weather: { label: 'ดื่มน้ำเมื่ออากาศร้อน', emoji: '☀️' },
  best_plan: { label: 'เลือกแผนที่เหมาะที่สุด', emoji: '🗓️' }
};

const EVAL_RESEARCH_ORDER = [
  'spread_day',
  'sweet_drink',
  'after_activity',
  'school_routine',
  'hot_weather',
  'best_plan'
];

const EVALUATE_BANK = [
  {
    id: 'eval_spread_day_01',
    family: 'spread_day',
    title: 'เลือกแผนดื่มน้ำที่ดีที่สุด',
    subtitle: 'แผนไหนเหมาะกับวันเรียนธรรมดามากที่สุด',
    options: [
      'ดื่มน้ำครั้งเดียวเยอะ ๆ ตอนเย็น',
      'จิบน้ำหลายช่วงทั้งวัน',
      'ดื่มเฉพาะตอนกระหายมาก'
    ],
    answerIndex: 1,
    feedbackTitle: 'แผนที่เหมาะที่สุดคือการดื่มน้ำกระจายทั้งวัน',
    feedbackText: 'การจิบน้ำหลายช่วงทำได้จริงกว่าและช่วยสร้างนิสัยที่ดีในชีวิตประจำวัน'
  },
  {
    id: 'eval_spread_day_02',
    family: 'spread_day',
    title: 'ถ้าต้องเรียนเช้าถึงบ่าย ควรเลือกแผนไหน',
    subtitle: 'เป้าหมายคือดูแลตัวเองได้ต่อเนื่องทั้งวัน',
    options: [
      'พกน้ำแล้วจิบตามช่วง',
      'รอกลับบ้านแล้วค่อยดื่ม',
      'ดื่มรวดเดียวก่อนเข้าเรียน'
    ],
    answerIndex: 0,
    feedbackTitle: 'พกน้ำแล้วจิบตามช่วงเหมาะที่สุด',
    feedbackText: 'แผนนี้สมดุลและช่วยให้ร่างกายได้รับน้ำสม่ำเสมอ'
  },

  {
    id: 'eval_after_activity_01',
    family: 'after_activity',
    title: 'หลังวิ่งเล่น แผนไหนเหมาะที่สุด',
    subtitle: 'เลือกแผนที่ช่วยให้ร่างกายสดชื่นและปลอดภัย',
    options: [
      'ดื่มน้ำเปล่าทีละน้อยหลังทำกิจกรรม',
      'ดื่มน้ำอัดลมแทนน้ำเปล่า',
      'ไม่ต้องดื่มอะไร'
    ],
    answerIndex: 0,
    feedbackTitle: 'ดื่มน้ำเปล่าทีละน้อยเหมาะที่สุด',
    feedbackText: 'หลังทำกิจกรรมควรได้รับน้ำเพื่อช่วยฟื้นตัวและลดความอ่อนล้า'
  },
  {
    id: 'eval_after_activity_02',
    family: 'after_activity',
    title: 'หลังเรียนพละ เด็กควรวางแผนอย่างไร',
    subtitle: 'คิดจากสิ่งที่ทำได้จริงในโรงเรียน',
    options: [
      'พกน้ำเปล่าไว้แล้วดื่มหลังใช้แรง',
      'งดน้ำจนถึงเย็น',
      'เลือกน้ำหวานอย่างเดียว'
    ],
    answerIndex: 0,
    feedbackTitle: 'พกน้ำเปล่าไว้แล้วดื่มหลังใช้แรงดีที่สุด',
    feedbackText: 'เป็นแผนที่ทำได้จริงและช่วยดูแลร่างกายหลังออกแรง'
  },

  {
    id: 'eval_sweet_drink_01',
    family: 'sweet_drink',
    title: 'ถ้าหิวน้ำระหว่างวัน ควรเลือกแผนไหน',
    subtitle: 'เป้าหมายคือเลือกสิ่งที่เหมาะกับร่างกายที่สุด',
    options: [
      'เลือกน้ำเปล่าเป็นหลัก',
      'เลือกชานมหรือน้ำหวานบ่อย ๆ',
      'ไม่ดื่มอะไรเลย'
    ],
    answerIndex: 0,
    feedbackTitle: 'น้ำเปล่าเป็นตัวเลือกที่เหมาะที่สุด',
    feedbackText: 'น้ำเปล่าช่วยคลายกระหายและเหมาะกับการดื่มสม่ำเสมอมากกว่าเครื่องดื่มหวาน'
  },
  {
    id: 'eval_sweet_drink_02',
    family: 'sweet_drink',
    title: 'ถ้าจะเริ่มลดเครื่องดื่มหวาน ควรเลือกแผนใด',
    subtitle: 'เริ่มจากสิ่งที่ทำได้จริง',
    options: [
      'พกน้ำเปล่าแล้วค่อย ๆ ลดหวาน',
      'ดื่มหวานเหมือนเดิมทุกวัน',
      'งดดื่มทุกอย่าง'
    ],
    answerIndex: 0,
    feedbackTitle: 'พกน้ำเปล่าแล้วค่อย ๆ ลดหวานเหมาะที่สุด',
    feedbackText: 'เป็นแผนที่ค่อยเป็นค่อยไปและทำให้เกิดนิสัยใหม่ได้ง่ายกว่า'
  },

  {
    id: 'eval_school_routine_01',
    family: 'school_routine',
    title: 'แผนไหนเหมาะกับวันเรียนที่มีหลายคาบ',
    subtitle: 'เน้นทำได้จริงในตารางเรียน',
    options: [
      'พกขวดน้ำและจิบเป็นบางช่วง',
      'ดื่มเฉพาะตอนกลับบ้าน',
      'ดื่มครั้งเดียวตอนเช้า'
    ],
    answerIndex: 0,
    feedbackTitle: 'พกขวดน้ำและจิบเป็นบางช่วงเหมาะที่สุด',
    feedbackText: 'ช่วยให้ดื่มน้ำได้ต่อเนื่องโดยไม่ต้องรอจนกระหายมาก'
  },
  {
    id: 'eval_school_routine_02',
    family: 'school_routine',
    title: 'ก่อนสอบควรเลือกแผนใด',
    subtitle: 'ต้องบาลานซ์ทั้งความพร้อมและความสบายตัว',
    options: [
      'ดื่มน้ำพอเหมาะ',
      'งดน้ำทั้งเช้า',
      'ดื่มแต่น้ำหวาน'
    ],
    answerIndex: 0,
    feedbackTitle: 'ดื่มน้ำพอเหมาะเหมาะที่สุด',
    feedbackText: 'ไม่ควรงดน้ำทั้งช่วงเช้า และไม่จำเป็นต้องดื่มมากเกินไปในครั้งเดียว'
  },

  {
    id: 'eval_hot_weather_01',
    family: 'hot_weather',
    title: 'ถ้าวันนี้อากาศร้อนมาก แผนไหนเหมาะที่สุด',
    subtitle: 'คิดจากการดูแลตัวเองระหว่างวัน',
    options: [
      'ดื่มน้ำสม่ำเสมอมากขึ้น',
      'รอให้หิวน้ำจัดก่อน',
      'พึ่งแต่น้ำหวานเย็น'
    ],
    answerIndex: 0,
    feedbackTitle: 'ดื่มน้ำสม่ำเสมอมากขึ้นเหมาะที่สุด',
    feedbackText: 'เมื่ออากาศร้อน ควรใส่ใจการดื่มน้ำมากขึ้นเพื่อช่วยให้ร่างกายสดชื่น'
  },
  {
    id: 'eval_hot_weather_02',
    family: 'hot_weather',
    title: 'ถ้ามีกิจกรรมกลางแจ้งตอนบ่าย ควรเลือกแผนใด',
    subtitle: 'วางแผนแบบทำได้จริง',
    options: [
      'เตรียมน้ำเปล่าไว้ล่วงหน้า',
      'ไม่ต้องเตรียมอะไร',
      'ดื่มน้ำอัดลมแทน'
    ],
    answerIndex: 0,
    feedbackTitle: 'เตรียมน้ำเปล่าไว้ล่วงหน้าเหมาะที่สุด',
    feedbackText: 'การเตรียมน้ำไว้ก่อนช่วยให้ดูแลตัวเองได้ง่ายเมื่ออยู่กลางแจ้ง'
  },

  {
    id: 'eval_best_plan_01',
    family: 'best_plan',
    title: 'แผนใดสมดุลที่สุดในวันธรรมดา',
    subtitle: 'เลือกแผนที่ช่วยสร้างนิสัยได้จริง',
    options: [
      'เช้า-เที่ยง-บ่าย-เย็น จิบน้ำตามช่วง',
      'ดื่มน้ำครั้งเดียวก่อนนอน',
      'ดื่มเฉพาะตอนเล่นกีฬา'
    ],
    answerIndex: 0,
    feedbackTitle: 'แผนจิบน้ำตามช่วงเหมาะที่สุด',
    feedbackText: 'เป็นแผนที่สมดุลและเชื่อมกับกิจวัตรประจำวันได้ดี'
  },
  {
    id: 'eval_best_plan_02',
    family: 'best_plan',
    title: 'ถ้าต้องเลือกเพียง 1 แผนสำหรับสัปดาห์นี้',
    subtitle: 'คิดจากความต่อเนื่องและทำได้จริง',
    options: [
      'พกน้ำเปล่าและดื่มตามเวลา',
      'รอหิวน้ำแล้วค่อยดื่ม',
      'ดื่มรวดเดียวตอนเย็น'
    ],
    answerIndex: 0,
    feedbackTitle: 'พกน้ำเปล่าและดื่มตามเวลาเหมาะที่สุด',
    feedbackText: 'แผนนี้ช่วยให้เกิดความต่อเนื่องและทำซ้ำได้ง่ายในหลายวัน'
  }
];

export async function openEvaluate(rootEl, state = {}, opts = {}) {
  const pid = String(state.pid || 'anon').trim() || 'anon';
  const studyId = String(state.studyId || 'nostudy').trim() || 'nostudy';
  const run = String(state.run || 'play');
  const weekNo = positiveInt(state.weekNo) || 1;
  const sessionNo = positiveInt(state.sessionNo) || 1;
  const randomFn = typeof opts.randomFn === 'function' ? opts.randomFn : Math.random;

  if (!rootEl) {
    return fallbackResult();
  }

  const item = prepareEvaluateItem(
    pickEvaluateItem({
      run,
      weekNo,
      sessionNo,
      pid,
      studyId,
      randomFn
    }),
    randomFn
  );

  if (!item) {
    return fallbackResult();
  }

  return new Promise((resolve) => {
    function showRoot() {
      rootEl.classList.add('show');
      rootEl.setAttribute('aria-hidden', 'false');
    }

    function hideRoot() {
      rootEl.classList.remove('show');
      rootEl.setAttribute('aria-hidden', 'true');
      rootEl.innerHTML = '';
    }

    const meta = EVAL_FAMILY_META[item.family] || { label: item.family, emoji: '💧' };

    rootEl.innerHTML = `
      <div class="overlay-card">
        <div class="overlay-kicker">Evaluate • ${escapeHtml(meta.emoji)} ${escapeHtml(meta.label)}</div>
        <h2>${escapeHtml(opts.title || item.title || 'เลือกแผนดื่มน้ำที่ดีที่สุด')}</h2>
        <p>${escapeHtml(opts.subtitle || item.subtitle || '')}</p>

        <div class="result-box">
          <strong>โจทย์</strong><br/>
          ${escapeHtml(item.title)}
        </div>

        <div style="display:grid; gap:10px; margin-top:14px;">
          ${item.shuffledOptions.map((choice, idx) => `
            <button
              class="btn ghost eval-choice"
              type="button"
              data-choice-index="${idx}"
              style="text-align:left; justify-content:flex-start;"
            >
              ${idx + 1}) ${escapeHtml(choice.text)}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    showRoot();

    rootEl.querySelectorAll('.eval-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const choiceIndex = Number(btn.dataset.choiceIndex || -1);
        const correct = choiceIndex === item.answerIndex;

        const knowledgeDelta = correct ? 6 : 2;
        const planningDelta = correct ? 10 : 3;
        const chosenText = item.shuffledOptions[choiceIndex]?.text || '-';
        const correctText = item.shuffledOptions[item.answerIndex]?.text || '-';

        saveEvaluateSeenHistory({
          pid,
          studyId,
          weekNo,
          sessionNo,
          id: item.id
        });

        rootEl.innerHTML = `
          <div class="overlay-card">
            <div class="overlay-kicker">Evaluate • Result</div>
            <h2>${correct ? 'เลือกได้ดีมาก ✅' : 'ลองคิดอีกนิด ✨'}</h2>

            <div class="result-box">
              <strong>คำตอบที่เลือก:</strong> ${escapeHtml(chosenText)}<br/>
              <strong>คำตอบที่เหมาะที่สุด:</strong> ${escapeHtml(correctText)}<br/><br/>
              <strong>คำอธิบาย:</strong> ${escapeHtml(item.feedbackText)}
            </div>

            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-label">Knowledge</div>
                <div class="summary-main">${knowledgeDelta}</div>
                <div class="summary-sub">จากการอธิบายเหตุผล</div>
              </div>

              <div class="summary-card">
                <div class="summary-label">Planning</div>
                <div class="summary-main">${planningDelta}</div>
                <div class="summary-sub">จากการเลือกแผนที่เหมาะสม</div>
              </div>
            </div>

            <div class="overlay-actions">
              <button class="btn primary" id="evalDoneBtn" type="button">ไปต่อ Create</button>
            </div>
          </div>
        `;

        rootEl.querySelector('#evalDoneBtn')?.addEventListener('click', () => {
          hideRoot();
          resolve({
            choice: choiceIndex,
            correct,
            knowledgeDelta,
            planningDelta,
            feedbackTitle: item.feedbackTitle,
            feedbackText: item.feedbackText,
            itemId: item.id,
            family: item.family
          });
        });
      });
    });
  });
}

function fallbackResult() {
  return {
    choice: null,
    correct: false,
    knowledgeDelta: 0,
    planningDelta: 0,
    feedbackTitle: 'ยังไม่มีผล',
    feedbackText: 'ยังไม่มีข้อมูล evaluate'
  };
}

function pickEvaluateItem({
  run = 'play',
  weekNo = 1,
  sessionNo = 1,
  pid = 'anon',
  studyId = 'nostudy',
  randomFn = Math.random
} = {}) {
  const history = readEvaluateSeenHistory(pid, studyId);
  const recentSet = new Set(history.recent || []);

  let family = null;

  if (run === 'research') {
    const idx = Math.max(0, ((weekNo - 1) * 2 + (sessionNo - 1))) % EVAL_RESEARCH_ORDER.length;
    family = EVAL_RESEARCH_ORDER[idx];
  } else {
    family = pickRandom(Object.keys(EVAL_FAMILY_META), randomFn);
  }

  const familyPool = EVALUATE_BANK.filter(item => item.family === family);
  const preferred = familyPool.filter(item => !recentSet.has(item.id));
  const firstChoicePool = preferred.length ? preferred : familyPool;

  let item = pickRandom(firstChoicePool, randomFn);
  if (item) return item;

  const globalPreferred = EVALUATE_BANK.filter(item => !recentSet.has(item.id));
  const globalPool = globalPreferred.length ? globalPreferred : EVALUATE_BANK;

  return pickRandom(globalPool, randomFn);
}

function prepareEvaluateItem(item, randomFn) {
  if (!item) return null;

  const entries = item.options.map((text, originalIndex) => ({
    text,
    originalIndex
  }));

  const shuffledOptions = shuffleArray(entries, randomFn);
  const answerIndex = shuffledOptions.findIndex(x => x.originalIndex === item.answerIndex);

  return {
    ...item,
    shuffledOptions,
    answerIndex
  };
}

function readEvaluateSeenHistory(pid, studyId) {
  const key = buildEvaluateSeenKey(pid, studyId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { recent: [], bySession: {} };
    const parsed = JSON.parse(raw);
    return {
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      bySession: parsed.bySession && typeof parsed.bySession === 'object' ? parsed.bySession : {}
    };
  } catch (_) {
    return { recent: [], bySession: {} };
  }
}

function saveEvaluateSeenHistory({
  pid,
  studyId,
  weekNo,
  sessionNo,
  id
} = {}) {
  if (!id) return;

  const key = buildEvaluateSeenKey(pid, studyId);
  const history = readEvaluateSeenHistory(pid, studyId);
  const sessionKey = `W${weekNo}S${sessionNo}`;

  history.bySession[sessionKey] = [id];
  history.recent = [id, ...(history.recent || []).filter(x => x !== id)].slice(0, EVAL_RECENT_LIMIT);

  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch (_) {}
}

function buildEvaluateSeenKey(pid, studyId) {
  const safePid = String(pid || 'anon').trim() || 'anon';
  const safeStudyId = String(studyId || 'nostudy').trim() || 'nostudy';
  return `HHA_HYD_V2_SEEN_EVAL:${safePid}:${safeStudyId}`;
}

function pickRandom(arr, randomFn) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const idx = Math.floor((typeof randomFn === 'function' ? randomFn() : Math.random()) * arr.length);
  return arr[idx] || arr[0];
}

function shuffleArray(arr, randomFn) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const r = typeof randomFn === 'function' ? randomFn() : Math.random();
    const j = Math.floor(r * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function positiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}