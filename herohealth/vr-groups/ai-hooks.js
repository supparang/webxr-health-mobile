// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks (NON-MODULE) — SAFE
// ✅ No "export" (works with <script defer>)
// ✅ window.GroupsVR.AIHooks.attach({...})
// ✅ Disabled by default; enable only when caller passes enabled:true
// ✅ Never runs in research unless you explicitly enable it

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  WIN.GroupsVR = WIN.GroupsVR || {};

  // ---- internal state ----
  const S = {
    enabled: false,
    runMode: 'play',
    seed: '',
    attached: false,
    lastTickAt: 0,
    counters: {
      shots: 0,
      hits: 0,
      misses: 0,
      comboMax: 0
    }
  };

  function nowMs(){
    try { return performance.now(); } catch(_) { return Date.now(); }
  }

  function safeDispatch(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---- public API ----
  const API = {
    attach(cfg){
      cfg = cfg || {};
      S.runMode = String(cfg.runMode || 'play').toLowerCase();
      S.seed    = String(cfg.seed || '');
      S.enabled = !!cfg.enabled;

      // safety: default OFF in research
      if (S.runMode === 'research') S.enabled = false;

      if (S.attached) return;
      S.attached = true;

      // Hook: shooting
      WIN.addEventListener('hha:shoot', (ev)=>{
        if (!S.enabled) return;
        S.counters.shots++;
        // you can enrich with ev.detail later
      }, { passive:true });

      // Hook: score updates (engine emits misses/combos here in your HUD wiring)
      WIN.addEventListener('hha:score', (ev)=>{
        if (!S.enabled) return;
        const d = ev.detail || {};
        const misses = Number(d.misses ?? 0) || 0;
        const combo  = Number(d.combo  ?? 0) || 0;
        S.counters.misses = misses;
        if (combo > S.counters.comboMax) S.counters.comboMax = combo;
      }, { passive:true });

      // Hook: rank/accuracy
      WIN.addEventListener('hha:rank', (ev)=>{
        if (!S.enabled) return;
        const d = ev.detail || {};
        // d.accuracy, d.grade etc. can be used later
      }, { passive:true });

      // Hook: end summary (optional)
      WIN.addEventListener('hha:end', (ev)=>{
        if (!S.enabled) return;
        const d = ev.detail || {};
        safeDispatch('groups:ai_hooks_summary', {
          seed: S.seed,
          runMode: S.runMode,
          counters: Object.assign({}, S.counters),
          end: d
        });
      }, { passive:true });

      // light heartbeat for future AI director (does nothing heavy now)
      const it = setInterval(()=>{
        if (!S.enabled) return;
        const t = nowMs();
        if (t - S.lastTickAt < 800) return;
        S.lastTickAt = t;
        // placeholder for future AI Difficulty Director / micro-tips feed
      }, 900);

      // expose stop if you want later
      API._stop = ()=>{ try{ clearInterval(it); }catch(_){ } };

      safeDispatch('groups:ai_hooks_ready', { enabled: S.enabled, runMode: S.runMode });
    }
  };

  WIN.GroupsVR.AIHooks = API;
})();