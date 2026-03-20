// === /herohealth/vr-hydration-v2/js/hydration.scenarios.js ===
// Hydration V2 Scenario Bank + Anti-repeat Engine
// PATCH v20260320a-HYDRATION-V2-SCENARIO-BANK-ANTI-REPEAT

const SEEN_RECENT_LIMIT = 12;

const FAMILY_META = {
  spread_day: {
    label: 'ดื่มน้ำกระจายทั้งวัน',
    emoji: '💧'
  },
  after_activity: {
    label: 'ดื่มน้ำหลังทำกิจกรรม',
    emoji: '🏃'
  },
  sweet_drink: {
    label: 'เลือกน้ำแทนของหวาน',
    emoji: '🥤'
  },
  school_routine: {
    label: 'การดื่มน้ำในวันเรียน',
    emoji: '🏫'
  },
  hot_weather: {
    label: 'ดื่มน้ำเมื่ออากาศร้อน',
    emoji: '☀️'
  },
  best_plan: {
    label: 'เลือกแผนที่เหมาะที่สุด',
    emoji: '🗓️'
  }
};

const RESEARCH_FAMILY_SETS = [
  ['spread_day', 'sweet_drink'],
  ['after_activity', 'school_routine'],
  ['hot_weather', 'best_plan'],
  ['spread_day', 'school_routine'],
  ['sweet_drink', 'hot_weather'],
  ['after_activity', 'best_plan']
];

const SCENARIO_BANK = [
  // =========================================================
  // FAMILY: spread_day
  // =========================================================
  {
    id: 'spread_day_a1',
    family: 'spread_day',
    difficulty: 1,
    stem: 'มะลิดื่มน้ำ 4 แก้วรวดเดียวตอนเย็น เพราะระหว่างวันไม่อยากเข้าห้องน้ำ แบบไหนดีกว่า',
    choices: [
      'ดื่มรวดเดียวตอนเย็นดีที่สุด',
      'ดื่มน้ำกระจายทั้งวันดีกว่า',
      'ไม่ต้องดื่มน้ำก็ได้'
    ],
    answerIndex: 1,
    explain: 'การดื่มน้ำกระจายทั้งวันช่วยให้ร่างกายสดชื่นกว่าและเหมาะกับการสร้างนิสัยที่ดี'
  },
  {
    id: 'spread_day_a2',
    family: 'spread_day',
    difficulty: 1,
    stem: 'ก่อนเข้าเรียน ต้นน้ำไม่ดื่มน้ำเลย แล้วตั้งใจไปดื่มเยอะ ๆ ตอนกลับบ้าน วิธีนี้เหมาะไหม',
    choices: [
      'ไม่ค่อยเหมาะ ควรดื่มเป็นช่วง ๆ ระหว่างวัน',
      'เหมาะมาก เพราะไม่ต้องพกขวดน้ำ',
      'เหมาะถ้าดื่มแต่น้ำหวาน'
    ],
    answerIndex: 0,
    explain: 'การดื่มน้ำเป็นช่วง ๆ ระหว่างวันช่วยให้ร่างกายไม่ขาดน้ำและดูแลง่ายกว่า'
  },
  {
    id: 'spread_day_a3',
    family: 'spread_day',
    difficulty: 1,
    stem: 'ปาล์มดื่มน้ำเฉพาะตอนพักเที่ยงครั้งเดียว แต่ช่วงเช้ากับบ่ายแทบไม่ดื่มเลย ควรปรับอย่างไร',
    choices: [
      'เพิ่มการจิบน้ำในบางช่วงของวัน',
      'ดื่มเฉพาะก่อนนอนพอ',
      'เปลี่ยนเป็นน้ำหวานแทน'
    ],
    answerIndex: 0,
    explain: 'การจิบน้ำเป็นบางช่วงช่วยให้ร่างกายได้รับน้ำสม่ำเสมอ'
  },
  {
    id: 'spread_day_a4',
    family: 'spread_day',
    difficulty: 2,
    stem: 'ถ้าวันนี้ต้องเรียนตั้งแต่เช้าถึงเย็น แผนไหนเหมาะที่สุด',
    choices: [
      'ดื่มเยอะมากครั้งเดียวตอนเช้า',
      'พกน้ำแล้วจิบตามช่วงระหว่างวัน',
      'รอกลับบ้านค่อยดื่ม'
    ],
    answerIndex: 1,
    explain: 'การพกน้ำและจิบตามช่วงเป็นแผนที่สมดุลและทำได้จริงในชีวิตประจำวัน'
  },

  // =========================================================
  // FAMILY: after_activity
  // =========================================================
  {
    id: 'after_activity_b1',
    family: 'after_activity',
    difficulty: 1,
    stem: 'หลังวิ่งเล่นเสร็จ ดินควรเลือกอะไรดีที่สุด',
    choices: [
      'น้ำเปล่า',
      'น้ำอัดลม',
      'ชานม'
    ],
    answerIndex: 0,
    explain: 'หลังวิ่งเล่น ร่างกายควรได้รับน้ำเปล่าเพื่อทดแทนน้ำที่เสียไป'
  },
  {
    id: 'after_activity_b2',
    family: 'after_activity',
    difficulty: 1,
    stem: 'หลังเรียนพละ นีน่ารู้สึกเหนื่อยและร้อน ควรทำอย่างไร',
    choices: [
      'ไม่ต้องดื่มอะไร',
      'ดื่มน้ำทีละน้อย',
      'ดื่มแต่น้ำหวานเย็น'
    ],
    answerIndex: 1,
    explain: 'หลังใช้แรง การดื่มน้ำทีละน้อยเป็นวิธีที่เหมาะและปลอดภัย'
  },
  {
    id: 'after_activity_b3',
    family: 'after_activity',
    difficulty: 2,
    stem: 'หลังเต้นกีฬา แบมเลือกจะดื่มน้ำเปล่าหรือรอจนหายเหนื่อยก่อน คุณคิดว่าแบบไหนดีกว่า',
    choices: [
      'ดื่มน้ำเปล่าหลังทำกิจกรรมดีกว่า',
      'รอจนเย็นค่อยดื่ม',
      'ไม่ต้องดื่มถ้ายังเล่นต่อ'
    ],
    answerIndex: 0,
    explain: 'หลังทำกิจกรรม ร่างกายควรได้รับน้ำเร็วพอสมควรเพื่อช่วยฟื้นตัว'
  },
  {
    id: 'after_activity_b4',
    family: 'after_activity',
    difficulty: 2,
    stem: 'หลังซ้อมกีฬา 30 นาที สิ่งไหนเหมาะที่สุด',
    choices: [
      'ดื่มน้ำเป็นช่วง ๆ',
      'ดื่มน้ำหวานแทนน้ำเปล่า',
      'งดดื่มน้ำเพื่อลดการเข้าห้องน้ำ'
    ],
    answerIndex: 0,
    explain: 'หลังซ้อมกีฬา ควรดื่มน้ำเพื่อช่วยให้ร่างกายสดชื่นและฟื้นตัวดีขึ้น'
  },

  // =========================================================
  // FAMILY: sweet_drink
  // =========================================================
  {
    id: 'sweet_drink_c1',
    family: 'sweet_drink',
    difficulty: 1,
    stem: 'ฟ้าจะพกอะไรไปโรงเรียนในวันที่อากาศร้อน',
    choices: [
      'น้ำอัดลม',
      'ขวดน้ำเปล่า',
      'ชานมไข่มุก'
    ],
    answerIndex: 1,
    explain: 'น้ำเปล่าเหมาะกว่าสำหรับการดื่มระหว่างวันและช่วยสร้างนิสัยที่ดี'
  },
  {
    id: 'sweet_drink_c2',
    family: 'sweet_drink',
    difficulty: 1,
    stem: 'เวลาหิวน้ำระหว่างเรียน สิ่งไหนเหมาะที่สุด',
    choices: [
      'น้ำเปล่า',
      'น้ำหวานเย็น',
      'ชานม'
    ],
    answerIndex: 0,
    explain: 'เมื่อต้องการคลายกระหาย น้ำเปล่าเป็นตัวเลือกที่เหมาะที่สุด'
  },
  {
    id: 'sweet_drink_c3',
    family: 'sweet_drink',
    difficulty: 2,
    stem: 'มุกดื่มน้ำหวานแทนน้ำเปล่าทุกบ่าย ถ้าอยากปรับนิสัยให้ดีขึ้น ควรเริ่มอย่างไร',
    choices: [
      'เริ่มพกน้ำเปล่าไว้จิบ',
      'ดื่มน้ำหวานเพิ่มขึ้น',
      'งดดื่มทุกอย่าง'
    ],
    answerIndex: 0,
    explain: 'การเริ่มพกน้ำเปล่าเป็นวิธีง่ายและช่วยลดการพึ่งเครื่องดื่มหวาน'
  },
  {
    id: 'sweet_drink_c4',
    family: 'sweet_drink',
    difficulty: 2,
    stem: 'หลังพักเที่ยง ปอนด์หิวน้ำมาก ควรเลือกอะไร',
    choices: [
      'น้ำเปล่า',
      'น้ำอัดลมขวดใหญ่',
      'ชานมหวานมาก'
    ],
    answerIndex: 0,
    explain: 'น้ำเปล่าช่วยคลายกระหายและเหมาะกับการดูแลร่างกายระหว่างวัน'
  },

  // =========================================================
  // FAMILY: school_routine
  // =========================================================
  {
    id: 'school_routine_d1',
    family: 'school_routine',
    difficulty: 1,
    stem: 'วันนี้เรียนยาวตั้งแต่เช้าถึงบ่าย แผนไหนเหมาะที่สุด',
    choices: [
      'ดื่มเช้าครั้งเดียว',
      'พกน้ำและจิบบางช่วง',
      'รอกลับบ้านค่อยดื่ม'
    ],
    answerIndex: 1,
    explain: 'การพกน้ำและจิบเป็นช่วงช่วยให้ทำได้จริงตลอดวันเรียน'
  },
  {
    id: 'school_routine_d2',
    family: 'school_routine',
    difficulty: 1,
    stem: 'ก่อนสอบ มุกไม่อยากเข้าห้องน้ำเลยจึงไม่ดื่มน้ำทั้งเช้า แบบนี้ดีไหม',
    choices: [
      'ดีมาก จะได้ไม่เสียเวลา',
      'ไม่ค่อยดี ควรดื่มพอเหมาะ',
      'ดีถ้าเปลี่ยนเป็นน้ำหวาน'
    ],
    answerIndex: 1,
    explain: 'การดื่มน้ำพอเหมาะสำคัญกว่าการงดน้ำทั้งช่วงเช้า'
  },
  {
    id: 'school_routine_d3',
    family: 'school_routine',
    difficulty: 2,
    stem: 'ถ้ามีเรียนคาบบ่ายต่อเนื่อง เด็กควรเตรียมตัวเรื่องน้ำอย่างไร',
    choices: [
      'พกขวดน้ำและจิบตามช่วง',
      'ดื่มรวดเดียวตอนเย็น',
      'ไม่ต้องพกอะไร'
    ],
    answerIndex: 0,
    explain: 'การพกขวดน้ำช่วยให้เด็กดูแลตัวเองได้สะดวกตลอดวันเรียน'
  },
  {
    id: 'school_routine_d4',
    family: 'school_routine',
    difficulty: 2,
    stem: 'ถ้าเพิ่งกลับจากพักกลางวันและต้องเข้าเรียนต่อ แผนไหนเหมาะกว่า',
    choices: [
      'ดื่มน้ำพอเหมาะแล้วเข้าเรียน',
      'งดดื่มน้ำทั้งบ่าย',
      'ดื่มแต่น้ำหวาน'
    ],
    answerIndex: 0,
    explain: 'หลังพักกลางวัน การดื่มน้ำพอเหมาะช่วยให้พร้อมสำหรับการเรียนต่อ'
  },

  // =========================================================
  // FAMILY: hot_weather
  // =========================================================
  {
    id: 'hot_weather_e1',
    family: 'hot_weather',
    difficulty: 1,
    stem: 'วันนี้อากาศร้อนกว่าปกติ เด็กควรดูแลการดื่มน้ำอย่างไร',
    choices: [
      'รอให้หิวน้ำมากก่อน',
      'ดื่มน้ำสม่ำเสมอมากขึ้น',
      'ดื่มแต่น้ำหวานเย็น'
    ],
    answerIndex: 1,
    explain: 'วันที่อากาศร้อนควรใส่ใจการดื่มน้ำมากขึ้นและดื่มอย่างสม่ำเสมอ'
  },
  {
    id: 'hot_weather_e2',
    family: 'hot_weather',
    difficulty: 1,
    stem: 'หลังเข้าแถวกลางแดด เด็กควรทำสิ่งใดต่อ',
    choices: [
      'ดื่มน้ำเปล่า',
      'ไม่ต้องดื่มอะไร',
      'ดื่มน้ำอัดลมแทน'
    ],
    answerIndex: 0,
    explain: 'หลังอยู่กลางแดด ร่างกายควรได้รับน้ำเพื่อช่วยให้สดชื่นขึ้น'
  },
  {
    id: 'hot_weather_e3',
    family: 'hot_weather',
    difficulty: 2,
    stem: 'วันที่แดดแรงมาก แผนไหนเหมาะที่สุด',
    choices: [
      'พกน้ำและจิบบ่อยขึ้น',
      'ดื่มรวดเดียวตอนเย็น',
      'งดน้ำเพื่อไม่ให้เข้าห้องน้ำ'
    ],
    answerIndex: 0,
    explain: 'เมื่ออากาศร้อน การพกน้ำและจิบบ่อยขึ้นเป็นวิธีที่เหมาะและทำได้จริง'
  },
  {
    id: 'hot_weather_e4',
    family: 'hot_weather',
    difficulty: 2,
    stem: 'ถ้าช่วงบ่ายอากาศร้อนมากและต้องทำกิจกรรมหน้าเสาธง ควรวางแผนอย่างไร',
    choices: [
      'เตรียมน้ำเปล่าไว้ล่วงหน้า',
      'ไม่ต้องเตรียมอะไร',
      'พึ่งแต่น้ำหวานอย่างเดียว'
    ],
    answerIndex: 0,
    explain: 'การเตรียมน้ำเปล่าไว้ล่วงหน้าช่วยให้ดูแลตัวเองได้ดีขึ้นในวันที่อากาศร้อน'
  },

  // =========================================================
  // FAMILY: best_plan
  // =========================================================
  {
    id: 'best_plan_f1',
    family: 'best_plan',
    difficulty: 2,
    stem: 'แผนไหนดีที่สุดสำหรับการดื่มน้ำในวันเรียน',
    choices: [
      'เช้า 1 ครั้ง เย็น 1 ครั้ง',
      'จิบน้ำหลายช่วงทั้งวัน',
      'ดื่มเฉพาะตอนวิ่งเล่น'
    ],
    answerIndex: 1,
    explain: 'แผนที่กระจายน้ำหลายช่วงทั้งวันเหมาะกับการสร้างนิสัยและใช้ได้จริง'
  },
  {
    id: 'best_plan_f2',
    family: 'best_plan',
    difficulty: 2,
    stem: 'แผนไหนเหมาะที่สุดถ้าวันนี้มีเรียน พละ และอากาศร้อน',
    choices: [
      'พกน้ำเปล่าและจิบตามช่วง',
      'ดื่มน้ำหวานตอนบ่าย',
      'รอกลับบ้านค่อยดื่ม'
    ],
    answerIndex: 0,
    explain: 'วันที่ทั้งเรียน พละ และอากาศร้อน ควรพกน้ำแล้วดื่มเป็นช่วงตลอดวัน'
  },
  {
    id: 'best_plan_f3',
    family: 'best_plan',
    difficulty: 2,
    stem: 'แผนใดช่วยสร้างนิสัยการดื่มน้ำได้ดีที่สุด',
    choices: [
      'ดื่มน้ำครั้งเดียวจำนวนมาก',
      'ดื่มน้ำเฉพาะเวลารู้สึกเหนื่อยมาก',
      'ดื่มน้ำเป็นเวลาและทำซ้ำทุกวัน'
    ],
    answerIndex: 2,
    explain: 'การดื่มน้ำเป็นเวลาและทำซ้ำสม่ำเสมอช่วยสร้างนิสัยได้ดีกว่า'
  },
  {
    id: 'best_plan_f4',
    family: 'best_plan',
    difficulty: 2,
    stem: 'ถ้าต้องเลือก 1 แผนสำหรับวันธรรมดา แผนไหนสมดุลที่สุด',
    choices: [
      'เช้า-เที่ยง-บ่าย-เย็น จิบน้ำตามช่วง',
      'ไม่ดื่มตอนเรียน แล้วดื่มรวดเดียว',
      'ดื่มแต่น้ำหวานเวลาง่วง'
    ],
    answerIndex: 0,
    explain: 'แผนที่สมดุลคือแผนที่ดื่มน้ำตามช่วงต่าง ๆ ของวันและทำได้จริง'
  }
];

export async function openScenarios(rootEl, state = {}, opts = {}) {
  const count = Math.max(1, Number(opts.count || 2));
  const randomFn = typeof opts.randomFn === 'function' ? opts.randomFn : Math.random;
  const pid = String(state.pid || 'anon').trim() || 'anon';
  const studyId = String(state.studyId || 'nostudy').trim() || 'nostudy';
  const run = String(state.run || 'play');
  const weekNo = positiveInt(state.weekNo) || 1;
  const sessionNo = positiveInt(state.sessionNo) || 1;

  if (!rootEl) {
    return {
      correctCount: 0,
      wrongCount: 0,
      knowledgeDelta: 0,
      summary: 'ยังไม่มีผล'
    };
  }

  const picked = pickScenarioSet({
    count,
    run,
    weekNo,
    sessionNo,
    pid,
    studyId,
    randomFn
  }).map(item => prepareScenario(item, randomFn));

  if (!picked.length) {
    return {
      correctCount: 0,
      wrongCount: 0,
      knowledgeDelta: 0,
      summary: 'ยังไม่มีผล'
    };
  }

  return new Promise((resolve) => {
    let cursor = 0;
    const answers = [];

    function showRoot() {
      rootEl.classList.add('show');
      rootEl.setAttribute('aria-hidden', 'false');
    }

    function hideRoot() {
      rootEl.classList.remove('show');
      rootEl.setAttribute('aria-hidden', 'true');
      rootEl.innerHTML = '';
    }

    function renderQuestion() {
      const q = picked[cursor];
      const meta = FAMILY_META[q.family] || { label: q.family, emoji: '💧' };

      rootEl.innerHTML = `
        <div class="overlay-card">
          <div class="overlay-kicker">Scenarios • ${cursor + 1}/${picked.length}</div>
          <h2>${escapeHtml(meta.emoji)} ${escapeHtml(meta.label)}</h2>
          <p>
            อ่านสถานการณ์ แล้วเลือกคำตอบที่เหมาะที่สุด
          </p>

          <div class="result-box">
            <strong>สถานการณ์</strong><br/>
            ${escapeHtml(q.stem)}
          </div>

          <div style="display:grid; gap:10px; margin-top:14px;">
            ${q.shuffledChoices.map((choice, idx) => `
              <button
                class="btn ghost scenario-choice"
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

      rootEl.querySelectorAll('.scenario-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          const choiceIndex = Number(btn.dataset.choiceIndex || -1);
          onAnswer(choiceIndex);
        });
      });
    }

    function onAnswer(choiceIndex) {
      const q = picked[cursor];
      const chosen = q.shuffledChoices[choiceIndex];
      const isCorrect = choiceIndex === q.answerIndex;

      answers.push({
        id: q.id,
        family: q.family,
        correct: isCorrect
      });

      const meta = FAMILY_META[q.family] || { label: q.family, emoji: '💧' };

      rootEl.innerHTML = `
        <div class="overlay-card">
          <div class="overlay-kicker">Scenarios • ${cursor + 1}/${picked.length}</div>
          <h2>${isCorrect ? 'ตอบถูกแล้ว ✅' : 'ยังไม่ถูก ✨'}</h2>

          <div class="result-box">
            <strong>${escapeHtml(meta.emoji)} ${escapeHtml(meta.label)}</strong><br/><br/>
            <strong>สถานการณ์:</strong> ${escapeHtml(q.stem)}<br/><br/>
            <strong>คำตอบที่เลือก:</strong> ${escapeHtml(chosen?.text || '-')}<br/>
            <strong>คำตอบที่เหมาะที่สุด:</strong> ${escapeHtml(q.shuffledChoices[q.answerIndex]?.text || '-')}<br/><br/>
            <strong>เหตุผล:</strong> ${escapeHtml(q.explain)}
          </div>

          <div class="overlay-actions">
            <button class="btn primary" id="scenarioNextBtn" type="button">
              ${cursor + 1 < picked.length ? 'ข้อต่อไป' : 'สรุปผล'}
            </button>
          </div>
        </div>
      `;

      rootEl.querySelector('#scenarioNextBtn')?.addEventListener('click', () => {
        cursor += 1;
        if (cursor < picked.length) {
          renderQuestion();
        } else {
          finish();
        }
      });
    }

    function finish() {
      const correctCount = answers.filter(a => a.correct).length;
      const wrongCount = answers.length - correctCount;
      const knowledgeDelta = computeKnowledgeDelta(correctCount, picked.length);
      const summary = buildSummaryText(correctCount, picked.length);

      saveSeenHistory({
        pid,
        studyId,
        weekNo,
        sessionNo,
        ids: picked.map(x => x.id)
      });

      rootEl.innerHTML = `
        <div class="overlay-card">
          <div class="overlay-kicker">Scenarios • Complete</div>
          <h2>สรุปผลสถานการณ์</h2>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">ตอบถูก</div>
              <div class="summary-main">${correctCount}</div>
              <div class="summary-sub">จาก ${picked.length} ข้อ</div>
            </div>

            <div class="summary-card">
              <div class="summary-label">Knowledge Score</div>
              <div class="summary-main">${knowledgeDelta}</div>
              <div class="summary-sub">ได้จากการตอบสถานการณ์</div>
            </div>
          </div>

          <div class="result-box">
            <strong>สรุป:</strong> ${escapeHtml(summary)}<br/><br/>
            ${answers.map((a, idx) => {
              const item = picked.find(x => x.id === a.id);
              const meta = FAMILY_META[item?.family] || { emoji: '💧', label: item?.family || '-' };
              return `ข้อ ${idx + 1}: ${escapeHtml(meta.emoji)} ${escapeHtml(meta.label)} • ${a.correct ? 'ถูก ✅' : 'ยังไม่ถูก ✨'}`;
            }).join('<br/>')}
          </div>

          <div class="overlay-actions">
            <button class="btn primary" id="scenarioDoneBtn" type="button">ไปต่อ</button>
          </div>
        </div>
      `;

      rootEl.querySelector('#scenarioDoneBtn')?.addEventListener('click', () => {
        hideRoot();
        resolve({
          correctCount,
          wrongCount,
          knowledgeDelta,
          summary,
          pickedIds: picked.map(x => x.id),
          families: picked.map(x => x.family)
        });
      });
    }

    renderQuestion();
  });
}

function computeKnowledgeDelta(correctCount, totalCount) {
  let score = correctCount * 8;
  if (totalCount >= 2 && correctCount === totalCount) score += 4;
  return Math.max(0, score);
}

function buildSummaryText(correctCount, totalCount) {
  if (correctCount === totalCount) return 'ตอบสถานการณ์ได้ครบทุกข้อ';
  if (correctCount > 0) return `ตอบสถานการณ์ถูก ${correctCount}/${totalCount} ข้อ`;
  return 'ยังไม่ผ่านทุกข้อ ลองอ่านเหตุผลแล้วเล่นต่ออีกนิด';
}

function prepareScenario(item, randomFn) {
  const entries = item.choices.map((text, originalIndex) => ({
    text,
    originalIndex
  }));

  const shuffledChoices = shuffleArray(entries, randomFn);
  const answerIndex = shuffledChoices.findIndex(x => x.originalIndex === item.answerIndex);

  return {
    ...item,
    shuffledChoices,
    answerIndex
  };
}

function pickScenarioSet({
  count = 2,
  run = 'play',
  weekNo = 1,
  sessionNo = 1,
  pid = 'anon',
  studyId = 'nostudy',
  randomFn = Math.random
} = {}) {
  const seen = readSeenHistory(pid, studyId);
  const recentSet = new Set(seen.recent || []);

  let families = run === 'research'
    ? chooseResearchFamilies(weekNo, sessionNo, count)
    : choosePlayFamilies(count, randomFn);

  const picked = [];
  const usedIds = new Set();

  for (const family of families) {
    const item = pickOneFromFamily({
      family,
      recentSet,
      usedIds,
      randomFn
    });

    if (item) {
      picked.push(item);
      usedIds.add(item.id);
    }
  }

  if (picked.length < count) {
    const leftovers = SCENARIO_BANK.filter(item => !usedIds.has(item.id));

    const preferred = leftovers.filter(item => !recentSet.has(item.id));
    const fallback = preferred.length ? preferred : leftovers;

    const shuffled = shuffleArray(fallback, randomFn);

    for (const item of shuffled) {
      if (picked.length >= count) break;
      if (usedIds.has(item.id)) continue;
      picked.push(item);
      usedIds.add(item.id);
    }
  }

  return picked.slice(0, count);
}

function chooseResearchFamilies(weekNo, sessionNo, count) {
  const idx = Math.max(0, ((weekNo - 1) * 2 + (sessionNo - 1))) % RESEARCH_FAMILY_SETS.length;
  const base = [...RESEARCH_FAMILY_SETS[idx]];
  const all = Object.keys(FAMILY_META);

  for (const family of all) {
    if (base.length >= count) break;
    if (!base.includes(family)) base.push(family);
  }

  return base.slice(0, count);
}

function choosePlayFamilies(count, randomFn) {
  const families = shuffleArray(Object.keys(FAMILY_META), randomFn);
  return families.slice(0, count);
}

function pickOneFromFamily({
  family,
  recentSet,
  usedIds,
  randomFn
} = {}) {
  const pool = SCENARIO_BANK.filter(item => item.family === family && !usedIds.has(item.id));
  if (!pool.length) return null;

  const preferred = pool.filter(item => !recentSet.has(item.id));
  const finalPool = preferred.length ? preferred : pool;
  return pickRandom(finalPool, randomFn);
}

function readSeenHistory(pid, studyId) {
  const key = buildSeenKey(pid, studyId);
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

function saveSeenHistory({
  pid,
  studyId,
  weekNo,
  sessionNo,
  ids = []
} = {}) {
  const key = buildSeenKey(pid, studyId);
  const history = readSeenHistory(pid, studyId);
  const sessionKey = `W${weekNo}S${sessionNo}`;

  const dedupIds = [...new Set(ids.filter(Boolean))];

  history.bySession[sessionKey] = dedupIds;
  history.recent = [
    ...dedupIds,
    ...(history.recent || []).filter(id => !dedupIds.includes(id))
  ].slice(0, SEEN_RECENT_LIMIT);

  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch (_) {}
}

function buildSeenKey(pid, studyId) {
  const safePid = String(pid || 'anon').trim() || 'anon';
  const safeStudyId = String(studyId || 'nostudy').trim() || 'nostudy';
  return `HHA_HYD_V2_SEEN_ITEMS:${safePid}:${safeStudyId}`;
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