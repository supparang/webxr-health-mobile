export async function createGame(args) {
  if (!window.createLegacyGoodJunkSolo) {
    await import('../goodjunk-solo-phaseboss-v2.js');
  }

  if (typeof window.createLegacyGoodJunkSolo !== 'function') {
    throw new Error('window.createLegacyGoodJunkSolo not found');
  }

  return window.createLegacyGoodJunkSolo(args || {});
}