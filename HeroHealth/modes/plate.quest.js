// === /HeroHealth/modes/plate.quest.js ===
// Proxy ใช้ engine หลักจาก plate.safe.js

import * as safe from './plate.safe.js';

export async function boot(opts = {}) {
  return safe.boot(opts);
}

export default { boot };
