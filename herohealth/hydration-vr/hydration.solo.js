export async function createHydrationSoloAdapter(ctx, shell) {
  let root;
  let score = 0;
  let miss = 0;
  let solved = 0;
  let bestStreak = 0;
  let streak = 0;
  const total = 8;

  const SCENARIOS = [
    {
      id: 'after-play',
      prompt: 'หลังวิ่งเล่นกลางแดด ควรเลือกอะไร?',
      choices: [
        { id: 'water', label: 'ดื่มน้ำเปล่า', ok: true },
        { id: 'soda', label: 'น้ำอัดลมหวานจัด', ok: false },
        { id: 'skip', label: 'ไม่ต้องดื่มอะไร', ok: false }
      ],
      tip: 'หลังเสียเหงื่อ ร่างกายควรได้ดื่มน้ำเพื่อทดแทน'
    },
    {
      id: 'morning',
      prompt: 'ตื่นนอนตอนเช้า ควรเริ่มอย่างไร?',
      choices: [
        { id: 'water', label: 'จิบน้ำ 1 แก้ว', ok: true },
        { id: 'candy', label: 'กินลูกอมก่อน', ok: false },
        { id: 'none', label: 'ไม่ต้องดื่ม', ok: false }
      ],
      tip: 'การจิบน้ำตอนเช้าช่วยเริ่มวันได้ดีขึ้น'
    },
    {
      id: 'classroom',
      prompt: 'อยู่ในห้องเรียนทั้งเช้า ควรทำอะไร?',
      choices: [
        { id: 'sip', label: 'จิบน้ำเป็นระยะ', ok: true },
        { id: 'wait', label: 'รอเย็นค่อยดื่มทีเดียว', ok: false },
        { id: 'tea', label: 'ดื่มชาหวานแทนน้ำเสมอ', ok: false }
      ],
      tip: 'การจิบน้ำเป็นระยะช่วยให้ดื่มได้เพียงพอกว่า'
    },
    {
      id: 'sports-day',
      prompt: 'วันกีฬาสีอากาศร้อน ควรเลือกแบบไหน?',
      choices: [
        { id: 'carry', label: 'พกขวดน้ำติดตัว', ok: true },
        { id: 'ignore', label: 'ไม่จำเป็นต้องพกน้ำ', ok: false },
        { id: 'sugar', label: 'เลือกแต่น้ำหวานอย่างเดียว', ok: false }
      ],
      tip: 'เมื่ออากาศร้อน ควรเข้าถึงน้ำได้ง่าย'
    },
    {
      id: 'thirsty',
      prompt: 'เริ่มรู้สึกคอแห้ง ควรทำอย่างไร?',
      choices: [
        { id: 'drink', label: 'หยุดพักแล้วดื่มน้ำ', ok: true },
        { id: 'push', label: 'ฝืนทำต่อโดยไม่ดื่ม', ok: false },
        { id: 'snack', label: 'กินขนมเค็มแทน', ok: false }
      ],
      tip: 'เมื่อเริ่มกระหายน้ำ ควรรีบดื่มน้ำ'
    },
    {
      id: 'lunch',
      prompt: 'ช่วงกลางวัน ทางเลือกไหนดี?',
      choices: [
        { id: 'water-meal', label: 'ดื่มน้ำคู่มื้ออาหาร', ok: true },
        { id: 'skip-water', label: 'ไม่ดื่มอะไรเลย', ok: false },
        { id: 'sweet-only', label: 'ดื่มแต่เครื่องดื่มหวานจัด', ok: false }
      ],
      tip: 'ดื่มน้ำกับมื้ออาหารช่วยเพิ่มโอกาสได้รับน้ำเพียงพอ'
    },
    {
      id: 'bottle',
      prompt: 'อยากดื่มน้ำให้พอทั้งวัน ควรทำแบบไหน?',
      choices: [
        { id: 'plan', label: 'เตรียมขวดน้ำไว้ใกล้ตัว', ok: true },
        { id: 'guess', label: 'ปล่อยตามใจโดยไม่เตรียม', ok: false },
        { id: 'late', label: 'ค่อยดื่มทีเดียวก่อนนอน', ok: false }
      ],
      tip: 'การเตรียมน้ำไว้ใกล้ตัวช่วยให้ดื่มได้สม่ำเสมอ'
    },
    {
      id: 'evening',
      prompt: 'หลังเลิกเรียนควรเลือกอะไรเพื่อดูแล hydration?',
      choices: [
        { id: 'refill', label: 'เติมน้ำก่อนกลับบ้าน', ok: true },
        { id: 'skip', label: 'ไม่ต้องดื่มเพราะใกล้กลับบ้านแล้ว', ok: false },
        { id: 'fizzy', label: 'ดื่มน้ำอัดลมแทนน้ำเสมอ', ok: false }
      ],
      tip: 'การเติมน้ำช่วงเย็นช่วยให้สมดุลทั้งวันดีขึ้น'
    }
  ];

  let queue = [];
  let current = null;

  function nextScenario() {
    if (queue.length === 0) {
      queue = shell.rng.shuffle(SCENARIOS).slice(0, total);
    }
    current = queue.shift() || null;
    renderCard();
  }

  function handleChoice(choiceId) {
    if (!current) return;
    const choice = current.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    const ok = !!choice.ok;
    if (ok) {
      solved += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      score += 100;
      shell.setScore(score);
      shell.setMission(solved, total);
    } else {
      miss += 1;
      streak = 0;
      score = Math.max(0, score - 25);
      shell.setScore(score);
    }

    shell.emit('hydration_solo_answer', {
      scenarioId: current.id,
      picked: choice.id,
      correct: ok,
      score,
      solved,
      miss
    });

    showTip(ok ? 'ดีมาก!' : 'ลองใหม่ได้', current.tip);

    if (solved >= total) {
      window.setTimeout(() => shell.endGame(buildSummary(true)), 350);
      return;
    }

    window.setTimeout(nextScenario, 380);
  }

  function buildSummary(success = false) {
    const accuracy = solved + miss > 0 ? Math.round((solved / (solved + miss)) * 100) : 0;
    const stars = solved >= total && miss <= 1 ? 3 : solved >= Math.ceil(total * 0.75) ? 2 : 1;
    return {
      success,
      stars,
      accuracy,
      miss,
      bestStreak,
      rewards: success ? ['hydration-solo-clear'] : ['hydration-solo-try'],
      coachFeedback: success
        ? ['ตัดสินใจเรื่องการดื่มน้ำได้ดีมาก', 'เริ่มวางพฤติกรรม hydration ได้ถูกทางแล้ว']
        : ['ลองเลือกทางที่ช่วยให้ดื่มน้ำสม่ำเสมอมากขึ้น'],
      nextAction: success
        ? 'ลองโหมด duet เพื่อช่วยกันวางแผนการดื่มน้ำ'
        : 'เล่นอีกครั้งและลดการเลือกทางที่ทำให้ขาดน้ำ',
      metrics: { solved, total, miss, score }
    };
  }

  function renderCard() {
    const card = root?.querySelector('[data-role="card"]');
    if (!card) return;
    if (!current) {
      card.innerHTML = '<div class="hyd-empty">กำลังเตรียมสถานการณ์...</div>';
      return;
    }

    card.innerHTML = `
      <div class="hyd-kicker">Hydration Scenario</div>
      <div class="hyd-prompt">${escapeHtml(current.prompt)}</div>
      <div class="hyd-choices">
        ${current.choices.map((choice) => `
          <button class="hyd-btn" data-choice="${choice.id}">${escapeHtml(choice.label)}</button>
        `).join('')}
      </div>
    `;

    card.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => handleChoice(btn.getAttribute('data-choice')));
    });
  }

  function showTip(title, text) {
    const tip = root?.querySelector('[data-role="tip"]');
    if (!tip) return;
    tip.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
  }

  return {
    async mount(stage) {
      root = document.createElement('div');
      root.className = 'hyd-solo-root';
      root.innerHTML = `
        <style>
          .hyd-solo-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto 1fr auto}
          .hyd-hero,.hyd-tip{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .hyd-hero h2{margin:0 0 8px;font-size:28px}.hyd-hero p{margin:0;color:#d7e5ff}
          .hyd-card{display:grid;place-items:center;padding:24px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center;min-height:420px}
          .hyd-kicker{font-size:13px;letter-spacing:.16em;color:#bed2f1;text-transform:uppercase;margin-bottom:12px}
          .hyd-prompt{font-size:34px;font-weight:800;line-height:1.25;margin-bottom:18px;max-width:760px}
          .hyd-choices{display:grid;gap:12px;grid-template-columns:1fr;max-width:720px;width:100%}
          .hyd-btn{min-height:74px;padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.14);background:rgba(10,24,52,.92);color:#eef5ff;font:inherit;font-size:18px;font-weight:700;cursor:pointer}
          .hyd-tip{display:flex;gap:10px;flex-direction:column}.hyd-tip span{color:#dce9ff}.hyd-empty{font-size:20px;color:#dce9ff}
        </style>
        <section class="hyd-hero">
          <h2>Hydration Solo</h2>
          <p>เลือกการดูแลการดื่มน้ำที่เหมาะสมในแต่ละสถานการณ์</p>
        </section>
        <section class="hyd-card" data-role="card"></section>
        <section class="hyd-tip" data-role="tip"><strong>Coach</strong><span>เลือกคำตอบที่ช่วยให้ร่างกายได้รับน้ำอย่างเหมาะสม</span></section>
      `;
      stage.appendChild(root);
      renderCard();
    },

    async start() {
      score = 0;
      miss = 0;
      solved = 0;
      bestStreak = 0;
      streak = 0;
      queue = shell.rng.shuffle(SCENARIOS).slice(0, total);
      shell.setScore(0);
      shell.setMission(0, total);
      nextScenario();
      shell.emit('hydration_solo_start', { total });
    },

    async pause() {},
    async resume() {},

    tick(timeLeft) {
      if (timeLeft <= 0) {
        shell.endGame(buildSummary(solved >= Math.ceil(total * 0.7)));
      }
    },

    getSummary() {
      return buildSummary(solved >= Math.ceil(total * 0.7));
    }
  };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}