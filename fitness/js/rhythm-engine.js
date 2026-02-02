// Longer pre-spawn for small screens / Cardboard so notes have time to fall
this._preSpawnSec = (this.mode === 'research')
  ? PRE_SPAWN_SEC
  : (isCVR ? 4.4 : (isMobile ? 3.4 : PRE_SPAWN_SEC));
// Tail length (pure UI) — improves timing visibility
this._noteTailPx = (isCVR ? 220 : (isMobile ? 130 : 110));