export const MATCH_STATUS = Object.freeze({
  LOBBY: 'lobby',
  READY: 'ready',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  FINISHED: 'finished'
});

function uid(prefix = 'room') {
  return `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function normalizePlayer(player = {}, index = 0) {
  return {
    playerId: String(player.playerId || player.pid || `p${index + 1}`),
    pid: String(player.pid || player.playerId || `p${index + 1}`),
    name: String(player.name || `Player ${index + 1}`),
    ready: !!player.ready,
    connected: player.connected !== false,
    score: Number(player.score || 0),
    progress: Number(player.progress || 0),
    rank: Number(player.rank || 0),
    hp: Number(player.hp || 100),
    shield: Number(player.shield || 0),
    contribution: Number(player.contribution || 0),
    miss: Number(player.miss || 0),
    bestStreak: Number(player.bestStreak || 0),
    finishedAt: Number(player.finishedAt || 0)
  };
}

export function createBaseRoom({
  gameId,
  mode,
  hostPlayer,
  diff = 'normal',
  timeLimit = 90,
  seed = String(Date.now()),
  meta = {}
}) {
  const host = normalizePlayer(hostPlayer, 0);
  host.ready = true;

  return {
    roomId: uid(mode || 'room'),
    matchId: uid('match'),
    gameId: String(gameId || 'game'),
    mode: String(mode || 'solo'),
    status: MATCH_STATUS.LOBBY,
    diff: String(diff || 'normal'),
    timeLimit: Number(timeLimit || 90),
    seed: String(seed || Date.now()),
    createdAt: Date.now(),
    startedAt: 0,
    finishedAt: 0,
    countdownMs: 2500,
    winner: '',
    teamGoal: 0,
    teamScore: 0,
    players: [host],
    scoreBoard: {},
    progressBoard: {},
    rematch: { requestedBy: [], acceptedBy: [] },
    meta: { ...meta }
  };
}

export function upsertPlayer(room, playerPatch) {
  const player = normalizePlayer(playerPatch, room.players.length);
  const idx = room.players.findIndex((p) => p.playerId === player.playerId);
  if (idx >= 0) {
    room.players[idx] = { ...room.players[idx], ...player };
  } else {
    room.players.push(player);
  }
  return room;
}

export function setPlayerReady(room, playerId, ready = true) {
  const p = room.players.find((x) => x.playerId === playerId);
  if (p) p.ready = !!ready;
  room.status = room.players.every((x) => x.ready) ? MATCH_STATUS.READY : MATCH_STATUS.LOBBY;
  return room;
}

export function startCountdown(room, countdownMs = 2500) {
  room.status = MATCH_STATUS.COUNTDOWN;
  room.countdownMs = Number(countdownMs || 2500);
  room.countdownStartAt = Date.now();
  return room;
}

export function startMatch(room) {
  room.status = MATCH_STATUS.PLAYING;
  room.startedAt = Date.now();
  return room;
}

export function finishMatch(room, patch = {}) {
  room.status = MATCH_STATUS.FINISHED;
  room.finishedAt = Date.now();
  Object.assign(room, patch || {});
  return room;
}

export function patchPlayer(room, playerId, patch = {}) {
  const p = room.players.find((x) => x.playerId === playerId);
  if (!p) return room;
  Object.assign(p, patch || {});
  return room;
}

export function requestRematch(room, playerId) {
  if (!room.rematch.requestedBy.includes(playerId)) {
    room.rematch.requestedBy.push(playerId);
  }
  return room;
}

export function acceptRematch(room, playerId) {
  if (!room.rematch.acceptedBy.includes(playerId)) {
    room.rematch.acceptedBy.push(playerId);
  }
  return room;
}

export function allAcceptedRematch(room) {
  return room.players.length > 0 && room.players.every((p) => room.rematch.acceptedBy.includes(p.playerId));
}

export function resetForRematch(room) {
  room.matchId = uid('match');
  room.status = MATCH_STATUS.LOBBY;
  room.startedAt = 0;
  room.finishedAt = 0;
  room.winner = '';
  room.teamScore = 0;
  room.scoreBoard = {};
  room.progressBoard = {};
  room.rematch = { requestedBy: [], acceptedBy: [] };
  room.players = room.players.map((p) => ({
    ...p,
    ready: false,
    score: 0,
    progress: 0,
    rank: 0,
    hp: 100,
    shield: 0,
    contribution: 0,
    miss: 0,
    bestStreak: 0,
    finishedAt: 0
  }));
  return room;
}