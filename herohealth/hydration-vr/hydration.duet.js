import {
  createDuetRoom,
  joinDuet,
  readyDuet,
  beginDuet,
  startDuet,
  submitDuetContribution,
  finishDuet
} from '../shared/modes/duet-core.js';

export async function createHydrationDuetAdapter(ctx, shell) {
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

  const pairGoal = 10;
  const total = 10;

  const SCENARIOS = [
    {
      id: 'after-play',
      prompt: 'เพื่อนเพิ่งเล่นกีฬาเสร็จ ควรแนะนำอะไร?',
      choices: [
        { id: 'water', label: 'ชวนดื่มน้ำ', ok: true },
        { id: 'ignore', label: 'ปล่อยไว้ก่อน', ok: false },
        { id: 'sweet', label: 'ดื่มแต่น้ำหวานจัด', ok: false }
      ]
    },
    {
      id: 'carry-bottle',
      prompt: 'อยากดื่มน้ำให้สม่ำเสมอ ควรทำอย่างไร?',
      choices: [
        { id: 'carry', label: 'พกขวดน้ำไว้ใกล้ตัว', ok: true },
        { id: 'guess', label: 'รอให้กระหายน้ำมากก่อน', ok: false },
        { id: 'skip', label: 'ไม่ต้องเตรียมอะไร', ok: false }
      ]
    },
    {
      id: 'class-break',
      prompt: 'ช่วงพักระหว่างคาบ วิธีไหนดี?',
      choices: [
        { id: 'sip', label: 'จิบน้ำเล็กน้อย', ok: true },
        { id: 'none', label: 'ไม่ดื่มเลย', ok: false },
        { id: 'snack', label: 'กินของเค็มแทนน้ำ', ok: false }
      ]
    },
    {
      id: 'hot-day',
      prompt: 'วันที่อากาศร้อนมาก ควรวางแผนแบบไหน?',
      choices: [
        { id: 'plan', label: 'ดื่มน้ำเป็นช่วง ๆ', ok: true },
        { id: 'last-minute', label: 'ค่อยดื่มตอนเย็นทีเดียว', ok: false },
        { id: 'fizzy', label: 'เลือกแต่น้ำอัดลม', ok: false }
      ]
    },
    {
      id: 'school-trip',
      prompt: 'ไปทัศนศึกษา ควรเตรียมอะไร?',
      choices: [
        { id: 'bottle', label: 'เตรียมขวดน้ำส่วนตัว', ok: true },
        { id: 'none', label: 'ไม่ต้องเอาน้ำไป', ok: false },
        { id: 'candy', label: 'เอาลูกอมแทนน้ำ', ok: false }
      ]
    }
  ];

  let queue = [];
  let current = null;

  function buildRoom() {
    room = createDuetRoom({
      gameId: 'hydration',
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
    renderLobbyState('พร้อมเล่นเป็นคู่แล้ว');
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
      startDuet(room);
      nextScenario();
      shell.emit('hydration_duet_start', { roomId: room.roomId, matchId: room.matchId, pairGoal });
    }, 800);
  }

  function renderLobbyState(text) {
    const el = root?.querySelector('[data-role="lobbyState"]');
    if (el) el.textContent = text || '';
  }

  function nextScenario() {
    if (queue.length === 0) {
      queue = shell.rng.shuffle(SCENARIOS).slice(0, total);
    }
    current = queue.shift() || null;
    renderCard();
  }

  function partnerAutoHelp() {
    if (!room || room.status !== 'playing') return;
    const partner = room.players.find((p) => p.playerId === 'cpu-partner');
    if (!partner) return;

    const chance = ctx.diff === 'hard' ? 0.42 : ctx.diff === 'easy' ? 0.7 : 0.56;
    if (!shell.rng.chance(chance)) return;

    const nextContribution = Number(partner.contribution || 0) + 1;
    const nextScore = Number(partner.score || 0) + 90;

    submitDuetContribution(room, 'cpu-partner', {
      score: nextScore,
      contribution: nextContribution,
      progress: nextContribution,
      bestStreak: Number(partner.bestStreak || 0) + 1,
      miss: Number(partner.miss || 0)
    });

    updateBoard();
  }

  function updateBoard() {
    const you = room.players.find((p) => p.playerId === selfId);
    const partner = room.players.find((p) => p.playerId === 'cpu-partner');
    const pct = Math.round(((room.teamScore || 0) / pairGoal) * 100);

    const pairBar = root.querySelector('[data-role="pairBar"]');
    const pairMeta = root.querySelector('[data-role="pairMeta"]');
    const youMeta = root.querySelector('[data-role="youMeta"]');
    const partnerMeta = root.querySelector('[data-role="partnerMeta"]');

    if (pairBar) pairBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (pairMeta) pairMeta.textContent = `${room.teamScore || 0}/${pairGoal}`;
    if (youMeta) youMeta.textContent = `คะแนน ${you?.score || 0} • ช่วยคู่ ${you?.contribution || 0}`;
    if (partnerMeta) partnerMeta.textContent = `คะแนน ${partner?.score || 0} • ช่วยคู่ ${partner?.contribution || 0}`;
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

    submitDuetContribution(room, selfId, {
      score,
      contribution: solved,
      progress: solved,
      bestStreak,
      miss
    });

    shell.setMission(room.teamScore || 0, pairGoal);
    shell.emit('hydration_duet_answer', {
      scenarioId: current.id,
      picked: choice.id,
      correct: ok,
      roomId: room.roomId,
      pairScore: room.teamScore || 0,
      pairGoal
    });

    updateBoard();
    showTip(ok ? 'เยี่ยมเลย' : 'ลองใหม่อีกนิด', ok
      ? 'คำตอบนี้ช่วยให้วางแผนการดื่มน้ำได้ดี'
      : 'ลองเลือกวิธีที่ทำให้ดื่มน้ำสม่ำเสมอมากขึ้น');

    if ((room.teamScore || 0) >= pairGoal) {
      window.setTimeout(() => shell.endGame(buildSummary()), 350);
      return;
    }

    partnerAutoHelp();
    window.setTimeout(nextScenario, 360);
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
      rewards: success ? ['hydration-duet-clear', 'pair-planner'] : ['hydration-duet-finish'],
      coachFeedback: success
        ? ['ช่วยกันวางแผนการดื่มน้ำได้ดีมาก', 'การเล่นเป็นคู่ช่วยให้ตัดสินใจได้แม่นขึ้น']
        : ['ลองช่วยกันเลือกวิธีดื่มน้ำที่เหมาะสมให้สม่ำเสมอมากขึ้น'],
      nextAction: success
        ? 'ลองโหมด coop เพื่อทำเป้าหมาย hydration ของทีม'
        : 'เล่น duet อีกครั้งและพยายามลด miss ให้ต่ำลง',
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

  function renderCard() {
    const card = root?.querySelector('[data-role="card"]');
    if (!card) return;
    if (!current) {
      card.innerHTML = '<div class="hyd-empty">กำลังเตรียมสถานการณ์...</div>';
      return;
    }

    card.innerHTML = `
      <div class="hyd-kicker">Pair Hydration Mission</div>
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
      root.className = 'hyd-duet-root';
      root.innerHTML = `
        <style>
          .hyd-duet-root{min-height:100%;display:grid;gap:16px;grid-template-rows:auto auto 1fr auto;position:relative}
          .hyd-hero,.hyd-tip,.hyd-track{padding:18px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
          .hyd-hero h2{margin:0 0 8px;font-size:28px}.hyd-hero p{margin:0;color:#d7e5ff}
          .hyd-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
          .hyd-cta{padding:12px 16px;border:none;border-radius:999px;background:linear-gradient(180deg,#5be38b,#2cc267);color:#072112;font:inherit;font-weight:800;cursor:pointer}
          .hyd-pair{display:grid;gap:12px;grid-template-columns:1.2fr .8fr .8fr}
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
          @media (max-width:980px){.hyd-pair{grid-template-columns:1fr}}
        </style>
        <section class="hyd-hero">
          <h2>Hydration Duet</h2>
          <p>เล่นเป็นคู่และช่วยกันทำ pair goal เรื่องการดื่มน้ำให้สำเร็จ</p>
          <div class="hyd-actions">
            <button class="hyd-cta" data-action="duetReady">Ready Pair</button>
            <span data-role="lobbyState">รอเริ่มเล่นเป็นคู่</span>
          </div>
        </section>
        <section class="hyd-pair">
          <div class="hyd-track">
            <div class="hyd-track-head"><span>Pair Goal</span><span data-role="pairMeta">0/${pairGoal}</span></div>
            <div class="hyd-track-rail"><div class="hyd-track-fill" data-role="pairBar"></div></div>
          </div>
          <div class="hyd-mini"><strong>You</strong><span data-role="youMeta">คะแนน 0 • ช่วยคู่ 0</span></div>
          <div class="hyd-mini"><strong>Partner</strong><span data-role="partnerMeta">คะแนน 0 • ช่วยคู่ 0</span></div>
        </section>
        <section class="hyd-card" data-role="card"></section>
        <section class="hyd-tip" data-role="tip"><strong>Coach</strong><span>ช่วยกันเลือกแนวทาง hydration ที่ดีที่สุด</span></section>
        <div class="hyd-countdown hyd-hidden" data-role="countdown">3</div>
      `;
      stage.appendChild(root);
      buildRoom();
      renderCard();
      updateBoard();

      const readyBtn = root.querySelector('[data-action="duetReady"]');
      readyBtn?.addEventListener('click', () => {
        readyBtn.disabled = true;
        renderLobbyState('กำลังเริ่มเล่นแบบคู่...');
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
      shell.setMission(0, pairGoal);
      shell.emit('hydration_duet_lobby', { pairGoal });
    },

    async pause() {},
    async resume() {},

    tick() {
      if (room?.status === 'playing') {
        partnerAutoHelp();
        if ((room.teamScore || 0) >= pairGoal) {
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