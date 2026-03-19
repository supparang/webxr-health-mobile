// === /herohealth/gate/gate-games.js ===
// FULL PATCH v20260319-GATE-GAMES-GROUPS-CANONICAL

export const GATE_GAMES = {
  groups: {
    cat: 'nutrition',
    label: 'Food Groups',
    theme: 'groups',
    warmupTitle: 'Food Groups Warmup',
    cooldownTitle: 'Food Groups Cooldown',
    files: {
      warmup: './games/groups/warmup.js?v=20260319a',
      cooldown: './games/groups/cooldown.js?v=20260319a',
      style: './games/groups/style.css?v=20260319a'
    },
    runCandidates: [
      '../vr-groups/groups-v1.html'
    ]
  }
};

export const GAME_ALIASES = {
  group: 'groups',
  groups: 'groups',
  'food-groups': 'groups',
  foodgroups: 'groups',
  food_groups: 'groups'
};

export function normalizeGameId(game = '') {
  const key = String(game || '').trim().toLowerCase();
  return GAME_ALIASES[key] || key;
}

export function getGameMeta(game) {
  return GATE_GAMES[normalizeGameId(game)] || null;
}

export function getGameFiles(game) {
  const meta = getGameMeta(game);
  return meta?.files || null;
}

export function getPhaseFile(game, phase = 'warmup') {
  const files = getGameFiles(game);
  if (!files) return '';
  return String(phase || '').toLowerCase() === 'cooldown'
    ? files.cooldown
    : files.warmup;
}

export function getGameStyleFile(game) {
  const files = getGameFiles(game);
  return files?.style || '';
}

export function getRunCandidates(game) {
  const meta = getGameMeta(game);
  return Array.isArray(meta?.runCandidates) ? meta.runCandidates : [];
}