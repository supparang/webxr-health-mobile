/* === /herohealth/plate/plate-coop-firebase.js ===
   HeroHealth Plate Coop Firebase Adapters
   PATCH v20260321-PLATE-COOP-FIREBASE-CHILDADDED
*/
'use strict';

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getDatabase,
  ref,
  get,
  set,
  remove,
  onValue,
  off,
  push,
  query,
  orderByChild,
  startAt,
  onChildAdded
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

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

export function createFirebaseAppIfNeeded(firebaseConfig){
  if (!firebaseConfig || typeof firebaseConfig !== 'object'){
    throw new Error('firebaseConfig is required');
  }

  if (getApps().length > 0){
    return getApp();
  }

  return initializeApp(firebaseConfig);
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
  firebaseConfig,
  db,
  basePath = 'herohealth/plate-coop'
} = {}){
  const app = db ? null : createFirebaseAppIfNeeded(firebaseConfig);
  const database = db || getDatabase(app);

  return {
    async getRoom(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return null;

      const snap = await get(ref(database, roomPath(basePath, id)));
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

      await set(ref(database, roomPath(basePath, id)), next);
    },

    async patchRoom(roomId, partial){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const snap = await get(ref(database, roomPath(basePath, id)));
      if (!snap.exists()) throw new Error(`Room not found: ${id}`);

      const prev = snap.val() || {};
      const next = safeMergeRoom(prev, partial);

      await set(ref(database, roomPath(basePath, id)), next);
    },

    subscribeRoom(roomId, cb){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const roomRef = ref(database, roomPath(basePath, id));

      const handler = (snap) => {
        try{
          cb?.(snap.exists() ? snap.val() : null);
        }catch(_){}
      };

      onValue(roomRef, handler);

      return () => {
        try{ off(roomRef, 'value', handler); }catch(_){}
      };
    },

    async deleteRoom(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return;
      await remove(ref(database, roomPath(basePath, id)));
    }
  };
}

export function createFirebaseNetAdapter({
  firebaseConfig,
  db,
  basePath = 'herohealth/plate-coop'
} = {}){
  const app = db ? null : createFirebaseAppIfNeeded(firebaseConfig);
  const database = db || getDatabase(app);

  return {
    async publishState(roomId, state){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const next = {
        ...deepClone(state),
        roomId: id,
        updatedAt: nowTs()
      };

      await set(ref(database, statePath(basePath, id)), next);
    },

    async getState(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return null;

      const snap = await get(ref(database, statePath(basePath, id)));
      return snap.exists() ? snap.val() : null;
    },

    subscribeState(roomId, cb){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const stateRef = ref(database, statePath(basePath, id));

      const handler = (snap) => {
        try{
          cb?.(snap.exists() ? snap.val() : null);
        }catch(_){}
      };

      onValue(stateRef, handler);

      return () => {
        try{ off(stateRef, 'value', handler); }catch(_){}
      };
    },

    async publishAction(roomId, action){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      const actionId =
        String(action?.id || '').trim() ||
        push(ref(database, actionsPath(basePath, id))).key;

      const payload = {
        ...deepClone(action),
        id: actionId,
        roomId: id,
        createdAt: Number(action?.createdAt || nowTs())
      };

      await set(ref(database, `${actionsPath(basePath, id)}/${actionId}`), payload);
    },

    subscribeActions(roomId, cb){
      const id = normalizeRoomId(roomId);
      if (!id) throw new Error('roomId required');

      let cutoffTs = nowTs();
      const seenIds = new Set();

      const q = query(
        ref(database, actionsPath(basePath, id)),
        orderByChild('createdAt'),
        startAt(cutoffTs)
      );

      const handler = (snap) => {
        try{
          if (!snap.exists()) return;

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

      onChildAdded(q, handler);

      return () => {
        try{ off(q, 'child_added', handler); }catch(_){}
      };
    },

    async clearRoom(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return;

      await Promise.all([
        remove(ref(database, statePath(basePath, id))),
        remove(ref(database, actionsPath(basePath, id)))
      ]);
    },

    async pruneOldActions(roomId, maxAgeMs = 10 * 60 * 1000){
      const id = normalizeRoomId(roomId);
      if (!id) return;

      const root = ref(database, actionsPath(basePath, id));
      const snap = await get(root);
      if (!snap.exists()) return;

      const now = nowTs();
      const data = snap.val() || {};
      const tasks = [];

      for (const [key, value] of Object.entries(data)){
        const createdAt = Number(value?.createdAt || 0);
        if (!createdAt || now - createdAt > maxAgeMs){
          tasks.push(remove(ref(database, `${actionsPath(basePath, id)}/${key}`)));
        }
      }

      if (tasks.length){
        await Promise.all(tasks);
      }
    }
  };
}