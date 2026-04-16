// /functions/english-store.js
'use strict';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

export async function createSessionDoc(sessionId, data) {
  await db.collection('englishSessions').doc(sessionId).set({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function getSessionDoc(sessionId) {
  const snap = await db.collection('englishSessions').doc(sessionId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function updateSessionDoc(sessionId, patch) {
  await db.collection('englishSessions').doc(sessionId).set({
    ...patch,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function appendSessionEvent(sessionId, event) {
  await db.collection('englishSessions').doc(sessionId)
    .collection('events')
    .add({
      ...event,
      createdAt: FieldValue.serverTimestamp()
    });
}

export async function saveLeaderboardEntry(unitId, uid, payload) {
  const dayKey = new Date().toISOString().slice(0, 10);
  await db.collection('englishLeaderboards')
    .doc(`${unitId}_${dayKey}`)
    .collection('entries')
    .doc(uid)
    .set({
      ...payload,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
}
