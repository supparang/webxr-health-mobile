// === /herohealth/gate/gate-games.js ===
// HeroHealth Gate Game Registry
// FULL PATCH v20260320-GATE-GAMES-CLEANOBJECTS-KIDS-ADV-FIX

export const GATE_GAMES = {
  // =========================
  // HYGIENE
  // =========================
  handwash: {
    cat: 'hygiene',
    label: 'Handwash',
    warmupTitle: 'วอร์มอัปก่อนเล่น Handwash',
    cooldownTitle: 'พักหลังเล่น Handwash',
    phaseFiles: {
      warmup: './games/handwash/warmup.js',
      cooldown: './games/handwash/cooldown.js'
    },
    styleFile: './games/handwash/style.css',
    run: '../hygiene-vr.html'
  },

  brush: {
    cat: 'hygiene',
    label: 'Brush',
    warmupTitle: 'วอร์มอัปก่อนเล่น Brush',
    cooldownTitle: 'พักหลังเล่น Brush',
    phaseFiles: {
      warmup: './games/brush/warmup.js',
      cooldown: './games/brush/cooldown.js'
    },
    styleFile: './games/brush/style.css',
    run: '../brush-vr.html'
  },

  bath: {
    cat: 'hygiene',
    label: 'Bath',
    warmupTitle: 'วอร์มอัปก่อนเล่น Bath',
    cooldownTitle: 'พักหลังเล่น Bath',
    phaseFiles: {
      warmup: './games/bath/warmup.js',
      cooldown: './games/bath/cooldown.js'
    },
    styleFile: './games/bath/style.css',
    run: '../bath-vr.html'
  },

  maskcough: {
    cat: 'hygiene',
    label: 'Mask & Cough',
    warmupTitle: 'วอร์มอัปก่อนเล่น Mask & Cough',
    cooldownTitle: 'พักหลังเล่น Mask & Cough',
    phaseFiles: {
      warmup: './games/maskcough/warmup.js',
      cooldown: './games/maskcough/cooldown.js'
    },
    styleFile: './games/maskcough/style.css',
    run: '../maskcough-vr.html'
  },

  germdetective: {
    cat: 'hygiene',
    label: 'Germ Detective',
    warmupTitle: 'วอร์มอัปก่อนเล่น Germ Detective',
    cooldownTitle: 'พักหลังเล่น Germ Detective',
    phaseFiles: {
      warmup: './games/germdetective/warmup.js',
      cooldown: './games/germdetective/cooldown.js'
    },
    styleFile: './games/germdetective/style.css',
    run: '../germ-detective-vr.html'
  },

  // -------------------------
  // Clean Objects — Advanced
  // -------------------------
  cleanobjects: {
    cat: 'hygiene',
    label: 'Clean Objects',
    warmupTitle: 'วอร์มอัปก่อนเล่น Clean Objects',
    cooldownTitle: 'พักหลังเล่น Clean Objects',
    phaseFiles: {
      warmup: './games/cleanobjects/warmup.js',
      cooldown: './games/cleanobjects/cooldown.js'
    },
    styleFile: './games/cleanobjects/style.css',
    run: '../vr-clean/home-clean.html'
  },

  // -------------------------
  // Clean Objects — Kids
  // -------------------------
  'cleanobjects-kids': {
    cat: 'hygiene',
    label: 'Clean Objects Kids',
    warmupTitle: 'วอร์มอัปก่อนเล่น Clean Objects Kids',
    cooldownTitle: 'พักหลังเล่น Clean Objects Kids',
    phaseFiles: {
      warmup: './games/cleanobjects-kids/warmup.js',
      cooldown: './games/cleanobjects-kids/cooldown.js'
    },
    styleFile: './games/cleanobjects-kids/style.css',
    run: '../vr-clean/clean-kids.html'
  }
};

// ----------------------------------
// aliases / normalize
// ----------------------------------
const ALIASES = {
  // advanced
  clean: 'cleanobjects',
  'clean-object': 'cleanobjects',
  'clean-objects': 'cleanobjects',
  'cleanobject': 'cleanobjects',
  'cleanobjects': 'cleanobjects',

  // kids
  'clean-kids': 'cleanobjects-kids',
  'clean-kid': 'cleanobjects-kids',
  'cleanobject-kids': 'cleanobjects-kids',
  'cleanobjects-kids': 'cleanobjects-kids',
  'clean-objects-kids': 'cleanobjects-kids'
};

export function normalizeGameId(v=''){
  const raw = String(v || '').trim().toLowerCase();
  if(!raw) return '';
  return ALIASES[raw] || raw;
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