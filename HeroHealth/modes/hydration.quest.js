// === /HeroHealth/modes/hydration.quest.js ===
// Proxy ไปใช้ engine หลักใน hydration.safe.js

import * as safe from './hydration.safe.js';

export async function boot(opts = {}) {
  return safe.boot(opts);
}

export default { boot };
