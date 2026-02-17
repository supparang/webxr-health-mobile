// === /herohealth/hub.links.js — attach hhGo to hub links (v20260217a) ===
'use strict';

import { hhGo } from './launch/launcher-core.js';

function onClick(e){
  const a = e.target.closest('[data-hhgo]');
  if (!a) return;

  // allow open in new tab
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  const target = a.getAttribute('data-hhgo');
  if (!target) return;
  e.preventDefault();

  // optional per-link defaults
  const defaults = {};
  const ds = a.dataset || {};
  if (ds.mode) defaults.mode = ds.mode;
  if (ds.diff) defaults.diff = ds.diff;
  if (ds.time) defaults.time = ds.time;
  if (ds.duration) defaults.duration = ds.duration;

  // some games still use ?time= / ?duration=
  hhGo(target, { defaults });
}

export function attachHubLinks(){
  document.addEventListener('click', onClick);
}