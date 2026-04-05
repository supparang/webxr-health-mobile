import {
  createDuetRoom,
  joinDuet,
  readyDuet,
  beginDuet,
  startDuet,
  submitDuetContribution,
  finishDuet
} from '../shared/modes/duet-core.js';

export async function createGroupsDuetAdapter(ctx, shell) {
  let root;
  let room = null;
  const selfId = ctx.pid || 'anon';

  let score = 0;
  let miss = 0;
  let solved = 0;
  let bestStreak = 0;
  let streak = 0;
  let countdownLeft = 3;
  let countdownId = 0;

  const total = 10;
  const pairGoal = 10;

  const FOODS = [
    { id: 'apple', label: 'Apple', group: 'fruit' },
    { id: 'banana', label: 'Banana', group: 'fruit' },
    { id: 'orange', label: 'Orange', group: 'fruit' },
    { id: 'broccoli', label: 'Broccoli', group: 'vegetable' },
    { id: 'carrot', label: 'Carrot', group: 'vegetable' },
    { id: 'pumpkin', label: 'Pumpkin', group: 'vegetable' },
    { id: 'egg', label: 'Egg', group: 'protein' },
    { id: 'milk', label: 'Milk', group: 'protein' },
    { id: 'fish', label: 'Fish', group: 'protein' },
    { id: 'rice', label: 'Rice', group: 'carb' },
    { id: 'bread', label: 'Bread', group: 'carb' },
    { id: 'corn', label: 'Corn', group: 'carb' },
    { id: 'oil', label: 'Oil', group: 'fat' },
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

  function buildRoom() {
    room = createDuetRoom({
      gameId: 'groups',
      hostPlayer: { playerId: selfId, pid: ctx.pid, name: ctx.name || 'Player' },
      diff: ctx.diff,
      timeLimit: ctx.time,
      seed: ctx.seed,
      meta: { pairGoal }
    });

    joinDuet(room, { playerId: 'cpu-partner', pid: 'cpu-partner', name: 'Partner', ready: true });
    readyDuet(room, selfId, true);
    readyDuet(room, 'cpu-partner', true);
    beginDuet(room, 2500);
    renderLobbyState('พร้อมเริ่มเล่นเป็นคู่');
  }

  function startCountdownOverlay() {
    const overlay = root.querySelector('[data-role="countdown"]');
    countdownLeft = 3;
    overlay.classList.remove('groups-hidden');
    overlay.textContent = String(countdownLeft);

    countdownId = window.setInterval(() => {
      countdownLeft -= 1;
      if (countdownLeft > 0) {
        overlay.textContent = String(countdownLeft);
        return;
      }
      clearInterval(countdownId);
      overlay.textContent = 'GO!';
      window.setTimeout(() => overlay.classList.add('groups-hidden'), 450);
      startDuet(room);
      nextItem();
      shell.emit('groups_duet_start', { roomId: room.roomId, matchId: room.matchId, pairGoal });
    }, 800);
  }

  function renderLobbyState(text) {
    const el = root?.querySelector('[data-role="lobbyState"]');
    if (el) el.textContent = text || '';
  }

  function nextItem() {
    if (queue.length === 0) {
      queue = shell.rng.shuffle(FOODS).slice(0, Math.max(1, total - solved));
    }
    current = queue.shift() || null;
    renderCard();
  }

  function renderCard() {
    const card = root?.querySelector('[data-role="card"]');
    if (!card) return;

    if (!current) {
      card.innerHTML = '<div class="groups-empty">กำลังเตรียมโจทย์...</div>';
      return;
    }

    card.innerHTML = `
      <div class="groups-prompt">เล่นเป็นคู่ ช่วยกันทำเป้าหมายให้ครบ</div>
      <div class="groups-item">${escapeHtml(current.label)}</div>
      <div class="groups-sub">ทำ pair goal ให้ครบ ${pairGoal} ข้อ</div>
    `;
  }

  function updateBoard() {
    const you = room.players.find((p) => p.playerId === selfId);
    const partner = room.players.find((p) => p.playerId === 'cpu-partner');

    const teamScore = room.teamScore || 0;
    const pct = Math.round((teamScore / pairGoal) * 100);

    const pairBar = root.querySelector('[data-role="pairBar"]');
    const pairMeta = root.querySelector('[data-role="pairMeta"]');
    const youMeta = root.querySelector('[data-role="youMeta"]');
    const partnerMeta = root.querySelector('[data-role="partnerMeta"]');

    if (pairBar) pairBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (pairMeta) pairMeta.textContent = `${teamScore}/${pairGoal}`;
    if (youMeta) youMeta.textContent = `คะแนน ${you?.score || 0} • ช่วยคู่ ${you?.contribution || 0}`;
    if (partnerMeta) partnerMeta.textContent = `คะแนน ${partner?.score || 0} • ช่วยคู่ ${partner?.contribution || 0}`;
  }

  function partnerAutoHelp() {
    if (!room || room.status !== 'playing') return;
    const partner = room.players.find((p) => p.playerId === 'cpu-partner');
    if (!partner) return;

    const chance = ctx.diff === 'hard' ? 0.42 : ctx.diff === 'easy' ? 0.7 : 0.55;
    if (!shell.rng.chance(chance)) return;

    const add = 1;
    const nextContribution = Number(partner.contribution || 0) + add;
    const nextScore = Number(partner.score || 0) + 90;

    submitDuetContribution(room, 'cpu-partner', {
      score: nextScore,
      contribution: nextContribution,
      progress: nextContribution,
      bestStreak: Number(partner.bestStreak || 0) + 1,
      miss: Number(partner.miss || 0)
    });

    if ((room.teamScore || 0) >= pairGoal) {
      shell.endGame(buildSummary());
      return;
    }

    updateBoard();
  }

  function handleAnswer(groupId) {
    if (!current || room.status !== 'playing') return;

    const ok = groupId === current.group;
    if (ok) {
      solved += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      score += 100;
      shell.setScore(score);
    } else {
      miss += 1;
      streak = 0;
      score = Math.max(0, score - 18);
      shell.setScore(score);
    }

    submitDuetContribution(room, selfId, {
      score,
      contribution: solved,
      progress: solved,
      bestStreak,
      miss
    });

    shell.setMission(room.teamScore || 0, pairGoal);
    shell.emit('groups_duet_answer', {
      correct: ok,
      itemId: current.id,
      expectedGroup: current.group,
      pickedGroup: groupId,
      score,
      solved,
      pairScore: room.teamScore || 0,
      pairGoal,
      roomId: room.roomId
    });

    updateBoard();

    if ((room.teamScore || 0) >= pairGoal) {
      shell.endGame(buildSummary());
      return;
    }

    nextItem();
    partnerAutoHelp();
  }

  function buildSummary() {
    finishDuet(room, { success: Number(room.teamScore || 0) >= pairGoal, pairGoal });
    const you = room.players.find((p) => p.playerId === selfId);
    const partner = room.players.find((p) => p.playerId === 'cpu-partner');
    const accuracy = solved + miss > 0 ? Math.round((solved / (solved + miss)) * 100) : 0;
    const success = Number(room.teamScore || 0) >= pairGoal;

    return {
      success,
      stars: success ? (miss <= 1 ? 3 : 2) : 1,
      accuracy,
      miss,
      bestStreak,
      contribution: you?.contribution || solved,
      teamResult: {
        success,
        pairGoal,
        teamScore: room.teamScore || 0,
        players: [
          { name: you?.name || 'You', contribution: you?.contribution || 0, score: you?.score || 0 },
          { name: partner?.name || 'Partner', contribution: partner?.contribution || 0, score: partner?.score || 0 }
        ]
      },
      rewards: success ? ['groups-duet-clear', 'pair-player'] : ['groups-duet-finish'],
      coachFeedback: success
        ? ['จับคู่กันแยกหมวดอาหารได้ดีมาก', 'จังหวะการเล่นเป็นคู่ลื่นไหลดี']
        : ['ลองเล่นให้จังหวะตรงกันมากขึ้นและลดการตอบผิด'],
      nextAction: success
        ? 'ลองโหมด battle ในลำดับถัดไป'
        : 'เล่น duet อีกครั้งเพื่อเพิ่ม pair score ให้ถึงเป้าหมาย',
      metrics: {
        solved,
        pairScore: room.teamScore || 0,
        pairGoal,
        miss,
        roomId: room.roomId,
        matchId: room.matchId
      }
    };
  }

  function attachHandlers() {
    root.querySelectorAll('[data-group]').forEach((btn) => {
      btn.addEventListener('click', () => handleAnswer(btn.getAttribute('data-group')));
    });

    const readyBtn = root.querySelector('[data-action="duetReady"]');
    if (readyBtn) {
      readyBtn.addEventListener('click', () => {
        renderLobbyState('กำลังเริ่มเล่นแบบคู่...');
        readyBtn.disabled = true;
        startCountdownOverlay();
      });
    }
  }

  return {
    async mount(stage) {
      root = document.createElement('div');
      root.className = 'groups-duet-root';
      root.innerHTML = `
        <style>
          .groups-duet-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr;position:relative}
          .groups-panel{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .groups-panel h2{margin:0 0 8px;font-size:28px}.groups-panel p{margin:0;color:#d7e5ff}
          .groups-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
          .groups-cta{padding:12px 16px;border:none;border-radius:999px;background:linear-gradient(180deg,#5be38b,#2cc267);color:#072112;font:inherit;font-weight:800;cursor:pointer}
          .groups-pair{display:grid;gap:12px;grid-template-columns:1.2fr .8fr .8fr}
          .groups-track{padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
          .groups-track-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700}
          .groups-track-rail{height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
          .groups-track-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#56de84,#ffd24a);width:0%}
          .groups-mini{padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
          .groups-mini strong{display:block;margin-bottom:6px}
          .groups-board{display:grid;gap:16px;grid-template-columns:1.05fr .95fr;min-height:400px}
          .groups-card{display:grid;place-items:center;padding:22px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center}
          .groups-grid{display:grid;gap:12px;grid-template-columns:1fr 1fr}
          .groups-btn{min-height:84px;padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.14);background:rgba(10,24,52,.92);color:#eef5ff;font:inherit;font-size:17px;font-weight:700;cursor:pointer}
          .groups-prompt{font-size:18px;color:#c4d6f4;margin-bottom:12px}.groups-item{font-size:38px;font-weight:800;margin-bottom:10px}.groups-sub{font-size:16px;color:#dce9ff}
          .groups-countdown{position:absolute;inset:0;display:grid;place-items:center;font-size:80px;font-weight:900;background:rgba(3,8,20,.72);backdrop-filter:blur(10px);z-index:5}
          .groups-hidden{display:none!important}.groups-empty{font-size:20px;color:#dce9ff}
          @media (max-width:980px){.groups-pair,.groups-board{grid-template-columns:1fr}.groups-grid{grid-template-columns:1fr}}
        </style>
        <section class="groups-panel">
          <h2>Food Groups Duet</h2>
          <p>เล่นเป็นคู่และช่วยกันจัดหมวดอาหารให้ครบตาม pair goal</p>
          <div class="groups-actions">
            <button class="groups-cta" data-action="duetReady">Ready Pair</button>
            <span data-role="lobbyState">รอเริ่มเล่นเป็นคู่</span>
          </div>
        </section>
        <section class="groups-pair">
          <div class="groups-track">
            <div class="groups-track-head"><span>Pair Goal</span><span data-role="pairMeta">0/${pairGoal}</span></div>
            <div class="groups-track-rail"><div class="groups-track-fill" data-role="pairBar"></div></div>
          </div>
          <div class="groups-mini"><strong>You</strong><span data-role="youMeta">คะแนน 0 • ช่วยคู่ 0</span></div>
          <div class="groups-mini"><strong>Partner</strong><span data-role="partnerMeta">คะแนน 0 • ช่วยคู่ 0</span></div>
        </section>
        <section class="groups-board">
          <div class="groups-card" data-role="card"></div>
          <div class="groups-grid">
            ${GROUPS.map((g) => `<button class="groups-btn" data-group="${g.id}">${escapeHtml(g.label)}</button>`).join('')}
          </div>
        </section>
        <div class="groups-countdown groups-hidden" data-role="countdown">3</div>
      `;
      stage.appendChild(root);
      attachHandlers();
      buildRoom();
      updateBoard();
      renderCard();
    },

    async start() {
      score = 0;
      miss = 0;
      solved = 0;
      bestStreak = 0;
      streak = 0;
      queue = shell.rng.shuffle(FOODS).slice(0, total);
      shell.setScore(0);
      shell.setMission(0, pairGoal);
      shell.emit('groups_duet_lobby', { mode: 'duet', pairGoal });
    },

    async pause() {},
    async resume() {},

    tick() {
      if (room?.status === 'playing') {
        partnerAutoHelp();
      }
    },

    getSummary() {
      return buildSummary();
    },

    destroy() {
      if (countdownId) clearInterval(countdownId);
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