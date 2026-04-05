import {
  createRaceRoom,
  joinRace,
  readyRace,
  beginRace,
  startRace,
  submitRaceProgress,
  submitRaceFinish,
  finishRace
} from '../shared/modes/race-core.js';

export async function createGroupsRaceAdapter(ctx, shell) {
  let root;
  let room = null;
  let selfId = ctx.pid || 'anon';
  let score = 0;
  let miss = 0;
  let solved = 0;
  let bestStreak = 0;
  let streak = 0;
  const total = 10;

  const FOODS = [
    { id: 'apple', label: 'Apple', group: 'fruit' },
    { id: 'orange', label: 'Orange', group: 'fruit' },
    { id: 'spinach', label: 'Spinach', group: 'vegetable' },
    { id: 'pumpkin', label: 'Pumpkin', group: 'vegetable' },
    { id: 'fish', label: 'Fish', group: 'protein' },
    { id: 'egg', label: 'Egg', group: 'protein' },
    { id: 'rice', label: 'Rice', group: 'carb' },
    { id: 'bread', label: 'Bread', group: 'carb' },
    { id: 'oil', label: 'Oil', group: 'fat' },
    { id: 'avocado', label: 'Avocado', group: 'fat' }
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
  let countdownLeft = 3;
  let countdownId = 0;

  function buildRoom() {
    room = createRaceRoom({
      gameId: 'groups',
      hostPlayer: { playerId: selfId, pid: ctx.pid, name: ctx.name || 'Player' },
      diff: ctx.diff,
      timeLimit: ctx.time,
      seed: ctx.seed,
      meta: { targetSolved: total }
    });

    const rivalName = ctx.opponentId ? `Rival ${ctx.opponentId}` : 'Rival';
    joinRace(room, { playerId: 'cpu-rival', pid: 'cpu-rival', name: rivalName, ready: true });
    readyRace(room, selfId, true);
    readyRace(room, 'cpu-rival', true);
    beginRace(room, 2500);
    renderLobbyState('พร้อมแข่งแล้ว');
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
      window.setTimeout(() => {
        overlay.classList.add('groups-hidden');
      }, 450);
      startRace(room);
      nextItem();
      shell.emit('groups_race_start', { roomId: room.roomId, matchId: room.matchId });
    }, 800);
  }

  function renderLobbyState(text) {
    const el = root?.querySelector('[data-role="lobbyState"]');
    if (el) el.textContent = text || '';
  }

  function updateBoard() {
    const you = room.players.find((p) => p.playerId === selfId);
    const rival = room.players.find((p) => p.playerId === 'cpu-rival');

    const youPct = Math.round(((you?.progress || 0) / total) * 100);
    const rivalPct = Math.round(((rival?.progress || 0) / total) * 100);

    const youBar = root.querySelector('[data-role="youBar"]');
    const rivalBar = root.querySelector('[data-role="rivalBar"]');
    const youMeta = root.querySelector('[data-role="youMeta"]');
    const rivalMeta = root.querySelector('[data-role="rivalMeta"]');

    if (youBar) youBar.style.width = `${Math.max(0, Math.min(100, youPct))}%`;
    if (rivalBar) rivalBar.style.width = `${Math.max(0, Math.min(100, rivalPct))}%`;
    if (youMeta) youMeta.textContent = `${you?.progress || 0}/${total} • ${you?.score || 0}`;
    if (rivalMeta) rivalMeta.textContent = `${rival?.progress || 0}/${total} • ${rival?.score || 0}`;
  }

  function nextItem() {
    if (queue.length === 0) {
      queue = shell.rng.shuffle(FOODS).slice(0, total - solved);
    }
    current = queue.shift() || null;
    renderCard();
  }

  function renderCard() {
    const card = root?.querySelector('[data-role="card"]');
    if (!card) return;
    if (!current) {
      card.innerHTML = '<div class="groups-empty">ไม่มีโจทย์แล้ว</div>';
      return;
    }
    card.innerHTML = `
      <div class="groups-prompt">แข่งจัดหมวดให้เร็วและแม่น</div>
      <div class="groups-item">${escapeHtml(current.label)}</div>
      <div class="groups-sub">เลือกหมวดที่ถูกต้องก่อนคู่แข่ง</div>
    `;
  }

  function rivalAutoPlay() {
    const rival = room.players.find((p) => p.playerId === 'cpu-rival');
    if (!rival || room.status !== 'playing') return;

    const gain = shell.rng.chance(ctx.diff === 'hard' ? 0.75 : ctx.diff === 'easy' ? 0.45 : 0.6) ? 1 : 0;
    if (!gain) return;

    const nextProgress = Math.min(total, Number(rival.progress || 0) + 1);
    const nextScore = Number(rival.score || 0) + 90;
    submitRaceProgress(room, 'cpu-rival', {
      progress: nextProgress,
      score: nextScore,
      bestStreak: nextProgress,
      miss: Number(rival.miss || 0)
    });

    if (nextProgress >= total) {
      submitRaceFinish(room, 'cpu-rival', {
        progress: total,
        score: nextScore,
        bestStreak: nextProgress,
        miss: Number(rival.miss || 0)
      });
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
      score = Math.max(0, score - 20);
      shell.setScore(score);
    }

    submitRaceProgress(room, selfId, {
      progress: solved,
      score,
      bestStreak,
      miss
    });

    shell.setMission(solved, total);
    shell.emit('groups_race_answer', {
      correct: ok,
      itemId: current.id,
      expectedGroup: current.group,
      pickedGroup: groupId,
      score,
      solved,
      total,
      roomId: room.roomId
    });

    updateBoard();

    if (solved >= total) {
      submitRaceFinish(room, selfId, {
        progress: total,
        score,
        bestStreak,
        miss
      });
      shell.endGame(buildSummary());
      return;
    }

    nextItem();
    rivalAutoPlay();
  }

  function buildSummary() {
    finishRace(room, {});
    const you = room.players.find((p) => p.playerId === selfId);
    const rival = room.players.find((p) => p.playerId === 'cpu-rival');
    const success = room.winner === selfId;
    const accuracy = solved + miss > 0 ? Math.round((solved / (solved + miss)) * 100) : 0;

    return {
      success,
      rank: you?.rank || (success ? 1 : 2),
      score: you?.score || score,
      stars: success ? 3 : accuracy >= 75 ? 2 : 1,
      accuracy,
      miss,
      bestStreak,
      opponentResult: {
        name: rival?.name || 'Rival',
        score: rival?.score || 0,
        rank: rival?.rank || (success ? 2 : 1)
      },
      rewards: success ? ['groups-race-win'] : ['groups-race-finish'],
      coachFeedback: success
        ? ['แยกหมวดอาหารได้ไวและแม่นกว่าคู่แข่ง']
        : ['ลองลด miss และเร่งจังหวะการตอบอีกนิด'],
      nextAction: success
        ? 'ลองโหมด coop เพื่อเล่นเป็นทีม'
        : 'เล่น race อีกครั้งเพื่อชนะด้วยความแม่นยำที่มากขึ้น',
      metrics: {
        solved,
        total,
        miss,
        winner: room.winner,
        roomId: room.roomId,
        matchId: room.matchId
      }
    };
  }

  function attachHandlers() {
    root.querySelectorAll('[data-group]').forEach((btn) => {
      btn.addEventListener('click', () => handleAnswer(btn.getAttribute('data-group')));
    });

    const readyBtn = root.querySelector('[data-action="raceReady"]');
    if (readyBtn) {
      readyBtn.addEventListener('click', () => {
        renderLobbyState('กำลังเริ่มแข่ง...');
        startCountdownOverlay();
        readyBtn.disabled = true;
      });
    }
  }

  return {
    async mount(stage) {
      root = document.createElement('div');
      root.className = 'groups-race-root';
      root.innerHTML = `
        <style>
          .groups-race-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr;position:relative}
          .groups-panel{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .groups-panel h2{margin:0 0 8px;font-size:28px}
          .groups-panel p{margin:0;color:#d7e5ff}
          .groups-race-board{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .groups-track{padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
          .groups-track-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700}
          .groups-track-rail{height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
          .groups-track-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#56de84,#ffd24a);width:0%}
          .groups-board{display:grid;gap:16px;grid-template-columns:1.05fr .95fr;min-height:400px}
          .groups-card{display:grid;place-items:center;padding:22px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center}
          .groups-grid{display:grid;gap:12px;grid-template-columns:1fr 1fr}
          .groups-btn{min-height:84px;padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.14);background:rgba(10,24,52,.92);color:#eef5ff;font:inherit;font-size:17px;font-weight:700;cursor:pointer}
          .groups-prompt{font-size:18px;color:#c4d6f4;margin-bottom:12px}
          .groups-item{font-size:38px;font-weight:800;margin-bottom:10px}
          .groups-sub{font-size:16px;color:#dce9ff}
          .groups-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
          .groups-cta{padding:12px 16px;border:none;border-radius:999px;background:linear-gradient(180deg,#5be38b,#2cc267);color:#072112;font:inherit;font-weight:800;cursor:pointer}
          .groups-countdown{position:absolute;inset:0;display:grid;place-items:center;font-size:80px;font-weight:900;background:rgba(3,8,20,.72);backdrop-filter:blur(10px);z-index:5}
          .groups-hidden{display:none!important}
          .groups-empty{font-size:20px;color:#dce9ff}
          @media (max-width:900px){.groups-race-board,.groups-board{grid-template-columns:1fr}.groups-grid{grid-template-columns:1fr}}
        </style>
        <section class="groups-panel">
          <h2>Food Groups Race</h2>
          <p>แข่งแยกหมวดอาหารให้เร็วและแม่นกว่าอีกฝั่ง</p>
          <div class="groups-actions">
            <button class="groups-cta" data-action="raceReady">Ready Race</button>
            <span data-role="lobbyState">รอเริ่มแข่ง</span>
          </div>
        </section>
        <section class="groups-race-board">
          <div class="groups-track">
            <div class="groups-track-head"><span>You</span><span data-role="youMeta">0/${total} • 0</span></div>
            <div class="groups-track-rail"><div class="groups-track-fill" data-role="youBar"></div></div>
          </div>
          <div class="groups-track">
            <div class="groups-track-head"><span>Rival</span><span data-role="rivalMeta">0/${total} • 0</span></div>
            <div class="groups-track-rail"><div class="groups-track-fill" data-role="rivalBar"></div></div>
          </div>
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
      shell.setMission(0, total);
      shell.emit('groups_race_lobby', { mode: 'race' });
    },

    async pause() {},
    async resume() {},

    tick() {
      if (room?.status === 'playing') {
        rivalAutoPlay();
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