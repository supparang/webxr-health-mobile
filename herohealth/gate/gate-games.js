// === /herohealth/gate/gate-games.js ===

export const GATE_GAMES = {
  // ...

  maskcough: {
    cat: 'hygiene',
    label: 'MaskCough',
    theme: 'maskcough',
    warmupTitle: 'MaskCough Quick Prep',
    cooldownTitle: 'MaskCough Calm Check',
    files: {
      warmup: './games/maskcough/warmup.js',
      cooldown: './games/maskcough/cooldown.js',
      style: './games/maskcough/style.css'
    },
    // ✅ สำคัญ: ให้ game flow ปลายทางเป็น v2
    run: '../vr-maskcough/maskcough-v2.html'
  },

  // ...
};

export function normalizeGameId(id=''){
  const s = String(id || '').trim().toLowerCase();
  if (s === 'mask-cough') return 'maskcough';
  if (s === 'mask_cough') return 'maskcough';
  if (s === 'maskcoughv2') return 'maskcough';
  return s;
}

export function getGameMeta(gameId=''){
  const id = normalizeGameId(gameId);
  return GATE_GAMES[id] || null;
}

export function getPhaseFile(gameId='', phase='warmup'){
  const meta = getGameMeta(gameId);
  if (!meta || !meta.files) return '';
  return phase === 'cooldown' ? meta.files.cooldown : meta.files.warmup;
}

export function getGameStyleFile(gameId=''){
  const meta = getGameMeta(gameId);
  return meta?.files?.style || '';
}

export function getRunFile(gameId=''){
  const meta = getGameMeta(gameId);
  return meta?.run || '';
}