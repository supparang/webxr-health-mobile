/* UX Quest • Legacy Act III–V Router
 * Canonical CSAI2601 no longer uses old Act III–V/B5 campaign logic.
 * It now routes all legacy late-course pages to the single canonical node player.
 */
(() => {
  'use strict';

  const path = String(location.pathname || '').toLowerCase();
  const map = [
    ['w7-wireframe-heist', 'W7'],
    ['b3-ux-blueprint-gauntlet', 'B3'],
    ['w9-design-system-vault', 'W9'],
    ['w10-responsive-rescue', 'W10'],
    ['w11-contrast-cipher', 'W11'],
    ['b4-design-system-siege', 'B4'],
    ['w12-component-command', 'W12'],
    ['w13-prototype-pulse', 'W13'],
    ['w14-validation-lab', 'W14'],
    ['b5-ux-launch-defense', 'W15']
  ];
  const hit = map.find(([needle]) => path.includes(needle));
  if (!hit) return;

  const target = `./csai2601-canonical-node.html?node=${encodeURIComponent(hit[1])}`;
  if (!path.includes('csai2601-canonical-node')) location.replace(target);
})();
