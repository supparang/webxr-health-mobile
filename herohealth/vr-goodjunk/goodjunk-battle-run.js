// /herohealth/vr-goodjunk/goodjunk-battle-run.js
// FULL PATCH v20260327-GJBATTLE-RUN-R1
(function () {
  'use strict';

  const W = window;
  const D = document;

  const qs = (k, d = '') => {
    try {
      return new URL(W.location.href).searchParams.get(k) ?? d;
    } catch (_) {
      return d;
    }
  };

  const clamp = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const ROOM_ID = String(qs('roomId', qs('room', 'GJ-' + Math.random().toString(36).slice(2, 8)))).toUpperCase().replace(/[^A-Z0-9_-]/g, '') || ('GJ-' + Math.random().toString(36).slice(2, 8).toUpperCase());
  const PID = String(qs('pid', 'anon')).replace(/[^a-zA-Z0-9_-]/g, '') || ('anon-' + Math.random().toString(36).slice(2, 8));
  const NICK = String(qs('name', qs('nick', PID))).trim().slice(0, 24) || PID;
  const DIFF = String(qs('diff', 'normal')).toLowerCase();
  const PLANNED_SEC = clamp(qs('time', '90'), 20, 600);
  const HUB = String(qs('hub', '../hub.html'));
  const MODE = 'battle';

  const GOOD_EMOJIS = ['🥗','🍎','🍌','🥕','🥛','🍉','🍇','🥦'];
  const JUNK_EMOJIS = ['🍟','🍩','🍔','🍭','🧁','🥤','🍫','🍕'];

  const DIFF_CFG = {
    easy:   { spawnMin: 850, spawnMax: 1200, ttlMin: 1700, ttlMax: 2300, attackDmg: 16 },
    normal: { spawnMin: 650, spawnMax: 950,  ttlMin: 1350, ttlMax: 1850, attackDmg: 18 },
    hard:   { spawnMin: 500, spawnMax: 820,  ttlMin: 1050, ttlMax: 1550, attackDmg: 22 }
  };
  const CFG = DIFF_CFG[DIFF] || DIFF_CFG.normal;

  const UI = {
    pillRoom: D.getElementById('pillRoom'),
    pillYou: D.getElementById('pillYou'),
    pillDiff: D.getElementById('pillDiff'),

    hpPct: D.getElementById('hpPct'),
    hpFill: D.getElementById('hpFill'),
    chargePct: D.getElementById('chargePct'),
    chargeFill: D.getElementById('chargeFill'),
    timeLeft: D.getElementById('timeLeft'),
    timeFill: D.getElementById('timeFill'),

    scoreValue: D.getElementById('scoreValue'),
    comboValue: D.getElementById('comboValue'),
    missValue: D.getElementById('missValue'),
    accValue: D.getElementById('accValue'),

    btnAttack: D.getElementById('btnAttack'),
    btnLeave: D.getElementById('btnLeave'),

    noticeText: D.getElementById('noticeText'),
    arena: D.getElementById('arena'),
    countdown: D.getElementById('countdown'),
    livePlayers: D.getElementById('livePlayers'),
    statusLine: D.getElementById('statusLine')
  };

  const S = {
    client: null,
    roomState: { status: 'waiting', plannedSec: PLANNED_SEC },
    players: {},
    opponentPid: '',
    hostLoop: 0,
    spawnLoop: 0,
    uiLoop: 0,
    started: false,
    ended: false,
    targetSeq: 0,
    attackSeen: new Set(),

    hp: 100,
    score: 0,
    combo: 0,
    miss: 0,
    hits: 0,
    badHits: 0,
    totalTap: 0,
    charge: 0
  };

  function setNotice(msg, emoji = '🧑‍🏫') {
    if (UI.noticeText) UI.noticeText.innerHTML = `${emoji} ${esc(msg)}`;
  }

  function calcAcc() {
    return S.totalTap > 0 ? Math.round((S.hits / S.totalTap) * 100) : 0;
  }

  function getRemainingSec() {
    const rs = S.roomState || {};
    const planned = clamp(rs.plannedSec || PLANNED_SEC, 1, 9999);

    if (rs.status === 'playing' && rs.startedAt) {
      const elapsed = Math.floor((Date.now() - Number(rs.startedAt)) / 1000);
      return Math.max(0, planned - elapsed);
    }

    return planned;
  }

  function updateHUD() {
    const acc = calcAcc();
    const remain = getRemainingSec();
    const planned = clamp((S.roomState && S.roomState.plannedSec) || PLANNED_SEC, 1, 9999);

    UI.hpPct.textContent = `${Math.round(S.hp)}%`;
    UI.hpFill.style.width = `${clamp(S.hp, 0, 100)}%`;

    UI.chargePct.textContent = `${Math.round(S.charge)}%`;
    UI.chargeFill.style.width = `${clamp(S.charge, 0, 100)}%`;

    UI.timeLeft.textContent = `${remain}s`;
    UI.timeFill.style.width = `${Math.round((remain / planned) * 100)}%`;

    UI.scoreValue.textContent = String(S.score);
    UI.comboValue.textContent = String(S.combo);
    UI.missValue.textContent = String(S.miss);
    UI.accValue.textContent = `${acc}%`;

    UI.btnAttack.textContent = `⚡ ATTACK READY ${Math.round(S.charge)}%`;
    UI.btnAttack.disabled = !(S.started && !S.ended && S.charge >= 100 && !!S.opponentPid);

    if (UI.statusLine) {
      let txt = `${S.roomState.status || 'waiting'}`;
      if (S.client && S.client.isHost) txt += ' • host';
      if (S.opponentPid) txt += ` • opponent ready`;
      UI.statusLine.textContent = txt;
    }
  }

  function renderPlayers() {
    const players = Object.values(S.players || {});
    if (!players.length) {
      UI.livePlayers.innerHTML = `<div class="player"><div class="left"><div class="avatar">⌛</div><div><div class="name">waiting</div><div class="mini">ยังไม่มีข้อมูลผู้เล่น</div></div></div><div class="badge">...</div></div>`;
      return;
    }

    UI.livePlayers.innerHTML = players.map(p => {
      const mine = p.pid === PID;
      const hp = clamp(p.hp || 0, 0, 100);
      const score = Number(p.score || 0);
      const combo = Number(p.combo || 0);
      const badge = mine ? 'YOU' : (p.connected === false ? 'OFFLINE' : 'LIVE');
      const av = mine ? '🧑' : '⚔️';

      return `
        <div class="player">
          <div class="left">
            <div class="avatar">${av}</div>
            <div>
              <div class="name">${esc(p.nick || p.pid || 'player')}</div>
              <div class="mini">HP ${hp}% • Score ${score} • Combo ${combo}</div>
            </div>
          </div>
          <div class="badge">${badge}</div>
        </div>
      `;
    }).join('');
  }

  function chooseOpponent() {
    const connected = Object.values(S.players || {})
      .filter(p => p && p.connected !== false && p.pid !== PID);

    S.opponentPid = connected[0] ? connected[0].pid : '';
  }

  async function syncSelf(extra = {}) {
    if (!S.client) return;
    try {
      await S.client.updateSelf(Object.assign({
        hp: Math.round(S.hp),
        score: Math.round(S.score),
        combo: Math.round(S.combo),
        miss: Math.round(S.miss),
        acc: calcAcc(),
        hits: Math.round(S.hits),
        badHits: Math.round(S.badHits),
        totalTap: Math.round(S.totalTap),
        charge: Math.round(S.charge),
        status: S.roomState.status || 'waiting'
      }, extra || {}));
    } catch (err) {
      console.error(err);
    }
  }

  function clearTargets() {
    UI.arena.querySelectorAll('.target').forEach(el => el.remove());
  }

  function stopLoops() {
    clearTimeout(S.spawnLoop);
    clearInterval(S.uiLoop);
  }

  function createCountdownText(v) {
    UI.countdown.textContent = String(v);
    UI.countdown.classList.add('show');
  }

  function hideCountdown() {
    UI.countdown.classList.remove('show');
  }

  function spawnTarget() {
    if (!S.started || S.ended) return;

    const rect = UI.arena.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const isGood = Math.random() < 0.68;
    const size = randInt(62, 90);
    const left = randInt(8, Math.max(8, Math.floor(rect.width - size - 8)));
    const top = randInt(8, Math.max(8, Math.floor(rect.height - size - 8)));
    const ttl = randInt(CFG.ttlMin, CFG.ttlMax);
    const emoji = isGood ? pick(GOOD_EMOJIS) : pick(JUNK_EMOJIS);

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `target ${isGood ? 'good' : 'junk'}`;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.innerHTML = `<span>${emoji}</span>`;

    let dead = false;

    const removeTarget = async (reason) => {
      if (dead) return;
      dead = true;
      if (el.isConnected) el.remove();

      if (reason === 'expire' && isGood && S.started && !S.ended) {
        S.miss += 1;
        S.combo = 0;
        S.hp = clamp(S.hp - 4, 0, 100);
        setNotice('พลาดอาหารดี เสีย HP เล็กน้อย', '😵');
        updateHUD();
        await syncSelf();
      }
    };

    el.addEventListener('click', async () => {
      if (dead || !S.started || S.ended) return;

      S.totalTap += 1;

      if (isGood) {
        S.hits += 1;
        S.combo += 1;
        S.score += 10 + Math.min(10, S.combo);
        S.charge = clamp(S.charge + 18, 0, 100);
        setNotice('ดีมาก +คะแนน +ชาร์จพลัง', '🥗');
      } else {
        S.badHits += 1;
        S.miss += 1;
        S.combo = 0;
        S.hp = clamp(S.hp - 10, 0, 100);
        S.charge = clamp(S.charge - 12, 0, 100);
        setNotice('โดน junk! เสีย HP', '🍟');
      }

      updateHUD();
      await syncSelf();
      await removeTarget('tap');
    }, { passive: true });

    UI.arena.appendChild(el);
    setTimeout(() => { removeTarget('expire'); }, ttl);
  }

  function scheduleSpawn() {
    clearTimeout(S.spawnLoop);
    if (!S.started || S.ended) return;

    const delay = randInt(CFG.spawnMin, CFG.spawnMax);
    S.spawnLoop = setTimeout(() => {
      spawnTarget();
      scheduleSpawn();
    }, delay);
  }

  function startPlaying() {
    if (S.started && !S.ended) return;

    S.started = true;
    S.ended = false;
    hideCountdown();
    clearTargets();

    setNotice('เริ่มแล้ว! แตะอาหารดี หลบ junk และชาร์จพลังให้เต็ม', '🚀');
    updateHUD();
    syncSelf({ status: 'playing' });

    clearInterval(S.uiLoop);
    S.uiLoop = setInterval(() => {
      updateHUD();
    }, 200);

    scheduleSpawn();
  }

  function finishPlaying() {
    if (S.ended) return;

    S.started = false;
    S.ended = true;
    stopLoops();
    clearTargets();
    hideCountdown();

    const winnerPid = S.roomState.winnerPid || '';
    const mine = winnerPid && winnerPid === PID;
    const draw = !winnerPid;

    if (draw) {
      setNotice('จบเกมแล้ว • เสมอ', '🤝');
    } else if (mine) {
      setNotice('ชนะแล้ว! เก่งมาก', '🏆');
    } else {
      setNotice('รอบนี้ยังไม่ชนะ ลองอีกครั้งได้เลย', '💪');
    }

    updateHUD();
    syncSelf({ status: 'ended' });
  }

  function winnerFromPlayers(players) {
    const arr = (players || []).slice().sort((a, b) => {
      const hpA = Number(a.hp || 0), hpB = Number(b.hp || 0);
      if (hpB !== hpA) return hpB - hpA;

      const scA = Number(a.score || 0), scB = Number(b.score || 0);
      if (scB !== scA) return scB - scA;

      const acA = Number(a.acc || 0), acB = Number(b.acc || 0);
      if (acB !== acA) return acB - acA;

      return String(a.pid || '').localeCompare(String(b.pid || ''));
    });

    if (!arr.length) return null;
    if (arr.length === 1) return arr[0];

    const a = arr[0], b = arr[1];
    if (
      Number(a.hp || 0) === Number(b.hp || 0) &&
      Number(a.score || 0) === Number(b.score || 0) &&
      Number(a.acc || 0) === Number(b.acc || 0)
    ) return null;

    return a;
  }

  function startHostLoop() {
    clearInterval(S.hostLoop);

    S.hostLoop = setInterval(async () => {
      if (!S.client || !S.client.isHost) return;

      const rs = S.roomState || {};
      const players = Object.values(S.players || {}).filter(Boolean);
      const connected = players.filter(p => p.connected !== false);
      const playingPlayers = connected.length;
      const planned = clamp(rs.plannedSec || PLANNED_SEC, 20, 600);

      try {
        if (rs.status === 'waiting') {
          if (playingPlayers >= 2) {
            await S.client.updateState({
              status: 'countdown',
              plannedSec: planned,
              countdownEndsAt: Date.now() + 3500,
              startedAt: null,
              endedAt: null,
              winnerPid: '',
              reason: ''
            });
          }
          return;
        }

        if (rs.status === 'countdown') {
          const leftMs = Number(rs.countdownEndsAt || 0) - Date.now();
          if (leftMs <= 0) {
            await S.client.updateState({
              status: 'playing',
              plannedSec: planned,
              startedAt: Date.now(),
              endedAt: null,
              winnerPid: '',
              reason: ''
            });
          }
          return;
        }

        if (rs.status === 'playing') {
          if (playingPlayers <= 1) {
            const w = connected[0] || null;
            await S.client.updateState({
              status: 'ended',
              endedAt: Date.now(),
              winnerPid: w ? w.pid : '',
              reason: 'walkover'
            });
            return;
          }

          const dead = connected.find(p => Number(p.hp || 0) <= 0);
          if (dead) {
            const w = winnerFromPlayers(connected);
            await S.client.updateState({
              status: 'ended',
              endedAt: Date.now(),
              winnerPid: w ? w.pid : '',
              reason: 'hp_zero'
            });
            return;
          }

          const startedAt = Number(rs.startedAt || 0);
          if (startedAt > 0 && Date.now() >= startedAt + planned * 1000) {
            const w = winnerFromPlayers(connected);
            await S.client.updateState({
              status: 'ended',
              endedAt: Date.now(),
              winnerPid: w ? w.pid : '',
              reason: 'time_up'
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 250);
  }

  function renderCountdown() {
    const rs = S.roomState || {};
    if (rs.status !== 'countdown') {
      hideCountdown();
      return;
    }

    const leftMs = Number(rs.countdownEndsAt || 0) - Date.now();
    const sec = Math.max(0, Math.ceil(leftMs / 1000));
    createCountdownText(sec > 0 ? sec : 'GO!');
  }

  async function handleAttack(attack) {
    if (!attack || !attack.id) return;
    if (attack.toPid !== PID) return;
    if (S.attackSeen.has(attack.id)) return;
    if (attack.handledBy && attack.handledBy[PID]) return;

    S.attackSeen.add(attack.id);

    const dmg = clamp(attack.dmg || 0, 1, 100);
    S.hp = clamp(S.hp - dmg, 0, 100);

    setNotice(`โดนโจมตี -${dmg} HP`, '💥');
    updateHUD();
    await syncSelf();
    try { await S.client.ackAttack(attack.id); } catch (_) {}
  }

  async function boot() {
    UI.pillRoom.textContent = `ROOM ${ROOM_ID}`;
    UI.pillYou.textContent = `YOU ${NICK}`;
    UI.pillDiff.textContent = `DIFF ${DIFF}`;
    updateHUD();
    setNotice('กำลังเชื่อมห้อง…', '🔌');

    try {
      if (!W.HHAMP || typeof W.HHAMP.createBattleRoom !== 'function') {
        throw new Error('โหลด multiplayer helper ไม่สำเร็จ');
      }

      S.client = await W.HHAMP.createBattleRoom({
        roomId: ROOM_ID,
        pid: PID,
        nick: NICK,
        plannedSec: PLANNED_SEC,
        diff: DIFF,
        mode: MODE
      });

      S.client.onPlayers((players) => {
        S.players = players || {};
        chooseOpponent();
        renderPlayers();
        updateHUD();

        const connected = Object.values(S.players || {}).filter(p => p && p.connected !== false);
        if ((S.roomState.status || 'waiting') === 'waiting') {
          if (connected.length >= 2) {
            setNotice('ครบ 2 คนแล้ว กำลังเตรียมเริ่มเกม', '🎮');
          } else {
            setNotice('รอผู้เล่นอีก 1 คน…', '⌛');
          }
        }
      });

      S.client.onState((roomState) => {
        S.roomState = roomState || {};
        updateHUD();
        renderCountdown();

        if (S.roomState.status === 'waiting') {
          S.started = false;
          S.ended = false;
          hideCountdown();
        }

        if (S.roomState.status === 'countdown') {
          renderCountdown();
        }

        if (S.roomState.status === 'playing') {
          startPlaying();
        }

        if (S.roomState.status === 'ended') {
          finishPlaying();
        }
      });

      S.client.onMeta(() => {
        updateHUD();
      });

      S.client.onAttack((attack) => {
        handleAttack(attack);
      });

      await S.client.connect();
      await syncSelf({ status: 'waiting' });

      renderPlayers();
      updateHUD();
      startHostLoop();

      setInterval(() => {
        if (S.roomState.status === 'countdown') renderCountdown();
      }, 120);

      setNotice('เชื่อมห้องสำเร็จ', '✅');
    } catch (err) {
      console.error(err);
      setNotice(`เชื่อมห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`, '⚠️');
    }
  }

  UI.btnAttack.addEventListener('click', async () => {
    if (!S.started || S.ended) return;
    if (S.charge < 100) return;
    if (!S.opponentPid) {
      setNotice('ยังไม่มีคู่ต่อสู้ให้โจมตี', '🤔');
      return;
    }
    if (!S.client) return;

    try {
      S.charge = 0;
      updateHUD();
      await syncSelf();

      await S.client.sendAttack({
        toPid: S.opponentPid,
        dmg: CFG.attackDmg,
        type: 'charge'
      });

      setNotice(`ปล่อยพลังโจมตีแล้ว -${CFG.attackDmg} HP`, '⚡');
    } catch (err) {
      console.error(err);
      setNotice('ส่งการโจมตีไม่สำเร็จ', '⚠️');
    }
  }, { passive: true });

  UI.btnLeave.addEventListener('click', async () => {
    try {
      if (S.client) await S.client.disconnect();
    } catch (_) {}
    W.location.href = HUB;
  });

  W.addEventListener('beforeunload', () => {
    try {
      if (S.client) S.client.disconnect();
    } catch (_) {}
  });

  boot();
})();