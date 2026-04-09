// groups.race.bridge.js
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

  await ensureFirebase();

  return {
    attach,
    detach,
    submitFinalResult
  };

  async function attach() {
    roomRef = db.ref(ROOT);

    await heartbeat();

    roomRef.child('meta').on('value', (snap) => {
      const meta = snap.val() || {};
      if (meta.state === 'aborted' || meta.state === 'ended') {
        // จะให้โชว์ summary หรือกลับ lobby ก็ได้
      }
    });

    hb = W.setInterval(() => {
      heartbeat().catch(console.warn);
    }, HEARTBEAT_MS);

    bindCoreHooks();
  }

  function detach() {
    if (hb) {
      clearInterval(hb);
      hb = 0;
    }
    if (roomRef) {
      roomRef.child('meta').off();
    }
  }

  function bindCoreHooks() {
    // ตัวอย่าง: ให้ core เรียก callback ระหว่างเล่น
    core.onRaceProgress = async (payload = {}) => {
      if (!roomRef) return;
      await roomRef.child(`progress/${uid}`).set({
        updatedAt: Date.now(),
        score: Number(payload.score || 0),
        miss: Number(payload.miss || 0),
        bestStreak: Number(payload.bestStreak || 0)
      }).catch(() => {});
    };

    core.onRaceFinish = async (summary = {}) => {
      await submitFinalResult(summary);
    };
  }

  async function heartbeat() {
    const ts = Date.now();
    await roomRef.child(`players/${uid}`).update({
      uid,
      pid: ctx.pid,
      name: ctx.name,
      ready: true,
      role: ctx.isHost ? 'host' : 'player',
      joinedAt: Number(ctx.joinedAt || ts),
      lastPingAt: ts
    });
  }

  async function submitFinalResult(summary = {}) {
    const ts = Date.now();

    await roomRef.child(`results/${uid}`).set({
      uid,
      pid: ctx.pid,
      score: Number(summary.score || 0),
      miss: Number(summary.miss || 0),
      bestStreak: Number(summary.bestStreak || 0),
      finished: true,
      updatedAt: ts
    });

    await roomRef.child(`progress/${uid}`).set({
      updatedAt: ts
    });
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