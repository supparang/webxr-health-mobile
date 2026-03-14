// === /herohealth/gate/gate-games.js ===
// PATCH: add cleanobjects gate mapping

export const GATE_GAMES = {
  groups: {
    label: 'GroupsVR',
    category: 'nutrition',
    warmupTitle: 'วอร์มอัปก่อนเล่น GroupsVR',
    cooldownTitle: 'คูลดาวน์หลังเล่น GroupsVR',
    phaseFiles: {
      warmup: './games/groups/warmup.js',
      cooldown: './games/groups/cooldown.js'
    },
    styleFile: './games/groups/style.css'
  },

  hydration: {
    label: 'HydrationVR',
    category: 'nutrition',
    warmupTitle: 'วอร์มอัปก่อนเล่น HydrationVR',
    cooldownTitle: 'คูลดาวน์หลังเล่น HydrationVR',
    phaseFiles: {
      warmup: './games/hydration/warmup.js',
      cooldown: './games/hydration/cooldown.js'
    },
    styleFile: './games/hydration/style.css'
  },

  plate: {
    label: 'PlateVR',
    category: 'nutrition',
    warmupTitle: 'วอร์มอัปก่อนเล่น PlateVR',
    cooldownTitle: 'คูลดาวน์หลังเล่น PlateVR',
    phaseFiles: {
      warmup: './games/plate/warmup.js',
      cooldown: './games/plate/cooldown.js'
    },
    styleFile: './games/plate/style.css'
  },

  goodjunk: {
    label: 'GoodJunkVR',
    category: 'nutrition',
    warmupTitle: 'วอร์มอัปก่อนเล่น GoodJunkVR',
    cooldownTitle: 'คูลดาวน์หลังเล่น GoodJunkVR',
    phaseFiles: {
      warmup: './games/goodjunk/warmup.js',
      cooldown: './games/goodjunk/cooldown.js'
    },
    styleFile: './games/goodjunk/style.css'
  },

  cleanobjects: {
    label: 'Clean Objects',
    category: 'hygiene',
    warmupTitle: 'วอร์มอัปก่อนเล่น Clean Objects',
    cooldownTitle: 'คูลดาวน์หลังเล่น Clean Objects',
    phaseFiles: {
      warmup: './games/cleanobjects/warmup.js',
      cooldown: './games/cleanobjects/cooldown.js'
    },
    styleFile: './games/cleanobjects/style.css'
  }
};

export function normalizeGameId(v=''){
  return String(v || '').trim().toLowerCase();
}

export function getGameMeta(game){
  return GATE_GAMES[normalizeGameId(game)] || null;
}

export function getPhaseFile(game, mode){
  const meta = getGameMeta(game);
  if(!meta || !meta.phaseFiles) return '';
  return meta.phaseFiles[String(mode || '').toLowerCase()] || '';
}

export function getGameStyleFile(game){
  const meta = getGameMeta(game);
  return meta?.styleFile || '';
}