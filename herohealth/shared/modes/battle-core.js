import {
  createBaseRoom,
  upsertPlayer,
  setPlayerReady,
  patchPlayer,
  startCountdown,
  startMatch,
  finishMatch
} from './mode-base.js';

export function createBattleRoom({ gameId, hostPlayer, diff = 'normal', timeLimit = 90, seed, meta = {} }) {
  const room = createBaseRoom({
    gameId,
    mode: 'battle',
    hostPlayer,
    diff,
    timeLimit,
    seed,
    meta: { startHp: 100, ...meta }
  });
  room.players[0].hp = Number(room.meta.startHp || 100);
  return room;
}

export function joinBattle(room, player) {
  const next = upsertPlayer(room, { ...player, hp: Number(room.meta.startHp || 100) });
  return next;
}

export function readyBattle(room, playerId, ready = true) {
  return setPlayerReady(room, playerId, ready);
}

export function beginBattle(room, countdownMs = 2500) {
  return startCountdown(room, countdownMs);
}

export function startBattle(room) {
  return startMatch(room);
}

export function applyBattleHit(room, attackerId, defenderId, damage = 10, patch = {}) {
  const attacker = room.players.find((p) => p.playerId === attackerId);
  const defender = room.players.find((p) => p.playerId === defenderId);
  if (!attacker || !defender) return room;

  const shield = Number(defender.shield || 0);
  const dmg = Math.max(0, Number(damage || 0));
  const absorbed = Math.min(shield, dmg);
  const hpLoss = Math.max(0, dmg - absorbed);

  patchPlayer(room, attackerId, {
    score: Number(attacker.score || 0) + Number(patch.scoreGain || 0),
    bestStreak: Number(patch.bestStreak || attacker.bestStreak || 0)
  });

  patchPlayer(room, defenderId, {
    shield: Math.max(0, shield - absorbed),
    hp: Math.max(0, Number(defender.hp || 0) - hpLoss),
    miss: Number(defender.miss || 0) + Number(patch.extraMiss || 0)
  });

  if (Number(defender.hp || 0) <= 0) {
    room.winner = attackerId;
    finishMatch(room, { winner: attackerId, reason: 'ko' });
  }

  return room;
}

export function grantBattleShield(room, playerId, shield = 10) {
  const p = room.players.find((x) => x.playerId === playerId);
  if (!p) return room;
  patchPlayer(room, playerId, { shield: Number(p.shield || 0) + Number(shield || 0) });
  return room;
}

export function finishBattle(room, summary = {}) {
  if (!room.winner) {
    const ordered = [...room.players].sort((a, b) => {
      if (b.hp !== a.hp) return b.hp - a.hp;
      return b.score - a.score;
    });
    room.winner = ordered[0]?.playerId || '';
  }
  return finishMatch(room, { summary, winner: room.winner });
}