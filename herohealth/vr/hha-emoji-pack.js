// === /herohealth/vr/hha-emoji-pack.js ===
// HHA Emoji Pack — UNIVERSAL (PRODUCTION)
// ✅ One place to manage emojis/icons used across ALL games
// ✅ Works with mode-factory.js decorateTarget(el, target)
// ✅ Deterministic if you pass target.rng (seeded) from mode-factory
//
// Depends on: ./food5-th.js (stable mapping, do not drift)

'use strict';

import { FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup } from './food5-th.js';

/* -----------------------------------------
 * Game Icons (top-level / menu / tags)
 * ----------------------------------------- */
export const GAME_ICONS = Object.freeze({
  plate: '🍽️',
  groups: '🧠',
  goodjunk: '🍭',
  hydration: '💧',
});

/* -----------------------------------------
 * Target UI templates
 * ----------------------------------------- */
function clearEl(el){
  while(el.firstChild) el.removeChild(el.firstChild);
}

function mkSpan(cls, text){
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
}

function mkBadge(text, tone='neutral'){
  const b = document.createElement('span');
  b.className = `hhaBadge ${tone}`;
  b.textContent = text;
  return b;
}

/* -----------------------------------------
 * Emoji picking rules (deterministic-friendly)
 * ----------------------------------------- */
function rngFromTarget(target){
  // mode-factory exposes `target.rng` (seeded)
  // fallback to Math.random for non-seeded games
  return (target && typeof target.rng === 'function') ? target.rng : Math.random;
}

export function pickFoodEmojiForTarget(target, groupId){
  const rng = rngFromTarget(target);
  return emojiForGroup(rng, groupId);
}

export function pickJunkEmojiForTarget(target){
  const rng = rngFromTarget(target);
  return pickEmoji(rng, JUNK.emojis);
}

/* -----------------------------------------
 * Decorators (call from mode-factory decorateTarget)
 * ----------------------------------------- */

/**
 * Plate: good => show food emoji of 5 groups, junk => show junk emoji.
 * Also adds small group badge ("หมู่ 1..5") for learning reinforcement.
 */
export function decoratePlateTarget(el, target){
  // Expect: target.kind ('good'|'junk'), target.groupIndex (0..4)
  const kind = (target?.kind || 'good');
  const gi0 = Number(target?.groupIndex ?? 0);
  const groupId = clampInt(gi0 + 1, 1, 5);

  clearEl(el);

  const main = mkSpan('fg-emoji', kind === 'junk'
    ? pickJunkEmojiForTarget(target)
    : pickFoodEmojiForTarget(target, groupId)
  );

  // badge text
  const badgeText = (kind === 'junk')
    ? 'JUNK'
    : `หมู่ ${groupId}`;

  const badgeTone = (kind === 'junk') ? 'bad' : 'good';

  el.appendChild(main);
  el.appendChild(mkBadge(badgeText, badgeTone));

  // add data for CSS hooks
  el.dataset.group = String(groupId);
}

/**
 * Groups: always "good" conceptually, but we still support kind.
 * Show an emoji by group + always show the Thai label (short).
 * Great for practice mode (kids recognize faster).
 */
export function decorateGroupsTarget(el, target){
  const kind = (target?.kind || 'good');
  const gi0 = Number(target?.groupIndex ?? 0);
  const groupId = clampInt(gi0 + 1, 1, 5);

  clearEl(el);

  const main = mkSpan('fg-emoji', (kind === 'junk')
    ? pickJunkEmojiForTarget(target)
    : pickFoodEmojiForTarget(target, groupId)
  );

  // short label: "หมู่ 1" etc (avoid long text blocking play)
  const badgeTone = (kind === 'junk') ? 'bad' : 'good';
  const badge = mkBadge(kind === 'junk' ? 'JUNK' : `หมู่ ${groupId}`, badgeTone);

  el.appendChild(main);
  el.appendChild(badge);

  el.dataset.group = String(groupId);
}

/**
 * GoodJunk: no mapping 5 groups by default (recommended),
 * but if you want "learning overlay", you can enable it with opts.showGroupBadge = true
 */
export function decorateGoodJunkTarget(el, target, opts={}){
  const kind = (target?.kind || 'good');
  const gi0 = Number(target?.groupIndex ?? 0);
  const groupId = clampInt(gi0 + 1, 1, 5);
  const showGroupBadge = !!opts.showGroupBadge;

  clearEl(el);

  const mainEmoji = (kind === 'junk')
    ? pickJunkEmojiForTarget(target)
    : pickFoodEmojiForTarget(target, groupId);

  el.appendChild(mkSpan('fg-emoji', mainEmoji));

  // Only show group badge if explicitly enabled (keeps GoodJunk simple + fast)
  if(showGroupBadge && kind !== 'junk'){
    el.appendChild(mkBadge(`หมู่ ${groupId}`, 'good'));
  }else{
    // tiny semantic badge for good/junk
    el.appendChild(mkBadge(kind === 'junk' ? 'NO' : 'YES', kind === 'junk' ? 'bad' : 'good'));
  }

  el.dataset.group = String(groupId);
}

/* -----------------------------------------
 * Generic decorateTarget router
 * ----------------------------------------- */
/**
 * Universal entry: decorateTargetByGame('plate'|'groups'|'goodjunk', el, target, opts)
 */
export function decorateTargetByGame(gameKey, el, target, opts={}){
  const k = String(gameKey || '').toLowerCase();
  if(k === 'plate') return decoratePlateTarget(el, target);
  if(k === 'groups') return decorateGroupsTarget(el, target);
  if(k === 'goodjunk') return decorateGoodJunkTarget(el, target, opts);
  // fallback: plate-style
  return decoratePlateTarget(el, target);
}

/* -----------------------------------------
 * Helpers
 * ----------------------------------------- */
function clampInt(v, a, b){
  v = Math.floor(Number(v) || 0);
  return v < a ? a : (v > b ? b : v);
}

/* -----------------------------------------
 * Optional: provide CSS baseline classnames used by decorators
 * (You can style these in each game's css)
 * -----------------------------------------
 * .fg-emoji { font-size: 28px; line-height: 1; }
 * .hhaBadge { font-size: 10px; font-weight: 900; padding: 3px 7px; border-radius: 999px; }
 * .hhaBadge.good { background: rgba(34,197,94,.18); border: 1px solid rgba(34,197,94,.35); }
 * .hhaBadge.bad  { background: rgba(239,68,68,.18); border: 1px solid rgba(239,68,68,.35); }
 */