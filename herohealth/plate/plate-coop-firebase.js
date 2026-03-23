/* === /herohealth/plate/plate-coop-firebase.js ===
   HeroHealth Plate Coop Firebase Adapters
   COMPAT VERSION using /herohealth/firebase-config.js
   PATCH v20260323-PLATE-COOP-FIREBASE-COMPAT
*/
'use strict';

function nowTs(){
  return Date.now();
}

function deepClone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function normalizeRoomId(roomId=''){
  return String(roomId || '').trim().toUpperCase();
}

function safeMergeRoom(prev = {}, partial = {}){
  const next = {
    ...prev,
    ...deepClone(partial),
    updatedAt: nowTs()
  };

  if (partial.players){
    next.players = {
      ...(prev.players || {}),
      ...deepClone(partial.players)
    };

    if (partial.players.A){
      next.players.A = {
        ...(prev.players?.A || {}),
        ...deepClone(partial.players.A)
      };
    }

    if (partial.players.B){
      next.players.B = {
        ...(prev.players?.B || {}),
        ...deepClone(partial.players.B)
      };
    }
  }

  if (partial.config){
    next.config = {
      ...(prev.config || {}),
      ...deepClone(partial.config)
    };
  }

  if (partial.match){
    next.match = {
      ...(prev.match || {}),
      ...deepClone(partial.match)
    };
  }

  return next;
}

function ensureCompatDb(){
  const db = window.HHA_FIREBASE_DB;
  if (!db) {
    throw new Error('HHA_FIREBASE_DB unavailable. Make sure ../firebase-config.js is loaded first.');
  }
  return db;
}

function roomPath(basePath, roomId){
  return `${basePath}/rooms/${normalizeRoomId(roomId)}`;
}

function statePath(basePath, roomId){
  return `${basePath}/states/${normalizeRoomId(roomId)}`;
}

function actionsPath(basePath, roomId){
  return `${basePath}/actions/${normalizeRoomId(roomId)}`;
}

export function createFirebaseRoomAdapter({
  db = null,
  basePath = 'herohealth/plate-coop'
} = {}){
  const database = db || ensureCompatDb();

  return {
    async getRoom(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return null;

      const snap = await database.ref(roomPath(basePath, id)).get();
      return snap.exists() ? snap.val() : null;
    },

    async setRoom(roomId, roomState){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const next = {
        ...deepClone(roomState),
        roomId: id,
        updatedAt: nowTs()
      };

      await database.ref(roomPath(basePath, id)).set(next);
    },

    async patchRoom(roomId, partial){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const ref = database.ref(roomPath(basePath, id));
      const snap = await ref.get();
      if (!snap.exists()) throw new Error(`Room not found: ${id}`);

      const prev = snap.val() || {};
      const next = safeMergeRoom(prev, partial);

      await ref.set(next);
    },

    subscribeRoom(roomId, cb){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const ref = database.ref(roomPath(basePath, id));
      const handler = snap => {
        try{
          cb?.(snap.exists() ? snap.val() : null);
        }catch(_){}
      };

      ref.on('value', handler);

      return () => {
        try{ ref.off('value', handler); }catch(_){}
      };
    },

    async deleteRoom(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return;
      await database.ref(roomPath(basePath, id)).remove();
    }
  };
}

export function createFirebaseNetAdapter({
  db = null,
  basePath = 'herohealth/plate-coop'
} = {}){
  const database = db || ensureCompatDb();

  return {
    async publishState(roomId, state){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const next = {
        ...deepClone(state),
        roomId: id,
        updatedAt: nowTs()
      };

      await database.ref(statePath(basePath, id)).set(next);
    },

    async getState(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return null;

      const snap = await database.ref(statePath(basePath, id)).get();
      return snap.exists() ? snap.val() : null;
    },

    subscribeState(roomId, cb){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const ref = database.ref(statePath(basePath, id));
      const handler = snap => {
        try{
          cb?.(snap.exists() ? snap.val() : null);
        }catch(_){}
      };

      ref.on('value', handler);

      return () => {
        try{ ref.off('value', handler); }catch(_){}
      };
    },

    async publishAction(roomId, action){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const actionId =
        String(action?.id || '').trim() ||
        database.ref(actionsPath(basePath, id)).push().key;

      const payload = {
        ...deepClone(action),
        id: actionId,
        roomId: id,
        createdAt: Number(action?.createdAt || nowTs())
      };

      await database.ref(`${actionsPath(basePath, id)}/${actionId}`).set(payload);
    },

    subscribeActions(roomId, cb){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const seenIds = new Set();
      const cutoffTs = nowTs();

      const q = database
        .ref(actionsPath(basePath, id))
        .orderByChild('createdAt')
        .startAt(cutoffTs);

      const handler = snap => {
        try{
          const item = snap.val();
          if (!item || !item.id) return;

          if (seenIds.has(item.id)) return;
          seenIds.add(item.id);

          if (seenIds.size > 5000){
            const arr = Array.from(seenIds).slice(-2000);
            seenIds.clear();
            for (const x of arr) seenIds.add(x);
          }

          cb?.(item);
        }catch(_){}
      };

      q.on('child_added', handler);

      return () => {
        try{ q.off('child_added', handler); }catch(_){}
      };
    },

    async clearRoom(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return;

      await Promise.all([
        database.ref(statePath(basePath, id)).remove(),
        database.ref(actionsPath(basePath, id)).remove()
      ]);
    },

    async pruneOldActions(roomId, maxAgeMs = 10 * 60 * 1000){
      const id = normalizeRoomId(roomId);
      if (!id) return;

      const root = database.ref(actionsPath(basePath, id));
      const snap = await root.get();
      if (!snap.exists()) return;

      const now = nowTs();
      const data = snap.val() || {};
      const tasks = [];

      for (const [key, value] of Object.entries(data)){
        const createdAt = Number(value?.createdAt || 0);
        if (!createdAt || now - createdAt > maxAgeMs){
          tasks.push(database.ref(`${actionsPath(basePath, id)}/${key}`).remove());
        }
      }

      if (tasks.length){
        await Promise.all(tasks);
      }
    }
  };
}