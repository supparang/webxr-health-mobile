import {
  createBattleRoom,
  joinBattle,
  readyBattle,
  beginBattle,
  startBattle,
  applyBattleHit,
  grantBattleShield,
  finishBattle
} from '../shared/modes/battle-core.js';

export async function createGroupsBattleAdapter(ctx, shell) {
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
    room = createBattleRoom({
      gameId: 'groups',
      hostPlayer: { playerId: selfId, pid: ctx.pid, name: ctx.name || 'Player' },
      diff: ctx.diff,
      timeLimit: ctx.time,
      seed: ctx.seed,
      meta: { startHp: 100 }
    });

    joinBattle(room, { playerId: 'cpu-rival', pid: 'cpu-rival', name: 'Rival', ready: true });
    readyBattle(room, selfId, true);
    readyBattle(room, 'cpu-rival', true);
    beginBattle(room, 2500);
    renderLobbyState('พร้อมประลองแล้ว');
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
      startBattle(room);
      nextItem();
      shell.emit('groups_battle_start', { roomId: room.roomId, matchId: room.matchId });
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
      <div class="groups-prompt">ตอบให้ถูกเพื่อโจมตีคู่แข่ง</div>
      <div class="groups-item">${escapeHtml(current.label)}</div>
      <div class="groups-sub">ตอบถูกต่อเนื่องจะโจมตีแรงขึ้นและมีโอกาสได้โล่</div>
    `;
  }

  function getPlayers() {
    const you = room.players.find((p) => p.playerId === selfId);
    const rival = room.players.find((p) => p.playerId === 'cpu-rival');
    return { you, rival };
  }

  function updateBoard() {
    const { you, rival } = getPlayers();
    const youHpPct = Math.max(0, Math.min(100, Number(you?.hp || 0)));
    const rivalHpPct = Math.max(0, Math.min(100, Number(rival?.hp || 0)));

    const youBar = root.querySelector('[data-role="youHpBar"]');
    const rivalBar = root.querySelector('[data-role="rivalHpBar"]');
    const youMeta = root.querySelector('[data-role="youMeta"]');
    const rivalMeta = root.querySelector('[data-role="rivalMeta"]');

    if (youBar) youBar.style.width = `${youHpPct}%`;
    if (rivalBar) rivalBar.style.width = `${rivalHpPct}%`;
    if (youMeta) youMeta.textContent = `HP ${you?.hp || 0} • Score ${you?.score || 0} • Shield ${you?.shield || 0}`;
    if (rivalMeta) rivalMeta.textContent = `HP ${rival?.hp || 0} • Score ${rival?.score || 0} • Shield ${rival?.shield || 0}`;
  }

  function maybeGrantShield(playerId, streakValue) {
    if (streakValue > 0 && streakValue % 3 === 0) {
      grantBattleShield(room, playerId, 8);
      shell.emit('groups_battle_shield', { playerId, shield: 8, streak: streakValue, roomId: room.roomId });
    }
  }

  function playerHitRival(multiplier = 1) {
    const damage = 10 + Math.max(0, multiplier - 1) * 4;
    applyBattleHit(room, selfId, 'cpu-rival', damage, {
      scoreGain: 100,
      bestStreak
    });
    score += 100;
    shell.setScore(score);
    maybeGrantShield(selfId, streak);
    updateBoard();
  }

  function rivalHitPlayer(multiplier = 1) {
    const damage = 9 + Math.max(0, multiplier - 1) * 4;
    applyBattleHit(room, 'cpu-rival', selfId, damage, {
      scoreGain: 90,
      bestStreak: Number(getPlayers().rival?.bestStreak || 0)
    });
    updateBoard();
  }

  function rivalAutoTurn() {
    if (!room || room.status !== 'playing') return;
    if (room.winner) {
      shell.endGame(buildSummary());
      return;
    }

    const chance = ctx.diff === 'hard' ? 0.68 : ctx.diff === 'easy' ? 0.42 : 0.56;
    if (!shell.rng.chance(chance)) return;

    const rival = getPlayers().rival;
    const hitStreak = Number(rival?.bestStreak || 0) + 1;
    rivalHitPlayer(Math.min(3, hitStreak));
    if (hitStreak % 3 === 0) {
      grantBattleShield(room, 'cpu-rival', 8);
    }

    shell.emit('groups_battle_rival_hit', {
      roomId: room.roomId,
      playerHp: getPlayers().you?.hp || 0,
      rivalHp: getPlayers().rival?.hp || 0
    });

    if (room.winner) {
      shell.endGame(buildSummary());
    }
  }

  function handleAnswer(groupId) {
    if (!current || room.status !== 'playing') return;

    const ok = groupId === current.group;
    if (ok) {
      solved += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      playerHitRival(Math.min(3, streak));
    } else {
      miss += 1;
      streak = 0;
      score = Math.max(0, score - 20);
      shell.setScore(score);
      rivalHitPlayer(1);
    }

    shell.setMission(solved, total);
    shell.emit('groups_battle_answer', {
      correct: ok,
      itemId: current.id,
      expectedGroup: current.group,
      pickedGroup: groupId,
      score,
      solved,
      miss,
      roomId: room.roomId,
      playerHp: getPlayers().you?.hp || 0,
      rivalHp: getPlayers().rival?.hp || 0
    });

    updateBoard();

    if (room.winner) {
      shell.endGame(buildSummary());
      return;
    }

    if (solved >= total) {
      finishBattle(room, {});
      shell.endGame(buildSummary());
      return;
    }

    nextItem();
    rivalAutoTurn();
  }

  function buildSummary() {
    finishBattle(room, {});
    const { you, rival } = getPlayers();
    const accuracy = solved + miss > 0 ? Math.round((solved / (solved + miss)) * 100) : 0;
    const success = room.winner === selfId || (Number(you?.hp || 0) > Number(rival?.hp || 0));

    return {
      success,
      rank: success ? 1 : 2,
      score: you?.score || score,
      stars: success ? 3 : accuracy >= 70 ? 2 : 1,
      accuracy,
      miss,
      bestStreak,
      opponentResult: {
        name: rival?.name || 'Rival',
        score: rival?.score || 0,
        hp: rival?.hp || 0,
        rank: success ? 2 : 1
      },
      rewards: success ? ['groups-battle-win', 'smart-strike'] : ['groups-battle-finish'],
      coachFeedback: success
        ? ['ตอบถูกได้แม่นและกดดันคู่แข่งได้ดีมาก', 'จังหวะ combo ช่วยให้โจมตีแรงขึ้นชัดเจน']
        : ['ลองลด miss และเก็บ streak ให้ยาวขึ้นเพื่อทำดาเมจแรงขึ้น'],
      nextAction: success
        ? 'Groups ตอนนี้ครบ 5 โหมดแล้ว พร้อมใช้เป็นแม่แบบของ Nutrition zone'
        : 'เล่น battle อีกครั้งเพื่อเก็บ streak และใช้โล่ให้คุ้มกว่าเดิม',
      metrics: {
        solved,
        total,
        miss,
        winner: room.winner,
        roomId: room.roomId,
        matchId: room.matchId,
        playerHp: you?.hp || 0,
        rivalHp: rival?.hp || 0
      }
    };
  }

  function attachHandlers() {
    root.querySelectorAll('[data-group]').forEach((btn) => {
      btn.addEventListener('click', () => handleAnswer(btn.getAttribute('data-group')));
    });

    const readyBtn = root.querySelector('[data-action="battleReady"]');
    if (readyBtn) {
      readyBtn.addEventListener('click', () => {
        renderLobbyState('กำลังเริ่มประลอง...');
        readyBtn.disabled = true;
        startCountdownOverlay();
      });
    }
  }

  return {
    async mount(stage) {
      root = document.createElement('div');
      root.className = 'groups-battle-root';
      root.innerHTML = `
        <style>
          .groups-battle-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr;position:relative}
          .groups-panel{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .groups-panel h2{margin:0 0 8px;font-size:28px}.groups-panel p{margin:0;color:#d7e5ff}
          .groups-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
          .groups-cta{padding:12px 16px;border:none;border-radius:999px;background:linear-gradient(180deg,#ffdf73,#f4b92b);color:#362100;font:inherit;font-weight:800;cursor:pointer}
          .groups-battle-top{display:grid;gap:12px;grid-template-columns:1fr 1fr}
          .groups-track{padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
          .groups-track-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700}
          .groups-track-rail{height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
          .groups-track-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#56de84,#ffd24a);width:0%}
          .groups-board{display:grid;gap:16px;grid-template-columns:1.05fr .95fr;min-height:400px}
          .groups-card{display:grid;place-items:center;padding:22px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center}
          .groups-grid{display:grid;gap:12px;grid-template-columns:1fr 1fr}
          .groups-btn{min-height:84px;padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.14);background:rgba(10,24,52,.92);color:#eef5ff;font:inherit;font-size:17px;font-weight:700;cursor:pointer}
          .groups-prompt{font-size:18px;color:#c4d6f4;margin-bottom:12px}.groups-item{font-size:38px;font-weight:800;margin-bottom:10px}.groups-sub{font-size:16px;color:#dce9ff}
          .groups-countdown{position:absolute;inset:0;display:grid;place-items:center;font-size:80px;font-weight:900;background:rgba(3,8,20,.72);backdrop-filter:blur(10px);z-index:5}
          .groups-hidden{display:none!important}.groups-empty{font-size:20px;color:#dce9ff}
          @media (max-width:980px){.groups-battle-top,.groups-board{grid-template-columns:1fr}.groups-grid{grid-template-columns:1fr}}
        </style>
        <section class="groups-panel">
          <h2>Food Groups Battle</h2>
          <p>ตอบให้ถูกเพื่อโจมตีคู่แข่ง เก็บ streak เพื่อเพิ่มพลังโจมตีและโล่</p>
          <div class="groups-actions">
            <button class="groups-cta" data-action="battleReady">Ready Battle</button>
            <span data-role="lobbyState">รอเริ่มประลอง</span>
          </div>
        </section>
        <section class="groups-battle-top">
          <div class="groups-track">
            <div class="groups-track-head"><span>You</span><span data-role="youMeta">HP 100 • Score 0 • Shield 0</span></div>
            <div class="groups-track-rail"><div class="groups-track-fill" data-role="youHpBar"></div></div>
          </div>
          <div class="groups-track">
            <div class="groups-track-head"><span>Rival</span><span data-role="rivalMeta">HP 100 • Score 0 • Shield 0</span></div>
            <div class="groups-track-rail"><div class="groups-track-fill" data-role="rivalHpBar"></div></div>
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
      shell.emit('groups_battle_lobby', { mode: 'battle' });
    },

    async pause() {},
    async resume() {},

    tick() {
      if (room?.status === 'playing') {
        rivalAutoTurn();
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