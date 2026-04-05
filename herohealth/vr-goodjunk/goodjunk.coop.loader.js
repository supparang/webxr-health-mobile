export async function createGame(args) {
  if (!window.createLegacyGoodJunkCoop) {
    await import('./goodjunk.safe.coop.js');
  }

  if (typeof window.createLegacyGoodJunkCoop !== 'function') {
    throw new Error('window.createLegacyGoodJunkCoop not found');
  }

  return window.createLegacyGoodJunkCoop(args || {});
}