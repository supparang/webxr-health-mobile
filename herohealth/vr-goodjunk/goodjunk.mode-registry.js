export const GOODJUNK_MODE_REGISTRY = {
  solo: {
    id: 'solo',
    kind: 'solo',
    loader: () => import('./goodjunk.solo.loader.js')
  },
  duet: {
    id: 'duet',
    kind: 'duet',
    loader: () => import('./goodjunk.safe.duet.js')
  },
  race: {
    id: 'race',
    kind: 'race',
    loader: () => import('./goodjunk-race-engine.js')
  },
  battle: {
    id: 'battle',
    kind: 'battle',
    loader: () => import('./goodjunk-battle-engine.js')
  },
  coop: {
    id: 'coop',
    kind: 'coop',
    loader: () => import('./goodjunk.safe.coop.js')
  }
};

export function getGoodJunkModeConfig(mode = 'solo') {
  return GOODJUNK_MODE_REGISTRY[String(mode || 'solo')] || GOODJUNK_MODE_REGISTRY.solo;
}