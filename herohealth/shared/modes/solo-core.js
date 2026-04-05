import { MATCH_STATUS, normalizePlayer } from './mode-base.js';

export function createSoloState({ gameId, player, diff = 'normal', timeLimit = 90, seed = String(Date.now()) }) {
  return {
    mode: 'solo',
    gameId: String(gameId || 'game'),
    status: MATCH_STATUS.LOBBY,
    diff: String(diff),
    timeLimit: Number(timeLimit || 90),
    seed: String(seed),
    player: normalizePlayer(player, 0),
    score: 0,
    progress: 0,
    finishedAt: 0
  };
}

export function startSolo(state) {
  state.status = MATCH_STATUS.PLAYING;
  state.startedAt = Date.now();
  return state;
}

export function patchSolo(state, patch = {}) {
  Object.assign(state, patch || {});
  return state;
}

export function finishSolo(state, summary = {}) {
  state.status = MATCH_STATUS.FINISHED;
  state.finishedAt = Date.now();
  state.summary = { ...summary };
  return state;
}