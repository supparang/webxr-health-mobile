import {
  createBaseRoom,
  upsertPlayer,
  setPlayerReady,
  patchPlayer,
  startCountdown,
  startMatch,
  finishMatch
} from './mode-base.js';

export function createCoopRoom({ gameId, hostPlayer, diff = 'normal', timeLimit = 90, seed, meta = {} }) {
  const room = createBaseRoom({
    gameId,
    mode: 'coop',
    hostPlayer,
    diff,
    timeLimit,
    seed,
    meta: { teamGoal: 100, ...meta }
  });
  room.teamGoal = Number(room.meta.teamGoal || 100);
  return room;
}

export function joinCoop(room, player) {
  return upsertPlayer(room, player);
}

export function readyCoop(room, playerId, ready = true) {
  return setPlayerReady(room, playerId, ready);
}

export function beginCoop(room, countdownMs = 2500) {
  return startCountdown(room, countdownMs);
}

export function startCoop(room) {
  return startMatch(room);
}

export function submitCoopContribution(room, playerId, patch = {}) {
  patchPlayer(room, playerId, {
    score: Number(patch.score || 0),
    contribution: Number(patch.contribution || 0),
    progress: Number(patch.progress || 0),
    bestStreak: Number(patch.bestStreak || 0),
    miss: Number(patch.miss || 0)
  });

  room.teamScore = room.players.reduce((sum, p) => sum + Number(p.score || 0), 0);
  return room;
}

export function setCoopTeamGoal(room, teamGoal) {
  room.teamGoal = Number(teamGoal || room.teamGoal || 0);
  return room;
}

export function finishCoop(room, summary = {}) {
  room.teamScore = room.players.reduce((sum, p) => sum + Number(p.score || 0), 0);
  room.teamResult = {
    success: !!summary.success,
    teamGoal: Number(summary.teamGoal || room.teamGoal || 0),
    teamScore: room.teamScore
  };
  return finishMatch(room, { summary });
}