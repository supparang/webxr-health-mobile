export async function createGame(args) {
  if (!window.createLegacyGoodJunkDuet) {
    await import('./goodjunk.safe.duet.js');
  }

  if (typeof window.createLegacyGoodJunkDuet !== 'function') {
    throw new Error('window.createLegacyGoodJunkDuet not found');
  }

  return window.createLegacyGoodJunkDuet(args || {});
}