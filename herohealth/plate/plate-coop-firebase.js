/* === /herohealth/plate/plate-coop-firebase.js ===
   HeroHealth Plate Coop Firebase Adapters
   PATCH v20260321-PLATE-COOP-FIREBASE

   Includes:
   - createFirebaseAppIfNeeded()
   - createFirebaseRoomAdapter()
   - createFirebaseNetAdapter()

   Requires:
   - Firebase Web SDK v10+ (ES modules)
   - Realtime Database enabled
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
  startAt
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

/* --------------------------------------------------
 * helpers
 * -------------------------------------------------- */
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

/* --------------------------------------------------
 * firebase app singleton
 * -------------------------------------------------- */
export function createFirebaseAppIfNeeded(firebaseConfig){
  if (!firebaseConfig || typeof firebaseConfig !== 'object'){
    throw new Error('firebaseConfig is required');
  }

  if (getApps().length > 0){
    return getApp();
  }

  return initializeApp(firebaseConfig);
}

/* --------------------------------------------------
 * paths
 * -------------------------------------------------- */
function roomPath(basePath, roomId){
  return `${basePath}/rooms/${normalizeRoomId(roomId)}`;
}

function statePath(basePath, roomId){
  return `${basePath}/states/${normalizeRoomId(roomId)}`;
}

function actionsPath(basePath, roomId){
  return `${basePath}/actions/${normalizeRoomId(roomId)}`;
}

/* --------------------------------------------------
 * ROOM ADAPTER
 * required by plate-coop-room.js:
 * - getRoom(roomId)
 * - setRoom(roomId, roomState)
 * - patchRoom(roomId, partial)
 * - subscribeRoom(roomId, cb)
 * - deleteRoom(roomId)
 * -------------------------------------------------- */
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

/* --------------------------------------------------
 * NET ADAPTER
 * required by plate-coop-net.js:
 * - publishState(roomId, state)
 * - getState(roomId)
 * - subscribeState(roomId, cb)
 * - publishAction(roomId, action)
 * - subscribeActions(roomId, cb)
 * - clearRoom(roomId)
 *
 * Structure:
 * /basePath/states/{roomId}
 * /basePath/actions/{roomId}/{actionId}
 * -------------------------------------------------- */
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

      const actionId = String(action?.id || '').trim() || push(ref(database, actionsPath(basePath, id))).key;
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

      const rootRef = ref(database, actionsPath(basePath, id));
      let lastSeenTs = 0;

      const q = query(rootRef, orderByChild('createdAt'), startAt(lastSeenTs || 0));

      const handler = (snap) => {
        try{
          if (!snap.exists()) return;

          const data = snap.val() || {};
          const list = Object.values(data)
            .filter(Boolean)
            .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

          for (const item of list){
            const ts = Number(item.createdAt || 0);
            if (ts >= lastSeenTs){
              lastSeenTs = Math.max(lastSeenTs, ts + 1);
              cb?.(item);
            }
          }
        }catch(_){}
      };

      onValue(q, handler);

      return () => {
        try{ off(rootRef, 'value', handler); }catch(_){}
      };
    },

    async clearRoom(roomId){
      const id = normalizeRoomId(roomId);
      if (!id) return;

      await Promise.all([
        remove(ref(database, statePath(basePath, id))),
        remove(ref(database, actionsPath(basePath, id)))
      ]);
    }
  };
}