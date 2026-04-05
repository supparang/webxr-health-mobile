import {
  createBaseRoom,
  upsertPlayer,
  setPlayerReady,
  patchPlayer,
  startCountdown,
  startMatch,
  finishMatch
} from './mode-base.js';

export function createRaceRoom({ gameId, hostPlayer, diff = 'normal', timeLimit = 90, seed, meta = {} }) {
  return createBaseRoom({
    gameId,
    mode: 'race',
    hostPlayer,
    diff,
    timeLimit,
    seed,
    meta: { finishRule: 'score_or_goal', ...meta }
  });
}

export function joinRace(room, player) {
  return upsertPlayer(room, player);
}

export function readyRace(room, playerId, ready = true) {
  return setPlayerReady(room, playerId, ready);
}

export function beginRace(room, countdownMs = 2500) {
  return startCountdown(room, countdownMs);
}

export function startRace(room) {
  return startMatch(room);
}

export function submitRaceProgress(room, playerId, patch = {}) {
  patchPlayer(room, playerId, {
    score: Number(patch.score || 0),
    progress: Number(patch.progress || 0),
    bestStreak: Number(patch.bestStreak || 0),
    miss: Number(patch.miss || 0)
  });

  room.scoreBoard[playerId] = Number(patch.score || 0);
  room.progressBoard[playerId] = Number(patch.progress || 0);
  return room;
}

export function submitRaceFinish(room, playerId, patch = {}) {
  patchPlayer(room, playerId, {
    score: Number(patch.score || 0),
    progress: Number(patch.progress || 100),
    finishedAt: Date.now(),
    bestStreak: Number(patch.bestStreak || 0),
    miss: Number(patch.miss || 0)
  });

  const ordered = [...room.players].sort((a, b) => {
    if (!!a.finishedAt !== !!b.finishedAt) return a.finishedAt ? -1 : 1;
    if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return b.score - a.score;
  });

  ordered.forEach((p, i) => {
    patchPlayer(room, p.playerId, { rank: i + 1 });
  });

  room.winner = ordered[0]?.playerId || '';
  return room;
}

export function finishRace(room, summary = {}) {
  return finishMatch(room, { summary, winner: room.winner || summary.winner || '' });
}