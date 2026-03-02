// === /herohealth/vr/mp-score.js ===
// HeroHealth Multiplayer Score (Polling) — PRODUCTION
// PATCH v20260302-MP-POLL-BASE
'use strict';

function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; }
}
function nowIso(){ return new Date().toISOString(); }

export function createMPSession(opts){
  opts = opts || {};
  const api = String(opts.api || qs('api','')).trim();
  const logEnabled = String(opts.log ?? qs('log','0')) === '1';
  const runMode = String(opts.runMode || qs('run','play'));
  const projectTag = String(opts.projectTag || 'goodjunk');

  const sessionId = String(opts.sessionId || qs('session','') || '').trim();
  const team = String(opts.team || qs('team','solo')).trim().toLowerCase();
  const role = String(opts.role || qs('role','') || '').trim().toLowerCase();
  const pid  = String(opts.pid  || qs('pid','anon')).trim();

  const mp = String(opts.mp ?? qs('mp','0')) === '1';
  const pollMs = Math.max(800, Math.min(5000, Number(opts.pollMs || 2000) || 2000));

  let pollTimer = null;
  let lastSnap = null;

  function canUse(){
    return mp && !!sessionId && !!api;
  }

  async function postEvent(eventType, extra){
    if(!logEnabled || !api) return;
    const payload = Object.assign({
      timestampIso: nowIso(),
      projectTag,
      runMode,
      pid,
      sessionId,
      team,
      role,
      eventType,
      __extraJson: JSON.stringify(extra || {})
    }, extra || {});
    try{
      await fetch(api, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        keepalive: true
      });
    }catch(e){
      // 403/blocked/Offline => ignore safely
    }
  }

  async function join(){
    if(!canUse()) return;
    await postEvent('MP_JOIN', { mpMode: qs('mpMode','team-battle') });
  }

  async function delta(scoreDelta, reason){
    if(!canUse()) return;
    scoreDelta = Number(scoreDelta)||0;
    await postEvent('MP_SCORE_DELTA', { scoreDelta, reason: String(reason||'') });
  }

  async function end(extra){
    if(!canUse()) return;
    await postEvent('MP_END', extra || {});
  }

  // ---- polling snapshot ----
  // Expected GET:
  //   `${api}?op=mpScore&sessionId=...`
  // Response JSON suggestion:
  //   { sessionId, red:123, blue:95, leader:"red", leadGap:28, ts:... }
  async function poll(){
    if(!canUse()) return null;
    try{
      const url = new URL(api);
      url.searchParams.set('op','mpScore');
      url.searchParams.set('sessionId', sessionId);
      const res = await fetch(url.toString(), { method:'GET', cache:'no-store' });
      if(!res.ok) return null;
      const js = await res.json();
      lastSnap = js || null;
      window.dispatchEvent(new CustomEvent('hha:mp-snapshot', { detail: lastSnap }));
      return lastSnap;
    }catch(e){
      return null;
    }
  }

  function startPolling(){
    if(!canUse()) return;
    if(pollTimer) return;
    poll(); // immediate
    pollTimer = setInterval(poll, pollMs);
  }

  function stopPolling(){
    if(pollTimer){ clearInterval(pollTimer); pollTimer = null; }
  }

  return {
    mp, api, sessionId, team, role, pid,
    canUse,
    join, delta, end,
    poll, startPolling, stopPolling,
    getLastSnapshot: ()=> lastSnap
  };
}