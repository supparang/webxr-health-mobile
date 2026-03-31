(function () {
  'use strict';

  const ROOM_ROOT = 'hha-battle/groups/raceRooms';

  function num(v, d = 0) {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function now() {
    return Date.now();
  }

  function cleanRoom(v) {
    return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  }

  function cleanName(v, fallback = 'ผู้เล่น') {
    const s = String(v || '').replace(/[^\wก-๙ _-]/g, '').trim().slice(0, 24);
    return s || fallback;
  }

  function waitFirebaseReady(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const fb = window.HHA_FIREBASE;
      if (fb && fb.ready && fb.auth && fb.db) {
        resolve(fb);
        return;
      }

      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(window.HHA_FIREBASE?.error || 'Firebase not initialized'));
      }, timeoutMs);

      function onReady() {
        if (done) return;
        done = true;
        cleanup();
        resolve(window.HHA_FIREBASE);
      }

      function onError(e) {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(e?.detail?.message || window.HHA_FIREBASE?.error || 'Firebase init failed'));
      }

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('hha:firebase-ready', onReady);
        window.removeEventListener('hha:firebase-error', onError);
      }

      window.addEventListener('hha:firebase-ready', onReady, { once: true });
      window.addEventListener('hha:firebase-error', onError, { once: true });
    });
  }

  function createHud() {
    let el = document.getElementById('groupsRaceHud');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'groupsRaceHud';
    el.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:12px',
      'z-index:9999',
      'min-width:220px',
      'max-width:min(86vw,320px)',
      'padding:12px 14px',
      'border-radius:18px',
      'background:rgba(9,20,49,.86)',
      'border:1px solid rgba(124,168,255,.18)',
      'box-shadow:0 14px 40px rgba(0,0,0,.35)',
      'color:#eef4ff',
      'font:600 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'backdrop-filter:blur(6px)'
    ].join(';');

    el.innerHTML = `
      <div style="font-weight:900;font-size:13px;opacity:.9;margin-bottom:6px;">🏁 Groups Race</div>
      <div id="groupsRaceHudRoom" style="font-size:12px;opacity:.8;">Room: -</div>
      <div id="groupsRaceHudName" style="font-size:12px;opacity:.8;">Player: -</div>
      <div id="groupsRaceHudStatus" style="margin-top:6px;font-weight:900;">พร้อมใช้งาน</div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function setHudText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function defaultAccuracy(correct, wrong) {
    const total = num(correct) + num(wrong);
    return total > 0 ? Math.round((num(correct) / total) * 100) : 0;
  }

  function buildCtx() {
    const q = new URLSearchParams(location.search);
    return {
      mode: q.get('mode') || '',
      roomId: cleanRoom(q.get('roomId') || q.get('room')),
      name: cleanName(q.get('name') || q.get('nick') || localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') || 'ผู้เล่น'),
      diff: q.get('diff') || 'normal',
      timeSec: num(q.get('timeSec') || q.get('time'), 60),
      startAt: num(q.get('startAt'), 0),
      hub: q.get('hub') || 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html',
      game: q.get('game') || 'groups',
      run: q.get('run') || 'play',
      zone: q.get('zone') || 'nutrition',
      seed: q.get('seed') || '',
      pid: q.get('pid') || '',
      studyId: q.get('studyId') || ''
    };
  }

  function createGroupsRaceHooks(options = {}) {
    const ctx = buildCtx();
    const state = {
      ctx,
      fb: null,
      uid: '',
      roomRef: null,
      unsub: null,
      liveTimer: null,
      redirecting: false,
      lastRoom: null,
      startedAtLocal: 0,
      finished: false
    };

    const opts = {
      gamePath: options.gamePath || './groups.html',
      onStatus: typeof options.onStatus === 'function' ? options.onStatus : null,
      onRoomValue: typeof options.onRoomValue === 'function' ? options.onRoomValue : null,
      getMetrics: typeof options.getMetrics === 'function' ? options.getMetrics : null,
      summaryKey: options.summaryKey || 'HHA_GROUPS_RACE_LAST_SUMMARY'
    };

    function isRaceMode() {
      return ctx.mode === 'race' && !!ctx.roomId;
    }

    function emitStatus(message) {
      console.log('[Groups Race Hooks]', message);
      createHud();
      setHudText('groupsRaceHudRoom', `Room: ${ctx.roomId || '-'}`);
      setHudText('groupsRaceHudName', `Player: ${ctx.name || '-'}`);
      setHudText('groupsRaceHudStatus', message);
      if (opts.onStatus) opts.onStatus(message);
    }

    async function init() {
      if (!isRaceMode()) {
        return { enabled: false, ctx };
      }

      createHud();
      emitStatus('กำลังเชื่อมต่อ race room...');
      state.fb = await waitFirebaseReady();
      state.uid = state.fb.auth.currentUser?.uid || window.HHA_FIREBASE?.uid || '';
      if (!state.uid) throw new Error('ไม่พบ uid ของผู้เล่น');

      state.roomRef = state.fb.db.ref(`${ROOM_ROOT}/${ctx.roomId}`);

      await ensurePlayerNode();
      attachRoomListener();
      emitStatus('เชื่อมต่อ race room สำเร็จ');
      return { enabled: true, ctx };
    }

    async function ensurePlayerNode() {
      const playerRef = state.fb.db.ref(`${ROOM_ROOT}/${ctx.roomId}/players/${state.uid}`);
      const snap = await playerRef.once('value');
      const old = snap.val() || {};

      await playerRef.update({
        uid: state.uid,
        name: ctx.name,
        ready: true,
        connected: true,
        updatedAt: now(),
        joinedAt: num(old.joinedAt, now())
      });

      try {
        playerRef.child('connected').onDisconnect().set(false);
        playerRef.child('updatedAt').onDisconnect().set(now());
      } catch (_) {}
    }

    function attachRoomListener() {
      if (!state.roomRef) return;
      const fn = (snap) => {
        const room = snap.val();
        state.lastRoom = room || null;
        if (opts.onRoomValue) opts.onRoomValue(room);
      };
      state.roomRef.on('value', fn);
      state.unsub = fn;
    }

    async function waitUntilStart() {
      if (!isRaceMode()) return;
      const startAt = num(ctx.startAt || state.lastRoom?.startAt, 0);

      if (!startAt) {
        emitStatus('ไม่มี startAt ใช้เริ่มเกมทันที');
        state.startedAtLocal = now();
        await markRunning();
        return;
      }

      await new Promise((resolve) => {
        const timer = setInterval(() => {
          const left = startAt - now();
          if (left <= 0) {
            clearInterval(timer);
            resolve();
            return;
          }
          emitStatus(`เริ่มแข่งใน ${Math.ceil(left / 1000)} วินาที`);
        }, 120);
      });

      state.startedAtLocal = now();
      await markRunning();
      emitStatus('เริ่มแข่ง!');
    }

    async function markRunning() {
      if (!isRaceMode()) return;
      try {
        const updates = {
          updatedAt: now()
        };

        if (state.uid) {
          updates[`players/${state.uid}/updatedAt`] = now();
          updates[`players/${state.uid}/ready`] = true;
          updates[`players/${state.uid}/connected`] = true;
        }

        const room = state.lastRoom || {};
        if (room.status !== 'running' && room.status !== 'started') {
          updates.status = 'running';
          updates.runningAt = now();
        }

        await state.roomRef.update(updates);
      } catch (err) {
        console.warn('[Groups Race Hooks] markRunning failed', err);
      }
    }

    async function updateLive(partial = null) {
      if (!isRaceMode() || !state.uid || state.finished) return;
      if (!partial && opts.getMetrics) partial = opts.getMetrics();
      if (!partial) return;

      const live = {
        score: num(partial.score, 0),
        correct: num(partial.correct, 0),
        wrong: num(partial.wrong, 0),
        accuracy: num(
          partial.accuracy,
          defaultAccuracy(partial.correct, partial.wrong)
        ),
        updatedAt: now()
      };

      try {
        await state.roomRef.child(`players/${state.uid}/live`).update(live);
        await state.roomRef.child(`players/${state.uid}`).update({
          updatedAt: now(),
          connected: true
        });
      } catch (err) {
        console.warn('[Groups Race Hooks] updateLive failed', err);
      }
    }

    function startAutoLive(intervalMs = 1500) {
      if (!isRaceMode()) return;
      stopAutoLive();
      state.liveTimer = setInterval(() => {
        updateLive().catch(() => {});
      }, Math.max(600, num(intervalMs, 1500)));
    }

    function stopAutoLive() {
      if (state.liveTimer) {
        clearInterval(state.liveTimer);
        state.liveTimer = null;
      }
    }

    async function finish(finalMetrics = null) {
      if (!isRaceMode() || state.finished) return null;
      state.finished = true;
      stopAutoLive();

      if (!finalMetrics && opts.getMetrics) finalMetrics = opts.getMetrics();
      finalMetrics = finalMetrics || {};

      const score = num(finalMetrics.score, 0);
      const correct = num(finalMetrics.correct, 0);
      const wrong = num(finalMetrics.wrong, 0);
      const accuracy = num(
        finalMetrics.accuracy,
        defaultAccuracy(correct, wrong)
      );
      const durationMs = num(
        finalMetrics.durationMs,
        state.startedAtLocal ? Math.max(0, now() - state.startedAtLocal) : 0
      );

      const result = {
        uid: state.uid,
        name: ctx.name,
        roomId: ctx.roomId,
        mode: 'race',
        game: ctx.game,
        diff: ctx.diff,
        timeSec: ctx.timeSec,
        score,
        correct,
        wrong,
        accuracy,
        durationMs,
        finishedAt: now(),
        extra: finalMetrics.extra || null
      };

      await state.roomRef.child(`results/${state.uid}`).set(result);
      await state.roomRef.child(`players/${state.uid}`).update({
        finished: true,
        connected: true,
        updatedAt: now()
      });

      tryCompleteRoom();
      saveLastSummary(result);
      emitStatus('ส่งผลการแข่งขันแล้ว');
      return result;
    }

    async function tryCompleteRoom() {
      try {
        const snap = await state.roomRef.once('value');
        const room = snap.val() || {};
        const players = Object.values(room.players || {}).filter(Boolean);
        const results = Object.values(room.results || {}).filter(Boolean);

        if (players.length >= 1 && results.length >= players.length) {
          const sorted = results
            .slice()
            .sort((a, b) => {
              const ds = num(b.score) - num(a.score);
              if (ds) return ds;
              const da = num(b.accuracy) - num(a.accuracy);
              if (da) return da;
              return num(a.durationMs, 999999999) - num(b.durationMs, 999999999);
            })
            .map((r, i) => ({ ...r, rank: i + 1 }));

          const rankMap = {};
          sorted.forEach((r) => {
            if (r.uid) rankMap[r.uid] = r.rank;
          });

          await state.roomRef.update({
            status: 'ended',
            endedAt: now()
          });

          for (const r of sorted) {
            if (!r.uid) continue;
            await state.roomRef.child(`results/${r.uid}/rank`).set(rankMap[r.uid]);
          }
        }
      } catch (err) {
        console.warn('[Groups Race Hooks] tryCompleteRoom failed', err);
      }
    }

    function saveLastSummary(result) {
      try {
        localStorage.setItem(opts.summaryKey, JSON.stringify(result));
      } catch (_) {}
    }

    function destroy() {
      stopAutoLive();
      if (state.roomRef && state.unsub) {
        state.roomRef.off('value', state.unsub);
      }
    }

    function getCtx() {
      return { ...ctx };
    }

    function buildBackToHubUrl() {
      return ctx.hub;
    }

    function buildLobbyUrl() {
      const u = new URL('./groups-race-lobby.html', location.href);
      if (ctx.hub) u.searchParams.set('hub', ctx.hub);
      if (ctx.zone) u.searchParams.set('zone', ctx.zone);
      if (ctx.game) u.searchParams.set('game', ctx.game);
      if (ctx.run) u.searchParams.set('run', ctx.run);
      if (ctx.seed) u.searchParams.set('seed', ctx.seed);
      if (ctx.pid) u.searchParams.set('pid', ctx.pid);
      if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
      return u.toString();
    }

    return {
      init,
      waitUntilStart,
      markRunning,
      updateLive,
      startAutoLive,
      stopAutoLive,
      finish,
      destroy,
      getCtx,
      isRaceMode,
      buildBackToHubUrl,
      buildLobbyUrl
    };
  }

  window.createGroupsRaceHooks = createGroupsRaceHooks;
})();