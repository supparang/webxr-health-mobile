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

export async function createHydrationCoopAdapter(ctx, shell) {
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

  const teamGoal = 12;
  const total = 12;

  const MISSIONS = [
    {
      id: 'morning-water',
      prompt: 'ทีมควรเลือกนิสัยช่วงเช้าแบบไหน?',
      choices: [
        { id: 'sip-morning', label: 'จิบน้ำหลังตื่นนอน', ok: true },
        { id: 'skip-all', label: 'ไม่ต้องดื่มอะไรเลย', ok: false },
        { id: 'sugar-only', label: 'ดื่มแต่น้ำหวาน', ok: false }
      ]
    },
    {
      id: 'school-bottle',
      prompt: 'ถ้าจะไปโรงเรียนทั้งวัน ควรเตรียมอะไร?',
      choices: [
        { id: 'bottle', label: 'เตรียมขวดน้ำส่วนตัว', ok: true },
        { id: 'none', label: 'ไม่ต้องเตรียม', ok: false },
        { id: 'snack', label: 'เอาขนมเค็มแทนน้ำ', ok: false }
      ]
    },
    {
      id: 'sports-break',
      prompt: 'ช่วงพักกีฬา ทีมควรทำอะไร?',
      choices: [
        { id: 'drink-break', label: 'พักและดื่มน้ำ', ok: true },
        { id: 'play-on', label: 'เล่นต่อไม่ต้องพัก', ok: false },
        { id: 'candy', label: 'กินขนมหวานแทน', ok: false }
      ]
    },
    {
      id: 'hot-weather',
      prompt: 'อากาศร้อนมาก ทางเลือกไหนดีที่สุด?',
      choices: [
        { id: 'regular-sip', label: 'จิบน้ำเป็นช่วง ๆ', ok: true },
        { id: 'wait-evening', label: 'ค่อยดื่มตอนเย็น', ok: false },
        { id: 'soda', label: 'ดื่มแต่น้ำอัดลม', ok: false }
      ]
    },
    {
      id: 'study-session',
      prompt: 'นั่งอ่านหนังสือนาน ๆ ควรทำอย่างไร?',
      choices: [
        { id: 'keep-near', label: 'วางน้ำไว้ใกล้ตัว', ok: true },
        { id: 'forget', label: 'ปล่อยลืมไป', ok: false },
        { id: 'skip', label: 'ไม่จำเป็นต้องดื่ม', ok: false }
      ]
    },
    {
      id: 'afternoon',
      prompt: 'ช่วงบ่ายเริ่มคอแห้ง ทีมควรเลือกอะไร?',
      choices: [
        { id: 'refill', label: 'เติมน้ำแล้วจิบต่อ', ok: true },
        { id: 'ignore', label: 'อดทนไปก่อน', ok: false },
        { id: 'fizzy', label: 'เลือกแต่น้ำหวานจัด', ok: false }
      ]
    }
  ];

  let queue = [];
  let current = null;

  function buildRoom() {
    room = createCoopRoom({
      gameId: 'hydration',
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
    renderLobbyState('พร้อมเริ่มภารกิจทีม');
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
      startCoop(room);
      nextMission();
      shell.emit('hydration_coop_start', { roomId: room.roomId, matchId: room.matchId, teamGoal });
    }, 800);
  }

  function renderLobbyState(text) {
    const el = root?.querySelector('[data-role="lobbyState"]');
    if (el) el.textContent = text || '';
  }

  function nextMission() {
    if (queue.length === 0) {
      queue = shell.rng.shuffle(MISSIONS).slice(0, total);
    }
    current = queue.shift() || null;
    renderCard();
  }

  function buddyAutoHelp() {
    if (!room || room.status !== 'playing') return;
    const buddy = room.players.find((p) => p.playerId === 'cpu-friend');
    if (!buddy) return;

    const chance = ctx.diff === 'hard' ? 0.46 : ctx.diff === 'easy' ? 0.74 : 0.6;
    if (!shell.rng.chance(chance)) return;

    const nextContribution = Number(buddy.contribution || 0) + 1;
    const nextScore = Number(buddy.score || 0) + 85;

    submitCoopContribution(room, 'cpu-friend', {
      score: nextScore,
      contribution: nextContribution,
      progress: nextContribution,
      bestStreak: Number(buddy.bestStreak || 0) + 1,
      miss: Number(buddy.miss || 0)
    });

    updateBoard();
  }

  function updateBoard() {
    const you = room.players.find((p) => p.playerId === selfId);
    const buddy = room.players.find((p) => p.playerId === 'cpu-friend');
    const pct = Math.round(((room.teamScore || 0) / teamGoal) * 100);

    const teamBar = root.querySelector('[data-role="teamBar"]');
    const teamMeta = root.querySelector('[data-role="teamMeta"]');
    const youMeta = root.querySelector('[data-role="youMeta"]');
    const buddyMeta = root.querySelector('[data-role="buddyMeta"]');

    if (teamBar) teamBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (teamMeta) teamMeta.textContent = `${room.teamScore || 0}/${teamGoal}`;
    if (youMeta) youMeta.textContent = `คะแนน ${you?.score || 0} • ช่วยทีม ${you?.contribution || 0}`;
    if (buddyMeta) buddyMeta.textContent = `คะแนน ${buddy?.score || 0} • ช่วยทีม ${buddy?.contribution || 0}`;
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
    shell.emit('hydration_coop_answer', {
      missionId: current.id,
      picked: choice.id,
      correct: ok,
      roomId: room.roomId,
      teamScore: room.teamScore || 0,
      teamGoal
    });

    updateBoard();
    showTip(ok ? 'ดีมากทั้งทีม' : 'ยังไม่ใช่', ok
      ? 'แนวทางนี้ช่วยให้ทีมดูแลการดื่มน้ำได้ดีขึ้น'
      : 'ลองเลือกทางที่ช่วยให้ดื่มน้ำสม่ำเสมอและเข้าถึงน้ำได้ง่าย');

    if ((room.teamScore || 0) >= teamGoal) {
      window.setTimeout(() => shell.endGame(buildSummary()), 350);
      return;
    }

    buddyAutoHelp();
    window.setTimeout(nextMission, 360);
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
      rewards: success ? ['hydration-coop-clear', 'team-hydration'] : ['hydration-coop-finish'],
      coachFeedback: success
        ? ['ทีมวางแผนการดื่มน้ำได้ดีมาก', 'ทุกคนช่วยกันทำเป้าหมาย hydration สำเร็จ']
        : ['ลองช่วยกันเลือกนิสัยที่ทำให้ดื่มน้ำได้ต่อเนื่องมากขึ้น'],
      nextAction: success
        ? 'Hydration ตอนนี้มี solo, duet, coop บน HNZS แล้ว พร้อมขยาย race/battle ต่อ'
        : 'เล่น coop อีกครั้งเพื่อดันทีมสกอร์ให้ถึงเป้าหมาย',
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

  function renderCard() {
    const card = root?.querySelector('[data-role="card"]');
    if (!card) return;
    if (!current) {
      card.innerHTML = '<div class="hyd-empty">กำลังเตรียมภารกิจทีม...</div>';
      return;
    }

    card.innerHTML = `
      <div class="hyd-kicker">Team Hydration Mission</div>
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
      root.className = 'hyd-coop-root';
      root.innerHTML = `
        <style>
          .hyd-coop-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr auto;position:relative}
          .hyd-hero,.hyd-tip,.hyd-track{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .hyd-hero h2{margin:0 0 8px;font-size:28px}.hyd-hero p{margin:0;color:#d7e5ff}
          .hyd-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
          .hyd-cta{padding:12px 16px;border:none;border-radius:999px;background:linear-gradient(180deg,#5be38b,#2cc267);color:#072112;font:inherit;font-weight:800;cursor:pointer}
          .hyd-team{display:grid;gap:12px;grid-template-columns:1.2fr .8fr .8fr}
          .hyd-track-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-weight:700}
          .hyd-track-rail{height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
          .hyd-track-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#56de84,#ffd24a);width:0%}
          .hyd-mini{padding:14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
          .hyd-mini strong{display:block;margin-bottom:6px}
          .hyd-card{display:grid;place-items:center;padding:24px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);text-align:center;min-height:380px}
          .hyd-kicker{font-size:13px;letter-spacing:.16em;color:#bed2f1;text-transform:uppercase;margin-bottom:12px}
          .hyd-prompt{font-size:32px;font-weight:800;line-height:1.25;margin-bottom:18px;max-width:760px}
          .hyd-choices{display:grid;gap:12px;grid-template-columns:1fr;max-width:720px;width:100%}
          .hyd-btn{min-height:74px;padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.14);background:rgba(10,24,52,.92);color:#eef5ff;font:inherit;font-size:18px;font-weight:700;cursor:pointer}
          .hyd-tip{display:flex;gap:10px;flex-direction:column}.hyd-tip span{color:#dce9ff}
          .hyd-countdown{position:absolute;inset:0;display:grid;place-items:center;font-size:80px;font-weight:900;background:rgba(3,8,20,.72);backdrop-filter:blur(10px);z-index:5}
          .hyd-hidden{display:none!important}.hyd-empty{font-size:20px;color:#dce9ff}
          @media (max-width:980px){.hyd-team{grid-template-columns:1fr}}
        </style>
        <section class="hyd-hero">
          <h2>Hydration Coop</h2>
          <p>ช่วยกันสร้างนิสัยการดื่มน้ำที่ดีให้ครบตามเป้าหมายทีม</p>
          <div class="hyd-actions">
            <button class="hyd-cta" data-action="coopReady">Ready Team</button>
            <span data-role="lobbyState">รอเริ่มภารกิจทีม</span>
          </div>
        </section>
        <section class="hyd-team">
          <div class="hyd-track">
            <div class="hyd-track-head"><span>Team Goal</span><span data-role="teamMeta">0/${teamGoal}</span></div>
            <div class="hyd-track-rail"><div class="hyd-track-fill" data-role="teamBar"></div></div>
          </div>
          <div class="hyd-mini"><strong>You</strong><span data-role="youMeta">คะแนน 0 • ช่วยทีม 0</span></div>
          <div class="hyd-mini"><strong>Buddy</strong><span data-role="buddyMeta">คะแนน 0 • ช่วยทีม 0</span></div>
        </section>
        <section class="hyd-card" data-role="card"></section>
        <section class="hyd-tip" data-role="tip"><strong>Coach</strong><span>ร่วมกันเลือกนิสัยที่ช่วยให้ทีมดื่มน้ำได้เพียงพอ</span></section>
        <div class="hyd-countdown hyd-hidden" data-role="countdown">3</div>
      `;
      stage.appendChild(root);
      buildRoom();
      renderCard();
      updateBoard();

      const readyBtn = root.querySelector('[data-action="coopReady"]');
      readyBtn?.addEventListener('click', () => {
        readyBtn.disabled = true;
        renderLobbyState('กำลังเริ่มภารกิจทีม...');
        startCountdownOverlay();
      });
    },

    async start() {
      score = 0;
      miss = 0;
      solved = 0;
      bestStreak = 0;
      streak = 0;
      queue = shell.rng.shuffle(MISSIONS).slice(0, total);
      shell.setScore(0);
      shell.setMission(0, teamGoal);
      shell.emit('hydration_coop_lobby', { teamGoal });
    },

    async pause() {},
    async resume() {},

    tick() {
      if (room?.status === 'playing') {
        buddyAutoHelp();
        if ((room.teamScore || 0) >= teamGoal) {
          shell.endGame(buildSummary());
        }
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