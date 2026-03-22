// === /herohealth/vr-hydration-v2/js/hydration.create.js ===
// Hydration V2 Create Template Bank + Anti-repeat
// PATCH v20260320a-HYDRATION-V2-CREATE-BANK-ANTI-REPEAT

const CREATE_RECENT_LIMIT = 10;

const SLOT_META = [
  { key: 'morning', label: 'เช้า' },
  { key: 'midmorning', label: 'สาย' },
  { key: 'noon', label: 'เที่ยง' },
  { key: 'afternoon', label: 'บ่าย' },
  { key: 'evening', label: 'เย็น' }
];

const CHOICE_META = {
  water: {
    label: 'น้ำเปล่า',
    emoji: '💧',
    short: 'น้ำ'
  },
  sweet: {
    label: 'เครื่องดื่มหวาน',
    emoji: '🥤',
    short: 'หวาน'
  },
  skip: {
    label: 'ไม่ได้ดื่ม',
    emoji: '⏭️',
    short: 'ข้าม'
  }
};

const CREATE_FAMILY_META = {
  regular_school: { label: 'วันเรียนปกติ', emoji: '🏫' },
  hot_day: { label: 'วันอากาศร้อน', emoji: '☀️' },
  pe_day: { label: 'วันเรียนพละ', emoji: '🏃' },
  exam_day: { label: 'วันสอบ', emoji: '📝' },
  sweet_control: { label: 'ลดเครื่องดื่มหวาน', emoji: '🥤' },
  activity_day: { label: 'วันกิจกรรมพิเศษ', emoji: '🎉' }
};

const CREATE_RESEARCH_ORDER = [
  'regular_school',
  'hot_day',
  'pe_day',
  'exam_day',
  'sweet_control',
  'activity_day'
];

const CREATE_TEMPLATE_BANK = [
  {
    id: 'regular_school_01',
    family: 'regular_school',
    title: 'จัดแผนดื่มน้ำสำหรับวันเรียนปกติ',
    subtitle: 'วันนี้มีเรียนตั้งแต่เช้าถึงบ่าย เลือกสิ่งที่จะดื่มในแต่ละช่วง',
    scenario: 'เป้าหมายคือดื่มน้ำให้สม่ำเสมอระหว่างวัน และหลีกเลี่ยงการดื่มหวานบ่อย',
    targets: {
      minWater: 4,
      maxSweet: 1,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'afternoon'],
      preferWaterSlots: ['noon']
    }
  },
  {
    id: 'regular_school_02',
    family: 'regular_school',
    title: 'วางแผนดื่มน้ำให้เหมาะกับวันเรียนยาว',
    subtitle: 'วันนี้มีหลายคาบติดกัน ควรจิบน้ำอย่างไร',
    scenario: 'ลองทำแผนที่ทำได้จริงในชีวิตประจำวัน และไม่ปล่อยให้ช่วงบ่ายขาดน้ำ',
    targets: {
      minWater: 4,
      maxSweet: 0,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'noon'],
      preferWaterSlots: ['afternoon', 'evening']
    }
  },

  {
    id: 'hot_day_01',
    family: 'hot_day',
    title: 'จัดแผนดื่มน้ำในวันที่อากาศร้อน',
    subtitle: 'วันนี้แดดแรงกว่าปกติ ต้องใส่ใจการดื่มน้ำมากขึ้น',
    scenario: 'ลองจัดแผนให้เหมาะกับอากาศร้อน และหลีกเลี่ยงการปล่อยให้ช่วงกลางวันขาดน้ำ',
    targets: {
      minWater: 4,
      maxSweet: 1,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'noon', 'afternoon'],
      preferWaterSlots: ['evening']
    }
  },
  {
    id: 'hot_day_02',
    family: 'hot_day',
    title: 'วางแผนดื่มน้ำในวันที่มีกิจกรรมกลางแจ้ง',
    subtitle: 'มีช่วงเข้าแถวและทำกิจกรรมหน้าลานตอนบ่าย',
    scenario: 'พยายามทำให้แผนนี้ช่วยให้ร่างกายสดชื่นและไม่พึ่งเครื่องดื่มหวาน',
    targets: {
      minWater: 4,
      maxSweet: 0,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'afternoon'],
      preferWaterSlots: ['noon', 'evening']
    }
  },

  {
    id: 'pe_day_01',
    family: 'pe_day',
    title: 'จัดแผนดื่มน้ำสำหรับวันเรียนพละ',
    subtitle: 'วันนี้มีเรียนพละช่วงบ่าย',
    scenario: 'แผนที่ดีควรมีน้ำในช่วงก่อนหรือหลังใช้แรง และไม่เน้นเครื่องดื่มหวาน',
    targets: {
      minWater: 4,
      maxSweet: 1,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'afternoon', 'evening'],
      preferWaterSlots: ['noon']
    }
  },
  {
    id: 'pe_day_02',
    family: 'pe_day',
    title: 'วางแผนดื่มน้ำสำหรับวันที่ต้องวิ่งเล่นเยอะ',
    subtitle: 'วันนี้มีกิจกรรมใช้แรงมากกว่าปกติ',
    scenario: 'ลองจัดแผนที่ช่วยให้พร้อมก่อนใช้แรงและฟื้นตัวหลังทำกิจกรรม',
    targets: {
      minWater: 4,
      maxSweet: 0,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'afternoon'],
      preferWaterSlots: ['evening']
    }
  },

  {
    id: 'exam_day_01',
    family: 'exam_day',
    title: 'จัดแผนดื่มน้ำในวันสอบ',
    subtitle: 'วันนี้ต้องบาลานซ์ทั้งความพร้อมและความสบายตัว',
    scenario: 'แผนที่ดีควรดื่มน้ำพอเหมาะ ไม่งดน้ำทั้งเช้า และไม่ดื่มรวดเดียวมากเกินไป',
    targets: {
      minWater: 3,
      maxSweet: 1,
      maxSkip: 2,
      mustWaterSlots: ['morning'],
      preferWaterSlots: ['noon', 'afternoon']
    }
  },
  {
    id: 'exam_day_02',
    family: 'exam_day',
    title: 'วางแผนดื่มน้ำให้เหมาะกับวันสอบยาว',
    subtitle: 'มีสอบทั้งเช้าและบ่าย',
    scenario: 'ลองจัดแผนที่พอดี ไม่มากเกินไป และไม่ปล่อยให้ร่างกายขาดน้ำ',
    targets: {
      minWater: 3,
      maxSweet: 0,
      maxSkip: 2,
      mustWaterSlots: ['morning', 'noon'],
      preferWaterSlots: ['afternoon']
    }
  },

  {
    id: 'sweet_control_01',
    family: 'sweet_control',
    title: 'จัดแผนลดเครื่องดื่มหวาน',
    subtitle: 'วันนี้ตั้งใจลดหวานและหันมาดื่มน้ำให้มากขึ้น',
    scenario: 'ถ้าแผนดี ควรเห็นน้ำเปล่าหลายช่วง และหวานน้อยที่สุด',
    targets: {
      minWater: 4,
      maxSweet: 0,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'afternoon'],
      preferWaterSlots: ['noon', 'evening']
    }
  },
  {
    id: 'sweet_control_02',
    family: 'sweet_control',
    title: 'สร้างแผนใหม่แทนการดื่มหวานบ่อย',
    subtitle: 'เป้าหมายคือฝึกนิสัยใหม่แบบค่อยเป็นค่อยไป',
    scenario: 'ลองทำแผนที่เน้นน้ำเปล่าให้มาก และไม่ใช้เครื่องดื่มหวานเป็นตัวหลัก',
    targets: {
      minWater: 4,
      maxSweet: 1,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'noon'],
      preferWaterSlots: ['afternoon', 'evening']
    }
  },

  {
    id: 'activity_day_01',
    family: 'activity_day',
    title: 'จัดแผนดื่มน้ำในวันกิจกรรมพิเศษ',
    subtitle: 'วันนี้มีทั้งเรียนและกิจกรรมเสริม',
    scenario: 'แผนที่ดีควรช่วยให้สดชื่นทั้งวันและไม่ทิ้งช่วงยาวเกินไป',
    targets: {
      minWater: 4,
      maxSweet: 1,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'afternoon'],
      preferWaterSlots: ['noon', 'evening']
    }
  },
  {
    id: 'activity_day_02',
    family: 'activity_day',
    title: 'วางแผนดื่มน้ำสำหรับวันที่ตารางแน่น',
    subtitle: 'วันนี้มีกิจกรรมต่อเนื่องหลายช่วง',
    scenario: 'ลองวางแผนให้ดื่มน้ำได้จริง แม้วันจะยุ่งกว่าปกติ',
    targets: {
      minWater: 4,
      maxSweet: 0,
      maxSkip: 1,
      mustWaterSlots: ['morning', 'afternoon'],
      preferWaterSlots: ['noon', 'evening']
    }
  }
];

export async function openCreate(rootEl, state = {}) {
  const pid = String(state.pid || 'anon').trim() || 'anon';
  const studyId = String(state.studyId || 'nostudy').trim() || 'nostudy';
  const run = String(state.run || 'play');
  const weekNo = positiveInt(state.weekNo) || 1;
  const sessionNo = positiveInt(state.sessionNo) || 1;

  if (!rootEl) {
    return fallbackCreateResult();
  }

  const template = pickCreateTemplate({
    run,
    weekNo,
    sessionNo,
    pid,
    studyId
  });

  if (!template) {
    return fallbackCreateResult();
  }

  const meta = CREATE_FAMILY_META[template.family] || { label: template.family, emoji: '💧' };
  const selections = {};

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

    function allSelected() {
      return SLOT_META.every(slot => !!selections[slot.key]);
    }

    function summaryText() {
      return SLOT_META.map(slot => {
        const choiceKey = selections[slot.key];
        const choice = CHOICE_META[choiceKey];
        return `${slot.label}: ${choice ? `${choice.emoji} ${choice.label}` : 'ยังไม่ได้เลือก'}`;
      }).join(' • ');
    }

    function renderForm() {
      rootEl.innerHTML = `
        <div class="overlay-card">
          <div class="overlay-kicker">Create • ${escapeHtml(meta.emoji)} ${escapeHtml(meta.label)}</div>
          <h2>${escapeHtml(template.title)}</h2>
          <p>${escapeHtml(template.subtitle)}</p>

          <div class="result-box">
            <strong>สถานการณ์</strong><br/>
            ${escapeHtml(template.scenario)}
          </div>

          <div style="display:grid; gap:12px; margin-top:14px;">
            ${SLOT_META.map(slot => `
              <div class="result-box">
                <strong>${escapeHtml(slot.label)}</strong><br/>
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                  ${Object.entries(CHOICE_META).map(([choiceKey, choice]) => `
                    <button
                      class="btn ${selections[slot.key] === choiceKey ? 'primary' : 'ghost'} create-choice"
                      type="button"
                      data-slot-key="${slot.key}"
                      data-choice-key="${choiceKey}"
                    >
                      ${escapeHtml(choice.emoji)} ${escapeHtml(choice.label)}
                    </button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="result-box" style="margin-top:14px;">
            <strong>แผนตอนนี้</strong><br/>
            ${escapeHtml(summaryText())}
          </div>

          <div class="overlay-actions">
            <button class="btn primary" id="createSubmitBtn" type="button" ${allSelected() ? '' : 'disabled'}>
              ส่งแผนนี้
            </button>
          </div>
        </div>
      `;

      showRoot();

      rootEl.querySelectorAll('.create-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          const slotKey = String(btn.dataset.slotKey || '');
          const choiceKey = String(btn.dataset.choiceKey || '');
          if (!slotKey || !choiceKey) return;
          selections[slotKey] = choiceKey;
          renderForm();
        });
      });

      rootEl.querySelector('#createSubmitBtn')?.addEventListener('click', () => {
        if (!allSelected()) return;
        finishCreate();
      });
    }

    function finishCreate() {
      const result = evaluatePlan(template, selections);

      saveCreateSeenHistory({
        pid,
        studyId,
        weekNo,
        sessionNo,
        id: template.id
      });

      rootEl.innerHTML = `
        <div class="overlay-card">
          <div class="overlay-kicker">Create • Result</div>
          <h2>${escapeHtml(result.feedbackTitle)}</h2>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">Plan Score</div>
              <div class="summary-main">${result.planScore}</div>
              <div class="summary-sub">คะแนนจากความเหมาะสมของแผน</div>
            </div>

            <div class="summary-card">
              <div class="summary-label">Water Slots</div>
              <div class="summary-main">${result.metrics.waterCount}</div>
              <div class="summary-sub">จำนวนช่วงที่เลือกน้ำเปล่า</div>
            </div>
          </div>

          <div class="result-box">
            <strong>แผนของคุณ</strong><br/>
            ${SLOT_META.map(slot => {
              const choice = CHOICE_META[selections[slot.key]];
              return `${slot.label}: ${choice ? `${choice.emoji} ${choice.label}` : '-'}`;
            }).join('<br/>')}
            <br/><br/>
            <strong>คำแนะนำ</strong><br/>
            ${escapeHtml(result.feedbackText)}
          </div>

          <div class="overlay-actions">
            <button class="btn primary" id="createDoneBtn" type="button">จบ Create</button>
          </div>
        </div>
      `;

      rootEl.querySelector('#createDoneBtn')?.addEventListener('click', () => {
        hideRoot();
        resolve({
          plan: {
            templateId: template.id,
            family: template.family,
            title: template.title,
            selections: { ...selections }
          },
          planScore: result.planScore,
          feedbackTitle: result.feedbackTitle,
          feedbackText: result.feedbackText,
          metrics: result.metrics
        });
      });
    }

    renderForm();
  });
}

function evaluatePlan(template, selections) {
  const chosen = SLOT_META.map(slot => ({
    slotKey: slot.key,
    choice: selections[slot.key] || 'skip'
  }));

  const waterCount = chosen.filter(x => x.choice === 'water').length;
  const sweetCount = chosen.filter(x => x.choice === 'sweet').length;
  const skipCount = chosen.filter(x => x.choice === 'skip').length;

  const mustWaterSlots = template.targets.mustWaterSlots || [];
  const preferWaterSlots = template.targets.preferWaterSlots || [];

  let score = 0;
  const notes = [];

  // โครงหลัก
  score += Math.min(40, waterCount * 10);

  if (waterCount >= template.targets.minWater) {
    score += 15;
  } else {
    notes.push(`ควรมีช่วงที่ดื่มน้ำอย่างน้อย ${template.targets.minWater} ช่วง`);
  }

  if (sweetCount <= template.targets.maxSweet) {
    score += 10;
  } else {
    notes.push(`ควรลดเครื่องดื่มหวานให้ไม่เกิน ${template.targets.maxSweet} ช่วง`);
    score -= 8 * (sweetCount - template.targets.maxSweet);
  }

  if (skipCount <= template.targets.maxSkip) {
    score += 10;
  } else {
    notes.push(`ไม่ควรปล่อยให้ไม่ได้ดื่มบ่อยเกิน ${template.targets.maxSkip} ช่วง`);
    score -= 6 * (skipCount - template.targets.maxSkip);
  }

  // must water
  let mustWaterHit = 0;
  for (const slotKey of mustWaterSlots) {
    if (selections[slotKey] === 'water') {
      mustWaterHit += 1;
      score += 6;
    } else {
      notes.push(`ช่วง${slotLabel(slotKey)}ควรเลือกน้ำเปล่า`);
    }
  }

  // prefer water
  let preferWaterHit = 0;
  for (const slotKey of preferWaterSlots) {
    if (selections[slotKey] === 'water') {
      preferWaterHit += 1;
      score += 4;
    }
  }

  // bonus สมดุล
  if (waterCount >= 4 && sweetCount === 0 && skipCount <= 1) {
    score += 10;
  }

  if (selections.morning === 'water') {
    score += 5;
  }

  if (selections.afternoon === 'water') {
    score += 5;
  }

  if (selections.evening === 'water' || selections.evening === 'skip') {
    score += 3;
  }

  score = clamp(Math.round(score), 0, 100);

  let feedbackTitle = 'ยังต้องปรับแผนอีกนิด ✨';
  if (score >= 80) feedbackTitle = 'วางแผนได้ดีมาก ✅';
  else if (score >= 60) feedbackTitle = 'วางแผนได้ดีแล้ว 👍';
  else if (score >= 40) feedbackTitle = 'แผนเริ่มดีขึ้นแล้ว 🙂';

  let feedbackText = '';
  if (score >= 80) {
    feedbackText = 'แผนนี้มีน้ำเปล่าหลายช่วง กระจายได้ดี และเหมาะกับสถานการณ์มาก';
  } else if (score >= 60) {
    feedbackText = 'แผนนี้ค่อนข้างเหมาะแล้ว แต่ยังปรับให้สม่ำเสมอขึ้นได้อีกนิด';
  } else {
    feedbackText = notes.length
      ? notes.join(' • ')
      : 'ลองเพิ่มน้ำเปล่าในหลายช่วง และลดหวานลงอีกหน่อย';
  }

  return {
    planScore: score,
    feedbackTitle,
    feedbackText,
    metrics: {
      waterCount,
      sweetCount,
      skipCount,
      mustWaterHit,
      preferWaterHit
    }
  };
}

function pickCreateTemplate({
  run = 'play',
  weekNo = 1,
  sessionNo = 1,
  pid = 'anon',
  studyId = 'nostudy'
} = {}) {
  const history = readCreateSeenHistory(pid, studyId);
  const recentSet = new Set(history.recent || []);

  let family = null;
  if (run === 'research') {
    const idx = Math.max(0, ((weekNo - 1) * 2 + (sessionNo - 1))) % CREATE_RESEARCH_ORDER.length;
    family = CREATE_RESEARCH_ORDER[idx];
  } else {
    family = pickRandom(Object.keys(CREATE_FAMILY_META));
  }

  const familyPool = CREATE_TEMPLATE_BANK.filter(item => item.family === family);
  const preferred = familyPool.filter(item => !recentSet.has(item.id));
  const pool = preferred.length ? preferred : familyPool;

  let picked = pickRandom(pool);
  if (picked) return picked;

  const globalPreferred = CREATE_TEMPLATE_BANK.filter(item => !recentSet.has(item.id));
  const globalPool = globalPreferred.length ? globalPreferred : CREATE_TEMPLATE_BANK;

  return pickRandom(globalPool);
}

function readCreateSeenHistory(pid, studyId) {
  const key = buildCreateSeenKey(pid, studyId);
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

function saveCreateSeenHistory({
  pid,
  studyId,
  weekNo,
  sessionNo,
  id
} = {}) {
  if (!id) return;

  const key = buildCreateSeenKey(pid, studyId);
  const history = readCreateSeenHistory(pid, studyId);
  const sessionKey = `W${weekNo}S${sessionNo}`;

  history.bySession[sessionKey] = [id];
  history.recent = [id, ...(history.recent || []).filter(x => x !== id)].slice(0, CREATE_RECENT_LIMIT);

  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch (_) {}
}

function buildCreateSeenKey(pid, studyId) {
  const safePid = String(pid || 'anon').trim() || 'anon';
  const safeStudyId = String(studyId || 'nostudy').trim() || 'nostudy';
  return `HHA_HYD_V2_SEEN_CREATE:${safePid}:${safeStudyId}`;
}

function slotLabel(slotKey) {
  const found = SLOT_META.find(x => x.key === slotKey);
  return found ? found.label : slotKey;
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] || arr[0];
}

function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function positiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function fallbackCreateResult() {
  return {
    plan: {},
    planScore: 0,
    feedbackTitle: 'ยังไม่มีผล',
    feedbackText: 'ยังไม่มีข้อมูล create'
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}