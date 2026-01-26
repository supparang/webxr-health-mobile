// === /herohealth/vr/hha-emoji-pack.js ===
// HHA Emoji Pack — SHARED (for Plate/Groups/GoodJunk)
// ✅ Single place to pick & decorate emojis consistently
// ✅ Deterministic if target provides t.rng (seeded)

'use strict';

import { FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup } from './food5-th.js';

export { FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup };

// pick by kind + groupIndex (0..4 or 1..5)
export function pickTargetEmoji(rng, { kind='good', groupIndex=0 } = {}){
  const r = (typeof rng === 'function') ? rng : Math.random;

  if(String(kind).toLowerCase() === 'junk'){
    return pickEmoji(r, JUNK.emojis);
  }
  // groupIndex can be 0..4 or 1..5
  const gid = (groupIndex >= 1 && groupIndex <= 5) ? groupIndex : (Number(groupIndex)||0) + 1;
  return emojiForGroup(r, gid);
}

// decorate DOM target (works with your mode-factory decorateTarget hook)
export function decorateEmojiTarget(el, t){
  if(!el) return;

  const rng = (t && typeof t.rng === 'function') ? t.rng : Math.random;
  const kind = t?.kind || 'good';
  const gi = (t?.groupIndex ?? 0);

  const emoji = pickTargetEmoji(rng, { kind, groupIndex: gi });

  // keep it crisp: one span
  el.textContent = '';
  const span = document.createElement('span');
  span.className = 'fg-emoji';
  span.textContent = emoji;
  el.appendChild(span);

  // aria label (nice for accessibility + debug)
  const gid = (gi >= 1 && gi <= 5) ? gi : (Number(gi)||0) + 1;
  const label = (String(kind).toLowerCase()==='junk')
    ? (JUNK.labelTH || 'JUNK')
    : (labelForGroup(gid) || `หมู่ ${gid}`);

  el.setAttribute('aria-label', `${label} ${emoji}`);
  el.dataset.gid = String(gid);
}