// /herohealth/vr-groups/groups.race.bridge.js
export async function createGroupsRaceBridge({ ctx, ui, core, logger, patch }) {
  const W = window;
  const roomCode = String(ctx.roomCode || '').trim();
  if (!roomCode) throw new Error('missing roomCode');

  const ROOT = `rooms/groups/race/${roomCode}`;
  const HEARTBEAT_MS = 2500;

  let db = null;
  let auth = null;
  let uid = '';
  let roomRef = null;
  let hb = 0;
  let joinedAt = Date.now();
  let metaOff = null;

  await ensureFirebase();

  return {
    attach,
    detach,
    submitFinalResult
  };

  async function attach() {
    roomRef = db.ref(ROOT);

    const playerSnap = await roomRef.child(`players/${uid}`).once('value');
    if (playerSnap.exists()) {
      joinedAt = Number(playerSnap.val()?.joinedAt || joinedAt);
    }

    await heartbeat();

    metaOff = roomRef.child('meta').on('value', async (snap) => {
      const meta = snap.val() || {};

      if (ctx.isHost && meta.state === 'countdown') {
        const startAt = Number(meta.startedAt || 0);
        if (startAt > 0 && Date.now() >= startAt) {
          try {
            await roomRef.child('meta').update({
              state: 'running',
              updatedAt: Date.now()
            });
          } catch (_) {}
        }
      }

      if (meta.state === 'aborted') {
        logger?.event?.('race_room_aborted', { patch, roomCode });
      }
    });

    hb = W.setInterval(() => {
      heartbeat().catch((err) => {
        logger?.event?.('race_heartbeat_error', {
          message: err?.message || String(err || 'unknown')
        });
      });
    }, HEARTBEAT_MS);

    core.onRaceProgress = async (payload = {}) => {
      await roomRef.child(`progress/${uid}`).set({
        updatedAt: Number(payload.updatedAt || Date.now()),
        phase: String(payload.phase || ''),
        score: Number(payload.score || 0),
        miss: Number(payload.miss || 0),
        bestStreak: Number(payload.bestStreak || 0),
        accuracy: Number(payload.accuracy || 0),
        progress: Number(payload.progress || 0),
        goalId: String(payload.goal?.id || ''),
        goalDone: Number(payload.goal?.done || 0),
        goalNeed: Number(payload.goal?.need || 0),
        timeLeftMs: Number(payload.timeLeftMs || 0)
      }).catch(() => {});
    };

    core.onRaceFinish = async (payload = {}) => {
      await submitFinalResult(payload);
    };

    core.onRaceExit = async (payload = {}) => {
      await roomRef.child(`progress/${uid}`).set({
        updatedAt: Number(payload.updatedAt || Date.now()),
        phase: String(payload.phase || 'exit'),
        score: Number(payload.score || 0),
        miss: Number(payload.miss || 0),
        bestStreak: Number(payload.bestStreak || 0),
        exitReason: String(payload.reason || 'manual_exit')
      }).catch(() => {});
    };

    W.addEventListener('pagehide', detach, { passive: true });
    W.addEventListener('beforeunload', detach, { passive: true });
  }

  async function detach() {
    if (hb) {
      clearInterval(hb);
      hb = 0;
    }

    try {
      if (roomRef && uid) {
        await roomRef.child(`players/${uid}`).update({
          ready: false,
          lastPingAt: 0
        });
      }
    } catch (_) {}

    if (roomRef && metaOff) {
      roomRef.child('meta').off('value', metaOff);
    }
  }

  async function heartbeat() {
    const ts = Date.now();
    await roomRef.child(`players/${uid}`).update({
      uid,
      pid: ctx.pid,
      name: ctx.name,
      ready: true,
      role: ctx.isHost ? 'host' : 'player',
      joinedAt,
      lastPingAt: ts
    });
  }

  async function submitFinalResult(payload = {}) {
    const summary = payload.summary || {};
    const ts = Number(payload.updatedAt || Date.now());

    await roomRef.child(`results/${uid}`).set({
      uid,
      pid: ctx.pid,
      score: Number(payload.score || summary.score || 0),
      miss: Number(payload.miss || summary.miss || 0),
      bestStreak: Number(payload.bestStreak || summary.bestStreak || 0),
      finished: true,
      updatedAt: ts
    });

    await roomRef.child(`progress/${uid}`).set({
      updatedAt: ts,
      phase: 'summary',
      score: Number(payload.score || summary.score || 0),
      miss: Number(payload.miss || summary.miss || 0),
      bestStreak: Number(payload.bestStreak || summary.bestStreak || 0),
      accuracy: Number(payload.accuracy || summary.accuracy || 0),
      progress: 100
    });

    if (ctx.isHost) {
      try {
        await roomRef.child('meta').update({
          state: 'ended',
          updatedAt: ts
        });
      } catch (_) {}
    }
  }

  async function ensureFirebase() {
    if (W.HHA_FIREBASE && W.HHA_FIREBASE.db) {
      db = W.HHA_FIREBASE.db;
      auth = W.HHA_FIREBASE.auth || null;
    } else if (W.HHA_FIREBASE_READY && typeof W.HHA_FIREBASE_READY.then === 'function') {
      const ctxFb = await W.HHA_FIREBASE_READY;
      db = ctxFb.db;
      auth = ctxFb.auth || null;
    } else if (W.firebase) {
      db = firebase.database();
      auth = firebase.auth();
    }

    if (!db) throw new Error('Firebase db unavailable');
    if (!auth) throw new Error('Firebase auth unavailable');

    if (!auth.currentUser) {
      await auth.signInAnonymously();
    }

    uid = auth.currentUser?.uid || '';
    if (!uid) {
      uid = await new Promise((resolve, reject) => {
        const off = auth.onAuthStateChanged((user) => {
          if (user?.uid) {
            off();
            resolve(user.uid);
          }
        }, reject);
      });
    }
  }
}