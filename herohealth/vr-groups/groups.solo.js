export async function createGroupsSoloAdapter(ctx, shell) {
  let root;
  let score = 0;
  let miss = 0;
  let bestStreak = 0;
  let streak = 0;
  let solved = 0;
  const total = 8;

  const FOODS = [
    { id: 'apple', label: 'Apple', group: 'fruit' },
    { id: 'banana', label: 'Banana', group: 'fruit' },
    { id: 'carrot', label: 'Carrot', group: 'vegetable' },
    { id: 'broccoli', label: 'Broccoli', group: 'vegetable' },
    { id: 'egg', label: 'Egg', group: 'protein' },
    { id: 'milk', label: 'Milk', group: 'protein' },
    { id: 'rice', label: 'Rice', group: 'carb' },
    { id: 'bread', label: 'Bread', group: 'carb' },
    { id: 'avocado', label: 'Avocado', group: 'fat' },
    { id: 'nuts', label: 'Nuts', group: 'fat' }
  ];

  const GROUPS = [
    { id: 'protein', label: 'หมู่ 1 โปรตีน' },
    { id: 'carb', label: 'หมู่ 2 คาร์โบไฮเดรต' },
    { id: 'vegetable', label: 'หมู่ 3 ผัก' },
    { id: 'fruit', label: 'หมู่ 4 ผลไม้' },
    { id: 'fat', label: 'หมู่ 5 ไขมัน' }
  ];

  let queue = [];
  let current = null;

  function nextItem() {
    if (queue.length === 0) {
      queue = shell.rng.shuffle(FOODS).slice(0, total);
    }
    current = queue.shift() || null;
    renderCard();
  }

  function markCorrect(groupId) {
    if (!current) return;

    const ok = groupId === current.group;
    if (ok) {
      solved += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      score += 100;
      shell.setScore(score);
      shell.setMission(solved, total);
      shell.emit('groups_answer', {
        correct: true,
        itemId: current.id,
        expectedGroup: current.group,
        pickedGroup: groupId,
        score,
        solved,
        total
      });
    } else {
      miss += 1;
      streak = 0;
      score = Math.max(0, score - 25);
      shell.setScore(score);
      shell.emit('groups_answer', {
        correct: false,
        itemId: current.id,
        expectedGroup: current.group,
        pickedGroup: groupId,
        score,
        miss
      });
    }

    if (solved >= total) {
      shell.endGame(buildSummary(true));
      return;
    }

    nextItem();
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
      rewards: success ? ['groups-solo-clear'] : ['groups-solo-try'],
      coachFeedback: success
        ? ['จัดหมวดอาหารได้ถูกต้องดีมาก', 'เริ่มจำหมวดอาหารหลักได้แม่นขึ้นแล้ว']
        : ['ลองสังเกตว่าอาหารแต่ละชนิดอยู่ในหมู่ไหนให้มากขึ้น'],
      nextAction: success
        ? 'ลองโหมด race เพื่อฝึกความเร็วในการแยกหมวดอาหาร'
        : 'เล่นอีกครั้งและพยายามทำให้ miss น้อยลง',
      metrics: {
        solved,
        total,
        miss,
        score
      }
    };
  }

  function renderCard() {
    if (!root) return;
    const card = root.querySelector('[data-role="card"]');
    if (!card) return;

    if (!current) {
      card.innerHTML = `<div class="groups-empty">เตรียมโจทย์...</div>`;
      return;
    }

    card.innerHTML = `
      <div class="groups-prompt">อาหารนี้อยู่หมู่ไหน?</div>
      <div class="groups-item">${escapeHtml(current.label)}</div>
      <div class="groups-sub">เลือกหมวดที่ถูกต้อง</div>
    `;
  }

  function attachHandlers() {
    root.querySelectorAll('[data-group]').forEach((btn) => {
      btn.addEventListener('click', () => {
        markCorrect(btn.getAttribute('data-group'));
      });
    });
  }

  return {
    async mount(stage) {
      root = document.createElement('div');
      root.className = 'groups-solo-root';
      root.innerHTML = `
        <style>
          .groups-solo-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto 1fr}
          .groups-hero{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .groups-hero h2{margin:0 0 8px;font-size:28px}
          .groups-hero p{margin:0;color:#d7e5ff}
          .groups-board{display:grid;gap:16px;grid-template-columns:1.1fr .9fr;min-height:420px}
          .groups-card{display:grid;place-items:center;padding:22px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center}
          .groups-prompt{font-size:18px;color:#c4d6f4;margin-bottom:12px}
          .groups-item{font-size:40px;font-weight:800;margin-bottom:10px}
          .groups-sub{font-size:16px;color:#dce9ff}
          .groups-empty{font-size:20px;color:#dce9ff}
          .groups-grid{display:grid;gap:12px;grid-template-columns:1fr 1fr}
          .groups-btn{min-height:88px;padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.14);background:rgba(10,24,52,.92);color:#eef5ff;font:inherit;font-size:17px;font-weight:700;cursor:pointer}
          .groups-btn:hover{transform:translateY(-1px)}
          @media (max-width:900px){.groups-board{grid-template-columns:1fr}.groups-grid{grid-template-columns:1fr}}
        </style>
        <section class="groups-hero">
          <h2>Food Groups Solo</h2>
          <p>เลือกหมวดอาหารให้ถูกต้อง ฝึกจำ 5 หมู่แบบสนุกและเข้าใจง่าย</p>
        </section>
        <section class="groups-board">
          <div class="groups-card" data-role="card"></div>
          <div class="groups-grid">
            ${GROUPS.map((g) => `<button class="groups-btn" data-group="${g.id}">${escapeHtml(g.label)}</button>`).join('')}
          </div>
        </section>
      `;
      stage.appendChild(root);
      attachHandlers();
      renderCard();
    },

    async start() {
      score = 0;
      miss = 0;
      bestStreak = 0;
      streak = 0;
      solved = 0;
      queue = shell.rng.shuffle(FOODS).slice(0, total);
      shell.setScore(0);
      shell.setMission(0, total);
      nextItem();
      shell.emit('groups_solo_start', { total });
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