import {
  createBaseRoom,
  upsertPlayer,
  setPlayerReady,
  patchPlayer,
  startCountdown,
  startMatch,
  finishMatch
} from './mode-base.js';

export function createDuetRoom({ gameId, hostPlayer, diff = 'normal', timeLimit = 90, seed, meta = {} }) {
  return createBaseRoom({
    gameId,
    mode: 'duet',
    hostPlayer,
    diff,
    timeLimit,
    seed,
    meta: { pairGoal: 0, ...meta }
  });
}

export function joinDuet(room, player) {
  return upsertPlayer(room, player);
}

export function readyDuet(room, playerId, ready = true) {
  return setPlayerReady(room, playerId, ready);
}

export function beginDuet(room, countdownMs = 2500) {
  startCountdown(room, countdownMs);
  return room;
}

export function startDuet(room) {
  return startMatch(room);
}

export function submitDuetContribution(room, playerId, patch = {}) {
  patchPlayer(room, playerId, {
    score: Number(patch.score || 0),
    progress: Number(patch.progress || 0),
    contribution: Number(patch.contribution || 0),
    bestStreak: Number(patch.bestStreak || 0),
    miss: Number(patch.miss || 0)
  });

  room.teamScore = room.players.reduce((sum, p) => sum + Number(p.score || 0), 0);
  return room;
}

export function finishDuet(room, summary = {}) {
  room.teamScore = room.players.reduce((sum, p) => sum + Number(p.score || 0), 0);
  room.teamResult = {
    success: !!summary.success,
    pairGoal: Number(summary.pairGoal || room.meta?.pairGoal || 0),
    teamScore: room.teamScore
  };
  return finishMatch(room, { summary });
}