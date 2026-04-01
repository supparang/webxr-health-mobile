'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-race.safe.js
 * GoodJunk Race Safe Bridge
 * FULL PATCH v20260401-race-safe-bridge-final
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.GJRaceSafe && W.GJRaceSafe.__version === '20260401-race-safe-bridge-final') return;

  const $ = (id) => D.getElementById(id);
  const qs = (k, d='') => {
    try { return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch(_) { return d; }
  };

  const ctx = W.__GJ_RUN_CTX__ || W.__GJ_MULTI_RUN_CTX__ || {
    roomId: qs('roomId', qs('room', '')),
    pid: qs('pid', 'anon'),
    name: qs('name', qs('nick', 'Player')),
    mode: 'race',
    diff: qs('diff', 'normal'),
    time: qs('time', '90'),
    hub: qs('hub', '../hub.html')
  };

  const els = {
    pillRoom: $('pillRoom'),
    pillPlayer: $('pillPlayer'),
    pillRole: $('pillRole'),
    pillDiff: $('pillDiff'),
    pillTime: $('pillTime'),

    engineStatusCard: $('engineStatusCard'),
    engineStatusBadge: $('engineStatusBadge'),
    engineStatusTitle: $('engineStatusTitle'),
    engineStatusText: $('engineStatusText'),
    engineStatusSub: $('engineStatusSub'),
    engineMiniMode: $('engineMiniMode'),
    engineMiniRoom: $('engineMiniRoom'),
    engineMiniPlayer: $('engineMiniPlayer'),
    engineSteps: $('engineSteps'),
    engineTip: $('engineTip'),
    engineDebugInfo: $('engineDebugInfo'),

    btnQuickCopyRoom: $('btnQuickCopyRoom'),
    btnQuickBackHub: $('btnQuickBackHub')
  };

  const state = {
    mode: 'race',
    roomId: String(ctx.roomId || ctx.room || '').trim(),
    pid: String(ctx.pid || 'anon').trim(),
    name: String(ctx.name || ctx.nick || 'Player').trim() || 'Player',
    role: String(ctx.role || 'player').trim() || 'player',
    diff: String(ctx.diff || 'normal').trim() || 'normal',
    time: String(ctx.time || '90').trim() || '90',

    status: 'boot',
    score: 0,
    miss: 0,
    bestStreak: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    remainSec: 0,

    room: null,
    players: [],
    summary: null,
    debugLines: [],
    __hideTimer: 0
  };

  function debugPush(line){
    state.debugLines.push(String(line));
    if (state.debugLines.length > 32) state.debugLines.shift();
    renderDebug();
  }

  function renderDebug(extra){
    const lines = [
      `[MODE] ${state.mode}`,
      `[ROOM] ${state.roomId || '-'}`,
      `[PID] ${state.pid || '-'}`,
      `[NAME] ${state.name || '-'}`,
      `[ROLE] ${state.role || '-'}`,
      `[STATUS] ${state.status || '-'}`,
      `[SCORE] ${state.score}`,
      `[MISS] ${state.miss}`,
      `[STREAK] ${state.bestStreak}`,
      `[PLAYERS] ${Array.isArray(state.players) ? state.players.length : 0}`
    ];
    if (extra) lines.push('', String(extra));
    if (state.debugLines.length) {
      lines.push('', ...state.debugLines);
    }
    if (els.engineDebugInfo) els.engineDebugInfo.textContent = lines.join('\n');
  }

  function heroDisplay(){
    return `${state.name || state.pid || 'Player'}`;
  }

  function setText(el, text){
    if (el) el.textContent = String(text == null ? '' : text);
  }

  function setHtml(el, html){
    if (el) el.innerHTML = String(html == null ? '' : html);
  }

  function setStatus(title, text, sub, badge){
    if (badge && els.engineStatusBadge) els.engineStatusBadge.textContent = badge;
    setText(els.engineStatusTitle, title || '');
    setText(els.engineStatusText, text || '');
    if (els.engineStatusText) els.engineStatusText.className = '';
    if (sub != null) setText(els.engineStatusSub, sub);
  }

  function setWarn(title, text, sub, badge){
    if (badge && els.engineStatusBadge) els.engineStatusBadge.textContent = badge;
    setText(els.engineStatusTitle, title || '');
    setText(els.engineStatusText, text || '');
    if (els.engineStatusText) els.engineStatusText.className = 'error';
    if (sub != null) setText(els.engineStatusSub, sub);
  }

  function setTip(html){
    if (els.engineTip) els.engineTip.innerHTML = html;
  }

  function setSteps(items){
    if (!els.engineSteps || !Array.isArray(items)) return;
    els.engineSteps.innerHTML = items.map((row) => {
      return `<div class="status-step"><span>${row.icon || '•'}</span><span>${row.text || ''}</span></div>`;
    }).join('');
  }

  function showCard(){
    clearTimeout(state.__hideTimer);
    if (els.engineStatusCard) els.engineStatusCard.style.display = '';
  }

  function hideCardSoon(ms=1200){
    clearTimeout(state.__hideTimer);
    if (!els.engineStatusCard) return;
    state.__hideTimer = setTimeout(() => {
      if (els.engineStatusCard) els.engineStatusCard.style.display = 'none';
    }, ms);
  }

  function updateMini(){
    setText(els.engineMiniMode, `MODE • ${String(state.mode || 'race').toUpperCase()}`);
    setText(els.engineMiniRoom, `ROOM • ${state.roomId || '-'}`);
    setText(els.engineMiniPlayer, `HERO • ${heroDisplay()}`);

    setText(els.pillRoom, `ROOM • ${state.roomId || '-'}`);
    setText(els.pillPlayer, `HERO • ${heroDisplay()}`);
    setText(els.pillRole, `ROLE • ${state.role || 'player'}`);
    setText(els.pillDiff, `LEVEL • ${state.diff || 'normal'}`);
    setText(els.pillTime, `TIME • ${state.time || '90'}`);
  }

  function findMe(){
    const arr = Array.isArray(state.players) ? state.players : [];
    return arr.find((p) => {
      const pid = String((p && (p.pid || p.id)) || '');
      return pid && pid === state.pid;
    }) || null;
  }

  function renderLoading(){
    state.status = 'loading';
    showCard();
    updateMini();
    setStatus(
      'กำลังเตรียมเกม…',
      'กำลังโหลด race engine',
      'เกมจะเริ่มเองเมื่อโหลดพร้อม ระหว่างเล่นให้ดูคะแนน เวลา และห้องเล่นด้านบน',
      '🏁'
    );
    setSteps([
      { icon:'1️⃣', text:'รอให้หน้าเกมโหลดให้พร้อมก่อน' },
      { icon:'2️⃣', text:'เมื่อเริ่มแล้ว ให้แตะเก็บอาหารดีให้ไว' },
      { icon:'3️⃣', text:'พยายามทำคะแนนให้มากที่สุดในรอบนี้' }
    ]);
    setTip('<strong>Tip:</strong> โหมดนี้เน้นความไวและความแม่นในการเก็บอาหารดี');
    renderDebug();
  }

  function renderWaiting(text){
    state.status = 'waiting';
    showCard();
    updateMini();

    const players = Array.isArray(state.players) ? state.players.length : 0;
    const me = findMe();
    const ready = me && (me.ready === true || String(me.phase || '') === 'run');

    setStatus(
      'กำลังรอเริ่มรอบ…',
      text || `มีผู้เล่นในห้อง ${players} คน`,
      ready
        ? 'คุณพร้อมแล้ว รอสัญญาณเริ่มจาก host'
        : 'ระบบกำลังรอข้อมูลห้องหรือรอ host เริ่มเกม',
      '⏳'
    );

    setSteps([
      { icon:'👀', text:'ตรวจ room code ให้ตรงกันทั้งสองเครื่อง' },
      { icon:'✅', text:'เมื่อ host กดเริ่ม ระบบจะพาเข้าเล่นพร้อมกัน' },
      { icon:'🏁', text:'เตรียมแตะเก็บอาหารดีให้ไวที่สุด' }
    ]);

    setTip('<strong>รอสักครู่:</strong> เมื่อห้องพร้อมแล้ว เกมจะเริ่มเอง');
    renderDebug();
  }

  function renderCountdown(sec){
    state.status = 'countdown';
    showCard();
    updateMini();

    setStatus(
      'กำลังนับถอยหลัง…',
      sec > 0 ? `เริ่มแข่งใน ${sec}` : 'GO!',
      'ทุกเครื่องจะเริ่มเล่นพร้อมกัน',
      '⏱️'
    );

    setSteps([
      { icon:'🎯', text:'เตรียมโฟกัสอาหารดี' },
      { icon:'⚡', text:'อย่าแตะอาหารขยะ' },
      { icon:'🏆', text:'ทำคะแนนให้มากที่สุดเพื่อขึ้นอันดับ' }
    ]);

    setTip('<strong>พร้อมแล้ว:</strong> อีกอึดใจเดียวจะเริ่มแข่ง');
    renderDebug();
  }

  function renderRunning(){
    state.status = 'running';
    updateMini();

    const remain = Number(state.remainSec || 0);
    const runningText = [
      `คะแนน ${state.score}`,
      remain > 0 ? `เวลาเหลือ ${remain}s` : '',
      state.bestStreak > 0 ? `best streak ${state.bestStreak}` : ''
    ].filter(Boolean).join(' • ');

    setStatus(
      'กำลังเล่นอยู่!',
      runningText || 'แตะเก็บอาหารดีให้ไวที่สุด',
      'ระบบกำลังเก็บคะแนนของรอบนี้อยู่',
      '🎮'
    );

    setSteps([
      { icon:'🍎', text:'แตะอาหารดีเพื่อเพิ่มคะแนน' },
      { icon:'🚫', text:'หลีกเลี่ยง junk เพื่อลด miss' },
      { icon:'🏅', text:'ยิ่ง streak สูง ยิ่งเล่นลื่น' }
    ]);

    const tip = state.goodHit > state.junkHit
      ? '<strong>ดีมาก:</strong> ตอนนี้เก็บอาหารดีได้มากกว่าของไม่ดี'
      : '<strong>ระวัง:</strong> พยายามแตะเฉพาะอาหารดีให้แม่นขึ้น';

    setTip(tip);

    if (els.engineStatusCard && els.engineStatusCard.style.display !== 'none') {
      hideCardSoon(950);
    }

    renderDebug();
  }

  function renderEnded(summary){
    state.status = 'ended';
    showCard();
    updateMini();

    const rank = Number(summary && (summary.rank ?? summary.place), 0);
    const title = rank === 1 ? 'จบรอบแล้ว! คุณชนะ' : 'จบรอบแล้ว!';
    const badge = rank === 1 ? '🏆' : '🏁';

    setStatus(
      title,
      `คะแนน ${summary && summary.score != null ? summary.score : state.score}`,
      summary && summary.result ? summary.result : 'กำลังแสดงสรุปผลของรอบนี้',
      badge
    );

    setSteps([
      { icon:'📊', text:'กำลังสรุปผลการแข่งขัน' },
      { icon:'✨', text:'ตรวจอันดับและคะแนนของคุณ' },
      { icon:'🔁', text:'กดเล่นใหม่ได้หลังดูสรุปเสร็จ' }
    ]);

    setTip('<strong>เรียบร้อย:</strong> รอบนี้จบแล้ว ดู summary ได้เลย');
    renderDebug();
  }

  function emitSummary(detail){
    try { W.dispatchEvent(new CustomEvent('gj:race-summary', { detail: detail || {} })); } catch(_) {}
    try { W.dispatchEvent(new CustomEvent('gj:summary', { detail: detail || {} })); } catch(_) {}
    try { W.dispatchEvent(new CustomEvent('hha:summary', { detail: detail || {} })); } catch(_) {}
  }

  function copyRoom(){
    const text = String(state.roomId || '').trim();
    if (!text) return Promise.reject(new Error('empty'));

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      try {
        const ta = D.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        D.body.appendChild(ta);
        ta.select();
        const ok = D.execCommand('copy');
        ta.remove();
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  function wireQuickActions(){
    if (els.btnQuickCopyRoom && !els.btnQuickCopyRoom.__wiredRaceSafe) {
      els.btnQuickCopyRoom.__wiredRaceSafe = true;
      els.btnQuickCopyRoom.addEventListener('click', () => {
        copyRoom()
          .then(() => setTip('<strong>คัดลอกแล้ว:</strong> ส่ง room code นี้ให้อีกเครื่องได้เลย'))
          .catch(() => setTip('<strong>คัดลอกไม่สำเร็จ:</strong> ใช้ข้อความ ROOM ด้านบนแทน'));
      });
    }

    if (els.btnQuickBackHub && !els.btnQuickBackHub.__wiredRaceSafe) {
      els.btnQuickBackHub.__wiredRaceSafe = true;
      els.btnQuickBackHub.addEventListener('click', () => {
        location.href = ctx.hub || '../hub.html';
      });
    }
  }

  const api = {
    __version: '20260401-race-safe-bridge-final',

    state,

    setState(patch){
      state.room = Object.assign({}, state.room || {}, patch || {});
      if (patch && patch.roomId) state.roomId = String(patch.roomId || '');
      if (patch && patch.status) state.status = String(patch.status || '');
      if (patch && patch.mode) state.mode = String(patch.mode || 'race');
      debugPush(`setState status=${patch && patch.status ? patch.status : '-'}`);
      updateMini();
      renderDebug();
      return state.room;
    },

    setRoomState(room){
      state.room = Object.assign({}, state.room || {}, room || {});
      if (room && room.roomId) state.roomId = String(room.roomId || state.roomId || '');
      if (room && room.status) state.status = String(room.status || state.status || 'boot');
      debugPush(`setRoomState status=${room && room.status ? room.status : '-'}`);
      updateMini();

      const s = String(room && room.status || '');
      if (s === 'waiting') renderWaiting();
      else if (s === 'countdown') renderCountdown(Math.max(0, Math.ceil((Number(room.startAt || room.countdownEndsAt || 0) - Date.now()) / 1000)));
      else if (s === 'running' || s === 'playing') renderRunning();

      renderDebug();
      return state.room;
    },

    setPlayers(players){
      state.players = Array.isArray(players) ? players.slice() : [];
      debugPush(`setPlayers count=${state.players.length}`);
      updateMini();
      renderDebug();
      return state.players;
    },

    syncPlayers(players){
      return api.setPlayers(players);
    },

    syncRoom(room){
      if (!room || typeof room !== 'object') return;
      if (room.meta && typeof room.meta === 'object') {
        if (room.meta.roomId) state.roomId = String(room.meta.roomId || state.roomId || '');
      }
      if (room.state && typeof room.state === 'object') {
        api.setRoomState({
          roomId: state.roomId,
          status: room.state.status,
          startAt: room.state.startAt,
          countdownEndsAt: room.state.countdownEndsAt,
          participantIds: room.state.participantIds
        });
      }
      if (room.players) {
        api.setPlayers(Array.isArray(room.players) ? room.players : Object.values(room.players));
      }
      renderDebug();
    },

    setScore(score){
      state.score = Number(score || 0);
      updateMini();
      if (state.status === 'running') renderRunning();
      renderDebug();
    },

    updateHud(hud){
      hud = hud || {};
      if (hud.score != null) state.score = Number(hud.score || 0);
      if (hud.miss != null) state.miss = Number(hud.miss || 0);
      if (hud.bestStreak != null) state.bestStreak = Number(hud.bestStreak || 0);
      if (hud.goodHit != null) state.goodHit = Number(hud.goodHit || 0);
      if (hud.junkHit != null) state.junkHit = Number(hud.junkHit || 0);
      if (hud.goodMiss != null) state.goodMiss = Number(hud.goodMiss || 0);
      if (hud.remainSec != null) state.remainSec = Number(hud.remainSec || 0);

      if (state.status === 'countdown') {
        renderCountdown(Math.max(0, Math.ceil(state.remainSec)));
      } else if (state.status === 'running' || state.status === 'playing') {
        renderRunning();
      } else {
        renderDebug();
      }
    },

    setSummary(summary){
      state.summary = summary || null;
      debugPush('setSummary called');
      if (summary) {
        renderEnded(summary);
        emitSummary(summary);
      }
      return state.summary;
    },

    finishGame(detail){
      state.summary = detail || {};
      debugPush('finishGame called');
      renderEnded(state.summary);
      emitSummary(state.summary);
    },

    onJudge(detail){
      if (!detail || typeof detail !== 'object') return;
      if (detail.good === true) {
        state.goodHit += 1;
      } else if (detail.good === false) {
        state.junkHit += 1;
      }
      if (detail.miss) state.miss += 1;
      renderDebug();
    },

    onDamage(detail){
      debugPush(`onDamage ${JSON.stringify(detail || {})}`);
      renderDebug();
    },

    onAttackCharge(detail){
      debugPush(`onAttackCharge ${JSON.stringify(detail || {})}`);
      renderDebug();
    },

    showLoading(msg){
      state.status = 'loading';
      showCard();
      updateMini();
      renderLoading();
      if (msg) {
        setText(els.engineStatusText, msg);
        renderDebug(msg);
      }
    },

    showWarn(msg){
      state.status = 'warn';
      showCard();
      updateMini();
      setWarn(
        'กำลังรอข้อมูลห้อง…',
        msg || 'กำลังรอข้อมูลจากห้อง race',
        'ถ้าหน้านี้ค้างนาน ให้ตรวจว่า room code ตรงกันและ host เริ่มเกมแล้ว',
        '⚠️'
      );
      setSteps([
        { icon:'🧭', text:'ตรวจว่า room code ของทั้งสองเครื่องตรงกัน' },
        { icon:'👑', text:'ให้ host กด Start Race จาก lobby' },
        { icon:'🔄', text:'ถ้ายังค้าง ลอง refresh แล้วเข้าห้องใหม่' }
      ]);
      setTip('<strong>คำเตือน:</strong> ระบบกำลังรอข้อมูลสำคัญจากห้อง');
      renderDebug(msg);
    },

    showError(msg){
      state.status = 'error';
      showCard();
      updateMini();
      setWarn(
        'เกิดปัญหาในการโหลด',
        msg || 'โหลดเกมไม่สำเร็จ',
        'ตรวจ path ของไฟล์ core / controller / firebase แล้วลองใหม่',
        '❌'
      );
      setSteps([
        { icon:'📁', text:'ตรวจชื่อไฟล์ core และ controller ให้ตรงกับไฟล์จริง' },
        { icon:'🔥', text:'ตรวจ firebase config และ rules' },
        { icon:'🔁', text:'refresh ใหม่แล้วลองอีกครั้ง' }
      ]);
      setTip('<strong>ยังไม่พร้อม:</strong> มีบางอย่างโหลดไม่สำเร็จ');
      renderDebug(msg);
    },

    clearMessage(){
      if (state.status === 'running' || state.status === 'playing') {
        renderRunning();
      } else {
        renderDebug();
      }
    },

    debug(text){
      renderDebug(text);
    }
  };

  W.GJRaceSafe = api;
  W.RaceSafe = api;

  wireQuickActions();
  renderLoading();
  debugPush('race safe bridge ready');
})();