export async function createGame(args) {
  if (!window.createLegacyGoodJunkRace) {
    await import('./goodjunk-race-engine.js');
  }

  if (typeof window.createLegacyGoodJunkRace !== 'function') {
    throw new Error('window.createLegacyGoodJunkRace not found');
  }

  return window.createLegacyGoodJunkRace(args || {});
}