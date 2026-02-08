/* === /herohealth/hha-gate.js ===
 * HeroHealth Warm-up Gate (STRICT)
 * - Blocks direct entry to main games unless warmup completed.
 * - Works with pass-through params + hub/back/next.
 */
(function(){
  'use strict';
  const WIN = window;

  function getQS(){
    try { return new URL(location.href).searchParams; }
    catch { return new URLSearchParams(); }
  }
  function hubUrl(){
    // keep current page's hub param if present, else fallback to /herohealth/hub.html if you want
    const q = getQS();
    return q.get('hub') || '';
  }
  function nowMs(){ try{ return Date.now(); }catch{ return +new Date(); } }

  // Keyed per "pid + mainId + run/studyId/phase/conditionGroup"
  function makeGateKey(mainId){
    const q = getQS();
    const pid = (q.get('pid') || '').trim() || 'NOPID';
    const run = (q.get('run') || '').trim() || 'play';
    const studyId = (q.get('studyId') || '').trim();
    const phase = (q.get('phase') || '').trim();
    const cg = (q.get('conditionGroup') || '').trim();
    // strict identity (research-safe)
    return `HHA_WARMUP_OK::${pid}::${run}::${studyId}::${phase}::${cg}::${mainId}`;
  }

  function isWarmupBypassed(){
    // ONLY allow bypass if explicitly set by developer (keep off in production)
    const q = getQS();
    return q.get('warmup') === '0';
  }

  function hasWarmup(mainId){
    const key = makeGateKey(mainId);
    try{
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      // TTL: allow within 30 minutes (tune)
      const ttlMs = 30 * 60 * 1000;
      if (!obj || !obj.ts) return false;
      if ((nowMs() - Number(obj.ts)) > ttlMs) return false;
      return obj.ok === true;
    }catch{
      return false;
    }
  }

  function buildHealthQuestUrl(opts){
    const q = getQS();
    const next = encodeURIComponent(location.href); // return to this exact game URL

    // Health Quest lives at /herohealth/health-quest.html
    const base = new URL(opts.healthQuestHref || './health-quest.html', location.href);

    // Pass-through all existing params (do NOT override)
    for (const [k,v] of q.entries()){
      if (k === 'hq' || k === 'main' || k === 'cat' || k === 'next' || k === 'back') continue;
      base.searchParams.set(k, v);
    }

    base.searchParams.set('hq', 'warmup');
    base.searchParams.set('main', opts.mainId);
    base.searchParams.set('cat', opts.cat || 'A');

    const hb = hubUrl();
    if (hb) base.searchParams.set('hub', hb);
    base.searchParams.set('back', hb || '');     // optional back
    base.searchParams.set('next', next);

    // Optional: force strict mode tag (for debugging)
    base.searchParams.set('gate', '1');

    return base.toString();
  }

  function hardenBackButton(){
    // Prevent simple backbutton skip after redirect to warmup
    // (If user tries, gate will still catch them again.)
    try{
      history.replaceState({hhaGate:1}, document.title, location.href);
    }catch{}
  }

  WIN.HHA_GATE = WIN.HHA_GATE || {};
  WIN.HHA_GATE.requireWarmup = function requireWarmup(opts){
    const mainId = String(opts.mainId || 'unknown').toLowerCase();
    const cat = String(opts.cat || 'A').toUpperCase();
    if (!mainId) return;

    if (isWarmupBypassed()) return; // keep OFF normally

    // If this page itself is Health Quest, never gate
    const q = getQS();
    if ((q.get('hq')||'').toLowerCase()) return;

    // Strict: must have warmup token
    if (!hasWarmup(mainId)){
      hardenBackButton();
      const url = buildHealthQuestUrl({
        mainId, cat,
        healthQuestHref: opts.healthQuestHref || './health-quest.html'
      });
      location.replace(url);
    }
  };

  WIN.HHA_GATE.markWarmupDone = function markWarmupDone(mainId){
    const key = makeGateKey(mainId);
    const payload = JSON.stringify({ ok:true, ts: nowMs() });
    try{ sessionStorage.setItem(key, payload); }catch{}
    try{ localStorage.setItem(key, payload); }catch{}
  };
})();
