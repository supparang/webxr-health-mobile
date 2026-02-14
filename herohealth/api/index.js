// === /herohealth/api/index.js ===
// HeroHealth — API init for HUB pages
// ✅ wires banner DOM -> HHA_API_STATUS.bindBanner
// ✅ runs probe once + retry
// ✅ exposes window.HHA_API.initHub()

'use strict';

import './api-status.js';
import { probeAPI } from './api-probe.js';

const WIN = window;

function qs(k, d=''){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
}

function pickEl(id){
  try{ return document.getElementById(id); }catch{ return null; }
}

/**
 * initHubAPI({
 *   endpoint, // API endpoint to probe
 *   dom: { dotId, titleId, msgId, detailId, retryId },
 * })
 */
export function initHubAPI(cfg = {}){
  const endpoint = String(cfg.endpoint || '').trim()
    || String(qs('api','')).trim()
    || ''; // allow ?api= override

  const dom = cfg.dom || {};
  const dotEl    = pickEl(dom.dotId    || 'apiDot');
  const titleEl  = pickEl(dom.titleId  || 'apiTitle');
  const msgEl    = pickEl(dom.msgId    || 'apiMsg');
  const detailEl = pickEl(dom.detailId || 'apiDetail'); // optional
  const retryEl  = pickEl(dom.retryId  || 'btnRetry');

  // bind banner
  let unbind = null;
  try{
    if(WIN.HHA_API_STATUS && typeof WIN.HHA_API_STATUS.bindBanner === 'function'){
      unbind = WIN.HHA_API_STATUS.bindBanner({
        dotEl, titleEl, msgEl, detailEl, retryEl,
        onRetry: ()=> probeAPI(endpoint)
      });
    }
  }catch(_){}

  // initial probe
  probeAPI(endpoint);

  return {
    endpoint,
    dispose: ()=>{ try{ unbind && unbind(); }catch(_){ } }
  };
}

// convenience global for hub.html (optional)
WIN.HHA_API = WIN.HHA_API || {};
WIN.HHA_API.initHub = initHubAPI;