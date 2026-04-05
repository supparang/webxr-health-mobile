import {
  createCoopRoom,
  joinCoop,
  readyCoop,
  beginCoop,
  startCoop,
  submitCoopContribution,
  setCoopTeamGoal,
  finishCoop
} from '../shared/modes/coop-core.js';

export async function createGroupsCoopAdapter(ctx, shell) {
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

  const total = 12;
  const teamGoal = 12;

  const FOODS = [
    { id: 'apple', label: 'Apple', group: 'fruit' },
    { id: 'banana', label: 'Banana', group: 'fruit' },
    { id: 'guava', label: 'Guava', group: 'fruit' },
    { id: 'broccoli', label: 'Broccoli', group: 'vegetable' },
    { id: 'carrot', label: 'Carrot', group: 'vegetable' },
    { id: 'morning-glory', label: 'Morning Glory', group: 'vegetable' },
    { id: 'egg', label: 'Egg', group: 'protein' },
    { id: 'milk', label: 'Milk', group: 'protein' },
    { id: 'fish', label: 'Fish', group: 'protein' },
    { id: 'rice', label: 'Rice', group: 'carb' },
    { id: 'bread', label: 'Bread', group: 'carb' },
    { id: 'sweet-potato', label: 'Sweet Potato', group: 'carb' },
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
    room = createCoopRoom({
      gameId: 'groups',
      hostPlayer: { playerId: selfId, pid: ctx.pid, name: ctx.name || 'Player' },
      diff: ctx.diff,
      timeLimit: ctx.time,
      seed: ctx.seed,
      meta: { teamGoal }
    });

    joinCoop(room, { playerId: 'cpu-friend', pid: 'cpu-friend', name: 'Buddy', ready: true });
    readyCoop(room, selfId, true);
    readyCoop(room, 'cpu-friend', true);
    setCoopTeamGoal(room, teamGoal);
    beginCoop(room, 2500);
    renderLobbyState('พร้อมเริ่มช่วยกันแล้ว');
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
      startCoop(room);
      nextItem();
      shell.emit('groups_coop_start', { roomId: room.roomId, matchId: room.matchId, teamGoal });
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
      card.innerHTML = '<div class="groups-empty">กำลังเตรียมโจทย์ถัดไป...</div>';
      return;
    }

    card.innerHTML = `
      <div class="groups-prompt">ช่วยกันเลือกหมวดอาหารให้ถูกต้อง</div>
      <div class="groups-item">${escapeHtml(current.label)}</div>
      <div class="groups-sub">ทำเป้าหมายทีมให้ครบ ${teamGoal} ข้อ</div>
    `;
  }

  function updateBoard() {
    const you = room.players.find((p) => p.playerId === selfId);
    const buddy = room.players.find((p) => p.playerId === 'cpu-friend');

    const teamPct = Math.round((Number(room.teamScore || 0) / teamGoal) * 100);
    const teamBar = root.querySelector('[data-role="teamBar"]');
    const teamMeta = root.querySelector('[data-role="teamMeta"]');
    const youMeta = root.querySelector('[data-role="youMeta"]');
    const buddyMeta = root.querySelector('[data-role="buddyMeta"]');

    if (teamBar) teamBar.style.width = `${Math.max(0, Math.min(100, teamPct))}%`;
    if (teamMeta) teamMeta.textContent = `${room.teamScore || 0}/${teamGoal}`;
    if (youMeta) youMeta.textContent = `คะแนน ${you?.score || 0} • ช่วยทีม ${you?.contribution || 0}`;
    if (buddyMeta) buddyMeta.textContent = `คะแนน ${buddy?.score || 0} • ช่วยทีม ${buddy?.contribution || 0}`;
  }

  function buddyAutoHelp() {
    if (!room || room.status !== 'playing') return;
    const buddy = room.players.find((p) => p.playerId === 'cpu-friend');
    if (!buddy) return;

    const chance = ctx.diff === 'hard' ? 0.48 : ctx.diff === 'easy' ? 0.72 : 0.6;
    if (!shell.rng.chance(chance)) return;

    const add = 1;
    const nextContribution = Number(buddy.contribution || 0) + add;
    const nextScore = Number(buddy.score || 0) + 85;

    submitCoopContribution(room, 'cpu-friend', {
      score: nextScore,
      contribution: nextContribution,
      progress: nextContribution,
      bestStreak: Number(buddy.bestStreak || 0) + 1,
      miss: Number(buddy.miss || 0)
    });

    if (room.teamScore >= teamGoal) {
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
      score = Math.max(0, score - 15);
      shell.setScore(score);
    }

    submitCoopContribution(room, selfId, {
      score,
      contribution: solved,
      progress: solved,
      bestStreak,
      miss
    });

    shell.setMission(room.teamScore || 0, teamGoal);
    shell.emit('groups_coop_answer', {
      correct: ok,
      itemId: current.id,
      expectedGroup: current.group,
      pickedGroup: groupId,
      score,
      solved,
      miss,
      teamScore: room.teamScore,
      teamGoal,
      roomId: room.roomId
    });

    updateBoard();

    if (room.teamScore >= teamGoal) {
      shell.endGame(buildSummary());
      return;
    }

    nextItem();
    buddyAutoHelp();
  }

  function buildSummary() {
    finishCoop(room, { success: Number(room.teamScore || 0) >= teamGoal, teamGoal });
    const you = room.players.find((p) => p.playerId === selfId);
    const buddy = room.players.find((p) => p.playerId === 'cpu-friend');
    const accuracy = solved + miss > 0 ? Math.round((solved / (solved + miss)) * 100) : 0;
    const success = Number(room.teamScore || 0) >= teamGoal;

    return {
      success,
      stars: success ? (miss <= 1 ? 3 : 2) : 1,
      accuracy,
      miss,
      bestStreak,
      contribution: you?.contribution || solved,
      teamResult: {
        success,
        teamGoal,
        teamScore: room.teamScore || 0,
        players: [
          { name: you?.name || 'You', contribution: you?.contribution || 0, score: you?.score || 0 },
          { name: buddy?.name || 'Buddy', contribution: buddy?.contribution || 0, score: buddy?.score || 0 }
        ]
      },
      rewards: success ? ['groups-coop-clear', 'team-helper'] : ['groups-coop-finish'],
      coachFeedback: success
        ? ['ช่วยกันจัดหมวดอาหารได้ครบตามเป้าหมายทีม', 'ทั้งทีมประสานงานได้ดีมาก']
        : ['ลองช่วยกันทำให้เป้าหมายทีมครบมากขึ้นในรอบถัดไป'],
      nextAction: success
        ? 'ลองโหมด duet เพื่อเล่นแบบคู่ที่จังหวะเร็วขึ้น'
        : 'เล่น coop อีกครั้งแล้วเพิ่มความแม่นของแต่ละคน',
      metrics: {
        solved,
        teamScore: room.teamScore || 0,
        teamGoal,
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

    const readyBtn = root.querySelector('[data-action="coopReady"]');
    if (readyBtn) {
      readyBtn.addEventListener('click', () => {
        renderLobbyState('เริ่มช่วยกันในอีกสักครู่...');
        readyBtn.disabled = true;
        startCountdownOverlay();
      });
    }
  }

  return {
    async mount(stage) {
      root = document.createElement('div');
      root.className = 'groups-coop-root';
      root.innerHTML = `
        <style>
          .groups-coop-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr;position:relative}
          .groups-panel{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .groups-panel h2{margin:0 0 8px;font-size:28px}.groups-panel p{margin:0;color:#d7e5ff}
          .groups-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
          .groups-cta{padding:12px 16px;border:none;border-radius:999px;background:linear-gradient(180deg,#5be38b,#2cc267);color:#072112;font:inherit;font-weight:800;cursor:pointer}
          .groups-team{display:grid;gap:12px;grid-template-columns:1.2fr .8fr .8fr}
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
          @media (max-width:980px){.groups-team,.groups-board{grid-template-columns:1fr}.groups-grid{grid-template-columns:1fr}}
        </style>
        <section class="groups-panel">
          <h2>Food Groups Coop</h2>
          <p>ช่วยกันจัดหมวดอาหารให้ครบตามเป้าหมายทีม</p>
          <div class="groups-actions">
            <button class="groups-cta" data-action="coopReady">Ready Team</button>
            <span data-role="lobbyState">รอเริ่มช่วยกัน</span>
          </div>
        </section>
        <section class="groups-team">
          <div class="groups-track">
            <div class="groups-track-head"><span>Team Goal</span><span data-role="teamMeta">0/${teamGoal}</span></div>
            <div class="groups-track-rail"><div class="groups-track-fill" data-role="teamBar"></div></div>
          </div>
          <div class="groups-mini"><strong>You</strong><span data-role="youMeta">คะแนน 0 • ช่วยทีม 0</span></div>
          <div class="groups-mini"><strong>Buddy</strong><span data-role="buddyMeta">คะแนน 0 • ช่วยทีม 0</span></div>
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
      shell.setMission(0, teamGoal);
      shell.emit('groups_coop_lobby', { mode: 'coop', teamGoal });
    },

    async pause() {},
    async resume() {},

    tick() {
      if (room?.status === 'playing') {
        buddyAutoHelp();
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