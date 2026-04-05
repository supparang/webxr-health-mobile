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

export async function createHydrationRaceAdapter(ctx, shell) {
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

  const SCENARIOS = [
    {
      id: 'carry-water',
      prompt: 'ไปโรงเรียนทั้งวัน ควรเตรียมอะไร?',
      choices: [
        { id: 'bottle', label: 'พกขวดน้ำติดตัว', ok: true },
        { id: 'none', label: 'ไม่ต้องเตรียม', ok: false },
        { id: 'candy', label: 'เอาขนมแทนน้ำ', ok: false }
      ]
    },
    {
      id: 'hot-day',
      prompt: 'วันที่อากาศร้อน ควรทำอย่างไร?',
      choices: [
        { id: 'sip', label: 'จิบน้ำเป็นช่วง ๆ', ok: true },
        { id: 'wait', label: 'รอจนเย็นค่อยดื่ม', ok: false },
        { id: 'skip', label: 'ไม่ต้องดื่ม', ok: false }
      ]
    },
    {
      id: 'after-sport',
      prompt: 'หลังเล่นกีฬาเสร็จ ควรเลือกอะไร?',
      choices: [
        { id: 'water', label: 'ดื่มน้ำทันที', ok: true },
        { id: 'ignore', label: 'ยังไม่ต้องดื่ม', ok: false },
        { id: 'sweet', label: 'เลือกแต่น้ำหวานจัด', ok: false }
      ]
    },
    {
      id: 'classroom',
      prompt: 'อยู่ในห้องเรียนทั้งเช้า ควรทำแบบไหน?',
      choices: [
        { id: 'keep-near', label: 'วางน้ำไว้ใกล้ตัว', ok: true },
        { id: 'forget', label: 'ปล่อยลืมไป', ok: false },
        { id: 'none', label: 'ไม่ต้องสนใจน้ำ', ok: false }
      ]
    },
    {
      id: 'afternoon',
      prompt: 'ช่วงบ่ายเริ่มคอแห้ง ควรทำอย่างไร?',
      choices: [
        { id: 'refill', label: 'เติมน้ำแล้วจิบต่อ', ok: true },
        { id: 'push', label: 'ฝืนต่อไปก่อน', ok: false },
        { id: 'soda', label: 'ดื่มแต่น้ำอัดลม', ok: false }
      ]
    },
    {
      id: 'morning',
      prompt: 'เริ่มต้นเช้าวันใหม่แบบไหนดี?',
      choices: [
        { id: 'morning-water', label: 'จิบน้ำ 1 แก้ว', ok: true },
        { id: 'snack', label: 'กินของเค็มก่อน', ok: false },
        { id: 'skip', label: 'ไม่ต้องดื่ม', ok: false }
      ]
    }
  ];

  let queue = [];
  let current = null;

  function buildRoom() {
    room = createRaceRoom({
      gameId: 'hydration',
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
    renderLobbyState('พร้อมแข่งวางแผนการดื่มน้ำ');
  }

  function startCountdownOverlay() {
    const overlay = root.querySelector('[data-role="countdown"]');
    countdownLeft = 3;
    overlay.classList.remove('hyd-hidden');
    overlay.textContent = String(countdownLeft);
    countdownId = window.setInterval(() => {
      countdownLeft -= 1;
      if (countdownLeft > 0) {
        overlay.textContent = String(countdownLeft);
        return;
      }
      clearInterval(countdownId);
      overlay.textContent = 'GO!';
      window.setTimeout(() => overlay.classList.add('hyd-hidden'), 450);
      startRace(room);
      nextScenario();
      shell.emit('hydration_race_start', { roomId: room.roomId, matchId: room.matchId });
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

  function nextScenario() {
    if (queue.length === 0) {
      queue = shell.rng.shuffle(SCENARIOS).slice(0, total - solved);
    }
    current = queue.shift() || null;
    renderCard();
  }

  function renderCard() {
    const card = root?.querySelector('[data-role="card"]');
    if (!card) return;
    if (!current) {
      card.innerHTML = '<div class="hyd-empty">ไม่มีสถานการณ์แล้ว</div>';
      return;
    }
    card.innerHTML = `
      <div class="hyd-kicker">Hydration Race</div>
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

  function rivalAutoPlay() {
    const rival = room.players.find((p) => p.playerId === 'cpu-rival');
    if (!rival || room.status !== 'playing') return;

    const gain = shell.rng.chance(ctx.diff === 'hard' ? 0.74 : ctx.diff === 'easy' ? 0.46 : 0.6) ? 1 : 0;
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

  function handleChoice(choiceId) {
    if (!current || room.status !== 'playing') return;
    const choice = current.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    const ok = !!choice.ok;
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
    shell.emit('hydration_race_answer', {
      scenarioId: current.id,
      picked: choice.id,
      correct: ok,
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

    nextScenario();
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
      rewards: success ? ['hydration-race-win'] : ['hydration-race-finish'],
      coachFeedback: success
        ? ['ตัดสินใจเรื่อง hydration ได้ไวและแม่นกว่าคู่แข่ง']
        : ['ลองเร่งจังหวะและลด miss เพื่อชนะ race รอบถัดไป'],
      nextAction: success
        ? 'ลอง battle เพื่อใช้การตัดสินใจที่แม่นยำโจมตีคู่แข่ง'
        : 'เล่น race อีกครั้งและพยายามตอบให้แม่นขึ้น',
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

  return {
    async mount(stage) {
      root = document.createElement('div');
      root.className = 'hyd-race-root';
      root.innerHTML = `
        <style>
          .hyd-race-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr;position:relative}
          .hyd-panel{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .hyd-panel h2{margin:0 0 8px;font-size:28px}.hyd-panel p{margin:0;color:#d7e5ff}
          .hyd-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
          .hyd-cta{padding:12px 16px;border:none;border-radius:999px;background:linear-gradient(180deg,#5be38b,#2cc267);color:#072112;font:inherit;font-weight:800;cursor:pointer}
          .hyd-race-board{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .hyd-track{padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
          .hyd-track-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700}
          .hyd-track-rail{height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
          .hyd-track-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#56de84,#ffd24a);width:0%}
          .hyd-card{display:grid;place-items:center;padding:24px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center;min-height:380px}
          .hyd-kicker{font-size:13px;letter-spacing:.16em;color:#bed2f1;text-transform:uppercase;margin-bottom:12px}
          .hyd-prompt{font-size:32px;font-weight:800;line-height:1.25;margin-bottom:18px;max-width:760px}
          .hyd-choices{display:grid;gap:12px;grid-template-columns:1fr;max-width:720px;width:100%}
          .hyd-btn{min-height:74px;padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.14);background:rgba(10,24,52,.92);color:#eef5ff;font:inherit;font-size:18px;font-weight:700;cursor:pointer}
          .hyd-countdown{position:absolute;inset:0;display:grid;place-items:center;font-size:80px;font-weight:900;background:rgba(3,8,20,.72);backdrop-filter:blur(10px);z-index:5}
          .hyd-hidden{display:none!important}.hyd-empty{font-size:20px;color:#dce9ff}
          @media (max-width:980px){.hyd-race-board{grid-template-columns:1fr}}
        </style>
        <section class="hyd-panel">
          <h2>Hydration Race</h2>
          <p>แข่งเลือกแนวทางการดื่มน้ำที่ถูกต้องให้ไวกว่าอีกฝั่ง</p>
          <div class="hyd-actions">
            <button class="hyd-cta" data-action="raceReady">Ready Race</button>
            <span data-role="lobbyState">รอเริ่มแข่ง</span>
          </div>
        </section>
        <section class="hyd-race-board">
          <div class="hyd-track">
            <div class="hyd-track-head"><span>You</span><span data-role="youMeta">0/${total} • 0</span></div>
            <div class="hyd-track-rail"><div class="hyd-track-fill" data-role="youBar"></div></div>
          </div>
          <div class="hyd-track">
            <div class="hyd-track-head"><span>Rival</span><span data-role="rivalMeta">0/${total} • 0</span></div>
            <div class="hyd-track-rail"><div class="hyd-track-fill" data-role="rivalBar"></div></div>
          </div>
        </section>
        <section class="hyd-card" data-role="card"></section>
        <div class="hyd-countdown hyd-hidden" data-role="countdown">3</div>
      `;
      stage.appendChild(root);
      buildRoom();
      updateBoard();
      renderCard();

      const readyBtn = root.querySelector('[data-action="raceReady"]');
      readyBtn?.addEventListener('click', () => {
        readyBtn.disabled = true;
        renderLobbyState('กำลังเริ่มแข่ง...');
        startCountdownOverlay();
      });
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
      shell.emit('hydration_race_lobby', { mode: 'race' });
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