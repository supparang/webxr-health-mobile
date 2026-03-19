// === /herohealth/shared/nutrition-cloud.js ===
// Cloud logger / Apps Script queue for nutrition games
// PATCH v20260318-NUTRITION-SHARED-FULL

import { normalizeGameKey } from './nutrition-common.js';

const QUEUE_KEY = 'HHA_PENDING_UPLOADS';

function safeParseArray(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-300)));
}

export function getPendingCloudQueue() {
  return safeParseArray(localStorage.getItem(QUEUE_KEY));
}

export function enqueueCloudPacket(packet) {
  const queue = getPendingCloudQueue();
  queue.push(packet);
  saveQueue(queue);
  return queue.length;
}

export function removeQueuedPacket(packetId) {
  const queue = getPendingCloudQueue().filter(item => item?.packetId !== packetId);
  saveQueue(queue);
  return queue.length;
}

export function buildResearchBase(ctx, sessionMeta = {}) {
  return {
    ts: Date.now(),
    pid: ctx.pid,
    studentId: ctx.studentId,
    studyId: ctx.studyId,
    classId: ctx.classId,
    sectionId: ctx.sectionId,
    sessionLabel: ctx.sessionLabel,

    gameId: ctx.gameId,
    gameKey: normalizeGameKey(ctx.gameId),
    game: ctx.game,
    cat: ctx.cat,
    theme: ctx.theme,

    phase: ctx.phase,
    run: ctx.run,
    mode: ctx.mode,
    diff: ctx.diff,
    time: ctx.time,
    seed: ctx.seed,
    engine: ctx.engine,
    view: ctx.view,

    group: ctx.group,
    cohort: ctx.cohort,
    conditionGroup: ctx.conditionGroup,

    gatePhase: ctx.gatePhase,
    launcher: ctx.launcher,
    returnTo: ctx.returnTo,
    hub: ctx.hub,

    sessionId: sessionMeta.sessionId || '',
    durationMs: sessionMeta.durationMs || 0
  };
}

export function buildCloudPacket({ ctx, sessionMeta, payloadType, metrics = {}, summary = {}, raw = {} }) {
  const base = buildResearchBase(ctx, sessionMeta);
  const packetId = `${base.gameKey}-${base.pid}-${base.sessionId || Date.now()}-${payloadType}`;

  return {
    packetId,
    payloadType,
    createdAt: Date.now(),
    endpoint: ctx.logEndpoint || '',
    packet: {
      source: 'herohealth-nutrition',
      version: '20260318-A',
      base,
      metrics,
      summary,
      raw
    }
  };
}

export async function postPacketToEndpoint(endpoint, packet) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(packet)
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return true;
}

export async function sendOrQueuePacket(ctx, packet) {
  const endpoint = ctx.logEndpoint || packet.endpoint || '';

  if (!endpoint || ctx.cloudMode === 'local') {
    enqueueCloudPacket(packet);
    return {
      ok: false,
      queued: true,
      reason: endpoint ? 'forced-local' : 'missing-endpoint'
    };
  }

  try {
    await postPacketToEndpoint(endpoint, packet.packet);
    return {
      ok: true,
      queued: false
    };
  } catch (err) {
    enqueueCloudPacket(packet);
    return {
      ok: false,
      queued: true,
      reason: String(err?.message || err)
    };
  }
}

export async function flushPendingQueue(ctx) {
  const endpoint = ctx.logEndpoint || '';
  if (!endpoint) {
    return {
      sent: 0,
      remaining: getPendingCloudQueue().length,
      skipped: true
    };
  }

  const queue = getPendingCloudQueue();
  let sent = 0;

  for (const item of queue) {
    try {
      await postPacketToEndpoint(endpoint, item.packet);
      removeQueuedPacket(item.packetId);
      sent += 1;
    } catch (err) {
      console.warn('[nutrition-cloud] flush item failed:', err);
      break;
    }
  }

  return {
    sent,
    remaining: getPendingCloudQueue().length,
    skipped: false
  };
}