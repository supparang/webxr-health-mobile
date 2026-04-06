// /herohealth/shared/herohealth-mode-config.js
// HeroHealth mode config
// PATCH v20260406-mode-config-a

(function (W) {
  'use strict';

  const MODE_CONFIG = {
    solo: {
      minPlayers: 1,
      maxPlayers: 1,
      teamMode: false,
      usesRoom: false,
      usesMatch: false,
      needsReady: false,
      needsLobby: false,
      hasRank: false,
      hasContribution: false,
      hasTeamScore: false
    },

    duet: {
      minPlayers: 2,
      maxPlayers: 2,
      teamMode: true,
      usesRoom: true,
      usesMatch: true,
      needsReady: true,
      needsLobby: true,
      hasRank: false,
      hasContribution: true,
      hasTeamScore: true
    },

    battle: {
      minPlayers: 2,
      maxPlayers: 2,
      teamMode: false,
      usesRoom: true,
      usesMatch: true,
      needsReady: true,
      needsLobby: true,
      hasRank: true,
      hasContribution: false,
      hasTeamScore: false
    },

    race: {
      minPlayers: 2,
      maxPlayers: 4,
      teamMode: false,
      usesRoom: true,
      usesMatch: true,
      needsReady: true,
      needsLobby: true,
      hasRank: true,
      hasContribution: false,
      hasTeamScore: false
    },

    coop: {
      minPlayers: 2,
      maxPlayers: 4,
      teamMode: true,
      usesRoom: true,
      usesMatch: true,
      needsReady: true,
      needsLobby: true,
      hasRank: false,
      hasContribution: true,
      hasTeamScore: true
    }
  };

  function getModeConfig(mode) {
    return MODE_CONFIG[mode] || MODE_CONFIG.solo;
  }

  function normalizeCapacity(mode, capacity) {
    const cfg = getModeConfig(mode);
    const n = Number(capacity);
    if (!Number.isFinite(n)) return cfg.maxPlayers;
    return Math.max(cfg.minPlayers, Math.min(cfg.maxPlayers, n));
  }

  W.HHA_MODE_CONFIG = MODE_CONFIG;
  W.HHA_getModeConfig = getModeConfig;
  W.HHA_normalizeCapacity = normalizeCapacity;

})(window);
