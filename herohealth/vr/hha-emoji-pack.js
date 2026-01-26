// === /herohealth/vr/hha-emoji-pack.js ===
// HHA Emoji Pack — SHARED (PRODUCTION)
// ------------------------------------------------------------
// ✅ Centralize emoji + labels across ALL games
// ✅ Reuse stable mapping from ./food5-th.js (DO NOT DRIFT)
// ✅ Provide decorateTarget helpers for mode-factory decorateTarget
// ✅ Supports seeded rng by receiving target.rng (deterministic research)
// ------------------------------------------------------------

'use strict';

import { FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup } from './food5-th.js';

/* ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------ */
function clamp(n, a, b){
  n = Number(n)||0;
  return n < a ? a : (n > b ? b : n);
}

function ensureNode(el, sel, tag='div', cls=''){
  let n = el.querySelector(sel);
  if(!n){
    n = document.createElement(tag);
    if(cls) n.className = cls;
    el.appendChild(n);
  }
  return n;
}

function setText(el, txt){
  if(!el) return;
  el.textContent = String(txt ?? '');
}

/* ------------------------------------------------------------
 * Public: Packs for UI lists, legends, etc.
 * ------------------------------------------------------------ */
export const HHA_PACK = Object.freeze({
  FOOD5,
  JUNK,
  pickEmoji,
  labelForGroup,
  emojiForGroup,
});

/* ------------------------------------------------------------
 * Target Decorators (for mode-factory decorateTarget)
 * - el: target DOM element
 * - t : target meta from mode-factory (has: kind, groupIndex, size, rng)
 * ------------------------------------------------------------ */

/**
 * decorateTargetPlate
 * Plate: good => emoji by groupIndex (0..4 => groupId 1..5)
 *       junk => emoji from JUNK
 * Adds:
 *  - .hhaEmoji (big)
 *  - .hhaBadge (label short)
 */
export function decorateTargetPlate(el, t){
  if(!el || !t) return;

  // size var for CSS scaling
  const size = clamp(t.size ?? 56, 36, 96);
  el.style.setProperty('--t', `${size}px`);

  const rng = (typeof t.rng === 'function') ? t.rng : Math.random;

  const emojiNode = ensureNode(el, '.hhaEmoji', 'span', 'hhaEmoji');
  const badgeNode = ensureNode(el, '.hhaBadge', 'span', 'hhaBadge');

  if((t.kind||'') === 'junk'){
    setText(emojiNode, pickEmoji(rng, JUNK.emojis));
    setText(badgeNode, 'JUNK');
    el.dataset.badge = 'junk';
    return;
  }

  // good
  const groupId = clamp((t.groupIndex ?? 0) + 1, 1, 5);
  setText(emojiNode, emojiForGroup(rng, groupId));

  // short label
  // หมู่ 1 โปรตีน -> "โปรตีน", หมู่ 2 คาร์โบไฮเดรต -> "คาร์บ", ฯลฯ
  const g = FOOD5[groupId];
  const short =
    (groupId===1) ? 'โปรตีน' :
    (groupId===2) ? 'คาร์บ' :
    (groupId===3) ? 'ผัก' :
    (groupId===4) ? 'ผลไม้' :
    (groupId===5) ? 'ไขมัน' : 'หมู่?';

  setText(badgeNode, short);
  el.dataset.badge = g?.key || `g${groupId}`;
}

/**
 * decorateTargetGroups
 * Groups: ALWAYS show emoji for the group itself (no junk concept by default)
 * If you want wrong-target style, set t.kind='junk' from spawner kinds.
 */
export function decorateTargetGroups(el, t){
  if(!el || !t) return;

  const size = clamp(t.size ?? 58, 40, 104);
  el.style.setProperty('--t', `${size}px`);

  const rng = (typeof t.rng === 'function') ? t.rng : Math.random;

  const emojiNode = ensureNode(el, '.hhaEmoji', 'span', 'hhaEmoji');
  const badgeNode = ensureNode(el, '.hhaBadge', 'span', 'hhaBadge');

  if((t.kind||'') === 'junk'){
    setText(emojiNode, pickEmoji(rng, JUNK.emojis));
    setText(badgeNode, 'ผิด');
    el.dataset.badge = 'junk';
    return;
  }

  const groupId = clamp((t.groupIndex ?? 0) + 1, 1, 5);
  setText(emojiNode, emojiForGroup(rng, groupId));

  const short =
    (groupId===1) ? 'โปรตีน' :
    (groupId===2) ? 'คาร์บ' :
    (groupId===3) ? 'ผัก' :
    (groupId===4) ? 'ผลไม้' :
    (groupId===5) ? 'ไขมัน' : 'หมู่?';

  setText(badgeNode, short);
  el.dataset.badge = `g${groupId}`;
}

/**
 * decorateTargetGoodJunk
 * GoodJunk: do NOT force 5 หมู่ (keep it "ดี vs ขยะ" for clarity)
 * good => random “healthy” emoji pool from FOOD5 mixed (lightly)
 * junk => JUNK
 */
export function decorateTargetGoodJunk(el, t){
  if(!el || !t) return;

  const size = clamp(t.size ?? 56, 36, 96);
  el.style.setProperty('--t', `${size}px`);

  const rng = (typeof t.rng === 'function') ? t.rng : Math.random;

  const emojiNode = ensureNode(el, '.hhaEmoji', 'span', 'hhaEmoji');
  const badgeNode = ensureNode(el, '.hhaBadge', 'span', 'hhaBadge');

  if((t.kind||'') === 'junk'){
    setText(emojiNode, pickEmoji(rng, JUNK.emojis));
    setText(badgeNode, 'ขยะ');
    el.dataset.badge = 'junk';
    return;
  }

  // healthy pool: sample from all FOOD5 emojis (balanced-ish)
  const gid = clamp(Math.floor(rng()*5)+1, 1, 5);
  setText(emojiNode, emojiForGroup(rng, gid));
  setText(badgeNode, 'ดี');
  el.dataset.badge = 'good';
}

/* ------------------------------------------------------------
 * Convenience: get decorator by game key
 * ------------------------------------------------------------ */
export function decoratorFor(game){
  const g = String(game||'').toLowerCase();
  if(g === 'plate') return decorateTargetPlate;
  if(g === 'groups') return decorateTargetGroups;
  if(g === 'goodjunk') return decorateTargetGoodJunk;
  return null;
}