/* === /herohealth/hha-gate.js ===
HHA Gate — Zone Daily Warmup/Cooldown (PID-based)
✅ Per-zone (nutrition/hygiene/fitness): 1x/day per pid
✅ Uses Bangkok day key
✅ Stores in localStorage under HHA_GATE_PROFILE::<pid>
✅ API:
  - HHA_GATE.requireWarmup({ zoneId, warmupHref, mainHrefOptional })
  - HHA_GATE.markWarmupDone(zoneId, pidOptional)
  - HHA_GATE.requireCooldown({ zoneId, cooldownHref })
  - HHA_GATE.markCooldownDone(zoneId, pidOptional)
  - HHA_GATE.getPid()
  - HHA_GATE.getDayKey()
*/
(function(){
  'use strict';
  const WIN = window;

  if (WIN.HHA_GATE) return;

  const ZONES = ['nutrition','hygiene','fitness'];

  // ---------- utils ----------
  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }
  function safeZone(z){
    z = String(z||'').toLowerCase().trim();
    return ZONES.includes(z) ? z : null;
  }
  function getDayKeyBangkok(){
    // YYYY-MM-DD in Asia/Bangkok
    try{
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year:'numeric', month:'2-digit', day:'2-digit'
      });
      return fmt.format(new Date()); // en-CA => 2026-02-08
    }catch(_){
      // fallback: local day (still ok if device in TH)
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const da = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${da}`;
    }
  }

  function readCtxPid(){
    // prefer ctx (HHA_CTX), fallback query pid
    try{
      if (WIN.HHA_CTX && typeof WIN.HHA_CTX.readCtx === 'function'){
        const ctx = WIN.HHA_CTX.readCtx() || null;
        const p = ctx && (ctx.pid || ctx.participantId);
        if (p && String(p).trim()) return String(p).trim();
      }
    }catch(_){}
    const p2 = qs('pid', null);
    return (p2 && String(p2).trim()) ? String(p2).trim() : '';
  }

  function profileKey(pid){ return `HHA_GATE_PROFILE::${pid||'ANON'}`; }

  function loadProfile(pid){
    try{
      const raw = localStorage.getItem(profileKey(pid));
      if (!raw) return { v:1, zones:{} };
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return { v:1, zones:{} };
      if (!obj.zones || typeof obj.zones !== 'object') obj.zones = {};
      return obj;
    }catch(_){
      return { v:1, zones:{} };
    }
  }

  function saveProfile(pid, prof){
    try{ localStorage.setItem(profileKey(pid), JSON.stringify(prof||{v:1,zones:{}})); }
    catch(_){}
  }

  function isDoneToday(prof, zoneId, kind, dayKey){
    // kind: 'warmup' | 'cooldown'
    const z = prof.zones?.[zoneId];
    if (!z) return false;
    const k = (kind === 'cooldown') ? 'cooldownDay' : 'warmupDay';
    return (z[k] === dayKey);
  }

  function markDone(prof, zoneId, kind, dayKey){
    prof.zones = prof.zones || {};
    prof.zones[zoneId] = prof.zones[zoneId] || {};
    const k = (kind === 'cooldown') ? 'cooldownDay' : 'warmupDay';
    prof.zones[zoneId][k] = dayKey;
  }

  function redirectTo(href, zoneId){
    // Pass-through current params + add zone= + return= (optional)
    const u = new URL(href, location.href);
    const cur = new URL(location.href).searchParams;

    // keep all current params
    for (const [k,v] of cur.entries()){
      u.searchParams.set(k, v);
    }

    // ensure zone param exists
    if (zoneId) u.searchParams.set('zone', zoneId);

    // add return url if not present (so quest page can send back)
    if (!u.searchParams.has('return')){
      u.searchParams.set('return', location.href);
    }

    location.replace(u.toString());
  }

  // ---------- public API ----------
  const API = {
    getPid(){ return readCtxPid(); },
    getDayKey(){ return getDayKeyBangkok(); },

    requireWarmup(opts){
      // opts: { zoneId, warmupHref }
      opts = opts || {};
      const zoneId = safeZone(opts.zoneId || qs('zone', null));
      if (!zoneId) return; // silent: must pass valid zone

      const warmupHref = String(opts.warmupHref || './quest-gate.html').trim();
      const pid = readCtxPid() || 'ANON';
      const dayKey = getDayKeyBangkok();

      const prof = loadProfile(pid);
      if (isDoneToday(prof, zoneId, 'warmup', dayKey)) return;

      // Not done => redirect NOW
      redirectTo(warmupHref, zoneId);
    },

    markWarmupDone(zoneId, pidOptional){
      zoneId = safeZone(zoneId || qs('zone', null));
      if (!zoneId) return false;
      const pid = (pidOptional && String(pidOptional).trim()) ? String(pidOptional).trim() : (readCtxPid() || 'ANON');
      const dayKey = getDayKeyBangkok();
      const prof = loadProfile(pid);
      markDone(prof, zoneId, 'warmup', dayKey);
      saveProfile(pid, prof);
      return true;
    },

    requireCooldown(opts){
      // opts: { zoneId, cooldownHref }
      opts = opts || {};
      const zoneId = safeZone(opts.zoneId || qs('zone', null));
      if (!zoneId) return;

      const cooldownHref = String(opts.cooldownHref || './cooldown.html').trim();
      const pid = readCtxPid() || 'ANON';
      const dayKey = getDayKeyBangkok();

      const prof = loadProfile(pid);
      if (isDoneToday(prof, zoneId, 'cooldown', dayKey)) return;

      redirectTo(cooldownHref, zoneId);
    },

    markCooldownDone(zoneId, pidOptional){
      zoneId = safeZone(zoneId || qs('zone', null));
      if (!zoneId) return false;
      const pid = (pidOptional && String(pidOptional).trim()) ? String(pidOptional).trim() : (readCtxPid() || 'ANON');
      const dayKey = getDayKeyBangkok();
      const prof = loadProfile(pid);
      markDone(prof, zoneId, 'cooldown', dayKey);
      saveProfile(pid, prof);
      return true;
    }
  };

  WIN.HHA_GATE = API;
})();
